/**
 * ProductivityIntelligenceEngine facade (Phase 13 §2 / §28).
 *
 * ONE pure function — `computeIntelligence(input)` — runs the whole
 * deterministic intelligence layer over data the app already subscribes to:
 *
 *   ProductivityMetricsService     buildProductivityMetrics   (metrics.ts)
 *   TimeAnalysisService            buildTimeDistribution      (time.ts)
 *   PlanningAccuracyService        buildPlannedVsActual       (planned.ts)
 *   ExecutionAnalysisService       (Phase 12)                 @/lib/execution
 *   WorkloadAnalysisService        buildWorkloadProfile       (workload.ts)
 *   ProjectHealthAnalysisService   buildProjectIntelligence   (health.ts)
 *   GoalProgressAnalysisService    buildGoalIntelligence      (health.ts)
 *   FocusAnalysisService           buildFocusAnalysis         (focus.ts)
 *   ConsistencyAnalysisService     buildConsistencyAnalysis   (consistency.ts)
 *   DeadlineReliabilityService     buildDeadlineReliability   (deadline.ts)
 *   TrendAnalysisService           buildTrends                (trends.ts)
 *   PatternDetectionService        buildEstimationProfile     (estimation.ts)
 *   InsightSnapshotService         buildProductivitySnapshots  (snapshot.ts)
 *   InsightGenerationService       buildInsights              (insights.ts)
 *   Review builders                buildWeekly/MonthlyReview  (reviews.ts)
 *
 * PURE: no side effects, no storage writes, no backend calls, **no AI** (§43).
 * Consumers memoize the call (src/hooks/use-intelligence.ts), so the dashboard,
 * Today and the Insight Center never re-run the analysis per render (§31).
 *
 * Windows are bounded (7..90 days, default 30) and every metric derives from
 * that one bounded load — no full-history scans (§31).
 */
import type { ExecutionSession } from "@/lib/execution";
import { buildProductivityMetrics, metricsScope, type MetricsScope } from "./metrics";
import { buildTimeDistribution } from "./time";
import { buildPlannedVsActual } from "./planned";
import { buildEstimationProfile } from "./estimation";
import { buildWorkloadProfile } from "./workload";
import { buildGoalIntelligence, buildProjectIntelligence } from "./health";
import { buildFocusAnalysis } from "./focus";
import { buildConsistencyAnalysis } from "./consistency";
import { buildDeadlineReliability } from "./deadline";
import { buildTrends } from "./trends";
import { buildProductivitySnapshots } from "./snapshot";
import { buildInsights } from "./insights";
import { buildMonthlyReview, buildWeeklyReview } from "./reviews";
import { windowForDays } from "./window";
import type { IntelligenceWindowKey } from "./window";
import type { IntelligenceInput } from "./input";
import type { ProductivityIntelligence } from "./types";

/** Smallest supported window when a caller asks for less than a week. */
export const MIN_WINDOW_DAYS = 7;
/** Largest window the engine will aggregate in one pass. */
export const MAX_WINDOW_DAYS = 90;

/** Clamps a requested day count to the supported, bounded range (§31). */
export function clampWindowDays(days: number | undefined): number {
  if (days == null || Number.isNaN(days)) return 30;
  return Math.min(MAX_WINDOW_DAYS, Math.max(MIN_WINDOW_DAYS, Math.round(days)));
}

export { windowForDays };
export type { IntelligenceWindowKey };

