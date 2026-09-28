/**
 * useExecution — Phase 12 data + computation hook.
 *
 * Composes the EXISTING planning + scheduling hooks (never recomputes them),
 * subscribes to the execution read models (live session, sessions + events over
 * the learning window) and runs `computeExecution` inside ONE memo. It also
 * exposes the controlled lifecycle mutations — start / pause / resume /
 * complete / abandon / feedback / recovery-audit — so no UI component talks to
 * the backend directly.
 *
 * Performance rules honored here (§31):
 *   - The caller passes its existing `usePlanning()` + `useSchedule()`, so the
 *     planner and scheduler are computed once per surface.
 *   - Convex deduplicates the identical subscriptions across Today / dashboard.
 *   - Only meaningful state changes hit the backend: the live timer ticks
 *     locally (see ActiveSessionCard), and the engine clock only refreshes once
 *     a minute WHILE a session is running — never a mutation per second.
 *
 * Refresh recovery (§35): the live session is read back from the backend, so a
 * browser reload restores exactly what the server says — the UI can never show
 * a timer the backend disagrees with.
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { emitProgressionEvent } from "@/components/progress/ProgressProvider";
import { addDaysKey } from "@/lib/task-utils";
import {
  computeExecution,
  dismissExecutionRecommendation,
  getExecutionDismissedSnapshot,
  subscribeExecutionDismissals,
  type ExecutionEventRow,
  type ExecutionRecommendation,
  type ExecutionResult,
  type ExecutionSession,
} from "@/lib/execution";
import type { UsePlanningResult } from "@/hooks/use-planning";
import type { UseScheduleResult } from "@/hooks/use-schedule";

/** Learning / reporting window (days). Bounded so history stays cheap. */
export const EXECUTION_WINDOW_DAYS = 30;

const EMPTY: never[] = [];

export interface StartSessionArgs {
  taskId?: Id<"tasks">;
  blockId?: Id<"timeBlocks">;
  projectId?: Id<"projects">;
  title?: string;
  kind?: string;
  plannedMinutes?: number;
}

export interface CompleteSessionResult {
  ok: boolean;
  reason?: string;
  actualMinutes?: number;
  varianceMinutes?: number | null;
  xp?: number;
  levelUp?: number | null;
  unlocked?: string[];
}

export interface LogRecoveryArgs {
  action: string;
  label: string;
  sessionId?: Id<"executionSessions">;
  taskId?: Id<"tasks">;
  blockId?: Id<"timeBlocks">;
  projectId?: Id<"projects">;
  meta?: string;
  markTaskBlocked?: boolean;
}

export interface UseExecutionResult {
  dayKey: string;
  /** Full engine output (memoized). */
  result: ExecutionResult;
  /** Recovery recommendations with local dismissals applied. */
  recommendations: ExecutionRecommendation[];
  dismiss: (id: string) => void;
  /** Server-authoritative live session (null when nothing is running). */
  activeSession: ExecutionSession | null;
  /** True until the execution queries have returned at least once. */
  loading: boolean;
  /* Controlled lifecycle — all user-initiated (§5 / §29). */
  start: (args: StartSessionArgs) => Promise<Id<"executionSessions"> | null>;
  pause: (id: Id<"executionSessions">) => Promise<void>;
  resume: (id: Id<"executionSessions">) => Promise<void>;
  complete: (
    id: Id<"executionSessions">,
    opts?: { feedback?: string; note?: string; actualMinutes?: number },
  ) => Promise<CompleteSessionResult>;
  abandon: (
    id: Id<"executionSessions">,
    opts?: { feedback?: string; note?: string },
  ) => Promise<void>;
  submitFeedback: (
    id: Id<"executionSessions">,
    feedback: string,
    note?: string,
  ) => Promise<void>;
  /** Audit-only: records the user's recovery decision (§36). */
  logRecovery: (args: LogRecoveryArgs) => Promise<void>;
}

