/**
 * Shared progression system config.
 *
 * This module is intentionally pure (no Convex / React imports) so it can be
 * used by the Convex engine, the API layer and the UI without duplication.
 * Everything is data driven: adding levels, missions, challenges, achievements
 * or rewards later is a config change, not a refactor.
 */

/* ------------------------------------------------------------------ */
/* Date helpers (server + client share the same day-key convention)     */
/* ------------------------------------------------------------------ */

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Stable YYYY-MM-DD key (local time), matching the rest of the app. */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayKey(): string {
  return dateKey(new Date());
}

/** Shift a YYYY-MM-DD key by N days. */
export function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dateKey(new Date(y, m - 1, d + days));
}

/** a - b in whole days. */
export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000);
}

/** Saturday-start week key (Persian week) for a day key. */
export function weekStartKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const offset = (dt.getDay() + 1) % 7; // Saturday = 0
  dt.setDate(dt.getDate() - offset);
  return dateKey(dt);
}

export function monthStartKey(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

/** Inclusive list of day keys from .. to. */
export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard < 800) {
    out.push(cur);
    cur = shiftKey(cur, 1);
    guard += 1;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Level system                                                        */
/* ------------------------------------------------------------------ */

export interface LevelDef {
  level: number;
  title: string;
  /** Cumulative XP required to reach this level. */
  xp: number;
}

export const LEVELS: LevelDef[] = [
  { level: 1, title: "شروع‌کننده", xp: 0 },
  { level: 2, title: "قدم اول", xp: 200 },
  { level: 3, title: "پیگیر", xp: 500 },
  { level: 4, title: "منظم", xp: 900 },
  { level: 5, title: "سازنده", xp: 1400 },
  { level: 6, title: "پرتلاش", xp: 2000 },
  { level: 7, title: "متمرکز", xp: 2800 },
  { level: 8, title: "حرفه‌ای", xp: 3700 },
  { level: 9, title: "استاد عادت", xp: 4700 },
  { level: 10, title: "فرمانده زمان", xp: 6000 },
];

export const MAX_NAMED_LEVEL = 10;

/** Cumulative XP needed for a level (levels above 10 follow a linear curve). */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  const last = LEVELS[LEVELS.length - 1];
  if (level <= last.level) return LEVELS[level - 1].xp;
  return last.xp + (level - last.level) * 1800;
}

export function titleForLevel(level: number): string {
  if (level <= MAX_NAMED_LEVEL) return LEVELS[level - 1].title;
  return LEVELS[MAX_NAMED_LEVEL - 1].title;
}

export interface LevelInfo {
  xp: number;
  level: number;
  title: string;
  levelStartXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  xpForNext: number;
  xpToNext: number;
  progressPct: number;
}

/** Resolve a level object from cumulative XP. */
export function levelInfoFromXp(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.round(totalXp));
  let level = 1;
  while (xpForLevel(level + 1) <= xp && level < 400) level += 1;
  const levelStartXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const xpIntoLevel = xp - levelStartXp;
  const xpForNext = nextLevelXp - levelStartXp;
  return {
    xp,
    level,
    title: titleForLevel(level),
    levelStartXp,
    nextLevelXp,
    xpIntoLevel,
    xpForNext,
    xpToNext: Math.max(0, nextLevelXp - xp),
    progressPct: xpForNext <= 0 ? 100 : Math.min(100, Math.round((xpIntoLevel / xpForNext) * 100)),
  };
}

/* ------------------------------------------------------------------ */
/* XP rules (configurable, anti-farming caps included)                  */
/* ------------------------------------------------------------------ */

