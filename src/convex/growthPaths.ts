/**
 * Growth Paths ("مسیرهای رشد") catalog.
 *
 * Predefined, admin-extensible journeys. No AI, no external API: every mission
 * is either evaluated from real productivity data by the Convex engine or is a
 * manual habit-style check-off.
 *
 * Mission kinds:
 *  - tasks   : completed tasks since the stage started
 *  - routine : routine / habit check-ins since the stage started
 *  - days    : distinct active days since the stage started
 *  - xp      : XP earned since the stage started
 *  - streak  : current productivity streak
 *  - manual  : user checks it off (habits the app cannot measure)
 */

export type PathMissionKind = "tasks" | "routine" | "days" | "xp" | "streak" | "manual";

export interface PathMission {
  id: string;
  title: string;
  description: string;
  kind: PathMissionKind;
  target: number;
  xp: number;
}

export interface PathStage {
  key: string;
  title: string;
  days: number;
  /** Extra XP awarded when every mission of the stage is completed. */
  bonus: number;
  missions: PathMission[];
}

export type PathCategory =
  | "سلامت و تناسب اندام"
  | "رشد فردی"
  | "مطالعه و یادگیری"
  | "نظم و بهره‌وری"
  | "مهارت‌آموزی"
  | "تمرکز و آرامش"
  | "اهداف شخصی";

export type PathDifficulty = "آسان" | "متوسط" | "سخت";

export interface GrowthPath {
  key: string;
  title: string;
  emoji: string;
  category: PathCategory;
  difficulty: PathDifficulty;
  summary: string;
  goal: string;
  totalDays: number;
  /** XP awarded once, when the whole path is finished. */
  completionXp: number;
  stages: PathStage[];
}

export const PATH_CATEGORIES: PathCategory[] = [
  "سلامت و تناسب اندام",
  "رشد فردی",
  "مطالعه و یادگیری",
  "نظم و بهره‌وری",
  "مهارت‌آموزی",
  "تمرکز و آرامش",
  "اهداف شخصی",
];

export const PATH_DIFFICULTIES: PathDifficulty[] = ["آسان", "متوسط", "سخت"];

const m = (
  id: string,
  title: string,
  description: string,
  kind: PathMissionKind,
  target: number,
  xp: number,
): PathMission => ({ id, title, description, kind, target, xp });

