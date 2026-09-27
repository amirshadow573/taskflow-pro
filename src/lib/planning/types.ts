/**
 * Planning Intelligence — shared types (Phase 10).
 *
 * The planning layer is a PURE, deterministic, explainable decision-support
 * foundation. It never mutates user data, never calls an external AI API, and
 * never replaces the user's stored priority — it only derives structured
 * planning signals that the UI (and a future AI provider) can consume.
 *
 * Every value here is computed client-side from real application data:
 * tasks, projects, goals, calendar/context events, time blocks, routines and
 * persona-specific entities (exams, deliverables, meetings, initiatives…).
 */
import type { NextActionTask } from "@/lib/next-action";

/* ------------------------------------------------------------------ */
/* States                                                              */
/* ------------------------------------------------------------------ */

/** Deadline urgency — computed from real dates, never invented. */
export type UrgencyState =
  | "overdue"
  | "critical"
  | "due_soon"
  | "upcoming"
  | "flexible"
  | "no_deadline";

/** System planning attention band — DISTINCT from the user's stored priority. */
export type AttentionBand = "high" | "medium" | "low";

/** Day/week workload classification — a planning state, not a judgment. */
export type WorkloadState = "light" | "balanced" | "heavy" | "overloaded";

/** Deterministic, explainable health of a project or goal. */
export type HealthState =
  | "healthy"
  | "needs_attention"
  | "at_risk"
  | "blocked"
  | "completed";

export type RecommendationSeverity = "critical" | "warning" | "info";

/** Extensible recommendation architecture (§17). */
export type RecommendationType =
  | "NEXT_ACTION"
  | "DEADLINE_WARNING"
  | "OVERDUE_WARNING"
  | "WORKLOAD_WARNING"
  | "SCHEDULING_SUGGESTION"
  | "PROJECT_ATTENTION"
  | "GOAL_ATTENTION"
  | "BLOCKED_TASK"
  | "MISSING_NEXT_ACTION"
  | "PLANNING_GAP"
  | "REVIEW_SUGGESTION";

/* ------------------------------------------------------------------ */
/* Recommendations                                                     */
/* ------------------------------------------------------------------ */

/**
 * One deterministic planning recommendation.
 *
 * Idempotent by design: `id` is derived from type + entity + day, so
 * re-rendering the dashboard can never produce duplicates, and dismissal
 * (localStorage, per-day) is non-destructive — no user data is touched.
 */
export interface PlanningRecommendation {
  /** `${type}:${scope}:${entityId}:${dayKey}` — stable across renders. */
  id: string;
  type: RecommendationType;
  severity: RecommendationSeverity;
  /** Short Persian headline. */
  title: string;
  /** Deterministic Persian explanation of WHY this matters. */
  detail: string;
  /** Optional navigation target — suggestions explain, they never act. */
  link?: { to: string; label: string };
  /** Underlying entity id (task / project / goal), for future AI actions. */
  targetId?: string;
  /** Day the recommendation was generated for (part of the id). */
  dayKey: string;
}

/* ------------------------------------------------------------------ */
/* Persona deadline items (normalized across the six personas)         */
/* ------------------------------------------------------------------ */

export type PlanningItemKind =
  | "exam"
  | "assignment"
  | "deliverable"
  | "invoice"
  | "milestone"
  | "initiative"
  | "meeting";

/**
 * A persona-specific deadline-bearing entity, normalized so the engine can
 * reason about student exams and freelancer deliverables through ONE path.
 */
export interface PlanningItem {
  id: string;
  title: string;
  kind: PlanningItemKind;
  /** Persian entity label, e.g. «آزمون», «تحویل». */
  label: string;
  dueDate?: string;
  /** Extra Persian context (e.g. «۳ روز تا آزمون»). */
  detail?: string;
}

/* ------------------------------------------------------------------ */
/* Calendar / schedule inputs                                          */
/* ------------------------------------------------------------------ */

export interface PlanningEvent {
  _id: string;
  title: string;
  type: string;
  date?: string;
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
}

export interface PlanningTimeBlock {
  title: string;
  day: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  kind: string;
}

export interface PlanningMeeting {
  title: string;
  date: string;
  time?: string; // HH:mm
}

/* ------------------------------------------------------------------ */
/* Workload                                                            */
/* ------------------------------------------------------------------ */

export interface WorkloadAnalysis {
  state: WorkloadState;
  /** Sum of task estimates for today — null when nothing is estimated. */
  estimatedMinutes: number | null;
  /** How many of today's tasks actually carry an estimate (0..1). */
  estimateCoverage: number;
  /** Occupied calendar/block time — null when the user has no schedule data. */
  occupiedMinutes: number | null;
  /** Documented planning-capacity assumption (see workload.ts). */
  capacityMinutes: number;
  /** capacity − occupied, only when occupied time is actually known. */
  availableMinutes: number | null;
  /** exact = estimates+calendar, approximate = partial, insufficient = no data. */
  confidence: "exact" | "approximate" | "insufficient";
  /** Persian explanation fragments — always explains WHY. */
  reasons: string[];
  /** Full Persian sentence; empty string when data is insufficient. */
  explanation: string;
}

