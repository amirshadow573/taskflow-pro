import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useUserProfile } from "@/hooks/use-user-profile";

/**
 * Personalization gate (Phase 2).
 *
 * On /onboarding:
 *  - profile loaded + onboardingCompleted → redirect to /dashboard
 *    (returning users must never see onboarding again)
 *  - no profile or not completed → render the onboarding flow
 *
 * While the profile is still loading, render the flow itself so a fresh
 * user starts seeing welcome content immediately; if the profile later
 * resolves as completed, the redirect happens then (no dead wait).
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const { onboardingCompleted } = useUserProfile();
  const location = useLocation();

  if (onboardingCompleted) {
    return <Navigate to="/dashboard" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
