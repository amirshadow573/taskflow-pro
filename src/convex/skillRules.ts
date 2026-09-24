/**
 * Skills & Evolution — Phase 05 (pure config, no Convex/React imports).
 *
 * Skills answer "which capabilities am I developing?" and Evolution answers
 * "where am I on my persona's journey?". Both sit ON TOP of the Phase 04
 * persona stats — they never create a second event system:
 *
 *   real activity → persona stats (Phase 04) → skills → evolution stages
 *
 * Design rules:
 *  - Everything here is DATA. Adding a persona, skill or stage is a config
 *    change; the service (skills.ts) and UI never hard-code them.
 *  - Skill progress is *derived* from contributing persona stats (0–100),
 *    which are themselves derived from audited activity — reversed or
 *    invalidated activity can never permanently inflate a skill.
 *  - Anti-gaming comes for free: stats ignore trivial interactions, so
 *    skills cannot be farmed by clicking, refreshing or re-toggling.
 *  - Future requirement types (quests, achievements, unlocks) can be added
 *    as new fields on SkillDef / EvolutionStage without touching consumers.
 */
import { faNum } from "./statRules";

/* ------------------------------------------------------------------ */
/* Skill levels (§9 — configurable)                                    */
/* ------------------------------------------------------------------ */

/**
 * Progress thresholds (0–100) for skill levels 2..5; level 1 is the base
 * once the skill has any data. Level 0 = "not started" (no data at all).
 */
export const SKILL_LEVEL_THRESHOLDS = [0, 25, 50, 70, 88] as const;

/** Max skill level (= number of thresholds). */
export const SKILL_MAX_LEVEL = SKILL_LEVEL_THRESHOLDS.length;

/** Derive the skill level from progress + data availability. */
export function skillLevelFor(hasData: boolean, progress: number): number {
  if (!hasData) return 0;
  let level = 1;
  for (const min of SKILL_LEVEL_THRESHOLDS) if (progress >= min) level = Math.max(level, SKILL_LEVEL_THRESHOLDS.indexOf(min) + 1);
  return level;
}

