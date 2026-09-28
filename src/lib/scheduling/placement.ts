/**
 * PlacementService + ReschedulingService (Phase 11 §12, §21, §22).
 *
 * Deterministic slot proposals — no AI, no randomness:
 *
 *   1. Duration comes from the caller (task estimate or an explicit user
 *      pick). We NEVER invent a precise duration (§11).
 *   2. Only real free gaps (AvailabilityService) inside the configured day
 *      window are candidates, and only up to the deadline.
 *   3. Score = deadline pressure + preferred focus hours + realism
 *      (nothing in the past, nothing past the preferred window).
 *   4. Same inputs → same proposals, always with a Persian reason.
 *
 * Rescheduling and "move this block" reuse the exact same logic with the
 * block's own interval removed, so suggestions can never collide with the
 * schedule they are replacing.
 */
import type { SchedulePrefs } from "@/lib/preferences";
import type {
  DayAvailability,
  PlacementResult,
  PlacementTarget,
  ProposedMove,
  ProposedSlot,
  ScheduleBlock,
} from "@/lib/scheduling/types";
import { fmtHM, minutesOf, nowMinutes as clockMinutes } from "@/lib/scheduling/time";

const MAX_SLOTS = 3;

/* ------------------------------------------------------------------ */
/* Focus-window scoring (§17)                                          */
/* ------------------------------------------------------------------ */

const MORNING: [number, number] = [8 * 60, 12 * 60];
const EVENING: [number, number] = [15 * 60, 20 * 60];
const PREFERRED_ANY: [number, number] = [9 * 60, 18 * 60];

function focusBonus(startMin: number, endMin: number, prefs: SchedulePrefs): number {
  const window =
    prefs.focusPreference === "morning"
      ? MORNING
      : prefs.focusPreference === "evening"
        ? EVENING
        : PREFERRED_ANY;
  const inside = startMin >= window[0] && endMin <= window[1];
  if (inside) return 25;
  const overlaps = startMin < window[1] && endMin > window[0];
  return overlaps ? 10 : 0;
}

function focusReason(prefs: SchedulePrefs): string {
  if (prefs.focusPreference === "morning") return "داخل بازه تمرکز صبحگاهی تو";
  if (prefs.focusPreference === "evening") return "داخل بازه تمرکز عصرگاهی تو";
  return "داخل ساعات کاری مؤثر روز";
}

/* ------------------------------------------------------------------ */
/* Placement                                                           */
/* ------------------------------------------------------------------ */

export interface PlacementInput {
  target: PlacementTarget;
  /** Availabilities ordered today → future (already computed). */
  days: DayAvailability[];
  prefs: SchedulePrefs;
  /** Do not propose slots after the due date (when it falls inside range). */
  persona?: string;
  /** Injected clock for tests (minutes since midnight). */
  nowMinutes?: number;
}

export function suggestSlots(input: PlacementInput): PlacementResult {
  const { target, days, prefs } = input;
  const notes: string[] = [];

  /* Duration is mandatory — never fabricated (§11). */
  if (!target.minutes || target.minutes <= 0) {
    return {
      slots: [],
      notes: ["مدت این کار مشخص نیست — اول یک تخمین انتخاب کن تا جا پیشنهاد بدهم."],
      needsDuration: true,
    };
  }

  const now = input.nowMinutes ?? clockMinutes();
  const dueDelta =
    target.dueDate && days.length > 0
      ? Math.round(
          (Date.parse(`${target.dueDate}T00:00:00`) -
            Date.parse(`${days[0].day}T00:00:00`)) /
            86400000,
        )
      : null;

  const overdue = dueDelta !== null && dueDelta < 0;
  if (overdue) notes.push("این کار عقب‌افتاده است — زودترین زمان ممکن پیشنهاد می‌شود.");

  const candidates: ProposedSlot[] = [];

  days.forEach((d, dayIndex) => {
    if (target.dueDate && d.day > target.dueDate && !overdue) return; // after deadline
    d.gaps.forEach((gap) => {
      const startMin = minutesOf(gap.start);
      const endMin = minutesOf(gap.end);
      if (startMin === null || endMin === null) return;
      if (gap.minutes < target.minutes) return;

      const slotStart = startMin;
      const slotEnd = startMin + target.minutes;
      const isToday = dayIndex === 0;
      const startPast = isToday && slotEnd <= now;
      const nowPenalty = isToday && slotStart < now && !startPast ? -10 : 0;

      let score = 50;
      // Deadline pressure: earlier days win, ASAP tasks win hardest.
      score += (days.length - dayIndex) * 6;
      if (dueDelta !== null && dueDelta <= 1) score += isToday ? 25 : 10;
      score += focusBonus(slotStart, slotEnd, prefs);
      // Efficiency: prefer gaps that don't waste much space.
      const slack = gap.minutes - target.minutes;
      if (slack <= 30) score += 8;
      if (startPast) score -= 40;
      score += nowPenalty;
      if (slotEnd > 21 * 60) score -= 15;

      const reasons = [`${fmtHM(slotStart)}–${fmtHM(slotEnd)} داخل بازه آزاد ${gap.start}–${gap.end}`];
      reasons.push(focusReason(prefs));
      if (isToday && slotStart >= now && !startPast) reasons.push("امروز قابل اجراست");
      if (dueDelta !== null && dueDelta <= 1) reasons.push("نزدیک‌ترین زمان قبل از موعد");

      candidates.push({
        day: d.day,
        start: fmtHM(slotStart),
        end: fmtHM(slotEnd),
        minutes: target.minutes,
        reason: reasons.join(" · "),
        score: Math.round(score),
      });
    });
  });

  if (candidates.length === 0) {
    if (target.dueDate && days.length > 0 && days[0].day > target.dueDate) {
      notes.push(`موعد این کار (${target.dueDate}) گذشته و جای خالی در بازه موجود نیست.`);
    } else if (days.every((d) => d.gaps.length === 0)) {
      notes.push("در روزهای آینده جای خالی به اندازه این کار پیدا نشد — تعهدها را بازبینی کن.");
    } else {
      notes.push(
        `به انداه ${target.minutes} دقیقه جای خالی پیوسته وجود ندارد — یا مدت را کم کن، یا کار را به چند جلسه تقسیم کن.`,
      );
    }
    return { slots: [], notes, needsDuration: false };
  }

  candidates.sort(
    (a, b) =>
      b.score - a.score || a.day.localeCompare(b.day) || a.start.localeCompare(b.start),
  );

  const slots: ProposedSlot[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    const key = `${c.day}:${c.start}`;
    if (seen.has(key)) continue;
    seen.add(key);
    slots.push(c);
    if (slots.length >= MAX_SLOTS) break;
  }

  return { slots, notes, needsDuration: false };
}

