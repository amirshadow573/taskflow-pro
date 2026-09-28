/**
 * ExecutionEngine — backend service layer (Phase 12).
 *
 * Closes the loop between planning and reality:
 *
 *   PlanningEngine → SchedulingEngine → TimeBlocks → Execution
 *        → ExecutionEvents → Deviation/Recovery → updated plan
 *
 * Design rules honored here:
 *   - A session records what HAPPENED; the task keeps its own status (§3).
 *     `executionSessions` never overwrites task status except through the one
 *     completion path (taskCore.setTaskDone), which owns XP (§22).
 *   - Starting work is idempotent in effect: an unfinished previous session is
 *     closed as `replaced`, so a browser refresh can never leave two live
 *     sessions behind (§35).
 *   - Nothing here is destructive or automatic: consequential schedule changes
 *     still go through the existing controlled mutations after confirmation
 *     (§29). `logRecovery` only audits the user's decision (§36).
 *   - Durations are always derived from timestamps, clamped at zero — no
 *     negative or impossible durations can be stored (§30).
 *
 * Services (spec §2):
 *   ExecutionSessionService     startSession / pauseSession / resumeSession
 *   ExecutionOutcomeService     completeSession / abandonSession
 *   ExecutionTrackingService    recordExecutionEvent (taskCore) + logRecovery
 *   ExecutionFeedbackService    submitFeedback
 *   ActualDurationService       elapsedOf / actualMinutesOf
 *   PlanningFeedbackService     sessionsInRange / eventsInRange (read models)
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { createFocusSessionRow } from "./employee";
import { localDayKey, recordExecutionEvent, setTaskDone } from "./taskCore";

/** Minimum recorded work time — a session is never stored as zero minutes. */
const MIN_ACTUAL_MINUTES = 1;
/** Upper bound so a forgotten timer can never claim an impossible duration. */
const MAX_ACTUAL_MINUTES = 24 * 60;
/** Persian tag the planning engine already understands as "blocked" (§9). */
const BLOCKED_TAG = "مسدود";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function requireUserId(ctx: MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

function clampMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return MIN_ACTUAL_MINUTES;
  return Math.min(MAX_ACTUAL_MINUTES, Math.max(MIN_ACTUAL_MINUTES, Math.round(minutes)));
}

/** Wall-clock work time in ms: elapsed minus every completed/current pause. */
function elapsedOf(session: Doc<"executionSessions">, now: number): number {
  const end = session.endedAt ?? now;
  const paused = session.pausedMs + (session.pausedAt ? Math.max(0, end - session.pausedAt) : 0);
  return Math.max(0, end - session.startedAt - paused);
}

function minutesOf(elapsedMs: number): number {
  return clampMinutes(elapsedMs / 60000);
}

/** Active = the user is (or believes they are) working right now. */
const ACTIVE_STATES = ["in_progress", "paused"] as const;

/** Close an open session without pretending work happened. */
async function closeAsReplaced(
  ctx: MutationCtx,
  session: Doc<"executionSessions">,
  now: number,
): Promise<void> {
  await ctx.db.patch(session._id, {
    state: "abandoned",
    endedAt: now,
    pausedMs: session.pausedMs + (session.pausedAt ? Math.max(0, now - session.pausedAt) : 0),
    pausedAt: undefined,
    elapsedMs: elapsedOf(session, now),
    endedReason: "replaced",
    updatedAt: now,
  });
  await recordExecutionEvent(ctx, {
    userId: session.userId,
    type: "EXECUTION_REPLACED",
    label: `جلسه قبلی بسته شد: «${session.title}»`,
    source: "system",
    at: now,
    taskId: session.taskId,
    blockId: session.blockId,
    projectId: session.projectId,
  });
}

/* ------------------------------------------------------------------ */
/* Queries — read models (§16 / §31)                                   */
/* ------------------------------------------------------------------ */

/**
 * The live session, if any — the recovery contract for a browser refresh
 * (§35). Returns null when nothing is running, so the UI can never show a
 * timer that the backend disagrees with.
 */
