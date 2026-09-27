/**
 * Recommendation dismissals (Phase 10 §16, §28).
 *
 * Dismissal is NON-DESTRUCTIVE and local: it only hides a recommendation for
 * the day it was generated — no task, priority, date or goal is touched, and
 * nothing is written to the backend. Ids are day-scoped (they embed the
 * dayKey), so a new day naturally starts with a clean slate; stale days are
 * pruned on every write to keep storage bounded.
 *
 * The tiny external store follows the same subscribe/snapshot pattern used
 * elsewhere in the app (see use-user-profile), so every surface (Today,
 * dashboard, Planning Center) stays in sync without a React context.
 */

const STORAGE_KEY = "taskly-planning-dismissed";
const KEEP_DAYS = 2;

type DismissalMap = Record<string, string[]>; // dayKey → recommendation ids

const listeners = new Set<() => void>();
/** Cached for useSyncExternalStore — invalidated on every write. */
let cached: { day: string; ids: string[] } | null = null;

function safeRead(): DismissalMap {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DismissalMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function safeWrite(map: DismissalMap): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* Storage full/unavailable — dismissal simply won't persist. */
  }
}

/** Keep only the most recent days so the key never grows unbounded. */
function prune(map: DismissalMap, dayKey: string): DismissalMap {
  const keys = Object.keys(map).sort().reverse();
  const keep = new Set<string>([dayKey, ...keys.slice(0, KEEP_DAYS - 1)]);
  const out: DismissalMap = {};
  for (const k of keys) {
    if (keep.has(k)) out[k] = map[k];
    if (Object.keys(out).length >= KEEP_DAYS) break;
  }
  return out;
}

function notify(): void {
  cached = null;
  for (const l of listeners) l();
}

/** ids dismissed for `dayKey` (stable snapshot for useSyncExternalStore). */
export function getDismissedSnapshot(dayKey: string): string[] {
  if (cached && cached.day === dayKey) return cached.ids;
  const ids = safeRead()[dayKey] ?? [];
  cached = { day: dayKey, ids };
  return ids;
}

export function subscribeDismissals(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Hide a recommendation for today. Idempotent — dismissing twice is a no-op. */
export function dismissRecommendation(id: string, dayKey: string): void {
  const map = safeRead();
  const ids = map[dayKey] ?? [];
  if (ids.includes(id)) return;
  map[dayKey] = [...ids, id];
  safeWrite(prune(map, dayKey));
  notify();
}

/** Undo a dismissal (used by the «بازگردانی» affordance if needed later). */
export function restoreRecommendation(id: string, dayKey: string): void {
  const map = safeRead();
  const ids = map[dayKey] ?? [];
  if (!ids.includes(id)) return;
  map[dayKey] = ids.filter((x) => x !== id);
  safeWrite(map);
  notify();
}

/** Filter a recommendation list down to what the user still wants to see. */
export function filterDismissed<T extends { id: string }>(
  recs: T[],
  dayKey: string,
): T[] {
  const dismissed = new Set(getDismissedSnapshot(dayKey));
  return recs.filter((r) => !dismissed.has(r.id));
}
