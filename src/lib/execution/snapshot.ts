/**
 * Execution snapshot (Phase 12 §16).
 *
 * A deterministic, structured summary of "how today actually went" — planned
 * vs scheduled vs actual, deviations, recoveries and the live session. This is
 * the object a future AI layer will consume (see AIExecutionContext); today it
 * simply feeds the daily review, the dashboard module and the insights panel.
 *
 * Pure: no storage writes, no clock reads beyond the injected `nowMs`.
 */
import type { WorkloadState } from "@/lib/planning";
import { minutesOf } from "@/lib/scheduling";
import {
  buildMetrics,
  isFinishedSession,
  recoveryActionCounts,
  sessionMinutes,
  type MetricsInput,
} from "./metrics";
import type {
  DeviationSignal,
  ExecutionBlockLite,
  ExecutionMetrics,
  ExecutionRecommendation,
  ExecutionSession,
  ExecutionSnapshot,
  ExecutionTaskLite,
} from "./types";

const BLOCKED_TAG = "مسدود";

export interface SnapshotInput extends MetricsInput {
  dayKey: string;
  persona: string;
  tasks: ExecutionTaskLite[];
  metrics: ExecutionMetrics;
  deviations: DeviationSignal[];
  recommendations: ExecutionRecommendation[];
  activeSession: ExecutionSession | null;
  /** Phase 10 signals (never re-derived here). */
  planningEstimatedMinutes?: number | null;
  workloadState?: WorkloadState | null;
  planningAvailableMinutes?: number | null;
  /** Phase 11 signals. */
  todayScheduledMinutes?: number | null;
  todayAvailableMinutes?: number | null;
}

function sumBlockMinutes(blocks: ExecutionBlockLite[], dayKey: string): number | null {
  const day = blocks.filter((b) => b.day === dayKey && b.status !== "cancelled");
  if (day.length === 0) return null;
  let total = 0;
  let counted = 0;
  for (const b of day) {
    const start = minutesOf(b.startTime);
    const end = minutesOf(b.endTime);
    if (start === null || end === null || end <= start) continue;
    total += end - start;
    counted += 1;
  }
  return counted > 0 ? total : null;
}

function estimatesForDay(tasks: ExecutionTaskLite[], dayKey: string): number | null {
  let total = 0;
  let counted = 0;
  for (const t of tasks) {
    if (t.dueDate !== dayKey) continue;
    if (t.status === "done") continue;
    const estimate = t.estimateMinutes;
    if (estimate == null || estimate <= 0) continue;
    total += estimate;
    counted += 1;
  }
  return counted > 0 ? total : null;
}

export function buildExecutionSnapshot(input: SnapshotInput): ExecutionSnapshot {
  const metrics = input.metrics ?? buildMetrics(input);

  const partialSessions = input.sessions.filter(
    (s) => s.feedback === "partial" || (s.state === "abandoned" && sessionMinutes(s, input.nowMs) >= 10),
  ).length;

  const rescheduledTasks = new Set(
    input.events
      .filter((e) => e.type === "RECOVERY_ACTION" && e.taskId)
      .map((e) => e.taskId as string),
  ).size;

  const blockedTasks = input.tasks.filter((t) =>
    (t.tags ?? []).some((tag) => tag.toLowerCase().trim() === BLOCKED_TAG),
  ).length;

  const driftSignal = input.deviations.find((d) => d.kind === "SCHEDULE_DRIFT");
  const plannedMinutes =
    estimatesForDay(input.tasks, input.dayKey) ?? input.planningEstimatedMinutes ?? null;

  return {
    date: input.dayKey,
    persona: input.persona,
    plannedMinutes,
    scheduledMinutes: input.todayScheduledMinutes ?? sumBlockMinutes(input.blocks, input.dayKey),
    actualMinutes: metrics.actualMinutes,
    availableMinutes: input.todayAvailableMinutes ?? input.planningAvailableMinutes ?? null,
    estimatedMinutes: metrics.estimatedMinutes > 0 ? metrics.estimatedMinutes : null,
    actualVsEstimated: metrics.varianceMinutes,
    completedSessions: metrics.completedSessions,
    partialSessions,
    abandonedSessions: metrics.abandonedSessions,
    missedBlocks: metrics.missedBlocks,
    rescheduledTasks,
    blockedTasks,
    scheduleDrift: driftSignal?.minutes ?? null,
    workloadState: input.workloadState ?? null,
    activeSession: input.activeSession,
    deviations: input.deviations,
    recoveryActions: recoveryActionCounts(input.events),
    recommendations: input.recommendations,
    generatedAt: input.nowMs,
  };
}

/** Tasks finished today (by execution history) — used by the review surface. */
export function completedTaskIdsToday(
  sessions: ExecutionSession[],
  tasks: ExecutionTaskLite[],
  nowMs: number,
): string[] {
  void nowMs;
  const ids = new Set<string>();
  const known = new Set(tasks.map((t) => t._id));
  for (const s of sessions) {
    if (!isFinishedSession(s) || s.state !== "completed" || !s.taskId) continue;
    if (known.has(s.taskId)) ids.add(s.taskId);
  }
  return [...ids];
}