export const activeSession = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const rows = await ctx.db
      .query("executionSessions")
      .withIndex("by_user_state", (q) => q.eq("userId", userId).eq("state", "in_progress"))
      .collect();
    const paused = await ctx.db
      .query("executionSessions")
      .withIndex("by_user_state", (q) => q.eq("userId", userId).eq("state", "paused"))
      .collect();
    const all = [...rows, ...paused];
    if (all.length === 0) return null;
    return all.sort((a, b) => b.startedAt - a.startedAt)[0];
  },
});

/** Every session for one local day (today's execution surface). */
export const sessionsForDay = query({
  args: { day: v.string() },
  handler: async (ctx, { day }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("executionSessions")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
      .collect();
  },
});

/**
 * Sessions across a day range (inclusive) — the weekly-insight read model.
 * Range query on the composite day index, never a full table scan (§31).
 */
export const sessionsInRange = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("executionSessions")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", from).lte("day", to),
      )
      .collect();
  },
});

/** Execution history for one task — estimate learning + repeated delay (§13/§14). */
export const sessionsForTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("executionSessions")
      .withIndex("by_task", (q) => q.eq("userId", userId).eq("taskId", taskId))
      .collect();
  },
});

/** Auditable event log for one day (§36). */
export const eventsForDay = query({
  args: { day: v.string() },
  handler: async (ctx, { day }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("executionEvents")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
      .collect();
  },
});

/** Auditable event log across a range (repeated-delay + drift analysis). */
export const eventsInRange = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("executionEvents")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", from).lte("day", to),
      )
      .collect();
  },
});

/** Most recent execution events (compact audit trail). */
export const recentEvents = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("executionEvents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(Math.min(Math.max(limit ?? 20, 1), 100));
    return rows;
  },
});

/* ------------------------------------------------------------------ */
/* Mutations — user-controlled execution lifecycle (§5)                */
/* ------------------------------------------------------------------ */

/**
 * Start working on a task, a time block, a project or an ad-hoc focus block.
 *
 * Concurrency contract (§35): any unfinished session is closed as `replaced`
 * before the new one starts — exactly one live session per user, no duplicates,
 * and the replaced session never awards XP.
 */
export const startSession = mutation({
  args: {
    taskId: v.optional(v.id("tasks")),
    blockId: v.optional(v.id("timeBlocks")),
    projectId: v.optional(v.id("projects")),
    title: v.optional(v.string()),
    /** task | focus | study | admin | other */
    kind: v.optional(v.string()),
    plannedMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();

    let taskId = args.taskId;
    let projectId = args.projectId;
    let title = args.title?.trim() || "";
    let plannedMinutes = args.plannedMinutes;
    let kind = args.kind;

    if (args.blockId) {
      const block = await ctx.db.get(args.blockId);
      if (!block || block.userId !== userId) throw new Error("Not found");
      taskId = taskId ?? block.taskId;
      projectId = projectId ?? block.projectId;
      title = title || block.title;
      if (plannedMinutes === undefined) {
        const [sh, sm] = block.startTime.split(":").map(Number);
        const [eh, em] = block.endTime.split(":").map(Number);
        const mins = (eh * 60 + em) - (sh * 60 + sm);
        if (Number.isFinite(mins) && mins > 0) plannedMinutes = mins;
      }
      if (!kind) kind = block.kind === "break" ? "other" : "task";
    }

    if (taskId) {
      const task = await ctx.db.get(taskId);
      if (!task || task.userId !== userId) throw new Error("Not found");
      title = title || task.title;
      projectId = projectId ?? task.projectId;
      if (plannedMinutes === undefined) plannedMinutes = task.estimateMinutes;
      if (!kind) kind = "task";
    }

    kind = kind ?? "focus";
    if (!title) throw new Error("A session needs a title");

    // Close any live session first — never two timers, never silent work.
    let replaced: Id<"executionSessions"> | null = null;
    for (const state of ACTIVE_STATES) {
      const open = await ctx.db
        .query("executionSessions")
        .withIndex("by_user_state", (q) => q.eq("userId", userId).eq("state", state))
        .collect();
      for (const s of open) {
        // Same target → reuse instead of restarting the clock.
        if (s.taskId && taskId && s.taskId === taskId) {
          if (s.state === "paused") {
            await ctx.db.patch(s._id, {
              state: "in_progress",
              pausedMs: s.pausedMs + (s.pausedAt ? Math.max(0, now - s.pausedAt) : 0),
              pausedAt: undefined,
              updatedAt: now,
            });
            await recordExecutionEvent(ctx, {
              userId,
              type: "EXECUTION_RESUMED",
              label: `ادامه اجرا: «${s.title}»`,
              sessionId: s._id,
              taskId: s.taskId,
              blockId: s.blockId,
              projectId: s.projectId,
            });
          }
          return { sessionId: s._id, reused: true, replaced: null as string | null };
        }
        await closeAsReplaced(ctx, s, now);
        replaced = s._id;
      }
    }

    const sessionId = await ctx.db.insert("executionSessions", {
      userId,
      taskId,
      blockId: args.blockId,
      projectId,
      title,
      kind,
      state: "in_progress",
      day: localDayKey(now),
      startedAt: now,
      pausedMs: 0,
      plannedMinutes,
      createdAt: now,
      updatedAt: now,
    });

    await recordExecutionEvent(ctx, {
      userId,
      type: taskId ? "TASK_STARTED" : "FOCUS_STARTED",
      label: `شروع اجرا: «${title}»`,
      sessionId,
      taskId,
      blockId: args.blockId,
      projectId,
      at: now,
      meta: JSON.stringify({ kind, plannedMinutes: plannedMinutes ?? null }),
    });

    return { sessionId, reused: false, replaced: replaced as string | null };
  },
});

