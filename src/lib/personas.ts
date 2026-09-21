/**
 * Personalization foundation — Phase 1.
 *
 * This module is the single source of truth for:
 *  - user personas and their display data
 *  - the dashboard widget registry (data-driven, not hard-coded)
 *  - per-persona recommended dashboard configurations
 *  - onboarding question templates (for future persona onboarding)
 *
 * Design rules (Phase 1):
 *  - Additive only: nothing here removes or replaces existing UI.
 *  - The catalog is data; the app renders whatever it is given.
 *  - The persona NEVER restricts access to core productivity features —
 *    it only influences recommended defaults (visibility + order).
 *  - The same Task/Project data is presented differently per persona;
 *    core data never becomes persona-specific at the database level.
 *
 * Future phases can add new personas/widgets by editing data here —
 * no product rewrite, no migration.
 */

/* ------------------------------------------------------------------ */
/* Persona model                                                       */
/* ------------------------------------------------------------------ */

export const PERSONA_KEYS = [
  "student",
  "employee",
  "freelancer",
  "business_owner",
  "manager",
  "team",
  "personal",
  "custom",
] as const;

export type PersonaKey = (typeof PERSONA_KEYS)[number];

export interface PersonaMeta {
  key: PersonaKey;
  /** Persian display label. */
  label: string;
  /** Short Persian description used in pickers. */
  description: string;
  /** Emoji used as an icon (no new icon deps). */
  emoji: string;
}

/** Static persona catalog (no per-user state). */
export const PERSONAS: PersonaMeta[] = [
  {
    key: "student",
    label: "دانش‌آموز / دانشجو",
    description: "درس، امتحان، پروژه درسی و برنامه مطالعه",
    emoji: "🎓",
  },
  {
    key: "employee",
    label: "کارمند",
    description: "جلسات، کارهای روزانه و ضرب‌الاجل‌های سازمانی",
    emoji: "💼",
  },
  {
    key: "freelancer",
    label: "فریلنسر",
    description: "چند مشتری، پروژه‌های موازی و ضرب‌الاجل‌ها",
    emoji: "🧑‍💻",
  },
  {
    key: "business_owner",
    label: "صاحب کسب‌وکار",
    description: "مدیریت کسب‌وکار، تیم و پروژه‌های در جریان",
    emoji: "🏪",
  },
  {
    key: "manager",
    label: "مدیر",
    description: "دید کلی تیم، بار کاری و سلامت پروژه‌ها",
    emoji: "🧭",
  },
  {
    key: "team",
    label: "تیمی / سازمانی",
    description: "هماهنگی کار گروهی و پروژه‌های مشترک",
    emoji: "🤝",
  },
  {
    key: "personal",
    label: "بهره‌وری شخصی",
    description: "نظم روزمره، عادت‌ها و اهداف شخصی",
    emoji: "🌱",
  },
  {
    key: "custom",
    label: "سفارشی",
    description: "ترکیبی دلخواه از امکانات پلتفرم",
    emoji: "🧩",
  },
];

export function personaMeta(key: string): PersonaMeta {
  return PERSONAS.find((p) => p.key === key) ?? PERSONAS[6]; // personal
}

/**
 * Map the legacy onboarding goal keys (focus / study / work / life) onto the
 * closest persona, so existing onboarding choices produce sensible defaults
 * without a new UI flow. Returns the full PersonaKey.
 */
export function personaKeyFromGoal(goal: string | null): PersonaKey {
  switch (goal) {
    case "study":
      return "student";
    case "work":
      return "employee";
    case "life":
      return "personal";
    case "focus":
      return "personal";
    default:
      return "personal";
  }
}

/* ------------------------------------------------------------------ */
/* Dashboard widget registry                                           */
/* ------------------------------------------------------------------ */

/**
 * Every widget the dashboard can render, independent of any persona.
 * `exists: false` marks widgets declared for future phases; their UI
 * ships later, but the configuration model supports them already.
 */
export interface WidgetDef {
  key: string;
  /** Persian label for future settings/onboarding UI. */
  label: string;
  description: string;
  /** Whether the widget's UI already ships in the current dashboard. */
  exists: boolean;
}

