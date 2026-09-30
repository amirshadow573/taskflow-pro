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

/* ------------------------------------------------------------------ */
/* Phase 2 — persona-adaptive onboarding catalog                       */
/* ------------------------------------------------------------------ */

/**
 * The 7 onboarding persona choices ("manager" and "team" merge into one
 * management card per the Phase 2 spec). "custom" covers "سایر".
 */
export const ONBOARDING_PERSONAS: PersonaMeta[] = [
  PERSONAS[0], // student
  PERSONAS[1], // employee
  PERSONAS[2], // freelancer
  PERSONAS[3], // business_owner
  {
    key: "manager",
    label: "مدیر / تیم",
    description: "مدیریت تیم، تقسیم کار و پیگیری پروژه‌ها",
    emoji: "👥",
  },
  PERSONAS[6], // personal
  PERSONAS[7], // custom (سایر)
];

/** One selectable goal in the onboarding (persona-adaptive). */
export interface GoalOption {
  key: string;
  label: string;
  description: string;
  /** lucide icon name resolved by OnboardingFlow (keeps this file UI-free). */
  icon: string;
}

/** Persian RTL goal catalogs — intentionally different per persona. */
export const GOALS_BY_PERSONA: Record<PersonaKey, GoalOption[]> = {
  student: [
    { key: "study_plan", label: "برنامه‌ریزی مطالعه", description: "برنامه منظم و قابل اجرا برای درس‌ها", icon: "book" },
    { key: "exam_prep", label: "آماده‌سازی امتحان", description: "برنامه‌ریزی برای آزمون‌ها و پایان ترم", icon: "target" },
    { key: "assignments", label: "مدیریت تکالیف", description: "پیگیری پروژه‌ها و تمرین‌های درسی", icon: "list" },
    { key: "focus", label: "تمرکز", description: "مطالعه عمیق بدون حواس‌پرتی", icon: "target" },
    { key: "consistency", label: "استمرار", description: "مطالعه روزانه و پیوسته", icon: "calendar" },
    { key: "academic", label: "اهداف درسی", description: "معدل، ترم و پیشرفت تحصیلی", icon: "flag" },
  ],
  employee: [
    { key: "task_mgmt", label: "مدیریت کارها", description: "نظم در کارهای روزانه", icon: "list" },
    { key: "time_mgmt", label: "مدیریت زمان", description: "استفاده بهتر از ساعت‌های کاری", icon: "clock" },
    { key: "focus", label: "تمرکز", description: "تمرکز روی کارهای مهم", icon: "target" },
    { key: "meetings", label: "جلسات", description: "مدیریت قرارها و جلسات", icon: "calendar" },
    { key: "deadlines", label: "ضرب‌الاجل‌ها", description: "رسیدن به موعدها بدون استرس", icon: "flag" },
    { key: "projects", label: "مدیریت پروژه", description: "سازمان‌دهی پروژه‌های سازمانی", icon: "folder" },
  ],
  freelancer: [
    { key: "projects", label: "مدیریت پروژه", description: "پروژه‌های موازی و تحویل‌ها", icon: "folder" },
    { key: "client_deadlines", label: "ضرب‌الاجل مشتری", description: "رسیدن به موعدهای توافق‌شده", icon: "clock" },
    { key: "time_tracking", label: "ثبت زمان", description: "آگاهی از زمان صرف‌شده هر کار", icon: "clock" },
    { key: "client_org", label: "سازمان‌دهی مشتریان", description: "کارها و پروژه هر مشتری", icon: "list" },
    { key: "delivery", label: "تحویل پروژه", description: "تحویل با کیفیت و به‌موقع", icon: "flag" },
    { key: "personal", label: "اهداف شخصی", description: "تعادل کار و زندگی", icon: "target" },
  ],
  business_owner: [
    { key: "team_mgmt", label: "مدیریت تیم", description: "تقسیم کار و پیگیری اعضا", icon: "users" },
    { key: "projects", label: "مدیریت پروژه", description: "پروژه‌های در جریان کسب‌وکار", icon: "folder" },
    { key: "deadlines", label: "ضرب‌الاجل‌ها", description: "موعدهای مهم کسب‌وکار", icon: "flag" },
    { key: "workload", label: "بار کاری", description: "تعادل بار تیم و منابع", icon: "users" },
    { key: "team_goals", label: "اهداف تیمی", description: "برنامه‌های تیم را به نتیجه برسانم", icon: "target" },
    { key: "business_goals", label: "اهداف کسب‌وکار", description: "رشد و توسعه کسب‌وکار", icon: "flag" },
  ],
  manager: [
    { key: "team_mgmt", label: "مدیریت تیم", description: "تقسیم کار و پیگیری اعضا", icon: "users" },
    { key: "projects", label: "مدیریت پروژه", description: "سلامت پروژه‌های تیم", icon: "folder" },
    { key: "deadlines", label: "ضرب‌الاجل‌ها", description: "موعدهای مهم تیم", icon: "flag" },
    { key: "workload", label: "بار کاری", description: "تعادل بار تیم و منابع", icon: "users" },
    { key: "team_goals", label: "اهداف تیمی", description: "برنامه‌های تیم را به نتیجه برسانم", icon: "target" },
    { key: "business_goals", label: "اهداف کسب‌وکار", description: "اهداف سازمانی بلندمدت", icon: "flag" },
  ],
  team: [
    { key: "team_mgmt", label: "هماهنگی تیم", description: "تقسیم کار و پیگیری مشترک", icon: "users" },
    { key: "projects", label: "پروژه‌های مشترک", description: "کارهای تیمی و پروژه‌ها", icon: "folder" },
    { key: "deadlines", label: "ضرب‌الاجل‌ها", description: "موعدهای مشترک تیمی", icon: "flag" },
    { key: "workload", label: "بار کاری", description: "تعادل بار کاری اعضا", icon: "users" },
    { key: "team_goals", label: "اهداف تیمی", description: "اهداف مشترک تیم", icon: "target" },
    { key: "business_goals", label: "اهداف سازمانی", description: "اهداف کل سازمان", icon: "flag" },
  ],
  personal: [
    { key: "daily_tasks", label: "کارهای روزانه", description: "نظم کارهای هر روز", icon: "list" },
    { key: "habits", label: "عادت‌ها", description: "ساخت عادت‌های پایدار", icon: "calendar" },
    { key: "focus", label: "تمرکز", description: "تمرکز عمیق روزانه", icon: "target" },
    { key: "life_org", label: "نظم زندگی", description: "کارهای شخصی و روزمره", icon: "list" },
    { key: "personal_goals", label: "اهداف شخصی", description: "اهداف بلندمدت خودم", icon: "flag" },
    { key: "consistency", label: "استمرار", description: "پیوستگی روزانه", icon: "calendar" },
  ],
  custom: [
    { key: "daily_tasks", label: "کارهای روزانه", description: "نظم کارهای هر روز", icon: "list" },
    { key: "focus", label: "تمرکز", description: "تمرکز روی کارهای مهم", icon: "target" },
    { key: "projects", label: "مدیریت پروژه", description: "سازمان‌دهی پروژه‌ها", icon: "folder" },
    { key: "goals", label: "اهداف", description: "پیگیری اهدافم", icon: "flag" },
  ],
};

