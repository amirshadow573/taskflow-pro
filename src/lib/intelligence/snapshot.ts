/**
 * Productivity snapshots (Phase 13 §29).
 *
 * A HISTORICAL aggregation over the existing records — weekly and monthly
 * buckets built from the same rows the app already stores (tasks with
 * `completedAt`, time blocks, execution sessions, focus sessions). This gives
 * trend analysis and the reviews an efficient, bounded input instead of forcing
 * every surface to walk all history on each render (§31).
 *
 * No new table, no write path: the Phase 10 `PlanningSnapshot` and Phase 12
 * `ExecutionSnapshot` remain the live "today" snapshots, and these are the
 * period rollups a future AI layer would read (§44).
 */
import type { ExecutionSession } from "@/lib/execution";
import { blockMinutes, sessionMinutes, uniqueFocusRows } from "./rows";
import { classifyLoad } from "@/lib/scheduling";
import type { IntelBlock, IntelFocus, IntelTask } from "./input";
import type { ProductivitySnapshot } from "./types";
import { dayKeyOf, daysBetween, monthKeyOf, weekStartOf } from "./window";
import { addDays } from "@/lib/scheduling/time";

export interface SnapshotInput {
  tasks: IntelTask[];
  blocks: IntelBlock[];
  sessions: ExecutionSession[];
  focusSessions: IntelFocus[];
  dayKey: string;
  nowMs: number;
  dailyCapacityMinutes: number;
  /** How many weeks of weekly buckets to build (default 12). */
  weeks?: number;
  /** How many months of monthly buckets to build (default 3). */
  months?: number;
}

function periodStats(
  input: SnapshotInput,
  from: string,
  to: string,
): Omit<ProductivitySnapshot, "period" | "periodKey" | "from" | "to"> {
  const inRange = (day: string) => day >= from && day <= to;

  const scheduledMinutes = input.blocks.reduce((sum, b) => {
    if (!inRange(b.day) || b.status === "cancelled" || b.kind === "break") return sum;
    return sum + (blockMinutes(b) ?? 0);
  }, 0);

  const plannedMinutes = input.tasks.reduce((sum, t) => {
    if (t.parentId || !t.dueDate || !inRange(t.dueDate)) return sum;
    return sum + (t.estimateMinutes ?? 0);
  }, 0);

  const windowSessions = input.sessions.filter((s) => inRange(s.day));
  const focusRows = uniqueFocusRows(input.sessions, input.focusSessions).filter((f) =>
    inRange(f.date),
  );
  const actualMinutes =
    windowSessions.reduce((sum, s) => sum + sessionMinutes(s, input.nowMs), 0) +
    focusRows.reduce((sum, f) => sum + f.actualMinutes, 0);
  const focusMinutes =
    windowSessions
      .filter((s) => s.kind === "focus" || s.kind === "study")
      .reduce((sum, s) => sum + sessionMinutes(s, input.nowMs), 0) +
    focusRows.reduce((sum, f) => sum + f.actualMinutes, 0);

  const completedSessions = windowSessions.filter((s) => s.state === "completed");
  let estimateTotal = 0;
  let estimateError = 0;
  for (const s of completedSessions) {
    if (s.plannedMinutes == null || s.plannedMinutes <= 0) continue;
    estimateTotal += s.plannedMinutes;
    estimateError += Math.abs(sessionMinutes(s, input.nowMs) - s.plannedMinutes);
  }

  let completedTasks = 0;
  let onTime = 0;
  let withDeadline = 0;
  const activeDays = new Set<string>();
  for (const t of input.tasks) {
    if (t.parentId) continue;
    if (t.status === "done" && t.completedAt != null) {
      const day = dayKeyOf(t.completedAt);
      if (inRange(day)) {
        completedTasks += 1;
        activeDays.add(day);
        if (t.dueDate) {
          withDeadline += 1;
          if (day <= t.dueDate) onTime += 1;
        }
      }
    }
  }
  for (const s of windowSessions) {
    if (sessionMinutes(s, input.nowMs) > 0) activeDays.add(s.day);
  }
  for (const f of focusRows) {
    if (f.actualMinutes > 0) activeDays.add(f.date);
  }

  const overdueTasks = input.tasks.filter(
    (t) => !t.parentId && t.status !== "done" && !!t.dueDate && t.dueDate < to,
  ).length;
  const blockedTasks = input.tasks.filter(
    (t) => !t.parentId && t.status !== "done" && t.tags.some((tag) => tag.trim() === "مسدود"),
  ).length;

  const periodDays = Math.max(1, daysBetween(from, to) + 1);
  const capacity = input.dailyCapacityMinutes * periodDays;

  return {
    plannedMinutes,
    scheduledMinutes,
    actualMinutes,
    completedTasks,
    overdueTasks,
    blockedTasks,
    focusMinutes,
    planningAccuracy:
      estimateTotal > 0
        ? Math.max(0, Math.round(100 - (estimateError / estimateTotal) * 100))
        : null,
    scheduleAdherence:
      scheduledMinutes > 0 ? Math.round((actualMinutes / scheduledMinutes) * 100) / 100 : null,
    workloadState: capacity > 0 ? classifyLoad(plannedMinutes + scheduledMinutes, capacity) : null,
    deadlineReliability: withDeadline > 0 ? onTime / withDeadline : null,
    activeDays: activeDays.size,
  };
}

export function buildProductivitySnapshots(input: SnapshotInput): ProductivitySnapshot[] {
  const out: ProductivitySnapshot[] = [];

  /* ---- weekly buckets (newest first for direct UI use) ---- */
  const weeks = input.weeks ?? 12;
  for (let i = 0; i < weeks; i += 1) {
    const start = weekStartOf(addDays(input.dayKey, -7 * i));
    const end = addDays(start, 6);
    if (end > input.dayKey) continue; // the current, incomplete week is "today"
    out.push({ period: "week", periodKey: start, from: start, to: end, ...periodStats(input, start, end) });
  }

  /* ---- monthly buckets ---- */
  const months = input.months ?? 3;
  const seen = new Set<string>();
  for (let i = 0; i < months; i += 1) {
    const cursor = new Date(`${input.dayKey}T00:00:00`);
    cursor.setMonth(cursor.getMonth() - i);
    const key = monthKeyOf(dayKeyOf(cursor.getTime()));
    if (seen.has(key)) continue;
    seen.add(key);
    const first = `${key}-01`;
    const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const last = `${key}-${lastDay < 10 ? `0${lastDay}` : lastDay}`;
    if (last >= input.dayKey) continue; // current month is in progress
    out.push({
      period: "month",
      periodKey: key,
      from: first,
      to: last,
      ...periodStats(input, first, last),
    });
  }

  return out;
}
