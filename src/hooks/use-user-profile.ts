import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import {
  PERSONAS,
  RECOMMENDED_DASHBOARDS,
  personaMeta,
  isTestMode,
  getTestPersonaKey,
  type DashboardConfig,
  type PersonaKey,
} from "@/lib/personas";

/**
 * Personalization state hook — reads the user's profile with graceful
 * defaults. In test mode, uses localStorage-selected persona instead of
 * Convex profile, allowing persona switching without real accounts.
 */
export function useUserProfile() {
  const profile = useQuery(api.userProfile.get, {});

  // Test mode: use localStorage persona instead of Convex profile
  const testPersona = isTestMode() ? getTestPersonaKey() : null;
  const personaKey: PersonaKey = testPersona
    ?? (profile?.personaKey as PersonaKey)
    ?? "personal";

  const persona = personaMeta(personaKey);

  let dashboardConfig: DashboardConfig = RECOMMENDED_DASHBOARDS[personaKey];
  if (profile?.dashboardConfig) {
    try {
      const parsed = JSON.parse(profile.dashboardConfig) as DashboardConfig;
      if (parsed && Array.isArray(parsed.rows)) dashboardConfig = parsed;
    } catch {
      /* fall back to the recommended config */
    }
  }

  return {
    /** Raw Convex document or null (not loaded / not created yet). */
    profile: profile ?? null,
    /** Is the query still loading? */
    isLoading: testPersona ? false : profile === undefined,
    personaKey,
    persona,
    personas: PERSONAS,
    goals: profile?.goals ?? [],
    planningStyle: profile?.workStyle ?? null,
    productivityStyle: profile?.productivityStyle ?? null,
    preferences: safeJson(profile?.preferences),
    personaDetails: safeJson(profile?.personaDetails),
    dashboardConfig,
    onboardingCompleted: testPersona ? true : !!profile?.completedOnboarding,
    /** Whether we're in test mode */
    testMode: !!testPersona,
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
