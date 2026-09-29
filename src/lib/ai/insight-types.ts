/**
 * Phase 16 — AI Insights: versioned schema + pattern vocabulary.
 *
 * The single most important rule in this file (§10, §11, §28):
 *
 *   PATTERNS ARE DETERMINISTIC. The model never decides whether a pattern
 *   exists — `patterns.ts` proves it from workspace data or it does not exist.
 *   The model may only EXPLAIN a proven pattern and RECOMMEND a response.
 *
 * That is why `AIInsight` carries `evidence: InsightEvidence[]` as a required,
 * non-empty field and why `confidence` is a small labelled band rather than a
 * number. A made-up "87% confidence" would be fake numerical certainty (§11).
 *
 * Vocabulary mirrors src/lib/intelligence/types.ts (the Phase 13 engine) so
 * there is ONE insight language in the product, not two.
 *
 * Relative imports only — Convex bundles this file and does not resolve `@/`.
 */

/* ------------------------------------------------------------------ */
/* Versioning                                                          */
/* ------------------------------------------------------------------ */

export const AI_INSIGHT_SCHEMA_VERSION = "1.0";
export const SUPPORTED_AI_INSIGHT_VERSIONS = ["1.0"] as const;

/* ------------------------------------------------------------------ */
/* Patterns (§10) — detected in code, never by the model                */
/* ------------------------------------------------------------------ */

export type AIPatternType =
  | "repeated_delay"
  | "repeated_rescheduling"
  | "duration_underestimation"
  | "duration_overestimation"
  | "workload_overload"
  | "deadline_pressure"
  | "goal_stagnation"
  | "project_stagnation"
  | "focus_fragmentation"
  | "routine_instability"
  | "habit_break"
  | "recurring_blocker"
  | "excessive_context_switching"
  | "low_completion_capacity"
  | "schedule_adherence_gap";

export const AI_PATTERN_TYPES: readonly AIPatternType[] = [
  "repeated_delay",
  "repeated_rescheduling",
  "duration_underestimation",
  "duration_overestimation",
  "workload_overload",
  "deadline_pressure",
  "goal_stagnation",
  "project_stagnation",
  "focus_fragmentation",
  "routine_instability",
  "habit_break",
  "recurring_blocker",
  "excessive_context_switching",
  "low_completion_capacity",
  "schedule_adherence_gap",
];

export const PATTERN_LABELS_FA: Record<AIPatternType, string> = {
  repeated_delay: "تعویق مکرر",
  repeated_rescheduling: "جابه‌جایی مکرر",
  duration_underestimation: "کم‌برآورد کردن زمان",
  duration_overestimation: "بیش‌برآورد کردن زمان",
  workload_overload: "بار کاری بیش از ظرفیت",
  deadline_pressure: "فشار سررسید",
  goal_stagnation: "رکود هدف",
  project_stagnation: "رکود پروژه",
  focus_fragmentation: "تکه‌تکه شدن تمرکز",
  routine_instability: "بی‌ثباتی روتین",
  habit_break: "شکستن عادت",
  recurring_blocker: "ماندگاری کارِ گرفتارشده",
  excessive_context_switching: "تعویض زیاد زمینه",
  low_completion_capacity: "ظرفیت تکمیل پایین",
  schedule_adherence_gap: "فاصلهٔ پیروی از برنامه",
};

/* ------------------------------------------------------------------ */
/* Severity + confidence                                               */
/* ------------------------------------------------------------------ */

/** Reuses the Phase 13 severity vocabulary so both surfaces read alike. */
export type AIInsightSeverity = "critical" | "warning" | "info" | "positive";

/**
 * Honest bands, not fake precision (§11). The UI MUST render these as the
 * phrase they represent — "الگوی قوی", "الگوی در حال شکل‌گیری", "دادهٔ محدود" —
 * and never as a percentage.
 */
export type AIInsightConfidence = "strong_pattern" | "emerging_pattern" | "limited_data";

export const CONFIDENCE_LABELS_FA: Record<AIInsightConfidence, string> = {
  strong_pattern: "الگوی قوی",
  emerging_pattern: "الگوی در حال شکل‌گیری",
  limited_data: "دادهٔ محدود",
};

export const SEVERITY_LABELS_FA: Record<AIInsightSeverity, string> = {
  critical: "بحرانی",
  warning: "هشدار",
  info: "اطلاع",
  positive: "خوب",
};

export type AIInsightWindow = "today" | "7d" | "14d" | "30d";

/* ------------------------------------------------------------------ */
/* Evidence — one observable fact (§11, §13)                           */
/* ------------------------------------------------------------------ */

export interface AIInsightEvidence {
  label: string;
  value: string;
}

/* ------------------------------------------------------------------ */
/* A detected pattern (§10)                                            */
/* ------------------------------------------------------------------ */

/**
 * Produced ONLY by `patterns.ts`. This is the ground truth the model explains;
 * it is also what gets rendered when AI is unavailable, so the product still
 * shows real intelligence without a provider (§24).
 */