export const XP_RULES = {
  /** Completing a task awards XP by priority. */
  taskByPriority: { low: 5, medium: 10, high: 16, urgent: 22 } as Record<string, number>,
  /** Completing a subtask — small, to avoid farming with checklists. */
  subtask: 3,
  /** Ticking a routine / habit item for a day. */
  routineItem: 10,
  /** Finishing every routine item of a day (at least 3 items). */
  perfectRoutineBonus: 20,
  /** Finishing all of today's planned tasks (at least 3). */
  plannedDayBonus: 30,
  /** Missions & challenges. */
  dailyMission: 40,
  weeklyMission: 150,
  /** Growth paths. */
  stageBonus: 100,
  pathCompletion: 300,
  /** Streak milestones (awarded once each). */
  streakMilestones: [7, 14, 30, 60, 100] as number[],
  /* Outcome awards — projects, goals, focus (Phase 03). */
  /** Finishing a whole project (awarded once per project). */
  projectCompleted: 150,
  /** Completing a project milestone / checkpoint (awarded once each). */
  projectMilestone: 60,
  /** Completing any goal (personal / work / team / business) — once each. */
  goalCompleted: 120,
  /** Completing one milestone/step inside a goal — once each. */
  goalMilestone: 40,
  /** A genuinely completed focus/study session (see min minutes below). */
  focusSession: 25,
  /** Minimum actual minutes for a session to count as completed focus. */
  focusMinMinutes: 10,
  /** Anti-exploit: maximum focus-session XP awards counted per day. */
  dailyFocusXpCap: 4,
  /** Anti-exploit: maximum task-XP awards counted per day. */
  dailyTaskXpCap: 12,
  /** Anti-exploit: maximum routine-XP awards counted per day. */
  dailyRoutineXpCap: 20,
} as const;

/**
 * Centralized semantic action registry (single source of truth).
 * Callers reference these names instead of scattering XP numbers through
 * the frontend — values always resolve from XP_RULES above.
 */
export const XP_ACTIONS = {
  TASK_COMPLETED: { kind: "task", xp: (priority: string) => XP_RULES.taskByPriority[priority] ?? 10 },
  TASK_IMPORTANT_COMPLETED: { kind: "task", xp: () => XP_RULES.taskByPriority.high ?? 16 },
  PROJECT_COMPLETED: { kind: "project", xp: () => XP_RULES.projectCompleted },
  PROJECT_MILESTONE: { kind: "project", xp: () => XP_RULES.projectMilestone },
  GOAL_COMPLETED: { kind: "goal", xp: () => XP_RULES.goalCompleted },
  GOAL_MILESTONE: { kind: "goal", xp: () => XP_RULES.goalMilestone },
  FOCUS_SESSION: { kind: "focus", xp: () => XP_RULES.focusSession },
  ROUTINE_COMPLETION: { kind: "routine", xp: () => XP_RULES.routineItem },
  DAILY_PLAN: { kind: "bonus", xp: () => XP_RULES.plannedDayBonus },
  WEEKLY_MISSION: { kind: "mission", xp: () => XP_RULES.weeklyMission },
} as const;

export type XpActionName = keyof typeof XP_ACTIONS;

/* ------------------------------------------------------------------ */
/* Daily score                                                         */
/* ------------------------------------------------------------------ */

export const DAILY_SCORE_WEIGHTS = {
  tasks: 0.45,
  routines: 0.25,
  consistency: 0.15,
  missions: 0.15,
} as const;

export interface DailyScoreInput {
  plannedTasks: number;
  completedTasks: number;
  routineItems: number;
  routineDone: number;
  currentStreak: number;
  missionsDone: number;
  missionsTotal: number;
}

export interface DailyScoreBreakdown {
  tasks: number;
  routines: number;
  consistency: number;
  missions: number;
  total: number;
}

const pct = (done: number, total: number): number => {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
};

/**
 * Daily productivity score 0..100 derived from real activity only.
 * Categories the user has no data for (no routines, no missions yet) are
 * dropped from the weighting instead of dragging the score down.
 */
export function computeDailyScore(input: DailyScoreInput): DailyScoreBreakdown {
  // A day with no planned tasks still scores if the user completed ad-hoc work.
  const tasks =
    input.plannedTasks > 0
      ? pct(input.completedTasks, input.plannedTasks)
      : Math.min(100, input.completedTasks * 25);
  const routines = input.routineItems > 0 ? pct(input.routineDone, input.routineItems) : 0;
  const consistency = Math.min(100, Math.round((input.currentStreak / 7) * 100));
  const missions = input.missionsTotal > 0 ? pct(input.missionsDone, input.missionsTotal) : 0;

  const weights = {
    tasks: DAILY_SCORE_WEIGHTS.tasks,
    routines: input.routineItems > 0 ? DAILY_SCORE_WEIGHTS.routines : 0,
    consistency: DAILY_SCORE_WEIGHTS.consistency,
    missions: input.missionsTotal > 0 ? DAILY_SCORE_WEIGHTS.missions : 0,
  };
  const weightSum = weights.tasks + weights.routines + weights.consistency + weights.missions;
  const total =
    weightSum <= 0
      ? 0
      : Math.round(
          (tasks * weights.tasks +
            routines * weights.routines +
            consistency * weights.consistency +
            missions * weights.missions) /
            weightSum,
        );
  return { tasks, routines, consistency, missions, total };
}

