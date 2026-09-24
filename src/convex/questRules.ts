/**
 * Quests — Phase 06 (pure config, no Convex/React imports).
 *
 * Quests are short-term, bounded productivity missions that sit ON TOP of the
 * existing XP / Stats / Skills systems — they never create a second engine:
 *
 *   context → persona → goals → tasks/projects → stats/skills → quests
 *          → meaningful actions → XP (existing awardXp, once per instance)
 *
 * Design rules:
 *  - Everything here is DATA. Adding a quest, persona or difficulty is a
 *    config change; the service (quests.ts) and the UI never hard-code them.
 *  - Progress is always *derived* from real application data (see quests.ts),
 *    never incremented — deleted or reversed activity self-heals on the next
 *    evaluation and farming trivial interactions is impossible by design.
 *  - Selection is deliberately small (see QUEST_LIMITS): the surface shows
 *    "here is what matters next", never a game board.
 *  - Deterministic generation and prioritization only — no AI.
 */

/* ------------------------------------------------------------------ */  
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type QuestType = "daily" | "weekly" | "special" | "persona" | "goal";

/** Lifecycle window a quest instance repeats on. */
export type QuestScope = "daily" | "weekly" | "special";

export type QuestDifficulty = "easy" | "medium" | "hard" | "major";

/**
 * Metric keys the evaluation engine can derive from real user data.
 * Every metric maps to existing tables — nothing is tracked twice.
 */
export type QuestMetric =
  | "tasks_done"
  | "priority_done"
  | "focus_sessions"
  | "focus_minutes"
  | "routine_full"
  | "daily_review"
  | "weekly_review"
  | "study_sessions"
  | "assignments_done"
  | "deliverables_done"
  | "milestones_done"
  | "milestone_progress"
  | "meetings_done"
  | "exam_prep"
  | "goal_progress";

export interface QuestDef {
  key: string;
  type: QuestType;
  scope: QuestScope;
  /** Persian title shown on the quest card. */
  title: string;
  /** Why this quest exists (shown in the detail view). */
  description: string;
  metric: QuestMetric;
  target: number;
  difficulty: QuestDifficulty;
  /** Configured XP reward — paid at most once per `${key}:${period}`. */
  xp: number;
  /** What real actions count toward completion (shown in detail view). */
  countsText: string;
  /** Related skill key (persona skill catalog) — context only. */
  skillKey?: string;
  /** When set, the quest only exists for these personas. */
  personas?: string[];
}

/* ------------------------------------------------------------------ */
/* Labels & tones                                                      */
/* ------------------------------------------------------------------ */

export const QUEST_TYPE_LABELS: Record<QuestType, string> = {
  daily: "روزانه",
  weekly: "هفتگی",
  special: "ویژه",
  persona: "اختصاصی",
  goal: "هدف‌محور",
};

export interface DifficultyMeta {
  label: string;
  tone: string;
}

export const QUEST_DIFFICULTY: Record<QuestDifficulty, DifficultyMeta> = {
  easy: { label: "آسان", tone: "emerald" },
  medium: { label: "متوسط", tone: "blue" },
  hard: { label: "سخت", tone: "amber" },
  major: { label: "ویژه", tone: "violet" },
};

/** Persian metric names for the quest detail view. */
export const QUEST_METRIC_LABELS: Record<QuestMetric, string> = {
  tasks_done: "تکمیل کارها",
  priority_done: "کارهای مهم و فوری",
  focus_sessions: "جلسه‌های تمرکز",
  focus_minutes: "زمان تمرکز",
  routine_full: "روزهای کامل روتین",
  daily_review: "برنامه روزانه",
  weekly_review: "برنامه هفتگی",
  study_sessions: "جلسه‌های مطالعه",
  assignments_done: "تکالیف تحویل‌شده",
  deliverables_done: "تحویل‌دادنی‌ها",
  milestones_done: "نقاط عطف پروژه",
  milestone_progress: "پیشرفت نقطه عطف",
  meetings_done: "جلسات تمام‌شده",
  exam_prep: "آماده‌سازی آزمون",
  goal_progress: "پیشرفت هدف",
};

