import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { LevelUpOverlay, type ProgressionEvent } from "./LevelUpOverlay";
import { UnlockFeedback } from "./UnlockCenter";

function useProgressQuery() {
  return useQuery(api.gamification.myProgress);
}

export type ProgressData = NonNullable<ReturnType<typeof useProgressQuery>>;

const Ctx = createContext<ProgressData | null>(null);

/** Reactive progression snapshot for any component inside the workspace. */
export function useProgress(): ProgressData | null {
  return useContext(Ctx);
}

const BOOTSTRAP_KEY = "taskly-progress-boot";

/**
 * Bootstraps the progression engine and exposes the snapshot. `ready` waits for
 * sample-data seeding to settle so history is rebuilt from the seeded work.
 * The engine is idempotent; the session guard only avoids busywork.
 */
export function ProgressProvider({
  children,
  ready = true,
}: {
  children: React.ReactNode;
  ready?: boolean;
}) {
  const data = useProgressQuery();
  const ensure = useMutation(api.gamification.ensureProgress);
  const booted = useRef(false);
  const celebratedLevel = useRef<number | null>(null);
  const [event, setEvent] = useState<ProgressionEvent | null>(null);

  useEffect(() => {
    if (!ready || booted.current) return;
    booted.current = true;
    const stamp = new Date().toISOString().slice(0, 10);
    if (sessionStorage.getItem(BOOTSTRAP_KEY) === stamp) return;
    sessionStorage.setItem(BOOTSTRAP_KEY, stamp);
    ensure().catch(() => {
      // Non fatal: the dashboard still renders without progression data.
      booted.current = false;
      sessionStorage.removeItem(BOOTSTRAP_KEY);
    });
  }, [ensure, ready]);

  // Reactive level-up detection: every XP source (tasks, projects, goals,
  // focus sessions, missions…) celebrates the same way, even when the caller
  // does not emit a progression event manually.
  useEffect(() => {
    if (!data) return;
    if (celebratedLevel.current === null) {
      celebratedLevel.current = data.level;
      return;
    }
    if (data.level > celebratedLevel.current) {
      celebratedLevel.current = data.level;
      setEvent({ levelUp: data.level, xp: data.xp });
    } else {
      celebratedLevel.current = Math.max(celebratedLevel.current, data.level);
    }
  }, [data]);

  useEffect(() => {
    const handler = (raw: Event) => {
      const detail = (raw as CustomEvent).detail as ProgressionEvent | undefined;
      if (!detail) return;
      if (detail.levelUp || (detail.unlocked && detail.unlocked.length > 0)) {
        setEvent(detail);
      }
    };
    window.addEventListener("progress:event", handler);
    return () => window.removeEventListener("progress:event", handler);
  }, []);

  return (
    <Ctx.Provider value={data ?? null}>
      {children}
      <LevelUpOverlay event={event} onClose={() => setEvent(null)} />
      {/* Phase 08 — self-healing unlock sync + restrained grant feedback. */}
      <UnlockFeedback />
    </Ctx.Provider>
  );
}

/** Fire a progression event from anywhere in the app. */
export function emitProgressionEvent(event: ProgressionEvent) {
  window.dispatchEvent(new CustomEvent("progress:event", { detail: event }));
}
