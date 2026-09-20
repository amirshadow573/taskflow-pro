/**
 * Level-up / gamification engine.
 *
 * Everything here is derived from real productivity data: tasks, routine
 * check-ins and the XP ledger. No external services, no AI.
 *
 * Public surface:
 *  - hooks: `handleTaskToggle`, `handleRoutineToggle` (called by tasks.ts / routines.ts)
 *  - queries: myProgress, overviewStats, xpHistory, missions, challengesState,
 *             achievementsList, leaderboard, rewardsList, pathsOverview,
 *             pathDetail, activityHeatmap, todayPathMissions, levelLadder
 *  - mutations: ensureProgress, startChallenge, joinPath, leavePath, completePathMission
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  ACHIEVEMENTS,
  CHALLENGES,
  DAILY_MISSIONS,
  LEVELS,
  REWARDS,
  WEEKLY_MISSIONS,
  XP_RULES,
  computeDailyScore,
  dateKey,
  diffDays,
  levelInfoFromXp,
  monthStartKey,
  shiftKey,
  todayKey,
  weekStartKey,
  type MissionTemplate,
} from "./progression";
import {
  GROWTH_PATHS,
  findPath,
  pathProgressXp,
  pathTotalXp,
  type PathMission,
} from "./growthPaths";

/* ------------------------------------------------------------------ */
/* small helpers                                                       */
/* ------------------------------------------------------------------ */

const STREAK_XP: Record<number, number> = { 7: 100, 14: 200, 30: 400, 60: 700, 100: 1000 };
const MANUAL_MISSION_XP_CAP_PER_DAY = 6;

type Ctx = QueryCtx | MutationCtx;

async function uid(ctx: Ctx): Promise<Id<"users"> | null> {
  return await getAuthUserId(ctx);
}

async function progDoc(ctx: Ctx, userId: Id<"users">): Promise<Doc<"progress"> | null> {
  return await ctx.db
    .query("progress")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
}

async function listTasks(ctx: Ctx, userId: Id<"users">): Promise<Doc<"tasks">[]> {
  return await ctx.db
    .query("tasks")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("archived"), false))
    .collect();
}

async function listItems(ctx: Ctx, userId: Id<"users">): Promise<Doc<"routineItems">[]> {
  return await ctx.db
    .query("routineItems")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.neq(q.field("archived"), true))
    .collect();
}

async function listCheckins(ctx: Ctx, userId: Id<"users">): Promise<Doc<"checkins">[]> {
  return await ctx.db
    .query("checkins")
    .withIndex("by_user_day", (q) => q.eq("userId", userId))
    .collect();
}

async function listDaily(ctx: Ctx, userId: Id<"users">): Promise<Doc<"dailyStats">[]> {
  return await ctx.db
    .query("dailyStats")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
}

async function listMissions(ctx: Ctx, userId: Id<"users">): Promise<Doc<"missionState">[]> {
  return await ctx.db
    .query("missionState")
    .withIndex("by_user_scope", (q) => q.eq("userId", userId))
    .collect();
}

async function eventByRef(
  ctx: Ctx,
  userId: Id<"users">,
  refType: string,
  refId: string,
): Promise<Doc<"xpEvents"> | null> {
  return await ctx.db
    .query("xpEvents")
    .withIndex("by_user_ref", (q) =>
      q.eq("userId", userId).eq("refType", refType).eq("refId", refId),
    )
    .first();
}

async function countEvents(
  ctx: Ctx,
  userId: Id<"users">,
  day: string,
  kinds: string[],
): Promise<number> {
  const rows = await ctx.db
    .query("xpEvents")
    .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
    .collect();
  return rows.filter((r) => kinds.includes(r.kind)).length;
}

const hasActivity = (s: { completedTasks: number; routineDone: number }): boolean =>
  s.completedTasks > 0 || s.routineDone > 0;

const fullRoutineDay = (s: { routineItems: number; routineDone: number }): boolean =>
  s.routineItems > 0 && s.routineDone >= s.routineItems;

/* ------------------------------------------------------------------ */
/* XP ledger                                                           */
/* ------------------------------------------------------------------ */

async function awardXp(
  ctx: MutationCtx,
  userId: Id<"users">,
  opts: {
    amount: number;
    kind: string;
    label: string;
    day: string;
    refType?: string;
    refId?: string;
    meta?: string;
  },
): Promise<boolean> {
  const { amount, kind, label, day, refType, refId, meta } = opts;
  if (amount <= 0) return false;
  if (refType && refId) {
    const existing = await eventByRef(ctx, userId, refType, refId);
    if (existing) return false;
  }
  // Anti-farming caps for the repeatable categories.
  if (kind === "task" || kind === "subtask") {
    const n = await countEvents(ctx, userId, day, ["task", "subtask"]);
    if (n >= XP_RULES.dailyTaskXpCap) return false;
  }
  if (kind === "routine") {
    const n = await countEvents(ctx, userId, day, ["routine"]);
    if (n >= XP_RULES.dailyRoutineXpCap) return false;
  }
  if (kind === "path" && refType === "pathManual") {
    const n = await countEvents(ctx, userId, day, ["path"]);
    if (n >= MANUAL_MISSION_XP_CAP_PER_DAY) return false;
  }

  await ctx.db.insert("xpEvents", {
    userId,
    amount,
    kind,
    label,
    day,
    createdAt: Date.now(),
    refType,
    refId,
    meta,
  });

  const prog = await progDoc(ctx, userId);
  if (prog) {
    const totalXp = prog.totalXp + amount;
    await ctx.db.patch(prog._id, {
      totalXp,
      level: levelInfoFromXp(totalXp).level,
      updatedAt: Date.now(),
    });
  }
  return true;
}

/** Remove a previously awarded event (used when a task is re-opened). */
async function revokeXp(
  ctx: MutationCtx,
  userId: Id<"users">,
  refType: string,
  refId: string,
): Promise<void> {
  const existing = await eventByRef(ctx, userId, refType, refId);
  if (!existing) return;
  await ctx.db.delete(existing._id);
  const prog = await progDoc(ctx, userId);
  if (prog) {
    const totalXp = Math.max(0, prog.totalXp - existing.amount);
    await ctx.db.patch(prog._id, {
      totalXp,
      level: levelInfoFromXp(totalXp).level,
      updatedAt: Date.now(),
    });
  }
}

/* ------------------------------------------------------------------ */
/* Day numbers + daily stats                                           */
/* ------------------------------------------------------------------ */

interface DayNumbers {
  day: string;
  plannedTasks: number;
  plannedDone: number;
  completedTasks: number;
  priorityDone: number;
  focusMinutes: number;
  routineItems: number;
  routineDone: number;
  routinesFull: number;
  xpEarned: number;
  missionsDone: number;
  missionsTotal: number;
}

