/**
 * Phase 10.5 — persona-aware planning questionnaires.
 *
 * There is deliberately NO generic prompt. Each persona gets its own question
 * set, required data, planning rules, output expectations and example
 * scenario, because a study plan, a client plan and a team plan are not the
 * same problem.
 *
 * The answers collected here are optional accelerants: the generated prompt
 * also asks the external AI to collect whatever is still missing, so the flow
 * still works for a user who skips the questionnaire (§10).
 */
import { type PersonaKey } from "@/lib/personas";

export type QuestionFieldType = "text" | "textarea" | "number" | "boolean";

export interface QuestionField {
  /** Unique within the section; answer key is `${section}.${key}`. */
  key: string;
  label: string;
  type: QuestionFieldType;
  hint?: string;
  placeholder?: string;
  required?: boolean;
}

export interface QuestionSection {
  key: string;
  title: string;
  intro?: string;
  fields: QuestionField[];
}

export interface PersonaPlanDefinition {
  persona: PersonaKey;
  /** Short persona label used in UI + prompts. */
  label: string;
  pageTitle: string;
  pageDescription: string;
  promptTitle: string;
  promptIntro: string;
  /** What the plan may contain (used for the preview legend). */
  planCategories: string[];
  requiredData: string[];
  optionalData: string[];
  /** Hard rules the external AI must respect for this persona. */
  planningRules: string[];
  outputExpectations: string[];
  examples: string[];
  questionSections: QuestionSection[];
}

/* ================================================================== */
/* Student                                                            */
/* ================================================================== */

