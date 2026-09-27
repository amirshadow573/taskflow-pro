/**
 * PlanningEngine facade (Phase 10 §3).
 *
 * One pure function — `computePlanning(input)` — runs the whole
 * deterministic planning layer over already-loaded application data:
 *
 *   PriorityService        → planningPriority (urgency.ts)
 *   UrgencyService         → classifyUrgency  (urgency.ts)
 *   DeadlineService        → deadline aggregation inside recommendations
 *   WorkloadService        → analyzeWorkload  (workload.ts)
 *   OverloadService        → detectOverload   (workload.ts)
 *   ProjectHealthService   → projectHealth    (health.ts)
 *   GoalAlignmentService   → goalHealth + goalExecution
 *   ScheduleService        → occupied/available time (workload.ts)
 *   DependencyService      → blockedReason    (buckets.ts)
 *   NextActionService      → rankActions      (next-action.ts, Phase 09)
 *   PlanningRecommendation → buildRecommendations (recommendations.ts)
 *   PlanningSnapshot       → buildPlanningSnapshot (snapshot.ts)
 *
 * PURE: no side effects, no storage writes, no mutations of user data.
 * Consumers memoize the call (see src/hooks/use-planning.ts), so the
 * dashboard never recomputes planning on every render.
 */
import type { GoalLite } from "@/lib/goals";
import type { NextActionProject, NextActionTask, ScoredAction } from "@/lib/next-action";
import { rankActions } from "@/lib/next-action";
import type { PersonaKey } from "@/lib/personas";
import { todayBuckets } from "@/lib/planning/buckets";
import { goalHealth, projectHealth } from "@/lib/planning/health";
import { buildRecommendations } from "@/lib/planning/recommendations";
import { buildPlanningSnapshot } from "@/lib/planning/snapshot";
import type {
  OverloadSignal,
  PlanningEvent,
  PlanningItem,
  PlanningMeeting,
  PlanningRecommendation,
  PlanningSnapshot,
  PlanningTimeBlock,
  TodayBuckets,
  WorkloadAnalysis,
} from "@/lib/planning/types";
import { planningPriority } from "@/lib/planning/urgency";
import { analyzeWorkload, detectOverload } from "@/lib/planning/workload";

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

export interface PlanningInput<T extends NextActionTask = NextActionTask> {
  persona: PersonaKey;
  /** Local YYYY-MM-DD the plan is generated for. */
  dayKey: string;
  /** ALL tasks (root + subtasks). */
  tasks: T[];
  projects: NextActionProject[];
  /** Normalized goals (useGoals → GoalView ≡ GoalLite). */
  goals: GoalLite[];
  /** Context events happening today (classes / exams / meetings). */
  todayEvents: PlanningEvent[];
  /** Events over the next days — used only to detect "has a schedule". */
  upcomingEvents: PlanningEvent[];
  /** ALL time blocks (filtered by day inside the engine). */
  timeBlocks: PlanningTimeBlock[];
  /** Persona meetings today (employee / manager). */
  meetingsToday?: PlanningMeeting[];
  /** Planned focus-session minutes today (employee). */
  focusPlannedMinutes?: number;
  /** Normalized persona deadline entities (exam / deliverable / milestone…). */
  personaItems: PlanningItem[];
  /** Student study minutes over the last 7 days (undefined = unknown). */
  recentStudyMinutes?: number;
  /** Minutes since midnight; defaults to the real clock. */
  nowMinutes?: number;
}

/* ------------------------------------------------------------------ */
/* Output                                                              */
/* ------------------------------------------------------------------ */

export interface TaskPriorityView<T extends NextActionTask = NextActionTask> {
  task: T;
  attention: ReturnType<typeof planningPriority>;
}

export interface PlanningResult<T extends NextActionTask = NextActionTask> {
  snapshot: PlanningSnapshot;
  buckets: TodayBuckets<T>;
  workload: WorkloadAnalysis;
  overloadSignals: OverloadSignal[];
  projectHealths: Array<{ project: NextActionProject; health: ReturnType<typeof projectHealth> }>;
  goalHealths: Array<{ goal: GoalLite; health: ReturnType<typeof goalHealth> }>;
  /** Phase 09 ranking — full ordered list (hero first). */
  ranked: ScoredAction[];
  nextAction: ScoredAction | null;
  /** System planning priority per open root task — user priority untouched. */
  priorities: TaskPriorityView<T>[];
  recommendations: PlanningRecommendation[];
}

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

/**
 * The primary action must never be work the user cannot progress: prefer the
 * highest-ranked UNBLOCKED task, falling back to the top rank when everything
 * is blocked (the blocker itself is then surfaced as a BLOCKED_TASK rec).
 */
export function pickPrimaryAction(
  ranked: ScoredAction[],
  blockedIds: ReadonlySet<string>,
): ScoredAction | null {
  if (ranked.length === 0) return null;
  return ranked.find((a) => !blockedIds.has(a.task._id)) ?? ranked[0];
}