async function computeDayNumbers(
  ctx: Ctx,
  userId: Id<"users">,
  day: string,
): Promise<DayNumbers> {
  const [allTasks, items, checkins, xpRows, missions] = await Promise.all([
    listTasks(ctx, userId),
    listItems(ctx, userId),
    ctx.db
      .query("checkins")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
      .collect(),
    ctx.db
      .query("xpEvents")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
      .collect(),
    listMissions(ctx, userId),
  ]);

  const roots = allTasks.filter((t) => !t.parentId);
  const planned = roots.filter((t) => t.dueDate === day);
  const plannedDone = planned.filter((t) => t.status === "done").length;
  const completedNow = roots.filter(
    (t) => t.status === "done" && t.completedAt && dateKey(new Date(t.completedAt)) === day,
  );
  const priorityDone = completedNow.filter(
    (t) => t.priority === "high" || t.priority === "urgent",
  ).length;
  const focusMinutes = completedNow.reduce((n, t) => n + (t.estimateMinutes ?? 0), 0);

  const doneIds = new Set(checkins.filter((c) => c.done).map((c) => c.itemId));
  const routineDone = items.filter((i) => doneIds.has(i._id)).length;
  const perRoutine = new Map<string, { total: number; done: number }>();
  for (const i of items) {
    const cur = perRoutine.get(i.routineId) ?? { total: 0, done: 0 };
    cur.total += 1;
    if (doneIds.has(i._id)) cur.done += 1;
    perRoutine.set(i.routineId, cur);
  }
  const routinesFull = [...perRoutine.values()].filter(
    (r) => r.total > 0 && r.done >= r.total,
  ).length;

  const dayMissions = missions.filter((mm) => mm.scope === "daily" && mm.period === day);

  return {
    day,
    plannedTasks: planned.length,
    plannedDone,
    completedTasks: completedNow.length,
    priorityDone,
    focusMinutes,
    routineItems: items.length,
    routineDone,
    routinesFull,
    xpEarned: xpRows.reduce((n, r) => n + r.amount, 0),
    missionsDone: dayMissions.filter((mm) => mm.completed).length,
    missionsTotal: dayMissions.length,
  };
}

async function upsertDaily(
  ctx: MutationCtx,
  userId: Id<"users">,
  n: DayNumbers,
  streak: number,
): Promise<void> {
  const breakdown = computeDailyScore({
    plannedTasks: n.plannedTasks,
    completedTasks: n.completedTasks,
    routineItems: n.routineItems,
    routineDone: n.routineDone,
    currentStreak: streak,
    missionsDone: n.missionsDone,
    missionsTotal: n.missionsTotal,
  });
  const patch = {
    plannedTasks: n.plannedTasks,
    completedTasks: n.completedTasks,
    routineItems: n.routineItems,
    routineDone: n.routineDone,
    focusMinutes: n.focusMinutes,
    xpEarned: n.xpEarned,
    missionsDone: n.missionsDone,
    missionsTotal: n.missionsTotal,
    taskScore: breakdown.tasks,
    routineScore: breakdown.routines,
    consistencyScore: breakdown.consistency,
    missionScore: breakdown.missions,
    score: breakdown.total,
    updatedAt: Date.now(),
  };
  const existing = await ctx.db
    .query("dailyStats")
    .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", n.day))
    .first();
  if (existing) await ctx.db.patch(existing._id, patch);
  else await ctx.db.insert("dailyStats", { userId, day: n.day, ...patch });
}

/** Re-read the day's XP/mission counts and refresh the stored score. */
async function refreshDaily(ctx: MutationCtx, ctxUserId: Id<"users">, day: string): Promise<void> {
  const [xpRows, missions, row, prog] = await Promise.all([
    ctx.db
      .query("xpEvents")
      .withIndex("by_user_day", (q) => q.eq("userId", ctxUserId).eq("day", day))
      .collect(),
    listMissions(ctx, ctxUserId),
    ctx.db
      .query("dailyStats")
      .withIndex("by_user_day", (q) => q.eq("userId", ctxUserId).eq("day", day))
      .first(),
    progDoc(ctx, ctxUserId),
  ]);
  if (!row) return;
  const dayMissions = missions.filter((mm) => mm.scope === "daily" && mm.period === day);
  const breakdown = computeDailyScore({
    plannedTasks: row.plannedTasks,
    completedTasks: row.completedTasks,
    routineItems: row.routineItems,
    routineDone: row.routineDone,
    currentStreak: prog?.currentStreak ?? 0,
    missionsDone: dayMissions.filter((mm) => mm.completed).length,
    missionsTotal: dayMissions.length,
  });
  await ctx.db.patch(row._id, {
    xpEarned: xpRows.reduce((n, r) => n + r.amount, 0),
    missionsDone: dayMissions.filter((mm) => mm.completed).length,
    missionsTotal: dayMissions.length,
    taskScore: breakdown.tasks,
    routineScore: breakdown.routines,
    consistencyScore: breakdown.consistency,
    missionScore: breakdown.missions,
    score: breakdown.total,
    updatedAt: Date.now(),
  });
}

/* ------------------------------------------------------------------ */
/* Streaks                                                             */
/* ------------------------------------------------------------------ */

function computeStreaks(
  activeDays: string[],
  today: string,
): { current: number; longest: number; lastDay: string | null; restUsed: number } {
  const sorted = [...new Set(activeDays)].sort();
  if (sorted.length === 0) return { current: 0, longest: 0, lastDay: null, restUsed: 0 };
  const lastDay = sorted[sorted.length - 1];
  const missed = diffDays(today, lastDay) - 1;

  let current = 0;
  let restUsed = 0;
  if (missed <= 1) {
    current = 1;
    restUsed = Math.max(0, missed);
    let prev = lastDay;
    for (let i = sorted.length - 2; i >= 0; i--) {
      const gap = diffDays(prev, sorted[i]) - 1; // 0 = consecutive days
      if (gap <= 1) {
        current += 1;
        if (gap === 1) restUsed += 1;
        prev = sorted[i];
      } else break;
    }
  }

  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const gap = diffDays(sorted[i], sorted[i - 1]) - 1;
    if (gap <= 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else run = 1;
  }
  longest = Math.max(longest, current);
  return { current, longest, lastDay, restUsed };
}

async function syncStreak(
  ctx: MutationCtx,
  userId: Id<"users">,
  day: string,
): Promise<{ current: number; longest: number }> {
  const stats = await listDaily(ctx, userId);
  const active = stats.filter(hasActivity).map((s) => s.day);
  const { current, longest, lastDay, restUsed } = computeStreaks(active, day);
  const prog = await progDoc(ctx, userId);
  if (prog) {
    await ctx.db.patch(prog._id, {
      currentStreak: current,
      longestStreak: Math.max(longest, prog.longestStreak),
      lastActiveDay: lastDay ?? undefined,
      restDaysUsed: restUsed,
      updatedAt: Date.now(),
    });
  }
  // Streak milestones (awarded once each).
  for (const milestone of XP_RULES.streakMilestones) {
    if (current >= milestone) {
      await awardXp(ctx, userId, {
        amount: STREAK_XP[milestone] ?? 100,
        kind: "streak",
        label: `زنجیره ${milestone} روزه`,
        day,
        refType: "streak",
        refId: `streak:${milestone}`,
      });
    }
  }
  return { current, longest };
}

/* ------------------------------------------------------------------ */
/* Day bonuses                                                         */
/* ------------------------------------------------------------------ */

async function applyDayBonuses(
  ctx: MutationCtx,
  userId: Id<"users">,
  day: string,
  n: DayNumbers,
): Promise<void> {
  const plannedRef = `day:${day}:planned`;
  const plannedOk =
    n.plannedTasks >= 3 && n.plannedDone >= n.plannedTasks && n.plannedDone > 0;
  if (plannedOk) {
    await awardXp(ctx, userId, {
      amount: XP_RULES.plannedDayBonus,
      kind: "bonus",
      label: "پاداش روز کامل — همه کارهای برنامه‌ریزی‌شده",
      day,
      refType: "dayBonus",
      refId: plannedRef,
    });
  } else {
    await revokeXp(ctx, userId, "dayBonus", plannedRef);
  }

  const routineRef = `day:${day}:routine`;
  const routineOk = n.routineItems >= 3 && n.routineDone >= n.routineItems;
  if (routineOk) {
    await awardXp(ctx, userId, {
      amount: XP_RULES.perfectRoutineBonus,
      kind: "bonus",
      label: "پاداش روتین کامل روز",
      day,
      refType: "dayBonus",
      refId: routineRef,
    });
  } else {
    await revokeXp(ctx, userId, "dayBonus", routineRef);
  }
}

