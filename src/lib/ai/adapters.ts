/**
 * Future AI extension points — Phase 09.
 *
 * This phase does NOT implement any AI provider (no Gemini / OpenAI /
 * OpenRouter, no chat, no agents). It only defines the CONTRACTS a later AI
 * phase will implement, plus the deterministic defaults used today.
 *
 * Design:
 *  - The dashboard builds ONE typed snapshot of everything a future planner
 *    would need (persona, context, tasks, projects, goals, calendar,
 *    routines, workload, stats, skills, quests, achievements, unlocks).
 *  - Providers are registered here. While none is registered, every consumer
 *    transparently falls back to the deterministic engine
 *    (src/lib/next-action.ts) — so behavior never changes when AI arrives.
 *  - No provider name, SDK, endpoint or key is referenced anywhere here.
 */
import {
  pickNextAction,
  type NextActionProject,
  type NextActionTask,
  type ScoredAction,
} from "@/lib/next-action";
import type { PersonaKey } from "@/lib/personas";
import type { GoalLite } from "@/lib/goals";
import {
  classifyUrgency,
  type AttentionBand,
  type PlanningEvent,
  type PlanningSnapshot,
  type UrgencyState,
  type WorkloadAnalysis,
} from "@/lib/planning";

/* ------------------------------------------------------------------ */
/* Signal snapshot — the single input a future AI layer would consume   */
/* ------------------------------------------------------------------ */

export interface WorkspaceSignals {
  persona: PersonaKey;
  /** Local YYYY-MM-DD. */
  dayKey: string;
  /** Environment / context engine label (e.g. "محیط کار"), when present. */
  environment: string | null;
  workStyle: string | null;
  productivityStyle: string | null;
  userGoals: string[];
  tasks: NextActionTask[];
  projects: NextActionProject[];
  /** Context events (classes / exams / meetings / deadlines) for today+week. */
  upcomingEvents: Array<{ title: string; day: string; type: string; time?: string }>;
  routines: { done: number; total: number };
  /** Workload: open root tasks due today. */
  todayLoad: number;
  stats: { key: string; label: string; value: number }[];
  skills: { key: string; label: string; level: number; progress: number }[];
  quests: { key: string; title: string; progress: number; target: number }[];
  achievements: { key: string; title: string; unlockedAt: number | null }[];
  unlocks: { key: string; label: string; status: string }[];
  progression: { level: number; totalXp: number; progressPct: number };
}

/* ------------------------------------------------------------------ */
/* Provider contracts                                                  */
/* ------------------------------------------------------------------ */

export type ProviderKind =
  | "nextAction"
  | "insights"
  | "schedule"
  | "recommendations"
  | "adaptiveModules"
  /** Phase 10: whole-planning replacement (still unimplemented by design). */
  | "planning";

export interface NextActionSuggestion {
  taskId: string;
  reason: string;
  confidence: number;
}

export type Provider<T> = (signals: WorkspaceSignals) => T | Promise<T>;

const registry: Partial<Record<ProviderKind, unknown>> = {};

/** Phase AI registers its provider here. No-op while none exists. */
export function registerAIProvider<T>(kind: ProviderKind, provider: Provider<T>): void {
  registry[kind] = provider;
}

export function getAIProvider<T>(kind: ProviderKind): Provider<T> | null {
  return (registry[kind] as Provider<T> | undefined) ?? null;
}

export function hasAIProvider(kind: ProviderKind): boolean {
  return registry[kind] != null;
}

/* ------------------------------------------------------------------ */
/* Resolution — deterministic today, pluggable tomorrow                */
/* ------------------------------------------------------------------ */

export interface ResolvedNextAction {
  source: "deterministic" | "ai";
  action: ScoredAction | NextActionSuggestion | null;
}

/**
 * Resolve the next action. Synchronous by design so the dashboard can render
 * without a loading state; a future provider that returns a Promise will be
 * consumed by the UI's async path (same call site, same signals).
 */
export function resolveNextAction(signals: WorkspaceSignals): ResolvedNextAction {
  const provider = getAIProvider<NextActionSuggestion>("nextAction");
  if (provider) {
    const out = provider(signals);
    if (out && !(out instanceof Promise)) {
      return { source: "ai", action: out };
    }
  }
  const action = pickNextAction(
    signals.tasks,
    signals.projects,
    signals.persona,
    signals.dayKey,
  );
  return { source: "deterministic", action };
}

/** True when a provider is registered — used only for diagnostics/telemetry. */
export function aiLayerActive(): boolean {
  return (Object.keys(registry) as ProviderKind[]).some(hasAIProvider);
}

/* ------------------------------------------------------------------ */
/* Phase 10 — future AI planning contract                              */
/* ------------------------------------------------------------------ */

/**
 * AIPlanningContext (§25) — the CONTROLLED, structured representation a
 * future AI layer receives. It deliberately is NOT raw database access:
 * every projection is whitelisted here, so no internal document shape,
 * user id or backend detail leaks beyond what the planner legitimately
 * needs. Built deterministically from the planning engine's own outputs.
 */