export function scoreTone(score: number): "emerald" | "amber" | "rose" | "slate" {
  if (score >= 80) return "emerald";
  if (score >= 60) return "amber";
  if (score >= 35) return "rose";
  return "slate";
}

/* ------------------------------------------------------------------ */
/* Mission templates (daily + weekly)                                  */
/* ------------------------------------------------------------------ */

/** Metric keys the engine can evaluate from real user data. */
export type MissionMetric =
  | "tasks_done"
  | "priority_done"
  | "all_planned"
  | "focus_minutes"
  | "routine_items"
  | "routine_full"
  | "habit_streak"
  | "score_days"
  | "routine_days"
  | "tasks_week"
  | "xp_today"
  | "xp_week"
  | "streak";

export interface MissionTemplate {
  key: string;
  title: string;
  description: string;
  metric: MissionMetric;
  target: number;
  xp: number;
  /** Marks missions that are only meaningful when the user has data. */
  requiresRoutines?: boolean;
}

export const DAILY_MISSIONS: MissionTemplate[] = [
  {
    key: "daily_priority_3",
    title: "۳ کار مهم را کامل کن",
    description: "کارهای با اولویت بالا یا فوری امروز.",
    metric: "priority_done",
    target: 3,
    xp: XP_RULES.dailyMission,
  },
  {
    key: "daily_plan_done",
    title: "همه کارهای امروز را ببند",
    description: "برنامه امروزت را کامل انجام بده.",
    metric: "all_planned",
    target: 100,
    xp: XP_RULES.dailyMission,
  },
  {
    key: "daily_routine",
    title: "روتین امروز را انجام بده",
    description: "همه آیتم‌های یک روتین را تیک بزن.",
    metric: "routine_full",
    target: 1,
    xp: XP_RULES.dailyMission,
    requiresRoutines: true,
  },
  {
    key: "daily_habit_keep",
    title: "زنجیره عادت را حفظ کن",
    description: "حداقل یک آیتم روتین امروز.",
    metric: "habit_streak",
    target: 1,
    xp: 20,
    requiresRoutines: true,
  },
  {
    key: "daily_focus_45",
    title: "۴۵ دقیقه کار متمرکز",
    description: "مجموع زمان تخمینی کارهای تکمیل‌شده امروز.",
    metric: "focus_minutes",
    target: 45,
    xp: 30,
  },
];

export const WEEKLY_MISSIONS: MissionTemplate[] = [
  {
    key: "weekly_plan_5",
    title: "۵ روز این هفته برنامه‌ات را کامل کن",
    description: "روزهایی با امتیاز ۶۰ به بالا.",
    metric: "score_days",
    target: 5,
    xp: XP_RULES.weeklyMission,
  },
  {
    key: "weekly_tasks_20",
    title: "۲۰ کار مهم را کامل کن",
    description: "در طول همین هفته.",
    metric: "tasks_week",
    target: 20,
    xp: XP_RULES.weeklyMission,
  },
  {
    key: "weekly_routine_5",
    title: "۵ روز روتین را کامل انجام بده",
    description: "روزهایی که همه آیتم‌های روتین تیک خورده.",
    metric: "routine_days",
    target: 5,
    xp: XP_RULES.weeklyMission,
    requiresRoutines: true,
  },
  {
    key: "weekly_xp_500",
    title: "۵۰۰ XP در این هفته کسب کن",
    description: "پاداش هفته پرکار.",
    metric: "xp_week",
    target: 500,
    xp: XP_RULES.weeklyMission,
  },
  {
    key: "weekly_streak_7",
    title: "زنجیره ۷ روزه را حفظ کن",
    description: "هر روز کاری انجام بده.",
    metric: "streak",
    target: 7,
    xp: XP_RULES.weeklyMission,
  },
];

