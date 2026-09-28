/**
 * ExecutionReview — Phase 12 §25 (daily) + §26 (weekly).
 *
 * Two light, optional read-outs of real execution:
 *
 *   Daily  — «امروز»: scheduled vs executed, main tasks done, overdue, blocked,
 *            estimate accuracy and an optional short note (local only).
 *   Weekly — «بازبینی هفته»: planned vs actual, completion rate, schedule
 *            adherence, estimate accuracy, delays/reschedules and focus time,
 *            plus the deterministic estimate insights with the option to
 *            correct a task's estimate — the ORIGINAL estimate stays intact
 *            (§14: base + historic adjustment, never a silent rewrite).
 *
 * Neither review is mandatory: both are panels the user can ignore. Nothing
 * here mutates state except the explicit «اصلاح تخمین» confirmation.
 */
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarRange,
  ClipboardCheck,
  NotebookPen,
  Sliders,
} from "lucide-react";
import { Bar, EmptyHint, Panel, Pill } from "@/components/progress/progress-ui";
import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { Button } from "@/components/ui/button";
import { toFa } from "@/lib/persian";
import { formatJalaliShort } from "@/lib/persian";
import { hoursFa, minutesFa } from "@/components/scheduling/schedule-ui";
import type { UseExecutionResult } from "@/hooks/use-execution";
import type { UsePlanningResult } from "@/hooks/use-planning";
import { readDayNote, writeDayNote } from "./execution-ui";

