/**
 * Phase 16 — deterministic pattern detection (§3, §4, §10, §11).
 *
 * THIS FILE IS THE HONESTY GUARANTEE.
 *
 * A pattern exists only when the numbers here prove it. The AI never decides
 * that something is a pattern — it only explains patterns this module produced.
 * Every detector declares its own minimum sample size, and returns nothing when
 * the data is thinner than that. "No pattern found" is a real, acceptable
 * result; inventing one is not (§11, §28).
 *
 * Pure module: plain data in, `DetectedPattern[]` out. No database, no
 * Convex types, no model calls.
 */
import type {
  AIInsightConfidence,
  AIInsightSeverity,
  AIInsightWindow,
  AIPatternType,
  DetectedPattern,
} from "./insight-types";

/* ------------------------------------------------------------------ */
/* Thresholds — named and auditable (§33 of the product spec)           */
/* ------------------------------------------------------------------ */

/** Minimum samples before any statistical claim is made. */
export const MIN_SAMPLES = {
  estimate: 4,
  workloadDays: 3,
  completionDays: 5,
  focusSessions: 4,
  habitPeriods: 3,
  goalStagnationWeeks: 2,
} as const;

/** Ratio above which we call time estimates systematically low/high. */
export const ESTIMATION_RATIO_THRESHOLD = 1.3;

/** Share of a day spent in sessions under this length = fragmented focus. */
export const SHORT_SESSION_MINUTES = 20;
export const FRAGMENTED_SHARE_THRESHOLD = 0.4;

/** Postponements on one task before it counts as recurring. */
export const REPEATED_POSTPONE_THRESHOLD = 3;

/** Utilization above which a day counts as overloaded. */
export const OVERLOAD_UTILIZATION = 1.0;

/* ------------------------------------------------------------------ */
/* Input — a flat, already-aggregated evidence set                     */
/* ------------------------------------------------------------------ */

export interface WorkloadDayInput {
  day: string;
  plannedMinutes: number;
  capacityMinutes: number | null;
}

export interface EstimateSample {
  id: string;
  title: string;
  estimateMinutes: number;
  actualMinutes: number;
}

export interface PostponedTaskInput {
  id: string;
  title: string;
  postponeCount: number;
  overdue: boolean;
}

