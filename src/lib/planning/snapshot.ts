/**
 * Planning snapshot (Phase 10 §18).
 *
 * The single structured summary of "what does today look like" — built from
 * real data only. This becomes the primary input a future AI layer consumes
 * instead of querying raw tables. `generatedAt` records when it was derived;
 * snapshots are computed client-side and memoized, never persisted, so there
 * is no lifecycle/duplication problem by construction.
 */
import type { GoalLite } from "@/lib/goals";
import type { NextActionProject, NextActionTask, ScoredAction } from "@/lib/next-action";
import type {
  HealthResult,
  PlanningItem,
  PlanningRecommendation,
  PlanningSnapshot,
  SnapshotCriticalItem,
  SnapshotRisk,
  TodayBuckets,
  WorkloadAnalysis,
} from "@/lib/planning/types";
import { classifyUrgency, urgencyRank } from "@/lib/planning/urgency";
import { HEALTH_LABELS_FA } from "@/lib/planning/types";

export interface SnapshotInput {
  dayKey: string;
  persona: string;
  workload: WorkloadAnalysis;
  buckets: TodayBuckets;
  tasks: NextActionTask[];
  projects: NextActionProject[];
  goals: GoalLite[];
  /** Resolved primary action (blocked tasks excluded — see pickPrimaryAction). */
  nextAction: ScoredAction | null;
  projectHealths: Array<{ project: NextActionProject; health: HealthResult }>;
  goalHealths: Array<{ goal: GoalLite; health: HealthResult }>;
  recommendations: PlanningRecommendation[];
  personaItems: PlanningItem[];
}

function openRootOf(tasks: NextActionTask[]): NextActionTask[] {
  return tasks.filter(
    (t) => !t.parentId && t.status !== "done" && t.status !== "inbox",
  );
}

const RISK_ORDER: Record<string, number> = {
  at_risk: 0,
  blocked: 1,
  needs_attention: 2,
  healthy: 3,
  completed: 4,
};

function toRisks(
  rows: Array<{ title: string; health: HealthResult; id: string }>,
): SnapshotRisk[] {
  return rows
    .filter((r) => r.health.state !== "healthy" && r.health.state !== "completed")
    .sort(
      (a, b) =>
        (RISK_ORDER[a.health.state] ?? 9) - (RISK_ORDER[b.health.state] ?? 9) ||
        a.title.localeCompare(b.title),
    )
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      title: r.title,
      state: r.health.state,
      reason:
        r.health.reasons.find((x) => x.tone === "bad")?.label ??
        r.health.reasons[0]?.label ??
        HEALTH_LABELS_FA[r.health.state],
    }));
}

/** Build the structured snapshot consumed by the UI and the future AI layer. */
export function buildPlanningSnapshot(input: SnapshotInput): PlanningSnapshot {
  const { dayKey, workload, buckets } = input;
  const openRoot = openRootOf(input.tasks);

  const overdue = openRoot.filter(
    (t) => t.dueDate !== undefined && t.dueDate < dayKey,
  );
  const dueSoon = openRoot.filter(
    (t) => classifyUrgency(t.dueDate, dayKey) === "due_soon",
  );

  /* Critical items — tasks first (most urgent), then persona entities. */
  const criticalTaskItems: SnapshotCriticalItem[] = openRoot
    .filter((t) => {
      const u = classifyUrgency(t.dueDate, dayKey);
      return u === "overdue" || u === "critical";
    })
    .sort(
      (a, b) =>
        urgencyRank(classifyUrgency(a.dueDate, dayKey)) -
          urgencyRank(classifyUrgency(b.dueDate, dayKey)) ||
        (a.dueDate ?? "").localeCompare(b.dueDate ?? "") ||
        a.title.localeCompare(b.title),
    )
    .slice(0, 5)
    .map((t) => ({
      id: t._id,
      title: t.title,
      kind: "task" as const,
      dueDate: t.dueDate,
      urgency: classifyUrgency(t.dueDate, dayKey),
    }));

  const criticalPersonaItems: SnapshotCriticalItem[] = input.personaItems
    .map((item) => ({ item, urgency: classifyUrgency(item.dueDate, dayKey) }))
    .filter((x) => x.urgency !== "no_deadline" && x.urgency !== "flexible" && x.urgency !== "upcoming")
    .sort((a, b) => urgencyRank(a.urgency) - urgencyRank(b.urgency))
    .slice(0, 3)
    .map(({ item, urgency }) => ({
      id: item.id,
      title: item.title,
      kind: item.kind,
      dueDate: item.dueDate,
      urgency,
    }));

  const nextAction = input.nextAction;

  const projectRisks = toRisks(
    input.projectHealths.map(({ project, health }) => ({
      id: project._id,
      title: project.name,
      health,
    })),
  );
  const goalRisks = toRisks(
    input.goalHealths.map(({ goal, health }) => ({
      id: goal.ref,
      title: goal.title,
      health,
    })),
  );

  return {
    date: dayKey,
    persona: input.persona,
    workload,
    availableTime: workload.availableMinutes,
    occupiedTime: workload.occupiedMinutes,
    overdueCount: overdue.length,
    dueSoonCount: dueSoon.length,
    criticalItems: [...criticalTaskItems, ...criticalPersonaItems],
    nextAction: nextAction
      ? {
          taskId: nextAction.task._id,
          title: nextAction.task.title,
          reason: nextAction.reason,
          score: nextAction.score,
        }
      : null,
    projectRisks,
    goalRisks,
    recommendations: input.recommendations,
    blockers: buckets.blocked.map((b) => ({
      id: b.task._id,
      title: b.task.title,
      reason: b.reason,
    })),
    generatedAt: Date.now(),
  };
}