/* ------------------------------ Work style ------------------------------ */

/** Planning cadence (Step 4a). */
export const PLANNING_STYLES = [
  { key: "daily", label: "روزانه", description: "برنامه هر روز را صبح می‌چینم", icon: "calendar" },
  { key: "weekly", label: "هفتگی", description: "هفته را یک‌جا برنامه‌ریزی می‌کنم", icon: "calendar" },
  { key: "project_based", label: "پروژه‌محور", description: "دور هر پروژه سازمان می‌گیرم", icon: "folder" },
  { key: "time_based", label: "زمان‌محور", description: "بلوک‌های زمانی مشخص دارم", icon: "clock" },
  { key: "flexible", label: "منعطف", description: "بسته به روز تصمیم می‌گیرم", icon: "sparkles" },
  { key: "hybrid", label: "ترکیبی", description: "ترکیبی از روش‌های بالا", icon: "sparkles" },
] as const;

export type PlanningStyleKey = (typeof PLANNING_STYLES)[number]["key"];

/** Productivity preference (Step 4b). */
export const PRODUCTIVITY_STYLES = [
  { key: "deep_focus", label: "تمرکز عمیق", description: "کارهای عمیق و طولانی", icon: "target" },
  { key: "fast_execution", label: "اجراهای سریع", description: "کارهای کوتاه و سریع", icon: "zap" },
  { key: "detailed_planning", label: "برنامه‌ریزی دقیق", description: "همه‌چیز از قبل مشخص", icon: "list" },
  { key: "flexible_flow", label: "جریان منعطف", description: "بسته به انرژی روز", icon: "sparkles" },
  { key: "goal_oriented", label: "هدف‌محور", description: "سنگ‌بنای اهداف بزرگ", icon: "flag" },
] as const;

