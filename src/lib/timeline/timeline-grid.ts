/**
 * Visual Timeline (Phase 17) — time-grid geometry.
 *
 * The timeline speaks the same language as the SchedulingEngine: minutes
 * since midnight, with `HH:mm` as the app-wide storage format. This module is
 * the ONLY place where minutes are converted to pixels, so the grid, the
 * drag interaction and the resize handles can never disagree.
 *
 * Pure and deterministic — no React, no data fetching.
 */
import { toFa } from "@/lib/persian";

/* Re-exported so timeline components never re-implement time parsing or
   "what time is it right now". */
export { minutesOf, fmtHM, nowMinutes } from "@/lib/scheduling/time";

/** Default snap interval for drag & resize: 30 minutes (§7, §17). */
export const TIMELINE_SNAP_MINUTES = 30;

/** Vertical scale. 1.2px per minute → 72px per hour, 36px per 30-min slot. */
export const PX_PER_MINUTE = 1.2;

/** A block is never drawn shorter than this, so a 15-min block stays legible. */
export const MIN_BLOCK_HEIGHT = 30;

export const MIN_BLOCK_MINUTES = 15;

export interface TimeWindow {
  /** Minutes since midnight, inclusive. */
  start: number;
  /** Minutes since midnight, exclusive. */
  end: number;
}

export const minutesToY = (minutes: number): number => minutes * PX_PER_MINUTE;

export const yToMinutes = (y: number): number => y / PX_PER_MINUTE;

/** Snap to the nearest grid step so values like 09:07 are impossible (§17). */
export function snapMinutes(minutes: number, step = TIMELINE_SNAP_MINUTES): number {
  const s = step > 0 ? step : TIMELINE_SNAP_MINUTES;
  return Math.round(minutes / s) * s;
}

/** Clamp + snap a candidate range, guaranteeing `end > start`. */
export function normalizeRange(
  start: number,
  end: number,
  step = TIMELINE_SNAP_MINUTES,
): { start: number; end: number } {
  const a = snapMinutes(Math.min(start, end), step);
  const b = snapMinutes(Math.max(start, end), step);
  if (b - a >= MIN_BLOCK_MINUTES) return { start: a, end: b };
  return { start: a, end: a + Math.max(step, MIN_BLOCK_MINUTES) };
}

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/* Day arithmetic lives with the SchedulingEngine so the timeline, the
   schedule snapshot and the agenda all agree on what "next day" means. */
export { addDays } from "@/lib/scheduling/time";

/**
 * The visible vertical range (§8) — derived from the user's OWN schedule
 * preferences (`prefs.dayStart` / `prefs.dayEnd`), then widened to include
 * everything actually on the grid so nothing is ever clipped. Padding only,
 * never invented time.
 */
export function visibleWindow(
  prefsWindow: TimeWindow,
  contentSpans: { start: number; end: number }[],
): TimeWindow {
  let start = prefsWindow.start;
  let end = prefsWindow.end;
  for (const s of contentSpans) {
    start = Math.min(start, s.start);
    end = Math.max(end, s.end);
  }
  // 30 min of breathing room top and bottom, aligned to the grid.
  const pad = TIMELINE_SNAP_MINUTES;
  start = Math.max(0, snapMinutes(start, pad) - pad);
  end = Math.min(24 * 60, snapMinutes(end, pad) + pad);
  if (end - start < 4 * 60) end = Math.min(24 * 60, start + 4 * 60);
  return { start, end };
}

export interface GridLine {
  minutes: number;
  y: number;
  /** Full-hour lines get a label; half-hour lines stay unlabelled. */
  labelled: boolean;
}

/**
 * Horizontal grid lines at the snap interval. Only whole hours carry a
 * label so the axis never becomes dense (§7).
 */
export function gridLines(win: TimeWindow, step = TIMELINE_SNAP_MINUTES): GridLine[] {
  const lines: GridLine[] = [];
  const first = snapMinutes(win.start, step);
  for (let m = first; m <= win.end; m += step) {
    lines.push({ minutes: m, y: minutesToY(m - win.start), labelled: m % 60 === 0 });
  }
  return lines;
}

export const windowHeight = (win: TimeWindow): number => minutesToY(win.end - win.start);

/** "۰۹:۳۰" — Persian digits, the app-wide time format. */
export const timeFa = (minutes: number): string => {
  const clamped = clamp(Math.round(minutes), 0, 24 * 60 - 1);
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return toFa(`${h < 10 ? "0" : ""}${h}:${m < 10 ? "0" : ""}${m}`);
};

/** "۰۹:۰۰ — ۱۰:۳۰" */
export const rangeFa = (start: number, end: number): string =>
  `${timeFa(start)} — ${timeFa(end)}`;

/** "۱ ساعت و ۳۰ دقیقه" — human duration, never a raw minute count. */
export function durationFa(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return toFa(`${m} دقیقه`);
  if (m === 0) return toFa(`${h} ساعت`);
  return toFa(`${h} ساعت و ${m} دقیقه`);
}

/**
 * How much text a block of this height can honestly show. Blocks are sized by
 * duration, so the renderer asks this instead of forcing long text into a
 * small box (§11).
 */
export function blockDensity(
  height: number,
): { showTime: boolean; showSubtitle: boolean; showDescription: boolean; compact: boolean } {
  return {
    showTime: height >= 34,
    showSubtitle: height >= 56,
    showDescription: height >= 104,
    compact: height < 56,
  };
}
