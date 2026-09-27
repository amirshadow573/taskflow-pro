/**
 * Smart Today buckets (Phase 10 §7).
 *
 *   Must Do    — critical / deadline-sensitive work for the day
 *   Should Do  — important work that meaningfully advances goals/projects
 *   Could Do   — useful but flexible work
 *   Deferred   — work the user INTENTIONALLY placed after today (later due date)
 *   Blocked    — work that cannot progress right now (explainable signals)
 *
 * Nothing is ever moved automatically — bucketing is derived state only, and
 * every blocked item carries a Persian reason explaining WHY.
 */
import type { NextActionProject, NextActionTask } from "@/lib/next-action";
import type { BlockedItem, TodayBuckets } from "@/lib/planning/types";

/* ------------------------------------------------------------------ */
/* Blocked detection                                                   */
/* ------------------------------------------------------------------ */

/** Tags that mark a task as blocked (user-controlled, deterministic). */
const BLOCKED_TAGS = ["blocked", "مسدود", "در انتظار", "waiting"];

/** Project statuses that block the tasks inside them. */
const BLOCKING_PROJECT_STATUSES = ["paused", "on_hold", "on-hold", "archived"];

/**
 * Why a task cannot progress right now — or null when it can.
 * Signals used: explicit user tags + the state of the parent project.
 * We never invent dependency graphs the schema does not have.
 */
export function blockedReason(
  task: NextActionTask,
  projectsById: Map<string, NextActionProject>,
): string | null {
  const tags = task.tags ?? [];
  const tag = tags.find((t) => BLOCKED_TAGS.includes(t.toLowerCase().trim()));
  if (tag) return `برچسب «${tag}» دارد — خودت علامت زده‌ای که متوقف است.`;

  if (task.projectId) {
    const project = projectsById.get(task.projectId);
    if (project && BLOCKING_PROJECT_STATUSES.includes(project.status)) {
      return `پروژه «${project.name}» متوقف است؛ تا فعال نشود پیش نمی‌رود.`;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Bucketing                                                           */
/* ------------------------------------------------------------------ */

export interface BucketInput<T extends NextActionTask = NextActionTask> {
  /** Local YYYY-MM-DD the buckets are computed for. */
  dayKey: string;
  /** ALL tasks (root + subtasks) — filtering happens here. */
  tasks: T[];
  projects: NextActionProject[];
  /** Horizon for the deferred bucket (tasks planned after today). */
  deferHorizonDays?: number;
}

function isOpenRoot(t: NextActionTask): boolean {
  // Inbox tasks with a due date count as planned for the day — this mirrors
  // how the Today page has always listed dated work regardless of status.
  return !t.parentId && t.status !== "done";
}

/**
 * Split the day's work into the five planning buckets. Deterministic:
 * same input → same buckets. `deferred` never includes overdue work (that is
 * the overdue signal's job, not a "moved on purpose" task).
 */
export function todayBuckets<T extends NextActionTask>(
  input: BucketInput<T>,
): TodayBuckets<T> {
  const { dayKey, tasks } = input;
  const projectsById = new Map(input.projects.map((p) => [p._id, p]));
  const horizon = input.deferHorizonDays ?? 7;

  const openRoot = tasks.filter(isOpenRoot);

  const mustDo: T[] = [];
  const shouldDo: T[] = [];
  const couldDo: T[] = [];
  const deferred: T[] = [];
  const blocked: BlockedItem<T>[] = [];

  for (const t of openRoot) {
    /* Blocked — evaluated regardless of date; the reason is always shown. */
    const reason = blockedReason(t, projectsById);
    if (reason) blocked.push({ task: t, reason });

    const due = t.dueDate;

    /* Future work: inside the horizon it counts as intentionally later. */
    if (due !== undefined && due > dayKey) {
      if (due <= addDays(dayKey, horizon)) deferred.push(t);
      continue;
    }
    /* No deadline → not part of the day's plan (surfaced by Next Action). */
    if (due === undefined) continue;

    /* Due today or overdue — both demand attention in today's plan (the
       page keeps a dedicated overdue surface on top of this). */
    const critical =
      t.priority === "urgent" ||
      t.priority === "high" ||
      due < dayKey ||
      (t.dueTime !== undefined && t.dueTime !== "");

    if (critical) {
      mustDo.push(t);
    } else if (t.projectId !== undefined || t.priority === "medium") {
      shouldDo.push(t);
    } else {
      couldDo.push(t);
    }
  }

  const byTime = (a: T, b: T) =>
    (a.dueTime ?? "99").localeCompare(b.dueTime ?? "99") ||
    (a.dueDate ?? "").localeCompare(b.dueDate ?? "");

  mustDo.sort(byTime);
  shouldDo.sort(byTime);
  couldDo.sort(byTime);
  deferred.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  blocked.sort((a, b) => (a.task.dueDate ?? "9999").localeCompare(b.task.dueDate ?? "9999"));

  return {
    mustDo: mustDo.filter((t) => !blocked.some((b) => b.task._id === t._id)),
    shouldDo: shouldDo.filter((t) => !blocked.some((b) => b.task._id === t._id)),
    couldDo: couldDo.filter((t) => !blocked.some((b) => b.task._id === t._id)),
    deferred: deferred.filter((t) => !blocked.some((b) => b.task._id === t._id)),
    blocked,
  };
}

function addDays(dayKey: string, n: number): string {
  const d = new Date(`${dayKey}T00:00:00`);
  d.setDate(d.getDate() + n);
  const pad = (x: number) => (x < 10 ? `0${x}` : String(x));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
