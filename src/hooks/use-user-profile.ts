import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  PERSONAS,
  RECOMMENDED_DASHBOARDS,
  personaMeta,
  getTestPersonaSnapshot,
  subscribeTestPersona,
  type DashboardConfig,
  type PersonaKey,
} from "@/lib/personas";

/** Stable empty array — never return a fresh `[]` identity from a hook. */
const NO_GOALS: string[] = [];

const TEST_DASHBOARD_KEY = "taskly-test-dashboard";
const localDashboardListeners = new Set<() => void>();

function readLocalDashboardConfig(): string | null {
  return localStorage.getItem(TEST_DASHBOARD_KEY);
}

/** Re-render readers after a test-mode dashboard write. */
function notifyLocalDashboard(): void {
  for (const l of localDashboardListeners) l();
}

function subscribeLocalDashboard(cb: () => void): () => void {
  localDashboardListeners.add(cb);
  return () => {
    localDashboardListeners.delete(cb);
  };
}

/**
 * Personalization state hook — the single source of truth for the persona.
 *
 * Audit fixes:
 *  1. The test-mode persona used to be read from localStorage during render,
 *     which is NOT reactive — a persona change did not re-render the app. It is
 *     now read through `useSyncExternalStore`, so switching persona instantly
 *     updates the dashboard, navigation and every consumer.
 *  2. `profile?.goals ?? []` returned a brand-new array on every render while
 *     the profile was loading. Downstream effects treated that as "the saved
 *     goals changed" and overwrote the user's in-flight edits. A stable constant
 *     removes that phantom signal.
 */
export function useUserProfile() {
  const profile = useQuery(api.userProfile.get, {});
  const upsertProfile = useMutation(api.userProfile.upsert);

  // Reactive test-mode persona (null when test mode is off).
  const testPersona = useSyncExternalStore(
    subscribeTestPersona,
    getTestPersonaSnapshot,
    () => null,
  );
  // Re-render when the test-mode dashboard config is written.
  useSyncExternalStore(
    subscribeLocalDashboard,
    readLocalDashboardConfig,
    () => null,
  );

  const personaKey: PersonaKey =
    testPersona ?? (profile?.personaKey as PersonaKey) ?? "personal";

  const persona = personaMeta(personaKey);

  const dashboardConfig: DashboardConfig = useMemo(() => {
    // Test mode has no Convex profile, so the dashboard customization is kept
    // locally — otherwise every widget toggle silently reverted (audit fix).
    const raw = testPersona
      ? readLocalDashboardConfig()
      : profile?.dashboardConfig;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as DashboardConfig;
        if (parsed && Array.isArray(parsed.rows)) return parsed;
      } catch {
        /* fall through to the recommended config */
      }
    }
    return RECOMMENDED_DASHBOARDS[personaKey];
  }, [testPersona, profile?.dashboardConfig, personaKey]);

  /** Persist the profile patch. Test mode has no auth, so it is a no-op there
   *  (the test persona store is the source of truth instead). */
  const saveProfile = useCallback(
    async (patch: Parameters<typeof upsertProfile>[0]) => {
      if (testPersona) {
        // Persist locally so the change is real, not a fake success.
        if (patch.dashboardConfig) {
          localStorage.setItem("taskly-test-dashboard", patch.dashboardConfig);
          notifyLocalDashboard();
        }
        return;
      }
      await upsertProfile(patch);
    },
    [upsertProfile, testPersona],
  );

  return {
    /** Raw Convex document or null (not loaded / not created yet). */
    profile: profile ?? null,
    /** Is the query still loading? */
    isLoading: testPersona ? false : profile === undefined,
    personaKey,
    persona,
    personas: PERSONAS,
    goals: profile?.goals ?? NO_GOALS,
    planningStyle: profile?.workStyle ?? null,
    productivityStyle: profile?.productivityStyle ?? null,
    preferences: safeJson(profile?.preferences),
    personaDetails: safeJson(profile?.personaDetails),
    dashboardConfig,
    onboardingCompleted: testPersona ? true : !!profile?.completedOnboarding,
    /** Whether we're in test mode */
    testMode: !!testPersona,
    /** Persist persona / personalization changes. */
    saveProfile,
  };
}

function safeJson(raw?: string): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}
