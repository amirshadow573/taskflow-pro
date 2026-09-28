/**
 * Execution deviation engine (Phase 12 §7 / §13).
 *
 * Turns observable data into structured deviation signals:
 * under-run, over-run, late/early start, missed block, partial execution,
 * repeated delay, schedule drift and real overload.
 *
 * Rules that matter:
 *   - Only what the product can actually observe. No claim about WHY the user
 *     was late, and no psychological labelling (§13).
 *   - Thresholds are conservative and documented, so a normal day produces no
 *     noise and a signal always means something.
 *   - Deterministic: same inputs → same signals, ordered stably.
 */
import { minutesOf } from "@/lib/scheduling";
import { toFa } from "@/lib/persian";
import {
  LATE_START_THRESHOLD_MINUTES,
  VARIANCE_MIN_MINUTES,
  VARIANCE_SHARE,
  actionOf,
  isFinishedSession,
  sessionMinutes,
} from "./metrics";
import type {
  DeviationKind,
  DeviationSignal,
  ExecutionBlockLite,
  ExecutionEventRow,
  ExecutionSession,
  ExecutionTaskLite,
} from "./types";

/** Drift needs a meaningful gap before it is worth telling the user about. */
export const DRIFT_MIN_MINUTES = 60;
export const DRIFT_SHARE = 0.4;
/** Repeated delay is only a pattern from the third observation onward. */
export const REPEATED_DELAY_MIN_COUNT = 2;

export interface DeviationInput {
  dayKey: string;
  sessions: ExecutionSession[];
  events: ExecutionEventRow[];
  blocks: ExecutionBlockLite[];
  tasks: ExecutionTaskLite[];
  nowMs: number;
  /** Phase 10 workload reading (reused, never re-derived). */
  workloadState?: string | null;
  /** Phase 11 signals: already-detected missed blocks + real capacity. */
  missedBlockIds?: string[];
  todayScheduledMinutes?: number | null;
  todayAvailableMinutes?: number | null;
}

function minuteOfDay(at: number): number {
  const d = new Date(at);
  return d.getHours() * 60 + d.getMinutes();
}

