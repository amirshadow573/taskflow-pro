/**
 * Urgency engine + system planning priority (Phase 10).
 *
 * Two deliberately SEPARATE concepts (§4, §5):
 *
 *   Urgency  — derived ONLY from real dates + a documented configuration
 *              (windows below). Never arbitrary, never hardcoded per task.
 *   Planning priority — a transparent 0..100 attention score. It NEVER
 *              replaces or rewrites the user's stored priority; the UI shows
 *              «توجه بالا» without touching `task.priority`.
 */
import type { PersonaKey } from "@/lib/personas";
import type { GoalLite } from "@/lib/goals";
import type { NextActionProject, NextActionTask } from "@/lib/next-action";
import type {
  AttentionBand,
  UrgencyState,
} from "@/lib/planning/types";

/* ------------------------------------------------------------------ */
/* Urgency configuration — documented windows, not arbitrary magic     */
/* ------------------------------------------------------------------ */

export interface UrgencyConfig {
  /** Days until deadline that count as «critical» (deadline today = 0). */
  criticalDays: number;
  /** Days until deadline that count as «due soon». */
  dueSoonDays: number;
  /** Days until deadline that count as «upcoming»; beyond = flexible. */
  upcomingDays: number;
}

export const DEFAULT_URGENCY_CONFIG: UrgencyConfig = {
  criticalDays: 0,
  dueSoonDays: 3,
  upcomingDays: 7,
};