export function computePlanning<T extends NextActionTask>(
  input: PlanningInput<T>,
): PlanningResult<T> {
  const { dayKey, persona, tasks, projects, goals } = input;
  const now =
    input.nowMinutes ?? new Date().getHours() * 60 + new Date().getMinutes();

  const openRoot = tasks.filter(
    (t) => !t.parentId && t.status !== "done" && t.status !== "inbox",
  ) as T[];
  const overdue = openRoot.filter(
    (t) => t.dueDate !== undefined && t.dueDate < dayKey,
  );

  /* Schedule / workload ------------------------------------------------ */
  const hasScheduleData =
    input.timeBlocks.length > 0 ||
    input.todayEvents.length > 0 ||
    input.upcomingEvents.length > 0 ||
    (input.meetingsToday?.length ?? 0) > 0;

  const { analysis: workload } = analyzeWorkload({
    dayKey,
    openToday: openRoot.filter((t) => t.dueDate !== undefined && t.dueDate <= dayKey),
    overdueCount: overdue.length,
    timeBlocks: input.timeBlocks,
    todayEvents: input.todayEvents,
    hasScheduleData,
    meetingsToday: input.meetingsToday,
    focusPlannedMinutes: input.focusPlannedMinutes,
  });
  const overloadSignals = detectOverload({
    dayKey,
    openToday: openRoot.filter(
      (t) => t.dueDate !== undefined && t.dueDate >= dayKey && t.dueDate <= dayKey,
    ),
    overdue,
    projects,
    tasks,
    estimatedMinutes: workload.estimatedMinutes,
    occupiedMinutes: workload.occupiedMinutes,
    capacityMinutes: workload.capacityMinutes,
  });

  /* Buckets ------------------------------------------------------------ */
  const buckets = todayBuckets<T>({ dayKey, tasks, projects });
  const blockedIds = new Set(buckets.blocked.map((b) => b.task._id));

  /* Next action (Phase 09 ranking, reused — never duplicated) ---------- */
  const ranked = rankActions(tasks, projects, persona, dayKey);
  const nextAction = pickPrimaryAction(ranked, blockedIds);

  /* Health ------------------------------------------------------------- */
  const tasksByProject = new Map<string, NextActionTask[]>();
  for (const t of tasks) {
    if (!t.projectId || t.parentId) continue;
    const list = tasksByProject.get(t.projectId);
    if (list) list.push(t);
    else tasksByProject.set(t.projectId, [t]);
  }
  const projectHealths = projects.map((project) => ({
    project,
    health: projectHealth(project, tasksByProject.get(project._id) ?? [], dayKey),
  }));

  const goalHealths = goals.map((goal) => ({
    goal,
    health: goalHealth({ goal, projects, tasks, dayKey }),
  }));

  /* System planning priority (per open root task) ---------------------- */
  const goalsByRef = new Map(goals.map((g) => [g.ref, g]));
  const projectsById = new Map(projects.map((p) => [p._id, p]));
  const todayLoad =
    buckets.mustDo.length + buckets.shouldDo.length + buckets.couldDo.length;

  const priorities: TaskPriorityView<T>[] = openRoot.map((task) => {
    const project = task.projectId ? projectsById.get(task.projectId) : undefined;
    return {
      task,
      attention: planningPriority({
        task,
        persona,
        dayKey,
        project,
        goal: project?.goalRef ? goalsByRef.get(project.goalRef) ?? null : null,
        blocked: blockedIds.has(task._id),
        todayLoad,
        nowMinutes: now,
      }),
    };
  });
  priorities.sort(
    (a, b) => b.attention.score - a.attention.score || a.task.title.localeCompare(b.task.title),
  );

  /* Recommendations ----------------------------------------------------- */
  const recommendations = buildRecommendations({
    dayKey,
    persona,
    tasks,
    projects,
    goals,
    buckets,
    workload,
    overloadSignals,
    nextAction,
    projectHealths,
    goalHealths,
    personaItems: input.personaItems,
    nowMinutes: now,
    recentStudyMinutes: input.recentStudyMinutes,
    availableMinutes: workload.availableMinutes,
  });

  /* Snapshot ------------------------------------------------------------ */
  const snapshot = buildPlanningSnapshot({
    dayKey,
    persona,
    workload,
    buckets,
    tasks,
    projects,
    goals,
    nextAction,
    projectHealths,
    goalHealths,
    recommendations,
    personaItems: input.personaItems,
  });

  return {
    snapshot,
    buckets,
    workload,
    overloadSignals,
    projectHealths,
    goalHealths,
    ranked,
    nextAction,
    priorities,
    recommendations,
  };
}

/* ------------------------------------------------------------------ */
/* Public surface                                                      */
/* ------------------------------------------------------------------ */

export * from "@/lib/planning/types";
export {
  classifyUrgency,
  dayDelta,
  isDeadlineUrgent,
  planningPriority,
  urgencyRank,
  DEFAULT_URGENCY_CONFIG,
} from "@/lib/planning/urgency";
export { blockedReason, todayBuckets } from "@/lib/planning/buckets";
export { analyzeWorkload, detectOverload, DEFAULT_DAY_CAPACITY_MINUTES } from "@/lib/planning/workload";
export { goalHealth, projectHealth } from "@/lib/planning/health";
export { buildRecommendations, MAX_RECOMMENDATIONS } from "@/lib/planning/recommendations";
export { buildPlanningSnapshot } from "@/lib/planning/snapshot";
export {
  dismissRecommendation,
  filterDismissed,
  getDismissedSnapshot,
  restoreRecommendation,
  subscribeDismissals,
} from "@/lib/planning/dismissals";

/** Re-exported for consumers that only import the facade. */
export type { ScoredAction } from "@/lib/next-action";
export { classifyUrgency as urgencyOf } from "@/lib/planning/urgency";

/** Unused-import guards — these types are part of the facade's contract. */
export type { PlanningItem as PersonaDeadlineItem } from "@/lib/planning/types";
