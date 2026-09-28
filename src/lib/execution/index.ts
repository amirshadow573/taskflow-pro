/**
 * ExecutionEngine facade (Phase 12 §2 / §28).
 *
 * One pure function — `computeExecution(input)` — runs the whole deterministic
 * execution layer over already-loaded application data:
 *
 *   ExecutionTrackingService   recordExecutionEvent       (backend: taskCore.ts)
 *   ExecutionSessionService    execution lifecycle        (backend: execution.ts)
 *   ActualDurationService      elapsedOf / sessionMinutes (metrics.ts)
 *   ExecutionFeedbackService   feedback chips             (types.ts)
 *   DeviationService           detectDeviations           (deviation.ts)
 *   DelayService               REPEATED_DELAY signal      (deviation.ts)
 *   BlockedWorkService         BLOCKED_TASK               (recovery.ts)
 *   EstimationLearning         learnEstimates             (learning.ts)
 *   RecoveryService            buildExecutionRecovery     (recovery.ts)
 *   ExecutionPatterns          buildWeeklyInsight         (weekly.ts)
 *   ExecutionSnapshotService   buildExecutionSnapshot     (snapshot.ts)
 *
 * PURE: no side effects, no storage writes, no backend calls. Consumers
 * memoize the call (src/hooks/use-execution.ts), so the dashboard never
 * recomputes execution on every render (§31 / §32).
 *
 * The facade composes the pure engine modules in the dependency order that
 * the spec demands: metrics → deviations → learning → recovery → snapshot →
 * weekly.
 */
import type { AttentionBand, WorkloadState } from "@/lib/planning";
import type { NextActionProject } from "@/lib/next-action";
import { minutesOf } from "@/lib/scheduling";
import { buildMetrics } from "./metrics";
import { detectDeviations } from "./deviation";
import { buildExecutionRecovery } from "./recovery";
import { buildExecutionSnapshot } from "./snapshot";
import { learnEstimates, insightForTask } from "./learning";
import { buildWeeklyInsight, type WeeklyExecutionInsight } from "./weekly";
import type {
  DeviationSignal,
  EstimateInsight,
  ExecutionBlockLite,
  ExecutionEventRow,
  ExecutionMetrics,
  ExecutionRecommendation,
  ExecutionSession,
  ExecutionSnapshot,
  ExecutionTaskLite,
} from "./types";

/* ------------------------------------------------------------------ */
/* Input / Output                                                      */
/* ------------------------------------------------------------------ */

export interface ExecutionInput {
  dayKey: string;
  persona: string;
  tasks: ExecutionTaskLite[];
  projects: NextActionProject[];
  blocks: ExecutionBlockLite[];
  /** Sessions over the learning window (include today). */
  sessions: ExecutionSession[];
  events: ExecutionEventRow[];
  activeSession: ExecutionSession | null;
  /** Injected clock (ms) so tests stay deterministic. */
  nowMs: number;
  /* Phase 10 signals (never re-derived here). */
  priorities: Array<{ taskId: string; score: number; attention: AttentionBand }>;
  workloadState?: WorkloadState | null;
  planningEstimatedMinutes?: number | null;
  planningAvailableMinutes?: number | null;
  nextActionTaskId?: string;
  /* Phase 11 signals. */
  todayScheduledMinutes?: number | null;
  todayAvailableMinutes?: number | null;
  conflicts?: Array<{ kind: string; day: string; blockId?: string; detail: string }>;
  unscheduledTaskIds?: string[];
}

export interface ExecutionResult {
  dayKey: string;
  persona: string;
  metrics: ExecutionMetrics;
  deviations: DeviationSignal[];
  insights: EstimateInsight[];
  recommendations: ExecutionRecommendation[];
  snapshot: ExecutionSnapshot;
  activeSession: ExecutionSession | null;
  weekly: WeeklyExecutionInsight;
}

/* ------------------------------------------------------------------ */
/* Facade                                                              */
/* ------------------------------------------------------------------ */

