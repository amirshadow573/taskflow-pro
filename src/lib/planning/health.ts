/**
 * Project & goal health (Phase 10 §11, §12).
 *
 * Deterministic states with ordered, user-facing explanations — no vague
 * AI-style scores. Signals used: overdue tasks, deadline proximity, real
 * execution progress (done/total), paused/blocked status, missing next
 * action. Activity/inactivity is intentionally NOT claimed: the schema does
 * not track per-project activity timestamps, and we never fabricate one.
 */
import type { GoalLite } from "@/lib/goals";
import { goalExecution } from "@/lib/goals";
import type { NextActionProject, NextActionTask } from "@/lib/next-action";
import type { HealthReason, HealthResult, HealthState } from "@/lib/planning/types";
import { dayDelta } from "@/lib/planning/urgency";
import { toFa } from "@/lib/persian";

function fmtDay(key: string): string {
  return toFa(key.slice(5).replace("-", "/"));
}

/* ------------------------------------------------------------------ */
/* Project health                                                      */
/* ------------------------------------------------------------------ */

export function projectHealth(
  project: NextActionProject,
  tasks: NextActionTask[],
  dayKey: string,
): HealthResult {
  const reasons: HealthReason[] = [];
  const own = tasks.filter((t) => t.projectId === project._id && !t.parentId);
  const open = own.filter((t) => t.status !== "done");
  const done = own.length - open.length;
  const progressPct = own.length ? Math.round((done / own.length) * 100) : null;

  const overdue = open.filter(
    (t) => t.dueDate !== undefined && t.dueDate < dayKey,
  );
  const delta = project.deadline ? dayDelta(dayKey, project.deadline) : null;

  let state: HealthState;

  if (project.status === "completed" || (own.length > 0 && open.length === 0)) {
    state = "completed";
    reasons.push({ key: "done", label: "همه کارهای این پروژه انجام شده", tone: "good" });
    if (delta !== null && delta >= 0) {
      reasons.push({ key: "deadline_ok", label: `قبل از ددلاین (${fmtDay(project.deadline!)}) تمام شد`, tone: "good" });
    }
  } else if (project.status === "paused" || project.status === "on_hold") {
    state = "blocked";
    reasons.push({ key: "paused", label: "وضعیت پروژه متوقف است", tone: "bad" });
    if (open.length > 0) {
      reasons.push({ key: "open_blocked", label: `${toFa(open.length)} کار باز روی آن منتظر است`, tone: "warn" });
    }
  } else if (overdue.length > 0 && delta !== null && delta <= 3) {
    state = "at_risk";
    reasons.push({
      key: "overdue_near_deadline",
      label: `${toFa(overdue.length)} کار عقب‌افتاده و ددلاین ${fmtDay(project.deadline!)} نزدیک است`,
      tone: "bad",
    });
  } else if (overdue.length >= 3) {
    state = "at_risk";
    reasons.push({ key: "overdue_accumulated", label: `${toFa(overdue.length)} کار عقب‌افتاده انباشته شده`, tone: "bad" });
  } else if (delta !== null && delta < 0 && open.length > 0) {
    state = "at_risk";
    reasons.push({ key: "deadline_passed", label: `ددلاین ${fmtDay(project.deadline!)} گذشته و کار باز دارد`, tone: "bad" });
  } else if (overdue.length > 0) {
    state = "needs_attention";
    reasons.push({ key: "overdue", label: `${toFa(overdue.length)} کار عقب‌افتاده دارد`, tone: "warn" });
    if (delta !== null && delta <= 7) {
      reasons.push({ key: "deadline_soon", label: `ددلاین ${fmtDay(project.deadline!)} این هفته است`, tone: "warn" });
    }
  } else if (delta !== null && delta <= 7) {
    state = "needs_attention";
    reasons.push({ key: "deadline_week", label: `ددلاین ${fmtDay(project.deadline!)} این هفته است`, tone: "warn" });
    if (own.length === 0) {
      reasons.push({ key: "no_tasks", label: "هنوز هیچ کاری برایش ثبت نشده", tone: "warn" });
    }
  } else if (own.length === 0) {
    // Planning gap, not danger: an empty project simply needs its first step.
    state = "needs_attention";
    reasons.push({ key: "no_tasks", label: "هیچ کاری به این پروژه وصل نیست", tone: "warn" });
  } else {
    state = "healthy";
    reasons.push({ key: "ok", label: `${toFa(open.length)} کار باز، بدون عقب‌افتادگی`, tone: "good" });
    if (progressPct !== null) {
      reasons.push({ key: "progress", label: `${toFa(progressPct)}٪ انجام شده`, tone: "good" });
    }
  }

  return { state, reasons, progressPct };
}

