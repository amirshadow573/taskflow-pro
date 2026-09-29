/**
 * Phase 14 — Smart Workflow & Automation Engine (THE one automation runtime).
 *
 * Architecture (all logic centralized here, never in UI components):
 *
 *   TriggerService            fireAutomationEvent / sweep (time + state)
 *   ConditionService          evaluateConditions (pure, from automationRules)
 *   ActionService             runAction — every action writes through the
 *                             EXISTING tables/services (tasks, timeBlocks,
 *                             personalNotes…), never a parallel system
 *   AutomationExecutionService executeAutomation — dedupe, cooldown, depth
 *   AutomationValidationService validateAutomation (pure, from automationRules)
 *   AutomationHistoryService   automationExecutions rows (success AND failure)
 *   AutomationSafetyService   owner scoping, destructive-action rejection,
 *                             MAX_DEPTH, event cooldown, candidate caps
 *
 * Safety invariants:
 *  - Every query/mutation is scoped to the authenticated owner. An automation
 *    can never read or write another user's rows (ownership is re-checked on
 *    every referenced target: project, task…).
 *  - Automation actions NEVER emit new automation events (writes bypass the
 *    public mutations), so chains cannot grow; MAX_DEPTH guards the rest.
 *  - Idempotency: one history row per (automation, dedupeKey) — the same
 *    occurrence can never execute twice.
 *  - Failures are recorded (status "failed" + Persian reason) and surfaced in
 *    history and on the automation card — never swallowed.
 *  - No AI, no autonomous agent: deterministic WHEN → IF → THEN only.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  AUTOMATION_TRIGGERS,
  dayKeyAt,
  describeAction,
  describeCondition,
  describeTrigger,
  evaluateConditions,
  localParts,
  nextTimeAt,
  renderTemplate,
  toFaNum,
  triggerDef,
  validateAutomation,
  type AutomationAction,
  type AutomationCondition,
  type AutomationEntity,
  type AutomationTrigger,
  type ConfigValue,
  type EntitySnapshot,
} from "./automationRules";

/* ------------------------------------------------------------------ */
/* Safety constants                                                    */
/* ------------------------------------------------------------------ */

/** Maximum chained execution depth (§10) — chains are refused beyond this. */
const MAX_DEPTH = 3;
/** Same-entity event cooldown: identical (automation, entity) events within
 *  this window are suppressed so one action can never spam notifications. */
const EVENT_COOLDOWN_MS = 10 * 60_000;
/** State triggers are re-evaluated at most every 10 minutes per automation. */
const STATE_EVAL_COOLDOWN_MS = 10 * 60_000;
/** Hard caps — one sweep can never scan unbounded data. */
const MAX_STATE_CANDIDATES = 25;
const MAX_AUTOMATIONS_PER_SWEEP = 12;
const MAX_PROJECTS_PER_EVAL = 30;
/** Working window used when an automation places a time block — mirrors the
 *  default scheduling preference (08:00–22:00); automation never schedules
 *  outside usable hours or on top of an existing block. */
const BLOCK_WINDOW_START = 8 * 60;
const BLOCK_WINDOW_END = 22 * 60;

type Ctx = QueryCtx | MutationCtx;

class ActionError extends Error {}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** "08:30" → minutes since midnight (NaN-safe → 0). */
function toMin(hhmm: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h < 10 ? "0" : ""}${h}:${m < 10 ? "0" : ""}${m}`;
}

/** Whole days from day key A to day key B (positive when B is later). */
function dayDiff(fromDay: string, toDay: string): number {
  const a = Date.parse(`${fromDay}T00:00:00Z`);
  const b = Date.parse(`${toDay}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

function cfgNumber(cfg: Record<string, ConfigValue> | undefined, key: string, fallback: number): number {
  const raw = cfg?.[key];
  const n = raw === undefined || Array.isArray(raw) ? NaN : Number(raw);
  return Number.isNaN(n) ? fallback : n;
}

const PRIORITIES = new Set(["low", "medium", "high", "urgent"]);

async function personaOf(ctx: Ctx, userId: Id<"users">): Promise<string> {
  const profile = await ctx.db
    .query("userProfile")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return profile?.personaKey || "personal";
}

function snap(
  entity: AutomationEntity,
  id: string,
  title: string,
  persona: string,
  fields: Record<string, ConfigValue>,
): EntitySnapshot {
  return { entity, id, title, persona, ...fields };
}

/* ------------------------------------------------------------------ */
/* Snapshot builders — only REAL fields that exist in the schema       */
/* ------------------------------------------------------------------ */

function taskSnapshot(d: Doc<"tasks">, persona: string, tz: number, now: number): EntitySnapshot {
  const today = dayKeyAt(now, tz);
  return snap("task", d._id, d.title, persona, {
    priority: d.priority,
    status: d.status,
    inProject: !!d.projectId,
    tag: (d.tags ?? []).join(" "),
    daysToDeadline: d.dueDate ? dayDiff(d.dueDate, today) : undefined,
  });
}

function projectSnapshot(
  d: Doc<"projects">,
  persona: string,
  tz: number,
  now: number,
  completionPct?: number,
): EntitySnapshot {
  const today = dayKeyAt(now, tz);
  return snap("project", d._id, d.name, persona, {
    status: d.status,
    completionPct,
    daysToDeadline: d.deadline ? dayDiff(d.deadline, today) : undefined,
  });
}

function goalSnapshot(d: Doc<"personalGoals"> | Record<string, unknown>, persona: string, tz: number, now: number): EntitySnapshot {
  const g = d as {
    _id: string;
    title: string;
    status: string;
    progress: number;
    dueDate?: string;
    updatedAt?: number;
    createdAt: number;
  };
  const today = dayKeyAt(now, tz);
  const lastActivity = g.updatedAt ?? g.createdAt;
  return snap("goal", g._id, g.title, persona, {
    status: g.status,
    progress: g.progress,
    inactiveDays: Math.max(0, Math.floor((now - lastActivity) / 86_400_000)),
    daysToDeadline: g.dueDate ? dayDiff(g.dueDate, today) : undefined,
  });
}

