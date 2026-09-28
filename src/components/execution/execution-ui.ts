/**
 * Shared display helpers for the Adaptive Execution UI (Phase 12).
 *
 * Pure formatting + tone maps — no React, no side effects. Kept in one module
 * so the live card, the recovery list, the daily review and the dashboard
 * module always word a duration, a severity and an action the same way
 * (Persian, and never color-only — §33).
 */
import { toFa } from "@/lib/persian";
import {
  EXECUTION_STATE_LABELS_FA,
  type ExecutionRecoveryAction,
  type ExecutionRecSeverity,
  type ExecutionState,
} from "@/lib/execution";

/** Persian state label; unknown server states fall back to the raw value. */
export function stateLabelFa(state: string): string {
  return EXECUTION_STATE_LABELS_FA[state as ExecutionState] ?? state;
}

/* ------------------------------------------------------------------ */
/* Time                                                                */
/* ------------------------------------------------------------------ */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Live timer — `H:MM:SS` with Persian digits (screen-reader friendly digits). */
export function timerFa(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return toFa(`${h}:${pad2(m)}:${pad2(s)}`);
}

/** Spoken/accessible description of the same duration (§33). */
export function timerLabelFa(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0) return `${toFa(h)} ساعت و ${toFa(m)} دقیقه`;
  return `${toFa(m)} دقیقه`;
}

/* ------------------------------------------------------------------ */
/* Severity / tone                                                     */
/* ------------------------------------------------------------------ */

export const REC_TONE: Record<ExecutionRecSeverity, "rose" | "amber" | "blue"> = {
  critical: "rose",
  warning: "amber",
  info: "blue",
};

export const REC_TILE: Record<ExecutionRecSeverity, string> = {
  critical: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  info: "bg-primary/10 text-primary",
};

/** Signed variance in a neutral, non-judgmental wording (§13). */
export function varianceFa(minutes: number | null): string | null {
  if (minutes === null || minutes === 0) return null;
  if (minutes > 0) return `${toFa(minutes)} دقیقه بیشتر از تخمین`;
  return `${toFa(Math.abs(minutes))} دقیقه کمتر از تخمین`;
}

/* ------------------------------------------------------------------ */
/* Recovery actions (§9 / §29) — every button is an explicit choice     */
/* ------------------------------------------------------------------ */

export const ACTION_LABELS_FA: Record<ExecutionRecoveryAction, string> = {
  start_now: "همین حالا شروع کن",
  reschedule: "جابه‌جایی زمان",
  keep_unscheduled: "بدون برنامه بماند",
  mark_complete: "انجام شد",
  mark_blocked: "مسدود است",
  adjust_estimate: "اصلاح تخمین زمان",
  accept_move: "پذیرش جابه‌جایی پیشنهادی",
  dismiss: "بی‌خیال",
};

/** Ordering so the least destructive option is never the only choice. */
export const ACTION_ORDER: ExecutionRecoveryAction[] = [
  "start_now",
  "mark_complete",
  "reschedule",
  "accept_move",
  "adjust_estimate",
  "keep_unscheduled",
  "mark_blocked",
  "dismiss",
];

export function sortActions(actions: ExecutionRecoveryAction[]): ExecutionRecoveryAction[] {
  return [...actions].sort(
    (a, b) => ACTION_ORDER.indexOf(a) - ACTION_ORDER.indexOf(b),
  );
}

/** Notes from the end-of-day review live next to the other local stores. */
const NOTE_PREFIX = "taskly-execution-note-";

export function readDayNote(dayKey: string): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(`${NOTE_PREFIX}${dayKey}`) ?? "";
}

export function writeDayNote(dayKey: string, note: string): void {
  if (typeof localStorage === "undefined") return;
  const key = `${NOTE_PREFIX}${dayKey}`;
  const trimmed = note.trim();
  if (trimmed) localStorage.setItem(key, trimmed);
  else localStorage.removeItem(key);
}
