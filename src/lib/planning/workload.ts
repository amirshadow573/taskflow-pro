/**
 * Workload analysis + overload detection (Phase 10 §8, §9).
 *
 * A planning state — NOT a judgment about the user. Every classification
 * explains WHY, and when data is missing the analysis says so instead of
 * pretending exact numbers exist:
 *
 *   - No task estimates  → approximate, based on task count (and it says so).
 *   - No calendar/blocks → occupied time is `null`, never a fake 0.
 *   - Nothing to plan    → confidence "insufficient" + empty explanation,
 *                          so the UI can show the graceful empty state.
 *
 * Configuration (capacity, thresholds) lives in one documented block — the
 * engine is deterministic: same inputs → same classification.
 */
import type {
  OverloadSignal,
  PlanningEvent,
  PlanningMeeting,
  PlanningTimeBlock,
  WorkloadAnalysis,
  WorkloadState,
} from "@/lib/planning/types";
import type { NextActionTask } from "@/lib/next-action";
import { toFa } from "@/lib/persian";

/* ------------------------------------------------------------------ */
/* Documented configuration                                            */
/* ------------------------------------------------------------------ */

/**
 * Planning capacity for one day, in minutes. This is an explicit planning
 * ASSUMPTION (a standard 8-hour work window), shown in explanations — it is
 * never presented as a fact about the user's life.
 */
export const DEFAULT_DAY_CAPACITY_MINUTES = 480;

/** Load ratio boundaries (load = estimated + occupied, over capacity). */
export const WORKLOAD_THRESHOLDS = {
  balancedFrom: 0.35,
  heavyFrom: 0.75,
  overloadedFrom: 1.0,
} as const;

/**
 * Commitments without an end time (meetings, timed context events) are
 * counted at this duration. Transparent assumption — mentioned in the
 * explanation whenever it contributes.
 */
export const UNKNOWN_COMMITMENT_MINUTES = 60;

/** Count-based thresholds used ONLY when no task carries an estimate. */
const COUNT_THRESHOLDS = { balancedFrom: 4, heavyFrom: 7, overloadedFrom: 10 } as const;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function minutesOf(hhmm?: string): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function durationOf(start?: string, end?: string): number | null {
  const a = minutesOf(start);
  const b = minutesOf(end);
  if (a === null || b === null) return null;
  return Math.max(0, b - a);
}

function hoursFa(minutes: number): string {
  const h = minutes / 60;
  const rounded = Math.round(h * 10) / 10;
  return toFa(String(rounded));
}

export interface WorkloadInput {
  dayKey: string;
  /** Open root tasks due today. */
  openToday: NextActionTask[];
  /** Root tasks past their due date. */
  overdueCount: number;
  /** All of the user's time blocks (filtered internally by day). */
  timeBlocks: PlanningTimeBlock[];
  /** Context events happening today. */
  todayEvents: PlanningEvent[];
  /** Whether ANY schedule data exists (blocks/events anywhere). */
  hasScheduleData: boolean;
  /** Persona meetings today (employee/manager) — extra commitments. */
  meetingsToday?: PlanningMeeting[];
  /** Planned focus-session minutes today (employee) — counted as committed time. */
  focusPlannedMinutes?: number;
  capacityMinutes?: number;
}

export interface WorkloadResult {
  analysis: WorkloadAnalysis;
  /** Estimated minutes for today's open tasks (null when nothing estimated). */
  estimatedMinutes: number | null;
  occupiedMinutes: number | null;
}

/* ------------------------------------------------------------------ */
/* Occupied time                                                       */
/* ------------------------------------------------------------------ */

interface OccupiedBreakdown {
  minutes: number;
  blockMinutes: number;
  eventMinutes: number;
  /** Commitments without end times, counted with the documented default. */
  assumedCount: number;
}

