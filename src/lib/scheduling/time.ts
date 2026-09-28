/**
 * Time math for scheduling (Phase 11). HH:mm is the app-wide convention
 * (tasks, blocks, context events all use it), so everything here works on
 * minutes-since-midnight with lossless formatting.
 */

export function minutesOf(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function fmtHM(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h < 10 ? `0${h}` : String(h)}:${m < 10 ? `0${m}` : String(m)}`;
}

/** Duration between two HH:mm values; null when either side is invalid. */
export function durationOf(start?: string | null, end?: string | null): number | null {
  const a = minutesOf(start);
  const b = minutesOf(end);
  if (a === null || b === null) return null;
  return b - a;
}

export interface Span {
  start: number;
  end: number;
}

/** Positive overlap between two spans, in minutes (0 = no overlap). */
export function overlapMinutes(a: Span, b: Span): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

export function spansOverlap(a: Span, b: Span): boolean {
  return overlapMinutes(a, b) > 0;
}

/** Free minutes between two spans when a ends before b starts (else 0). */
export function gapAfter(a: Span, b: Span): number {
  return Math.max(0, b.start - a.end);
}

/** Merge overlapping/adjacent spans into disjoint, sorted intervals. */
export function mergeSpans(spans: Span[]): Span[] {
  if (spans.length === 0) return [];
  const sorted = [...spans].sort((a, b) => a.start - b.start || a.end - b.end);
  const out: Span[] = [{ ...sorted[0] }];
  for (const s of sorted.slice(1)) {
    const last = out[out.length - 1];
    if (s.start <= last.end) last.end = Math.max(last.end, s.end);
    else out.push({ ...s });
  }
  return out;
}

/** Free spans of `window` after removing `busy` (merged first). */
export function freeSpans(window: Span, busy: Span[]): Span[] {
  const merged = mergeSpans(busy.filter((b) => b.end > window.start && b.start < window.end));
  const free: Span[] = [];
  let cursor = window.start;
  for (const b of merged) {
    if (b.start > cursor) free.push({ start: cursor, end: Math.min(b.start, window.end) });
    cursor = Math.max(cursor, b.end);
    if (cursor >= window.end) break;
  }
  if (cursor < window.end) free.push({ start: cursor, end: window.end });
  return free.filter((s) => s.end > s.start);
}

export function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function addDays(dayKey: string, n: number): string {
  const d = new Date(`${dayKey}T00:00:00`);
  d.setDate(d.getDate() + n);
  const pad = (x: number) => (x < 10 ? `0${x}` : String(x));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
