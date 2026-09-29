/**
 * useIntelligence — Phase 13 data + computation hook.
 *
 * Composes the EXISTING Phase 10 / 11 / 12 hooks (never recomputes them) and
 * subscribes to the historical read models the intelligence layer needs
 * (execution sessions + events, focus sessions, time blocks, routines, habits,
 * reviews, and the persona's own records), then runs `computeIntelligence`
 * inside ONE memo.
 *
 * Performance rules honored here (§31):
 *   - The caller passes its existing `usePlanning()` / `useSchedule()` /
 *     `useExecution()`, so the planner, scheduler and execution engine are each
 *     computed once per surface.
 *   - Identical Convex subscriptions are deduplicated across surfaces by Convex
 *     itself, and persona-specific queries are `"skip"`-ped unless the active
 *     persona actually uses them.
 *   - The window is BOUNDED (7..90 days) and defaults to 30; nothing walks full
 *     history, and the engine clock only advances every five minutes.
 *   - Pure read path: this hook never mutates user data, never writes to the
 *     backend, and never calls external services. Dismissals are local and
 *     day-scoped (src/lib/intelligence/dismissals.ts).
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { useGoals } from "@/hooks/use-goals";
import { useUserProfile } from "@/hooks/use-user-profile";
import { sessionMinutes } from "@/lib/execution";
import {
  applyInsightStatus,
  computeIntelligence,
  dismissInsight,
  getDismissedInsightSnapshot,
  getUsefulInsightSnapshot,
  markInsightUseful,
  subscribeInsightDismissals,
  subscribeInsightUsefulness,
  windowDays,
  dayKeyOf,
  daysBetween,
  type Insight,
  type PersonaSignals,
  type ProductivityIntelligence,
  type TimeWindow,
} from "@/lib/intelligence";
import { addDaysKey, todayKey } from "@/lib/task-utils";
import type { UsePlanningResult } from "@/hooks/use-planning";
import type { UseScheduleResult } from "@/hooks/use-schedule";
import type { UseExecutionResult } from "@/hooks/use-execution";

/** Default analysis window (days). The Insight Center can widen it to 7..90. */
export const DEFAULT_INTELLIGENCE_WINDOW: TimeWindow = "30d";

/** A contact is "stale" when nothing has been recorded about them for this long. */
export const STALE_CUSTOMER_DAYS = 14;

const EMPTY: never[] = [];

export interface UseIntelligenceResult {
  dayKey: string;
  /** Active analysis window + its day count. */
  window: TimeWindow;
  days: number;
  setWindow: (window: TimeWindow) => void;
  /** Full engine output (memoized). */
  data: ProductivityIntelligence;
  /** Insights with local dismiss/useful status applied, dismissed ones filtered out. */
  insights: Insight[];
  /** Insights marked useful in this session (for the "useful" counter). */
  usefulIds: string[];
  dismiss: (id: string) => void;
  markUseful: (id: string) => void;
  /** True until the core queries have returned at least once. */
  loading: boolean;
}

