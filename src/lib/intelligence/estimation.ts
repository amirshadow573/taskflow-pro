/**
 * Estimation accuracy (Phase 13 §6).
 *
 * Reuses the Phase 12 estimation-learning layer for the task / tag / work-type
 * patterns (single source of truth for "base + historic adjustment") and adds
 * ONLY the scope Phase 12 does not cover: patterns per PROJECT (§6 asks for
 * project / client / subject estimates).
 *
 * Minimum-sample protection lives here as a hard rule: a pattern is only
 * reported above `estimationPatternSamples`, and the profile is only declared
 * sufficient above `estimationSamples`.
 */
import type { EstimateInsight, ExecutionSession } from "@/lib/execution";
import { sessionMinutes } from "@/lib/execution";
import { estimatedSessions } from "./rows";
import { minutesFa, countFa } from "./format";
import { INTELLIGENCE_THRESHOLDS } from "./types";
import type { EstimationPattern, EstimationProfile, ProductivityMetrics } from "./types";
import type { IntelProject, IntelTask } from "./input";

/** Accuracy tolerance band: inside ±10% the estimate is considered accurate. */
export const ESTIMATION_TOLERANCE_PCT = 10;

export interface EstimationInput {
  sessions: ExecutionSession[];
  metrics: ProductivityMetrics;
  /** Phase 12 learning output — reused verbatim for task/tag/kind scopes. */
  insights: EstimateInsight[];
  tasks: IntelTask[];
  projects: IntelProject[];
  nowMs: number;
}

const SCOPE_ORDER: Record<EstimationPattern["scope"], number> = {
  task: 0,
  tag: 1,
  kind: 2,
  project: 3,
};

export function buildEstimationProfile(input: EstimationInput): EstimationProfile {
  const finished = estimatedSessions(input.sessions);

  let estimatedTotal = 0;
  let actualTotal = 0;
  for (const s of finished) {
    estimatedTotal += s.plannedMinutes ?? 0;
    actualTotal += sessionMinutes(s, input.nowMs);
  }
  const ratio = estimatedTotal > 0 ? actualTotal / estimatedTotal : null;
  const deviationPct = ratio !== null ? Math.round((ratio - 1) * 100) : null;

  let direction: EstimationProfile["direction"] = "insufficient";
  if (finished.length >= INTELLIGENCE_THRESHOLDS.estimationSamples && deviationPct !== null) {
    if (deviationPct > ESTIMATION_TOLERANCE_PCT) direction = "under_estimating";
    else if (deviationPct < -ESTIMATION_TOLERANCE_PCT) direction = "over_estimating";
    else direction = "accurate";
  }

  /* ---- Phase 12 patterns (task / tag / kind), reused as-is ---- */
  const patterns: EstimationPattern[] = input.insights
    .filter((i) => i.adjustmentMinutes !== 0)
    .map((i) => ({
      key: i.key,
      scope: i.scope,
      label: i.label,
      baseMinutes: i.baseMinutes,
      actualMinutes: i.historicalMinutes,
      samples: i.samples,
      adjustmentMinutes: i.adjustmentMinutes,
      adjustmentPct: i.adjustmentPct,
      note: i.note,
    }));

  /* ---- Project scope (new in Phase 13) ---- */
  const projectById = new Map(input.projects.map((p) => [p._id, p]));
  const taskById = new Map(input.tasks.map((t) => [t._id, t]));
  const byProject = new Map<string, { planned: number[]; actual: number[] }>();
  for (const s of finished) {
    const task = s.taskId ? taskById.get(s.taskId) : undefined;
    const projectId = s.projectId ?? task?.projectId;
    if (!projectId || !projectById.has(projectId)) continue;
    const bucket = byProject.get(projectId) ?? { planned: [], actual: [] };
    bucket.planned.push(s.plannedMinutes ?? 0);
    bucket.actual.push(sessionMinutes(s, input.nowMs));
    byProject.set(projectId, bucket);
  }
  for (const [projectId, bucket] of byProject) {
    if (bucket.planned.length < INTELLIGENCE_THRESHOLDS.estimationPatternSamples) continue;
    const project = projectById.get(projectId);
    if (!project) continue;
    const base = Math.round(bucket.planned.reduce((a, b) => a + b, 0) / bucket.planned.length);
    const actual = Math.round(bucket.actual.reduce((a, b) => a + b, 0) / bucket.actual.length);
    const adjustment = actual - base;
    if (adjustment === 0) continue;
    const directionLabel = adjustment > 0 ? "بیشتر" : "کمتر";
    patterns.push({
      key: `project:${projectId}`,
      scope: "project",
      label: project.name,
      baseMinutes: base,
      actualMinutes: actual,
      samples: bucket.planned.length,
      adjustmentMinutes: adjustment,
      adjustmentPct: base > 0 ? Math.round((adjustment / base) * 100) : 0,
      note: `در ${countFa(bucket.planned.length)} اجرای اخیر پروژه «${project.name}»، زمان واقعی به‌طور میانگین ${minutesFa(
        Math.abs(adjustment),
      )} ${directionLabel} از تخمین بوده است (تخمین میانگین ${minutesFa(base)} / واقعی میانگین ${minutesFa(actual)}).`,
    });
  }

  patterns.sort(
    (a, b) =>
      SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope] ||
      Math.abs(b.adjustmentPct) - Math.abs(a.adjustmentPct) ||
      a.key.localeCompare(b.key),
  );

  return {
    samples: input.metrics.estimateSamples,
    accuracyPct: input.metrics.estimateAccuracyPct,
    ratio,
    direction,
    patterns: patterns.slice(0, 8),
    sufficient: finished.length >= INTELLIGENCE_THRESHOLDS.estimationSamples,
  };
}

/** Persian sentence for the whole-window estimation reading (§6). */
export function estimationSummaryFa(profile: EstimationProfile, days: number): string {
  if (!profile.sufficient || profile.accuracyPct === null) {
    return `برای تحلیل دقت تخمین، به حداقل ${countFa(
      INTELLIGENCE_THRESHOLDS.estimationSamples,
    )} اجرای دارای تخمین نیاز است — تا حالا ${countFa(profile.samples)} اجرا ثبت شده.`;
  }
  const dev = profile.ratio !== null ? Math.round((profile.ratio - 1) * 100) : 0;
  if (profile.direction === "accurate") {
    return `در ${days} روز گذشته، دقت تخمین زمان ${countFa(
      profile.accuracyPct,
    )}٪ بوده — تخمین‌ها با زمان واقعی هم‌خوان‌اند.`;
  }
  const word = dev > 0 ? "بیشتر" : "کمتر";
  return `در ${days} روز گذشته، زمان واقعی انجام کارها به‌طور میانگین ${countFa(
    Math.abs(dev),
  )}٪ ${word} از تخمین بوده است (دقت تخمین ${countFa(profile.accuracyPct)}٪).`;
}
