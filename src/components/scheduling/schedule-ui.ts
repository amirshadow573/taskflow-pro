/**
 * Shared display helpers for the Adaptive Scheduling UI (Phase 11).
 *
 * Pure formatting + tone maps — no React, no side effects. Kept in one place
 * so the timeline, the weekly table and the dashboard strip always agree on
 * how a minute, a load state or a severity is worded (Persian, never
 * color-only).
 */
import { toFa, formatJalaliShort } from "@/lib/persian";
import { addDaysKey, todayKey } from "@/lib/task-utils";
import type { DayLoadState, ScheduleRecSeverity } from "@/lib/scheduling";

/** "< 60 → ۴۵ دقیقه", otherwise "۱٫۵ ساعت" (rounded to half hours). */
export function hoursFa(minutes: number | null | undefined): string {
  if (minutes == null || Number.isNaN(minutes)) return "—";
  if (minutes < 60) return `${toFa(minutes)} دقیقه`;
  const h = Math.round(minutes / 30) / 2;
  return `${toFa(h)} ساعت`;
}

/** Exact Persian duration — "۱ ساعت و ۳۰ دقیقه" (never fabricated). */
export function minutesFa(minutes: number): string {
  if (minutes < 60) return `${toFa(minutes)} دقیقه`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${toFa(h)} ساعت و ${toFa(m)} دقیقه` : `${toFa(h)} ساعت`;
}

export const LOAD_TONE: Record<DayLoadState, "emerald" | "blue" | "amber" | "rose"> = {
  light: "emerald",
  balanced: "blue",
  heavy: "amber",
  overloaded: "rose",
};

export const SEVERITY_TONE: Record<ScheduleRecSeverity, "rose" | "amber" | "blue"> = {
  critical: "rose",
  warning: "amber",
  info: "blue",
};

export const SEVERITY_TILE: Record<ScheduleRecSeverity, string> = {
  critical: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  info: "bg-primary/10 text-primary",
};

/** Persian label for a horizon day: امروز / فردا / jalali short date. */
export function dayLabelFa(day: string): string {
  const today = todayKey();
  if (day === today) return "امروز";
  if (day === addDaysKey(1)) return "فردا";
  return formatJalaliShort(new Date(`${day}T00:00:00`));
}

/** Time-of-day → Persian "۱۴:۳۰" (Latin HH:mm in, Persian digits out). */
export function timeFa(hhmm: string): string {
  return toFa(hhmm);
}

/** Slot label "۱۴:۰۰–۱۵:۰۰" shared by timeline/dialog rows. */
export function slotLabel(start: string, end: string): string {
  return `${timeFa(start)}–${timeFa(end)}`;
}

/** Duration label — "مدت نامشخص" when no estimate exists; never fabricated. */
export function durationLabel(minutes?: number): string {
  return minutes && minutes > 0 ? minutesFa(minutes) : "مدت نامشخص";
}