function examSnapshot(d: Doc<"exams">, persona: string, tz: number, now: number): EntitySnapshot {
  const today = dayKeyAt(now, tz);
  return snap("exam", d._id, d.title, persona, {
    status: d.completed ? "completed" : "pending",
    daysToDeadline: dayDiff(d.date, today),
  });
}

function deliverableSnapshot(d: Doc<"deliverables">, persona: string, tz: number, now: number): EntitySnapshot {
  const today = dayKeyAt(now, tz);
  return snap("deliverable", d._id, d.title, persona, {
    priority: d.priority,
    status: d.status,
    daysToDeadline: dayDiff(d.dueDate, today),
  });
}

function invoiceSnapshot(d: Doc<"invoices">, persona: string, tz: number, now: number): EntitySnapshot {
  const today = dayKeyAt(now, tz);
  return snap("invoice", d._id, d.title, persona, {
    status: d.status,
    daysToDeadline: dayDiff(d.dueDate, today),
  });
}

function opportunitySnapshot(
  d: Doc<"salesOpportunities">,
  persona: string,
  tz: number,
  now: number,
): EntitySnapshot {
  const today = dayKeyAt(now, tz);
  return snap("opportunity", d._id, d.title, persona, {
    status: d.stage,
    daysToDeadline: d.expectedCloseDate ? dayDiff(d.expectedCloseDate, today) : undefined,
  });
}

function blockSnapshot(d: Doc<"timeBlocks">, persona: string): EntitySnapshot {
  return snap("block", d._id, d.title, persona, { status: d.status ?? "planned" });
}

function executionSnapshot(
  d: { _id?: string; title?: string; actualMinutes?: number },
  persona: string,
  entity: AutomationEntity = "execution",
): EntitySnapshot {
  return snap(entity, d._id ?? "session", d.title || "نشست اجرا", persona, {
    actualMinutes: d.actualMinutes,
  });
}

/** All of the owner's tasks — loaded ONCE per evaluation, grouped locally. */
async function loadUserTasks(ctx: Ctx, userId: Id<"users">): Promise<Doc<"tasks">[]> {
  return await ctx.db
    .query("tasks")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
}

/** Completion % of a project from its REAL tasks (done / total, 0 if empty). */
function completionPctOf(tasks: Doc<"tasks">[], projectId: Id<"projects">): number {
  const mine = tasks.filter((t) => t.projectId === projectId && !t.archived);
  if (mine.length === 0) return 0;
  const done = mine.filter((t) => t.status === "done").length;
  return Math.round((done / mine.length) * 100);
}

/* ------------------------------------------------------------------ */
/* ActionService                                                       */
/* ------------------------------------------------------------------ */

/* Type alias (not interface) so it is assignable to renderTemplate's
 * Record<string, string> — interfaces lack implicit index signatures. */
type ActionVars = {
  title: string;
  date: string;
  entity: string;
  id: string;
  persona: string;
};

interface ActionResult {
  summary: string;
  detail?: Record<string, unknown>;
  notify?: { title: string; body?: string };
}

async function loadOwnedTask(
  ctx: MutationCtx,
  userId: Id<"users">,
  rawId: string,
): Promise<Doc<"tasks">> {
  const id = ctx.db.normalizeId("tasks", rawId);
  if (!id) throw new ActionError("کار موردنظر دیگر وجود ندارد.");
  const task = await ctx.db.get(id);
  if (!task || task.userId !== userId) throw new ActionError("کار موردنظر دیگر وجود ندارد.");
  return task;
}