/* ------------------------------------------------------------------ */
/* Challenges                                                          */
/* ------------------------------------------------------------------ */

export type ChallengeMetric = "days_active" | "tasks_done" | "routine_days" | "xp_total";

export interface ChallengeDef {
  key: string;
  title: string;
  description: string;
  days: number;
  metric: ChallengeMetric;
  target: number;
  xp: number;
  emoji: string;
  tone: "blue" | "violet" | "emerald" | "amber" | "rose" | "cyan";
}

export const CHALLENGES: ChallengeDef[] = [
  {
    key: "focus_7",
    title: "چالش ۷ روز تمرکز",
    description: "۷ روز متوالی کار مفید انجام بده.",
    days: 7,
    metric: "days_active",
    target: 7,
    xp: 250,
    emoji: "🎯",
    tone: "blue",
  },
  {
    key: "study_14",
    title: "چالش ۱۴ روز مطالعه",
    description: "در ۱۴ روز، ۱۴ کار مطالعه‌ای کامل کن.",
    days: 14,
    metric: "tasks_done",
    target: 14,
    xp: 400,
    emoji: "📚",
    tone: "violet",
  },
  {
    key: "routine_21",
    title: "چالش ۲۱ روز نظم روتین",
    description: "۲۱ روز روتین‌هایت را کامل انجام بده.",
    days: 21,
    metric: "routine_days",
    target: 21,
    xp: 600,
    emoji: "🌱",
    tone: "emerald",
  },
  {
    key: "discipline_30",
    title: "چالش ۳۰ روز نظم",
    description: "۳۰ روز با برنامه شخصی پیش برو.",
    days: 30,
    metric: "days_active",
    target: 30,
    xp: 1000,
    emoji: "🏆",
    tone: "amber",
  },
  {
    key: "sprint_3",
    title: "اسپرینت ۳ روزه",
    description: "در ۳ روز، ۱۵ کار را کامل کن.",
    days: 3,
    metric: "tasks_done",
    target: 15,
    xp: 200,
    emoji: "⚡",
    tone: "cyan",
  },
  {
    key: "xp_hunter_7",
    title: "شکار XP هفتگی",
    description: "در ۷ روز، ۸۰۰ XP کسب کن.",
    days: 7,
    metric: "xp_total",
    target: 800,
    xp: 350,
    emoji: "✨",
    tone: "rose",
  },
];

/* ------------------------------------------------------------------ */
/* Achievements                                                        */
/* ------------------------------------------------------------------ */

export type AchievementMetric =
  | "tasksDone"
  | "tasksOneDay"
  | "currentStreak"
  | "longestStreak"
  | "level"
  | "missionsDone"
  | "challengesDone"
  | "pathsDone"
  | "perfectDays"
  | "routineDays"
  | "activeDays"
  | "projectsDone"
  | "xpTotal"
  | "routineDone";