function computeOccupied(input: WorkloadInput): OccupiedBreakdown | null {
  if (!input.hasScheduleData) return null;
  let blockMinutes = 0;
  for (const b of input.timeBlocks) {
    if (b.day !== input.dayKey) continue;
    blockMinutes += durationOf(b.startTime, b.endTime) ?? 0;
  }
  // Planned focus time counts as committed time for the day.
  blockMinutes += input.focusPlannedMinutes ?? 0;
  let eventMinutes = 0;
  let assumedCount = 0;
  for (const e of input.todayEvents) {
    const d = durationOf(e.startTime, e.endTime);
    if (d !== null) eventMinutes += d;
    else if (e.startTime) {
      eventMinutes += UNKNOWN_COMMITMENT_MINUTES;
      assumedCount += 1;
    }
  }
  for (const m of input.meetingsToday ?? []) {
    if (m.date !== input.dayKey) continue;
    // Meetings only carry a start time — count the documented default once.
    eventMinutes += UNKNOWN_COMMITMENT_MINUTES;
    assumedCount += 1;
  }
  return {
    minutes: blockMinutes + eventMinutes,
    blockMinutes,
    eventMinutes,
    assumedCount,
  };
}

/* ------------------------------------------------------------------ */
/* Classification                                                      */
/* ------------------------------------------------------------------ */

const STATE_VERDICT_FA: Record<WorkloadState, string> = {
  light: "بار امروز سبک است.",
  balanced: "بار امروز متعادل است.",
  heavy: "بار امروز سنگین است.",
  overloaded: "بار امروز از ظرفیت پیشنهادی فراتر است.",
};

/**
 * Analyze today's workload. Deterministic and explainable — every number in
 * the explanation comes from real estimates, calendar events or time blocks.
 */
export function analyzeWorkload(input: WorkloadInput): WorkloadResult {
  const capacity = input.capacityMinutes ?? DEFAULT_DAY_CAPACITY_MINUTES;
  const openToday = input.openToday;

  const estimatedSet = openToday.filter((t) => (t.estimateMinutes ?? 0) > 0);
  const estimatedMinutes = estimatedSet.length
    ? estimatedSet.reduce((n, t) => n + (t.estimateMinutes ?? 0), 0)
    : null;
  const coverage = openToday.length ? estimatedSet.length / openToday.length : 0;

  const occupied = computeOccupied(input);
  const occupiedMinutes = occupied ? occupied.minutes : null;

  const reasons: string[] = [];
  let state: WorkloadState;
  let confidence: WorkloadAnalysis["confidence"];

  const nothingToPlan =
    openToday.length === 0 && input.overdueCount === 0 && (occupiedMinutes ?? 0) === 0;

  if (nothingToPlan && !estimatedMinutes) {
    // Insufficient data — do NOT fabricate a workload.
    return {
      analysis: {
        state: "light",
        estimatedMinutes: null,
        estimateCoverage: 0,
        occupiedMinutes,
        capacityMinutes: capacity,
        availableMinutes: occupiedMinutes !== null ? Math.max(0, capacity - occupiedMinutes) : null,
        confidence: "insufficient",
        reasons: [],
        explanation: "",
      },
      estimatedMinutes: null,
      occupiedMinutes,
    };
  }

  if (estimatedMinutes !== null) {
    /* Estimates exist → ratio-based classification over capacity. */
    const load = estimatedMinutes + (occupiedMinutes ?? 0);
    const ratio = load / capacity;
    state =
      ratio >= WORKLOAD_THRESHOLDS.overloadedFrom
        ? "overloaded"
        : ratio >= WORKLOAD_THRESHOLDS.heavyFrom
          ? "heavy"
          : ratio >= WORKLOAD_THRESHOLDS.balancedFrom
            ? "balanced"
            : "light";
    confidence = occupiedMinutes !== null ? "exact" : "approximate";

    reasons.push(
      `${toFa(estimatedSet.length)} کار امروز حدود ${hoursFa(estimatedMinutes)} ساعت تخمین زده شده`,
    );
    if (coverage < 1) {
      reasons.push(
        `تخمین ${toFa(Math.round(coverage * 100))}٪ کارها ثبت شده — بقیه تخمینی نیستند`,
      );
    }
    if (occupiedMinutes !== null && occupiedMinutes > 0) {
      reasons.push(`${hoursFa(occupiedMinutes)} ساعت تعهد زمانی (جلسه/بلوک) داری`);
    } else if (occupiedMinutes === 0) {
      reasons.push("تعهد زمانی ثبت‌شده‌ای برای امروز نداری");
    }
  } else {
    /* No estimates → count-based approximation, clearly labeled. */
    const count = openToday.length;
    state =
      count >= COUNT_THRESHOLDS.overloadedFrom
        ? "overloaded"
        : count >= COUNT_THRESHOLDS.heavyFrom
          ? "heavy"
          : count >= COUNT_THRESHOLDS.balancedFrom
            ? "balanced"
            : "light";
    confidence = "approximate";
    reasons.push(`${toFa(count)} کار برای امروز داری`);
    reasons.push("برای هیچ‌کدام تخمین زمانی ثبت نشده — تخمین بر اساس تعداد کارهاست");
    if (occupiedMinutes !== null && occupiedMinutes > 0) {
      reasons.push(`${hoursFa(occupiedMinutes)} ساعت تعهد زمانی داری`);
    }
  }

  if (occupied && occupied.assumedCount > 0) {
    reasons.push(
      `${toFa(occupied.assumedCount)} تعهد بدون ساعت پایان با ${toFa(UNKNOWN_COMMITMENT_MINUTES)} دقیقه شمرده شد`,
    );
  }

  const explanation = [
    STATE_VERDICT_FA[state],
    reasons.join("، ") + (reasons.length ? "." : ""),
  ]
    .filter(Boolean)
    .join(" ");

  return {
    analysis: {
      state,
      estimatedMinutes,
      estimateCoverage: coverage,
      occupiedMinutes,
      capacityMinutes: capacity,
      availableMinutes:
        occupiedMinutes !== null ? Math.max(0, capacity - occupiedMinutes) : null,
      confidence,
      reasons,
      explanation,
    },
    estimatedMinutes,
    occupiedMinutes,
  };
}