async function runAction(
  ctx: MutationCtx,
  userId: Id<"users">,
  action: AutomationAction,
  vars: ActionVars,
  now: number,
  tz: number,
): Promise<ActionResult> {
  const cfg = (action.config ?? {}) as Record<string, ConfigValue>;

  switch (action.key) {
    case "notify": {
      const title = renderTemplate(String(cfg.title ?? "یادآوری خودکار"), vars).trim() || "یادآوری خودکار";
      const rawBody = String(cfg.body ?? "").trim();
      const body = rawBody ? renderTemplate(rawBody, vars) : undefined;
      return { summary: `اعلان «${title}»`, notify: { title, body } };
    }

    case "create_task": {
      const title = renderTemplate(String(cfg.title ?? ""), vars).trim();
      if (!title) throw new ActionError("عنوان کار در عمل «کار جدید بساز» خالی است.");
      const due = String(cfg.due ?? "today");
      let dueDate: string | undefined;
      if (due === "today") dueDate = dayKeyAt(now, tz);
      else if (due === "tomorrow") dueDate = dayKeyAt(now + 86_400_000, tz);
      else if (due === "in_days") dueDate = dayKeyAt(now + clamp(Math.round(cfgNumber(cfg, "days", 1)), 0, 60) * 86_400_000, tz);
      const priorityRaw = String(cfg.priority ?? "medium");
      const priority = PRIORITIES.has(priorityRaw) ? priorityRaw : "medium";
      const tags: string[] = [];
      const tag = String(cfg.tag ?? "").trim();
      if (tag) tags.push(tag);
      let projectId: Id<"projects"> | undefined;
      if (cfg.projectId !== undefined && cfg.projectId !== "") {
        const pid = ctx.db.normalizeId("projects", String(cfg.projectId));
        if (!pid) throw new ActionError("پروژه موردنظر دیگر وجود ندارد.");
        const proj = await ctx.db.get(pid);
        if (!proj || proj.userId !== userId) throw new ActionError("پروژه موردنظر دیگر وجود ندارد یا به آن دسترسی ندارید.");
        if (proj.archived) throw new ActionError("پروژه موردنظر بایگانی شده است.");
        projectId = pid;
      }
      const id = await ctx.db.insert("tasks", {
        userId,
        title,
        status: "todo",
        priority,
        dueDate,
        projectId,
        tags,
        sortOrder: 0,
        createdAt: now,
        archived: false,
      });
      return { summary: `ساخت کار «${title}»`, detail: { action: "create_task", taskId: id, dueDate } };
    }

    case "add_tag": {
      const tag = String(cfg.tag ?? "").trim();
      if (!tag) throw new ActionError("برچسب در عمل «برچسب اضافه کن» خالی است.");
      const task = await loadOwnedTask(ctx, userId, vars.id);
      if (!task.tags.includes(tag)) {
        await ctx.db.patch(task._id, { tags: [...task.tags, tag] });
      }
      return { summary: `افزودن برچسب «${tag}» به «${task.title}»`, detail: { action: "add_tag", taskId: task._id } };
    }

    case "set_priority": {
      const priorityRaw = String(cfg.priority ?? "high");
      if (!PRIORITIES.has(priorityRaw)) throw new ActionError("اولویت انتخاب‌شده معتبر نیست.");
      const task = await loadOwnedTask(ctx, userId, vars.id);
      await ctx.db.patch(task._id, { priority: priorityRaw });
      return {
        summary: `تغییر اولویت «${task.title}» به ${priorityRaw}`,
        detail: { action: "set_priority", taskId: task._id, priority: priorityRaw },
      };
    }

    case "create_time_block": {
      const title = renderTemplate(String(cfg.title ?? "بلوک زمانی"), vars).trim() || "بلوک زمانی";
      const dayOffset = String(cfg.day ?? "today") === "tomorrow" ? 1 : 0;
      const wantStart = clamp(toMin(String(cfg.start ?? "09:00")), 0, 24 * 60 - 15);
      const minutes = clamp(Math.round(cfgNumber(cfg, "minutes", 60)), 15, 480);
      const kind = String(cfg.kind ?? "focus");
      if (wantStart + minutes > BLOCK_WINDOW_END) {
        throw new ActionError("بلوک زمانی از بازه کاری روز (تا ساعت ۲۲:۰۰) بیرون می‌زند.");
      }

      const todayKey = dayKeyAt(now, tz);
      const nowMin = localParts(now, tz).hh * 60 + localParts(now, tz).mm;

      /** First free slot ≥ searchFrom that fits [start, start+minutes). */
      const findSlot = async (day: string, searchFrom: number): Promise<{ start: number; end: number } | null> => {
        const busy = await ctx.db
          .query("timeBlocks")
          .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
          .collect();
        const occupied = busy
          .filter((b) => b.status !== "cancelled")
          .map((b) => [toMin(b.startTime), toMin(b.endTime)] as const);
        const from = Math.max(searchFrom, BLOCK_WINDOW_START);
        const latest = BLOCK_WINDOW_END - minutes;
        for (let s = Math.ceil(from / 15) * 15; s <= latest; s += 15) {
          const e = s + minutes;
          const clash = occupied.some(([bs, be]) => s < be && e > bs);
          if (!clash) return { start: s, end: e };
        }
        return null;
      };

      let day = dayOffset === 1 ? dayKeyAt(now + 86_400_000, tz) : todayKey;
      // Today: never schedule in the past (small safety margin).
      const searchFrom = day === todayKey ? Math.max(wantStart, nowMin + 5) : wantStart;
      let slot = await findSlot(day, searchFrom);
      if (!slot && day === todayKey) {
        // No room today → try tomorrow at the configured start (§18: never
        // blindly create a conflicting block; move forward or fail visibly).
        day = dayKeyAt(now + 86_400_000, tz);
        slot = await findSlot(day, wantStart);
      }
      if (!slot) throw new ActionError("برای این بلوک زمانی جای خالی مناسبی در برنامه پیدا نشد.");

      const id = await ctx.db.insert("timeBlocks", {
        userId,
        title,
        day,
        startTime: minToHHMM(slot.start),
        endTime: minToHHMM(slot.end),
        kind,
        status: "planned",
        fixed: false,
        source: "automation",
        updatedAt: now,
        createdAt: now,
      });
      return {
        summary: `ساخت بلوک «${title}» (${day} — ${minToHHMM(slot.start)})`,
        detail: { action: "create_time_block", blockId: id, day, startTime: minToHHMM(slot.start) },
      };
    }

    case "create_note": {
      const title = renderTemplate(String(cfg.title ?? "یادداشت"), vars).trim() || "یادداشت";
      const body = renderTemplate(String(cfg.body ?? ""), vars);
      const id = await ctx.db.insert("personalNotes", {
        userId,
        title,
        body,
        tags: ["اتوماسیون"],
        createdAt: now,
        updatedAt: now,
      });
      return { summary: `ساخت یادداشت «${title}»`, detail: { action: "create_note", noteId: id } };
    }

    default:
      throw new ActionError(`عمل «${action.key}» پشتیبانی نمی‌شود.`);
  }
}

/* ------------------------------------------------------------------ */
/* AutomationExecutionService + safety (idempotency, loop protection)  */
/* ------------------------------------------------------------------ */

type ExecOutcome = "success" | "failed" | "duplicate" | "cooldown" | "condition" | "refused";

interface ExecOpts {
  origin: string;
  triggerLabel: string;
  /** Exact idempotency key — one history row per (automation, key). */
  dedupeKey: string;
  /** Key WITHOUT time bucket (event storms) for the cooldown guard. */
  dedupeBase?: string;
  snapshot: EntitySnapshot;
  depth: number;
  now: number;
  /** Record condition failures as "skipped" history rows (time origin). */
  recordSkip?: boolean;
}