const STUDENT: PersonaPlanDefinition = {
  persona: "student",
  label: "دانش‌آموز / دانشجو",
  pageTitle: "برنامه مطالعه‌ام را با ChatGPT بسازم",
  pageDescription:
    "اطلاعات مدرسه، کلاس‌ها، آزمون‌ها و زمان در دسترس را به هوش مصنوعی خودت می‌دهی و یک برنامه مطالعه ساختاریافته می‌گیری؛ سپس فایل آن را اینجا وارد می‌کنی.",
  promptTitle: "پرامپت ساخت برنامه مطالعه",
  promptIntro:
    "این متن را کپی کن و در ChatGPT بچسبان. اول جواب سؤال‌ها را می‌پرسد، بعد فایل JSON برنامه را می‌سازد.",
  planCategories: [
    "برنامه مطالعه روزانه",
    "جلسات تمرکز",
    "برنامه آمادگی آزمون",
    "کارهای تکلیف",
    "اولویت درس‌ها",
  ],
  requiredData: [
    "مشخصات مدرسه یا دانشگاه و پایه/ترم",
    "روزها و ساعت کلاس‌ها",
    "تاریخ و درس آزمون‌های پیش رو",
    "حداقل و حداکثر زمان مطالعه روزانه",
  ],
  optionalData: [
    "کلاس‌های آنلاین و خصوصی",
    "ساعت رفت‌وبرگشت",
    "ورزش و کارهای خانوادگی",
    "ساعت خواب و استراحت",
    "درس‌های قوی و ضعیف",
  ],
  planningRules: [
    "هیچ کلاس، آزمون یا تعهد ثابتی را جابه‌جا نکن.",
    "زمان مطالعه روزانه از حداکثر اعلام‌شده بیشتر نشود.",
    "بین بلوک‌های مطالعه زمان استراحت بگذار.",
    "برای هر درسِ ضعیف، مرور پراکنده (تکرار در چند روز) بساز، نه یک جلسه سنگین.",
    "روزهای کم‌ظرفیت (ورزش، خانواده) را سبک‌تر بگیر.",
  ],
  outputExpectations: [
    "بلوک مطالعه با روز و ساعت دقیق",
    "کارهای روزانه با سررسید",
    "اولویت هر درس و دلیل آن",
    "برنامه آمادگی هر آزمون تا روز آزمون",
  ],
  examples: [
    "شنبه ۱۶:۰۰–۱۷:۰۰ ریاضی — چون آزمون ریاضی نزدیک است و ضعف اصلی است.",
    "یکشنبه ۱۸:۰۰–۱۹:۰۰ مرور غلط‌های فیزیک هفته.",
  ],
  questionSections: [
    {
      key: "school",
      title: "محیط آموزشی",
      fields: [
        { key: "name", label: "نام مدرسه / دانشگاه", type: "text", placeholder: "دبیرستان داده" },
        { key: "grade", label: "پایه یا ترم تحصیلی", type: "text", placeholder: "دهم / ترم اول" },
        { key: "major", label: "رشته یا مجموعه دروس", type: "text", placeholder: "ریاضی و فیزیک" },
        { key: "days", label: "روزهای حضور در مدرسه", type: "text", placeholder: "شنبه تا چهارشنبه" },
        {
          key: "hours",
          label: "ساعت شروع و پایان مدرسه",
          type: "text",
          placeholder: "۰۷:۳۰ تا ۱۴:۰۰",
        },
        { key: "commute", label: "زمان رفت‌وبرگشت (دقیقه)", type: "number", hint: "اختیاری" },
      ],
    },
    {
      key: "classes",
      title: "کلاس‌ها و برنامه ثابت",
      fields: [
        { key: "subjects", label: "درس‌ها و روز و ساعت هرکدام", type: "textarea", placeholder: "ریاضی — یکشنبه ۱۰:۰۰" },
        {
          key: "extra",
          label: "کلاس خصوصی یا آنلاین",
          type: "textarea",
          hint: "اختیاری — روز و ساعت",
        },
        {
          key: "fixedStudy",
          label: "جلسه‌های مطالعه ثابت",
          type: "textarea",
          hint: "اختیاری — مثلاً مطالعه شبانه جمعه‌ها",
        },
      ],
    },
    {
      key: "deadlines",
      title: "آزمون‌ها و مهلت‌ها",
      fields: [
        { key: "exams", label: "آزمون‌های پیش رو (درس و تاریخ)", type: "textarea", placeholder: "فیزیک — ۱۵ مهر" },
        { key: "assignments", label: "تکلیف‌ها و پروژه‌ها", type: "textarea", hint: "اختیاری" },
        { key: "importance", label: "کدام درس‌ها مهم‌ترند؟", type: "text", hint: "اختیاری" },
      ],
    },
    {
      key: "strengths",
      title: "نقاط قوت و ضعف",
      fields: [
        { key: "strong", label: "درس‌های قوی", type: "text", hint: "اختیاری" },
        { key: "weak", label: "درس‌های ضعیف یا نیازمند تکرار", type: "text" },
        { key: "hardTopics", label: "مبحث‌های سخت", type: "textarea", hint: "اختیاری" },
      ],
    },
    {
      key: "availability",
      title: "زمان در دسترس",
      fields: [
        { key: "min", label: "حداقل مطالعه روزانه (ساعت)", type: "number", required: true },
        { key: "max", label: "حداکثر واقع‌بینانه روزانه (ساعت)", type: "number", required: true },
        {
          key: "periods",
          label: "بازه‌های مناسب مطالعه",
          type: "text",
          hint: "اختیاری — مثلاً صبح‌ها و بعدازظهرها",
        },
        { key: "session", label: "طول جلسه تمرکز دلخواه (دقیقه)", type: "number" },
        { key: "break", label: "استراحت بین جلسه‌ها (دقیقه)", type: "number" },
      ],
    },
    {
      key: "constraints",
      title: "محدودیت‌ها و تعهدها",
      fields: [
        { key: "sports", label: "ورزش", type: "text", hint: "اختیاری — روز و ساعت" },
        { key: "family", label: "کارهای خانوادگی یا مذهبی", type: "textarea", hint: "اختیاری" },
        { key: "sleep", label: "ساعت خواب و بیداری", type: "text", hint: "اختیاری" },
        { key: "lightDays", label: "روزهای کم‌ظرفیت", type: "text", hint: "اختیاری" },
      ],
    },
    {
      key: "goals",
      title: "هدف‌ها",
      fields: [
        { key: "short", label: "هدف کوتاه‌مدت", type: "text" },
        { key: "grade", label: "هدف نمره/رتبه", type: "text", hint: "اختیاری" },
        { key: "long", label: "هدف بلندمدت", type: "text", hint: "اختیاری" },
      ],
    },
  ],
};

