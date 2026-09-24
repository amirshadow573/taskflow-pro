import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { handleProjectStatusChange } from "./gamification";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("archived"), false))
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    deadline: v.optional(v.string()),
    /** `${kind}:${goalId}` — the goal this project serves (Phase 09). */
    goalRef: v.optional(v.string()),
  },
  handler: async (ctx, { name, description, color, deadline, goalRef }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    return await ctx.db.insert("projects", {
      userId,
      name: name.trim(),
      description: description?.trim() || undefined,
      color: color ?? "#4f46e5",
      deadline: deadline || undefined,
      status: "active",
      createdAt: Date.now(),
      archived: false,
      goalRef: goalRef || undefined,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    color: v.optional(v.string()),
    deadline: v.optional(v.union(v.string(), v.null())),
    status: v.optional(v.string()),
    goalRef: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { id, ...rest }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const project = await ctx.db.get(id);
    if (!project || project.userId !== userId) throw new Error("Not found");
    const prevStatus = project.status;
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(rest)) {
      if (val !== undefined) patch[k] = val === null ? undefined : val;
    }
    if (Object.keys(patch).length) await ctx.db.patch(id, patch);
    // XP: meaningful outcome when a project is completed (reversible + audited).
    if (rest.status !== undefined && rest.status !== prevStatus) {
      await handleProjectStatusChange(ctx, project, rest.status);
    }
  },
});

export const remove = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const project = await ctx.db.get(id);
    if (!project || project.userId !== userId) throw new Error("Not found");
    // Detach its tasks instead of destroying user work
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const t of tasks) {
      if (t.projectId === id) await ctx.db.patch(t._id, { projectId: undefined });
    }
    await ctx.db.delete(id);
  },
});
