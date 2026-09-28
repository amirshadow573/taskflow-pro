/**
 * ConflictService (Phase 11 §13).
 *
 * Detects — and only detects: nothing is ever auto-fixed. Fixed commitments
 * in particular are never silently overwritten; a conflict is reported with
 * a Persian explanation and it is the user's call what to move.
 *
 * Detected kinds:
 *   invalid_range         block end ≤ start
 *   outside_window        block outside the configured day window
 *   overlap               two blocks (or two fixed events) collide
 *   double_booking        a block sits on top of a fixed commitment
 *   insufficient_duration block shorter than the task's estimate
 *   deadline_conflict     block scheduled after the task's due date
 *   back_to_back          work blocks with zero gap and no break
 */
import type { SchedulePrefs } from "@/lib/preferences";
import type {
  FixedCommitment,
  ScheduleBlock,
  ScheduleConflict,
} from "@/lib/scheduling/types";
import {
  durationOf,
  fmtHM,
  minutesOf,
  overlapMinutes,
  type Span,
} from "@/lib/scheduling/time";

/** Documented default for start-time-only commitments. */
const UNKNOWN_COMMITMENT_MINUTES = 60;

export interface ConflictInput {
  day: string;
  prefs: SchedulePrefs;
  events: FixedCommitment[];
  blocks: ScheduleBlock[];
  /** Task lookup for duration/deadline checks. */
  tasksById: Map<
    string,
    { title: string; estimateMinutes?: number; dueDate?: string; status: string }
  >;
  /** Current time (minutes) — past blocks are handled as MISSED_BLOCK recs. */
  nowMinutes?: number;
  /** Hard cap so one day can never drown in warnings. */
  limit?: number;
}

interface Entry {
  id?: string;
  title: string;
  span: Span;
  fixed: boolean;
  isBreak: boolean;
}

