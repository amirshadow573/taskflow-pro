import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { handleFocusSession, handleGoalStatusChange } from "./gamification";

/* ================================================================== */
/*  MEETINGS (reuse manager table)                                     */
/* ================================================================== */

export const listMyMeetings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db.query("meetings").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  },
});

export const createMeeting = mutation({
  args: { title: v.string(), date: v.string(), time: v.optional(v.string()), participants: v.array(v.string()), projectId: v.optional(v.id("projects")), agenda: v.optional(v.string()), teamId: v.optional(v.id("teams")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    // Use a dummy teamId if none provided — meetings table requires it
    const dummyTeam = await ctx.db.query("teams").withIndex("by_user", (q) => q.eq("userId", userId)).first();
    const teamId = args.teamId ?? dummyTeam?._id;
    if (!teamId) throw new Error("No team found — create a team first");
    return ctx.db.insert("meetings", { userId, teamId, title: args.title, date: args.date, time: args.time, participants: args.participants, projectId: args.projectId, agenda: args.agenda, notes: undefined, decisions: undefined, actionItems: undefined, status: "scheduled", createdAt: Date.now() });
  },
});

export const updateMeeting = mutation({
  args: { id: v.id("meetings"), notes: v.optional(v.string()), decisions: v.optional(v.string()), actionItems: v.optional(v.string()), status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    const patch: Record<string, unknown> = {};
    for (const [k, v_] of Object.entries(args)) { if (k !== "id" && v_ !== undefined) patch[k] = v_; }
    await ctx.db.patch(args.id, patch);
  },
});

export const deleteMeeting = mutation({
  args: { id: v.id("meetings") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/*  FOCUS SESSIONS                                                     */
/* ================================================================== */

export const listFocusSessions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db.query("focusSessions").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  },
});

/**
 * Shared focus/study row creation + XP path.
 *
 * The employee workspace and the Phase 12 execution engine both record focus
 * sessions through this ONE helper, so a completed focus session can never
 * award XP twice (handleFocusSession is itself idempotent per refId).
 */
export async function createFocusSessionRow(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    taskId?: Id<"tasks">;
    projectId?: Id<"projects">;
    title?: string;
    plannedMinutes: number;
    actualMinutes: number;
    date: string;
    completed: boolean;
    type: string;
    /** Persian label used in the XP ledger entry. */
    sourceLabel?: string;
  },
): Promise<{
  id: Id<"focusSessions">;
  /** Progression result (null when nothing was awarded). */
  result: Awaited<ReturnType<typeof handleFocusSession>> | null;
}> {
  const { sourceLabel = "جلسه تمرکز", ...row } = args;
  const id = await ctx.db.insert("focusSessions", {
    ...row,
    createdAt: Date.now(),
  });
  let result: Awaited<ReturnType<typeof handleFocusSession>> | null = null;
  // XP: only genuinely completed sessions earn focus XP (daily cap applies).
  if (args.completed) {
    result = await handleFocusSession(
      ctx,
      {
        userId: args.userId,
        _id: id,
        title: args.title,
        plannedMinutes: args.plannedMinutes,
        actualMinutes: args.actualMinutes,
        completed: args.completed,
      },
      sourceLabel,
    );
  }
  return { id, result };
}

export const createFocusSession = mutation({
  args: { taskId: v.optional(v.id("tasks")), projectId: v.optional(v.id("projects")), title: v.optional(v.string()), plannedMinutes: v.number(), actualMinutes: v.number(), date: v.string(), completed: v.boolean(), type: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return (await createFocusSessionRow(ctx, { userId, ...args })).id;
  },
});

export const updateFocusSession = mutation({
  args: { id: v.id("focusSessions"), actualMinutes: v.optional(v.number()), completed: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    const patch: Record<string, unknown> = {};
    if (args.actualMinutes !== undefined) patch.actualMinutes = args.actualMinutes;
    if (args.completed !== undefined) patch.completed = args.completed;
    await ctx.db.patch(args.id, patch);
    // XP: award/revoke when the session's completion state changes.
    const nextCompleted = args.completed ?? doc.completed;
    const nextMinutes = args.actualMinutes ?? doc.actualMinutes;
    if (nextCompleted !== doc.completed || nextMinutes !== doc.actualMinutes) {
      await handleFocusSession(
        ctx,
        { userId, _id: args.id, title: doc.title ?? undefined, plannedMinutes: doc.plannedMinutes, actualMinutes: nextMinutes, completed: nextCompleted },
        "جلسه تمرکز",
      );
    }
  },
});

