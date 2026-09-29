/**
 * Weekly + monthly productivity reviews (Phase 13 §23 / §24).
 *
 * Both reviews are DERIVED, never authored: every line is either an analysis
 * sentence the engine already produced, an observable evidence pair from an
 * insight, or a count straight from the metric layer. Nothing is invented and
 * nothing is judged — the sections answer the four questions the spec asks:
 *
 *   چه چیزی تغییر کرد؟ / چه چیزی کار کرد؟ / چه چیزی نیاز به توجه دارد؟ /
 *   چه چیزی را تنظیم کنیم؟
 *
 * Sample protection is inherited: below the thresholds the review says that
 * data is still being collected instead of showing a number (§32 / §33).
 */
import { countFa, hoursFa, minutesFa, pctFa } from "./format";
import { deadlineSummaryFa } from "./deadline";
import { estimationSummaryFa } from "./estimation";
import { focusSummaryFa } from "./focus";
import { workloadTrendFa } from "./workload";
import { INTELLIGENCE_THRESHOLDS } from "./types";
import type {
  ConsistencyAnalysis,
  DeadlineReliability,
  EstimationProfile,
  FocusAnalysis,
  GoalIntelligence,
  Insight,
  PlannedVsActual,
  ProductivityMetrics,
  ProductivityReview,
  ProjectIntelligence,
  ReviewSection,
  TimeDistribution,
  TrendWindow,
  WorkloadProfile,
} from "./types";

export interface ReviewInput {
  dayKey: string;
  from: string;
  to: string;
  days: number;
  persona: string;
  metrics: ProductivityMetrics;
  planned: PlannedVsActual;
  estimation: EstimationProfile;
  workload: WorkloadProfile;
  projects: ProjectIntelligence[];
  goals: GoalIntelligence[];
  focus: FocusAnalysis;
  consistency: ConsistencyAnalysis;
  deadline: DeadlineReliability;
  time: TimeDistribution;
  trends: TrendWindow[];
  insights: Insight[];
}

function positiveInsights(insights: Insight[]): Insight[] {
  return insights.filter((i) => i.severity === "positive").slice(0, 3);
}

function attentionInsights(insights: Insight[]): Insight[] {
  return insights.filter((i) => i.severity === "critical" || i.severity === "warning").slice(0, 4);
}

function hasSignal(input: ReviewInput): boolean {
  return (
    input.metrics.completedTasks > 0 ||
    input.metrics.actualMinutes > 0 ||
    input.metrics.activeDays > 0 ||
    input.insights.length > 0
  );
}

const COLLECTING_LINE =
  "برای تحلیل دقیق این بخش، چند روز فعالیت بیشتر لازم است. سیستم همین حالا هم در حال جمع‌آوری داده است.";

/* ------------------------------------------------------------------ */
/* Weekly (§23)                                                        */
/* ------------------------------------------------------------------ */