/** The next threshold above `progress`, or null when the skill is maxed. */
export function nextSkillThreshold(progress: number): number | null {
  for (const min of SKILL_LEVEL_THRESHOLDS) {
    if (progress < min) return min;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Skill definitions                                                   */
/* ------------------------------------------------------------------ */

export interface SkillStatContribution {
  /** Stat key from statRules.STAT_CATALOG. */
  statKey: string;
  weight: number;
}

export interface SkillDef {
  key: string;
  /** Persian display name. */
  label: string;
  /** One neutral sentence — what this capability represents. */
  description: string;
  /** Icon name resolved by the UI (same icon set as the stats surface). */
  icon: string;
  /** Tone key from the shared design system. */
  tone: string;
  /** Weighted persona stats that develop this skill. */
  stats: SkillStatContribution[];
  /** Deterministic "how to improve" hints shown in the skill detail. */
  tips: string[];
}

/* ------------------------------------------------------------------ */
/* Persona skill sets (§3–§9 — one path per persona)                    */
/* ------------------------------------------------------------------ */

export const PERSONA_SKILLS: Record<string, SkillDef[]> = {
  // Student — Planner → Consistent Learner → Focused Learner → Exam Strategist → Study Master
  student: [
    {
      key: "planning",
      label: "برنامه‌ریزی درسی",
      description: "توانایی برنامه‌ریزی مطالعه و اجرای همان برنامه.",
      icon: "calendar",
      tone: "violet",
      stats: [{ statKey: "planning", weight: 0.65 }, { statKey: "consistency", weight: 0.35 }],
      tips: [
        "برنامه هفتگی مطالعه بچین و به آن پایبند بمان",
        "کارهای مهم را قبل از امتحان‌ها زمان‌بندی کن",
      ],
    },
    {
      key: "studyConsistency",
      label: "ثبات مطالعه",
      description: "ادامه‌دادن مطالعه به‌صورت منظم در طول هفته‌ها.",
      icon: "flame",
      tone: "amber",
      stats: [{ statKey: "consistency", weight: 0.6 }, { statKey: "study", weight: 0.4 }],
      tips: ["هر روز حتی کوتاه مطالعه کن", "روتین مطالعه روزانه بساز"],
    },
    {
      key: "focus",
      label: "تمرکز",
      description: "جلسه‌های کار متمرکز واقعی و بدون حواس‌پرتی.",
      icon: "timer",
      tone: "blue",
      stats: [{ statKey: "focus", weight: 0.7 }, { statKey: "consistency", weight: 0.3 }],
      tips: ["جلسه‌های تمرکز کوتاه اما پیوسته بگذار", "بلوک‌های زمانی بدون اعلان بساز"],
    },
    {
      key: "examPrep",
      label: "آماده‌سازی امتحان",
      description: "آماده‌سازی هدفمند برای آزمون‌ها و تکالیف به‌موقع.",
      icon: "book",
      tone: "cyan",
      stats: [{ statKey: "study", weight: 0.55 }, { statKey: "execution", weight: 0.25 }, { statKey: "planning", weight: 0.2 }],
      tips: ["پیشرفت آماده‌سازی هر امتحان را به‌روز نگه دار", "تکالیف را قبل از موعد تحویل بده"],
    },
    {
      key: "studyExecution",
      label: "اجرای مطالعه",
      description: "تبدیل برنامه‌ی درسی به جلسه‌های تمام‌شده.",
      icon: "check",
      tone: "emerald",
      stats: [{ statKey: "execution", weight: 0.6 }, { statKey: "study", weight: 0.4 }],
      tips: ["جلسه‌های برنامه‌ریزی‌شده را کامل کن", "کارهای عقب‌افتاده را جبران کن"],
    },
    {
      key: "organization",
      label: "سازمان‌دهی تحصیلی",
      description: "منظم نگه‌داشتن درس‌ها، یادداشت‌ها و کارهای تحصیلی.",
      icon: "folder",
      tone: "blue",
      stats: [{ statKey: "planning", weight: 0.5 }, { statKey: "consistency", weight: 0.3 }, { statKey: "execution", weight: 0.2 }],
      tips: ["درس‌ها و تکالیف را مرتب و به‌روز نگه دار", "یادداشت‌های هر درس را جمع کن"],
    },
  ],

  // Employee — Contributor → Organizer → Reliable Executor → Focused Professional → Workflow Expert → Execution Master
  employee: [
    {
      key: "workPlanning",
      label: "برنامه‌ریزی کار",
      description: "برنامه‌ریزی مؤثر کارهای روزانه و هفتگی.",
      icon: "calendar",
      tone: "violet",
      stats: [{ statKey: "planning", weight: 0.6 }, { statKey: "consistency", weight: 0.4 }],
      tips: ["کارهای فردا را امروز برنامه‌ریزی کن", "بلوک‌های زمانی برای کارهای مهم بگذار"],
    },
    {
      key: "executionSkill",
      label: "اجرای کار",
      description: "اتمام کارهای برنامه‌ریزی‌شده به‌موقع.",
      icon: "check",
      tone: "emerald",
      stats: [{ statKey: "execution", weight: 0.7 }, { statKey: "reliability", weight: 0.3 }],
      tips: ["کارهای برنامه‌ریزی‌شده را کامل تحویل بده", "موعد کوتاه‌مدت تعیین کن و به آن پایبند باش"],
    },
    {
      key: "focusSkill",
      label: "تمرکز حرفه‌ای",
      description: "کار عمیق و بدون حواس‌پرتی روی کارهای شغلی.",
      icon: "timer",
      tone: "blue",
      stats: [{ statKey: "focus", weight: 0.7 }, { statKey: "consistency", weight: 0.3 }],
      tips: ["جلسه‌های تمرکز منظم بگذار", "ساعات عمیق کاری را در تقویم قفل کن"],
    },
    {
      key: "reliabilitySkill",
      label: "پایبندی به تعهد",
      description: "تعهدهای برنامه‌ریزی‌شده که سر وقت تمام می‌شوند.",
      icon: "shield",
      tone: "blue",
      stats: [{ statKey: "reliability", weight: 0.7 }, { statKey: "execution", weight: 0.3 }],
      tips: ["موعد تعیین‌شده را جدی بگیر", "کارهای دیرکرد را سریع جبران کن"],
    },
    {
      key: "meetingFollowUp",
      label: "پیگیری جلسات",
      description: "دنبال‌کردن تصمیم‌ها و آیتم‌های اقدام جلسه‌ها.",
      icon: "users",
      tone: "violet",
      stats: [{ statKey: "planning", weight: 0.5 }, { statKey: "execution", weight: 0.3 }, { statKey: "consistency", weight: 0.2 }],
      tips: ["خروجی هر جلسه را به کار تبدیل کن", "آیتم‌های اقدام را در لیست کار بگذار"],
    },
    {
      key: "workflow",
      label: "مدیریت جریان کار",
      description: "جریان کاری منظم و قابل‌اعتماد در کل هفته.",
      icon: "settings",
      tone: "amber",
      stats: [{ statKey: "planning", weight: 0.4 }, { statKey: "consistency", weight: 0.3 }, { statKey: "reliability", weight: 0.3 }],
      tips: ["روتین‌های کاری ثابت بساز", "برنامه هفتگی را مرور و اصلاح کن"],
    },
  ],

  // Freelancer — Starter → Organizer → Reliable Freelancer → Project Pro → Client Workflow Expert → Workflow Master
  freelancer: [
    {
      key: "clientSkill",
      label: "مدیریت مشتری",
      description: "جریان تحویل‌ها و تعهدهای مشتری‌ها را منظم نگه‌داشتن.",
      icon: "briefcase",
      tone: "cyan",
      stats: [{ statKey: "client", weight: 0.6 }, { statKey: "consistency", weight: 0.4 }],
      tips: ["پیگیری‌های مشتری را برنامه‌ریزی کن", "تحویل‌ها را سر وقت ارسال کن"],
    },
    {
      key: "deadlineSkill",
      label: "مدیریت ضرب‌الاجل",
      description: "رسیدن به موعدهای پروژه‌ها بدون عقب‌افتادن.",
      icon: "alarm",
      tone: "rose",
      stats: [{ statKey: "deadline", weight: 0.7 }, { statKey: "execution", weight: 0.3 }],
      tips: ["موعدها را با حاشیه‌ی امن برنامه‌ریزی کن", "کارهای نزدیک به موعد را اولویت بده"],
    },
    {
      key: "projectExecution",
      label: "اجرای پروژه",
      description: "بردن پروژه‌ها و نقاط عطف به سرانجام.",
      icon: "folder",
      tone: "blue",
      stats: [{ statKey: "execution", weight: 0.6 }, { statKey: "planning", weight: 0.4 }],
      tips: ["پروژه‌ها را به نقاط عطف کوچک بشکن", "هر هفته پیشرفت پروژه را جلو ببر"],
    },
    {
      key: "deliverableSkill",
      label: "مدیریت تحویل‌دادنی‌ها",
      description: "آماده‌سازی و تحویل منظم خروجی‌های پروژه.",
      icon: "check",
      tone: "emerald",
      stats: [{ statKey: "client", weight: 0.4 }, { statKey: "execution", weight: 0.4 }, { statKey: "deadline", weight: 0.2 }],
      tips: ["چک‌لیست تحویل برای هر پروژه بساز", "کیفیت خروجی را قبل از ارسال بررسی کن"],
    },
    {
      key: "timeManagement",
      label: "مدیریت زمان",
      description: "تقسیم هوشمندانه‌ی زمان بین پروژه‌ها و مشتری‌ها.",
      icon: "calendar",
      tone: "violet",
      stats: [{ statKey: "planning", weight: 0.55 }, { statKey: "deadline", weight: 0.25 }, { statKey: "consistency", weight: 0.2 }],
      tips: ["برای هر مشتری ظرفیت هفتگی تعیین کن", "زمان عمیق کار را از جلسات جدا کن"],
    },
    {
      key: "workloadPlanning",
      label: "برنامه‌ریزی بار کاری",
      description: "برنامه‌ریزی حجم کار و بار پروژه‌های فعال.",
      icon: "settings",
      tone: "amber",
      stats: [{ statKey: "planning", weight: 0.6 }, { statKey: "consistency", weight: 0.4 }],
      tips: ["پروژه‌های فعال را در تقویم بچین", "ظرفیت اضافه برای کارهای فوری نگه دار"],
    },
  ],

  // Manager — Coordinator → Planner → Team Organizer → Project Manager → Team Strategist → Operations Master
  manager: [
    {
      key: "delegation",
      label: "واگذاری کار",
      description: "تقسیم درست کارها و پیگیری اجرای آن‌ها.",
      icon: "users",
      tone: "violet",
      stats: [{ statKey: "team", weight: 0.6 }, { statKey: "execution", weight: 0.4 }],
      tips: ["کارها را با وضوح کامل واگذار کن", "پیگیری منظم برای کارهای واگذارشده بگذار"],
    },
    {
      key: "teamPlanning",
      label: "برنامه‌ریزی تیمی",
      description: "برنامه‌ریزی کار تیم و جلسات هماهنگی.",
      icon: "calendar",
      tone: "violet",
      stats: [{ statKey: "planning", weight: 0.6 }, { statKey: "team", weight: 0.4 }],
      tips: ["جلسات تیمی را منظم برگزار کن", "برنامه هفتگی تیم را شفاف کن"],
    },
    {
      key: "workloadSkill",
      label: "مدیریت بار کاری",
      description: "توزیع متعادل کارها بین اعضای تیم.",
      icon: "settings",
      tone: "amber",
      stats: [{ statKey: "team", weight: 0.5 }, { statKey: "consistency", weight: 0.5 }],
      tips: ["بار کاری اعضا را مرور کن", "کارهای اضافه را بازتوزیع کن"],
    },
    {
      key: "projectCoord",
      label: "هماهنگی پروژه",
      description: "بردن نقاط عطف پروژه به سرانجام.",
      icon: "folder",
      tone: "blue",
      stats: [{ statKey: "projects", weight: 0.6 }, { statKey: "planning", weight: 0.4 }],
      tips: ["نقاط عطف پروژه را به‌روز نگه دار", "ریسک‌های پروژه را زود شناسایی کن"],
    },
    {
      key: "teamExecution",
      label: "اجرای تیمی",
      description: "تبدیل برنامه‌های تیم به نتیجه‌ی واقعی.",
      icon: "check",
      tone: "emerald",
      stats: [{ statKey: "execution", weight: 0.5 }, { statKey: "team", weight: 0.5 }],
      tips: ["پیشرفت کارهای تیم را دنبال کن", "موانع اجرا را سریع رفع کن"],
    },
    {
      key: "operationalPlanning",
      label: "برنامه‌ریزی عملیاتی",
      description: "برنامه‌ریزی منظم عملیات و روال‌های تیم.",
      icon: "compass",
      tone: "cyan",
      stats: [{ statKey: "planning", weight: 0.5 }, { statKey: "projects", weight: 0.3 }, { statKey: "consistency", weight: 0.2 }],
      tips: ["روال‌های تکرارشونده را استاندارد کن", "مرور هفتگی عملیات بگذار"],
    },
  ],

  // Business Owner — Builder → Organizer → Operator → Business Planner → Growth Operator → Business Strategist
  business_owner: [
    {
      key: "strategicPlanning",
      label: "برنامه‌ریزی راهبردی",
      description: "پیش بردن اهداف بلندمدت و ابتکارهای راهبردی.",
      icon: "compass",
      tone: "violet",
      stats: [{ statKey: "strategy", weight: 0.6 }, { statKey: "consistency", weight: 0.2 }, { statKey: "execution", weight: 0.2 }],
      tips: ["اهداف راهبردی را به گام‌های فصلی بشکن", "ابتکارهای فعال را مرور و اولویت کن"],
    },
    {
      key: "businessExecution",
      label: "اجرای کسب‌وکار",
      description: "اتمام اولویت‌های مهم کسب‌وکار.",
      icon: "check",
      tone: "emerald",
      stats: [{ statKey: "execution", weight: 0.6 }, { statKey: "operations", weight: 0.4 }],
      tips: ["اولویت‌های روز را قبل از شروع مشخص کن", "کارهای نیمه‌کاره را ببند"],
    },
    {
      key: "salesManagement",
      label: "مدیریت فروش",
      description: "پیش رفتن منظم فرصت‌ها و قراردادهای فروش.",
      icon: "trending",
      tone: "emerald",
      stats: [{ statKey: "sales", weight: 0.7 }, { statKey: "execution", weight: 0.3 }],
      tips: ["پیگیری فرصت‌های فروش را منظم کن", "مراحل پایپ‌لاین را به‌روز نگه دار"],
    },
    {
      key: "operationsSkill",
      label: "مدیریت عملیات",
      description: "انضباط اجرای کارهای عملیاتی روزانه.",
      icon: "settings",
      tone: "amber",
      stats: [{ statKey: "operations", weight: 0.6 }, { statKey: "consistency", weight: 0.4 }],
      tips: ["روال‌های عملیاتی را استاندارد کن", "کارهای عملیاتی معوق را پاکسازی کن"],
    },
    {
      key: "customerManagement",
      label: "مدیریت مشتریان",
      description: "نگه‌داشتن جریان منظم رابطه با مشتری‌ها.",
      icon: "briefcase",
      tone: "cyan",
      stats: [{ statKey: "sales", weight: 0.4 }, { statKey: "operations", weight: 0.3 }, { statKey: "consistency", weight: 0.3 }],
      tips: ["پیگیری با مشتریان را زمان‌بندی کن", "تعهدات مشتریان را دنبال کن"],
    },
    {
      key: "growthPlanning",
      label: "برنامه‌ریزی رشد",
      description: "طراحی و اجرای مسیرهای رشد کسب‌وکار.",
      icon: "compass",
      tone: "blue",
      stats: [{ statKey: "strategy", weight: 0.5 }, { statKey: "sales", weight: 0.3 }, { statKey: "consistency", weight: 0.2 }],
      tips: ["یک ابتکار رشد فعال داشته باش", "نتیجه‌ی ابتکارها را اندازه بگیر"],
    },
  ],

  // Personal — Starter → Organizer → Planner → Consistent Doer → Focused Builder → Personal Productivity Master
  personal: [
    {
      key: "planningSkill",
      label: "برنامه‌ریزی",
      description: "برنامه‌ریزی مؤثر زندگی و کارهای شخصی.",
      icon: "calendar",
      tone: "violet",
      stats: [{ statKey: "planning", weight: 0.6 }, { statKey: "consistency", weight: 0.4 }],
      tips: ["برنامه هفتگی شخصی بچین", "اولویت‌های روز را صبح مشخص کن"],
    },
    {
      key: "consistencySkill",
      label: "ثبات",
      description: "پایبندی منظم به روتین‌ها و تعهدهای شخصی.",
      icon: "flame",
      tone: "amber",
      stats: [{ statKey: "consistency", weight: 0.7 }, { statKey: "planning", weight: 0.3 }],
      tips: ["روتین‌های کوچک اما روزانه بساز", "عادت‌ها را هر روز علامت بزن"],
    },
    {
      key: "focusSkill",
      label: "تمرکز",
      description: "کار متمرکز و عمیق روی کارهای شخصی مهم.",
      icon: "timer",
      tone: "blue",
      stats: [{ statKey: "focus", weight: 0.7 }, { statKey: "consistency", weight: 0.3 }],
      tips: ["جلسه‌های تمرکز روزانه بگذار", "حواس‌پرتی‌ها را در زمان تمرکز قطع کن"],
    },
    {
      key: "goalExecution",
      label: "اجرای اهداف",
      description: "پیشرفت واقعی روی اهداف شخصی و گام‌هایشان.",
      icon: "target",
      tone: "rose",
      stats: [{ statKey: "goals", weight: 0.6 }, { statKey: "execution", weight: 0.4 }],
      tips: ["هر هدف را به گام‌های هفتگی بشکن", "پیشرفت اهداف را به‌روز کن"],
    },
    {
      key: "routineManagement",
      label: "مدیریت روتین",
      description: "ساختن و حفظ روتین‌های روزانه‌ی مفید.",
      icon: "flame",
      tone: "emerald",
      stats: [{ statKey: "consistency", weight: 0.6 }, { statKey: "planning", weight: 0.2 }, { statKey: "focus", weight: 0.2 }],
      tips: ["روتین‌های صبح و شب بساز", "روتین‌های بی‌اثر را حذف یا ساده کن"],
    },
    {
      key: "personalOrganization",
      label: "سازمان‌دهی شخصی",
      description: "منظم نگه‌داشتن کارها، اهداف و مسئولیت‌های شخصی.",
      icon: "folder",
      tone: "blue",
      stats: [{ statKey: "planning", weight: 0.45 }, { statKey: "consistency", weight: 0.3 }, { statKey: "goals", weight: 0.25 }],
      tips: ["لیست‌ها و اهداف را مرتب نگه دار", "مرور هفتگی وضعیت شخصی بگذار"],
    },
  ],
};

/** Aliases share the parent path. */
PERSONA_SKILLS.team = PERSONA_SKILLS.manager;
PERSONA_SKILLS.custom = PERSONA_SKILLS.personal;

/** Resolve the persona's ordered skill definitions (fallback: personal). */
export function skillsForPersona(personaKey: string): SkillDef[] {
  return PERSONA_SKILLS[personaKey] ?? PERSONA_SKILLS.personal;
}

/* ------------------------------------------------------------------ */
/* Skill progress computation (pure)                                   */
/* ------------------------------------------------------------------ */

/**
 * Weighted average of the contributing persona stats. Stats without data are
 * dropped and weights renormalized; the skill has data only if at least one
 * contributing stat has data. Mirrors the Phase 04 scoring philosophy.
 */
export function computeSkillProgress(
  def: SkillDef,
  statValue: (statKey: string) => number | null,
): { hasData: boolean; progress: number } {
  let weightSum = 0;
  let acc = 0;
  for (const { statKey, weight } of def.stats) {
    const v = statValue(statKey);
    if (v === null) continue;
    weightSum += weight;
    acc += Math.max(0, Math.min(100, v)) * weight;
  }
  if (weightSum <= 0) return { hasData: false, progress: 0 };
  return { hasData: true, progress: Math.round(acc / weightSum) };
}

/* ------------------------------------------------------------------ */
/* Evolution stages (§Evolution — persona-specific journey)             */
/* ------------------------------------------------------------------ */

export interface SkillRequirement {
  skillKey: string;
  minLevel: number;
}

export interface StatRequirement {
  statKey: string;
  min: number;
}

export interface EvolutionStage {
  key: string;
  /** Persian stage name — professional, never childish. */
  label: string;
  /** What this stage represents for the user. */
  description: string;
  /** Minimum global level (from the XP system). */
  requiredLevel: number;
  requiredSkills: SkillRequirement[];
  requiredStats: StatRequirement[];
}

export const PERSONA_EVOLUTION: Record<string, EvolutionStage[]> = {
  student: [
    { key: "new_student", label: "دانش‌آموز تازه‌کار", description: "شروع مسیر یادگیری منظم.", requiredLevel: 1, requiredSkills: [], requiredStats: [] },
    { key: "planner", label: "برنامه‌ریز", description: "برنامه‌ریزی درسی را به عادت تبدیل کرده‌ای.", requiredLevel: 2, requiredSkills: [{ skillKey: "planning", minLevel: 2 }], requiredStats: [] },
    { key: "consistent_learner", label: "یادگیرنده‌ی باثبات", description: "مطالعه‌ی منظم بخشی از روزهای تو شده است.", requiredLevel: 3, requiredSkills: [{ skillKey: "studyConsistency", minLevel: 2 }], requiredStats: [{ statKey: "consistency", min: 40 }] },
    { key: "focused_learner", label: "یادگیرنده‌ی متمرکز", description: "تمرکز عمیق روی درس‌ها را تجربه کرده‌ای.", requiredLevel: 4, requiredSkills: [{ skillKey: "focus", minLevel: 2 }, { skillKey: "studyConsistency", minLevel: 2 }], requiredStats: [] },
    { key: "exam_strategist", label: "راهبردگر امتحان", description: "آماده‌سازی امتحان را هدفمند پیش می‌بری.", requiredLevel: 6, requiredSkills: [{ skillKey: "examPrep", minLevel: 3 }, { skillKey: "planning", minLevel: 2 }], requiredStats: [] },
    { key: "study_master", label: "استاد مطالعه", description: "مسیر کامل یادگیری منظم و متمرکز را پیموده‌ای.", requiredLevel: 8, requiredSkills: [{ skillKey: "planning", minLevel: 4 }, { skillKey: "focus", minLevel: 3 }, { skillKey: "studyConsistency", minLevel: 3 }, { skillKey: "examPrep", minLevel: 3 }], requiredStats: [] },
  ],
  employee: [
    { key: "contributor", label: "مشارکت‌کننده", description: "شروع مسیر اجرای منظم کارها.", requiredLevel: 1, requiredSkills: [], requiredStats: [] },
    { key: "organizer", label: "منظم‌ساز", description: "برنامه‌ریزی کار روزانه را جدی گرفته‌ای.", requiredLevel: 2, requiredSkills: [{ skillKey: "workPlanning", minLevel: 2 }], requiredStats: [] },
    { key: "reliable_executor", label: "مجری مطمئن", description: "کارهای برنامه‌ریزی‌شده را سر وقت تحویل می‌دهی.", requiredLevel: 3, requiredSkills: [{ skillKey: "executionSkill", minLevel: 2 }, { skillKey: "reliabilitySkill", minLevel: 2 }], requiredStats: [] },
    { key: "focused_professional", label: "حرفه‌ای متمرکز", description: "کار عمیق بخشی از سبک کاری تو شده است.", requiredLevel: 4, requiredSkills: [{ skillKey: "focusSkill", minLevel: 2 }, { skillKey: "reliabilitySkill", minLevel: 2 }], requiredStats: [{ statKey: "focus", min: 40 }] },
    { key: "workflow_expert", label: "متخصص جریان کار", description: "جریان کاری منظم و قابل‌اعتماد ساخته‌ای.", requiredLevel: 6, requiredSkills: [{ skillKey: "workflow", minLevel: 3 }, { skillKey: "workPlanning", minLevel: 2 }], requiredStats: [] },
    { key: "execution_master", label: "استاد اجرا", description: "مسیر کامل اجرای حرفه‌ای و پایبند را پیموده‌ای.", requiredLevel: 8, requiredSkills: [{ skillKey: "executionSkill", minLevel: 4 }, { skillKey: "workflow", minLevel: 3 }, { skillKey: "reliabilitySkill", minLevel: 3 }], requiredStats: [] },
  ],
  freelancer: [
    { key: "starter", label: "تازه‌کار", description: "شروع مسیر حرفه‌ای فریلنسری.", requiredLevel: 1, requiredSkills: [], requiredStats: [] },
    { key: "organizer", label: "منظم‌ساز", description: "بار کاری و پروژه‌ها را منظم چیده‌ای.", requiredLevel: 2, requiredSkills: [{ skillKey: "workloadPlanning", minLevel: 2 }], requiredStats: [] },
    { key: "reliable_freelancer", label: "فریلنسر قابل‌اعتماد", description: "موعدها و تعهدهایت را جدی می‌گیری.", requiredLevel: 3, requiredSkills: [{ skillKey: "deadlineSkill", minLevel: 2 }, { skillKey: "clientSkill", minLevel: 1 }], requiredStats: [] },
    { key: "project_pro", label: "حرفه‌ای پروژه", description: "پروژه‌ها را به نقاط عطف می‌رسانی.", requiredLevel: 5, requiredSkills: [{ skillKey: "projectExecution", minLevel: 3 }, { skillKey: "deadlineSkill", minLevel: 2 }], requiredStats: [{ statKey: "deadline", min: 45 }] },
    { key: "client_workflow_expert", label: "متخصص جریان مشتری", description: "جریان کار مشتری‌ها را مسلط مدیریت می‌کنی.", requiredLevel: 6, requiredSkills: [{ skillKey: "clientSkill", minLevel: 3 }, { skillKey: "deliverableSkill", minLevel: 2 }], requiredStats: [] },
    { key: "workflow_master", label: "استاد جریان کار", description: "مسیر کامل فریلنسری منظم و قابل‌اعتماد را پیموده‌ای.", requiredLevel: 8, requiredSkills: [{ skillKey: "clientSkill", minLevel: 3 }, { skillKey: "projectExecution", minLevel: 3 }, { skillKey: "workloadPlanning", minLevel: 3 }], requiredStats: [] },
  ],
  manager: [
    { key: "coordinator", label: "هماهنگ‌کننده", description: "شروع مسیر مدیریت و هماهنگی تیم.", requiredLevel: 1, requiredSkills: [], requiredStats: [] },
    { key: "planner", label: "برنامه‌ریز", description: "برنامه‌ریزی کار تیم را نظام داده‌ای.", requiredLevel: 2, requiredSkills: [{ skillKey: "teamPlanning", minLevel: 2 }], requiredStats: [] },
    { key: "team_organizer", label: "سازمان‌دهنده‌ی تیم", description: "تقسیم کار و پیگیری را درست انجام می‌دهی.", requiredLevel: 3, requiredSkills: [{ skillKey: "delegation", minLevel: 2 }, { skillKey: "workloadSkill", minLevel: 1 }], requiredStats: [] },
    { key: "project_manager", label: "مدیر پروژه", description: "پروژه‌ها را به نقاط عطف می‌رسانی.", requiredLevel: 5, requiredSkills: [{ skillKey: "projectCoord", minLevel: 3 }, { skillKey: "teamPlanning", minLevel: 2 }], requiredStats: [{ statKey: "projects", min: 45 }] },
    { key: "team_strategist", label: "راهبردگر تیم", description: "برنامه‌های تیم را به نتیجه تبدیل می‌کنی.", requiredLevel: 6, requiredSkills: [{ skillKey: "teamExecution", minLevel: 3 }, { skillKey: "operationalPlanning", minLevel: 2 }], requiredStats: [] },
    { key: "operations_master", label: "استاد عملیات", description: "مسیر کامل مدیریت تیم و عملیات را پیموده‌ای.", requiredLevel: 8, requiredSkills: [{ skillKey: "teamPlanning", minLevel: 3 }, { skillKey: "projectCoord", minLevel: 3 }, { skillKey: "teamExecution", minLevel: 3 }], requiredStats: [] },
  ],
  business_owner: [
    { key: "builder", label: "بانی", description: "شروع مسیر ساختن کسب‌وکار منظم.", requiredLevel: 1, requiredSkills: [], requiredStats: [] },
    { key: "organizer", label: "منظم‌ساز", description: "اجرای اولویت‌های کسب‌وکار را نظام داده‌ای.", requiredLevel: 2, requiredSkills: [{ skillKey: "businessExecution", minLevel: 2 }], requiredStats: [] },
    { key: "operator", label: "اپراتور", description: "عملیات و فروش را روزمره دنبال می‌کنی.", requiredLevel: 3, requiredSkills: [{ skillKey: "operationsSkill", minLevel: 2 }, { skillKey: "salesManagement", minLevel: 1 }], requiredStats: [] },
    { key: "business_planner", label: "برنامه‌ریز کسب‌وکار", description: "اهداف راهبردی را به برنامه تبدیل کرده‌ای.", requiredLevel: 5, requiredSkills: [{ skillKey: "strategicPlanning", minLevel: 2 }, { skillKey: "operationsSkill", minLevel: 2 }], requiredStats: [] },
    { key: "growth_operator", label: "اپراتور رشد", description: "جریان فروش و مسیرهای رشد را می‌سازی.", requiredLevel: 6, requiredSkills: [{ skillKey: "salesManagement", minLevel: 3 }, { skillKey: "growthPlanning", minLevel: 2 }], requiredStats: [{ statKey: "sales", min: 45 }] },
    { key: "business_strategist", label: "راهبردگر کسب‌وکار", description: "مسیر کامل راهبرد و عملیات را پیموده‌ای.", requiredLevel: 8, requiredSkills: [{ skillKey: "strategicPlanning", minLevel: 4 }, { skillKey: "salesManagement", minLevel: 3 }, { skillKey: "operationsSkill", minLevel: 3 }], requiredStats: [] },
  ],
  personal: [
    { key: "starter", label: "تازه‌کار", description: "شروع مسیر بهره‌وری شخصی.", requiredLevel: 1, requiredSkills: [], requiredStats: [] },
    { key: "organizer", label: "منظم‌ساز", description: "برنامه‌ریزی شخصی را جدی گرفته‌ای.", requiredLevel: 2, requiredSkills: [{ skillKey: "planningSkill", minLevel: 2 }], requiredStats: [] },
    { key: "planner", label: "برنامه‌ریز", description: "برنامه و روتین‌های شخصی داری.", requiredLevel: 3, requiredSkills: [{ skillKey: "planningSkill", minLevel: 2 }, { skillKey: "routineManagement", minLevel: 1 }], requiredStats: [] },
    { key: "consistent_doer", label: "انجام‌دهنده‌ی باثبات", description: "پایبندی منظم بخشی از زندگی تو شده است.", requiredLevel: 4, requiredSkills: [{ skillKey: "consistencySkill", minLevel: 3 }, { skillKey: "goalExecution", minLevel: 2 }], requiredStats: [{ statKey: "consistency", min: 45 }] },
    { key: "focused_builder", label: "سازنده‌ی متمرکز", description: "تمرکز عمیق را برای ساختن چیزهای مهم داری.", requiredLevel: 6, requiredSkills: [{ skillKey: "focusSkill", minLevel: 3 }, { skillKey: "consistencySkill", minLevel: 2 }], requiredStats: [] },
    { key: "productivity_master", label: "استاد بهره‌وری شخصی", description: "مسیر کامل بهره‌وری شخصی را پیموده‌ای.", requiredLevel: 8, requiredSkills: [{ skillKey: "planningSkill", minLevel: 4 }, { skillKey: "consistencySkill", minLevel: 3 }, { skillKey: "focusSkill", minLevel: 3 }, { skillKey: "goalExecution", minLevel: 3 }], requiredStats: [] },
  ],
};

/** Resolve the persona's evolution stages (fallback: personal). */
export function evolutionForPersona(personaKey: string): EvolutionStage[] {
  return PERSONA_EVOLUTION[personaKey] ?? PERSONA_EVOLUTION.personal;
}

/* ------------------------------------------------------------------ */
/* Stage evaluation (pure)                                             */
/* ------------------------------------------------------------------ */

export interface EvolutionContext {
  level: number;
  /** skillKey → current level. */
  skillLevels: Record<string, number>;
  /** statKey → current value or null (no data). */
  statValue: (statKey: string) => number | null;
}

/** True when every requirement of the stage is satisfied. */
export function stageMet(stage: EvolutionStage, ctx: EvolutionContext): boolean {
  if (ctx.level < stage.requiredLevel) return false;
  for (const req of stage.requiredSkills) {
    if ((ctx.skillLevels[req.skillKey] ?? 0) < req.minLevel) return false;
  }
  for (const req of stage.requiredStats) {
    const v = ctx.statValue(req.statKey);
    if (v === null || v < req.min) return false;
  }
  return true;
}

/** Index of the highest satisfied stage (stage 0 always satisfies). */
export function evolutionStageIndex(stages: EvolutionStage[], ctx: EvolutionContext): number {
  let current = 0;
  for (let i = stages.length - 1; i > 0; i--) {
    if (stageMet(stages[i], ctx)) {
      current = i;
      break;
    }
  }
  return current;
}

/** Compact Persian summary of a stage's requirements, for the UI. */
export function stageRequirementsText(
  stage: EvolutionStage,
  skillLabel: (skillKey: string) => string,
  statLabel: (statKey: string) => string,
): string[] {
  const parts: string[] = [];
  if (stage.requiredLevel > 1) parts.push(`سطح ${faNum(stage.requiredLevel)}`);
  for (const r of stage.requiredSkills) {
    parts.push(`${skillLabel(r.skillKey)} سطح ${faNum(r.minLevel)}`);
  }
  for (const r of stage.requiredStats) {
    parts.push(`آمار «${statLabel(r.statKey)}» دست‌کم ${faNum(r.min)}`);
  }
  return parts;
}

/* ------------------------------------------------------------------ */
/* Shared copy                                                         */
/* ------------------------------------------------------------------ */

export const SKILLS_EMPTY_STATE = "با انجام کارهای واقعی، مسیر مهارت‌هایت شکل می‌گیرد";
export const SKILLS_NO_DATA = "هنوز داده کافی نداریم";
export const SKILL_MAXED = "بیشینه";