function Cell({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-white/50 px-3 py-2 dark:bg-white/5">
      <p className="text-[10px] font-semibold text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[15px] font-extrabold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Daily                                                               */
/* ------------------------------------------------------------------ */

export function ExecutionDailyReview({
  execution,
  plan,
}: {
  execution: UseExecutionResult;
  plan: UsePlanningResult;
}) {
  const { snapshot, metrics } = execution.result;
  const [note, setNote] = useState(() => readDayNote(execution.dayKey));
  const [saved, setSaved] = useState(false);

  const mainTasks = [...plan.result.buckets.mustDo, ...plan.result.buckets.shouldDo];
  const mainDone = mainTasks.filter((t) => t.status === "done").length;

  const hasData =
    metrics.sessions > 0 ||
    (snapshot.scheduledMinutes ?? 0) > 0 ||
    mainTasks.length > 0 ||
    snapshot.blockedTasks > 0;
  if (!hasData) return null;

  const save = () => {
    writeDayNote(execution.dayKey, note);
    setSaved(true);
    toast.success("یادداشت روز ذخیره شد.");
    window.setTimeout(() => setSaved(false), 2500);
  };

  return (
    <Panel
      title="مرور امروز"
      icon={<ClipboardCheck className="size-4 text-primary" aria-hidden />}
      description="جمع‌بندی واقعی امروز — بدون داوری، فقط داده"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Cell label="برنامه‌ریزی‌شده" value={snapshot.scheduledMinutes != null ? hoursFa(snapshot.scheduledMinutes) : "—"} />
          <Cell label="انجام‌شده" value={hoursFa(metrics.actualMinutes)} />
          <Cell
            label="کارهای اصلی"
            value={`${toFa(mainDone)} / ${toFa(mainTasks.length)}`}
            hint={mainTasks.length === 0 ? "کار اصلی برای امروز ثبت نشده" : undefined}
          />
          <Cell label="عقب‌افتاده" value={toFa(plan.result.snapshot.overdueCount)} />
          <Cell label="مسدود" value={toFa(snapshot.blockedTasks)} />
          <Cell
            label="دقت تخمین زمان"
            value={metrics.estimateAccuracyPct != null ? `${toFa(metrics.estimateAccuracyPct)}٪` : "—"}
          />
        </div>

        <div>
          <label
            htmlFor="execution-day-note"
            className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground"
          >
            <NotebookPen className="size-3.5" aria-hidden />
            یادداشت کوتاه روز (اختیاری، فقط روی همین دستگاه)
          </label>
          <textarea
            id="execution-day-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="مثلاً: جلسه طول کشید و برنامه عقب افتاد…"
            className="w-full resize-none rounded-xl border border-border/70 bg-white/60 px-3 py-2 text-[12px] outline-none focus-visible:outline-2 focus-visible:outline-primary dark:bg-white/5"
          />
          <div className="mt-1.5 flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={save} disabled={saved}>
              {saved ? "ذخیره شد" : "ذخیره یادداشت"}
            </Button>
            <Link
              to="/planning"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
            >
              بازبینی هفته
              <ArrowLeft className="size-3" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Weekly                                                              */
/* ------------------------------------------------------------------ */

export function ExecutionWeeklyReview({ execution }: { execution: UseExecutionResult }) {
  const weekly = execution.result.weekly;
  const insights = execution.result.insights;
  const { tasks, updateTask } = useWorkspace();
  const [showInsights, setShowInsights] = useState(false);

  const hasData = weekly.sessions > 0 || weekly.actualMinutes > 0;
  if (!hasData) {
    return (
      <Panel
        title="بازبینی هفته"
        icon={<CalendarRange className="size-4 text-primary" aria-hidden />}
        description="الگوی اجرا در هفت روز گذشته"
      >
        <EmptyHint>
          هنوز داده اجرایی برای این هفته ثبت نشده. با شروع و پایان کارها، این بخش خودش پر می‌شود.
        </EmptyHint>
      </Panel>
    );
  }

  const maxDay = Math.max(1, ...weekly.days.map((d) => Math.max(d.actualMinutes, d.scheduledMinutes)));

  return (
    <Panel
      title="بازبینی هفته"
      icon={<CalendarRange className="size-4 text-primary" aria-hidden />}
      description={`از ${formatJalaliShort(new Date(`${weekly.from}T00:00:00`))} تا ${formatJalaliShort(new Date(`${weekly.to}T00:00:00`))}`}
      action={
        <Link
          to="/planning"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
        >
          بررسی برنامه هفته
          <ArrowLeft className="size-3" aria-hidden />
        </Link>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Cell label="اجرای واقعی" value={hoursFa(weekly.actualMinutes)} />
          <Cell label="تخمین" value={weekly.estimatedMinutes > 0 ? hoursFa(weekly.estimatedMinutes) : "—"} />
          <Cell
            label="اختلاف با تخمین"
            value={weekly.variancePct != null ? `${toFa(Math.abs(weekly.variancePct))}٪` : "—"}
            hint={weekly.variancePct != null && weekly.variancePct > 0 ? "بیشتر از تخمین" : weekly.variancePct != null ? "کمتر از تخمین" : undefined}
          />
          <Cell
            label="دقت تخمین"
            value={weekly.estimateAccuracyPct != null ? `${toFa(weekly.estimateAccuracyPct)}٪` : "—"}
          />
          <Cell
            label="سهم تکمیل"
            value={weekly.completionRate != null ? `${toFa(Math.round(weekly.completionRate * 100))}٪` : "—"}
          />
          <Cell
            label="هم‌خوانی با برنامه"
            value={weekly.scheduledAdherence != null ? `${toFa(Math.round(weekly.scheduledAdherence * 100))}٪` : "—"}
          />
          <Cell label="زمان تمرکز" value={hoursFa(weekly.focusMinutes)} />
          <Cell
            label="جابه‌جایی‌ها"
            value={toFa(weekly.reschedules + weekly.postponements)}
            hint={`${toFa(weekly.reschedules)} جابه‌جایی برنامه، ${toFa(weekly.postponements)} تعویق موعد`}
          />
        </div>

        {/* 7-day distribution — actual vs scheduled, no invented numbers */}
        <div className="flex items-end gap-1.5" role="img" aria-label="توزیع هفت‌روزه اجرا و برنامه">
          {weekly.days.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-16 w-full items-end justify-center gap-0.5">
                <span
                  className="w-1/2 rounded-t bg-primary/70"
                  style={{ height: `${Math.round((d.actualMinutes / maxDay) * 100)}%` }}
                  title={`اجرا: ${minutesFa(d.actualMinutes)}`}
                />
                <span
                  className="w-1/2 rounded-t bg-border"
                  style={{ height: `${Math.round((d.scheduledMinutes / maxDay) * 100)}%` }}
                  title={`برنامه: ${minutesFa(d.scheduledMinutes)}`}
                />
              </div>
              <span className="text-[9px] tabular-nums text-muted-foreground">
                {toFa(d.day.slice(8))}
              </span>
            </div>
          ))}
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-primary/70" aria-hidden /> اجراشده
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-border" aria-hidden /> برنامه‌ریزی‌شده
          </span>
        </p>

        <ul className="space-y-1.5">
          {weekly.notes.map((note, i) => (
            <li
              key={i}
              className="rounded-xl border border-border/60 bg-white/50 px-3 py-2 text-[11px] leading-5 text-muted-foreground dark:bg-white/5"
            >
              {note}
            </li>
          ))}
        </ul>

        {insights.length > 0 && (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowInsights((v) => !v)}>
                <Sliders className="size-3.5" aria-hidden />
                تنظیم تخمین‌ها ({toFa(insights.length)})
              </Button>
              <span className="text-[10px] text-muted-foreground">
                تخمین اصلی هیچ‌وقت بازنویسی نمی‌شود؛ فقط مقدار پیشنهادی جایگزین می‌شود.
              </span>
            </div>

            {showInsights && (
              <ul className="mt-2 space-y-2">
                {insights.slice(0, 6).map((insight) => {
                  const taskId = insight.key.startsWith("task:") ? insight.key.slice(5) : null;
                  const task = taskId ? tasks.find((t) => t._id === taskId) : undefined;
                  return (
                    <li
                      key={insight.key}
                      className="rounded-xl border border-border/60 bg-white/50 px-3 py-2.5 dark:bg-white/5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill toneKey={insight.adjustmentMinutes > 0 ? "amber" : "emerald"}>
                          {insight.adjustmentMinutes > 0
                            ? `+${toFa(insight.adjustmentMinutes)} دقیقه`
                            : `${toFa(insight.adjustmentMinutes)} دقیقه`}
                        </Pill>
                        <span className="text-[12px] font-extrabold">{insight.label}</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{insight.note}</p>
                      <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                        تخمین فعلی: {minutesFa(insight.baseMinutes)} · میانگین واقعی:{" "}
                        {minutesFa(insight.historicalMinutes)} · نمونه: {toFa(insight.samples)}
                      </p>
                      {task && insight.adjustmentMinutes !== 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            void updateTask(task._id, { estimateMinutes: insight.historicalMinutes })
                          }
                          className="mt-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-primary"
                        >
                          اعمال روی «{task.title}»
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <Bar
          pct={weekly.scheduledAdherence != null ? Math.round(weekly.scheduledAdherence * 100) : 0}
          toneKey="blue"
          className="h-2"
        />
      </div>
    </Panel>
  );
}
