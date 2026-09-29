/**
 * Phase 15 — AI Intelligence Layer: shared contracts.
 *
 * This module is PURE and provider-agnostic. It defines what the AI is
 * allowed to say and do, never how a provider is reached.
 *
 * Two invariants everything else depends on:
 *  1. The AI never holds a database handle. It only ever emits an `AIAction`
 *     — a declarative proposal in a closed vocabulary (`AIActionType`).
 *  2. Nothing here is executable. There is no eval, no arbitrary command, no
 *     "run this instruction". The union below IS the allowlist (§34).
 *
 * Uses relative imports only: Convex bundles these files and does not resolve
 * the `@/` tsconfig alias (Phase 10.5 lesson).
 */

/* ------------------------------------------------------------------ */
/* Versioning                                                          */
/* ------------------------------------------------------------------ */

/** Bumped whenever the response/action contract changes incompatibly. */
export const AI_RESPONSE_SCHEMA_VERSION = "1.0";

export const SUPPORTED_AI_RESPONSE_VERSIONS = ["1.0"] as const;

/* ------------------------------------------------------------------ */
/* Safety levels (§11)                                                 */
/* ------------------------------------------------------------------ */

/**
 * 1 — informational: the AI only explains. No confirmation needed because
 *     nothing can change.
 * 2 — non-destructive creation: adds new rows. Confirmed once, up front.
 * 3 — existing-data modification: moves/edits rows the user already owns.
 *     Always individually listed before applying.
 * 4 — destructive/irreversible. Refused outright in this phase (§11, §35).
 */
export type AISafetyLevel = 1 | 2 | 3 | 4;

/* ------------------------------------------------------------------ */
/* Actions (§9, §10)                                                   */
/* ------------------------------------------------------------------ */

/**
 * The closed vocabulary of things the AI may propose.
 *
 * Every member maps 1:1 onto an EXISTING application service — see
 * `ACTION_SERVICE_MAP` in ./actions.ts. Types are deliberately excluded: there
 * is no `delete_*`, no `bulk_*`, no arbitrary entity write (§10, §11).
 */
export type AIActionType =
  /* tasks */
  | "create_task"
  | "update_task"
  | "complete_task"
  | "reschedule_task"
  | "change_priority"
  /* projects */
  | "create_project"
  | "update_project"
  /* goals */
  | "create_goal"
  | "update_goal"
  /* schedule — events are time blocks with a `kind`; there is no second
     calendar model, so there is no separate *_calendar_event action */
  | "create_time_block"
  | "move_time_block"
  /* routines & notes */
  | "create_routine"
  | "create_note";

export interface AIActionBase {
  /** Human-readable justification, shown verbatim in the confirmation UI. */
  reason: string;
  /** Marks a proposal the user has explicitly ticked on/off. */
  selected?: boolean;
}

/** Fields shared by anything that targets an existing row. */
export interface AIActionTargeted extends AIActionBase {
  /** Raw id from the model. NEVER trusted — re-validated for ownership. */
  target_id: string;
}

export interface AIActionCreateTask extends AIActionBase {
  type: "create_task";
  title: string;
  description?: string;
  priority?: TaskPriority;
  due_date?: string; // YYYY-MM-DD
  project_id?: string;
  estimate_minutes?: number;
}

export interface AIActionUpdateTask extends AIActionTargeted {
  type: "update_task";
  title?: string;
  description?: string;
}

export interface AIActionCompleteTask extends AIActionTargeted {
  type: "complete_task";
}

export interface AIActionRescheduleTask extends AIActionTargeted {
  type: "reschedule_task";
  target_date: string; // YYYY-MM-DD
}

export interface AIActionChangePriority extends AIActionTargeted {
  type: "change_priority";
  priority: TaskPriority;
}

export interface AIActionCreateProject extends AIActionBase {
  type: "create_project";
  name: string;
  description?: string;
  deadline?: string; // YYYY-MM-DD
}

export interface AIActionUpdateProject extends AIActionTargeted {
  type: "update_project";
  name?: string;
  description?: string;
  deadline?: string;
}

export interface AIActionCreateGoal extends AIActionBase {
  type: "create_goal";
  title: string;
  description?: string;
  due_date?: string;
}

export interface AIActionUpdateGoal extends AIActionTargeted {
  type: "update_goal";
  progress?: number; // 0..100
  status?: "active" | "paused" | "completed";
}

export interface AIActionCreateTimeBlock extends AIActionBase {
  type: "create_time_block";
  title: string;
  day: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  kind?: TimeBlockKind;
  task_id?: string;
  project_id?: string;
}

export interface AIActionMoveTimeBlock extends AIActionTargeted {
  type: "move_time_block";
  day: string;
  start_time: string;
  end_time: string;
}