export const GROWTH_PATHS: GrowthPath[] = [
  /* ---------------------------------------------------------------- */
  {
    key: "fitness",
    title: "مسیر ارتقای آمادگی جسمانی",
    emoji: "🏃",
    category: "سلامت و تناسب اندام",
    difficulty: "متوسط",
    summary: "تحرک، ورزش و روتین‌های سالم را به یک عادت پایدار تبدیل کن.",
    goal: "ساخت عادت حرکت روزانه و افزایش تدریجی فعالیت بدنی.",
    totalDays: 36,
    completionXp: 300,
    stages: [
      {
        key: "f1",
        title: "شروع حرکت",
        days: 5,
        bonus: 100,
        missions: [
          m("f1m1", "۳ روز پیاده‌روی ۳۰ دقیقه‌ای", "کار «پیاده‌روی» را روزانه کامل کن.", "days", 3, 40),
          m("f1m2", "۵ کار حرکتی را کامل کن", "هر فعالیت بدنی را به‌عنوان کار ثبت کن.", "tasks", 5, 30),
          m("f1m3", "ثبت فعالیت در تقویم", "یک روتین ورزشی بساز و یک روز کامل تیک بزن.", "routine", 1, 30),
        ],
      },
      {
        key: "f2",
        title: "ساخت عادت",
        days: 7,
        bonus: 100,
        missions: [
          m("f2m1", "۲ جلسه تمرین کامل", "دو جلسه تمرین را کامل انجام بده.", "manual", 2, 40),
          m("f2m2", "حفظ روتین صبحگاهی در ۵ روز", "روتین صبحگاهی را ۵ بار کامل کن.", "routine", 5, 50),
          m("f2m3", "پیوستگی ۵ روزه", "۵ روز فعال بدون وقفه.", "days", 5, 40),
        ],
      },
      {
        key: "f3",
        title: "افزایش فعالیت",
        days: 7,
        bonus: 100,
        missions: [
          m("f3m1", "۱۰ کار حرکتی در این مرحله", "فعالیت‌های بدنی را مستند کن.", "tasks", 10, 60),
          m("f3m2", "۳۰ دقیقه تمرین روزانه", "زمان تخمینی تمرین‌ها را ثبت کن.", "manual", 3, 40),
          m("f3m3", "۱۴۰ XP در این مرحله", "با فعالیت واقعی XP جمع کن.", "xp", 140, 40),
        ],
      },
      {
        key: "f4",
        title: "استمرار",
        days: 7,
        bonus: 120,
        missions: [
          m("f4m1", "زنجیره ۷ روزه", "یک هفته بدون وقفه فعال بمان.", "streak", 7, 60),
          m("f4m2", "۷ روز فعالیت ثبت‌شده", "هر روز حداقل یک فعالیت بدنی.", "days", 7, 60),
          m("f4m3", "۲۴۰ XP در این مرحله", "حجم فعالیتت را بالا ببر.", "xp", 240, 50),
        ],
      },
      {
        key: "f5",
        title: "چالش نهایی",
        days: 10,
        bonus: 150,
        missions: [
          m("f5m1", "۱۰ روز پیوستگی", "پایان مسیر با یک رکورد شخصی.", "days", 10, 80),
          m("f5m2", "۵ جلسه تمرین", "پنج جلسه تمرین کامل.", "manual", 5, 70),
          m("f5m3", "۳۵۰ XP در مرحله پایانی", "قبل از خط پایان.", "xp", 350, 60),
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    key: "growth",
    title: "مسیر رشد فردی",
    emoji: "🌱",
    category: "رشد فردی",
    difficulty: "متوسط",
    summary: "نظم شخصی، تأمل و یادگیری روزانه را در زندگی‌ات جا بینداز.",
    goal: "ساختن پایه‌های رشد: مطالعه، تأمل، و پیوستگی روزانه.",
    totalDays: 30,
    completionXp: 300,
    stages: [
      {
        key: "g1",
        title: "قدم اول",
        days: 5,
        bonus: 100,
        missions: [
          m("g1m1", "۵ کار شخصی را کامل کن", "کارهای مربوط به رشد خودت.", "tasks", 5, 40),
          m("g1m2", "یک روتین صبحگاهی بساز", "و آن را یک روز کامل انجام بده.", "routine", 1, 30),
          m("g1m3", "۳ روز فعال", "شروع پیوستگی.", "days", 3, 30),
        ],
      },
      {
        key: "g2",
        title: "ساختن نظم",
        days: 7,
        bonus: 100,
        missions: [
          m("g2m1", "۷ روز برنامه‌ریزی", "هر روز کارهایت را از پیش مشخص کن.", "days", 7, 60),
          m("g2m2", "۱۰ کار را کامل کن", "روی کارهای مهم‌تر تمرکز کن.", "tasks", 10, 50),
          m("g2m3", "۴ روز روتین کامل", "روتین روزانه را تمام کن.", "routine", 4, 50),
        ],
      },
      {
        key: "g3",
        title: "تعمیق عادت‌ها",
        days: 8,
        bonus: 120,
        missions: [
          m("g3m1", "۱۴ روز مطالعه یا یادگیری", "روزهایی که کار یادگیری داشتی.", "days", 8, 70),
          m("g3m2", "۲۰ کار در این مرحله", "حجم کار را بالا ببر.", "tasks", 20, 70),
          m("g3m3", "۲۰۰ XP در این مرحله", "نتیجه پیوستگی.", "xp", 200, 50),
        ],
      },
      {
        key: "g4",
        title: "استمرار",
        days: 7,
        bonus: 130,
        missions: [
          m("g4m1", "زنجیره ۷ روزه", "یک هفته کامل.", "streak", 7, 70),
          m("g4m2", "۵ روز روتین کامل", "نظم را ثابت کن.", "routine", 5, 60),
          m("g4m3", "۲۵۰ XP در این مرحله", "بالاترین آستانه تا اینجا.", "xp", 250, 60),
        ],
      },
      {
        key: "g5",
        title: "تکمیل مسیر",
        days: 3,
        bonus: 150,
        missions: [
          m("g5m1", "۱۲ کار نهایی", "خط پایان مسیر.", "tasks", 12, 80),
          m("g5m2", "۳ روز پایانی فعال", "بدون شکستن زنجیره.", "days", 3, 50),
          m("g5m3", "یک پروژه شخصی را ببند", "پروژه‌ای را به وضعیت تکمیل‌شده برسان.", "manual", 1, 80),
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    key: "study",
    title: "مسیر مطالعه و یادگیری",
    emoji: "📚",
    category: "مطالعه و یادگیری",
    difficulty: "متوسط",
    summary: "یک عادت مطالعه پایدار بساز و هر روز کمی جلوتر برو.",
    goal: "تبدیل مطالعه به بخشی ثابت از روز.",
    totalDays: 28,
    completionXp: 300,
    stages: [
      {
        key: "s1",
        title: "شروع",
        days: 4,
        bonus: 100,
        missions: [
          m("s1m1", "۳ روز مطالعه", "روزهایی که کار مطالعه‌ای کامل کردی.", "days", 3, 40),
          m("s1m2", "۴ کار مطالعه‌ای", "فصل یا مبحث مشخص.", "tasks", 4, 30),
          m("s1m3", "روتین مطالعه بساز", "و یک روز کامل تیک بزن.", "routine", 1, 30),
        ],
      },
      {
        key: "s2",
        title: "پیوستگی",
        days: 7,
        bonus: 110,
        missions: [
          m("s2m1", "۷ روز مطالعه", "بدون روز خالی.", "days", 7, 70),
          m("s2m2", "۱۰ کار مطالعه‌ای", "با تمرکز روی یک موضوع.", "tasks", 10, 60),
          m("s2m3", "۵ روز روتین مطالعه", "روتین مطالعه را کامل کن.", "routine", 5, 50),
        ],
      },
      {
        key: "s3",
        title: "عمق بیشتر",
        days: 8,
        bonus: 120,
        missions: [
          m("s3m1", "۱۸ کار مطالعه‌ای", "حجم یادگیری بالا.", "tasks", 18, 80),
          m("s3m2", "زنجیره ۷ روزه", "پیوستگی واقعی.", "streak", 7, 70),
          m("s3m3", "۲۲۰ XP در این مرحله", "حاصل تلاش.", "xp", 220, 50),
        ],
      },
      {
        key: "s4",
        title: "تسلط",
        days: 9,
        bonus: 150,
        missions: [
          m("s4m1", "۲۵ کار مطالعه‌ای", "خط پایان مسیر.", "tasks", 25, 90),
          m("s4m2", "۹ روز فعال پیوسته", "بدون وقفه.", "days", 9, 80),
          m("s4m3", "یک جمع‌بندی بنویس", "چیزی که یاد گرفتی را ثبت کن.", "manual", 1, 60),
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    key: "discipline",
    title: "مسیر هدف‌گذاری و نظم شخصی",
    emoji: "🎯",
    category: "نظم و بهره‌وری",
    difficulty: "آسان",
    summary: "برنامه‌ریزی، پیگیری و بستن کارها را به یک روتین تبدیل کن.",
    goal: "ساختن سیستم شخصی برای رسیدن به اهداف.",
    totalDays: 24,
    completionXp: 300,
    stages: [
      {
        key: "d1",
        title: "راه‌اندازی",
        days: 4,
        bonus: 100,
        missions: [
          m("d1m1", "۴ روز برنامه‌ریزی", "کارهای فردا را امشب مشخص کن.", "days", 4, 40),
          m("d1m2", "۵ کار را ببند", "روی برنامه بمان.", "tasks", 5, 30),
          m("d1m3", "یک پروژه بساز", "و برایش کار تعریف کن.", "manual", 1, 30),
        ],
      },
      {
        key: "d2",
        title: "اجرا",
        days: 7,
        bonus: 110,
        missions: [
          m("d2m1", "۱۲ کار کامل‌شده", "اجرای برنامه.", "tasks", 12, 60),
          m("d2m2", "۵ روز با امتیاز ۶۰+", "روزهای باکیفیت.", "days", 5, 50),
          m("d2m3", "۱۴۰ XP در این مرحله", "پاداش اجرا.", "xp", 140, 50),
        ],
      },
      {
        key: "d3",
        title: "پایداری",
        days: 7,
        bonus: 120,
        missions: [
          m("d3m1", "زنجیره ۷ روزه", "یک هفته منظم.", "streak", 7, 70),
          m("d3m2", "۲۰ کار در این مرحله", "تداوم.", "tasks", 20, 80),
          m("d3m3", "۵ روز روتین کامل", "نظم شخصی.", "routine", 5, 60),
        ],
      },
      {
        key: "d4",
        title: "تکمیل",
        days: 6,
        bonus: 150,
        missions: [
          m("d4m1", "یک پروژه را کامل کن", "هدف مشخصی را ببند.", "manual", 1, 90),
          m("d4m2", "۶ روز فعال پایانی", "پایان بدون وقفه.", "days", 6, 70),
          m("d4m3", "۳۰۰ XP در این مرحله", "خط پایان.", "xp", 300, 60),
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    key: "skills",
    title: "مسیر مهارت‌آموزی",
    emoji: "💻",
    category: "مهارت‌آموزی",
    difficulty: "سخت",
    summary: "یک مهارت مشخص را با تمرین روزانه و پروژه واقعی بساز.",
    goal: "پیشرفت قابل اندازه‌گیری در یک مهارت هدف.",
    totalDays: 35,
    completionXp: 350,
    stages: [
      {
        key: "k1",
        title: "انتخاب و شروع",
        days: 5,
        bonus: 110,
        missions: [
          m("k1m1", "مهارت هدفت را مشخص کن", "یک مهارت را انتخاب و ثبت کن.", "manual", 1, 40),
          m("k1m2", "۵ جلسه تمرین", "هر جلسه یک کار باشد.", "tasks", 5, 40),
          m("k1m3", "روتین تمرین روزانه", "و یک روز کامل انجامش بده.", "routine", 1, 30),
        ],
      },
      {
        key: "k2",
        title: "تمرین متمرکز",
        days: 10,
        bonus: 130,
        missions: [
          m("k2m1", "۱۵ جلسه تمرین", "تکرار هوشمند.", "tasks", 15, 80),
          m("k2m2", "زنجیره ۷ روزه", "بدون روز خالی.", "streak", 7, 80),
          m("k2m3", "۸ روز تمرین پیوسته", "پیوستگی واقعی.", "days", 8, 70),
        ],
      },
      {
        key: "k3",
        title: "ساخت پروژه",
        days: 12,
        bonus: 150,
        missions: [
          m("k3m1", "یک پروژه تمرینی بساز", "و آن را مدیریت کن.", "manual", 1, 90),
          m("k3m2", "۲۵ کار در این مرحله", "اجرای پروژه.", "tasks", 25, 100),
          m("k3m3", "۳۵۰ XP در این مرحله", "حجم تلاش.", "xp", 350, 80),
        ],
      },
      {
        key: "k4",
        title: "ارائه",
        days: 8,
        bonus: 180,
        missions: [
          m("k4m1", "پروژه را به پایان برسان", "نسخه نهایی.", "manual", 1, 120),
          m("k4m2", "۸ روز فعال پایانی", "بدون وقفه.", "days", 8, 80),
          m("k4m3", "۴۰۰ XP در مرحله پایانی", "خط پایان مسیر.", "xp", 400, 80),
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    key: "focus",
    title: "مسیر تمرکز و آرامش",
    emoji: "🧘",
    category: "تمرکز و آرامش",
    difficulty: "آسان",
    summary: "کاهش حواس‌پرتی، جلسات تمرکز عمیق و بازه‌های استراحت آگاهانه.",
    goal: "بالا بردن کیفیت تمرکز و کاهش کارهای پراکنده.",
    totalDays: 21,
    completionXp: 300,
    stages: [
      {
        key: "c1",
        title: "پاک‌سازی",
        days: 4,
        bonus: 100,
        missions: [
          m("c1m1", "صندوق ورودی را خالی کن", "همه کارها را سازماندهی کن.", "manual", 1, 40),
          m("c1m2", "۲ روز تمرکز عمیق", "کارهای فوری را ببند.", "days", 2, 30),
          m("c1m3", "روتین آرامش بساز", "و یک روز کامل تیک بزن.", "routine", 1, 30),
        ],
      },
      {
        key: "c2",
        title: "تمرکز عمیق",
        days: 7,
        bonus: 120,
        missions: [
          m("c2m1", "۱۲ کار متمرکز", "بدون کارهای پراکنده.", "tasks", 12, 70),
          m("c2m2", "۵ روز تمرکز پیوسته", "پیوستگی.", "days", 5, 60),
          m("c2m3", "۱۸۰ XP در این مرحله", "کیفیت بالای کار.", "xp", 180, 50),
        ],
      },
      {
        key: "c3",
        title: "آرامش پایدار",
        days: 6,
        bonus: 130,
        missions: [
          m("c3m1", "زنجیره ۷ روزه", "تمرکز بدون وقفه.", "streak", 7, 80),
          m("c3m2", "۶ روز روتین کامل", "عادت آرامش.", "routine", 6, 70),
          m("c3m3", "۲۰ کار قبل از خط پایان", "کارهای مهم را ببند.", "tasks", 20, 80),
        ],
      },
      {
        key: "c4",
        title: "پایان مسیر",
        days: 4,
        bonus: 150,
        missions: [
          m("c4m1", "۴ روز پایانی", "بدون حواس‌پرتی.", "days", 4, 60),
          m("c4m2", "بازبینی هفته", "یک بازبینی کوتاه ثبت کن.", "manual", 1, 60),
          m("c4m3", "۲۵۰ XP در این مرحله", "خط پایان.", "xp", 250, 60),
        ],
      },
    ],
  },
];

export function findPath(key: string): GrowthPath | undefined {
  return GROWTH_PATHS.find((p) => p.key === key);
}

export function pathStage(path: GrowthPath, index: number): PathStage | undefined {
  return path.stages[index];
}

export function pathTotalMissions(path: GrowthPath): number {
  return path.stages.reduce((n, s) => n + s.missions.length, 0);
}

/** XP available from stage missions + stage bonuses + completion bonus. */
export function pathMissionXp(path: GrowthPath): number {
  return path.stages.reduce((n, s) => n + s.missions.reduce((x, mm) => x + mm.xp, 0), 0);
}

export function pathTotalXp(path: GrowthPath): number {
  return pathMissionXp(path) + path.stages.reduce((n, s) => n + s.bonus, 0) + path.completionXp;
}

/** XP required to progress through the path (used for the progress ratio). */
export function pathProgressXp(path: GrowthPath, completedMissionIds: string[], stageBonuses: string[]): number {
  return path.stages.reduce(
    (n, s) =>
      n +
      s.missions.filter((mm) => completedMissionIds.includes(mm.id)).reduce((x, mm) => x + mm.xp, 0) +
      (stageBonuses.includes(s.key) ? s.bonus : 0),
    0,
  );
}

export const PATH_COLLECTIONS = [
  { key: "popular", label: "محبوب‌ترین‌ها" },
  { key: "beginner", label: "برای شروع" },
  { key: "short", label: "کوتاه‌مدت" },
  { key: "advanced", label: "پیشرفته" },
] as const;

export function collectionPaths(key: string): GrowthPath[] {
  switch (key) {
    case "beginner":
      return GROWTH_PATHS.filter((p) => p.difficulty === "آسان");
    case "short":
      return GROWTH_PATHS.filter((p) => p.totalDays <= 25);
    case "advanced":
      return GROWTH_PATHS.filter((p) => p.difficulty === "سخت");
    default:
      return GROWTH_PATHS.filter((p) => p.difficulty !== "آسان");
  }
}
