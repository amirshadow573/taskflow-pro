import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { isTestMode } from "@/lib/personas";

const TEST_USER = { name: "کاربر آزمایشی", image: undefined, email: "test@localhost" };

/**
 * Auth hook — in test mode returns a mock user without requiring
 * real Convex authentication, so all workspace components work.
 */
export function useAuth() {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.currentUser);
  const { signIn, signOut } = useAuthActions();

  if (isTestMode()) {
    return {
      isLoading: false,
      isAuthenticated: true,
      user: TEST_USER,
      signIn,
      signOut,
    };
  }

  const isLoading = isAuthLoading || user === undefined;

  return {
    isLoading,
    isAuthenticated,
    user,
    signIn,
    signOut,
  };
}
