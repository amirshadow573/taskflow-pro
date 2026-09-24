/**
 * useGoals — Phase 09.
 *
 * One reactive subscription to the centralized goals facade (src/convex/goals.ts),
 * which normalizes the persona's goal table (personal / work / team / business).
 * Returns `undefined` while loading so consumers can render skeleton-free
 * placeholders instead of fake data.
 */
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import type { GoalView } from "@/convex/goals";

export function useGoals(): GoalView[] | undefined {
  return useQuery(api.goals.list);
}
