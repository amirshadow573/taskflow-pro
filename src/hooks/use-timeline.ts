/**
 * useTimeline — Visual Timeline (Phase 17) data hook.
 *
 * Subscribes to the EXISTING scheduling sources over the visible range and
 * runs them through the SchedulingEngine's own primitives
 * (`expandCommitments`, `detectConflicts`). It creates no subscription that
 * another surface does not already use, and it exposes only controlled
 * mutations — nothing is ever written without an explicit user action.
 *
 * Sources read (§20–§25, §43):
 *   timeBlocks        tasks, projects, goals, routine items, habits, AI imports
 *   context events    classes, exams, appointments (fixed commitments)
 *   manager meetings  employee / manager / team commitments
 *   routines + habits their names, for traceability of linked blocks
 */
import { useCallback, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useSchedulePrefs } from "@/lib/preferences";
import { expandCommitments, normalizeBlock, type FixedCommitment } from "@/lib/scheduling";
import { addDays } from "@/lib/timeline/timeline-grid";
import {
  buildDayActivities,
  type TimelineBlockRow,
  type TimelineContext,
  type TimelineGoalRow,
  type TimelineHabitRow,
  type TimelineProjectRow,
  type TimelineRoutineRow,
  type TimelineTaskRow,
} from "@/lib/timeline/timeline-model";

const EMPTY_TASKS: TimelineTaskRow[] = [];
const EMPTY_EVENTS: never[] = [];
const EMPTY_MEETINGS: never[] = [];
const EMPTY_BLOCKS: TimelineBlockRow[] = [];
const EMPTY_GOALS: TimelineGoalRow[] = [];
const EMPTY_ROUTINES: TimelineRoutineRow[] = [];
const EMPTY_HABITS: TimelineHabitRow[] = [];
const EMPTY_PROJECTS: TimelineProjectRow[] = [];

export type TimelineView = "day" | "week";

export interface UseTimelineArgs {
  /** Any day inside the visible range. */
  dayKey: string;
  view: TimelineView;
}

export interface UseTimelineResult {
  view: TimelineView;
  /** Day keys currently on the grid (1 or 7 entries). */
  dayKeys: string[];
  /** Every activity across the visible range, grouped by day. */
  byDay: Map<string, ReturnType<typeof buildDayActivities>>;
  commitmentsByDay: Map<string, FixedCommitment[]>;
  prefs: ReturnType<typeof useSchedulePrefs>[0];
  savePrefs: ReturnType<typeof useSchedulePrefs>[1];
  /** Everything the create / edit form needs to offer real links. */
  context: TimelineContext;
  /** True while any of the underlying subscriptions are still loading. */
  loading: boolean;
  createBlock: (args: {
    title: string;
    day: string;
    startTime: string;
    endTime: string;
    kind: string;
    description?: string;
    color?: string;
    taskId?: Id<"tasks">;
    projectId?: Id<"projects">;
    goalId?: Id<"personalGoals">;
    routineId?: Id<"routineItems">;
    habitId?: Id<"habits">;
    fixed?: boolean;
  }) => Promise<void>;
  updateBlock: (id: Id<"timeBlocks">, patch: Record<string, unknown>) => Promise<void>;
  deleteBlock: (id: Id<"timeBlocks">) => Promise<void>;
}

