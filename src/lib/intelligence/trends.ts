/**
 * Productivity trends (Phase 13 §16).
 *
 * Four windows — 7 / 14 / 30 / 90 days — each compared against itself: the
 * newest half versus the previous half. A window is only reported when there is
 * enough DATA inside it (`trendMinDays`, per-half activity floor), so the UI can
 * say "insufficient data" instead of pretending a statistic exists (§16/§33).
 */
import { sessionMinutes, uniqueFocusRows } from "./rows";
import { countFa, signedPctFa } from "./format";
import { INTELLIGENCE_THRESHOLDS } from "./types";
import { INTELLIGENCE_WINDOWS, dayKeyOf, dayKeysFor } from "./window";
import type { TrendWindow } from "./types";
import type { ExecutionSession } from "@/lib/execution";
import type { IntelFocus, IntelTask } from "./input";

/** Minimum active days per half before a direction is claimed. */
export const TREND_MIN_ACTIVE_DAYS_PER_HALF = 3;
/** Signed band inside which a change is reported as "stable". */
export const TREND_STABLE_BAND_PCT = 10;

export interface TrendInput {
  dayKey: string;
  tasks: IntelTask[];
  sessions: ExecutionSession[];
  focusSessions: IntelFocus[];
  nowMs: number;
  /** How many days of history the caller actually loaded. */
  availableDays: number;
}

export function buildTrends(input: TrendInput): TrendWindow[] {
  const completedDays = new Map<string, number>();
  for (const t of input.tasks) {
    if (t.parentId || t.status !== "done" || t.completedAt == null) continue;
    const day = dayKeyOf(t.completedAt);
    completedDays.set(day, (completedDays.get(day) ?? 0) + 1);
  }

  const focusRows = uniqueFocusRows(input.sessions, input.focusSessions);
  const sessionMinutesByDay = new Map<string, number>();
  for (const s of input.sessions) {
    sessionMinutesByDay.set(s.day, (sessionMinutesByDay.get(s.day) ?? 0) + sessionMinutes(s, input.nowMs));
  }
  for (const f of focusRows) {
    sessionMinutesByDay.set(f.date, (sessionMinutesByDay.get(f.date) ?? 0) + f.actualMinutes);
  }

  return INTELLIGENCE_WINDOWS.filter((w) => input.availableDays >= w.days).map(({ window, days }) => {
    const keys = dayKeysFor(input.dayKey, days);
    const half = Math.floor(keys.length / 2);
    const previous = keys.slice(0, half);
    const latest = keys.slice(keys.length - half);

    let actualMinutes = 0;
    let completedTasks = 0;
    let activeDays = 0;
    for (const day of keys) {
      const minutes = sessionMinutesByDay.get(day) ?? 0;
      const completed = completedDays.get(day) ?? 0;
      actualMinutes += minutes;
      completedTasks += completed;
      if (minutes > 0 || completed > 0) activeDays += 1;
    }

    const sumMinutes = (list: string[]) =>
      list.reduce((sum, day) => sum + (sessionMinutesByDay.get(day) ?? 0), 0);
    const prevMinutes = sumMinutes(previous);
    const latestMinutes = sumMinutes(latest);

    const prevActive = previous.filter(
      (d) => (sessionMinutesByDay.get(d) ?? 0) > 0 || (completedDays.get(d) ?? 0) > 0,
    ).length;
    const latestActive = latest.filter(
      (d) => (sessionMinutesByDay.get(d) ?? 0) > 0 || (completedDays.get(d) ?? 0) > 0,
    ).length;

    const enoughData =
      days >= INTELLIGENCE_THRESHOLDS.trendMinDays &&
      prevActive >= TREND_MIN_ACTIVE_DAYS_PER_HALF &&
      latestActive >= TREND_MIN_ACTIVE_DAYS_PER_HALF &&
      prevMinutes > 0;

    let changePct: number | null = null;
    let direction: TrendWindow["direction"] = "insufficient";
    if (enoughData) {
      changePct = Math.round(((latestMinutes - prevMinutes) / prevMinutes) * 100);
      if (changePct >= TREND_STABLE_BAND_PCT) direction = "up";
      else if (changePct <= -TREND_STABLE_BAND_PCT) direction = "down";
      else direction = "stable";
    }

    let note: string;
    if (!enoughData) {
      note = `برای روند ${countFa(days)} روزه، داده کافی نیست (${countFa(
        activeDays,
      )} روز فعال ثبت شده).`;
    } else if (direction === "stable") {
      note = `در ${countFa(days)} روز گذشته، حجم اجرای واقعی تقریباً ثابت مانده است (${countFa(
        activeDays,
      )} روز فعال).`;
    } else {
      const word = direction === "up" ? "بیشتر" : "کمتر";
      note = `در ${countFa(days)} روز گذشته، اجرای واقعی نسبت به نیمه قبل ${signedPctFa(
        changePct,
      ).replace("+", "")} ${word} شده است (${countFa(activeDays)} روز فعال).`;
    }

    return {
      window,
      days,
      actualMinutes,
      completedTasks,
      activeDays,
      changePct,
      direction,
      sufficient: enoughData,
      note,
    };
  });
}
