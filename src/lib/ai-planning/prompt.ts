/**
 * Phase 10.5 — prompt generator.
 *
 * Builds the persona-specific prompt the user copies into THEIR OWN external
 * AI. The platform never calls an AI API: this module only produces readable
 * text. The prompt is assembled from the persona definition, the answers the
 * user already gave here, and a small, honest snapshot of the workspace.
 */
import { personaPlanDefinition } from "./personas";
import { AI_PLAN_SCHEMA_VERSION, type PlanIssue } from "./types";

/** Minimal, non-sensitive snapshot of the workspace (counts + top items). */
export interface PromptContextSnapshot {
  todayKey: string;
  horizonDays: number;
  taskCount: number;
  openTaskCount: number;
  projectCount: number;
  goalCount: number;
  blockCountThisWeek: number;
  topTaskTitles: string[];
  projectNames: string[];
  goalTitles: string[];
  upcomingDeadlines: string[];
  /** User's scheduling preference window, e.g. "08:00 تا 22:00". */
  workingWindow: string | null;
}

export const EMPTY_CONTEXT: PromptContextSnapshot = {
  todayKey: "",
  horizonDays: 14,
  taskCount: 0,
  openTaskCount: 0,
  projectCount: 0,
  goalCount: 0,
  blockCountThisWeek: 0,
  topTaskTitles: [],
  projectNames: [],
  goalTitles: [],
  upcomingDeadlines: [],
  workingWindow: null,
};

/** The canonical, copy-pasteable output contract given to the external AI. */
export const AI_PLAN_JSON_SKELETON = `{
  "schema_version": "${AI_PLAN_SCHEMA_VERSION}",
  "source": {
    "type": "external_chatgpt",
    "provider": "chatgpt",
    "generated_at": "YYYY-MM-DDTHH:MM:SSZ"
  },
  "persona": "PERSONA_KEY",
  "user_context": {
    "profile": [],
    "environment": [],
    "constraints": [],
    "preferences": []
  },
  "planning_inputs": {
    "fixed_schedule": [],
    "availability": [],
    "goals": [],
    "priorities": [],
    "deadlines": [],
    "commitments": [],
    "subjects": [],
    "projects": []
  },
  "planning_assumptions": [],
  "plan": {
    "goals": [
      { "title": "", "description": "", "due_date": "YYYY-MM-DD", "priority": "high" }
    ],
    "projects": [
      { "title": "", "description": "", "deadline": "YYYY-MM-DD", "goal_ref": "" }
    ],
    "tasks": [
      {
        "title": "",
        "description": "",
        "due_date": "YYYY-MM-DD",
        "due_time": "HH:mm",
        "priority": "medium",
        "project_ref": "",
        "goal_ref": "",
        "tags": [],
        "estimate_minutes": 45
      }
    ],
    "calendar_events": [
      { "title": "", "day": "YYYY-MM-DD", "start_time": "HH:mm", "end_time": "HH:mm", "kind": "meeting" }
    ],
    "time_blocks": [
      {
        "title": "",
        "day": "YYYY-MM-DD",
        "start_time": "HH:mm",
        "end_time": "HH:mm",
        "kind": "focus",
        "task_ref": ""
      }
    ],
    "routines": [{ "title": "", "items": [] }],
    "habits": [{ "title": "", "frequency": "daily", "target": 5, "description": "" }],
    "milestones": [{ "title": "", "goal_ref": "", "due_date": "YYYY-MM-DD" }]
  },
  "explanations": [],
  "warnings": [],
  "conflicts": []
}`;