async function executeAutomation(
  ctx: MutationCtx,
  userId: Id<"users">,
  auto: Doc<"automations">,
  opts: ExecOpts,
): Promise<ExecOutcome> {
  // — Loop protection: never run beyond the chain depth cap.
  if (opts.depth >= MAX_DEPTH) return "refused";
  // — Disabled between evaluation and execution.
  if (!auto.enabled) return "refused";

  // — Idempotency: this exact occurrence already ran.
  const dup = await ctx.db
    .query("automationExecutions")
    .withIndex("by_user_auto_key", (q) =>
      q.eq("userId", userId).eq("automationId", auto._id).eq("dedupeKey", opts.dedupeKey),
    )
    .first();
  if (dup) return "duplicate";

  // — Event cooldown: same automation + same entity fired moments ago.
  if (opts.origin.startsWith("event:") && opts.dedupeBase) {
    const cutoff = opts.now - EVENT_COOLDOWN_MS;
    const recent = await ctx.db
      .query("automationExecutions")
      .withIndex("by_user_at", (q) => q.eq("userId", userId).gt("at", cutoff))
      .take(120);
    const storm = recent.some(
      (e) => e.automationId === auto._id && e.dedupeKey.startsWith(opts.dedupeBase!),
    );
    if (storm) return "cooldown";
  }

  const day = dayKeyAt(opts.now, auto.tzOffsetMinutes);
  const base = {
    userId,
    automationId: auto._id,
    automationName: auto.name,
    dedupeKey: opts.dedupeKey,
    origin: opts.origin,
    triggerLabel: opts.triggerLabel,
    depth: opts.depth,
    at: opts.now,
    day,
  };

  // — ConditionService (AND, pure).
  const conditionResult = evaluateConditions(
    (auto.conditions ?? []) as AutomationCondition[],
    opts.snapshot,
  );
  if (!conditionResult.ok) {
    if (!opts.recordSkip) return "condition";
    await ctx.db.insert("automationExecutions", {
      ...base,
      status: "skipped",
      actionSummary: "شرط‌ها برقرار نبود",
      reason: conditionResult.reason ?? "شرطی برقرار نیست.",
    });
    await ctx.db.patch(auto._id, {
      lastStatus: "skipped",
      lastFailureReason: undefined,
    });
    return "condition";
  }

  // — ActionService: run actions in order; first failure is recorded.
  const vars: ActionVars = {
    title: opts.snapshot.title,
    date: day,
    entity: opts.snapshot.entity,
    id: opts.snapshot.id,
    persona: opts.snapshot.persona,
  };
  const summaries: string[] = [];
  const details: Array<Record<string, unknown>> = [];
  let notifyTitle: string | undefined;
  let notifyBody: string | undefined;

  for (const action of (auto.actions ?? []) as AutomationAction[]) {
    try {
      const res = await runAction(ctx, userId, action, vars, opts.now, auto.tzOffsetMinutes);
      summaries.push(res.summary);
      if (res.detail) details.push(res.detail);
      if (res.notify) {
        notifyTitle = res.notify.title;
        notifyBody = res.notify.body;
      }
    } catch (err) {
      const reason =
        err instanceof ActionError
          ? err.message
          : "خطای ناشناخته هنگام اجرای عمل. لطفاً دوباره تلاش کن.";
      await ctx.db.insert("automationExecutions", {
        ...base,
        status: "failed",
        actionSummary: summaries.join(" • "),
        reason,
        details: JSON.stringify({ failedAction: action.key, done: details }),
      });
      await ctx.db.patch(auto._id, {
        lastExecutedAt: opts.now,
        runCount: auto.runCount + 1,
        lastStatus: "failed",
        lastFailureReason: reason,
      });
      return "failed";
    }
  }

  await ctx.db.insert("automationExecutions", {
    ...base,
    status: "success",
    actionSummary: summaries.join(" • ") || "بدون عمل",
    details: JSON.stringify(details),
    notify: notifyTitle ? true : undefined,
    notifyTitle,
    notifyBody,
  });
  await ctx.db.patch(auto._id, {
    lastExecutedAt: opts.now,
    runCount: auto.runCount + 1,
    lastStatus: "success",
    lastFailureReason: undefined,
  });
  return "success";
}

/* ------------------------------------------------------------------ */
/* TriggerService — event triggers                                     */
/* ------------------------------------------------------------------ */

async function buildSnapshotFromDoc(
  ctx: Ctx,
  userId: Id<"users">,
  entity: AutomationEntity | undefined,
  doc: unknown,
  id: string | undefined,
  persona: string,
  tz: number,
  now: number,
): Promise<EntitySnapshot | null> {
  if (!entity) return null;
  if (entity === "task") {
    if (doc) return taskSnapshot(doc as Doc<"tasks">, persona, tz, now);
    if (id) {
      const tid = ctx.db.normalizeId("tasks", id);
      if (tid) {
        const t = await ctx.db.get(tid);
        if (t && t.userId === userId) return taskSnapshot(t, persona, tz, now);
      }
    }
    return null;
  }
  if (entity === "project") {
    const tasks = await loadUserTasks(ctx, userId);
    if (doc) {
      const p = doc as Doc<"projects">;
      return projectSnapshot(p, persona, tz, now, completionPctOf(tasks, p._id));
    }
    if (id) {
      const pid = ctx.db.normalizeId("projects", id);
      if (pid) {
        const p = await ctx.db.get(pid);
        if (p && p.userId === userId) {
          return projectSnapshot(p, persona, tz, now, completionPctOf(tasks, pid));
        }
      }
    }
    return null;
  }
  if (entity === "goal" && doc) return goalSnapshot(doc as Record<string, unknown>, persona, tz, now);
  if (entity === "exam" && doc) return examSnapshot(doc as Doc<"exams">, persona, tz, now);
  if (entity === "deliverable" && doc) return deliverableSnapshot(doc as Doc<"deliverables">, persona, tz, now);
  if (entity === "invoice" && doc) return invoiceSnapshot(doc as Doc<"invoices">, persona, tz, now);
  if (entity === "opportunity" && doc) return opportunitySnapshot(doc as Doc<"salesOpportunities">, persona, tz, now);
  if (entity === "block" && doc) return blockSnapshot(doc as Doc<"timeBlocks">, persona);
  if (entity === "execution" && doc) return executionSnapshot(doc as { _id?: string; title?: string; actualMinutes?: number }, persona);
  return null;
}

export interface EventFireOpts {
  entity?: AutomationEntity;
  /** Document id as string (used for the dedupe key). */
  id?: string;
  /** The row itself (preferred — no re-read). Goals REQUIRE this. */
  doc?: unknown;
  /** Prebuilt snapshot (progress events). */
  snapshot?: EntitySnapshot;
  /** Occurrence token for idempotency (defaults to a per-minute bucket). */
  token?: string;
  /** Chain depth (default 0). */
  depth?: number;
}

/**
 * TriggerService entry point — call from host mutations after the data change
 * is written. NEVER throws: automation must never break the mutation that
 * produced the event (§24 / §25). Cheap early-exit when no automation listens.
 */
