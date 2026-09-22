/**
 * Persona Stats — Phase 04 (pure config + scoring, no Convex/React imports).
 *
 * Stats answer "what am I becoming better at?" while XP answers "how far have
 * I progressed?". They are deliberately separate systems fed by the same real
 * activity.
 *
 * Design rules:
 *  - Everything here is DATA: stat definitions, persona sets, tiers, trend
 *    thresholds. Adding a persona or stat is a config change, not a refactor.
 *  - Values are always derived (0–100 normalized), never incremented, so
 *    deleted/reversed activity can never inflate them.
 *  - Quality over quantity: signals are ratios, on-time rates and outcomes —
 *    raw click/task volume never scores directly.
 *  - Insufficient data renders as "no data", never as a fake number.
 */

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** Format a number with Persian digits (server-side strings stay RTL-clean). */
export function faNum(n: number): string {
  return String(Math.round(n)).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

const clamp01 = (n: number): number => Math.max(0, Math.min(100, n));

/* ------------------------------------------------------------------ */
/* Metric results                                                      */
/* ------------------------------------------------------------------ */

/**
 * One computed signal inside a window.
 * `value === null` means "no data for this signal in this window" — it is
 * excluded from the weighted score instead of dragging it down.
 */
export interface MetricResult {
  value: number | null;
  /** Meaningful items behind the number — drives the insufficient-data gate. */
  evidence: number;
  /** Short Persian explanation, e.g. "تکمیل ۳ کار برنامه‌ریزی‌شده". */
  reason?: string;
}

export type MetricValues = Record<string, MetricResult>;

/* ------------------------------------------------------------------ */
/* Stat catalog (global — personas pick subsets + ordering)            */
/* ------------------------------------------------------------------ */

export interface StatSignal {
  metric: string;
  weight: number;
}

export interface StatDef {
  key: string;
  /** Persian display name. */
  label: string;
  /** One neutral sentence — what this measures, never a judgment of the user. */
  description: string;
  /** Icon name resolved by the UI (kept as data so this file stays pure). */
  icon: string;
  /** Tone key from the shared design system (blue | violet | emerald | …). */
  tone: string;
  signals: StatSignal[];
  /** Minimum evidence units before a value is shown at all. */
  minEvidence: number;
}

export const STAT_CATALOG: Record<string, StatDef> = {
  focus: {
    key: "focus",
    label: "تمرکز",
    description: "جلسه‌های کار متمرکز واقعی و پیوسته، نه صرفِ حضور در برنامه.",
    icon: "timer",
    tone: "blue",
    signals: [
      { metric: "focusDepth", weight: 0.6 },
      { metric: "activeDays", weight: 0.4 },
    ],
    minEvidence: 3,
  },
  consistency: {
    key: "consistency",
    label: "ثبات",
    description: "منظم بودن رفتار کاری در طول هفته‌ها و ماه‌ها.",
    icon: "flame",
    tone: "amber",
    signals: [
      { metric: "activeDays", weight: 0.5 },
      { metric: "routineAdherence", weight: 0.3 },
      { metric: "habitConsistency", weight: 0.2 },
    ],
    minEvidence: 4,
  },
  planning: {
    key: "planning",
    label: "برنامه‌ریزی",
    description: "کیفیت برنامه‌ریزی کارها و اجرای همان برنامه.",
    icon: "calendar",
    tone: "violet",
    signals: [
      { metric: "plannedDays", weight: 0.5 },
      { metric: "plannedCompletion", weight: 0.4 },
      { metric: "timeBlocks", weight: 0.1 },
    ],
    minEvidence: 3,
  },
  study: {
    key: "study",
    label: "مطالعه",
    description: "کار درسی واقعی: جلسه‌های مطالعه و تکالیف به‌موقع.",
    icon: "book",
    tone: "cyan",
    signals: [
      { metric: "studyDepth", weight: 0.6 },
      { metric: "assignmentsOnTime", weight: 0.4 },
    ],
    minEvidence: 2,
  },
  execution: {
    key: "execution",
    label: "انجام کار",
    description: "تبدیل برنامه به نتیجه — کارهای برنامه‌ریزی‌شده که تمام شدند.",
    icon: "check",
    tone: "emerald",
    signals: [
      { metric: "plannedCompletion", weight: 0.5 },
      { metric: "onTime", weight: 0.3 },
      { metric: "outcomes", weight: 0.2 },
    ],
    minEvidence: 3,
  },
  deadline: {
    key: "deadline",
    label: "ضرب‌الاجل",
    description: "رسیدن به موعدها بدون عقب‌افتادن کارها.",
    icon: "alarm",
    tone: "rose",
    signals: [
      { metric: "onTime", weight: 0.7 },
      { metric: "plannedCompletion", weight: 0.3 },
    ],
    minEvidence: 2,
  },
  client: {
    key: "client",
    label: "مدیریت مشتری",
    description: "جریان تحویل‌ها و تعهدهای مشتری‌ها — بدون قضاوت درباره رضایت آن‌ها.",
    icon: "briefcase",
    tone: "cyan",
    signals: [
      { metric: "deliveries", weight: 0.6 },
      { metric: "onTime", weight: 0.4 },
    ],
    minEvidence: 2,
  },
  team: {
    key: "team",
    label: "مدیریت تیم",
    description: "اقدام‌های هماهنگی تیم: تقسیم کار، پیگیری و جلسات.",
    icon: "users",
    tone: "violet",
    signals: [
      { metric: "teamActivity", weight: 0.6 },
      { metric: "meetingsDone", weight: 0.4 },
    ],
    minEvidence: 3,
  },
  projects: {
    key: "projects",
    label: "پروژه‌ها",
    description: "نقاط عطف و اهداف پروژه‌ای که به سرانجام رسیدند.",
    icon: "folder",
    tone: "blue",
    signals: [
      { metric: "milestones", weight: 0.7 },
      { metric: "outcomes", weight: 0.3 },
    ],
    minEvidence: 2,
  },
  strategy: {
    key: "strategy",
    label: "راهبرد",
    description: "پیشرفت اهداف بلندمدت و ابتکارهای راهبردی.",
    icon: "compass",
    tone: "violet",
    signals: [
      { metric: "goalProgress", weight: 0.6 },
      { metric: "outcomes", weight: 0.4 },
    ],
    minEvidence: 3,
  },
  sales: {
    key: "sales",
    label: "فروش",
    description: "پیش رفتن جریان فروش — فرصت‌ها و قراردادها، نه صرفِ فعالیت.",
    icon: "trending",
    tone: "emerald",
    signals: [
      { metric: "salesFlow", weight: 0.7 },
      { metric: "onTime", weight: 0.3 },
    ],
    minEvidence: 2,
  },
  operations: {
    key: "operations",
    label: "عملیات",
    description: "انضباط اجرای کارهای عملیاتی و پیشرفت ابتکارها.",
    icon: "settings",
    tone: "amber",
    signals: [
      { metric: "initiativeProgress", weight: 0.5 },
      { metric: "plannedCompletion", weight: 0.3 },
      { metric: "routineAdherence", weight: 0.2 },
    ],
    minEvidence: 3,
  },
  reliability: {
    key: "reliability",
    label: "پایبندی",
    description: "تعهدهای برنامه‌ریزی‌شده که سر وقت تمام شدند — نه قضاوت درباره توانایی.",
    icon: "shield",
    tone: "blue",
    signals: [
      { metric: "onTime", weight: 0.7 },
      { metric: "plannedCompletion", weight: 0.3 },
    ],
    minEvidence: 2,
  },
  goals: {
    key: "goals",
    label: "اهداف",
    description: "پیشرفت واقعی روی اهداف شخصی و گام‌هایشان.",
    icon: "target",
    tone: "rose",
    signals: [
      { metric: "goalProgress", weight: 0.6 },
      { metric: "outcomes", weight: 0.4 },
    ],
    minEvidence: 3,
  },
};

/* ------------------------------------------------------------------ */
/* Persona stat sets (order = personalized display order)              */
/* ------------------------------------------------------------------ */

export const PERSONA_STATS: Record<string, string[]> = {
  // §4 — Student
  student: ["focus", "consistency", "planning", "study", "execution"],
  // §7 — Employee
  employee: ["execution", "planning", "focus", "consistency", "reliability"],
  // §5 — Freelancer
  freelancer: ["execution", "deadline", "planning", "client", "consistency"],
  // §6 — Manager (also serves the "team" persona)
  manager: ["planning", "execution", "team", "projects", "consistency"],
  team: ["planning", "execution", "team", "projects", "consistency"],
  // §8 — Business owner
  business_owner: ["strategy", "execution", "sales", "operations", "consistency"],
  // §9 — Personal productivity (also serves the "custom" persona)
  personal: ["planning", "consistency", "focus", "goals", "execution"],
  custom: ["planning", "consistency", "focus", "goals", "execution"],
};

/** Resolve the ordered stat definitions for a persona (fallback: personal). */
export function statsForPersona(personaKey: string): StatDef[] {
  const keys = PERSONA_STATS[personaKey] ?? PERSONA_STATS.personal;
  return keys.map((k) => STAT_CATALOG[k]).filter((d): d is StatDef => !!d);
}

/* ------------------------------------------------------------------ */
/* Tiers (§14 — configurable, neutral terminology)                      */
/* ------------------------------------------------------------------ */

export interface StatTier {
  key: string;
  label: string;
  min: number;
}

export const STAT_TIERS: StatTier[] = [
  { key: "developing", label: "در حال شکل‌گیری", min: 0 },
  { key: "emerging", label: "در حال رشد", min: 20 },
  { key: "stable", label: "پایدار", min: 40 },
  { key: "strong", label: "مستحکم", min: 60 },
  { key: "advanced", label: "پیشرفته", min: 80 },
  { key: "exceptional", label: "چشمگیر", min: 95 },
];

export function tierForValue(value: number): StatTier {
  let tier = STAT_TIERS[0];
  for (const t of STAT_TIERS) if (value >= t.min) tier = t;
  return tier;
}

/* ------------------------------------------------------------------ */
/* Trend (§15 — no conclusions from insufficient data)                 */
/* ------------------------------------------------------------------ */

export type StatTrend = "up" | "down" | "flat";

/** Minimum delta (points) before a period-over-period change is called a trend. */
export const TREND_THRESHOLD = 6;

export function trendFor(
  current: { value: number; hasData: boolean } | null,
  previous: { value: number; hasData: boolean } | null,
): StatTrend | null {
  if (!current?.hasData || !previous?.hasData) return null;
  const delta = current.value - previous.value;
  if (delta >= TREND_THRESHOLD) return "up";
  if (delta <= -TREND_THRESHOLD) return "down";
  return "flat";
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

export interface StatScore {
  hasData: boolean;
  /** 0–100 — only meaningful when hasData is true. */
  value: number;
  evidence: number;
  reason: string;
  /** Which signals actually contributed (for debugging / future detail views). */
  parts: Array<{ metric: string; value: number; weight: number }>;
}

/**
 * Weighted score from metric results. Signals without data are dropped and
 * the remaining weights renormalized — a user with no routines is not
 * punished for having none, and a user with no data gets `hasData: false`
 * instead of a misleading number.
 */
export function scoreStat(def: StatDef, metrics: MetricValues): StatScore {
  let weightSum = 0;
  let acc = 0;
  let evidence = 0;
  const parts: StatScore["parts"] = [];
  const reasons: Array<{ weight: number; text: string }> = [];

  for (const signal of def.signals) {
    const m = metrics[signal.metric];
    if (!m || m.value === null) continue;
    weightSum += signal.weight;
    acc += clamp01(m.value) * signal.weight;
    evidence += m.evidence * signal.weight;
    parts.push({ metric: signal.metric, value: clamp01(m.value), weight: signal.weight });
    if (m.reason) reasons.push({ weight: signal.weight, text: m.reason });
  }

  const hasData = weightSum > 0 && evidence >= def.minEvidence;
  const value = weightSum > 0 ? Math.round(acc / weightSum) : 0;
  const reason = hasData
    ? reasons
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 2)
        .map((r) => r.text)
        .join(" · ")
    : "";

  return { hasData, value, evidence, reason, parts };
}

/* ------------------------------------------------------------------ */
/* Windows (§16 — comparable periods only)                              */
/* ------------------------------------------------------------------ */

export const DEFAULT_STAT_WINDOW = 30;
export const STAT_WINDOW_OPTIONS = [7, 30] as const;

/** Inclusive [from, to] day-key bounds of the current and previous window. */
export function windowBounds(
  today: string,
  windowDays: number,
  shift: (key: string, days: number) => string,
): { current: { from: string; to: string }; previous: { from: string; to: string } } {
  const currentTo = today;
  const currentFrom = shift(today, -(windowDays - 1));
  const previousTo = shift(currentFrom, -1);
  const previousFrom = shift(previousTo, -(windowDays - 1));
  return {
    current: { from: currentFrom, to: currentTo },
    previous: { from: previousFrom, to: previousTo },
  };
}

/** Trend display metadata shared by every surface (text, not color alone). */
export const TREND_META: Record<StatTrend, { label: string; symbol: string; tone: string }> = {
  up: { label: "در حال بهبود", symbol: "↑", tone: "emerald" },
  flat: { label: "ثابت", symbol: "→", tone: "slate" },
  down: { label: "کاهش", symbol: "↓", tone: "amber" },
};

/** Insufficient-data copy (§29). */
export const STATS_NO_DATA = "هنوز داده کافی نداریم";
export const STATS_EMPTY_STATE = "شروع کن تا الگوی پیشرفتت شکل بگیرد";
