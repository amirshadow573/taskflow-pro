/**
 * Skills & Evolution — Phase 05 service.
 *
 * ONE centralized engine that derives skill progress from the Phase 04
 * persona stats (which are themselves derived from audited activity) and
 * resolves the user's evolution stage. No second event system: this module
 * only reads `personaStats` / `progress` rows and persists derived state.
 *
 *   real activity → XP (Phase 03) → persona stats (Phase 04)
 *                                          ↓
 *                                skills → evolution stages
 *
 * Key properties:
 *  - Derivation, not accumulation: progress is recomputed from cached stat
 *    rows on every sync, so reversed/invalidated activity self-heals and
 *    farming is impossible by construction.
 *  - Auditable: level-ups and stage changes are logged into `skillEvents`;
 *    regressions (activity reversed) silently correct the derived state.
 *  - Idempotent and never throws — must not block the productivity engine.
 *  - Deterministic recommendations, computed from real data (no AI).
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  SKILL_MAXED,
  SKILL_MAX_LEVEL,
  SKILLS_EMPTY_STATE,
  SKILLS_NO_DATA,
  computeSkillProgress,
  evolutionForPersona,
  evolutionStageIndex,
  nextSkillThreshold,
  skillLevelFor,
  skillsForPersona,
  stageMet,
  stageRequirementsText,
  type SkillDef,
} from "./skillRules";
import { STAT_CATALOG } from "./statRules";

type Ctx = QueryCtx | MutationCtx;

/** Resolve the user's active persona (mirrors personaStats.personaOf). */
async function personaOf(ctx: Ctx, userId: Id<"users">): Promise<string> {
  const profile = await ctx.db
    .query("userProfile")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return profile?.personaKey ?? "personal";
}

const statLabel = (statKey: string): string => STAT_CATALOG[statKey]?.label ?? statKey;
const skillLabelOf = (skills: SkillDef[], skillKey: string): string =>
  skills.find((s) => s.key === skillKey)?.label ?? skillKey;

/* ------------------------------------------------------------------ */
/* Engine hook — called after every stats sync (i.e. after activity)   */
/* ------------------------------------------------------------------ */

/**
 * Recompute the persona's skills + evolution stage from the cached persona
 * stat rows and persist derived state. Idempotent; never throws.
 */
