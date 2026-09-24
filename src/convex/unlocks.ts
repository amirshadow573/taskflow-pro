/**
 * Unlocks / Capabilities — Phase 08 service.
 *
 * ONE centralized engine that decides which ADVANCED optional capabilities a
 * user may access. It never creates parallel counters: every requirement is
 * evaluated against the existing progression systems (progress / personaStats
 * / userSkills / achievementUnlocks / userQuests / userEvolution) and the
 * config catalog in unlockRules.ts.
 *
 *   XP → Stats → Skills → Quests → Achievements → Evolution
 *         ↓
 *   Unlock conditions → automatic, idempotent grants → capability checks
 *
 * Key properties:
 *  - Core productivity is NEVER gated — only cataloged advanced capabilities.
 *  - Grants are idempotent (by_user_key) and persistent: a legitimately
 *    granted capability is never revoked by later progression regressions.
 *  - Auto-unlock: no manual activation step — when every requirement is met
 *    the grant is persisted on the next sync, with an auditable unlockEvent.
 *  - Centralized access control: UI must call `capability` / `capabilities`
 *    instead of scattering `level > N` checks through components.
 *  - Failure-tolerant: like stats/skills sync, it never blocks the engine.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  UNLOCK_CATEGORIES,
  requirementText,
  unlockEligible,
  unlocksForPersona,
  resolveUnlock,
  type UnlockDef,
  type UnlockRequirement,
  type UnlockTone,
} from "./unlockRules";

type Ctx = QueryCtx | MutationCtx;

/* ------------------------------------------------------------------ */
/* Evaluation context (reads existing systems only)                    */
/* ------------------------------------------------------------------ */

async function personaOf(ctx: Ctx, userId: Id<"users">): Promise<string> {
  const profile = await ctx.db
    .query("userProfile")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return profile?.personaKey ?? "personal";
}

interface EvalContext {
  persona: string;
  level: number;
  totalXp: number;
  stats: Map<string, { value: number; hasData: boolean }>;
  /** skillKey → level, from the persona's cached skill rows. */
  skills: Map<string, number>;
  achievements: Set<string>;
  /** questKey → completed instance count. */
  quests: Map<string, number>;
  evolutionIndex: number;
  /** Keys already persisted as unlocked (grants never revoked). */
  granted: Set<string>;
}

async function buildEvalContext(
  ctx: Ctx,
  userId: Id<"users">,
  persona: string,
): Promise<EvalContext> {
  const [prog, statRows, skillRows, achRows, questRows, evoRows, unlockRows] =
    await Promise.all([
      ctx.db.query("progress").withIndex("by_user", (q) => q.eq("userId", userId)).first(),
      ctx.db.query("personaStats").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("userSkills").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db
        .query("achievementUnlocks")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("userQuests")
        .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "completed"))
        .collect(),
      ctx.db.query("userEvolution").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("userUnlocks").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ]);

  const stats = new Map<string, { value: number; hasData: boolean }>();
  for (const r of statRows) stats.set(r.statKey, { value: r.value, hasData: r.hasData });

  const skills = new Map<string, number>();
  for (const r of skillRows) if (r.persona === persona) skills.set(r.skillKey, r.level);

  const quests = new Map<string, number>();
  for (const r of questRows) quests.set(r.questKey, (quests.get(r.questKey) ?? 0) + 1);

  const evo = evoRows.find((r) => r.persona === persona);

  return {
    persona,
    level: prog?.level ?? 1,
    totalXp: prog?.totalXp ?? 0,
    stats,
    skills,
    achievements: new Set(achRows.map((a) => a.key)),
    quests,
    evolutionIndex: evo?.stageIndex ?? 0,
    granted: new Set(unlockRows.map((u) => u.unlockKey)),
  };
}

/* ------------------------------------------------------------------ */
/* Requirement evaluation                                              */
/* ------------------------------------------------------------------ */