/* ------------------------------------------------------------------ */
/* Selection limits (configurable — surface stays small)               */
/* ------------------------------------------------------------------ */

export const QUEST_LIMITS = {
  /** Active daily quests per day. */
  DAILY_MIN: 1,
  DAILY_MAX: 3,
  /** Active weekly quests per week. */
  WEEKLY_MIN: 2,
  WEEKLY_MAX: 5,
  /** Special quests visible at once — only when there is a real reason. */
  SPECIAL_MAX: 3,
  /** How many completed quests the history tab shows. */
  COMPLETED_SHOWN: 40,
} as const;

/** Days ahead a deadline must fall for a special quest to be generated. */
export const SPECIAL_WINDOW_DAYS = 7;
/** Exams get a longer preparation window. */
export const SPECIAL_EXAM_WINDOW_DAYS = 14;

/** Special quest rewards by difficulty (event-bound, one-off). */
export const SPECIAL_XP: Record<string, number> = {
  medium: 70,
  hard: 100,
  major: 160,
};

/** How far a goal must advance to complete a goal-based quest. */
export const GOAL_ADVANCE_WEEKLY = 25;
export const GOAL_ADVANCE_SPECIAL = 20;
export const GOAL_QUEST_XP = 100;

/* ------------------------------------------------------------------ */
/* Empty states (calm, never punishing)                                */
/* ------------------------------------------------------------------ */

export const QUEST_EMPTY = {
  today: "چیز فوری‌ای منتظرت نیست — روی کارهای خودت تمرکز کن.",
  week: "هفته‌ات آرام است؛ بر اولویت‌های فعلی‌ات متمرکز بمان.",
  special: "فعلاً مأموریت ویژه‌ای در کار نیست.",
  completed: "هنوز مأموریتی تمام نشده — اولین گام را که برداری، همین‌جا ثبت می‌شود.",
  strip: "ماموریتی برای امروز نداری — هر وقت کاری بکنی، اینجا شکل می‌گیرد.",
} as const;

/* ------------------------------------------------------------------ */
/* Generic quest catalog (every persona)                               */
/* ------------------------------------------------------------------ */

const COUNTS_TASKS = "کارهایی که وضعیت‌شان «انجام شد» می‌شود (تیک زدن چک‌لیست خالی حساب نمی‌شود).";
const COUNTS_FOCUS =
  "جلسه تمرکز واقعی با حداقل ۱۰ دقیقه زمان انجام‌شده — جلسه‌های نیمه‌کاره حساب نمی‌شوند.";
const COUNTS_ROUTINE = "روزی که همه آیتم‌های یک روتین تیک بخورد.";
const COUNTS_REVIEW = "ثبت بازتاب/برنامه در بخش بازتاب — نه صرف باز کردن صفحه.";

