/**
 * Future capability catalog — the ONE place that says what exists today and
 * what is planned for later (Phase: "AI & Future Features").
 *
 * Hard rules encoded here:
 *  - Every entry is DATA ONLY. There is no AI provider, endpoint, key or
 *    simulated result anywhere in this file or the UI that renders it.
 *  - Everything listed is `status: "coming_soon"`: visible, clearly labeled
 *    «به‌زودی», never interactive as a working feature.
 *  - The deterministic engines (Planning / Scheduling / Execution /
 *    Productivity Intelligence) keep working exactly as before — AI is an
 *    optional enhancement layer for the future, never a dependency.
 *
 * To activate a capability later: flip its `status` to "active" and replace
 * the preview card with a real surface. No other file needs to change.
 */
import { type PersonaKey } from "@/lib/personas";

/** Lifecycle of a capability. Only "active" capabilities are usable today. */
export type FeatureState = "active" | "coming_soon" | "disabled";

/** Coarse grouping used by the "Advanced" showcase and screen readers. */
export type FeatureCategory =
  | "planning"
  | "assistant"
  | "insights"
  | "workspace"
  | "agents";

/** Where a preview is allowed to appear (keeps the UI from being flooded). */
export type FeatureSurface = "dashboard" | "planning" | "insights" | "advanced";

export interface FutureFeatureDefinition {
  /** Stable id (used for anchors, tests and future activation). */
  id: string;
  key: string;
  /** Persian label shown on the card. */
  title: string;
  /** One-sentence, factual Persian description. No marketing claims. */
  description: string;
  category: FeatureCategory;
  /** Personas this preview is relevant for, or "all". */
  personas: PersonaKey[] | "all";
  status: FeatureState;
  /** Icon key — resolved to a component in the UI layer (no React here). */
  icon: string;
  /** Sort weight inside a surface (lower first). */
  order: number;
  /** Surfaces this preview may appear on. */
  surfaces: FeatureSurface[];
}

const ALL: PersonaKey[] | "all" = "all";

/**
 * Future capabilities. Titles stay plain; descriptions explain WHAT the
 * capability would do — never what it currently does.
 */