/* ================================================================== */
/* Employee                                                           */
/* ================================================================== */

const EMPLOYEE: PersonaPlanDefinition = {
  persona: "employee",
  label: "کارمند",
  pageTitle: "برنامه کاری‌ام را با ChatGPT بسازم",
  pageDescription:
    "ساعات کاری، جلسه‌ها، مسئولیت‌های تکرارشونده و مهلت‌ها را می‌دهی و یک برنامه اجرایی هفتگی می‌گیری؛ سپس فایل آن را وارد می‌کنی.",
  promptTitle: "پرامپت ساخت برنامه کاری",
  promptIntro:
    "این متن را کپی کن و در ChatGPT بچسبان؛ سؤال‌ها را می‌پرسد و در پایان فایل JSON برنامه را می‌سازد.",
  planCategories: [
    "برنامه روز و هفته کاری",
    "اولویت کارها",
    "بلوک تمرکز عمیق",
    "پیگیری جلسه‌ها",
    "کارهای تکرارشونده",
  ],
  requiredData: [
    "ساعات کاری و نوع همکاری (حضوری/دورکار)",
    "جلسه‌های ثابت هفته",
    "کارهای اولویت‌دار و مهلت‌دار",
    "ساعات تمرکز ترجیحی",
  ],
  optionalData: [
    "مسئولیت‌های تکرارشونده هفتگی",
    "توقع مدیر در این دوره",
    "زمان رفت‌وبرگشت",
    "ترجیح استراحت و ناهار",
  ],
  planningRules: [
    "جلسات و تعهدات ثابت را جابه‌جا نکن.",
    "حداقل ۶۰٪ زمان عمیق/متمرکز را برای کار اولویت‌دار نگه دار.",
    "کارهای اولویت‌دار را قبل از کارهای فرعی بگذار.",
    "جمع کارهای هر روز از زمان در دسترس بیشتر نشود.",
    "برای هر جلسه یک کار پیگیری بساز (اگر لازم است).",
  ],
  outputExpectations: [
    "اولویت‌بندی کارها برای هفته",
    "بلوک‌های تمرکز با روز و ساعت",
    "کارهای پیگیری جلسات",
    "کارهای تکرارشونده به‌صورت روتین",
  ],
  examples: [
    "دوشنبه ۰۹:۰۰–۱۱:۰۰ گزارش ماهانه (تمرکز عمیق، بدون جلسه).",
    "بعد از جلسه سه‌شنبه با مشتری: ارسال خلاصه تصمیم‌ها تا پایان همان روز.",
  ],
  questionSections: [
    {
      key: "work",
      title: "شرایط کار",
      fields: [
        { key: "role", label: "سمت و تیم", type: "text" },
        {
          key: "mode",
          label: "نوع همکاری",
          type: "text",
          placeholder: "حضوری / ترکیبی / دورکار",
        },
        { key: "hours", label: "ساعت شروع و پایان کار", type: "text", placeholder: "۰۹:۰۰ تا ۱۷:۰۰" },
        { key: "commute", label: "زمان رفت‌وبرگشت (دقیقه)", type: "number", hint: "اختیاری" },
      ],
    },
    {
      key: "meetings",
      title: "جلسه‌ها",
      fields: [
        { key: "fixed", label: "جلسه‌های ثابت هفته", type: "textarea", placeholder: "دوشنبه ۱۰:۰۰ تیم‌میت" },
        { key: "prep", label: "آمادگی لازم قبل از جلسه", type: "textarea", hint: "اختیاری" },
      ],
    },
    {
      key: "workload",
      title: "کارها و اولویت‌ها",
      fields: [
        { key: "priority", label: "کارهای اولویت‌دار این دوره", type: "textarea" },
        { key: "deadlines", label: "مهلت‌های قطعی", type: "textarea", hint: "اختیاری" },
        { key: "recurring", label: "مسئولیت‌های تکرارشونده", type: "textarea", hint: "اختیاری" },
        { key: "expectations", label: "انتظار مدیر", type: "textarea", hint: "اختیاری" },
      ],
    },
    {
      key: "availability",
      title: "زمان و تمرکز",
      fields: [
        { key: "focusWindow", label: "بهترین ساعت تمرکز عمیق", type: "text", hint: "اختیاری" },
        { key: "maxDeep", label: "حداکثر بلوک تمرکز (دقیقه)", type: "number" },
        { key: "lunch", label: "زمان ناهار و استراحت", type: "text", hint: "اختیاری" },
      ],
    },
    {
      key: "goals",
      title: "هدف‌های کاری",
      fields: [
        { key: "short", label: "هدف این ماه", type: "text" },
        { key: "long", label: "هدف بلندمدت شغلی", type: "text", hint: "اختیاری" },
      ],
    },
  ],
};

