/**
 * Planning recommendation engine (Phase 10 §16, §17).
 *
 * Recommendations are:
 *   - DETERMINISTIC — same inputs → same list, same ids (idempotent; the
 *     dashboard can re-render forever without duplicates)
 *   - EXPLAINABLE   — every item states WHY in Persian
 *   - ACTIONABLE    — optional link to the surface where the user can act
 *   - DISMISSIBLE   — non-destructive dismissal (localStorage, per day)
 *   - NON-DESTRUCTIVE — this module NEVER mutates tasks, priorities, dates
 *     or goals; consequential changes always require the user's own action.
 *
 * No AI is involved. Templates are fixed strings composed from real data.
 */
import type { GoalLite } from "@/lib/goals";
import { goalExecution } from "@/lib/goals";
import type { NextActionProject, NextActionTask, ScoredAction } from "@/lib/next-action";
import type { PersonaKey } from "@/lib/personas";
import {
  classifyUrgency,
  dayDelta,
  isDeadlineUrgent,
} from "@/lib/planning/urgency";
import type {
  HealthResult,
  OverloadSignal,
  PlanningItem,
  PlanningRecommendation,
  RecommendationType,
  TodayBuckets,
  WorkloadAnalysis,
} from "@/lib/planning/types";
import { toFa } from "@/lib/persian";

/* ------------------------------------------------------------------ */
/* Ordering                                                            */
/* ------------------------------------------------------------------ */

const TYPE_ORDER: Record<RecommendationType, number> = {
  NEXT_ACTION: 0,
  OVERDUE_WARNING: 1,
  DEADLINE_WARNING: 2,
  BLOCKED_TASK: 3,
  WORKLOAD_WARNING: 4,
  PROJECT_ATTENTION: 5,
  GOAL_ATTENTION: 6,
  MISSING_NEXT_ACTION: 7,
  SCHEDULING_SUGGESTION: 8,
  PLANNING_GAP: 9,
  REVIEW_SUGGESTION: 10,
};

const SEVERITY_ORDER: Record<PlanningRecommendation["severity"], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

/** Hard cap so the surface can never drown the user. */
export const MAX_RECOMMENDATIONS = 20;

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

