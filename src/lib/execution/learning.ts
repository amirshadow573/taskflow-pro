/**
 * Estimation learning (Phase 12 §14).
 *
 * Deterministic, explainable feedback from real execution history:
 *
 *   base estimate (the user's own)  +  historical adjustment  =  planning estimate
 *
 * Rules:
 *   - The ORIGINAL estimate is never rewritten; the adjustment is a separate,
 *     displayable number (`EstimateInsight`) that the scheduler may use.
 *   - No machine learning, no inference — a plain average over at least
 *     MIN_SAMPLES observations, clamped so a single outlier cannot distort the
 *     plan, and always explainable in Persian (`note`).
 */
import { toFa } from "@/lib/persian";
import { isFinishedSession, sessionMinutes } from "./metrics";
import {
  EXECUTION_KIND_LABELS_FA,
  type EstimateInsight,
  type ExecutionSession,
  type ExecutionTaskLite,
} from "./types";

/** An adjustment only exists once there is a real pattern, never from 1 run. */
export const MIN_SAMPLES = 3;
/** Clamps keep a single weird session from wrecking the plan (§14). */
export const MAX_ADJUSTMENT_MINUTES = 120;
export const MIN_ADJUSTMENT_MINUTES = -60;

export interface LearningInput {
  /** Finished sessions over the learning window (e.g. last 30 days). */
  sessions: ExecutionSession[];
  tasks: ExecutionTaskLite[];
  nowMs: number;
}

interface Sample {
  planned: number;
  actual: number;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function clampAdjustment(minutes: number): number {
  return Math.max(MIN_ADJUSTMENT_MINUTES, Math.min(MAX_ADJUSTMENT_MINUTES, minutes));
}

function buildInsight(
  key: string,
  scope: EstimateInsight["scope"],
  label: string,
  baseMinutes: number,
  samples: Sample[],
): EstimateInsight | null {
  if (samples.length < MIN_SAMPLES || baseMinutes <= 0) return null;
  const historicalMinutes = Math.round(mean(samples.map((s) => s.actual)));
  const adjustmentMinutes = clampAdjustment(historicalMinutes - baseMinutes);
  if (adjustmentMinutes === 0) {
    return {
      key,
      scope,
      label,
      baseMinutes,
      historicalMinutes,
      samples: samples.length,
      adjustmentMinutes: 0,
      adjustmentPct: 0,
      note: `بر اساس ${toFa(samples.length)} اجرای قبلی «${label}»، تخمین زمان درست بوده است.`,
    };
  }
  const direction = adjustmentMinutes > 0 ? "افزایش" : "کاهش";
  return {
    key,
    scope,
    label,
    baseMinutes,
    historicalMinutes,
    samples: samples.length,
    adjustmentMinutes,
    adjustmentPct: Math.round((adjustmentMinutes / baseMinutes) * 100),
    note: `بر اساس ${toFa(samples.length)} اجرای قبلی «${label}»، زمان برنامه‌ریزی‌شده ${toFa(
      Math.abs(adjustmentMinutes),
    )} دقیقه ${direction} یافته است (میانگین واقعی: ${toFa(historicalMinutes)} دقیقه).`,
  };
}

export function learnEstimates({ sessions, tasks, nowMs }: LearningInput): EstimateInsight[] {
  const taskById = new Map(tasks.map((t) => [t._id, t]));
  const byTask = new Map<string, Sample[]>();
  const byTag = new Map<string, Sample[]>();
  const byKind = new Map<string, Sample[]>();

  for (const s of sessions) {
    if (!isFinishedSession(s)) continue;
    if (s.plannedMinutes == null || s.plannedMinutes <= 0) continue;
    const actual = sessionMinutes(s, nowMs);
    if (actual <= 0) continue;
    const sample: Sample = { planned: s.plannedMinutes, actual };

    if (s.taskId) {
      const list = byTask.get(s.taskId) ?? [];
      list.push(sample);
      byTask.set(s.taskId, list);

      const task = taskById.get(s.taskId);
      const tag = task?.tags?.[0];
      if (tag) {
        const tagList = byTag.get(tag) ?? [];
        tagList.push(sample);
        byTag.set(tag, tagList);
      }
    }

    const kindList = byKind.get(s.kind) ?? [];
    kindList.push(sample);
    byKind.set(s.kind, kindList);
  }

  const insights: EstimateInsight[] = [];

  for (const [taskId, samples] of byTask) {
    const task = taskById.get(taskId);
    if (!task) continue;
    const base = task.estimateMinutes ?? Math.round(mean(samples.map((s) => s.planned)));
    const insight = buildInsight(`task:${taskId}`, "task", task.title, base, samples);
    if (insight) insights.push(insight);
  }

  for (const [tag, samples] of byTag) {
    const base = Math.round(mean(samples.map((s) => s.planned)));
    const insight = buildInsight(`tag:${tag}`, "tag", tag, base, samples);
    if (insight) insights.push(insight);
  }

  for (const [kind, samples] of byKind) {
    const base = Math.round(mean(samples.map((s) => s.planned)));
    const insight = buildInsight(
      `kind:${kind}`,
      "kind",
      EXECUTION_KIND_LABELS_FA[kind] ?? kind,
      base,
      samples,
    );
    if (insight) insights.push(insight);
  }

  const scopeOrder: Record<EstimateInsight["scope"], number> = { task: 0, tag: 1, kind: 2 };
  return insights.sort(
    (a, b) =>
      scopeOrder[a.scope] - scopeOrder[b.scope] ||
      Math.abs(b.adjustmentMinutes) - Math.abs(a.adjustmentMinutes) ||
      a.key.localeCompare(b.key),
  );
}

/** The most specific insight for a task (task → its first tag → kind). */
export function insightForTask(
  task: ExecutionTaskLite,
  insights: EstimateInsight[],
  kind?: string,
): EstimateInsight | null {
  const byKey = new Map(insights.map((i) => [i.key, i]));
  const taskInsight = byKey.get(`task:${task._id}`);
  if (taskInsight && taskInsight.adjustmentMinutes !== 0) return taskInsight;
  const tag = task.tags?.[0];
  const tagInsight = tag ? byKey.get(`tag:${tag}`) : undefined;
  if (tagInsight && tagInsight.adjustmentMinutes !== 0) return tagInsight;
  const kindInsight = kind ? byKey.get(`kind:${kind}`) : undefined;
  if (kindInsight && kindInsight.adjustmentMinutes !== 0) return kindInsight;
  return taskInsight ?? tagInsight ?? kindInsight ?? null;
}

/**
 * Per-task PLANNING duration (base + historical adjustment).
 *
 * This is what the scheduler may plan with. It never mutates the task's own
 * `estimateMinutes`, so history stays intact and the difference is always
 * explainable to the user (§14).
 */
export function planningEstimatesByTask(
  tasks: ExecutionTaskLite[],
  insights: EstimateInsight[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const task of tasks) {
    const insight = insightForTask(task, insights);
    if (!insight || insight.adjustmentMinutes === 0) continue;
    const base = task.estimateMinutes ?? insight.baseMinutes;
    const planning = Math.max(5, base + insight.adjustmentMinutes);
    if (planning !== base) out[task._id] = planning;
  }
  return out;
}