/* ================================================================== */
/* Freelancer                                                         */
/* ================================================================== */

const FREELANCER: PersonaPlanDefinition = {
  persona: "freelancer",
  label: "فریلنسر",
  pageTitle: "برنامه مشتری‌ها و پروژه‌هایم را با ChatGPT بسازم",
  pageDescription:
    "مشتری‌ها، تحویل‌پذیرها، فاکتورها و ظرفیت واقعی‌ات را می‌دهی و یک برنامه اجرایی قابل اتکا می‌گیری؛ سپس فایل آن را وارد می‌کنی.",
  promptTitle: "پرامپت ساخت برنامه کار فریلنسری",
  promptIntro:
    "این متن را در ChatGPT بچسبان؛ بعد از پرسیدن سؤال‌ها، برنامه را به‌صورت فایل JSON می‌سازد.",
  planCategories: [
    "پیگیری مشتری‌ها",
    "برنامه تحویل‌پذیرها",
    "بلوک کار متمرکز",
    "کارهای در انتظار پاسخ",
    "پیگیری فاکتور",
  ],
  requiredData: [
    "فهرست مشتری‌ها و اولویت هرکدام",
    "پروژه‌ها و تحویل‌پذیرهای در جریان",
    "ساعت کاری و ظرفیت واقعی روزانه",
    "موعدهای قطعی تحویل و پرداخت",
  ],
  optionalData: [
    "نحوه ارتباط ترجیحی با هر مشتری",
    "بازبینی‌ها و اصلاحات در جریان",
    "جلسه‌های ثابت",
    "هدف درآمدی",
  ],
  planningRules: [
    "موعد تحویل و فاکتور را به‌عنوان قید قطعی در نظر بگیر.",
    "برای هر مشتری یک بلوک پیگیری مشخص کن (نه «هر وقت شد»).",
    "کارهای در انتظار پاسخ را از کارهای فعال جدا نگه دار.",
    "حداکثر ۷۰٪ ظرفیت روزانه را به پروژه‌ها اختصاص بده تا جای پیگیری و کار اداری بماند.",
    "کار اداری و فاکتور را در انتهای روز بگذار، نه بین بلوک‌های عمیق.",
  ],
  outputExpectations: [
    "کار پیگیری برای هر مشتری",
    "برنامه تحویل‌پذیرها با موعد",
    "بلوک‌های کار عمیق و کار اداری",
    "یادآوری فاکتورهای نزدیک سررسید",
  ],
  examples: [
    "دوشنبه ۱۰:۰۰–۱۲:۰۰ طراحی صفحه اصلی سایت آکادمی (تحویل تا پنج‌شنبه).",
    "پنج‌شنبه ۱۶:۰۰ تماس با مشتری «تهران‌وب» برای تأیید مرحله دوم.",
  ],
  questionSections: [
    {
      key: "clients",
      title: "مشتری‌ها",
      fields: [
        { key: "list", label: "مشتری‌ها و اولویت هرکدام", type: "textarea" },
        { key: "communication", label: "نحوه ارتباط ترجیحی", type: "text", hint: "اختیاری" },
        { key: "followUp", label: "نیاز به پیگیری دوره‌ای؟", type: "textarea", hint: "اختیاری" },
      ],
    },
    {
      key: "projects",
      title: "پروژه‌ها و تحویل‌پذیرها",
      fields: [
        { key: "active", label: "پروژه‌های در جریان", type: "textarea" },
        { key: "deliverables", label: "تحویل‌پذیرها و موعدشان", type: "textarea" },
        { key: "revisions", label: "بازبینی‌های در جریان", type: "textarea", hint: "اختیاری" },
        { key: "waiting", label: "چیزهایی که منتظر مشتری هستند", type: "textarea", hint: "اختیاری" },
      ],
    },
    {
      key: "capacity",
      title: "ظرفیت کاری",
      fields: [
        { key: "hours", label: "ساعت کاری روزانه", type: "text" },
        { key: "maxDaily", label: "حداکثر کار واقعی در روز (ساعت)", type: "number" },
        { key: "deepWindow", label: "بازه کار عمیق", type: "text", hint: "اختیاری" },
        { key: "adminWindow", label: "بازه کار اداری و پیگیری", type: "text", hint: "اختیاری" },
      ],
    },
    {
      key: "finance",
      title: "مالی",
      fields: [
        { key: "pricing", label: "نوع قیمت‌گذاری پروژه‌ها", type: "text", hint: "ساعتی / ثابت" },
        { key: "invoices", label: "فاکتورهای در جریان و موعدشان", type: "textarea", hint: "اختیاری" },
        { key: "target", label: "هدف درآمدی این ماه", type: "text", hint: "اختیاری" },
      ],
    },
    {
      key: "meetings",
      title: "جلسه‌ها و تعهدها",
      fields: [
        { key: "meetings", label: "جلسه‌های ثابت", type: "textarea", hint: "اختیاری" },
        { key: "rest", label: "زمان استراحت و پایان هفته", type: "text", hint: "اختیاری" },
      ],
    },
  ],
};

