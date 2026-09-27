/**
 * Planning Center — Phase 10 §20.
 *
 * The one surface that answers «الان چه خبر است؟» quickly:
 *
 *   1. Today's planning state  (workload, buckets, overload signals)
 *   2. Next action             (Phase 09 card — reused, not duplicated)
 *   3. Important deadlines     (facts: every near deadline, incl. persona)
 *   4. Needs attention         (facts: project + goal health + blockers)
 *   5. Planning suggestions    (advice: dismissible, explainable)
 *   6. Planning gaps           (structural gaps — recommendations only)
 *
 * Facts and advice are deliberately separated so nothing appears twice with
 * the same wording. Nothing on this page ever mutates user data.
 */
import { usePlanning, type UsePlanningResult } from "@/hooks/use-planning";
import { NextActionCard } from "@/components/workspace/command/NextActionCard";
import { PlanningSuggestions } from "./PlanningSuggestions";
import { EmptyHint, Panel, Pill } from "@/components/progress/progress-ui";
import {
  HEALTH_LABELS_FA,
  PLANNING_EMPTY_STATE_FA,
  URGENCY_LABELS_FA,
  WORKLOAD_LABELS_FA,
  type HealthState,
  type PlanningRecommendation,
  type SnapshotCriticalItem,
  type UrgencyState,
  type WorkloadState,
} from "@/lib/planning";
import { formatDueFa } from "@/lib/task-utils";
import { toFa } from "@/lib/persian";
import {
  Ban,
  CalendarClock,
  FolderKanban,
  Gauge,
  ListChecks,
  Target,
  TriangleAlert,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Tone maps (label text always accompanies the color — never color-only) */
/* ------------------------------------------------------------------ */

const WORKLOAD_TONE: Record<WorkloadState, "emerald" | "blue" | "amber" | "rose"> = {
  light: "emerald",
  balanced: "blue",
  heavy: "amber",
  overloaded: "rose",
};

const HEALTH_TONE: Record<HealthState, "emerald" | "amber" | "rose" | "slate"> = {
  healthy: "emerald",
  completed: "emerald",
  needs_attention: "amber",
  at_risk: "rose",
  blocked: "slate",
};

const URGENCY_TONE: Record<UrgencyState, "rose" | "amber" | "blue" | "slate"> = {
  overdue: "rose",
  critical: "rose",
  due_soon: "amber",
  upcoming: "blue",
  flexible: "slate",
  no_deadline: "slate",
};

const KIND_LABELS_FA: Record<string, string> = {
  task: "کار",
  exam: "آزمون",
  assignment: "تکلیف",
  deliverable: "تحویل",
  invoice: "صورتحساب",
  milestone: "گام پروژه",
  initiative: "ابتکار",
  meeting: "جلسه",
};

function hoursFa(minutes: number | null): string {
  if (minutes === null) return "—";
  const h = Math.round(minutes / 30) / 2;
  return `${toFa(h)} ساعت`;
}

/* ------------------------------------------------------------------ */
/* 1 — Today's state                                                   */
/* ------------------------------------------------------------------ */

function DayStatePanel({ plan }: { plan: UsePlanningResult }) {
  const { result } = plan;
  const { workload, buckets, overloadSignals, snapshot } = result;

  const dayCount =
    buckets.mustDo.length + buckets.shouldDo.length + buckets.couldDo.length;

  const chips = [
    { key: "must", label: "باید انجام شود", count: buckets.mustDo.length, tone: "rose" as const },
    { key: "should", label: "مهم", count: buckets.shouldDo.length, tone: "blue" as const },
    { key: "could", label: "انعطاف‌پذیر", count: buckets.couldDo.length, tone: "slate" as const },
    { key: "deferred", label: "برای روزهای بعد", count: buckets.deferred.length, tone: "violet" as const },
    { key: "blocked", label: "مسدود", count: buckets.blocked.length, tone: "amber" as const },
  ];

  const stats = [
    { icon: ListChecks, label: "کارهای امروز", value: dayCount },
    { icon: TriangleAlert, label: "عقب‌افتاده", value: snapshot.overdueCount },
    { icon: CalendarClock, label: "نزدیک موعد", value: snapshot.dueSoonCount },
    { icon: Ban, label: "مسدود", value: snapshot.blockers.length },
  ];

  return (
    <Panel
      title="وضعیت امروز"
      icon={<Gauge className="size-4 text-primary" aria-hidden />}
      description="بار کاری، سطل‌های امروز و تعارض‌های برنامه‌ریزی"
      action={
        <Pill toneKey={WORKLOAD_TONE[workload.state]}>
          بار: {WORKLOAD_LABELS_FA[workload.state]}
        </Pill>
      }
    >
      <div className="space-y-4">
        {/* Workload explanation — honest about missing data */}
        {workload.confidence === "insufficient" ? (
          <EmptyHint>{PLANNING_EMPTY_STATE_FA}</EmptyHint>
        ) : (
          <div>
            <p className="text-[12px] leading-6">{workload.explanation}</p>
            <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <li>تخمین کارها: {hoursFa(workload.estimatedMinutes)}</li>
              <li>تعهد زمانی: {hoursFa(workload.occupiedMinutes)}</li>
              <li>ظرفیت فرضی روز: {hoursFa(workload.capacityMinutes)}</li>
            </ul>
          </div>
        )}

        {/* Counts */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border/60 bg-white/50 px-3 py-2 dark:bg-white/5"
            >
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                <s.icon className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{s.label}</span>
              </div>
              <div className="mt-0.5 text-lg font-extrabold tabular-nums">
                {toFa(s.value)}
              </div>
            </div>
          ))}
        </div>

        {/* Bucket strip — every chip is labeled, never color-only */}
        <div>
          <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">
            سطل‌های برنامه امروز
          </p>
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <Pill key={c.key} toneKey={c.tone}>
                {c.label}: {toFa(c.count)}
              </Pill>
            ))}
          </div>
        </div>

        {/* Overload signals — explained, never auto-fixed */}
        {overloadSignals.length > 0 && (
          <div className="rounded-xl border border-amber-200/70 bg-amber-50/70 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
            <p className="flex items-center gap-1.5 text-[11px] font-extrabold text-amber-700 dark:text-amber-300">
              <TriangleAlert className="size-3.5" aria-hidden />
              تعارض‌های احتمالی برنامه
            </p>
            <ul className="mt-1.5 space-y-1">
              {overloadSignals.map((s) => (
                <li
                  key={s.key}
                  className="flex gap-2 text-[11px] leading-5 text-amber-800/90 dark:text-amber-200/90"
                >
                  <span aria-hidden>•</span>
                  <span>{s.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* 3 — Deadlines (facts)                                               */
/* ------------------------------------------------------------------ */

function DeadlinesPanel({ plan }: { plan: UsePlanningResult }) {
  const items = plan.result.snapshot.criticalItems;

  return (
    <Panel
      title="موعدهای مهم"
      icon={<CalendarClock className="size-4 text-amber-500" aria-hidden />}
      description="عقب‌افتاده‌ها و موعدهای نزدیک — از روی تاریخ‌های واقعی"
    >
      {items.length === 0 ? (
        <EmptyHint>
          مهلت نزدیکی ثبت نشده — کارها و رویدادهایت را تاریخ‌دار کن تا هشدار
          بگیری.
        </EmptyHint>
      ) : (
        <ul className="space-y-2">
          {items.map((item: SnapshotCriticalItem) => (
            <li
              key={`${item.kind}:${item.id}`}
              className="flex items-center gap-2 rounded-xl border border-border/60 bg-white/50 px-3 py-2 dark:bg-white/5"
            >
              <Pill toneKey={URGENCY_TONE[item.urgency]}>
                {URGENCY_LABELS_FA[item.urgency]}
              </Pill>
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">
                {item.title}
              </span>
              <span className="shrink-0 text-[10px] font-bold text-muted-foreground">
                {KIND_LABELS_FA[item.kind] ?? "کار"}
              </span>
              {item.dueDate && (
                <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">
                  {formatDueFa(item.dueDate)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* 4 — Needs attention (facts) + blockers                              */
/* ------------------------------------------------------------------ */

function AttentionPanel({ plan }: { plan: UsePlanningResult }) {
  const { result } = plan;
  const { projectRisks, goalRisks } = result.snapshot;
  const blocked = result.buckets.blocked;
  const allClear = projectRisks.length === 0 && goalRisks.length === 0;

  return (
    <Panel
      title="نیازمند توجه"
      icon={<Target className="size-4 text-rose-500" aria-hidden />}
      description="سلامت پروژه‌ها و اهداف، به‌همراه کارهای مسدود"
    >
      <div className="space-y-4">
        {allClear && blocked.length === 0 ? (
          <EmptyHint>
            پروژه‌ها و اهدافت در مسیر سالم‌اند — چیزی نیازمند توجه فوری نیست.
          </EmptyHint>
        ) : (
          <>
            {projectRisks.length > 0 && (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                  <FolderKanban className="size-3.5" aria-hidden />
                  پروژه‌ها
                </p>
                <ul className="space-y-1.5">
                  {projectRisks.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-xl border border-border/60 bg-white/50 px-3 py-2 dark:bg-white/5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-[12px] font-bold">
                          {r.title}
                        </span>
                        <Pill toneKey={HEALTH_TONE[r.state]}>
                          {HEALTH_LABELS_FA[r.state]}
                        </Pill>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                        {r.reason}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {goalRisks.length > 0 && (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                  <Target className="size-3.5" aria-hidden />
                  اهداف
                </p>
                <ul className="space-y-1.5">
                  {goalRisks.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-xl border border-border/60 bg-white/50 px-3 py-2 dark:bg-white/5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-[12px] font-bold">
                          {r.title}
                        </span>
                        <Pill toneKey={HEALTH_TONE[r.state]}>
                          {HEALTH_LABELS_FA[r.state]}
                        </Pill>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                        {r.reason}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {blocked.length > 0 && (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                  <Ban className="size-3.5" aria-hidden />
                  مسدود — قابل پیشرفت نیست
                </p>
                <ul className="space-y-1.5">
                  {blocked.map((b) => (
                    <li
                      key={b.task._id}
                      className="rounded-xl border border-dashed border-border/70 px-3 py-2"
                    >
                      <p className="text-[12px] font-bold">{b.task.title}</p>
                      <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                        {b.reason}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Types rendered in their own sections — excluded from suggestions    */
/* ------------------------------------------------------------------ */

const SECTION_OWNED_TYPES = new Set<PlanningRecommendation["type"]>([
  "NEXT_ACTION", // dedicated Next Action card
  "BLOCKED_TASK", // blocked list above
  "PROJECT_ATTENTION", // attention facts above
  "GOAL_ATTENTION", // attention facts above
  "PLANNING_GAP", // gaps section below
  "MISSING_NEXT_ACTION", // gaps section below
]);

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function PlanningCenter() {
  const plan = usePlanning();
  const { result, recommendations, dismiss } = plan;
  const advice = recommendations.filter((r) => !SECTION_OWNED_TYPES.has(r.type));
  const gaps = recommendations.filter(
    (r) => r.type === "PLANNING_GAP" || r.type === "MISSING_NEXT_ACTION",
  );

  return (
    <div className="space-y-5">
      {/* Row 1 — state + next action */}
      <div className="grid gap-5 lg:grid-cols-2">
        <DayStatePanel plan={plan} />
        <NextActionCard />
      </div>

      {/* Row 2 — facts: deadlines + attention */}
      <div className="grid gap-5 lg:grid-cols-2">
        <DeadlinesPanel plan={plan} />
        <AttentionPanel plan={plan} />
      </div>

      {/* Advice — today's plan, scheduling, review */}
      <PlanningSuggestions
        recommendations={advice}
        onDismiss={dismiss}
        limit={8}
        showEmpty={result.recommendations.length === 0}
        title="پیشنهادهای برنامه‌ریزی"
      />

      {/* Structural gaps — only when they exist */}
      {gaps.length > 0 && (
        <PlanningSuggestions
          recommendations={gaps}
          onDismiss={dismiss}
          limit={5}
          title="گپ‌های برنامه‌ریزی"
          description="چیزهایی که هنوز به هم وصل نشده‌اند — فقط پیشنهاد، هیچ اجباری"
        />
      )}
    </div>
  );
}
