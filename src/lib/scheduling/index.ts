/**
 * SchedulingEngine facade (Phase 11 §9).
 *
 * One pure function — `computeSchedule(input)` — runs the deterministic
 * scheduling layer over existing data, consuming Phase 10 planning signals:
 *
 *   AvailabilityService        → computeDayAvailability (availability.ts)
 *   CapacityService            → computeWeekLoad        (availability.ts)
 *   ConflictService            → detectConflicts        (conflicts.ts)
 *   DurationService            → duration from estimate/user (never invented)
 *   PlacementService           → suggestSlots           (placement.ts)
 *   ReschedulingService        → suggestReschedule / proposeMove
 *   ScheduleValidationService  → conflicts + load inside computeSchedule
 *   ScheduleRecommendationService → buildScheduleRecommendations
 *
 * PURE: no side effects, no storage writes, no backend calls. Consumers
 * memoize the call (src/hooks/use-schedule.ts). Scheduling changes always
 * happen through the existing controlled mutations after user confirmation.
 */
import type { AttentionBand } from "@/lib/planning";
import type { NextActionTask } from "@/lib/next-action";
import type { SchedulePrefs } from "@/lib/preferences";
import { computeDayAvailability, computeWeekLoad } from "@/lib/scheduling/availability";
import { detectConflicts } from "@/lib/scheduling/conflicts";
import {
  buildScheduleRecommendations,
  type ScheduleTask,
} from "@/lib/scheduling/recommendations";
import { buildScheduleSnapshot } from "@/lib/scheduling/snapshot";
import { addDays, nowMinutes as clockMinutes } from "@/lib/scheduling/time";
import type {
  DayAvailability,
  FixedCommitment,
  ScheduleBlock,
  ScheduleConflict,
  ScheduleRecommendation,
  ScheduleSnapshot,
  WeekDaySummary,
} from "@/lib/scheduling/types";

/* ------------------------------------------------------------------ */
/* Raw input shapes                                                    */
/* ------------------------------------------------------------------ */

/** A timeBlocks row as stored (legacy rows may lack the Phase 11 fields). */
export type ScheduleBlockInput = Omit<ScheduleBlock, "status" | "fixed" | "source"> & {
  status?: string;
  fixed?: boolean;
  source?: string;
};

export function normalizeBlock(b: ScheduleBlockInput): ScheduleBlock {
  return {
    ...b,
    status: b.status ?? "planned",
    fixed: b.fixed ?? false,
    source: b.source ?? "manual",
  };
}

/** Context-engine event rows (eventsInRange / eventsOnDay results). */
export interface RawContextEvent {
  _id: string;
  title: string;
  type: string;
  date?: string;
  weekdays?: number[];
  startTime?: string;
  endTime?: string;
}

/** Persona meeting rows (manager/employee meetings table). */
export interface RawMeeting {
  _id?: string;
  title: string;
  date: string;
  time?: string;
}

/**
 * Expand one-off + weekly-recurring context events (and persona meetings)
 * into per-day fixed commitments. Recurring rows expand exactly like the
 * Calendar page does — one source of truth for recurrence.
 */