export interface DetectedPattern {
  type: AIPatternType;
  severity: AIInsightSeverity;
  confidence: AIInsightConfidence;
  /** "7d" etc. — the window the evidence was measured over. */
  timeWindow: AIInsightWindow;
  evidence: AIInsightEvidence[];
  /** Ids of the entities involved, so a click can open the right object. */
  affectedEntityIds: string[];
  /** Sample size behind the verdict — the anti-fabrication guard. */
  sampleSize: number;
  /** Deterministic Persian statement of WHAT the data shows. */
  statement: string;
}

/* ------------------------------------------------------------------ */
/* AI interpretation + recommendation (§2)                             */
/* ------------------------------------------------------------------ */

/** The model's reading of a proven pattern. Explains; never re-detects. */
export interface AIInsightInterpretation {
  /** Must be one of the patterns passed in; anything else is dropped. */
  patternType: AIPatternType;
  /** What this means for the user, in plain Persian. */
  explanation: string;
  /** What to actually do about it. */
  recommendation: string;
  severity: AIInsightSeverity;
  confidence: AIInsightConfidence;
  /** Optional extra evidence lines the model adds — merged, never replaces. */
  additionalEvidence: AIInsightEvidence[];
  /** Optional automation the user MAY want; never created automatically (§18). */
  automationSuggestion: AutomationSuggestion | null;
}

/** §18 — a proposal to the user, never an action the AI takes. */
export interface AutomationSuggestion {
  title: string;
  why: string;
}

/* ------------------------------------------------------------------ */
/* Response envelope (§25)                                             */
/* ------------------------------------------------------------------ */

export type AIInsightResponseType = "insight" | "review" | "insufficient_data";

/** §7 / §8 — the review shape. Sections are fixed so the UI never invents order. */
export const DAILY_REVIEW_SECTIONS = [
  "went_well",
  "missed",
  "friction",
  "unfinished",
  "tomorrow_risk",
  "adjustment",
] as const;

export const WEEKLY_REVIEW_SECTIONS = [
  "summary",
  "biggest_progress",
  "biggest_friction",
  "planning_accuracy",
  "execution_pattern",
  "workload_pattern",
  "goal_progress",
  "project_risks",
  "recommended_changes",
  "next_week_focus",
] as const;

export type DailyReviewSectionKey = (typeof DAILY_REVIEW_SECTIONS)[number];
export type WeeklyReviewSectionKey = (typeof WEEKLY_REVIEW_SECTIONS)[number];

export const REVIEW_SECTION_TITLES_FA: Record<string, string> = {
  went_well: "چه چیزی خوب پیش رفت",
  missed: "چه چیزی طبق برنامه پیش نرفت",
  friction: "بزرگ‌ترین مانع",
  unfinished: "کارهای ناتمام مهم",
  tomorrow_risk: "خطر فردا",
  adjustment: "تنظیم پیشنهادی",
  summary: "خلاصهٔ هفته",
  biggest_progress: "بزرگ‌ترین پیشرفت",
  biggest_friction: "بزرگ‌ترین مانع",
  planning_accuracy: "دقت برنامه‌ریزی",
  execution_pattern: "الگوی اجرا",
  workload_pattern: "الگوی بار کاری",
  goal_progress: "پیشرفت اهداف",
  project_risks: "ریسک پروژه‌ها",
  recommended_changes: "تغییرات پیشنهادی",
  next_week_focus: "تمرکز هفتهٔ بعد",
};

export interface AIInsightSection {
  key: string;
  /** Persian bullets; each one must trace back to workspace data. */
  lines: string[];
}

export interface AIInsightResponse {
  schema_version: string;
  response_type: AIInsightResponseType;
  persona: string;
  summary: string;
  /** One entry per PROVEN pattern, at most. Never a new detection. */
  interpretations: AIInsightInterpretation[];
  /** Present for `review` responses. */
  sections: AIInsightSection[];
  /** Reuses the Phase 15 action vocabulary and validator verbatim (§6). */
  actions: import("./types").AIAction[];
  /** Honest caveats: data gaps, small samples, conflicting signals. */
  warnings: string[];
  /** Patterns the deterministic engine found but the model did not address. */
  unexplainedPatterns: AIPatternType[];
  context_version: string;
  generated_at: number;
}

/* ------------------------------------------------------------------ */
/* Parsed result handed to the UI                                      */
/* ------------------------------------------------------------------ */

export interface AIInsightResult {
  response: AIInsightResponse;
  patterns: DetectedPattern[];
  /** Patterns the model skipped, so the UI can still show the real signal. */
  unexplainedPatterns: DetectedPattern[];
  /** True when there was genuinely not enough data to say anything. */
  insufficient: boolean;
  /** Data actually sent to the provider (§27 privacy disclosure). */
  contextSources: string[];
  confidence: AIInsightConfidence;
}

/** Version marker for the evidence envelope (§25 `context_version`). */
export const AI_CONTEXT_VERSION = "insight-ctx-1.0";

export const AI_MAX_INSIGHTS = 12;
export const AI_MAX_REVIEW_LINES = 6;

/** Shown whenever the deterministic engine has too little to work with (§11). */
export const INSUFFICIENT_DATA_FA =
  "هنوز فعالیت کافی ثبت نشده تا الگوی قابل اتکایی پیدا شود.";
