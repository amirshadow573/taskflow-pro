/**
 * Next Action — Phase 09 (deterministic, no AI).
 *
 * Answers "What should I do next?" from REAL application data using transparent,
 * deterministic rules. Signals used (in scoring order of influence):
 *
 *   1. Deadline proximity (overdue > today > tomorrow > this week)
 *   2. User-defined priority (urgent → low)
 *   3. Scheduled time (dueTime set / already passed)
 *   4. Project deadline proximity (project importance)
 *   5. Workload (when the day is heavy, quick wins get a small boost)
 *   6. Persona bias (small, predictable weight deltas per persona)
 *
 * IMPORTANT: This module is intentionally pure and side-effect free so the
 * future AI planning phase can replace it behind the provider contract in
 * src/lib/ai/adapters.ts without touching any UI component.
 */

import type { PersonaKey } from "@/lib/personas";

/* ------------------------------------------------------------------ */
/* Input shapes (structural — matches WorkspaceData docs)              */
/* ------------------------------------------------------------------ */

export interface NextActionTask {
  _id: string;
  title: string;
  status: string;
  priority: string; // urgent | high | medium | low
  dueDate?: string;
  dueTime?: string; // HH:mm
  projectId?: string;
  tags: string[];
  parentId?: string;
  estimateMinutes?: number;
}

export interface NextActionProject {
  _id: string;
  name: string;
  deadline?: string;
  status: string;
  goalRef?: string;
  /** Project accent color (hex) used for subtle UI accents. */
  color?: string;
}