/** Whole-day difference from `dayKey` to `dateKey` (negative = past). */
export function dayDelta(dayKey: string, dateKey?: string | null): number | null {
  if (!dateKey) return null;
  const a = Date.parse(`${dayKey}T00:00:00`);
  const b = Date.parse(`${dateKey}T00:00:00`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

/**
 * Classify the urgency of any deadline-bearing entity (task, project, goal,
 * exam, deliverable…). `null` date → «no deadline» — we never invent urgency.
 */
export function classifyUrgency(
  dueDate: string | null | undefined,
  dayKey: string,
  config: UrgencyConfig = DEFAULT_URGENCY_CONFIG,
): UrgencyState {
  const delta = dayDelta(dayKey, dueDate);
  if (delta === null) return "no_deadline";
  if (delta < 0) return "overdue";
  if (delta <= config.criticalDays) return "critical";
  if (delta <= config.dueSoonDays) return "due_soon";
  if (delta <= config.upcomingDays) return "upcoming";
  return "flexible";
}

/** Ordering helper — lower = more urgent. */
export function urgencyRank(state: UrgencyState): number {
  switch (state) {
    case "overdue":
      return 0;
    case "critical":
      return 1;
    case "due_soon":
      return 2;
    case "upcoming":
      return 3;
    case "flexible":
      return 4;
    default:
      return 5;
  }
}

/** True when the state demands attention within the planning horizon. */
export function isDeadlineUrgent(state: UrgencyState): boolean {
  return state === "overdue" || state === "critical" || state === "due_soon";
}

/* ------------------------------------------------------------------ */
/* System planning priority                                            */
/* ------------------------------------------------------------------ */

/**
 * Persona weight on planning attention — small, deterministic, predictable.
 * Mirrors the Phase 09 next-action bias without coupling the two modules.
 */
const PERSONA_WEIGHTS: Record<PersonaKey | string, number> = {
  student: 1.05, // exams/assignments amplify deadline attention
  employee: 1.0,
  freelancer: 1.05, // client deadlines carry contractual weight
  manager: 1.0,
  team: 1.0,
  business_owner: 1.0,
  personal: 1.0,
  custom: 1.0,
};

const USER_PRIORITY_POINTS: Record<string, number> = {
  urgent: 18,
  high: 12,
  medium: 6,
  low: 2,
};

export interface PlanningPriorityInput {
  task: NextActionTask & { createdAt?: number };
  persona: PersonaKey | string;
  dayKey: string;
  project?: NextActionProject | undefined;
  goal?: GoalLite | null;
  /** Task carries a blocked signal (see buckets.ts). */
  blocked?: boolean;
  /** Open root tasks due today — workload modifier. */
  todayLoad: number;
  /** Minutes since midnight — used for the scheduled-time signal. */
  nowMinutes?: number;
}

export interface PlanningPriority {
  /** Deterministic 0..100 attention score. */
  score: number;
  attention: AttentionBand;
  /** The user's stored priority — copied, never modified. */
  userPriority: string;
  urgency: UrgencyState;
  /** Persian explanations, strongest signal first. */
  reasons: string[];
  /** Raw signal keys (debugging / future AI). */
  signals: string[];
}

function minutesOf(hhmm?: string): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * System planning priority for ONE task.
 *
 * Transparent and explainable: every point comes from a named signal, and the
 * returned `reasons` explain the strongest contributors in Persian. The user's
 * stored `task.priority` is an INPUT here — it is never rewritten.
 */
export function planningPriority(input: PlanningPriorityInput): PlanningPriority {
  const { task, persona, dayKey } = input;
  const weight = PERSONA_WEIGHTS[persona] ?? PERSONA_WEIGHTS.custom;
  const reasons: string[] = [];
  const signals: string[] = [];
  let score = 0;

  const add = (points: number, signal: string, reason?: string) => {
    score += points;
    signals.push(signal);
    if (reason) reasons.push(reason);
  };

  /* 1 — urgency from real dates */
  const urgency = classifyUrgency(task.dueDate, dayKey);
  switch (urgency) {
    case "overdue": {
      const days = Math.min(Math.abs(dayDelta(dayKey, task.dueDate) ?? 0), 30);
      add(30, "overdue", `${days === 1 ? "دیروز" : `${days} روز پیش`} موعدش بود`);
      break;
    }
    case "critical":
      add(24, "due_today", "برای امروز موعد دارد");
      break;
    case "due_soon":
      add(14, "due_soon", "ظرف ۳ روز آینده موعد دارد");
      break;
    case "upcoming":
      add(7, "upcoming", "این هفته موعد دارد");
      break;
    case "flexible":
      add(2, "flexible", "مهلت دار و عجله‌ای ندارد");
      break;
    case "no_deadline":
      signals.push("no_deadline");
      break;
  }

  /* 2 — the user's own priority (as an input signal, not a replacement) */
  const userPoints = USER_PRIORITY_POINTS[task.priority] ?? 6;
  add(userPoints * weight, "user_priority");
  if (task.priority === "urgent") reasons.push("خودت فوری علامت زده‌ای");
  else if (task.priority === "high") reasons.push("اولویت بالای خودت است");

  /* 3 — project deadline proximity */
  if (input.project?.deadline) {
    const pd = dayDelta(dayKey, input.project.deadline);
    if (pd !== null && pd <= 3) {
      add(10, "project_deadline_near", `ددلاین پروژه «${input.project.name}» نزدیک است`);
    } else if (pd !== null && pd <= 7) {
      add(5, "project_deadline_week", `پروژه «${input.project.name}» این هفته به ددلاین می‌رسد`);
    }
  }

  /* 4 — goal alignment */
  if (input.goal && input.goal.status !== "completed") {
    add(4, "goal_linked", `به هدف «${input.goal.title}» متصل است`);
  }

  /* 5 — scheduled time today already passed */
  if (task.dueDate === dayKey && task.dueTime) {
    const at = minutesOf(task.dueTime);
    const now = input.nowMinutes ?? new Date().getHours() * 60 + new Date().getMinutes();
    if (at !== null && at <= now) {
      add(6, "time_passed", `ساعت ${task.dueTime} گذشته است`);
    }
  }

  /* 6 — blocked state raises attention WITHOUT pretending work can start */
  if (input.blocked) {
    add(5, "blocked", "مسدود است و باید رفع انسداد شود");
  }

  /* 7 — task age (old open tasks deserve a nudge) */
  if (task.createdAt) {
    const ageDays = Math.floor((Date.now() - task.createdAt) / 86400000);
    if (ageDays >= 14) {
      add(4, "old_task", `${ageDays} روز است باز مانده`);
    } else if (ageDays >= 7) {
      add(2, "aging_task", "هفته‌ای است باز مانده");
    }
  }

  /* 8 — workload context: quick wins help a heavy day, giants do not */
  if (input.todayLoad >= 6) {
    if ((task.estimateMinutes ?? 60) <= 25) {
      add(3, "quick_win", "برای روز پر، شروع کوتاهی است");
    } else if ((task.estimateMinutes ?? 0) >= 120) {
      score -= 3;
      signals.push("too_big_for_load");
      reasons.push("برای بار امروز سنگین است — شاید فردا بهتر باشد");
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  /*
   * Attention band — deterministic AND meaningful:
   *   high   = any overdue work, or a critical-day task the user marked
   *            urgent/high, or a strongly loaded score (≥45)
   *   medium = moderate score (≥20)
   *   low    = everything else (flexible, far-dated, low priority)
   */
  const attention: AttentionBand =
    urgency === "overdue" ||
    (urgency === "critical" && (task.priority === "urgent" || task.priority === "high")) ||
    score >= 45
      ? "high"
      : score >= 20
        ? "medium"
        : "low";

  return {
    score,
    attention,
    userPriority: task.priority,
    urgency,
    reasons,
    signals,
  };
}
