/**
 * ExecutionNow — Phase 12 §17 (Today: «الان» / «بعدی» / «نیاز به توجه»).
 *
 * The first thing the user sees on Today:
 *   1. If a session is running (server-authoritative), the live card IS the
 *      surface — nothing else competes with actual work.
 *   2. Otherwise, the NEXT scheduled block with a one-click [شروع], plus the
 *      planner's primary action as a secondary start target.
 *   3. «نیاز به توجه» — deadline work that is at risk, derived from the Phase 10
 *      attention band (never from a second priority engine).
 *
 * Starting is a single controlled mutation: `execution.start` → the backend
 * creates the session, records the audit event and returns the live session, so
 * the card appears from server truth (refresh-safe, §35).
 */
import { AlertTriangle, ArrowLeft, CalendarClock, Play, Timer } from "lucide-react";
import { Link } from "react-router";
import { Pill } from "@/components/progress/progress-ui";
import { Button } from "@/components/ui/button";
import { useUserProfile } from "@/hooks/use-user-profile";
import { blockLabel } from "@/lib/scheduling";
import { formatDueFa, todayKey } from "@/lib/task-utils";
import { toFa } from "@/lib/persian";
import { timeFa } from "@/components/scheduling/schedule-ui";
import type { UsePlanningResult } from "@/hooks/use-planning";
import type { UseScheduleResult } from "@/hooks/use-schedule";
import type { UseExecutionResult } from "@/hooks/use-execution";
import { ActiveSessionCard } from "./ActiveSessionCard";

export function ExecutionNow({
  execution,
  plan,
  schedule,
}: {
  execution: UseExecutionResult;
  plan: UsePlanningResult;
  schedule: UseScheduleResult;
}) {
  const { personaKey } = useUserProfile();
  const session = execution.activeSession;

  if (session) {
    return <ActiveSessionCard execution={execution} session={session} />;
  }

  const next = schedule.result.snapshot.nextBlock;
  const nextAction = plan.result.nextAction;

  return (
    <section
      className="ui-surface overflow-hidden rounded-2xl"
      aria-label="اجرای امروز"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <span className="ui-icon-tile size-6">
            <Timer className="size-3.5 text-primary" aria-hidden />
          </span>
          الان
        </h2>
        {next && (
          <Pill toneKey="slate">
            بعدی: {timeFa(next.start)}–{timeFa(next.end)}
          </Pill>
        )}
      </header>

      <div className="space-y-3 p-4">
        {next ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-white/50 px-3 py-2.5 dark:bg-white/5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Pill toneKey="blue">{blockLabel("task", personaKey)}</Pill>
                <span className="truncate text-[13px] font-extrabold">{next.title}</span>
              </div>
              <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                {timeFa(next.start)}–{timeFa(next.end)}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() =>
                void execution.start({
                  blockId: next.id as never,
                  taskId: (next.taskId ?? undefined) as never,
                  title: next.title,
                })
              }
            >
              <Play className="size-3.5" aria-hidden />
              شروع این بلوک
            </Button>
          </div>
        ) : null}

        {nextAction ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-white/50 px-3 py-2.5 dark:bg-white/5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Pill toneKey="violet">قدم بعدی</Pill>
                <span className="truncate text-[13px] font-extrabold">
                  {nextAction.task.title}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{nextAction.reason}</p>
            </div>
            <Button
              size="sm"
              variant={next ? "outline" : "default"}
              onClick={() =>
                void execution.start({
                  taskId: nextAction.task._id as never,
                  title: nextAction.task.title,
                  plannedMinutes: nextAction.task.estimateMinutes,
                })
              }
            >
              <Play className="size-3.5" aria-hidden />
              شروع کار
            </Button>
          </div>
        ) : null}

        {!next && !nextAction && (
          <p className="rounded-xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
            الان کار زمان‌بندی‌شده‌ای نداری. یک بلوک بساز یا کار مهم امروز را انتخاب کن —
            با زدن «شروع»، زمان واقعی اجرا ثبت می‌شود.
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * «نیاز به توجه» — deadline work whose planner attention is high, plus overdue
 * work. Uses the planner's already-computed band (§10) — no second priority
 * engine, and no claim the user cannot see in their own data.
 */
export function ExecutionAtRisk({ plan }: { plan: UsePlanningResult }) {
  const dayKey = todayKey();
  const priorityById = new Map(
    plan.result.priorities.map((p) => [p.task._id as string, p.attention]),
  );

  const atRisk = plan.result.priorities
    .filter((p) => {
      const task = p.task;
      if (task.status === "done") return false;
      const overdue = !!task.dueDate && task.dueDate < dayKey;
      const dueToday = task.dueDate === dayKey;
      if (overdue) return true;
      return dueToday && p.attention.attention === "high";
    })
    .slice(0, 4);

  if (atRisk.length === 0) return null;

  return (
    <section className="ui-surface overflow-hidden rounded-2xl" aria-label="کارهای در معرض خطر">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <span className="ui-icon-tile size-6">
            <AlertTriangle className="size-3.5 text-amber-500" aria-hidden />
          </span>
          نیاز به توجه
        </h2>
        <Link
          to="/tasks?filter=overdue"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
        >
          همه
          <ArrowLeft className="size-3" aria-hidden />
        </Link>
      </header>
      <ul className="divide-y divide-border/40">
        {atRisk.map((p) => {
          const attention = priorityById.get(p.task._id as string);
          const overdue = !!p.task.dueDate && p.task.dueDate < dayKey;
          return (
            <li
              key={p.task._id as string}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5"
            >
              <Pill toneKey={overdue ? "rose" : "amber"}>
                {overdue ? "عقب‌افتاده" : "مهلت امروز"}
              </Pill>
              {attention?.attention === "high" && <Pill toneKey="rose">اهمیت بالا</Pill>}
              <span className="min-w-0 flex-1 truncate text-[12px] font-bold">
                {p.task.title}
              </span>
              {p.task.dueDate && (
                <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                  <CalendarClock className="size-3" aria-hidden />
                  {formatDueFa(p.task.dueDate)}
                </span>
              )}
              {p.task.postponeCount && p.task.postponeCount > 0 ? (
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {toFa(p.task.postponeCount)} بار جابه‌جا شده
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
