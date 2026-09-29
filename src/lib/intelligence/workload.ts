/**
 * Workload analysis + trend (Phase 13 §7 / §8).
 *
 * Reuses the Phase 11 load classifier (`classifyLoad`) so a "heavy" day means
 * exactly the same thing in every surface, and measures workload by MINUTES
 * (scheduled + estimated), never by task count.
 *
 * The trend compares the newest half of the window with the previous half and
 * refuses to speak below `trendMinDays` (§8 / §33).
 */
import { classifyLoad } from "@/lib/scheduling";
import { toFa } from "@/lib/persian";
import { blockMinutes, sessionMinutes, uniqueFocusRows } from "./rows";
import { hoursFa, signedPctFa } from "./format";
import { INTELLIGENCE_THRESHOLDS } from "./types";
import type { ProductivityMetrics, WorkloadDay, WorkloadProfile } from "./types";
import type { IntelBlock, IntelFocus, IntelTask } from "./input";
import type { ExecutionSession, ExecutionSnapshot } from "@/lib/execution";
import type { MetricsScope } from "./metrics";

export interface WorkloadInput {
  scope: MetricsScope;
  blocks: IntelBlock[];
  tasks: IntelTask[];
  sessions: ExecutionSession[];
  focusSessions: IntelFocus[];
  nowMs: number;
  /** Realistic usable minutes for one day (from the user's schedule prefs). */
  dailyCapacityMinutes: number;
  /** Phase 12 snapshot — the authority for "how is today going". */
  snapshot: ExecutionSnapshot;
  metrics: ProductivityMetrics;
}

function sumBlockMinutes(blocks: IntelBlock[]): number {
  return blocks.reduce((sum, b) => {
    if (b.status === "cancelled" || b.kind === "break") return sum;
    return sum + (blockMinutes(b) ?? 0);
  }, 0);
}

export function buildWorkloadProfile(input: WorkloadInput): WorkloadProfile {
  const capacity = input.dailyCapacityMinutes > 0 ? input.dailyCapacityMinutes : 480;

  const blocksByDay = new Map<string, IntelBlock[]>();
  for (const b of input.blocks) {
    if (b.status === "cancelled") continue;
    const list = blocksByDay.get(b.day);
    if (list) list.push(b);
    else blocksByDay.set(b.day, [b]);
  }

  const tasksByDay = new Map<string, IntelTask[]>();
  for (const t of input.tasks) {
    if (!t.dueDate || t.parentId) continue;
    const list = tasksByDay.get(t.dueDate);
    if (list) list.push(t);
    else tasksByDay.set(t.dueDate, [t]);
  }

  const focusRows = uniqueFocusRows(input.sessions, input.focusSessions);
  const sessionsByDay = new Map<string, ExecutionSession[]>();
  for (const s of input.sessions) {
    const list = sessionsByDay.get(s.day);
    if (list) list.push(s);
    else sessionsByDay.set(s.day, [s]);
  }

  const days: WorkloadDay[] = input.scope.dayKeys.map((day) => {
    const scheduledMinutes = sumBlockMinutes(blocksByDay.get(day) ?? []);
    const estimatedMinutes = (tasksByDay.get(day) ?? []).reduce(
      (sum, t) => sum + (t.estimateMinutes ?? 0),
      0,
    );
    const sessionMinutesToday = (sessionsByDay.get(day) ?? []).reduce(
      (sum, s) => sum + sessionMinutes(s, input.nowMs),
      0,
    );
    const focusMinutesToday = focusRows
      .filter((f) => f.date === day)
      .reduce((sum, f) => sum + f.actualMinutes, 0);
    const planned = scheduledMinutes + estimatedMinutes;
    return {
      day,
      scheduledMinutes,
      estimatedMinutes,
      actualMinutes: sessionMinutesToday + focusMinutesToday,
      availableMinutes: capacity,
      state: classifyLoad(planned, capacity),
    };
  });

  const overloadedDays = days.filter((d) => d.state === "overloaded").length;
  const heavyDays = days.filter((d) => d.state === "heavy").length;

  /* ---- trend: newest half vs previous half of the window ---- */
  const sufficientTrend = input.scope.days >= INTELLIGENCE_THRESHOLDS.trendMinDays;
  const half = Math.floor(days.length / 2);
  const previous = days.slice(0, half);
  const latest = days.slice(days.length - half);
  const plannedOf = (list: WorkloadDay[]) =>
    list.reduce((sum, d) => sum + d.scheduledMinutes + d.estimatedMinutes, 0);
  const prevPlanned = plannedOf(previous);
  const latestPlanned = plannedOf(latest);
  let trendPct: number | null = null;
  if (sufficientTrend && prevPlanned > 0) {
    trendPct = Math.round(((latestPlanned - prevPlanned) / prevPlanned) * 100);
  }
  let trend: WorkloadProfile["trend"] = "insufficient";
  if (trendPct !== null) {
    if (trendPct >= 10) trend = "rising";
    else if (trendPct <= -10) trend = "falling";
    else trend = "stable";
  }

  return {
    todayState: input.snapshot.workloadState ?? null,
    todayScheduledMinutes: input.snapshot.scheduledMinutes ?? input.metrics.scheduledMinutes,
    todayAvailableMinutes: input.snapshot.availableMinutes ?? null,
    days,
    overloadedDays,
    heavyDays,
    trendPct,
    trend,
    sufficient: sufficientTrend,
  };
}

/** Persian sentence for a workload trend (§8). */
export function workloadTrendFa(profile: WorkloadProfile, days: number): string {
  if (!profile.sufficient || profile.trend === "insufficient" || profile.trendPct === null) {
    return `برای تحلیل روند بار کاری، به حداقل ${toFa(
      INTELLIGENCE_THRESHOLDS.trendMinDays,
    )} روز داده نیاز است.`;
  }
  if (profile.trend === "stable") {
    return `در این ${days} روز، حجم کار برنامه‌ریزی‌شده تقریباً ثابت مانده است.`;
  }
  const word = profile.trend === "rising" ? "افزایش" : "کاهش";
  return `در این ${days} روز، حجم کار برنامه‌ریزی‌شده ${signedPctFa(
    profile.trendPct,
  ).replace("+", "")} ${word} یافته است (مجموع کار جدید در نیمه دوم بازه).`;
}

/** Persian note for overload density (§7). */
export function workloadOverloadFa(profile: WorkloadProfile, days: number): string {
  if (profile.overloadedDays === 0 && profile.heavyDays === 0) {
    return `در این ${days} روز، هیچ روزی بیش از ظرفیت واقعی بارگذاری نشده است.`;
  }
  const parts: string[] = [];
  if (profile.overloadedDays > 0) parts.push(`${toFa(profile.overloadedDays)} روز بیش از ظرفیت`);
  if (profile.heavyDays > 0) parts.push(`${toFa(profile.heavyDays)} روز سنگین`);
  return `در این ${days} روز، ${parts.join(" و ")} ثبت شده است — ظرفیت روزانه ${hoursFa(
    profile.todayAvailableMinutes ?? null,
  )} در نظر گرفته شده.`;
}
