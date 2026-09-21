import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Personalization foundation (Phase 1).
 *
 * One document per user holding persona, goals, preferences and dashboard
 * configuration. Pure data — no UI, no gamification, no AI. Consumers
 * (onboarding, settings, dashboard personalization in Phase 2+) read and
 * write this through a tiny API so the underlying storage can evolve.
 *
 * JSON string fields (personaDetails / preferences / dashboardConfig) keep
 * the schema additive and migration-free: new keys can be added later
 * without touching the Convex table definition.
 */

/** Returns the current user's profile, or null when none exists yet. */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return await ctx.db
      .query("userProfile")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

/**
 * Patch-or-create the profile for the signed-in user.
 * Only provided fields are written; omitted fields are preserved, so
 * onboarding and settings can update different parts independently.
 *
 * Goals are replaced wholesale (arrays), JSON fields are full-document
 * snapshots written by the client helper in src/lib/personas.ts.
 */
export const upsert = mutation({
  args: {
    personaKey: v.optional(v.string()),
    personaSource: v.optional(v.string()), // onboarding | settings | inferred | default
    personaDetails: v.optional(v.string()), // JSON
    goals: v.optional(v.array(v.string())),
    workStyle: v.optional(v.string()), // planning cadence key
    productivityStyle: v.optional(v.string()), // productivity preference key
    preferences: v.optional(v.string()), // JSON
    dashboardConfig: v.optional(v.string()), // JSON
    completedOnboarding: v.optional(v.boolean()),
  },
  handler: async (ctx, patch) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("userProfile")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(patch.personaKey !== undefined ? { personaKey: patch.personaKey } : {}),
        ...(patch.personaSource !== undefined
          ? { personaSource: patch.personaSource }
          : {}),
        ...(patch.personaDetails !== undefined
          ? { personaDetails: patch.personaDetails }
          : {}),
        ...(patch.goals !== undefined ? { goals: patch.goals } : {}),
        ...(patch.workStyle !== undefined ? { workStyle: patch.workStyle } : {}),
        ...(patch.productivityStyle !== undefined
          ? { productivityStyle: patch.productivityStyle }
          : {}),
        ...(patch.preferences !== undefined ? { preferences: patch.preferences } : {}),
        ...(patch.dashboardConfig !== undefined
          ? { dashboardConfig: patch.dashboardConfig }
          : {}),
        ...(patch.completedOnboarding !== undefined
          ? { completedOnboarding: patch.completedOnboarding }
          : {}),
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("userProfile", {
      userId,
      personaKey: patch.personaKey ?? "personal",
      personaSource: patch.personaSource ?? "default",
      personaDetails: patch.personaDetails,
      goals: patch.goals ?? [],
      workStyle: patch.workStyle,
      productivityStyle: patch.productivityStyle,
      preferences: patch.preferences,
      dashboardConfig: patch.dashboardConfig,
      completedOnboarding: patch.completedOnboarding ?? false,
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
  },
});
