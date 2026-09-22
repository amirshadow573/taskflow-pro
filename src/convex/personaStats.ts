/**
 * Persona Stats — Phase 04.
 *
 * Centralized stat service: ONE place that turns real activity into persona
 * stat values. Definitions and scoring rules live in ./statRules.ts (pure
 * config); this module only loads data and persists results.
 *
 * Architecture:
 *   activity → windowed metrics → weighted score (0–100) → tier/trend → UI
 *
 * Key properties:
 *  - Derivation, not accumulation: values are recomputed from source data for
 *    every window, so deleted/reversed activity can never inflate a stat and
 *    double counting is impossible by construction.
 *  - Comparable windows only (7d vs previous 7d, 30d vs previous 30d).
 *  - Insufficient data → hasData:false, never a fake number.
 *  - Persona-aware: which stats exist (and their order) comes from config.
 *
 * Public surface:
 *  - syncPersonaStats(ctx, userId)  — engine hook (called from gamification)
 *  - queries: overview, snapshot, history
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { dateKey, shiftKey, todayKey } from "./progression";
import {
  DEFAULT_STAT_WINDOW,
  STATS_EMPTY_STATE,
  STAT_WINDOW_OPTIONS,
  faNum,
  scoreStat,
  statsForPersona,
  tierForValue,
  trendFor,
  windowBounds,
  type MetricResult,
  type MetricValues,
  type StatDef,
  type StatScore,
} from "./statRules";

type Ctx = QueryCtx | MutationCtx;

/* ------------------------------------------------------------------ */
/* Data bundle — one span load shared by every window                  */
/* ------------------------------------------------------------------ */

interface GoalRow {
  progress: number;
  status: string;
  completedAt?: number;
}

interface Bundle {
  daily: Doc<"dailyStats">[];
  roots: Doc<"tasks">[];
  focus: Doc<"focusSessions">[];
  study: Doc<"studySessions">[];
  assignments: Doc<"assignments">[];
  milestones: Doc<"milestones">[];
  xp: Doc<"xpEvents">[];
  goals: GoalRow[];
  initiatives: Doc<"initiatives">[];
  deliverables: Doc<"deliverables">[];
  teamActivity: Doc<"teamActivity">[];
  meetings: Doc<"meetings">[];
  sales: Doc<"salesOpportunities">[];
  timeBlocks: Doc<"timeBlocks">[];
  habitLogs: Doc<"habitLogs">[];
}

/** Load every source the metric registry needs for [from .. to]. */
async function loadBundle(
  ctx: Ctx,
  userId: Id<"users">,
  from: string,
  to: string,
): Promise<Bundle> {
  const [
    daily,
    tasks,
    focus,
    study,
    assignments,
    milestones,
    xp,
    personalGoals,
    workGoals,
    teamGoals,
    businessGoals,
    initiatives,
    deliverables,
    teamActivity,
    meetings,
    sales,
    timeBlocks,
    habitLogs,
  ] = await Promise.all([
    ctx.db
      .query("dailyStats")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).gte("day", from).lte("day", to))
      .collect(),
    ctx.db
      .query("tasks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("archived"), true))
      .collect(),
    ctx.db
      .query("focusSessions")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).gte("date", from).lte("date", to))
      .collect(),
    ctx.db
      .query("studySessions")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).gte("date", from).lte("date", to))
      .collect(),
    ctx.db
      .query("assignments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("milestones")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("xpEvents")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).gte("day", from).lte("day", to))
      .collect(),
    ctx.db.query("personalGoals").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("workGoals").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("teamGoals").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("businessGoals").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("initiatives").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("deliverables").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("teamActivity").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("meetings").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ctx.db.query("salesOpportunities").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ctx.db
      .query("timeBlocks")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).gte("day", from).lte("day", to))
      .collect(),
    ctx.db
      .query("habitLogs")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).gte("day", from).lte("day", to))
      .collect(),
  ]);

  const mapGoal = (rows: Array<{ progress: number; status: string; completedAt?: number }>): GoalRow[] =>
    rows.filter((g) => g.status !== "paused").map((g) => ({ progress: g.progress, status: g.status, completedAt: g.completedAt }));

  return {
    daily,
    roots: tasks.filter((t) => !t.parentId),
    focus,
    study,
    assignments,
    milestones,
    xp,
    goals: [
      ...mapGoal(personalGoals),
      ...mapGoal(workGoals),
      ...mapGoal(teamGoals),
      ...mapGoal(businessGoals),
    ],
    initiatives,
    deliverables,
    teamActivity,
    meetings,
    sales,
    timeBlocks,
    habitLogs,
  };
}

