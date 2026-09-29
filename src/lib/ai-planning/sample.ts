/**
 * Phase 10.5 — sample plan generator.
 *
 * A small, VALID v1.0 document per persona. It exists for two reasons:
 *  - the user can download it to see the exact shape before talking to their AI;
 *  - the import pipeline (parse → validate → conflicts → preview → apply) can
 *    be exercised end to end without any external AI.
 *
 * It is a SAMPLE, clearly labeled in the content — never a generated result.
 */
import { AI_PLAN_SCHEMA_VERSION, type AIPlanSourceType } from "./types";

function addDays(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + days * 86_400_000;
  const dt = new Date(t);
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

interface SampleContent {
  goal: { title: string; description: string };
  project: { title: string; description: string };
  tasks: Array<{ title: string; due: number; priority: string; est: number; tags: string[] }>;
  block: { title: string; dayOffset: number; start: string; end: string };
  event: { title: string; dayOffset: number; start: string; end: string; kind: string };
  routine: { title: string; items: string[] };
  habit: { title: string; frequency: "daily" | "weekly"; target: number };
  milestone: { title: string; due: number };
  subjects: string[];
  constraints: string[];
  fixed: string[];
  availability: string[];
}

const CONTENT: Record<string, SampleContent> = {
  student: {
    goal: { title: "میانگین ۱۸ در ریاضی و فیزیک تا پایان ترم", description: "هدف نمونه برای تست وارد کردن برنامه." },
    project: { title: "آمادگی آزمون میان‌ترم", description: "مرور فصل‌های کلیدی و حل تمرین." },
    tasks: [
      { title: "حل تمرین‌های فصل حرکت", due: 1, priority: "high", est: 60, tags: ["ریاضی"] },
      { title: "مرور غلط‌های فیزیک هفته قبل", due: 2, priority: "high", est: 45, tags: ["فیزیک"] },
      { title: "خلاصه‌نویسی درس شیمی", due: 4, priority: "medium", est: 40, tags: ["شیمی"] },
    ],
    block: { title: "تمرکز ریاضی", dayOffset: 1, start: "16:00", end: "17:00" },
    event: { title: "کلاس خصوصی فیزیک", dayOffset: 2, start: "17:00", end: "18:00", kind: "study" },
    routine: { title: "روتین شب مطالعه", items: ["مرور ۱۰ دقیقه‌ای", "برنامه فردا را بنویس"] },
    habit: { title: "مطالعه روزانه", frequency: "daily", target: 3 },
    milestone: { title: "پایان مرور فصل اول", due: 7 },
    subjects: ["ریاضی", "فیزیک", "شیمی"],
    constraints: ["ساعت خواب ۲۳:۰۰", "ورزش سه‌شنبه‌ها"],
    fixed: ["کلاس‌های مدرسه ۰۷:۳۰ تا ۱۴:۰۰"],
    availability: ["حداقل ۲ ساعت مطالعه روزانه", "بازه خوب: ۱۶:۰۰ تا ۲۰:۰۰"],
  },
  employee: {
    goal: { title: "تحویل گزارش ماهانه تا پایان هفته", description: "هدف نمونه برای تست وارد کردن برنامه." },
    project: { title: "گزارش عملکرد ماه", description: "جمع‌آوری داده و نگارش گزارش." },
    tasks: [
      { title: "جمع‌آوری داده‌های فروش", due: 1, priority: "high", est: 90, tags: ["گزارش"] },
      { title: "نگارش پیش‌نویس گزارش", due: 2, priority: "high", est: 120, tags: ["نوشتن"] },
      { title: "ارسال خلاصه جلسه تیم", due: 1, priority: "medium", est: 20, tags: ["پیگیری"] },
    ],
    block: { title: "تمرکز عمیق گزارش", dayOffset: 1, start: "09:00", end: "11:00" },
    event: { title: "تیم‌میت هفتگی", dayOffset: 2, start: "10:00", end: "11:00", kind: "meeting" },
    routine: { title: "پایان روز کاری", items: ["مرور کارهای فردا", "ثبت پیگیری‌ها"] },
    habit: { title: "برنامه‌ریزی روزانه", frequency: "daily", target: 1 },
    milestone: { title: "ارسال نسخه نهایی گزارش", due: 4 },
    subjects: ["گزارش ماهانه"],
    constraints: ["جلسه‌های ثابت دوشنبه و سه‌شنبه"],
    fixed: ["ساعت کاری ۰۹:۰۰ تا ۱۷:۰۰"],
    availability: ["بازه تمرکز خوب: صبح‌ها", "حداکثر ۲ بلوک ۹۰ دقیقه‌ای در روز"],
  },
  freelancer: {
    goal: { title: "تحویل پروژه سایت آکادمی تا آخر هفته", description: "هدف نمونه برای تست وارد کردن برنامه." },
    project: { title: "طراحی سایت آکادمی", description: "صفحه اصلی + صفحه دوره‌ها." },
    tasks: [
      { title: "تماس با مشتری برای تأیید صفحه اصلی", due: 1, priority: "high", est: 20, tags: ["پیگیری"] },
      { title: "طراحی صفحه اصلی", due: 3, priority: "high", est: 180, tags: ["طراحی"] },
      { title: "ارسال فاکتور مرحله دوم", due: 2, priority: "medium", est: 15, tags: ["مالی"] },
    ],
    block: { title: "کار عمیق طراحی", dayOffset: 1, start: "10:00", end: "12:30" },
    event: { title: "تماس با مشتری تهران‌وب", dayOffset: 2, start: "16:00", end: "16:30", kind: "meeting" },
    routine: { title: "پایان روز فریلنسری", items: ["ثبت ساعات کار", "پیگیری فاکتورها"] },
    habit: { title: "کار عمیق روزانه", frequency: "daily", target: 2 },
    milestone: { title: "تحویل نسخه اول صفحه اصلی", due: 3 },
    subjects: ["سایت آکادمی"],
    constraints: ["ظرفیت واقعی ۶ ساعت کار مفید در روز"],
    fixed: ["جلسه هفتگی با شریک — شنبه ۱۱:۰۰"],
    availability: ["بازه کار عمیق: صبح", "بازه کار اداری: عصر"],
  },
  manager: {
    goal: { title: "تحویل نسخه ۱ محصول در پایان ماه", description: "هدف نمونه برای تست وارد کردن برنامه." },
    project: { title: "نسخه ۱ محصول", description: "تحویل به مشتریان اولیه." },
    tasks: [
      { title: "تقسیم کارهای فاز توسعه بین اعضا", due: 1, priority: "high", est: 45, tags: ["مدیریت"] },
      { title: "پیگیری گزارش هفتگی اعضا", due: 2, priority: "medium", est: 30, tags: ["پیگیری"] },
      { title: "بستن ریسک تأخیر API", due: 3, priority: "high", est: 60, tags: ["ریسک"] },
    ],
    block: { title: "بررسی ظرفیت و واگذاری", dayOffset: 1, start: "11:00", end: "12:00" },
    event: { title: "جلسه هفتگی تیم", dayOffset: 2, start: "10:00", end: "11:00", kind: "meeting" },
    routine: { title: "پایان روز مدیریتی", items: ["بررسی پیشرفت پروژه‌ها", "ثبت ریسک‌های جدید"] },
    habit: { title: "بازبینی هفتگی تیم", frequency: "weekly", target: 1 },
    milestone: { title: "پایان فاز توسعه", due: 14 },
    subjects: ["نسخه ۱ محصول"],
    constraints: ["ظرفیت هر عضو ۶ ساعت مفید در روز"],
    fixed: ["جلسه تیم — دوشنبه ۱۰:۰۰"],
    availability: ["بازه واگذاری کار: اواخر هفته کاری"],
  },
  business_owner: {
    goal: { title: "رشد ۲۰٪ فروش ماه آینده", description: "هدف نمونه برای تست وارد کردن برنامه." },
    project: { title: "کمپین معرفی خدمات جدید", description: "صفحه فرود + پیگیری لیدها." },
    tasks: [
      { title: "تماس با لیدهای هفته", due: 1, priority: "high", est: 60, tags: ["فروش"] },
      { title: "آماده‌سازی صفحه فرود کمپین", due: 3, priority: "high", est: 120, tags: ["بازاریابی"] },
      { title: "بررسی هزینه‌های ثابت ماه", due: 2, priority: "medium", est: 40, tags: ["مالی"] },
    ],
    block: { title: "کار فروش و پیگیری", dayOffset: 1, start: "11:00", end: "12:30" },
    event: { title: "جلسه با مشتری رهگستر", dayOffset: 2, start: "13:00", end: "13:45", kind: "meeting" },
    routine: { title: "بازبینی هفتگی کسب‌وکار", items: ["بررسی فروش هفته", "بررسی لیدهای جدید"] },
    habit: { title: "پیگیری روزانه فروش", frequency: "daily", target: 1 },
    milestone: { title: "پایان کمپین و گزارش نتایج", due: 14 },
    subjects: ["خدمات جدید"],
    constraints: ["تعهد مالی: اجاره و حقوق سررسید اول ماه"],
    fixed: ["جلسه تیم — شنبه ۹:۰۰"],
    availability: ["بازه کار عمیق: صبح", "بازه فروش: عصر"],
  },
  personal: {
    goal: { title: "تعادل بهتر بین کار و خانواده", description: "هدف نمونه برای تست وارد کردن برنامه." },
    project: { title: "هفته متعادل", description: "برنامه شخصی هفتگی." },
    tasks: [
      { title: "پیاده‌روی ۳۰ دقیقه‌ای", due: 1, priority: "medium", est: 30, tags: ["سلامتی"] },
      { title: "برنامه‌ریزی هفته آینده", due: 2, priority: "high", est: 45, tags: ["بازبینی"] },
      { title: "تماس با خانواده", due: 4, priority: "low", est: 30, tags: ["خانواده"] },
    ],
    block: { title: "تمرکز شخصی", dayOffset: 1, start: "07:30", end: "08:30" },
    event: { title: "باشگاه", dayOffset: 2, start: "18:00", end: "19:00", kind: "personal" },
    routine: { title: "شروع آرام روز", items: ["آب", "برنامه امروز", "۵ دقیقه سکوت"] },
    habit: { title: "مطالعه روزانه", frequency: "daily", target: 20 },
    milestone: { title: "بازبینی ماهانه تعادل", due: 30 },
    subjects: ["سلامتی", "یادگیری", "خانواده"],
    constraints: ["خواب ۲۳:۰۰", "ورزش دو روز در هفته"],
    fixed: ["تعهدات خانوادگی آخر هفته"],
    availability: ["بازه تمرکز: صبح زود", "بازه سبک: عصر"],
  },
};

function contentFor(persona: string): SampleContent {
  return CONTENT[persona] ?? CONTENT.personal;
}

/** A valid, importable sample document for the given persona. */
export function buildSamplePlan(
  persona: string,
  todayKey: string,
  source: { type: AIPlanSourceType; provider: string } = { type: "external_chatgpt", provider: "chatgpt" },
): Record<string, unknown> {
  const c = contentFor(persona);
  const day = (offset: number) => addDays(todayKey, offset);

  return {
    schema_version: AI_PLAN_SCHEMA_VERSION,
    source: {
      type: source.type,
      provider: source.provider,
      generated_at: new Date().toISOString(),
    },
    persona,
    user_context: {
      profile: [`شخصیت: ${c.goal.title.slice(0, 40)}… (نمونه)`],
      environment: c.fixed,
      constraints: c.constraints,
      preferences: ["زبان برنامه: فارسی", "واحد زمان: دقیقه"],
    },
    planning_inputs: {
      fixed_schedule: c.fixed,
      availability: c.availability,
      goals: [c.goal.title],
      priorities: c.tasks.slice(0, 2).map((t) => t.title),
      deadlines: c.tasks.map((t) => `${t.title} — ${day(t.due)}`),
      commitments: c.constraints,
      subjects: c.subjects,
      projects: [c.project.title],
    },
    planning_assumptions: [
      "این فایل نمونه است و برای تست وارد کردن برنامه ساخته شده؛ داده واقعی کاربر نیست.",
      "زمان‌های پیشنهادی صرفاً برای نمایش قالب انتخاب شده‌اند.",
    ],
    plan: {
      goals: [
        {
          title: c.goal.title,
          description: c.goal.description,
          due_date: day(30),
          priority: "high",
        },
      ],
      projects: [
        {
          title: c.project.title,
          description: c.project.description,
          deadline: day(14),
          goal_ref: c.goal.title,
        },
      ],
      tasks: c.tasks.map((t) => ({
        title: t.title,
        description: "",
        due_date: day(t.due),
        priority: t.priority,
        project_ref: c.project.title,
        goal_ref: c.goal.title,
        tags: t.tags,
        estimate_minutes: t.est,
      })),
      calendar_events: [
        {
          title: c.event.title,
          day: day(c.event.dayOffset),
          start_time: c.event.start,
          end_time: c.event.end,
          kind: c.event.kind,
        },
      ],
      time_blocks: [
        {
          title: c.block.title,
          day: day(c.block.dayOffset),
          start_time: c.block.start,
          end_time: c.block.end,
          kind: "focus",
          task_ref: c.tasks[0]?.title ?? "",
        },
      ],
      routines: [{ title: c.routine.title, items: c.routine.items }],
      habits: [
        { title: c.habit.title, frequency: c.habit.frequency, target: c.habit.target, description: "" },
      ],
      milestones: [{ title: c.milestone.title, goal_ref: c.goal.title, due_date: day(c.milestone.due) }],
    },
    explanations: [
      "کارهای اولویت‌دار در بلوک‌های تمرکز صبح قرار گرفته‌اند.",
      "کارهای پیگیری در انتهای روز چیده شده‌اند تا تمرکز صبح حفظ شود.",
    ],
    warnings: [],
    conflicts: [],
  };
}
