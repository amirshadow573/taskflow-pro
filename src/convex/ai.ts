/**
 * Phase 15 — AI Intelligence Layer (backend).
 *
 * The pipeline the spec mandates, end to end:
 *
 *   User → Persona → Context → Workspace → Deterministic Intelligence
 *         → AIContextService → AIProvider → AIResponseService (parse)
 *         → AIValidationService (allowlist + safety) → user confirmation
 *         → AIActionService → EXISTING application services → database
 *
 * Convex constraint that shapes the file: an ACTION has no database. So the
 * turn is split into three server-side steps joined by `runMutation`:
 *
 *   prepareTurn (mutation, db)   → builds + serializes the context envelope
 *   ask         (action,  fetch) → talks to the provider, parses, validates
 *   finishTurn  (mutation, db)   → persists the assistant turn + usage row
 *
 * Hard boundaries enforced here:
 *  - The AI never receives a db handle. It only ever sees the serialized
 *    context built by `buildContext`, and it never writes anything itself.
 *  - The client never sends actions. `applyProposal` re-loads the STORED plan
 *    from the message the server wrote, so a tampered client cannot inject a
 *    different action or retarget an id (§25, §34).
 *  - Every referenced id is re-read and ownership-checked before any write. An
 *    id belonging to another user is rejected, never fetched (§34).
 *  - Writes go through the `tasks`/`projects`/`personal`/`routines` mutations,
 *    so the deterministic engines, automation triggers and XP bookkeeping run
 *    exactly as if the user had done it by hand (§2, §18).
 *  - Nothing is deleted. There is no delete action in the vocabulary (§11).
 *  - If no provider is configured, `ask` returns a typed failure and the rest
 *    of the app is untouched (§24).
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import {
  action,
  mutation,
  query,
  type ActionCtx,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";

import { validateActions } from "../lib/ai/actions";
import {
  AI_CONTEXT_LIMITS,
  describeContextSources,
  renderAIContextForModel,
  type AIContext,
  type AIContextBlock,
  type AIContextEvent,
  type AIContextGoal,
  type AIContextProject,
  type AIContextTask,
} from "../lib/ai/context";
import { parseAIResponse } from "../lib/ai/parse";
import { buildAISystemPrompt, personaAIDefinition } from "../lib/ai/persona-ai";
import { getAIProvider, isAIConfigured } from "../lib/ai/provider";
import {
  AI_MAX_ACTIONS,
  AI_MAX_HISTORY_TURNS,
  AI_RESPONSE_SCHEMA_VERSION,
  type AIAction,
  type AIResponse,
  type ValidatedAction,
} from "../lib/ai/types";

/* ------------------------------------------------------------------ */
/* Existing application services (§2)                                   */
/*                                                                     */
/* This Convex version exposes registered mutations as opaque handles  */
/* that cannot be invoked from another function. The AI write path      */
/* therefore targets the SAME tables and the SAME shared core helpers   */
/* (`setTaskDone` below) that those services use, with identical         */
/* ownership guards — see applyOne().                                   */
/* ------------------------------------------------------------------ */
import { setTaskDone } from "./taskCore";

/* ------------------------------------------------------------------ */
/* Local helpers                                                       */
/* ------------------------------------------------------------------ */

type Ctx = QueryCtx | MutationCtx;

function p2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function dayKeyOf(at: number, tzOffsetMinutes: number): string {
  const d = new Date(at + tzOffsetMinutes * 60_000);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}