export function computeIntelligence(input: IntelligenceInput): ProductivityIntelligence {
  const days = clampWindowDays(input.windowDays);
  const window = windowForDays(days);
  const scope: MetricsScope = metricsScope(input.dayKey, days, window);
  const inWindow = new Set(scope.dayKeys);

  /* ---- window-bounded slices: nothing outside the requested range is used ---- */
  const sessions: ExecutionSession[] = input.sessions.filter((s) => inWindow.has(s.day));
  const events = input.events.filter((e) => inWindow.has(e.day));
  const blocks = input.blocks.filter((b) => inWindow.has(b.day));
  const focusSessions = input.focusSessions.filter((f) => inWindow.has(f.date));

  const metrics = buildProductivityMetrics({
    scope,
    tasks: input.tasks,
    blocks: input.blocks,
    sessions: input.sessions,
    events: input.events,
    focusSessions: input.focusSessions,
    nowMs: input.nowMs,
  });

  const time = buildTimeDistribution({
    sessions,
    focusSessions,
    projects: input.projects,
    goals: input.goals,
    persona: input.persona,
    nowMs: input.nowMs,
  });

  const planned = buildPlannedVsActual(metrics, days);

  const estimation = buildEstimationProfile({
    sessions,
    metrics,
    insights: input.execution.estimateInsights,
    tasks: input.tasks,
    projects: input.projects,
    nowMs: input.nowMs,
  });

  const workload = buildWorkloadProfile({
    scope,
    blocks: input.blocks,
    tasks: input.tasks,
    sessions: input.sessions,
    focusSessions: input.focusSessions,
    nowMs: input.nowMs,
    dailyCapacityMinutes: input.capacity.dailyMinutes,
    /* Phase 12 snapshot stays the authority for "how is today going". */
    snapshot: input.execution.snapshot,
    metrics,
  });

  const healthInput = {
    tasks: input.tasks,
    projects: input.projects,
    goals: input.goals,
    sessions: input.sessions,
    projectHealths: input.projectHealths,
    goalHealths: input.goalHealths,
    dayKey: input.dayKey,
    days,
  };
  const projects = buildProjectIntelligence(healthInput);
  const goals = buildGoalIntelligence(healthInput);

  const focus = buildFocusAnalysis({
    sessions,
    focusSessions,
    projects: input.projects,
    nowMs: input.nowMs,
  });

  const consistency = buildConsistencyAnalysis({
    scope,
    tasks: input.tasks,
    blocks: input.blocks,
    sessions: input.sessions,
    focusSessions: input.focusSessions,
    nowMs: input.nowMs,
    routine: input.routine,
    habits: input.habits,
    reviews: input.reviews,
  });

  const deadline = buildDeadlineReliability({
    tasks: input.tasks,
    dayKey: input.dayKey,
    days,
  });

  const trends = buildTrends({
    dayKey: input.dayKey,
    tasks: input.tasks,
    sessions: input.sessions,
    focusSessions: input.focusSessions,
    nowMs: input.nowMs,
    availableDays: days,
  });

  const snapshots = buildProductivitySnapshots({
    tasks: input.tasks,
    blocks: input.blocks,
    sessions: input.sessions,
    focusSessions: input.focusSessions,
    dayKey: input.dayKey,
    nowMs: input.nowMs,
    dailyCapacityMinutes: input.capacity.dailyMinutes,
  });

  const insights = buildInsights({
    dayKey: input.dayKey,
    persona: input.persona,
    window,
    days,
    nowMs: input.nowMs,
    metrics,
    planned,
    estimation,
    workload,
    projects,
    goals,
    focus,
    consistency,
    deadline,
    time,
    executionRecommendations: input.execution.recommendations,
    schedule: input.schedule,
    personaSignals: input.personaSignals,
  });

  const reviewInput = {
    dayKey: input.dayKey,
    from: scope.from,
    to: scope.to,
    days,
    persona: input.persona,
    metrics,
    planned,
    estimation,
    workload,
    projects,
    goals,
    focus,
    consistency,
    deadline,
    time,
    trends,
    insights,
  };

  const hasData =
    metrics.completedTasks > 0 ||
    metrics.actualMinutes > 0 ||
    metrics.activeDays > 0 ||
    input.sessions.length > 0 ||
    input.blocks.length > 0;

  return {
    dayKey: input.dayKey,
    persona: input.persona,
    window,
    metrics,
    time,
    planned,
    estimation,
    workload,
    projects,
    goals,
    focus,
    consistency,
    deadline,
    trends,
    snapshots,
    insights,
    weeklyReview: buildWeeklyReview(reviewInput),
    monthlyReview: buildMonthlyReview(reviewInput),
    hasData,
    generatedAt: input.nowMs,
  };
}

