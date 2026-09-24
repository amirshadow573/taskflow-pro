/**
 * Unlocks / Capabilities — Phase 08 (pure config, no Convex/React imports).
 *
 * Philosophy: "Simple Surface, Powerful Core."
 *
 *   XP / Level → Stats → Skills → Quests → Achievements → Evolution
 *                                              ↓
 *                                    Unlock conditions → Capabilities
 *
 * CORE vs ADVANCED
 *  - CORE (never gated): tasks, projects, calendar, goals, planning,
 *    dashboard, search, notifications, settings, essential persona
 *    workspace functionality. This catalog must NEVER point at them.
 *  - ADVANCED (gatable): deep analytics, comparative reporting, review
 *    centers — optional capabilities that become useful after real use.
 *
 * Design rules:
 *  - Everything here is DATA. Adding an unlock, requirement or persona is a
 *    config change; the service (unlocks.ts) and the UI never hard-code rules.
 *  - Every unlock MUST point to a real capability that exists in the product.
 *    Never register an empty/future module just to fill the catalog.
 *  - Requirements are evaluated against EXISTING systems only (progress,
 *    personaStats, userSkills, achievementUnlocks, userQuests, userEvolution)
 *    — no parallel counters, no duplicate engines.
 *  - `personas` keeps the surface persona-aware: irrelevant capabilities are
 *    never shown, their requirements never generated.
 */
import { achievementMeta } from "./progression";
import { GENERIC_QUESTS, PERSONA_QUESTS } from "./questRules";
import { STAT_CATALOG, faNum } from "./statRules";
import { evolutionForPersona, skillsForPersona } from "./skillRules";

/* ------------------------------------------------------------------ */
/* Categories — Phase 08 of the product roadmap                        */
/* ------------------------------------------------------------------ */

export type UnlockCategory =
  | "planning"
  | "focus"
  | "analytics"
  | "goals"
  | "projects"
  | "calendar"
  | "reviews"
  | "personalization"
  | "persona";

/** Small, stable category set — new categories are a deliberate change. */
export const UNLOCK_CATEGORIES: Record<UnlockCategory, { label: string }> = {
  planning: { label: "برنامه‌ریزی" },
  focus: { label: "تمرکز" },
  analytics: { label: "تحلیل و گزارش" },
  goals: { label: "اهداف" },
  projects: { label: "پروژه‌ها" },
  calendar: { label: "تقویم" },
  reviews: { label: "مرور و بازبینی" },
  personalization: { label: "شخصی‌سازی" },
  persona: { label: "مخصوص فضای کاری" },
};

/* ------------------------------------------------------------------ */
/* Requirements                                                        */
/* ------------------------------------------------------------------ */

/**
 * Requirement types — each maps onto an EXISTING progression system:
 *  - level / xp       → XP & Level system        (progress table)
 *  - stat             → Persona Stats            (personaStats table)
 *  - skill            → Skill Tree               (userSkills table)
 *  - achievement      → Achievements             (achievementUnlocks table)
 *  - quest            → Quests                   (userQuests table)
 *  - evolution        → Evolution stages          (userEvolution table)
 *  - dependency       → another unlock (order-safe)
 */
export type UnlockRequirement =
  | { type: "level"; min: number }
  | { type: "xp"; min: number }
  | { type: "stat"; statKey: string; min: number }
  | { type: "skill"; skillKey: string; minLevel: number }
  | { type: "achievement"; key: string }
  | { type: "quest"; key: string; minCount?: number }
  | { type: "evolution"; minStageIndex: number }
  | { type: "dependency"; unlockKey: string };

export type UnlockTone = "blue" | "violet" | "emerald" | "amber" | "rose" | "cyan" | "slate";

/* ------------------------------------------------------------------ */
/* Unlock definitions                                                  */
/* ------------------------------------------------------------------ */

