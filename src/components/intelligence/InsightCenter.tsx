/**
 * InsightCenter — Phase 13 §20 / §27 / §36.
 *
 * The full productivity-intelligence surface. It lives INSIDE the existing
 * analytics route (no new navigation, no new top-level page — §27), and it is
 * intentionally organised as questions rather than as a wall of charts:
 *
 *   نمای کلی        → the prioritized insights (what happened & what to do)
 *   برنامهریزی      → planned vs scheduled vs actual, estimation patterns
 *   اجرا            → sessions, missed blocks, postponed work
 *   زمان            → where the executed time actually went (§4)
 *   پروژهها / اهداف → explainable health with reasons (§9 / §10)
 *   تمرکز           → focus time + interruption share (§13 / §14)
 *   روندها          → bounded trend windows + historical buckets (§16 / §29)
 *
 * It composes the same hooks the rest of the app uses, so nothing is computed
 * twice, and it renders an honest collecting state instead of fake analytics
 * when there is not enough history yet (§32 / §33).
 */
import { useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Compass,
  Flame,
  Gauge,
  Lightbulb,
  PlayCircle,
  RotateCcw,
} from "lucide-react";
import { Bar, EmptyHint, Panel, StatTile } from "@/components/progress/progress-ui";
import { HEALTH_LABELS_FA } from "@/lib/planning";
import { toFa } from "@/lib/persian";
import {
  INTELLIGENCE_EMPTY_STATE_FA,
  dayFa,
  restoreInsight,
  type InsightCategory,
} from "@/lib/intelligence";
import type { DeviationSignal } from "@/lib/execution";
import { usePlanning } from "@/hooks/use-planning";
import { useSchedule } from "@/hooks/use-schedule";
import { useExecution } from "@/hooks/use-execution";
import { useIntelligence } from "@/hooks/use-intelligence";
import { InsightCard } from "./InsightCard";
import { ProductivityReviewPanel } from "./ProductivityReview";
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  HEALTH_CHIP,
  SEVERITY_DOT,
  SEVERITY_ORDER,
  WINDOW_OPTIONS,
  severityLabelFa,
  trendLabelFa,
  windowLabelFa,
} from "./insight-ui";

type Tab = InsightCategory | "overview";

