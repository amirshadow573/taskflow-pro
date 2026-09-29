/**
 * Productivity Intelligence — shared types (Phase 13).
 *
 * Everything here is DETERMINISTIC, EXPLAINABLE and derived from data the
 * product already stores: tasks, projects, goals, time blocks, execution
 * sessions/events, focus sessions, routines, habits and reviews — plus the
 * snapshots the Phase 10 / 11 / 12 engines already produce.
 *
 * Hard rules encoded in these types:
 *   - Every insight carries EVIDENCE (observable values, never a vibe).
 *   - Every insight has a minimum-sample guard, so a single odd day can never
 *     become a conclusion (§33).
 *   - Insights describe DATA, never personality (§18 non-judgmental).
 *   - There is no "productivity score": ranking is by practical relevance
 *     (deadline → goal → project → workload → pattern → execution → planning →
 *     informational), documented in `INSIGHT_PRIORITY_WEIGHT` (§19).
 *   - No AI, no external analytics, no new gamification (§43).
 */
import type { HealthState, WorkloadState } from "@/lib/planning";

/* ------------------------------------------------------------------ */
/* Insight model (§17)                                                 */
/* ------------------------------------------------------------------ */

export type InsightType =
  | "PLANNING_ACCURACY"
  | "EXECUTION_PATTERN"
  | "WORKLOAD"
  | "PROJECT_RISK"
  | "GOAL_STAGNATION"
  | "DEADLINE"
  | "TIME_DISTRIBUTION"
  | "FOCUS"
  | "CONSISTENCY"
  | "ESTIMATION"
  | "SCHEDULE_DRIFT"
  | "RECOVERY";

/** Insight Center sections (§20). */
export type InsightCategory =
  | "overview"
  | "planning"
  | "execution"
  | "time"
  | "projects"
  | "goals"
  | "focus"
  | "trends";

export type InsightSeverity = "critical" | "warning" | "info" | "positive";

export type InsightStatus = "new" | "dismissed" | "useful";

export type TimeWindow = "today" | "7d" | "14d" | "30d" | "90d";

/** One observable fact behind an insight (label + already-formatted value). */
export interface InsightEvidence {
  label: string;
  value: string;
}

/** What the user can do about an insight — always an explicit choice (§34). */
export interface InsightAction {
  kind:
    | "open_task"
    | "open_project"
    | "open_goal"
    | "open_schedule"
    | "open_today"
    | "review_estimates"
    | "open_insights"
    | "dismiss";
  label: string;
  /** Route the action navigates to (omitted for `dismiss`). */
  to?: string;
}

/** The affected entity, so a surface can open the exact object (§34/§40-16). */
export interface InsightAffected {
  taskId?: string;
  projectId?: string;
  goalRef?: string;
  blockId?: string;
  blockDay?: string;
}

export interface Insight {
  /** Deterministic: `${type}:${scope}:${dayKey}` — stable across renders. */
  id: string;
  type: InsightType;
  category: InsightCategory;
  severity: InsightSeverity;
  /** Persian headline. */
  title: string;
  /** Persian explanation — what happened, in observable terms. */
  description: string;
  evidence: InsightEvidence[];
  /** Primary metric key this insight is based on (for future AI + debugging). */
  metric: string;
  timeWindow: TimeWindow;
  affected?: InsightAffected;
  actions: InsightAction[];
  /** Relevance ordering (higher first) — NOT a productivity score (§19). */
  priority: number;
  /** How strongly the data supports it. */
  confidence: "high" | "medium" | "low";
  /** Signal keys that produced it (audit trail). */
  signals: string[];
  createdAt: number;
  /** Local day the insight stops being surfaced (end of day). */
  expiresDay: string;
  status: InsightStatus;
}

/* ------------------------------------------------------------------ */
/* Analyses (§3–§16)                                                   */
/* ------------------------------------------------------------------ */