/** One detected planning conflict (§9) — every signal is explained, none auto-fixed. */
export interface OverloadSignal {
  key:
    | "deadlines_today"
    | "overdue_accumulating"
    | "project_deadline_near"
    | "insufficient_focus_time"
    | "estimates_exceed_capacity"
    | "time_block_overload";
  detail: string;
}

/* ------------------------------------------------------------------ */
/* Health                                                              */
/* ------------------------------------------------------------------ */

export interface HealthReason {
  key: string;
  /** Persian, user-facing. */
  label: string;
  tone: "bad" | "warn" | "good";
}

export interface HealthResult {
  state: HealthState;
  /** Ordered explanations — strongest signal first. */
  reasons: HealthReason[];
  /** Execution progress from real tasks (null when there are no tasks). */
  progressPct: number | null;
}

/* ------------------------------------------------------------------ */
/* Today buckets (§7)                                                  */
/* ------------------------------------------------------------------ */

export interface BlockedItem<T extends NextActionTask = NextActionTask> {
  task: T;
  /** Persian reason the task cannot progress right now. */
  reason: string;
}

export interface TodayBuckets<T extends NextActionTask = NextActionTask> {
  /** Critical or deadline-sensitive work. */
  mustDo: T[];
  /** Important work that meaningfully advances goals/projects. */
  shouldDo: T[];
  /** Useful but flexible work. */
  couldDo: T[];
  /** Intentionally scheduled after today (user-chosen later dates). */
  deferred: T[];
  /** Work that cannot currently progress (blocked signals). */
  blocked: BlockedItem<T>[];
}

/* ------------------------------------------------------------------ */
/* Snapshot (§18) — the structured input a future AI layer consumes    */
/* ------------------------------------------------------------------ */

export interface SnapshotCriticalItem {
  id: string;
  title: string;
  kind: "task" | PlanningItemKind;
  dueDate?: string;
  urgency: UrgencyState;
}

export interface SnapshotRisk {
  id: string;
  title: string;
  state: HealthState;
  /** Strongest Persian reason this item is at risk. */
  reason: string;
}

export interface PlanningSnapshot {
  date: string;
  persona: string;
  workload: WorkloadAnalysis;
  availableTime: number | null;
  occupiedTime: number | null;
  overdueCount: number;
  dueSoonCount: number;
  criticalItems: SnapshotCriticalItem[];
  nextAction: { taskId: string; title: string; reason: string; score: number } | null;
  projectRisks: SnapshotRisk[];
  goalRisks: SnapshotRisk[];
  recommendations: PlanningRecommendation[];
  blockers: Array<{ id: string; title: string; reason: string }>;
  generatedAt: number;
}

/* ------------------------------------------------------------------ */
/* Persian labels                                                      */
/* ------------------------------------------------------------------ */

export const URGENCY_LABELS_FA: Record<UrgencyState, string> = {
  overdue: "عقب‌افتاده",
  critical: "امروز",
  due_soon: "نزدیک موعد",
  upcoming: "پیش رو",
  flexible: "انعطافی",
  no_deadline: "بدون مهلت",
};

export const WORKLOAD_LABELS_FA: Record<WorkloadState, string> = {
  light: "سبک",
  balanced: "متعادل",
  heavy: "سنگین",
  overloaded: "بیش از ظرفیت",
};

export const HEALTH_LABELS_FA: Record<HealthState, string> = {
  healthy: "سالم",
  needs_attention: "نیازمند توجه",
  at_risk: "در خطر",
  blocked: "متوقف",
  completed: "تکمیل‌شده",
};

export const ATTENTION_LABELS_FA: Record<AttentionBand, string> = {
  high: "توجه بالا",
  medium: "توجه متوسط",
  low: "توجه کم",
};

/** Centralized recommendation configuration (§17). */
export const RECOMMENDATION_META: Record<
  RecommendationType,
  { labelFa: string; tone: "critical" | "warning" | "info" }
> = {
  NEXT_ACTION: { labelFa: "قدم بعدی", tone: "info" },
  DEADLINE_WARNING: { labelFa: "موعد نزدیک", tone: "warning" },
  OVERDUE_WARNING: { labelFa: "عقب‌افتاده", tone: "critical" },
  WORKLOAD_WARNING: { labelFa: "بار امروز", tone: "warning" },
  SCHEDULING_SUGGESTION: { labelFa: "زمان‌بندی", tone: "info" },
  PROJECT_ATTENTION: { labelFa: "پروژه", tone: "warning" },
  GOAL_ATTENTION: { labelFa: "هدف", tone: "warning" },
  BLOCKED_TASK: { labelFa: "مسدود", tone: "warning" },
  MISSING_NEXT_ACTION: { labelFa: "قدم گمشده", tone: "warning" },
  PLANNING_GAP: { labelFa: "گپ برنامه‌ریزی", tone: "info" },
  REVIEW_SUGGESTION: { labelFa: "بازبینی", tone: "info" },
};

/** Empty-state copy (§32) — planning must degrade gracefully, never fabricate. */
export const PLANNING_EMPTY_STATE_FA = "اطلاعات کافی برای پیشنهاد برنامه وجود ندارد.";