export const FUTURE_FEATURES: FutureFeatureDefinition[] = [
  {
    id: "ai-planning",
    key: "ai_planning",
    title: "برنامه‌ریزی هوشمند",
    description:
      "پس از گفتگو با دستیار، برنامهٔ پیشنهادی به‌صورت بلوک زمانی و کار در فضای کاری ثبت می‌شود؛ آنچه هنوز باقی مانده، پیشنهاد خودکار و بدون تأیید برای هفت روز آینده است.",
    category: "planning",
    personas: ALL,
    status: "coming_soon",
    icon: "sparkles",
    order: 10,
    surfaces: ["advanced"],
  },
  {
    /*
     * Phase 15 shipped the assistant itself, so per §28 this entry leaves the
     * coming-soon grid entirely and is listed under CURRENT_CAPABILITIES below.
     * Kept as a comment so the history of the catalog stays legible.
     */
    id: "ai-insights",
    key: "ai_insights",
    title: "بینش‌های هوشمند",
    description:
      "تحلیل هوشمند رفتار کاری و ارائه بینش‌های شخصی‌سازی‌شده درباره بهره‌وری شما.",
    category: "insights",
    personas: ALL,
    status: "coming_soon",
    icon: "lightbulb",
    order: 30,
    surfaces: ["insights", "advanced"],
  },
  {
    id: "ai-adaptive-planning",
    key: "ai_adaptive_planning",
    title: "برنامه‌ریزی تطبیقی",
    description:
      "برنامه شما را با توجه به تغییرات روز، اولویت‌ها، زمان آزاد و عملکرد واقعی‌تان تطبیق می‌دهد.",
    category: "planning",
    personas: ALL,
    status: "coming_soon",
    icon: "calendar-clock",
    order: 40,
    surfaces: ["planning", "advanced"],
  },
  {
    id: "ai-task-generation",
    key: "ai_task_generation",
    title: "تولید هوشمند کار",
    description:
      "تبدیل هدف‌ها و پروژه‌های شما به اقدامات و وظایف قابل اجرا.",
    category: "planning",
    personas: ALL,
    status: "coming_soon",
    icon: "list-todo",
    order: 50,
    surfaces: ["advanced"],
  },
  {
    id: "ai-goal-planning",
    key: "ai_goal_planning",
    title: "برنامه‌ریزی اهداف",
    description:
      "تبدیل اهداف بزرگ به مسیرهای اجرایی، پروژه‌ها و اقدامات مرحله‌به‌مرحله.",
    category: "planning",
    personas: ALL,
    status: "coming_soon",
    icon: "target",
    order: 60,
    surfaces: ["advanced"],
  },
  {
    id: "ai-project-planning",
    key: "ai_project_planning",
    title: "دستیار پروژه",
    description:
      "کمک برای ساخت ساختار پروژه، مراحل اجرا، زمان‌بندی و اولویت‌بندی.",
    category: "planning",
    personas: ALL,
    status: "coming_soon",
    icon: "folder-kanban",
    order: 70,
    surfaces: ["advanced"],
  },
  {
    id: "ai-schedule-optimization",
    key: "ai_schedule_optimization",
    title: "بهینه‌سازی زمان‌بندی",
    description:
      "پیشنهاد زمان‌بندی هوشمند بر اساس الگوی کاری، تقویم، ظرفیت و اولویت‌های شما.",
    category: "planning",
    personas: ALL,
    status: "coming_soon",
    icon: "clock",
    order: 80,
    surfaces: ["planning", "advanced"],
  },
  {
    id: "ai-workspace",
    key: "ai_workspace",
    title: "فضای کاری هوشمند",
    description:
      "یک فضای هوشمند متصل به تمام اطلاعات کاری و بهره‌وری شما.",
    category: "workspace",
    personas: ALL,
    status: "coming_soon",
    icon: "layout-dashboard",
    order: 90,
    surfaces: ["advanced"],
  },
  {
    id: "ai-agents",
    key: "ai_agents",
    title: "دستیارهای تخصصی",
    description:
      "دستیارهای تخصصی که در آینده وظایف مشخصی را در فضای کاری شما انجام می‌دهند.",
    category: "agents",
    personas: ALL,
    status: "coming_soon",
    icon: "bot",
    order: 100,
    surfaces: ["advanced"],
  },

  /* ---- Persona-specific previews (only shown to the matching persona) ---- */
  {
    id: "ai-study-planner",
    key: "ai_study_planner",
    title: "برنامه‌ریز مطالعه",
    description: "تبدیل برنامه درسی و آزمون‌ها به یک مسیر مطالعه هفتگی واقع‌بینانه.",
    category: "planning",
    personas: ["student"],
    status: "coming_soon",
    icon: "graduation-cap",
    order: 5,
    surfaces: ["dashboard", "advanced"],
  },
  {
    id: "ai-exam-planner",
    key: "ai_exam_planner",
    title: "برنامه‌ریز آزمون",
    description: "برنامه آمادگی بر اساس تاریخ آزمون، سرفصل‌ها و زمان در دسترس.",
    category: "planning",
    personas: ["student"],
    status: "coming_soon",
    icon: "target",
    order: 6,
    surfaces: ["advanced"],
  },
  {
    id: "ai-study-insights",
    key: "ai_study_insights",
    title: "بینش مطالعه",
    description: "تحلیل الگوی مطالعه و پیشنهاد نقاط قابل بهبود در هر درس.",
    category: "insights",
    personas: ["student"],
    status: "coming_soon",
    icon: "lightbulb",
    order: 7,
    surfaces: ["advanced"],
  },
  {
    id: "ai-work-planner",
    key: "ai_work_planner",
    title: "برنامه‌ریز کار",
    description: "چیدن وظایف کاری هفته بر اساس اولویت‌ها و جلسه‌های واقعی.",
    category: "planning",
    personas: ["employee"],
    status: "coming_soon",
    icon: "briefcase",
    order: 5,
    surfaces: ["dashboard", "advanced"],
  },
  {
    id: "ai-workload-assistant",
    key: "ai_workload_assistant",
    title: "دستیار بار کاری",
    description: "تشخیص اضافه‌بار و پیشنهاد بازتوزیع کار بین روزها و افراد.",
    category: "assistant",
    personas: ["employee", "manager"],
    status: "coming_soon",
    icon: "gauge",
    order: 6,
    surfaces: ["advanced"],
  },
  {
    id: "ai-meeting-assistant",
    key: "ai_meeting_assistant",
    title: "دستیار جلسات",
    description: "تبدیل صورت‌جلسه و تصمیم‌ها به کارهای مشخص با مسئول و مهلت.",
    category: "assistant",
    personas: ["employee", "manager"],
    status: "coming_soon",
    icon: "users",
    order: 7,
    surfaces: ["advanced"],
  },
  {
    id: "ai-client-planner",
    key: "ai_client_planner",
    title: "برنامه‌ریز مشتری",
    description: "برنامه‌ریزی کارها بر اساس مشتری‌ها، تحویل‌پذیرها و موعدهای واقعی.",
    category: "planning",
    personas: ["freelancer"],
    status: "coming_soon",
    icon: "briefcase",
    order: 5,
    surfaces: ["dashboard", "advanced"],
  },
  {
    id: "ai-deliverable-planner",
    key: "ai_deliverable_planner",
    title: "برنامه‌ریز تحویل",
    description: "شکستن هر تحویل‌پذیر به مراحل کوچک‌تر با زمان‌بندی واقع‌بینانه.",
    category: "planning",
    personas: ["freelancer"],
    status: "coming_soon",
    icon: "list-todo",
    order: 6,
    surfaces: ["advanced"],
  },
  {
    id: "ai-invoice-assistant",
    key: "ai_invoice_assistant",
    title: "دستیار فاکتور و پرداخت",
    description: "پیگیری هوشمند فاکتورهای ارسال‌شده و یادآوری پرداخت‌های معوق.",
    category: "assistant",
    personas: ["freelancer"],
    status: "coming_soon",
    icon: "receipt",
    order: 7,
    surfaces: ["advanced"],
  },
  {
    id: "ai-team-planning",
    key: "ai_team_planning",
    title: "برنامه‌ریزی تیم",
    description: "هماهنگی هدف‌های تیمی با ظرفیت واقعی اعضا و کارهای واگذارشده.",
    category: "planning",
    personas: ["manager"],
    status: "coming_soon",
    icon: "users",
    order: 5,
    surfaces: ["dashboard", "advanced"],
  },
  {
    id: "ai-project-risk",
    key: "ai_project_risk",
    title: "دستیار ریسک پروژه",
    description: "هشدار زودهنگام درباره پروژه‌هایی که از برنامه عقب افتاده‌اند.",
    category: "insights",
    personas: ["manager"],
    status: "coming_soon",
    icon: "shield-check",
    order: 6,
    surfaces: ["advanced"],
  },
  {
    id: "ai-sales-assistant",
    key: "ai_sales_assistant",
    title: "دستیار فروش",
    description: "پیشنهاد قدم بعدی برای هر فرصت فروش بر اساس مرحله و زمان‌بندی.",
    category: "assistant",
    personas: ["business_owner"],
    status: "coming_soon",
    icon: "trending-up",
    order: 5,
    surfaces: ["dashboard", "advanced"],
  },
  {
    id: "ai-operations-assistant",
    key: "ai_operations_assistant",
    title: "دستیار عملیات",
    description: "پیگیری جریان نقدی، تعهدات و کارهای عقب‌افتاده کسب‌وکار.",
    category: "assistant",
    personas: ["business_owner"],
    status: "coming_soon",
    icon: "building-2",
    order: 6,
    surfaces: ["advanced"],
  },
  {
    id: "ai-business-insights",
    key: "ai_business_insights",
    title: "بینش کسب‌وکار",
    description: "خواندن روند درآمد، هزینه و فروش در یک نگاه قابل فهم.",
    category: "insights",
    personas: ["business_owner"],
    status: "coming_soon",
    icon: "lightbulb",
    order: 7,
    surfaces: ["advanced"],
  },
  {
    id: "ai-life-planner",
    key: "ai_life_planner",
    title: "برنامه‌ریز زندگی",
    description: "تبدیل حوزه‌های زندگی و اهداف شخصی به یک مسیر هفتگی متعادل.",
    category: "planning",
    personas: ["personal", "custom"],
    status: "coming_soon",
    icon: "heart-pulse",
    order: 5,
    surfaces: ["dashboard", "advanced"],
  },
  {
    id: "ai-routine-assistant",
    key: "ai_routine_assistant",
    title: "دستیار عادات و روتین",
    description: "پیشنهاد زمان و ترتیب اجرای عادت‌ها بر اساس روزهای واقعی شما.",
    category: "assistant",
    personas: ["personal", "custom", "student"],
    status: "coming_soon",
    icon: "repeat",
    order: 6,
    surfaces: ["advanced"],
  },
];

