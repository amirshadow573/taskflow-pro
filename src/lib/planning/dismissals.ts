/**
 * Recommendation dismissals (Phase 10 §16, §28 — refactored in Phase 11
 * onto the shared store factory in src/lib/dismissal-store.ts).
 *
 * Dismissal is NON-DESTRUCTIVE and local: it only hides a recommendation for
 * the day it was generated — no task, priority, date or goal is touched, and
 * nothing is written to the backend. Ids are day-scoped, so a new day
 * naturally starts with a clean slate; stale days are pruned on write.
 */
import { createDismissalStore } from "@/lib/dismissal-store";

const STORE_KEY = "taskly-planning-dismissed";

const store = createDismissalStore(STORE_KEY, 2);

/** ids dismissed for `dayKey` (stable snapshot for useSyncExternalStore). */
export function getDismissedSnapshot(dayKey: string): string[] {
  return store.getSnapshot(dayKey);
}

export function subscribeDismissals(cb: () => void): () => void {
  return store.subscribe(cb);
}

/** Hide a recommendation for today. Idempotent — dismissing twice is a no-op. */
export function dismissRecommendation(id: string, dayKey: string): void {
  store.dismiss(id, dayKey);
}

/** Undo a dismissal (used by the «بازگردانی» affordance if needed later). */
export function restoreRecommendation(id: string, dayKey: string): void {
  store.restore(id, dayKey);
}

/** Filter a recommendation list down to what the user still wants to see. */
export function filterDismissed<T extends { id: string }>(
  recs: T[],
  dayKey: string,
): T[] {
  const dismissed = new Set(store.getSnapshot(dayKey));
  return recs.filter((r) => !dismissed.has(r.id));
}