export async function fireAutomationEvent(
  ctx: MutationCtx,
  userId: Id<"users">,
  eventKey: string,
  opts: EventFireOpts = {},
): Promise<void> {
  try {
    const depth = opts.depth ?? 0;
    if (depth >= MAX_DEPTH) return;

    const enabled = await ctx.db
      .query("automations")
      .withIndex("by_user_enabled", (q) => q.eq("userId", userId).eq("enabled", true))
      .collect();
    const matching = enabled.filter(
      (a) => a.trigger?.kind === "event" && a.trigger.key === eventKey,
    );
    if (matching.length === 0) return;

    const now = Date.now();
    const persona = opts.snapshot ? opts.snapshot.persona || (await personaOf(ctx, userId)) : await personaOf(ctx, userId);
    const bucket = opts.token ?? String(Math.floor(now / 60_000));
    const def = AUTOMATION_TRIGGERS[eventKey];

    for (const auto of matching) {
      const tz = auto.tzOffsetMinutes;
      const snapshot =
        opts.snapshot && !opts.doc
          ? opts.snapshot
          : (await buildSnapshotFromDoc(ctx, userId, opts.entity, opts.doc, opts.id, persona, tz, now)) ??
            opts.snapshot;
      if (!snapshot) continue;
      const entityId = opts.id ?? snapshot.id;
      const base = `event:${eventKey}:${entityId}`;
      await executeAutomation(ctx, userId, auto, {
        origin: `event:${eventKey}`,
        triggerLabel: `${def?.label ?? eventKey} — «${snapshot.title}»`,
        dedupeKey: `${base}:${bucket}`,
        dedupeBase: base,
        snapshot,
        depth,
        now,
      });
    }
  } catch (err) {
    // Safety: an automation failure must never break the host mutation.
    console.error("[automations] event fire failed", err);
  }
}

/**
 * Convenience hook for the progression engine (level / achievement events).
 * One line at the call site; builds the "progress" snapshot internally.
 */
export async function fireProgressEvent(
  ctx: MutationCtx,
  userId: Id<"users">,
  eventKey: "level_reached" | "achievement_unlocked",
  args: { level: number; token: string; title?: string },
): Promise<void> {
  try {
    const persona = await personaOf(ctx, userId);
    const snapshot = snap("progress", args.token, args.title ?? `سطح ${args.level}`, persona, {
      level: args.level,
    });
    await fireAutomationEvent(ctx, userId, eventKey, {
      entity: "progress",
      snapshot,
      token: args.token,
    });
  } catch (err) {
    console.error("[automations] progress event failed", err);
  }
}

/* ------------------------------------------------------------------ */
/* TriggerService — state candidates (daily deterministic sweep)       */
/* ------------------------------------------------------------------ */

interface Candidate {
  snapshot: EntitySnapshot;
  /** Idempotency key: state:<trigger>:<entity>[:<day>]. */
  dedupe: string;
}