export function detectConflicts(input: ConflictInput): ScheduleConflict[] {
  const { day, prefs } = input;
  const out: ScheduleConflict[] = [];
  const limit = input.limit ?? 8;
  const push = (c: ScheduleConflict) => {
    if (out.length < limit && !out.some((x) => x.id === c.id)) out.push(c);
  };

  const windowStart = minutesOf(prefs.dayStart) ?? 0;
  const windowEnd = minutesOf(prefs.dayEnd) ?? 0;

  const entries: Entry[] = [];
  const invalidBlocks: ScheduleBlock[] = [];

  for (const b of input.blocks) {
    const start = minutesOf(b.startTime);
    const end = minutesOf(b.endTime);
    if (start === null || end === null || end <= start) {
      invalidBlocks.push(b);
      continue;
    }
    entries.push({
      id: b._id,
      title: b.title,
      span: { start, end },
      fixed: b.fixed,
      isBreak: b.kind === "break",
    });
  }

  for (const e of input.events) {
    const start = minutesOf(e.startTime);
    if (start === null) continue; // no start time → cannot place, never guess
    const dur = durationOf(e.startTime, e.endTime) ?? UNKNOWN_COMMITMENT_MINUTES;
    entries.push({
      id: e.id,
      title: e.title,
      span: { start, end: start + Math.max(15, dur) },
      fixed: true,
      isBreak: false,
    });
  }

  /* 1 — invalid ranges */
  for (const b of invalidBlocks) {
    push({
      id: `invalid_range:${b._id}:${day}`,
      kind: "invalid_range",
      day,
      detail: `بازه «${b.title}» نامعتبر است (${b.startTime} تا ${b.endTime}) — ساعت پایان باید بعد از ساعت شروع باشد.`,
      a: { id: b._id, title: b.title, start: b.startTime, end: b.endTime },
    });
  }

  /* 2 — outside the configured window */
  for (const e of entries) {
    if (!e.id) continue;
    if (e.span.start < windowStart || e.span.end > windowEnd) {
      push({
        id: `outside_window:${e.id}:${day}`,
        kind: "outside_window",
        day,
        detail: `«${e.title}» (${fmtHM(e.span.start)}–${fmtHM(e.span.end)}) بیرون از بازه روز شما (${prefs.dayStart}–${prefs.dayEnd}) است.`,
        a: {
          id: e.id,
          title: e.title,
          start: fmtHM(e.span.start),
          end: fmtHM(e.span.end),
        },
      });
    }
  }

  /* 3/4 — pairwise overlaps */
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      const ov = overlapMinutes(a.span, b.span);
      if (ov <= 0) continue;
      const bothFixed = a.fixed && b.fixed;
      const kind = bothFixed ? "overlap" : a.fixed || b.fixed ? "double_booking" : "overlap";
      push({
        id: `overlap:${a.id ?? a.title}:${b.id ?? b.title}:${day}`,
        kind,
        day,
        detail: bothFixed
          ? `«${a.title}» و «${b.title}» ${ov} دقیقه هم‌پوشانی دارند.`
          : `«${b.fixed ? a.title : b.title}» با «${b.fixed ? b.title : a.title}» ${ov} دقیقه تداخل دارد — تعهد ثابت جابه‌جا نمی‌شود.`,
        a: { id: a.id, title: a.title, start: fmtHM(a.span.start), end: fmtHM(a.span.end) },
        b: { id: b.id, title: b.title, start: fmtHM(b.span.start), end: fmtHM(b.span.end) },
      });
    }
  }

  /* 5/6/7 — block ↔ linked-task checks + back-to-back */
  const workBlocks = input.blocks
    .filter((b) => b.status !== "cancelled" && b.kind !== "break")
    .sort((x, y) => (x.startTime ?? "").localeCompare(y.startTime ?? ""));

  for (const b of workBlocks) {
    const start = minutesOf(b.startTime);
    const end = minutesOf(b.endTime);
    if (start === null || end === null || end <= start) continue;

    if (b.taskId) {
      const task = input.tasksById.get(b.taskId);
      if (task) {
        const dur = end - start;
        if (task.estimateMinutes && task.estimateMinutes > dur) {
          push({
            id: `insufficient_duration:${b._id}:${day}`,
            kind: "insufficient_duration",
            day,
            detail: `برای «${task.title}» ${task.estimateMinutes} دقیقه تخمین زده‌اید ولی این بلوک ${dur} دقیقه است.`,
            a: { id: b._id, title: b.title, start: b.startTime, end: b.endTime },
          });
        }
        if (task.dueDate && task.dueDate < day && task.status !== "done") {
          push({
            id: `deadline_conflict:${b._id}:${day}`,
            kind: "deadline_conflict",
            day,
            detail: `«${task.title}» ${task.dueDate} موعد دارد ولی ${day} برایش وقت گذاشته‌اید — بعد از موعد است.`,
            a: { id: b._id, title: b.title, start: b.startTime, end: b.endTime },
          });
        }
      }
    }
  }

  /* back-to-back work with zero gap (breaks are real elements — gap via a
     break block is fine, so break blocks are excluded from adjacency) */
  for (let i = 0; i < workBlocks.length - 1; i++) {
    const a = workBlocks[i];
    const b = workBlocks[i + 1];
    const aEnd = minutesOf(a.endTime);
    const bStart = minutesOf(b.startTime);
    if (aEnd === null || bStart === null) continue;
    if (bStart - aEnd === 0 && !(a.fixed && b.fixed)) {
      push({
        id: `back_to_back:${a._id}:${b._id}:${day}`,
        kind: "back_to_back",
        day,
        detail: `«${a.title}» و «${b.title}» بدون هیچ فاصله‌ای تمام می‌شوند — ${prefs.breakMinutes} دقیقه استراحت واقع‌بینانه است.`,
        a: { id: a._id, title: a.title, start: a.startTime, end: a.endTime },
        b: { id: b._id, title: b.title, start: b.startTime, end: b.endTime },
      });
    }
  }

  return out;
}
