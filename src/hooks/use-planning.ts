/**
 * usePlanning — Phase 10 data + computation hook.
 *
 * Gathers everything the deterministic planning engine needs (tasks,
 * projects, goals, calendar/context events, time blocks, meetings, focus
 * sessions and the persona's deadline entities), runs `computePlanning` inside
 * a memo, and exposes dismissal-filtered recommendations.
 *
 * Performance rules honored here:
 *   - ONE memo over stable inputs → no planning math on unrelated renders.
 *   - Persona-specific queries are skipped (`"skip"`) unless the active
 *     persona actually uses them, so a Student never subscribes to invoices
 *     and a Manager never subscribes to exams.
 *   - Convex deduplicates identical subscriptions across surfaces, so Today,
 *     the dashboard module and the Planning Center share one live query each.
 *
 * Pure read path: this hook NEVER mutates user data. Dismissals are local,
 * non-destructive and day-scoped (see src/lib/planning/dismissals.ts).
 */
import { useMemo, useSyncExternalStore, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace, type TaskDoc } from "@/components/workspace/WorkspaceData";
import { useGoals } from "@/hooks/use-goals";
import { useUserProfile } from "@/hooks/use-user-profile";
import {
  computePlanning,
  dismissRecommendation,
  getDismissedSnapshot,
  subscribeDismissals,
  type PlanningItem,
  type PlanningRecommendation,
  type PlanningResult,
} from "@/lib/planning";
import { todayKey, addDaysKey } from "@/lib/task-utils";
import { toFa } from "@/lib/persian";

/** Stable empty arrays — never let `?? []` create phantom memo deps. */
const EMPTY: never[] = [];

export interface UsePlanningResult {
  /** Local YYYY-MM-DD the plan was generated for. */
  dayKey: string;
  /** Full engine output (memoized) — task-typed for direct UI rendering. */
  result: PlanningResult<TaskDoc>;
  /** Recommendations with this session's dismissals applied. */
  recommendations: PlanningRecommendation[];
  /** Hide a recommendation for today — non-destructive, local only. */
  dismiss: (id: string) => void;
}