async function collectStateCandidates(
  ctx: Ctx,
  userId: Id<"users">,
  trigger: AutomationTrigger,
  tz: number,
  now: number,
): Promise<Candidate[]> {
  const today = dayKeyAt(now, tz);
  const cfg = (trigger.config ?? {}) as Record<string, ConfigValue>;
  const out: Candidate[] = [];
  const persona = await personaOf(ctx, userId);
  const push = (snapshot: EntitySnapshot, dedupe: string) => {
    if (out.length < MAX_STATE_CANDIDATES) out.push({ snapshot, dedupe });
  };

  switch (trigger.key) {
    case "task_overdue": {
      const rows = await ctx.db
        .query("tasks")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const t of rows) {
        if (t.archived || t.status === "done" || !t.dueDate) continue;
        if (t.dueDate < today) {
          push(taskSnapshot(t, persona, tz, now), `state:task_overdue:${t._id}:${today}`);
        }
      }
      break;
    }

    case "task_due_soon": {
      const days = clamp(Math.round(cfgNumber(cfg, "days", 1)), 1, 30);
      const until = dayKeyAt(now + days * 86_400_000, tz);
      const rows = await ctx.db
        .query("tasks")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const t of rows) {
        if (t.archived || t.status === "done" || !t.dueDate) continue;
        if (t.dueDate >= today && t.dueDate <= until) {
          push(taskSnapshot(t, persona, tz, now), `state:task_due_soon:${t._id}:${today}`);
        }
      }
      break;
    }

    case "project_deadline_soon": {
      const days = clamp(Math.round(cfgNumber(cfg, "days", 1)), 1, 90);
      const until = dayKeyAt(now + days * 86_400_000, tz);
      const rows = await ctx.db
        .query("projects")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const p of rows) {
        if (p.archived || p.status === "completed" || !p.deadline) continue;
        if (p.deadline >= today && p.deadline <= until) {
          push(projectSnapshot(p, persona, tz, now), `state:project_deadline_soon:${p._id}:${today}`);
        }
      }
      break;
    }

    case "project_completion_reached": {
      const threshold = clamp(Math.round(cfgNumber(cfg, "thresholdPct", 80)), 1, 100);
      const rows = await ctx.db
        .query("projects")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      const tasks = await loadUserTasks(ctx, userId);
      let checked = 0;
      for (const p of rows) {
        if (checked >= MAX_PROJECTS_PER_EVAL) break;
        if (p.archived || p.status === "completed") continue;
        checked++;
        const pct = completionPctOf(tasks, p._id);
        if (pct >= threshold) {
          // Once per project — reaching a threshold is a milestone, not a daily state.
          push(projectSnapshot(p, persona, tz, now, pct), `state:project_completion_reached:${p._id}`);
        }
      }
      break;
    }

    case "goal_inactive": {
      const days = clamp(Math.round(cfgNumber(cfg, "days", 7)), 1, 90);
      const tables = ["personalGoals", "workGoals", "teamGoals", "businessGoals"] as const;
      for (const table of tables) {
        const rows = await ctx.db
          .query(table)
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect();
        for (const g of rows) {
          const row = g as unknown as {
            _id: string;
            title: string;
            status: string;
            progress: number;
            dueDate?: string;
            updatedAt?: number;
            createdAt: number;
          };
          if (row.status !== "active") continue;
          const lastActivity = row.updatedAt ?? row.createdAt;
          const inactiveDays = Math.floor((now - lastActivity) / 86_400_000);
          if (inactiveDays >= days) {
            push(goalSnapshot(row, persona, tz, now), `state:goal_inactive:${table}:${row._id}:${today}`);
          }
        }
      }
      break;
    }

    case "exam_upcoming": {
      const days = clamp(Math.round(cfgNumber(cfg, "days", 7)), 1, 60);
      const until = dayKeyAt(now + days * 86_400_000, tz);
      const rows = await ctx.db
        .query("exams")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const e of rows) {
        if (e.completed || e.archived) continue;
        if (e.date >= today && e.date <= until) {
          push(examSnapshot(e, persona, tz, now), `state:exam_upcoming:${e._id}:${today}`);
        }
      }
      break;
    }

    case "deliverable_overdue": {
      const rows = await ctx.db
        .query("deliverables")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const d of rows) {
        if (d.status === "delivered" || d.status === "approved") continue;
        if (d.dueDate < today) {
          push(deliverableSnapshot(d, persona, tz, now), `state:deliverable_overdue:${d._id}:${today}`);
        }
      }
      break;
    }

    case "invoice_due_soon": {
      const days = clamp(Math.round(cfgNumber(cfg, "days", 3)), 1, 45);
      const until = dayKeyAt(now + days * 86_400_000, tz);
      const rows = await ctx.db
        .query("invoices")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const inv of rows) {
        if (inv.status === "paid" || inv.status === "cancelled") continue;
        if (inv.dueDate >= today && inv.dueDate <= until) {
          push(invoiceSnapshot(inv, persona, tz, now), `state:invoice_due_soon:${inv._id}:${today}`);
        }
      }
      break;
    }

    case "opportunity_closing_soon": {
      const days = clamp(Math.round(cfgNumber(cfg, "days", 3)), 1, 60);
      const until = dayKeyAt(now + days * 86_400_000, tz);
      const rows = await ctx.db
        .query("salesOpportunities")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const o of rows) {
        if (o.stage === "won" || o.stage === "lost" || !o.expectedCloseDate) continue;
        if (o.expectedCloseDate >= today && o.expectedCloseDate <= until) {
          push(opportunitySnapshot(o, persona, tz, now), `state:opportunity_closing_soon:${o._id}:${today}`);
        }
      }
      break;
    }

    case "time_block_missed": {
      // Only recent windows — never a burst of ancient missed blocks.
      const since = dayKeyAt(now - 3 * 86_400_000, tz);
      const rows = await ctx.db
        .query("timeBlocks")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const b of rows) {
        if (b.day < since || b.day >= today) continue;
        const missed = b.status === "missed" || (b.status ?? "planned") === "planned";
        if (missed) {
          push(blockSnapshot(b, persona), `state:time_block_missed:${b._id}`);
        }
      }
      break;
    }

    default:
      break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Sweep — time triggers + state triggers (opportunistic, no cron in   */
/* this project; invoked by the client on load + every 10 minutes,     */
/* guarded by per-automation cooldowns so DB traffic stays bounded)    */
/* ------------------------------------------------------------------ */

async function sweepTimeAutomation(
  ctx: MutationCtx,
  userId: Id<"users">,
  auto: Doc<"automations">,
  now: number,
): Promise<boolean> {
  const tz = auto.tzOffsetMinutes;
  const due = auto.nextExecutionAt;

  if (due === undefined) {
    const next = nextTimeAt(auto.trigger as AutomationTrigger, tz, now);
    await ctx.db.patch(auto._id, { nextExecutionAt: next ?? undefined });
    return false;
  }
  if (due > now) return false;

  const snapshot = snap("any", auto._id, auto.name, await personaOf(ctx, userId), {});
  const outcome = await executeAutomation(ctx, userId, auto, {
    origin: "time",
    triggerLabel: describeTrigger(auto.trigger as AutomationTrigger),
    dedupeKey: `time:${due}`,
    snapshot,
    depth: 0,
    now,
    recordSkip: true,
  });

  // Advance the schedule past "now" (catches up over missed occurrences by
  // firing once and jumping to the next future slot). Only a cooldown/refusal
  // leaves the occurrence pending for the next sweep.
  if (outcome !== "cooldown" && outcome !== "refused") {
    const next = nextTimeAt(auto.trigger as AutomationTrigger, tz, now);
    await ctx.db.patch(auto._id, { nextExecutionAt: next ?? undefined });
  }
  return outcome === "success" || outcome === "failed";
}

async function sweepStateAutomation(
  ctx: MutationCtx,
  userId: Id<"users">,
  auto: Doc<"automations">,
  now: number,
): Promise<boolean> {
  if (auto.lastEvaluatedAt && now - auto.lastEvaluatedAt < STATE_EVAL_COOLDOWN_MS) return false;
  // Stamp immediately so a slow evaluation is never re-entered.
  await ctx.db.patch(auto._id, { lastEvaluatedAt: now });

  const tz = auto.tzOffsetMinutes;
  const trigger = auto.trigger as AutomationTrigger;
  const candidates = await collectStateCandidates(ctx, userId, trigger, tz, now);
  let fired = false;
  for (const cand of candidates) {
    const outcome = await executeAutomation(ctx, userId, auto, {
      origin: "state",
      triggerLabel: `${describeTrigger(trigger)} — «${cand.snapshot.title}»`,
      dedupeKey: cand.dedupe,
      snapshot: cand.snapshot,
      depth: 0,
      now,
    });
    if (outcome === "success" || outcome === "failed") fired = true;
  }
  return fired;
}

/**
 * Evaluate due time triggers + state triggers for the calling user.
 * Deterministic, bounded, idempotent — safe to call as often as the client
 * likes: cooldowns and dedupe keys make extra calls cheap no-ops.
 */
export const sweep = mutation({
  args: { tzOffsetMinutes: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { fired: 0 };
    const now = Date.now();
    let fired = 0;
    let processed = 0;

    const autos = await ctx.db
      .query("automations")
      .withIndex("by_user_enabled", (q) => q.eq("userId", userId).eq("enabled", true))
      .collect();

    for (const auto of autos) {
      if (processed >= MAX_AUTOMATIONS_PER_SWEEP) break;
      const kind = auto.trigger?.kind;
      if (kind === "time") {
        processed++;
        if (await sweepTimeAutomation(ctx, userId, auto, now)) fired++;
      } else if (kind === "state") {
        if (auto.lastEvaluatedAt && now - auto.lastEvaluatedAt < STATE_EVAL_COOLDOWN_MS) continue;
        processed++;
        if (await sweepStateAutomation(ctx, userId, auto, now)) fired++;
      }
    }
    return { fired };
  },
});

/* ------------------------------------------------------------------ */
/* AutomationValidationService + CRUD                                  */
/* ------------------------------------------------------------------ */

const defArgs = {
  name: v.string(),
  description: v.optional(v.string()),
  enabled: v.optional(v.boolean()),
  trigger: v.any(),
  conditions: v.array(v.any()),
  actions: v.array(v.any()),
  createdFromTemplate: v.optional(v.string()),
  /** Fixed offset of the owner's device (minutes east of UTC). */
  tzOffsetMinutes: v.number(),
};

function cleanName(raw: string): string {
  return raw.trim().slice(0, 120);
}

export const create = mutation({
  args: defArgs,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { ok: false as const, issues: ["ابتدا وارد حساب کاربری شو."] };
    const name = cleanName(args.name);
    const validation = validateAutomation({
      name,
      description: args.description,
      trigger: args.trigger,
      conditions: args.conditions,
      actions: args.actions,
    });
    if (!validation.ok) return { ok: false as const, issues: validation.issues };

    const now = Date.now();
    const tz = args.tzOffsetMinutes;
    const trigger = args.trigger as AutomationTrigger;
    const next = trigger.kind === "time" ? nextTimeAt(trigger, tz, now) : undefined;
    const id = await ctx.db.insert("automations", {
      userId,
      name,
      description: args.description?.trim() || undefined,
      enabled: args.enabled ?? true,
      trigger,
      conditions: args.conditions,
      actions: args.actions,
      createdFromTemplate: args.createdFromTemplate,
      tzOffsetMinutes: tz,
      createdAt: now,
      updatedAt: now,
      nextExecutionAt: next ?? undefined,
      runCount: 0,
    });
    return { ok: true as const, id };
  },
});

