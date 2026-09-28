/**
 * Adaptive Scheduling & Time Blocking — shared types (Phase 11).
 *
 * Everything here is DETERMINISTIC and derived from real data: the existing
 * timeBlocks table, context events, meetings, tasks and the Phase 10
 * PlanningEngine. Nothing mutates user state; scheduling changes always flow
 * through the existing controlled mutations after explicit confirmation.
 */
import type { SchedulePrefs } from "@/lib/preferences";

/* ------------------------------------------------------------------ */
/* Blocks                                                              */
/* ------------------------------------------------------------------ */

/** Shared block taxonomy (§4). Persona only changes the DISPLAY label. */
export type BlockKind =
  | "focus"
  | "task"
  | "meeting"
  | "study"
  | "routine"
  | "personal"
  | "break"
  | "review"
  | "planning"
  | "admin"
  | "other";

export type BlockStatus = "planned" | "completed" | "missed" | "cancelled";

/** A time block row, normalized for the engine and UI. */
export interface ScheduleBlock {
  _id: string;
  title: string;
  day: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  kind: string;
  status: string;
  /** Fixed blocks (meetings, confirmed commitments) never auto-move. */
  fixed: boolean;
  source: string;
  taskId?: string;
  projectId?: string;
  priority?: string;
}

/** A fixed commitment that blocks availability (context events, meetings). */
export interface FixedCommitment {
  id: string;
  title: string;
  day: string;
  startTime?: string;
  endTime?: string;
  /** "event" = context engine, "meeting" = persona meeting table. */
  origin: "event" | "meeting";
  type: string;
}

/* ------------------------------------------------------------------ */
/* Time math                                                           */
/* ------------------------------------------------------------------ */

export interface TimeSlot {
  start: string; // HH:mm
  end: string; // HH:mm
  minutes: number;
}

export interface Interval {
  start: string;
  end: string;
  minutes: number;
  /** What occupies this interval — for explanations. */
  label: string;
  kind: "fixed" | "scheduled" | "break" | "buffer";
  id?: string;
}

/* ------------------------------------------------------------------ */
/* Availability (§6)                                                   */
/* ------------------------------------------------------------------ */

export interface DayAvailability {
  day: string;
  windowStart: string;
  windowEnd: string;
  /** Total usable minutes inside the configured day window. */
  totalMinutes: number;
  /** Fixed commitments (events / meetings / fixed blocks). */
  fixedMinutes: number;
  /** Breaks and buffers reserved inside the window. */
  reservedMinutes: number;
  /** Scheduled flexible work (already-planned blocks). */
  scheduledMinutes: number;
  /** total − fixed − reserved − scheduled — the real planning room. */
  availableMinutes: number;
  /** Where the user could still place new work (buffer-padded). */
  gaps: TimeSlot[];
  /** True when no window/commitment data exists — never fabricate time. */
  unknown: boolean;
}

/* ------------------------------------------------------------------ */
/* Conflicts (§13)                                                     */
/* ------------------------------------------------------------------ */

export type ConflictKind =
  | "invalid_range"
  | "outside_window"
  | "overlap"
  | "double_booking"
  | "insufficient_duration"
  | "deadline_conflict"
  | "back_to_back";

export interface ScheduleConflict {
  /** Stable, deduplicable id. */
  id: string;
  kind: ConflictKind;
  day: string;
  /** Persian explanation of the conflict. */
  detail: string;
  a: { id?: string; title: string; start: string; end: string };
  b?: { id?: string; title: string; start: string; end: string };
}

/* ------------------------------------------------------------------ */
/* Placement (§12)                                                     */
/* ------------------------------------------------------------------ */

export interface PlacementTarget {
  taskId?: string;
  title: string;
  /** Real duration — NEVER fabricated; caller supplies from estimate/user. */
  minutes: number;
  dueDate?: string;
  priority?: string;
  projectId?: string;
}

export interface ProposedSlot {
  day: string;
  start: string;
  end: string;
  minutes: number;
  /** Persian reason this slot was proposed (deterministic). */
  reason: string;
  /** Higher = better fit; deterministic tie-breaks by day/time. */
  score: number;
}

export interface PlacementResult {
  /** Top candidate slots, best first (max 3). */
  slots: ProposedSlot[];
  /** Persian notes — why no slot, or what to watch out for. */
  notes: string[];
  /** True when the task has no usable duration (user must choose). */
  needsDuration: boolean;
}

/* ------------------------------------------------------------------ */
/* Recommendations (§29)                                               */
/* ------------------------------------------------------------------ */

export type ScheduleRecommendationType =
  | "SCHEDULE_TASK"
  | "RESCHEDULE_TASK"
  | "MOVE_FLEXIBLE_BLOCK"
  | "DEADLINE_CONFLICT"
  | "OVERLOAD_WARNING"
  | "INSUFFICIENT_TIME"
  | "MISSED_BLOCK"
  | "EMPTY_CAPACITY"
  | "BREAK_RECOMMENDATION"
  | "UNSCHEDULED_PRIORITY";

export type ScheduleRecSeverity = "critical" | "warning" | "info";

/** A confirmed-ready bulk change — ALWAYS previewed before applying (§30). */
export interface ProposedMove {
  blockId: string;
  title: string;
  from: { day: string; start: string; end: string };
  to: { day: string; start: string; end: string };
}