export function useExecution(
  plan: UsePlanningResult,
  schedule: UseScheduleResult,
): UseExecutionResult {
  const { tasks, projects } = useWorkspace();
  const dayKey = plan.dayKey;
  const windowStart = addDaysKey(-(EXECUTION_WINDOW_DAYS - 1));

  /* ---------------------------------------------------------------- */
  /* Read models (live session + learning window)                      */
  /* ---------------------------------------------------------------- */
  const active = useQuery(api.execution.activeSession, {});
  const sessions = useQuery(api.execution.sessionsInRange, {
    from: windowStart,
    to: dayKey,
  });
  const events = useQuery(api.execution.eventsInRange, {
    from: windowStart,
    to: dayKey,
  });

  const activeSession = (active ?? null) as ExecutionSession | null;
  const sessionRows = (sessions ?? EMPTY) as ExecutionSession[];
  const eventRows = (events ?? EMPTY) as ExecutionEventRow[];

  /* ---------------------------------------------------------------- */
  /* Engine clock — only ticks while real work is running (§31)         */
  /* ---------------------------------------------------------------- */
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!activeSession) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [activeSession]);

  /* ---------------------------------------------------------------- */
  /* Engine — ONE memo over stable inputs                              */
  /* ---------------------------------------------------------------- */
  const result = useMemo<ExecutionResult>(() => {
    const scheduleResult = schedule.result;
    const todayAvailability = scheduleResult.today;
    return computeExecution({
      dayKey,
      persona: plan.result.snapshot.persona,
      tasks,
      projects,
      blocks: scheduleResult.blocks,
      sessions: sessionRows,
      events: eventRows,
      activeSession,
      nowMs,
      priorities: plan.result.priorities.map((p) => ({
        taskId: p.task._id,
        score: p.attention.score,
        attention: p.attention.attention,
      })),
      workloadState: plan.result.workload.state,
      planningEstimatedMinutes: plan.result.workload.estimatedMinutes,
      planningAvailableMinutes: plan.result.workload.availableMinutes,
      nextActionTaskId: plan.result.nextAction?.task._id,
      todayScheduledMinutes: todayAvailability.unknown ? null : todayAvailability.scheduledMinutes,
      todayAvailableMinutes: todayAvailability.unknown ? null : todayAvailability.availableMinutes,
      conflicts: scheduleResult.conflicts.map((c) => ({
        kind: c.kind,
        day: c.day,
        blockId: c.a.id,
        detail: c.detail,
      })),
      unscheduledTaskIds: scheduleResult.unscheduled.map((t) => t._id),
    });
  }, [dayKey, plan.result, schedule.result, tasks, projects, sessionRows, eventRows, activeSession, nowMs]);

  /* ---------------------------------------------------------------- */
  /* Dismissals — local, non-destructive, day-scoped (§29)             */
  /* ---------------------------------------------------------------- */
  const dismissed = useSyncExternalStore(
    subscribeExecutionDismissals,
    () => getExecutionDismissedSnapshot(dayKey),
    () => getExecutionDismissedSnapshot(dayKey),
  );

  const recommendations = useMemo(() => {
    const set = new Set(dismissed);
    return result.recommendations.filter((r) => !set.has(r.id));
  }, [result.recommendations, dismissed]);

  const dismiss = useCallback(
    (id: string) => dismissExecutionRecommendation(id, dayKey),
    [dayKey],
  );

  /* ---------------------------------------------------------------- */
  /* Controlled mutations                                              */
  /* ---------------------------------------------------------------- */
  const startMut = useMutation(api.execution.startSession);
  const pauseMut = useMutation(api.execution.pauseSession);
  const resumeMut = useMutation(api.execution.resumeSession);
  const completeMut = useMutation(api.execution.completeSession);
  const abandonMut = useMutation(api.execution.abandonSession);
  const feedbackMut = useMutation(api.execution.submitFeedback);
  const recoveryMut = useMutation(api.execution.logRecovery);

  const start = useCallback(
    async (args: StartSessionArgs) => {
      try {
        const out = await startMut(args);
        setNowMs(Date.now());
        return out?.sessionId ?? null;
      } catch {
        toast.error("شروع اجرا ثبت نشد — دوباره تلاش کن.");
        return null;
      }
    },
    [startMut],
  );

  const pause = useCallback(
    async (id: Id<"executionSessions">) => {
      try {
        await pauseMut({ id });
        setNowMs(Date.now());
      } catch {
        toast.error("توقف موقت ثبت نشد.");
      }
    },
    [pauseMut],
  );

  const resume = useCallback(
    async (id: Id<"executionSessions">) => {
      try {
        await resumeMut({ id });
        setNowMs(Date.now());
      } catch {
        toast.error("ادامه اجرا ثبت نشد.");
      }
    },
    [resumeMut],
  );

  const complete = useCallback(
    async (
      id: Id<"executionSessions">,
      opts?: { feedback?: string; note?: string; actualMinutes?: number },
    ): Promise<CompleteSessionResult> => {
      try {
        const out = await completeMut({ id, ...opts });
        setNowMs(Date.now());
        if (!out?.ok) {
          if (out?.reason === "already_completed") {
            toast.info("این جلسه قبلاً ثبت شده است.");
          }
          return { ok: false, reason: out?.reason };
        }
        if (out.xp || out.levelUp || (out.unlocked && out.unlocked.length > 0)) {
          emitProgressionEvent({
            levelUp: out.levelUp ?? null,
            unlocked: out.unlocked ?? [],
            xp: out.xp ?? 0,
          });
        }
        toast.success("اجرا ثبت شد ✓", {
          description: `زمان ثبت‌شده: ${out.actualMinutes ?? 0} دقیقه`,
        });
        return {
          ok: true,
          actualMinutes: out.actualMinutes,
          varianceMinutes: out.varianceMinutes,
          xp: out.xp,
          levelUp: out.levelUp,
          unlocked: out.unlocked,
        };
      } catch {
        toast.error("ثبت پایان اجرا ناموفق بود.");
        return { ok: false };
      }
    },
    [completeMut],
  );

  const abandon = useCallback(
    async (id: Id<"executionSessions">, opts?: { feedback?: string; note?: string }) => {
      try {
        await abandonMut({ id, ...opts });
        setNowMs(Date.now());
        toast.success("اجرا رها شد — کار و تاریخچه‌اش دست‌نخورده ماند.");
      } catch {
        toast.error("ثبت رها کردن ناموفق بود.");
      }
    },
    [abandonMut],
  );

  const submitFeedback = useCallback(
    async (id: Id<"executionSessions">, feedback: string, note?: string) => {
      try {
        await feedbackMut({ id, feedback, note });
      } catch {
        toast.error("ثبت بازخورد ناموفق بود.");
      }
    },
    [feedbackMut],
  );

  const logRecovery = useCallback(
    async (args: LogRecoveryArgs) => {
      try {
        await recoveryMut(args);
      } catch {
        // Audit logging must never block the real action the user asked for.
      }
    },
    [recoveryMut],
  );

  return {
    dayKey,
    result,
    recommendations,
    dismiss,
    activeSession,
    loading: active === undefined || sessions === undefined || events === undefined,
    start,
    pause,
    resume,
    complete,
    abandon,
    submitFeedback,
    logRecovery,
  };
}