/** Pause the clock (time spent paused is never counted as work). */
export const pauseSession = mutation({
  args: { id: v.id("executionSessions") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const session = await ctx.db.get(id);
    if (!session || session.userId !== userId) throw new Error("Not found");
    if (session.state !== "in_progress") return { ok: false, elapsedMs: elapsedOf(session, Date.now()) };
    const now = Date.now();
    await ctx.db.patch(id, { state: "paused", pausedAt: now, updatedAt: now });
    await recordExecutionEvent(ctx, {
      userId,
      type: "EXECUTION_PAUSED",
      label: `توقف موقت: «${session.title}»`,
      sessionId: id,
      taskId: session.taskId,
      blockId: session.blockId,
      projectId: session.projectId,
      at: now,
    });
    return { ok: true, elapsedMs: elapsedOf(session, now) };
  },
});

export const resumeSession = mutation({
  args: { id: v.id("executionSessions") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const session = await ctx.db.get(id);
    if (!session || session.userId !== userId) throw new Error("Not found");
    if (session.state !== "paused") return { ok: false, elapsedMs: elapsedOf(session, Date.now()) };
    const now = Date.now();
    await ctx.db.patch(id, {
      state: "in_progress",
      pausedMs: session.pausedMs + (session.pausedAt ? Math.max(0, now - session.pausedAt) : 0),
      pausedAt: undefined,
      updatedAt: now,
    });
    await recordExecutionEvent(ctx, {
      userId,
      type: "EXECUTION_RESUMED",
      label: `ادامه اجرا: «${session.title}»`,
      sessionId: id,
      taskId: session.taskId,
      blockId: session.blockId,
      projectId: session.projectId,
      at: now,
    });
    return { ok: true, elapsedMs: elapsedOf(session, now) };
  },
});

/**
 * Finish a session.
 *
 * Outcome path is decided by `kind` so XP is granted EXACTLY ONCE (§22/§39):
 *   - kind "task"          → taskCore.setTaskDone → existing task XP/stat path
 *   - kind "focus"/"study" → the shared focus-session row → existing focus XP
 *
 * Idempotent: a session that already ended returns { ok: false } and writes
 * nothing, so a double-click can never award a second reward.
 */
