/**
 * Adaptive Execution — shared types (Phase 12 §3 / §16 / §23 / §33).
 *
 * Everything here is deterministic and explainable: no AI, no inference about
 * the user's psychology — only observable product data (timestamps, statuses,
 * estimates, feedback the user chose to give).
 *
 * Separation of concerns (§3):
 *   task status      → what is the state of the WORK      ("todo" | "done" …)
 *   execution state  → what happened while ATTEMPTING it  (see ExecutionState)
 * The two are intentionally different types.
 */
import type { AttentionBand, WorkloadState } from "@/lib/planning";

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

/** Execution lifecycle of one attempt (§3). */
export type ExecutionState =
  | "in_progress"
  | "paused"
  | "completed"
  | "abandoned";

/** What kind of work the session represents — decides the outcome path (§21). */
export type ExecutionKind = "task" | "focus" | "study" | "admin" | "other";

/** Minimal, optional feedback (§8) — never mandatory, never a rating of the person. */
export type ExecutionFeedback =
  | "completed"
  | "partial"
  | "blocked"
  | "longer"
  | "easier"
  | "irrelevant"
  | "waiting";

/**
 * Client-side view of an execution session row. Structurally compatible with
 * the Convex document (ids arrive as strings), so the engine stays pure.
 */
export interface ExecutionSession {
  _id: string;
  taskId?: string;
  blockId?: string;
  projectId?: string;
  title: string;
  kind: string;
  state: string;
  day: string;
  startedAt: number;
  endedAt?: number;
  pausedMs: number;
  pausedAt?: number;
  elapsedMs?: number;
  plannedMinutes?: number;
  feedback?: string;
  feedbackNote?: string;
  endedReason?: string;
}

/** Auditable execution event row (client view). */
export interface ExecutionEventRow {
  _id: string;
  type: string;
  day: string;
  at: number;
  sessionId?: string;
  taskId?: string;
  blockId?: string;
  projectId?: string;
  source: string;
  label: string;
  meta?: string;
}

/** Append-only event vocabulary (§23). */
export const EXECUTION_EVENT_TYPES = [
  "TASK_STARTED",
  "FOCUS_STARTED",
  "EXECUTION_PAUSED",
  "EXECUTION_RESUMED",
  "EXECUTION_COMPLETED",
  "EXECUTION_ABANDONED",
  "EXECUTION_REPLACED",
  "EXECUTION_FEEDBACK",
  "TASK_COMPLETED_BY_EXECUTION",
  "TASK_POSTPONED",
  "DEVIATION_OVERRUN",
  "DEVIATION_UNDERRUN",
  "RECOVERY_ACTION",
] as const;

export type ExecutionEventType = (typeof EXECUTION_EVENT_TYPES)[number];

/* ------------------------------------------------------------------ */
/* Deviation analysis (§7)                                             */
/* ------------------------------------------------------------------ */

export type DeviationKind =
  | "UNDER_RUN"
  | "OVER_RUN"
  | "LATE_START"
  | "EARLY_START"
  | "MISSED_BLOCK"
  | "PARTIAL_EXECUTION"
  | "REPEATED_DELAY"
  | "SCHEDULE_DRIFT"
  | "OVERLOAD";

export interface DeviationSignal {
  kind: DeviationKind;
  /** Persian, observable-only explanation. */
  detail: string;
  day?: string;
  taskId?: string;
  blockId?: string;
  sessionId?: string;
  /** Signed minutes when the signal is about duration (actual − planned). */
  minutes?: number;
}

/* ------------------------------------------------------------------ */
/* Metrics (§15) — operational execution metrics, NOT gamification     */
/* ------------------------------------------------------------------ */

export interface ExecutionMetrics {
  sessions: number;
  completedSessions: number;
  abandonedSessions: number;
  /** Finished work time (actual), in minutes. */
  actualMinutes: number;
  /** Estimated time for the same finished sessions, in minutes. */
  estimatedMinutes: number;
  /** actual − estimated (null when nothing was estimated). */
  varianceMinutes: number | null;
  /** Rough estimate accuracy 0..100 (null when no estimate samples). */
  estimateAccuracyPct: number | null;
  /** completed / (completed + abandoned) as 0..1 (null when no finished work). */
  completionRate: number | null;
  averageSessionMinutes: number | null;
  /** Sessions interrupted at least once (pause/resume). */
  interruptedSessions: number;
  lateStartCount: number;
  missedBlocks: number;
  reschedules: number;
  postponements: number;
  feedbackCount: number;
  minutesByKind: Record<string, number>;
}

