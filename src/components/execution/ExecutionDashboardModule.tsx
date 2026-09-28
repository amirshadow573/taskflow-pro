/**
 * ExecutionDashboardModule — Phase 12 §18.
 *
 * A COMPACT execution summary for the persona dashboards: today's plan progress
 * plus the few numbers that actually change behavior (planned vs executed,
 * in-progress, missed, blocked) and a single line pointing at recovery when
 * reality diverged. It is deliberately NOT an analytics page — full insights
 * live in the Today review (§25 / §26).
 *
 * Same composition as Today (usePlanning → useSchedule → useExecution), so the
 * Convex subscriptions are shared and nothing is computed twice. Renders
 * nothing while there is nothing real to report (§34).
 */
import { Link } from "react-router";
import { ArrowLeft, Activity, TriangleAlert } from "lucide-react";
import { Bar, Pill } from "@/components/progress/progress-ui";
import { toFa } from "@/lib/persian";
import { hoursFa } from "@/components/scheduling/schedule-ui";
import { usePlanning } from "@/hooks/use-planning";
import { useSchedule } from "@/hooks/use-schedule";
import { useExecution } from "@/hooks/use-execution";

export function ExecutionDashboardModule() {
  const plan = usePlanning();
  const schedule = useSchedule(plan);
  const execution = useExecution(plan, schedule);

  if (execution.loading) return null;

  const { metrics, snapshot } = execution.result;
  const active = execution.activeSession;

  const mainTasks = [...plan.result.buckets.mustDo, ...plan.result.buckets.shouldDo];
  const mainDone = mainTasks.filter((t) => t.status === "done").length;
  const scheduled = snapshot.scheduledMinutes ?? 0;

  const hasData =
    mainTasks.length > 0 ||
    metrics.sessions > 0 ||
    scheduled > 0 ||
    snapshot.blockedTasks > 0;
  if (!hasData) return null;

  const pct = mainTasks.length > 0 ? Math.round((mainDone / mainTasks.length) * 100) : 0;
  const recoveryCount = execution.recommendations.length;

  return (
    <section className="ui-surface rounded-2xl p-4" aria-label="اجرای امروز">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <span className="ui-icon-tile size-6">
            <Activity className="size-3.5 text-primary" aria-hidden />
          </span>
          اجرای امروز
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          {active && (
            <Pill toneKey="emerald">
              در حال انجام{active.title ? `: ${active.title}` : ""}
            </Pill>
          )}
          <Link
            to="/today"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
          >
            امروز
            <ArrowLeft className="size-3" aria-hidden />
          </Link>
        </div>
      </header>

      <div className="mt-3 space-y-1.5">
        <Bar pct={pct} toneKey={pct >= 80 ? "emerald" : pct >= 40 ? "blue" : "amber"} className="h-2.5" />
        <p className="text-[11px] text-muted-foreground">
          {mainTasks.length > 0
            ? `${toFa(mainDone)} از ${toFa(mainTasks.length)} کار اصلی انجام شده (${toFa(pct)}٪)`
            : "امروز کار اصلی ثبت نشده"}
          {snapshot.scheduledMinutes != null && snapshot.scheduledMinutes > 0
            ? ` — ${hoursFa(metrics.actualMinutes)} از ${hoursFa(snapshot.scheduledMinutes)} برنامه اجرا شده`
            : ` — ${hoursFa(metrics.actualMinutes)} اجرای واقعی ثبت شده`}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Pill toneKey="slate">{toFa(metrics.sessions)} نشست اجرا</Pill>
        <Pill toneKey="emerald">{toFa(metrics.completedSessions)} تکمیل</Pill>
        {snapshot.partialSessions > 0 && (
          <Pill toneKey="amber">{toFa(snapshot.partialSessions)} ناقص</Pill>
        )}
        {metrics.missedBlocks > 0 && (
          <Pill toneKey="amber">{toFa(metrics.missedBlocks)} از دست رفته</Pill>
        )}
        {snapshot.blockedTasks > 0 && (
          <Pill toneKey="rose">{toFa(snapshot.blockedTasks)} مسدود</Pill>
        )}
        {metrics.estimateAccuracyPct != null && (
          <Pill toneKey="blue">دقت تخمین {toFa(metrics.estimateAccuracyPct)}٪</Pill>
        )}
      </div>

      {recoveryCount > 0 && (
        <p className="mt-3 flex items-center gap-1.5 rounded-xl border border-amber-200/70 bg-amber-50/70 px-3 py-2 text-[11px] font-bold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
          {toFa(recoveryCount)} مورد برای بازیابی برنامه —{" "}
          <Link to="/today" className="underline">
            در «امروز» ببین
          </Link>
        </p>
      )}
    </section>
  );
}
