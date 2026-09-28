/**
 * Schedule recommendation dismissals (Phase 11 §29) — same contract as the
 * planning dismissals: local, non-destructive, day-scoped, idempotent.
 */
import { createDismissalStore } from "@/lib/dismissal-store";

const store = createDismissalStore("taskly-schedule-dismissed", 2);

export const getScheduleDismissedSnapshot = (dayKey: string): string[] =>
  store.getSnapshot(dayKey);

export const subscribeScheduleDismissals = (cb: () => void): (() => void) =>
  store.subscribe(cb);

export const dismissScheduleRecommendation = (id: string, dayKey: string): void =>
  store.dismiss(id, dayKey);

export const filterDismissedSchedule = <T extends { id: string }>(
  recs: T[],
  dayKey: string,
): T[] => {
  const dismissed = new Set(store.getSnapshot(dayKey));
  return recs.filter((r) => !dismissed.has(r.id));
};