/* ------------------------------------------------------------------ */
/* Estimate learning (§14)                                             */
/* ------------------------------------------------------------------ */

export interface EstimateInsight {
  /** Stable key: `task:<id>` | `tag:<tag>` | `kind:<kind>`. */
  key: string;
  scope: "task" | "tag" | "kind";
  /** Persian subject, e.g. «مطالعه» or the task title. */
  label: string;
  /** The user's own estimate (or the average of historic estimates). */
  baseMinutes: number;
  /** Average ACTUAL duration from history. */
  historicalMinutes: number;
  samples: number;
  /** historical − base (signed, minutes). */
  adjustmentMinutes: number;
  adjustmentPct: number;
  /** Explainable Persian sentence. */
  note: string;
}

/* ------------------------------------------------------------------ */
/* Recovery recommendations (§12 / §29)                                */
/* ------------------------------------------------------------------ */

export type ExecutionRecoveryType =
  | "MISSED_BLOCK"
  | "OVERDUE_RECOVERY"
  | "OVERRUN_CONFLICT"
  | "UNDERRUN"
  | "RESCHEDULE_REQUIRED"
  | "WORKLOAD_OVERLOAD"
  | "REPEATED_DELAY"
  | "BLOCKED_TASK"
  | "SCHEDULE_DRIFT"
  | "RECOVERED_TIME";

export type ExecutionRecoveryAction =
  | "reschedule"
  | "start_now"
  | "keep_unscheduled"
  | "mark_complete"
  | "mark_blocked"
  | "adjust_estimate"
  | "accept_move"
  | "dismiss";

export type ExecutionRecSeverity = "critical" | "warning" | "info";

export interface ExecutionRecommendation {
  /** Stable + idempotent: `${type}:${entityId}:${dayKey}`. */
  id: string;
  type: ExecutionRecoveryType;
  severity: ExecutionRecSeverity;
  /** Short Persian headline. */
  title: string;
  /** Deterministic Persian explanation of WHY (observable data only). */
  detail: string;
  taskId?: string;
  blockId?: string;
  sessionId?: string;
  projectId?: string;
  /** Confirm-first actions the surface may offer (never auto-applied). */
  actions: ExecutionRecoveryAction[];
  /** Signal strength — how well the data supports this recommendation. */
  confidence: "high" | "medium" | "low";
  /** Source signal keys, for the audit trail. */
  signals: string[];
  /** Local day the recommendation expires on (end of day). */
  expiresDay: string;
}

/* ------------------------------------------------------------------ */
/* Snapshot (§16) — the structured input a future AI layer consumes     */
/* ------------------------------------------------------------------ */

export interface ExecutionSnapshot {
  date: string;
  persona: string;
  /** Minutes the user intended to work today (estimates of today's tasks). */
  plannedMinutes: number | null;
  /** Minutes already placed in today's time blocks. */
  scheduledMinutes: number | null;
  /** Minutes actually executed today. */
  actualMinutes: number;
  /** Realistic remaining capacity today (Phase 11 availability). */
  availableMinutes: number | null;
  estimatedMinutes: number | null;
  actualVsEstimated: number | null;
  completedSessions: number;
  partialSessions: number;
  abandonedSessions: number;
  missedBlocks: number;
  rescheduledTasks: number;
  blockedTasks: number;
  scheduleDrift: number | null;
  workloadState: WorkloadState | null;
  activeSession: ExecutionSession | null;
  deviations: DeviationSignal[];
  recoveryActions: { action: string; count: number }[];
  recommendations: ExecutionRecommendation[];
  generatedAt: number;
}

/* ------------------------------------------------------------------ */
/* Persian labels (§33 — never color-only, always readable)            */
/* ------------------------------------------------------------------ */

export const EXECUTION_STATE_LABELS_FA: Record<ExecutionState, string> = {
  in_progress: "در حال انجام",
  paused: "متوقف موقت",
  completed: "انجام‌شده",
  abandoned: "رها‌شده",
};

export const EXECUTION_KIND_LABELS_FA: Record<string, string> = {
  task: "کار",
  focus: "تمرکز",
  study: "مطالعه",
  admin: "اداری",
  other: "سایر",
};

