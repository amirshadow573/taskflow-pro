/**
 * Visual Timeline (Phase 17) — the unified timeline data adapter.
 *
 * This is a VIEW + INTERACTION layer, never a second database (§26, §54).
 * Every activity on the grid is either:
 *   - an existing `timeBlocks` row (created by the user, the PlanningEngine,
 *     the SchedulingEngine, an automation, or the Phase 10.5 external-AI
 *     import bridge), or
 *   - a fixed commitment expanded from the Context Engine / persona meetings
 *     through the SchedulingEngine's own `expandCommitments`.
 *
 * Nothing is fabricated: if the workspace has no scheduled work, the timeline
 * says so instead of showing sample events (§53).
 *
 * Pure and deterministic — safe to unit test, no React, no I/O.
 */
import {
  blockLabel,
  detectConflicts,
  type FixedCommitment,
  type ScheduleBlock,
  type ScheduleConflict,
  type SchedulePrefs,
} from "@/lib/scheduling";
import { resolveActivityColor, type TimelineColorKey } from "@/lib/timeline/timeline-colors";
import {
  MIN_BLOCK_MINUTES,
  MIN_BLOCK_HEIGHT,
  TIMELINE_SNAP_MINUTES,
  clamp,
  minutesToY,
  normalizeRange,
  snapMinutes,
} from "@/lib/timeline/timeline-grid";

/* ------------------------------------------------------------------ */
/* Source rows (exactly what the existing tables return)               */
/* ------------------------------------------------------------------ */

export interface TimelineTaskRow {
  _id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
  /** Scheduled start time on the task itself (HH:mm) — the My Tasks view. */
  dueTime?: string;
  estimateMinutes?: number;
  description?: string;
  parentId?: string;
  projectId?: string;
}

export interface TimelineProjectRow {
  _id: string;
  name: string;
  color?: string;
}

export interface TimelineGoalRow {
  _id: string;
  title: string;
  ref?: string;
}

export interface TimelineRoutineRow {
  _id: string;
  title: string;
}

export interface TimelineHabitRow {
  _id: string;
  title: string;
}

/** A `timeBlocks` row plus the Phase 17 optional fields. */
export interface TimelineBlockRow extends ScheduleBlock {
  notes?: string;
  color?: string;
  routineId?: string;
  habitId?: string;
  goalId?: string;
  projectId?: string;
  completedAt?: number;
}

/* ------------------------------------------------------------------ */
/* The unified activity                                                */
/* ------------------------------------------------------------------ */

/** Where an activity came from — every activity stays traceable to its source. */
export type TimelineOrigin =
  | "task"
  | "project"
  | "goal"
  | "routine"
  | "habit"
  | "event"
  | "meeting"
  | "block";

export interface TimelineActivity {
  /** Stable key for React + drag tracking. */
  key: string;
  origin: TimelineOrigin;
  /** Present for `origin === "block"`; the only rows backed by a time block. */
  blockId?: string;
  /**
   * True when the row was DERIVED from a task that carries its own
   * `dueDate` + `dueTime` and has no time block yet. Derived rows are still
   * real data — the task IS scheduled — but they are persisted by writing
   * back to the task, never by inserting a duplicate time block (§31).
   */
  derived: boolean;
  /** YYYY-MM-DD — the column this activity belongs to. */
  day: string;
  title: string;
  /** Minutes since midnight. */
  start: number;
  end: number;
  kind: string;
  status: string;
  fixed: boolean;
  /** Resolved palette key (stored colour, else a kind-derived fallback). */
  colorKey: TimelineColorKey;
  /** The user's own choice, if any — null means "never picked a colour". */
  storedColor: string | null;
  /** Multi-line free text; blocks reuse the existing `notes` field. */
  description?: string;
  projectName?: string;
  goalTitle?: string;
  taskId?: string;
  taskTitle?: string;
  taskStatus?: string;
  taskPriority?: string;
  taskDone?: boolean;
  routineItemId?: string;
  routineItemTitle?: string;
  habitId?: string;
  habitTitle?: string;
  source?: string;
}

export interface TimelineContext {
  tasks: TimelineTaskRow[];
  projects: TimelineProjectRow[];
  goals: TimelineGoalRow[];
  routineItems: TimelineRoutineRow[];
  habits: TimelineHabitRow[];
  persona?: string;
}

export interface BuildTimelineInput extends TimelineContext {
  day: string;
  blocks: TimelineBlockRow[];
  commitments: FixedCommitment[];
}

/**
 * Display duration for a scheduled task that has a start time but no
 * explicit estimate. The grid needs *some* height to honour §4, so this is a
 * UI default only — it becomes the task's real `estimateMinutes` the moment
 * the user resizes the block, and it is never written unless they do.
 */
