/**
 * Execution recommendation dismissals (Phase 12 §29).
 *
 * Same contract as the planning + scheduling dismissals: LOCAL, day-scoped and
 * non-destructive. Dismissing a recovery suggestion hides it for the day it was
 * generated and touches nothing else — no task, block, estimate or status is
 * changed, and nothing is written to the backend. Ids embed their dayKey, so a
 * new day naturally starts clean and stale days are pruned on write.
 */
import { createDismissalStore } from "@/lib/dismissal-store";

const store = createDismissalStore("taskly-execution-dismissed", 2);

export const getExecutionDismissedSnapshot = (dayKey: string): string[] =>
  store.getSnapshot(dayKey);

export const subscribeExecutionDismissals = (cb: () => void): (() => void) =>
  store.subscribe(cb);

export const dismissExecutionRecommendation = (id: string, dayKey: string): void =>
  store.dismiss(id, dayKey);

export const restoreExecutionRecommendation = (id: string, dayKey: string): void =>
  store.restore(id, dayKey);

export const filterDismissedExecution = <T extends { id: string }>(
  recs: T[],
  dayKey: string,
): T[] => {
  const dismissed = new Set(store.getSnapshot(dayKey));
  return recs.filter((r) => !dismissed.has(r.id));
};