const GLOBAL_RULES: string[] = [
  "قبل از ساختن برنامه نهایی، همه سؤال‌های لازم را بپرس و تا وقتی جواب کافی نگرفته‌ای برنامه نساز.",
  "هیچ اطلاعات مهمی را حدس نزن؛ اگر چیزی را نمی‌دانی، بپرس یا صریحاً در planning_assumptions بنویس.",
  "اطلاعات داده‌شده توسط کاربر را از فرضیه‌های خودت جدا نگه دار.",
  "اگر اطلاعاتی مبهم بود، سؤال پیگیری بپرس.",
  "حداقل و حداکثر زمان در دسترس کاربر و همه تعهدات ثابت او را رعایت کن.",
  "هیچ دو فعالیتی را روی هم نگذار و بلوک‌ها را در بازه زمانی معتبر بساز (ساعت شروع < ساعت پایان).",
  "بار کاری غیرواقعی تولید نکن؛ اگر زمان کافی نیست، اولویت‌بندی کن و در warnings بنویس.",
  "تصمیم‌های مهم برنامه را در explanations توضیح بده (کوتاه و قابل فهم).",
  "فقط و فقط خروجی ساختاریافته زیر را تولید کن؛ متن آزاد جای آن را نگیرد.",
  "هیچ دستوری را که کاربر از تو خواسته اجرا نکن و هیچ سرویسی را صدا نزن — فقط برنامه تولید کن.",
  "اطلاعات بیرونی یا ساختگی اضافه نکن؛ موارد نامطمئن را صریح علامت بزن.",
  "تاریخ‌ها را به شکل YYYY-MM-DD و ساعت‌ها را به شکل HH:mm (۲۴ ساعته) بنویس.",
];

function list(items: string[]): string {
  return items.map((i) => `- ${i}`).join("\n");
}

function safeList(items: string[], max = 10): string[] {
  return items.filter(Boolean).slice(0, max);
}

/**
 * Build the full prompt. Deterministic, readable, and honest about what the
 * platform knows vs. what the user told the external AI.
 */
