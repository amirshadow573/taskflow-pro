/**
 * Phase 10.5 — AI Planning Import bridge (backend).
 *
 * The platform NEVER calls an AI provider. The user copies a persona prompt
 * into their own AI tool, receives a JSON file, and uploads it here. This
 * module is the untrusted-data boundary:
 *
 *   AIPlanParser/Normalizer/Validator  (src/lib/ai-planning/schema.ts — pure)
 *   → AIPlanConflictService           (conflicts.ts — pure)
 *   → analyze  : validate + preview + record the import (no workspace writes)
 *   → apply    : EXPLICIT confirmation, then create entities in the EXISTING
 *                models (tasks, projects, personalGoals, timeBlocks, routines,
 *                habits, personalNotes) — never a parallel system
 *   → history  : full audit trail (Phase 10.5 §20)
 *
 * Safety invariants:
 *  - The file is data only. No evaluation, no instructions executed, no
 *    "AI commands" — only the whitelisted fields in the v1 schema are read.
 *  - Nothing existing is ever modified or deleted. The only writes are
 *    INSERTs owned by the calling user.
 *  - Blocking conflicts (schedule overlaps) are skipped unless the user ticks
 *    an explicit override in the confirmation dialog.
 *  - Every write is owner-scoped; the authenticated user is the owner.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { detectConflicts, detectDuplicates, filterConflictingBlocks } from "../lib/ai-planning/conflicts";
import { normalizeAIPlan } from "../lib/ai-planning/schema";
import { normalizeTitle, toMin, emptyBodyCounts, emptyCounts, type AIPlanBody, type AIPlanSourceType, type AppliedCounts, type NormalizedAIPlan, type PlanAnalysis } from "../lib/ai-planning/types";

/** Upper bounds — an import may never flood the workspace. */
const MAX_ITEMS = {
  goals: 60,
  projects: 60,
  tasks: 400,
  calendar_events: 200,
  time_blocks: 400,
  routines: 40,
  habits: 60,
  milestones: 200,
};
const DEFAULT_AVAILABLE_MINUTES = 8 * 60;
const SNAPSHOT_MAX_CHARS = 120_000;

type Ctx = QueryCtx | MutationCtx;

