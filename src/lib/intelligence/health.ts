/**
 * Project & goal health intelligence (Phase 13 §9 / §10 / §11).
 *
 * State + REASONS come from the Phase 10 planner (`projectHealth` /
 * `goalHealth`) — this module never re-derives health, so the dashboard, the
 * planner and the insight center can never disagree.
 *
 * What Phase 13 adds on top is pure history that the planner deliberately
 * avoids claiming: **real activity timestamps**. They are derived from
 * observable fields (`task.completedAt`, execution-session days) — not guessed,
 * not from a new tracking table — which makes stagnation detectable:
 *
 *   «این هدف در ۹ روز گذشته فعالیت قابل‌توجهی نداشته است.»
 */
import type { ExecutionSession } from "@/lib/execution";
import type { IntelGoal, IntelGoalHealth, IntelProject, IntelProjectHealth, IntelTask } from "./input";
import type { GoalIntelligence, ProjectIntelligence } from "./types";
import { dayKeyOf, daysBetween, windowStartDay } from "./window";

const BLOCKED_TAG = "مسدود";
const VELOCITY_DAYS = 14;

export interface HealthIntelligenceInput {
  tasks: IntelTask[];
  projects: IntelProject[];
  goals: IntelGoal[];
  sessions: ExecutionSession[];
  projectHealths: IntelProjectHealth[];
  goalHealths: IntelGoalHealth[];
  dayKey: string;
  days: number;
}

interface ActivityIndex {
  lastDay: string | null;
  /** Day → completed count, for velocity. */
  completedDays: string[];
}

function buildActivityIndex(
  tasks: IntelTask[],
  sessions: ExecutionSession[],
  projectId?: string,
  taskIds?: Set<string>,
): ActivityIndex {
  const days: string[] = [];
  let last: string | null = null;
  for (const t of tasks) {
    if (t.completedAt == null) continue;
    if (projectId && t.projectId !== projectId) continue;
    if (taskIds && !taskIds.has(t._id)) continue;
    const day = dayKeyOf(t.completedAt);
    days.push(day);
    if (!last || day > last) last = day;
  }
  for (const s of sessions) {
    if (s.state !== "completed") continue;
    if (projectId && s.projectId !== projectId) continue;
    if (taskIds && (!s.taskId || !taskIds.has(s.taskId))) continue;
    const day = s.day;
    if (!last || day > last) last = day;
  }
  return { lastDay: last, completedDays: days };
}

export function buildProjectIntelligence(
  input: HealthIntelligenceInput,
): ProjectIntelligence[] {
  const healthByProject = new Map(input.projectHealths.map((h) => [h.projectId, h]));
  const from = windowStartDay(input.dayKey, input.days);
  const velocityFrom = windowStartDay(input.dayKey, VELOCITY_DAYS);

  return input.projects.map((project) => {
    const own = input.tasks.filter((t) => t.projectId === project._id && !t.parentId);
    const open = own.filter((t) => t.status !== "done");
    const overdue = open.filter((t) => !!t.dueDate && t.dueDate < input.dayKey);
    const blocked = open.filter((t) =>
      t.tags.some((tag) => tag.trim() === BLOCKED_TAG),
    );
    const remaining = open.reduce((sum, t) => sum + (t.estimateMinutes ?? 0), 0);

    const health = healthByProject.get(project._id);
    const activity = buildActivityIndex(input.tasks, input.sessions, project._id);
    const completedLast14 = activity.completedDays.filter((d) => d >= velocityFrom).length;
    const daysSinceActivity = activity.lastDay ? daysBetween(activity.lastDay, input.dayKey) : null;

    const signals: string[] = [];
    if (overdue.length > 0) signals.push("overdue");
    if (blocked.length > 0) signals.push("blocked");
    if (remaining > 0) signals.push("remaining_work");
    if (daysSinceActivity != null && daysSinceActivity >= 7) signals.push("stagnant");
    if (!activity.lastDay && own.length > 0) signals.push("no_completion_ever");

    void from;
    return {
      projectId: project._id,
      name: project.name,
      health: health?.state ?? (own.length === 0 ? "needs_attention" : "healthy"),
      progressPct: health?.progressPct ?? null,
      openTasks: open.length,
      overdueTasks: overdue.length,
      blockedTasks: blocked.length,
      remainingEstimateMinutes: remaining,
      completedLast14,
      velocityPerWeek: Math.round((completedLast14 / VELOCITY_DAYS) * 7 * 10) / 10,
      lastActivityDay: activity.lastDay,
      daysSinceActivity,
      reasons: health?.reasons ?? [],
      signals,
    };
  });
}

export function buildGoalIntelligence(input: HealthIntelligenceInput): GoalIntelligence[] {
  const healthByRef = new Map(input.goalHealths.map((h) => [h.ref, h]));
  const velocityFrom = windowStartDay(input.dayKey, VELOCITY_DAYS);

  return input.goals.map((goal) => {
    const linked = input.projects.filter((p) => p.goalRef === goal.ref);
    const linkedIds = new Set(linked.map((p) => p._id));
    const taskIds = new Set(
      input.tasks.filter((t) => t.projectId && linkedIds.has(t.projectId) && !t.parentId).map((t) => t._id),
    );
    const linkedTasks = input.tasks.filter((t) => taskIds.has(t._id));
    const open = linkedTasks.filter((t) => t.status !== "done");

    const activity = buildActivityIndex(input.tasks, input.sessions, undefined, taskIds);
    const completedLast14 = activity.completedDays.filter((d) => d >= velocityFrom).length;
    const daysSinceActivity = activity.lastDay ? daysBetween(activity.lastDay, input.dayKey) : null;
    const health = healthByRef.get(goal.ref);

    return {
      ref: goal.ref,
      title: goal.title,
      health: health?.state ?? "needs_attention",
      progressPct: health?.progressPct ?? goal.progress,
      dueDate: goal.dueDate,
      projectCount: linked.length,
      openTasks: open.length,
      completedLast14,
      lastActivityDay: activity.lastDay,
      daysSinceActivity,
      reasons: health?.reasons ?? [],
      unmeasurable: linked.length === 0 && linkedTasks.length === 0,
    };
  });
}