/* ================================================================== */
/* Manager                                                            */
/* ================================================================== */

const MANAGER: PersonaPlanDefinition = {
  persona: "manager",
  label: "مدیر",
  pageTitle: "برنامه اجرای تیم را با ChatGPT بسازم",
  pageDescription:
    "ساختار تیم، پروژه‌ها، ظرفیت هر نفر و ریسک‌ها را می‌دهی و یک برنامه تیمی با تخصیص کار می‌گیری؛ سپس فایل آن را وارد می‌کنی.",
  promptTitle: "پرامپت ساخت برنامه تیم",
  promptIntro:
    "این متن را در ChatGPT بچسبان؛ برنامه باید تیم‌محور باشد، نه برنامه شخصی مدیر.",
  planCategories: [
    "اولویت‌های تیم",
    "واگذاری کارها",
    "نقاط عطف پروژه",
    "پیگیری جلسات",
    "پایش بار کار",
  ],
  requiredData: [
    "اعضای تیم و نقش هرکدام",
    "پروژه‌های تیمی و موعدها",
    "ظرفیت و محدودیت هر نفر",
    "اهداف تیم",
  ],
  optionalData: [
    "کارهای واگذارشده معلق",
    "ریسک‌ها و وابستگی‌ها",
    "جلسه‌های تیمی",
    "اولویت‌های کسب‌وکار",
  ],
  planningRules: [
    "خروجی باید تیم‌محور باشد: هر کار باید مسئول داشته باشد.",
    "مجموع کار واگذارشده هر نفر از ظرفیت اعلام‌شده‌اش بیشتر نشود.",
    "برای هر ریسک، یک اقدام مشخص با مسئول و موعد بساز.",
    "جلسات تیمی را در برنامه نگه دار و برای آن‌ها پیگیری بساز.",
    "برای هر پروژه نقاط عطف هفتگی مشخص کن.",
  ],
  outputExpectations: [
    "فهرست کارها با مسئول و موعد",
    "توزیع بار کار بر اساس ظرفیت",
    "نقاط عطف هر پروژه",
    "اقدام‌های کاهش ریسک",
  ],
  examples: [
    "مهدی — گزارش هفتگی فروش — تا پنج‌شنبه (ظرفیت ۶ ساعت در روز).",
    "risks: تأخیر API مشتری → تماس با تیم فنی تا دوشنبه.",
  ],
  questionSections: [
    {
      key: "team",
      title: "تیم",
      fields: [
        { key: "members", label: "اعضا و نقش هرکدام", type: "textarea" },
        { key: "capacity", label: "ظرفیت هر نفر", type: "textarea", hint: "اختیاری — مثلاً ۶ ساعت مفید" },
        { key: "availability", label: "عدم‌حضور یا محدودیت‌ها", type: "textarea", hint: "اختیاری" },
      ],
    },
    {
      key: "projects",
      title: "پروژه‌ها و نقاط عطف",
      fields: [
        { key: "projects", label: "پروژه‌های تیمی و موعدها", type: "textarea" },
        { key: "milestones", label: "نقاط عطف مهم", type: "textarea", hint: "اختیاری" },
        { key: "dependencies", label: "وابستگی‌ها", type: "textarea", hint: "اختیاری" },
      ],
    },
    {
      key: "risks",
      title: "ریسک‌ها و فشار کار",
      fields: [
        { key: "risks", label: "ریسک‌های فعلی", type: "textarea", hint: "اختیاری" },
        { key: "overload", label: "کارهای انباشته یا عقب‌افتاده", type: "textarea", hint: "اختیاری" },
      ],
    },
    {
      key: "meetings",
      title: "جلسه‌ها",
      fields: [
        { key: "fixed", label: "جلسه‌های ثابت تیم", type: "textarea", hint: "اختیاری" },
        { key: "reporting", label: "گزارش‌گیری دوره‌ای", type: "textarea", hint: "اختیاری" },
      ],
    },
    {
      key: "goals",
      title: "اهداف تیم",
      fields: [
        { key: "quarter", label: "هدف این فصل/ماه تیم", type: "text" },
        { key: "business", label: "اولویت‌های کسب‌وکار", type: "textarea", hint: "اختیاری" },
      ],
    },
  ],
};

