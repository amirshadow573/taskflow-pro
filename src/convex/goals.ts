/**
 * Goals facade — Phase 09 (Dashboard & Workspace Integration).
 *
 * ONE read-only query that normalizes the persona-specific goal tables
 * (personalGoals / workGoals / teamGoals / businessGoals) into a single shape
 * the workspace can consume. It does NOT create a second goals system: every
 * row still lives in its original table and is edited through the existing
 * persona services. This module only resolves + normalizes.
 *
 * The `ref` (`${kind}:${id}`) is the same value stored on `projects.goalRef`,
 * which is how the UI derives Goal → Project → Task relationships.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

export type GoalKind = "personal" | "work" | "team" | "business";

export interface GoalView {
  /** `${kind}:${id}` — matches projects.goalRef. */
  ref: string;
  kind: GoalKind;
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  /** Self-reported progress 0..100 (execution progress is computed in the UI). */
  progress: number;
  /** active | completed | paused | at_risk */
  status: string;
}

async function personaOf(ctx: QueryCtx, userId: Id<"users">): Promise<string> {
  const profile = await ctx.db
    .query("userProfile")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return profile?.personaKey ?? "personal";
}

/** Persona → which goal table holds that persona's objectives. */
export function kindForPersona(personaKey: string): GoalKind {
  switch (personaKey) {
    case "employee":
      return "work";
    case "manager":
    case "team":
      return "team";
    case "business_owner":
      return "business";
    default:
      // student / freelancer / personal / custom → personal goals table
      return "personal";
  }
}

const normalize = (kind: GoalKind, g: Doc<"personalGoals" | "workGoals" | "teamGoals" | "businessGoals">): GoalView => ({
  ref: `${kind}:${g._id}`,
  kind,
  id: g._id as string,
  title: g.title,
  description: g.description ?? null,
  dueDate: g.dueDate ?? null,
  progress: typeof g.progress === "number" ? g.progress : 0,
  status: g.status ?? "active",
});

/**
 * The active persona's goals, normalized. One subscription, small per-user
 * read — safe for dashboard / project pages.
 */
export const list = query({
  args: {},
  handler: async (ctx): Promise<GoalView[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const kind = kindForPersona(await personaOf(ctx, userId));

    if (kind === "work") {
      const rows = await ctx.db
        .query("workGoals")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      return rows.map((g) => normalize(kind, g));
    }
    if (kind === "team") {
      const rows = await ctx.db
        .query("teamGoals")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      return rows.map((g) => normalize(kind, g));
    }
    if (kind === "business") {
      const rows = await ctx.db
        .query("businessGoals")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      return rows.map((g) => normalize(kind, g));
    }
    const rows = await ctx.db
      .query("personalGoals")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.map((g) => normalize(kind, g));
  },
});
