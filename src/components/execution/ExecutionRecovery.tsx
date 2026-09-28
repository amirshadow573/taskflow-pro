/**
 * ExecutionRecovery — Phase 12 §9 / §11 / §12 / §17 / §29 (Today: «بازیابی برنامه»).
 *
 * Renders the deterministic recovery options produced by the engine
 * (recovery.ts). This is where the product talks back to reality:
 *
 *   - every row explains WHY it exists (observable data only — §13),
 *   - every action is an explicit, confirm-first choice; nothing is applied on
 *     render and nothing bulk-applies silently (§29 / §30),
 *   - reusing the EXISTING controlled mutations: start the execution engine,
 *     the scheduler's reschedule/move dialogs, the task completion path and the
 *     estimate update. No new write path is introduced here,
 *   - every decision is audited through `execution.logRecovery` (§36).
 *
 * Escape hatch (§10): recovery never re-ranks work. Order and severity come from
 * the Phase 10 planner + the scheduling engine, which the engine already
 * consumed.
 */
import { Link } from "react-router";
import { toast } from "sonner";
import {
  AlarmClock,
  ArrowLeft,
  Ban,
  CalendarClock,
  Clock,
  Gauge,
  Hourglass,
  Lightbulb,
  RefreshCw,
  Repeat,
  Sparkles,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";
import { EmptyHint, Panel, Pill } from "@/components/progress/progress-ui";
import { useWorkspace } from "@/components/workspace/WorkspaceData";
import {
  EXECUTION_REC_META,
  insightForTask,
  type ExecutionRecommendation,
  type ExecutionRecoveryAction,
  type ExecutionRecoveryType,
} from "@/lib/execution";
import { cn } from "@/lib/utils";
import { minutesFa } from "@/components/scheduling/schedule-ui";
import type { ScheduleDialogActions } from "@/components/scheduling/use-schedule-dialogs";
import type { UseExecutionResult } from "@/hooks/use-execution";
import type { UseScheduleResult } from "@/hooks/use-schedule";
import { ACTION_LABELS_FA, REC_TILE, REC_TONE, sortActions } from "./execution-ui";

const TYPE_ICON: Record<ExecutionRecoveryType, LucideIcon> = {
  MISSED_BLOCK: AlarmClock,
  OVERDUE_RECOVERY: CalendarClock,
  OVERRUN_CONFLICT: Hourglass,
  UNDERRUN: Sparkles,
  RESCHEDULE_REQUIRED: RefreshCw,
  WORKLOAD_OVERLOAD: Gauge,
  REPEATED_DELAY: Repeat,
  BLOCKED_TASK: Ban,
  SCHEDULE_DRIFT: TrendingUp,
  RECOVERED_TIME: Clock,
};

const CONFIDENCE_FA = {
  high: "اطمینان بالا",
  medium: "اطمینان متوسط",
  low: "اطمینان کم",
} as const;

export function ExecutionRecovery({
  execution,
  schedule,
  actions,
  limit = 5,
  title = "بازیابی برنامه",
  description = "واقعیت با برنامه فرق کرده — این گزینه‌ها را خودت انتخاب کن",
}: {
  execution: UseExecutionResult;
  schedule: UseScheduleResult;
  actions: ScheduleDialogActions;
  limit?: number;
  title?: string;
  description?: string;
}) {
  const { tasks, toggleDone, updateTask } = useWorkspace();
  const { recommendations, dismiss } = execution;
  const { insights } = execution.result;

  const blockOf = (id?: string) =>
    id ? schedule.result.blocks.find((b) => b._id === id) : undefined;
  const taskOf = (id?: string) => (id ? tasks.find((t) => t._id === id) : undefined);

  const run = async (rec: ExecutionRecommendation, action: ExecutionRecoveryAction) => {
    const block = blockOf(rec.blockId);
    const task = taskOf(rec.taskId);
    const label = `${rec.title} — ${ACTION_LABELS_FA[action]}`;

    switch (action) {
      case "start_now":
        await execution.start({
          blockId: rec.blockId as never,
          taskId: rec.taskId as never,
          projectId: rec.projectId as never,
          title: block?.title ?? task?.title,
        });
        break;
      case "mark_complete":
        if (block) await actions.completeBlock(block);
        else if (task) await toggleDone(task, true);
        break;
      case "reschedule":
      case "accept_move":
        if (block) actions.openReschedule(block);
        else if (task) actions.openScheduleTask(task);
        break;
      case "keep_unscheduled":
        if (block) await actions.keepUnscheduled(block);
        break;
      case "adjust_estimate": {
        if (!task) break;
        const insight = insightForTask(task, insights);
        const minutes = insight?.historicalMinutes ?? task.estimateMinutes;
        if (minutes && minutes > 0) {
          await updateTask(task._id, { estimateMinutes: minutes });
          toast.success("تخمین زمان به‌روز شد", {
            description: `تخمین جدید: ${minutesFa(minutes)} — مقدار قبلی در تاریخچه باقی می‌ماند.`,
          });
        }
        break;
      }
      case "mark_blocked":
        await execution.logRecovery({
          action,
          label,
          taskId: rec.taskId as never,
          blockId: rec.blockId as never,
          markTaskBlocked: Boolean(rec.taskId),
        });
        break;
      case "dismiss":
        dismiss(rec.id);
        await execution.logRecovery({ action, label, taskId: rec.taskId as never });
        return;
      default:
        break;
    }

    await execution.logRecovery({
      action,
      label,
      sessionId: rec.sessionId as never,
      taskId: rec.taskId as never,
      blockId: rec.blockId as never,
      projectId: rec.projectId as never,
    });

    /* Dialogs stay open (the real change happens after confirmation). */
    if (action !== "reschedule" && action !== "accept_move") dismiss(rec.id);
  };

  if (recommendations.length === 0) {
    return (
      <Panel
        title={title}
        icon={<Lightbulb className="size-4 text-primary" aria-hidden />}
        description={description}
      >
        <EmptyHint>
          الان چیزی برای بازیابی نیست — برنامه و اجرا با هم هم‌خوان‌اند. همین‌طور ادامه بده.
        </EmptyHint>
      </Panel>
    );
  }

  const visible = recommendations.slice(0, limit);

  return (
    <Panel
      title={title}
      icon={<Lightbulb className="size-4 text-primary" aria-hidden />}
      description={description}
      action={
        <Link
          to="/planning"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
        >
          تنظیم مسیر روز
          <ArrowLeft className="size-3" aria-hidden />
        </Link>
      }
    >
      <ul className="space-y-2">
        {visible.map((rec) => {
          const Icon = TYPE_ICON[rec.type];
          const meta = EXECUTION_REC_META[rec.type];
          const block = blockOf(rec.blockId);
          const task = taskOf(rec.taskId);
          return (
            <li
              key={rec.id}
              className="rounded-xl border border-border/60 bg-white/50 px-3 py-2.5 dark:bg-white/5"
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={cn("grid size-7 shrink-0 place-items-center rounded-lg", REC_TILE[rec.severity])}
                  aria-hidden
                >
                  <Icon className="size-3.5" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Pill toneKey={REC_TONE[rec.severity]}>{meta.labelFa}</Pill>
                    <span className="text-[13px] font-extrabold leading-5">{rec.title}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {CONFIDENCE_FA[rec.confidence]}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{rec.detail}</p>

                  {(block || task) && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {block ? `بلوک: ${block.title}` : ""}
                      {block && task ? " · " : ""}
                      {task ? `کار: ${task.title}` : ""}
                    </p>
                  )}

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {sortActions(rec.actions).map((action) => {
                      const primary = action === "start_now" || action === "mark_complete";
                      const destructive = action === "mark_blocked";
                      return (
                        <button
                          key={action}
                          type="button"
                          onClick={() => void run(rec, action)}
                          className={cn(
                            "rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                            primary
                              ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                              : destructive
                                ? "border-amber-300/70 bg-amber-50/70 text-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                                : "border-border/70 bg-white/60 text-muted-foreground hover:border-primary/40 hover:text-primary dark:bg-white/5",
                          )}
                        >
                          {ACTION_LABELS_FA[action]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => dismiss(rec.id)}
                  aria-label={`نادیده گرفتن پیشنهاد بازیابی: ${rec.title}`}
                  title="برای امروز نادیده گرفته می‌شود"
                  className="grid size-6 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[10px] leading-5 text-muted-foreground">
        این پیشنهادها فقط از داده‌های قابل‌مشاهده ساخته می‌شوند (زمان واقعی ثبت‌شده، بلوک‌های
        برنامه و تاریخچه‌ی خودت) — هیچ تغییری بدون تأیید تو اعمال نمی‌شود و هیچ‌کدام درباره‌ی
        علت رفتار تو قضاوت نمی‌کنند.
      </p>
    </Panel>
  );
}