export const GENERIC_QUESTS: QuestDef[] = [
  /* ---- daily ---- */
  {
    key: "g_daily_focus",
    type: "daily",
    scope: "daily",
    title: "یک جلسه تمرکز",
    description: "برای مهم‌ترین کار امروز یک بلوک تمرکز واقعی بگذار.",
    metric: "focus_sessions",
    target: 1,
    difficulty: "easy",
    xp: 25,
    countsText: COUNTS_FOCUS,
  },
  {
    key: "g_daily_priority",
    type: "daily",
    scope: "daily",
    title: "کارهای مهم امروز",
    description: "دو کار با اولویت بالا یا فوری را امروز ببند.",
    metric: "priority_done",
    target: 2,
    difficulty: "medium",
    xp: 40,
    countsText: COUNTS_TASKS,
  },
  {
    key: "g_daily_tasks",
    type: "daily",
    scope: "daily",
    title: "سه کار امروز",
    description: "سه کار از برنامه امروز را به پایان برسان.",
    metric: "tasks_done",
    target: 3,
    difficulty: "medium",
    xp: 45,
    countsText: COUNTS_TASKS,
  },
  {
    key: "g_daily_routine",
    type: "daily",
    scope: "daily",
    title: "روتین کامل امروز",
    description: "همه آیتم‌های یک روتین را امروز انجام بده.",
    metric: "routine_full",
    target: 1,
    difficulty: "easy",
    xp: 30,
    countsText: COUNTS_ROUTINE,
  },
  /* ---- weekly ---- */
  {
    key: "g_week_tasks",
    type: "weekly",
    scope: "weekly",
    title: "۱۰ کار در این هفته",
    description: "در طول همین هفته ده کار واقعی را تمام کن.",
    metric: "tasks_done",
    target: 10,
    difficulty: "medium",
    xp: 120,
    countsText: COUNTS_TASKS,
  },
  {
    key: "g_week_focus_sessions",
    type: "weekly",
    scope: "weekly",
    title: "۴ جلسه تمرکز هفتگی",
    description: "چهار جلسه تمرکز واقعی در طول هفته بگذار.",
    metric: "focus_sessions",
    target: 4,
    difficulty: "medium",
    xp: 130,
    countsText: COUNTS_FOCUS,
  },
  {
    key: "g_week_priority",
    type: "weekly",
    scope: "weekly",
    title: "هشت کار مهم هفتگی",
    description: "هشت کار با اولویت بالا یا فوری را این هفته ببند.",
    metric: "priority_done",
    target: 8,
    difficulty: "hard",
    xp: 160,
    countsText: COUNTS_TASKS,
  },
  {
    key: "g_week_routine",
    type: "weekly",
    scope: "weekly",
    title: "۵ روز روتین کامل",
    description: "پنج روز از این هفته را با روتین کامل سپری کن.",
    metric: "routine_full",
    target: 5,
    difficulty: "hard",
    xp: 150,
    countsText: COUNTS_ROUTINE,
  },
  {
    key: "g_week_review",
    type: "weekly",
    scope: "weekly",
    title: "برنامه هفتگی",
    description: "هفته آینده را برنامه‌ریزی کن و کارهای مهم را به اهداف گره بزن.",
    metric: "weekly_review",
    target: 1,
    difficulty: "medium",
    xp: 110,
    countsText: COUNTS_REVIEW,
  },
];

/* ------------------------------------------------------------------ */
/* Persona quest catalogs                                              */
/* ------------------------------------------------------------------ */

