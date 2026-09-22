import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { handleGoalMilestoneChange, handleGoalStatusChange } from "./gamification";

/* ================================================================== */
/*  Life Areas                                                         */
/* ================================================================== */

export const listLifeAreas = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("lifeAreas")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const createLifeArea = mutation({
  args: { name: v.string(), color: v.string(), emoji: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("lifeAreas", {
      userId,
      name: args.name,
      color: args.color,
      emoji: args.emoji,
      archived: false,
      createdAt: Date.now(),
    });
  },
});

export const updateLifeArea = mutation({
  args: {
    id: v.id("lifeAreas"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    emoji: v.optional(v.string()),
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    const { id, ...patch } = args;
    await ctx.db.patch(id, patch);
  },
});

export const deleteLifeArea = mutation({
  args: { id: v.id("lifeAreas") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/*  Personal Goals                                                     */
/* ================================================================== */

export const listGoals = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("personalGoals")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const createGoal = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    lifeAreaId: v.optional(v.id("lifeAreas")),
    dueDate: v.optional(v.string()),
    milestones: v.array(v.object({ title: v.string(), done: v.boolean() })),
    relatedProjectIds: v.array(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const now = Date.now();
    return ctx.db.insert("personalGoals", {
      userId,
      title: args.title,
      description: args.description,
      lifeAreaId: args.lifeAreaId,
      dueDate: args.dueDate,
      progress: 0,
      status: "active",
      milestones: args.milestones,
      relatedProjectIds: args.relatedProjectIds,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateGoal = mutation({
  args: {
    id: v.id("personalGoals"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    lifeAreaId: v.optional(v.id("lifeAreas")),
    dueDate: v.optional(v.string()),
    progress: v.optional(v.number()),
    status: v.optional(v.string()),
    milestones: v.optional(v.array(v.object({ title: v.string(), done: v.boolean() }))),
    relatedProjectIds: v.optional(v.array(v.id("projects"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    const { id, ...patch } = args;
    const updates: Record<string, unknown> = { ...patch, updatedAt: Date.now() };
    if (patch.status === "completed") updates.completedAt = Date.now();
    // Derive progress from milestones when milestones were provided.
    if (patch.milestones) {
      const done = patch.milestones.filter((m) => m.done).length;
      updates.progress = patch.milestones.length
        ? Math.round((done / patch.milestones.length) * 100)
        : (patch.progress ?? doc.progress);
    }
    await ctx.db.patch(id, updates);

    // XP: goal completion + per-milestone progress (shared Phase 03 engine).
    const nextStatus = (patch.status as string | undefined) ?? doc.status;
    if (nextStatus !== doc.status) {
      await handleGoalStatusChange(ctx, userId, {
        table: "personalGoals",
        goalId: id,
        title: (patch.title as string | undefined) ?? doc.title,
        prevStatus: doc.status,
        newStatus: nextStatus,
      });
    }
    if (patch.milestones) {
      for (let i = 0; i < patch.milestones.length; i++) {
        const wasDone = doc.milestones[i]?.done ?? false;
        const nowDone = patch.milestones[i].done;
        if (wasDone !== nowDone) {
          await handleGoalMilestoneChange(ctx, userId, {
            goalId: id,
            index: i,
            title: patch.milestones[i].title,
            done: nowDone,
          });
        }
      }
    }
  },
});

export const deleteGoal = mutation({
  args: { id: v.id("personalGoals") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/*  Habits                                                             */
/* ================================================================== */

export const listHabits = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("habits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

/** Habits with today's completion state + streak, in one round trip. */
export const habitsState = query({
  args: { day: v.string() },
  handler: async (ctx, { day }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const habits = await ctx.db
      .query("habits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const logs = await ctx.db
      .query("habitLogs")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).gte("day", shiftDay(day, -60)))
      .collect();
    return habits
      .filter((h) => !h.archived)
      .map((h) => {
        const mine = logs.filter((l) => l.habitId === h._id);
        const doneToday = mine.some((l) => l.day === day && l.done);
        // Streak: consecutive days ending today (or yesterday if today not done yet).
        let streak = 0;
        let cursor = doneToday ? day : shiftDay(day, -1);
        for (let i = 0; i < 365; i++) {
          const hit = mine.some((l) => l.day === cursor && l.done);
          if (!hit) break;
          streak++;
          cursor = shiftDay(cursor, -1);
        }
        const weekStart = shiftDay(day, -6);
        const weekDone = mine.filter((l) => l.done && l.day >= weekStart && l.day <= day).length;
        return { ...h, doneToday, streak, weekDone };
      });
  },
});

export const createHabit = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    frequency: v.string(),
    target: v.number(),
    color: v.optional(v.string()),
    lifeAreaId: v.optional(v.id("lifeAreas")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("habits", {
      userId,
      title: args.title,
      description: args.description,
      frequency: args.frequency,
      target: args.target,
      color: args.color,
      lifeAreaId: args.lifeAreaId,
      archived: false,
      createdAt: Date.now(),
    });
  },
});

export const updateHabit = mutation({
  args: {
    id: v.id("habits"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    frequency: v.optional(v.string()),
    target: v.optional(v.number()),
    color: v.optional(v.string()),
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    const { id, ...patch } = args;
    await ctx.db.patch(id, patch);
  },
});

export const deleteHabit = mutation({
  args: { id: v.id("habits") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    const logs = await ctx.db
      .query("habitLogs")
      .withIndex("by_habit", (q) => q.eq("habitId", args.id))
      .collect();
    for (const l of logs) await ctx.db.delete(l._id);
    await ctx.db.delete(args.id);
  },
});

export const toggleHabitLog = mutation({
  args: { habitId: v.id("habits"), day: v.string(), done: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.habitId);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    const existing = await ctx.db
      .query("habitLogs")
      .withIndex("by_habit", (q) => q.eq("habitId", args.habitId))
      .filter((q) => q.eq(q.field("day"), args.day))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { done: args.done });
    } else {
      await ctx.db.insert("habitLogs", { userId, habitId: args.habitId, day: args.day, done: args.done });
    }
  },
});

/* ================================================================== */
/*  Time Blocks                                                        */
/* ================================================================== */

export const listTimeBlocks = query({
  args: { day: v.optional(v.string()) },
  handler: async (ctx, { day }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const q = ctx.db
      .query("timeBlocks")
      .withIndex("by_user", (r) => r.eq("userId", userId));
    const rows = await q.collect();
    return day ? rows.filter((r) => r.day === day) : rows;
  },
});

export const createTimeBlock = mutation({
  args: {
    title: v.string(),
    day: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    kind: v.string(),
    taskId: v.optional(v.id("tasks")),
    projectId: v.optional(v.id("projects")),
    goalId: v.optional(v.id("personalGoals")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("timeBlocks", { userId, ...args, createdAt: Date.now() });
  },
});

export const deleteTimeBlock = mutation({
  args: { id: v.id("timeBlocks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/*  Reviews                                                            */
/* ================================================================== */

export const listReviews = query({
  args: { type: v.optional(v.string()) },
  handler: async (ctx, { type }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("personalReviews")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    return type ? rows.filter((r) => r.type === type) : rows;
  },
});

export const saveReview = mutation({
  args: {
    type: v.string(),
    periodKey: v.string(),
    completedWork: v.string(),
    remainingWork: v.string(),
    wentWell: v.string(),
    focusNext: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("personalReviews")
      .withIndex("by_user_type", (q) => q.eq("userId", userId).eq("type", args.type))
      .filter((q) => q.eq(q.field("periodKey"), args.periodKey))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        completedWork: args.completedWork,
        remainingWork: args.remainingWork,
        wentWell: args.wentWell,
        focusNext: args.focusNext,
        updatedAt: now,
      });
      return existing._id;
    }
    return ctx.db.insert("personalReviews", { userId, ...args, createdAt: now, updatedAt: now });
  },
});

export const deleteReview = mutation({
  args: { id: v.id("personalReviews") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/*  Notes                                                              */
/* ================================================================== */

export const listNotes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("personalNotes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const createNote = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    lifeAreaId: v.optional(v.id("lifeAreas")),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const now = Date.now();
    return ctx.db.insert("personalNotes", { userId, ...args, createdAt: now, updatedAt: now });
  },
});

export const updateNote = mutation({
  args: {
    id: v.id("personalNotes"),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    lifeAreaId: v.optional(v.id("lifeAreas")),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    const { id, ...patch } = args;
    await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
  },
});

export const deleteNote = mutation({
  args: { id: v.id("personalNotes") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

/** Shift a YYYY-MM-DD key by n days (UTC-safe). */
function shiftDay(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