export function InsightCenter() {
  const plan = usePlanning();
  const schedule = useSchedule(plan);
  const execution = useExecution(plan, schedule);
  const intel = useIntelligence(plan, schedule, execution);

  const [tab, setTab] = useState<Tab>("overview");
  const { data, insights } = intel;

  const counts = useMemo(() => {
    const map = new Map<InsightCategory, number>();
    for (const insight of insights) map.set(insight.category, (map.get(insight.category) ?? 0) + 1);
    return map;
  }, [insights]);

  const visible = useMemo(
    () => (tab === "overview" ? insights : insights.filter((i) => i.category === tab)),
    [insights, tab],
  );

  const restoredCount = useMemo(
    () => intel.data.insights.length - insights.length,
    [intel.data.insights.length, insights.length],
  );

  return (
    <div className="space-y-5" aria-label="مرکز بینش‌ها">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <span className="ui-icon-tile size-7">
              <Lightbulb className="size-4 text-primary" aria-hidden />
            </span>
            بینش‌های بهره‌وری
          </h2>
          <p className="mt-1 max-w-2xl text-[12px] leading-5 text-muted-foreground">
            این بخش تاریخ واقعی کارت را می‌خواند و بدون حدس و بدون داوری نشان می‌دهد چه اتفاقی
            افتاده، چرا این عدد نمایش داده می‌شود و چه اقدامی می‌توانی انجام بدهی.
          </p>
        </div>

        <div
          className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-border/60 p-1"
          role="group"
          aria-label="بازه تحلیل"
        >
          {WINDOW_OPTIONS.map((option) => (
            <button
              key={option.window}
              type="button"
              onClick={() => intel.setWindow(option.window)}
              aria-pressed={intel.window === option.window}
              className={
                intel.window === option.window
                  ? "rounded-lg bg-primary/15 px-2.5 py-1 text-[11px] font-extrabold text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  : "rounded-lg px-2.5 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      {!data.hasData ? (
        <Panel
          title="در حال جمع‌آوری داده"
          icon={
            <span className="ui-icon-tile size-6">
              <Compass className="size-3.5 text-primary" aria-hidden />
            </span>
          }
        >
          <EmptyHint>{INTELLIGENCE_EMPTY_STATE_FA}</EmptyHint>
          <ul className="mt-3 space-y-1.5 text-[11px] leading-5 text-muted-foreground">
            <li>• با اجرای یک کار در «امروز»، زمان واقعی و نتیجه آن ثبت می‌شود.</li>
            <li>• با ساخت بلوک زمانی در «برنامه‌ریزی»، برنامه و اجرا قابل مقایسه می‌شوند.</li>
            <li>• با ثبت تخمین زمان روی کارها، دقت تخمین قابل سنجش می‌شود.</li>
          </ul>
        </Panel>
      ) : (
        <>
          <MetricsStrip intel={intel} />

          <nav className="flex flex-wrap items-center gap-1.5" aria-label="دسته‌بندی بینش‌ها">
            <TabButton active={tab === "overview"} onClick={() => setTab("overview")} label="نمای کلی" count={insights.length} />
            {CATEGORY_ORDER.map((category) => (
              <TabButton
                key={category}
                active={tab === category}
                onClick={() => setTab(category)}
                label={CATEGORY_META[category].label}
                count={counts.get(category) ?? 0}
              />
            ))}
          </nav>

          {visible.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {visible.map((insight) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  onDismiss={intel.dismiss}
                  onUseful={intel.markUseful}
                />
              ))}
            </div>
          ) : (
            <EmptyHint>
              در این دسته برای بازه انتخاب‌شده بینشی ساخته نشد. بینش‌ها فقط با عبور از آستانه
              داده کافی ساخته می‌شوند.
            </EmptyHint>
          )}

          {restoredCount > 0 && (
            <button
              type="button"
              onClick={() => {
                /* Restoring notifies the store, so the list re-renders itself. */
                for (const insight of data.insights) restoreInsight(insight.id, intel.dayKey);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <RotateCcw className="size-3" aria-hidden />
              بازگرداندن {toFa(restoredCount)} بینش نادیده‌گرفته‌شده
            </button>
          )}

          {tab === "overview" && <WorkloadPanel intel={intel} />}

          {tab === "planning" && (
            <div className="grid gap-3 lg:grid-cols-2">
              <PlannedPanel intel={intel} />
              <PatternsPanel intel={intel} />
            </div>
          )}

          {tab === "execution" && (
            <div className="grid gap-3 lg:grid-cols-2">
              <ExecutionPanel intel={intel} />
              <DeviationsPanel deviations={execution.result.deviations} />
            </div>
          )}

          {tab === "time" && <TimePanel intel={intel} />}
          {tab === "projects" && <ProjectsPanel intel={intel} />}
          {tab === "goals" && <GoalsPanel intel={intel} />}
          {tab === "focus" && <FocusPanel intel={intel} />}
          {tab === "trends" && (
            <div className="space-y-3">
              <TrendsPanel intel={intel} />
              <SnapshotsPanel intel={intel} />
            </div>
          )}

          {(tab === "overview" || tab === "trends") && (
            <div className="space-y-3">
              <ProductivityReviewPanel
                review={data.weeklyReview}
                title="مرور هفتگی"
                description={windowLabelFa(data.window)}
              />
              <ProductivityReviewPanel
                review={data.monthlyReview}
                title="مرور ماهانه"
                description={data.monthlyReview.sufficient ? "۳۰ روز گذشته" : "در حال جمع‌آوری"}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

type Intel = ReturnType<typeof useIntelligence>;

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "rounded-xl bg-primary/15 px-3 py-1.5 text-[11px] font-extrabold text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          : "rounded-xl px-3 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      }
    >
      {label}
      {count > 0 && <span className="ms-1 tabular-nums opacity-70">{toFa(count)}</span>}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-white/50 px-3 py-2 dark:bg-white/5">
      <p className="text-[10px] font-semibold text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[14px] font-extrabold tabular-nums">{value}</p>
    </div>
  );
}

function MetricsStrip({ intel }: { intel: Intel }) {
  const { metrics, planned, estimation, focus, consistency, deadline } = intel.data;
  const severityCounts = SEVERITY_ORDER.map((severity) => ({
    severity,
    count: intel.insights.filter((i) => i.severity === severity).length,
  })).filter((row) => row.count > 0);

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
      <StatTile
        icon={<CalendarClock className="size-4 text-blue-600 dark:text-blue-300" aria-hidden />}
        label="برنامه‌ریزی‌شده"
        value={`${toFa(Math.round(planned.plannedMinutes))} دقیقه`}
        hint={`زمان‌بندی: ${toFa(Math.round(planned.scheduledMinutes))} دقیقه`}
        toneKey="blue"
      />
      <StatTile
        icon={<PlayCircle className="size-4 text-emerald-600 dark:text-emerald-300" aria-hidden />}
        label="اجراشده"
        value={`${toFa(Math.round(metrics.actualMinutes))} دقیقه`}
        hint={planned.adherencePct != null ? `پایبندی ${toFa(planned.adherencePct)}٪` : "بدون برنامه مقایسه‌پذیر"}
        toneKey="emerald"
      />
      <StatTile
        icon={<CheckCircle2 className="size-4 text-violet-600 dark:text-violet-300" aria-hidden />}
        label="کارهای انجام‌شده"
        value={toFa(metrics.completedTasks)}
        hint={`${toFa(metrics.activeDays)} روز فعال`}
        toneKey="violet"
      />
      <StatTile
        icon={<Gauge className="size-4 text-amber-600 dark:text-amber-300" aria-hidden />}
        label="دقت تخمین"
        value={estimation.sufficient && estimation.accuracyPct != null ? `${toFa(estimation.accuracyPct)}٪` : "—"}
        hint={estimation.sufficient ? `${toFa(estimation.samples)} نمونه` : "نمونه کافی نیست"}
        toneKey="amber"
      />
      <StatTile
        icon={<Flame className="size-4 text-cyan-600 dark:text-cyan-300" aria-hidden />}
        label="تمرکز"
        value={`${toFa(Math.round(focus.totalMinutes))} دقیقه`}
        hint={`${toFa(focus.sessions)} جلسه`}
        toneKey="cyan"
      />
      <StatTile
        icon={<CalendarClock className="size-4 text-rose-600 dark:text-rose-300" aria-hidden />}
        label="پایبندی موعد"
        value={deadline.sufficient && deadline.onTimeRate != null ? `${toFa(Math.round(deadline.onTimeRate * 100))}٪` : "—"}
        hint={`${toFa(consistency.activeDays)} روز فعال`}
        toneKey="rose"
      />

      {severityCounts.length > 0 && (
        <div className="col-span-2 flex flex-wrap items-center gap-2 md:col-span-3 xl:col-span-6">
          {severityCounts.map(({ severity, count }) => (
            <span
              key={severity}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 px-2.5 py-1 text-[11px] font-bold"
            >
              <span aria-hidden className={`size-2 rounded-full ${SEVERITY_DOT[severity]}`} />
              {severityLabelFa(severity)}: {toFa(count)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkloadPanel({ intel }: { intel: Intel }) {
  const { workload, metrics } = intel.data;
  return (
    <Panel title="بار کاری" description={windowLabelFa(intel.data.window)}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="روزهای بیش از ظرفیت" value={toFa(workload.overloadedDays)} />
        <Stat label="روزهای سنگین" value={toFa(workload.heavyDays)} />
        <Stat label="بلوک از دست رفته" value={toFa(metrics.missedBlocks)} />
        <Stat label="کارهای جابه‌جاشده" value={toFa(metrics.rescheduledTasks)} />
      </div>
      {workload.trendPct != null && (
        <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
          روند حجم کار برنامه‌ریزی‌شده: {trendLabelFa(workload.trend)} نسبت به نیمه قبلی بازه.
        </p>
      )}
    </Panel>
  );
}

function PlannedPanel({ intel }: { intel: Intel }) {
  const { planned, metrics } = intel.data;
  const pct = planned.adherencePct ?? 0;
  return (
    <Panel title="برنامه در برابر اجرا" description={windowLabelFa(intel.data.window)}>
      <Bar pct={Math.min(100, pct)} toneKey={pct >= 80 ? "emerald" : pct >= 60 ? "blue" : "amber"} className="h-2.5" />
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{planned.interpretation}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="برنامه‌ریزی‌شده" value={`${toFa(Math.round(planned.plannedMinutes))} دقیقه`} />
        <Stat label="زمان‌بندی‌شده" value={`${toFa(Math.round(planned.scheduledMinutes))} دقیقه`} />
        <Stat label="اجراشده" value={`${toFa(Math.round(planned.actualMinutes))} دقیقه`} />
        <Stat label="اختلاف" value={`${toFa(Math.round(Math.abs(planned.varianceMinutes)))} دقیقه`} />
        <Stat label="کارهای عقب‌افتاده" value={toFa(metrics.overdueTasks)} />
        <Stat label="کارهای باز" value={toFa(metrics.openTasks)} />
      </div>
    </Panel>
  );
}

function PatternsPanel({ intel }: { intel: Intel }) {
  const patterns = intel.data.estimation.patterns;
  return (
    <Panel
      title="الگوهای تخمین زمان"
      description="تخمین اصلی هیچ‌وقت بازنویسی نمی‌شود؛ این اعداد فقط برای برنامه‌ریزی آینده‌اند"
    >
      {patterns.length === 0 ? (
        <EmptyHint>
          برای شناسایی الگوی تخمین، به چند اجرای ثبت‌شده با تخمین زمان نیاز است.
        </EmptyHint>
      ) : (
        <ul className="space-y-2.5">
          {patterns.map((pattern) => (
            <li key={pattern.key} className="rounded-2xl border border-border/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12px] font-extrabold">{pattern.label}</span>
                <span className="text-[10px] font-bold text-muted-foreground">
                  {toFa(pattern.samples)} نمونه
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="rounded-lg bg-muted px-2 py-0.5 font-bold">
                  تخمین {toFa(pattern.baseMinutes)} دقیقه
                </span>
                <span className="rounded-lg bg-muted px-2 py-0.5 font-bold">
                  میانگین واقعی {toFa(pattern.actualMinutes)} دقیقه
                </span>
                <span className="rounded-lg bg-primary/10 px-2 py-0.5 font-bold text-primary">
                  تعدیل {pattern.adjustmentMinutes > 0 ? "+" : "−"}
                  {toFa(Math.abs(pattern.adjustmentMinutes))} دقیقه
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{pattern.note}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ExecutionPanel({ intel }: { intel: Intel }) {
  const { metrics, execution } = intel.data;
  return (
    <Panel title="خلاصه اجرا" description={windowLabelFa(intel.data.window)}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="نشست‌های اجرا" value={toFa(metrics.completedSessions)} />
        <Stat label="نشست‌های رهاشده" value={toFa(metrics.abandonedSessions)} />
        <Stat label="بلوک از دست رفته" value={toFa(metrics.missedBlocks)} />
        <Stat label="کارهای به تعویق افتاده" value={toFa(metrics.postponedTasks)} />
        <Stat label="جابه‌جایی برنامه" value={toFa(metrics.rescheduledTasks)} />
        <Stat
          label="برنامه امروز"
          value={execution.snapshot.scheduledMinutes != null ? `${toFa(Math.round(execution.snapshot.scheduledMinutes))} دقیقه` : "—"}
        />
      </div>
    </Panel>
  );
}

function DeviationsPanel({ deviations }: { deviations: DeviationSignal[] }) {
  return (
    <Panel title="انحراف‌های امروز" description="فقط از تفاوت بین برنامه و اجرای واقعی">
      {deviations.length === 0 ? (
        <EmptyHint>امروز انحراف ثبت‌شده‌ای بین برنامه و اجرا وجود ندارد.</EmptyHint>
      ) : (
        <ul className="space-y-2">
          {deviations.slice(0, 6).map((deviation, i) => (
            <li key={`${deviation.kind}-${i}`} className="rounded-xl border border-border/60 px-3 py-2">
              <p className="text-[11px] font-bold">{deviation.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function TimePanel({ intel }: { intel: Intel }) {
  const { time } = intel.data;
  if (time.empty) {
    return (
      <Panel title="توزیع زمان">
        <EmptyHint>برای توزیع زمان، اول چند جلسه اجرا یا تمرکز ثبت کن.</EmptyHint>
      </Panel>
    );
  }
  const groups: Array<{ title: string; slices: typeof time.byType }> = [
    { title: "نوع کار", slices: time.byType },
    { title: "پروژه", slices: time.byProject },
    { title: "هدف", slices: time.byGoal },
  ];
  return (
    <Panel title="توزیع زمان" description={`مجموع ${toFa(Math.round(time.totalMinutes))} دقیقه اجرای واقعی`}>
      <div className="space-y-4">
        {groups
          .filter((group) => group.slices.length > 0)
          .map((group) => (
            <div key={group.title}>
              <h3 className="text-[12px] font-extrabold">{group.title}</h3>
              <ul className="mt-2 space-y-2">
                {group.slices.slice(0, 6).map((slice) => (
                  <li key={slice.key}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold">{slice.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {toFa(Math.round(slice.minutes))} دقیقه — {toFa(slice.pct)}٪
                      </span>
                    </div>
                    <Bar pct={slice.pct} toneKey="cyan" className="mt-1 h-1.5" />
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    </Panel>
  );
}

function ProjectsPanel({ intel }: { intel: Intel }) {
  const projects = intel.data.projects;
  return (
    <Panel title="سلامت پروژه‌ها" description="وضعیت + دلایل قابل بررسی">
      {projects.length === 0 ? (
        <EmptyHint>هنوز پروژه‌ای برای تحلیل وجود ندارد.</EmptyHint>
      ) : (
        <ul className="space-y-2.5">
          {projects.map((project) => (
            <li key={project.projectId} className="rounded-2xl border border-border/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12px] font-extrabold">{project.name}</span>
                <span
                  className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${HEALTH_CHIP[project.health]}`}
                >
                  {HEALTH_LABELS_FA[project.health]}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                <span>پیشرفت {project.progressPct != null ? `${toFa(project.progressPct)}٪` : "—"}</span>
                <span>•</span>
                <span>{toFa(project.openTasks)} کار باز</span>
                <span>•</span>
                <span>{toFa(project.overdueTasks)} عقب‌افتاده</span>
                <span>•</span>
                <span>{toFa(project.blockedTasks)} مسدود</span>
                <span>•</span>
                <span>باقی‌مانده {toFa(Math.round(project.remainingEstimateMinutes))} دقیقه</span>
                {project.daysSinceActivity != null && (
                  <>
                    <span>•</span>
                    <span>آخرین فعالیت {toFa(project.daysSinceActivity)} روز پیش</span>
                  </>
                )}
              </div>
              {project.reasons.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {project.reasons.map((reason) => (
                    <li
                      key={reason}
                      className="rounded-lg bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground"
                    >
                      {reason}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function GoalsPanel({ intel }: { intel: Intel }) {
  const goals = intel.data.goals;
  return (
    <Panel title="سلامت اهداف" description="پیشرفت قابل‌اندازه‌گیری از کارهای واقعی">
      {goals.length === 0 ? (
        <EmptyHint>هنوز هدفی برای تحلیل وجود ندارد.</EmptyHint>
      ) : (
        <ul className="space-y-2.5">
          {goals.map((goal) => (
            <li key={goal.ref} className="rounded-2xl border border-border/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12px] font-extrabold">{goal.title}</span>
                <span className="text-[10px] font-bold text-muted-foreground">
                  {HEALTH_LABELS_FA[goal.health]}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                <span>پیشرفت {toFa(goal.progressPct)}٪</span>
                <span>•</span>
                <span>{toFa(goal.projectCount)} پروژه</span>
                <span>•</span>
                <span>{toFa(goal.openTasks)} کار باز</span>
                {goal.daysSinceActivity != null && (
                  <>
                    <span>•</span>
                    <span>آخرین فعالیت {toFa(goal.daysSinceActivity)} روز پیش</span>
                  </>
                )}
              </div>
              {goal.unmeasurable && (
                <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                  فعالیت قابل‌اندازه‌گیری به این هدف وصل نشده است؛ با اتصال یک پروژه یا کار،
                  پیشرفت آن سنجیده می‌شود.
                </p>
              )}
              {goal.reasons.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {goal.reasons.map((reason) => (
                    <li
                      key={reason}
                      className="rounded-lg bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground"
                    >
                      {reason}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function FocusPanel({ intel }: { intel: Intel }) {
  const { focus } = intel.data;
  return (
    <Panel title="تمرکز" description={windowLabelFa(intel.data.window)}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="زمان تمرکز" value={`${toFa(Math.round(focus.totalMinutes))} دقیقه`} />
        <Stat label="جلسه‌ها" value={toFa(focus.sessions)} />
        <Stat label="میانگین جلسه" value={focus.averageMinutes != null ? `${toFa(focus.averageMinutes)} دقیقه` : "—"} />
        <Stat
          label="جلسه ناتمام"
          value={focus.interruptionRate != null ? `${toFa(Math.round(focus.interruptionRate * 100))}٪` : "—"}
        />
      </div>
      {focus.sufficient ? (
        <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
          {focus.interruptionRate != null
            ? `${toFa(focus.interruptedSessions)} جلسه قبل از پایان متوقف شده است؛ این یک مشاهده رفتاری است و علت آن را سیستم نمی‌داند.`
            : "همه جلسه‌ها به پایان برنامه‌ریزی‌شده رسیده‌اند."}
        </p>
      ) : (
        <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
          برای تحلیل الگوی تمرکز، به حداقل {toFa(5)} جلسه نیاز است.
        </p>
      )}
    </Panel>
  );
}

function TrendsPanel({ intel }: { intel: Intel }) {
  return (
    <Panel title="روندها" description="هر بازه فقط با داده کافی گزارش می‌شود">
      {intel.data.trends.length === 0 ? (
        <EmptyHint>برای تحلیل روند، به داده تاریخی بیشتری نیاز است.</EmptyHint>
      ) : (
        <ul className="space-y-2">
          {intel.data.trends.map((trend) => (
            <li
              key={trend.window}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-[12px] font-extrabold">بازه {windowLabelFa(trend.window)}</p>
                <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">{trend.note}</p>
              </div>
              <span
                className={
                  trend.direction === "up"
                    ? "rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-300"
                    : trend.direction === "down"
                      ? "rounded-lg bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300"
                      : "rounded-lg bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground"
                }
              >
                {trendLabelFa(trend.direction)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function SnapshotsPanel({ intel }: { intel: Intel }) {
  const weeks = intel.data.snapshots.filter((s) => s.period === "week").slice(0, 6);
  return (
    <Panel title="تاریخ هفتگی" description="نمونه‌های ذخیره‌شده برای تحلیل سریع روند">
      {weeks.length === 0 ? (
        <EmptyHint>هنوز هفته کامل‌شده‌ای برای ثبت تاریخچه وجود ندارد.</EmptyHint>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <caption className="sr-only">تاریخچه هفتگی برنامه‌ریزی، اجرا و تمرکز</caption>
            <thead>
              <tr className="text-muted-foreground">
                <th scope="col" className="p-2 text-start font-bold">هفته</th>
                <th scope="col" className="p-2 text-start font-bold">زمان‌بندی‌شده</th>
                <th scope="col" className="p-2 text-start font-bold">اجراشده</th>
                <th scope="col" className="p-2 text-start font-bold">تمرکز</th>
                <th scope="col" className="p-2 text-start font-bold">کارهای انجام‌شده</th>
                <th scope="col" className="p-2 text-start font-bold">پایبندی</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={week.periodKey} className="border-t border-border/50">
                  <td className="p-2 font-bold">{dayFa(week.from)}</td>
                  <td className="p-2 tabular-nums">{toFa(Math.round(week.scheduledMinutes))} د</td>
                  <td className="p-2 tabular-nums">{toFa(Math.round(week.actualMinutes))} د</td>
                  <td className="p-2 tabular-nums">{toFa(Math.round(week.focusMinutes))} د</td>
                  <td className="p-2 tabular-nums">{toFa(week.completedTasks)}</td>
                  <td className="p-2 tabular-nums">
                    {week.scheduleAdherence != null ? `${toFa(Math.round(week.scheduleAdherence * 100))}٪` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