/* ================================================================== */
/* Business Owner                                                     */
/* ================================================================== */

const BUSINESS_OWNER: PersonaPlanDefinition = {
  persona: "business_owner",
  label: "صاحب کسب‌وکار",
  pageTitle: "برنامه عملیات کسب‌وکارم را با ChatGPT بسازم",
  pageDescription:
    "اولویت‌های کسب‌وکار، فروش، مشتری‌ها و کارهای عملیاتی را می‌دهی و یک برنامه هفتگی/ماهانه می‌گیری؛ سپس فایل آن را وارد می‌کنی.",
  promptTitle: "پرامپت ساخت برنامه کسب‌وکار",
  promptIntro:
    "این متن را در ChatGPT بچسبان؛ خروجی باید اجرایی باشد، نه یک سیستم حسابداری.",
  planCategories: [
    "اولویت‌های کسب‌وکار",
    "پیگیری فروش",
    "کارهای عملیاتی",
    "نقاط عطف پروژه",
    "بازبینی مالی و هزینه",
  ],
  requiredData: [
    "اولویت‌های اصلی کسب‌وکار برای این دوره",
    "فرصت‌های فروش و مرحله هرکدام",
    "پروژه‌ها و موعدها",
    "مشتریان فعال و نیازهای فوری",
  ],
  optionalData: [
    "هدف درآمدی و هزینه‌های نزدیک",
    "مسئولیت‌های اعضای تیم",
    "جریان نقدی و تعهدات پرداخت",
    "ابتکارهای رشد",
  ],
  planningRules: [
    "این برنامه ابزار حسابداری نیست؛ فقط کارهای اجرایی را برنامه‌ریزی کن.",
    "برای هر فرصت فروش یک قدم بعدی مشخص با موعد بساز.",
    "موعدهای مالی (پرداخت اجاره، حقوق، فاکتور) را قید قطعی بگیر.",
    "کارهای فروش را از کارهای عملیاتی در بلوک‌های زمانی جدا کن.",
    "برای هر پروژه یک بازبینی ماهانه در نظر بگیر.",
  ],
  outputExpectations: [
    "قدم بعدی هر فرصت فروش",
    "کارهای عملیاتی با موعد",
    "نقاط عطف پروژه‌ها",
    "جلسه بازبینی هفتگی/ماهانه",
  ],
  examples: [
    "شنبه ۱۱:۰۰ تماس با مشتری «رهگستر» درباره تمدید قرارداد.",
    "یکشنبه ۱۰:۰۰–۱۲:۰۰ کار روی صفحه پرداخت سایت (فروش را متوقف نکند).",
  ],
  questionSections: [
    {
      key: "business",
      title: "کسب‌وکار",
      fields: [
        { key: "type", label: "نوع کسب‌وکار", type: "text" },
        { key: "priorities", label: "اولویت‌های این دوره", type: "textarea" },
        { key: "growth", label: "ابتکارهای رشد", type: "textarea", hint: "اختیاری" },
      ],
    },
    {
      key: "sales",
      title: "فروش و مشتری‌ها",
      fields: [
        { key: "opportunities", label: "فرصت‌های فروش و مرحله هرکدام", type: "textarea" },
        { key: "customers", label: "مشتریان فعال و نیاز فوری", type: "textarea" },
        { key: "followUps", label: "پیگیری‌های معوق", type: "textarea", hint: "اختیاری" },
      ],
    },
    {
      key: "operations",
      title: "عملیات",
      fields: [
        { key: "projects", label: "پروژه‌های جاری", type: "textarea", hint: "اختیاری" },
        { key: "team", label: "مسئولیت اعضای تیم", type: "textarea", hint: "اختیاری" },
        { key: "deadlines", label: "موعدهای قطعی کسب‌وکار", type: "textarea", hint: "اختیاری" },
      ],
    },
    {
      key: "money",
      title: "پول (در حد تصمیم اجرایی)",
      fields: [
        { key: "target", label: "هدف درآمدی این ماه", type: "text", hint: "اختیاری" },
        { key: "fixedCosts", label: "هزینه‌های ثابت نزدیک", type: "text", hint: "اختیاری" },
        { key: "cashflow", label: "نگرانی جریان نقدی", type: "textarea", hint: "اختیاری" },
      ],
    },
    {
      key: "time",
      title: "زمان خودتان",
      fields: [
        { key: "hours", label: "ساعت کاری خودتان", type: "text" },
        { key: "meetings", label: "جلسه‌های ثابت", type: "textarea", hint: "اختیاری" },
      ],
    },
  ],
};