function evalRequirement(
  req: UnlockRequirement,
  e: EvalContext,
  grantedSoFar: Set<string>,
): { met: boolean; current: number | null; target: number } {
  switch (req.type) {
    case "level":
      return { met: e.level >= req.min, current: e.level, target: req.min };
    case "xp":
      return { met: e.totalXp >= req.min, current: e.totalXp, target: req.min };
    case "stat": {
      const s = e.stats.get(req.statKey);
      return {
        met: !!s?.hasData && s.value >= req.min,
        current: s?.hasData ? Math.round(s.value) : null,
        target: req.min,
      };
    }
    case "skill": {
      const lvl = e.skills.get(req.skillKey) ?? 0;
      return { met: lvl >= req.minLevel, current: lvl, target: req.minLevel };
    }
    case "achievement": {
      const has = e.achievements.has(req.key);
      return { met: has, current: has ? 1 : 0, target: 1 };
    }
    case "quest": {
      const count = e.quests.get(req.key) ?? 0;
      const target = req.minCount ?? 1;
      return { met: count >= target, current: count, target };
    }
    case "evolution":
      return {
        met: e.evolutionIndex >= req.minStageIndex,
        current: e.evolutionIndex,
        target: req.minStageIndex,
      };
    case "dependency": {
      // Evaluated in catalog order: dependencies always sort first, and the
      // caller threads the just-met keys through `grantedSoFar`.
      const met = e.granted.has(req.unlockKey) || grantedSoFar.has(req.unlockKey);
      return { met, current: met ? 1 : 0, target: 1 };
    }
  }
}

export interface RequirementRow {
  type: string;
  /** Persian explanation shown to the user (never technical). */
  text: string;
  met: boolean;
  current: number | null;
  target: number;
  /** "all" = AND group, "any" = OR group. */
  group: "all" | "any";
}

interface EvaluatedUnlock {
  def: UnlockDef;
  rows: RequirementRow[];
  /** All AND requirements met AND (no anyOf OR anyOf met). */
  allMet: boolean;
  /** Persisted grant OR live allMet — what capability checks must use. */
  granted: boolean;
}

/**
 * Evaluate the persona's catalog in order. Dependencies resolve because defs
 * are sorted (order) and each newly-met key is threaded through the pass.
 */
function evaluateCatalog(defs: UnlockDef[], e: EvalContext): EvaluatedUnlock[] {
  const grantedSoFar = new Set<string>();
  const out: EvaluatedUnlock[] = [];

  for (const def of defs) {
    const rows: RequirementRow[] = def.requirements.map((req) => {
      const r = evalRequirement(req, e, grantedSoFar);
      return {
        type: req.type,
        text: requirementText(req, e.persona),
        met: r.met,
        current: r.current,
        target: r.target,
        group: "all" as const,
      };
    });
    const anyRows: RequirementRow[] = (def.anyOf ?? []).map((req) => {
      const r = evalRequirement(req, e, grantedSoFar);
      return {
        type: req.type,
        text: requirementText(req, e.persona),
        met: r.met,
        current: r.current,
        target: r.target,
        group: "any" as const,
      };
    });
    const allRows = [...rows, ...anyRows];
    const andMet = rows.every((r) => r.met);
    const anyMet = anyRows.length === 0 || anyRows.some((r) => r.met);
    const allMet = andMet && anyMet;
    const granted = e.granted.has(def.key) || allMet;
    if (granted) grantedSoFar.add(def.key);
    out.push({ def, rows: allRows, allMet, granted });
  }
  return out;
}

/** Progress figures shared by the UI (the anyOf group counts as one item). */
function progressOf(item: EvaluatedUnlock): { metCount: number; total: number; pct: number } {
  const andRows = item.rows.filter((r) => r.group === "all");
  const anyRows = item.rows.filter((r) => r.group === "any");
  const total = andRows.length + (anyRows.length > 0 ? 1 : 0);
  let metCount = andRows.filter((r) => r.met).length;
  if (anyRows.length > 0 && anyRows.some((r) => r.met)) metCount += 1;
  return { metCount, total, pct: total > 0 ? Math.round((metCount / total) * 100) : 0 };
}