/** Saturday-first week, matching the Persian calendar used across the app. */
export function weekDayKeys(anchor: string): string[] {
  const d = new Date(`${anchor}T00:00:00`);
  const weekday = d.getDay(); // 0 = Saturday
  const back = (weekday + 1) % 7;
  const start = addDays(anchor, -back);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function useTimeline({ dayKey, view }: UseTimelineArgs): UseTimelineResult {
  const { tasks, projects } = useWorkspace();
  const { personaKey } = useUserProfile();
  const [prefs, savePrefs] = useSchedulePrefs();

  const dayKeys = useMemo(
    () => (view === "week" ? weekDayKeys(dayKey) : [dayKey]),
    [dayKey, view],
  );
  const rangeStart = dayKeys[0] ?? dayKey;
  const rangeEnd = dayKeys[dayKeys.length - 1] ?? dayKey;

  /* ---- existing scheduling sources, scoped to the visible range ---- */
  const blocks = useQuery(api.personal.listTimeBlocks, {});
  const events = useQuery(api.context.eventsInRange, {
    start: rangeStart,
    end: rangeEnd,
  });
  const needsMeetings =
    personaKey === "employee" || personaKey === "manager" || personaKey === "team";
  const meetings = useQuery(api.manager.listMeetings, needsMeetings ? {} : "skip");
  const goals = useQuery(api.personal.listGoals, {});
  const routines = useQuery(api.routines.listAllItems, {});
  const habits = useQuery(api.personal.listHabits, {});

  /* ---- lookup maps for context / traceability ---- */
  const projectRows = useMemo<TimelineProjectRow[]>(
    () =>
      projects.length > 0
        ? projects.map((p) => ({ _id: p._id, name: p.name, color: p.color }))
        : EMPTY_PROJECTS,
    [projects],
  );

  const taskRows = useMemo<TimelineTaskRow[]>(
    () =>
      tasks.length > 0
        ? tasks.map((t) => ({
            _id: t._id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate,
            estimateMinutes: t.estimateMinutes,
            description: t.description,
          }))
        : EMPTY_TASKS,
    [tasks],
  );

  const context = useMemo<TimelineContext>(
    () => ({
      tasks: taskRows,
      projects: projectRows,
      goals: goals ?? EMPTY_GOALS,
      routineItems: routines ?? EMPTY_ROUTINES,
      habits: habits ?? EMPTY_HABITS,
      persona: personaKey,
    }),
    [taskRows, projectRows, goals, routines, habits, personaKey],
  );

  /* ---- commitments: the SchedulingEngine's own recurrence expansion ---- */
  const commitmentsByDay = useMemo(
    () =>
      expandCommitments(
        events ?? EMPTY_EVENTS,
        meetings ?? EMPTY_MEETINGS,
        dayKeys,
      ),
    [events, meetings, dayKeys],
  );

  /* ---- one adapter pass per visible day ---- */
  const byDay = useMemo(() => {
    const all = blocks ?? EMPTY_BLOCKS;
    const rangeSet = new Set(dayKeys);
    const relevant = all.filter((b) => rangeSet.has(b.day));
    const map = new Map<string, ReturnType<typeof buildDayActivities>>();
    for (const day of dayKeys) {
      map.set(
        day,
        buildDayActivities({
          ...context,
          day,
          // The adapter requires the fully-normalised Phase 11 fields; the
          // query returns raw rows, so normalise here rather than inventing
          // defaults in two places.
          blocks: relevant
            .filter((b) => b.day === day)
            .map((b) => normalizeBlock(b as never) as TimelineBlockRow),
          commitments: commitmentsByDay.get(day) ?? [],
        }),
      );
    }
    return map;
  }, [blocks, dayKeys, context, commitmentsByDay]);

  /* ---- controlled mutations: the ONLY write paths ---- */
  const createMut = useMutation(api.personal.createTimeBlock);
  const updateMut = useMutation(api.personal.updateTimeBlock);
  const deleteMut = useMutation(api.personal.deleteTimeBlock);

  const createBlock = useCallback<UseTimelineResult["createBlock"]>(
    async (args) => {
      await createMut({
        title: args.title,
        day: args.day,
        startTime: args.startTime,
        endTime: args.endTime,
        kind: args.kind,
        notes: args.description,
        color: args.color,
        taskId: args.taskId,
        projectId: args.projectId,
        goalId: args.goalId,
        routineId: args.routineId,
        habitId: args.habitId,
        fixed: args.fixed ?? false,
        source: "manual",
        status: "planned",
      });
    },
    [createMut],
  );

  const updateBlock = useCallback<UseTimelineResult["updateBlock"]>(
    async (id, patch) => {
      await updateMut({ id, ...patch } as never);
    },
    [updateMut],
  );

  const deleteBlock = useCallback<UseTimelineResult["deleteBlock"]>(
    async (id) => {
      await deleteMut({ id });
    },
    [deleteMut],
  );

  return {
    view,
    dayKeys,
    byDay,
    commitmentsByDay,
    prefs,
    savePrefs,
    context,
    loading: blocks === undefined,
    createBlock,
    updateBlock,
    deleteBlock,
  };
}