/* ------------------------------------------------------------------ */
/* Missions                                                            */
/* ------------------------------------------------------------------ */

function missionValue(
  t: MissionTemplate,
  ctxData: {
    n: DayNumbers;
    weekScoreDays: number;
    weekTasks: number;
    weekRoutineDays: number;
    weekXp: number;
    streak: number;
  },
): number {
  const { n } = ctxData;
  switch (t.metric) {
    case "tasks_done":
      return n.completedTasks;
    case "priority_done":
      return n.priorityDone;
    case "all_planned":
      return n.plannedTasks >= 3 && n.plannedDone >= n.plannedTasks
        ? 100
        : n.plannedTasks > 0
          ? Math.round((n.plannedDone / n.plannedTasks) * 100)
          : 0;
    case "focus_minutes":
      return n.focusMinutes;
    case "routine_items":
      return n.routineDone;
    case "routine_full":
      return n.routinesFull;
    case "habit_streak":
      return n.routineDone > 0 ? 1 : 0;
    case "score_days":
      return ctxData.weekScoreDays;
    case "routine_days":
      return ctxData.weekRoutineDays;
    case "tasks_week":
      return ctxData.weekTasks;
    case "xp_today":
      return n.xpEarned;
    case "xp_week":
      return ctxData.weekXp;
    case "streak":
      return ctxData.streak;
    default:
      return 0;
  }
}