export function buildWeeklyReview(input: ReviewInput): ProductivityReview {
  const stats: ProductivityReview["stats"] = [
    {
      label: "برنامه‌ریزی",
      value:
        input.consistency.planningConsistency != null
          ? pctFa(Math.round(input.consistency.planningConsistency * 100))
          : "—",
    },
    { label: "اجرا", value: input.planned.adherencePct != null ? pctFa(input.planned.adherencePct) : "—" },
    { label: "تمرکز", value: hoursFa(input.focus.totalMinutes) },
    { label: "کارهای انجام‌شده", value: countFa(input.metrics.completedTasks) },
    {
      label: "پروژه‌های نیازمند توجه",
      value: countFa(
        input.projects.filter((p) => p.health === "at_risk" || p.health === "blocked" || p.health === "needs_attention").length,
      ),
    },
    { label: "اهداف فعال", value: countFa(input.goals.filter((g) => !g.unmeasurable).length) },
  ];

  /* چه چیزی تغییر کرد؟ */
  const changed: string[] = [workloadTrendFa(input.workload, input.days)];
  if (input.planned.sufficient && input.planned.adherencePct != null) {
    changed.push(
      `${pctFa(input.planned.adherencePct)} از زمان زمان‌بندی‌شده به اجرای واقعی تبدیل شده است (${hoursFa(
        input.planned.scheduledMinutes,
      )} زمان‌بندی‌شده، ${hoursFa(input.planned.actualMinutes)} اجراشده).`,
    );
  }
  if (input.estimation.sufficient) {
    changed.push(estimationSummaryFa(input.estimation, input.days));
  }
  const trend = input.trends.find((t) => t.window === "14d" && t.sufficient)
    ?? input.trends.find((t) => t.sufficient);
  if (trend && trend.direction !== "insufficient") changed.push(trend.note);

  /* چه چیزی کار کرد؟ */
  const worked: string[] = [];
  for (const insight of positiveInsights(input.insights)) worked.push(`${insight.title} — ${insight.description}`);
  if (input.focus.totalMinutes > 0 && worked.length < 3) worked.push(focusSummaryFa(input.focus));
  if (
    input.deadline.sufficient &&
    input.deadline.onTimeRate != null &&
    input.deadline.onTimeRate >= 0.9 &&
    worked.length < 3
  ) {
    worked.push(deadlineSummaryFa(input.deadline));
  }

  /* چه چیزی نیاز به توجه دارد؟ */
  const attention: string[] = [];
  for (const insight of attentionInsights(input.insights)) {
    const evidence = insight.evidence[0];
    attention.push(evidence ? `${insight.title} (${evidence.label}: ${evidence.value})` : insight.title);
  }

  /* چه چیزی را تنظیم کنیم؟ */
  const adjust: string[] = [];
  for (const pattern of input.estimation.patterns.slice(0, 2)) {
    adjust.push(
      `تخمین «${pattern.label}» را از ${minutesFa(pattern.baseMinutes)} به حدود ${minutesFa(
        pattern.actualMinutes,
      )} تغییر بده (بر پایه ${countFa(pattern.samples)} اجرا).`,
    );
  }
  if (input.workload.overloadedDays >= INTELLIGENCE_THRESHOLDS.workloadOverloadDays) {
    adjust.push(
      `${countFa(input.workload.overloadedDays)} روز بیش از ظرفیت واقعی بارگذاری شده بود؛ پیش از افزودن کار جدید، ظرفیت روزانه را بازبینی کن.`,
    );
  }
  const stalled = input.goals.filter(
    (g) => !g.unmeasurable && g.daysSinceActivity != null && g.daysSinceActivity >= INTELLIGENCE_THRESHOLDS.goalStagnationDays,
  );
  for (const goal of stalled.slice(0, 2)) {
    adjust.push(`هدف «${goal.title}» در ${countFa(goal.daysSinceActivity!)} روز گذشته پیشرفتی ثبت نکرده؛ یک قدم کوچک برایش تعریف کن یا هدف را بازبینی کن.`);
  }
  if (input.metrics.overdueTasks >= 3) {
    adjust.push(
      `${countFa(input.metrics.overdueTasks)} کار از موعد گذشته است؛ در برنامه هفته آینده برای آن‌ها جای واقعی باز کن.`,
    );
  }

  const sections: ReviewSection[] = [
    {
      title: "چه چیزی تغییر کرد؟",
      lines: changed.length > 0 ? changed : [COLLECTING_LINE],
    },
    {
      title: "چه چیزی کار کرد؟",
      lines: worked.length > 0 ? worked : [COLLECTING_LINE],
    },
    {
      title: "چه چیزی نیاز به توجه دارد؟",
      lines: attention.length > 0 ? attention : ["در این بازه مورد قابل‌توجهی ثبت نشده است."],
    },
    {
      title: "چه چیزی را تنظیم کنیم؟",
      lines: adjust.length > 0 ? adjust : ["مورد فوری برای تنظیم نیست؛ همین روند را ادامه بده."],
    },
  ];

  return {
    period: "week",
    from: input.from,
    to: input.to,
    stats,
    sections,
    sufficient: hasSignal(input),
  };
}