/* ------------------------------------------------------------------ */
/* Metrics — every signal is windowed, ratio-based and capped at 100   */
/* ------------------------------------------------------------------ */

const isAwarded = (r: { status?: string }): boolean => r.status !== "reversed";
const cap = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

function deadlineMetric(
  items: Array<{ met: boolean; missed: boolean }>,
): MetricResult {
  const met = items.filter((i) => i.met).length;
  const missed = items.filter((i) => i.missed).length;
  const total = met + missed;
  if (total === 0) return { value: null, evidence: 0 };
  return {
    value: cap((met / total) * 100),
    evidence: total,
    reason: `${faNum(met)} کار به‌موقع`,
  };
}

function computeMetrics(
  bundle: Bundle,
  from: string,
  to: string,
  today: string,
): MetricValues {
  const inWin = (day: string | undefined): boolean => !!day && day >= from && day <= to;
  const tsInWin = (ts?: number): boolean => ts !== undefined && inWin(dateKey(new Date(ts)));

  /* ---- daily rollups ---- */
  const days = bundle.daily.filter((d) => inWin(d.day));
  const planned = days.reduce((n, d) => n + d.plannedTasks, 0);
  const completed = days.reduce((n, d) => n + d.completedTasks, 0);
  const routineItems = days.reduce((n, d) => n + d.routineItems, 0);
  const routineDone = days.reduce((n, d) => n + d.routineDone, 0);
  const activeDayCount = days.filter((d) => d.completedTasks > 0 || d.routineDone > 0).length;
  const plannedDayCount = days.filter((d) => d.plannedTasks > 0).length;
  const taskFocusMinutes = days.reduce((n, d) => n + d.focusMinutes, 0);

  /* ---- deadline / on-time (root tasks with a due date in the window) ---- */
  const dueRoots = bundle.roots.filter((t) => inWin(t.dueDate));
  const dueItems = dueRoots.map((t) => {
    const doneDay = t.completedAt ? dateKey(new Date(t.completedAt)) : null;
    const done = t.status === "done" && doneDay !== null;
    const met = done && doneDay <= (t.dueDate ?? "");
    // A task due today is still pending — it is neither met nor missed yet.
    const missed = done ? doneDay > (t.dueDate ?? "") : (t.dueDate ?? "") < today;
    return { met, missed };
  });

  /* ---- focus & study sessions (genuinely completed only) ---- */
  const focusSessions = bundle.focus.filter((s) => s.completed && s.actualMinutes >= 10);
  const focusMinutes = focusSessions.reduce((n, s) => n + s.actualMinutes, 0);
  const usedFocusMinutes = focusSessions.length > 0 ? focusMinutes : taskFocusMinutes;

  const studySessions = bundle.study.filter((s) => s.completed && s.actualMinutes > 0);
  const studyMinutes = studySessions.reduce((n, s) => n + s.actualMinutes, 0);

  /* ---- assignments on time ---- */
  const dueAssignments = bundle.assignments.filter((a) => inWin(a.dueDate));
  const assignmentItems = dueAssignments.map((a) => {
    const doneDay = a.completedAt ? dateKey(new Date(a.completedAt)) : null;
    const done = (a.status === "completed" || a.status === "done") && doneDay !== null;
    const met = done && doneDay <= a.dueDate;
    const missed = done ? doneDay > a.dueDate : a.dueDate < today;
    return { met, missed };
  });
  const assignmentsMet = assignmentItems.filter((i) => i.met).length;

  /* ---- outcomes from the auditable XP ledger (already reversal-safe) ---- */
  const awarded = bundle.xp.filter(isAwarded);
  const goalsCompleted = awarded.filter((e) => e.kind === "goal" && e.refType === "goal").length;
  const projectsCompleted = awarded.filter((e) => e.kind === "project" && e.refType === "project").length;

  const milestonesDone = bundle.milestones.filter((m) => m.status === "completed" && tsInWin(m.completedAt)).length;

  /* ---- goals snapshot (same for both windows — a level, not an event) ---- */
  const goalCount = bundle.goals.length;
  const goalAvg =
    goalCount > 0
      ? Math.round(bundle.goals.reduce((n, g) => n + Math.max(0, Math.min(100, g.progress)), 0) / goalCount)
      : 0;
  const goalsCompletedEver = bundle.goals.filter((g) => g.status === "completed").length;

  /* ---- freelancer / manager / business signals ---- */
  const deliveries = bundle.deliverables.filter(
    (d) => (d.status === "delivered" || d.status === "approved") && tsInWin(d.completedAt),
  ).length;

  const teamActions = bundle.teamActivity.filter(
    (a) =>
      tsInWin(a.createdAt) &&
      ["task_assigned", "task_completed", "meeting_scheduled", "goal_updated"].includes(a.type),
  ).length;

  const meetingsDone = bundle.meetings.filter((m) => m.status === "completed" && inWin(m.date)).length;

  const SALES_STAGES = ["contacted", "qualified", "proposal", "negotiation", "won"];
  const salesTouched = bundle.sales.filter(
    (s) => s.updatedAt >= 0 && SALES_STAGES.includes(s.stage) && tsInWin(s.updatedAt),
  ).length;
  const salesWon = bundle.sales.filter((s) => s.stage === "won" && tsInWin(s.updatedAt)).length;

  const initiativesDone = bundle.initiatives.filter(
    (i) => i.status === "completed" && tsInWin(i.updatedAt),
  ).length;
  const initiativesActive = bundle.initiatives.filter(
    (i) => i.status !== "completed" && i.status !== "paused",
  );
  const initiativeAvg =
    initiativesActive.length > 0
      ? Math.round(
          initiativesActive.reduce((n, i) => n + Math.max(0, Math.min(100, i.progress)), 0) /
            initiativesActive.length,
        )
      : initiativesDone > 0
        ? 100
        : null;

  /* ---- personal rhythms ---- */
  const habitDays = new Set(bundle.habitLogs.filter((h) => h.done && inWin(h.day)).map((h) => h.day)).size;
  const blockCount = bundle.timeBlocks.filter((b) => inWin(b.day)).length;

  const windowDays = Math.max(
    1,
    Math.round(
      (Date.parse(to + "T00:00:00") - Date.parse(from + "T00:00:00")) / 8400000 + 1,
    ),
  );

  /* ---- metric registry ---- */
  const metrics: MetricValues = {};

  metrics.plannedCompletion =
    planned > 0
      ? {
          value: cap((completed / planned) * 100),
          evidence: completed,
          reason: `${faNum(completed)} کار برنامه‌ریزی‌شده تمام شد`,
        }
      : { value: null, evidence: 0 };

  metrics.onTime = deadlineMetric(dueItems);

  metrics.plannedDays =
    plannedDayCount > 0
      ? {
          value: cap((plannedDayCount / windowDays) * 100),
          evidence: plannedDayCount,
          reason: `${faNum(plannedDayCount)} روز برنامه‌ریزی‌شده`,
        }
      : { value: null, evidence: 0 };

  metrics.activeDays =
    activeDayCount > 0
      ? {
          value: cap((activeDayCount / windowDays) * 100),
          evidence: activeDayCount,
          reason: `${faNum(activeDayCount)} روز فعال`,
        }
      : { value: null, evidence: 0 };

  metrics.routineAdherence =
    routineItems > 0
      ? {
          value: cap((routineDone / routineItems) * 100),
          evidence: routineDone,
          reason: `${faNum(routineDone)} آیتم روتین`,
        }
      : { value: null, evidence: 0 };

  metrics.habitConsistency =
    habitDays > 0
      ? {
          value: cap((habitDays / windowDays) * 100),
          evidence: habitDays,
          reason: `${faNum(habitDays)} روز عادت`,
        }
      : { value: null, evidence: 0 };

  metrics.focusDepth =
    usedFocusMinutes > 0
      ? {
          value: cap((usedFocusMinutes / (windowDays * 45)) * 100),
          evidence: focusSessions.length + Math.floor(usedFocusMinutes / 15),
          reason: `${faNum(usedFocusMinutes)} دقیقه کار متمرکز`,
        }
      : { value: null, evidence: 0 };

  metrics.studyDepth =
    studyMinutes > 0
      ? {
          value: cap((studyMinutes / (windowDays * 40)) * 100),
          evidence: studySessions.length + Math.floor(studyMinutes / 15),
          reason: `${faNum(studyMinutes)} دقیقه مطالعه`,
        }
      : { value: null, evidence: 0 };

  metrics.assignmentsOnTime =
    assignmentItems.some((i) => i.met || i.missed)
      ? {
          value: cap((assignmentsMet / assignmentItems.length) * 100),
          evidence: assignmentItems.length,
          reason: `${faNum(assignmentsMet)} تکلیف به‌موقع`,
        }
      : { value: null, evidence: 0 };

  metrics.milestones =
    milestonesDone > 0
      ? {
          value: cap((milestonesDone / Math.max(1, windowDays / 3.5)) * 100),
          evidence: milestonesDone,
          reason: `${faNum(milestonesDone)} نقطه عطف`,
        }
      : { value: null, evidence: 0 };

  const outcomeParts: string[] = [];
  if (goalsCompleted > 0) outcomeParts.push(`${faNum(goalsCompleted)} هدف`);
  if (projectsCompleted > 0) outcomeParts.push(`${faNum(projectsCompleted)} پروژه`);
  const outcomeCount = goalsCompleted + projectsCompleted;
  metrics.outcomes =
    outcomeCount > 0
      ? {
          value: cap((outcomeCount / Math.max(1, windowDays / 10)) * 100),
          evidence: outcomeCount,
          reason: `تکمیل ${outcomeParts.join(" و ")}`,
        }
      : { value: null, evidence: 0 };

  metrics.goalProgress =
    goalCount > 0
      ? {
          value: goalAvg,
          evidence: goalCount * 2 + goalsCompletedEver,
          reason: `میانگین پیشرفت ${faNum(goalAvg)}٪ اهداف`,
        }
      : { value: null, evidence: 0 };

  metrics.deliveries =
    deliveries > 0
      ? {
          value: cap((deliveries / Math.max(1, (windowDays / 7) * 2)) * 100),
          evidence: deliveries,
          reason: `${faNum(deliveries)} تحویل`,
        }
      : { value: null, evidence: 0 };

  metrics.teamActivity =
    teamActions > 0
      ? {
          value: cap((teamActions / Math.max(1, windowDays * 1.5)) * 100),
          evidence: teamActions,
          reason: `${faNum(teamActions)} اقدام تیمی`,
        }
      : { value: null, evidence: 0 };

  metrics.meetingsDone =
    meetingsDone > 0
      ? {
          value: cap((meetingsDone / Math.max(1, (windowDays / 7) * 2)) * 100),
          evidence: meetingsDone,
          reason: `${faNum(meetingsDone)} جلسه انجام‌شده`,
        }
      : { value: null, evidence: 0 };

  metrics.salesFlow =
    salesTouched > 0
      ? {
          value: cap((salesTouched / Math.max(1, (windowDays / 7) * 3)) * 100),
          evidence: salesTouched,
          reason:
            salesWon > 0
              ? `${faNum(salesWon)} برد · ${faNum(salesTouched)} فرصت جلو رفت`
              : `${faNum(salesTouched)} فرصت فروش جلو رفت`,
        }
      : { value: null, evidence: 0 };

  metrics.initiativeProgress =
    initiativesDone > 0 || initiativeAvg !== null
      ? {
          value: cap(
            0.5 * cap((initiativesDone / Math.max(1, windowDays / 14)) * 100) +
              0.5 * (initiativeAvg ?? 0),
          ),
          evidence: initiativesDone + initiativesActive.length,
          reason:
            initiativesDone > 0
              ? `تکمیل ${faNum(initiativesDone)} ابتکار`
              : `میانگین پیشرفت ${faNum(initiativeAvg ?? 0)}٪ ابتکارات`,
        }
      : { value: null, evidence: 0 };

  metrics.timeBlocks =
    blockCount > 0
      ? {
          value: cap((blockCount / Math.max(1, windowDays * 0.5)) * 100),
          evidence: blockCount,
          reason: `${faNum(blockCount)} بلوک زمانی`,
        }
      : { value: null, evidence: 0 };

  return metrics;
}