export interface UnlockDef {
  key: string;
  /** Persian display name. */
  label: string;
  /** What this capability gives the user, in plain language. */
  description: string;
  /** Icon token resolved by the UI (lucide name). */
  icon: string;
  tone: UnlockTone;
  category: UnlockCategory;
  /** "all" or an explicit persona allow-list (persona-aware surface). */
  personas: string[] | "all";
  /** Feature/module identifier used by the capability access service. */
  featureKey: string;
  /** ALL of these must be met (AND). */
  requirements: UnlockRequirement[];
  /** Optional group where at least ONE must be met (OR). Counts as 1 item. */
  anyOf?: UnlockRequirement[];
  /** Display/evaluation order — dependencies must sort before dependants. */
  order: number;
  /** Inactive defs are registered but hidden everywhere. */
  active: boolean;
}

/**
 * The v1 catalog — every entry maps to a capability that EXISTS today:
 *
 *  analytics        → /analytics advanced analytics route (all personas)
 *  leaderboard      → XP leaderboard tab inside «پیشرفت من» (all personas)
 *  study_analytics  → «تحلیل مطالعه» module in the Student workspace
 *  work_analytics   → «تحلیل» module in the Employee workspace
 *  client_analytics → «تحلیل» module in the Freelancer workspace
 *  team_analytics   → «تحلیل تیم» module in the Manager workspace
 *  business_analytics → «تحلیل» tab in the Business Owner workspace
 *  review_center    → «مرور» (review center) in the Personal workspace
 *
 * Future phases register new entries here — no service/UI changes needed.
 */
