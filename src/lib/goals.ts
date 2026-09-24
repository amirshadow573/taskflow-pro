/**
 * Goal → Project → Task helpers — Phase 09.
 *
 * Pure, client-side utilities shared by the dashboard, project pages, goal
 * cards and the task detail panel. The relationship itself is data: a project
 * stores an optional `goalRef` (`${kind}:${goalId}`), and tasks already belong
 * to a project via `projectId`. Nothing here duplicates a backend system.
 */
import type { NextActionProject, NextActionTask } from "@/lib/next-action";

export interface GoalLite {
  ref: string;
  kind: string;
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  progress: number;
  status: string;
}

/** True when the goal is still open (active / at risk). */
export function isOpenGoal(goal: GoalLite): boolean {
  return goal.status !== "completed";
}

/** Find a goal by its `ref` (fast map lookup for project / task contexts). */
export function findGoal(goals: GoalLite[] | undefined, ref?: string | null): GoalLite | null {
  if (!ref || !goals) return null;
  return goals.find((g) => g.ref === ref) ?? null;
}

export interface ProjectExecution {
  projects: Array<{ project: NextActionProject; tasks: number; done: number; pct: number }>;
  totalTasks: number;
  doneTasks: number;
  /** Execution progress derived from real tasks (0..100, -1 when no tasks). */
  executionPct: number;
}

/** Compute REAL execution progress for a goal from its linked projects. */
export function goalExecution(
  goalRef: string,
  projects: NextActionProject[],
  tasks: NextActionTask[],
): ProjectExecution {
  const linked = projects.filter((p) => p.goalRef === goalRef);
  const ids = new Set(linked.map((p) => p._id));
  const own = tasks.filter((t) => t.projectId && ids.has(t.projectId) && !t.parentId);
  const done = own.filter((t) => t.status === "done").length;
  return {
    projects: linked.map((project) => {
      const pts = own.filter((t) => t.projectId === project._id);
      const d = pts.filter((t) => t.status === "done").length;
      return {
        project,
        tasks: pts.length,
        done: d,
        pct: pts.length ? Math.round((d / pts.length) * 100) : 0,
      };
    }),
    totalTasks: own.length,
    doneTasks: done,
    executionPct: own.length ? Math.round((done / own.length) * 100) : -1,
  };
}

/** The goal serving a task: task → project → goalRef. */
export function goalOfTask(
  task: NextActionTask,
  projects: NextActionProject[],
  goals: GoalLite[] | undefined,
): GoalLite | null {
  if (!task.projectId) return null;
  const project = projects.find((p) => p._id === task.projectId);
  return findGoal(goals, project?.goalRef);
}