export interface AIPlanningContext {
  persona: PersonaKey;
  /** User-declared context — persona settings, never inferred. */
  context: {
    environment: string | null;
    workStyle: string | null;
    productivityStyle: string | null;
    userGoals: string[];
  };
  /** Environment / schedule facts from the Context & Environment engine. */
  environment: {
    name: string | null;
    events: Array<{ title: string; day: string; type: string; time?: string }>;
  };
  goals: Array<{
    ref: string;
    title: string;
    dueDate: string | null;
    progress: number;
    status: string;
  }>;
  activeProjects: Array<{
    id: string;
    name: string;
    deadline: string | null;
    status: string;
    goalRef: string | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    dueTime: string | null;
    projectId: string | null;
    estimateMinutes: number | null;
    /** Derived planning signals (never stored fields). */
    urgency: UrgencyState;
    /** System planning attention — present when priorities were supplied. */
    attention?: AttentionBand;
  }>;
  calendar: {
    day: string;
    events: PlanningEvent[];
    occupiedMinutes: number | null;
    availableMinutes: number | null;
  };
  workload: WorkloadAnalysis;
  routines: { done: number; total: number };
  progression: WorkspaceSignals["progression"];
  /** The structured daily summary — primary input for any future AI call. */
  planningSnapshot: PlanningSnapshot;
}

/**
 * Build the future AI context from signals the app ALREADY has. Pure and
 * synchronous: when an AI provider eventually arrives, it consumes this
 * instead of querying tables.
 */
export function buildAIPlanningContext(
  signals: WorkspaceSignals,
  options: {
    snapshot: PlanningSnapshot;
    goals: GoalLite[];
    todayEvents?: PlanningEvent[];
    /** Per-task system attention from computePlanning (optional). */
    priorities?: Array<{ taskId: string; attention: AttentionBand }>;
  },
): AIPlanningContext {
  const { snapshot, goals } = options;
  const attentionByTask = new Map(
    (options.priorities ?? []).map((p) => [p.taskId, p.attention]),
  );
  return {
    persona: signals.persona,
    context: {
      environment: signals.environment,
      workStyle: signals.workStyle,
      productivityStyle: signals.productivityStyle,
      userGoals: signals.userGoals,
    },
    environment: {
      name: signals.environment,
      events: signals.upcomingEvents,
    },
    goals: goals.map((g) => ({
      ref: g.ref,
      title: g.title,
      dueDate: g.dueDate,
      progress: g.progress,
      status: g.status,
    })),
    activeProjects: signals.projects
      .filter((p) => p.status !== "completed")
      .map((p) => ({
        id: p._id,
        name: p.name,
        deadline: p.deadline ?? null,
        status: p.status,
        goalRef: p.goalRef ?? null,
      })),
    tasks: signals.tasks
      .filter((t) => t.status !== "done")
      .map((t) => ({
        id: t._id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate ?? null,
        dueTime: t.dueTime ?? null,
        projectId: t.projectId ?? null,
        estimateMinutes: t.estimateMinutes ?? null,
        urgency: classifyUrgency(t.dueDate, signals.dayKey),
        attention: attentionByTask.get(t._id),
      })),
    calendar: {
      day: signals.dayKey,
      events: options.todayEvents ?? [],
      occupiedMinutes: snapshot.occupiedTime,
      availableMinutes: snapshot.availableTime,
    },
    workload: snapshot.workload,
    routines: signals.routines,
    progression: signals.progression,
    planningSnapshot: snapshot,
  };
}

/* ------------------------------------------------------------------ */
/* Phase 10 — AI action safety boundaries (contract only — no executor) */
/* ------------------------------------------------------------------ */

/**
 * The ONLY operations a future AI layer may ever request (§26). There is no
 * "run arbitrary mutation" or raw table access — an allow-list exists so the
 * eventual executor can validate every request against it.
 */
export type AIActionKind =
  | "create_task"
  | "update_task"
  | "complete_task"
  | "reschedule_task"
  | "create_time_block"
  | "create_calendar_event"
  | "update_priority"
  | "create_project"
  | "create_goal";

export const AI_ACTION_KINDS: readonly AIActionKind[] = [
  "create_task",
  "update_task",
  "complete_task",
  "reschedule_task",
  "create_time_block",
  "create_calendar_event",
  "update_priority",
  "create_project",
  "create_goal",
];

export interface AIActionRequest {
  kind: AIActionKind;
  /** Persian summary shown to the user in the confirmation dialog. */
  summary: string;
  /** Whitelisted fields for the target operation — no arbitrary payloads. */
  payload: Record<string, unknown>;
}

/**
 * Safety policy for future AI actions. Nothing executes in this phase; the
 * policy exists so the executor is written with the boundaries already
 * fixed: confirm-first, allow-list only, never destructive-by-surprise.
 */
export const AI_ACTION_POLICY = {
  /** Every action requires explicit user confirmation before it applies. */
  requiresConfirmation: true as const,
  /** Nothing outside the allow-list may ever be executed. */
  allowedKinds: AI_ACTION_KINDS,
  /** Explicitly forbidden, even in a future phase. */
  forbidden: [
    "direct_database_access",
    "bulk_delete",
    "silent_reschedule",
    "silent_priority_change",
    "goal_or_project_deletion",
    "calendar_commitment_change_without_confirmation",
  ] as const,
  /** Consequential mutations always flow through the existing services. */
  executorNote:
    "Future AI actions must call the existing controlled mutations after user confirmation — never a generic db.run.",
} as const;

export function isAIActionAllowed(kind: string): kind is AIActionKind {
  return (AI_ACTION_KINDS as readonly string[]).includes(kind);
}