/* ------------------------------------------------------------------ */
/* Goal health                                                         */
/* ------------------------------------------------------------------ */

export interface GoalHealthInput {
  goal: GoalLite;
  projects: NextActionProject[];
  tasks: NextActionTask[];
  dayKey: string;
}

/**
 * Goal health: target date + self-reported progress + REAL execution through
 * linked projects/tasks + attention recommendation (as an explanation, never
 * an automatic change).
 */
export function goalHealth(input: GoalHealthInput): HealthResult {
  const { goal, projects, tasks, dayKey } = input;
  const reasons: HealthReason[] = [];
  const exec = goalExecution(goal.ref, projects, tasks);
  const delta = goal.dueDate ? dayDelta(dayKey, goal.dueDate) : null;
  const progressPct = exec.executionPct >= 0 ? exec.executionPct : goal.progress;

  let state: HealthState;

  if (goal.status === "completed") {
    state = "completed";
    reasons.push({ key: "done", label: "تکمیل شده", tone: "good" });
    return { state, reasons, progressPct };
  }

  if (goal.status === "paused") {
    state = "blocked";
    reasons.push({ key: "paused", label: "هدف متوقف است", tone: "bad" });
    return { state, reasons, progressPct };
  }

  const overdueRelated = tasks.filter(
    (t) =>
      t.status !== "done" &&
      !t.parentId &&
      t.projectId !== undefined &&
      exec.projects.some((p) => p.project._id === t.projectId) &&
      t.dueDate !== undefined &&
      t.dueDate < dayKey,
  );

  if (delta !== null && delta < 0 && goal.progress < 100) {
    state = "at_risk";
    reasons.push({ key: "target_passed", label: `موعد هدف (${fmtDay(goal.dueDate!)}) گذشته`, tone: "bad" });
    reasons.push({ key: "progress_low", label: `${toFa(goal.progress)}٪ پیشرفت`, tone: "warn" });
  } else if (goal.status === "at_risk") {
    state = "at_risk";
    reasons.push({ key: "marked_at_risk", label: "خودت یا سیستم آن را در خطر علامت زده", tone: "bad" });
    if (delta !== null) reasons.push({ key: "due", label: `موعد ${fmtDay(goal.dueDate!)}`, tone: "warn" });
  } else if (overdueRelated.length >= 2) {
    state = "at_risk";
    reasons.push({ key: "related_overdue", label: `${toFa(overdueRelated.length)} کار مرتبط عقب‌افتاده`, tone: "bad" });
  } else if (delta !== null && delta <= 7 && goal.progress < 50) {
    state = "needs_attention";
    reasons.push({ key: "due_low_progress", label: `موعد ${fmtDay(goal.dueDate!)} نزدیک است و پیشرفت ${toFa(goal.progress)}٪ است`, tone: "warn" });
  } else if (exec.projects.length === 0) {
    state = "needs_attention";
    reasons.push({ key: "no_project", label: "هنوز پروژه‌ای به آن وصل نشده", tone: "warn" });
  } else if (overdueRelated.length > 0) {
    state = "needs_attention";
    reasons.push({ key: "related_overdue", label: `${toFa(overdueRelated.length)} کار مرتبط عقب‌افتاده`, tone: "warn" });
  } else {
    state = "healthy";
    if (exec.executionPct >= 0) {
      reasons.push({ key: "execution", label: `اجرا: ${toFa(exec.doneTasks)} از ${toFa(exec.totalTasks)} کار`, tone: "good" });
    } else {
      reasons.push({ key: "self_progress", label: `${toFa(goal.progress)}٪ پیشرفت گزارش شده`, tone: "good" });
    }
    if (delta !== null && delta > 7) {
      reasons.push({ key: "due_ok", label: `موعد ${fmtDay(goal.dueDate!)} — فاصله دارد`, tone: "good" });
    }
  }

  return { state, reasons, progressPct };
}