export interface AchievementDef {
  key: string;
  title: string;
  description: string;
  icon: string;
  tone: "blue" | "violet" | "emerald" | "amber" | "rose" | "cyan";
  metric: AchievementMetric;
  target: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: "first_task", title: "شروع طوفانی", description: "اولین کارت را کامل کن.", icon: "rocket", tone: "blue", metric: "tasksDone", target: 1 },
  { key: "tasks_50", title: "کاربلد", description: "۵۰ کار را کامل کن.", icon: "check", tone: "emerald", metric: "tasksDone", target: 50 },
  { key: "tasks_250", title: "ماشین بهره‌وری", description: "۲۵۰ کار را کامل کن.", icon: "zap", tone: "violet", metric: "tasksDone", target: 250 },
  { key: "tasks_1000", title: "افسانه پیوستگی", description: "۱۰۰۰ کار را کامل کن.", icon: "crown", tone: "amber", metric: "tasksDone", target: 1000 },
  { key: "day_10_tasks", title: "روز پرکار", description: "۱۰ کار را در یک روز کامل کن.", icon: "flame", tone: "amber", metric: "tasksOneDay", target: 10 },
  { key: "streak_7", title: "زنجیره ۷ روزه", description: "۷ روز متوالی فعال بمان.", icon: "flame", tone: "amber", metric: "currentStreak", target: 7 },
  { key: "streak_30", title: "یک ماه پیوستگی", description: "۳۰ روز متوالی فعال بمان.", icon: "medal", tone: "violet", metric: "longestStreak", target: 30 },
  { key: "streak_100", title: "صد روز پایداری", description: "۱۰۰ روز متوالی فعال بمان.", icon: "trophy", tone: "rose", metric: "longestStreak", target: 100 },
  { key: "habit_builder", title: "عادت‌ساز", description: "۱۴ روز روتین‌هایت را کامل کن.", icon: "repeat", tone: "emerald", metric: "routineDays", target: 14 },
  { key: "routine_100", title: "روتین‌ساز حرفه‌ای", description: "۱۰۰ آیتم روتین را تیک بزن.", icon: "list", tone: "cyan", metric: "routineDone", target: 100 },
  { key: "perfect_day", title: "روز بی‌نقص", description: "یک روز با امتیاز ۱۰۰.", icon: "star", tone: "amber", metric: "perfectDays", target: 1 },
  { key: "perfect_days_10", title: "استمرار کامل", description: "۱۰ روز با امتیاز ۱۰۰.", icon: "sparkles", tone: "violet", metric: "perfectDays", target: 10 },
  { key: "mission_first", title: "ماموریت انجام شد", description: "اولین ماموریتت را کامل کن.", icon: "target", tone: "blue", metric: "missionsDone", target: 1 },
  { key: "mission_50", title: "ماموریت‌باز", description: "۵۰ ماموریت را کامل کن.", icon: "crosshair", tone: "cyan", metric: "missionsDone", target: 50 },
  { key: "challenge_first", title: "چالش‌پذیر", description: "اولین چالشت را کامل کن.", icon: "swords", tone: "rose", metric: "challengesDone", target: 1 },
  { key: "challenge_master", title: "استاد چالش", description: "۵ چالش را کامل کن.", icon: "shield", tone: "violet", metric: "challengesDone", target: 5 },
  { key: "path_first", title: "مسافر مسیر", description: "اولین مسیر رشدت را تمام کن.", icon: "route", tone: "emerald", metric: "pathsDone", target: 1 },
  { key: "path_master", title: "قهرمان مسیرها", description: "۳ مسیر رشد را کامل کن.", icon: "map", tone: "amber", metric: "pathsDone", target: 3 },
  { key: "goal_achiever", title: "هدف‌گذار", description: "اولین پروژه‌ات را به پایان برسان.", icon: "flag", tone: "blue", metric: "projectsDone", target: 1 },
  { key: "level_5", title: "سازنده", description: "به سطح ۵ برس.", icon: "layers", tone: "cyan", metric: "level", target: 5 },
  { key: "level_10", title: "فرمانده زمان", description: "به سطح ۱۰ برس.", icon: "crown", tone: "amber", metric: "level", target: 10 },
  { key: "consistency_master", title: "استاد پیوستگی", description: "۳۰ روز فعال داشته باش.", icon: "calendar", tone: "emerald", metric: "activeDays", target: 30 },
  { key: "xp_5000", title: "پنج هزار XP", description: "۵۰۰۰ XP کسب کن.", icon: "gem", tone: "violet", metric: "xpTotal", target: 5000 },
];

/** Per-path achievements, derived from the growth-path catalog. */
export function pathAchievements(pathKey: string, pathTitle: string, emoji: string): AchievementDef {
  return {
    key: `path_${pathKey}_done`,
    title: `تکمیل ${pathTitle}`,
    description: "همه مراحل این مسیر را کامل کردی.",
    icon: emoji,
    tone: "amber",
    metric: "pathsDone",
    target: 1,
  };
}

export function achievementMeta(key: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.key === key);
}

/* ------------------------------------------------------------------ */
/* Rewards / unlocks                                                   */
/* ------------------------------------------------------------------ */

export type RewardKind = "frame" | "accent" | "title" | "theme" | "effect";

export interface RewardDef {
  key: string;
  title: string;
  description: string;
  kind: RewardKind;
  level: number;
  /** Preview classes used by the UI. */
  preview: string;
}