/* ------------------------------------------------------------------ */
/* Scoring pipeline                                                    */
/* ------------------------------------------------------------------ */

interface ComputedStat {
  def: StatDef;
  score: StatScore;
  previous: StatScore;
  trend: "up" | "down" | "flat" | null;
}

async function computeStats(
  ctx: Ctx,
  userId: Id<"users">,
  personaKey: string,
  windowDays: number,
): Promise<{ persona: string; windowDays: number; computed: ComputedStat[]; today: string }> {
  const defs = statsForPersona(personaKey);
  const today = todayKey();
  const bounds = windowBounds(today, windowDays, shiftKey);
  const bundle = await loadBundle(ctx, userId, bounds.previous.from, bounds.current.to);

  const currentMetrics = computeMetrics(bundle, bounds.current.from, bounds.current.to, today);
  const previousMetrics = computeMetrics(bundle, bounds.previous.from, bounds.previous.to, today);

  const computed = defs.map((def) => {
    const score = scoreStat(def, currentMetrics);
    const previous = scoreStat(def, previousMetrics);
    return {
      def,
      score,
      previous,
      trend: trendFor(
        { value: score.value, hasData: score.hasData },
        { value: previous.value, hasData: previous.hasData },
      ),
    };
  });

  return { persona: personaKey, windowDays, computed, today };
}