/* ------------------------------------------------------------------ */
/* Auto-unlock engine (idempotent, never throws)                       */
/* ------------------------------------------------------------------ */

/**
 * Evaluate every eligible unlock and persist grants whose requirements are
 * fully satisfied. Safe to call after every engine run: already-granted keys
 * are skipped, inserts are guarded by `by_user_key`, and failures are logged
 * instead of breaking the productivity engine.
 */
export async function syncUnlocks(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<string[]> {
  try {
    const persona = await personaOf(ctx, userId);
    const defs = unlocksForPersona(persona);
    if (defs.length === 0) return [];

    const e = await buildEvalContext(ctx, userId, persona);
    const evaluated = evaluateCatalog(defs, e);
    const newly: string[] = [];
    const now = Date.now();

    for (const item of evaluated) {
      if (!item.allMet || e.granted.has(item.def.key)) continue;

      // Guarded re-check — the same capability can never be granted twice.
      const existing = await ctx.db
        .query("userUnlocks")
        .withIndex("by_user_key", (q) =>
          q.eq("userId", userId).eq("unlockKey", item.def.key),
        )
        .first();
      if (existing) continue;

      const { metCount, total } = progressOf(item);
      const snapshot = JSON.stringify({
        metCount,
        total,
        requirements: item.rows.map((r) => ({ text: r.text, met: r.met })),
      });
      await ctx.db.insert("userUnlocks", {
        userId,
        persona,
        unlockKey: item.def.key,
        status: "unlocked",
        unlockedAt: now,
        trigger: "requirements_met",
        requirementsSnapshot: snapshot,
      });
      await ctx.db.insert("unlockEvents", {
        userId,
        unlockKey: item.def.key,
        type: "granted",
        label: item.def.label,
        trigger: "requirements_met",
        snapshot: snapshot,
        createdAt: now,
      });
      newly.push(item.def.key);
    }
    return newly;
  } catch (err) {
    console.error("[unlocks] sync failed", err);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Serialization                                                       */
/* ------------------------------------------------------------------ */

/** Wire shape of one unlock as consumed by the Unlock Center UI. */
export interface SerializedUnlock {
  key: string;
  label: string;
  description: string;
  icon: string;
  tone: UnlockTone;
  category: string;
  categoryLabel: string;
  featureKey: string;
  status: "locked" | "available" | "unlocked";
  unlockedAt: number | null;
  requirements: RequirementRow[];
  metCount: number;
  total: number;
  progressPct: number;
}

function serializeUnlock(
  item: EvaluatedUnlock,
  unlockedAt: number | null,
): SerializedUnlock {
  const { metCount, total, pct } = progressOf(item);
  const status: SerializedUnlock["status"] =
    unlockedAt !== null ? "unlocked" : item.allMet ? "available" : "locked";
  return {
    key: item.def.key,
    label: item.def.label,
    description: item.def.description,
    icon: item.def.icon,
    tone: item.def.tone,
    category: item.def.category,
    categoryLabel: UNLOCK_CATEGORIES[item.def.category]?.label ?? item.def.category,
    featureKey: item.def.featureKey,
    status,
    unlockedAt,
    requirements: item.rows,
    metCount,
    total,
    progressPct: status === "unlocked" ? 100 : pct,
  };
}

/** Evaluate the persona's catalog with persisted grant timestamps attached. */
async function evaluateFor(
  ctx: Ctx,
  userId: Id<"users">,
): Promise<{ persona: string; evaluated: EvaluatedUnlock[]; unlockedAt: Map<string, number> } | null> {
  const persona = await personaOf(ctx, userId);
  const defs = unlocksForPersona(persona);
  const e = await buildEvalContext(ctx, userId, persona);
  const evaluated = evaluateCatalog(defs, e);
  const rows = await ctx.db
    .query("userUnlocks")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const unlockedAt = new Map(rows.map((r) => [r.unlockKey, r.unlockedAt]));
  return { persona, evaluated, unlockedAt };
}

/* ------------------------------------------------------------------ */
/* Public queries                                                      */
/* ------------------------------------------------------------------ */

/**
 * Everything the Unlock Center needs in one round trip: persona-aware
 * unlocks with requirements, statuses and progress, plus a summary.
 */
export const center = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const state = await evaluateFor(ctx, userId);
    if (!state) return null;
    const items = state.evaluated.map((item) =>
      serializeUnlock(item, state.unlockedAt.get(item.def.key) ?? null),
    );
    const unlockedCount = items.filter((i) => i.status === "unlocked").length;
    const next =
      state.evaluated.find((i) => !state.unlockedAt.has(i.def.key)) ?? null;
    return {
      unlocks: items,
      summary: {
        unlockedCount,
        totalCount: items.length,
        next: next
          ? {
              key: next.def.key,
              label: next.def.label,
              description: next.def.description,
              missing: next.rows.filter((r) => !r.met).slice(0, 2).map((r) => r.text),
            }
          : null,
      },
    };
  },
});

