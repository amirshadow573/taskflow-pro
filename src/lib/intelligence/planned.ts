/**
 * Planned vs Scheduled vs Actual (Phase 13 §5).
 *
 * The central comparison model of the intelligence layer. It never labels the
 * user: it states what happened, in percentages and minutes, and offers a
 * neutral interpretation sentence.
 */
import { hoursFa, pctFa } from "./format";
import type { ProductivityMetrics, PlannedVsActual } from "./types";

export function buildPlannedVsActual(
  metrics: ProductivityMetrics,
  days: number,
): PlannedVsActual {
  const { plannedMinutes, scheduledMinutes, actualMinutes } = metrics;
  const varianceMinutes = actualMinutes - plannedMinutes;
  const adherence =
    metrics.scheduleAdherence !== null ? Math.round(metrics.scheduleAdherence * 100) : null;
  const completion =
    metrics.planningAdherence !== null ? Math.round(metrics.planningAdherence * 100) : null;
  const driftMinutes = metrics.scheduleDriftMinutes ?? 0;
  const sufficient = scheduledMinutes > 0 || plannedMinutes > 0;

  let interpretation: string;
  if (!sufficient) {
    interpretation =
      "برای مقایسه برنامه و اجرا، اول چند بلوک زمانی بساز یا برای کارها تخمین زمان ثبت کن.";
  } else if (scheduledMinutes > 0 && actualMinutes > scheduledMinutes) {
    interpretation = `در این ${days} روز، زمان واقعی اجرا (${hoursFa(
      actualMinutes,
    )}) از برنامه‌ریزی (${hoursFa(scheduledMinutes)}) پیشی گرفته است.`;
  } else if (adherence !== null && adherence >= 80) {
    interpretation = `در این ${days} روز، ${pctFa(
      adherence,
    )} از زمان برنامه‌ریزی‌شده به اجرای واقعی تبدیل شده است.`;
  } else if (adherence !== null && adherence >= 60) {
    interpretation = `در این ${days} روز، ${pctFa(
      adherence,
    )} از زمان برنامه‌ریزی‌شده اجرا شده است؛ فاصله باقی‌مانده ${hoursFa(
      Math.abs(driftMinutes),
    )} است.`;
  } else {
    interpretation = `در این ${days} روز، ${hoursFa(actualMinutes)} از ${hoursFa(
      scheduledMinutes,
    )} برنامه اجرا شده است — این فاصله فقط یک واقعیت است، نه قضاوت.`;
  }

  return {
    plannedMinutes,
    scheduledMinutes,
    actualMinutes,
    varianceMinutes,
    adherencePct: adherence,
    completionPct: completion,
    driftMinutes,
    interpretation,
    sufficient,
  };
}