async function personaOf(ctx: Ctx, userId: Id<"users">): Promise<string> {
  const profile = await ctx.db
    .query("userProfile")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return profile?.personaKey ?? "personal";
}

/* ------------------------------------------------------------------ */
/* Persistence — engine hook (called after every meaningful activity)  */
/* ------------------------------------------------------------------ */

/**
 * Recompute the persona's stats for the default window and persist:
 *  - the cached `personaStats` row (dashboard snapshot), and
 *  - today's `statSnapshots` row (history / future analytics).
 * Fully idempotent and derived — safe to run as often as the engine runs.
 * Never throws: stats must not block the productivity engine.
 */
export async function syncPersonaStats(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  try {
    const personaKey = await personaOf(ctx, userId);
    const { computed, today } = await computeStats(
      ctx,
      userId,
      personaKey,
      DEFAULT_STAT_WINDOW,
    );
    const now = Date.now();

    for (const { def, score, previous, trend } of computed) {
      const tier = tierForValue(score.value);

      const existing = await ctx.db
        .query("personaStats")
        .withIndex("by_user_stat", (q) => q.eq("userId", userId).eq("statKey", def.key))
        .first();
      const row = {
        persona: personaKey,
        statKey: def.key,
        hasData: score.hasData,
        value: score.value,
        previousValue: previous.hasData ? previous.value : undefined,
        trend: trend ?? undefined,
        tier: tier.key,
        windowDays: DEFAULT_STAT_WINDOW,
        reason: score.reason || undefined,
        computedAt: now,
      };
      if (existing) await ctx.db.patch(existing._id, row);
      else await ctx.db.insert("personaStats", { userId, ...row });

      if (!score.hasData) continue;

      const yesterday = await ctx.db
        .query("statSnapshots")
        .withIndex("by_user_stat_day", (q) =>
          q.eq("userId", userId).eq("statKey", def.key).eq("day", shiftKey(today, -1)),
        )
        .first();
      const snapExisting = await ctx.db
        .query("statSnapshots")
        .withIndex("by_user_stat_day", (q) =>
          q.eq("userId", userId).eq("statKey", def.key).eq("day", today),
        )
        .first();
      const snap = {
        value: score.value,
        delta: yesterday ? score.value - yesterday.value : undefined,
        reason: score.reason || undefined,
        updatedAt: now,
      };
      if (snapExisting) await ctx.db.patch(snapExisting._id, snap);
      else await ctx.db.insert("statSnapshots", { userId, statKey: def.key, day: today, createdAt: now, ...snap });
    }
  } catch (err) {
    console.error("[personaStats] sync failed", err);
  }
}