export const PERSONA_QUESTS: Record<string, QuestDef[]> = {
  /* ---- Student ---- */
  student: [
    {
      key: "s_daily_study",
      type: "persona",
      scope: "daily",
      title: "یک جلسه مطالعه",
      description: "امروز یک جلسه مطالعه واقعی و تمام‌شده داشته باش.",
      metric: "study_sessions",
      target: 1,
      difficulty: "easy",
      xp: 30,
      countsText: "جلسه مطالعه‌ای که وضعیت آن «تمام» باشد و زمان واقعی ثبت کرده باشد.",
      skillKey: "studyConsistency",
      personas: ["student"],
    },
    {
      key: "s_daily_assignment",
      type: "persona",
      scope: "daily",
      title: "یک تکلیف امروز",
      description: "دست‌کم یک تکلیف درسی را امروز تکمیل کن.",
      metric: "assignments_done",
      target: 1,
      difficulty: "medium",
      xp: 40,
      countsText: "تکلیفی که وضعیت آن «تکمیل‌شده» شود.",
      skillKey: "studyExecution",
      personas: ["student"],
    },
    {
      key: "s_week_study3",
      type: "persona",
      scope: "weekly",
      title: "۳ جلسه مطالعه هفتگی",
      description: "در طول هفته سه جلسه مطالعه متمرکز تمام کن.",
      metric: "study_sessions",
      target: 3,
      difficulty: "medium",
      xp: 130,
      countsText: "جلسه‌های مطالعه تمام‌شده با زمان واقعی.",
      skillKey: "studyConsistency",
      personas: ["student"],
    },
    {
      key: "s_week_assignments",
      type: "persona",
      scope: "weekly",
      title: "تکالیف این هفته",
      description: "تکالیفی که این هفته موعد دارند را تحویل بده.",
      metric: "assignments_done",
      target: 2,
      difficulty: "medium",
      xp: 120,
      countsText: "تکالیفی که وضعیت آن‌ها «تکمیل‌شده» شود.",
      skillKey: "studyExecution",
      personas: ["student"],
    },
  ],

  /* ---- Employee ---- */
  employee: [
    {
      key: "e_daily_plan",
      type: "persona",
      scope: "daily",
      title: "برنامه فردا را ببند",
      description: "قبل از پایان امروز، برنامه فردات را ثبت کن.",
      metric: "daily_review",
      target: 1,
      difficulty: "medium",
      xp: 45,
      countsText: COUNTS_REVIEW,
      skillKey: "workPlanning",
      personas: ["employee"],
    },
    {
      key: "e_week_review",
      type: "persona",
      scope: "weekly",
      title: "برنامه کاری هفته",
      description: "هفته کاری‌ات را مرور و برای هفته بعد برنامه‌ریزی کن.",
      metric: "weekly_review",
      target: 1,
      difficulty: "medium",
      xp: 110,
      countsText: COUNTS_REVIEW,
      skillKey: "workPlanning",
      personas: ["employee"],
    },
    {
      key: "e_week_meetings",
      type: "persona",
      scope: "weekly",
      title: "جلسات هفته را جمع‌وجور کن",
      description: "جلسات تعیین‌شده این هفته را به نتیجه برسان.",
      metric: "meetings_done",
      target: 2,
      difficulty: "medium",
      xp: 120,
      countsText: "جلساتی که وضعیت آن‌ها «تمام» شود.",
      skillKey: "meetingFollowUp",
      personas: ["employee"],
    },
  ],

  /* ---- Freelancer ---- */
  freelancer: [
    {
      key: "f_daily_deliverable",
      type: "persona",
      scope: "daily",
      title: "یک تحویل امروز",
      description: "دست‌کم یک خروجی مشتری را امروز به سرانجام برسان.",
      metric: "deliverables_done",
      target: 1,
      difficulty: "hard",
      xp: 70,
      countsText: "تحویل‌دادنی‌ای که به «تحویل شد» یا «تأیید شد» برسد.",
      skillKey: "deliverableSkill",
      personas: ["freelancer"],
    },
    {
      key: "f_week_deliverables",
      type: "persona",
      scope: "weekly",
      title: "۲ تحویل هفتگی",
      description: "دو خروجی مشتری را در این هفته تحویل بده.",
      metric: "deliverables_done",
      target: 2,
      difficulty: "hard",
      xp: 160,
      countsText: "تحویل‌دادنی‌های «تحویل شد» یا «تأیید شد».",
      skillKey: "deliverableSkill",
      personas: ["freelancer"],
    },
    {
      key: "f_week_focus_time",
      type: "persona",
      scope: "weekly",
      title: "۴ ساعت کار ساعتی",
      description: "چهار ساعت کار متمرکز و قابل‌حساب در این هفته ثبت کن.",
      metric: "focus_minutes",
      target: 240,
      difficulty: "hard",
      xp: 150,
      countsText: "مجموع زمان جلسه‌های تمرکز تمام‌شده (حداقل ۱۰ دقیقه).",
      skillKey: "timeManagement",
      personas: ["freelancer"],
    },
    {
      key: "f_week_milestones",
      type: "persona",
      scope: "weekly",
      title: "یک نقطه عطف پروژه",
      description: "یک نقطه عطف از پروژه‌های در جریان را تمام کن.",
      metric: "milestones_done",
      target: 1,
      difficulty: "hard",
      xp: 150,
      countsText: "نقاط عطفی که وضعیت آن‌ها «تکمیل‌شده» شود.",
      skillKey: "projectExecution",
      personas: ["freelancer"],
    },
  ],

  /* ---- Manager ---- */
  manager: [
    {
      key: "m_daily_priority",
      type: "persona",
      scope: "daily",
      title: "اولویت‌های امروز تیم",
      description: "دو کار مهم یا فوری را امروز ببند تا تیم جلو برود.",
      metric: "priority_done",
      target: 2,
      difficulty: "medium",
      xp: 40,
      countsText: COUNTS_TASKS,
      skillKey: "teamExecution",
      personas: ["manager"],
    },
    {
      key: "m_week_review",
      type: "persona",
      scope: "weekly",
      title: "برنامه هفتگی تیم",
      description: "هفته تیم را مرور و برنامه هفته بعد را بچین.",
      metric: "weekly_review",
      target: 1,
      difficulty: "medium",
      xp: 110,
      countsText: COUNTS_REVIEW,
      skillKey: "teamPlanning",
      personas: ["manager"],
    },
    {
      key: "m_week_meetings",
      type: "persona",
      scope: "weekly",
      title: "جلسات هماهنگی هفتگی",
      description: "جلسات تعیین‌شده این هفته را به نتیجه برسان.",
      metric: "meetings_done",
      target: 2,
      difficulty: "medium",
      xp: 120,
      countsText: "جلساتی که وضعیت آن‌ها «تمام» شود.",
      skillKey: "delegation",
      personas: ["manager"],
    },
    {
      key: "m_week_milestones",
      type: "persona",
      scope: "weekly",
      title: "یک نقطه عطف پروژه",
      description: "یک نقطه عطف پروژه‌های تیم را این هفته تمام کن.",
      metric: "milestones_done",
      target: 1,
      difficulty: "hard",
      xp: 150,
      countsText: "نقاط عطفی که وضعیت آن‌ها «تکمیل‌شده» شود.",
      skillKey: "projectCoord",
      personas: ["manager"],
    },
  ],

  /* ---- Business Owner ---- */
  business_owner: [
    {
      key: "b_daily_priority",
      type: "persona",
      scope: "daily",
      title: "سه اولویت کسب‌وکار",
      description: "سه کار مهم کسب‌وکار را امروز به سرانجام برسان.",
      metric: "priority_done",
      target: 3,
      difficulty: "medium",
      xp: 45,
      countsText: COUNTS_TASKS,
      skillKey: "businessExecution",
      personas: ["business_owner"],
    },
    {
      key: "b_week_review",
      type: "persona",
      scope: "weekly",
      title: "مرور هفتگی کسب‌وکار",
      description: "وضعیت هفته را مرور و اولویت‌های هفته بعد را مشخص کن.",
      metric: "weekly_review",
      target: 1,
      difficulty: "medium",
      xp: 110,
      countsText: COUNTS_REVIEW,
      skillKey: "strategicPlanning",
      personas: ["business_owner"],
    },
    {
      key: "b_week_milestones",
      type: "persona",
      scope: "weekly",
      title: "یک نقطه عطف عملیاتی",
      description: "یک نقطه عطف از پروژه‌های کسب‌وکار را تمام کن.",
      metric: "milestones_done",
      target: 1,
      difficulty: "hard",
      xp: 150,
      countsText: "نقاط عطفی که وضعیت آن‌ها «تکمیل‌شده» شود.",
      skillKey: "operationsSkill",
      personas: ["business_owner"],
    },
    {
      key: "b_week_focus",
      type: "persona",
      scope: "weekly",
      title: "۳ ساعت کار عمیق",
      description: "سه ساعت کار متمرکز روی مسائل مهم کسب‌وکار بگذار.",
      metric: "focus_minutes",
      target: 180,
      difficulty: "medium",
      xp: 130,
      countsText: COUNTS_FOCUS,
      skillKey: "operationsSkill",
      personas: ["business_owner"],
    },
  ],

  /* ---- Personal productivity ---- */
  personal: [
    {
      key: "p_daily_routine",
      type: "persona",
      scope: "daily",
      title: "روتین کامل امروز",
      description: "همه آیتم‌های یک روتین را امروز انجام بده.",
      metric: "routine_full",
      target: 1,
      difficulty: "easy",
      xp: 25,
      countsText: COUNTS_ROUTINE,
      skillKey: "routineManagement",
      personas: ["personal"],
    },
    {
      key: "p_daily_review",
      type: "persona",
      scope: "daily",
      title: "برنامه فردا",
      description: "قبل از پایان امروز برنامه فردات را ثبت کن.",
      metric: "daily_review",
      target: 1,
      difficulty: "easy",
      xp: 30,
      countsText: COUNTS_REVIEW,
      skillKey: "planningSkill",
      personas: ["personal"],
    },
    {
      key: "p_week_review",
      type: "persona",
      scope: "weekly",
      title: "برنامه‌ریزی هفتگی",
      description: "هفته آینده را برنامه‌ریزی کن و پیشرفت اهداف را مرور کن.",
      metric: "weekly_review",
      target: 1,
      difficulty: "medium",
      xp: 110,
      countsText: COUNTS_REVIEW,
      skillKey: "planningSkill",
      personas: ["personal"],
    },
    {
      key: "p_week_tasks",
      type: "persona",
      scope: "weekly",
      title: "۸ مسئولیت هفتگی",
      description: "هشت کار مهم شخصی را این هفته تمام کن.",
      metric: "tasks_done",
      target: 8,
      difficulty: "medium",
      xp: 120,
      countsText: COUNTS_TASKS,
      skillKey: "personalOrganization",
      personas: ["personal"],
    },
  ],
};

