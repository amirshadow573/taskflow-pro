import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/* ================================================================== */
/*  TEAMS                                                              */
/* ================================================================== */

export const listTeams = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db.query("teams").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  },
});

export const createTeam = mutation({
  args: { name: v.string(), description: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("teams", { userId, name: args.name, description: args.description, archived: false, createdAt: Date.now() });
  },
});

export const updateTeam = mutation({
  args: { id: v.id("teams"), name: v.optional(v.string()), description: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.description !== undefined) patch.description = args.description;
    await ctx.db.patch(args.id, patch);
  },
});

export const deleteTeam = mutation({
  args: { id: v.id("teams") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/*  TEAM MEMBERS                                                       */
/* ================================================================== */

export const listMembers = query({
  args: { teamId: v.optional(v.id("teams")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    if (args.teamId) {
      return ctx.db.query("teamMembers").withIndex("by_team", (q) => q.eq("teamId", args.teamId!)).collect();
    }
    return ctx.db.query("teamMembers").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  },
});

export const createMember = mutation({
  args: { teamId: v.id("teams"), name: v.string(), role: v.string(), email: v.optional(v.string()), capacity: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const team = await ctx.db.get(args.teamId);
    if (!team || team.userId !== userId) throw new Error("Team not found");
    return ctx.db.insert("teamMembers", { userId, teamId: args.teamId, name: args.name, role: args.role, email: args.email, capacity: args.capacity, archived: false, createdAt: Date.now() });
  },
});

export const updateMember = mutation({
  args: { id: v.id("teamMembers"), name: v.optional(v.string()), role: v.optional(v.string()), capacity: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.role !== undefined) patch.role = args.role;
    if (args.capacity !== undefined) patch.capacity = args.capacity;
    await ctx.db.patch(args.id, patch);
  },
});

export const deleteMember = mutation({
  args: { id: v.id("teamMembers") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/*  MILESTONES                                                         */
/* ================================================================== */

export const listMilestones = query({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    if (args.projectId) {
      return ctx.db.query("milestones").withIndex("by_project", (q) => q.eq("projectId", args.projectId!)).collect();
    }
    return ctx.db.query("milestones").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  },
});

export const createMilestone = mutation({
  args: { projectId: v.id("projects"), title: v.string(), description: v.optional(v.string()), dueDate: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("milestones", { userId, projectId: args.projectId, title: args.title, description: args.description, dueDate: args.dueDate, status: "pending", progress: 0, completedAt: undefined, createdAt: Date.now() });
  },
});

export const updateMilestone = mutation({
  args: { id: v.id("milestones"), title: v.optional(v.string()), dueDate: v.optional(v.string()), status: v.optional(v.string()), progress: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    const patch: Record<string, unknown> = {};
    for (const [k, v_] of Object.entries(args)) { if (k !== "id" && v_ !== undefined) patch[k] = v_; }
    if (args.status === "completed") patch.completedAt = Date.now();
    await ctx.db.patch(args.id, patch);
  },
});

export const deleteMilestone = mutation({
  args: { id: v.id("milestones") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/*  TEAM GOALS                                                         */
/* ================================================================== */

export const listTeamGoals = query({
  args: { teamId: v.optional(v.id("teams")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    if (args.teamId) {
      return ctx.db.query("teamGoals").withIndex("by_team", (q) => q.eq("teamId", args.teamId!)).collect();
    }
    return ctx.db.query("teamGoals").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  },
});

export const createTeamGoal = mutation({
  args: { teamId: v.id("teams"), title: v.string(), description: v.optional(v.string()), period: v.string(), dueDate: v.optional(v.string()), ownerId: v.optional(v.id("teamMembers")), relatedProjectIds: v.array(v.id("projects")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("teamGoals", { userId, teamId: args.teamId, title: args.title, description: args.description, period: args.period, dueDate: args.dueDate, progress: 0, status: "active", ownerId: args.ownerId, relatedProjectIds: args.relatedProjectIds, completedAt: undefined, createdAt: Date.now() });
  },
});

export const updateTeamGoal = mutation({
  args: { id: v.id("teamGoals"), title: v.optional(v.string()), status: v.optional(v.string()), progress: v.optional(v.number()), dueDate: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    const patch: Record<string, unknown> = {};
    for (const [k, v_] of Object.entries(args)) { if (k !== "id" && v_ !== undefined) patch[k] = v_; }
    if (args.status === "completed") patch.completedAt = Date.now();
    await ctx.db.patch(args.id, patch);
  },
});

export const deleteTeamGoal = mutation({
  args: { id: v.id("teamGoals") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/*  MEETINGS                                                           */
/* ================================================================== */

export const listMeetings = query({
  args: { teamId: v.optional(v.id("teams")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    if (args.teamId) {
      return ctx.db.query("meetings").withIndex("by_team", (q) => q.eq("teamId", args.teamId!)).collect();
    }
    return ctx.db.query("meetings").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  },
});

export const createMeeting = mutation({
  args: { teamId: v.id("teams"), title: v.string(), date: v.string(), time: v.optional(v.string()), participants: v.array(v.string()), projectId: v.optional(v.id("projects")), agenda: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("meetings", { userId, teamId: args.teamId, title: args.title, date: args.date, time: args.time, participants: args.participants, projectId: args.projectId, agenda: args.agenda, notes: undefined, decisions: undefined, actionItems: undefined, status: "scheduled", createdAt: Date.now() });
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
/*  TEAM ACTIVITY                                                      */
/* ================================================================== */

export const listActivity = query({
  args: { teamId: v.optional(v.id("teams")), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const q = args.teamId
      ? ctx.db.query("teamActivity").withIndex("by_team", (q) => q.eq("teamId", args.teamId!))
      : ctx.db.query("teamActivity").withIndex("by_user", (q) => q.eq("userId", userId));
    return q.order("desc").take(args.limit ?? 30);
  },
});

export const logActivity = mutation({
  args: { teamId: v.id("teams"), type: v.string(), title: v.string(), description: v.optional(v.string()), memberId: v.optional(v.id("teamMembers")), projectId: v.optional(v.id("projects")), taskId: v.optional(v.id("tasks")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("teamActivity", { userId, teamId: args.teamId, type: args.type, title: args.title, description: args.description, memberId: args.memberId, projectId: args.projectId, taskId: args.taskId, createdAt: Date.now() });
  },
});