export const WIDGETS: WidgetDef[] = [
  { key: "today-overview", label: "نمای کلی امروز", description: "درصد تکمیل و شمارنده‌های امروز", exists: true },
  { key: "quick-add", label: "افزودن سریع", description: "ساخت سریع کار جدید", exists: true },
  { key: "today-tasks", label: "کارهای امروز", description: "فهرست کارهای امروز", exists: true },
  { key: "overdue", label: "عقب‌افتاده‌ها", description: "کارهای گذشته‌ای که انجام نشده‌اند", exists: true },
  { key: "next-up", label: "پیشنهاد بعدی", description: "کارهای بدون تاریخ یا آینده", exists: true },
  { key: "progress-snapshot", label: "نمای پیشرفت", description: "سطح، XP و زنجیره روزها", exists: true },
  { key: "routines", label: "روتین‌های امروز", description: "برنامه‌های تکرارشونده امروز", exists: true },
  { key: "growth-paths", label: "مسیرهای رشد", description: "مسیرهای فعال رشد", exists: true },
  { key: "projects", label: "پروژه‌های فعال", description: "وضعیت پروژه‌های فعال", exists: true },
  { key: "deadlines", label: "ضرب‌الاجل‌ها", description: "نزدیک‌ترین ضرب‌الاجل پروژه‌ها", exists: false },
  { key: "study-progress", label: "پیشرفت درس", description: "پیشرفت دروس و آماده‌سازی امتحان", exists: false },
  { key: "client-projects", label: "پروژه‌های مشتریان", description: "پروژه‌های فعال هر مشتری", exists: false },
  { key: "team-overview", label: "نمای تیم", description: "بار کاری و وضعیت اعضای تیم", exists: false },
  { key: "focus-timer", label: "تایمر تمرکز", description: "جلسات پومودورو / تمرکز", exists: false },
  { key: "goals", label: "اهداف", description: "اهداف بلندمدت و پیشرفتشان", exists: false },
];

export function widgetDef(key: string): WidgetDef | undefined {
  return WIDGETS.find((w) => w.key === key);
}

/* ------------------------------------------------------------------ */
/* Dashboard configuration model                                       */
/* ------------------------------------------------------------------ */

/** One row of a dashboard layout: which widget, visible or not, and order. */
export interface WidgetConfigRow {
  widget: string; // WidgetDef.key
  visible: boolean;
  /** Higher = earlier in the flow (stable sort, descending). */
  priority: number;
}

export interface DashboardConfig {
  version: 1;
  rows: WidgetConfigRow[];
}

/** Ordered rows for a persona-recommended dashboard. */
function rowsOf(...keys: string[]): DashboardConfig {
  return {
    version: 1,
    rows: keys.map((widget, i) => ({
      widget,
      visible: true,
      priority: keys.length - i,
    })),
  };
}

/**
 * Per-persona recommended configurations. These are DEFAULTS, not prisons:
 * the user (or a future phase) can hide/reorder rows per user.
 *
 * Order follows the existing Dashboard flow:
 * greeting → overview → quick add → task lists → progress → routines →
 * paths → projects.
 */
export const RECOMMENDED_DASHBOARDS: Record<PersonaKey, DashboardConfig> = {
  student: rowsOf(
    "today-overview",
    "quick-add",
    "today-tasks",
    "deadlines",
    "overdue",
    "routines",
    "progress-snapshot",
    "next-up",
    "growth-paths",
    "projects",
  ),
  employee: rowsOf(
    "today-overview",
    "quick-add",
    "today-tasks",
    "deadlines",
    "overdue",
    "routines",
    "progress-snapshot",
    "next-up",
    "growth-paths",
    "projects",
  ),
  freelancer: rowsOf(
    "today-overview",
    "quick-add",
    "today-tasks",
    "deadlines",
    "overdue",
    "routines",
    "progress-snapshot",
    "next-up",
    "growth-paths",
    "projects",
  ),
  business_owner: rowsOf(
    "today-overview",
    "quick-add",
    "today-tasks",
    "deadlines",
    "overdue",
    "progress-snapshot",
    "routines",
    "next-up",
    "growth-paths",
    "projects",
  ),
  manager: rowsOf(
    "today-overview",
    "quick-add",
    "today-tasks",
    "deadlines",
    "overdue",
    "progress-snapshot",
    "routines",
    "next-up",
    "growth-paths",
    "projects",
  ),
  team: rowsOf(
    "today-overview",
    "quick-add",
    "today-tasks",
    "deadlines",
    "overdue",
    "progress-snapshot",
    "routines",
    "next-up",
    "growth-paths",
    "projects",
  ),
  personal: rowsOf(
    "today-overview",
    "quick-add",
    "today-tasks",
    "overdue",
    "next-up",
    "routines",
    "progress-snapshot",
    "growth-paths",
    "projects",
  ),
  custom: rowsOf(
    "today-overview",
    "quick-add",
    "today-tasks",
    "overdue",
    "next-up",
    "progress-snapshot",
    "routines",
    "growth-paths",
    "projects",
  ),
};

