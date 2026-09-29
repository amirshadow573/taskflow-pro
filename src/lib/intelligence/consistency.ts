/**
 * Consistency analysis (Phase 13 §15).
 *
 * Consistency is reported SEPARATELY from completion, because "I did 4 of 6
 * tasks" and "I showed up on 5 of 7 days" are different facts. Nothing here is
 * turned into a good/bad judgment: the engine states how many days carried a
 * given kind of activity, and how often routines / habits / reviews were kept.
 */
import { countFa } from "./format";
import { sessionMinutes, uniqueFocusRows } from "./rows";
import { INTELLIGENCE_THRESHOLDS } from "./types";
import type { ConsistencyAnalysis } from "./types";
import type { ExecutionSession } from "@/lib/execution";
import type { IntelBlock, IntelFocus, IntelTask } from "./input";
import type { MetricsScope } from "./metrics";

export interface ConsistencyInput {
  scope: MetricsScope;
  tasks: IntelTask[];
  blocks: IntelBlock[];
  sessions: ExecutionSession[];
  focusSessions: IntelFocus[];
  nowMs: number;
  routine: { todayPct: number; monthPct: number; itemsCount: number };
  habits: { total: number; doneToday: number; weekDone: number; weekTarget: number; bestStreak: number };
  reviews: Array<{ type: string; periodKey: string }>;
}

function ratio(part: number, total: number): number | null {
  return total > 0 ? part / total : null;
}

export function buildConsistencyAnalysis(input: ConsistencyInput): ConsistencyAnalysis {
  const days = input.scope.dayKeys;
  const inWindow = new Set(days);

  const planningDays = new Set<string>();
  for (const b of input.blocks) {
    if (inWindow.has(b.day) && b.status !== "cancelled") planningDays.add(b.day);
  }
  for (const t of input.tasks) {
    if (t.dueDate && inWindow.has(t.dueDate) && !t.parentId) planningDays.add(t.dueDate);
  }

  const executionDays = new Set<string>();
  for (const s of input.sessions) {
    if (inWindow.has(s.day) && sessionMinutes(s, input.nowMs) > 0) executionDays.add(s.day);
  }

  const focusDays = new Set<string>();
  for (const s of input.sessions) {
    if (inWindow.has(s.day) && (s.kind === "focus" || s.kind === "study")) {
      if (sessionMinutes(s, input.nowMs) > 0) focusDays.add(s.day);
    }
  }
  for (const f of uniqueFocusRows(input.sessions, input.focusSessions)) {
    if (inWindow.has(f.date) && f.actualMinutes > 0) focusDays.add(f.date);
  }

  const activeDays = new Set<string>([...planningDays, ...executionDays, ...focusDays]);

  const reviewsLast30 = input.reviews.filter((r) => r.periodKey >= input.scope.from).length;
  const weeklyReviewsLast30 = input.reviews.filter(
    (r) => r.type === "weekly" && r.periodKey >= input.scope.from,
  ).length;

  const sufficient = input.scope.days >= INTELLIGENCE_THRESHOLDS.consistencyDays;

  return {
    activeDays: activeDays.size,
    planningDays: planningDays.size,
    executionDays: executionDays.size,
    focusDays: focusDays.size,
    executionConsistency: ratio(executionDays.size, days.length),
    planningConsistency: ratio(planningDays.size, days.length),
    focusConsistency: ratio(focusDays.size, days.length),
    routineMonthPct: input.routine.itemsCount > 0 ? input.routine.monthPct : null,
    habitsTracked: input.habits.total,
    habitsDoneToday: input.habits.doneToday,
    habitWeekPct:
      input.habits.weekTarget > 0
        ? Math.round((input.habits.weekDone / input.habits.weekTarget) * 100)
        : null,
    reviewsLast30,
    weeklyReviewsLast30,
    sufficient,
  };
}

/** Persian sentence for the consistency reading (§15). */
export function consistencySummaryFa(consistency: ConsistencyAnalysis, days: number): string {
  if (consistency.activeDays === 0) {
    return "در این بازه هیچ روز فعالی ثبت نشده است — با اجرای یک کار، این بخش شروع به کار می‌کند.";
  }
  const parts = [`${countFa(consistency.activeDays)} روز از ${countFa(days)} روز فعال بوده است`];
  if (consistency.executionDays > 0) {
    parts.push(`${countFa(consistency.executionDays)} روز اجرای ثبت‌شده`);
  }
  if (consistency.planningDays > 0) {
    parts.push(`${countFa(consistency.planningDays)} روز برنامه‌ریزی‌شده`);
  }
  if (consistency.focusDays > 0) {
    parts.push(`${countFa(consistency.focusDays)} روز تمرکز`);
  }
  return `${parts.join("، ")}.`;
}