export interface ScheduleRecommendation {
  /** `${type}:${scope}:${entity}:${dayKey}` — idempotent across renders. */
  id: string;
  type: ScheduleRecommendationType;
  severity: ScheduleRecSeverity;
  /** Persian headline. */
  title: string;
  /** Persian explanation — WHY this is suggested. */
  detail: string;
  dayKey: string;
  /** Entity this targets (task / block id). */
  targetId?: string;
  /** A concrete proposed slot, when the rec offers one. */
  proposedSlot?: { day: string; start: string; end: string };
  /** Bulk plan (move list) — preview first, apply only after confirmation. */
  plan?: ProposedMove[];
}

/* ------------------------------------------------------------------ */
/* Weekly view (§8)                                                    */
/* ------------------------------------------------------------------ */

export type DayLoadState = "light" | "balanced" | "heavy" | "overloaded";

export interface WeekDaySummary {
  day: string;
  availability: DayAvailability;
  /** Work minutes due that day (scheduled + unscheduled estimates). */
  plannedMinutes: number;
  /** Unscheduled estimate minutes due that day. */
  unscheduledMinutes: number;
  /** Due-task count (open, root). */
  dueTaskCount: number;
  load: DayLoadState;
  isToday: boolean;
}

/* ------------------------------------------------------------------ */
/* Snapshot (§34) — future AI input                                    */
/* ------------------------------------------------------------------ */

export interface ScheduleSnapshot {
  date: string;
  availableTime: number | null;
  occupiedTime: number | null;
  fixedBlocks: Array<{ id: string; title: string; start: string; end: string }>;
  flexibleBlocks: Array<{ id: string; title: string; start: string; end: string; taskId?: string }>;
  unscheduledTasks: Array<{ id: string; title: string; minutes: number | null; dueDate?: string }>;
  /** Workload for the day (planned vs available). */
  workload: { plannedMinutes: number; availableMinutes: number | null; state: DayLoadState };
  conflicts: ScheduleConflict[];
  recommendations: ScheduleRecommendation[];
  nextBlock: { id: string; title: string; start: string; end: string; taskId?: string } | null;
  /** Week distribution — supports weekly planning for the future AI. */
  week: Array<{ day: string; plannedMinutes: number; availableMinutes: number | null; load: DayLoadState }>;
  generatedAt: number;
}

/* ------------------------------------------------------------------ */
/* Labels (Persian)                                                    */
/* ------------------------------------------------------------------ */

export const BLOCK_KIND_LABELS_FA: Record<string, string> = {
  focus: "تمرکز",
  task: "کار",
  meeting: "جلسه",
  study: "مطالعه",
  routine: "روتین",
  personal: "شخصی",
  break: "استراحت",
  review: "بازبینی",
  planning: "برنامه‌ریزی",
  admin: "اداری",
  other: "سایر",
};

/**
 * Persona display labels (§4) — SAME engine, same kinds; only the wording
 * differs per persona.
 */
export const PERSONA_BLOCK_LABELS: Record<string, Partial<Record<BlockKind, string>>> = {
  student: { focus: "بلوک مطالعه", study: "مطالعه درس", review: "مرور" },
  employee: { focus: "کار عمیق", admin: "کار اداری" },
  freelancer: { focus: "کار مشتری", task: "کار پروژه" },
  manager: { focus: "کار تمرکزی", planning: "برنامه‌ریزی تیم", meeting: "هماهنگی تیم" },
  business_owner: { focus: "کار کسب‌وکار", review: "بازبینی مالی" },
  personal: { focus: "تمرکز شخصی", personal: "کار شخصی" },
};

export function blockLabel(kind: string, persona?: string): string {
  const base = (BLOCK_KIND_LABELS_FA[kind] ?? BLOCK_KIND_LABELS_FA.other)!;
  if (persona) {
    const override = PERSONA_BLOCK_LABELS[persona]?.[kind as BlockKind];
    if (override) return override;
  }
  return base;
}

export const BLOCK_STATUS_LABELS_FA: Record<string, string> = {
  planned: "برنامه‌ریزی‌شده",
  completed: "انجام‌شده",
  missed: "از دست رفته",
  cancelled: "لغوشده",
};

export const DAY_LOAD_LABELS_FA: Record<DayLoadState, string> = {
  light: "سبک",
  balanced: "متعادل",
  heavy: "سنگین",
  overloaded: "بیش از ظرفیت",
};

export const SCHEDULE_REC_META: Record<
  ScheduleRecommendationType,
  { labelFa: string; tone: ScheduleRecSeverity }
> = {
  SCHEDULE_TASK: { labelFa: "زمان‌بندی", tone: "info" },
  RESCHEDULE_TASK: { labelFa: "زمان‌بندی مجدد", tone: "warning" },
  MOVE_FLEXIBLE_BLOCK: { labelFa: "انتقال", tone: "warning" },
  DEADLINE_CONFLICT: { labelFa: "تعارض موعد", tone: "critical" },
  OVERLOAD_WARNING: { labelFa: "بیش‌باری", tone: "critical" },
  INSUFFICIENT_TIME: { labelFa: "کمبود وقت", tone: "warning" },
  MISSED_BLOCK: { labelFa: "از دست رفته", tone: "warning" },
  EMPTY_CAPACITY: { labelFa: "ظرفیت خالی", tone: "info" },
  BREAK_RECOMMENDATION: { labelFa: "استراحت", tone: "info" },
  UNSCHEDULED_PRIORITY: { labelFa: "بدون برنامه", tone: "warning" },
};

/** Empty-state copy (§40) — scheduling never fabricates data. */
export const SCHEDULING_EMPTY_STATE_FA = "اطلاعات کافی برای ساخت برنامه وجود ندارد.";

export type { SchedulePrefs };