async function evaluateMissions(
  ctx: MutationCtx,
  userId: Id<"users">,
  day: string,
  n: DayNumbers,
  streak: number,
): Promise<void> {
  const [stats, items] = await Promise.all([listDaily(ctx, userId), listItems(ctx, userId)]);
  const hasRoutines = items.length > 0;
  const week = weekStartKey(day);
  const weekRows = stats.filter((s) => s.day >= week && s.day <= day);
  const weekScoreDays = weekRows.filter((s) => s.score >= 60).length;
  const weekTasks = weekRows.reduce((x, s) => x + s.completedTasks, 0);
  const weekRoutineDays = weekRows.filter(fullRoutineDay).length;
  const weekXp = weekRows.reduce((x, s) => x + s.xpEarned, 0);

  const scopes: Array<{ scope: string; templates: MissionTemplate[]; period: string }> = [
    { scope: "daily", templates: DAILY_MISSIONS, period: day },
    { scope: "weekly", templates: WEEKLY_MISSIONS, period: week },
  ];

  for (const { scope, templates, period } of scopes) {
    for (const t of templates) {
      if (t.requiresRoutines && !hasRoutines) continue;
      const value = missionValue(t, {
        n,
        weekScoreDays,
        weekTasks,
        weekRoutineDays,
        weekXp,
        streak,
      });
      const existing = await ctx.db
        .query("missionState")
        .withIndex("by_user_key_period", (q) =>
          q.eq("userId", userId).eq("key", t.key).eq("period", period),
        )
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, {
          progress: value,
          target: t.target,
          ...(existing.completed ? {} : { completed: value >= t.target }),
        });
      } else {
        await ctx.db.insert("missionState", {
          userId,
          key: t.key,
          scope,
          period,
          progress: value,
          target: t.target,
          completed: value >= t.target,
        });
      }
      if (value >= t.target) {
        const award = await awardXp(ctx, userId, {
          amount: t.xp,
          kind: "mission",
          label: t.title,
          day,
          refType: "mission",
          refId: `${t.key}:${period}`,
        });
        if (award) {
          const row = await ctx.db
            .query("missionState")
            .withIndex("by_user_key_period", (q) =>
              q.eq("userId", userId).eq("key", t.key).eq("period", period),
            )
            .first();
          if (row) await ctx.db.patch(row._id, { completed: true, completedAt: Date.now() });
        }
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Challenges                                                          */
/* ------------------------------------------------------------------ */

async function evaluateChallenges(
  ctx: MutationCtx,
  userId: Id<"users">,
  day: string,
): Promise<void> {
  const [rows, stats] = await Promise.all([
    ctx.db
      .query("challengeState")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
    listDaily(ctx, userId),
  ]);

  for (const c of rows) {
    if (c.status !== "active") continue;
    const def = CHALLENGES.find((x) => x.key === c.key);
    if (!def) continue;
    const until = c.endsDay < day ? c.endsDay : day;
    const range = stats.filter((s) => s.day >= c.startedDay && s.day <= until);
    let value = 0;
    if (def.metric === "days_active") value = range.filter(hasActivity).length;
    else if (def.metric === "tasks_done")
      value = range.reduce((x, s) => x + s.completedTasks, 0);
    else if (def.metric === "routine_days") value = range.filter(fullRoutineDay).length;
    else value = range.reduce((x, s) => x + s.xpEarned, 0);

    const progress = Math.min(def.target, value);
    if (progress >= def.target) {
      const awarded = await awardXp(ctx, userId, {
        amount: def.xp,
        kind: "challenge",
        label: def.title,
        day,
        refType: "challenge",
        refId: `challenge:${def.key}:${c.startedDay}`,
      });
      await ctx.db.patch(c._id, {
        progress: def.target,
        target: def.target,
        status: "completed",
        completedAt: awarded ? Date.now() : c.completedAt ?? Date.now(),
      });
    } else if (day > c.endsDay) {
      await ctx.db.patch(c._id, { progress, target: def.target, status: "failed" });
    } else {
      await ctx.db.patch(c._id, { progress, target: def.target });
    }
  }
}

/* ------------------------------------------------------------------ */
/* Growth paths                                                        */
/* ------------------------------------------------------------------ */

async function evaluatePaths(
  ctx: MutationCtx,
  userId: Id<"users">,
  day: string,
  n: DayNumbers,
): Promise<void> {
  const enrollments = await ctx.db
    .query("pathEnrollments")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const active = enrollments.filter((e) => e.status === "active");
  if (active.length === 0) return;

  const [stats, checkins] = await Promise.all([
    listDaily(ctx, userId),
    listCheckins(ctx, userId),
  ]);

  for (const enr of active) {
    const path = findPath(enr.pathKey);
    if (!path) continue;
    let stageIndex = enr.stageIndex;
    let stageStart = enr.stageStartedDay;
    let completedIds = [...enr.completedMissionIds];
    let bonuses = [...enr.stageBonusesPaid];
    let xpEarned = enr.xpEarned;
    let changed = false;
    let guard = 0;

    while (stageIndex < path.stages.length && guard < 8) {
      guard += 1;
      const stage = path.stages[stageIndex];
      const range = stats.filter((s) => s.day >= stageStart && s.day <= day);
      const daysActive = range.filter(hasActivity).length;
      const tasksDone = range.reduce((x, s) => x + s.completedTasks, 0);
      const xpRange = range.reduce((x, s) => x + s.xpEarned, 0);
      const routineRange = checkins.filter(
        (c) => c.done && c.day >= stageStart && c.day <= day,
      ).length;
      const prog = await progDoc(ctx, userId);

      for (const mission of stage.missions) {
        if (completedIds.includes(mission.id)) continue;
        let value = 0;
        if (mission.kind === "tasks") value = tasksDone;
        else if (mission.kind === "routine") value = routineRange;
        else if (mission.kind === "days") value = daysActive;
        else if (mission.kind === "xp") value = xpRange;
        else if (mission.kind === "streak") value = prog?.currentStreak ?? 0;
        else value = 0; // manual missions need an explicit completion
        if (value >= mission.target && mission.kind !== "manual") {
          const awarded = await awardXp(ctx, userId, {
            amount: mission.xp,
            kind: "path",
            label: mission.title,
            day,
            refType: "pathMission",
            refId: `path:${path.key}:${mission.id}`,
            meta: path.key,
          });
          completedIds.push(mission.id);
          if (awarded) xpEarned += mission.xp;
          changed = true;
        }
      }

      const stageDone = stage.missions.every((mm) => completedIds.includes(mm.id));
      if (!stageDone) break;

      if (!bonuses.includes(stage.key)) {
        const awarded = await awardXp(ctx, userId, {
          amount: stage.bonus,
          kind: "stage",
          label: `تکمیل مرحله «${stage.title}» — ${path.title}`,
          day,
          refType: "pathStage",
          refId: `path:${path.key}:${stage.key}`,
          meta: path.key,
        });
        bonuses.push(stage.key);
        if (awarded) xpEarned += stage.bonus;
        changed = true;
      }

      if (stageIndex + 1 >= path.stages.length) {
        // Path finished.
        const awarded = await awardXp(ctx, userId, {
          amount: path.completionXp,
          kind: "path",
          label: `تکمیل مسیر «${path.title}»`,
          day,
          refType: "pathDone",
          refId: `pathDone:${path.key}`,
          meta: path.key,
        });
        if (awarded) xpEarned += path.completionXp;
        await unlockAchievement(ctx, userId, `path_${path.key}_done`);
        await ctx.db.patch(enr._id, {
          status: "completed",
          stageIndex,
          completedMissionIds: completedIds,
          stageBonusesPaid: bonuses,
          xpEarned,
          completedAt: Date.now(),
          lastActiveAt: Date.now(),
        });
        changed = false;
        break;
      }

      stageIndex += 1;
      stageStart = day;
      changed = true;
    }

    if (changed) {
      await ctx.db.patch(enr._id, {
        stageIndex,
        stageStartedDay: stageStart,
        completedMissionIds: completedIds,
        stageBonusesPaid: bonuses,
        xpEarned,
        lastActiveAt: Date.now(),
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/* Achievements + rewards                                              */
/* ------------------------------------------------------------------ */

async function unlockAchievement(
  ctx: MutationCtx,
  userId: Id<"users">,
  key: string,
): Promise<boolean> {
  const existing = await ctx.db
    .query("achievementUnlocks")
    .withIndex("by_user_key", (q) => q.eq("userId", userId).eq("key", key))
    .first();
  if (existing) return false;
  await ctx.db.insert("achievementUnlocks", { userId, key, unlockedAt: Date.now() });
  return true;
}

interface StatSnapshot {
  tasksDone: number;
  tasksOneDay: number;
  currentStreak: number;
  longestStreak: number;
  level: number;
  missionsDone: number;
  challengesDone: number;
  pathsDone: number;
  perfectDays: number;
  routineDays: number;
  activeDays: number;
  projectsDone: number;
  xpTotal: number;
  routineDone: number;
}

async function evaluateAchievements(
  ctx: MutationCtx,
  userId: Id<"users">,
  day: string,
): Promise<string[]> {
  const [stats, prog, unlocks, missions, challenges, paths, projects] = await Promise.all([
    listDaily(ctx, userId),
    progDoc(ctx, userId),
    ctx.db
      .query("achievementUnlocks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
    listMissions(ctx, userId),
    ctx.db
      .query("challengeState")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("pathEnrollments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
  ]);

  const snapshot: StatSnapshot = {
    tasksDone: stats.reduce((n, s) => n + s.completedTasks, 0),
    tasksOneDay: stats.reduce((n, s) => Math.max(n, s.completedTasks), 0),
    currentStreak: prog?.currentStreak ?? 0,
    longestStreak: prog?.longestStreak ?? 0,
    level: prog?.level ?? 1,
    missionsDone: missions.filter((mm) => mm.completed).length,
    challengesDone: challenges.filter((c) => c.status === "completed").length,
    pathsDone: paths.filter((p) => p.status === "completed").length,
    perfectDays: stats.filter((s) => s.score >= 100).length,
    routineDays: stats.filter(fullRoutineDay).length,
    activeDays: stats.filter(hasActivity).length,
    projectsDone: projects.filter((p) => p.status === "completed").length,
    xpTotal: prog?.totalXp ?? 0,
    routineDone: stats.reduce((n, s) => n + s.routineDone, 0),
  };

  const unlocked = new Set(unlocks.map((u) => u.key));
  const newly: string[] = [];

  for (const def of ACHIEVEMENTS) {
    if (unlocked.has(def.key)) continue;
    const value = snapshot[def.metric as keyof StatSnapshot] ?? 0;
    if (value >= def.target) {
      if (await unlockAchievement(ctx, userId, def.key)) {
        newly.push(def.key);
      }
    }
  }

  // Level based rewards.
  const earnedRewards = REWARDS.filter((r) => r.level <= snapshot.level);
  for (const reward of earnedRewards) {
    const has = await ctx.db
      .query("rewardUnlocks")
      .withIndex("by_user_key", (q) => q.eq("userId", userId).eq("key", reward.key))
      .first();
    if (!has) {
      await ctx.db.insert("rewardUnlocks", {
        userId,
        key: reward.key,
        unlockedAt: Date.now(),
      });
    }
  }

  void day;
  return newly;
}

/* ------------------------------------------------------------------ */
/* Totals                                                              */
/* ------------------------------------------------------------------ */

async function syncTotals(ctx: MutationCtx, userId: Id<"users">, day: string): Promise<void> {
  const prog = await progDoc(ctx, userId);
  if (!prog) return;
  const week = weekStartKey(day);
  const month = monthStartKey(day);
  const [weekRows, monthRows] = await Promise.all([
    ctx.db
      .query("xpEvents")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).gte("day", week).lte("day", day))
      .collect(),
    ctx.db
      .query("xpEvents")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", month).lte("day", day),
      )
      .collect(),
  ]);
  await ctx.db.patch(prog._id, {
    weekKey: week,
    weekXp: weekRows.reduce((n, r) => n + r.amount, 0),
    monthKey: month,
    monthXp: monthRows.reduce((n, r) => n + r.amount, 0),
    level: levelInfoFromXp(prog.totalXp).level,
    updatedAt: Date.now(),
  });
}

/* ------------------------------------------------------------------ */
/* Engine entry points                                                 */
/* ------------------------------------------------------------------ */

interface EngineResult {
  level: number;
  levelUp: number | null;
  unlocked: string[];
  xp: number;
}

async function runEngine(
  ctx: MutationCtx,
  userId: Id<"users">,
  day: string,
  startLevel: number,
): Promise<EngineResult> {
  const before = await progDoc(ctx, userId);
  const numbers = await computeDayNumbers(ctx, userId, day);
  await upsertDaily(ctx, userId, numbers, before?.currentStreak ?? 0);
  await applyDayBonuses(ctx, userId, day, numbers);
  await evaluateMissions(ctx, userId, day, numbers, before?.currentStreak ?? 0);
  await evaluateChallenges(ctx, userId, day);
  await evaluatePaths(ctx, userId, day, numbers);
  const { current } = await syncStreak(ctx, userId, day);
  await refreshDaily(ctx, userId, day);
  await syncTotals(ctx, userId, day);
  const unlocked = await evaluateAchievements(ctx, userId, day);
  await syncTotals(ctx, userId, day);

  const after = await progDoc(ctx, userId);
  void current;
  return {
    level: after?.level ?? 1,
    levelUp: (after?.level ?? 1) > startLevel ? (after?.level ?? 1) : null,
    unlocked,
    xp: after?.totalXp ?? 0,
  };
}

/** Called by tasks.toggleDone after the task document has been patched. */
export async function handleTaskToggle(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  done: boolean,
): Promise<EngineResult> {
  const userId = task.userId;
  const prog = await ensureProgressDoc(ctx, userId);
  const startLevel = prog.level;
  const day = todayKey();

  if (done) {
    const isSubtask = !!task.parentId;
    const amount = isSubtask
      ? XP_RULES.subtask
      : (XP_RULES.taskByPriority[task.priority] ?? 10);
    await awardXp(ctx, userId, {
      amount,
      kind: isSubtask ? "subtask" : "task",
      label: isSubtask ? `زیرکار «${task.title}»` : `تکمیل «${task.title}»`,
      day,
      refType: "task",
      refId: task._id,
    });
  } else {
    await revokeXp(ctx, userId, "task", task._id);
  }
  // The progression layer must never block finishing a real task. It is fully
  // idempotent, so a partial failure simply self-heals on the next activity.
  try {
    return await runEngine(ctx, userId, day, startLevel);
  } catch (err) {
    console.error("[gamification] engine failed after task toggle", err);
    return { level: startLevel, levelUp: null, unlocked: [], xp: 0 };
  }
}

/** Called by routines.toggleCheckin. */
export async function handleRoutineToggle(
  ctx: MutationCtx,
  userId: Id<"users">,
  itemTitle: string,
  day: string,
  done: boolean,
): Promise<EngineResult> {
  const prog = await ensureProgressDoc(ctx, userId);
  const startLevel = prog.level;
  const ref = `${itemTitle}:${day}`;
  if (done) {
    await awardXp(ctx, userId, {
      amount: XP_RULES.routineItem,
      kind: "routine",
      label: `روتین «${itemTitle}»`,
      day,
      refType: "routineRef",
      refId: ref,
    });
  } else {
    await revokeXp(ctx, userId, "routineRef", ref);
  }
  try {
    return await runEngine(ctx, userId, day, startLevel);
  } catch (err) {
    console.error("[gamification] engine failed after routine toggle", err);
    return { level: startLevel, levelUp: null, unlocked: [], xp: 0 };
  }
}

/* ------------------------------------------------------------------ */
/* Bootstrapping + backfill                                            */
/* ------------------------------------------------------------------ */

async function ensureProgressDoc(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"progress">> {
  const existing = await progDoc(ctx, userId);
  if (existing) return existing;
  const id = await ctx.db.insert("progress", {
    userId,
    totalXp: 0,
    level: 1,
    currentStreak: 0,
    longestStreak: 0,
    restDaysUsed: 0,
    weekXp: 0,
    monthXp: 0,
    updatedAt: Date.now(),
  });
  await backfill(ctx, userId);
  const doc = await ctx.db.get(id);
  return doc ?? {
    _id: id,
    _creationTime: Date.now(),
    userId,
    totalXp: 0,
    level: 1,
    currentStreak: 0,
    longestStreak: 0,
    restDaysUsed: 0,
    weekXp: 0,
    monthXp: 0,
    updatedAt: Date.now(),
  };
}

/**
 * Rebuild history from data that already exists (sample data, imported tasks,
 * routine check-ins) so a user never starts at a totally empty profile.
 */
async function backfill(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  const [tasks, items, checkins] = await Promise.all([
    listTasks(ctx, userId),
    listItems(ctx, userId),
    listCheckins(ctx, userId),
  ]);

  const roots = tasks.filter((t) => !t.parentId);
  const completions = roots
    .filter((t) => t.status === "done" && t.completedAt)
    .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0));

  const perDay = new Map<string, number>();
  let totalXp = 0;
  let inserted = 0;

  for (const task of completions) {
    if (inserted >= 600) break;
    const day = dateKey(new Date(task.completedAt!));
    const used = perDay.get(day) ?? 0;
    if (used >= XP_RULES.dailyTaskXpCap) continue;
    perDay.set(day, used + 1);
    const amount = XP_RULES.taskByPriority[task.priority] ?? 10;
    await ctx.db.insert("xpEvents", {
      userId,
      amount,
      kind: "task",
      label: `تکمیل «${task.title}»`,
      day,
      createdAt: task.completedAt!,
      refType: "task",
      refId: task._id,
    });
    totalXp += amount;
    inserted += 1;
  }

  const doneCheckins = checkins.filter((c) => c.done);
  const itemTitle = new Map(items.map((i) => [i._id as string, i.title]));
  const perDayRoutine = new Map<string, number>();
  for (const c of doneCheckins) {
    if (inserted >= 1200) break;
    const used = perDayRoutine.get(c.day) ?? 0;
    if (used >= XP_RULES.dailyRoutineXpCap) continue;
    perDayRoutine.set(c.day, used + 1);
    await ctx.db.insert("xpEvents", {
      userId,
      amount: XP_RULES.routineItem,
      kind: "routine",
      label: `روتین «${itemTitle.get(c.itemId as string) ?? "روتین"}»`,
      day: c.day,
      createdAt: Date.now(),
      refType: "routineRef",
      refId: `${c.itemId}:${c.day}`,
    });
    totalXp += XP_RULES.routineItem;
    inserted += 1;
  }

  // Daily history rows for days that actually had activity.
  const activeDays = new Set<string>([
    ...completions.map((t) => dateKey(new Date(t.completedAt!))),
    ...doneCheckins.map((c) => c.day),
  ]);
  const ordered = [...activeDays].sort();
  const trimmed = ordered.slice(Math.max(0, ordered.length - 150));

  for (const day of trimmed) {
    const planned = roots.filter((t) => t.dueDate === day);
    const done = completions.filter((t) => dateKey(new Date(t.completedAt!)) === day);
    const routineDone = doneCheckins.filter((c) => c.day === day).length;
    const xpEarned = await ctx.db
      .query("xpEvents")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
      .collect();
    const breakdown = computeDailyScore({
      plannedTasks: planned.length,
      completedTasks: done.length,
      routineItems: items.length,
      routineDone,
      currentStreak: 0,
      missionsDone: 0,
      missionsTotal: 0,
    });
    await ctx.db.insert("dailyStats", {
      userId,
      day,
      plannedTasks: planned.length,
      completedTasks: done.length,
      routineItems: items.length,
      routineDone,
      focusMinutes: done.reduce((n, t) => n + (t.estimateMinutes ?? 0), 0),
      xpEarned: xpEarned.reduce((n, r) => n + r.amount, 0),
      missionsDone: 0,
      missionsTotal: 0,
      taskScore: breakdown.tasks,
      routineScore: breakdown.routines,
      consistencyScore: breakdown.consistency,
      missionScore: breakdown.missions,
      score: breakdown.total,
      updatedAt: Date.now(),
    });
  }

  const stats = await listDaily(ctx, userId);
  const { current, longest, lastDay, restUsed } = computeStreaks(
    stats.filter(hasActivity).map((s) => s.day),
    todayKey(),
  );
  const prog = await progDoc(ctx, userId);
  if (prog) {
    await ctx.db.patch(prog._id, {
      totalXp,
      level: levelInfoFromXp(totalXp).level,
      currentStreak: current,
      longestStreak: longest,
      lastActiveDay: lastDay ?? undefined,
      restDaysUsed: restUsed,
      updatedAt: Date.now(),
    });
  }
}

/* ------------------------------------------------------------------ */
/* Public mutations                                                    */
/* ------------------------------------------------------------------ */

/** Idempotent bootstrap: builds history, then runs the engine for today. */
export const ensureProgress = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await uid(ctx);
    if (!userId) return null;
    const prog = await ensureProgressDoc(ctx, userId);
    const result = await runEngine(ctx, userId, todayKey(), prog.level);
    return result;
  },
});

export const startChallenge = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const userId = await uid(ctx);
    if (!userId) throw new Error("Not authenticated");
    const def = CHALLENGES.find((c) => c.key === key);
    if (!def) throw new Error("چالش یافت نشد");
    const existing = await ctx.db
      .query("challengeState")
      .withIndex("by_user_key", (q) => q.eq("userId", userId).eq("key", key))
      .first();
    if (existing && existing.status === "active") return { started: false };
    if (existing) await ctx.db.delete(existing._id);
    const today = todayKey();
    await ctx.db.insert("challengeState", {
      userId,
      key,
      status: "active",
      startedAt: Date.now(),
      startedDay: today,
      endsDay: shiftKey(today, def.days - 1),
      progress: 0,
      target: def.target,
    });
    await ensureProgressDoc(ctx, userId);
    await runEngine(ctx, userId, today, 1);
    return { started: true };
  },
});