/** Persian category labels (Advanced showcase grouping + a11y). */
export const FEATURE_CATEGORY_LABELS: Record<FeatureCategory, string> = {
  planning: "برنامه‌ریزی",
  assistant: "دستیار",
  insights: "بینش و تحلیل",
  workspace: "فضای کاری",
  agents: "دستیارهای تخصصی",
};

/**
 * What the product does TODAY — the deterministic layer. Shown next to the
 * "coming soon" grid so the user always sees what is real right now.
 */
export interface CurrentCapability {
  key: string;
  title: string;
  description: string;
  route?: string;
  state: "active";
}

export const CURRENT_CAPABILITIES: CurrentCapability[] = [
  {
    key: "tasks_projects",
    title: "کارها و پروژه‌ها",
    description: "ثبت، اولویت‌بندی و پیگیری کارها در کنار پروژه‌ها و اهداف.",
    route: "/tasks",
    state: "active",
  },
  {
    key: "planning",
    title: "برنامه‌ریزی و اولویت‌بندی",
    description: "موتور برنامه‌ریزی قطعی: اولویت‌ها، بار کاری و قدم بعدی.",
    route: "/planning",
    state: "active",
  },
  {
    key: "scheduling",
    title: "زمان‌بندی و بلوک‌ها",
    description: "موتور زمان‌بندی قطعی: بلوک‌های زمانی، تداخل‌ها و ساعات کاری.",
    route: "/calendar",
    state: "active",
  },
  {
    key: "execution",
    title: "اجرا و بازیابی",
    description: "نشست تمرکز، ثبت زمان واقعی و پیشنهاد بازیابی پس از انحراف.",
    route: "/today",
    state: "active",
  },
  {
    key: "intelligence",
    title: "تحلیل بهره‌وری",
    description: "موتور بینش قطعی: الگوها، روندها و سلامت پروژه‌ها و اهداف.",
    route: "/analytics",
    state: "active",
  },
  {
    key: "progression",
    title: "پیشرفت و شخصی‌سازی",
    description: "سطح، XP، مهارت‌ها، ماموریت‌ها، دستاوردها و باز شدن قابلیت‌ها.",
    route: "/progress",
    state: "active",
  },
  {
    key: "external_ai_import",
    title: "واردسازی برنامه از AI خارجی",
    description:
      "پرامپت آمادهٔ شخصیت‌محور می‌گیرید، خروجی هوش مصنوعی خودتان را وارد می‌کنید و پس از اعتبارسنجی و تأیید، به فضای کاری اضافه می‌شود.",
    route: "/ai-planning",
    state: "active",
  },
  {
    key: "ai_assistant",
    title: "دستیار بهره‌وری",
    description:
      "دستیار داخلی که فضای کاری شما را می‌خواند، پیشنهاد ساختاریافته می‌دهد و فقط پس از تأیید شما آن را اعمال می‌کند. کلید API فقط روی سرور نگهداری می‌شود.",
    route: "/assistant",
    state: "active",
  },
];