export async function syncUserSkills(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  try {
    const personaKey = await personaOf(ctx, userId);
    const skills = skillsForPersona(personaKey);
    const stages = evolutionForPersona(personaKey);
    const now = Date.now();

    const statRows = await ctx.db
      .query("personaStats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const statValue = (statKey: string): number | null => {
      const row = statRows.find((r) => r.statKey === statKey);
      return row?.hasData ? row.value : null;
    };

    const prog = await ctx.db
      .query("progress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const level = prog?.level ?? 1;

    /* ---- per-skill progress ---- */
    const skillLevels: Record<string, number> = {};
    for (const def of skills) {
      const { hasData, progress } = computeSkillProgress(def, statValue);
      const lvl = skillLevelFor(hasData, progress);
      skillLevels[def.key] = lvl;

      const existing = await ctx.db
        .query("userSkills")
        .withIndex("by_user_skill", (q) => q.eq("userId", userId).eq("skillKey", def.key))
        .first();

      if (existing) {
        if (lvl > existing.level && lvl > 0) {
          await ctx.db.insert("skillEvents", {
            userId,
            persona: personaKey,
            skillKey: def.key,
            type: "levelUp",
            from: existing.level,
            to: lvl,
            label: `مهارت «${def.label}» به سطح ${lvl} رسید`,
            createdAt: now,
          });
        }
        await ctx.db.patch(existing._id, {
          persona: personaKey,
          hasData,
          progress,
          level: lvl,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("userSkills", {
          userId,
          persona: personaKey,
          skillKey: def.key,
          hasData,
          progress,
          level: lvl,
          updatedAt: now,
        });
        if (lvl > 0) {
          await ctx.db.insert("skillEvents", {
            userId,
            persona: personaKey,
            skillKey: def.key,
            type: "levelUp",
            from: 0,
            to: lvl,
            label: `مهارت «${def.label}» شکل گرفت`,
            createdAt: now,
          });
        }
      }
    }

    /* ---- evolution stage ---- */
    const stageIndex = evolutionStageIndex(stages, { level, skillLevels, statValue });
    const stage = stages[stageIndex] ?? stages[0];
    const evoExisting = await ctx.db
      .query("userEvolution")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (evoExisting) {
      if (stageIndex > evoExisting.stageIndex) {
        await ctx.db.insert("skillEvents", {
          userId,
          persona: personaKey,
          skillKey: "evolution",
          type: "evolution",
          from: evoExisting.stageIndex,
          to: stageIndex,
          label: `مرحله‌ی تازه: «${stage.label}»`,
          createdAt: now,
        });
      }
      if (stageIndex !== evoExisting.stageIndex || evoExisting.stageKey !== stage.key) {
        await ctx.db.patch(evoExisting._id, {
          persona: personaKey,
          stageIndex,
          stageKey: stage.key,
          updatedAt: now,
        });
      }
    } else {
      await ctx.db.insert("userEvolution", {
        userId,
        persona: personaKey,
        stageIndex,
        stageKey: stage.key,
        updatedAt: now,
      });
    }
  } catch (err) {
    console.error("[skills] sync failed", err);
  }
}

/* ------------------------------------------------------------------ */
/* Recommendations — deterministic, data-driven (no AI)                */
/* ------------------------------------------------------------------ */

interface RecommendationInput {
  skills: Array<{
    def: SkillDef;
    hasData: boolean;
    progress: number;
    nextThreshold: number | null;
  }>;
  stageIndex: number;
  stageMetFlags: boolean[];
  stageGap: (stageIndex: number) => string | null;
}

function buildRecommendations(input: RecommendationInput): string[] {
  const out: string[] = [];
  const { skills } = input;

  /* 1 — closest evolution requirement. */
  for (let i = input.stageIndex + 1; i < input.stageMetFlags.length && out.length < 2; i++) {
    if (input.stageMetFlags[i]) continue;
    const gap = input.stageGap(i);
    if (gap) out.push(gap);
    break; // only the next unmet stage
  }

  /* 2 — skill close to its next level. */
  const near = skills
    .filter((s) => s.hasData && s.nextThreshold !== null && s.nextThreshold - s.progress <= 12)
    .sort((a, b) => a.nextThreshold! - a.progress - (b.nextThreshold! - b.progress))[0];
  if (near && out.length < 3) {
    out.push(
      `مهارت «${near.def.label}» فقط ${near.nextThreshold! - near.progress} واحد تا سطح بعد فاصله دارد — ادامه بده.`,
    );
  }

  /* 3 — weakest skill versus the rest. */
  const withData = skills.filter((s) => s.hasData);
  if (withData.length >= 2 && out.length < 3) {
    const weakest = withData.reduce((min, s) => (s.progress < min.progress ? s : min));
    const strongest = withData.reduce((max, s) => (s.progress > max.progress ? s : max));
    if (strongest.progress - weakest.progress >= 25) {
      out.push(`«${weakest.def.label}» عقب‌تر از بقیه است؛ ${weakest.def.tips[0]}.`);
    }
  }

  return out.slice(0, 3);
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

/** Full Skills/Evolution view for the Progress Center. */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const personaKey = await personaOf(ctx, userId);
    const skills = skillsForPersona(personaKey);
    const stages = evolutionForPersona(personaKey);

    const statRows = await ctx.db
      .query("personaStats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const statValue = (statKey: string): number | null => {
      const row = statRows.find((r) => r.statKey === statKey);
      return row?.hasData ? row.value : null;
    };

    const skillRows = await ctx.db
      .query("userSkills")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const prog = await ctx.db
      .query("progress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const level = prog?.level ?? 1;

    const evoRow = await ctx.db
      .query("userEvolution")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const events = await ctx.db
      .query("skillEvents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(60);

    /* ---- skill views ---- */
    const skillViews = skills.map((def) => {
      const row = skillRows.find((r) => r.skillKey === def.key);
      const computed = computeSkillProgress(def, statValue);
      const hasData = row?.hasData ?? computed.hasData;
      const progress = row?.progress ?? computed.progress;
      const lvl = row?.level ?? skillLevelFor(hasData, progress);
      const nextThreshold = nextSkillThreshold(progress);
      return {
        def,
        hasData,
        progress,
        level: lvl,
        nextThreshold,
        relatedStats: def.stats.map(({ statKey, weight }) => ({
          statKey,
          label: statLabel(statKey),
          value: statValue(statKey),
          weight,
        })),
        recentEvents: events
          .filter((e) => e.skillKey === def.key && e.type === "levelUp")
          .slice(0, 2)
          .map((e) => ({ label: e.label ?? null, createdAt: e.createdAt })),
      };
    });

    const skillLevels: Record<string, number> = {};
    for (const s of skillViews) skillLevels[s.def.key] = s.level;

    /* ---- evolution ---- */
    const stageMetFlags = stages.map((st) =>
      stageMet(st, { level, skillLevels, statValue }),
    );
    let stageIndex = 0;
    for (let i = stages.length - 1; i > 0; i--) {
      if (stageMetFlags[i]) {
        stageIndex = i;
        break;
      }
    }
    const currentStage = stages[stageIndex] ?? stages[0];
    const nextStage = stageIndex + 1 < stages.length ? stages[stageIndex + 1] : null;

    const stageGap = (idx: number): string | null => {
      const st = stages[idx];
      if (!st) return null;
      if (level < st.requiredLevel) {
        return `برای رسیدن به مرحله‌ی «${st.label}» به سطح ${st.requiredLevel} نیاز داری (الان سطح ${level}).`;
      }
      const skillReq = st.requiredSkills.find((r) => (skillLevels[r.skillKey] ?? 0) < r.minLevel);
      if (skillReq) {
        const need = skillReq.minLevel - (skillLevels[skillReq.skillKey] ?? 0);
        return `برای رسیدن به مرحله‌ی «${st.label}»، مهارت «${skillLabelOf(skills, skillReq.skillKey)}» را ${need} سطح تقویت کن.`;
      }
      const statReq = st.requiredStats.find((r) => {
        const v = statValue(r.statKey);
        return v === null || v < r.min;
      });
      if (statReq) {
        return `برای رسیدن به مرحله‌ی «${st.label}»، آمار «${statLabel(statReq.statKey)}» را تقویت کن (دست‌کم ${statReq.min}).`;
      }
      return null;
    };

    const recommendations = buildRecommendations({
      skills: skillViews,
      stageIndex,
      stageMetFlags,
      stageGap,
    });

    const lastEvolution = events.find((e) => e.type === "evolution") ?? null;
    const anyData = skillViews.some((s) => s.hasData);

    return {
      persona: personaKey,
      level,
      anyData,
      emptyState: SKILLS_EMPTY_STATE,
      noData: SKILLS_NO_DATA,
      maxed: SKILL_MAXED,
      maxLevel: SKILL_MAX_LEVEL,
      skills: skillViews.map((s) => ({
        key: s.def.key,
        label: s.def.label,
        description: s.def.description,
        icon: s.def.icon,
        tone: s.def.tone,
        tips: s.def.tips,
        hasData: s.hasData,
        progress: s.progress,
        level: s.level,
        nextThreshold: s.nextThreshold,
        relatedStats: s.relatedStats,
        recentEvents: s.recentEvents,
      })),
      evolution: {
        stageIndex,
        stageKey: currentStage.key,
        stageLabel: currentStage.label,
        stageDescription: currentStage.description,
        nextLabel: nextStage?.label ?? null,
        nextRequirements: nextStage
          ? stageRequirementsText(nextStage, (k) => skillLabelOf(skills, k), statLabel)
          : [],
        stages: stages.map((st, i) => ({
          key: st.key,
          label: st.label,
          description: st.description,
          state: i < stageIndex ? "done" : i === stageIndex ? "current" : "future",
          requirements: stageRequirementsText(st, (k) => skillLabelOf(skills, k), statLabel),
        })),
      },
      lastEvolution: lastEvolution
        ? { label: lastEvolution.label ?? null, createdAt: lastEvolution.createdAt }
        : null,
      recommendations,
    };
  },
});

/** Cheap cached snapshot for the compact dashboard strip. */
export const snapshot = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const personaKey = await personaOf(ctx, userId);
    const skills = skillsForPersona(personaKey);
    const stages = evolutionForPersona(personaKey);

    const skillRows = await ctx.db
      .query("userSkills")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const evoRow = await ctx.db
      .query("userEvolution")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const stageIndex = evoRow?.stageIndex ?? 0;
    const stage = stages[stageIndex] ?? stages[0];

    const top = skills.slice(0, 3).map((def) => {
      const row = skillRows.find((r) => r.skillKey === def.key);
      return {
        key: def.key,
        label: def.label,
        tone: def.tone,
        hasData: row?.hasData ?? false,
        progress: row?.progress ?? 0,
        level: row?.level ?? 0,
      };
    });

    return {
      persona: personaKey,
      stageIndex,
      stageLabel: stage.label,
      stageCount: stages.length,
      skills: top,
      anyData: skillRows.some((r) => r.hasData),
      updatedAt: skillRows.reduce((n, r) => Math.max(n, r.updatedAt), 0),
      emptyState: SKILLS_EMPTY_STATE,
    };
  },
});

/** Recent skill events (level-ups + evolution) — detail/history feed. */
export const events = query({
  args: { skillKey: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { skillKey, limit }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const max = Math.min(50, Math.max(1, limit ?? 15));
    const rows = await ctx.db
      .query("skillEvents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(max * 3);
    return rows
      .filter((r) => (skillKey ? r.skillKey === skillKey : true))
      .slice(0, max)
      .map((r) => ({
        skillKey: r.skillKey,
        type: r.type,
        from: r.from,
        to: r.to,
        label: r.label ?? null,
        createdAt: r.createdAt,
      }));
  },
});