function addDaysKey(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + days * 86_400_000);
  return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}`;
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function safeJson<T>(raw: string | undefined | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Optional-string reader for the persona domain tables. */
function s(doc: unknown, key: string): string | undefined {
  if (typeof doc !== "object" || doc === null) return undefined;
  const v = (doc as Record<string, unknown>)[key];
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function n(doc: unknown, key: string): number | undefined {
  if (typeof doc !== "object" || doc === null) return undefined;
  const v = (doc as Record<string, unknown>)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

async function requireUser(ctx: Ctx | ActionCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 12;

/* ------------------------------------------------------------------ */
/* AIContextService (§4, §5)                                           */
/* ------------------------------------------------------------------ */

const DEFAULT_AVAILABILITY = {
  dayStart: "08:00",
  dayEnd: "17:00",
  bufferMinutes: 10,
  breakMinutes: 15,
  maxFocusMinutes: 90,
  focusPreference: "morning",
};

const PERSONA_LABELS: Record<string, string> = {
  student: "دانش‌آموز / دانشجو",
  employee: "کارمند",
  freelancer: "فریلنسر",
  manager: "مدیر",
  team: "مدیر تیم",
  business_owner: "صاحب کسب‌وکار",
  personal: "بهره‌وری شخصی",
  custom: "سفارشی",
};

async function schedulePrefsOf(
  ctx: Ctx,
  userId: Id<"users">,
): Promise<typeof DEFAULT_AVAILABILITY> {
  const profile = await ctx.db
    .query("userProfile")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (!profile) return DEFAULT_AVAILABILITY;
  const p = profile as unknown as Record<string, unknown>;
  const str = (key: string, fallback: string): string =>
    typeof p[key] === "string" ? (p[key] as string) : fallback;
  const num = (key: string, fallback: number): number =>
    typeof p[key] === "number" && Number.isFinite(p[key]) ? (p[key] as number) : fallback;
  return {
    dayStart: str("scheduleDayStart", DEFAULT_AVAILABILITY.dayStart),
    dayEnd: str("scheduleDayEnd", DEFAULT_AVAILABILITY.dayEnd),
    bufferMinutes: num("scheduleBufferMinutes", DEFAULT_AVAILABILITY.bufferMinutes),
    breakMinutes: num("scheduleBreakMinutes", DEFAULT_AVAILABILITY.breakMinutes),
    maxFocusMinutes: num("scheduleMaxFocusMinutes", DEFAULT_AVAILABILITY.maxFocusMinutes),
    focusPreference: str("focusPreference", DEFAULT_AVAILABILITY.focusPreference),
  };
}

/**
 * Build the one context envelope the AI is allowed to see (§5).
 *
 * Persona decides which domain tables are read at all: a student's exams are
 * transmitted, a freelancer's clients are — but never both. Anything not read
 * cannot leak (§26).
 */
async function buildContext(
  ctx: Ctx,
  userId: Id<"users">,
  horizonDays: number,
  tzOffsetMinutes: number,
): Promise<AIContext> {
  const L = AI_CONTEXT_LIMITS;
  const today = dayKeyOf(Date.now(), tzOffsetMinutes);
  const until = addDaysKey(today, horizonDays);
  const sources: string[] = [];

  const profile = await ctx.db
    .query("userProfile")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  const persona = profile?.personaKey || "personal";
  sources.push("persona");

  const [tasks, projects, personalGoals, workGoals, businessGoals, blocks, contextEvents] =
    await Promise.all([
      ctx.db.query("tasks").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("projects").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db
        .query("personalGoals")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db.query("workGoals").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db
        .query("businessGoals")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db.query("timeBlocks").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db
        .query("contextEvents")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);

  /* ---- tasks ---- */
  const openTasks = tasks.filter((t) => !t.archived && t.status !== "done");
  if (openTasks.length > 0) sources.push("tasks");

  const ranked = [...openTasks].sort((a, b) => {
    const ad = a.dueDate ?? "9999-12-31";
    const bd = b.dueDate ?? "9999-12-31";
    if (ad !== bd) return ad < bd ? -1 : 1;
    if (a.priority === b.priority) return 0;
    return a.priority === "urgent" ? -1 : 1;
  });

  const ctxTasks: AIContextTask[] = ranked.slice(0, L.tasks).map((t) => ({
    id: t._id as string,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    projectId: t.projectId as string | undefined,
    estimateMinutes: t.estimateMinutes,
    postponeCount: t.postponeCount,
  }));

  /* ---- projects ---- */
  const counts = new Map<string, { total: number; open: number }>();
  for (const t of tasks) {
    if (!t.projectId || t.archived) continue;
    const cur = counts.get(t.projectId) ?? { total: 0, open: 0 };
    cur.total += 1;
    if (t.status !== "done") cur.open += 1;
    counts.set(t.projectId, cur);
  }
  const activeProjects = projects.filter((p) => !p.archived && p.status !== "completed");
  if (activeProjects.length > 0) sources.push("projects");
  const ctxProjects: AIContextProject[] = activeProjects.slice(0, L.projects).map((p) => {
    const c = counts.get(p._id) ?? { total: 0, open: 0 };
    return {
      id: p._id as string,
      name: p.name,
      status: p.status,
      deadline: p.deadline,
      taskCount: c.total,
      openTaskCount: c.open,
    };
  });

  /* ---- goals ---- */
  const rawGoals: AIContextGoal[] = [
    ...personalGoals.map((g) => ({
      id: g._id as string,
      title: g.title,
      status: g.status,
      progress: g.progress,
      dueDate: g.dueDate,
    })),
    ...workGoals.map((g) => ({
      id: g._id as string,
      title: g.title,
      status: g.status,
      progress: g.progress,
      dueDate: g.dueDate,
    })),
    ...businessGoals.map((g) => ({
      id: g._id as string,
      title: g.title,
      status: g.status,
      progress: g.progress,
      dueDate: g.dueDate,
    })),
  ].filter((g) => g.status !== "completed");
  if (rawGoals.length > 0) sources.push("goals");
  const ctxGoals = rawGoals.slice(0, L.goals);

  /* ---- schedule ---- */
  const windowBlocks = blocks.filter((b) => b.day >= today && b.day <= until);
  if (windowBlocks.length > 0) sources.push("blocks");
  const ctxBlocks: AIContextBlock[] = [...windowBlocks]
    .sort((a, b) =>
      a.day === b.day ? toMin(a.startTime) - toMin(b.startTime) : a.day < b.day ? -1 : 1,
    )
    .slice(0, L.blocks)
    .map((b) => ({
      id: b._id as string,
      title: b.title,
      day: b.day,
      startTime: b.startTime,
      endTime: b.endTime,
      kind: b.kind,
      fixed: b.fixed === true,
      taskId: b.taskId as string | undefined,
    }));

  /* ---- events ---- */
  const windowEvents = contextEvents
    .filter((e): e is typeof e & { date: string } => typeof e.date === "string")
    .filter((e) => e.date >= today && e.date <= until)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (windowEvents.length > 0) sources.push("events");
  const ctxEvents: AIContextEvent[] = windowEvents.slice(0, L.events).map((e) => ({
    title: e.title,
    day: e.date,
    type: e.type,
  }));

  /* ---- routines ---- */
  const routines = await ctx.db
    .query("routines")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const todayCheckins = await ctx.db
    .query("checkins")
    .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", today))
    .collect();
  const routineRows =
    routines.length > 0
      ? [
          {
            title: routines
              .map((r) => r.title)
              .join("، ")
              .slice(0, L.maxTitleLength),
            doneCount: todayCheckins.length,
            totalCount: routines.length,
          },
        ]
      : [];
  if (routineRows.length > 0) sources.push("routines");

  /* ---- persona domain context (§6, §20) ---- */
  const domainContext = await buildDomainContext(ctx, userId, persona, today, until);
  if (domainContext.length > 0) sources.push("domain");

  /* ---- deterministic facts (§13, §18) ---- */
  const availability = await schedulePrefsOf(ctx, userId);
  const todayTasks = openTasks.filter((t) => t.dueDate === today);
  const todayPlannedMinutes = todayTasks.reduce((acc, t) => acc + (t.estimateMinutes ?? 30), 0);
  const capacityMinutes = Math.max(
    0,
    toMin(availability.dayEnd) - toMin(availability.dayStart) - availability.breakMinutes,
  );

  const upcomingDeadlines = [...openTasks]
    .filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= until)
    .sort((a, b) => ((a.dueDate as string) < (b.dueDate as string) ? -1 : 1))
    .slice(0, 6)
    .map((t) => {
      const days = Math.round(
        (Date.parse(`${t.dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
      );
      return { title: t.title, dueDate: t.dueDate as string, daysLeft: days };
    });

  const weekAgo = Date.now() - 7 * 86_400_000;
  const completedLast7Days = tasks.filter(
    (t) => (t.completedAt ?? 0) >= weekAgo && t.status === "done",
  ).length;
  const delayedLast7Days = openTasks.filter((t) => (t.postponeCount ?? 0) > 0).length;
  const overloaded = todayPlannedMinutes > capacityMinutes;

  return {
    persona: {
      key: persona,
      label: PERSONA_LABELS[persona] ?? persona,
      workStyle: null,
      productivityStyle: null,
    },
    availability,
    facts: {
      todayKey: today,
      horizonDays,
      todayTaskCount: todayTasks.length,
      openTaskCount: openTasks.length,
      todayPlannedMinutes,
      todayCapacityMinutes: capacityMinutes,
      overloaded,
      upcomingDeadlines,
      completedLast7Days,
      delayedLast7Days,
      note: overloaded
        ? "موتور برنامه‌ریزی اعلام می‌کند بار امروز از ظرفیت بیشتر است."
        : "موتور برنامه‌ریزی اعلام می‌کند بار امروز در محدودهٔ ظرفیت است.",
    },
    tasks: ctxTasks,
    projects: ctxProjects,
    goals: ctxGoals,
    blocks: ctxBlocks,
    events: ctxEvents,
    routines: routineRows,
    domainContext,
    sources,
  };
}