/** Central metric layer — every surface reads metrics from here (§3). */
export interface ProductivityMetrics {
  window: TimeWindow;
  days: number;
  /** Tasks completed inside the window (by `completedAt`). */
  completedTasks: number;
  createdTasks: number;
  /** completed / created (0..1) — null when nothing was created. */
  completionRate: number | null;
  openTasks: number;
  overdueTasks: number;
  /** Minutes the user intended (estimates of work planned in the window). */
  plannedMinutes: number;
  /** Minutes placed in time blocks. */
  scheduledMinutes: number;
  /** Minutes actually executed (execution sessions + focus sessions). */
  actualMinutes: number;
  /** actual ÷ scheduled (0..1) — null when nothing was scheduled. */
  scheduleAdherence: number | null;
  /** actual ÷ planned (0..1) — null when nothing was planned. */
  planningAdherence: number | null;
  /** scheduled − actual in minutes (positive = under-executed). */
  scheduleDriftMinutes: number | null;
  completedSessions: number;
  abandonedSessions: number;
  missedBlocks: number;
  rescheduledTasks: number;
  postponedTasks: number;
  /** Days with at least one completion, execution or focus record. */
  activeDays: number;
  /** Estimate error distribution for finished work. */
  estimateSamples: number;
  estimateAccuracyPct: number | null;
}

export interface TimeSlice {
  key: string;
  /** Persian label (persona-aware where the engine has a mapping). */
  label: string;
  minutes: number;
  /** 0..100 share of the analysed total. */
  pct: number;
}

export interface TimeDistribution {
  totalMinutes: number;
  /** Time grouped by work TYPE (kind: study/focus/task/admin/meeting…). */
  byType: TimeSlice[];
  /** Time grouped by project (only when the project has recorded time). */
  byProject: TimeSlice[];
  /** Time grouped by goal (via project → goalRef), when mappable. */
  byGoal: TimeSlice[];
  /** True when there is nothing to distribute yet. */
  empty: boolean;
}

export interface PlannedVsActual {
  plannedMinutes: number;
  scheduledMinutes: number;
  actualMinutes: number;
  varianceMinutes: number;
  /** Share of scheduled time that turned into real execution (0..100). */
  adherencePct: number | null;
  /** Share of planned estimates that turned into real execution (0..100). */
  completionPct: number | null;
  driftMinutes: number;
  /** Deterministic Persian interpretation (never a judgment). */
  interpretation: string;
  sufficient: boolean;
}

export interface EstimationPattern {
  /** `task:<id>` | `tag:<t>` | `kind:<k>` | `project:<id>` */
  key: string;
  scope: "task" | "tag" | "kind" | "project";
  label: string;
  baseMinutes: number;
  actualMinutes: number;
  samples: number;
  adjustmentMinutes: number;
  adjustmentPct: number;
  /** Persian, explainable statement. */
  note: string;
}

export interface EstimationProfile {
  samples: number;
  accuracyPct: number | null;
  /** actual ÷ estimated for the whole window (0..2+, null without samples). */
  ratio: number | null;
  direction: "under_estimating" | "over_estimating" | "accurate" | "insufficient";
  patterns: EstimationPattern[];
  sufficient: boolean;
}

export interface WorkloadDay {
  day: string;
  scheduledMinutes: number;
  estimatedMinutes: number;
  actualMinutes: number;
  availableMinutes: number | null;
  state: WorkloadState | null;
}

export interface WorkloadProfile {
  todayState: WorkloadState | null;
  /** scheduled + estimated remaining work vs real capacity for today. */
  todayScheduledMinutes: number;
  todayAvailableMinutes: number | null;
  days: WorkloadDay[];
  overloadedDays: number;
  heavyDays: number;
  /** signed % change of planned minutes, latest period vs previous. */
  trendPct: number | null;
  trend: "rising" | "falling" | "stable" | "insufficient";
  sufficient: boolean;
}

export interface ProjectIntelligence {
  projectId: string;
  name: string;
  health: HealthState;
  progressPct: number | null;
  openTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  remainingEstimateMinutes: number;
  completedLast14: number;
  velocityPerWeek: number | null;
  /** Local day of the most recent real activity (completedAt / session). */
  lastActivityDay: string | null;
  daysSinceActivity: number | null;
  reasons: string[];
  signals: string[];
}

export interface GoalIntelligence {
  ref: string;
  title: string;
  health: HealthState;
  progressPct: number;
  dueDate: string | null;
  projectCount: number;
  openTasks: number;
  completedLast14: number;
  lastActivityDay: string | null;
  daysSinceActivity: number | null;
  reasons: string[];
  /** True when the goal has no measurable linked activity at all (§10). */
  unmeasurable: boolean;
}