/* ------------------------------------------------------------------ */
/* Public queries                                                      */
/* ------------------------------------------------------------------ */

function serializeStat(c: ComputedStat) {
  return {
    key: c.def.key,
    label: c.def.label,
    description: c.def.description,
    icon: c.def.icon,
    tone: c.def.tone,
    hasData: c.score.hasData,
    value: c.score.value,
    previousValue: c.previous.hasData ? c.previous.value : null,
    trend: c.trend,
    tier: tierForValue(c.score.value),
    reason: c.score.reason || null,
  };
}

/**
 * Live computation for a chosen window (7 or 30 days), each compared with the
 * previous comparable window. Used by the Progress/Stats center.
 */
export const overview = query({
  args: { windowDays: v.optional(v.number()) },
  handler: async (ctx, { windowDays }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const days = (STAT_WINDOW_OPTIONS as readonly number[]).includes(windowDays ?? 0)
      ? (windowDays as number)
      : DEFAULT_STAT_WINDOW;
    const personaKey = await personaOf(ctx, userId);
    const { computed } = await computeStats(ctx, userId, personaKey, days);
    return {
      persona: personaKey,
      windowDays: days,
      stats: computed.map(serializeStat),
      emptyState: STATS_EMPTY_STATE,
    };
  },
});

/**
 * Cheap cached snapshot for the dashboard strip — reads the rows the engine
 * already persisted instead of recomputing on every dashboard load.
 */