/**
 * Centralized capability check — the ONLY way components/UI may decide
 * whether an advanced feature is accessible. Unknown featureKeys are treated
 * as unlocked so a future module can never be locked by accident.
 */
export const capability = query({
  args: { featureKey: v.string() },
  handler: async (ctx, { featureKey }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { found: false, unlocked: true, label: "", description: "", missing: [] as string[] };
    const state = await evaluateFor(ctx, userId);
    if (!state) return { found: false, unlocked: true, label: "", description: "", missing: [] as string[] };
    const item = state.evaluated.find((i) => i.def.featureKey === featureKey);
    if (!item) return { found: false, unlocked: true, label: "", description: "", missing: [] as string[] };
    return {
      found: true,
      unlocked: item.granted,
      label: item.def.label,
      description: item.def.description,
      missing: item.rows.filter((r) => !r.met).map((r) => r.text),
    };
  },
});

/** Compact map for navigation (e.g. show a subtle lock on «تحلیل»). */
export const capabilities = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const state = await evaluateFor(ctx, userId);
    if (!state) return null;
    const map: Record<string, boolean> = {};
    for (const item of state.evaluated) map[item.def.featureKey] = item.granted;
    return map;
  },
});

const NEW_HINT_WINDOW_MS = 72 * 60 * 60 * 1000; // 72h for the "new" card

/**
 * Compact dashboard progression hint — either the capability just granted or
 * the next one within reach. Null when nothing is worth showing.
 */
export const hint = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const state = await evaluateFor(ctx, userId);
    if (!state) return null;

    const events = await ctx.db
      .query("unlockEvents")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(5);

    const now = Date.now();
    const fresh = events.find((ev) => now - ev.createdAt < NEW_HINT_WINDOW_MS);
    if (fresh) {
      const def = state.evaluated.find((i) => i.def.key === fresh.unlockKey);
      if (def) {
        return {
          kind: "new" as const,
          key: def.def.key,
          label: def.def.label,
          description: def.def.description,
          icon: def.def.icon,
          tone: def.def.tone,
        };
      }
    }

    const next = state.evaluated.find((i) => !i.granted);
    if (!next) return null;
    return {
      kind: "next" as const,
      key: next.def.key,
      label: next.def.label,
      description: next.def.description,
      icon: next.def.icon,
      tone: next.def.tone,
      missing: next.rows.filter((r) => !r.met).slice(0, 2).map((r) => r.text),
    };
  },
});

/** Recent unlock grants — feeds the restrained "new capability" feedback. */
export const recent = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("unlockEvents")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(8);
    return rows.map((r) => ({
      id: r._id,
      unlockKey: r.unlockKey,
      label: r.label,
      type: r.type,
      createdAt: r.createdAt,
    }));
  },
});

/**
 * Self-healing sync — the Unlock Center calls this on mount so grants are
 * persisted even when no engine activity has run yet this session.
 */
export const sync = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await syncUnlocks(ctx, userId);
  },
});
