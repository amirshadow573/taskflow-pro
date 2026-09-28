/**
 * Shared per-day dismissal store (Phase 10 → Phase 11 refactor).
 *
 * Dismissal is always LOCAL, NON-DESTRUCTIVE and day-scoped: it only hides a
 * generated recommendation for the day it was created; no user data is
 * touched and nothing is written to the backend. Ids embed their dayKey, so
 * a new day starts with a clean slate; stale days are pruned on write.
 *
 * Each store keeps its own listener set + snapshot cache, so every surface
 * (Today / dashboard / Planning Center) stays in sync via
 * `useSyncExternalStore` without a React context.
 */

type DismissalMap = Record<string, string[]>; // dayKey → ids

export interface DismissalStore {
  subscribe(cb: () => void): () => void;
  /** ids dismissed for `dayKey` — stable identity until the next write. */
  getSnapshot(dayKey: string): string[];
  dismiss(id: string, dayKey: string): void;
  restore(id: string, dayKey: string): void;
}

export function createDismissalStore(
  storageKey: string,
  keepDays = 2,
): DismissalStore {
  const listeners = new Set<() => void>();
  let cached: { day: string; ids: string[] } | null = null;

  function safeRead(): DismissalMap {
    if (typeof localStorage === "undefined") return {};
    try {
      const raw = localStorage.getItem(storageKey);
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
      localStorage.setItem(storageKey, JSON.stringify(map));
    } catch {
      /* Storage unavailable — dismissal simply won't persist. */
    }
  }

  function prune(map: DismissalMap, dayKey: string): DismissalMap {
    const keys = Object.keys(map).sort().reverse();
    const keep = new Set<string>([dayKey, ...keys.slice(0, keepDays - 1)]);
    const out: DismissalMap = {};
    for (const k of keys) {
      if (keep.has(k)) out[k] = map[k];
      if (Object.keys(out).length >= keepDays) break;
    }
    return out;
  }

  function notify(): void {
    cached = null;
    for (const l of listeners) l();
  }

  return {
    subscribe(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    getSnapshot(dayKey) {
      if (cached && cached.day === dayKey) return cached.ids;
      const ids = safeRead()[dayKey] ?? [];
      cached = { day: dayKey, ids };
      return ids;
    },
    dismiss(id, dayKey) {
      const map = safeRead();
      const ids = map[dayKey] ?? [];
      if (ids.includes(id)) return;
      map[dayKey] = [...ids, id];
      safeWrite(prune(map, dayKey));
      notify();
    },
    restore(id, dayKey) {
      const map = safeRead();
      const ids = map[dayKey] ?? [];
      if (!ids.includes(id)) return;
      map[dayKey] = ids.filter((x) => x !== id);
      safeWrite(map);
      notify();
    },
  };
}