export interface ScoredAction {
  task: NextActionTask;
  score: number;
  /** Persian reason shown to the user (why THIS action, right now). */
  reason: string;
  /** Raw signal keys that contributed — kept for debugging / future AI. */
  signals: string[];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const PRIORITY_SCORE: Record<string, number> = {
  urgent: 55,
  high: 38,
  medium: 20,
  low: 8,
};

/** Persona weight deltas — deterministic, small and predictable. */
const PERSONA_WEIGHTS: Record<
  PersonaKey | string,
  { priority: number; deadline: number; scheduled: number; project: number }
> = {
  student: { priority: 1.0, deadline: 1.1, scheduled: 1.15, project: 1.0 },
  employee: { priority: 1.1, deadline: 1.0, scheduled: 1.0, project: 1.05 },
  freelancer: { priority: 1.0, deadline: 1.25, scheduled: 1.0, project: 1.1 },
  manager: { priority: 1.0, deadline: 1.1, scheduled: 1.0, project: 1.15 },
  team: { priority: 1.0, deadline: 1.1, scheduled: 1.0, project: 1.15 },
  business_owner: { priority: 1.0, deadline: 1.1, scheduled: 0.95, project: 1.1 },
  personal: { priority: 1.0, deadline: 1.0, scheduled: 1.1, project: 1.0 },
  custom: { priority: 1.0, deadline: 1.0, scheduled: 1.0, project: 1.0 },
};

function dayDiff(fromKey: string, toKey: string): number {
  const a = Date.parse(`${fromKey}T00:00:00`);
  const b = Date.parse(`${toKey}T00:00:00`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

function minutesNow(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function minutesOf(hhmm?: string): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

export interface ScoreContext {
  persona: PersonaKey | string;
  /** Local YYYY-MM-DD "today". */
  dayKey: string;
  projectsById: Map<string, NextActionProject>;
  /** Open root-task count due today (workload signal). */
  todayLoad: number;
}

/**
 * Score one task. Higher = more relevant as the next action.
 * The returned reason is the single strongest contributing signal.
 */
export function scoreTask(
  task: NextActionTask,
  ctx: ScoreContext,
): ScoredAction {
  const w = PERSONA_WEIGHTS[ctx.persona] ?? PERSONA_WEIGHTS.custom;
  let score = 0;
  let reason = "قدم بعدی مناسب برای شروع است";
  let best = -1;
  const signals: string[] = [];

  const push = (signal: string, value: number, why: string) => {
    signals.push(signal);
    if (value > best) {
      best = value;
      reason = why;
    }
    score += value;
  };

  /* 1 — deadline proximity (dominant signal) */
  if (task.dueDate) {
    const delta = dayDiff(ctx.dayKey, task.dueDate);
    if (delta < 0) {
      const days = Math.min(-delta, 7);
      push("overdue", (80 + days * 4) * w.deadline, `${days === 1 ? "دیروز" : `${days} روز پیش`} سررسیدش بود`);
    } else if (delta === 0) {
      push("due_today", 55 * w.deadline, "برای امروز برنامه‌ریزی شده");
    } else if (delta === 1) {
      push("due_tomorrow", 24 * w.deadline, "فردا سررسید دارد");
    } else if (delta <= 3) {
      push("due_3d", 14 * w.deadline, "ظرف ۳ روز آینده سررسید دارد");
    } else if (delta <= 7) {
      push("due_7d", 7 * w.deadline, "این هفته به سررسیدش می‌رسیم");
    }
  } else {
    score -= 10;
    signals.push("no_date");
  }

  /* 2 — user-defined priority */
  const prio = PRIORITY_SCORE[task.priority] ?? PRIORITY_SCORE.medium;
  if (prio >= 38) {
    push(
      "priority",
      prio * w.priority,
      task.priority === "urgent" ? "اولویت فوری دارد" : "اولویت بالایی دارد",
    );
  } else {
    score += prio * w.priority;
    signals.push("priority_low");
  }

  /* 3 — scheduled time today */
  if (task.dueDate === ctx.dayKey && task.dueTime) {
    const at = minutesOf(task.dueTime);
    if (at !== null) {
      const now = minutesNow();
      if (at <= now) {
        push("time_passed", 26 * w.scheduled, `ساعت ${task.dueTime} گذشته است`);
      } else if (at - now <= 240) {
        push("time_soon", 18 * w.scheduled, `امروز ساعت ${task.dueTime} وقت دارد`);
      } else {
        score += 8 * w.scheduled;
        signals.push("time_later");
      }
    }
  }

  /* 4 — project deadline proximity (+ goal-linked project importance) */
  const project = task.projectId
    ? ctx.projectsById.get(task.projectId)
    : undefined;
  if (project?.deadline) {
    const delta = dayDiff(ctx.dayKey, project.deadline);
    if (delta <= 3) {
      push(
        "project_deadline",
        18,
        `ددلاین پروژه «${project.name}» نزدیک است`,
      );
    } else if (delta <= 7) {
      score += 10;
      signals.push("project_deadline_week");
    }
  }
  if (project?.goalRef) {
    score += 6;
    signals.push("goal_linked");
  }

  /* 5 — workload: on heavy days, quick wins get a small boost */
  if (ctx.todayLoad >= 5 && (task.estimateMinutes ?? 60) <= 25) {
    score += 6;
    signals.push("quick_win");
  }

  /* Deterministic tie-breaker: older tasks first. */
  score += Math.max(0, 4 - (task.tags?.length ?? 0)) * 0.01;

  return { task, score: Math.round(score * 10) / 10, reason, signals };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/** Rank every open root task. Deterministic: same input → same order. */
export function rankActions(
  tasks: NextActionTask[],
  projects: NextActionProject[],
  persona: PersonaKey | string,
  dayKey: string,
): ScoredAction[] {
  const projectsById = new Map(projects.map((p) => [p._id, p]));
  const open = tasks.filter(
    (t) => !t.parentId && t.status !== "done" && t.status !== "inbox",
  );
  const todayLoad = open.filter((t) => t.dueDate === dayKey).length;
  const ctx: ScoreContext = { persona, dayKey, projectsById, todayLoad };
  return open
    .map((t) => scoreTask(t, ctx))
    .sort((a, b) => b.score - a.score || a.task.title.localeCompare(b.task.title));
}

/** The single most relevant next action, or null when nothing is open. */
export function pickNextAction(
  tasks: NextActionTask[],
  projects: NextActionProject[],
  persona: PersonaKey | string,
  dayKey: string,
): ScoredAction | null {
  return rankActions(tasks, projects, persona, dayKey)[0] ?? null;
}

/** Top N alternatives (excluding the primary action). */
export function pickAlternatives(
  ranked: ScoredAction[],
  primaryId?: string,
  limit = 2,
): ScoredAction[] {
  return ranked.filter((a) => a.task._id !== primaryId).slice(0, limit);
}