export const completeSession = mutation({
  args: {
    id: v.id("executionSessions"),
    feedback: v.optional(v.string()),
    note: v.optional(v.string()),
    /** Optional user-corrected duration in minutes (interrupted timers). */
    actualMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const session = await ctx.db.get(args.id);
    if (!session || session.userId !== userId) throw new Error("Not found");
    if (session.state === "completed") return { ok: false, reason: "already_completed" as const };
    if (session.state === "abandoned") return { ok: false, reason: "abandoned" as const };

    const now = Date.now();
    const elapsedMs = elapsedOf(session, now);
    const actualMinutes =
      args.actualMinutes !== undefined && args.actualMinutes > 0
        ? clampMinutes(args.actualMinutes)
        : minutesOf(elapsedMs);

    await ctx.db.patch(args.id, {
      state: "completed",
      endedAt: now,
      pausedMs: session.pausedMs + (session.pausedAt ? Math.max(0, now - session.pausedAt) : 0),
      pausedAt: undefined,
      elapsedMs,
      feedback: args.feedback,
      feedbackNote: args.note?.trim() || undefined,
      endedReason: "completed",
      updatedAt: now,
    });

    const varianceMinutes = session.plannedMinutes ? actualMinutes - session.plannedMinutes : null;

    await recordExecutionEvent(ctx, {
      userId,
      type: "EXECUTION_COMPLETED",
      label: `پایان اجرا: «${session.title}» — ${actualMinutes} دقیقه`,
      sessionId: args.id,
      taskId: session.taskId,
      blockId: session.blockId,
      projectId: session.projectId,
      at: now,
      meta: JSON.stringify({
        plannedMinutes: session.plannedMinutes ?? null,
        actualMinutes,
        varianceMinutes,
        pausedMs: session.pausedMs,
      }),
    });

    /* ---- outcome: exactly one existing progression path ---- */
    let xp = 0;
    let levelUp: number | null = null;
    let unlocked: string[] = [];

    if (session.kind === "focus" || session.kind === "study") {
      const { result } = await createFocusSessionRow(ctx, {
        userId,
        taskId: session.taskId ?? undefined,
        projectId: session.projectId ?? undefined,
        title: session.title,
        plannedMinutes: session.plannedMinutes ?? actualMinutes,
        actualMinutes,
        date: session.day,
        completed: true,
        type: "focus",
        sourceLabel: session.kind === "study" ? "جلسه مطالعه" : "جلسه تمرکز",
      });
      xp = result?.xp ?? 0;
      levelUp = result?.levelUp ?? null;
      unlocked = result?.unlocked ?? [];
    } else if (session.taskId) {
      const result = await setTaskDone(ctx, session.taskId, true);
      xp = result?.xp ?? 0;
      levelUp = result?.levelUp ?? null;
      unlocked = result?.unlocked ?? [];
      await recordExecutionEvent(ctx, {
        userId,
        type: "TASK_COMPLETED_BY_EXECUTION",
        label: `کار از مسیر اجرا انجام شد: «${session.title}»`,
        sessionId: args.id,
        taskId: session.taskId,
        blockId: session.blockId,
        projectId: session.projectId,
        at: now,
      });
    }

    if (varianceMinutes !== null && Math.abs(varianceMinutes) >= 1) {
      await recordExecutionEvent(ctx, {
        userId,
        type: varianceMinutes > 0 ? "DEVIATION_OVERRUN" : "DEVIATION_UNDERRUN",
        label:
          varianceMinutes > 0
            ? `«${session.title}» بیشتر از تخمین طول کشید (${varianceMinutes} دقیقه)`
            : `«${session.title}» کمتر از تخمین طول کشید (${Math.abs(varianceMinutes)} دقیقه)`,
        source: "system",
        sessionId: args.id,
        taskId: session.taskId,
        projectId: session.projectId,
        at: now,
        meta: JSON.stringify({ plannedMinutes: session.plannedMinutes, actualMinutes }),
      });
    }

    return {
      ok: true as const,
      sessionId: args.id,
      elapsedMs,
      actualMinutes,
      varianceMinutes,
      xp,
      levelUp,
      unlocked,
    };
  },
});

