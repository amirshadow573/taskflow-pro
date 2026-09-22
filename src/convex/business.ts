import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { handleGoalStatusChange } from "./gamification";

/* ================================================================== */
/* Customers                                                           */
/* ================================================================== */

export const listCustomers = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("customers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const createCustomer = mutation({
  args: {
    name: v.string(),
    company: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    status: v.string(),
    source: v.optional(v.string()),
    tags: v.array(v.string()),
    notes: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("customers", {
      userId,
      ...args,
      totalRevenue: 0,
      pendingPayments: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const updateCustomer = mutation({
  args: {
    id: v.id("customers"),
    name: v.optional(v.string()),
    company: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    status: v.optional(v.string()),
    source: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    color: v.optional(v.string()),
    totalRevenue: v.optional(v.number()),
    pendingPayments: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined) filtered[k] = v;
    }
    filtered.updatedAt = Date.now();
    await ctx.db.patch(id, filtered);
  },
});

export const deleteCustomer = mutation({
  args: { id: v.id("customers") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/* Sales Opportunities                                                 */
/* ================================================================== */

export const listSales = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("salesOpportunities")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const createSale = mutation({
  args: {
    customerId: v.optional(v.id("customers")),
    title: v.string(),
    value: v.number(),
    currency: v.string(),
    stage: v.string(),
    expectedCloseDate: v.optional(v.string()),
    probability: v.optional(v.number()),
    owner: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("salesOpportunities", {
      userId,
      ...args,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const updateSale = mutation({
  args: {
    id: v.id("salesOpportunities"),
    customerId: v.optional(v.id("customers")),
    title: v.optional(v.string()),
    value: v.optional(v.number()),
    currency: v.optional(v.string()),
    stage: v.optional(v.string()),
    expectedCloseDate: v.optional(v.string()),
    probability: v.optional(v.number()),
    owner: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined) filtered[k] = v;
    }
    filtered.updatedAt = Date.now();
    await ctx.db.patch(id, filtered);
  },
});

export const deleteSale = mutation({
  args: { id: v.id("salesOpportunities") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/* Revenue Entries                                                     */
/* ================================================================== */

export const listRevenue = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("revenueEntries")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const createRevenue = mutation({
  args: {
    customerId: v.optional(v.id("customers")),
    projectId: v.optional(v.id("projects")),
    title: v.string(),
    amount: v.number(),
    currency: v.string(),
    status: v.string(),
    category: v.optional(v.string()),
    date: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("revenueEntries", {
      userId,
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const updateRevenue = mutation({
  args: {
    id: v.id("revenueEntries"),
    title: v.optional(v.string()),
    amount: v.optional(v.number()),
    status: v.optional(v.string()),
    category: v.optional(v.string()),
    date: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined) filtered[k] = v;
    }
    await ctx.db.patch(id, filtered);
  },
});

export const deleteRevenue = mutation({
  args: { id: v.id("revenueEntries") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/* Expenses                                                            */
/* ================================================================== */

export const listExpenses = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("expenses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const createExpense = mutation({
  args: {
    projectId: v.optional(v.id("projects")),
    title: v.string(),
    amount: v.number(),
    currency: v.string(),
    category: v.string(),
    date: v.string(),
    notes: v.optional(v.string()),
    recurring: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("expenses", {
      userId,
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const updateExpense = mutation({
  args: {
    id: v.id("expenses"),
    title: v.optional(v.string()),
    amount: v.optional(v.number()),
    category: v.optional(v.string()),
    date: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined) filtered[k] = v;
    }
    await ctx.db.patch(id, filtered);
  },
});

export const deleteExpense = mutation({
  args: { id: v.id("expenses") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/* Payments                                                            */
/* ================================================================== */

export const listPayments = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("payments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const createPayment = mutation({
  args: {
    customerId: v.optional(v.id("customers")),
    projectId: v.optional(v.id("projects")),
    title: v.string(),
    amount: v.number(),
    currency: v.string(),
    type: v.string(),
    status: v.string(),
    dueDate: v.string(),
    paidDate: v.optional(v.string()),
    paidAmount: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("payments", {
      userId,
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const updatePayment = mutation({
  args: {
    id: v.id("payments"),
    title: v.optional(v.string()),
    amount: v.optional(v.number()),
    status: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    paidDate: v.optional(v.string()),
    paidAmount: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined) filtered[k] = v;
    }
    await ctx.db.patch(id, filtered);
  },
});

export const deletePayment = mutation({
  args: { id: v.id("payments") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/* Business Goals                                                      */
/* ================================================================== */

export const listBusinessGoals = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("businessGoals")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const createBusinessGoal = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    type: v.string(),
    period: v.string(),
    target: v.optional(v.number()),
    current: v.number(),
    unit: v.optional(v.string()),
    progress: v.number(),
    status: v.string(),
    dueDate: v.optional(v.string()),
    relatedProjectIds: v.array(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("businessGoals", {
      userId,
      ...args,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const updateBusinessGoal = mutation({
  args: {
    id: v.id("businessGoals"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    type: v.optional(v.string()),
    period: v.optional(v.string()),
    target: v.optional(v.number()),
    current: v.optional(v.number()),
    unit: v.optional(v.string()),
    progress: v.optional(v.number()),
    status: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    relatedProjectIds: v.optional(v.array(v.id("projects"))),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined) filtered[k] = v;
    }
    const doc = await ctx.db.get(id);
    if (!doc) return;
    filtered.updatedAt = Date.now();
    await ctx.db.patch(id, filtered);
    // XP: strategic goal completion (shared Phase 03 engine, once per goal).
    const nextStatus = (args.status as string | undefined) ?? doc.status;
    if (nextStatus !== doc.status) {
      await handleGoalStatusChange(ctx, doc.userId, {
        table: "businessGoals",
        goalId: id,
        title: (args.title as string | undefined) ?? doc.title,
        prevStatus: doc.status,
        newStatus: nextStatus,
      });
    }
  },
});

export const deleteBusinessGoal = mutation({
  args: { id: v.id("businessGoals") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/* Initiatives                                                         */
/* ================================================================== */

export const listInitiatives = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("initiatives")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const createInitiative = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    status: v.string(),
    goalId: v.optional(v.id("businessGoals")),
    projectId: v.optional(v.id("projects")),
    priority: v.string(),
    dueDate: v.optional(v.string()),
    progress: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("initiatives", {
      userId,
      ...args,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const updateInitiative = mutation({
  args: {
    id: v.id("initiatives"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    goalId: v.optional(v.id("businessGoals")),
    projectId: v.optional(v.id("projects")),
    priority: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    progress: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined) filtered[k] = v;
    }
    filtered.updatedAt = Date.now();
    await ctx.db.patch(id, filtered);
  },
});

export const deleteInitiative = mutation({
  args: { id: v.id("initiatives") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
