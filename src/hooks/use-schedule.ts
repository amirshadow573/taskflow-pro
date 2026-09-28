/**
 * useSchedule — Phase 11 data + computation hook.
 *
 * Gathers time blocks, the week's context events + persona meetings, the
 * user's schedule preferences and the Phase 10 planning result, then runs
 * `computeSchedule` inside ONE memo. Exposes dismissal-filtered schedule
 * recommendations plus the controlled mutations that apply confirmed
 * changes (create / update / delete block, apply previewed moves).
 *
 * Rules honored:
 *   - The caller passes its existing planning result (usePlanning), so the
 *     planner is computed once per surface, not twice (§37).
 *   - Identical Convex subscriptions are shared across surfaces.
 *   - Nothing mutates without an explicit user action (§2, §30).
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useWorkspace, type TaskDoc } from "@/components/workspace/WorkspaceData";
import { useUserProfile } from "@/hooks/use-user-profile";
import { usePlanning, type UsePlanningResult } from "@/hooks/use-planning";
import { useSchedulePrefs } from "@/lib/preferences";
import {
  computeSchedule,
  dismissScheduleRecommendation,
  getScheduleDismissedSnapshot,
  subscribeScheduleDismissals,
  type ProposedMove,
  type ScheduleRecommendation,
  type ScheduleResult,
} from "@/lib/scheduling";
import { addDaysKey } from "@/lib/task-utils";

const EMPTY: never[] = [];

export interface CreateBlockArgs {
  title: string;
  day: string;
  startTime: string;
  endTime: string;
  kind: string;
  taskId?: Id<"tasks">;
  projectId?: Id<"projects">;
  goalId?: Id<"personalGoals">;
  status?: string;
  fixed?: boolean;
  source?: string;
  priority?: string;
  notes?: string;
}

export interface UseScheduleResult {
  dayKey: string;
  prefs: ReturnType<typeof useSchedulePrefs>[0];
  savePrefs: (next: ReturnType<typeof useSchedulePrefs>[0]) => void;
  /** Full engine output (memoized). */
  result: ScheduleResult;
  /** Schedule recommendations with local dismissals applied. */
  recommendations: ScheduleRecommendation[];
  dismiss: (id: string) => void;
  /** Controlled mutations — all require an explicit user action. */
  createBlock: (args: CreateBlockArgs) => Promise<void>;
  updateBlock: (
    id: Id<"timeBlocks">,
    patch: Record<string, unknown>,
  ) => Promise<void>;
  deleteBlock: (id: Id<"timeBlocks">) => Promise<void>;
  /** Task → time block (§10): explicit, confirmed scheduling. */
  scheduleTask: (
    task: TaskDoc,
    slot: { day: string; start: string; end: string },
  ) => Promise<void>;
  /** Apply a previewed move (single or bulk, after confirmation). */
  applyMove: (move: ProposedMove) => Promise<void>;
  applyMoves: (moves: ProposedMove[]) => Promise<void>;
}

export function useSchedule(plan: UsePlanningResult): UseScheduleResult {
  const { tasks } = useWorkspace();
  const { personaKey } = useUserProfile();
  const [prefs, savePrefs] = useSchedulePrefs();

  const dayKey = plan.dayKey;
  const weekEnd = addDaysKey(6);

  /* Shared schedule data */
  const timeBlocks = useQuery(api.personal.listTimeBlocks, {});
  const eventsInRange = useQuery(api.context.eventsInRange, {
    start: dayKey,
    end: weekEnd,
  });
  const needsMeetings =
    personaKey === "employee" || personaKey === "manager" || personaKey === "team";
  const meetings = useQuery(api.manager.listMeetings, needsMeetings ? {} : "skip");

  /* Planning signals (Phase 10 → Phase 11, §25) */
  const priorities = useMemo(
    () =>
      plan.result.priorities.map((p) => ({
        taskId: p.task._id as string,
        score: p.attention.score,
        attention: p.attention.attention,
      })),
    [plan.result],
  );

  const result = useMemo<ScheduleResult>(
    () =>
      computeSchedule({
        dayKey,
        prefs,
        persona: personaKey,
        tasks,
        blocks: timeBlocks ?? EMPTY,
        rawEvents: eventsInRange ?? EMPTY,
        meetings: needsMeetings ? (meetings ?? EMPTY) : EMPTY,
        planning: {
          priorities,
          nextActionTaskId: plan.result.nextAction?.task._id as string | undefined,
        },
      }),
    [
      dayKey,
      prefs,
      personaKey,
      tasks,
      timeBlocks,
      eventsInRange,
      needsMeetings,
      meetings,
      priorities,
      plan.result,
    ],
  );

  /* Dismissals — local, non-destructive, day-scoped */
  const dismissed = useSyncExternalStore(
    subscribeScheduleDismissals,
    () => getScheduleDismissedSnapshot(dayKey),
    () => getScheduleDismissedSnapshot(dayKey),
  );
  const recommendations = useMemo(() => {
    const set = new Set(dismissed);
    return result.recommendations.filter((r) => !set.has(r.id));
  }, [result, dismissed]);
  const dismiss = useCallback(
    (id: string) => dismissScheduleRecommendation(id, dayKey),
    [dayKey],
  );

  /* Controlled mutations */
  const createMut = useMutation(api.personal.createTimeBlock);
  const updateMut = useMutation(api.personal.updateTimeBlock);
  const deleteMut = useMutation(api.personal.deleteTimeBlock);

  const createBlock = useCallback(
    async (args: CreateBlockArgs) => {
      await createMut(args);
    },
    [createMut],
  );
  const updateBlock = useCallback(
    async (id: Id<"timeBlocks">, patch: Record<string, unknown>) => {
      await updateMut({ id, ...patch } as never);
    },
    [updateMut],
  );
  const deleteBlock = useCallback(
    async (id: Id<"timeBlocks">) => {
      await deleteMut({ id });
    },
    [deleteMut],
  );

  const scheduleTask = useCallback(
    async (task: TaskDoc, slot: { day: string; start: string; end: string }) => {
      await createMut({
        title: task.title,
        day: slot.day,
        startTime: slot.start,
        endTime: slot.end,
        kind: "task",
        taskId: task._id,
        projectId: task.projectId,
        priority: task.priority,
        source: "planning",
        status: "planned",
      });
    },
    [createMut],
  );

  const applyMove = useCallback(
    async (move: ProposedMove) => {
      await updateMut({
        id: move.blockId as Id<"timeBlocks">,
        day: move.to.day,
        startTime: move.to.start,
        endTime: move.to.end,
        source: "reschedule",
      });
    },
    [updateMut],
  );

  const applyMoves = useCallback(
    async (moves: ProposedMove[]) => {
      for (const m of moves) await applyMove(m);
    },
    [applyMove],
  );

  return {
    dayKey,
    prefs,
    savePrefs,
    result,
    recommendations,
    dismiss,
    createBlock,
    updateBlock,
    deleteBlock,
    scheduleTask,
    applyMove,
    applyMoves,
  };
}

/** Re-export so surfaces can chain planning + scheduling without extra imports. */
export { usePlanning };
export type { UsePlanningResult };
