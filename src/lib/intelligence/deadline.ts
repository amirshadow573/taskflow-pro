/**
 * Deadline reliability (Phase 13 §12).
 *
 * Answers "how reliably does deadline-bound work get finished?" using only
 * observable facts: a task's `dueDate` and its real `completedAt` timestamp.
 * Nothing is inferred, and reliability is only reported above
 * `deadlineSamples` completed deadline-bound tasks (§33).
 */
import { toFa } from "@/lib/persian";
import { countFa } from "./format";
import { INTELLIGENCE_THRESHOLDS } from "./types";
import type { DeadlineReliability } from "./types";
import type { IntelTask } from "./input";
import { dayKeyOf, daysBetween, windowStartDay } from "./window";

export interface DeadlineInput {
  tasks: IntelTask[];
  dayKey: string;
  days: number;
}

export function buildDeadlineReliability(input: DeadlineInput): DeadlineReliability {
  const from = windowStartDay(input.dayKey, input.days);
  const root = input.tasks.filter((t) => !t.parentId && t.dueDate);

  let completed = 0;
  let onTime = 0;
  let late = 0;
  let delaySum = 0;

  for (const t of root) {
    if (t.status !== "done" || t.completedAt == null) continue;
    const completedDay = dayKeyOf(t.completedAt);
    // Only work completed inside the window counts toward the rate.
    if (completedDay < from) continue;
    completed += 1;
    if (completedDay <= (t.dueDate as string)) {
      onTime += 1;
    } else {
      late += 1;
      delaySum += daysBetween(t.dueDate as string, completedDay);
    }
  }

  const overdueOpen = root.filter(
    (t) => t.status !== "done" && (t.dueDate as string) < input.dayKey,
  ).length;

  const sufficient = completed >= INTELLIGENCE_THRESHOLDS.deadlineSamples;

  return {
    windowDays: input.days,
    withDeadline: root.length,
    completed,
    onTime,
    late,
    overdueOpen,
    onTimeRate: completed > 0 ? onTime / completed : null,
    averageDelayDays: late > 0 ? Math.round((delaySum / late) * 10) / 10 : null,
    sufficient,
  };
}

/** Persian sentence for the deadline reading (§12). */
export function deadlineSummaryFa(deadline: DeadlineReliability): string {
  if (!deadline.sufficient || deadline.onTimeRate === null) {
    return `برای سنجش قابل‌اعتماد بودن موعد، به حداقل ${countFa(
      INTELLIGENCE_THRESHOLDS.deadlineSamples,
    )} کار دارای موعد نیاز است — تا حالا ${countFa(deadline.completed)} کار با موعد در این بازه ثبت شده.`;
  }
  const base = `در ${countFa(deadline.windowDays)} روز گذشته، ${countFa(
    Math.round(deadline.onTimeRate * 100),
  )}٪ کارهای دارای موعد قبل یا در زمان مقرر انجام شده‌اند.`;
  if (deadline.averageDelayDays != null && deadline.late > 0) {
    return `${base} میانگین تأخیر در ${toFa(deadline.late)} کار دیرتر از موعد، ${toFa(
      deadline.averageDelayDays,
    )} روز بوده است.`;
  }
  return base;
}
