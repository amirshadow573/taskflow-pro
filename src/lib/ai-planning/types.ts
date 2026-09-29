/**
 * Phase 10.5 — AI Plan (v1) shared types.
 *
 * The AI plan is the ONLY contract between an EXTERNAL AI (the user's own
 * ChatGPT / Gemini / Claude account) and this productivity platform. The
 * platform never calls an AI API: the user copies a persona-specific prompt,
 * answers the questions in their own AI tool, and brings back a JSON file
 * that conforms to the schema below.
 *
 * Two layers are preserved forever and never mixed:
 *   1. USER INPUT  — what the user told the external AI
 *      (user_context + planning_inputs + planning_assumptions)
 *   2. AI PLAN     — what the external AI decided
 *      (plan.goals / projects / tasks / calendar_events / time_blocks / …)
 *
 * The file is untrusted input: it is parsed as data only, never executed.
 */

export const AI_PLAN_SCHEMA_VERSION = "1.0";
export const SUPPORTED_SCHEMA_VERSIONS: readonly string[] = ["1.0"];

/** Source abstraction (§24) — UI says "ChatGPT", the model is provider-agnostic. */
export type AIPlanSourceType =
  | "external_chatgpt"
  | "external_gemini"
  | "external_claude"
  | "future_api"
  | "future_provider";

export const SOURCE_LABELS: Record<AIPlanSourceType, string> = {
  external_chatgpt: "ChatGPT",
  external_gemini: "Gemini",
  external_claude: "Claude",
  future_api: "اتصال مستقیم (آینده)",
  future_provider: "ارائه‌دهنده دیگر (آینده)",
};

export interface AIPlanSource {
  type: AIPlanSourceType;
  provider: string;
  generated_at?: string;
}

/* ------------------------------------------------------------------ */
/* Layer 1 — USER INPUT (everything the user stated)                   */
/* ------------------------------------------------------------------ */

export interface AIPlanUserContext {
  profile?: string[];
  environment?: string[];
  constraints?: string[];
  preferences?: string[];
}

export interface AIPlanInputs {
  fixed_schedule?: string[];
  availability?: string[];
  goals?: string[];
  priorities?: string[];
  deadlines?: string[];
  commitments?: string[];
  subjects?: string[];
  projects?: string[];
}

/* ------------------------------------------------------------------ */
/* Layer 2 — AI-GENERATED PLAN (what the AI decided)                   */
/* ------------------------------------------------------------------ */

export interface AIPlanGoal {
  title: string;
  description?: string;
  due_date?: string;
  priority?: string;
  notes?: string;
}

export interface AIPlanProject {
  title: string;
  description?: string;
  deadline?: string;
  status?: string;
  goal_ref?: string;
  notes?: string;
}

export interface AIPlanTask {
  title: string;
  description?: string;
  due_date?: string;
  due_time?: string;
  priority?: string;
  /** Title of a project inside THIS file (resolved on import). */
  project_ref?: string;
  /** Title of a goal inside THIS file (kept as a tag reference). */
  goal_ref?: string;
  tags?: string[];
  estimate_minutes?: number;
}

export interface AIPlanCalendarEvent {
  title: string;
  day: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  kind?: string;
  notes?: string;
}

export interface AIPlanTimeBlock {
  title: string;
  day: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  kind?: string;
  task_ref?: string;
  notes?: string;
}

export interface AIPlanRoutine {
  title: string;
  items?: string[];
}

export interface AIPlanHabit {
  title: string;
  frequency: "daily" | "weekly";
  target?: number;
  description?: string;
}

export interface AIPlanMilestone {
  title: string;
  goal_ref?: string;
  due_date?: string;
  notes?: string;
}

export interface AIPlanBody {
  goals: AIPlanGoal[];
  projects: AIPlanProject[];
  tasks: AIPlanTask[];
  calendar_events: AIPlanCalendarEvent[];
  time_blocks: AIPlanTimeBlock[];
  routines: AIPlanRoutine[];
  habits: AIPlanHabit[];
  milestones: AIPlanMilestone[];
}

