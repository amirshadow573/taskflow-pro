import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { recordExecutionEvent, setTaskDone } from "./taskCore";
import { fireAutomationEvent } from "./automations";

function dayKey(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** All active (non-archived) tasks for the current user. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("tasks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("archived"), false))
      .collect();
  },
});

export const listArchived = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("tasks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("archived"), true))
      .collect();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    dueTime: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    tags: v.optional(v.array(v.string())),
    parentId: v.optional(v.id("tasks")),
    estimateMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const id = await ctx.db.insert("tasks", {
      userId,
      title: args.title.trim(),
      description: args.description?.trim() || undefined,
      status: args.status ?? "todo",
      priority: args.priority ?? "medium",
      dueDate: args.dueDate || undefined,
      dueTime: args.dueTime || undefined,
      projectId: args.projectId,
      tags: args.tags ?? [],
      parentId: args.parentId,
      estimateMinutes: args.estimateMinutes,
      sortOrder: 0,
      createdAt: Date.now(),
      archived: false,
    });
    // Phase 14 — `task_created` event trigger for the automation engine.
    const created = await ctx.db.get(id);
    await fireAutomationEvent(ctx, userId, "task_created", {
      entity: "task",
      id,
      doc: created,
    });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    dueDate: v.optional(v.union(v.string(), v.null())),
    dueTime: v.optional(v.union(v.string(), v.null())),
    projectId: v.optional(v.union(v.id("projects"), v.null())),
    tags: v.optional(v.array(v.string())),
    estimateMinutes: v.optional(v.union(v.number(), v.null())),
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, ...rest }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const task = await ctx.db.get(id);
    if (!task || task.userId !== userId) throw new Error("Not found");
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(rest)) {
      if (val !== undefined) patch[k] = val === null ? undefined : val;
    }

    /*
     * Phase 12 — observable postponement data (§13). Only counts a due date
     * that actually moved forward; nothing is inferred about the user's
     * reasons, and no history is rewritten.
     */
    const nextDue = patch.dueDate as string | undefined;
    const postponed =
      nextDue !== undefined && !!task.dueDate && nextDue > task.dueDate;
    if (postponed) {
      patch.postponeCount = (task.postponeCount ?? 0) + 1;
      patch.lastPostponedAt = Date.now();
    }

    // Audit fix: completing a task through the status selector (task detail
    // panel) bypassed the progression engine, so XP / stats / skills /
    // achievements silently diverged from the checkbox path. Keep ONE code
    // path: any transition into or out of "done" goes through the engine.
    const nextStatus = patch.status as string | undefined;
    const wasDone = task.status === "done";
    const willBeDone = nextStatus !== undefined && nextStatus === "done";
    const completionChanged =
      nextStatus !== undefined && wasDone !== willBeDone;

    if (completionChanged) {
      patch.completedAt = willBeDone ? Date.now() : undefined;
    }

    if (Object.keys(patch).length) await ctx.db.patch(id, patch);

    if (postponed) {
      await recordExecutionEvent(ctx, {
        userId,
        type: "TASK_POSTPONED",
        label: `به تعویق افتاد: «${task.title}»`,
        taskId: id,
        projectId: task.projectId,
        meta: JSON.stringify({
          from: task.dueDate,
          to: nextDue,
          count: patch.postponeCount,
        }),
      });
    }

    if (completionChanged) {
      await setTaskDone(ctx, id, willBeDone);
    } else {
      // Phase 14 — `task_updated` event trigger (non-completion edits; the
      // completion path already fired task_completed inside setTaskDone).
      const after = await ctx.db.get(id);
      await fireAutomationEvent(ctx, userId, "task_updated", {
        entity: "task",
        id,
        doc: after,
      });
    }
  },
});

/**
 * Complete / reopen a task (micro-interaction friendly).
 * Also feeds the progression system: XP, streak, missions, achievements.
 */
export const toggleDone = mutation({
  args: { id: v.id("tasks"), done: v.boolean() },
  handler: async (ctx, { id, done }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const task = await ctx.db.get(id);
    if (!task || task.userId !== userId) throw new Error("Not found");
    /*
     * Phase 11/12 — ONE completion path (src/convex/taskCore.ts): task status,
     * linked time blocks and the progression engine stay in sync, whether the
     * completion came from the checkbox, the status selector or the execution
     * engine. Returns { level, levelUp, unlocked, xp } so the UI can celebrate.
     */
    return await setTaskDone(ctx, id, done);
  },
});

export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const task = await ctx.db.get(id);
    if (!task || task.userId !== userId) throw new Error("Not found");
    const children = await ctx.db
      .query("tasks")
      .withIndex("by_parent", (q) => q.eq("parentId", id))
      .collect();
    /*
     * Phase 11 — a time block never outlives its task: deleting a task (or
     * its subtasks) removes the associated blocks. Deleting a BLOCK, by
     * contrast, never touches the task (see personal.deleteTimeBlock).
     */
    const removedIds = new Set<string>([id as unknown as string, ...children.map((c) => c._id as unknown as string)]);
    const blocks = await ctx.db
      .query("timeBlocks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const b of blocks) {
      if (b.taskId && removedIds.has(b.taskId as unknown as string)) {
        await ctx.db.delete(b._id);
      }
    }
    for (const c of children) await ctx.db.delete(c._id);
    await ctx.db.delete(id);
  },
});