export const DEFAULT_TASK_DURATION_MINUTES = 30;

const minutesOfSafe = (value: string | undefined | null, fallback: number): number => {
  const m = /^(\d{1,2}):(\d{2})$/.exec((value ?? "").trim());
  if (!m) return fallback;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return fallback;
  return h * 60 + min;
};

/**
 * Turn one day of existing rows into timeline activities. Rows with an
 * unusable range are dropped rather than rendered at a made-up time.
 */
export function buildDayActivities(input: BuildTimelineInput): TimelineActivity[] {
  const tasks = new Map(input.tasks.map((t) => [t._id, t]));
  const projects = new Map(input.projects.map((p) => [p._id, p]));
  const goals = new Map(input.goals.map((g) => [g._id, g]));
  const routines = new Map(input.routineItems.map((r) => [r._id, r]));
  const habits = new Map(input.habits.map((h) => [h._id, h]));
  const out: TimelineActivity[] = [];

  for (const b of input.blocks) {
    const start = minutesOfSafe(b.startTime, NaN);
    const end = minutesOfSafe(b.endTime, NaN);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;

    const task = b.taskId ? tasks.get(b.taskId) : undefined;
    const project = b.projectId ? projects.get(b.projectId) : undefined;
    const goal = b.goalId ? goals.get(b.goalId) : undefined;
    const routineItem = b.routineId ? routines.get(b.routineId) : undefined;
    const habit = b.habitId ? habits.get(b.habitId) : undefined;

    // The block's own title wins; fall back to the linked entity's name so a
    // block created by the engine is never blank.
    const title = b.title?.trim() || task?.title || project?.name || habit?.title || routineItem?.title || "بدون عنوان";

    out.push({
      key: `block:${b._id}`,
      origin: task ? "task" : project ? "project" : goal ? "goal" : routineItem ? "routine" : habit ? "habit" : "block",
      blockId: b._id,
      derived: false,
      day: b.day,
      title,
      start,
      end,
      kind: b.kind,
      status: b.status,
      fixed: Boolean(b.fixed),
      colorKey: resolveActivityColor(b.color, b.kind),
      storedColor: b.color ?? null,
      description: b.notes?.trim() || undefined,
      projectName: project?.name,
      goalTitle: goal?.title,
      taskId: b.taskId,
      taskTitle: task?.title,
      taskStatus: task?.status,
      taskPriority: task?.priority,
      taskDone: task?.status === "done",
      routineItemId: b.routineId,
      routineItemTitle: routineItem?.title,
      habitId: b.habitId,
      habitTitle: habit?.title,
      source: b.source,
    });
  }

  /*
   * CRITICAL FIX #1 — scheduled tasks from «کارهای من».
   *
   * `tasks.create` / `tasks.update` store `dueDate` + `dueTime` on the task
   * itself; nothing ever writes a `timeBlocks` row for them. Reading only
   * time blocks therefore made the timeline blind to every task the user had
   * already scheduled — the page looked empty and people recreated their own
   * work. These rows are DERIVED (view-only): no table is written, and a task
   * that already has a time block is skipped so it is never shown twice (§31).
   */
  const scheduledTaskIds = new Set(
    input.blocks.filter((b) => b.taskId).map((b) => b.taskId as string),
  );
  for (const t of input.tasks) {
    if (t.dueDate !== input.day) continue;
    if (!t.dueTime) continue; // a date without a time has no place on a time grid
    if (scheduledTaskIds.has(t._id)) continue; // the block is the source of truth

    const start = minutesOfSafe(t.dueTime, NaN);
    if (!Number.isFinite(start)) continue;
    const duration =
      typeof t.estimateMinutes === "number" && t.estimateMinutes > 0
        ? t.estimateMinutes
        : DEFAULT_TASK_DURATION_MINUTES;

    const project = t.projectId ? projects.get(t.projectId) : undefined;
    out.push({
      key: `task:${t._id}`,
      origin: "task",
      blockId: undefined,
      derived: true,
      day: input.day,
      title: t.title?.trim() || "بدون عنوان",
      start,
      end: Math.max(start + MIN_BLOCK_MINUTES, start + duration),
      kind: "task",
      status: t.status === "done" ? "completed" : "planned",
      fixed: false,
      colorKey: resolveActivityColor(undefined, "task"),
      storedColor: null,
      description: t.description?.trim() || undefined,
      projectName: project?.name,
      goalTitle: undefined,
      taskId: t._id,
      taskTitle: t.title,
      taskStatus: t.status,
      taskPriority: t.priority,
      taskDone: t.status === "done",
      source: "task",
    });
  }

  // Fixed commitments are facts: classes, exams, meetings, appointments.
  // They render on the grid but are never draggable (§18).
  for (const c of input.commitments) {
    const start = minutesOfSafe(c.startTime, NaN);
    if (!Number.isFinite(start)) continue;
    const end = minutesOfSafe(c.endTime, start + 60);
    out.push({
      key: `commit:${c.id}`,
      origin: c.origin === "meeting" ? "meeting" : "event",
      blockId: undefined,
      derived: false,
      day: input.day,
      title: c.title,
      start,
      end: Math.max(start + MIN_BLOCK_MINUTES, end),
      kind: c.origin === "meeting" ? "meeting" : "event",
      status: "fixed",
      fixed: true,
      storedColor: null,
      // Deliberately a neutral tone: a commitment is a different visual
      // category from something the user scheduled themselves.
      colorKey: "slate",
      description: blockLabel(c.type, input.persona) || undefined,
    });
  }

  return out.sort((a, b) => a.start - b.start || a.end - b.end || a.key.localeCompare(b.key));
}

