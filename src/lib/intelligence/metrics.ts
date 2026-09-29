/**
 * Productivity metrics layer (Phase 13 §3 / §5 / §15).
 *
 * ONE place computes the window-level numbers every surface reads. It consumes
 * the same raw rows the rest of the app already subscribes to (tasks, blocks,
 * execution sessions/events, focus sessions) — no new tracking, no second
 * source of truth — and it is deliberately broader than the UI (§3: the engine
 * may calculate more than it shows).
 *
 * Today's reading is NOT recomputed here: the Phase 12 `ExecutionSnapshot`
 * stays the authority for "today", and this layer is window-scoped aggregation.
 */
import type { ExecutionEventRow, ExecutionSession } from "@/lib/execution";
import type { IntelBlock, IntelFocus, IntelTask, IntelligenceInput } from "./input";
import { blockMinutes, estimatedSessions, sessionMinutes, uniqueFocusRows } from "./rows";
import type { ProductivityMetrics, TimeWindow } from "./types";
import { dayKeyOf, dayKeysFor, windowStartDay } from "./window";

export interface MetricsScope {
  window: TimeWindow;
  days: number;
  from: string;
  to: string;
  dayKeys: string[];
}

export function metricsScope(dayKey: string, days: number, window: TimeWindow): MetricsScope {
  return {
    window,
    days,
    from: windowStartDay(dayKey, days),
    to: dayKey,
    dayKeys: dayKeysFor(dayKey, days),
  };
}

export interface MetricsInput {
  scope: MetricsScope;
  tasks: IntelTask[];
  blocks: IntelBlock[];
  sessions: ExecutionSession[];
  events: ExecutionEventRow[];
  focusSessions: IntelFocus[];
  nowMs: number;
}

export function buildProductivityMetrics(input: MetricsInput): ProductivityMetrics {
  const { scope } = input;
  const inWindow = new Set(scope.dayKeys);
  const fromTs = Date.parse(`${scope.from}T00:00:00`);

  const rootTasks = input.tasks.filter((t) => !t.parentId);
  const openTasks = rootTasks.filter((t) => t.status !== "done");
  const overdueTasks = openTasks.filter((t) => !!t.dueDate && t.dueDate < scope.to);

  const completedTasks = rootTasks.filter(
    (t) => t.status === "done" && t.completedAt != null && t.completedAt >= fromTs,
  ).length;
  const createdTasks = rootTasks.filter(
    (t) => t.createdAt != null && t.createdAt >= fromTs,
  ).length;

  /* ---- planned / scheduled / actual (§5) ---- */
  const plannedMinutes = rootTasks.reduce((sum, t) => {
    if (!t.dueDate || !inWindow.has(t.dueDate)) return sum;
    const est = t.estimateMinutes ?? 0;
    return est > 0 ? sum + est : sum;
  }, 0);

  const scheduledMinutes = input.blocks.reduce((sum, b) => {
    if (!inWindow.has(b.day) || b.status === "cancelled" || b.kind === "break") return sum;
    return sum + (blockMinutes(b) ?? 0);
  }, 0);

  const windowSessions = input.sessions.filter((s) => inWindow.has(s.day));
  const windowFocus = uniqueFocusRows(input.sessions, input.focusSessions).filter((f) =>
    inWindow.has(f.date),
  );
  const focusMinutes = windowFocus.reduce((sum, f) => sum + f.actualMinutes, 0);
  const sessionMinutesTotal = windowSessions.reduce((s, x) => s + sessionMinutes(x, input.nowMs), 0);
  const actualMinutes = sessionMinutesTotal + focusMinutes;

  const scheduleAdherence =
    scheduledMinutes > 0 ? Math.min(1.5, actualMinutes / scheduledMinutes) : null;
  const planningAdherence =
    plannedMinutes > 0 ? Math.min(1.5, actualMinutes / plannedMinutes) : null;
  const scheduleDriftMinutes = scheduledMinutes > 0 ? scheduledMinutes - actualMinutes : null;

  /* ---- outcomes ---- */
  const completedSessions = windowSessions.filter((s) => s.state === "completed").length;
  const abandonedSessions = windowSessions.filter((s) => s.state === "abandoned").length;
  const missedBlocks = input.blocks.filter(
    (b) => inWindow.has(b.day) && b.status === "missed",
  ).length;

  const rescheduledTasks = new Set(
    input.events
      .filter((e) => e.type === "RECOVERY_ACTION" && inWindow.has(e.day) && e.taskId)
      .map((e) => e.taskId as string),
  ).size;
  const postponedTasks = new Set(
    input.events
      .filter((e) => e.type === "TASK_POSTPONED" && inWindow.has(e.day) && e.taskId)
      .map((e) => e.taskId as string),
  ).size;

  /* ---- consistency basics (§15) ---- */
  const activeDaySet = new Set<string>();
  for (const t of rootTasks) {
    if (t.status === "done" && t.completedAt != null) {
      const day = dayKeyOf(t.completedAt);
      if (inWindow.has(day)) activeDaySet.add(day);
    }
  }
  for (const s of windowSessions) {
    if (sessionMinutes(s, input.nowMs) > 0) activeDaySet.add(s.day);
  }
  for (const f of windowFocus) {
    if (f.actualMinutes > 0) activeDaySet.add(f.date);
  }

  /* ---- estimation accuracy (§6 foundation) ---- */
  const estimated = estimatedSessions(windowSessions);
  let absError = 0;
  let estimateTotal = 0;
  for (const s of estimated) {
    const planned = s.plannedMinutes ?? 0;
    estimateTotal += planned;
    absError += Math.abs(sessionMinutes(s, input.nowMs) - planned);
  }
  const estimateAccuracyPct =
    estimated.length > 0 && estimateTotal > 0
      ? Math.max(0, Math.round(100 - (absError / estimateTotal) * 100))
      : null;

  return {
    window: scope.window,
    days: scope.days,
    completedTasks,
    createdTasks,
    completionRate: createdTasks > 0 ? completedTasks / createdTasks : null,
    openTasks: openTasks.length,
    overdueTasks: overdueTasks.length,
    plannedMinutes,
    scheduledMinutes,
    actualMinutes,
    scheduleAdherence,
    planningAdherence,
    scheduleDriftMinutes,
    completedSessions,
    abandonedSessions,
    missedBlocks,
    rescheduledTasks,
    postponedTasks,
    activeDays: activeDaySet.size,
    estimateSamples: estimated.length,
    estimateAccuracyPct,
  };
}

/** Convenience wrapper used by the facade. */
export function metricsFromInput(
  input: IntelligenceInput,
  scope: MetricsScope,
): ProductivityMetrics {
  return buildProductivityMetrics({
    scope,
    tasks: input.tasks,
    blocks: input.blocks,
    sessions: input.sessions,
    events: input.events,
    focusSessions: input.focusSessions,
    nowMs: input.nowMs,
  });
}