export interface RecommendationContext {
  dayKey: string;
  persona: PersonaKey | string;
  tasks: NextActionTask[];
  projects: NextActionProject[];
  goals: GoalLite[];
  buckets: TodayBuckets;
  workload: WorkloadAnalysis;
  overloadSignals: OverloadSignal[];
  nextAction: ScoredAction | null;
  projectHealths: Array<{ project: NextActionProject; health: HealthResult }>;
  goalHealths: Array<{ goal: GoalLite; health: HealthResult }>;
  personaItems: PlanningItem[];
  /** Minutes since midnight — drives the evening review signal. */
  nowMinutes: number;
  /** Student-only: study minutes logged in the last 7 days (undefined = unknown). */
  recentStudyMinutes?: number;
  /** Free minutes left today (null when the calendar is unknown). */
  availableMinutes: number | null;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function fmtDay(key: string): string {
  return toFa(key.slice(5).replace("-", "/"));
}

function dayLabel(delta: number): string {
  if (delta === 0) return "امروز";
  if (delta === 1) return "فردا";
  if (delta === -1) return "دیروز";
  if (delta > 1) return `${toFa(delta)} روز دیگر`;
  return `${toFa(-delta)} روز پیش`;
}

export function recommendationSorter(
  a: PlanningRecommendation,
  b: PlanningRecommendation,
): number {
  // The next action is the constructive hero — always first.
  const aHero = a.type === "NEXT_ACTION" ? -1 : SEVERITY_ORDER[a.severity];
  const bHero = b.type === "NEXT_ACTION" ? -1 : SEVERITY_ORDER[b.severity];
  return (
    aHero - bHero ||
    TYPE_ORDER[a.type] - TYPE_ORDER[b.type] ||
    a.id.localeCompare(b.id)
  );
}

/* ------------------------------------------------------------------ */
/* Generator                                                           */
/* ------------------------------------------------------------------ */

/**
 * Build the full recommendation list. Pure — no side effects, no storage
 * writes (dismissal is handled separately in ./dismissals.ts).
 */
export function buildRecommendations(
  ctx: RecommendationContext,
): PlanningRecommendation[] {
  const out: PlanningRecommendation[] = [];
  const { dayKey } = ctx;
  const seen = new Set<string>();

  const add = (rec: Omit<PlanningRecommendation, "dayKey">) => {
    if (seen.has(rec.id) || out.length >= MAX_RECOMMENDATIONS) return;
    seen.add(rec.id);
    out.push({ ...rec, dayKey });
  };

  const openRoot = ctx.tasks.filter(
    (t) => !t.parentId && t.status !== "done" && t.status !== "inbox",
  );
  const projectById = new Map(ctx.projects.map((p) => [p._id, p]));

  /* 1 — NEXT_ACTION: the single most relevant step, always deterministic. */
  if (ctx.nextAction) {
    const project = ctx.nextAction.task.projectId
      ? projectById.get(ctx.nextAction.task.projectId)
      : undefined;
    add({
      id: `next_action:${ctx.nextAction.task._id}:${dayKey}`,
      type: "NEXT_ACTION",
      severity: "info",
      title: `قدم بعدی: ${ctx.nextAction.task.title}`,
      detail: project
        ? `${ctx.nextAction.reason} · پروژه «${project.name}»`
        : ctx.nextAction.reason,
      targetId: ctx.nextAction.task._id,
      link: { to: "/today", label: "در امروز" },
    });
  }

  /* 2 — OVERDUE_WARNING: worst overdue tasks (cap 2). */
  const overdueTasks = openRoot
    .filter((t) => t.dueDate !== undefined && t.dueDate < dayKey)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  for (const t of overdueTasks.slice(0, 2)) {
    const days = Math.abs(dayDelta(dayKey, t.dueDate) ?? 0);
    const project = t.projectId ? projectById.get(t.projectId) : undefined;
    add({
      id: `overdue:task:${t._id}:${dayKey}`,
      type: "OVERDUE_WARNING",
      severity: "critical",
      title: `${t.title} عقب‌افتاده`,
      detail: `موعدش ${dayLabel(dayDelta(dayKey, t.dueDate) ?? 0)} بود${project ? ` · پروژه «${project.name}»` : ""} — الان ${toFa(days)} روز از موعد گذشته، تعیین تکلیفش کن.`,
      targetId: t._id,
      link: { to: "/tasks?filter=overdue", label: "کارهای عقب‌افتاده" },
    });
  }

  /* 3 — DEADLINE_WARNING: tasks due today / within 3 days (cap 2). */
  const soonTasks = openRoot
    .filter((t) => {
      const u = classifyUrgency(t.dueDate, dayKey);
      return u === "critical" || u === "due_soon";
    })
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  for (const t of soonTasks.slice(0, 2)) {
    const delta = dayDelta(dayKey, t.dueDate) ?? 0;
    add({
      id: `deadline:task:${t._id}:${dayKey}`,
      type: "DEADLINE_WARNING",
      severity: delta <= 0 ? "critical" : "warning",
      title: `«${t.title}» ${delta <= 0 ? "امروز" : "فردا"} موعد دارد`,
      detail:
        delta <= 0
          ? "برای امروز برنامه‌ریزی شده — در بخش «باید امروز انجام شود» می‌بینیاش."
          : `موعدش ${dayLabel(delta)} است (${fmtDay(t.dueDate!)}) — امروز بخشی از کار را جلو بینداز.`,
      targetId: t._id,
      link: { to: "/today", label: "امروز" },
    });
  }

  /* 4 — Persona deadline items (exams, deliverables, milestones…). */
  const urgentItems = ctx.personaItems
    .map((item) => ({ item, urgency: classifyUrgency(item.dueDate, dayKey) }))
    .filter((x) => isDeadlineUrgent(x.urgency))
    .sort(
      (a, b) =>
        (a.item.dueDate ?? "").localeCompare(b.item.dueDate ?? "") ||
        a.item.id.localeCompare(b.item.id),
    );

  for (const { item, urgency } of urgentItems.slice(0, 3)) {
    const delta = dayDelta(dayKey, item.dueDate) ?? 0;
    let detail =
      item.detail ??
      `${item.label} ${fmtDay(item.dueDate ?? dayKey)} دارد (${dayLabel(delta)}).`;

    // Student-specific: exam close + no recent study activity (§13).
    if (
      item.kind === "exam" &&
      ctx.recentStudyMinutes !== undefined &&
      ctx.recentStudyMinutes === 0 &&
      urgency !== "overdue"
    ) {
      detail += " اخیراً جلسه مطالعه‌ای ثبت نکرده‌ای — آمادگی‌ات را جدی بگیر.";
    }

    add({
      id: `deadline:${item.kind}:${item.id}:${dayKey}`,
      type: urgency === "overdue" ? "OVERDUE_WARNING" : "DEADLINE_WARNING",
      severity: urgency === "overdue" || urgency === "critical" ? "critical" : "warning",
      title:
        urgency === "overdue"
          ? `${item.label} «${item.title}» گذشته`
          : `${item.label} «${item.title}» نزدیک است`,
      detail,
      targetId: item.id,
      link: { to: "/calendar", label: "تقویم" },
    });
  }

  /* 5 — WORKLOAD_WARNING: heavy / overloaded days explain themselves. */
  if (ctx.workload.state === "heavy" || ctx.workload.state === "overloaded") {
    const deferHint =
      ctx.workload.state === "overloaded"
        ? " اگر امکانش هست، یکی دو کار کم‌فشارتر را به روز بعد منتقل کن — تصمیم با خودت است."
        : "";
    add({
      id: `workload:${ctx.workload.state}:${dayKey}`,
      type: "WORKLOAD_WARNING",
      severity: ctx.workload.state === "overloaded" ? "critical" : "warning",
      title:
        ctx.workload.state === "overloaded"
          ? "بار امروز از ظرفیت پیشنهادی بیشتر است"
          : "بار امروز سنگین است",
      detail: `${ctx.workload.explanation}${deferHint}`,
      link: { to: "/planning", label: "مرکز برنامه‌ریزی" },
    });
  }

  /* 6 — BLOCKED_TASK (cap 2). */
  for (const b of ctx.buckets.blocked.slice(0, 2)) {
    add({
      id: `blocked:task:${b.task._id}:${dayKey}`,
      type: "BLOCKED_TASK",
      severity: "warning",
      title: `«${b.task.title}» مسدود است`,
      detail: b.reason,
      targetId: b.task._id,
      link: { to: "/tasks", label: "کارهای من" },
    });
  }

  /* 7 — PROJECT_ATTENTION: at-risk / blocked projects (cap 3). */
  for (const { project, health } of ctx.projectHealths
    .filter((x) => x.health.state === "at_risk" || x.health.state === "blocked")
    .slice(0, 3)) {
    const why = health.reasons
      .slice(0, 2)
      .map((r) => r.label)
      .join("؛ ");
    add({
      id: `project_attention:${project._id}:${dayKey}`,
      type: "PROJECT_ATTENTION",
      severity: "warning",
      title: `پروژه «${project.name}» ${health.state === "blocked" ? "متوقف" : "در خطر"} است`,
      detail: `${why}. سری به‌اش بزن و تصمیم بگیر.`,
      targetId: project._id,
      link: { to: `/projects/${project._id}`, label: "پروژه" },
    });
  }

  /* 8 — GOAL_ATTENTION: goals falling behind (cap 2). */
  for (const { goal, health } of ctx.goalHealths
    .filter((x) => {
      if (x.health.state === "at_risk") return true;
      if (x.health.state !== "needs_attention") return false;
      return x.health.reasons.some(
        (r) => r.key === "related_overdue" || r.key === "due_low_progress",
      );
    })
    .slice(0, 2)) {
    const why = health.reasons
      .slice(0, 2)
      .map((r) => r.label)
      .join("؛ ");
    add({
      id: `goal_attention:${goal.ref}:${dayKey}`,
      type: "GOAL_ATTENTION",
      severity: health.state === "at_risk" ? "warning" : "info",
      title: `هدف «${goal.title}» عقب است`,
      detail: `${why}. یک قدم کوچک برایش امروز بردار.`,
      targetId: goal.ref,
    });
  }

  /* 9 — MISSING_NEXT_ACTION: near-deadline projects without open work. */
  for (const { project } of ctx.projectHealths
    .filter(({ project, health }) => {
      if (project.status === "completed" || health.state === "completed") return false;
      const delta = project.deadline ? dayDelta(dayKey, project.deadline) : null;
      if (delta === null || delta > 7) return false;
      return health.progressPct === null; // no root tasks at all
    })
    .slice(0, 2)) {
    const delta = dayDelta(dayKey, project.deadline!) ?? 0;
    add({
      id: `missing_next_action:${project._id}:${dayKey}`,
      type: "MISSING_NEXT_ACTION",
      severity: "warning",
      title: `برای «${project.name}» قدمی ثبت نشده`,
      detail: `ددلاین ${dayLabel(delta)} (${fmtDay(project.deadline!)}) دارد اما هیچ کار بازی به‌اش وصل نیست — اولین کارش را بساز.`,
      targetId: project._id,
      link: { to: `/projects/${project._id}`, label: "پروژه" },
    });
  }

  /* 10 — SCHEDULING_SUGGESTION: recommend a block, never create one. */
  const nextExam = ctx.personaItems.find(
    (i) =>
      i.kind === "exam" &&
      classifyUrgency(i.dueDate, dayKey) !== "no_deadline" &&
      classifyUrgency(i.dueDate, dayKey) !== "flexible" &&
      classifyUrgency(i.dueDate, dayKey) !== "overdue",
  );
  if (nextExam) {
    add({
      id: `scheduling:exam:${nextExam.id}:${dayKey}`,
      type: "SCHEDULING_SUGGESTION",
      severity: "warning",
      title: `برای «${nextExam.title}» بلوک مطالعه بساز`,
      detail: `${nextExam.detail ?? `موعدش ${fmtDay(nextExam.dueDate ?? dayKey)} است.`} در تقویم یک بلوک زمانی برای آمادگی‌اش خالی کن — ما نمی‌سازیمش، خودت تأیید کن.`,
      targetId: nextExam.id,
      link: { to: "/calendar", label: "تقویم" },
    });
  }
  const schedulable =
    ctx.nextAction &&
    !ctx.nextAction.task.dueTime &&
    ctx.availableMinutes !== null &&
    ctx.workload.state !== "overloaded" &&
    ctx.buckets.mustDo.length > 0;
  if (schedulable && ctx.nextAction) {
    const minutes = ctx.nextAction.task.estimateMinutes ?? 45;
    const available = ctx.availableMinutes ?? 0;
    if (available >= Math.min(minutes, 120)) {
      add({
        id: `scheduling:task:${ctx.nextAction.task._id}:${dayKey}`,
        type: "SCHEDULING_SUGGESTION",
        severity: "info",
        title: `برای «${ctx.nextAction.task.title}» وقت بگذار`,
        detail: `بدون ساعت مشخص است و حدود ${toFa(Math.round(available / 60))} ساعت فرصت داری — یک بلوک ${toFa(Math.min(minutes, 120))} دقیقه‌ای در تقویم برایش در نظر بگیر.`,
        targetId: ctx.nextAction.task._id,
        link: { to: "/calendar", label: "تقویم" },
      });
    }
  }

  /* 11 — PLANNING_GAP: structural gaps (recommend only, never force). */
  const unlinked = openRoot.filter((t) => t.projectId === undefined);
  if (unlinked.length >= 3) {
    add({
      id: `planning_gap:unlinked:${dayKey}`,
      type: "PLANNING_GAP",
      severity: "info",
      title: `${toFa(unlinked.length)} کار بدون پروژه`,
      detail:
        "اگر بخشی از این کارها به هدفی متصل‌اند، پروژه‌شان را مشخص کن تا پیشرفت هدف واقعی دیده شود — هیچ‌چیز را اجباری دسته‌بندی نمی‌کنیم.",
      link: { to: "/tasks", label: "کارهای من" },
    });
  }
  for (const { goal } of ctx.goalHealths
    .filter(({ goal, health }) => {
      if (health.state === "completed" || health.state === "blocked") return false;
      return goalExecution(goal.ref, ctx.projects, ctx.tasks).projects.length === 0;
    })
    .slice(0, 2)) {
    add({
      id: `planning_gap:goal:${goal.ref}:${dayKey}`,
      type: "PLANNING_GAP",
      severity: "info",
      title: `هدف «${goal.title}» بدون پروژه فعال`,
      detail: "پروژه‌ای به این هدف وصل نیست؛ تا پروژه‌ای نباشد، پیشرفت واقعی‌اش اندازه‌گیری نمی‌شود.",
    });
  }

  /* 12 — REVIEW_SUGGESTION (at most one — the strongest situation). */
  const openTodayCount =
    ctx.buckets.mustDo.length + ctx.buckets.shouldDo.length + ctx.buckets.couldDo.length;
  if (overdueTasks.length >= 5) {
    add({
      id: `review:backlog:${dayKey}`,
      type: "REVIEW_SUGGESTION",
      severity: "info",
      title: "اولویت‌ها به بازبینی نیاز دارند",
      detail: `${toFa(overdueTasks.length)} کار عقب‌افتاده انباشته شده — چندتایشان را به روزهای بعد منتقل کن یا اولویتشان را عوض کن؛ همه‌چیز با تأیید خودت انجام می‌شود.`,
      link: { to: "/planning", label: "مرکز برنامه‌ریزی" },
    });
  } else if (ctx.nowMinutes >= 18 * 60 && openTodayCount > 0) {
    add({
      id: `review:evening:${dayKey}`,
      type: "REVIEW_SUGGESTION",
      severity: "info",
      title: "روز در حال بسته شدن است",
      detail: `${toFa(openTodayCount)} کار از امروز باقی مانده — کارهای ناتمام را مرور کن و تصمیم بگیر فردا از کجا ادامه دهی.`,
      link: { to: "/planning", label: "مرکز برنامه‌ریزی" },
    });
  }

  return out.sort(recommendationSorter);
}
