/**
 * Execution metrics (Phase 12 §15).
 *
 * Operational measurements of what actually happened — completion rate,
 * estimate accuracy, interruptions, late starts, missed blocks. These are NOT
 * gamification stats: nothing here feeds XP, levels, skills or persona stats,
 * and nothing is stored. Every value is derived from the same arrays the UI
 * already subscribes to, so there is no extra database traffic (§31).
 */
import { minutesOf } from "@/lib/scheduling";
import type {
  ExecutionBlockLite,
  ExecutionEventRow,
  ExecutionMetrics,
  ExecutionSession,
} from "./types";

/** Local minutes-since-midnight for an epoch timestamp. */
function minuteOfDay(at: number): number {
  const d = new Date(at);
  return d.getHours() * 60 + d.getMinutes();
}

/** Work time of a session in ms: frozen when ended, live while running. */
export function sessionElapsedMs(session: ExecutionSession, nowMs: number): number {
  const end = session.endedAt ?? nowMs;
  const paused = session.pausedMs + (session.pausedAt ? Math.max(0, end - session.pausedAt) : 0);
  return Math.max(0, end - session.startedAt - paused);
}

/** True when the session is still open (running or paused) — §35. */
export function isActiveSession(session: ExecutionSession): boolean {
  return session.state === "in_progress" || session.state === "paused";
}

export function isFinishedSession(session: ExecutionSession): boolean {
  return session.state === "completed" || session.state === "abandoned";
}

/** A finishable session whose clock is still running belongs to today. */
export function sessionMinutes(session: ExecutionSession, nowMs: number): number {
  return Math.max(0, Math.round(sessionElapsedMs(session, nowMs) / 60000));
}

/** Late-start threshold: how many minutes after the block the user began. */
export const LATE_START_THRESHOLD_MINUTES = 10;
/** Over/under-run threshold: max(absolute, share of the estimate). */
export const VARIANCE_MIN_MINUTES = 10;
export const VARIANCE_SHARE = 0.25;

export interface MetricsInput {
  sessions: ExecutionSession[];
  events: ExecutionEventRow[];
  blocks: ExecutionBlockLite[];
  /** Injected clock (ms) so tests stay deterministic. */
  nowMs: number;
}

export function buildMetrics({ sessions, events, blocks, nowMs }: MetricsInput): ExecutionMetrics {
  const finished = sessions.filter(isFinishedSession);
  const completed = finished.filter((s) => s.state === "completed");
  const abandoned = finished.filter((s) => s.state === "abandoned");

  const minutesByKind: Record<string, number> = {};
  let actualMinutes = 0;
  for (const s of sessions) {
    const m = sessionMinutes(s, nowMs);
    if (m <= 0) continue;
    actualMinutes += m;
    minutesByKind[s.kind] = (minutesByKind[s.kind] ?? 0) + m;
  }

  let estimatedMinutes = 0;
  let varianceMinutes = 0;
  let estimateSamples = 0;
  let estimateAbsError = 0;
  for (const s of finished) {
    if (s.plannedMinutes == null || s.plannedMinutes <= 0) continue;
    const actual = sessionMinutes(s, nowMs);
    estimatedMinutes += s.plannedMinutes;
    varianceMinutes += actual - s.plannedMinutes;
    estimateAbsError += Math.abs(actual - s.plannedMinutes);
    estimateSamples += 1;
  }

  const estimateAccuracyPct =
    estimateSamples > 0 && estimatedMinutes > 0
      ? Math.max(0, Math.round(100 - (estimateAbsError / estimatedMinutes) * 100))
      : null;

  const interruptions = sessions.filter((s) => s.pausedMs > 0).length;

  const blockById = new Map(blocks.map((b) => [b._id, b]));
  let lateStartCount = 0;
  for (const s of sessions) {
    if (!s.blockId) continue;
    const block = blockById.get(s.blockId);
    if (!block || block.day !== s.day) continue;
    const scheduled = minutesOf(block.startTime);
    if (scheduled === null) continue;
    if (minuteOfDay(s.startedAt) - scheduled >= LATE_START_THRESHOLD_MINUTES) lateStartCount += 1;
  }

  const missedBlocks = blocks.filter((b) => b.status === "missed").length;

  const recoveryEvents = events.filter((e) => e.type === "RECOVERY_ACTION");
  const reschedules = recoveryEvents.filter((e) => actionOf(e) === "reschedule").length;
  const postponements = events.filter((e) => e.type === "TASK_POSTPONED").length;

  const finishable = completed.length + abandoned.length;
  const completionRate = finishable > 0 ? completed.length / finishable : null;

  return {
    sessions: sessions.length,
    completedSessions: completed.length,
    abandonedSessions: abandoned.length,
    actualMinutes,
    estimatedMinutes,
    varianceMinutes: estimateSamples > 0 ? varianceMinutes : null,
    estimateAccuracyPct,
    completionRate,
    averageSessionMinutes: sessions.length > 0 ? Math.round(actualMinutes / sessions.length) : null,
    interruptedSessions: interruptions,
    lateStartCount,
    missedBlocks,
    reschedules,
    postponements,
    feedbackCount: sessions.filter((s) => !!s.feedback).length,
    minutesByKind,
  };
}

/** Read the `action` field out of a recovery event's JSON meta (never throws). */
export function actionOf(event: ExecutionEventRow): string | null {
  if (!event.meta) return null;
  try {
    const parsed = JSON.parse(event.meta) as { action?: unknown };
    return typeof parsed.action === "string" ? parsed.action : null;
  } catch {
    return null;
  }
}

/** Grouped recovery actions for the snapshot (§16). */
export function recoveryActionCounts(events: ExecutionEventRow[]): Array<{ action: string; count: number }> {
  const counts = new Map<string, number>();
  for (const e of events) {
    if (e.type !== "RECOVERY_ACTION") continue;
    const action = actionOf(e) ?? "unknown";
    counts.set(action, (counts.get(action) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count || a.action.localeCompare(b.action));
}
