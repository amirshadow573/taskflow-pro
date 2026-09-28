/**
 * Schedule Recommendations — Phase 11 §29 + §23 (missed-block options).
 *
 * Renders the deterministic recommendation list produced by the scheduling
 * engine. Same contract as the Phase 10 planning list:
 *   - every row explains WHY it exists (Persian detail from the engine),
 *   - every row is dismissible (local, day-scoped, non-destructive),
 *   - actions are explicit confirmations — nothing mutates on render,
 *   - bulk suggestions open a PREVIEW first (§30), never an instant apply.
 *
 * No XP is granted by any of these actions (§32): completing a task goes
 * through the existing toggleDone path, and scheduling itself never scores.
 */
import {
  AlarmClock,
  CalendarClock,
  CalendarPlus,
  Coffee,
  Gauge,
  Hourglass,
  Inbox,
  Lightbulb,
  ListChecks,
  MoveHorizontal,
  RefreshCw,
  X,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router";
import { EmptyHint, Panel, Pill } from "@/components/progress/progress-ui";
import { useWorkspace } from "@/components/workspace/WorkspaceData";
import {
  SCHEDULE_REC_META,
  type ScheduleRecommendation,
  type ScheduleRecommendationType,
} from "@/lib/scheduling";
import type { UseScheduleResult } from "@/hooks/use-schedule";
import { cn } from "@/lib/utils";
import type { ScheduleDialogActions } from "./use-schedule-dialogs";
import { SEVERITY_TILE, SEVERITY_TONE } from "./schedule-ui";

const TYPE_ICON: Record<ScheduleRecommendationType, LucideIcon> = {
  SCHEDULE_TASK: CalendarPlus,
  RESCHEDULE_TASK: RefreshCw,
  MOVE_FLEXIBLE_BLOCK: MoveHorizontal,
  DEADLINE_CONFLICT: CalendarClock,
  OVERLOAD_WARNING: Gauge,
  INSUFFICIENT_TIME: Hourglass,
  MISSED_BLOCK: AlarmClock,
  EMPTY_CAPACITY: Inbox,
  BREAK_RECOMMENDATION: Coffee,
  UNSCHEDULED_PRIORITY: ListChecks,
};

/** Recommendation types whose confirmation flow needs a linked task. */
const TASK_TARGETED = new Set<ScheduleRecommendationType>([
  "SCHEDULE_TASK",
  "UNSCHEDULED_PRIORITY",
  "EMPTY_CAPACITY",
  "INSUFFICIENT_TIME",
]);

function ScheduleRecRow({
  rec,
  schedule,
  actions,
  onDismiss,
}: {
  rec: ScheduleRecommendation;
  schedule: UseScheduleResult;
  actions: ScheduleDialogActions;
  onDismiss: (id: string) => void;
}) {
  const { tasks } = useWorkspace();
  const Icon = TYPE_ICON[rec.type];
  const meta = SCHEDULE_REC_META[rec.type];
  const plan = rec.plan;

  const block = rec.targetId
    ? schedule.result.blocks.find((b) => b._id === rec.targetId)
    : undefined;
  const task =
    rec.targetId && TASK_TARGETED.has(rec.type)
      ? tasks.find((t) => t._id === rec.targetId)
      : undefined;
  const missedBlock = rec.type === "MISSED_BLOCK" && block ? block : undefined;

  return (
    <li className="rounded-xl border border-border/60 bg-white/50 px-3 py-2.5 dark:bg-white/5">
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-lg",
            SEVERITY_TILE[rec.severity],
          )}
          aria-hidden
        >
          <Icon className="size-3.5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Pill toneKey={SEVERITY_TONE[rec.severity]}>{meta.labelFa}</Pill>
            <span className="text-[13px] font-extrabold leading-5">{rec.title}</span>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
            {rec.detail}
          </p>

          {/* Explicit confirmation actions — one click opens a review flow,
              the actual write always happens behind a second confirmation. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {rec.type === "SCHEDULE_TASK" && task && (
              <button
                type="button"
                onClick={() => actions.openScheduleTask(task)}
                className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <CalendarPlus className="size-3" aria-hidden />
                زمان‌بندی کن
              </button>
            )}

            {(rec.type === "RESCHEDULE_TASK" || rec.type === "MISSED_BLOCK") &&
              block &&
              !block.fixed && (
                <button
                  type="button"
                  onClick={() => actions.openReschedule(block)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-white/60 px-2 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary dark:bg-white/5"
                >
                  <RefreshCw className="size-3" aria-hidden />
                  جابه‌جایی
                </button>
              )}

            {rec.type === "MOVE_FLEXIBLE_BLOCK" && plan && (
              <button
                type="button"
                onClick={() => actions.openMoves(plan, rec.title)}
                className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <MoveHorizontal className="size-3" aria-hidden />
                بررسی تغییرات
              </button>
            )}

            {missedBlock && (
              <>
                <button
                  type="button"
                  onClick={() => void actions.completeBlock(missedBlock)}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-300/70 bg-emerald-50/70 px-2 py-1 text-[11px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-primary dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                >
                  انجام شد
                </button>
                <button
                  type="button"
                  onClick={() => void actions.keepUnscheduled(missedBlock)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border/70 px-2 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                >
                  بماند بدون برنامه
                </button>
              </>
            )}

            {rec.type === "INSUFFICIENT_TIME" && task && (
              <button
                type="button"
                onClick={() => actions.openScheduleTask(task)}
                className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-white/60 px-2 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary dark:bg-white/5"
              >
                انتخاب مدت و زمان
              </button>
            )}
            {rec.type === "UNSCHEDULED_PRIORITY" && task && (
              <button
                type="button"
                onClick={() => actions.openScheduleTask(task)}
                className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <CalendarPlus className="size-3" aria-hidden />
                زمان‌بندی کن
              </button>
            )}
            {rec.type === "EMPTY_CAPACITY" && task && (
              <button
                type="button"
                onClick={() => actions.openScheduleTask(task)}
                className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <CalendarPlus className="size-3" aria-hidden />
                یکی را زمان‌بندی کن
              </button>
            )}

            {rec.type === "DEADLINE_CONFLICT" && (
              <Link
                to="/tasks?filter=upcoming"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
              >
                دیدن موعدها <span aria-hidden>←</span>
              </Link>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onDismiss(rec.id)}
          aria-label={`نادیده گرفتن پیشنهاد زمان‌بندی: ${rec.title}`}
          title="برای امروز نادیده گرفته می‌شود"
          className="grid size-6 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    </li>
  );
}

export interface ScheduleRecommendationsProps {
  schedule: UseScheduleResult;
  actions: ScheduleDialogActions;
  limit?: number;
  title?: string;
  description?: string;
  showEmpty?: boolean;
  className?: string;
}

export function ScheduleRecommendations({
  schedule,
  actions,
  limit = 6,
  title = "پیشنهادهای زمان‌بندی",
  description = "قطعی و قابل رد زدن — هیچ تغییری بدون تأیید تو اعمال نمی‌شود",
  showEmpty = false,
  className,
}: ScheduleRecommendationsProps) {
  const { recommendations, dismiss } = schedule;

  if (recommendations.length === 0) {
    if (!showEmpty) return null;
    return (
      <Panel
        title={title}
        icon={<Lightbulb className="size-4 text-primary" aria-hidden />}
        description={description}
        className={className}
      >
        <EmptyHint>
          امروز پیشنهاد زمان‌بندی‌ای ندارم — اگر بلوکی ساختی یا مدت کاری را مشخص
          کردی، همین‌جا پیشنهاد ظاهر می‌شود.
        </EmptyHint>
      </Panel>
    );
  }

  const visible = recommendations.slice(0, limit);
  const hidden = recommendations.length - visible.length;

  return (
    <Panel
      title={title}
      icon={<Lightbulb className="size-4 text-primary" aria-hidden />}
      description={description}
      className={className}
    >
      <ul className="space-y-2">
        {visible.map((rec) => (
          <ScheduleRecRow
            key={rec.id}
            rec={rec}
            schedule={schedule}
            actions={actions}
            onDismiss={dismiss}
          />
        ))}
      </ul>
      {hidden > 0 && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          {hidden} پیشنهاد دیگر در مرکز برنامه‌ریزی منتظر است —{" "}
          <Link to="/planning" className="font-bold text-primary hover:underline">
            ببینشان
          </Link>
        </p>
      )}
      <p className="mt-3 text-[10px] leading-5 text-muted-foreground">
        پیشنهادها از روی داده‌های واقعی برنامه (تعهدها، موعدها و ظرفیت روز)
        محاسبه می‌شوند، نه حدس — و فقط با تأیید خودت اعمال می‌شوند.
      </p>
    </Panel>
  );
}