/** The canonical import document (already normalized: every array exists). */
export interface NormalizedAIPlan {
  schema_version: string;
  source: AIPlanSource;
  persona: string;
  user_context: Required<AIPlanUserContext>;
  planning_inputs: Required<AIPlanInputs>;
  planning_assumptions: string[];
  plan: AIPlanBody;
  explanations: string[];
  warnings: string[];
  conflicts: string[];
  /** Non-schema information about the normalization pass (audit + UI). */
  meta: {
    importedAt: number;
    /** Fields that were present but malformed and therefore dropped. */
    dropped: string[];
    counts: Record<keyof AIPlanBody | "assumptions" | "explanations", number>;
  };
}

/* ------------------------------------------------------------------ */
/* Validation + conflict vocabulary                                    */
/* ------------------------------------------------------------------ */

export type IssueLevel = "error" | "warning";

export interface PlanIssue {
  level: IssueLevel;
  field: string;
  message: string;
}

/** An error means the file is rejected; warnings are shown but allowed. */
export interface NormalizeResult {
  plan: NormalizedAIPlan | null;
  issues: PlanIssue[];
  /** True when there is at least one error (safe to reject). */
  rejected: boolean;
}

export type ConflictKind =
  | "overlap_existing"
  | "overlap_in_plan"
  | "capacity"
  | "missing_reference"
  | "past_due"
  | "impossible_time";

export interface PlanConflict {
  kind: ConflictKind;
  day?: string;
  detail: string;
  /** Titles of the involved imported items (and existing ones when relevant). */
  items: string[];
  /** False → the user may still apply after reading it; true → needs a decision. */
  blocking: boolean;
}

export interface PlanDuplicate {
  entity: "task" | "project" | "goal";
  importedTitle: string;
  existingId: string;
  existingTitle: string;
}

export interface PlanAnalysis {
  ok: boolean;
  rejected: boolean;
  issues: PlanIssue[];
  plan: NormalizedAIPlan | null;
  conflicts: PlanConflict[];
  duplicates: PlanDuplicate[];
  /** Counts per entity for the preview header. */
  newCounts: Record<keyof AIPlanBody, number>;
  duplicateCounts: { task: number; project: number; goal: number };
}

/* ------------------------------------------------------------------ */
/* Apply result (what actually landed in the workspace)                */
/* ------------------------------------------------------------------ */

export type ImportStatus =
  | "uploaded"
  | "validated"
  | "needs_review"
  | "applied"
  | "partially_applied"
  | "rejected"
  | "failed";

export interface AppliedCounts {
  goals: number;
  projects: number;
  tasks: number;
  calendar_events: number;
  time_blocks: number;
  routines: number;
  routine_items: number;
  habits: number;
  milestones: number;
}

export type AppliedSelection = Partial<keyof AIPlanBody>;

/* ------------------------------------------------------------------ */
/* Small shared helpers                                                */
/* ------------------------------------------------------------------ */

export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
/**
 * Two capture groups (hours, minutes) — `toMin` reads both of them, so the
 * minute part must be captured too. With a single group `toMin` returned NaN
 * and every schedule comparison silently failed.
 */
export const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Loose title comparison used for duplicate detection (Persian-aware). */
export function normalizeTitle(raw: string): string {
  return raw
    .trim()
    .replace(/[\s\u200c]+/g, " ")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ۀة]/g, "ه")
    .replace(/[أإ]/g, "ا")
    .toLowerCase();
}

export function toMin(hhmm: string): number {
  const m = TIME_RE.exec(hhmm.trim());
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function fromMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h < 10 ? "0" : ""}${h}:${m < 10 ? "0" : ""}${m}`;
}

export function emptyCounts(): Record<keyof AppliedCounts, number> {
  return {
    goals: 0,
    projects: 0,
    tasks: 0,
    calendar_events: 0,
    time_blocks: 0,
    routines: 0,
    routine_items: 0,
    habits: 0,
    milestones: 0,
  };
}

export function emptyBodyCounts(): Record<
  keyof AIPlanBody | "assumptions" | "explanations",
  number
> {
  return {
    goals: 0,
    projects: 0,
    tasks: 0,
    calendar_events: 0,
    time_blocks: 0,
    routines: 0,
    habits: 0,
    milestones: 0,
    assumptions: 0,
    explanations: 0,
  };
}