/**
 * Abandon a session (stopped without finishing). The task keeps its status and
 * its history — nothing is marked as failed (§23), and no XP is written.
 */
export const abandonSession = mutation({
  args: {
    id: v.id("executionSessions"),
    feedback: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const session = await ctx.db.get(args.id);
    if (!session || session.userId !== userId) throw new Error("Not found");
    if (session.state === "completed" || session.state === "abandoned") {
      return { ok: false, elapsedMs: session.elapsedMs ?? 0 };
    }
    const now = Date.now();
    const elapsedMs = elapsedOf(session, now);
    await ctx.db.patch(args.id, {
      state: "abandoned",
      endedAt: now,
      pausedMs: session.pausedMs + (session.pausedAt ? Math.max(0, now - session.pausedAt) : 0),
      pausedAt: undefined,
      elapsedMs,
      feedback: args.feedback,
      feedbackNote: args.note?.trim() || undefined,
      endedReason: "abandoned",
      updatedAt: now,
    });
    await recordExecutionEvent(ctx, {
      userId,
      type: "EXECUTION_ABANDONED",
      label: `اجرا نیمه‌کاره رها شد: «${session.title}»`,
      sessionId: args.id,
      taskId: session.taskId,
      blockId: session.blockId,
      projectId: session.projectId,
      at: now,
      meta: JSON.stringify({ elapsedMs, feedback: args.feedback ?? null }),
    });
    return { ok: true as const, elapsedMs };
  },
});

/** Minimal, optional feedback on any session (§8) — never mandatory. */
export const submitFeedback = mutation({
  args: {
    id: v.id("executionSessions"),
    feedback: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const session = await ctx.db.get(args.id);
    if (!session || session.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(args.id, {
      feedback: args.feedback,
      feedbackNote: args.note?.trim() || undefined,
      updatedAt: Date.now(),
    });
    await recordExecutionEvent(ctx, {
      userId,
      type: "EXECUTION_FEEDBACK",
      label: `بازخورد ثبت شد: «${session.title}»`,
      sessionId: args.id,
      taskId: session.taskId,
      blockId: session.blockId,
      at: Date.now(),
      meta: JSON.stringify({ feedback: args.feedback }),
    });
    return { ok: true as const };
  },
});

/**
 * Audit one recovery decision (§9 / §36).
 *
 * The actual schedule/task change is ALWAYS performed by the existing
 * controlled mutation (tasks.update, personal.updateTimeBlock, the scheduling
 * dialogs) — this mutation only records WHAT the user decided, so the audit
 * trail explains why the plan changed.
 *
 * `markTaskBlocked` is the single convenience write: it appends the Persian
 * "مسدود" tag the planning engine already understands as a blocked signal.
 */
export const logRecovery = mutation({
  args: {
    action: v.string(), // reschedule | start_now | keep_unscheduled | mark_complete | mark_blocked | adjust_estimate | accept_move | dismiss
    label: v.string(),
    sessionId: v.optional(v.id("executionSessions")),
    taskId: v.optional(v.id("tasks")),
    blockId: v.optional(v.id("timeBlocks")),
    projectId: v.optional(v.id("projects")),
    meta: v.optional(v.string()),
    markTaskBlocked: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();

    if (args.markTaskBlocked && args.taskId) {
      const task = await ctx.db.get(args.taskId);
      if (!task || task.userId !== userId) throw new Error("Not found");
      if (!task.tags.includes(BLOCKED_TAG)) {
        await ctx.db.patch(args.taskId, { tags: [...task.tags, BLOCKED_TAG] });
      }
    }

    await recordExecutionEvent(ctx, {
      userId,
      type: "RECOVERY_ACTION",
      label: args.label,
      source: "user",
      at: now,
      sessionId: args.sessionId,
      taskId: args.taskId,
      blockId: args.blockId,
      projectId: args.projectId,
      meta: JSON.stringify({ action: args.action, ...(args.meta ? { detail: args.meta } : {}) }),
    });

    return { ok: true as const };
  },
});
