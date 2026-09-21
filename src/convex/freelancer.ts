import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/* ================================================================== */
/*  CLIENTS                                                            */
/* ================================================================== */

export const listClients = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db.query("clients").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  },
});

export const createClient = mutation({
  args: { name: v.string(), company: v.optional(v.string()), email: v.optional(v.string()), phone: v.optional(v.string()), color: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("clients", { userId, name: args.name, company: args.company, email: args.email, phone: args.phone, color: args.color, archived: false, createdAt: Date.now() });
  },
});

export const updateClient = mutation({
  args: { id: v.id("clients"), name: v.optional(v.string()), company: v.optional(v.string()), email: v.optional(v.string()), phone: v.optional(v.string()), color: v.optional(v.string()) },
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

export const deleteClient = mutation({
  args: { id: v.id("clients") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/*  INVOICES                                                           */
/* ================================================================== */

export const listInvoices = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db.query("invoices").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  },
});

export const createInvoice = mutation({
  args: { clientId: v.id("clients"), projectId: v.optional(v.id("projects")), title: v.string(), amount: v.number(), currency: v.string(), status: v.string(), dueDate: v.string(), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("invoices", { userId, clientId: args.clientId, projectId: args.projectId, title: args.title, amount: args.amount, currency: args.currency, status: args.status, dueDate: args.dueDate, paidAt: undefined, items: undefined, notes: args.notes, createdAt: Date.now() });
  },
});

export const updateInvoice = mutation({
  args: { id: v.id("invoices"), status: v.optional(v.string()), paidAt: v.optional(v.number()), notes: v.optional(v.string()) },
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

export const deleteInvoice = mutation({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/*  TIME ENTRIES                                                       */
/* ================================================================== */

export const listTimeEntries = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db.query("timeEntries").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  },
});

export const createTimeEntry = mutation({
  args: { clientId: v.optional(v.id("clients")), projectId: v.optional(v.id("projects")), description: v.optional(v.string()), startTime: v.number(), endTime: v.optional(v.number()), duration: v.number(), billable: v.boolean(), hourlyRate: v.optional(v.number()), date: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("timeEntries", { userId, clientId: args.clientId, projectId: args.projectId, description: args.description, startTime: args.startTime, endTime: args.endTime, duration: args.duration, billable: args.billable, hourlyRate: args.hourlyRate, date: args.date, createdAt: Date.now() });
  },
});

export const updateTimeEntry = mutation({
  args: { id: v.id("timeEntries"), endTime: v.optional(v.number()), duration: v.optional(v.number()), description: v.optional(v.string()) },
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

export const deleteTimeEntry = mutation({
  args: { id: v.id("timeEntries") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/*  DELIVERABLES                                                       */
/* ================================================================== */

export const listDeliverables = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db.query("deliverables").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  },
});

export const createDeliverable = mutation({
  args: { clientId: v.id("clients"), projectId: v.optional(v.id("projects")), title: v.string(), description: v.optional(v.string()), dueDate: v.string(), priority: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("deliverables", { userId, clientId: args.clientId, projectId: args.projectId, title: args.title, description: args.description, dueDate: args.dueDate, status: "pending", priority: args.priority, completedAt: undefined, createdAt: Date.now() });
  },
});

export const updateDeliverable = mutation({
  args: { id: v.id("deliverables"), status: v.optional(v.string()), priority: v.optional(v.string()), dueDate: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    const patch: Record<string, unknown> = {};
    for (const [k, v_] of Object.entries(args)) { if (k !== "id" && v_ !== undefined) patch[k] = v_; }
    if (args.status === "approved" || args.status === "delivered") patch.completedAt = Date.now();
    await ctx.db.patch(args.id, patch);
  },
});

export const deleteDeliverable = mutation({
  args: { id: v.id("deliverables") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/*  PROPOSALS                                                          */
/* ================================================================== */

export const listProposals = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db.query("proposals").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  },
});

export const createProposal = mutation({
  args: { clientId: v.id("clients"), title: v.string(), description: v.optional(v.string()), amount: v.number(), currency: v.string(), validUntil: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("proposals", { userId, clientId: args.clientId, title: args.title, description: args.description, amount: args.amount, currency: args.currency, status: "draft", validUntil: args.validUntil, createdAt: Date.now() });
  },
});

export const updateProposal = mutation({
  args: { id: v.id("proposals"), status: v.optional(v.string()), amount: v.optional(v.number()) },
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

export const deleteProposal = mutation({
  args: { id: v.id("proposals") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});