/** One-time realistic Persian sample data for onboarding. */
export const seedDemo = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("tasks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) return;

    const now = Date.now();
    const p1 = await ctx.db.insert("projects", {
      userId,
      name: "بازطراحی وب‌سایت",
      description: "طراحی و پیاده‌سازی نسخه جدید سایت شرکت",
      color: "#4f46e5",
      deadline: dayKey(21),
      status: "active",
      createdAt: now,
      archived: false,
    });
    const p2 = await ctx.db.insert("projects", {
      userId,
      name: "پروژه دانشگاه",
      description: "درس طراحی الگوریتم — پروژه پایان ترم",
      color: "#f59e0b",
      deadline: dayKey(10),
      status: "active",
      createdAt: now,
      archived: false,
    });
    const p3 = await ctx.db.insert("projects", {
      userId,
      name: "رشد شخصی",
      description: "عادت‌ها و یادگیری‌های روزانه",
      color: "#10b981",
      status: "active",
      createdAt: now,
      archived: false,
    });

    const mk = (
      title: string,
      opts: {
        status?: string;
        priority?: string;
        due?: number;
        time?: string;
        project?: typeof p1;
        tags?: string[];
      } = {},
    ) =>
      ctx.db.insert("tasks", {
        userId,
        title,
        status: opts.status ?? "todo",
        priority: opts.priority ?? "medium",
        dueDate: opts.due === undefined ? undefined : dayKey(opts.due),
        dueTime: opts.time,
        projectId: opts.project,
        tags: opts.tags ?? [],
        sortOrder: 0,
        createdAt: now,
        archived: false,
        completedAt:
          opts.status === "done" ? now - (opts.due ? -opts.due : 0) * 86400000 : undefined,
      });

    const parent = await mk("طراحی صفحه اصلی سایت", {
      status: "in_progress",
      priority: "high",
      due: 0,
      project: p1,
      tags: ["طراحی"],
    });
    for (const [t, done] of [
      ["طراحی هدر", true],
      ["طراحی بخش هیرو", true],
      ["طراحی داشبورد", true],
      ["ریسپانسیو کردن چیدمان", false],
      ["تست نهایی مرورگرها", false],
    ] as Array<[string, boolean]>) {
      await ctx.db.insert("tasks", {
        userId,
        title: t,
        status: done ? "done" : "todo",
        priority: "medium",
        projectId: p1,
        tags: [],
        parentId: parent,
        sortOrder: 0,
        createdAt: now,
        archived: false,
        completedAt: done ? now : undefined,
      });
    }

    await mk("تکمیل صفحه قیمت‌گذاری", { due: 1, project: p1, tags: ["طراحی"] });
    await mk("طراحی نسخه موبایل", { priority: "high", due: 3, project: p1, tags: ["طراحی", "موبایل"] });
    await mk("بررسی بازخورد کاربران", { status: "review", due: 0, project: p1 });
    await mk("انتشار نسخه دمو", { priority: "urgent", due: 2, project: p1 });
    await mk("ارسال پروژه به مشتری", { priority: "urgent", due: -1, project: p1, tags: ["مشتری"] });
    await mk("جلسه تیم محصول", { due: 1, time: "10:00", project: p1, tags: ["جلسه"] });
    await mk("مطالعه فصل سوم زیست", { due: 0, time: "18:00", project: p2, tags: ["مطالعه"] });
    await mk("حل تمرین‌های گراف", { status: "in_progress", priority: "high", due: 2, project: p2, tags: ["الگوریتم"] });
    await mk("مرور منابع آزمون", { due: 5, project: p2 });
    await mk("تمرین فتوشاپ", { status: "inbox", priority: "low", project: p3, tags: ["یادگیری"] });
    await mk("نوشتن ایده‌های بلاگ", { status: "inbox", priority: "low", project: p3 });
    await mk("تماس با دندانپزشک", { status: "inbox", priority: "low" });
    await mk("مرور هزینه‌های ماهانه", { status: "inbox", priority: "medium" });
    await mk("پاسخ به ایمیل‌ها", { priority: "low", due: 0, tags: ["اداری"] });
    await mk("مرور روزانه", { status: "done", due: 0, project: p3 });
    await mk("ورزش ۳۰ دقیقه", { status: "done", due: 0, project: p3 });
    await mk("خرید هفتگی", { status: "done", priority: "low", due: -1 });
    await mk("مطالعه ۲۰ صفحه کتاب", { status: "done", priority: "low", due: -1, project: p3 });
    await mk("تمرین کدنویسی", { status: "done", priority: "low", due: -2, project: p3 });
    await mk("پیاده‌روی عصرگاهی", { status: "done", priority: "low", due: -3, project: p3 });
    await mk("مرور اهداف هفته", { status: "done", priority: "low", due: -4, project: p3 });
  },
});
