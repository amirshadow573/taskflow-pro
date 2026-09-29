/**
 * InsightEngine (Phase 13 §17 / §18 / §19 / §25 / §26).
 *
 * Turns the analyses into a small set of DETERMINISTIC, EXPLAINABLE, ACTIONABLE
 * insights:
 *
 *   - every insight is guarded by a minimum-sample threshold (§33),
 *   - every insight carries evidence the user can verify (§18),
 *   - every insight describes DATA, never personality (§18),
 *   - near-duplicates are collapsed (`scope` keys) so the user never sees five
 *     cards saying the same thing (§18 non-duplicative),
 *   - ordering is by practical relevance — deadline → project → goal →
 *     workload → recovery → estimation → planning → … (§19) — NOT a score.
 *
 * The engine only reads analyses; it never recomputes or mutates anything.
 */
import type { ExecutionRecommendation } from "@/lib/execution";
import type {
  ConsistencyAnalysis,
  DeadlineReliability,
  EstimationProfile,
  FocusAnalysis,
  GoalIntelligence,
  Insight,
  InsightAction,
  InsightEvidence,
  InsightSeverity,
  InsightType,
  PlannedVsActual,
  ProductivityMetrics,
  ProjectIntelligence,
  TimeDistribution,
  TimeWindow,
  WorkloadProfile,
} from "./types";
import {
  INSIGHT_CATEGORY_BY_TYPE,
  INSIGHT_PRIORITY_WEIGHT,
  INSIGHT_SEVERITY_BONUS,
  INTELLIGENCE_THRESHOLDS,
  MAX_INSIGHTS,
  WORKLOAD_LABELS_FA,
} from "./types";
import { countFa, dayFa, deliverableStatusFa, hoursFa, minutesFa, pctFa, ratioPctFa } from "./format";
import type { PersonaSignals } from "./input";
import { deadlineSummaryFa } from "./deadline";
import { estimationSummaryFa } from "./estimation";
import { focusSummaryFa, interruptionSummaryFa } from "./focus";
import { consistencySummaryFa } from "./consistency";
import { workloadTrendFa } from "./workload";

export interface InsightEngineInput {
  dayKey: string;
  persona: string;
  window: TimeWindow;
  days: number;
  nowMs: number;
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
  executionRecommendations: ExecutionRecommendation[];
  schedule: { conflicts: number; unscheduledTasks: number };
  personaSignals?: PersonaSignals;
}

interface Draft {
  type: InsightType;
  scope: string;
  severity: InsightSeverity;
  title: string;
  description: string;
  evidence: InsightEvidence[];
  metric: string;
  affected?: Insight["affected"];
  /** Observational insights may offer no action at all (§18 actionable *where appropriate*). */
  actions?: InsightAction[];
  confidence: Insight["confidence"];
  signals: string[];
  /** Extra ranking nudge (e.g. urgency), added on top of the type weight. */
  weight?: number;
}

const LINK_TODAY = "/today";
const LINK_PLANNING = "/planning";
const LINK_PROJECTS = "/projects";
const LINK_DASHBOARD = "/dashboard";
const LINK_OVERDUE = "/tasks?filter=overdue";

function actionOpen(label: string, to: string): InsightAction {
  return { kind: "open_insights", label, to };
}