export function useIntelligence(
  plan: UsePlanningResult,
  schedule: UseScheduleResult,
  execution: UseExecutionResult,
): UseIntelligenceResult {
  const { tasks, projects } = useWorkspace();
  const goals = useGoals();
  const { personaKey } = useUserProfile();

  const dayKey = plan.dayKey;
  const [timeWindow, setTimeWindow] = useState<TimeWindow>(DEFAULT_INTELLIGENCE_WINDOW);
  const days = windowDays(timeWindow);
  const windowStart = addDaysKey(-(days - 1));
  const weekStart = addDaysKey(-6);
  const weekEnd = addDaysKey(6);
  const monthPrefix = dayKey.slice(0, 7);
  const yearPrefix = dayKey.slice(0, 4);

  /* ---------------------------------------------------------------- */
  /* Persona flags (query gating)                                      */
  /* ---------------------------------------------------------------- */
  const isStudent = personaKey === "student";
  const isEmployee = personaKey === "employee";
  const isManager = personaKey === "manager" || personaKey === "team";
  const isFreelancer = personaKey === "freelancer";
  const isBusiness = personaKey === "business_owner";
  const isPersonal = personaKey === "personal";

  /* ---------------------------------------------------------------- */
  /* Shared historical read models                                     */
  /* ---------------------------------------------------------------- */
  const sessions = useQuery(api.execution.sessionsInRange, { from: windowStart, to: dayKey });
  const events = useQuery(api.execution.eventsInRange, { from: windowStart, to: dayKey });
  const focusSessions = useQuery(api.employee.listFocusSessions, {});
  const timeBlocks = useQuery(api.personal.listTimeBlocks, {});
  const routineStats = useQuery(api.routines.getStats, { day: dayKey, monthPrefix, yearPrefix });
  const habitRows = useQuery(api.personal.habitsState, { day: dayKey });
  const reviewRows = useQuery(api.personal.listReviews, {});

  /* Persona-specific records (subscribed only when the persona uses them). */
  const exams = useQuery(api.student.listExams, isStudent ? {} : "skip");
  const assignments = useQuery(api.student.listAssignments, isStudent ? {} : "skip");
  const studySessions = useQuery(api.student.listStudySessions, isStudent ? {} : "skip");
  const meetings = useQuery(api.manager.listMeetings, isEmployee ? {} : "skip");
  const deliverables = useQuery(api.freelancer.listDeliverables, isFreelancer ? {} : "skip");
  const invoices = useQuery(api.freelancer.listInvoices, isFreelancer ? {} : "skip");
  const timeEntries = useQuery(api.freelancer.listTimeEntries, isFreelancer ? {} : "skip");
  const milestones = useQuery(api.manager.listMilestones, isManager ? {} : "skip");
  const initiatives = useQuery(api.business.listInitiatives, isBusiness ? {} : "skip");
  const customers = useQuery(api.business.listCustomers, isBusiness ? {} : "skip");
  const personalGoals = useQuery(api.personal.listGoals, isPersonal ? {} : "skip");
  const lifeAreas = useQuery(api.personal.listLifeAreas, isPersonal ? {} : "skip");

  /* ---------------------------------------------------------------- */
  /* Engine clock — intelligence only needs coarse "now" (§31)         */
  /* ---------------------------------------------------------------- */
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 300_000);
    return () => clearInterval(id);
  }, []);

  /* ---------------------------------------------------------------- */
  /* Persona signals — only observable facts, only when the data exists */
  /* ---------------------------------------------------------------- */
  const personaSignals = useMemo<PersonaSignals | undefined>(() => {
    const signals: PersonaSignals = {};

    if (isStudent) {
      let studyMinutes7d = 0;
      for (const s of studySessions ?? EMPTY) {
        if (s.date >= weekStart && s.date <= dayKey) studyMinutes7d += s.actualMinutes;
      }
      signals.studyMinutes7d = studyMinutes7d;

      const openExams = (exams ?? EMPTY).filter(
        (e) => !e.completed && !e.archived && e.date >= dayKey,
      );
      signals.upcomingExams = openExams.map((e) => ({
        title: e.title,
        date: e.date,
        preparation: e.preparationProgress,
      }));

      const openAssignments = (assignments ?? EMPTY).filter(
        (a) => a.status !== "completed" && !a.archived,
      );
      signals.openAssignments = openAssignments.length;
      signals.overdueAssignments = openAssignments.filter((a) => a.dueDate < dayKey).length;
    }

    if (isEmployee) {
      signals.meetingsThisWeek = (meetings ?? EMPTY).filter(
        (m) => m.status !== "cancelled" && m.date >= dayKey && m.date <= weekEnd,
      ).length;
      let focusToday = 0;
      for (const s of focusSessions ?? EMPTY) {
        if (s.date !== dayKey) continue;
        focusToday += s.completed ? s.actualMinutes : s.plannedMinutes;
      }
      signals.focusPlannedToday = focusToday;
    }

    if (isFreelancer) {
      const openDeliverables = (deliverables ?? EMPTY).filter(
        (d) => d.status !== "delivered" && d.status !== "approved",
      );
      signals.openDeliverables = openDeliverables.length;
      signals.deliverablesDueSoon = openDeliverables
        .filter((d) => d.dueDate <= weekEnd)
        .map((d) => ({ title: d.title, dueDate: d.dueDate, status: d.status }));

      let billableSeconds = 0;
      for (const entry of timeEntries ?? EMPTY) {
        if (!entry.billable) continue;
        if (entry.date < weekStart || entry.date > dayKey) continue;
        billableSeconds += entry.duration;
      }
      signals.billableMinutes7d = Math.round(billableSeconds / 60);

      signals.overdueInvoices = (invoices ?? EMPTY).filter(
        (i) => i.status !== "paid" && i.status !== "cancelled" && i.status !== "draft" && i.dueDate < dayKey,
      ).length;
    }

    if (isManager) {
      signals.atRiskMilestones = (milestones ?? EMPTY)
        .filter((m) => m.status !== "completed" && m.dueDate <= weekEnd && m.progress < 70)
        .map((m) => ({ title: m.title, dueDate: m.dueDate, progress: m.progress }));
      /* Aggregate only — never per-employee analytics (§30). */
      signals.blockedTeamTasks = tasks.filter(
        (t) => t.status !== "done" && t.tags.some((tag) => tag.trim() === "مسدود"),
      ).length;
    }

    if (isBusiness) {
      signals.atRiskInitiatives = (initiatives ?? EMPTY)
        .filter(
          (i) =>
            i.status !== "completed" && !!i.dueDate && i.dueDate <= weekEnd && i.progress < 70,
        )
        .map((i) => ({ title: i.title, dueDate: i.dueDate as string, progress: i.progress }));

      signals.staleCustomers = (customers ?? EMPTY).filter((c) => {
        if (!["lead", "prospect", "active"].includes(c.status)) return false;
        return daysBetween(dayKeyOf(c.updatedAt), dayKey) >= STALE_CUSTOMER_DAYS;
      }).length;
    }

    if (isPersonal && !signals.lifeAreaMinutes) {
      const areaName = new Map((lifeAreas ?? EMPTY).map((a) => [a._id as string, a.name]));
      const goalArea = new Map(
        (personalGoals ?? EMPTY)
          .filter((g) => !!g.lifeAreaId)
          .map((g) => [`personal:${g._id as string}`, areaName.get(g.lifeAreaId as string)]),
      );
      const projectArea = new Map(
        projects
          .map((p) => [p._id as string, p.goalRef ? goalArea.get(p.goalRef) : undefined] as const)
          .filter(([, area]) => !!area),
      );
      const byArea = new Map<string, number>();
      for (const session of sessions ?? EMPTY) {
        if (!session.projectId) continue;
        const area = projectArea.get(session.projectId as string);
        if (!area) continue;
        byArea.set(area, (byArea.get(area) ?? 0) + sessionMinutes(session, clock));
      }
      if (byArea.size > 0) {
        signals.lifeAreaMinutes = [...byArea.entries()].map(([label, minutes]) => ({
          label,
          minutes: Math.round(minutes),
        }));
      }
    }

    return Object.keys(signals).length > 0 ? signals : undefined;
  }, [
    isStudent,
    isEmployee,
    isFreelancer,
    isManager,
    isBusiness,
    isPersonal,
    studySessions,
    exams,
    assignments,
    meetings,
    focusSessions,
    deliverables,
    timeEntries,
    invoices,
    milestones,
    tasks,
    initiatives,
    customers,
    lifeAreas,
    personalGoals,
    projects,
    sessions,
    clock,
    dayKey,
    weekStart,
    weekEnd,
  ]);

  /* ---------------------------------------------------------------- */
  /* Engine — ONE memo over stable inputs                              */
  /* ---------------------------------------------------------------- */
  const routine = useMemo(
    () => ({
      todayPct: routineStats?.dayPct ?? 0,
      monthPct: routineStats?.monthPct ?? 0,
      itemsCount: routineStats?.itemsCount ?? 0,
    }),
    [routineStats],
  );

  const habits = useMemo(() => {
    const rows = habitRows ?? EMPTY;
    let weekTarget = 0;
    let weekDone = 0;
    let bestStreak = 0;
    let doneToday = 0;
    for (const h of rows) {
      weekTarget += h.frequency === "weekly" ? Math.max(1, h.target) : Math.max(1, h.target) * 7;
      weekDone += h.weekDone;
      if (h.streak > bestStreak) bestStreak = h.streak;
      if (h.doneToday) doneToday += 1;
    }
    return { total: rows.length, doneToday, weekDone, weekTarget, bestStreak };
  }, [habitRows]);

  const reviews = useMemo(
    () => (reviewRows ?? EMPTY).map((r) => ({ type: r.type, periodKey: r.periodKey })),
    [reviewRows],
  );

  /**
   * Realistic usable minutes for one day: the Phase 11 availability model
   * (window minus fixed commitments and reserved breaks), so "overload" means
   * the same thing in the dashboard, the planner and the insight center.
   */
  const dailyCapacity = useMemo(() => {
    const today = schedule.result.today;
    if (today.unknown) return 480;
    const usable = today.totalMinutes - today.fixedMinutes - today.reservedMinutes;
    return usable > 0 ? usable : 480;
  }, [schedule.result]);

  const projectHealths = useMemo(
    () =>
      plan.result.projectHealths.map(({ project, health }) => ({
        projectId: project._id,
        state: health.state,
        progressPct: health.progressPct,
        reasons: health.reasons.map((r) => r.label),
      })),
    [plan.result],
  );

  const goalHealths = useMemo(
    () =>
      plan.result.goalHealths.map(({ goal, health }) => ({
        ref: goal.ref,
        state: health.state,
        progressPct: health.progressPct ?? goal.progress,
        reasons: health.reasons.map((r) => r.label),
      })),
    [plan.result],
  );

  const data = useMemo<ProductivityIntelligence>(
    () =>
      computeIntelligence({
        dayKey,
        nowMs: clock,
        persona: personaKey,
        windowDays: days,
        tasks,
        projects,
        goals: (goals ?? EMPTY).map((g) => ({
          ref: g.ref,
          kind: g.kind,
          title: g.title,
          dueDate: g.dueDate,
          progress: g.progress,
          status: g.status,
        })),
        blocks: timeBlocks ?? EMPTY,
        sessions: sessions ?? EMPTY,
        events: events ?? EMPTY,
        focusSessions: focusSessions ?? EMPTY,
        routine,
        habits,
        reviews,
        projectHealths,
        goalHealths,
        execution: {
          snapshot: execution.result.snapshot,
          recommendations: execution.recommendations,
          estimateInsights: execution.result.insights,
        },
        schedule: {
          conflicts: schedule.result.conflicts.length,
          unscheduledTasks: schedule.result.unscheduled.length,
        },
        capacity: { dailyMinutes: dailyCapacity },
        personaSignals,
      }),
    [
      dayKey,
      clock,
      personaKey,
      days,
      tasks,
      projects,
      goals,
      timeBlocks,
      sessions,
      events,
      focusSessions,
      routine,
      habits,
      reviews,
      projectHealths,
      goalHealths,
      execution.result,
      execution.recommendations,
      schedule.result,
      dailyCapacity,
      personaSignals,
    ],
  );

  /* ---------------------------------------------------------------- */
  /* Dismissals + usefulness — local, non-destructive, day-scoped (§34) */
  /* ---------------------------------------------------------------- */
  const dismissed = useSyncExternalStore(
    subscribeInsightDismissals,
    () => getDismissedInsightSnapshot(dayKey),
    () => getDismissedInsightSnapshot(dayKey),
  );
  const useful = useSyncExternalStore(
    subscribeInsightUsefulness,
    () => getUsefulInsightSnapshot(dayKey),
    () => getUsefulInsightSnapshot(dayKey),
  );

  const insights = useMemo(() => {
    const dismissedSet = new Set(dismissed);
    /* `applyInsightStatus` stamps new/dismissed/useful; dismissed are hidden. */
    return applyInsightStatus(data.insights, dayKey).filter((i) => !dismissedSet.has(i.id));
  }, [data.insights, dismissed, dayKey]);

  const dismiss = useCallback((id: string) => dismissInsight(id, dayKey), [dayKey]);
  const markUseful = useCallback((id: string) => markInsightUseful(id, dayKey), [dayKey]);

  const loading =
    sessions === undefined ||
    events === undefined ||
    focusSessions === undefined ||
    timeBlocks === undefined ||
    routineStats === undefined ||
    habitRows === undefined ||
    reviewRows === undefined;

  return {
    dayKey,
    window: timeWindow,
    days,
    setWindow: setTimeWindow,
    data,
    insights,
    usefulIds: useful,
    dismiss,
    markUseful,
    loading,
  };
}

/** The local day key this hook analyses (same convention as the planner). */
export const intelligenceDayKey = todayKey;