export const UNLOCKS: UnlockDef[] = [
  {
    key: "analytics",
    label: "تحلیل پیشرفته",
    description:
      "روند تکمیل کارها، عادت‌های هفتگی و نقاط ضعف زمان‌بندی را با نمودارهای عمیق ببین.",
    icon: "LineChart",
    tone: "blue",
    category: "analytics",
    personas: "all",
    featureKey: "analytics",
    requirements: [{ type: "level", min: 2 }, { type: "xp", min: 250 }],
    order: 10,
    active: true,
  },
  {
    key: "leaderboard",
    label: "رده‌بندی و مقایسه",
    description:
      "جایگاهت را در میان کاربران بر اساس XP واقعی ببین و رشد هفتگی‌ات را مقایسه کن.",
    icon: "Users",
    tone: "violet",
    category: "analytics",
    personas: "all",
    featureKey: "leaderboard",
    requirements: [{ type: "level", min: 2 }],
    anyOf: [
      { type: "achievement", key: "streak_7" },
      { type: "xp", min: 400 },
    ],
    order: 20,
    active: true,
  },
  {
    key: "study_analytics",
    label: "تحلیل مطالعه",
    description:
      "الگوی مطالعه، جلسه‌های تمرکز و پیشرفت درسی‌ات را در یک نمای تحلیلی ببین.",
    icon: "GraduationCap",
    tone: "cyan",
    category: "analytics",
    personas: ["student"],
    featureKey: "study_analytics",
    requirements: [
      { type: "dependency", unlockKey: "analytics" },
      { type: "level", min: 3 },
      { type: "stat", statKey: "study", min: 30 },
    ],
    order: 30,
    active: true,
  },
  {
    key: "work_analytics",
    label: "تحلیل بهره‌وری کاری",
    description:
      "نحوه اجرای کارها، پایبندی به تعهد و تمرکز حرفه‌ای‌ات را با نمودار بسنج.",
    icon: "Briefcase",
    tone: "blue",
    category: "analytics",
    personas: ["employee"],
    featureKey: "work_analytics",
    requirements: [
      { type: "dependency", unlockKey: "analytics" },
      { type: "level", min: 3 },
    ],
    anyOf: [
      { type: "stat", statKey: "reliability", min: 30 },
      { type: "skill", skillKey: "executionSkill", minLevel: 2 },
    ],
    order: 30,
    active: true,
  },
  {
    key: "client_analytics",
    label: "تحلیل درآمد و زمان",
    description:
      "روند تحویل‌ها، ضرب‌الاجل‌ها و زمان صرف‌شده روی پروژه‌ها را تحلیل کن.",
    icon: "Timer",
    tone: "emerald",
    category: "analytics",
    personas: ["freelancer"],
    featureKey: "client_analytics",
    requirements: [
      { type: "dependency", unlockKey: "analytics" },
      { type: "level", min: 3 },
      { type: "stat", statKey: "deadline", min: 30 },
    ],
    order: 30,
    active: true,
  },
  {
    key: "team_analytics",
    label: "تحلیل تیم",
    description:
      "بار کاری اعما، روند تحویل پروژه‌ها و سلامت کلی تیم را در یک نما ببین.",
    icon: "UsersRound",
    tone: "violet",
    category: "analytics",
    personas: ["manager", "team"],
    featureKey: "team_analytics",
    requirements: [
      { type: "dependency", unlockKey: "analytics" },
      { type: "level", min: 3 },
      { type: "stat", statKey: "team", min: 30 },
    ],
    order: 30,
    active: true,
  },
  {
    key: "business_analytics",
    label: "تحلیل کسب‌وکار",
    description:
      "درآمد، هزینه، فروش و اهداف را در کنار هم تحلیل کن و روند رشد را ببین.",
    icon: "Building2",
    tone: "amber",
    category: "analytics",
    personas: ["business_owner"],
    featureKey: "business_analytics",
    requirements: [
      { type: "dependency", unlockKey: "analytics" },
      { type: "level", min: 3 },
      { type: "stat", statKey: "operations", min: 30 },
    ],
    order: 30,
    active: true,
  },
  {
    key: "review_center",
    label: "مرکز مرور هفتگی",
    description:
      "هر هفته کارنامه‌ات را مرور کن: چه خوب پیش رفت، چه ماند و هفته بعد روی چه تمرکز کنی.",
    icon: "ClipboardCheck",
    tone: "emerald",
    category: "reviews",
    personas: ["personal", "custom"],
    featureKey: "review_center",
    requirements: [
      { type: "level", min: 2 },
      { type: "evolution", minStageIndex: 1 },
    ],
    order: 40,
    active: true,
  },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function resolveUnlock(key: string): UnlockDef | undefined {
  return UNLOCKS.find((u) => u.key === key);
}

/** Persona-eligible, active unlocks in evaluation order. */
export function unlocksForPersona(personaKey: string): UnlockDef[] {
  return UNLOCKS.filter(
    (u) =>
      u.active &&
      (u.personas === "all" || u.personas.includes(personaKey)),
  ).sort((a, b) => a.order - b.order);
}

export function unlockEligible(def: UnlockDef, personaKey: string): boolean {
  return def.personas === "all" || def.personas.includes(personaKey);
}

function questTitle(key: string, personaKey: string): string {
  const all = [...GENERIC_QUESTS, ...(PERSONA_QUESTS[personaKey] ?? []), ...(PERSONA_QUESTS.all ?? [])];
  return all.find((q) => q.key === key)?.title ?? key;
}

/**
 * Human, Persian explanation of a single requirement — used in unlock cards
 * and locked-state copy so the user always knows WHY something is locked and
 * WHAT to do about it.
 */
export function requirementText(req: UnlockRequirement, personaKey: string): string {
  switch (req.type) {
    case "level":
      return `به سطح ${faNum(req.min)} برسی`;
    case "xp":
      return `${faNum(req.min)} XP کسب کنی`;
    case "stat":
      return `«${STAT_CATALOG[req.statKey]?.label ?? req.statKey}» به ${faNum(req.min)} برسد`;
    case "skill": {
      const skill = skillsForPersona(personaKey).find((s) => s.key === req.skillKey);
      return `مهارت «${skill?.label ?? req.skillKey}» به سطح ${faNum(req.minLevel)}`;
    }
    case "achievement":
      return `دستاورد «${achievementMeta(req.key)?.title ?? req.key}» را بگیری`;
    case "quest":
      return `ماموریت «${questTitle(req.key, personaKey)}» را کامل کنی`;
    case "evolution": {
      const stage = evolutionForPersona(personaKey)[req.minStageIndex];
      return stage
        ? `به مرحله «${stage.label}» برسی`
        : `مرحله تکامل ${faNum(req.minStageIndex + 1)} را بپیمایی`;
    }
    case "dependency": {
      const dep = resolveUnlock(req.unlockKey);
      return `قابلیت «${dep?.label ?? req.unlockKey}» باز شده باشد`;
    }
  }
}
