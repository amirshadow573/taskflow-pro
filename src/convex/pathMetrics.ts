/**
 * Live metrics for the stage a user is currently working through in a growth
 * path. Kept separate from the engine so both the stage view and any future
 * evaluator share one implementation.
 */
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { todayKey } from "./progression";
import type { PathMissionKind } from "./growthPaths";

export interface PathLiveMetrics {
  tasksDone: number;
  daysActive: number;
  xpRange: number;
  routineDone: number;
  streak: number;
}

export async function pathLiveMetrics(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  fromDay: string,
): Promise<PathLiveMetrics> {
  const day = todayKey();
  const [stats, prog, checkins] = await Promise.all([
    ctx.db
      .query("dailyStats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("progress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first(),
    ctx.db
      .query("checkins")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", fromDay).lte("day", day),
      )
      .collect(),
  ]);

  const range = stats.filter((s) => s.day >= fromDay && s.day <= day);
  return {
    tasksDone: range.reduce((n, s) => n + s.completedTasks, 0),
    daysActive: range.filter((s) => s.completedTasks > 0 || s.routineDone > 0).length,
    xpRange: range.reduce((n, s) => n + s.xpEarned, 0),
    routineDone: checkins.filter((c) => c.done).length,
    streak: prog?.currentStreak ?? 0,
  };
}

/** Current value of a mission for the metrics above (manual missions need a tap). */
export function missionLiveValue(kind: PathMissionKind, m: PathLiveMetrics): number {
  switch (kind) {
    case "tasks":
      return m.tasksDone;
    case "routine":
      return m.routineDone;
    case "days":
      return m.daysActive;
    case "xp":
      return m.xpRange;
    case "streak":
      return m.streak;
    default:
      return 0;
  }
}