/** Persona-friendly label for a session kind (§19 — one engine, tailored copy). */
export const PERSONA_SESSION_LABELS: Record<string, Partial<Record<ExecutionKind, string>>> = {
  student: { study: "بلوک مطالعه", focus: "تمرکز درسی", task: "کار درسی" },
  employee: { focus: "کار عمیق", task: "کار کاری", admin: "کار اداری" },
  freelancer: { focus: "کار مشتری", task: "کار پروژه", admin: "اداری" },
  manager: { focus: "تمرکز مدیریتی", task: "کار تیم", admin: "هماهنگی" },
  business_owner: { focus: "تمرکز کسب‌وکار", task: "کار کسب‌وکار", admin: "عملیات" },
  personal: { focus: "تمرکز شخصی", task: "کار شخصی", study: "یادگیری" },
};

export function sessionLabel(kind: string, persona?: string): string {
  const personaLabel = persona ? PERSONA_SESSION_LABELS[persona]?.[kind as ExecutionKind] : undefined;
  return personaLabel ?? EXECUTION_KIND_LABELS_FA[kind] ?? kind;
}

export const DEVIATION_LABELS_FA: Record<DeviationKind, string> = {
  UNDER_RUN: "سریع‌تر از تخمین",
  OVER_RUN: "طولانی‌تر از تخمین",
  LATE_START: "شروع با تأخیر",
  EARLY_START: "شروع زودتر",
  MISSED_BLOCK: "بلوک از دست رفته",
  PARTIAL_EXECUTION: "اجرای ناقص",
  REPEATED_DELAY: "تعویق تکرارشده",
  SCHEDULE_DRIFT: "انحراف از برنامه",
  OVERLOAD: "بار بیش از ظرفیت",
};

export const EXECUTION_REC_META: Record<
  ExecutionRecoveryType,
  { labelFa: string; tone: ExecutionRecSeverity }
> = {
  MISSED_BLOCK: { labelFa: "بلوک از دست رفته", tone: "warning" },
  OVERDUE_RECOVERY: { labelFa: "بازیابی عقب‌افتاده", tone: "critical" },
  OVERRUN_CONFLICT: { labelFa: "تداخل زمانی", tone: "warning" },
  UNDERRUN: { labelFa: "زمان آزادشده", tone: "info" },
  RESCHEDULE_REQUIRED: { labelFa: "نیاز به جابه‌جایی", tone: "warning" },
  WORKLOAD_OVERLOAD: { labelFa: "بار بیش از ظرفیت", tone: "critical" },
  REPEATED_DELAY: { labelFa: "تعویق تکرارشده", tone: "warning" },
  BLOCKED_TASK: { labelFa: "مسدود", tone: "warning" },
  SCHEDULE_DRIFT: { labelFa: "انحراف برنامه", tone: "info" },
  RECOVERED_TIME: { labelFa: "زمان آزاد", tone: "info" },
};

/** Feedback chips offered after a session (§8) — short, neutral, optional. */
export const FEEDBACK_OPTIONS_FA: Array<{ value: ExecutionFeedback; label: string }> = [
  { value: "completed", label: "کامل انجام شد" },
  { value: "partial", label: "ناقص ماند" },
  { value: "longer", label: "بیشتر از تخمین طول کشید" },
  { value: "easier", label: "ساده‌تر از انتظار بود" },
  { value: "blocked", label: "متوقف شدم" },
  { value: "waiting", label: "منتظر دیگرانم" },
  { value: "irrelevant", label: "دیگر مهم نیست" },
];

/** Empty-state copy (§34) — execution never fabricates data. */
export const EXECUTION_EMPTY_STATE_FA =
  "هنوز داده اجرایی برای امروز ثبت نشده. با شروع یک کار، همین‌جا نشان داده می‌شود.";

/* ------------------------------------------------------------------ */
/* Small shared helpers                                                */
/* ------------------------------------------------------------------ */

/** Attention band coming from the Phase 10 planner (reused, not re-derived). */
export type PlanningAttention = AttentionBand;

export interface ExecutionTaskLite {
  _id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
  dueTime?: string;
  projectId?: string;
  tags: string[];
  estimateMinutes?: number;
  postponeCount?: number;
}

export interface ExecutionBlockLite {
  _id: string;
  title: string;
  day: string;
  startTime: string;
  endTime: string;
  kind: string;
  status?: string;
  fixed?: boolean;
  taskId?: string;
  projectId?: string;
}