/* ------------------------------------------------------------------ */
/* Overlap layout (§29)                                                */
/* ------------------------------------------------------------------ */

export interface PlacedActivity extends TimelineActivity {
  /** 0-based column within its overlap cluster. */
  lane: number;
  /** Number of columns in the cluster. */
  lanes: number;
  top: number;
  height: number;
  /** Percentage offsets, pre-computed so the renderer stays pure. */
  leftPct: number;
  widthPct: number;
}

interface Cluster {
  items: TimelineActivity[];
  lanes: number;
}

/**
 * Group activities into transitively-overlapping clusters, then assign each
 * one a column. Classic calendar packing: activities never stack on top of
 * each other, and a cluster is only as narrow as it needs to be.
 */
function clusterActivities(items: TimelineActivity[]): Cluster[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  const clusters: Cluster[] = [];
  let current: TimelineActivity[] = [];
  let currentEnd = -1;

  for (const a of sorted) {
    if (current.length === 0 || a.start < currentEnd) {
      current.push(a);
      currentEnd = Math.max(currentEnd, a.end);
    } else {
      clusters.push({ items: current, lanes: 0 });
      current = [a];
      currentEnd = a.end;
    }
  }
  if (current.length > 0) clusters.push({ items: current, lanes: 0 });

  return clusters.map((cluster) => {
    const columnEnds: number[] = [];
    const laneOf = new Map<string, number>();
    // Tallest-first inside a cluster: it gives the short neighbours the
    // columns they need instead of one very tall block hogging column 0.
    const ordered = [...cluster.items].sort(
      (a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start,
    );
    for (const a of ordered) {
      let lane = columnEnds.findIndex((end) => end <= a.start);
      if (lane === -1) {
        lane = columnEnds.length;
        columnEnds.push(a.end);
      } else {
        columnEnds[lane] = a.end;
      }
      laneOf.set(a.key, lane);
    }
    const lanes = Math.max(1, columnEnds.length);
    return {
      items: cluster.items.map((a) => ({ ...a, __lane: laneOf.get(a.key) ?? 0 })),
      lanes,
    };
  });
}

interface LanesActivity extends TimelineActivity {
  __lane: number;
}

/** Horizontal gap (in % of a column) reserved between side-by-side blocks. */
const LANE_GAP_PCT = 6;

/**
 * Place one day's activities on the grid: vertical position from duration,
 * horizontal position from overlap clustering.
 */
export function layoutDay(
  activities: TimelineActivity[],
  win: { start: number; end: number },
): PlacedActivity[] {
  const placed: PlacedActivity[] = [];

  for (const cluster of clusterActivities(activities)) {
    const lanes = cluster.lanes;
    const widthPct = 100 / lanes;
    for (const raw of cluster.items as LanesActivity[]) {
      const lane = raw.__lane;
      // +1 so a 30-min slot has a visible 1px divider under it.
      const top = minutesToY(raw.start - win.start) + 1;
      const height = Math.max(
        MIN_BLOCK_HEIGHT,
        minutesToY(raw.end - raw.start) - 2,
      );
      placed.push({
        ...raw,
        lane,
        lanes,
        top,
        height,
        leftPct: lane * widthPct + LANE_GAP_PCT / 2,
        widthPct: widthPct - LANE_GAP_PCT,
      });
    }
  }

  return placed.sort((a, b) => a.top - b.top || a.lane - b.lane);
}

/* ------------------------------------------------------------------ */
/* Move validation (§18, §19)                                          */
/* ------------------------------------------------------------------ */

export interface MoveProposal {
  day: string;
  start: number;
  end: number;
}

/**
 * Project any activity into the `ScheduleBlock` shape the ConflictService
 * already understands — including DERIVED task rows that have no block yet.
 * This is validation input only: nothing is ever persisted from it.
 */
export function activityAsBlock(activity: TimelineActivity): ScheduleBlock {
  return {
    _id: activity.blockId ?? activity.key,
    title: activity.title,
    day: activity.day,
    startTime: hhmm(activity.start),
    endTime: hhmm(activity.end),
    kind: activity.kind,
    status: activity.status,
    fixed: activity.fixed,
    source: activity.derived ? "task" : (activity.source ?? "manual"),
    taskId: activity.taskId,
    projectId: undefined,
    priority: activity.taskPriority,
  };
}

/**
 * Validate a drag / resize through the EXISTING ConflictService. Returns the
 * proposed placement plus every conflict it would create — the caller decides
 * what to do, and the block is never silently overwritten.
 */
export function validateMove(input: {
  day: string;
  prefs: SchedulePrefs;
  block: ScheduleBlock;
  activities: TimelineActivity[];
  commitments: FixedCommitment[];
  tasksById: Map<string, { title: string; estimateMinutes?: number; dueDate?: string; status: string }>;
  proposal: MoveProposal;
}): { conflicts: ScheduleConflict[]; blocking: ScheduleConflict[] } {
  const { day, prefs, block, proposal } = input;

  const blocksForDay: ScheduleBlock[] = input.activities
    // Skip only the row being moved — every other activity, derived or not,
    // is an obstacle.
    .filter((a) => a.blockId !== block._id && a.key !== block._id)
    .map((a) => activityAsBlock(a));

  // The proposed version of the dragged block participates in the check too,
  // so `outside_window` / `insufficient_duration` are caught for it.
  blocksForDay.push({
    ...block,
    _id: block._id,
    day,
    startTime: hhmm(proposal.start),
    endTime: hhmm(proposal.end),
    source: "reschedule",
  });

  const conflicts = detectConflicts({
    day,
    prefs,
    events: input.commitments,
    blocks: blocksForDay,
    tasksById: input.tasksById,
  });

  // A block that already overlaps something is not newly blocked by our own
  // re-check of its neighbours; only conflicts involving the dragged block
  // (or an invalid range) can block this move.
  const blocking = conflicts.filter(
    (c) =>
      c.kind === "invalid_range" ||
      c.a.id === block._id ||
      (c.b?.id !== undefined && c.b.id === block._id),
  );

  return { conflicts, blocking };
}

export const hhmm = (minutes: number): string => {
  const m = clamp(Math.round(minutes), 0, 24 * 60 - 1);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/**
 * Snap a pointer-driven move: the whole block follows the finger, keeping its
 * real duration, and lands on the grid (§15, §17).
 */
export function snapMove(
  activity: { start: number; end: number },
  deltaMinutes: number,
  win: { start: number; end: number },
): { start: number; end: number } {
  const duration = Math.max(MIN_BLOCK_MINUTES, activity.end - activity.start);
  const rawStart = snapMinutes(activity.start + deltaMinutes);
  const start = clamp(rawStart, win.start, Math.max(win.start, win.end - duration));
  return normalizeRange(start, start + duration);
}

/**
 * Snap a resize of the top or bottom edge.
 *
 * Order matters: snap FIRST, then clamp against limits that are themselves
 * on the grid (rounding the limit with a plain `Math.round` can push the
 * result off-grid, e.g. to 09:45 — which §17 forbids). The minimum length is
 * rounded UP and the maximum start is rounded DOWN so the block can never
 * collapse to zero or drift off the interval.
 */
export function snapResize(
  activity: { start: number; end: number },
  edge: "start" | "end",
  deltaMinutes: number,
  win: { start: number; end: number },
  step = TIMELINE_SNAP_MINUTES,
): { start: number; end: number } {
  if (edge === "end") {
    const snapped = clamp(snapMinutes(activity.end + deltaMinutes, step), win.start, win.end);
    const minEnd = Math.ceil((activity.start + MIN_BLOCK_MINUTES) / step) * step;
    return { start: activity.start, end: clamp(Math.max(snapped, minEnd), win.start, win.end) };
  }
  const snapped = clamp(snapMinutes(activity.start + deltaMinutes, step), win.start, win.end);
  const maxStart = Math.floor((activity.end - MIN_BLOCK_MINUTES) / step) * step;
  return { start: clamp(Math.min(snapped, maxStart), win.start, win.end), end: activity.end };
}