/** Aliases share the parent catalog. */
PERSONA_QUESTS.team = PERSONA_QUESTS.manager;
PERSONA_QUESTS.custom = PERSONA_QUESTS.personal;

/** Resolve the persona's quest definitions (generic + persona-specific). */
export function questsForPersona(personaKey: string): QuestDef[] {
  const specific = PERSONA_QUESTS[personaKey] ?? PERSONA_QUESTS.personal;
  return [...GENERIC_QUESTS, ...specific];
}

/* ------------------------------------------------------------------ */
/* Prioritization (deterministic scoring — no AI)                      */
/* ------------------------------------------------------------------ */

export interface QuestScoreEnv {
  /** True when the definition belongs to this persona's catalog. */
  isPersonaDef: boolean;
  /** Metrics already covered by active quests in the same period. */
  activeMetrics: string[];
  /** How much recent source data exists for this quest's metric. */
  sourceStrength: number;
  /** Open tasks planned for today — avoid conflicting with heavy workload. */
  openTasksToday: number;
  /** Days until the deadline (special quests only). */
  daysToDeadline: number | null;
}

/**
 * Deterministic priority score. Deadline proximity and persona relevance
 * rise to the top; duplicate metrics and overloaded targets are pushed down
 * so the small selection never conflicts with obvious workload constraints.
 */
export function scoreQuest(def: QuestDef, env: QuestScoreEnv): number {
  let score = 50;
  if (env.isPersonaDef) score += 12;
  score += Math.min(18, env.sourceStrength * 3);
  if (env.activeMetrics.includes(def.metric)) score -= 30;
  if (env.openTasksToday >= 8 && def.target >= 5) score -= 12;
  if (env.daysToDeadline !== null) {
    score += Math.max(0, 18 - env.daysToDeadline * 4);
  }
  if (def.difficulty === "major") score -= 4;
  return score;
}

/** Stable ordering: highest score first, key as the deterministic tiebreak. */
export function compareQuestScore(
  a: { def: QuestDef; score: number },
  b: { def: QuestDef; score: number },
): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.def.key.localeCompare(b.def.key);
}
