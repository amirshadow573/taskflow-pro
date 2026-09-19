import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

/** All active routines (task sets) for the current user. */
export const listRoutines = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("routines")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();
  },
});

/** All active items grouped by routine for the current user. */
export const listAllItems = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("routineItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();
  },
});

/** Check-ins for a specific day (used by the daily page). */
export const listCheckinsForDay = query({
  args: { day: v.string() },
  handler: async (ctx, { day }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("checkins")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
      .collect();
  },
});

/** Check-ins for a Gregorian month (YYYY-MM) for the calendar heatmap. */
export const listCheckinsForMonth = query({
  args: { monthPrefix: v.string() }, // "YYYY-MM"
  handler: async (ctx, { monthPrefix }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const start = await ctx.db
      .query("checkins")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", `${monthPrefix}-00`),
      )
      .collect();
    return start.filter((c) => c.day.startsWith(monthPrefix));
  },
});

/** Overall stats: today, this month, this year percentages. */
export const getStats = query({
  args: { day: v.string(), monthPrefix: v.string(), yearPrefix: v.string() },
  handler: async (ctx, { day, monthPrefix, yearPrefix }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return { dayPct: 0, monthPct: 0, yearPct: 0, itemsCount: 0 };
    }

    const routines = await ctx.db
      .query("routines")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();

    const items = await ctx.db
      .query("routineItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();

    const itemsCount = items.length;

    const pct = (done: number, total: number) =>
      total === 0 ? 0 : Math.round((done / total) * 100);

    const dayCheckins = await ctx.db
      .query("checkins")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
      .collect();
    const dayDone = dayCheckins.filter((c) => c.done).length;

    // Month: walk all days with prefix
    const monthCheckins = await ctx.db
      .query("checkins")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", `${monthPrefix}-00`),
      )
      .collect();
    const monthDone = monthCheckins.filter(
      (c) => c.done && c.day.startsWith(monthPrefix),
    ).length;
    const dayOfMonth = Number(day.slice(8, 10));
    const monthPct = pct(monthDone, itemsCount * dayOfMonth);

    // Year: same trick, day slice of the year prefix
    const yearCheckins = await ctx.db
      .query("checkins")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId)
          .gte("day", `${yearPrefix}-01-01`)
          .lte("day", day),
      )
      .collect();
    const yearDone = yearCheckins.filter((c) => c.done).length;
    // approximate day-of-year from the month/day part
    const month = Number(day.slice(5, 7));
    const dom = Number(day.slice(8, 10));
    const dayOfYear = Math.round((month - 1) * 30.44) + dom;
    const yearPct = pct(yearDone, itemsCount * dayOfYear);

    return { dayPct: pct(dayDone, itemsCount), monthPct, yearPct, itemsCount };
  },
});

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

export const createRoutine = mutation({
  args: { title: v.string(), colorKey: v.string() },
  handler: async (ctx, { title, colorKey }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const all = await ctx.db
      .query("routines")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .collect();
    const sortOrder = all.reduce((m, r) => Math.max(m, r.sortOrder), 0) + 1;
    return await ctx.db.insert("routines", {
      userId,
      title: title.trim(),
      colorKey,
      sortOrder,
    });
  },
});

export const renameRoutine = mutation({
  args: { id: v.id("routines"), title: v.string() },
  handler: async (ctx, { id, title }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const routine = await ctx.db.get(id);
    if (!routine || routine.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, { title: title.trim() });
  },
});

export const setRoutineColor = mutation({
  args: { id: v.id("routines"), colorKey: v.string() },
  handler: async (ctx, { id, colorKey }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const routine = await ctx.db.get(id);
    if (!routine || routine.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, { colorKey });
  },
});

export const deleteRoutine = mutation({
  args: { id: v.id("routines") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const routine = await ctx.db.get(id);
    if (!routine || routine.userId !== userId) throw new Error("Not found");

    const items = await ctx.db
      .query("routineItems")
      .withIndex("by_routine", (q) => q.eq("routineId", id))
      .collect();
    for (const item of items) {
      const checkins = await ctx.db
        .query("checkins")
        .withIndex("by_item", (q) => q.eq("itemId", item._id))
        .collect();
      for (const c of checkins) await ctx.db.delete(c._id);
      await ctx.db.delete(item._id);
    }
    await ctx.db.delete(id);
  },
});

export const createItem = mutation({
  args: { routineId: v.id("routines"), title: v.string() },
  handler: async (ctx, { routineId, title }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const routine = await ctx.db.get(routineId);
    if (!routine || routine.userId !== userId) throw new Error("Not found");
    const items = await ctx.db
      .query("routineItems")
      .withIndex("by_routine", (q) => q.eq("routineId", routineId))
      .collect();
    const sortOrder = items.reduce((m, i) => Math.max(m, i.sortOrder), 0) + 1;
    await ctx.db.insert("routineItems", {
      userId,
      routineId,
      title: title.trim(),
      sortOrder,
    });
  },
});

export const renameItem = mutation({
  args: { id: v.id("routineItems"), title: v.string() },
  handler: async (ctx, { id, title }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const item = await ctx.db.get(id);
    if (!item || item.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, { title: title.trim() });
  },
});

export const deleteItem = mutation({
  args: { id: v.id("routineItems") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const item = await ctx.db.get(id);
    if (!item || item.userId !== userId) throw new Error("Not found");
    const checkins = await ctx.db
      .query("checkins")
      .withIndex("by_item", (q) => q.eq("itemId", id))
      .collect();
    for (const c of checkins) await ctx.db.delete(c._id);
    await ctx.db.delete(id);
  },
});

/** Toggle (or set) the done state of an item for a day. */
export const toggleCheckin = mutation({
  args: { itemId: v.id("routineItems"), day: v.string(), done: v.boolean() },
  handler: async (ctx, { itemId, day, done }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const item = await ctx.db.get(itemId);
    if (!item || item.userId !== userId) throw new Error("Not found");

    const existing = await ctx.db
      .query("checkins")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
      .filter((q) => q.eq(q.field("itemId"), itemId))
      .collect();

    if (existing.length > 0) {
      await ctx.db.patch(existing[0]._id, { done });
    } else {
      await ctx.db.insert("checkins", { userId, itemId, day, done });
    }
  },
});
