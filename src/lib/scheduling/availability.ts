/**
 * AvailabilityService + CapacityService (Phase 11 §6, §8).
 *
 * Realistic available time for a day:
 *
 *   Total Day (configured window — NEVER the full 24h)
 *   − Fixed commitments (context events, meetings, fixed blocks)
 *   − Reserved time (breaks; buffer is applied when carving gaps)
 *   − Already-scheduled flexible work
 *   = Available Planning Time (the returned gaps)
 *
 * Events without an end time count with the documented 60-minute default
 * (same assumption the Phase 10 workload service uses) — the explanation
 * always says so. Meetings with no start time cannot be placed as intervals
 * and are excluded (never guessed).
 */
import type { SchedulePrefs } from "@/lib/preferences";
import type {
  DayAvailability,
  DayLoadState,
  FixedCommitment,
  ScheduleBlock,
  TimeSlot,
  WeekDaySummary,
} from "@/lib/scheduling/types";
import {
  durationOf,
  fmtHM,
  freeSpans,
  mergeSpans,
  minutesOf,
  type Span,
} from "@/lib/scheduling/time";

/** Documented fallback for commitments that only carry a start time. */
export const UNKNOWN_COMMITMENT_MINUTES = 60;

interface OccupiedPiece {
  span: Span;
  kind: "fixed" | "scheduled" | "break";
  label: string;
  id?: string;
}

/** Parse one fixed commitment into an interval (null when no start time). */
function commitmentSpan(c: FixedCommitment): Span | null {
  const start = minutesOf(c.startTime);
  if (start === null) return null;
  const dur = durationOf(c.startTime, c.endTime) ?? UNKNOWN_COMMITMENT_MINUTES;
  return { start, end: start + Math.max(15, dur) };
}

function blockSpan(b: ScheduleBlock): Span | null {
  const start = minutesOf(b.startTime);
  const end = minutesOf(b.endTime);
  if (start === null || end === null || end <= start) return null;
  return { start, end };
}

const ACTIVE_BLOCK_STATUSES = new Set(["planned", "completed"]);

export interface DayInput {
  day: string;
  prefs: SchedulePrefs;
  /** Fixed commitments already filtered/expanded for this day. */
  events: FixedCommitment[];
  /** Time blocks already filtered for this day. */
  blocks: ScheduleBlock[];
}

/**
 * Compute one day's availability. Deterministic; `unknown` is only true
 * when the configured window itself is unusable — we never fabricate time.
 */
export function computeDayAvailability(input: DayInput): DayAvailability {
  const { day, prefs, events, blocks } = input;
  const windowStart = minutesOf(prefs.dayStart) ?? 0;
  const windowEnd = minutesOf(prefs.dayEnd) ?? 0;
  const invalidWindow = windowEnd <= windowStart;

  const pieces: OccupiedPiece[] = [];

  for (const e of events) {
    const span = commitmentSpan(e);
    if (!span) continue;
    pieces.push({ span, kind: "fixed", label: e.title, id: e.id });
  }

  for (const b of blocks) {
    if (!ACTIVE_BLOCK_STATUSES.has(b.status)) continue;
    const span = blockSpan(b);
    if (!span) continue;
    if (b.kind === "break") {
      pieces.push({ span, kind: "break", label: b.title, id: b._id });
    } else if (b.fixed) {
      pieces.push({ span, kind: "fixed", label: b.title, id: b._id });
    } else {
      pieces.push({ span, kind: "scheduled", label: b.title, id: b._id });
    }
  }

  if (invalidWindow) {
    return {
      day,
      windowStart: prefs.dayStart,
      windowEnd: prefs.dayEnd,
      totalMinutes: 0,
      fixedMinutes: 0,
      reservedMinutes: 0,
      scheduledMinutes: 0,
      availableMinutes: 0,
      gaps: [],
      unknown: true,
    };
  }

  const fixedMinutes = sumMinutes(pieces.filter((p) => p.kind === "fixed"));
  const scheduledMinutes = sumMinutes(pieces.filter((p) => p.kind === "scheduled"));
  const reservedMinutes = sumMinutes(pieces.filter((p) => p.kind === "break"));
  const totalMinutes = windowEnd - windowStart;

  const windowSpan: Span = { start: windowStart, end: windowEnd };
  const rawGaps = freeSpans(
    windowSpan,
    pieces.map((p) => p.span),
  );

  /* Buffer: pad each gap by bufferMinutes on both interior sides so two
     placements can never end up back-to-back against the user's wishes. */
  const buffer = Math.max(0, prefs.bufferMinutes);
  const gaps: TimeSlot[] = [];
  for (const g of rawGaps) {
    const start = g.start === windowStart ? g.start : g.start + buffer;
    const end = g.end === windowEnd ? g.end : g.end - buffer;
    if (end - start >= 15) gaps.push({ start: fmtHM(start), end: fmtHM(end), minutes: end - start });
  }

  return {
    day,
    windowStart: prefs.dayStart,
    windowEnd: prefs.dayEnd,
    totalMinutes,
    fixedMinutes,
    reservedMinutes,
    scheduledMinutes,
    availableMinutes: gaps.reduce((n, g) => n + g.minutes, 0),
    gaps,
    unknown: false,
  };
}

