import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import { v } from "convex/values";
import { findPath } from "./growthPaths";
import { missionLiveValue, pathLiveMetrics } from "./pathMetrics";

/**
 * Real progress values for the missions of the stage the user is currently on.
 * Auto missions are measured from actual activity; manual ones report 0 until
 * the user checks them off.
 */
export const stage = query({
  args: { pathKey: v.string() },
  handler: async (ctx, { pathKey }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const path = findPath(pathKey);
    if (!path) return null;
    const enr = await ctx.db
      .query("pathEnrollments")
      .withIndex("by_user_path", (q) => q.eq("userId", userId).eq("pathKey", pathKey))
      .first();
    if (!enr || enr.status !== "active") return null;
    const stage = path.stages[enr.stageIndex];
    if (!stage) return null;

    const metrics = await pathLiveMetrics(ctx, userId, enr.stageStartedDay);
    return {
      stageKey: stage.key,
      stageIndex: enr.stageIndex,
      stageStartedDay: enr.stageStartedDay,
      metrics,
      missions: stage.missions.map((mm) => ({
        id: mm.id,
        value: enr.completedMissionIds.includes(mm.id)
          ? mm.target
          : missionLiveValue(mm.kind, metrics),
      })),
    };
  },
});