export const update = mutation({
  args: { id: v.id("automations"), ...defArgs },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { ok: false as const, issues: ["ابتدا وارد حساب کاربری شو."] };
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) {
      return { ok: false as const, issues: ["این اتوماسیون پیدا نشد."] };
    }
    const name = cleanName(args.name);
    const validation = validateAutomation({
      name,
      description: args.description,
      trigger: args.trigger,
      conditions: args.conditions,
      actions: args.actions,
    });
    if (!validation.ok) return { ok: false as const, issues: validation.issues };

    const now = Date.now();
    const trigger = args.trigger as AutomationTrigger;
    const next = trigger.kind === "time" ? nextTimeAt(trigger, args.tzOffsetMinutes, now) : undefined;
    await ctx.db.patch(args.id, {
      name,
      description: args.description?.trim() || undefined,
      enabled: args.enabled ?? existing.enabled,
      trigger,
      conditions: args.conditions,
      actions: args.actions,
      tzOffsetMinutes: args.tzOffsetMinutes,
      nextExecutionAt: next ?? undefined,
      updatedAt: now,
    });
    return { ok: true as const, id: args.id };
  },
});

export const setEnabled = mutation({
  args: {
    id: v.id("automations"),
    enabled: v.boolean(),
    tzOffsetMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const auto = await ctx.db.get(args.id);
    if (!auto || auto.userId !== userId) throw new Error("Not found");
    const now = Date.now();
    const patch: Record<string, unknown> = { enabled: args.enabled, updatedAt: now };
    if (args.tzOffsetMinutes !== undefined) patch.tzOffsetMinutes = args.tzOffsetMinutes;
    if (args.enabled && auto.trigger?.kind === "time") {
      const tz = args.tzOffsetMinutes ?? auto.tzOffsetMinutes;
      // (Re)arm the schedule only when missing or already in the past.
      if (auto.nextExecutionAt === undefined || auto.nextExecutionAt <= now) {
        patch.nextExecutionAt = nextTimeAt(auto.trigger as AutomationTrigger, tz, now) ?? undefined;
      }
    }
    await ctx.db.patch(args.id, patch);
    return { ok: true as const };
  },
});