export interface FocusAnalysis {
  sessions: number;
  totalMinutes: number;
  averageMinutes: number | null;
  plannedMinutes: number;
  executionFocusMinutes: number;
  /** 0..1 share of finished focus sessions that reached their plan. */
  completionRate: number | null;
  /** Sessions stopped before their planned length. */
  interruptedSessions: number;
  interruptionRate: number | null;
  byProject: TimeSlice[];
  bestDay: { day: string; minutes: number } | null;
  sufficient: boolean;
}

export interface ConsistencyAnalysis {
  activeDays: number;
  planningDays: number;
  executionDays: number;
  focusDays: number;
  /** 0..1 — null when there is nothing to be consistent about. */
  executionConsistency: number | null;
  planningConsistency: number | null;
  focusConsistency: number | null;
  routineMonthPct: number | null;
  habitsTracked: number;
  habitsDoneToday: number;
  habitWeekPct: number | null;
  reviewsLast30: number;
  weeklyReviewsLast30: number;
  sufficient: boolean;
}

export interface DeadlineReliability {
  windowDays: number;
  withDeadline: number;
  completed: number;
  onTime: number;
  late: number;
  overdueOpen: number;
  /** onTime ÷ completed-with-deadline (0..1) — null without samples. */
  onTimeRate: number | null;
  averageDelayDays: number | null;
  sufficient: boolean;
}

export interface TrendWindow {
  window: Extract<TimeWindow, "7d" | "14d" | "30d" | "90d">;
  days: number;
  actualMinutes: number;
  completedTasks: number;
  activeDays: number;
  /** Latest half vs previous half of the window (signed %). */
  changePct: number | null;
  direction: "up" | "down" | "stable" | "insufficient";
  sufficient: boolean;
  note: string;
}

/** One aggregated period of the productivity snapshot history (§29). */
export interface ProductivitySnapshot {
  period: "week" | "month";
  periodKey: string;
  from: string;
  to: string;
  plannedMinutes: number;
  scheduledMinutes: number;
  actualMinutes: number;
  completedTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  focusMinutes: number;
  planningAccuracy: number | null;
  scheduleAdherence: number | null;
  workloadState: WorkloadState | null;
  deadlineReliability: number | null;
  activeDays: number;
}

/* ------------------------------------------------------------------ */
/* Review models (§23 / §24)                                           */
/* ------------------------------------------------------------------ */

export interface ReviewSection {
  title: string;
  /** Persian bullet lines — each one an observable fact. */
  lines: string[];
}

export interface ProductivityReview {
  period: "week" | "month";
  from: string;
  to: string;
  stats: Array<{ label: string; value: string }>;
  sections: ReviewSection[];
  sufficient: boolean;
}

/* ------------------------------------------------------------------ */
/* Facade output                                                       */
/* ------------------------------------------------------------------ */

export interface ProductivityIntelligence {
  dayKey: string;
  persona: string;
  window: TimeWindow;
  metrics: ProductivityMetrics;
  time: TimeDistribution;
  planned: PlannedVsActual;
  estimation: EstimationProfile;
  workload: WorkloadProfile;
  projects: ProjectIntelligence[];
  goals: GoalIntelligence[];
  focus: FocusAnalysis;
  consistency: ConsistencyAnalysis;
  deadline: DeadlineReliability;
  trends: TrendWindow[];
  snapshots: ProductivitySnapshot[];
  insights: Insight[];
  weeklyReview: ProductivityReview;
  monthlyReview: ProductivityReview;
  /** True when the user has enough history for ANY insight (§32). */
  hasData: boolean;
  generatedAt: number;
}

/* ------------------------------------------------------------------ */
/* Thresholds (§33 — insufficient-sample protection)                   */
/* ------------------------------------------------------------------ */

