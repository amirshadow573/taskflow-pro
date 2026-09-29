/**
 * Phase 16 — AI Insights backend.
 *
 * The whole point of this file is one sentence: AI never decides what is true.
 *
 *   Workspace data
 *     → aggregateInsightContext()   deterministic evidence  (this module)
 *     → detectPatterns()            proven patterns         (pure, src/lib/ai/patterns.ts)
 *     → AI                          explanation only
 *     → parseInsightResponse()      interpretations bound to proven patterns
 *     → user confirmation
 *     → ai.applyProposal()          THE PHASE 15 APPLY PATH, reused verbatim
 *
 * Notice there is no apply function here. Insight actions are stored as a plan
 * on an `aiMessages` row and applied by the EXISTING `ai.applyProposal`
 * mutation — same allowlist, same ownership checks, same confirmation gate,
 * same existing application services. One action pipeline, not two (§6, §27).
 *
 * The deterministic patterns are returned to the client EVEN WHEN THE PROVIDER
 * IS UNAVAILABLE. A failed AI call must never cost the user real intelligence
 * (§22, §24).
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import {
  action,
  internalMutation,
  query,
  type ActionCtx,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";

import {
  aggregateInsightContext,
  contextVersion,
  renderInsightContextForModel,
  renderProgressionForModel,
  type InsightAggregation,
  type InsightBlockInput,
  type InsightContextInput,
  type InsightGoalInput,
  type InsightHabitInput,
  type InsightProjectInput,
  type InsightRoutineDayInput,
  type InsightSessionInput,
  type InsightTaskInput,
} from "../lib/ai/insight-context";
import {
  buildInsightSystemPrompt,
  INSIGHT_SCHEMA_HINT,
  DAILY_SECTION_KEYS,
  WEEKLY_SECTION_KEYS,
  insightPersonaDefinition,
} from "../lib/ai/insight-prompts";
import { parseInsightResponse } from "../lib/ai/insight-parser";
import { getAIProvider } from "../lib/ai/provider";
import type { AIResult } from "../lib/ai/types";
import type {
  AIInsightResponse,
  AIInsightWindow,
  DetectedPattern,
} from "../lib/ai/insight-types";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
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

async function requireUser(ctx: Ctx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

const WINDOW_DAYS: Record<AIInsightWindow, number> = {
  today: 1,
  "7d": 7,
  "14d": 14,
  "30d": 30,
};

const DEFAULT_AVAILABILITY = {
  dayStart: "08:00",
  dayEnd: "17:00",
  breakMinutes: 15,
  maxFocusMinutes: 90,
};

/* ------------------------------------------------------------------ */
/* Deterministic evidence aggregation (§2, §6)                          */
/* ------------------------------------------------------------------ */

/**
 * Read the workspace and compute the evidence envelope. Pure reads, no writes,
 * so it is safe as a query the UI can call on its own to render REAL insight
 * even with no provider configured.
 */