/* ------------------------------------------------------------------ */
/* Monthly (§24)                                                       */
/* ------------------------------------------------------------------ */

export function buildMonthlyReview(input: ReviewInput): ProductivityReview {
  const stats: ProductivityReview["stats"] = [
    { label: "زمان اجراشده", value: hoursFa(input.metrics.actualMinutes) },
    { label: "کارهای انجام‌شده", value: countFa(input.metrics.completedTasks) },
    { label: "روزهای فعال", value: `${countFa(input.consistency.activeDays)} از ${countFa(input.days)}` },
    { label: "دقت تخمین", value: input.estimation.accuracyPct != null ? pctFa(input.estimation.accuracyPct) : "—" },
    {
      label: "پایبندی به موعد",
      value: input.deadline.onTimeRate != null ? pctFa(Math.round(input.deadline.onTimeRate * 100)) : "—",
    },
    { label: "تمرکز", value: hoursFa(input.focus.totalMinutes) },
  ];

  /* نمای کلی */
  const overview: string[] = [];
  if (input.planned.sufficient && input.planned.adherencePct != null) {
    overview.push(
      `در این بازه ${hoursFa(input.planned.plannedMinutes)} کار برنامه‌ریزی شد، ${hoursFa(
        input.planned.scheduledMinutes,
      )} زمان‌بندی شد و ${hoursFa(input.planned.actualMinutes)} واقعاً اجرا شد.`,
    );
  }
  overview.push(workloadTrendFa(input.workload, input.days));
  if (input.deadline.sufficient) overview.push(deadlineSummaryFa(input.deadline));
  if (input.consistency.sufficient) {
    overview.push(
      `در ${countFa(input.consistency.activeDays)} روز از ${countFa(input.days)} روز فعالیت ثبت شده است (${countFa(
        input.consistency.executionDays,
      )} روز اجرا، ${countFa(input.consistency.planningDays)} روز برنامه‌ریزی).`,
    );
  }
  if (input.consistency.weeklyReviewsLast30 > 0) {
    overview.push(
      `در این بازه ${countFa(input.consistency.weeklyReviewsLast30)} مرور هفتگی ثبت شده است.`,
    );
  }

  /* پروژه‌ها */
  const projectLines: string[] = [];
  const byActivity = [...input.projects].sort(
    (a, b) => b.completedLast14 - a.completedLast14 || a.name.localeCompare(b.name),
  );
  for (const project of byActivity.slice(0, 3)) {
    if (project.completedLast14 === 0 && project.openTasks === 0) continue;
    projectLines.push(
      `«${project.name}»: ${countFa(project.completedLast14)} کار در ۱۴ روز گذشته، ${countFa(
        project.openTasks,
      )} کار باز، پیشرفت ${pctFa(project.progressPct)}${
        project.overdueTasks > 0 ? `، ${countFa(project.overdueTasks)} کار عقب‌افتاده` : ""
      }.`,
    );
  }
  const atRisk = input.projects.filter((p) => p.health === "at_risk" || p.health === "blocked");
  for (const project of atRisk.slice(0, 2)) {
    projectLines.push(
      `«${project.name}» ${project.health === "blocked" ? "در وضعیت مسدود" : "در معرض تأخیر"} است${
        project.reasons[0] ? ` — ${project.reasons[0]}` : ""
      }.`,
    );
  }

  /* اهداف */
  const goalLines: string[] = [];
  for (const goal of input.goals.slice(0, 4)) {
    if (goal.unmeasurable) {
      goalLines.push(`«${goal.title}» فعالیت قابل‌اندازه‌گیری وصل‌شده ندارد؛ پیشرفت آن سنجیده نمی‌شود.`);
      continue;
    }
    goalLines.push(
      `«${goal.title}»: پیشرفت ${pctFa(goal.progressPct)}، ${countFa(
        goal.completedLast14,
      )} کار در ۱۴ روز گذشته${
        goal.daysSinceActivity != null ? `، آخرین فعالیت ${countFa(goal.daysSinceActivity)} روز پیش` : ""
      }.`,
    );
  }

  /* زمان و تمرکز */
  const timeLines: string[] = [];
  if (!input.time.empty) {
    timeLines.push(`مجموع زمان اجراشده در این بازه ${hoursFa(input.time.totalMinutes)} بوده است.`);
    for (const slice of input.time.byType.slice(0, 3)) {
      timeLines.push(`«${slice.label}»: ${hoursFa(slice.minutes)} (${pctFa(slice.pct)}).`);
    }
    for (const slice of input.time.byProject.slice(0, 2)) {
      timeLines.push(`پروژه «${slice.label}»: ${hoursFa(slice.minutes)} (${pctFa(slice.pct)}).`);
    }
  }
  if (input.focus.totalMinutes > 0) timeLines.push(focusSummaryFa(input.focus));
  if (input.focus.bestDay) {
    timeLines.push(
      `پرتمرکزترین روز این بازه ${input.focus.bestDay.day} با ${hoursFa(input.focus.bestDay.minutes)} تمرکز بوده است.`,
    );
  }

  /* تنظیم برای ماه آینده */
  const adjust: string[] = [];
  for (const pattern of input.estimation.patterns.slice(0, 3)) {
    adjust.push(
      `تخمین «${pattern.label}» را از ${minutesFa(pattern.baseMinutes)} به حدود ${minutesFa(
        pattern.actualMinutes,
      )} تغییر بده.`,
    );
  }
  for (const goal of input.goals
    .filter(
      (g) => !g.unmeasurable && g.daysSinceActivity != null && g.daysSinceActivity >= INTELLIGENCE_THRESHOLDS.goalStagnationDays,
    )
    .slice(0, 2)) {
    adjust.push(`هدف «${goal.title}» را بازبینی کن: ${countFa(goal.daysSinceActivity!)} روز بدون پیشرفت ثبت‌شده.`);
  }
  if (input.workload.overloadedDays >= INTELLIGENCE_THRESHOLDS.workloadOverloadDays) {
    adjust.push(
      `در ${countFa(input.workload.overloadedDays)} روز حجم کار از ظرفیت عبور کرده است؛ ظرفیت روزانه را واقع‌بینانه‌تر تنظیم کن.`,
    );
  }
  if (input.metrics.rescheduledTasks > 0) {
    adjust.push(
      `در این بازه ${countFa(input.metrics.rescheduledTasks)} کار جابه‌جا شده است؛ بلوک‌های زمانی کوتاه‌تر و واقع‌بینانه‌تر معمولاً این عدد را کم می‌کند.`,
    );
  }

  const sections: ReviewSection[] = [
    { title: "نمای کلی ماه", lines: overview.length > 0 ? overview : [COLLECTING_LINE] },
    { title: "پروژه‌ها", lines: projectLines.length > 0 ? projectLines : [COLLECTING_LINE] },
    { title: "اهداف", lines: goalLines.length > 0 ? goalLines : ["هنوز هدفی برای گزارش ثبت نشده است."] },
    { title: "زمان و تمرکز", lines: timeLines.length > 0 ? timeLines : [COLLECTING_LINE] },
    { title: "تنظیم برای ماه آینده", lines: adjust.length > 0 ? adjust : ["مورد فوری برای تنظیم نیست."] },
  ];

  return {
    period: "month",
    from: input.from,
    to: input.to,
    stats,
    sections,
    /* A monthly review needs a real month of history before it is shown (§24). */
    sufficient: input.days >= 30 && hasSignal(input),
  };
}
