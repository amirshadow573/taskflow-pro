/**
 * Insight dismissal + usefulness (Phase 13 §34).
 *
 * Same contract as the Phase 10/11/12 dismissal stores: LOCAL, day-scoped and
 * non-destructive. Dismissing an insight hides it for the day it was generated
 * and changes nothing else — no data is written to the backend, no project,
 * goal, task or estimate is touched. Ids embed their dayKey, so an insight can
 * never "immediately reappear" (§40-15) and a new day starts clean.
 *
 * "Useful" is stored the same way: a local, non-scoring acknowledgement. It is
 * deliberately NOT a gamification input (§28 forbids new XP/stats) — it only
 * tells the Insight Center which cards the user found valuable.
 */
import { createDismissalStore } from "@/lib/dismissal-store";
import type { Insight, InsightStatus } from "./types";

const dismissStore = createDismissalStore("taskly-insights-dismissed", 3);
const usefulStore = createDismissalStore("taskly-insights-useful", 3);

export const getDismissedInsightSnapshot = (dayKey: string): string[] =>
  dismissStore.getSnapshot(dayKey);

export const subscribeInsightDismissals = (cb: () => void): (() => void) =>
  dismissStore.subscribe(cb);

export const dismissInsight = (id: string, dayKey: string): void =>
  dismissStore.dismiss(id, dayKey);

export const restoreInsight = (id: string, dayKey: string): void =>
  dismissStore.restore(id, dayKey);

export const getUsefulInsightSnapshot = (dayKey: string): string[] =>
  usefulStore.getSnapshot(dayKey);

export const subscribeInsightUsefulness = (cb: () => void): (() => void) =>
  usefulStore.subscribe(cb);

export const markInsightUseful = (id: string, dayKey: string): void =>
  usefulStore.dismiss(id, dayKey);

export const unmarkInsightUseful = (id: string, dayKey: string): void =>
  usefulStore.restore(id, dayKey);

/** Hides dismissed insights only — the default reading of the Insight Center. */
export function filterDismissedInsights(insights: Insight[], dayKey: string): Insight[] {
  const dismissed = new Set(dismissStore.getSnapshot(dayKey));
  return insights.filter((i) => !dismissed.has(i.id));
}

/** Applies local status (new / dismissed / useful) to insight rows. */
export function applyInsightStatus(insights: Insight[], dayKey: string): Insight[] {
  const dismissed = new Set(dismissStore.getSnapshot(dayKey));
  const useful = new Set(usefulStore.getSnapshot(dayKey));
  return insights.map((insight) => {
    const status: InsightStatus = dismissed.has(insight.id)
      ? "dismissed"
      : useful.has(insight.id)
        ? "useful"
        : "new";
    return status === insight.status ? insight : { ...insight, status };
  });
}
