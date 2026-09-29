/**
 * Productivity Intelligence — engine input contract (Phase 13 §1 / §31).
 *
 * The engine is PURE: it receives plain rows the app already subscribes to plus
 * the outputs of the Phase 10/11/12 engines, and returns analyses + insights.
 * It never queries the database, never writes, and never calls an AI provider.
 *
 * This is also the performance boundary (§31): the caller decides the window
 * (default 30 days, max 90) and loads it once; the intelligence layers then
 * aggregate in memory instead of scanning full history per page render.
 */
import type { HealthState, WorkloadState } from "@/lib/planning";
import type {
  ExecutionEventRow,
  ExecutionRecommendation,
  ExecutionSession,
  ExecutionSnapshot,
  EstimateInsight,
} from "@/lib/execution";

/* ------------------------------------------------------------------ */
/* Row shapes (structurally compatible with the Convex documents)      */
/* ------------------------------------------------------------------ */

export interface IntelTask {
  _id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
  dueTime?: string;
  projectId?: string;
  tags: string[];
  parentId?: string;
  estimateMinutes?: number;
  postponeCount?: number;
  completedAt?: number;
  createdAt?: number;
}

export interface IntelProject {
  _id: string;
  name: string;
  deadline?: string;
  status: string;
  goalRef?: string;
  color?: string;
}

export interface IntelGoal {
  ref: string;
  kind: string;
  title: string;
  dueDate: string | null;
  progress: number;
  status: string;
}

export interface IntelBlock {
  _id: string;
  title: string;
  day: string;
  startTime: string;
  endTime: string;
  kind: string;
  status?: string;
  fixed?: boolean;
  taskId?: string;
  projectId?: string;
}

/** Existing focus-session rows (employee.listFocusSessions — user-scoped). */
export interface IntelFocus {
  _id: string;
  title?: string;
  taskId?: string;
  projectId?: string;
  plannedMinutes: number;
  actualMinutes: number;
  date: string;
  completed: boolean;
  type: string;
}

/** Project/goal health already computed by the Phase 10 planner (§9/§10). */
export interface IntelProjectHealth {
  projectId: string;
  state: HealthState;
  progressPct: number | null;
  reasons: string[];
}

export interface IntelGoalHealth {
  ref: string;
  state: HealthState;
  progressPct: number;
  reasons: string[];
}

/**
 * Persona-specific facts the caller can cheaply provide from EXISTING queries.
 * Every field is optional: when absent the related insight is simply not
 * generated (threshold protection — §33 / §27).
 */
export interface PersonaSignals {
  /* Student */
  studyMinutes7d?: number;
  upcomingExams?: Array<{ title: string; date: string; preparation: number }>;
  openAssignments?: number;
  overdueAssignments?: number;
  /* Employee */
  meetingsThisWeek?: number;
  focusPlannedToday?: number;
  /* Freelancer */
  openDeliverables?: number;
  /**
   * Deliverables whose due date is close. `status` is the stored status
   * (pending | in_progress | delivered | revised | approved) — the engine turns
   * it into a Persian label instead of inventing a percentage.
   */
  deliverablesDueSoon?: Array<{ title: string; dueDate: string; status: string }>;
  billableMinutes7d?: number;
  overdueInvoices?: number;
  /* Manager — own team's aggregate status only (never per-employee analytics) */
  atRiskMilestones?: Array<{ title: string; dueDate: string; progress: number }>;
  blockedTeamTasks?: number;
  /* Business owner */
  atRiskInitiatives?: Array<{ title: string; dueDate: string; progress: number }>;
  /** Contacts with no recorded change for `staleDayThreshold` days (§26). */
  staleCustomers?: number;
  /* Personal productivity */
  lifeAreaMinutes?: Array<{ label: string; minutes: number }>;
  /* Any persona */
  personaNotes?: string[];
}

/* ------------------------------------------------------------------ */
/* Engine input                                                        */
/* ------------------------------------------------------------------ */

export interface IntelligenceInput {
  dayKey: string;
  /** Injected clock (ms) so every calculation stays deterministic in tests. */
  nowMs: number;
  persona: string;
  /** Main analysis window in days (default 30, clamped to 7..90). */
  windowDays?: number;
  tasks: IntelTask[];
  projects: IntelProject[];
  goals: IntelGoal[];
  blocks: IntelBlock[];
  /** Execution sessions over the window (include today). */
  sessions: ExecutionSession[];
  events: ExecutionEventRow[];
  focusSessions: IntelFocus[];
  /** Routine completion facts (routines.getStats result). */
  routine: { todayPct: number; monthPct: number; itemsCount: number };
  /** Habit facts (personal.habitsState, aggregated by the caller). */
  habits: { total: number; doneToday: number; weekDone: number; weekTarget: number; bestStreak: number };
  /** Saved reviews (personal.listReviews) — weekly/monthly reflection record. */
  reviews: Array<{ type: string; periodKey: string }>;
  /** Phase 10 planner output — reused, never re-derived (§9/§10). */
  projectHealths: IntelProjectHealth[];
  goalHealths: IntelGoalHealth[];
  /** Phase 12 output — reused for RECOVERY insights + today's reading. */
  execution: {
    snapshot: ExecutionSnapshot;
    recommendations: ExecutionRecommendation[];
    estimateInsights: EstimateInsight[];
  };
  /** Phase 11 signals. */
  schedule: { conflicts: number; unscheduledTasks: number };
  /** Working-time assumptions (from the user's schedule prefs). */
  capacity: { dailyMinutes: number };
  personaSignals?: PersonaSignals;
}

/** Convenience: workload state labels are shared with the planning layer. */
export type { WorkloadState };
