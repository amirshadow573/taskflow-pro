/**
 * Window helpers for the intelligence layer (Phase 13 §16 / §31).
 *
 * One place decides what "7d / 14d / 30d / 90d" means, so every analysis and
 * every trend window agrees on boundaries, and nothing scans more history than
 * the caller asked for.
 */
import { addDays } from "@/lib/scheduling/time";
import type { TimeWindow } from "./types";

/** Windows the intelligence engine supports for aggregation + trends (§16). */
export type IntelligenceWindowKey = Extract<TimeWindow, "7d" | "14d" | "30d" | "90d">;

export const INTELLIGENCE_WINDOWS: Array<{
  window: IntelligenceWindowKey;
  days: number;
  labelFa: string;
}> = [
  { window: "7d", days: 7, labelFa: "۷ روز" },
  { window: "14d", days: 14, labelFa: "۱۴ روز" },
  { window: "30d", days: 30, labelFa: "۳۰ روز" },
  { window: "90d", days: 90, labelFa: "۹۰ روز" },
];

export function windowDays(window: TimeWindow): number {
  return INTELLIGENCE_WINDOWS.find((w) => w.window === window)?.days ?? 30;
}

/** Canonical window for a day count (nearest supported window). */
export function windowForDays(days: number): IntelligenceWindowKey {
  let best = INTELLIGENCE_WINDOWS[0];
  for (const w of INTELLIGENCE_WINDOWS) {
    if (Math.abs(w.days - days) < Math.abs(best.days - days)) best = w;
  }
  return best.window;
}

/** Inclusive list of day keys ending on `dayKey`, oldest first. */
export function dayKeysFor(dayKey: string, days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) out.push(addDays(dayKey, -i));
  return out;
}

/** First day of the window (inclusive). */
export function windowStartDay(dayKey: string, days: number): string {
  return addDays(dayKey, -(days - 1));
}

export function isDayInRange(day: string, from: string, to: string): boolean {
  return day >= from && day <= to;
}

/** Days between two day keys (b − a). */
export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00`) - Date.parse(`${a}T00:00:00`);
  return Math.round(ms / 86_400_000);
}

/** Local day key of an epoch timestamp (matches the rest of the app). */
export function dayKeyOf(at: number): string {
  const d = new Date(at);
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Calendar-month key (YYYY-MM) of a day key. */
export function monthKeyOf(day: string): string {
  return day.slice(0, 7);
}

/** Start of the week (Saturday, Persian convention) containing `day`. */
export function weekStartOf(day: string): string {
  const d = new Date(`${day}T00:00:00`);
  const persianWeekday = (d.getDay() + 1) % 7; // Sat = 0 … Fri = 6
  return addDays(day, -persianWeekday);
}
