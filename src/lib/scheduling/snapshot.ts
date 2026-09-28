/**
 * Schedule snapshot (Phase 11 §34).
 *
 * The structured "what does the schedule look like" summary — deterministic,
 * built client-side, never persisted (so no lifecycle/duplication problem).
 * This is the second major input a future AI layer will receive, next to the
 * Phase 10 PlanningSnapshot.
 */
import type {
  DayAvailability,
  ScheduleBlock,
  ScheduleConflict,
  ScheduleRecommendation,
  ScheduleSnapshot,
  WeekDaySummary,
} from "@/lib/scheduling/types";
import { minutesOf } from "@/lib/scheduling/time";
import type { ScheduleTask } from "@/lib/scheduling/recommendations";

export interface ScheduleSnapshotInput {
  dayKey: string;
  today: DayAvailability;
  week: WeekDaySummary[];
  blocks: ScheduleBlock[];
  tasks: ScheduleTask[];
  conflicts: ScheduleConflict[];
  recommendations: ScheduleRecommendation[];
  unscheduled: ScheduleTask[];
}

export function buildScheduleSnapshot(input: ScheduleSnapshotInput): ScheduleSnapshot {
  const { dayKey, today, week, blocks } = input;
  const todayBlocks = blocks.filter(
    (b) => b.day === dayKey && b.status !== "cancelled",
  );

  const fixedBlocks = todayBlocks
    .filter((b) => b.fixed)
    .map((b) => ({ id: b._id, title: b.title, start: b.startTime, end: b.endTime }));

  const flexibleBlocks = todayBlocks
    .filter((b) => !b.fixed && b.kind !== "break")
    .map((b) => ({
      id: b._id,
      title: b.title,
      start: b.startTime,
      end: b.endTime,
      taskId: b.taskId,
    }));

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const isToday = (b: ScheduleBlock) => {
    if (b.status !== "planned" || b.kind === "break") return false;
    const start = minutesOf(b.startTime);
    const end = minutesOf(b.endTime);
    if (start === null || end === null) return false;
    return start >= nowMin;
  };
  const next = todayBlocks
    .filter(isToday)
    .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""))[0];

  const todaySummary = week.find((w) => w.day === dayKey);

  return {
    date: dayKey,
    availableTime: today.unknown ? null : today.availableMinutes,
    occupiedTime: today.unknown ? null : today.fixedMinutes + today.scheduledMinutes,
    fixedBlocks,
    flexibleBlocks,
    unscheduledTasks: input.unscheduled.slice(0, 20).map((t) => ({
      id: t._id,
      title: t.title,
      minutes: t.estimateMinutes ?? null,
      dueDate: t.dueDate,
    })),
    workload: {
      plannedMinutes: todaySummary?.plannedMinutes ?? today.scheduledMinutes,
      availableMinutes: today.unknown ? null : today.availableMinutes,
      state: todaySummary?.load ?? "light",
    },
    conflicts: input.conflicts.filter((c) => c.day === dayKey),
    recommendations: input.recommendations,
    nextBlock: next
      ? {
          id: next._id,
          title: next.title,
          start: next.startTime,
          end: next.endTime,
          taskId: next.taskId,
        }
      : null,
    week: week.map((w) => ({
      day: w.day,
      plannedMinutes: w.plannedMinutes,
      availableMinutes: w.availability.unknown ? null : w.availability.availableMinutes,
      load: w.load,
    })),
    generatedAt: Date.now(),
  };
}
