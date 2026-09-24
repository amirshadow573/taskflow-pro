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
  | "adaptiveModules";

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