export type ProductivityStyleKey = (typeof PRODUCTIVITY_STYLES)[number]["key"];

/** Where onboarding answers live in the userProfile document. */
export interface WorkStyle {
  planningStyle: PlanningStyleKey | null;
  productivityStyle: ProductivityStyleKey | null;
}

/* -------------------- Dashboard config generation ----------------------- */

/**
 * Deterministic dashboard-config generation from onboarding answers.
 * Base = the persona's recommended layout; goals + work style apply small,
 * predictable priority bumps. Same core widgets, different presentation.
 */
export function buildDashboardConfig(input: {
  personaKey: PersonaKey;
  goals: string[];
  workStyle: WorkStyle;
}): DashboardConfig {
  const { personaKey, goals, workStyle } = input;
  const has = (g: string) => goals.includes(g);

  const priority: Record<string, number> = {};
  const visible: Record<string, boolean> = {};
  const base = RECOMMENDED_DASHBOARDS[personaKey].rows;
  for (const r of base) {
    priority[r.widget] = r.priority;
    visible[r.widget] = true;
  }

  /** Additive, small, predictable adjustments. */
  const bump = (widget: string, delta: number, show = true) => {
    priority[widget] = (priority[widget] ?? 0) + delta;
    if (show) visible[widget] = true;
  };

  if (personaKey === "student") {
    if (has("exam_prep") || has("assignments")) bump("deadlines", 4);
    if (has("study_plan")) bump("routines", 3);
    if (has("consistency") || has("academic")) bump("progress-snapshot", 2);
  }
  if (personaKey === "freelancer" || personaKey === "business_owner") {
    if (has("client_deadlines") || has("deadlines")) bump("deadlines", 4);
    if (has("projects") || has("delivery")) bump("projects", 3);
    if (has("time_tracking")) bump("progress-snapshot", 2);
  }
  if (personaKey === "employee") {
    if (has("deadlines")) bump("deadlines", 4);
    if (has("meetings")) bump("routines", 2);
    if (has("time_mgmt") || has("task_mgmt")) bump("today-tasks", 2);
  }
  if (personaKey === "manager" || personaKey === "team" || personaKey === "business_owner") {
    if (has("workload") || has("team_mgmt")) bump("projects", 4);
  }
  if (has("focus") || has("habits")) bump("routines", 2);
  if (has("consistency")) bump("progress-snapshot", 2);

  if (workStyle.planningStyle === "daily" || workStyle.planningStyle === "weekly") {
    bump("routines", 2);
  }
  if (workStyle.productivityStyle === "goal_oriented") {
    bump("progress-snapshot", 2);
  }

  return {
    version: 1,
    rows: WIDGETS.filter((w) => visible[w.key])
      .map((w) => ({
        widget: w.key,
        visible: true,
        priority: priority[w.key] ?? 0,
      }))
      .sort((a, b) => b.priority - a.priority),
  };
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
  // ── Student: study tasks, routines/study sessions, and progress first ──
  student: rowsOf(
    "today-overview",
    "quick-add",
    "today-tasks",     // ③  "برنامه مطالعه امروز"
    "routines",        // ④  "جلسات مطالعه" — moved UP (study focus)
    "overdue",         // ⑤  "تکالیف عقب‌افتاده"
    "progress-snapshot",// ⑥  "پیشرفت تحصیلی"
    "next-up",         // ⑦  "درس‌های بعدی"
    "growth-paths",    // ⑧  "مسیرهای یادگیری"
    "projects",        // ⑨  "پروژه‌های درسی"
  ),
  // ── Employee: tasks, deadlines, and meetings emphasis ──
  employee: rowsOf(
    "today-overview",
    "quick-add",
    "today-tasks",     // ③  "وظایف امروز"
    "overdue",         // ④  "کارهای عقب‌افتاده" — deadlines visible
    "next-up",         // ⑤  "پروژه‌های بعدی"
    "routines",        // ⑥  "برنامه روزانه کاری"
    "progress-snapshot",// ⑦  "بهره‌وری"
    "growth-paths",    // ⑧  "مسیرهای حرفه‌ای"
    "projects",        // ⑨  "پروژه‌های سازمانی"
  ),
  // ── Freelancer: projects-first layout (clients > everything) ──
  freelancer: rowsOf(
    "today-overview",
    "quick-add",
    "projects",        // ③  "پروژه‌های فعال مشتری" — MOVED UP
    "today-tasks",     // ④  "کارهای امروز"
    "overdue",         // ⑤  "ددلاین‌های عقب‌افتاده"
    "next-up",         // ⑥  "پروژه‌های بعدی"
    "progress-snapshot",// ⑦  "پیشرفت پروژه‌ها"
    "routines",        // ⑧  "برنامه روزانه"
    "growth-paths",    // ⑨  "مسیرهای رشد"
  ),
  // ── Business Owner: overview + projects + progress ──
  business_owner: rowsOf(
    "today-overview",
    "quick-add",
    "projects",        // ③  "پروژه‌های کسب‌وکار"
    "progress-snapshot",// ④  "وضعیت کلی"
    "today-tasks",     // ⑤  "وظایف مهم"
    "overdue",         // ⑥  "مواعید عقب‌افتاده"
    "next-up",         // ⑦  "اقدامات بعدی"
    "routines",        // ⑧  "برنامه روزانه"
    "growth-paths",    // ⑨  "مسیرهای رشد"
  ),
  // ── Manager / Team: projects + progress + tasks ──
  manager: rowsOf(
    "today-overview",
    "quick-add",
    "projects",        // ③  "پروژه‌های تیم"
    "progress-snapshot",// ④  "وضعیت کلی"
    "today-tasks",     // ⑤  "وظایف مهم"
    "overdue",         // ⑥  "مواعید عقب‌افتاده"
    "next-up",         // ⑦  "اقدامات بعدی"
    "routines",        // ⑧  "برنامه روزانه"
    "growth-paths",    // ⑨  "مسیرهای رشد"
  ),
  team: rowsOf(
    "today-overview",
    "quick-add",
    "projects",
    "progress-snapshot",
    "today-tasks",
    "overdue",
    "next-up",
    "routines",
    "growth-paths",
  ),
  // ── Personal: balanced general-purpose layout ──
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
    "routines",
    "progress-snapshot",
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

/* ------------------------------------------------------------------ */
/* Section labels — contextual per persona                              */
/* ------------------------------------------------------------------ */

/**
 * Persona-specific section headings. Keys are dashboard widget keys.
 * Missing keys fall back to the widget's base label from WIDGETS[].
 */
export const SECTION_LABELS: Record<string, Record<string, string>> = {
  student: {
    "today-overview": "برنامه مطالعه امروز",
    "today-tasks": "درس‌ها و تکالیف امروز",
    "routines": "جلسات مطالعه",
    "overdue": "تکالیف عقب‌افتاده",
    "next-up": "درس‌های بعدی",
    "progress-snapshot": "پیشرفت تحصیلی",
    "growth-paths": "مسیرهای یادگیری",
    "projects": "پروژه‌های درسی",
  },
  employee: {
    "today-overview": "وظایف امروز",
    "today-tasks": "کارهای امروز",
    "routines": "برنامه روزانه کاری",
    "overdue": "کارهای عقب‌افتاده",
    "next-up": "پروژه‌های بعدی",
    "progress-snapshot": "بهره‌وری",
    "growth-paths": "مسیرهای حرفه‌ای",
    "projects": "پروژه‌های سازمانی",
  },
  freelancer: {
    "today-overview": "پروژه‌ها و کارهای امروز",
    "today-tasks": "کارهای امروز",
    "projects": "پروژه‌های فعال مشتری",
    "overdue": "ددلاین‌های عقب‌افتاده",
    "next-up": "پروژه‌های بعدی",
    "progress-snapshot": "پیشرفت پروژه‌ها",
    "routines": "برنامه روزانه",
    "growth-paths": "مسیرهای رشد",
  },
  business_owner: {
    "today-overview": "نمای کلی کسب‌وکار",
    "today-tasks": "وظایف مهم",
    "projects": "پروژه‌های کسب‌وکار",
    "progress-snapshot": "وضعیت کلی",
    "overdue": "مواعید عقب‌افتاده",
    "next-up": "اقدامات بعدی",
    "routines": "برنامه روزانه",
    "growth-paths": "مسیرهای رشد",
  },
  manager: {
    "today-overview": "وضعیت امروز",
    "today-tasks": "وظایف مهم",
    "projects": "پروژه‌های تیم",
    "progress-snapshot": "وضعیت کلی",
    "overdue": "مواعید عقب‌افتاده",
    "next-up": "اقدامات بعدی",
    "routines": "برنامه روزانه",
    "growth-paths": "مسیرهای رشد",
  },
  team: {
    "today-overview": "وضعیت تیم",
    "today-tasks": "وظایف تیم",
    "projects": "پروژه‌های تیم",
    "progress-snapshot": "وضعیت کلی",
    "overdue": "مواعید عقب‌افتاده",
    "next-up": "اقدامات بعدی",
    "routines": "برنامه تیم",
    "growth-paths": "مسیرهای رشد",
  },
  personal: {}, // uses base labels
  custom: {},
};

export function sectionLabel(widgetKey: string, personaKey: string): string {
  const override = SECTION_LABELS[personaKey]?.[widgetKey];
  if (override) return override;
  return WIDGETS.find((w) => w.key === widgetKey)?.label ?? widgetKey;
}

/* ------------------------------------------------------------------ */
/* Navigation emphasis — persona-specific nav boosts                    */
/* ------------------------------------------------------------------ */

/** Paths to highlight for each persona (higher = more emphasis). */
export const NAV_EMPHASIS: Record<PersonaKey, string[]> = {
  student:   ["/today", "/progress", "/calendar"],
  employee:  ["/today", "/tasks", "/calendar"],
  freelancer:["/projects", "/today", "/progress"],
  business_owner: ["/dashboard", "/projects", "/progress"],
  manager:   ["/dashboard", "/projects", "/progress"],
  team:      ["/dashboard", "/projects", "/progress"],
  personal:  ["/today", "/progress"],
  custom:    ["/today"],
};

/** Mobile nav items per persona (bottom bar, 5 max). */
export const MOBILE_NAV_PER_PERSONA: Record<PersonaKey, string[]> = {
  student:   ["/today", "/progress", "/tasks", "/calendar", "/projects"],
  employee:  ["/today", "/tasks", "/progress", "/calendar", "/projects"],
  freelancer:["/projects", "/today", "/progress", "/calendar", "/tasks"],
  business_owner: ["/dashboard", "/projects", "/today", "/progress", "/calendar"],
  manager:   ["/dashboard", "/projects", "/today", "/progress", "/calendar"],
  team:      ["/dashboard", "/projects", "/today", "/progress", "/calendar"],
  personal:  ["/dashboard", "/today", "/progress", "/tasks", "/projects"],
  custom:    ["/dashboard", "/today", "/progress", "/tasks", "/projects"],
};

/* ------------------------------------------------------------------ */
/* Persona-aware greetings                                             */
/* ------------------------------------------------------------------ */

export const PERSONA_GREETINGS: Record<PersonaKey, { greeting: string; sub: string }> = {
  student:       { greeting: "برنامه مطالعه امروزت چطوره", sub: "درس‌ها و تکالیف امروزت را بررسی کن." },
  employee:      { greeting: "صبح بخیر", sub: "کارهای امروزت آماده‌اند." },
  freelancer:    { greeting: "پروژه‌هایت امروز آماده‌اند", sub: "ددلاین‌ها و کارهای مشتریان را بررسی کن." },
  business_owner:{ greeting: "نمای کلی کسب‌وکارت", sub: "وضعیت پروژه‌ها و اهداف را ببین." },
  manager:       { greeting: "وضعیت تیم امروز", sub: "پروژه‌ها و بار کاری اعضای تیم." },
  team:          { greeting: "وضعیت تیم امروز", sub: "کارهای مشترک و پروژه‌ها." },
  personal:      { greeting: "امروز چه کاری می‌خواهی انجام بدهی", sub: "برنامه امروزت را شروع کن." },
  custom:        { greeting: "امروز چه کاری می‌خواهی انجام بدهی", sub: "فضای کاری‌ات آماده است." },
};

/* ------------------------------------------------------------------ */
/* Persona feature set — controls enabled modules & navigation          */
/* ------------------------------------------------------------------ */

/** Every distinct module that can appear in the workspace. */
export type FeatureKey =
  // shared core
  | "tasks" | "projects" | "calendar" | "goals" | "progress" | "routines"
  | "inbox" | "analytics" | "planning" | "focus"
  // student
  | "subjects" | "exams" | "gradeCalc" | "studyPlanner" | "studyNotes"
  // manager / team
  | "team" | "teamMembers" | "workload" | "teamGoals" | "teamActivity" | "performance"
  // freelancer
  | "clients" | "timeTracking" | "deliveries" | "clientDeadlines"
  // employee
  | "meetings" | "workGoals" | "workDeadlines"
  // business
  | "businessGoals" | "strategicProjects";

export interface PersonaFeatureConfig {
  /** Features shown in nav / dashboard. */
  enabled: FeatureKey[];
  /** Features never shown (for future phases). */
  hidden: FeatureKey[];
}

/** Persona → default feature set. Goals can further boost/promote items. */
export const PERSONA_FEATURES: Record<PersonaKey, PersonaFeatureConfig> = {
  student: {
    enabled: ["tasks","projects","calendar","goals","progress","routines","focus","subjects","exams","gradeCalc","studyPlanner","studyNotes"],
    hidden: ["team","teamMembers","workload","teamGoals","teamActivity","performance","clients","timeTracking","deliveries","clientDeadlines","meetings","workGoals","workDeadlines","businessGoals","strategicProjects"],
  },
  employee: {
    enabled: ["tasks","projects","calendar","goals","progress","routines","focus","meetings","workGoals","workDeadlines"],
    hidden: ["subjects","exams","gradeCalc","studyPlanner","studyNotes","team","teamMembers","workload","teamGoals","teamActivity","performance","clients","timeTracking","deliveries","clientDeadlines","businessGoals","strategicProjects"],
  },
  freelancer: {
    enabled: ["tasks","projects","calendar","goals","progress","routines","focus","clients","timeTracking","deliveries","clientDeadlines"],
    hidden: ["subjects","exams","gradeCalc","studyPlanner","studyNotes","team","teamMembers","workload","teamGoals","teamActivity","performance","meetings","workGoals","workDeadlines","businessGoals","strategicProjects"],
  },
  business_owner: {
    enabled: ["tasks","projects","calendar","goals","progress","routines","businessGoals","strategicProjects","teamMembers","workload","performance"],
    hidden: ["subjects","exams","gradeCalc","studyPlanner","studyNotes","clients","timeTracking","deliveries","clientDeadlines","meetings","workGoals","workDeadlines"],
  },
  manager: {
    enabled: ["tasks","projects","calendar","goals","progress","routines","team","teamMembers","workload","teamGoals","teamActivity","performance"],
    hidden: ["subjects","exams","gradeCalc","studyPlanner","studyNotes","clients","timeTracking","deliveries","clientDeadlines","meetings","workGoals","workDeadlines","businessGoals","strategicProjects"],
  },
  team: {
    enabled: ["tasks","projects","calendar","goals","progress","routines","team","teamMembers","workload","teamGoals","teamActivity","performance"],
    hidden: ["subjects","exams","gradeCalc","studyPlanner","studyNotes","clients","timeTracking","deliveries","clientDeadlines","meetings","workGoals","workDeadlines","businessGoals","strategicProjects"],
  },
  personal: {
    enabled: ["tasks","projects","calendar","goals","progress","routines","focus","inbox","analytics"],
    hidden: ["subjects","exams","gradeCalc","studyPlanner","studyNotes","team","teamMembers","workload","teamGoals","teamActivity","performance","clients","timeTracking","deliveries","clientDeadlines","meetings","workGoals","workDeadlines","businessGoals","strategicProjects"],
  },
  custom: {
    enabled: ["tasks","projects","calendar","goals","progress","routines","focus","inbox","analytics"],
    hidden: [],
  },
};

/** Check if a feature is enabled for a persona. */
export function hasFeature(personaKey: PersonaKey, feature: FeatureKey): boolean {
  return PERSONA_FEATURES[personaKey]?.enabled.includes(feature) ?? false;
}

/* ------------------------------------------------------------------ */
/* Test mode — temporary development bypass                              */
/* ------------------------------------------------------------------ */

const TEST_KEY = "taskly-test-mode";
const TEST_PERSONA_KEY = "taskly-test-persona";

/**
 * Test-mode persona store (audit fix).
 *
 * Previously the persona lived ONLY in localStorage and was read during render,
 * so a persona change produced no re-render: the UI either appeared to do
 * nothing, or required `window.location.reload()` to "stick". localStorage is
 * not reactive, so it is now wrapped in a tiny subscribe/notify store and read
 * through `useSyncExternalStore` (see hooks/use-user-profile.ts).
 *
 * This is the single source of truth for the test-mode persona.
 */
const testPersonaListeners = new Set<() => void>();

/** Cached snapshot so `useSyncExternalStore` sees a stable value. */
let testPersonaCache: PersonaKey | null | undefined;

function readTestPersona(): PersonaKey | null {
  if (localStorage.getItem(TEST_KEY) !== "1") return null;
  return (localStorage.getItem(TEST_PERSONA_KEY) as PersonaKey) ?? "personal";
}

/** Stable snapshot for useSyncExternalStore. */
export function getTestPersonaSnapshot(): PersonaKey | null {
  if (testPersonaCache === undefined) testPersonaCache = readTestPersona();
  return testPersonaCache;
}

function notifyTestPersona(): void {
  testPersonaCache = readTestPersona();
  for (const l of testPersonaListeners) l();
}

/** Subscribe to test-persona changes (returns an unsubscribe function). */
export function subscribeTestPersona(cb: () => void): () => void {
  testPersonaListeners.add(cb);
  return () => {
    testPersonaListeners.delete(cb);
  };
}

function setTestPersona(personaKey: PersonaKey | null): void {
  if (personaKey === null) localStorage.removeItem(TEST_PERSONA_KEY);
  else localStorage.setItem(TEST_PERSONA_KEY, personaKey);
  notifyTestPersona();
}

/** Enable test mode with a specific persona (no auth required). */
export function enableTestMode(personaKey: PersonaKey): void {
  localStorage.setItem(TEST_KEY, "1");
  setTestPersona(personaKey);
}

export function disableTestMode(): void {
  localStorage.removeItem(TEST_KEY);
  localStorage.removeItem(TEST_PERSONA_KEY);
  notifyTestPersona();
}

export function isTestMode(): boolean {
  return localStorage.getItem(TEST_KEY) === "1";
}

export function getTestPersonaKey(): PersonaKey | null {
  return readTestPersona();
}

/**
 * Quick switch persona in test mode. Re-renders every subscriber immediately
 * (no page reload) so the workspace, navigation and dashboard all re-derive.
 */
export function switchTestPersona(personaKey: PersonaKey): void {
  if (!isTestMode()) return;
  setTestPersona(personaKey);
}
