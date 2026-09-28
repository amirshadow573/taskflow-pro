/**
 * ExecutionProgress — Phase 12 §17 / §25 (Today: «پیشرفت»).
 *
 * A compact, honest reading of how today is actually going: scheduled vs
 * executed minutes, estimate accuracy and the session outcome counts. Every
 * number comes from the execution engine (real timestamps + real estimates) —
 * nothing is inferred and nothing is invented. The panel renders NOTHING until
 * there is something real to show (§34 / §40), so a quiet day stays quiet.
 */
import { Activity, BarChart3 } from "lucide-react";
import { Bar, Pill } from "@/components/progress/progress-ui";
import { toFa } from "@/lib/persian";
import { hoursFa } from "@/components/scheduling/schedule-ui";
import type { UseExecutionResult } from "@/hooks/use-execution";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-white/50 px-3 py-2 dark:bg-white/5">
      <p className="text-[10px] font-semibold text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[15px] font-extrabold tabular-nums">{value}</p>
    </div>
  );
}

export function ExecutionProgress({ execution }: { execution: UseExecutionResult }) {
  const { metrics, snapshot } = execution.result;

  const scheduled = snapshot.scheduledMinutes;
  const hasData =
    metrics.sessions > 0 ||
    (scheduled ?? 0) > 0 ||
    metrics.missedBlocks > 0 ||
    snapshot.blockedTasks > 0;

  if (!hasData) return null;

  const pct =
    scheduled && scheduled > 0
      ? Math.min(100, Math.round((metrics.actualMinutes / scheduled) * 100))
      : metrics.actualMinutes > 0
        ? 100
        : 0;

  return (
    <section className="ui-surface overflow-hidden rounded-2xl" aria-label="پیشرفت اجرای امروز">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <span className="ui-icon-tile size-6">
            <BarChart3 className="size-3.5 text-primary" aria-hidden />
          </span>
          پیشرفت اجرای امروز
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          {metrics.completedSessions > 0 && (
            <Pill toneKey="emerald">{toFa(metrics.completedSessions)} نشست تکمیل‌شده</Pill>
          )}
          {snapshot.partialSessions > 0 && (
            <Pill toneKey="amber">{toFa(snapshot.partialSessions)} ناقص</Pill>
          )}
          {metrics.missedBlocks > 0 && (
            <Pill toneKey="amber">{toFa(metrics.missedBlocks)} بلوک از دست رفته</Pill>
          )}
          {snapshot.blockedTasks > 0 && (
            <Pill toneKey="rose">{toFa(snapshot.blockedTasks)} مسدود</Pill>
          )}
        </div>
      </header>

      <div className="space-y-3 p-4">
        {scheduled != null && scheduled > 0 ? (
          <div className="space-y-1.5">
            <Bar pct={pct} toneKey={pct >= 80 ? "emerald" : pct >= 40 ? "blue" : "amber"} className="h-2.5" />
            <p className="text-[11px] text-muted-foreground">
              {hoursFa(metrics.actualMinutes)} از {hoursFa(scheduled)} برنامه امروز اجرا شده
              {pct > 0 ? ` (${toFa(pct)}٪)` : ""}.
            </p>
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Activity className="size-3.5 shrink-0" aria-hidden />
            {hoursFa(metrics.actualMinutes)} اجرای واقعی ثبت شده — امروز بلوک زمان‌بندی‌شده‌ای نداری.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="اجراشده" value={hoursFa(metrics.actualMinutes)} />
          <Stat
            label="تخمین کارهای انجام‌شده"
            value={metrics.estimatedMinutes > 0 ? hoursFa(metrics.estimatedMinutes) : "—"}
          />
          <Stat
            label="دقت تخمین زمان"
            value={metrics.estimateAccuracyPct != null ? `${toFa(metrics.estimateAccuracyPct)}٪` : "—"}
          />
          <Stat
            label="سهم تکمیل"
            value={
              metrics.completionRate != null
                ? `${toFa(Math.round(metrics.completionRate * 100))}٪`
                : "—"
            }
          />
        </div>

        {snapshot.rescheduledTasks > 0 && (
          <p className="text-[10px] leading-5 text-muted-foreground">
            {toFa(snapshot.rescheduledTasks)} کار امروز بر اساس تصمیم خودت جابه‌جا شده است — این
            عدد فقط نتیجه را ثبت می‌کند و داوری نمی‌کند.
          </p>
        )}
      </div>
    </section>
  );
}