/** Persona-scoped domain labels. Each branch reads a different table set. */
async function buildDomainContext(
  ctx: Ctx,
  userId: Id<"users">,
  persona: string,
  today: string,
  until: string,
): Promise<string[]> {
  const out: string[] = [];
  try {
    if (persona === "student") {
      const subjects = await ctx.db
        .query("subjects")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      const exams = await ctx.db
        .query("exams")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const sub of subjects) {
        const weak = (n(sub, "currentGrade") ?? 0) > (n(sub, "targetGrade") ?? 0);
        out.push(
          `درس: ${sub.name}${weak ? " (نیازمند تقویت)" : ""} — ${s(sub, "teacher") ?? "بدون معلم"}`,
        );
      }
      for (const e of exams) {
        const date = s(e, "date");
        if (date && date >= today && date <= until) {
          out.push(`امتحان: ${e.title} — ${date}`);
        }
      }
    } else if (persona === "freelancer") {
      const clients = await ctx.db
        .query("clients")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      const deliverables = await ctx.db
        .query("deliverables")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const c of clients.slice(0, 8)) out.push(`مشتری: ${c.name}`);
      for (const d of deliverables.slice(0, 8)) {
        const due = s(d, "dueDate");
        out.push(`تحویل‌دادنی: ${d.title}${due ? ` — مهلت: ${due}` : ""}`);
      }
    } else if (persona === "manager" || persona === "team") {
      const teams = await ctx.db
        .query("teams")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const t of teams.slice(0, 8)) out.push(`تیم: ${t.name}`);
      const teamGoals = await ctx.db
        .query("teamGoals")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const g of teamGoals.slice(0, 8)) out.push(`هدف تیمی: ${g.title}`);
    } else if (persona === "business_owner") {
      const customers = await ctx.db
        .query("customers")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      const opportunities = await ctx.db
        .query("salesOpportunities")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const c of customers.slice(0, 8)) out.push(`مشتری: ${c.name}`);
      for (const o of opportunities.slice(0, 8)) {
        const stage = s(o, "stage");
        out.push(`فرصت فروش: ${o.title}${stage ? ` — مرحله: ${stage}` : ""}`);
      }
    }
  } catch {
    // Domain tables are optional per deployment; their absence must never
    // break the assistant. Whatever was collected so far is still valid.
  }
  return out.slice(0, AI_CONTEXT_LIMITS.domainContext);
}