/** The one honest sentence shown wherever future capabilities appear. */
export const FUTURE_NOTE =
  "دستیار بهره‌وری و واردسازی برنامه فعال هستند؛ همهٔ آنچه در فهرست بالا می‌بینید هنوز «به‌زودی» است. موتورهای قطعی برنامه‌ریزی، زمان‌بندی، اجرا و تحلیل در هیچ حالتی به هوش مصنوعی وابسته نیستند.";

/* ------------------------------------------------------------------ */
/* Selectors (pure, deterministic — the UI only reads these)          */
/* ------------------------------------------------------------------ */

function matchesPersona(f: FutureFeatureDefinition, persona: PersonaKey): boolean {
  if (f.personas === "all") return true;
  if (f.personas.includes(persona)) return true;
  // "team" workspaces are managed by managers; "custom" behaves like personal.
  if (persona === "team") return f.personas.includes("manager");
  return false;
}

export function featureById(id: string): FutureFeatureDefinition | undefined {
  return FUTURE_FEATURES.find((f) => f.id === id);
}

/** Future capabilities for a persona, optionally limited to one surface. */
export function featuresForPersona(
  persona: PersonaKey,
  opts: { surface?: FeatureSurface; category?: FeatureCategory; limit?: number } = {},
): FutureFeatureDefinition[] {
  const rows = FUTURE_FEATURES.filter(
    (f) =>
      f.status !== "disabled" &&
      matchesPersona(f, persona) &&
      (!opts.surface || f.surfaces.includes(opts.surface)) &&
      (!opts.category || f.category === opts.category),
  ).sort((a, b) => a.order - b.order);
  return opts.limit ? rows.slice(0, opts.limit) : rows;
}

/** True when the capability exists but cannot be used yet. */
export function isComingSoon(f: FutureFeatureDefinition): boolean {
  return f.status === "coming_soon";
}
