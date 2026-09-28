/**
 * Weekly execution insight (Phase 12 §26).
 *
 * A compact, deterministic reading of the last 7 days of REAL execution:
 * planned vs actual, completion rate, schedule adherence, estimate accuracy,
 * repeated delays, rescheduling and focus time. It only reports what the
 * execution log can prove — never a psychological interpretation — and it is
 * pure (the caller passes the sessions/events it already subscribes to), so no
 * extra database traffic is created (§31).
 */
import { toFa } from "@/lib/persian";
import { addDays, minutesOf } from "@/lib/scheduling/time";
import { actionOf, isFinishedSession, sessionMinutes } from "./metrics";
import type {
  ExecutionBlockLite,
  ExecutionEventRow,
  ExecutionSession,
} from "./types";

/** Minimum gap before an accuracy/adherence observation is worth telling. */
export const WEEK_VARIANCE_MIN_PCT = 15;
export const WEEK_ADHERENCE_MIN_SAMPLES = 60;

export interface WeeklyDayExecution {
  day: string;
  actualMinutes: number;
  estimatedMinutes: number;
  scheduledMinutes: number;
  completedSessions: number;
  abandonedSessions: number;
}

export interface WeeklyExecutionInsight {
  from: string;
  to: string;
  days: WeeklyDayExecution[];
  /** Actual executed minutes across the window. */
  actualMinutes: number;
  /** Estimated minutes for the same finished sessions. */
  estimatedMinutes: number;
  /** actual − estimated (null when nothing was estimated). */
  varianceMinutes: number | null;
  /** Signed percentage (null when there is no estimate sample). */
  variancePct: number | null;
  /** Rough estimate accuracy 0..100 (null when no estimate samples). */
  estimateAccuracyPct: number | null;
  /** completed / (completed + abandoned) 0..1 (null when nothing finished). */
  completionRate: number | null;
  /** Actual ÷ scheduled 0..1 (null when nothing was scheduled). */
  scheduledAdherence: number | null;
  reschedules: number;
  postponements: number;
  missedBlocks: number;
  /** Focus + study session minutes in the window. */
  focusMinutes: number;
  sessions: number;
  completedSessions: number;
  abandonedSessions: number;
  /** Persian, observable-only observations (may be empty). */
  notes: string[];
}

export interface WeeklyInsightInput {
  dayKey: string;
  /** Sessions over the window (extra days are ignored). */
  sessions: ExecutionSession[];
  events: ExecutionEventRow[];
  /** All time blocks (the window is selected inside). */
  blocks: ExecutionBlockLite[];
  nowMs: number;
  /** Optional override — defaults to the last 7 days ending on `dayKey`. */
  windowDays?: number;
}