export const snapshot = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const personaKey = await personaOf(ctx, userId);
    const defs = statsForPersona(personaKey);
    const rows = await ctx.db
      .query("personaStats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return {
      persona: personaKey,
      stats: defs.map((def) => {
        const row = rows.find((r) => r.statKey === def.key);
        return {
          key: def.key,
          label: def.label,
          icon: def.icon,
          tone: def.tone,
          hasData: row?.hasData ?? false,
          value: row?.value ?? 0,
          trend: row?.trend ?? null,
          tier: row?.tier ?? tierForValue(0).key,
          reason: row?.reason ?? null,
        };
      }),
      computedAt: rows.reduce((n, r) => Math.max(n, r.computedAt), 0),
      emptyState: STATS_EMPTY_STATE,
      noData: "هنوز داده کافی نداریم",
    };
  },
});

/** Daily history for one stat — feeds the trend chart. */
export const history = query({
  args: { statKey: v.string(), days: v.optional(v.number()) },
  handler: async (ctx, { statKey, days }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const span = Math.max(7, Math.min(90, days ?? 30));
    const rows = await ctx.db
      .query("statSnapshots")
      .withIndex("by_user_stat_day", (q) =>
        q.eq("userId", userId).eq("statKey", statKey).gte("day", shiftKey(todayKey(), -(span - 1))),
      )
      .collect();
    return rows
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((r) => ({ day: r.day, value: r.value, delta: r.delta ?? 0, reason: r.reason ?? null }));
  },
});