export interface PatternInput {
  window: AIInsightWindow;
  /** Tasks that moved forward at least `postponeCount` times. */
  postponed: PostponedTaskInput[];
  /** Estimate vs real minutes for finished work. */
  estimates: EstimateSample[];
  /** Per-day planned minutes vs real capacity. */
  workload: WorkloadDayInput[];
  /** Planned vs completed task counts over the window. */
  plannedCount: number;
  completedCount: number;
  /** Minutes placed in blocks vs minutes actually executed. */
  scheduledMinutes: number;
  actualMinutes: number;
  /** Execution sessions + how many ended early/interrupted. */
  focusSessions: number;
  interruptedSessions: number;
  shortSessionCount: number;
  /** Daily routine completion counts. */
  routineDays: Array<{ day: string; done: number; total: number }>;
  /** Habit completion per period. */
  habits: Array<{ id: string; title: string; target: number; done: number; periods: number }>;
  /** Active goals and their recent progress movement. */
  goals: Array<{ id: string; title: string; progress: number; daysSinceUpdate: number }>;
  /** Active projects. */
  projects: Array<{
    id: string;
    name: string;
    openTasks: number;
    overdueTasks: number;
    progressPct: number | null;
  }>;
  /** Tasks repeatedly reported as blocked. */
  blockedTasks: Array<{ id: string; title: string; blockCount: number }>;
  /** How many times the user rescheduled a block in the window. */
  rescheduleCount: number;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const pct = (n: number): string => `${Math.round(n)}٪`;

function clampSeverity(v: number): AIInsightSeverity {
  if (v >= 1.5) return "critical";
  if (v >= 1.0) return "warning";
  return "info";
}

/** More samples ⇒ more confidence. Never a percentage (§11). */
function confidenceFor(samples: number, strongAt: number): AIInsightConfidence {
  if (samples >= strongAt) return "strong_pattern";
  if (samples >= Math.ceil(strongAt / 2)) return "emerging_pattern";
  return "limited_data";
}

function make(
  type: AIPatternType,
  input: PatternInput,
  opts: {
    severity: AIInsightSeverity;
    confidence: AIInsightConfidence;
    evidence: DetectedPattern["evidence"];
    affectedEntityIds?: string[];
    sampleSize: number;
    statement: string;
  },
): DetectedPattern {
  return {
    type,
    severity: opts.severity,
    confidence: opts.confidence,
    timeWindow: input.window,
    evidence: opts.evidence,
    affectedEntityIds: opts.affectedEntityIds ?? [],
    sampleSize: opts.sampleSize,
    statement: opts.statement,
  };
}

/* ------------------------------------------------------------------ */
/* Detectors                                                           */
/* ------------------------------------------------------------------ */

/** §3 — the same task pushed forward again and again. */
function detectRepeatedDelay(input: PatternInput): DetectedPattern | null {
  const repeated = input.postponed.filter(
    (t) => t.postponeCount >= REPEATED_POSTPONE_THRESHOLD,
  );
  if (repeated.length === 0) return null;

  const worst = [...repeated].sort((a, b) => b.postponeCount - a.postponeCount).slice(0, 5);
  const overdue = repeated.filter((t) => t.overdue).length;

  return make("repeated_delay", input, {
    severity: overdue > 0 ? "warning" : "info",
    confidence: confidenceFor(repeated.length, 3),
    evidence: [
      { label: "کارهای چندبار تعویق‌خورده", value: String(repeated.length) },
      { label: "بیشترین تعداد تعویق", value: String(worst[0]?.postponeCount ?? 0) },
      { label: "از این تعداد، عقب‌افتاده", value: String(overdue) },
    ],
    affectedEntityIds: worst.map((t) => t.id),
    sampleSize: repeated.length,
    statement: `${repeated.length} کار دست‌کم ${REPEATED_POSTPONE_THRESHOLD} بار به روز بعد منتقل شده‌اند.`,
  });
}

/** §3 — plans rewritten over and over. */
function detectRepeatedRescheduling(input: PatternInput): DetectedPattern | null {
  if (input.rescheduleCount < 3) return null;
  return make("repeated_rescheduling", input, {
    severity: input.rescheduleCount >= 6 ? "warning" : "info",
    confidence: confidenceFor(input.rescheduleCount, 6),
    evidence: [
      { label: "تعداد جابه‌جایی بلوک زمانی", value: String(input.rescheduleCount) },
    ],
    sampleSize: input.rescheduleCount,
    statement: `در این بازه ${input.rescheduleCount} بار برنامهٔ زمانی جابه‌جا شده است.`,
  });
}

/** §3 — estimates vs reality, in both directions. */
function detectEstimationBias(input: PatternInput): DetectedPattern | null {
  if (input.estimates.length < MIN_SAMPLES.estimate) return null;

  const sumEstimate = input.estimates.reduce((n, e) => n + e.estimateMinutes, 0);
  const sumActual = input.estimates.reduce((n, e) => n + e.actualMinutes, 0);
  if (sumEstimate <= 0) return null;

  const ratio = sumActual / sumEstimate;
  const under = ratio >= ESTIMATION_RATIO_THRESHOLD;
  const over = ratio <= 1 / ESTIMATION_RATIO_THRESHOLD;
  if (!under && !over) return null;

  const drift = Math.abs(sumActual - sumEstimate);
  const worst = [...input.estimates]
    .sort((a, b) => b.actualMinutes / Math.max(1, b.estimateMinutes) - a.actualMinutes / Math.max(1, a.estimateMinutes))
    .slice(0, 3);

  return make(
    under ? "duration_underestimation" : "duration_overestimation",
    input,
    {
      severity: clampSeverity(ratio >= 1.8 || ratio <= 0.5 ? 2 : 1),
      confidence: confidenceFor(input.estimates.length, 8),
      evidence: [
        { label: "زمان تخمین‌زده", value: `${sumEstimate} دقیقه` },
        { label: "زمان واقعی", value: `${sumActual} دقیقه` },
        { label: "اختلاف", value: `${under ? "+" : ""}${drift} دقیقه` },
        { label: "نمونه", value: `${input.estimates.length} کار` },
      ],
      affectedEntityIds: worst.map((e) => e.id),
      sampleSize: input.estimates.length,
      statement: under
        ? `زمان واقعی این کارها به‌طور میانگین ${ratio.toFixed(1)} برابر زمان تخمین‌زده بوده است.`
        : `زمان تخمین‌زده به‌طور میانگین ${ratio.toFixed(1)} برابر زمان واقعی بوده است.`,
    },
  );
}

/** §3 — days that simply did not fit. */
function detectWorkloadOverload(input: PatternInput): DetectedPattern | null {
  const comparable = input.workload.filter((d) => (d.capacityMinutes ?? 0) > 0);
  if (comparable.length < MIN_SAMPLES.workloadDays) return null;

  const overloaded = comparable.filter(
    (d) => d.plannedMinutes > (d.capacityMinutes as number) * OVERLOAD_UTILIZATION,
  );
  if (overloaded.length === 0) return null;

  const worst = [...overloaded].sort((a, b) => b.plannedMinutes - a.plannedMinutes)[0];
  const utilization = (worst.plannedMinutes / (worst.capacityMinutes as number)) * 100;

  return make("workload_overload", input, {
    severity: overloaded.length >= comparable.length / 2 ? "warning" : "info",
    confidence: confidenceFor(overloaded.length, 3),
    evidence: [
      { label: "روزهای پرتر از ظرفیت", value: `${overloaded.length} از ${comparable.length}` },
      { label: "پرترین روز", value: worst.day },
      { label: "بار آن روز نسبت به ظرفیت", value: pct(utilization) },
    ],
    affectedEntityIds: [],
    sampleSize: overloaded.length,
    statement: `${overloaded.length} روز، کار برنامه‌ریزی‌شده از ظرفیت واقعی بیشتر بوده است.`,
  });
}

/** §3 — work that keeps sliding past its date. */
function detectDeadlinePressure(input: PatternInput): DetectedPattern | null {
  const overdue = input.postponed.filter((t) => t.overdue);
  if (overdue.length < 2) return null;

  return make("deadline_pressure", input, {
    severity: overdue.length >= 4 ? "warning" : "info",
    confidence: confidenceFor(overdue.length, 5),
    evidence: [
      { label: "کارهای عقب‌افتاده", value: String(overdue.length) },
      { label: "از مجموع کارهای باز", value: String(input.postponed.length + overdue.length) },
    ],
    affectedEntityIds: overdue.slice(0, 5).map((t) => t.id),
    sampleSize: overdue.length,
    statement: `${overdue.length} کار از تاریخ سررسید گذشته‌اند.`,
  });
}

/** §9 — goals nobody has touched lately. */
function detectGoalStagnation(input: PatternInput): DetectedPattern | null {
  const stagnant = input.goals.filter(
    (g) => g.daysSinceUpdate >= MIN_SAMPLES.goalStagnationWeeks * 7,
  );
  if (stagnant.length === 0) return null;

  return make("goal_stagnation", input, {
    severity: stagnant.length >= 3 ? "warning" : "info",
    confidence: confidenceFor(stagnant.length, 3),
    evidence: [
      { label: "اهداف بدون به‌روزرسانی", value: String(stagnant.length) },
      { label: "بیشترین توقف", value: `${Math.max(...stagnant.map((g) => g.daysSinceUpdate))} روز` },
    ],
    affectedEntityIds: stagnant.slice(0, 5).map((g) => g.id),
    sampleSize: stagnant.length,
    statement: `${stagnant.length} هدف دست‌کم دو هفته به‌روز نشده‌اند.`,
  });
}

/** §9 — projects losing momentum. */
function detectProjectStagnation(input: PatternInput): DetectedPattern | null {
  const atRisk = input.projects.filter(
    (p) => p.overdueTasks > 0 || (p.progressPct !== null && p.openTasks > 0 && p.progressPct < 20),
  );
  if (atRisk.length === 0) return null;

  return make("project_stagnation", input, {
    severity: atRisk.some((p) => p.overdueTasks >= 3) ? "warning" : "info",
    confidence: confidenceFor(atRisk.length, 3),
    evidence: [
      { label: "پروژه‌های پرریسک", value: String(atRisk.length) },
      {
        label: "مجموع کارهای عقب‌افتادهٔ این پروژه‌ها",
        value: String(atRisk.reduce((n, p) => n + p.overdueTasks, 0)),
      },
    ],
    affectedEntityIds: atRisk.slice(0, 5).map((p) => p.id),
    sampleSize: atRisk.length,
    statement: `${atRisk.length} پروژه کار عقب‌افتاده یا پیشرفت بسیار کم دارند.`,
  });
}

/** §3 — focus broken into unusable pieces. */
function detectFocusFragmentation(input: PatternInput): DetectedPattern | null {
  if (input.focusSessions < MIN_SAMPLES.focusSessions) return null;

  const share = input.shortSessionCount / input.focusSessions;
  if (share < FRAGMENTED_SHARE_THRESHOLD) return null;

  return make("focus_fragmentation", input, {
    severity: share >= 0.6 ? "warning" : "info",
    confidence: confidenceFor(input.focusSessions, 10),
    evidence: [
      { label: "نشست‌های تمرکز", value: String(input.focusSessions) },
      { label: "نشست‌های کوتاه‌تر از ۲۰ دقیقه", value: `${input.shortSessionCount} (${pct(share * 100)})` },
    ],
    affectedEntityIds: [],
    sampleSize: input.focusSessions,
    statement: `${pct(share * 100)} از نشست‌های تمرکز کوتاه‌تر از ۲۰ دقیقه بوده‌اند.`,
  });
}

/** §3 — frequent context switching. */
function detectContextSwitching(input: PatternInput): DetectedPattern | null {
  if (input.focusSessions < MIN_SAMPLES.focusSessions) return null;
  const ratio = input.interruptedSessions / input.focusSessions;
  if (ratio < 0.5) return null;

  return make("excessive_context_switching", input, {
    severity: ratio >= 0.7 ? "warning" : "info",
    confidence: confidenceFor(input.focusSessions, 10),
    evidence: [
      { label: "نشست‌های اجرا", value: String(input.focusSessions) },
      { label: "نشست‌های قطع‌شده یا ناتمام", value: `${input.interruptedSessions} (${pct(ratio * 100)})` },
    ],
    affectedEntityIds: [],
    sampleSize: input.focusSessions,
    statement: `${pct(ratio * 100)} از نشست‌های اجرا پیش از پایان بسته شده‌اند.`,
  });
}

/** §3 — daily routines that stopped happening. */
function detectRoutineInstability(input: PatternInput): DetectedPattern | null {
  if (input.routineDays.length < MIN_SAMPLES.completionDays) return null;

  const rates = input.routineDays.map((d) => (d.total > 0 ? d.done / d.total : 0));
  const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
  if (avg >= 0.7) return null;

  return make("routine_instability", input, {
    severity: avg < 0.4 ? "warning" : "info",
    confidence: confidenceFor(input.routineDays.length, 7),
    evidence: [
      { label: "میانگین انجام روتین", value: pct(avg * 100) },
      { label: "روزهای بررسی‌شده", value: String(input.routineDays.length) },
    ],
    affectedEntityIds: [],
    sampleSize: input.routineDays.length,
    statement: `روتین‌ها به‌طور میانگین در ${pct(avg * 100)} از موارد انجام شده‌اند.`,
  });
}

/** §9 — habits that broke. */
function detectHabitBreak(input: PatternInput): DetectedPattern | null {
  const broken = input.habits.filter(
    (h) => h.periods >= MIN_SAMPLES.habitPeriods && h.target > 0 && h.done / h.target < 0.5,
  );
  if (broken.length === 0) return null;

  return make("habit_break", input, {
    severity: broken.length >= 2 ? "warning" : "info",
    confidence: confidenceFor(broken.length, 3),
    evidence: [
      { label: "عادت‌های نیمه‌کاره", value: String(broken.length) },
      { label: "نام عادت", value: broken[0]?.title ?? "—" },
    ],
    affectedEntityIds: broken.slice(0, 5).map((h) => h.id),
    sampleSize: broken.length,
    statement: `${broken.length} عادت در بیش از نیستی از بازه‌ها به هدف نرسیده است.`,
  });
}

/** §3 — work that is blocked again and again. */
function detectRecurringBlocker(input: PatternInput): DetectedPattern | null {
  const blocked = input.blockedTasks.filter((t) => t.blockCount >= 2);
  if (blocked.length === 0) return null;

  return make("recurring_blocker", input, {
    severity: "warning",
    confidence: confidenceFor(blocked.length, 2),
    evidence: [
      { label: "کارهای تکرارشوندهٔ گرفتارشده", value: String(blocked.length) },
      { label: "بیشترین تعداد توقف", value: String(Math.max(...blocked.map((t) => t.blockCount))) },
    ],
    affectedEntityIds: blocked.slice(0, 5).map((t) => t.id),
    sampleSize: blocked.length,
    statement: `${blocked.length} کار دست‌کم دو بار به‌عنوان گرفتارشده ثبت شده است.`,
  });
}

/** §3 — how little of the plan actually happens. */
function detectLowCompletionCapacity(input: PatternInput): DetectedPattern | null {
  if (input.scheduledMinutes <= 0 || input.focusSessions < MIN_SAMPLES.completionDays) return null;

  const adherence = input.actualMinutes / input.scheduledMinutes;
  if (adherence >= 0.75) return null;

  return make("low_completion_capacity", input, {
    severity: adherence < 0.5 ? "warning" : "info",
    confidence: confidenceFor(input.focusSessions, 12),
    evidence: [
      { label: "زمان برنامه‌ریزی‌شده", value: `${input.scheduledMinutes} دقیقه` },
      { label: "زمان واقعی اجراشده", value: `${input.actualMinutes} دقیقه` },
      { label: "نرخ پیروی از برنامه", value: pct(adherence * 100) },
    ],
    affectedEntityIds: [],
    sampleSize: input.focusSessions,
    statement: `از زمان برنامه‌ریزی‌شده تنها ${pct(adherence * 100)} اجرا شده است.`,
  });
}

/** §3 — the plan itself is bigger than the user ever finishes. */
function detectPlanTooHeavy(input: PatternInput): DetectedPattern | null {
  if (input.plannedCount <= 0 || input.completedCount < MIN_SAMPLES.completionDays) return null;

  const ratio = input.completedCount / input.plannedCount;
  if (ratio >= 0.7) return null;

  return make("schedule_adherence_gap", input, {
    severity: ratio < 0.45 ? "warning" : "info",
    confidence: confidenceFor(input.plannedCount, 10),
    evidence: [
      { label: "کارهای برنامه‌ریزی‌شده", value: String(input.plannedCount) },
      { label: "کارهای انجام‌شده", value: String(input.completedCount) },
      { label: "نرخ تکمیل", value: pct(ratio * 100) },
    ],
    affectedEntityIds: [],
    sampleSize: input.plannedCount,
    statement: `از ${input.plannedCount} کار برنامه‌ریزی‌شده، ${input.completedCount} مورد انجام شده است.`,
  });
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

const DETECTORS: Array<(i: PatternInput) => DetectedPattern | null> = [
  detectRepeatedDelay,
  detectRepeatedRescheduling,
  detectEstimationBias,
  detectWorkloadOverload,
  detectDeadlinePressure,
  detectGoalStagnation,
  detectProjectStagnation,
  detectFocusFragmentation,
  detectContextSwitching,
  detectRoutineInstability,
  detectHabitBreak,
  detectRecurringBlocker,
  detectLowCompletionCapacity,
  detectPlanTooHeavy,
];

/**
 * Run every detector. The result is ordered worst-first so the UI shows what
 * matters without the model having to rank anything.
 */
export function detectPatterns(input: PatternInput): DetectedPattern[] {
  const found: DetectedPattern[] = [];
  for (const detect of DETECTORS) {
    const p = detect(input);
    if (p) found.push(p);
  }
  const rank: Record<AIInsightSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
    positive: 3,
  };
  return found.sort(
    (a, b) => rank[a.severity] - rank[b.severity] || b.sampleSize - a.sampleSize,
  );
}

/** True when the input is too thin for ANY claim to be honest. */
export function isInsufficientEvidence(input: PatternInput): boolean {
  return (
    input.completedCount < MIN_SAMPLES.completionDays &&
    input.focusSessions < MIN_SAMPLES.focusSessions &&
    input.postponed.length === 0 &&
    input.workload.length < MIN_SAMPLES.workloadDays
  );
}