function sumMinutes(pieces: OccupiedPiece[]): number {
  // Union of spans so overlapping entries are never double-counted.
  return mergeSpans(pieces.map((p) => p.span)).reduce((n, s) => n + (s.end - s.start), 0);
}

/* ------------------------------------------------------------------ */
/* Weekly load (CapacityService)                                       */
/* ------------------------------------------------------------------ */

export interface WeekLoadInput {
  days: DayAvailability[];
  /** Open root tasks (used for due-date workload per day). */
  tasks: Array<{
    _id: string;
    dueDate?: string;
    estimateMinutes?: number;
    status: string;
    parentId?: string;
  }>;
  /** Blocks for the whole week (already active statuses filtered or not). */
  blocks: ScheduleBlock[];
}

const LOAD_THRESHOLDS = { balancedFrom: 0.35, heavyFrom: 0.75 } as const;

export function classifyLoad(plannedMinutes: number, availableMinutes: number | null): DayLoadState {
  if (availableMinutes === null || availableMinutes <= 0) {
    return plannedMinutes > 0 ? "overloaded" : "light";
  }
  const ratio = plannedMinutes / availableMinutes;
  if (ratio > 1) return "overloaded";
  if (ratio >= LOAD_THRESHOLDS.heavyFrom) return "heavy";
  if (ratio >= LOAD_THRESHOLDS.balancedFrom) return "balanced";
  return "light";
}

/** Per-day workload distribution across the week (§8). */
export function computeWeekLoad(input: WeekLoadInput): WeekDaySummary[] {
  return input.days.map((availability) => {
    const day = availability.day;
    const due = input.tasks.filter(
      (t) =>
        t.status !== "done" &&
        !t.parentId &&
        t.dueDate === day,
    );
    const scheduledIds = new Set(
      input.blocks
        .filter(
          (b) =>
            b.day === day &&
            b.taskId &&
            b.status !== "cancelled" &&
            b.kind !== "break",
        )
        .map((b) => b.taskId!),
    );
    const unscheduled = due.filter((t) => !scheduledIds.has(t._id));
    const unscheduledMinutes = unscheduled.reduce(
      (n, t) => n + (t.estimateMinutes ?? 0),
      0,
    );
    const plannedMinutes = availability.scheduledMinutes + unscheduledMinutes;

    return {
      day,
      availability,
      plannedMinutes,
      unscheduledMinutes,
      dueTaskCount: due.length,
      load: classifyLoad(plannedMinutes, availability.availableMinutes),
      isToday: false,
    };
  });
}