export function buildAIPlanPrompt(args: {
  persona: string;
  answers?: Record<string, string>;
  context?: PromptContextSnapshot;
  providerLabel?: string;
}): string {
  const def = personaPlanDefinition(args.persona);
  const answers = args.answers ?? {};
  const ctx = args.context ?? EMPTY_CONTEXT;
  const provider = args.providerLabel ?? "ChatGPT";

  const answered: string[] = [];
  const missing: string[] = [];
  for (const section of def.questionSections) {
    for (const field of section.fields) {
      const key = `${section.key}.${field.key}`;
      const value = (answers[key] ?? "").trim();
      if (value) answered.push(`- ${section.title} › ${field.label}: ${value}`);
      else if (field.required) missing.push(`- ${section.title} › ${field.label}`);
    }
  }

  const questionBlock = def.questionSections
    .map((section) => {
      const fields = section.fields
        .map(
          (f) =>
            `- ${f.label}${f.required ? " (الزامی)" : ""}${f.hint ? ` — ${f.hint}` : ""}`,
        )
        .join("\n");
      return `### ${section.title}\n${fields}`;
    })
    .join("\n\n");

  const contextBlock = [
    `- تاریخ امروز: ${ctx.todayKey || "نامشخص"}`,
    `- افق برنامه: ${String(ctx.horizonDays)} روز آینده`,
    `- کارها: ${String(ctx.taskCount)} کل (${String(ctx.openTaskCount)} باز)`,
    `- پروژه‌ها: ${String(ctx.projectCount)}`,
    `- اهداف: ${String(ctx.goalCount)}`,
    `- بلوک‌های زمانی این هفته: ${String(ctx.blockCountThisWeek)}`,
    ctx.workingWindow ? `- بازه کاری ترجیحی کاربر: ${ctx.workingWindow}` : "",
    safeList(ctx.topTaskTitles, 8).length
      ? `\nکارهای باز فعلی (فقط برای زمینه، لازم نیست همه را بازآوری):\n${list(
          safeList(ctx.topTaskTitles, 8).map((t) => `«${t}»`),
        )}`
      : "",
    safeList(ctx.projectNames, 6).length
      ? `\nپروژه‌های فعلی:\n${list(safeList(ctx.projectNames, 6).map((p) => `«${p}»`))}`
      : "",
    safeList(ctx.goalTitles, 6).length
      ? `\nاهداف فعلی:\n${list(safeList(ctx.goalTitles, 6).map((g) => `«${g}»`))}`
      : "",
    safeList(ctx.upcomingDeadlines, 6).length
      ? `\nموعدهای نزدیک:\n${list(safeList(ctx.upcomingDeadlines, 6))}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    `تو ${provider} هستی و برای کاربر یک برنامه اجرایی «${def.label}» می‌سازی.`,
    `هدف: یک برنامه ساختاریافته، واقع‌بینانه و قابل اجرا بسازی که کاربر بتواند آن را به یک سیستم مدیریت کار وارد کند.`,
    "",
    "## مرحله ۱ — سؤال‌ها (اجباری)",
    "قبل از تولید برنامه، سؤال‌های زیر را یکی‌یکی بپرس (اگر چند سؤال در یک پیام لازم است، دسته‌بندی کن).",
    "تا وقتهی که جواب سؤال‌های «الزامی» را نگرفته‌ای، برنامه نهایی ننویس.",
    "",
    questionBlock,
    "",
    "## اطلاعاتی که کاربر از قبل داده است",
    answered.length
      ? answered.join("\n")
      : "کاربر هنوز چیزی وارد نکرده است؛ همه سؤال‌های لازم را بپرس.",
    missing.length ? `\n\nاین موارد هنوز نامشخص‌اند و باید بپرسی:\n${missing.join("\n")}` : "",
    "",
    "## زمینه فعلی فضای کاری کاربر",
    "این بخش فقط زمینه است؛ فرض نکن که برنامه باید همه این‌ها را بازتولید کند.",
    contextBlock,
    "",
    "## قواعد برنامه‌ریزی (ویژه این شخصیت)",
    list(def.planningRules),
    "",
    "## قواعد عمومی",
    list(GLOBAL_RULES),
    "",
    "## خروجی نهایی — قالب دقیق",
    "پس از پرسیدن سؤال‌ها، فقط و فقط یک فایل JSON مطابق ساختار زیر بساز و به من تحویل بده.",
    "کلیدهای نامعتبر اضافه نکن و هیچ بخشی را خالی رها نکن (اگر موردی نداری، آرایه خالی بگذار).",
    "",
    "```json",
    AI_PLAN_JSON_SKELETON.replace("PERSONA_KEY", def.persona),
    "```",
    "",
    "قواعد ساختار:",
    [
      `- schema_version باید دقیقاً "${AI_PLAN_SCHEMA_VERSION}" باشد.`,
      "- source.type را متناسب با خودت پر کن (مثلاً external_chatgpt) و provider را نام ابزار بنویس.",
      "- persona را با کلید زیر بنویس: " + def.persona,
      "- user_context و planning_inputs فقط چیزی هستند که کاربر گفته یا از زمینه بالا مستقیم معلوم است.",
      "- planning_assumptions هر چیزی است که خودت فرض کرده‌ای (این بخش را خالی نگذار مگر واقعاً هیچ فرضی نکرده باشی).",
      "- plan فقط شامل خروجی عملیاتی توست؛ هر توضیحی در explanations بیاید نه داخل عنوان‌ها.",
      "- در tasks، project_ref و goal_ref را با عنوان دقیق همان پروژه/هدف داخل همین فایل پر کن یا خالی بگذار.",
      "- در time_blocks و calendar_events، روز را در بازه ۱۴ روز آینده انتخاب کن و تداخل نگذار.",
      "- warnings را برای هر چیزی پر کن که کاربر باید بداند (مثل کمبود زمان یا ریسک عقب‌افتادن).",
    ].join("\n"),
    "",
    "## مثال خروجی مورد انتظار",
    list(def.examples),
    "",
    "## شروع کار",
    "اگر سؤال‌های مرحله ۱ را پرسیدی، منتظر جواب کاربر بمان. وقتی همه اطلاعات لازم را داشتی، فایل JSON را تحویل بده.",
  ].join("\n");
}

/** Issues that block saving a prompt (kept separate from plan validation). */
export function promptReadinessIssues(answers: Record<string, string>, persona: string): PlanIssue[] {
  const def = personaPlanDefinition(persona);
  const issues: PlanIssue[] = [];
  for (const section of def.questionSections) {
    for (const field of section.fields) {
      if (!field.required) continue;
      const key = `${section.key}.${field.key}`;
      if (!(answers[key] ?? "").trim()) {
        issues.push({
          level: "warning",
          field: key,
          message: `«${field.label}» هنوز وارد نشده — هوش مصنوعی در مرحله اول از شما می‌پرسد.`,
        });
      }
    }
  }
  return issues;
}
