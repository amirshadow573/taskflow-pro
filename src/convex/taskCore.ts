/**
 * Shared task-completion core + execution event log — Phase 12 (§22 / §24 / §36).
 *
 * Why this file exists:
 *   - XP must flow from exactly ONE place. `tasks.toggleDone` (checkbox / status
 *     selector) and `execution.completeSession` (execution engine) both call
 *     `setTaskDone`, so a task can never award XP twice — the progression layer
 *     still owns every XP decision via `handleTaskToggle`.
 *   - The auditable execution log is append-only and lives here so both the
 *     execution engine and the task layer can write to it without importing
 *     each other (no cycles).
 *
 * Nothing in this file computes XP, stats, skills, quests or achievements: it
 * only calls the existing centralized progression engine.
 */
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { fireAutomationEvent } from "./automations";
import { handleTaskToggle } from "./gamification";

export type TaskEngineResult = Awaited<ReturnType<typeof handleTaskToggle>>;

/** Local YYYY-MM-DD — same convention as tasks.ts / gamification.ts. */
export function localDayKey(at: number = Date.now()): string {
  const d = new Date(at);
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export interface ExecutionEventInput {
  userId: Id<"users">;
  /** See EXECUTION_EVENT_TYPES in src/lib/execution/types.ts. */
  type: string;
  /** Short Persian label for the audit trail. */
  label: string;
  /** user = the person acted; system = the engine observed something. */
  source?: "user" | "system";
  day?: string;
  at?: number;
  sessionId?: Id<"executionSessions">;
  taskId?: Id<"tasks">;
  blockId?: Id<"timeBlocks">;
  projectId?: Id<"projects">;
  /** JSON payload (deviation, recovery action, variance, …). */
  meta?: string;
}

/**
 * Append one auditable execution event (§23).
 * Audit logging must never block real work, so failures are logged and
 * swallowed — the event log is a record, not a source of truth for progress.
 */
export async function recordExecutionEvent(
  ctx: MutationCtx,
  event: ExecutionEventInput,
): Promise<void> {
  const at = event.at ?? Date.now();
  try {
    await ctx.db.insert("executionEvents", {
      userId: event.userId,
      type: event.type,
      day: event.day ?? localDayKey(at),
      at,
      sessionId: event.sessionId,
      taskId: event.taskId,
      blockId: event.blockId,
      projectId: event.projectId,
      source: event.source ?? "user",
      label: event.label,
      meta: event.meta,
    });
  } catch (err) {
    console.error("[execution] failed to record event", err);
  }
}

/**
 * Complete / reopen a task through the single progression path.
 *
 * - patches the task status + completedAt,
 * - keeps the Phase 11 schedule honest in BOTH directions (completing closes
 *   the open time blocks, un-completing reopens them),
 * - then calls `handleTaskToggle` — the only XP/stat/skill/quest/achievement
 *   entry point — exactly once.
 */
export async function setTaskDone(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
  done: boolean,
): Promise<TaskEngineResult | null> {
  const task = await ctx.db.get(taskId);
  if (!task) return null;

  if (done) {
    await ctx.db.patch(taskId, { status: "done", completedAt: Date.now() });
  } else {
    await ctx.db.patch(taskId, { status: "todo", completedAt: undefined });
  }

  const blocks = await ctx.db
    .query("timeBlocks")
    .withIndex("by_user", (q) => q.eq("userId", task.userId))
    .collect();
  const now = Date.now();
  for (const b of blocks) {
    if (b.taskId !== taskId) continue;
    if (done && b.status === "planned") {
      await ctx.db.patch(b._id, {
        status: "completed",
        completedAt: now,
        updatedAt: now,
      });
    } else if (!done && b.status === "completed") {
      await ctx.db.patch(b._id, {
        status: "planned",
        completedAt: undefined,
        updatedAt: now,
      });
    }
  }

  const updated = await ctx.db.get(taskId);
  if (!updated) return null;
  const result = await handleTaskToggle(ctx, updated, done);

  // Phase 14 — `task_completed` event trigger. Checkbox, status selector and
  // execution engine all funnel through here, so the automation engine sees
  // every completion exactly once. fireAutomationEvent never throws.
  if (done) {
    await fireAutomationEvent(ctx, task.userId, "task_completed", {
      entity: "task",
      id: taskId,
      doc: updated,
      token: String(updated.completedAt ?? now),
    });
  }
  return result;
}
