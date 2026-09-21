import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import {
  PERSONAS,
  RECOMMENDED_DASHBOARDS,
  personaMeta,
  type DashboardConfig,
  type PersonaKey,
} from "@/lib/personas";

/**
 * Phase 1 personalization foundation — client side.
 *
 * Reads the signed-in user's profile (persona / goals / preferences /
 * dashboard config) with graceful defaults. Nothing in the existing UI
 * changes when no profile exists: callers receive the sensible default
 * ("personal" persona + its recommended dashboard).
 *
 * Phase 2+ consumers:
 *  - dashboard renders rows from `dashboardConfig` (visibility + order)
 *  - onboarding renders persona-specific questions
 *  - gamification / AI read persona for tuned defaults
 */
export function useUserProfile() {
  const profile = useQuery(api.userProfile.get, {});

  const personaKey: PersonaKey = (profile?.personaKey as PersonaKey) ?? "personal";
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
    /** Is the query still loading (undefined from Convex)? */
    isLoading: profile === undefined,
    personaKey,
    persona,
    /** All personas — for pickers in settings/onboarding. */
    personas: PERSONAS,
    goals: profile?.goals ?? [],
    preferences: safeJson(profile?.preferences),
    personaDetails: safeJson(profile?.personaDetails),
    /** Resolved dashboard layout: recommended default or the user's saved one. */
    dashboardConfig,
    /** Server-side mirror of the old onboarding "done" flag. */
    onboarded: !!profile,
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