export function detectDeviations(input: DeviationInput): DeviationSignal[] {
  const signals: DeviationSignal[] = [];
  const blockById = new Map(input.blocks.map((b) => [b._id, b]));
  const taskById = new Map(input.tasks.map((t) => [t._id, t]));

  /* ---- per-session duration + start-time deviations ---- */
  for (const s of input.sessions) {
    const block = s.blockId ? blockById.get(s.blockId) : undefined;

    if (isFinishedSession(s) && s.plannedMinutes && s.plannedMinutes > 0) {
      const actual = sessionMinutes(s, input.nowMs);
      const variance = actual - s.plannedMinutes;
      const threshold = Math.max(
        VARIANCE_MIN_MINUTES,
        Math.round(s.plannedMinutes * VARIANCE_SHARE),
      );
      if (variance >= threshold) {
        signals.push({
          kind: "OVER_RUN",
          detail: `«${s.title}» ${toFa(actual)} دقیقه طول کشید، در حالی که ${toFa(
            s.plannedMinutes,
          )} دقیقه تخمین زده شده بود.`,
          day: s.day,
          taskId: s.taskId,
          blockId: s.blockId,
          sessionId: s._id,
          minutes: variance,
        });
      } else if (-variance >= threshold) {
        signals.push({
          kind: "UNDER_RUN",
          detail: `«${s.title}» ${toFa(actual)} دقیقه طول کشید — ${toFa(
            Math.abs(variance),
          )} دقیقه زودتر از تخمین ${toFa(s.plannedMinutes)} دقیقه‌ای.`,
          day: s.day,
          taskId: s.taskId,
          blockId: s.blockId,
          sessionId: s._id,
          minutes: variance,
        });
      }
    }

    if (block && block.day === s.day && block.startTime) {
      const scheduled = minutesOf(block.startTime);
      if (scheduled !== null) {
        const delta = minuteOfDay(s.startedAt) - scheduled;
        if (delta >= LATE_START_THRESHOLD_MINUTES) {
          signals.push({
            kind: "LATE_START",
            detail: `«${s.title}» با ${toFa(delta)} دقیقه تأخیر از ساعت ${toFa(
              block.startTime,
            )} شروع شد.`,
            day: s.day,
            taskId: s.taskId,
            blockId: s.blockId,
            sessionId: s._id,
            minutes: delta,
          });
        } else if (-delta >= LATE_START_THRESHOLD_MINUTES) {
          signals.push({
            kind: "EARLY_START",
            detail: `«${s.title}» ${toFa(Math.abs(delta))} دقیقه زودتر از ساعت ${toFa(
              block.startTime,
            )} شروع شد.`,
            day: s.day,
            taskId: s.taskId,
            blockId: s.blockId,
            sessionId: s._id,
            minutes: delta,
          });
        }
      }
    }

    /* ---- partial execution ---- */
    const partial =
      s.feedback === "partial" ||
      (s.state === "abandoned" && sessionMinutes(s, input.nowMs) >= 10);
    if (partial) {
      signals.push({
        kind: "PARTIAL_EXECUTION",
        detail: `«${s.title}» شروع شد اما کامل نشد (${toFa(
          sessionMinutes(s, input.nowMs),
        )} دقیقه کار ثبت شد).`,
        day: s.day,
        taskId: s.taskId,
        blockId: s.blockId,
        sessionId: s._id,
        minutes: sessionMinutes(s, input.nowMs),
      });
    }
  }

  /* ---- missed blocks (Phase 11 already detected them — reuse) ---- */
  const missed = new Set(input.missedBlockIds ?? []);
  for (const b of input.blocks) {
    if (b.status === "missed") missed.add(b._id);
  }
  for (const id of missed) {
    const block = blockById.get(id);
    if (!block) continue;
    signals.push({
      kind: "MISSED_BLOCK",
      detail: `بلوک «${block.title}» (${toFa(block.startTime)}–${toFa(block.endTime)}) بدون اجرا گذشت.`,
      day: block.day,
      taskId: block.taskId,
      blockId: block._id,
    });
  }

  /* ---- repeated delay (§13) ---- */
  for (const task of input.tasks) {
    if ((task.postponeCount ?? 0) >= REPEATED_DELAY_MIN_COUNT) {
      signals.push({
        kind: "REPEATED_DELAY",
        detail: `موعد «${task.title}» ${toFa(task.postponeCount ?? 0)} بار جابه‌جا شده است.`,
        taskId: task._id,
        minutes: undefined,
      });
    }
  }
  const postponeByTask = new Map<string, number>();
  const rescheduleByBlock = new Map<string, number>();
  for (const e of input.events) {
    if (e.type === "TASK_POSTPONED" && e.taskId) {
      postponeByTask.set(e.taskId, (postponeByTask.get(e.taskId) ?? 0) + 1);
    }
    if (e.type === "RECOVERY_ACTION" && e.blockId && actionOf(e) === "reschedule") {
      rescheduleByBlock.set(e.blockId, (rescheduleByBlock.get(e.blockId) ?? 0) + 1);
    }
  }
  for (const [taskId, count] of postponeByTask) {
    const task = taskById.get(taskId);
    if (!task || count < REPEATED_DELAY_MIN_COUNT) continue;
    if ((task.postponeCount ?? 0) >= REPEATED_DELAY_MIN_COUNT) continue; // already reported
    signals.push({
      kind: "REPEATED_DELAY",
      detail: `«${task.title}» در بازه اخیر ${toFa(count)} بار به تعویق افتاده است.`,
      taskId,
    });
  }
  for (const [blockId, count] of rescheduleByBlock) {
    if (count < REPEATED_DELAY_MIN_COUNT) continue;
    const block = blockById.get(blockId);
    signals.push({
      kind: "REPEATED_DELAY",
      detail: `${block ? `بلوک «${block.title}»` : "یک بلوک"} ${toFa(count)} بار جابه‌جا شده است.`,
      blockId,
      taskId: block?.taskId,
    });
  }

  /* ---- schedule drift ---- */
  const scheduled = input.todayScheduledMinutes;
  const executed = input.sessions
    .filter((s) => s.day === input.dayKey)
    .reduce((sum, s) => sum + sessionMinutes(s, input.nowMs), 0);
  if (scheduled != null && scheduled > 0) {
    const drift = executed - scheduled;
    const threshold = Math.max(DRIFT_MIN_MINUTES, Math.round(scheduled * DRIFT_SHARE));
    if (Math.abs(drift) >= threshold) {
      signals.push({
        kind: "SCHEDULE_DRIFT",
        detail:
          drift < 0
            ? `از ${toFa(scheduled)} دقیقه برنامه امروز، ${toFa(executed)} دقیقه اجرا شده است (${toFa(
                Math.abs(drift),
              )} دقیقه فاصله).`
            : `امروز ${toFa(executed)} دقیقه اجرا شده، در حالی که برنامه ${toFa(
                scheduled,
              )} دقیقه بود.`,
        day: input.dayKey,
        minutes: drift,
      });
    }
  }

  /* ---- overload: REAL workload beyond what the day offers ---- */
  const available = input.todayAvailableMinutes;
  if (available != null && available > 0 && executed > available) {
    signals.push({
      kind: "OVERLOAD",
      detail: `زمان اجراشده امروز (${toFa(executed)} دقیقه) از ظرفیت واقعی روز (${toFa(
        available,
      )} دقیقه) بیشتر شده است.`,
      day: input.dayKey,
      minutes: executed - available,
    });
  } else if (input.workloadState === "overloaded") {
    signals.push({
      kind: "OVERLOAD",
      detail: "بار کاری امروز بیش از ظرفیت برنامه‌ریزی‌شده ثبت شده است.",
      day: input.dayKey,
    });
  }

  return sortSignals(signals);
}

const KIND_ORDER: DeviationKind[] = [
  "MISSED_BLOCK",
  "OVERLOAD",
  "REPEATED_DELAY",
  "OVER_RUN",
  "SCHEDULE_DRIFT",
  "PARTIAL_EXECUTION",
  "LATE_START",
  "UNDER_RUN",
  "EARLY_START",
];

/** Stable ordering: strongest signal kind first, then the largest magnitude. */
export function sortSignals(signals: DeviationSignal[]): DeviationSignal[] {
  return [...signals].sort(
    (a, b) =>
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
      Math.abs(b.minutes ?? 0) - Math.abs(a.minutes ?? 0) ||
      (a.sessionId ?? a.taskId ?? "").localeCompare(b.sessionId ?? b.taskId ?? ""),
  );
}

/** Count per deviation kind — used by the snapshot + insights UI. */
export function deviationCounts(signals: DeviationSignal[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of signals) out[s.kind] = (out[s.kind] ?? 0) + 1;
  return out;
}