export const joinPath = mutation({
  args: { pathKey: v.string() },
  handler: async (ctx, { pathKey }) => {
    const userId = await uid(ctx);
    if (!userId) throw new Error("Not authenticated");
    const path = findPath(pathKey);
    if (!path) throw new Error("مسیر یافت نشد");
    const existing = await ctx.db
      .query("pathEnrollments")
      .withIndex("by_user_path", (q) => q.eq("userId", userId).eq("pathKey", pathKey))
      .first();
    if (existing && existing.status === "active") return { joined: false };
    const today = todayKey();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "active",
        stageIndex: 0,
        stageStartedDay: today,
        completedMissionIds: [],
        stageBonusesPaid: [],
        xpEarned: 0,
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        completedAt: undefined,
      });
    } else {
      await ctx.db.insert("pathEnrollments", {
        userId,
        pathKey,
        status: "active",
        stageIndex: 0,
        stageStartedDay: today,
        completedMissionIds: [],
        stageBonusesPaid: [],
        xpEarned: 0,
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
      });
    }
    const prog = await ensureProgressDoc(ctx, userId);
    await runEngine(ctx, userId, today, prog.level);
    return { joined: true };
  },
});

export const leavePath = mutation({
  args: { pathKey: v.string() },
  handler: async (ctx, { pathKey }) => {
    const userId = await uid(ctx);
    if (!userId) throw new Error("Not authenticated");
    const enr = await ctx.db
      .query("pathEnrollments")
      .withIndex("by_user_path", (q) => q.eq("userId", userId).eq("pathKey", pathKey))
      .first();
    if (!enr) return { left: false };
    await ctx.db.delete(enr._id);
    return { left: true };
  },
});