export function expandCommitments(
  events: RawContextEvent[],
  meetings: RawMeeting[],
  dayKeys: string[],
): Map<string, FixedCommitment[]> {
  const out = new Map<string, FixedCommitment[]>();
  for (const day of dayKeys) {
    const weekday = new Date(`${day}T00:00:00`).getDay();
    const list: FixedCommitment[] = [];
    for (const e of events) {
      const matches = e.date === day || (e.date === undefined && (e.weekdays ?? []).includes(weekday));
      if (!matches) continue;
      list.push({
        id: `${e._id}:${day}`,
        title: e.title,
        day,
        startTime: e.startTime,
        endTime: e.endTime,
        origin: "event",
        type: e.type,
      });
    }
    meetings.forEach((m, i) => {
      if (m.date !== day) return;
      list.push({
        id: `${m._id ?? `m${i}`}:${day}`,
        title: m.title,
        day,
        startTime: m.time,
        endTime: undefined,
        origin: "meeting",
        type: "meeting",
      });
    });
    out.set(day, list);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Input / Output                                                      */
/* ------------------------------------------------------------------ */

export interface ScheduleInput {
  /** Primary day (today). The horizon starts here. */
  dayKey: string;
  prefs: SchedulePrefs;
  persona: string;
  /** All tasks (root + subtasks). */
  tasks: NextActionTask[];
  /** All time blocks (raw rows are normalized internally). */
  blocks: ScheduleBlockInput[];
  /** Context events covering the horizon (eventsInRange result). */
  rawEvents: RawContextEvent[];
  /** Persona meetings (empty array when the persona has none). */
  meetings: RawMeeting[];
  /**
   * Phase 10 planning signals (§25) — scheduling consumes the planner's
   * attention ranking instead of re-deriving priority.
   */
  planning?: {
    priorities: Array<{ taskId: string; score: number; attention: AttentionBand }>;
    nextActionTaskId?: string;
  };
  /** Horizon length in days (default: 6 → today + 6 = one week). */
  horizonDays?: number;
  /** Injected clock for deterministic tests (minutes since midnight). */
  nowMinutes?: number;
}

export interface ScheduleResult {
  dayKeys: string[];
  /** Availabilities for the horizon, today first. */
  days: DayAvailability[];
  today: DayAvailability;
  week: WeekDaySummary[];
  conflicts: ScheduleConflict[];
  recommendations: ScheduleRecommendation[];
  /** Open root tasks with no block in the horizon. */
  unscheduled: ScheduleTask[];
  /** Expanded fixed commitments per day (for UI timelines). */
  commitments: Map<string, FixedCommitment[]>;
  /** Normalized blocks (statuses/flags defaulted). */
  blocks: ScheduleBlock[];
  snapshot: ScheduleSnapshot;
}

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

export function computeSchedule(input: ScheduleInput): ScheduleResult {
  const horizon = Math.max(1, input.horizonDays ?? 6);
  const dayKeys = Array.from({ length: horizon + 1 }, (_, i) => addDays(input.dayKey, i));

  const blocks = input.blocks.map(normalizeBlock);
  const commitments = expandCommitments(input.rawEvents, input.meetings, dayKeys);

  const blocksByDay = new Map<string, ScheduleBlock[]>();
  for (const b of blocks) {
    if (!dayKeys.includes(b.day)) continue;
    const list = blocksByDay.get(b.day);
    if (list) list.push(b);
    else blocksByDay.set(b.day, [b]);
  }

  /* Availability per day */
  const days = dayKeys.map((day) =>
    computeDayAvailability({
      day,
      prefs: input.prefs,
      events: commitments.get(day) ?? [],
      blocks: blocksByDay.get(day) ?? [],
    }),
  );

  /* Weekly capacity / load */
  const week = computeWeekLoad({ days, tasks: input.tasks, blocks });
  for (const w of week) w.isToday = w.day === input.dayKey;

  /* Conflicts across the horizon */
  const tasksById = new Map(
    input.tasks.map((t) => [
      t._id,
      {
        title: t.title,
        estimateMinutes: t.estimateMinutes,
        dueDate: t.dueDate,
        status: t.status,
      },
    ]),
  );
  const conflicts: ScheduleConflict[] = [];
  for (const day of dayKeys) {
    conflicts.push(
      ...detectConflicts({
        day,
        prefs: input.prefs,
        events: commitments.get(day) ?? [],
        blocks: blocksByDay.get(day) ?? [],
        tasksById,
        nowMinutes: input.nowMinutes,
      }),
    );
  }

  /* Unscheduled work (open root tasks with no active block in horizon) */
  const scheduledIds = new Set(
    blocks
      .filter((b) => b.taskId && b.status !== "cancelled" && b.kind !== "break")
      .map((b) => b.taskId!),
  );
  const unscheduled = input.tasks.filter(
    (t) =>
      !t.parentId &&
      t.status !== "done" &&
      t.status !== "inbox" &&
      !scheduledIds.has(t._id),
  ) as ScheduleTask[];

  /* Recommendations (consume Phase 10 planning priorities) */
  const recommendations = buildScheduleRecommendations({
    dayKey: input.dayKey,
    prefs: input.prefs,
    persona: input.persona,
    days,
    week,
    blocks,
    tasks: input.tasks as ScheduleTask[],
    conflicts,
    priorities: input.planning?.priorities ?? [],
    nowMinutes: input.nowMinutes ?? clockMinutes(),
  });

  const snapshot = buildScheduleSnapshot({
    dayKey: input.dayKey,
    today: days[0],
    week,
    blocks,
    tasks: input.tasks as ScheduleTask[],
    conflicts,
    recommendations,
    unscheduled,
  });

  return {
    dayKeys,
    days,
    today: days[0],
    week,
    conflicts,
    recommendations,
    unscheduled,
    commitments,
    blocks,
    snapshot,
  };
}

/* ------------------------------------------------------------------ */
/* Public surface                                                      */
/* ------------------------------------------------------------------ */

export * from "@/lib/scheduling/types";
export {
  computeDayAvailability,
  computeWeekLoad,
  classifyLoad,
  UNKNOWN_COMMITMENT_MINUTES,
} from "@/lib/scheduling/availability";
export { detectConflicts } from "@/lib/scheduling/conflicts";
export { suggestSlots, suggestReschedule, proposeMove } from "@/lib/scheduling/placement";
export {
  buildScheduleRecommendations,
  scheduleRecSorter,
  MAX_SCHEDULE_RECOMMENDATIONS,
} from "@/lib/scheduling/recommendations";
export { buildScheduleSnapshot } from "@/lib/scheduling/snapshot";
export {
  dismissScheduleRecommendation,
  filterDismissedSchedule,
  getScheduleDismissedSnapshot,
  subscribeScheduleDismissals,
} from "@/lib/scheduling/dismissals";
export {
  durationOf,
  fmtHM,
  mergeSpans,
  minutesOf,
  nowMinutes,
  freeSpans,
} from "@/lib/scheduling/time";