export function usePlanning(): UsePlanningResult {
  const { tasks, projects } = useWorkspace();
  const { personaKey } = useUserProfile();
  const goals = useGoals();

  const dayKey = todayKey();
  const weekAgoKey = addDaysKey(-6);

  /* ---------------------------------------------------------------- */
  /* Shared schedule data                                              */
  /* ---------------------------------------------------------------- */
  const todayEvents = useQuery(api.context.eventsOnDay, { day: dayKey });
  const upcomingEvents = useQuery(api.context.upcomingEvents, {
    from: dayKey,
    limit: 10,
  });
  const timeBlocks = useQuery(api.personal.listTimeBlocks, {});

  /* ---------------------------------------------------------------- */
  /* Persona-specific data (subscribed only when relevant)             */
  /* ---------------------------------------------------------------- */
  const isStudent = personaKey === "student";
  const isFreelancer = personaKey === "freelancer";
  const isBusiness = personaKey === "business_owner";
  const isManagerish = personaKey === "manager" || personaKey === "team";
  const isEmployee = personaKey === "employee";

  const exams = useQuery(api.student.listExams, isStudent ? {} : "skip");
  const assignments = useQuery(api.student.listAssignments, isStudent ? {} : "skip");
  const studySessions = useQuery(api.student.listStudySessions, isStudent ? {} : "skip");
  const deliverables = useQuery(
    api.freelancer.listDeliverables,
    isFreelancer ? {} : "skip",
  );
  const invoices = useQuery(api.freelancer.listInvoices, isFreelancer ? {} : "skip");
  const initiatives = useQuery(api.business.listInitiatives, isBusiness ? {} : "skip");
  const milestones = useQuery(api.manager.listMilestones, isManagerish ? {} : "skip");
  const meetings = useQuery(
    api.manager.listMeetings,
    isEmployee || isManagerish ? {} : "skip",
  );
  const focusSessions = useQuery(
    api.employee.listFocusSessions,
    isEmployee ? {} : "skip",
  );

  /* ---------------------------------------------------------------- */
  /* Normalized persona deadline items                                 */
  /* ---------------------------------------------------------------- */
  const personaItems = useMemo<PlanningItem[]>(() => {
    const items: PlanningItem[] = [];
    if (isStudent) {
      for (const e of exams ?? []) {
        if (e.completed || e.archived) continue;
        items.push({
          id: `exam:${e._id}`,
          title: e.title,
          kind: "exam",
          label: "آزمون",
          dueDate: e.date,
          detail: `آمادگی ${toFa(e.preparationProgress)}٪ ثبت شده`,
        });
      }
      for (const a of assignments ?? []) {
        if (a.status === "completed" || a.archived) continue;
        items.push({
          id: `assignment:${a._id}`,
          title: a.title,
          kind: "assignment",
          label: "تکلیف",
          dueDate: a.dueDate,
        });
      }
    } else if (isFreelancer) {
      for (const d of deliverables ?? []) {
        if (d.status === "delivered" || d.status === "approved") continue;
        items.push({
          id: `deliverable:${d._id}`,
          title: d.title,
          kind: "deliverable",
          label: "تحویل",
          dueDate: d.dueDate,
        });
      }
      for (const i of invoices ?? []) {
        if (i.status === "paid" || i.status === "cancelled" || i.status === "draft") continue;
        items.push({
          id: `invoice:${i._id}`,
          title: i.title,
          kind: "invoice",
          label: "صورتحساب",
          dueDate: i.dueDate,
          detail: `${toFa(i.amount)} ${i.currency} — پیگیری طلب`,
        });
      }
    } else if (isBusiness) {
      for (const ini of initiatives ?? []) {
        if (ini.status === "completed" || !ini.dueDate) continue;
        items.push({
          id: `initiative:${ini._id}`,
          title: ini.title,
          kind: "initiative",
          label: "ابتکار",
          dueDate: ini.dueDate,
          detail: `پیشرفت ${toFa(ini.progress)}٪`,
        });
      }
    } else if (isManagerish) {
      for (const m of milestones ?? []) {
        if (m.status === "completed") continue;
        items.push({
          id: `milestone:${m._id}`,
          title: m.title,
          kind: "milestone",
          label: "گام پروژه",
          dueDate: m.dueDate,
          detail: `پیشرفت ${toFa(m.progress)}٪`,
        });
      }
    }
    return items;
  }, [
    isStudent,
    isFreelancer,
    isBusiness,
    isManagerish,
    exams,
    assignments,
    deliverables,
    invoices,
    initiatives,
    milestones,
  ]);

  /* Student: study minutes over the last 7 days (exam preparation signal). */
  const recentStudyMinutes = useMemo(() => {
    if (!isStudent) return undefined;
    let total = 0;
    for (const s of studySessions ?? []) {
      if (s.date >= weekAgoKey && s.date <= dayKey) total += s.actualMinutes;
    }
    return total;
  }, [isStudent, studySessions, weekAgoKey, dayKey]);

  /* ---------------------------------------------------------------- */
  /* Calendar commitments today                                        */
  /* ---------------------------------------------------------------- */
  const meetingsToday = useMemo(() => {
    if (!isEmployee && !isManagerish) return [];
    return (meetings ?? [])
      .filter((m) => m.date === dayKey && m.status !== "cancelled")
      .map((m) => ({ title: m.title, date: m.date, time: m.time }));
  }, [isEmployee, isManagerish, meetings, dayKey]);

  const focusPlannedMinutes = useMemo(() => {
    if (!isEmployee) return undefined;
    let total = 0;
    for (const s of focusSessions ?? []) {
      if (s.date !== dayKey) continue;
      total += s.completed ? s.actualMinutes : s.plannedMinutes;
    }
    return total;
  }, [isEmployee, focusSessions, dayKey]);

  /* ---------------------------------------------------------------- */
  /* Engine — ONE memo over stable inputs                              */
  /* ---------------------------------------------------------------- */
  const goalList = goals ?? EMPTY;
  const result = useMemo<PlanningResult<TaskDoc>>(
    () =>
      computePlanning({
        persona: personaKey,
        dayKey,
        tasks,
        projects,
        goals: goalList,
        todayEvents: todayEvents ?? EMPTY,
        upcomingEvents: upcomingEvents ?? EMPTY,
        timeBlocks: timeBlocks ?? EMPTY,
        meetingsToday,
        focusPlannedMinutes,
        personaItems,
        recentStudyMinutes,
      }),
    [
      personaKey,
      dayKey,
      tasks,
      projects,
      goalList,
      todayEvents,
      upcomingEvents,
      timeBlocks,
      meetingsToday,
      focusPlannedMinutes,
      personaItems,
      recentStudyMinutes,
    ],
  );

  /* ---------------------------------------------------------------- */
  /* Dismissals — local, non-destructive, day-scoped                   */
  /* ---------------------------------------------------------------- */
  const dismissed = useSyncExternalStore(
    subscribeDismissals,
    () => getDismissedSnapshot(dayKey),
    () => getDismissedSnapshot(dayKey),
  );

  const recommendations = useMemo(() => {
    const set = new Set(dismissed);
    return result.recommendations.filter((r) => !set.has(r.id));
  }, [result, dismissed]);

  const dismiss = useCallback(
    (id: string) => dismissRecommendation(id, dayKey),
    [dayKey],
  );

  return { dayKey, result, recommendations, dismiss };
}