export const insightContext = query({
  args: {
    window: v.optional(v.string()),
    tzOffsetMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const win = (args.window ?? "7d") as AIInsightWindow;
    const days = WINDOW_DAYS[win] ?? 7;
    const tz = args.tzOffsetMinutes ?? 210;

    const today = dayKeyOf(Date.now(), tz);
    const from = addDaysKey(today, -(days - 1));
    const until = addDaysKey(today, days);

    const [profile, tasks, projects, blocks, sessions, goals, routines, routineItems, checkins, habits, habitLogs, automations] =
      await Promise.all([
        ctx.db.query("userProfile").withIndex("by_user", (q) => q.eq("userId", userId)).first(),
        ctx.db.query("tasks").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
        ctx.db.query("projects").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
        ctx.db.query("timeBlocks").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
        ctx.db.query("executionSessions").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
        Promise.all([
          ctx.db.query("personalGoals").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
          ctx.db.query("workGoals").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
          ctx.db.query("businessGoals").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
        ]),
        ctx.db.query("routines").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
        ctx.db.query("routineItems").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
        ctx.db.query("checkins").withIndex("by_user_day", (q) => q.eq("userId", userId).gte("day", from)).collect(),
        ctx.db.query("habits").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
        ctx.db.query("habitLogs").withIndex("by_user_day", (q) => q.eq("userId", userId).gte("day", from)).collect(),
        ctx.db.query("automations").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ]);

    const persona = profile?.personaKey || "personal";

    /* ---- tasks ---- */
    const openTasks = tasks.filter((t) => !t.archived);
    const taskInputs: InsightTaskInput[] = openTasks.map((t) => ({
      id: t._id as string,
      title: t.title,
      status: t.status,
      dueDate: t.dueDate,
      estimateMinutes: t.estimateMinutes,
      postponeCount: t.postponeCount,
      completedAt: t.completedAt,
      projectId: t.projectId as string | undefined,
      // "Blocked" is only inferred from an EXPLICIT tag — never guessed.
      blockedCount: t.tags.filter((tag) =>
        ["blocked", "گرفتار", "گرفتارشده"].includes(tag.toLowerCase()),
      ).length,
    }));

    /* ---- schedule ---- */
    const blockInputs: InsightBlockInput[] = blocks
      .filter((b) => b.day >= from && b.day <= until)
      .map((b) => ({
        id: b._id as string,
        day: b.day,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        kind: b.kind,
      }));

    /* ---- execution ---- */
    const sessionInputs: InsightSessionInput[] = sessions
      .filter((s) => s.day >= from && s.day <= today)
      .map((s) => {
        const minutes = s.elapsedMs ? Math.round(s.elapsedMs / 60_000) : 0;
        const interrupted =
          s.state !== "completed" ||
          s.endedReason === "interrupted" ||
          s.endedReason === "abandoned";
        return {
          id: s._id as string,
          day: s.day,
          kind: s.kind,
          minutes,
          interrupted,
          taskId: s.taskId as string | undefined,
          plannedMinutes: s.plannedMinutes,
        };
      });

    /* ---- goals ---- */
    const [personalGoals, workGoals, businessGoals] = goals;
    const goalInputs: InsightGoalInput[] = [
      ...personalGoals.map((g) => ({
        id: g._id as string,
        title: g.title,
        progress: g.progress,
        status: g.status,
        updatedAt: g.updatedAt ?? g.createdAt,
      })),
      ...workGoals.map((g) => ({
        id: g._id as string,
        title: g.title,
        progress: g.progress,
        status: g.status,
        // workGoals has no updatedAt column — creation time is the honest floor.
        updatedAt: g.createdAt,
      })),
      ...businessGoals.map((g) => ({
        id: g._id as string,
        title: g.title,
        progress: g.progress,
        status: g.status,
        updatedAt: g.createdAt,
      })),
    ];

    /* ---- projects ---- */
    const projectInputs: InsightProjectInput[] = projects
      .filter((p) => !p.archived)
      .map((p) => {
        const mine = openTasks.filter((t) => t.projectId === p._id && t.status !== "done");
        return {
          id: p._id as string,
          name: p.name,
          status: p.status,
          openTasks: mine.length,
          overdueTasks: mine.filter((t) => t.dueDate && t.dueDate < today).length,
        };
      });

    /* ---- routines ---- */
    const routineIds = new Set(routines.map((r) => r._id));
    const itemCountByRoutine = new Map<string, number>();
    for (const it of routineItems) {
      if (!routineIds.has(it.routineId)) continue;
      itemCountByRoutine.set(it.routineId, (itemCountByRoutine.get(it.routineId) ?? 0) + 1);
    }
    const doneByDay = new Map<string, number>();
    for (const c of checkins) {
      if (!c.done) continue;
      doneByDay.set(c.day, (doneByDay.get(c.day) ?? 0) + 1);
    }
    const routineDays: InsightRoutineDayInput[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = addDaysKey(today, -i);
      routineDays.push({ day: d, done: doneByDay.get(d) ?? 0, total: routines.length });
    }

    /* ---- habits ---- */
    const activeHabits = habits.filter((h) => !h.archived);
    const habitDone = new Map<string, number>();
    const habitDays = new Map<string, Set<string>>();
    for (const log of habitLogs) {
      if (!log.done) continue;
      habitDone.set(log.habitId, (habitDone.get(log.habitId) ?? 0) + 1);
      const set = habitDays.get(log.habitId) ?? new Set<string>();
      set.add(log.day);
      habitDays.set(log.habitId, set);
    }
    const habitInputs: InsightHabitInput[] = activeHabits.map((h) => ({
      id: h._id as string,
      title: h.title,
      target: Math.max(1, h.target),
      done: habitDone.get(h._id) ?? 0,
      periods: habitDays.get(h._id)?.size ?? 0,
    }));

    /* ---- availability ---- */
    const p = (profile ?? {}) as unknown as Record<string, unknown>;
    const availability = {
      dayStart: typeof p.scheduleDayStart === "string" ? p.scheduleDayStart : DEFAULT_AVAILABILITY.dayStart,
      dayEnd: typeof p.scheduleDayEnd === "string" ? p.scheduleDayEnd : DEFAULT_AVAILABILITY.dayEnd,
      breakMinutes:
        typeof p.scheduleBreakMinutes === "number" ? p.scheduleBreakMinutes : DEFAULT_AVAILABILITY.breakMinutes,
      maxFocusMinutes:
        typeof p.scheduleMaxFocusMinutes === "number" ? p.scheduleMaxFocusMinutes : DEFAULT_AVAILABILITY.maxFocusMinutes,
    };

    /* ---- persona domain labels ---- */
    const domainContext = await domainLabels(ctx, userId, persona, today, until);

    const input: InsightContextInput = {
      persona,
      window: win,
      todayKey: today,
      availability,
      tasks: taskInputs,
      blocks: blockInputs,
      sessions: sessionInputs,
      goals: goalInputs,
      projects: projectInputs,
      routineDays,
      habits: habitInputs,
      // "Reschedule" is evidenced by the planner/adapter provenance we already
      // write on blocks (source === "reschedule"), never invented.
      rescheduleCount: blocks.filter((b) => b.day >= from && b.source === "reschedule").length,
      domainContext,
    };

    const aggregation: InsightAggregation = aggregateInsightContext(input);

    /* ---- progression (§19), real numbers only ---- */
    const progression = await ctx.db
      .query("progress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const activeAutomations = automations.filter((a) => a.enabled).length;
    const progressionText = progression
      ? renderProgressionForModel({
          level: progression.level ?? 1,
          totalXp: progression.totalXp ?? 0,
          xpThisMonth: 0,
          statDeltas: [],
          questsActive: activeAutomations,
          questsDone: 0,
        })
      : "";

    return {
      persona,
      window: win,
      todayKey: today,
      stats: aggregation.stats,
      patterns: aggregation.patterns,
      insufficient: aggregation.insufficient,
      sources: aggregation.sources,
      contextText:
        renderInsightContextForModel(input, aggregation) +
        (progressionText ? `\n\n${progressionText}` : ""),
      automationCount: activeAutomations,
      contextVersion: contextVersion(),
    };
  },
});

/** Persona-scoped labels only (§9). Never the whole domain table. */
async function domainLabels(
  ctx: Ctx,
  userId: Id<"users">,
  persona: string,
  today: string,
  until: string,
): Promise<string[]> {
  const out: string[] = [];
  try {
    if (persona === "student") {
      const exams = await ctx.db
        .query("exams")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      const subjects = await ctx.db
        .query("subjects")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const e of exams.slice(0, 8)) {
        const date = (e as unknown as { date?: string }).date;
        if (date && date >= today && date <= until) out.push(`امتحان: ${e.title} — ${date}`);
      }
      for (const s of subjects.slice(0, 8)) {
        out.push(`درس: ${s.name} — ${s.studyHours} ساعت مطالعهٔ ثبت‌شده`);
      }
    } else if (persona === "freelancer") {
      const deliverables = await ctx.db
        .query("deliverables")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      const clients = await ctx.db
        .query("clients")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const d of deliverables.slice(0, 8)) {
        const due = (d as unknown as { dueDate?: string }).dueDate;
        out.push(`تحویل‌دادنی: ${d.title}${due ? ` — مهلت: ${due}` : ""}`);
      }
      for (const c of clients.slice(0, 6)) out.push(`مشتری: ${c.name}`);
    } else if (persona === "manager" || persona === "team") {
      const teams = await ctx.db
        .query("teams")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      const members = await ctx.db
        .query("teamMembers")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const t of teams.slice(0, 6)) out.push(`تیم: ${t.name}`);
      for (const m of members.slice(0, 10)) {
        out.push(`عضو تیم: ${(m as unknown as { name?: string }).name ?? "—"}`);
      }
    } else if (persona === "business_owner") {
      const opps = await ctx.db
        .query("salesOpportunities")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const o of opps.slice(0, 10)) {
        const stage = (o as unknown as { stage?: string }).stage;
        out.push(`فرصت فروش: ${o.title}${stage ? ` — مرحله: ${stage}` : ""}`);
      }
    } else if (persona === "employee") {
      const meetings = await ctx.db
        .query("meetings")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const m of meetings.slice(0, 8)) {
        const date = (m as unknown as { date?: string }).date;
        if (date && date >= today) out.push(`جلسه: ${m.title}${date ? ` — ${date}` : ""}`);
      }
    }
  } catch {
    // Optional domain tables must never break insight generation.
  }
  return out.slice(0, 12);
}

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

