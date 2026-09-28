/**
 * ScheduleRecommendationService (Phase 11 §29).
 *
 * Deterministic, explainable, dismissible, non-destructive. Same id
 * contract as Phase 10 (`type:scope:entity:dayKey`) so re-rendering can
 * never produce duplicates, and dismissal is local + day-scoped
 * (see ./dismissals.ts).
 *
 * Bulk suggestions carry a `plan` — the UI MUST preview it and only apply
 * after explicit confirmation (§30). Nothing here writes to the backend.
 */
import type { SchedulePrefs } from "@/lib/preferences";
import type { AttentionBand } from "@/lib/planning";
import type {
  DayAvailability,
  ScheduleBlock,
  ScheduleConflict,
  ScheduleRecommendation,
  ScheduleRecommendationType,
  WeekDaySummary,
} from "@/lib/scheduling/types";
import { proposeMove, suggestSlots } from "@/lib/scheduling/placement";
import { minutesOf, nowMinutes as clockMinutes } from "@/lib/scheduling/time";

export interface ScheduleTask {
  _id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
  dueTime?: string;
  projectId?: string;
  estimateMinutes?: number;
  parentId?: string;
  tags: string[];
}

export interface ScheduleRecContext {
  dayKey: string;
  prefs: SchedulePrefs;
  persona: string;
  /** Availabilities for today…+N, today first. */
  days: DayAvailability[];
  /** Week load summaries (isToday set on the primary day). */
  week: WeekDaySummary[];
  /** All time blocks in the horizon. */
  blocks: ScheduleBlock[];
  tasks: ScheduleTask[];
  conflicts: ScheduleConflict[];
  /** Phase 10 planning priorities — scheduling consumes planning (§25). */
  priorities: Array<{ taskId: string; score: number; attention: AttentionBand }>;
  nowMinutes?: number;
}

const TYPE_ORDER: Record<ScheduleRecommendationType, number> = {
  OVERLOAD_WARNING: 0,
  DEADLINE_CONFLICT: 1,
  MISSED_BLOCK: 2,
  RESCHEDULE_TASK: 3,
  INSUFFICIENT_TIME: 4,
  UNSCHEDULED_PRIORITY: 5,
  SCHEDULE_TASK: 6,
  MOVE_FLEXIBLE_BLOCK: 7,
  BREAK_RECOMMENDATION: 8,
  EMPTY_CAPACITY: 9,
};

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 } as const;

export const MAX_SCHEDULE_RECOMMENDATIONS = 16;

const WORK_STATUSES = new Set(["planned", "completed"]);

function fmtRange(start: string, end: string): string {
  return `${start}–${end}`;
}

function isWorkBlock(b: ScheduleBlock): boolean {
  return WORK_STATUSES.has(b.status) && b.kind !== "break";
}