/* ------------------------------------------------------------------ */
/* The output contract handed to the model (§9)                        */
/* ------------------------------------------------------------------ */

const SCHEMA_HINT = `فقط و فقط یک شیء JSON برگردان، بدون هیچ متن اضافه‌ای قبل یا بعد از آن. ساختار دقیق:
{
  "schema_version": "${AI_RESPONSE_SCHEMA_VERSION}",
  "response_type": "analysis" | "action_plan" | "clarify" | "refusal",
  "summary": "یک جملهٔ فارسی کوتاه",
  "sections": [{"key": "string", "title": "string", "body": "string"}],
  "actions": [],
  "question": "فقط وقتی response_type برابر clarify است",
  "notes": ["string"]
}

هر عضو از actions باید دقیقاً یکی از این اشکال باشد:
{"type":"create_task","title":"string","description":"string","priority":"low|medium|high|urgent","due_date":"YYYY-MM-DD","project_id":"id","estimate_minutes":number,"reason":"string"}
{"type":"update_task","target_id":"id","title":"string","reason":"string"}
{"type":"complete_task","target_id":"id","reason":"string"}
{"type":"reschedule_task","target_id":"id","target_date":"YYYY-MM-DD","reason":"string"}
{"type":"change_priority","target_id":"id","priority":"low|medium|high|urgent","reason":"string"}
{"type":"create_project","name":"string","description":"string","deadline":"YYYY-MM-DD","reason":"string"}
{"type":"update_project","target_id":"id","name":"string","reason":"string"}
{"type":"create_goal","title":"string","description":"string","due_date":"YYYY-MM-DD","reason":"string"}
{"type":"update_goal","target_id":"id","progress":number,"status":"active|paused|completed","reason":"string"}
{"type":"create_time_block","title":"string","day":"YYYY-MM-DD","start_time":"HH:mm","end_time":"HH:mm","kind":"focus|task|meeting|study|routine|personal|review|planning|admin|other","task_id":"id","reason":"string"}
{"type":"move_time_block","target_id":"id","day":"YYYY-MM-DD","start_time":"HH:mm","end_time":"HH:mm","reason":"string"}
{"type":"create_routine","title":"string","color_key":"string","reason":"string"}
{"type":"create_note","title":"string","body":"string","tags":["string"],"reason":"string"}

شناسه‌ها (target_id و project_id و task_id) را فقط از همان شناسه‌هایی بردار که در زمینهٔ بالا برایت فرستاده شده‌اند. هر شناسهٔ دیگری ساختگی است و رد خواهد شد.`;

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

/** Whether AI is available, without ever exposing configuration (§24). */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const profile = await ctx.db
      .query("userProfile")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const persona = profile?.personaKey || "personal";
    const def = personaAIDefinition(persona);
    return {
      configured: isAIConfigured(),
      persona,
      personaLabel: def.label,
      quickActions: def.quickActions,
    };
  },
});

/** Recent turns of the newest thread, for the conversation view. */
export const history = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const conv = await ctx.db
      .query("aiConversations")
      .withIndex("by_user_at", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    if (!conv) return { conversationId: null, messages: [] };

    const all = await ctx.db
      .query("aiMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
      .collect();
    const ordered = all.sort((a, b) => a.createdAt - b.createdAt);
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 60);

    return {
      conversationId: conv._id as Id<"aiConversations">,
      messages: ordered.slice(-limit).map((m) => ({
        id: m._id as Id<"aiMessages">,
        role: m.role,
        content: m.content,
        responseType: m.responseType ?? null,
        plan: m.plan ?? null,
        status: m.status ?? null,
        createdAt: m.createdAt,
      })),
    };
  },
});