export function buildInsights(input: InsightEngineInput): Insight[] {
  const drafts: Draft[] = [];
  const T = INTELLIGENCE_THRESHOLDS;

  const add = (draft: Draft) => drafts.push(draft);

  /* ---------------------------------------------------------------- */
  /* 1 — DEADLINE reliability + overdue load (§12 / §19 highest weight) */
  /* ---------------------------------------------------------------- */
  if (input.deadline.sufficient && input.deadline.onTimeRate !== null) {
    const pct = Math.round(input.deadline.onTimeRate * 100);
    add({
      type: "DEADLINE",
      scope: "reliability",
      severity: pct >= 90 ? "positive" : pct >= 75 ? "info" : "warning",
      title: pct >= 90 ? "موعدها قابل‌اعتماد پیش می‌روند" : "بخشی از کارهای دارای موعد دیر انجام می‌شوند",
      description: deadlineSummaryFa(input.deadline),
      evidence: [
        { label: "انجام‌شده در موعد", value: `${countFa(input.deadline.onTime)} از ${countFa(input.deadline.completed)}` },
        { label: "نرخ پایبندی", value: pctFa(pct) },
        {
          label: "میانگین تأخیر",
          value: input.deadline.averageDelayDays != null ? `${countFa(input.deadline.averageDelayDays)} روز` : "—",
        },
      ],
      metric: "deadline.onTimeRate",
      actions: [actionOpen("کارهای دارای موعد", LINK_OVERDUE)],
      confidence: "high",
      signals: ["deadline_reliability", input.window],
    });
  }

  if (input.metrics.overdueTasks >= 3) {
    add({
      type: "DEADLINE",
      scope: "overdue_load",
      severity: input.metrics.overdueTasks >= 6 ? "critical" : "warning",
      title: `${countFa(input.metrics.overdueTasks)} کار با موعد گذشته هنوز باز است`,
      description: `در ${countFa(input.metrics.days)} روز گذشته، ${countFa(
        input.metrics.overdueTasks,
      )} کار از موعدشان گذشته و هنوز تمام نشده‌اند. این عدد از تاریخ موعد خود کارها محاسبه شده است.`,
      evidence: [
        { label: "کارهای عقب‌افتاده", value: countFa(input.metrics.overdueTasks) },
        { label: "کل کارهای باز", value: countFa(input.metrics.openTasks) },
      ],
      metric: "metrics.overdueTasks",
      actions: [actionOpen("دیدن کارهای عقب‌افتاده", LINK_OVERDUE), actionOpen("بازیابی در امروز", LINK_TODAY)],
      confidence: "high",
      signals: ["overdue", "deadline"],
      weight: Math.min(10, input.metrics.overdueTasks),
    });
  }

  /* ---------------------------------------------------------------- */
  /* 2 — PROJECT risk (§9)                                             */
  /* ---------------------------------------------------------------- */
  const riskyProjects = input.projects
    .filter((p) => p.health === "at_risk" || p.health === "blocked" || p.health === "needs_attention")
    .filter((p) => p.overdueTasks > 0 || p.blockedTasks > 0 || p.openTasks >= T.projectTasks)
    .sort(
      (a, b) =>
        (b.overdueTasks + b.blockedTasks) - (a.overdueTasks + a.blockedTasks) ||
        b.remainingEstimateMinutes - a.remainingEstimateMinutes,
    )
    .slice(0, 3);

  for (const project of riskyProjects) {
    const critical = project.health === "at_risk" || project.health === "blocked";
    add({
      type: "PROJECT_RISK",
      scope: `project:${project.projectId}`,
      severity: critical ? "critical" : "warning",
      title: `پروژه «${project.name}» ${critical ? "در معرض خطر است" : "نیاز به توجه دارد"}`,
      description: project.reasons[0]
        ? `${project.reasons.join(" · ")} — ${countFa(project.openTasks)} کار باز با مجموع تخمین ${minutesFa(
            project.remainingEstimateMinutes,
          )} باقی مانده است.`
        : `${countFa(project.overdueTasks)} کار عقب‌افتاده و ${countFa(
            project.blockedTasks,
          )} کار مسدود دارد؛ مجموع کار باقی‌مانده ${minutesFa(project.remainingEstimateMinutes)} است.`,
      evidence: [
        { label: "پیشرفت", value: pctFa(project.progressPct) },
        { label: "عقب‌افتاده", value: countFa(project.overdueTasks) },
        { label: "مسدود", value: countFa(project.blockedTasks) },
        { label: "کار باقی‌مانده", value: minutesFa(project.remainingEstimateMinutes) },
        {
          label: "آخرین فعالیت",
          value:
            project.lastActivityDay != null
              ? `${dayFa(project.lastActivityDay)}${project.daysSinceActivity != null ? ` (${countFa(project.daysSinceActivity)} روز پیش)` : ""}`
              : "ثبت نشده",
        },
      ],
      metric: "projects.health",
      affected: { projectId: project.projectId },
      actions: [actionOpen("دیدن پروژه", `${LINK_PROJECTS}/${project.projectId}`), actionOpen("برنامه‌ریزی", LINK_PLANNING)],
      confidence: critical ? "high" : "medium",
      signals: ["project_health", ...project.signals],
      weight: critical ? 6 : 2,
    });
  }

  /* ---------------------------------------------------------------- */
  /* 3 — GOAL stagnation (§10 / §11)                                   */
  /* ---------------------------------------------------------------- */
  const stalledGoals = input.goals
    .filter((g) => !g.unmeasurable)
    .filter((g) => g.daysSinceActivity != null && g.daysSinceActivity >= T.goalStagnationDays)
    .sort((a, b) => (b.daysSinceActivity ?? 0) - (a.daysSinceActivity ?? 0))
    .slice(0, 2);

  for (const goal of stalledGoals) {
    add({
      type: "GOAL_STAGNATION",
      scope: `goal:${goal.ref}`,
      severity: goal.daysSinceActivity! >= 21 ? "warning" : "info",
      title: `هدف «${goal.title}» در ${countFa(goal.daysSinceActivity!)} روز گذشته پیشرفتی ثبت نکرده`,
      description: `آخرین فعالیت قابل‌مشاهده این هدف ${dayFa(
        goal.lastActivityDay!,
      )} بوده است. این یک مشاهده است، نه قضاوت — اگر هدف هنوز مهم است، یک قدم کوچک کافی است.`,
      evidence: [
        { label: "آخرین فعالیت", value: dayFa(goal.lastActivityDay!) },
        { label: "کارهای باز", value: countFa(goal.openTasks) },
        { label: "پروژه‌های متصل", value: countFa(goal.projectCount) },
        { label: "پیشرفت", value: pctFa(goal.progressPct) },
      ],
      metric: "goals.daysSinceActivity",
      affected: { goalRef: goal.ref },
      actions: [actionOpen("دیدن هدف", LINK_DASHBOARD), actionOpen("تنظیم برنامه", LINK_PLANNING)],
      confidence: "high",
      signals: ["goal_stagnation", "observable_history"],
      weight: Math.min(8, goal.daysSinceActivity!),
    });
  }

  const unmeasurableGoals = input.goals.filter((g) => g.unmeasurable).slice(0, 1);
  for (const goal of unmeasurableGoals) {
    add({
      type: "GOAL_STAGNATION",
      scope: `goal_unmeasured:${goal.ref}`,
      severity: "info",
      title: `هدف «${goal.title}» فعالیت قابل‌اندازه‌گیری ندارد`,
      description:
        "هیچ پروژه یا کاری به این هدف وصل نیست، پس سیستم نمی‌تواند پیشرفت واقعی آن را بسنجد. اتصال یک پروژه یا کار، پیشرفت را قابل‌اندازه‌گیری می‌کند.",
      evidence: [
        { label: "پروژه‌های متصل", value: "۰" },
        { label: "کارهای متصل", value: "۰" },
      ],
      metric: "goals.measurable",
      affected: { goalRef: goal.ref },
      actions: [actionOpen("دیدن هدف", LINK_DASHBOARD)],
      confidence: "high",
      signals: ["goal_unmeasurable"],
    });
  }

  /* ---------------------------------------------------------------- */
  /* 4 — WORKLOAD (§7 / §8)                                            */
  /* ---------------------------------------------------------------- */
  if (input.workload.overloadedDays >= T.workloadOverloadDays) {
    add({
      type: "WORKLOAD",
      scope: "overload",
      severity: input.workload.overloadedDays >= 5 ? "critical" : "warning",
      title: `${countFa(input.workload.overloadedDays)} روز بیش از ظرفیت واقعی بارگذاری شده است`,
      description: `در ${countFa(input.days)} روز گذشته، ${countFa(
        input.workload.overloadedDays,
      )} روز کار برنامه‌ریزی‌شده از ظرفیت روزانه عبور کرده است${
        input.workload.todayAvailableMinutes != null
          ? ` (ظرفیت روزانه ${hoursFa(input.workload.todayAvailableMinutes)})`
          : ""
      }.`,
      evidence: [
        { label: "روزهای بیش از ظرفیت", value: countFa(input.workload.overloadedDays) },
        { label: "روزهای سنگین", value: countFa(input.workload.heavyDays) },
        {
          label: "بار امروز",
          value: input.workload.todayState ? WORKLOAD_LABELS_FA[input.workload.todayState] : "—",
        },
      ],
      metric: "workload.overloadedDays",
      actions: [actionOpen("تنظیم برنامه هفته", LINK_PLANNING), actionOpen("بازیابی امروز", LINK_TODAY)],
      confidence: "high",
      signals: ["workload", "capacity"],
      weight: input.workload.overloadedDays,
    });
  }

  if (input.workload.sufficient && input.workload.trend === "rising" && (input.workload.trendPct ?? 0) >= 20) {
    add({
      type: "WORKLOAD",
      scope: "trend",
      severity: "info",
      title: "حجم کار برنامه‌ریزی‌شده در حال افزایش است",
      description: workloadTrendFa(input.workload, input.days),
      evidence: [
        { label: "تغییر حجم کار", value: pctFa(Math.abs(input.workload.trendPct ?? 0)) },
        { label: "روزهای سنگین", value: countFa(input.workload.heavyDays) },
      ],
      metric: "workload.trendPct",
      actions: [actionOpen("بررسی برنامه هفته", LINK_PLANNING)],
      confidence: "medium",
      signals: ["workload_trend"],
    });
  }

  /* ---------------------------------------------------------------- */
  /* 5 — RECOVERY (§17 / Phase 12 loop)                                */
  /* ---------------------------------------------------------------- */
  const criticalRecs = input.executionRecommendations.filter((r) => r.severity === "critical");
  if (criticalRecs.length > 0) {
    add({
      type: "RECOVERY",
      scope: "critical",
      severity: "critical",
      title: `${countFa(criticalRecs.length)} مورد نیازمند بازیابی برنامه`,
      description: `${criticalRecs
        .slice(0, 2)
        .map((r) => r.title)
        .join(" · ")} — این موارد از تفاوت بین برنامه و اجرای واقعی امروز ساخته شده‌اند.`,
      evidence: [
        { label: "موارد بحرانی", value: countFa(criticalRecs.length) },
        { label: "کل پیشنهادها", value: countFa(input.executionRecommendations.length) },
      ],
      metric: "execution.recommendations",
      actions: [actionOpen("بازیابی در امروز", LINK_TODAY)],
      confidence: "high",
      signals: ["execution_recovery"],
      weight: 5,
    });
  } else if (input.executionRecommendations.length >= 3) {
    add({
      type: "RECOVERY",
      scope: "pending",
      severity: "warning",
      title: `${countFa(input.executionRecommendations.length)} پیشنهاد بازیابی روی میز است`,
      description:
        "امروز چند مورد بین برنامه و اجرا فاصله افتاده است. هرکدام را می‌توانی جابه‌جا کنی، شروع کنی یا برای امروز نادیده بگیری.",
      evidence: [{ label: "پیشنهادهای باز", value: countFa(input.executionRecommendations.length) }],
      metric: "execution.recommendations",
      actions: [actionOpen("بازیابی در امروز", LINK_TODAY)],
      confidence: "medium",
      signals: ["execution_recovery"],
    });
  }

  /* ---------------------------------------------------------------- */
  /* 6 — ESTIMATION (§6)                                               */
  /* ---------------------------------------------------------------- */
  if (input.estimation.sufficient) {
    const accurate = input.estimation.direction === "accurate";
    add({
      type: "ESTIMATION",
      scope: "summary",
      severity: accurate ? "positive" : "warning",
      title: accurate ? "تخمین زمان دقیق است" : "تخمین زمان کارها با واقعیت فاصله دارد",
      description: estimationSummaryFa(input.estimation, input.days),
      evidence: [
        { label: "دقت تخمین", value: pctFa(input.estimation.accuracyPct) },
        { label: "نمونه اجرا", value: countFa(input.estimation.samples) },
        {
          label: "نسبت واقعی به تخمین",
          value: input.estimation.ratio != null ? ratioPctFa(input.estimation.ratio) : "—",
        },
      ],
      metric: "estimation.accuracyPct",
      actions: [actionOpen("تنظیم تخمین‌ها", LINK_TODAY)],
      confidence: "high",
      signals: ["estimation", input.window],
    });
  }

  const strongestPattern = input.estimation.patterns.find((p) => Math.abs(p.adjustmentPct) >= 25);
  if (strongestPattern) {
    add({
      type: "ESTIMATION",
      scope: strongestPattern.key,
      severity: "info",
      title: `تخمین «${strongestPattern.label}» نیاز به بازنگری دارد`,
      description: strongestPattern.note,
      evidence: [
        { label: "تخمین فعلی", value: minutesFa(strongestPattern.baseMinutes) },
        { label: "میانگین واقعی", value: minutesFa(strongestPattern.actualMinutes) },
        { label: "نمونه", value: countFa(strongestPattern.samples) },
      ],
      metric: "estimation.pattern",
      actions: [actionOpen("تنظیم تخمین‌ها", LINK_TODAY)],
      confidence: "medium",
      signals: ["estimation_pattern", strongestPattern.scope],
    });
  }

  /* ---------------------------------------------------------------- */
  /* 7 — PLANNING accuracy (§5) — one statement, never duplicated      */
  /* ---------------------------------------------------------------- */
  if (input.planned.sufficient && input.planned.adherencePct !== null) {
    const pct = input.planned.adherencePct;
    if (pct < 65) {
      add({
        type: "PLANNING_ACCURACY",
        scope: "adherence",
        severity: pct < 45 ? "warning" : "info",
        title: `${pctFa(pct)} از برنامه زمان‌بندی‌شده اجرا شده است`,
        description: `${input.planned.interpretation} برنامه‌ریزی سبک‌تر یا واقع‌بینانه‌تر، این عدد را بالا می‌برد.`,
        evidence: [
          { label: "برنامه‌ریزی‌شده", value: hoursFa(input.planned.scheduledMinutes) },
          { label: "اجراشده", value: hoursFa(input.planned.actualMinutes) },
          { label: "فاصله", value: hoursFa(Math.abs(input.planned.driftMinutes)) },
        ],
        metric: "planned.adherencePct",
        actions: [actionOpen("بررسی برنامه", LINK_PLANNING), actionOpen("بازیابی امروز", LINK_TODAY)],
        confidence: "high",
        signals: ["planning_adherence", input.window],
      });
    } else if (pct >= 85) {
      add({
        type: "PLANNING_ACCURACY",
        scope: "adherence",
        severity: "positive",
        title: `${pctFa(pct)} از برنامه‌ات را اجرا کرده‌ای`,
        description: `${input.planned.interpretation} این هم‌خوانی بین برنامه و اجرا، برنامه‌ریزی‌ات را قابل‌اعتماد می‌کند.`,
        evidence: [
          { label: "برنامه‌ریزی‌شده", value: hoursFa(input.planned.scheduledMinutes) },
          { label: "اجراشده", value: hoursFa(input.planned.actualMinutes) },
        ],
        metric: "planned.adherencePct",
        confidence: "high",
        signals: ["planning_adherence"],
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* 8 — SCHEDULE DRIFT driven by concrete conflicts/missed blocks      */
  /* ---------------------------------------------------------------- */
  if (input.metrics.missedBlocks >= 2) {
    add({
      type: "SCHEDULE_DRIFT",
      scope: "missed_blocks",
      severity: input.metrics.missedBlocks >= 4 ? "warning" : "info",
      title: `${countFa(input.metrics.missedBlocks)} بلوک زمانی بدون اجرا ماند`,
      description: `در ${countFa(input.days)} روز گذشته، ${countFa(
        input.metrics.missedBlocks,
      )} بلوک زمان‌بندی‌شده اجرا نشده است. علت را نمی‌دانیم؛ فقط همین واقعیت را نشان می‌دهیم تا بتوانی بلوک‌ها را واقع‌بینانه‌تر بچینی.`,
      evidence: [
        { label: "بلوک از دست رفته", value: countFa(input.metrics.missedBlocks) },
        { label: "جابه‌جایی برنامه", value: countFa(input.metrics.rescheduledTasks) },
      ],
      metric: "metrics.missedBlocks",
      actions: [actionOpen("بررسی برنامه", LINK_PLANNING)],
      confidence: "high",
      signals: ["missed_blocks", "schedule_drift"],
    });
  }

  /* ---------------------------------------------------------------- */
  /* 9 — EXECUTION pattern: repeated postponement (§13 Phase 12 signal) */
  /* ---------------------------------------------------------------- */
  if (input.metrics.postponedTasks >= 3) {
    add({
      type: "EXECUTION_PATTERN",
      scope: "postponement",
      severity: "warning",
      title: `${countFa(input.metrics.postponedTasks)} کار مکرراً به تعویق افتاده است`,
      description:
        "این کارها هر بار موعدشان جلو رفته است. گاهی علتش این است که تخمین زمان با واقعیت هم‌خوان نیست؛ گاهی هم کار واقعاً اولویت ندارد.",
      evidence: [
        { label: "کارهای جابه‌جاشده موعد", value: countFa(input.metrics.postponedTasks) },
        { label: "جابه‌جایی برنامه", value: countFa(input.metrics.rescheduledTasks) },
      ],
      metric: "metrics.postponedTasks",
      actions: [actionOpen("بازیابی امروز", LINK_TODAY), actionOpen("بررسی برنامه", LINK_PLANNING)],
      confidence: "high",
      signals: ["repeated_delay"],
    });
  }

  if (
    input.consistency.sufficient &&
    input.metrics.completedSessions >= 5 &&
    input.metrics.actualMinutes > 0
  ) {
    const finished = input.metrics.completedSessions + input.metrics.abandonedSessions;
    const rate = finished > 0 ? input.metrics.completedSessions / finished : null;
    if (rate !== null && rate >= 0.8) {
      add({
        type: "EXECUTION_PATTERN",
        scope: "session_completion",
        severity: "positive",
        title: "جلسه‌های اجرا معمولاً تا پایان پیش می‌روند",
        description: `${countFa(input.metrics.completedSessions)} از ${countFa(
          finished,
        )} جلسه اجرا کامل به پایان رسیده و در مجموع ${hoursFa(
          input.metrics.actualMinutes,
        )} کار واقعی ثبت شده است.`,
        evidence: [
          { label: "جلسه کامل‌شده", value: countFa(input.metrics.completedSessions) },
          { label: "جلسه رهاشده", value: countFa(input.metrics.abandonedSessions) },
          { label: "زمان اجراشده", value: hoursFa(input.metrics.actualMinutes) },
        ],
        metric: "metrics.completedSessions",
        confidence: "medium",
        signals: ["execution_consistency"],
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* 10 — TIME distribution (§4)                                       */
  /* ---------------------------------------------------------------- */
  if (!input.time.empty && input.time.totalMinutes >= T.minMinutesForShare && input.time.byType.length >= 2) {
    const top = input.time.byType[0];
    add({
      type: "TIME_DISTRIBUTION",
      scope: "by_type",
      severity: "info",
      title: `بیشترین زمان تو صرف «${top.label}» شده است`,
      description: `از ${hoursFa(input.time.totalMinutes)} زمان اجراشده در این بازه، ${hoursFa(
        top.minutes,
      )} (${pctFa(top.pct)}) روی «${top.label}» بوده است.`,
      evidence: input.time.byType
        .slice(0, 3)
        .map((slice) => ({ label: slice.label, value: `${hoursFa(slice.minutes)} — ${pctFa(slice.pct)}` })),
      metric: "time.byType",
      confidence: "high",
      signals: ["time_distribution"],
    });
  }

  if (
    input.time.byProject.length >= 2 &&
    input.time.byProject[0].pct >= 60 &&
    input.time.totalMinutes >= 180
  ) {
    const top = input.time.byProject[0];
    add({
      type: "TIME_DISTRIBUTION",
      scope: "by_project",
      severity: "info",
      title: `تمرکز زمان روی پروژه «${top.label}»`,
      description: `${pctFa(top.pct)} از زمان اجراشده این بازه صرف پروژه «${top.label}» شده است. اگر پروژه‌های دیگر اولویت دارند، این عدد را در نظر بگیر.`,
      evidence: input.time.byProject
        .slice(0, 3)
        .map((slice) => ({ label: slice.label, value: `${hoursFa(slice.minutes)} — ${pctFa(slice.pct)}` })),
      metric: "time.byProject",
      confidence: "medium",
      signals: ["time_distribution", "project_concentration"],
    });
  }

  /* ---------------------------------------------------------------- */
  /* 11 — FOCUS (§13 / §14)                                            */
  /* ---------------------------------------------------------------- */
  if (input.focus.totalMinutes > 0) {
    const interrupted = input.focus.sufficient && (input.focus.interruptionRate ?? 0) >= 0.3;
    add({
      type: "FOCUS",
      scope: interrupted ? "interruptions" : "total",
      severity: interrupted ? "info" : "positive",
      title: interrupted ? "بخشی از جلسه‌های تمرکز قبل از پایان متوقف می‌شود" : "زمان تمرکزت ثبت می‌شود",
      description: interrupted
        ? `${interruptionSummaryFa(input.focus, input.focus.sufficient)} این الگو فقط با جلسه‌های کوتاه‌تر یا بلوک‌های آزادتر قابل تغییر است.`
        : focusSummaryFa(input.focus),
      evidence: [
        { label: "زمان تمرکز", value: hoursFa(input.focus.totalMinutes) },
        { label: "تعداد جلسه", value: countFa(input.focus.sessions) },
        {
          label: "میانگین جلسه",
          value: input.focus.averageMinutes != null ? minutesFa(input.focus.averageMinutes) : "—",
        },
      ],
      metric: "focus.totalMinutes",
      confidence: input.focus.sufficient ? "high" : "medium",
      signals: ["focus", interrupted ? "interruptions" : "focus_time"],
    });
  }

  /* ---------------------------------------------------------------- */
  /* 12 — CONSISTENCY (§15)                                            */
  /* ---------------------------------------------------------------- */
  if (input.consistency.sufficient && input.consistency.activeDays > 0) {
    const consistency = input.consistency;
    const rate = consistency.executionConsistency ?? 0;
    add({
      type: "CONSISTENCY",
      scope: "activity",
      severity: rate >= 0.5 ? "positive" : "info",
      title:
        rate >= 0.5
          ? `در ${countFa(consistency.activeDays)} روز از ${countFa(input.days)} روز فعال بوده‌ای`
          : `روزهای فعال محدود به ${countFa(consistency.activeDays)} روز بوده است`,
      description: consistencySummaryFa(consistency, input.days),
      evidence: [
        { label: "روزهای فعال", value: `${countFa(consistency.activeDays)} از ${countFa(input.days)}` },
        { label: "روزهای اجرا", value: countFa(consistency.executionDays) },
        { label: "روزهای برنامه‌ریزی", value: countFa(consistency.planningDays) },
        {
          label: "روتین این ماه",
          value: consistency.routineMonthPct != null ? pctFa(consistency.routineMonthPct) : "—",
        },
        {
          label: "عادت‌ها این هفته",
          value: consistency.habitWeekPct != null ? pctFa(consistency.habitWeekPct) : "—",
        },
      ],
      metric: "consistency.activeDays",
      confidence: "high",
      signals: ["consistency"],
    });
  }

  /* ---------------------------------------------------------------- */
  /* 13 — Persona-specific insights (§25 / §27 / §26)                  */
  /* ---------------------------------------------------------------- */
  const signals = input.personaSignals;
  if (signals) {
    /* Student */
    if (signals.studyMinutes7d != null && signals.studyMinutes7d > 0) {
      add({
        type: "TIME_DISTRIBUTION",
        scope: "student_study",
        severity: "info",
        title: `در ۷ روز گذشته ${hoursFa(signals.studyMinutes7d)} مطالعه ثبت شده است`,
        description: "این عدد از جلسه‌های مطالعه ثبت‌شده در بخش تحصیلی می‌آید.",
        evidence: [{ label: "زمان مطالعه هفتگی", value: hoursFa(signals.studyMinutes7d) }],
        metric: "persona.studyMinutes7d",
        confidence: "high",
        signals: ["student", "study_time"],
      });
    }
    for (const exam of (signals.upcomingExams ?? []).slice(0, 2)) {
      const rawDays = Math.round(
        (Date.parse(`${exam.date}T00:00:00`) - Date.parse(`${input.dayKey}T00:00:00`)) / 86_400_000,
      );
      /* A passed exam is never reported as "soon" — the caller only sends future dates too. */
      if (rawDays < 0 || rawDays > 7) continue;
      const daysLeft = rawDays;
      add({
        type: "DEADLINE",
        scope: `exam:${exam.title}`,
        severity: exam.preparation < 50 ? "critical" : "warning",
        title: `آزمون «${exam.title}» ${daysLeft === 0 ? "امروز است" : `${countFa(daysLeft)} روز دیگر است`}`,
        description: `پیشرفت آمادگی ثبت‌شده ${pctFa(
          exam.preparation,
        )} است. این عدد را سیستم نمی‌سازد؛ از آمادگی ثبت‌شده خودت می‌آید.`,
        evidence: [
          { label: "آمادگی ثبت‌شده", value: pctFa(exam.preparation) },
          { label: "روز باقی‌مانده", value: countFa(daysLeft) },
        ],
        metric: "persona.examReadiness",
        actions: [actionOpen("برنامه مطالعه", LINK_TODAY), actionOpen("تنظیم برنامه هفته", LINK_PLANNING)],
        confidence: "high",
        signals: ["student", "exam_readiness"],
        weight: daysLeft <= 2 ? 6 : 2,
      });
    }
    if ((signals.overdueAssignments ?? 0) >= 2) {
      add({
        type: "DEADLINE",
        scope: "student_assignments",
        severity: "warning",
        title: `${countFa(signals.overdueAssignments!)} تکلیف از موعد گذشته است`,
        description: "تکلیف‌های دارای موعد گذشته در بخش تحصیلی ثبت شده‌اند.",
        evidence: [
          { label: "تکالیف عقب‌افتاده", value: countFa(signals.overdueAssignments!) },
          { label: "تکالیف باز", value: countFa(signals.openAssignments ?? 0) },
        ],
        metric: "persona.overdueAssignments",
        actions: [actionOpen("دیدن کارها", LINK_OVERDUE)],
        confidence: "high",
        signals: ["student", "assignments"],
      });
    }

    /* Employee */
    if ((signals.meetingsThisWeek ?? 0) >= 8) {
      add({
        type: "WORKLOAD",
        scope: "employee_meetings",
        severity: "info",
        title: `${countFa(signals.meetingsThisWeek!)} جلسه در این هفته`,
        description:
          "جلسه‌ها ظرفیت کار عمیق را کم می‌کنند. برنامه‌ریزی بلوک‌های تمرکز در فاصله بین جلسه‌ها معمولاً کمک می‌کند.",
        evidence: [{ label: "جلسه‌های هفته", value: countFa(signals.meetingsThisWeek!) }],
        metric: "persona.meetings",
        actions: [actionOpen("بررسی برنامه", LINK_PLANNING)],
        confidence: "medium",
        signals: ["employee", "meetings"],
      });
    }

    /* Freelancer */
    for (const deliverable of (signals.deliverablesDueSoon ?? []).slice(0, 2)) {
      add({
        type: "DEADLINE",
        scope: `deliverable:${deliverable.title}`,
        severity: "warning",
        title: `تحویل «${deliverable.title}» نزدیک است`,
        description: `موعد تحویل ${dayFa(deliverable.dueDate)} است و وضعیت ثبت‌شده آن «${deliverableStatusFa(
          deliverable.status,
        )}» است.`,
        evidence: [
          { label: "موعد", value: dayFa(deliverable.dueDate) },
          { label: "وضعیت ثبت‌شده", value: deliverableStatusFa(deliverable.status) },
        ],
        metric: "persona.deliverables",
        actions: [actionOpen("دیدن پروژه‌ها", LINK_PROJECTS), actionOpen("تنظیم برنامه هفته", LINK_PLANNING)],
        confidence: "high",
        signals: ["freelancer", "deliverable"],
      });
    }
    if ((signals.overdueInvoices ?? 0) > 0) {
      add({
        type: "DEADLINE",
        scope: "freelancer_invoices",
        severity: "warning",
        title: `${countFa(signals.overdueInvoices!)} صورتحساب سررسیدگذشته دارد`,
        description: "صورتحساب‌های سررسیدگذشته در بخش مالی ثبت شده‌اند و پیگیری مستقیم روی درآمد اثر دارد.",
        evidence: [{ label: "صورتحساب سررسیدگذشته", value: countFa(signals.overdueInvoices!) }],
        metric: "persona.overdueInvoices",
        confidence: "high",
        signals: ["freelancer", "invoices"],
      });
    }
    if ((signals.billableMinutes7d ?? 0) > 0) {
      add({
        type: "TIME_DISTRIBUTION",
        scope: "freelancer_billable",
        severity: "info",
        title: `در ۷ روز گذشته ${hoursFa(signals.billableMinutes7d!)} کار قابل‌صورتحساب ثبت شده است`,
        description: "این عدد از زمان ثبت‌شده روی کارهای قابل‌صورتحساب می‌آید.",
        evidence: [{ label: "زمان قابل‌صورتحساب هفتگی", value: hoursFa(signals.billableMinutes7d!) }],
        metric: "persona.billableMinutes7d",
        confidence: "high",
        signals: ["freelancer", "billable"],
      });
    }

    /* Manager — aggregate only, never per-employee analytics (§30) */
    if ((signals.blockedTeamTasks ?? 0) > 0) {
      add({
        type: "PROJECT_RISK",
        scope: "manager_blocked",
        severity: "warning",
        title: `${countFa(signals.blockedTeamTasks!)} کار تیمی در وضعیت مسدود است`,
        description:
          "این عدد از کارهای مسدودشده‌ی پروژه‌های تحت مدیریت تو می‌آید — بدون هیچ داده‌ی فردی از اعضای تیم.",
        evidence: [{ label: "کارهای مسدود تیمی", value: countFa(signals.blockedTeamTasks!) }],
        metric: "persona.blockedTeamTasks",
        actions: [actionOpen("دیدن پروژه‌ها", LINK_PROJECTS)],
        confidence: "high",
        signals: ["manager", "blocked"],
      });
    }
    for (const milestone of (signals.atRiskMilestones ?? []).slice(0, 2)) {
      add({
        type: "PROJECT_RISK",
        scope: `milestone:${milestone.title}`,
        severity: milestone.progress < 40 ? "critical" : "warning",
        title: `گام پروژه «${milestone.title}» در معرض تأخیر است`,
        description: `موعد ${dayFa(milestone.dueDate)} و پیشرفت ثبت‌شده ${pctFa(milestone.progress)} است.`,
        evidence: [
          { label: "موعد", value: dayFa(milestone.dueDate) },
          { label: "پیشرفت", value: pctFa(milestone.progress) },
        ],
        metric: "persona.milestones",
        actions: [actionOpen("دیدن پروژه‌ها", LINK_PROJECTS)],
        confidence: "high",
        signals: ["manager", "milestone"],
      });
    }

    /* Business owner */
    for (const initiative of (signals.atRiskInitiatives ?? []).slice(0, 2)) {
      add({
        type: "PROJECT_RISK",
        scope: `initiative:${initiative.title}`,
        severity: initiative.progress < 40 ? "critical" : "warning",
        title: `ابتکار «${initiative.title}» عقب‌تر از برنامه است`,
        description: `موعد ${dayFa(initiative.dueDate)} و پیشرفت ${pctFa(initiative.progress)} است.`,
        evidence: [
          { label: "موعد", value: dayFa(initiative.dueDate) },
          { label: "پیشرفت", value: pctFa(initiative.progress) },
        ],
        metric: "persona.initiatives",
        actions: [actionOpen("دیدن پروژه‌ها", LINK_PROJECTS)],
        confidence: "high",
        signals: ["business", "initiative"],
      });
    }
    if ((signals.staleCustomers ?? 0) > 0) {
      add({
        type: "EXECUTION_PATTERN",
        scope: "business_followups",
        severity: "info",
        title: `${countFa(signals.staleCustomers!)} مشتری بدون پیگیری اخیر`,
        description: "این مشتری‌ها در بازه تعیین‌شده هیچ فعالیت ثبت‌شده‌ای نداشته‌اند.",
        evidence: [{ label: "مشتریان بدون پیگیری", value: countFa(signals.staleCustomers!) }],
        metric: "persona.staleCustomers",
        confidence: "medium",
        signals: ["business", "followups"],
      });
    }

    /* Personal productivity */
    if ((signals.lifeAreaMinutes ?? []).length >= 2) {
      const top = [...(signals.lifeAreaMinutes ?? [])].sort((a, b) => b.minutes - a.minutes)[0];
      add({
        type: "TIME_DISTRIBUTION",
        scope: "life_area",
        severity: "info",
        title: `بیشترین زمان شخصی روی «${top.label}» بوده است`,
        description: `از زمان ثبت‌شده در حوزه‌های زندگی، «${top.label}» با ${hoursFa(
          top.minutes,
        )} بیشترین سهم را دارد.`,
        evidence: (signals.lifeAreaMinutes ?? [])
          .slice(0, 3)
          .map((area) => ({ label: area.label, value: hoursFa(area.minutes) })),
        metric: "persona.lifeAreas",
        confidence: "medium",
        signals: ["personal", "life_area"],
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Build: dedupe by (type, scope), prioritize, cap (§18 / §19)        */
  /* ---------------------------------------------------------------- */
  const seen = new Set<string>();
  const insights: Insight[] = [];
  for (const draft of drafts) {
    const key = `${draft.type}:${draft.scope}`;
    if (seen.has(key)) continue;
    seen.add(key);
    insights.push(toInsight(draft, input));
  }

  insights.sort(
    (a, b) => b.priority - a.priority || b.createdAt - a.createdAt || a.id.localeCompare(b.id),
  );

  /* Keep at most one informational TIME_DISTRIBUTION-style duplicate per type
     when a stronger same-type insight already exists (§18 non-duplicative). */
  const typeCount = new Map<InsightType, number>();
  const capped: Insight[] = [];
  for (const insight of insights) {
    const count = typeCount.get(insight.type) ?? 0;
    const limit = insight.type === "PROJECT_RISK" || insight.type === "DEADLINE" ? 4 : 3;
    if (count >= limit) continue;
    typeCount.set(insight.type, count + 1);
    capped.push(insight);
    if (capped.length >= MAX_INSIGHTS) break;
  }

  return capped;
}

function toInsight(draft: Draft, input: InsightEngineInput): Insight {
  const priority =
    INSIGHT_PRIORITY_WEIGHT[draft.type] +
    INSIGHT_SEVERITY_BONUS[draft.severity] +
    (draft.weight ?? 0) +
    (input.days >= 30 ? 1 : 0);
  return {
    id: `${draft.type}:${draft.scope}:${input.dayKey}`,
    type: draft.type,
    category: INSIGHT_CATEGORY_BY_TYPE[draft.type],
    severity: draft.severity,
    title: draft.title,
    description: draft.description,
    evidence: draft.evidence,
    metric: draft.metric,
    timeWindow: input.window,
    affected: draft.affected,
    actions: draft.actions ?? [],
    priority,
    confidence: draft.confidence,
    signals: draft.signals,
    createdAt: input.nowMs,
    expiresDay: input.dayKey,
    status: "new",
  };
}

/** Insights that deserve a surface on Today (§22) — actionable + today-bound. */
export function actionableTodayInsights(insights: Insight[]): Insight[] {
  const todayTypes: InsightType[] = ["DEADLINE", "RECOVERY", "WORKLOAD", "SCHEDULE_DRIFT", "PROJECT_RISK"];
  return insights
    .filter((i) => todayTypes.includes(i.type))
    .filter((i) => i.severity === "critical" || i.severity === "warning")
    .slice(0, 3);
}
