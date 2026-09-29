/**
 * Row-level helpers shared by the intelligence analyses.
 *
 * The important rule lives here: **executed time is never double-counted**.
 * Phase 12 records a completed `focus`/`study` session BOTH as an execution
 * session and as a focus-session row (the same work, two ledgers — one for the
 * execution engine, one for the focus/stats system). This module removes a
 * focus row when an execution session already represents the same work, using a
 * deterministic key (day + task or title + planned minutes) and no guessing.
 */
import { minutesOf } from "@/lib/scheduling/time";
import { sessionMinutes } from "@/lib/execution";
import type { ExecutionSession } from "@/lib/execution";
import type { IntelFocus } from "./input";

export { sessionMinutes };
export { minutesOf };

/** Work minutes of a time block; null when the range is invalid. */
export function blockMinutes(block: { startTime: string; endTime: string }): number | null {
  const start = minutesOf(block.startTime);
  const end = minutesOf(block.endTime);
  if (start === null || end === null || end <= start) return null;
  return end - start;
}

function focusKey(
  day: string,
  taskId: string | undefined,
  title: string | undefined,
  planned: number,
): string {
  return `${day}|${taskId ?? (title ?? "").trim()}|${planned}`;
}

/**
 * Focus rows that are NOT already represented by an execution session.
 * Deterministic and conservative: only an exact day/target/planned match is
 * treated as "already counted".
 */
export function uniqueFocusRows(
  sessions: ExecutionSession[],
  focusSessions: IntelFocus[],
): IntelFocus[] {
  const counted = new Set(
    sessions
      .filter((s) => s.kind === "focus" || s.kind === "study")
      .map((s) => focusKey(s.day, s.taskId, s.title, s.plannedMinutes ?? 0)),
  );
  return focusSessions.filter(
    (f) => !counted.has(focusKey(f.date, f.taskId, f.title, f.plannedMinutes)),
  );
}

/** Total executed minutes from execution sessions (finished + still running). */
export function executedMinutes(sessions: ExecutionSession[], nowMs: number): number {
  return sessions.reduce((sum, s) => sum + sessionMinutes(s, nowMs), 0);
}

/** Finished execution sessions with a usable estimate (for estimation math). */
export function estimatedSessions(sessions: ExecutionSession[]): ExecutionSession[] {
  return sessions.filter(
    (s) =>
      (s.state === "completed" || s.state === "abandoned") &&
      s.plannedMinutes != null &&
      s.plannedMinutes > 0,
  );
}
