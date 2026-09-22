import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/* ================================================================== */
/*  EnvironmentService                                                 */
/* ================================================================== */

export const listEnvironments = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const envs = await ctx.db
      .query("environments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const memberships = await ctx.db
      .query("environmentMemberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return envs.map((e) => {
      const m = memberships.find((x) => x.environmentId === e._id && x.status === "active");
      return {
        ...e,
        role: m?.role ?? "member",
        membershipLabel: m?.label ?? null,
        membershipId: m?._id ?? null,
      };
    });
  },
});

export const createEnvironment = mutation({
  args: {
    name: v.string(),
    type: v.string(),
    description: v.optional(v.string()),
    website: v.optional(v.string()),
    timezone: v.optional(v.string()),
    schedule: v.array(v.number()),
    role: v.string(),
    membershipLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const now = Date.now();
    const environmentId = await ctx.db.insert("environments", {
      userId,
      name: args.name,
      type: args.type,
      description: args.description,
      website: args.website,
      timezone: args.timezone,
      schedule: args.schedule,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("environmentMemberships", {
      userId,
      environmentId,
      role: args.role,
      label: args.membershipLabel,
      status: "active",
      createdAt: now,
    });
    return environmentId;
  },
});

export const updateEnvironment = mutation({
  args: {
    id: v.id("environments"),
    name: v.optional(v.string()),
    type: v.optional(v.string()),
    description: v.optional(v.string()),
    website: v.optional(v.string()),
    timezone: v.optional(v.string()),
    schedule: v.optional(v.array(v.number())),
    role: v.optional(v.string()),
    membershipLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    const { id, role, membershipLabel, ...envPatch } = args;
    await ctx.db.patch(id, { ...envPatch, updatedAt: Date.now() });
    if (role !== undefined || membershipLabel !== undefined) {
      const membership = await ctx.db
        .query("environmentMemberships")
        .withIndex("by_user_env", (q) => q.eq("userId", userId).eq("environmentId", id))
        .first();
      if (membership) {
        await ctx.db.patch(membership._id, {
          ...(role !== undefined ? { role } : {}),
          ...(membershipLabel !== undefined ? { label: membershipLabel } : {}),
        });
      }
    }
  },
});

export const deleteEnvironment = mutation({
  args: { id: v.id("environments") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    // Cascade: membership, attributes, events, sources tied to this environment.
    const [memberships, attrs, events, sources] = await Promise.all([
      ctx.db.query("environmentMemberships").withIndex("by_user_env", (q) => q.eq("userId", userId).eq("environmentId", args.id)).collect(),
      ctx.db.query("contextAttributes").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("contextEvents").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("contextSources").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ]);
    for (const m of memberships) await ctx.db.delete(m._id);
    for (const a of attrs) if (a.environmentId === args.id) await ctx.db.delete(a._id);
    for (const e of events) if (e.environmentId === args.id) await ctx.db.delete(e._id);
    for (const s of sources) if (s.environmentId === args.id) await ctx.db.delete(s._id);
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/*  ContextService — attributes with provenance                        */
/* ================================================================== */

export const listAttributes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("contextAttributes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

/**
 * Set a context attribute. Values provided by the user are marked
 * user_provided / known; callers may pass other origins for discovered data.
 */
export const setAttribute = mutation({
  args: {
    key: v.string(),
    value: v.string(),
    environmentId: v.optional(v.id("environments")),
    origin: v.optional(v.string()),
    confidence: v.optional(v.string()),
    sourceId: v.optional(v.id("contextSources")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const origin = args.origin ?? "user_provided";
    const confidence = args.confidence ?? "known";
    const now = Date.now();
    const existing = await ctx.db
      .query("contextAttributes")
      .withIndex("by_user_key", (q) => q.eq("userId", userId).eq("key", args.key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        environmentId: args.environmentId,
        origin,
        confidence,
        // User-entered values are implicitly confirmed.
        userConfirmed: origin === "user_provided",
        sourceId: args.sourceId,
        lastUpdated: now,
      });
      return existing._id;
    }
    return ctx.db.insert("contextAttributes", {
      userId,
      environmentId: args.environmentId,
      key: args.key,
      value: args.value,
      origin,
      confidence,
      userConfirmed: origin === "user_provided",
      sourceId: args.sourceId,
      lastUpdated: now,
      createdAt: now,
    });
  },
});

/** User confirms (or marks incorrect) an inferred/discovered attribute. */
export const resolveAttribute = mutation({
  args: { id: v.id("contextAttributes"), confirmed: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    if (args.confirmed) {
      await ctx.db.patch(args.id, { userConfirmed: true, confidence: "known", lastUpdated: Date.now() });
    } else {
      // User says it's wrong — remove rather than keep bad data around.
      await ctx.db.delete(args.id);
    }
  },
});

export const deleteAttribute = mutation({
  args: { id: v.id("contextAttributes") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/*  ContextEventService — contextual calendar events                   */
/* ================================================================== */

export const listEvents = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("contextEvents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const createContextEvent = mutation({
  args: {
    title: v.string(),
    type: v.string(),
    environmentId: v.optional(v.id("environments")),
    date: v.optional(v.string()),
    weekdays: v.array(v.number()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    origin: v.optional(v.string()),
    sourceId: v.optional(v.id("contextSources")),
    confidence: v.optional(v.string()),
    userConfirmed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    if (!args.date && args.weekdays.length === 0) {
      throw new Error("An event needs either a date or recurrence weekdays");
    }
    return ctx.db.insert("contextEvents", {
      userId,
      environmentId: args.environmentId,
      title: args.title,
      type: args.type,
      date: args.date,
      weekdays: args.weekdays,
      startTime: args.startTime,
      endTime: args.endTime,
      origin: args.origin ?? "user",
      sourceId: args.sourceId,
      confidence: args.confidence ?? "known",
      userConfirmed: args.userConfirmed ?? true,
      createdAt: Date.now(),
    });
  },
});

export const updateContextEvent = mutation({
  args: {
    id: v.id("contextEvents"),
    title: v.optional(v.string()),
    type: v.optional(v.string()),
    date: v.optional(v.string()),
    weekdays: v.optional(v.array(v.number())),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    userConfirmed: v.optional(v.boolean()),
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

export const deleteContextEvent = mutation({
  args: { id: v.id("contextEvents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});

/**
 * Events relevant to a single day — expands weekly recurrence.
 * Used by Calendar and Today without blocking the dashboard.
 */
export const eventsOnDay = query({
  args: { day: v.string() },
  handler: async (ctx, { day }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("contextEvents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const weekday = new Date(`${day}T00:00:00`).getDay();
    return rows.filter(
      (e) => e.date === day || (e.date === undefined && e.weekdays.includes(weekday)),
    );
  },
});

/** One-off context events in a date range (YYYY-MM-DD start/end) for month grids. */
export const eventsInRange = query({
  args: { start: v.string(), end: v.string() },
  handler: async (ctx, { start, end }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("contextEvents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.filter(
      (e) =>
        (e.date !== undefined && e.date >= start && e.date <= end) ||
        e.date === undefined, // recurring events are expanded client-side
    );
  },
});

/** Next N upcoming contextual events (recurring ones projected forward). */
export const upcomingEvents = query({
  args: { from: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { from, limit }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("contextEvents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const out: (typeof rows)[number][] = [];
    for (let i = 0; i < 30 && out.length < (limit ?? 5); i++) {
      const d = new Date(`${from}T00:00:00`);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      for (const e of rows) {
        if (out.length >= (limit ?? 5)) break;
        if (e.date === key || (e.date === undefined && e.weekdays.includes(d.getDay()))) {
          out.push({ ...e, date: key });
        }
      }
    }
    return out;
  },
});

/* ================================================================== */
/*  SourceService — provenance registry (references only)              */
/* ================================================================== */

export const listSources = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("contextSources")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const addSource = mutation({
  args: {
    name: v.string(),
    sourceType: v.string(),
    url: v.optional(v.string()),
    environmentId: v.optional(v.id("environments")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("contextSources", {
      userId,
      environmentId: args.environmentId,
      name: args.name,
      sourceType: args.sourceType,
      url: args.url,
      lastChecked: undefined,
      status: "active",
      createdAt: Date.now(),
    });
  },
});

export const touchSource = mutation({
  args: { id: v.id("contextSources"), status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(args.id, {
      lastChecked: Date.now(),
      ...(args.status ? { status: args.status } : {}),
    });
  },
});

export const removeSource = mutation({
  args: { id: v.id("contextSources") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});

/* ================================================================== */
/*  ContextConfirmation — nothing auto-applied                         */
/* ================================================================== */

export const listConfirmations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("contextConfirmations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    return rows;
  },
});

export const proposeConfirmation = mutation({
  args: { kind: v.string(), payload: v.string(), confidence: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return ctx.db.insert("contextConfirmations", {
      userId,
      kind: args.kind,
      payload: args.payload,
      confidence: args.confidence ?? "inferred",
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

/**
 * Accept a pending confirmation — materializes the payload into the
 * corresponding entity (environment | event | attribute). Dismiss removes it.
 */
export const resolveConfirmation = mutation({
  args: { id: v.id("contextConfirmations"), accepted: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== userId) throw new Error("Not found");

    if (!args.accepted) {
      await ctx.db.patch(args.id, { status: "dismissed" });
      return;
    }

    const payload = JSON.parse(doc.payload) as Record<string, unknown>;
    const now = Date.now();

    if (doc.kind === "environment") {
      const environmentId = await ctx.db.insert("environments", {
        userId,
        name: String(payload.name ?? "محیط جدید"),
        type: String(payload.type ?? "other"),
        description: payload.description ? String(payload.description) : undefined,
        website: payload.website ? String(payload.website) : undefined,
        schedule: Array.isArray(payload.schedule) ? (payload.schedule as number[]) : [],
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("environmentMemberships", {
        userId,
        environmentId,
        role: String(payload.role ?? "member"),
        label: payload.label ? String(payload.label) : undefined,
        status: "active",
        createdAt: now,
      });
    } else if (doc.kind === "event") {
      await ctx.db.insert("contextEvents", {
        userId,
        environmentId: payload.environmentId
          ? (payload.environmentId as Id<"environments">)
          : undefined,
        title: String(payload.title ?? "رویداد"),
        type: String(payload.type ?? "event"),
        date: payload.date ? String(payload.date) : undefined,
        weekdays: Array.isArray(payload.weekdays) ? (payload.weekdays as number[]) : [],
        startTime: payload.startTime ? String(payload.startTime) : undefined,
        endTime: payload.endTime ? String(payload.endTime) : undefined,
        origin: "environment",
        confidence: "inferred",
        userConfirmed: true, // accepted by the user in this very action
        createdAt: now,
      });
    } else if (doc.kind === "attribute") {
      await ctx.db.insert("contextAttributes", {
        userId,
        environmentId: payload.environmentId
          ? (payload.environmentId as Id<"environments">)
          : undefined,
        key: String(payload.key ?? "context"),
        value: String(payload.value ?? ""),
        origin: "discovered",
        confidence: "known",
        userConfirmed: true,
        lastUpdated: now,
        createdAt: now,
      });
    }

    await ctx.db.patch(args.id, { status: "accepted" });
  },
});

/* ================================================================== */
/*  ContextResolutionService — one round trip for the workspace        */
/* ================================================================== */

/**
 * Everything the workspace needs to feel "understanding" in one query:
 * primary environment, membership, key attributes, upcoming contextual
 * events, and pending confirmations. Non-blocking for callers — the UI
 * renders skeletons while this loads and works fine when it's empty.
 */
export const workspaceContext = query({
  args: { from: v.string() },
  handler: async (ctx, { from }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { environment: null, attributes: [], upcoming: [], pending: 0 };
    }
    const [envs, attrs, events, pending] = await Promise.all([
      listEnvironmentsInternal(ctx, userId),
      ctx.db.query("contextAttributes").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("contextEvents").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db
        .query("contextConfirmations")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("status"), "pending"))
        .collect(),
    ]);

    const primary = envs[0] ?? null;

    // Project upcoming events over the next 30 days.
    const upcoming: { title: string; type: string; date: string; startTime?: string; environmentName?: string }[] = [];
    for (let i = 0; i < 30 && upcoming.length < 5; i++) {
      const d = new Date(`${from}T00:00:00`);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      for (const e of events) {
        if (upcoming.length >= 5) break;
        if (e.date === key || (e.date === undefined && e.weekdays.includes(d.getDay()))) {
          upcoming.push({
            title: e.title,
            type: e.type,
            date: key,
            startTime: e.startTime,
            environmentName: envs.find((x) => x._id === e.environmentId)?.name,
          });
        }
      }
    }

    return {
      environment: primary,
      attributes: attrs.filter((a) => a.userConfirmed || a.origin === "user_provided"),
      upcoming,
      pending: pending.length,
    };
  },
});

async function listEnvironmentsInternal(ctx: QueryCtx, userId: Id<"users">) {
  const envs = await ctx.db
    .query("environments")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const memberships = await ctx.db
    .query("environmentMemberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return envs.map((e) => {
    const m = memberships.find((x) => x.environmentId === e._id && x.status === "active");
    return { ...e, role: m?.role ?? "member", membershipLabel: m?.label ?? null };
  });
}