export interface AIActionCreateRoutine extends AIActionBase {
  type: "create_routine";
  title: string;
  color_key?: string;
}

export interface AIActionCreateNote extends AIActionBase {
  type: "create_note";
  title: string;
  body: string;
  tags?: string[];
}

export type AIAction =
  | AIActionCreateTask
  | AIActionUpdateTask
  | AIActionCompleteTask
  | AIActionRescheduleTask
  | AIActionChangePriority
  | AIActionCreateProject
  | AIActionUpdateProject
  | AIActionCreateGoal
  | AIActionUpdateGoal
  | AIActionCreateTimeBlock
  | AIActionMoveTimeBlock
  | AIActionCreateRoutine
  | AIActionCreateNote;

/* ------------------------------------------------------------------ */
/* Constrained vocabularies (mirrors the existing task schema)         */
/* ------------------------------------------------------------------ */

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TIME_BLOCK_KINDS = [
  "focus",
  "task",
  "meeting",
  "study",
  "routine",
  "personal",
  "review",
  "planning",
  "admin",
  "other",
] as const;
export type TimeBlockKind = (typeof TIME_BLOCK_KINDS)[number];

export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/* ------------------------------------------------------------------ */
/* Response envelope (§9)                                              */
/* ------------------------------------------------------------------ */

/**
 * `analysis`  — explanation only, no workspace change (safety level 1).
 * `action_plan` — carries proposals the user may review and apply.
 * `refusal`  — the AI declined or lacked the data; nothing is offered.
 * `clarify`  — the request is ambiguous; the AI asks a question instead of
 *               guessing (§10 "ask follow-up questions").
 */
export type AIResponseType =
  | "analysis"
  | "action_plan"
  | "refusal"
  | "clarify";

export interface AIResponseSection {
  /** Stable key so the UI can label the block consistently. */
  key: string;
  title: string;
  body: string;
}

export interface AIResponse {
  schema_version: string;
  response_type: AIResponseType;
  /** One-sentence headline, always plain text, always Persian. */
  summary: string;
  /** Optional structured blocks: priority summary, risks, deadlines… */
  sections: AIResponseSection[];
  actions: AIAction[];
  /** Question for the user when `response_type === "clarify"`. */
  question?: string;
  /**
   * What the platform computed and sent. Echoed back so the user can see
   * exactly what the AI was told (§26, §27). Never contains secrets.
   */
  context_sources: string[];
  /** Honest, derived-from-context caveats (not free-form speculation). */
  notes: string[];
}

/* ------------------------------------------------------------------ */
/* Proposals (the validated, UI-facing form)                           */
/* ------------------------------------------------------------------ */

export interface ValidatedAction {
  action: AIAction;
  safety: AISafetyLevel;
  /** Persian one-liner shown in the confirmation list. */
  label: string;
  /** Extra detail line (target title, before → after). */
  detail?: string;
  /** Set when the action was dropped or degraded during validation. */
  issues: string[];
  /** False when the action references an id the user does not own. */
  applicable: boolean;
}

export interface ActionPlan {
  actions: ValidatedAction[];
  /** Highest safety level present; drives which confirmation UI is shown. */
  maxSafety: AISafetyLevel;
  droppedCount: number;
}

/* ------------------------------------------------------------------ */
/* Failure handling (§24, §25, §33)                                    */
/* ------------------------------------------------------------------ */

export type AIFailureKind =
  | "not_configured"
  | "unauthorized"
  | "timeout"
  | "provider_error"
  | "invalid_response"
  | "empty_response"
  | "rate_limited"
  | "unknown";

export interface AIResult<T> {
  ok: boolean;
  data?: T;
  failure?: AIFailureKind;
  /** Persian, user-safe. Never leaks provider internals or keys. */
  message?: string;
  /** True when retrying the identical request could plausibly succeed. */
  retryable?: boolean;
}

/* ------------------------------------------------------------------ */
/* Usage accounting (§23)                                              */
/* ------------------------------------------------------------------ */

export interface AIUsageRecord {
  userId: string;
  provider: string;
  model: string;
  feature: string;
  latencyMs: number;
  ok: boolean;
  promptTokens?: number;
  completionTokens?: number;
  /** Provider-reported cost when available; otherwise undefined. */
  estimatedCostUsd?: number;
  errorKind?: AIFailureKind;
  createdAt: number;
}

export const AI_DEFAULT_TIMEOUT_MS = 25_000;
export const AI_MAX_ACTIONS = 20;
export const AI_MAX_CONTEXT_CHARS = 24_000;
export const AI_MAX_HISTORY_TURNS = 6;