export const deleteFocusSession = mutation({
  args: { id: v.id("focusSessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/*  RECURRING CONFIGS                                                  */
/* ================================================================== */

export const listRecurringConfigs = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db.query("recurringConfigs").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  },
});

export const createRecurringConfig = mutation({
  args: { title: v.string(), description: v.optional(v.string()), projectId: v.optional(v.id("projects")), priority: v.string(), estimateMinutes: v.optional(v.number()), recurrence: v.string(), recurrenceDays: v.optional(v.array(v.number())) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("recurringConfigs", { userId, title: args.title, description: args.description, projectId: args.projectId, priority: args.priority, estimateMinutes: args.estimateMinutes, recurrence: args.recurrence, recurrenceDays: args.recurrenceDays, lastGenerated: undefined, active: true, createdAt: Date.now() });
  },
});

export const updateRecurringConfig = mutation({
  args: { id: v.id("recurringConfigs"), active: v.optional(v.boolean()), title: v.optional(v.string()), priority: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    const patch: Record<string, unknown> = {};
    for (const [k, v_] of Object.entries(args)) { if (k !== "id" && v_ !== undefined) patch[k] = v_; }
    await ctx.db.patch(args.id, patch);
  },
});

export const deleteRecurringConfig = mutation({
  args: { id: v.id("recurringConfigs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/*  WORK GOALS                                                         */
/* ================================================================== */

export const listWorkGoals = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db.query("workGoals").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  },
});

export const createWorkGoal = mutation({
  args: { title: v.string(), description: v.optional(v.string()), period: v.string(), dueDate: v.optional(v.string()), relatedProjectIds: v.array(v.id("projects")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("workGoals", { userId, title: args.title, description: args.description, period: args.period, dueDate: args.dueDate, progress: 0, status: "active", relatedProjectIds: args.relatedProjectIds, completedAt: undefined, createdAt: Date.now() });
  },
});

export const updateWorkGoal = mutation({
  args: { id: v.id("workGoals"), title: v.optional(v.string()), status: v.optional(v.string()), progress: v.optional(v.number()), dueDate: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    const patch: Record<string, unknown> = {};
    for (const [k, v_] of Object.entries(args)) { if (k !== "id" && v_ !== undefined) patch[k] = v_; }
    if (args.status === "completed") patch.completedAt = Date.now();
    await ctx.db.patch(args.id, patch);
    // XP: work-goal completion (shared engine, once per goal).
    if (args.status !== undefined && args.status !== doc.status) {
      await handleGoalStatusChange(ctx, userId, {
        table: "workGoals",
        goalId: args.id,
        title: doc.title,
        prevStatus: doc.status,
        newStatus: args.status,
      });
    }
  },
});

export const deleteWorkGoal = mutation({
  args: { id: v.id("workGoals") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/*  EMPLOYEE NOTES                                                     */
/* ================================================================== */

export const listNotes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db.query("employeeNotes").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  },
});

export const createNote = mutation({
  args: { title: v.string(), content: v.string(), noteType: v.string(), projectId: v.optional(v.id("projects")), tags: v.array(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("employeeNotes", { userId, title: args.title, content: args.content, noteType: args.noteType, projectId: args.projectId, tags: args.tags, createdAt: Date.now(), updatedAt: Date.now() });
  },
});

export const updateNote = mutation({
  args: { id: v.id("employeeNotes"), title: v.optional(v.string()), content: v.optional(v.string()), tags: v.optional(v.array(v.string())) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [k, v_] of Object.entries(args)) { if (k !== "id" && v_ !== undefined) patch[k] = v_; }
    await ctx.db.patch(args.id, patch);
  },
});

export const deleteNote = mutation({
  args: { id: v.id("employeeNotes") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});