export function computeExecution(input: ExecutionInput): ExecutionResult {
  /* One-day scope for today's execution surface (filtered from the window). */
  const todaySessions = input.sessions.filter((s) => s.day === input.dayKey);
  const todayEvents = input.events.filter((e) => e.day === input.dayKey);
  const todayBlocks = input.blocks.filter((b) => b.day === input.dayKey);

  const metrics = buildMetrics({
    sessions: todaySessions,
    events: todayEvents,
    blocks: todayBlocks,
    nowMs: input.nowMs,
  });

  const deviations = detectDeviations({
    dayKey: input.dayKey,
    sessions: todaySessions,
    events: todayEvents,
    blocks: todayBlocks,
    tasks: input.tasks,
    nowMs: input.nowMs,
    workloadState: input.workloadState ?? null,
    todayScheduledMinutes: input.todayScheduledMinutes,
    todayAvailableMinutes: input.todayAvailableMinutes,
  });

  const insights = learnEstimates({
    sessions: input.sessions,
    tasks: input.tasks,
    nowMs: input.nowMs,
  });

  /* Per-task learning note for the REPEATED_DELAY recovery text (§14). */
  const estimateNoteByTask: Record<string, string> = {};
  for (const task of input.tasks) {
    const insight = insightForTask(task, insights);
    if (insight) estimateNoteByTask[task._id] = insight.note;
  }

  /* Remaining flexible work today — the overload / empty-capacity math. */
  let remainingScheduledMinutes: number | null = null;
  {
    let total = 0;
    let any = false;
    for (const b of todayBlocks) {
      if (b.status !== "planned") continue;
      if (b.kind === "break") continue;
      const s = minutesOf(b.startTime);
      const e = minutesOf(b.endTime);
      if (s === null || e === null || e <= s) continue;
      total += e - s;
      any = true;
    }
    remainingScheduledMinutes = any ? total : null;
  }

  const recommendations = buildExecutionRecovery({
    dayKey: input.dayKey,
    tasks: input.tasks,
    projects: input.projects,
    blocks: todayBlocks,
    sessions: todaySessions,
    events: todayEvents,
    deviations,
    metrics,
    priorities: input.priorities,
    nextActionTaskId: input.nextActionTaskId,
    unscheduledTaskIds: input.unscheduledTaskIds,
    conflicts: input.conflicts,
    availableMinutes: input.todayAvailableMinutes,
    remainingScheduledMinutes,
    estimateNoteByTask: Object.keys(estimateNoteByTask).length > 0 ? estimateNoteByTask : undefined,
  });

  const snapshot = buildExecutionSnapshot({
    dayKey: input.dayKey,
    persona: input.persona,
    tasks: input.tasks,
    sessions: todaySessions,
    events: todayEvents,
    blocks: todayBlocks,
    nowMs: input.nowMs,
    metrics,
    deviations,
    recommendations,
    activeSession: input.activeSession,
    planningEstimatedMinutes: input.planningEstimatedMinutes,
    workloadState: input.workloadState ?? null,
    planningAvailableMinutes: input.planningAvailableMinutes,
    todayScheduledMinutes: input.todayScheduledMinutes,
    todayAvailableMinutes: input.todayAvailableMinutes,
  });

  const weekly = buildWeeklyInsight({
    dayKey: input.dayKey,
    sessions: input.sessions,
    events: input.events,
    blocks: input.blocks,
    nowMs: input.nowMs,
  });

  return {
    dayKey: input.dayKey,
    persona: input.persona,
    metrics,
    deviations,
    insights,
    recommendations,
    snapshot,
    activeSession: input.activeSession,
    weekly,
  };
}

/* ------------------------------------------------------------------ */
/* Public surface                                                      */
/* ------------------------------------------------------------------ */

export * from "./types";
export { buildMetrics, actionOf, recoveryActionCounts, sessionElapsedMs, isActiveSession, isFinishedSession, sessionMinutes } from "./metrics";
export type { MetricsInput } from "./metrics";
export { detectDeviations, sortSignals, deviationCounts } from "./deviation";
export type { DeviationInput } from "./deviation";
export { learnEstimates, insightForTask, planningEstimatesByTask } from "./learning";
export type { LearningInput } from "./learning";
export { buildExecutionRecovery, recoveryMeta } from "./recovery";
export type { RecoveryInput } from "./recovery";
export { buildExecutionSnapshot, completedTaskIdsToday } from "./snapshot";
export type { SnapshotInput } from "./snapshot";
export { buildWeeklyInsight } from "./weekly";
export type { WeeklyDayExecution, WeeklyExecutionInsight, WeeklyInsightInput } from "./weekly";
export {
  dismissExecutionRecommendation,
  restoreExecutionRecommendation,
  filterDismissedExecution,
  getExecutionDismissedSnapshot,
  subscribeExecutionDismissals,
} from "./dismissals";
export { addDaysKey, todayKey } from "@/lib/task-utils";