/** Duplicate — created DISABLED so a copy can never double-fire silently. */
export const duplicate = mutation({
  args: { id: v.id("automations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const auto = await ctx.db.get(args.id);
    if (!auto || auto.userId !== userId) throw new Error("Not found");
    const now = Date.now();
    const trigger = auto.trigger as AutomationTrigger;
    const next = trigger.kind === "time" ? nextTimeAt(trigger, auto.tzOffsetMinutes, now) : undefined;
    const id = await ctx.db.insert("automations", {
      userId,
      name: `${auto.name} (کپی)`.slice(0, 120),
      description: auto.description,
      enabled: false,
      trigger,
      conditions: auto.conditions,
      actions: auto.actions,
      createdFromTemplate: auto.createdFromTemplate,
      tzOffsetMinutes: auto.tzOffsetMinutes,
      createdAt: now,
      updatedAt: now,
      nextExecutionAt: next ?? undefined,
      runCount: 0,
    });
    return { ok: true as const, id };
  },
});

/** Deletes the rule; history rows survive (denormalized name) for audit. */
export const remove = mutation({
  args: { id: v.id("automations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const auto = await ctx.db.get(args.id);
    if (!auto || auto.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
    return { ok: true as const };
  },
});

/* ------------------------------------------------------------------ */
/* Queries — owner-scoped                                              */
/* ------------------------------------------------------------------ */

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("automations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const history = query({
  args: {
    limit: v.optional(v.number()),
    automationId: v.optional(v.id("automations")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("automationExecutions")
      .withIndex("by_user_at", (q) => q.eq("userId", userId))
      .order("desc")
      .take(300);
    const filtered = args.automationId
      ? rows.filter((r) => r.automationId === args.automationId)
      : rows;
    return filtered.slice(0, clamp(args.limit ?? 50, 1, 200));
  },
});

/**
 * Automation notification channel — rows produced by the `notify` action.
 * Surfaced by the EXISTING bell popover (no second notification system).
 */
export const notifications = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const cutoff = Date.now() - 3 * 86_400_000;
    const rows = await ctx.db
      .query("automationExecutions")
      .withIndex("by_user_at", (q) => q.eq("userId", userId).gt("at", cutoff))
      .order("desc")
      .take(80);
    return rows
      .filter((r) => r.notify && r.notifyTitle)
      .slice(0, 6)
      .map((r) => ({
        id: r._id,
        title: r.notifyTitle as string,
        body: r.notifyBody ?? `${r.automationName} — اجرای خودکار`,
        at: r.at,
        automationName: r.automationName,
      }));
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { total: 0, enabled: 0, runs7d: 0, failed7d: 0, lastRun: null as number | null };
    const autos = await ctx.db
      .query("automations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const cutoff = Date.now() - 7 * 86_400_000;
    const recent = await ctx.db
      .query("automationExecutions")
      .withIndex("by_user_at", (q) => q.eq("userId", userId).gt("at", cutoff))
      .take(300);
    return {
      total: autos.length,
      enabled: autos.filter((a) => a.enabled).length,
      runs7d: recent.length,
      failed7d: recent.filter((r) => r.status === "failed").length,
      lastRun: recent.length ? recent[0].at : autos.reduce<number | null>((m, a) => (a.lastExecutedAt && (!m || a.lastExecutedAt > m) ? a.lastExecutedAt : m), null),
    };
  },
});

/* ------------------------------------------------------------------ */
/* Test / Preview mode (§23) — READ-ONLY dry run, never executes       */
/* ------------------------------------------------------------------ */

export const preview = query({
  args: {
    trigger: v.any(),
    conditions: v.array(v.any()),
    actions: v.array(v.any()),
    tzOffsetMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { ok: false as const, issues: ["ابتدا وارد حساب کاربری شو."] };
    }
    const tz = args.tzOffsetMinutes ?? -new Date().getTimezoneOffset();
    const validation = validateAutomation({
      name: "پیش‌نمایش",
      trigger: args.trigger,
      conditions: args.conditions,
      actions: args.actions,
    });
    const trigger = args.trigger as AutomationTrigger;
    const conditions = (args.conditions ?? []) as AutomationCondition[];
    const actions = (args.actions ?? []) as AutomationAction[];
    const now = Date.now();

    const wouldCreate = { notifications: 0, tasks: 0, blocks: 0, notes: 0, patches: 0 };
    for (const a of actions) {
      if (a.key === "notify") wouldCreate.notifications++;
      else if (a.key === "create_task") wouldCreate.tasks++;
      else if (a.key === "create_time_block") wouldCreate.blocks++;
      else if (a.key === "create_note") wouldCreate.notes++;
      else wouldCreate.patches++;
    }
    const effects: string[] = [];
    if (wouldCreate.notifications) effects.push(`${toFaNum(wouldCreate.notifications)} اعلان`);
    if (wouldCreate.tasks) effects.push(`${toFaNum(wouldCreate.tasks)} کار جدید`);
    if (wouldCreate.blocks) effects.push(`${toFaNum(wouldCreate.blocks)} بلوک زمانی`);
    if (wouldCreate.notes) effects.push(`${toFaNum(wouldCreate.notes)} یادداشت`);
    if (wouldCreate.patches) effects.push(`${toFaNum(wouldCreate.patches)} ویرایش کار`);
    const effectText = effects.length ? effects.join("، ") : "هیچ تغییری";

    if (!validation.ok) {
      return {
        ok: false as const,
        issues: validation.issues,
        triggerText: describeTrigger(trigger),
        conditionTexts: conditions.map(describeCondition),
        actionTexts: actions.map(describeAction),
        nextAt: null as number | null,
        matchCount: null as number | null,
        wouldCreate,
        summary: "این اتوماسیون هنوز معتبر نیست.",
      };
    }

    const triggerDef_ = triggerDef(trigger.key);
    const kind = triggerDef_?.kind;

    let nextAt: number | null = null;
    let matchCount: number | null = null;
    let summary: string;

    if (kind === "time") {
      nextAt = nextTimeAt(trigger, tz, now);
      const persona = await personaOf(ctx, userId);
      const synthetic = snap("any", "", "", persona, {});
      const cond = evaluateConditions(conditions, synthetic);
      if (nextAt === null) {
        summary = "این زمان‌بندی دیگر اجرا نمی‌شود (تاریخ گذشته یا نامعتبر).";
      } else if (!cond.ok) {
        const p = localParts(nextAt, tz);
        summary = `اجرای بعدی: ${dayKeyAt(nextAt, tz)} ساعت ${toFaNum(`${p.hh}:${p.mm < 10 ? "0" : ""}${p.mm}`)} — اما شرط‌ها الان برقرار نیستند (${cond.reason ?? ""})`;
      } else {
        const p = localParts(nextAt, tz);
        summary = `اگر اجرا شود: ${toFaNum(dayKeyAt(nextAt, tz))} ساعت ${toFaNum(`${p.hh}:${p.mm < 10 ? "0" : ""}${p.mm}`)} — ${effectText}.`;
      }
    } else if (kind === "state") {
      const candidates = await collectStateCandidates(ctx, userId, trigger, tz, now);
      let passing = 0;
      for (const c of candidates) {
        const r = evaluateConditions(conditions, c.snapshot);
        if (r.ok) passing++;
      }
      matchCount = passing;
      summary =
        passing > 0
          ? `الان ${toFaNum(passing)} مورد مطابق داری؛ اگر همین حالا اجرا می‌شد: ${effectText}.`
          : `الان مورد مطابقی نیست؛ در اولین رویداد مطابق اجرا می‌شود و ${effectText}.`;
    } else {
      const persona = await personaOf(ctx, userId);
      const synthetic = snap(triggerDef_?.entity ?? "any", "", "", persona, {});
      const cond = evaluateConditions(conditions, synthetic);
      summary = cond.ok
        ? `با اولین «${describeTrigger(trigger)}» اجرا می‌شود — ${effectText}.`
        : `با اولین «${describeTrigger(trigger)}» بررسی می‌شود، اما شرط‌ها الان برقرار نیستند (${cond.reason ?? ""}).`;
    }

    return {
      ok: true as const,
      issues: [] as string[],
      triggerText: describeTrigger(trigger),
      conditionTexts: conditions.map(describeCondition),
      actionTexts: actions.map(describeAction),
      nextAt,
      matchCount,
      wouldCreate,
      summary,
    };
  },
});