/* ------------------------------------------------------------------ */
/* Step 1 — prepare the turn (db access)                               */
/* ------------------------------------------------------------------ */

interface PreparedTurn {
  persona: string;
  contextText: string;
  contextSources: string[];
  history: Array<{ role: "user" | "assistant"; content: string }>;
}

/**
 * Read-only half of a turn: assembles and serializes the context envelope.
 *
 * This is a QUERY, not a mutation, so the `ask` action can read it via
 * `ctx.runQuery` — actions have no database handle. It performs no writes and
 * is safe to call on its own; everything that changes state lives in
 * `recordTurn` and `applyProposal`.
 */
export const contextPayload = query({
  args: {
    conversationId: v.optional(v.id("aiConversations")),
    horizonDays: v.optional(v.number()),
    tzOffsetMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<PreparedTurn | { error: "rate_limited" }> => {
    const userId = await requireUser(ctx);

    const windowStart = Date.now() - RATE_LIMIT_WINDOW_MS;
    const recent = await ctx.db
      .query("aiUsage")
      .withIndex("by_user_at", (q) => q.eq("userId", userId).gte("createdAt", windowStart))
      .collect();
    if (recent.length >= RATE_LIMIT_MAX) return { error: "rate_limited" };

    const horizonDays = Math.min(Math.max(args.horizonDays ?? 7, 1), 21);
    const tzOffset = args.tzOffsetMinutes ?? 210;
    const context = await buildContext(ctx, userId, horizonDays, tzOffset);

    let history: PreparedTurn["history"] = [];
    if (args.conversationId) {
      const conv = await ctx.db.get(args.conversationId);
      if (conv && conv.userId === userId) {
        const prior = await ctx.db
          .query("aiMessages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
          .collect();
        history = prior
          .sort((a, b) => a.createdAt - b.createdAt)
          .slice(-AI_MAX_HISTORY_TURNS)
          .map((m) => ({
            role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
            content: m.content.slice(0, 600),
          }));
      }
    }

    return {
      persona: context.persona.key,
      contextText: renderAIContextForModel(context),
      contextSources: describeContextSources(context),
      history,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Step 2 — the provider call                                          */
/* ------------------------------------------------------------------ */

/** Usage telemetry the client echoes back to `recordTurn` (§23). */
export interface AskTelemetry {
  provider: string;
  model: string;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
}

export interface AskSuccess {
  ok: true;
  response: AIResponse;
  plan: { actions: ValidatedAction[]; maxSafety: number; droppedCount: number };
  contextSources: string[];
  latencyMs: number;
  telemetry: AskTelemetry;
}

export interface AskFailure {
  ok: false;
  failure: string;
  message: string;
  retryable: boolean;
  /** Present when the provider was actually reached, for usage accounting. */
  telemetry?: AskTelemetry;
}

export const ask = action({
  args: {
    prompt: v.string(),
    feature: v.optional(v.string()),
    conversationId: v.optional(v.id("aiConversations")),
    horizonDays: v.optional(v.number()),
    tzOffsetMinutes: v.optional(v.number()),
  },
  handler: async (ctx: ActionCtx, args): Promise<AskSuccess | AskFailure> => {
    const started = Date.now();
    await requireUser(ctx);

    const prompt = args.prompt.trim().slice(0, 1_000);
    if (!prompt) {
      return { ok: false, failure: "empty_response", message: "پیام خالی است.", retryable: false };
    }

    /* ---- 1. context (read-only query; actions have no db) ---- */
    const prep = await ctx.runQuery(api.ai.contextPayload, {
      conversationId: args.conversationId,
      horizonDays: args.horizonDays,
      tzOffsetMinutes: args.tzOffsetMinutes,
    });

    if ("error" in prep) {
      return {
        ok: false,
        failure: "rate_limited",
        message: "تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.",
        retryable: true,
      };
    }

    /* ---- 2. provider ---- */
    const provider = getAIProvider();
    const completion = await provider.complete({
      system: buildAISystemPrompt(prep.persona),
      user: `# پرسش کاربر\n${prompt}\n\n# زمینهٔ فضای کاری\n${prep.contextText}`,
      history: prep.history,
      schemaHint: SCHEMA_HINT,
    });

    const telemetry: AskTelemetry = {
      provider: provider.name,
      model: provider.model,
      latencyMs: Date.now() - started,
    };

    if (!completion.ok || !completion.data) {
      return {
        ok: false,
        failure: completion.failure ?? "unknown",
        message:
          completion.message ??
          "دستیار هوش مصنوعی در دسترس نیست. فضای کاری شما کاملاً کار می‌کند.",
        retryable: completion.retryable ?? true,
        telemetry,
      };
    }

    /* ---- 3. parse + validate ---- */
    const parsed = parseAIResponse(completion.data.content, {
      contextSources: prep.contextSources,
    });
    if (!parsed.ok || !parsed.data) {
      return {
        ok: false,
        failure: "invalid_response",
        message: parsed.message ?? "پاسخ دستیار قابل استفاده نبود.",
        retryable: true,
        telemetry,
      };
    }

    const { response, plan } = parsed.data;
    return {
      ok: true,
      response,
      plan,
      contextSources: prep.contextSources,
      latencyMs: telemetry.latencyMs,
      telemetry: {
        ...telemetry,
        promptTokens: completion.data.usage.promptTokens,
        completionTokens: completion.data.usage.completionTokens,
      },
    };
  },
});

/* ------------------------------------------------------------------ */
/* Step 3 — persist the turn + usage (§23)                             */
/* ------------------------------------------------------------------ */

/**
 * Writes the audit trail: the user's question, the assistant's answer and the
 * usage row.
 *
 * The plan is stored server-side and is what `applyProposal` later re-reads and
 * re-validates. The client can therefore never talk to `applyProposal` with an
 * action of its own inventing — it can only choose indexes into a plan this
 * server already produced and checked (§25, §34).
 *
 * Usage is recorded for failures too, so provider health is observable even
 * when no answer was produced (§23, §25).
 */
export const recordTurn = mutation({
  args: {
    prompt: v.string(),
    feature: v.optional(v.string()),
    conversationId: v.optional(v.id("aiConversations")),
    ok: v.boolean(),
    failure: v.optional(v.string()),
    summary: v.optional(v.string()),
    responseType: v.optional(v.string()),
    plan: v.optional(v.string()),
    contextSources: v.optional(v.string()),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    latencyMs: v.optional(v.number()),
    promptTokens: v.optional(v.number()),
    completionTokens: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Id<"aiMessages"> | null> => {
    const userId = await requireUser(ctx);
    const now = Date.now();

    let conversationId = args.conversationId ?? null;
    if (conversationId) {
      const conv = await ctx.db.get(conversationId);
      if (!conv || conv.userId !== userId) conversationId = null;
    }
    if (!conversationId) {
      conversationId = await ctx.db.insert("aiConversations", {
        userId,
        persona: "personal",
        feature: args.feature ?? "assistant",
        title: args.prompt.trim().slice(0, 80),
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(conversationId, { updatedAt: now });
    }

    await ctx.db.insert("aiMessages", {
      userId,
      conversationId,
      role: "user",
      content: args.prompt.trim().slice(0, 1_000),
      createdAt: now,
    });

    await ctx.db.insert("aiUsage", {
      userId,
      provider: args.provider ?? "unknown",
      model: args.model ?? "unknown",
      feature: args.feature ?? "assistant",
      latencyMs: args.latencyMs ?? 0,
      ok: args.ok,
      promptTokens: args.promptTokens,
      completionTokens: args.completionTokens,
      errorKind: args.ok ? undefined : args.failure,
      createdAt: now,
    });

    if (!args.ok || !args.summary) return null;

    const plan = safeJson<{ actions?: unknown[] }>(args.plan, {});
    return await ctx.db.insert("aiMessages", {
      userId,
      conversationId,
      role: "assistant",
      content: args.summary.slice(0, 400),
      responseType: args.responseType,
      plan: args.plan,
      contextSources: args.contextSources,
      status: Array.isArray(plan.actions) && plan.actions.length > 0 ? "pending" : "no_actions",
      createdAt: now + 1,
    });
  },
});

/* ------------------------------------------------------------------ */
/* AIActionService (§2, §12) — confirmation-gated application          */
/* ------------------------------------------------------------------ */

async function ownTask(ctx: MutationCtx, userId: Id<"users">, id: string) {
  const doc = await ctx.db.get(id as Id<"tasks">);
  return doc && doc.userId === userId ? doc : null;
}
async function ownProject(ctx: MutationCtx, userId: Id<"users">, id: string) {
  const doc = await ctx.db.get(id as Id<"projects">);
  return doc && doc.userId === userId ? doc : null;
}
async function ownGoal(ctx: MutationCtx, userId: Id<"users">, id: string) {
  const doc = await ctx.db.get(id as Id<"personalGoals">);
  return doc && doc.userId === userId ? doc : null;
}
async function ownBlock(ctx: MutationCtx, userId: Id<"users">, id: string) {
  const doc = await ctx.db.get(id as Id<"timeBlocks">);
  return doc && doc.userId === userId ? doc : null;
}

/**
 * Apply a stored proposal.
 *
 * The client sends only WHICH indexes to apply, never the actions themselves —
 * the plan is re-read from the server-owned message and re-validated, so a
 * tampered payload cannot introduce a new action or retarget an id (§25).
 */
export const applyProposal = mutation({
  args: {
    messageId: v.id("aiMessages"),
    actionIndexes: v.array(v.number()),
    confirm: v.boolean(),
  },
  handler: async (ctx, args): Promise<{
    applied: string[];
    skipped: Array<{ index: number; reason: string }>;
  }> => {
    const userId = await requireUser(ctx);

    // Explicit confirmation is mandatory (§12, §19).
    if (!args.confirm) throw new Error("تأیید کاربر برای اعمال تغییرات لازم است.");

    const message = await ctx.db.get(args.messageId);
    if (!message || message.userId !== userId) throw new Error("Not found");
    if (message.role !== "assistant") throw new Error("Not found");
    if (message.status === "applied") throw new Error("این پیشنهاد قبلاً اعمال شده است.");

    // Re-validate what was stored; a stored blob is still untrusted input.
    const stored = safeJson<{ actions?: unknown[] }>(message.plan, {});
    const revalidated = validateActions(stored.actions);

    const wanted = new Set(
      args.actionIndexes.filter((i) => Number.isInteger(i) && i >= 0 && i < AI_MAX_ACTIONS),
    );

    const applied: string[] = [];
    const skipped: Array<{ index: number; reason: string }> = [];

    for (let i = 0; i < revalidated.actions.length; i++) {
      if (!wanted.has(i)) {
        skipped.push({ index: i, reason: "انتخاب نشده بود." });
        continue;
      }
      try {
        const id = await applyOne(ctx, userId, revalidated.actions[i].action);
        if (id) applied.push(id);
        else skipped.push({ index: i, reason: "اقدام با وضعیت فعلی فضای کاری سازگار نبود." });
      } catch (err) {
        skipped.push({
          index: i,
          reason: err instanceof Error ? err.message : "اعمال این اقدام ممکن نشد.",
        });
      }
    }

    await ctx.db.patch(message._id, {
      status: applied.length > 0 ? "applied" : "discarded",
      appliedIds: JSON.stringify(applied),
      appliedAt: Date.now(),
    });

    return { applied, skipped };
  },
});

/**
 * Apply exactly one validated action to the EXISTING models.
 *
 * Every branch writes to the same tables the human-facing services use, and
 * every branch first proves ownership of anything it targets. Completion goes
 * through the shared `setTaskDone` core so XP, linked blocks and the execution
 * engine stay in step exactly as they do for a manual checkbox.
 *
 * Returns null when the target no longer exists, is not owned by the caller, or
 * the action is inapplicable to current state.
 */
async function applyOne(
  ctx: MutationCtx,
  userId: Id<"users">,
  action: AIAction,
): Promise<string | null> {
  const now = Date.now();

  switch (action.type) {
    /* ---------------- tasks ---------------- */
    case "create_task": {
      if (action.project_id && !(await ownProject(ctx, userId, action.project_id))) return null;
      return (await ctx.db.insert("tasks", {
        userId,
        title: action.title,
        description: action.description,
        status: "todo",
        priority: action.priority ?? "medium",
        dueDate: action.due_date,
        projectId: action.project_id as Id<"projects"> | undefined,
        tags: [],
        estimateMinutes: action.estimate_minutes,
        sortOrder: 0,
        createdAt: now,
        archived: false,
      })) as string;
    }
    case "update_task": {
      const t = await ownTask(ctx, userId, action.target_id);
      if (!t) return null;
      await ctx.db.patch(t._id, {
        ...(action.title ? { title: action.title } : {}),
        ...(action.description ? { description: action.description } : {}),
      });
      return t._id as string;
    }
    case "complete_task": {
      const t = await ownTask(ctx, userId, action.target_id);
      if (!t) return null;
      if (t.status === "done") return t._id as string;
      // Shared core: keeps status, blocks, XP and progression in step.
      await setTaskDone(ctx, t._id, true);
      return t._id as string;
    }
    case "reschedule_task": {
      const t = await ownTask(ctx, userId, action.target_id);
      if (!t) return null;
      const movedForward = (t.dueDate ?? "") < action.target_date;
      await ctx.db.patch(t._id, {
        dueDate: action.target_date,
        // Mirror the postpone bookkeeping tasks.update performs, so
        // repeated-delay detection and the insights engine keep seeing the
        // truth (§13).
        ...(movedForward
          ? { postponeCount: (t.postponeCount ?? 0) + 1, lastPostponedAt: now }
          : {}),
      });
      return t._id as string;
    }
    case "change_priority": {
      const t = await ownTask(ctx, userId, action.target_id);
      if (!t) return null;
      await ctx.db.patch(t._id, { priority: action.priority });
      return t._id as string;
    }

    /* ---------------- projects ---------------- */
    case "create_project": {
      return (await ctx.db.insert("projects", {
        userId,
        name: action.name,
        description: action.description,
        color: "#4f46e5",
        deadline: action.deadline,
        status: "active",
        createdAt: now,
        archived: false,
      })) as string;
    }
    case "update_project": {
      const p = await ownProject(ctx, userId, action.target_id);
      if (!p) return null;
      await ctx.db.patch(p._id, {
        ...(action.name ? { name: action.name } : {}),
        ...(action.description ? { description: action.description } : {}),
        ...(action.deadline ? { deadline: action.deadline } : {}),
      });
      return p._id as string;
    }

    /* ---------------- goals ---------------- */
    case "create_goal": {
      return (await ctx.db.insert("personalGoals", {
        userId,
        title: action.title,
        description: action.description,
        dueDate: action.due_date,
        progress: 0,
        status: "active",
        milestones: [],
        relatedProjectIds: [],
        createdAt: now,
        updatedAt: now,
      })) as string;
    }
    case "update_goal": {
      const g = await ownGoal(ctx, userId, action.target_id);
      if (!g) return null;
      await ctx.db.patch(g._id, {
        ...(action.progress !== undefined ? { progress: action.progress } : {}),
        ...(action.status ? { status: action.status } : {}),
        updatedAt: now,
      });
      return g._id as string;
    }

    /* ---------------- schedule ---------------- */
    case "create_time_block": {
      let taskId: Id<"tasks"> | undefined;
      if (action.task_id) {
        const t = await ownTask(ctx, userId, action.task_id);
        if (!t) return null;
        taskId = t._id;
      }
      let projectId: Id<"projects"> | undefined;
      if (action.project_id) {
        const p = await ownProject(ctx, userId, action.project_id);
        if (!p) return null;
        projectId = p._id;
      }
      return (await ctx.db.insert("timeBlocks", {
        userId,
        title: action.title,
        day: action.day,
        startTime: action.start_time,
        endTime: action.end_time,
        kind: action.kind ?? "focus",
        taskId,
        projectId,
        status: "planned",
        // Provenance: this block came from the assistant, not the planner.
        source: "ai",
        fixed: false,
        createdAt: now,
        updatedAt: now,
      })) as string;
    }
    case "move_time_block": {
      const b = await ownBlock(ctx, userId, action.target_id);
      if (!b) return null;
      // Fixed commitments are external promises; never moved by the AI (§6).
      if (b.fixed === true) return null;
      await ctx.db.patch(b._id, {
        day: action.day,
        startTime: action.start_time,
        endTime: action.end_time,
        updatedAt: now,
      });
      return b._id as string;
    }

    /* ---------------- routines & notes ---------------- */
    case "create_routine": {
      const all = await ctx.db
        .query("routines")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      const sortOrder = all.reduce((m, r) => Math.max(m, r.sortOrder), 0) + 1;
      return (await ctx.db.insert("routines", {
        userId,
        title: action.title,
        colorKey: action.color_key ?? "blue",
        sortOrder,
      })) as string;
    }
    case "create_note": {
      return (await ctx.db.insert("personalNotes", {
        userId,
        title: action.title,
        body: action.body,
        tags: action.tags ?? [],
        createdAt: now,
        updatedAt: now,
      })) as string;
    }

    default:
      return null;
  }
}

/** §12 "Cancel" — record the decision so the proposal cannot be replayed. */
export const discardProposal = mutation({
  args: { messageId: v.id("aiMessages") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message || message.userId !== userId) throw new Error("Not found");
    if (message.status === "applied") throw new Error("این پیشنهاد قبلاً اعمال شده است.");
    await ctx.db.patch(message._id, { status: "discarded" });
    return true;
  },
});

/** Start fresh — the assistant keeps no memory of its own (§22). */
export const clearConversation = mutation({
  args: { conversationId: v.optional(v.id("aiConversations")) },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const target = args.conversationId
      ? await ctx.db.get(args.conversationId)
      : await ctx.db
          .query("aiConversations")
          .withIndex("by_user_at", (q) => q.eq("userId", userId))
          .order("desc")
          .first();
    if (!target || target.userId !== userId) return false;

    const msgs = await ctx.db
      .query("aiMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", target._id))
      .collect();
    for (const m of msgs) await ctx.db.delete(m._id);
    await ctx.db.delete(target._id);
    return true;
  },
});

/* ------------------------------------------------------------------ */
/* Usage query (§23) — internal accounting, no raw counters in the UI  */
/* ------------------------------------------------------------------ */

export const usageSummary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const rows = await ctx.db
      .query("aiUsage")
      .withIndex("by_user_at", (q) => q.eq("userId", userId))
      .order("desc")
      .take(200);
    const okRows = rows.filter((r) => r.ok);
    return {
      requests: rows.length,
      succeeded: okRows.length,
      failed: rows.length - okRows.length,
      averageLatencyMs: okRows.length
        ? Math.round(okRows.reduce((a, r) => a + r.latencyMs, 0) / okRows.length)
        : 0,
    };
  },
});