/* ================================================================== */
/* Personal Productivity                                              */
/* ================================================================== */

const PERSONAL: PersonaPlanDefinition = {
  persona: "personal",
  label: "بهره‌وری شخصی",
  pageTitle: "برنامه زندگی‌ام را با ChatGPT بسازم",
  pageDescription:
    "حوزه‌های زندگی، اهداف، عادت‌ها و تعهدها را می‌دهی و یک برنامه متعادل هفتگی می‌گیری؛ سپس فایل آن را وارد می‌کنی.",
  promptTitle: "پرامپت ساخت برنامه شخصی",
  promptIntro:
    "این متن را در ChatGPT بچسبان؛ برنامه باید بین کار، خانواده، سلامتی و رشد تعادل برقرار کند.",
  planCategories: [
    "برنامه روز و هفته",
    "عادت‌ها و روتین‌ها",
    "بلوک تمرکز شخصی",
    "اقدام هدف‌ها",
    "بازبینی هفتگی",
  ],
  requiredData: [
    "حوزه‌های مهم زندگی",
    "هدف‌های شخصی",
    "تعهدهای ثابت خانواده و کار",
    "زمان در دسترس",
  ],
  optionalData: [
    "عادت‌های فعلی",
    "ورزش و سلامتی",
    "یادگیری و مطالعه شخصی",
    "تاریخ‌های مهم شخصی",
  ],
  planningRules: [
    "هیچ حوزه‌ای از زندگی را کاملاً نادیده نگیر.",
    "روز استراحت واقعی در هفته بگذار.",
    "عادت‌ها را کوچک و قابل انجام نگه دار (۱۵–۳۰ دقیقه).",
    "کار عمیق را اول روز بگذار و عصرها را سبک‌تر.",
    "جمع کارهای هر روز از زمان در دسترس بیشتر نشود.",
  ],
  outputExpectations: [
    "عادت‌های روزانه با تعداد هدف",
    "بلوک تمرکز و استراحت",
    "اقدام‌های هدف‌ها",
    "جلسه بازبینی هفتگی",
  ],
  examples: [
    "هر روز ۰۷:۰۰–۰۷:۲۰ مطالعه (عادت روزانه).",
    "جمعه ۱۸:۰۰ بازبینی هفته: چه چیزی جلو رفت، چه چیزی نه.",
  ],
  questionSections: [
    {
      key: "areas",
      title: "حوزه‌های زندگی",
      fields: [
        { key: "list", label: "حوزه‌های مهم زندگی", type: "text", placeholder: "کار، خانواده، سلامتی، یادگیری" },
        { key: "balance", label: "کدام حوزه کم‌ attention می‌گیرد؟", type: "text", hint: "اختیاری" },
      ],
    },
    {
      key: "goals",
      title: "هدف‌ها",
      fields: [
        { key: "short", label: "هدف‌های ۱ تا ۳ ماهه", type: "textarea" },
        { key: "long", label: "هدف بلندمدت", type: "text", hint: "اختیاری" },
        { key: "deadlines", label: "تاریخ‌های مهم", type: "text", hint: "اختیاری" },
      ],
    },
    {
      key: "commitments",
      title: "تعهدها",
      fields: [
        { key: "family", label: "تعهدهای خانوادگی", type: "textarea", hint: "اختیاری" },
        { key: "work", label: "تعهدهای کاری یا درسی", type: "textarea", hint: "اختیاری" },
        { key: "fixed", label: "روتین‌های ثابت هفتگی", type: "textarea", hint: "اختیاری" },
      ],
    },
    {
      key: "habits",
      title: "عادت‌ها و سلامتی",
      fields: [
        { key: "current", label: "عادت‌های فعلی", type: "textarea", hint: "اختیاری" },
        { key: "fitness", label: "ورزش و سلامتی", type: "text", hint: "اختیاری" },
        { key: "sleep", label: "ساعت خواب و بیداری", type: "text", hint: "اختیاری" },
      ],
    },
    {
      key: "time",
      title: "زمان در دسترس",
      fields: [
        { key: "hours", label: "ساعت شروع و پایان روز کاری", type: "text" },
        { key: "peak", label: "بهترین ساعت تمرکز", type: "text", hint: "اختیاری" },
        { key: "restDays", label: "روزهای سبک یا استراحت", type: "text", hint: "اختیاری" },
      ],
    },
  ],
};