export function buildWeeklyInsight(input: WeeklyInsightInput): WeeklyExecutionInsight {
  const windowDays = Math.max(2, Math.min(14, input.windowDays ?? 7));
  const from = addDays(input.dayKey, -(windowDays - 1));
  const to = input.dayKey;
  const dayKeys: string[] = [];
  for (let i = 0; i < windowDays; i += 1) dayKeys.push(addDays(from, i));

  const inWindow = new Set(dayKeys);
  const sessions = input.sessions.filter((s) => inWindow.has(s.day));
  const events = input.events.filter((e) => inWindow.has(e.day));
  const blocks = input.blocks.filter((b) => inWindow.has(b.day));

  const scheduledByDay = new Map<string, number>();
  for (const b of blocks) {
    if (b.status === "cancelled") continue;
    const start = minutesOf(b.startTime);
    const end = minutesOf(b.endTime);
    if (start === null || end === null || end <= start) continue;
    scheduledByDay.set(b.day, (scheduledByDay.get(b.day) ?? 0) + (end - start));
  }

  const days: WeeklyDayExecution[] = dayKeys.map((day) => {
    let actualMinutes = 0;
    let estimatedMinutes = 0;
    let completedSessions = 0;
    let abandonedSessions = 0;
    for (const s of sessions) {
      if (s.day !== day) continue;
      actualMinutes += sessionMinutes(s, input.nowMs);
      if (isFinishedSession(s)) {
        if (s.state === "completed") completedSessions += 1;
        else abandonedSessions += 1;
        if (s.plannedMinutes && s.plannedMinutes > 0) estimatedMinutes += s.plannedMinutes;
      }
    }
    return {
      day,
      actualMinutes,
      estimatedMinutes,
      scheduledMinutes: scheduledByDay.get(day) ?? 0,
      completedSessions,
      abandonedSessions,
    };
  });

  const actualMinutes = days.reduce((sum, d) => sum + d.actualMinutes, 0);
  const estimatedMinutes = days.reduce((sum, d) => sum + d.estimatedMinutes, 0);
  const scheduledMinutes = days.reduce((sum, d) => sum + d.scheduledMinutes, 0);
  const completedSessions = days.reduce((sum, d) => sum + d.completedSessions, 0);
  const abandonedSessions = days.reduce((sum, d) => sum + d.abandonedSessions, 0);

  let absError = 0;
  let estimateSamples = 0;
  for (const s of sessions) {
    if (!isFinishedSession(s)) continue;
    if (s.plannedMinutes == null || s.plannedMinutes <= 0) continue;
    absError += Math.abs(sessionMinutes(s, input.nowMs) - s.plannedMinutes);
    estimateSamples += 1;
  }

  const varianceMinutes = estimateSamples > 0 ? actualMinutes - estimatedMinutes : null;
  const variancePct =
    estimateSamples > 0 && estimatedMinutes > 0
      ? Math.round(((actualMinutes - estimatedMinutes) / estimatedMinutes) * 100)
      : null;
  const estimateAccuracyPct =
    estimateSamples > 0 && estimatedMinutes > 0
      ? Math.max(0, Math.round(100 - (absError / estimatedMinutes) * 100))
      : null;

  const finishable = completedSessions + abandonedSessions;
  const completionRate = finishable > 0 ? completedSessions / finishable : null;
  const scheduledAdherence =
    scheduledMinutes >= WEEK_ADHERENCE_MIN_SAMPLES ? Math.min(1, actualMinutes / scheduledMinutes) : null;

  const reschedules = events.filter(
    (e) => e.type === "RECOVERY_ACTION" && actionOf(e) === "reschedule",
  ).length;
  const postponements = events.filter((e) => e.type === "TASK_POSTPONED").length;
  const missedBlocks = blocks.filter((b) => b.status === "missed").length;
  const focusMinutes = sessions
    .filter((s) => s.kind === "focus" || s.kind === "study")
    .reduce((sum, s) => sum + sessionMinutes(s, input.nowMs), 0);

  /* ---- Persian, observable-only observations ---- */
  const notes: string[] = [];
  if (variancePct !== null && Math.abs(variancePct) >= WEEK_VARIANCE_MIN_PCT) {
    notes.push(
      variancePct > 0
        ? `در این بازه، زمان واقعی انجام کارها به‌طور میانگین ${toFa(Math.abs(variancePct))}٪ بیشتر از زمان تخمینی بوده است.`
        : `در این بازه، زمان واقعی انجام کارها به‌طور میانگین ${toFa(Math.abs(variancePct))}٪ کمتر از زمان تخمینی بوده است.`,
    );
  }
  if (scheduledAdherence !== null && scheduledAdherence < 0.7) {
    notes.push(
      `از ${toFa(scheduledMinutes)} دقیقهٔ برنامه‌ریزی‌شده، ${toFa(actualMinutes)} دقیقه اجرا شده است — برنامه را سبک‌تر و واقع‌بینانه‌تر می‌توان چید.`,
    );
  }
  if (missedBlocks >= 2) {
    notes.push(`${toFa(missedBlocks)} بلوک زمانی در این بازه بدون اجرا ماند.`);
  }
  if (postponements >= 2) {
    notes.push(`${toFa(postponements)} بار جابه‌جایی موعد ثبت شده است — ممکن است برآورد مدت این کارها نیاز به بازنگری داشته باشد.`);
  }
  if (reschedules >= 3) {
    notes.push(`${toFa(reschedules)} بار جابه‌جایی برنامه ثبت شده است.`);
  }
  if (notes.length === 0) {
    notes.push(
      "در این بازه، اجرای کارها با برنامه هم‌خوان بوده است — داده‌ای که نیاز به اصلاح نشان بدهد پیدا نشد.",
    );
  }

  return {
    from,
    to,
    days,
    actualMinutes,
    estimatedMinutes,
    varianceMinutes,
    variancePct,
    estimateAccuracyPct,
    completionRate,
    scheduledAdherence,
    reschedules,
    postponements,
    missedBlocks,
    focusMinutes,
    sessions: sessions.length,
    completedSessions,
    abandonedSessions,
    notes,
  };
}