/* ------------------------------------------------------------------ */
/* Rescheduling (§21)                                                  */
/* ------------------------------------------------------------------ */

/**
 * Alternative slots for an EXISTING block: its own interval is excluded by
 * recomputing availability without it, so proposals never collide with the
 * block being moved.
 */
export function suggestReschedule(
  block: ScheduleBlock,
  days: DayAvailability[],
  prefs: SchedulePrefs,
  nowMinutes?: number,
): PlacementResult {
  const minutes =
    (minutesOf(block.endTime) ?? 0) - (minutesOf(block.startTime) ?? 0);
  if (minutes <= 0) {
    return {
      slots: [],
      notes: ["بازه این بلوک نامعتبر است — اول آن را اصلاح کن."],
      needsDuration: false,
    };
  }
  return suggestSlots(
    {
      target: {
        taskId: block.taskId,
        title: block.title,
        minutes,
        priority: block.priority,
      },
      days,
      prefs,
      nowMinutes,
    },
  );
}

/* ------------------------------------------------------------------ */
/* Flexible moves (§8, §22)                                            */
/* ------------------------------------------------------------------ */

/**
 * Propose moving one flexible block to another day (same time if that slot
 * is free there, otherwise the first fitting gap). Returns null when the
 * target day cannot take it — a proposal is only ever produced when it is
 * actually valid.
 */
export function proposeMove(
  block: ScheduleBlock,
  from: DayAvailability,
  targetDays: DayAvailability[],
  prefs: SchedulePrefs,
): ProposedMove | null {
  if (block.fixed) return null;
  const minutes = (minutesOf(block.endTime) ?? 0) - (minutesOf(block.startTime) ?? 0);
  if (minutes <= 0) return null;

  const start = minutesOf(block.startTime);
  if (start === null) return null;

  for (const target of targetDays) {
    if (target.day === from.day) continue;
    if (target.unknown || target.gaps.length === 0) continue;
    // Prefer the same time of day when that exact slot is free.
    const sameTime = target.gaps.find(
      (g) => {
        const gs = minutesOf(g.start);
        const ge = minutesOf(g.end);
        return gs !== null && ge !== null && gs <= start && start + minutes <= ge;
      },
    );
    if (sameTime) {
      return {
        blockId: block._id,
        title: block.title,
        from: { day: from.day, start: block.startTime, end: block.endTime },
        to: {
          day: target.day,
          start: block.startTime,
          end: fmtHM(start + minutes),
        },
      };
    }
    // Otherwise first gap that fits.
    const fit = target.gaps.find((g) => g.minutes >= minutes);
    if (fit) {
      const fs = minutesOf(fit.start);
      if (fs === null) continue;
      return {
        blockId: block._id,
        title: block.title,
        from: { day: from.day, start: block.startTime, end: block.endTime },
        to: { day: target.day, start: fit.start, end: fmtHM(fs + minutes) },
      };
    }
  }
  return null;
}