export const REWARDS: RewardDef[] = [
  { key: "frame_blue", title: "قاب آبی", description: "قاب پروفایل با هاله آبی.", kind: "frame", level: 2, preview: "from-sky-400 to-blue-600" },
  { key: "title_persistent", title: "عنوان «پیگیر»", description: "عنوان نمایشی زیر نام تو.", kind: "title", level: 3, preview: "from-blue-500 to-indigo-600" },
  { key: "accent_amber", title: "لهجه کهربایی", description: "رنگ تأکید گرم برای پروفایل.", kind: "accent", level: 4, preview: "from-amber-400 to-orange-500" },
  { key: "frame_violet", title: "قاب بنفش", description: "قاب پروفایل با گرادیان بنفش.", kind: "frame", level: 5, preview: "from-violet-400 to-purple-600" },
  { key: "title_diligent", title: "عنوان «پرتلاش»", description: "عنوان ویژه برای هفته‌های پرکار.", kind: "title", level: 6, preview: "from-indigo-500 to-violet-600" },
  { key: "theme_glass", title: "تم شیشه‌ای", description: "سطح شیشه‌ای پررنگ‌تر در پروفایل.", kind: "theme", level: 7, preview: "from-cyan-400 to-sky-600" },
  { key: "frame_gold", title: "قاب طلایی", description: "قاب طلایی برای سطح‌های بالا.", kind: "frame", level: 8, preview: "from-amber-300 to-yellow-600" },
  { key: "title_habit_master", title: "عنوان «استاد عادت»", description: "برای کسانی که عادت‌ها را ساختند.", kind: "title", level: 9, preview: "from-emerald-400 to-teal-600" },
  { key: "effect_aura", title: "هاله پروفایل", description: "هاله متحرک اطراف آواتار.", kind: "effect", level: 9, preview: "from-fuchsia-400 to-violet-600" },
  { key: "frame_legend", title: "قاب افسانه‌ای", description: "بالاترین نشان تزئینی پلتفرم.", kind: "frame", level: 10, preview: "from-rose-400 via-violet-500 to-amber-400" },
];

export function rewardsForLevel(level: number): RewardDef[] {
  return REWARDS.filter((r) => r.level <= level);
}

export function nextReward(level: number): RewardDef | undefined {
  return REWARDS.filter((r) => r.level > level).sort((a, b) => a.level - b.level)[0];
}

/* ------------------------------------------------------------------ */
/* XP history kinds                                                    */
/* ------------------------------------------------------------------ */

export const XP_KINDS = [
  "task",
  "subtask",
  "routine",
  "mission",
  "challenge",
  "path",
  "stage",
  "streak",
  "bonus",
  "project",
  "goal",
  "focus",
] as const;
export type XpKind = (typeof XP_KINDS)[number];

export const XP_KIND_LABELS: Record<string, string> = {
  task: "کار",
  subtask: "زیرکار",
  routine: "روتین",
  mission: "ماموریت",
  challenge: "چالش",
  path: "مسیر رشد",
  stage: "مرحله مسیر",
  streak: "زنجیره",
  bonus: "پاداش",
  project: "پروژه",
  goal: "هدف",
  focus: "تمرکز",
};

/** Filter groups used by the XP history UI. */
export const XP_FILTERS: Array<{ key: string; label: string; kinds: XpKind[] }> = [
  { key: "all", label: "همه", kinds: [...XP_KINDS] },
  { key: "task", label: "کارها", kinds: ["task", "subtask"] },
  { key: "routine", label: "روتین‌ها", kinds: ["routine"] },
  { key: "mission", label: "ماموریت‌ها", kinds: ["mission"] },
  { key: "challenge", label: "چالش‌ها", kinds: ["challenge"] },
  { key: "path", label: "مسیرها", kinds: ["path", "stage"] },
  { key: "project", label: "پروژه‌ها", kinds: ["project"] },
  { key: "goal", label: "اهداف", kinds: ["goal"] },
  { key: "focus", label: "تمرکز", kinds: ["focus"] },
  { key: "bonus", label: "پاداش‌ها", kinds: ["streak", "bonus"] },
];
