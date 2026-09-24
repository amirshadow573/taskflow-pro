/**
 * Quest Center read model — Phase 06 data, exposed for the Progress Center.
 *
 * Audit fix: the `userQuests` table and `questRules` catalog existed and were
 * written by the engine, but NO user-facing query read them. The dashboard's
 * "ماموریت" row linked to `/progress?tab=quests`, a tab that did not exist —
 * a dead link. This module adds the missing READ side only. It does not
 * re-implement quest generation, scoring or XP (those stay in questRules /
 * gamification / progression).
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import { v } from "convex/values";
import { QUEST_DIFFICULTY, QUEST_TYPE_LABELS } from "./questRules";

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const max = Math.min(100, Math.max(1, limit ?? 40));
    const rows = await ctx.db
      .query("userQuests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return rows
      // Active first, then most recently updated; never show stale/expired rows.
      .filter((r) => r.status === "active" || r.status === "completed")
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "active" ? -1 : 1;
        return b.updatedAt - a.updatedAt;
      })
      .slice(0, max)
      .map((r) => ({
        id: r._id as string,
        questKey: r.questKey,
        title: r.title,
        description: r.description,
        type: r.type,
        typeLabel: QUEST_TYPE_LABELS[r.type as keyof typeof QUEST_TYPE_LABELS] ?? r.type,
        difficulty: r.difficulty,
        difficultyLabel:
          QUEST_DIFFICULTY[r.difficulty as keyof typeof QUEST_DIFFICULTY]?.label ??
          r.difficulty,
        progress: r.progress,
        target: r.target,
        xp: r.xp,
        status: r.status,
        period: r.period,
        deadline: r.deadline ?? null,
        countsText: r.countsText ?? null,
        completedAt: r.completedAt ?? null,
      }));
  },
});
