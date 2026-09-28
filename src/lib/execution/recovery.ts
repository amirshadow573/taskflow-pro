/**
 * Recovery engine (Phase 12 §9 / §12 / §29).
 *
 * Turns execution reality + Phase 10 planning signals + Phase 11 scheduling
 * signals into a short, prioritised list of RECOVERY OPTIONS.
 *
 * Hard rules:
 *   - Deterministic + explainable: every recommendation states the observable
 *     data behind it (no psychological claims, no fabrication).
 *   - Non-destructive: a recommendation only OFFERS actions. Applying anything
 *     goes through the existing controlled mutations after explicit
 *     confirmation (§29 / §30).
 *   - Priority is NOT re-derived: recovery order reuses the Phase 10 planner's
 *     attention score (§10) — there is only one priority engine in the product.
 */
import { toFa } from "@/lib/persian";
import { blockedReason, type AttentionBand } from "@/lib/planning";
import type { NextActionProject } from "@/lib/next-action";
import { EXECUTION_REC_META } from "./types";
import type {
  DeviationSignal,
  ExecutionBlockLite,
  ExecutionEventRow,
  ExecutionMetrics,
  ExecutionRecommendation,
  ExecutionRecoveryAction,
  ExecutionRecoveryType,
  ExecutionSession,
  ExecutionTaskLite,
} from "./types";

export const MAX_EXECUTION_RECOMMENDATIONS = 12;
/** Tag the planner treats as blocked (mirrors BLOCKED_TAGS in planning/buckets). */
const BLOCKED_TAG = "مسدود";

export interface RecoveryInput {
  dayKey: string;
  tasks: ExecutionTaskLite[];
  projects: NextActionProject[];
  blocks: ExecutionBlockLite[];
  sessions: ExecutionSession[];
  events: ExecutionEventRow[];
  deviations: DeviationSignal[];
  metrics: ExecutionMetrics;
  /** Phase 10 attention per task (recovery priority — reused, never recomputed). */
  priorities?: Array<{ taskId: string; score: number; attention: AttentionBand }>;
  nextActionTaskId?: string;
  /** Phase 11: open root tasks with nothing scheduled. */
  unscheduledTaskIds?: string[];
  /** Phase 11 conflicts (overlap / double booking / deadline …). */
  conflicts?: Array<{ kind: string; day: string; blockId?: string; detail: string }>;
  /** Phase 11 availability facts for today. */
  availableMinutes?: number | null;
  remainingScheduledMinutes?: number | null;
  /** Optional per-task learning note (from learning.ts) for delay advice. */
  estimateNoteByTask?: Record<string, string>;
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };

function needsAction(actions: ExecutionRecoveryAction[]): ExecutionRecoveryAction[] {
  return actions.length > 0 ? actions : ["dismiss"];
}