export function scheduleRecSorter(a: ScheduleRecommendation, b: ScheduleRecommendation) {
  return (
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
    TYPE_ORDER[a.type] - TYPE_ORDER[b.type] ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Build the schedule recommendation list. Pure — no storage writes, no
 * backend calls; dismissal and application happen in the UI layer.
 */
export function buildScheduleRecommendations(
  ctx: ScheduleRecContext,
): ScheduleRecommendation[] {
  const { dayKey, prefs, days, week, blocks, tasks, conflicts } = ctx;
  const now = ctx.nowMinutes ?? clockMinutes();
  const out: ScheduleRecommendation[] = [];
  const seen = new Set<string>();
  const add = (rec: Omit<ScheduleRecommendation, "dayKey">) => {
    if (seen.has(rec.id) || out.length >= MAX_SCHEDULE_RECOMMENDATIONS) return;
    seen.add(rec.id);
    out.push({ ...rec, dayKey });
  };

  const today = days[0];
  const todaySummary = week.find((w) => w.day === dayKey);
  const horizon = new Set(days.map((d) => d.day));

  const openRoot = tasks.filter(
    (t) => !t.parentId && t.status !== "done" && t.status !== "inbox",
  );
  const scheduledTaskIds = new Set(
    blocks.filter((b) => isWorkBlock(b) && b.taskId && horizon.has(b.day)).map((b) => b.taskId!),
  );
  const unscheduled = openRoot.filter((t) => !scheduledTaskIds.has(t._id));

  const scoreOf = new Map(ctx.priorities.map((p) => [p.taskId, p]));
  const rankUnscheduled = (list: ScheduleTask[]) =>
    [...list].sort(
      (a, b) =>
        (scoreOf.get(b._id)?.score ?? 0) - (scoreOf.get(a._id)?.score ?? 0) ||
        (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"),
    );

  /* ---------------------------------------------------------------- */
  /* 1 — MISSED_BLOCK: planned blocks whose time has passed            */
  /* ---------------------------------------------------------------- */
  if (today) {
    const missed = blocks
      .filter((b) => {
        if (b.day !== dayKey || b.status !== "planned" || !isWorkBlock(b)) return false;
        const end = minutesOf(b.endTime);
        if (end === null || end >= now) return false;
        const task = b.taskId ? tasks.find((t) => t._id === b.taskId) : undefined;
        return !task || task.status !== "done";
      })
      .sort((a, b) => (a.endTime ?? "").localeCompare(b.endTime ?? ""));
    for (const b of missed.slice(0, 2)) {
      add({
        id: `missed_block:${b._id}:${dayKey}`,
        type: "MISSED_BLOCK",
        severity: "warning",
        title: `«${b.title}» از دست رفت`,
        detail: `ساعت ${b.endTime} تمام شد و انجام نشد — جابه‌جایش کن، لغوش کن یا بگذار همان‌طور بماند؛ وضعیت کار دست‌نخورده می‌ماند.`,
        targetId: b._id,
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* 2 — OVERLOAD_WARNING: planned work exceeds real capacity         */
  /* ---------------------------------------------------------------- */
  for (const w of week.filter((w) => w.load === "overloaded").slice(0, 2)) {
    add({
      id: `overload:${w.day}:${dayKey}`,
      type: "OVERLOAD_WARNING",
      severity: "critical",
      title: `${w.day === dayKey ? "امروز" : w.day} بیش از ظرفیت برنامه‌ریزی شده`,
      detail: `${w.plannedMinutes} دقیقه کار در برابر ${w.availability.availableMinutes ?? 0} دقیقه فرصت خالی. یک یا دو بلوک انعطاف‌پذیر را به روز سبک‌تر منتقل کن — تصمیم با توست.`,
      targetId: w.day,
    });
  }

  /* ---------------------------------------------------------------- */
  /* 3 — MOVE_FLEXIBLE_BLOCK with a previewable plan (§30)             */
  /* ---------------------------------------------------------------- */
  for (const w of week.filter((w) => w.load === "overloaded").slice(0, 2)) {
    const sourceDay = days.find((d) => d.day === w.day);
    if (!sourceDay) continue;
    const candidates = blocks
      .filter(
        (b) =>
          b.day === w.day &&
          !b.fixed &&
          isWorkBlock(b) &&
          b.status === "planned",
      )
      .sort((a, b) => {
        const order: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
        return (order[a.priority ?? "medium"] ?? 2) - (order[b.priority ?? "medium"] ?? 2);
      });
    const otherDays = days.filter((d) => {
      const summary = week.find((x) => x.day === d.day);
      return (
        d.day !== w.day &&
        summary !== undefined &&
        (summary.load === "light" || summary.load === "balanced")
      );
    });
    for (const b of candidates.slice(0, 2)) {
      const move = proposeMove(b, sourceDay, otherDays, prefs);
      if (!move) continue;
      add({
        id: `move_flexible:${b._id}:${move.to.day}:${dayKey}`,
        type: "MOVE_FLEXIBLE_BLOCK",
        severity: "warning",
        title: `«${b.title}» را به ${move.to.day} منتقل کن`,
        detail: `${w.day} بیش از ظرفیت است و این بلوک انعطاف‌پذیر است؛ ${move.to.day} ساعت ${fmtRange(move.to.start, move.to.end)} خالی است. قبل از اعمال، پیش‌نمایش را ببین.`,
        targetId: b._id,
        proposedSlot: { day: move.to.day, start: move.to.start, end: move.to.end },
        plan: [move],
      });
      break; // one concrete move proposal per overloaded day
    }
  }

  /* ---------------------------------------------------------------- */
  /* 4 — conflicts: deadline conflicts + reschedule proposals          */
  /* ---------------------------------------------------------------- */
  for (const c of conflicts.filter((c) => c.kind === "deadline_conflict").slice(0, 2)) {
    add({
      id: `schedule_${c.id}`,
      type: "DEADLINE_CONFLICT",
      severity: "critical",
      title: `برنامه بعد از موعد است`,
      detail: c.detail,
      targetId: c.a.id,
    });
  }

  for (const c of conflicts
    .filter((c) => c.kind === "overlap" || c.kind === "double_booking")
    .slice(0, 2)) {
    const block = c.a.id ? blocks.find((b) => b._id === c.a.id) : undefined;
    if (!block || block.fixed) continue;
    const dayAvail = days.find((d) => d.day === c.day);
    if (!dayAvail) continue;
    const alternatives = suggestSlots(
      {
        target: {
          taskId: block.taskId,
          title: block.title,
          minutes: (minutesOf(block.endTime) ?? 0) - (minutesOf(block.startTime) ?? 0),
          priority: block.priority,
        },
        days: days.filter((d) => d.day !== block.day || d.gaps.length > 0),
        prefs,
        nowMinutes: now,
      },
    );
    const alt = alternatives.slots[0];
    add({
      id: `reschedule:${block._id}:${dayKey}`,
      type: "RESCHEDULE_TASK",
      severity: "warning",
      title: `«${block.title}» تداخل دارد`,
      detail: `${c.detail}${alt ? ` جایگزین پیشنهادی: ${alt.day} ${fmtRange(alt.start, alt.end)}.` : " جایگزین خالی پیدا نشد — یکی از دو بلوک را دستی جابه‌جا کن."}`,
      targetId: block._id,
      ...(alt ? { proposedSlot: { day: alt.day, start: alt.start, end: alt.end } } : {}),
    });
  }

  /* ---------------------------------------------------------------- */
  /* 5 — unscheduled important work → schedule / insufficient / priority */
  /* ---------------------------------------------------------------- */
  const candidates = rankUnscheduled(unscheduled)
    .filter((t) => {
      const s = scoreOf.get(t._id);
      const dueSoon =
        t.dueDate !== undefined && t.dueDate <= days[Math.min(2, days.length - 1)]?.day;
      return s?.attention === "high" || dueSoon;
    })
    .slice(0, 4);

  let scheduledRecs = 0;
  let insufficient = 0;
  let priorityRecs = 0;

  for (const t of candidates) {
    const minutes = t.estimateMinutes ?? 0;
    const attention = scoreOf.get(t._id);

    if (minutes <= 0) {
      if (priorityRecs < 1 && (attention?.attention === "high" || (t.dueDate !== undefined && t.dueDate <= days[1]?.day))) {
        priorityRecs += 1;
        add({
          id: `unscheduled_priority:${t._id}:${dayKey}`,
          type: "UNSCHEDULED_PRIORITY",
          severity: "warning",
          title: `«${t.title}» هنوز وقت ندارد`,
          detail: t.dueDate
            ? `مهم است و ${t.dueDate} موعد دارد، اما مدت‌اش مشخص نیست — بعد از انتخاب مدت، جا پیشنهاد می‌دهم.`
            : `مهم است اما مدت‌اش مشخص نیست — یک تخمین انتخاب کن تا جا پیشنهاد بدهم.`,
          targetId: t._id,
        });
      }
      continue;
    }

    const placement = suggestSlots(
      {
        target: {
          taskId: t._id,
          title: t.title,
          minutes,
          dueDate: t.dueDate,
          priority: t.priority,
          projectId: t.projectId,
        },
        days,
        prefs,
        persona: ctx.persona,
        nowMinutes: now,
      },
    );

    const slot = placement.slots[0];
    if (slot && scheduledRecs < 2) {
      scheduledRecs += 1;
      add({
        id: `schedule_task:${t._id}:${slot.day}:${slot.start}:${dayKey}`,
        type: "SCHEDULE_TASK",
        severity: "info",
        title: `برای «${t.title}» وقت پیشنهادی`,
        detail: `${fmtRange(slot.start, slot.end)} در ${slot.day} — ${slot.reason}. با تأیید تو ساخته می‌شود.`,
        targetId: t._id,
        proposedSlot: { day: slot.day, start: slot.start, end: slot.end },
      });
    } else if (!slot && insufficient < 1) {
      insufficient += 1;
      add({
        id: `insufficient_time:${t._id}:${dayKey}`,
        type: "INSUFFICIENT_TIME",
        severity: "warning",
        title: `برای «${t.title}» جا نمانده`,
        detail: `${placement.notes.join(" ")}${t.dueDate ? ` موعد: ${t.dueDate}.` : ""}`,
        targetId: t._id,
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* 6 — BREAK_RECOMMENDATION: work with zero rest                    */
  /* ---------------------------------------------------------------- */
  if (today && todaySummary) {
    const workToday = blocks.filter((b) => b.day === dayKey && isWorkBlock(b) && b.status === "planned");
    const breaksToday = blocks.filter(
      (b) => b.day === dayKey && b.kind === "break" && b.status === "planned",
    );
    const workMinutes = today.scheduledMinutes;
    if (workToday.length >= 2 && breaksToday.length === 0 && workMinutes >= prefs.maxFocusMinutes) {
      add({
        id: `break:${dayKey}`,
        type: "BREAK_RECOMMENDATION",
        severity: "info",
        title: "بین کارها استراحت بگذار",
        detail: `${workToday.length} بلوک کاری بدون هیچ استراحتی پشت‌سرِهم برنامه‌ریزی شده — ${prefs.breakMinutes} دقیقه فاصله، برنامه را واقع‌بینانه نگه می‌دارد.`,
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* 7 — EMPTY_CAPACITY: a genuinely free day with work waiting        */
  /* ---------------------------------------------------------------- */
  if (today && todaySummary && unscheduled.length > 0) {
    const free = today.availableMinutes;
    const planned = todaySummary.plannedMinutes;
    if (free >= 180 && planned === 0) {
      add({
        id: `empty_capacity:${dayKey}`,
        type: "EMPTY_CAPACITY",
        severity: "info",
        title: "امروز ظرفیت خالی زیادی داری",
        detail: `حدود ${Math.round(free / 60)} ساعت خالی است و ${unscheduled.length} کار بدون برنامه داری — یکی را انتخاب و زمان‌بندی کن.`,
        targetId: unscheduled[0]._id,
      });
    }
  }

  return out.sort(scheduleRecSorter);
}