export const INTELLIGENCE_THRESHOLDS = {
  /** Estimation insights need several finished, estimated executions. */
  estimationSamples: 5,
  /** A per-scope estimation pattern needs its own samples. */
  estimationPatternSamples: 4,
  /** Trends compare halves, so a window needs at least this many days. */
  trendMinDays: 14,
  /** Consistency statements need a real observation span. */
  consistencyDays: 7,
  /** Focus statements need several sessions, not one long one. */
  focusSessions: 5,
  /** Project risk/velocity needs a meaningful project. */
  projectTasks: 3,
  /** Goal stagnation needs an observation window. */
  goalStagnationDays: 8,
  /** Project stagnation needs an observation window. */
  projectStagnationDays: 7,
  /** Deadline reliability needs a real sample of deadline-bound work. */
  deadlineSamples: 5,
  /** Workload trend needs at least this many overloaded/heavy days. */
  workloadOverloadDays: 3,
  /** A share-based statement needs this many minutes to be meaningful. */
  minMinutesForShare: 60,
} as const;

/** Relevance weights — insight ordering, NOT a productivity score (§19). */
export const INSIGHT_PRIORITY_WEIGHT: Record<InsightType, number> = {
  DEADLINE: 100,
  PROJECT_RISK: 90,
  GOAL_STAGNATION: 80,
  WORKLOAD: 70,
  RECOVERY: 60,
  ESTIMATION: 55,
  PLANNING_ACCURACY: 50,
  SCHEDULE_DRIFT: 45,
  EXECUTION_PATTERN: 40,
  CONSISTENCY: 35,
  FOCUS: 30,
  TIME_DISTRIBUTION: 20,
};

export const INSIGHT_SEVERITY_BONUS: Record<InsightSeverity, number> = {
  critical: 20,
  warning: 10,
  info: 0,
  positive: -5,
};

/** Maximum insights surfaced at once (§18 non-duplicative). */
export const MAX_INSIGHTS = 12;

/* ------------------------------------------------------------------ */
/* Persian labels                                                      */
/* ------------------------------------------------------------------ */

export const INSIGHT_TYPE_LABELS_FA: Record<InsightType, string> = {
  PLANNING_ACCURACY: "دقت برنامه‌ریزی",
  EXECUTION_PATTERN: "الگوی اجرا",
  WORKLOAD: "بار کاری",
  PROJECT_RISK: "ریسک پروژه",
  GOAL_STAGNATION: "رکود هدف",
  DEADLINE: "قابل‌اعتماد بودن موعد",
  TIME_DISTRIBUTION: "توزیع زمان",
  FOCUS: "تمرکز",
  CONSISTENCY: "پیوستگی",
  ESTIMATION: "دقت تخمین زمان",
  SCHEDULE_DRIFT: "انحراف از برنامه",
  RECOVERY: "بازیابی",
};

export const INSIGHT_CATEGORY_LABELS_FA: Record<InsightCategory, string> = {
  overview: "نمای کلی",
  planning: "برنامه‌ریزی",
  execution: "اجرا",
  time: "زمان",
  projects: "پروژه‌ها",
  goals: "اهداف",
  focus: "تمرکز",
  trends: "روندها",
};

export const INSIGHT_CATEGORY_BY_TYPE: Record<InsightType, InsightCategory> = {
  PLANNING_ACCURACY: "planning",
  EXECUTION_PATTERN: "execution",
  WORKLOAD: "planning",
  PROJECT_RISK: "projects",
  GOAL_STAGNATION: "goals",
  DEADLINE: "execution",
  TIME_DISTRIBUTION: "time",
  FOCUS: "focus",
  CONSISTENCY: "trends",
  ESTIMATION: "planning",
  SCHEDULE_DRIFT: "execution",
  RECOVERY: "execution",
};

export const INSIGHT_SEVERITY_LABELS_FA: Record<InsightSeverity, string> = {
  critical: "نیازمند اقدام",
  warning: "قابل توجه",
  info: "اطلاع",
  positive: "روند خوب",
};

export const WORKLOAD_LABELS_FA: Record<WorkloadState, string> = {
  light: "سبک",
  balanced: "متعادل",
  heavy: "سنگین",
  overloaded: "بیش از ظرفیت",
};

/** Empty state (§32) — never fabricate analytics. */
export const INTELLIGENCE_EMPTY_STATE_FA =
  "برای ساختن بینش دقیق، چند روز فعالیت بیشتر لازم است. با اجرای کارها و ثبت جلسه‌های تمرکز، این بخش خودش پر می‌شود.";

export const INTELLIGENCE_COLLECTING_FA =
  "در حال جمع‌آوری داده: بعد از چند جلسه اجرا و برنامه‌ریزی می‌توانیم دقت تخمین و روند کارت را نشان دهیم.";