/** Habit-style mission inside a growth path that the app cannot measure. */
export const completePathMission = mutation({
  args: { pathKey: v.string(), missionId: v.string() },
  handler: async (ctx, { pathKey, missionId }) => {
    const userId = await uid(ctx);
    if (!userId) throw new Error("Not authenticated");
    const path = findPath(pathKey);
    if (!path) throw new Error("مسیر یافت نشد");
    const enr = await ctx.db
      .query("pathEnrollments")
      .withIndex("by_user_path", (q) => q.eq("userId", userId).eq("pathKey", pathKey))
      .first();
    if (!enr || enr.status !== "active") throw new Error("این مسیر فعال نیست");
    const stage = path.stages[enr.stageIndex];
    const mission = stage?.missions.find((mm) => mm.id === missionId);
    if (!mission) throw new Error("این ماموریت در مرحله فعلی نیست");
    if (enr.completedMissionIds.includes(missionId)) return { completed: false };
    const day = todayKey();
    const awarded = await awardXp(ctx, userId, {
      amount: mission.xp,
      kind: "path",
      label: mission.title,
      day,
      refType: "pathManual",
      refId: `pathManual:${pathKey}:${missionId}`,
      meta: pathKey,
    });
    await ctx.db.patch(enr._id, {
      completedMissionIds: [...enr.completedMissionIds, missionId],
      xpEarned: enr.xpEarned + (awarded ? mission.xp : 0),
      lastActiveAt: Date.now(),
    });
    const prog = await ensureProgressDoc(ctx, userId);
    await runEngine(ctx, userId, day, prog.level);
    return { completed: true };
  },
});

/* ------------------------------------------------------------------ */
/* Public queries                                                      */
/* ------------------------------------------------------------------ */