export function buildExecutionRecovery(input: RecoveryInput): ExecutionRecommendation[] {
  const recs: ExecutionRecommendation[] = [];
  const taskById = new Map(input.tasks.map((t) => [t._id, t]));
  const blockById = new Map(input.blocks.map((b) => [b._id, b]));
  const projectsById = new Map(input.projects.map((p) => [p._id, p]));
  const scoreOf = new Map((input.priorities ?? []).map((p) => [p.taskId, p.score]));
  const attentionOf = new Map((input.priorities ?? []).map((p) => [p.taskId, p.attention]));

  const push = (rec: ExecutionRecommendation) => {
    if (recs.length < MAX_EXECUTION_RECOMMENDATIONS * 2) recs.push(rec);
  };

  /* ---------------------------------------------------------------- */
  /* 1 — Missed blocks: the clearest recovery case (§9 / §23)          */
  /* ---------------------------------------------------------------- */
  const missed = input.deviations.filter((d) => d.kind === "MISSED_BLOCK").slice(0, 3);
  for (const signal of missed) {
    const block = signal.blockId ? blockById.get(signal.blockId) : undefined;
    const task = block?.taskId ? taskById.get(block.taskId) : undefined;
    const critical =
      !!task && (attentionOf.get(task._id) === "high" || (scoreOf.get(task._id) ?? 0) >= 45);
    push({
      id: `MISSED_BLOCK:${block?._id ?? signal.blockId ?? signal.detail}:${input.dayKey}`,
      type: "MISSED_BLOCK",
      severity: critical ? "critical" : "warning",
      title: block ? `بلوک «${block.title}» از دست رفت` : "یک بلوک اجرا نشد",
      detail: signal.detail,
      taskId: task?._id ?? signal.taskId,
      blockId: block?._id ?? signal.blockId,
      actions: needsAction(["start_now", "reschedule", "keep_unscheduled", "mark_complete"]),
      confidence: "high",
      signals: ["missed_block", "schedule"],
      expiresDay: input.dayKey,
    });
  }

  /* ---------------------------------------------------------------- */
  /* 2 — Overdue recovery: deadline-critical work fell behind          */
  /* ---------------------------------------------------------------- */
  const overdue = input.tasks
    .filter((t) => t.status !== "done" && !!t.dueDate && t.dueDate < input.dayKey)
    .sort(
      (a, b) =>
        (scoreOf.get(b._id) ?? 0) - (scoreOf.get(a._id) ?? 0) ||
        (a.dueDate ?? "").localeCompare(b.dueDate ?? ""),
    )
    .slice(0, 2);
  for (const task of overdue) {
    const attention = attentionOf.get(task._id);
    push({
      id: `OVERDUE_RECOVERY:${task._id}:${input.dayKey}`,
      type: "OVERDUE_RECOVERY",
      severity: attention === "high" || task.priority === "urgent" ? "critical" : "warning",
      title: `«${task.title}» عقب افتاده است`,
      detail: `موعدش ${toFa(task.dueDate ?? "")} بود و هنوز انجام نشده.${
        task.postponeCount ? ` تا حالا ${toFa(task.postponeCount)} بار جابه‌جا شده است.` : ""
      }`,
      taskId: task._id,
      projectId: task.projectId,
      actions: needsAction(["start_now", "reschedule", "dismiss"]),
      confidence: "high",
      signals: ["overdue", "planning_attention"],
      expiresDay: input.dayKey,
    });
  }

  /* ---------------------------------------------------------------- */
  /* 3 — Overrun conflicts: an over-run pushed the next block (§11)     */
  /* ---------------------------------------------------------------- */
  const overruns = input.deviations.filter((d) => d.kind === "OVER_RUN").slice(0, 2);
  for (const signal of overruns) {
    const session = input.sessions.find((s) => s._id === signal.sessionId);
    const sessionBlockId = session?.blockId;
    const sessionDay = session?.day;
    const sessionEnd =
      (sessionBlockId ? blockById.get(sessionBlockId)?.endTime : undefined) ?? "00:00";
    const nextBlock =
      sessionBlockId && sessionDay
        ? input.blocks.find(
            (b) =>
              b.day === sessionDay &&
              b._id !== sessionBlockId &&
              b.status !== "completed" &&
              b.status !== "cancelled" &&
              !b.fixed &&
              b.startTime >= sessionEnd,
          )
        : undefined;
    if (!nextBlock) continue;
    push({
      id: `OVERRUN_CONFLICT:${signal.sessionId ?? signal.detail}:${input.dayKey}`,
      type: "OVERRUN_CONFLICT",
      severity: "warning",
      title: `زمان‌بندی بعدی به‌هم ریخته — «${nextBlock.title}»`,
      detail: `${signal.detail} بلوک بعدی «${nextBlock.title}» (${toFa(
        nextBlock.startTime,
      )}) جابه‌جا شود تا برنامه واقع‌بینانه بماند.`,
      taskId: nextBlock.taskId,
      blockId: nextBlock._id,
      sessionId: signal.sessionId,
      actions: needsAction(["reschedule", "accept_move", "dismiss"]),
      confidence: "medium",
      signals: ["over_run", "schedule_conflict"],
      expiresDay: input.dayKey,
    });
  }

  /* ---------------------------------------------------------------- */
  /* 4 — Scheduling conflicts detected by the Phase 11 engine (§13)     */
  /* ---------------------------------------------------------------- */
  const overlapping = (input.conflicts ?? []).filter(
    (c) => c.kind === "overlap" || c.kind === "double_booking",
  );
  for (const conflict of overlapping.slice(0, 2)) {
    const block = conflict.blockId ? blockById.get(conflict.blockId) : undefined;
    if (!block) continue;
    push({
      id: `RESCHEDULE_REQUIRED:${block._id}:${input.dayKey}`,
      type: "RESCHEDULE_REQUIRED",
      severity: "warning",
      title: `تداخل زمانی: «${block.title}»`,
      detail: conflict.detail,
      blockId: block._id,
      taskId: block.taskId,
      actions: needsAction(["reschedule", "dismiss"]),
      confidence: "high",
      signals: ["schedule_conflict"],
      expiresDay: input.dayKey,
    });
  }

  /* ---------------------------------------------------------------- */
  /* 5 — Real overload: more work than the day can hold (§9 / §14)      */
  /* ---------------------------------------------------------------- */
  const overloaded =
    input.deviations.some((d) => d.kind === "OVERLOAD") ||
    (input.availableMinutes != null &&
      input.remainingScheduledMinutes != null &&
      input.remainingScheduledMinutes > input.availableMinutes);
  if (overloaded) {
    const remaining = input.remainingScheduledMinutes;
    const available = input.availableMinutes;
    push({
      id: `WORKLOAD_OVERLOAD:${input.dayKey}`,
      type: "WORKLOAD_OVERLOAD",
      severity: "critical",
      title: "بار امروز بیش از ظرفیت واقعی است",
      detail:
        remaining != null && available != null
          ? `حدود ${toFa(remaining)} دقیقه کار باقی مانده، اما تنها ${toFa(
              available,
            )} دقیقه ظرفیت واقعی داری. جابه‌جایی کارهای انعطاف‌پذیر می‌تواند روز را نجات دهد.`
          : "زمان اجراشده امروز از ظرفیت واقعی روز بیشتر شده است.",
      actions: needsAction(["accept_move", "dismiss"]),
      confidence: "high",
      signals: ["overload", "availability"],
      expiresDay: input.dayKey,
    });
  }

  /* ---------------------------------------------------------------- */
  /* 6 — Repeated delay: an observable pattern, with an estimate fix    */
  /* ---------------------------------------------------------------- */
  const delays = input.deviations.filter((d) => d.kind === "REPEATED_DELAY").slice(0, 2);
  for (const signal of delays) {
    const task = signal.taskId ? taskById.get(signal.taskId) : undefined;
    const note = task ? input.estimateNoteByTask?.[task._id] : undefined;
    push({
      id: `REPEATED_DELAY:${task?._id ?? signal.blockId ?? signal.detail}:${input.dayKey}`,
      type: "REPEATED_DELAY",
      severity: "warning",
      title: task ? `«${task.title}» مکرراً به تعویق می‌افتد` : "تعویق تکرارشده در برنامه",
      detail: `${signal.detail}${note ? ` ${note}` : ""}`,
      taskId: task?._id ?? signal.taskId,
      blockId: signal.blockId,
      actions: needsAction(
        task ? ["adjust_estimate", "reschedule", "dismiss"] : ["reschedule", "dismiss"],
      ),
      confidence: "high",
      signals: ["repeated_delay", "observable_history"],
      expiresDay: input.dayKey,
    });
  }

  /* ---------------------------------------------------------------- */
  /* 7 — Blocked work: reported by the user or detected by the planner  */
  /* ---------------------------------------------------------------- */
  const blockedFromFeedback = new Set(
    input.sessions.filter((s) => s.feedback === "blocked" || s.feedback === "waiting").map((s) => s.taskId),
  );
  const blockedCandidates = input.tasks
    .filter((t) => t.status !== "done")
    .filter(
      (t) =>
        (t.tags ?? []).some((tag) => tag.toLowerCase().trim() === BLOCKED_TAG) ||
        blockedFromFeedback.has(t._id) ||
        blockedReason(t, projectsById) !== null,
    )
    .slice(0, 2);
  for (const task of blockedCandidates) {
    const reason = blockedReason(task, projectsById);
    const session = input.sessions.find((s) => s.taskId === task._id && s.feedback);
    const alreadyTagged = (task.tags ?? []).some((tag) => tag.toLowerCase().trim() === BLOCKED_TAG);
    push({
      id: `BLOCKED_TASK:${task._id}:${input.dayKey}`,
      type: "BLOCKED_TASK",
      severity: "warning",
      title: `«${task.title}» متوقف مانده`,
      detail: reason ?? "در اجرای امروز به‌عنوان متوقف‌شده ثبت شد — تا رفع مانع پیش نمی‌رود.",
      taskId: task._id,
      projectId: task.projectId,
      sessionId: session?._id,
      actions: needsAction(
        alreadyTagged ? ["reschedule", "dismiss"] : ["mark_blocked", "reschedule", "dismiss"],
      ),
      confidence: "medium",
      signals: reason ? ["planner_blocked"] : ["execution_feedback"],
      expiresDay: input.dayKey,
    });
  }

  /* ---------------------------------------------------------------- */
  /* 8 — Schedule drift: reality moved away from the plan (§7)          */
  /* ---------------------------------------------------------------- */
  const drift = input.deviations.find((d) => d.kind === "SCHEDULE_DRIFT");
  if (drift) {
    push({
      id: `SCHEDULE_DRIFT:${input.dayKey}`,
      type: "SCHEDULE_DRIFT",
      severity: "info",
      title: "امروز از برنامه فاصله گرفته است",
      detail: `${drift.detail} این یک مشاهده است، نه اشتباه — اگر مفید است برنامه را با واقعیت هم‌راستا کن.`,
      actions: needsAction(["reschedule", "dismiss"]),
      confidence: "high",
      signals: ["schedule_drift"],
      expiresDay: input.dayKey,
    });
  }

  /* ---------------------------------------------------------------- */
  /* 9 — Recovered time: finished early, capacity is free (§11)         */
  /* ---------------------------------------------------------------- */
  const underruns = input.deviations.filter((d) => d.kind === "UNDER_RUN");
  if (underruns.length > 0) {
    const saved = underruns.reduce((sum, d) => sum + Math.abs(d.minutes ?? 0), 0);
    const candidate = input.unscheduledTaskIds
      ?.map((id) => taskById.get(id))
      .filter((t): t is ExecutionTaskLite => !!t)
      .sort((a, b) => (scoreOf.get(b._id) ?? 0) - (scoreOf.get(a._id) ?? 0))[0];
    push({
      id: `UNDERRUN:${input.dayKey}`,
      type: "UNDERRUN",
      severity: "info",
      title: `${toFa(saved)} دقیقه زودتر تمام شد`,
      detail: `«${underruns[0].detail}» زمان آزادشده را می‌توانی برای کار مهم بعدی خرج کنی — ولی پر کردن خودکار برنامه انجام نمی‌شود.`,
      taskId: candidate?._id,
      actions: needsAction(candidate ? ["start_now", "dismiss"] : ["dismiss"]),
      confidence: "high",
      signals: ["under_run", "recovered_time"],
      expiresDay: input.dayKey,
    });
  } else if (
    input.availableMinutes != null &&
    input.availableMinutes >= 30 &&
    (input.remainingScheduledMinutes ?? 0) === 0 &&
    (input.unscheduledTaskIds ?? []).length > 0
  ) {
    const candidate = (input.unscheduledTaskIds ?? [])
      .map((id) => taskById.get(id))
      .filter((t): t is ExecutionTaskLite => !!t)
      .sort((a, b) => (scoreOf.get(b._id) ?? 0) - (scoreOf.get(a._id) ?? 0))[0];
    if (candidate) {
      push({
        id: `RECOVERED_TIME:${candidate._id}:${input.dayKey}`,
        type: "RECOVERED_TIME",
        severity: "info",
        title: `${toFa(input.availableMinutes)} دقیقه ظرفیت آزاد داری`,
        detail: `امروز کار زمان‌بندی‌نشده‌ای برای «${candidate.title}» باقی مانده و زمان کافی هست. شروعش اختیاری است.`,
        taskId: candidate._id,
        actions: needsAction(["start_now", "dismiss"]),
        confidence: "medium",
        signals: ["availability", "unscheduled_work"],
        expiresDay: input.dayKey,
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Ordering + cap                                                     */
  /* ---------------------------------------------------------------- */
  const sorted = recs.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      (a.confidence === b.confidence ? 0 : a.confidence === "high" ? -1 : 1) ||
      a.id.localeCompare(b.id),
  );

  const seen = new Set<string>();
  const unique: ExecutionRecommendation[] = [];
  for (const rec of sorted) {
    if (seen.has(rec.id)) continue;
    seen.add(rec.id);
    unique.push(rec);
    if (unique.length >= MAX_EXECUTION_RECOMMENDATIONS) break;
  }
  return unique;
}

/** Persian meta for a recommendation type (shared by every execution surface). */
export function recoveryMeta(type: ExecutionRecoveryType) {
  return EXECUTION_REC_META[type];
}