export const status = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const profile = await ctx.db
      .query("userProfile")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const persona = profile?.personaKey || "personal";
    const def = insightPersonaDefinition(persona);
    return {
      persona,
      personaLabel: def.label,
      quickActions: def.quickActions,
      focus: def.focus,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Generate an insight or a review (§7, §8, §12)                        */
/* ------------------------------------------------------------------ */

export type InsightKind = "insight" | "daily_review" | "weekly_review";

export interface InsightAskSuccess {
  ok: true;
  response: AIInsightResponse;
  patterns: DetectedPattern[];
  unexplainedPatterns: DetectedPattern[];
  insufficient: boolean;
  confidence: string;
  contextSources: string[];
  latencyMs: number;
  /** Reused Phase 15 apply path — only non-null when actions were proposed. */
  messageId: Id<"aiMessages"> | null;
  telemetry: { provider: string; model: string; latencyMs: number };
}

export interface InsightAskFailure {
  ok: false;
  failure: string;
  message: string;
  retryable: boolean;
  /**
   * The DETERMINISTIC patterns are still returned on failure (§22, §24): the
   * user keeps real intelligence even when the provider is down.
   */
  patterns: DetectedPattern[];
  insufficient: boolean;
  stats: Array<{ label: string; value: string }>;
  telemetry?: { provider: string; model: string; latencyMs: number };
}

export const askInsight = action({
  args: {
    kind: v.optional(v.string()),
    window: v.optional(v.string()),
    tzOffsetMinutes: v.optional(v.number()),
    /** Optional free-text question layered on top of the analysis (§12). */
    question: v.optional(v.string()),
  },
  handler: async (ctx: ActionCtx, args): Promise<InsightAskSuccess | InsightAskFailure> => {
    const started = Date.now();
    await requireUser(ctx as unknown as MutationCtx);

    const kind = (args.kind ?? "insight") as InsightKind;
    const allowedSections =
      kind === "daily_review"
        ? DAILY_SECTION_KEYS
        : kind === "weekly_review"
          ? WEEKLY_SECTION_KEYS
          : undefined;

    /* ---- 1. deterministic evidence (query — actions have no db) ---- */
    const ctxPayload = await ctx.runQuery(api.aiInsights.insightContext, {
      window: args.window ?? (kind === "weekly_review" ? "7d" : "7d"),
      tzOffsetMinutes: args.tzOffsetMinutes,
    });

    const patterns = ctxPayload.patterns;
    const telemetryBase = { provider: "n/a", model: "n/a", latencyMs: 0 };

    /* ---- 2. not enough data ⇒ say so, do not call the provider ---- */
    if (ctxPayload.insufficient || patterns.length === 0) {
      return {
        ok: false,
        failure: "insufficient_data",
        message:
          "هنوز فعالیت کافی ثبت نشده تا الگوی قابل اتکایی پیدا شود. فضای کاری شما مثل قبل کار می‌کند.",
        retryable: false,
        patterns,
        insufficient: true,
        stats: ctxPayload.stats,
      };
    }

    /* ---- 3. provider ---- */
    const provider = getAIProvider();
    const mode = kind === "daily_review" ? "daily_review" : kind === "weekly_review" ? "weekly_review" : "insight";

    const userText = [
      args.question
        ? `# پرسش کاربر\n${args.question.slice(0, 600)}`
        : `# درخواست\n${mode === "daily_review" ? "مرور روزانهٔ امروز را بنویس." : mode === "weekly_review" ? "مرور هفتگی را بنویس." : "این الگوها را تحلیل کن."}`,
      "",
      ctxPayload.contextText,
    ].join("\n");

    const completion = await provider.complete({
      system: buildInsightSystemPrompt(
        ctxPayload.persona,
        mode,
        patterns.map((p) => p.type),
      ),
      user: userText,
      history: [],
      schemaHint: INSIGHT_SCHEMA_HINT,
    });

    const telemetry = {
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
          "دستیار هوش مصنوعی موقتاً در دسترس نیست. تحلیل‌های قطعی و فضای کاری شما کاملاً کار می‌کند.",
        retryable: completion.retryable ?? true,
        patterns,
        insufficient: false,
        stats: ctxPayload.stats,
        telemetry,
      };
    }

    /* ---- 4. parse + bind to proven patterns ---- */
    const parsed: AIResult<{
      response: AIInsightResponse;
      unexplainedPatterns: DetectedPattern[];
      insufficient: boolean;
      confidence: string;
    }> = parseInsightResponse(completion.data.content, {
      persona: ctxPayload.persona,
      proven: patterns,
      allowedSections: allowedSections as readonly string[] | undefined,
      contextSources: ctxPayload.sources,
    });

    if (!parsed.ok || !parsed.data) {
      return {
        ok: false,
        failure: "invalid_response",
        message: `${parsed.message ?? "پاسخ دستیار قابل استفاده نبود."} تحلیل‌های قطعی همچنان در دسترس است.`,
        retryable: true,
        patterns,
        insufficient: false,
        stats: ctxPayload.stats,
        telemetry,
      };
    }

    const { response, unexplainedPatterns, insufficient, confidence } = parsed.data;

    /* ---- 5. persist + hand any actions to the Phase 15 apply path ---- */
    let messageId: Id<"aiMessages"> | null = null;
    const actionCount = response.actions.length;
    if (actionCount > 0) {
      messageId = await ctx.runMutation(api.ai.recordTurn, {
        prompt: args.question?.slice(0, 1000) ?? `بینش ${kind}`,
        feature: `insight_${kind}`,
        ok: true,
        summary: response.summary,
        responseType: "action_plan",
        plan: JSON.stringify({ actions: response.actions, maxSafety: 3, droppedCount: 0 }),
        contextSources: JSON.stringify(ctxPayload.sources),
        provider: provider.name,
        model: provider.model,
        latencyMs: telemetry.latencyMs,
        promptTokens: completion.data.usage.promptTokens,
        completionTokens: completion.data.usage.completionTokens,
      });
    }

    await ctx.runMutation(internal.aiInsights.recordInsight, {
      kind,
      persona: ctxPayload.persona,
      window: ctxPayload.window,
      summary: response.summary,
      patterns: JSON.stringify(patterns),
      interpretations: JSON.stringify(response.interpretations),
      sections: JSON.stringify(response.sections),
      plan: actionCount > 0 ? JSON.stringify({ actions: response.actions }) : undefined,
      messageId: messageId ?? undefined,
      confidence,
      insufficient,
      contextSources: JSON.stringify(ctxPayload.sources),
      provider: provider.name,
      model: provider.model,
    });

    void telemetryBase;
    return {
      ok: true,
      response,
      patterns,
      unexplainedPatterns,
      insufficient,
      confidence,
      contextSources: ctxPayload.sources,
      latencyMs: telemetry.latencyMs,
      messageId,
      telemetry,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Persistence + history (§14)                                          */
/* ------------------------------------------------------------------ */

export const recordInsight = internalMutation({
  args: {
    kind: v.string(),
    persona: v.string(),
    window: v.string(),
    summary: v.string(),
    patterns: v.string(),
    interpretations: v.optional(v.string()),
    sections: v.optional(v.string()),
    plan: v.optional(v.string()),
    messageId: v.optional(v.id("aiMessages")),
    confidence: v.string(),
    insufficient: v.boolean(),
    contextSources: v.optional(v.string()),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    return await ctx.db.insert("aiInsights", {
      userId,
      persona: args.persona,
      kind: args.kind,
      window: args.window,
      summary: args.summary,
      patterns: args.patterns,
      interpretations: args.interpretations,
      sections: args.sections,
      plan: args.plan,
      messageId: args.messageId,
      confidence: args.confidence,
      insufficient: args.insufficient,
      contextSources: args.contextSources,
      provider: args.provider,
      model: args.model,
      createdAt: Date.now(),
    });
  },
});

/** Recent insight/review runs. Patterns are returned so history stays honest. */
export const insightHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const rows = await ctx.db
      .query("aiInsights")
      .withIndex("by_user_at", (q) => q.eq("userId", userId))
      .order("desc")
      .take(Math.min(Math.max(args.limit ?? 10, 1), 40));
    return rows.map((r) => ({
      _id: r._id as Id<"aiInsights">,
      kind: r.kind,
      window: r.window,
      summary: r.summary,
      confidence: r.confidence,
      insufficient: r.insufficient,
      patternCount: (safeParse(r.patterns, []) as DetectedPattern[]).length,
      createdAt: r.createdAt,
      messageId: r.messageId ?? null,
    }));
  },
});

function safeParse<T>(raw: string | undefined | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