/* ------------------------------------------------------------------ */
/* Onboarding question templates (Phase 2+ will render these)          */
/* ------------------------------------------------------------------ */

export type OnboardingQuestionKind = "single" | "multi" | "text" | "number";

export interface OnboardingQuestionOption {
  key: string;
  label: string;
  description?: string;
}

export interface OnboardingQuestion {
  id: string;
  kind: OnboardingQuestionKind;
  /** Persian prompt shown to the user. */
  prompt: string;
  helper?: string;
  options?: OnboardingQuestionOption[];
  /** Personas this question applies to ("all" = every persona). */
  personas: PersonaKey[] | "all";
  /** Where the answer is stored (future schema path, documentation only). */
  stores: string;
}

/**
 * Declared, not yet rendered. Phase 2 onboarding will walk the user through
 * the persona question plus every question matching the chosen persona.
 */
export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    id: "persona",
    kind: "single",
    prompt: "بیشتر از این پلتفرم برای چه استفاده می‌کنی؟",
    helper: "داشبورد و پیشنهادها را متناسب با انتخابت مرتب می‌کنیم. بعداً قابل تغییر است.",
    options: PERSONAS.map((p) => ({ key: p.key, label: p.label, description: p.description })),
    personas: "all",
    stores: "userProfile.persona.key",
  },
  {
    id: "goals",
    kind: "multi",
    prompt: "مهم‌ترین اهدافت کدام‌اند؟",
    options: [
      { key: "focus", label: "تمرکز روزانه" },
      { key: "study", label: "درس و مطالعه" },
      { key: "work", label: "مدیریت کار و پروژه" },
      { key: "life", label: "زندگی شخصی و عادت‌ها" },
      { key: "business", label: "رشد کسب‌وکار" },
      { key: "teamwork", label: "هماهنگی تیم" },
    ],
    personas: "all",
    stores: "userProfile.goals[]",
  },
  {
    id: "planning_style",
    kind: "single",
    prompt: "برنامه‌ریزی‌ات را بیشتر چطور دوست داری؟",
    options: [
      { key: "daily", label: "روزانه", description: "برنامه‌ی روز را صبح می‌چینم" },
      { key: "weekly", label: "هفتگی", description: "هفته را یک‌جا می‌چینم" },
      { key: "mixed", label: "ترکیبی", description: "هم روز، هم هفته" },
    ],
    personas: "all",
    stores: "userProfile.preferences.planningStyle",
  },
  {
    id: "student_field",
    kind: "text",
    prompt: "رشته تحصیلی‌ات چیست؟",
    personas: ["student"],
    stores: "userProfile.persona.details.field",
  },
  {
    id: "student_courses",
    kind: "number",
    prompt: "چند درس در ترم داری؟",
    personas: ["student"],
    stores: "userProfile.persona.details.courseCount",
  },
  {
    id: "employee_hours",
    kind: "text",
    prompt: "ساعات کاری‌ات معمولاً چطور است؟",
    personas: ["employee", "manager"],
    stores: "userProfile.persona.details.workHours",
  },
  {
    id: "freelancer_clients",
    kind: "number",
    prompt: "چند مشتری فعال داری؟",
    personas: ["freelancer"],
    stores: "userProfile.persona.details.clientCount",
  },
  {
    id: "team_size",
    kind: "number",
    prompt: "تعداد اعضای تیم؟",
    personas: ["manager", "business_owner", "team"],
    stores: "userProfile.persona.details.teamSize",
  },
];

/** Questions that apply to a given persona (in catalog order). */
export function questionsForPersona(key: PersonaKey): OnboardingQuestion[] {
  return ONBOARDING_QUESTIONS.filter(
    (q) => q.personas === "all" || q.personas.includes(key),
  );
}
