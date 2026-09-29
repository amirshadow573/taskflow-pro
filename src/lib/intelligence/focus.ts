/**
 * Focus analysis + interruption / context-switching (Phase 13 §13 / §14).
 *
 * Uses the existing focus-session ledger plus focus-kind execution sessions,
 * de-duplicated through the shared rule in `rows.ts` so the same work is never
 * counted twice. Everything is observable behaviour — "this session stopped
 * before its planned length" — never a psychological explanation (§14).
 *
 * Both statements are sample-guarded: one long session is not a pattern.
 */
import { sessionMinutes, type ExecutionSession } from "@/lib/execution";
import { uniqueFocusRows } from "./rows";
import { countFa, hoursFa, minutesFa } from "./format";
import { INTELLIGENCE_THRESHOLDS } from "./types";
import type { FocusAnalysis, TimeSlice } from "./types";
import type { IntelFocus, IntelProject } from "./input";

/** A focus unit counts as "cut short" below this share of its plan. */
export const FOCUS_SHORT_SHARE = 0.9;

export interface FocusInput {
  sessions: ExecutionSession[];
  focusSessions: IntelFocus[];
  projects: IntelProject[];
  nowMs: number;
}

interface FocusUnit {
  minutes: number;
  planned: number;
  day: string;
  projectId?: string;
  done: boolean;
  interrupted: boolean;
}

export function buildFocusAnalysis(input: FocusInput): FocusAnalysis {
  const units: FocusUnit[] = [
    ...input.sessions
      .filter((s) => s.kind === "focus" || s.kind === "study")
      .map((s) => {
        const minutes = sessionMinutes(s, input.nowMs);
        const planned = s.plannedMinutes ?? 0;
        return {
          minutes,
          planned,
          day: s.day,
          projectId: s.projectId,
          done: s.state === "completed",
          interrupted: s.state === "abandoned" || s.pausedMs > 0,
        };
      }),
    ...uniqueFocusRows(input.sessions, input.focusSessions).map((f) => ({
      minutes: f.actualMinutes,
      planned: f.plannedMinutes,
      day: f.date,
      projectId: f.projectId,
      done: f.completed,
      interrupted: !f.completed,
    })),
  ].filter((u) => u.minutes > 0);

  const totalMinutes = units.reduce((sum, u) => sum + u.minutes, 0);
  const plannedMinutes = units.reduce((sum, u) => sum + u.planned, 0);

  /* A unit is "cut short" when it is unfinished OR well below its plan. */
  const cutShort = units.filter(
    (u) => u.interrupted || (u.planned > 0 && u.minutes < u.planned * FOCUS_SHORT_SHARE),
  ).length;

  const byProjectMap = new Map<string, { label: string; minutes: number }>();
  const projectById = new Map(input.projects.map((p) => [p._id, p]));
  for (const u of units) {
    if (!u.projectId) continue;
    const project = projectById.get(u.projectId);
    if (!project) continue;
    const cur = byProjectMap.get(project._id) ?? { label: project.name, minutes: 0 };
    cur.minutes += u.minutes;
    byProjectMap.set(project._id, cur);
  }

  const byDay = new Map<string, number>();
  for (const u of units) byDay.set(u.day, (byDay.get(u.day) ?? 0) + u.minutes);
  let bestDay: FocusAnalysis["bestDay"] = null;
  for (const [day, minutes] of byDay) {
    if (!bestDay || minutes > bestDay.minutes) bestDay = { day, minutes };
  }

  const byProject: TimeSlice[] = [...byProjectMap.entries()]
    .map(([key, v]) => ({
      key,
      label: v.label,
      minutes: Math.round(v.minutes),
      pct: totalMinutes > 0 ? Math.round((v.minutes / totalMinutes) * 100) : 0,
    }))
    .sort((a, b) => b.minutes - a.minutes || a.key.localeCompare(b.key));

  const executionFocusMinutes = input.sessions
    .filter((s) => s.kind === "focus" || s.kind === "study")
    .reduce((sum, s) => sum + sessionMinutes(s, input.nowMs), 0);

  return {
    sessions: units.length,
    totalMinutes: Math.round(totalMinutes),
    averageMinutes: units.length > 0 ? Math.round(totalMinutes / units.length) : null,
    plannedMinutes,
    executionFocusMinutes: Math.round(executionFocusMinutes),
    completionRate: units.length > 0 ? units.filter((u) => u.done).length / units.length : null,
    interruptedSessions: cutShort,
    interruptionRate: units.length > 0 ? cutShort / units.length : null,
    byProject,
    bestDay,
    sufficient: units.length >= INTELLIGENCE_THRESHOLDS.focusSessions,
  };
}

/** Persian sentence for the focus reading (§13). */
export function focusSummaryFa(focus: FocusAnalysis): string {
  if (focus.sessions === 0) {
    return "هنوز جلسه تمرکزی ثبت نشده است. با شروع یک کار در «امروز» زمان تمرکز هم ثبت می‌شود.";
  }
  const base = `در این بازه ${minutesFa(focus.totalMinutes)} زمان تمرکز در ${focus.sessions} جلسه ثبت شده است`;
  if (focus.averageMinutes != null) {
    return `${base} (میانگین هر جلسه ${minutesFa(focus.averageMinutes)}).`;
  }
  return `${base}.`;
}

/** Persian sentence for interruption behaviour (§14) — sample-guarded. */
export function interruptionSummaryFa(focus: FocusAnalysis, sufficient: boolean): string {
  if (!sufficient || focus.interruptionRate === null) {
    return `برای تحلیل الگوی توقف، به حداقل ${countFa(
      INTELLIGENCE_THRESHOLDS.focusSessions,
    )} جلسه تمرکز نیاز است (تا حالا ${countFa(focus.sessions)} جلسه ثبت شده).`;
  }
  const pct = Math.round(focus.interruptionRate * 100);
  if (pct === 0) {
    return `در این بازه، ${hoursFa(focus.totalMinutes)} تمرکز ثبت شده و هیچ جلسه‌ای قبل از پایان برنامه‌ریزی‌شده متوقف نشده است.`;
  }
  return `در این بازه، ${countFa(pct)}٪ از جلسه‌های تمرکز قبل از پایان برنامه‌ریزی‌شده متوقف شده‌اند (${countFa(
    focus.interruptedSessions,
  )} جلسه).`;
}