export const myProgress = query({
  args: {},
  handler: async (ctx) => {
    const userId = await uid(ctx);
    if (!userId) return null;
    const [prog, stats, missions, enrollments] = await Promise.all([
      progDoc(ctx, userId),
      listDaily(ctx, userId),
      listMissions(ctx, userId),
      ctx.db
        .query("pathEnrollments")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    const day = todayKey();
    const week = weekStartKey(day);
    const today = stats.find((s) => s.day === day) ?? null;
    const weekRows = stats.filter((s) => s.day >= week && s.day <= day);
    const info = levelInfoFromXp(prog?.totalXp ?? 0);
    const dailyMissions = missions.filter((mm) => mm.scope === "daily" && mm.period === day);
    const weeklyMissions = missions.filter((mm) => mm.scope === "weekly" && mm.period === week);
    const activePaths = enrollments
      .filter((e) => e.status === "active")
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
      .map((e) => {
        const path = findPath(e.pathKey);
        if (!path) return null;
        const totalXp = pathTotalXp(path);
        const earned = pathProgressXp(path, e.completedMissionIds, e.stageBonusesPaid);
        return {
          pathKey: e.pathKey,
          title: path.title,
          emoji: path.emoji,
          stageIndex: e.stageIndex,
          stageCount: path.stages.length,
          stageTitle: path.stages[e.stageIndex]?.title ?? "",
          nextStageTitle: path.stages[e.stageIndex + 1]?.title ?? null,
          missionCount: path.stages[e.stageIndex]?.missions.length ?? 0,
          missionsDone:
            path.stages[e.stageIndex]?.missions.filter((mm) =>
              e.completedMissionIds.includes(mm.id),
            ).length ?? 0,
          xpEarned: earned,
          xpTotal: totalXp,
          progressPct: totalXp > 0 ? Math.round((earned / totalXp) * 100) : 0,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return {
      /** Everything the dashboard snapshot needs. */
      level: info.level,
      levelTitle: info.title,
      xp: info.xp,
      levelStartXp: info.levelStartXp,
      nextLevelXp: info.nextLevelXp,
      xpIntoLevel: info.xpIntoLevel,
      xpForNext: info.xpForNext,
      xpToNext: info.xpToNext,
      progressPct: info.progressPct,
      maxNamedLevel: LEVELS.length,
      currentStreak: prog?.currentStreak ?? 0,
      longestStreak: prog?.longestStreak ?? 0,
      weekXp: prog?.weekXp ?? 0,
      monthXp: prog?.monthXp ?? 0,
      totalXp: prog?.totalXp ?? 0,
      score: today?.score ?? 0,
      scoreBreakdown: {
        tasks: today?.taskScore ?? 0,
        routines: today?.routineScore ?? 0,
        consistency: today?.consistencyScore ?? 0,
        missions: today?.missionScore ?? 0,
      },
      today: {
        day,
        completedTasks: today?.completedTasks ?? 0,
        plannedTasks: today?.plannedTasks ?? 0,
        routineDone: today?.routineDone ?? 0,
        routineItems: today?.routineItems ?? 0,
        xpEarned: today?.xpEarned ?? 0,
        focusMinutes: today?.focusMinutes ?? 0,
      },
      week: {
        xp: weekRows.reduce((n, s) => n + s.xpEarned, 0),
        tasks: weekRows.reduce((n, s) => n + s.completedTasks, 0),
        activeDays: weekRows.filter(hasActivity).length,
        avgScore: weekRows.length
          ? Math.round(weekRows.reduce((n, s) => n + s.score, 0) / weekRows.length)
          : 0,
      },
      missions: {
        dailyDone: dailyMissions.filter((m) => m.completed).length,
        dailyTotal: dailyMissions.length,
        weeklyDone: weeklyMissions.filter((m) => m.completed).length,
        weeklyTotal: weeklyMissions.length,
      },
      activePaths,
    };
  },
});

export const activityHeatmap = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days }) => {
    const userId = await uid(ctx);
    if (!userId) return [];
    const stats = await listDaily(ctx, userId);
    const span = days ?? 120;
    const today = todayKey();
    const rows: Array<{ day: string; score: number; tasks: number; routine: number; xp: number }> = [];
    for (let i = span - 1; i >= 0; i--) {
      const key = shiftKey(today, -i);
      const row = stats.find((s) => s.day === key);
      rows.push({
        day: key,
        score: row?.score ?? 0,
        tasks: row?.completedTasks ?? 0,
        routine: row?.routineDone ?? 0,
        xp: row?.xpEarned ?? 0,
      });
    }
    return rows;
  },
});

export const xpHistory = query({
  args: { limit: v.optional(v.number()), kinds: v.optional(v.array(v.string())) },
  handler: async (ctx, { limit, kinds }) => {
    const userId = await uid(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("xpEvents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(Math.min(limit ?? 60, 200));
    const filtered = kinds && kinds.length ? rows.filter((r) => kinds.includes(r.kind)) : rows;
    return filtered.map((r) => ({
      id: r._id,
      amount: r.amount,
      kind: r.kind,
      label: r.label,
      day: r.day,
      createdAt: r.createdAt,
    }));
  },
});

export const missionsState = query({
  args: {},
  handler: async (ctx) => {
    const userId = await uid(ctx);
    if (!userId) return { daily: [], weekly: [], hasRoutines: false };
    const [missions, items] = await Promise.all([listMissions(ctx, userId), listItems(ctx, userId)]);
    const day = todayKey();
    const week = weekStartKey(day);
    const shape = (scope: string, period: string, templates: MissionTemplate[]) =>
      templates
        .filter((t) => !(t.requiresRoutines && items.length === 0))
        .map((t) => {
          const row = missions.find((m) => m.key === t.key && m.period === period);
          return {
            key: t.key,
            title: t.title,
            description: t.description,
            xp: t.xp,
            target: t.target,
            progress: row?.progress ?? 0,
            completed: row?.completed ?? false,
            completedAt: row?.completedAt ?? null,
            scope,
            period,
          };
        });
    return {
      daily: shape("daily", day, DAILY_MISSIONS),
      weekly: shape("weekly", week, WEEKLY_MISSIONS),
      hasRoutines: items.length > 0,
    };
  },
});

export const challengesState = query({
  args: {},
  handler: async (ctx) => {
    const userId = await uid(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("challengeState")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const day = todayKey();
    return CHALLENGES.map((def) => {
      const row = rows.find((r) => r.key === def.key);
      const active = row?.status === "active";
      return {
        key: def.key,
        title: def.title,
        description: def.description,
        days: def.days,
        xp: def.xp,
        emoji: def.emoji,
        tone: def.tone,
        target: def.target,
        status: row ? row.status : "available",
        progress: row?.progress ?? 0,
        startedDay: row?.startedDay ?? null,
        endsDay: row?.endsDay ?? null,
        completedAt: row?.completedAt ?? null,
        daysLeft: active && row ? Math.max(0, diffDays(row.endsDay, day)) : null,
      };
    });
  },
});

export const achievementsList = query({
  args: {},
  handler: async (ctx) => {
    const userId = await uid(ctx);
    if (!userId) return [];
    const [unlocks, enrollments] = await Promise.all([
      ctx.db
        .query("achievementUnlocks")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("pathEnrollments")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);
    const map = new Map(unlocks.map((u) => [u.key, u.unlockedAt]));
    const base = ACHIEVEMENTS.map((a) => ({
      key: a.key,
      title: a.title,
      description: a.description,
      icon: a.icon,
      tone: a.tone,
      unlocked: map.has(a.key),
      unlockedAt: map.get(a.key) ?? null,
      group: "عمومی" as string,
    }));
    const pathOnes = GROWTH_PATHS.map((p) => {
      const key = `path_${p.key}_done`;
      return {
        key,
        title: `تکمیل ${p.title}`,
        description: "همه مراحل این مسیر را کامل کردی.",
        icon: "route",
        tone: "amber" as const,
        unlocked: map.has(key),
        unlockedAt: map.get(key) ?? null,
        group: p.title,
      };
    });
    // The catalog may include path badges; only show ones with meaning.
    void enrollments;
    return [...base, ...pathOnes];
  },
});

export const rewardsList = query({
  args: {},
  handler: async (ctx) => {
    const userId = await uid(ctx);
    if (!userId) return [];
    const [prog, unlocks] = await Promise.all([
      progDoc(ctx, userId),
      ctx.db
        .query("rewardUnlocks")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);
    const level = prog?.level ?? 1;
    const set = new Set(unlocks.map((u) => u.key));
    return REWARDS.map((r) => ({
      key: r.key,
      title: r.title,
      description: r.description,
      kind: r.kind,
      level: r.level,
      preview: r.preview,
      current: r.level <= level,
      claimed: set.has(r.key),
    }));
  },
});

export const leaderboard = query({
  args: { range: v.optional(v.string()) },
  handler: async (ctx, { range }) => {
    const userId = await uid(ctx);
    if (!userId) return null;
    const rows = await ctx.db.query("progress").collect();
    const users = await ctx.db.query("users").collect();
    const nameOf = (id: Id<"users">) => users.find((u) => u._id === id)?.name ?? "کاربر";
    const imageOf = (id: Id<"users">) => users.find((u) => u._id === id)?.image;
    const info = (p: Doc<"progress">) => levelInfoFromXp(p.totalXp);

    const scored = rows.map((p) => {
      const value =
        range === "week" ? p.weekXp : range === "month" ? p.monthXp : p.totalXp;
      return {
        userId: p.userId as string,
        name: nameOf(p.userId),
        image: imageOf(p.userId) ?? null,
        level: info(p).level,
        levelTitle: info(p).title,
        xp: value,
        totalXp: p.totalXp,
        streak: p.currentStreak,
      };
    });
    scored.sort((a, b) => b.xp - a.xp || b.totalXp - a.totalXp);
    const ranked = scored.map((row, i) => ({ ...row, rank: i + 1 }));
    const me = ranked.find((r) => r.userId === userId) ?? null;
    const above = me ? ranked.find((r) => r.rank === me.rank - 1) : null;
    const myStats = await listDaily(ctx, userId);
    const day = todayKey();
    const week = weekStartKey(day);
    const thisWeek = myStats
      .filter((s) => s.day >= week && s.day <= day)
      .reduce((n, s) => n + s.xpEarned, 0);
    const lastWeekStart = shiftKey(week, -7);
    const lastWeek = myStats
      .filter((s) => s.day >= lastWeekStart && s.day < week)
      .reduce((n, s) => n + s.xpEarned, 0);

    return {
      rows: ranked.slice(0, 20),
      me,
      gapToNext: me && above ? Math.max(0, above.xp - me.xp) : 0,
      participants: ranked.length,
      weekDeltaPct:
        lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null,
    };
  },
});

export const pathsOverview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await uid(ctx);
    const enrollments = userId
      ? await ctx.db
          .query("pathEnrollments")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect()
      : [];
    return GROWTH_PATHS.map((p) => {
      const enr = enrollments.find((e) => e.pathKey === p.key);
      const totalXp = pathTotalXp(p);
      const earned = enr ? pathProgressXp(p, enr.completedMissionIds, enr.stageBonusesPaid) : 0;
      return {
        key: p.key,
        title: p.title,
        emoji: p.emoji,
        category: p.category,
        difficulty: p.difficulty,
        summary: p.summary,
        goal: p.goal,
        totalDays: p.totalDays,
        stageCount: p.stages.length,
        missionCount: p.stages.reduce((n, s) => n + s.missions.length, 0),
        totalXp,
        completionXp: p.completionXp,
        status: enr?.status ?? "available",
        stageIndex: enr?.stageIndex ?? 0,
        progressPct: totalXp > 0 ? Math.round((earned / totalXp) * 100) : 0,
        xpEarned: earned,
      };
    });
  },
});

export const pathDetail = query({
  args: { pathKey: v.string() },
  handler: async (ctx, { pathKey }) => {
    const userId = await uid(ctx);
    const path = findPath(pathKey);
    if (!path) return null;
    const enr = userId
      ? await ctx.db
          .query("pathEnrollments")
          .withIndex("by_user_path", (q) => q.eq("userId", userId).eq("pathKey", pathKey))
          .first()
      : null;
    const completed = enr?.completedMissionIds ?? [];
    const bonuses = enr?.stageBonusesPaid ?? [];
    const totalXp = pathTotalXp(path);
    const earned = pathProgressXp(path, completed, bonuses);
    return {
      path: {
        key: path.key,
        title: path.title,
        emoji: path.emoji,
        category: path.category,
        difficulty: path.difficulty,
        summary: path.summary,
        goal: path.goal,
        totalDays: path.totalDays,
        completionXp: path.completionXp,
        totalXp,
      },
      enrolled: !!enr,
      status: enr?.status ?? "available",
      currentStage: enr?.stageIndex ?? 0,
      stageStartedDay: enr?.stageStartedDay ?? null,
      progressPct: totalXp > 0 ? Math.round((earned / totalXp) * 100) : 0,
      xpEarned: earned,
      stages: path.stages.map((s, index) => {
        const stageDone = s.missions.every((mm) => completed.includes(mm.id));
        const locked = !!enr && index > enr.stageIndex;
        return {
          key: s.key,
          title: s.title,
          days: s.days,
          bonus: s.bonus,
          index,
          state: stageDone
            ? "completed"
            : locked
              ? "locked"
              : enr && index === enr.stageIndex
                ? "active"
                : "available",
          missionsDone: s.missions.filter((mm) => completed.includes(mm.id)).length,
          missionsTotal: s.missions.length,
          missions: s.missions.map((mm: PathMission) => ({
            id: mm.id,
            title: mm.title,
            description: mm.description,
            kind: mm.kind,
            target: mm.target,
            xp: mm.xp,
            completed: completed.includes(mm.id),
            locked: locked || (!!enr && index !== enr.stageIndex && !stageDone),
          })),
        };
      }),
    };
  },
});

/** Missions from active paths that are relevant for today. */
export const todayPathMissions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await uid(ctx);
    if (!userId) return [];
    const enrollments = await ctx.db
      .query("pathEnrollments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const active = enrollments
      .filter((e) => e.status === "active")
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
      .slice(0, 3);
    return active.flatMap((e) => {
      const path = findPath(e.pathKey);
      if (!path) return [];
      const stage = path.stages[e.stageIndex];
      if (!stage) return [];
      return stage.missions.slice(0, 3).map((mm) => ({
        pathKey: path.key,
        pathTitle: path.title,
        emoji: path.emoji,
        stageTitle: stage.title,
        id: mm.id,
        title: mm.title,
        description: mm.description,
        kind: mm.kind,
        xp: mm.xp,
        completed: e.completedMissionIds.includes(mm.id),
      }));
    });
  },
});

/** Everything the Stats tab needs in one round trip. */
export const overviewStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await uid(ctx);
    if (!userId) return null;
    const [stats, prog, missions, challenges, enrollments, projects] = await Promise.all([
      listDaily(ctx, userId),
      progDoc(ctx, userId),
      listMissions(ctx, userId),
      ctx.db
        .query("challengeState")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("pathEnrollments")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("projects")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);
    const day = todayKey();
    const last30 = [...Array(30)].map((_, i) => shiftKey(day, -(29 - i)));
    const trend = last30.map((key) => {
      const row = stats.find((s) => s.day === key);
      return {
        day: key,
        xp: row?.xpEarned ?? 0,
        tasks: row?.completedTasks ?? 0,
        score: row?.score ?? 0,
      };
    });
    return {
      xpTrend: trend,
      totalXp: prog?.totalXp ?? 0,
      level: levelInfoFromXp(prog?.totalXp ?? 0).level,
      levelTitle: levelInfoFromXp(prog?.totalXp ?? 0).title,
      tasksCompleted: stats.reduce((n, s) => n + s.completedTasks, 0),
      routineDone: stats.reduce((n, s) => n + s.routineDone, 0),
      activeDays: stats.filter(hasActivity).length,
      perfectDays: stats.filter((s) => s.score >= 100).length,
      avgScore: stats.length
        ? Math.round(stats.reduce((n, s) => n + s.score, 0) / stats.length)
        : 0,
      currentStreak: prog?.currentStreak ?? 0,
      longestStreak: prog?.longestStreak ?? 0,
      missionsDone: missions.filter((m) => m.completed).length,
      challengesDone: challenges.filter((c) => c.status === "completed").length,
      pathsCompleted: enrollments.filter((e) => e.status === "completed").length,
      projectsCompleted: projects.filter((p) => p.status === "completed").length,
      completionRate: (() => {
        const planned = stats.reduce((n, s) => n + s.plannedTasks, 0);
        const done = stats.reduce((n, s) => n + s.completedTasks, 0);
        return planned > 0 ? Math.min(100, Math.round((done / planned) * 100)) : 0;
      })(),
    };
  },
});

/** Level ladder for the "سطح و XP" tab. */
export const levelLadder = query({
  args: {},
  handler: async (ctx) => {
    const userId = await uid(ctx);
    const prog = userId ? await progDoc(ctx, userId) : null;
    const info = levelInfoFromXp(prog?.totalXp ?? 0);
    return LEVELS.map((l) => ({
      level: l.level,
      title: l.title,
      xp: l.xp,
      state: info.level === l.level ? "current" : info.level > l.level ? "done" : "locked",
    }));
  },
});