async function requireUser(ctx: Ctx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

async function personaOf(ctx: Ctx, userId: Id<"users">): Promise<string> {
  const profile = await ctx.db
    .query("userProfile")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return profile?.personaKey || "personal";
}

function dayKeyOf(at: number, tzOffsetMinutes: number): string {
  const d = new Date(at + tzOffsetMinutes * 60_000);
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

function addDaysKey(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + days * 86_400_000);
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`;
}

function safeJson(value: unknown, max = SNAPSHOT_MAX_CHARS): string | undefined {
  const text = JSON.stringify(value ?? null);
  if (text.length <= max) return text;
  return JSON.stringify({ truncated: true, size: text.length });
}

async function loadExisting(ctx: Ctx, userId: Id<"users">, todayKey: string) {
  const [tasks, projects, personalGoals, workGoals, teamGoals, businessGoals, allBlocks] = await Promise.all([
    ctx.db.query("tasks").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("projects").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("personalGoals").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("workGoals").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("teamGoals").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("businessGoals").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("timeBlocks").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
  ]);
  const until = addDaysKey(todayKey, 21);
  return {
    tasks: tasks.map((t) => ({ id: t._id as string, title: t.title as string })),
    projects: projects.map((p) => ({ id: p._id as string, name: p.name as string })),
    goals: [
      ...personalGoals.map((g) => ({ id: g._id as string, title: g.title as string })),
      ...workGoals.map((g) => ({ id: g._id as string, title: g.title as string })),
      ...teamGoals.map((g) => ({ id: g._id as string, title: g.title as string })),
      ...businessGoals.map((g) => ({ id: g._id as string, title: g.title as string })),
    ],
    blocks: allBlocks
      .filter((b) => b.day >= todayKey && b.day <= until)
      .map((b) => ({
        id: b._id as string,
        day: b.day as string,
        startTime: b.startTime as string,
        endTime: b.endTime as string,
        title: b.title as string,
        status: b.status as string | undefined,
      })),
  };
}

function emptyAnalysisIssues(): PlanAnalysis["issues"] {
  return [];
}

/* ------------------------------------------------------------------ */
/* analyze — validate, detect conflicts/duplicates, stage the import  */
/* ------------------------------------------------------------------ */

export const analyze = mutation({
  args: {
    /** The parsed JSON document (untrusted). */
    raw: v.any(),
    /** Device UTC offset in minutes — the importer works in the owner's day. */
    tzOffsetMinutes: v.optional(v.number()),
    /** Usable minutes per day from the user's scheduling preference. */
    availableMinutesPerDay: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const now = Date.now();
    const tz = args.tzOffsetMinutes ?? -new Date().getTimezoneOffset();
    const todayKey = dayKeyOf(now, tz);
    const persona = await personaOf(ctx, userId);

    const result = normalizeAIPlan(args.raw, { expectedPersona: persona, now });
    if (result.rejected || !result.plan) {
      // Rejected files are still recorded — the user must be able to see WHY.
      const id = await ctx.db.insert("aiPlanningImports", {
        userId,
        status: "rejected",
        persona,
        sourceType: "external_chatgpt",
        sourceProvider: "نامشخص",
        schemaVersion: String(
        typeof args.raw === "object" && args.raw !== null && "schema_version" in args.raw
          ? (args.raw as { schema_version?: unknown }).schema_version ?? ""
          : "",
      ),
        createdAt: now,
        updatedAt: now,
        inputCounts: JSON.stringify(emptyBodyCounts()),
        appliedCounts: JSON.stringify(emptyCounts()),
        issues: safeJson(result.issues),
        notes: "فایل رد شد؛ چیزی وارد فضای کاری نشد.",
      });
      return {
        ok: false as const,
        importId: id,
        rejected: true,
        issues: result.issues,
        conflicts: [] as PlanAnalysis["conflicts"],
        duplicates: [] as PlanAnalysis["duplicates"],
        newCounts: emptyBodyCounts(),
        duplicateCounts: { task: 0, project: 0, goal: 0 },
        persona,
        todayKey,
      };
    }

    const plan = result.plan;
    const existing = await loadExisting(ctx, userId, todayKey);
    const conflicts = detectConflicts(plan, {
      ...existing,
      availableMinutesPerDay: Math.max(
        60,
        Math.min(16 * 60, args.availableMinutesPerDay ?? DEFAULT_AVAILABLE_MINUTES),
      ),
      todayKey,
    });
    const duplicates = detectDuplicates(plan, existing);

    const newCounts = emptyBodyCounts();
    for (const key of Object.keys(newCounts) as Array<keyof AIPlanBody>) {
      const total = plan.plan[key].length;
      const dupes =
        key === "tasks"
          ? duplicates.filter((d) => d.entity === "task").length
          : key === "projects"
            ? duplicates.filter((d) => d.entity === "project").length
            : key === "goals"
              ? duplicates.filter((d) => d.entity === "goal").length
              : 0;
      newCounts[key] = Math.max(0, total - dupes);
    }
    const duplicateCounts = {
      task: duplicates.filter((d) => d.entity === "task").length,
      project: duplicates.filter((d) => d.entity === "project").length,
      goal: duplicates.filter((d) => d.entity === "goal").length,
    };

    const blocking = conflicts.filter((c) => c.blocking).length;
    const status = blocking > 0 || duplicates.length > 0 ? "needs_review" : "validated";

    const importId = await ctx.db.insert("aiPlanningImports", {
      userId,
      status,
      persona: plan.persona || persona,
      sourceType: plan.source.type,
      sourceProvider: plan.source.provider,
      schemaVersion: plan.schema_version,
      createdAt: now,
      updatedAt: now,
      inputCounts: JSON.stringify(plan.meta.counts),
      appliedCounts: JSON.stringify(emptyCounts()),
      issues: safeJson(result.issues),
      conflicts: safeJson(conflicts),
      duplicates: safeJson(duplicates),
      // Layer separation: inputs are kept apart from the generated plan.
      contextSnapshot: safeJson({
        user_context: plan.user_context,
        planning_inputs: plan.planning_inputs,
        planning_assumptions: plan.planning_assumptions,
        explanations: plan.explanations,
      }),
      planSnapshot: safeJson(plan.plan),
    });

    return {
      ok: true as const,
      importId,
      rejected: false,
      issues: result.issues.length ? result.issues : emptyAnalysisIssues(),
      conflicts,
      duplicates,
      newCounts,
      duplicateCounts,
      persona: plan.persona || persona,
      todayKey,
      status,
      source: plan.source,
      schemaVersion: plan.schema_version,
    };
  },
});

/* ------------------------------------------------------------------ */
/* apply — only after explicit confirmation                             */
/* ------------------------------------------------------------------ */

export const apply = mutation({
  args: {
    importId: v.id("aiPlanningImports"),
    /** Entities the user chose. Missing key = include. */
    selection: v.optional(v.record(v.string(), v.boolean())),
    /** Import blocks even if they overlap the calendar (explicit override). */
    includeConflictingBlocks: v.optional(v.boolean()),
    /** Import items whose title already exists (explicit override). */
    includeDuplicates: v.optional(v.boolean()),
    tzOffsetMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const now = Date.now();
    const tz = args.tzOffsetMinutes ?? -new Date().getTimezoneOffset();
    const todayKey = dayKeyOf(now, tz);

    const record = await ctx.db.get(args.importId);
    if (!record || record.userId !== userId) throw new Error("این واردسازی پیدا نشد.");
    if (record.status === "applied" || record.status === "partially_applied") {
      throw new Error("این برنامه قبلاً اعمال شده است.");
    }
    if (record.status === "rejected") throw new Error("این فایل رد شده بود و قابل اعمال نیست.");
    if (!record.planSnapshot) throw new Error("اطلاعات برنامه برای این واردسازی موجود نیست.");

    const plan: NormalizedAIPlan = {
      schema_version: record.schemaVersion,
      source: {
        type: (record.sourceType ?? "external_chatgpt") as AIPlanSourceType,
        provider: record.sourceProvider,
      },
      persona: record.persona,
      user_context: { profile: [], environment: [], constraints: [], preferences: [] },
      planning_inputs: {
        fixed_schedule: [],
        availability: [],
        goals: [],
        priorities: [],
        deadlines: [],
        commitments: [],
        subjects: [],
        projects: [],
      },
      planning_assumptions: [],
      plan: JSON.parse(record.planSnapshot) as AIPlanBody,
      explanations: [],
      warnings: [],
      conflicts: [],
      meta: { importedAt: record.createdAt, dropped: [], counts: emptyBodyCounts() },
    };

    const sel = (key: keyof AIPlanBody): boolean => args.selection?.[key] !== false;
    const applied = emptyCounts();
    const rejected: string[] = [];
    const createdIds: Record<string, string[]> = {};
    const track = (key: string, id: string) => {
      (createdIds[key] ??= []).push(id);
    };

    const existing = await loadExisting(ctx, userId, todayKey);
    const existingTaskTitles = new Set(existing.tasks.map((t) => normalizeTitle(t.title)));
    const existingProjectTitles = new Set(existing.projects.map((p) => normalizeTitle(p.name)));
    const existingGoalTitles = new Set(existing.goals.map((g) => normalizeTitle(g.title)));
    const allowDupes = args.includeDuplicates === true;

    const goalIdByTitle = new Map<string, Id<"personalGoals">>();
    const projectIdByTitle = new Map<string, Id<"projects">>();

    // ── goals → personalGoals (the generic goal model) ───────────────────
    if (sel("goals")) {
      for (const g of plan.plan.goals.slice(0, MAX_ITEMS.goals)) {
        if (!allowDupes && existingGoalTitles.has(normalizeTitle(g.title))) {
          rejected.push(`هدف تکراری: «${g.title}»`);
          continue;
        }
        const id = await ctx.db.insert("personalGoals", {
          userId,
          title: g.title,
          description: g.description,
          dueDate: g.due_date,
          progress: 0,
          status: "active",
          milestones: [],
          relatedProjectIds: [],
          createdAt: now,
          updatedAt: now,
        });
        goalIdByTitle.set(normalizeTitle(g.title), id);
        track("goals", id);
        applied.goals++;
        existingGoalTitles.add(normalizeTitle(g.title));
      }
    }

    // ── projects → projects ─────────────────────────────────────────────
    if (sel("projects")) {
      for (const p of plan.plan.projects.slice(0, MAX_ITEMS.projects)) {
        if (!allowDupes && existingProjectTitles.has(normalizeTitle(p.title))) {
          rejected.push(`پروژه تکراری: «${p.title}»`);
          continue;
        }
        const goalId = p.goal_ref ? goalIdByTitle.get(normalizeTitle(p.goal_ref)) : undefined;
        const id = await ctx.db.insert("projects", {
          userId,
          name: p.title,
          description: p.description,
          color: "#4f46e5",
          deadline: p.deadline,
          status: p.status === "paused" ? "paused" : "active",
          createdAt: now,
          archived: false,
          goalRef: goalId ? `personal:${goalId}` : undefined,
        });
        projectIdByTitle.set(normalizeTitle(p.title), id);
        track("projects", id);
        applied.projects++;
        existingProjectTitles.add(normalizeTitle(p.title));
      }
    }

    // ── tasks → tasks (linked to imported projects) ──────────────────────
    if (sel("tasks")) {
      for (const t of plan.plan.tasks.slice(0, MAX_ITEMS.tasks)) {
        if (!allowDupes && existingTaskTitles.has(normalizeTitle(t.title))) {
          rejected.push(`کار تکراری: «${t.title}»`);
          continue;
        }
        const projectId = t.project_ref ? projectIdByTitle.get(normalizeTitle(t.project_ref)) : undefined;
        const tags = [...(t.tags ?? [])];
        if (t.goal_ref) tags.push("هدف: " + t.goal_ref);
        tags.push("ورودی از AI");
        const id = await ctx.db.insert("tasks", {
          userId,
          title: t.title,
          description: t.description,
          status: "todo",
          priority: t.priority ?? "medium",
          dueDate: t.due_date,
          dueTime: t.due_time,
          projectId,
          tags,
          estimateMinutes: t.estimate_minutes,
          sortOrder: 0,
          createdAt: now,
          archived: false,
        });
        track("tasks", id);
        applied.tasks++;
        existingTaskTitles.add(normalizeTitle(t.title));
      }
    }

    // ── milestones → tasks tagged as milestones (never overwrite goals) ──
    if (sel("milestones")) {
      for (const m of plan.plan.milestones.slice(0, MAX_ITEMS.milestones)) {
        const tags = ["نقطه عطف", "ورودی از AI"];
        if (m.goal_ref) tags.push("هدف: " + m.goal_ref);
        const id = await ctx.db.insert("tasks", {
          userId,
          title: m.title,
          description: m.notes,
          status: "todo",
          priority: "medium",
          dueDate: m.due_date,
          tags,
          sortOrder: 0,
          createdAt: now,
          archived: false,
        });
        track("milestones", id);
        applied.milestones++;
      }
    }

    // ── calendar events + time blocks → timeBlocks ──────────────────────
    const { keep } = filterConflictingBlocks(plan, { blocks: existing.blocks });
    const keptTitles = new Set(keep.map((b) => normalizeTitle(b.title)));
    /** An imported block may reference a task by plain title inside the file. */
    const resolveTaskId = (ref: string | undefined) => {
      if (!ref) return undefined;
      const match = existing.tasks.find((t) => normalizeTitle(t.title) === normalizeTitle(ref));
      return match ? (ctx.db.normalizeId("tasks", match.id) ?? undefined) : undefined;
    };

    if (sel("calendar_events")) {
      for (const e of plan.plan.calendar_events.slice(0, MAX_ITEMS.calendar_events)) {
        const clash = existing.blocks.some(
          (b) => b.day === e.day && toMin(e.start_time) < toMin(b.endTime) && toMin(e.end_time) > toMin(b.startTime),
        );
        if (clash && args.includeConflictingBlocks !== true) {
          rejected.push(`رویداد «${e.title}» با تقویم موجود تداخل دارد`);
          continue;
        }
        const id = await ctx.db.insert("timeBlocks", {
          userId,
          title: e.title,
          day: e.day,
          startTime: e.start_time,
          endTime: e.end_time,
          kind: e.kind ?? "meeting",
          status: "planned",
          fixed: false,
          source: "ai_import",
          notes: e.notes,
          updatedAt: now,
          createdAt: now,
        });
        track("calendar_events", id);
        applied.calendar_events++;
      }
    }

    if (sel("time_blocks")) {
      for (const b of plan.plan.time_blocks.slice(0, MAX_ITEMS.time_blocks)) {
        if (!keptTitles.has(normalizeTitle(b.title)) && args.includeConflictingBlocks !== true) {
          rejected.push(`بلوک «${b.title}» با برنامه موجود تداخل دارد`);
          continue;
        }
        const id = await ctx.db.insert("timeBlocks", {
          userId,
          title: b.title,
          day: b.day,
          startTime: b.start_time,
          endTime: b.end_time,
          kind: b.kind ?? "focus",
          taskId: resolveTaskId(b.task_ref),
          status: "planned",
          fixed: false,
          source: "ai_import",
          notes: b.notes,
          updatedAt: now,
          createdAt: now,
        });
        track("time_blocks", id);
        applied.time_blocks++;
      }
    }

    // ── routines → routines + routineItems ──────────────────────────────
    if (sel("routines")) {
      for (const r of plan.plan.routines.slice(0, MAX_ITEMS.routines)) {
        const routineId = await ctx.db.insert("routines", {
          userId,
          title: r.title,
          colorKey: "#4f46e5",
          sortOrder: 0,
        });
        track("routines", routineId);
        applied.routines++;
        let order = 0;
        for (const item of (r.items ?? []).slice(0, 20)) {
          const itemId = await ctx.db.insert("routineItems", {
            userId,
            routineId,
            title: item,
            sortOrder: order++,
          });
          track("routine_items", itemId);
          applied.routine_items++;
        }
      }
    }

    // ── habits → habits ─────────────────────────────────────────────────
    if (sel("habits")) {
      for (const h of plan.plan.habits.slice(0, MAX_ITEMS.habits)) {
        const id = await ctx.db.insert("habits", {
          userId,
          title: h.title,
          description: h.description,
          frequency: h.frequency,
          target: h.target ?? (h.frequency === "daily" ? 1 : 3),
          archived: false,
          createdAt: now,
        });
        track("habits", id);
        applied.habits++;
      }
    }

    // ── the USER INPUT layer becomes part of the workspace context ───────
    const ctxSnapshot = record.contextSnapshot ? JSON.parse(record.contextSnapshot) : null;
    if (ctxSnapshot) {
      const lines: string[] = [
        `منبع: ${record.sourceProvider} — نسخه ساختار ${record.schemaVersion}`,
        `شخصیت: ${record.persona}`,
        "",
        "ورودی‌های کاربر:",
        ...Object.entries(ctxSnapshot.user_context ?? {}).flatMap(([k, v]) =>
          (Array.isArray(v) && v.length ? [`• ${k}: ${(v as string[]).join(" / ")}`] : []),
        ),
        ...Object.entries(ctxSnapshot.planning_inputs ?? {}).flatMap(([k, v]) =>
          (Array.isArray(v) && v.length ? [`• ${k}: ${(v as string[]).join(" / ")}`] : []),
        ),
        "",
        "فرض‌های برنامه‌ریزی AI:",
        ...(ctxSnapshot.planning_assumptions ?? []).map((a: string) => `• ${a}`),
      ];
      const noteId = await ctx.db.insert("personalNotes", {
        userId,
        title: `زمینه برنامه‌ریزی AI — ${record.sourceProvider}`,
        body: lines.join("\n"),
        tags: ["برنامه‌ریزی", "ai-import"],
        createdAt: now,
        updatedAt: now,
      });
      track("context", noteId);
    }

    const totalApplied = Object.values(applied).reduce((n, c) => n + c, 0);
    const status: Doc<"aiPlanningImports">["status"] =
      totalApplied === 0 ? "rejected" : rejected.length > 0 ? "partially_applied" : "applied";

    await ctx.db.patch(record._id, {
      status,
      appliedAt: now,
      updatedAt: now,
      appliedCounts: JSON.stringify(applied),
      appliedIds: safeJson(createdIds),
      applyOptions: safeJson({
        selection: args.selection ?? null,
        includeConflictingBlocks: args.includeConflictingBlocks === true,
        includeDuplicates: args.includeDuplicates === true,
        rejected,
      }),
      notes:
        rejected.length > 0
          ? `${rejected.length} مورد به‌دلیل تکراری بودن یا تداخل وارد نشد.`
          : "همه موارد انتخاب‌شده وارد شدند.",
    });

    return { ok: true as const, status, applied, rejected };
  },
});

/* ------------------------------------------------------------------ */
/* history / detail / discard                                          */
/* ------------------------------------------------------------------ */

export const history = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("aiPlanningImports")
      .withIndex("by_user_at", (q) => q.eq("userId", userId))
      .order("desc")
      .take(Math.min(Math.max(args.limit ?? 20, 1), 100));
    return rows;
  },
});

export const detail = query({
  args: { id: v.id("aiPlanningImports") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const row = await ctx.db.get(args.id);
    if (!row || row.userId !== userId) return null;
    return row;
  },
});

/** Removes a staged (never applied) import — the workspace is untouched. */
export const discard = mutation({
  args: { id: v.id("aiPlanningImports") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const row = await ctx.db.get(args.id);
    if (!row || row.userId !== userId) throw new Error("Not found");
    if (row.status === "applied" || row.status === "partially_applied") {
      throw new Error("برنامه اعمال‌شده حذف نمی‌شود؛ فقط سابقه باقی می‌ماند.");
    }
    await ctx.db.delete(args.id);
    return { ok: true as const };
  },
});

export type { AppliedCounts };