/** Empty-but-honest state used before the first data arrives (§32). */
export function emptyIntelligence(dayKey: string, persona: string): ProductivityIntelligence {
  return computeIntelligence({
    dayKey,
    nowMs: Date.parse(`${dayKey}T00:00:00`),
    persona,
    tasks: [],
    projects: [],
    goals: [],
    blocks: [],
    sessions: [],
    events: [],
    focusSessions: [],
    routine: { todayPct: 0, monthPct: 0, itemsCount: 0 },
    habits: { total: 0, doneToday: 0, weekDone: 0, weekTarget: 0, bestStreak: 0 },
    reviews: [],
    projectHealths: [],
    goalHealths: [],
    execution: {
      snapshot: {
        date: dayKey,
        persona,
        plannedMinutes: null,
        scheduledMinutes: null,
        actualMinutes: 0,
        availableMinutes: null,
        estimatedMinutes: null,
        actualVsEstimated: null,
        completedSessions: 0,
        partialSessions: 0,
        abandonedSessions: 0,
        missedBlocks: 0,
        rescheduledTasks: 0,
        blockedTasks: 0,
        scheduleDrift: null,
        workloadState: null,
        activeSession: null,
        deviations: [],
        recoveryActions: [],
        recommendations: [],
        generatedAt: Date.parse(`${dayKey}T00:00:00`),
      },
      recommendations: [],
      estimateInsights: [],
    },
    schedule: { conflicts: 0, unscheduledTasks: 0 },
    capacity: { dailyMinutes: 480 },
  });
}

/* ------------------------------------------------------------------ */
/* Public surface                                                      */
/* ------------------------------------------------------------------ */

export * from "./types";
export {
  INTELLIGENCE_WINDOWS,
  dayKeysFor,
  windowDays,
  windowForDays as canonicalWindowForDays,
  windowStartDay,
  weekStartOf,
  monthKeyOf,
  dayKeyOf,
  isDayInRange,
  daysBetween,
} from "./window";
export { metricsFromInput, metricsScope, buildProductivityMetrics } from "./metrics";
export type { MetricsScope, MetricsInput } from "./metrics";
export { blockMinutes, executedMinutes, estimatedSessions, sessionMinutes, uniqueFocusRows } from "./rows";
export { buildTimeDistribution } from "./time";
export type { TimeDistributionInput } from "./time";
export { buildPlannedVsActual } from "./planned";
export { buildEstimationProfile, ESTIMATION_TOLERANCE_PCT } from "./estimation";
export type { EstimationInput } from "./estimation";
export { buildWorkloadProfile, workloadTrendFa, workloadOverloadFa } from "./workload";
export type { WorkloadInput } from "./workload";
export { buildProjectIntelligence, buildGoalIntelligence } from "./health";
export type { HealthIntelligenceInput } from "./health";
export { buildFocusAnalysis, focusSummaryFa, interruptionSummaryFa, FOCUS_SHORT_SHARE } from "./focus";
export type { FocusInput } from "./focus";
export { buildConsistencyAnalysis, consistencySummaryFa } from "./consistency";
export type { ConsistencyInput } from "./consistency";
export { buildDeadlineReliability, deadlineSummaryFa } from "./deadline";
export type { DeadlineInput } from "./deadline";
export { buildTrends, TREND_MIN_ACTIVE_DAYS_PER_HALF, TREND_STABLE_BAND_PCT } from "./trends";
export type { TrendInput } from "./trends";
export { buildProductivitySnapshots } from "./snapshot";
export type { SnapshotInput } from "./snapshot";
export { estimationSummaryFa } from "./estimation";
export { buildInsights, actionableTodayInsights } from "./insights";
export type { InsightEngineInput } from "./insights";
export { buildWeeklyReview, buildMonthlyReview } from "./reviews";
export type { ReviewInput } from "./reviews";
export {
  dismissInsight,
  restoreInsight,
  markInsightUseful,
  unmarkInsightUseful,
  filterDismissedInsights,
  applyInsightStatus,
  getDismissedInsightSnapshot,
  getUsefulInsightSnapshot,
  subscribeInsightDismissals,
  subscribeInsightUsefulness,
} from "./dismissals";
export type {
  PersonaSignals,
  IntelligenceInput,
  IntelTask,
  IntelProject,
  IntelGoal,
  IntelBlock,
  IntelFocus,
  IntelProjectHealth,
  IntelGoalHealth,
} from "./input";
export { hoursFa, minutesFa, pctFa, ratioPctFa, countFa, signedPctFa, dayFa } from "./format";
export { addDaysKey, todayKey } from "@/lib/task-utils";