/* ================================================================== */
/* Registry                                                           */
/* ================================================================== */

const DEFINITIONS: Record<string, PersonaPlanDefinition> = {
  student: STUDENT,
  employee: EMPLOYEE,
  freelancer: FREELANCER,
  manager: MANAGER,
  business_owner: BUSINESS_OWNER,
  personal: PERSONAL,
  custom: PERSONAL,
  team: MANAGER,
};

export function personaPlanDefinition(persona: string): PersonaPlanDefinition {
  return DEFINITIONS[persona] ?? PERSONAL;
}

/** Personas with their own questionnaire (used by the wizard switcher). */
export const SUPPORTED_AI_PLAN_PERSONAS: PersonaKey[] = [
  "student",
  "employee",
  "freelancer",
  "manager",
  "business_owner",
  "personal",
];

/** Shared 8-step "how it works" (§9). */
export const HOW_IT_WORKS: string[] = [
  "متن پرامپت را کپی کنید.",
  "ChatGPT (یا هر هوش مصنوعی دیگری) را باز کنید.",
  "پرامپت را جای‌گذاری کنید.",
  "به سؤال‌هایی که می‌پرسد پاسخ دهید.",
  "از او بخواهید فایل JSON برنامه را بسازد و دانلود کنید.",
  "به همین صفحه برگردید و فایل را رها کنید یا انتخاب کنید.",
  "قبل از اعمال، خلاصه و تعارض‌ها را بررسی کنید.",
  "با تأیید شما، برنامه وارد فضای کاری شما می‌شود.",
];