/* ------------------------------------------------------------------ */
/* Overload detection (§9)                                             */
/* ------------------------------------------------------------------ */

export interface OverloadInput {
  dayKey: string;
  openToday: NextActionTask[];
  overdue: NextActionTask[];
  projects: Array<{ _id: string; name: string; deadline?: string; status: string }>;
  tasks: NextActionTask[];
  estimatedMinutes: number | null;
  occupiedMinutes: number | null;
  capacityMinutes: number;
}

/**
 * Detect planning conflicts. Each signal carries a Persian explanation.
 * Nothing is deleted, moved or deprioritized — detection only.
 */
export function detectOverload(input: OverloadInput): OverloadSignal[] {
  const signals: OverloadSignal[] = [];
  const push = (key: OverloadSignal["key"], detail: string) => {
    if (signals.length < 6) signals.push({ key, detail });
  };

  if (input.openToday.length >= 6) {
    push(
      "deadlines_today",
      `${toFa(input.openToday.length)} کار برای یک روز برنامه‌ریزی شده — واقع‌بینانه نیست؟`,
    );
  }

  if (input.overdue.length >= 3) {
    push(
      "overdue_accumulating",
      `${toFa(input.overdue.length)} کار عقب‌افتاده انباشته شده — یکی یکی تعیین تکلیف کن.`,
    );
  }

  const nearProject = input.projects.find((p) => {
    if (!p.deadline || p.status === "completed") return false;
    const delta = Math.round(
      (Date.parse(`${p.deadline}T00:00:00`) - Date.parse(`${input.dayKey}T00:00:00`)) /
        86400000,
    );
    if (delta < 0 || delta > 3) return false;
    return input.tasks.some((t) => t.projectId === p._id && t.status !== "done");
  });
  if (nearProject) {
    push(
      "project_deadline_near",
      `ددلاین پروژه «${nearProject.name}» نزدیک است و کارهایش هنوز باز‌اند.`,
    );
  }

  if (
    input.occupiedMinutes !== null &&
    input.occupiedMinutes >= input.capacityMinutes * 0.7 &&
    input.openToday.length > 0
  ) {
    push(
      "insufficient_focus_time",
      `بیش از ${toFa(70)}٪ روز درگیر تعهدهای زمانی است — فرصت اجرای کارها کم می‌شود.`,
    );
  }

  if (
    input.estimatedMinutes !== null &&
    input.estimatedMinutes + (input.occupiedMinutes ?? 0) > input.capacityMinutes
  ) {
    push(
      "estimates_exceed_capacity",
      `کارهای تخمین‌زده شده به‌علاوه تعهدها از ${hoursFa(input.capacityMinutes)} ساعت ظرفیت روز بیشتر است.`,
    );
  }

  return signals;
}
