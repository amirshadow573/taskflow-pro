/**
 * Phase 17 — runtime validation for the Visual Timeline.
 *
 * The timeline's risk is not its styling, it is its ARITHMETIC: if the pixel
 * scale, the snap, the overlap packing or the conflict gate are wrong, the
 * user drags a block somewhere and the app silently lies. Those are pure
 * functions, so they are tested here for real rather than by eye.
 *
 * Pure modules only — no Convex, no React, no DOM.
 *
 * Covers §7 (grid), §9 (duration-sized blocks), §11 (density), §12/§36
 * (colour persistence), §15–§17 (move / resize / snap), §18 (conflict gate),
 * §20–§25 (adapter integration), §29 (overlap layout) and §53 (no fake data).
 *
 * Run:  bun run scripts/timeline-check.ts
 */
import {
  PX_PER_MINUTE,
  TIMELINE_SNAP_MINUTES,
  blockDensity,
  durationFa,
  gridLines,
  minutesToY,
  normalizeRange,
  rangeFa,
  snapMinutes,
  timeFa,
  visibleWindow,
  yToMinutes,
} from "../src/lib/timeline/timeline-grid";
import {
  asTimelineColorKey,
  resolveActivityColor,
  TIMELINE_COLOR_KEYS,
  TIMELINE_COLORS,
} from "../src/lib/timeline/timeline-colors";
import {
  buildDayActivities,
  hhmm,
  layoutDay,
  snapMove,
  snapResize,
  validateMove,
  type FixedCommitment,
  type TimelineActivity,
  type TimelineBlockRow,
} from "../src/lib/timeline/timeline-model";
import { DEFAULT_SCHEDULE_PREFS } from "../src/lib/preferences";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) {
    passed++;
    console.log("  ok   " + name);
  } else {
    failed++;
    console.log("  FAIL " + name);
  }
}

const WIN = { start: 6 * 60, end: 22 * 60 };

/** Minimal block factory for the adapter + layout tests. */
function block(over: Partial<TimelineBlockRow> & { _id: string }): TimelineBlockRow {
  return {
    title: "بلوک",
    day: "2026-10-01",
    startTime: "09:00",
    endTime: "10:00",
    kind: "task",
    status: "planned",
    fixed: false,
    source: "manual",
    ...over,
  };
}

function activity(over: Partial<TimelineActivity> & { key: string }): TimelineActivity {
  return {
    origin: "block",
    day: "2026-10-01",
    title: "کار",
    start: 9 * 60,
    end: 10 * 60,
    kind: "task",
    status: "planned",
    fixed: false,
    colorKey: "blue",
    storedColor: null,
    ...over,
  };
}

console.log("\n── grid geometry (§7, §9) ──");
check("۳۰ دقیقه پیش‌فرض است", TIMELINE_SNAP_MINUTES === 30);
check("پیکس بر دقیقه مثبت و معقول است", PX_PER_MINUTE > 0.5 && PX_PER_MINUTE <= 3);
check("تبدیل دقیقه↔پیکس رفت‌وبرگشتی است", yToMinutes(minutesToY(123)) === 123);
check("یک ساعت ۷۲ پیکس است", minutesToY(60) === 72);

const lines = gridLines(WIN, 30);
check("خطوط شبکه برای ۱۶ ساعت = ۳۲ خط ۳۰ دقیقه‌ای", lines.length === 33);
check("فقط ساعت کامل برچسب دارد", lines.filter((l) => l.labelled).length === 17);
check("اولین خط در سقف پنجره است", lines[0].minutes === WIN.start);

console.log("\n── window from real availability (§8) ──");
const win = visibleWindow({ start: 8 * 60, end: 22 * 60 }, []);
check("بازه خالی = بازه کاری کاربر + ۳۰ دقیقه نفس", win.start === 7 * 60 + 30 && win.end === 22 * 60 + 30);
check("پنجره روی شبکه می‌ماند", win.start % 30 === 0 && win.end % 30 === 0);
const wide = visibleWindow({ start: 8 * 60, end: 22 * 60 }, [{ start: 6 * 60, end: 23 * 60 }]);
check("محتوای خارج از بازه گسترش می‌دهد، نه اینکه بریده شود", wide.start <= 6 * 60 && wide.end >= 23 * 60);
check("پنجره هرگز خالی نمی‌شود", visibleWindow({ start: 9 * 60, end: 9 * 60 }, []).end > 9 * 60);

console.log("\n── snapping (§17) ──");
check("۰۹:۰۷ به نزدیک‌ترین نیم ساعت می‌رود", snapMinutes(9 * 60 + 7) === 9 * 60);
check("۰۹:۲۰ به ۰۹:۳۰ می‌رود", snapMinutes(9 * 60 + 20) === 9 * 60 + 30);
check("۰۹:۴۶ به ۱۰:۰۰ می‌رود (نزدیک‌ترین نیم‌ساعت)", snapMinutes(9 * 60 + 46) === 10 * 60);
check("مقدار غیرممکن تولید نمی‌شود", snapMinutes(9 * 60 + 7) % TIMELINE_SNAP_MINUTES === 0);

const nr = normalizeRange(600, 540);
check("بازه معکوس نرمال می‌شود", nr.start === 540 && nr.end === 600);
const tiny = normalizeRange(600, 600);
check("بازه صفر به حداقل مدت تبدیل می‌شود", tiny.end > tiny.start);

console.log("\n── move keeps the real duration (§15) ──");
const moved = snapMove({ start: 540, end: 630 }, 200, WIN);
check("مدت واقعی حفظ می‌شود", moved.end - moved.start === 90);
check("شروع روی شبکه می‌نشیند", moved.start % 30 === 0);
const clamped = snapMove({ start: 540, end: 630 }, 10_000, WIN);
check("خارج از پنجره کلیپ می‌شود", clamped.end <= WIN.end && clamped.start >= WIN.start);

console.log("\n── resize edges (§16) ──");
const grown = snapResize({ start: 540, end: 600 }, "end", 45, WIN);
check("کشیدن لبه پایین مدت را زیاد می‌کند", grown.end === 660 && grown.start === 540);
const shrunk = snapResize({ start: 540, end: 600 }, "end", -600, WIN);
check("پایین‌تر از کمینه نمی‌رود", shrunk.end - shrunk.start >= 15);
check("کمینه هم روی شبکه است", shrunk.end % 30 === 0);
const top = snapResize({ start: 540, end: 600 }, "start", 60, WIN);
check("کشیدن لبه بالا شروع را جابه‌جا و پایان را ثابت نگه می‌دارد", top.start === 570 && top.end === 600);
check("لبه بالا هرگز از پایین عبور نمی‌کند", top.end > top.start);
check("لبه بالا روی شبکه می‌ماند (نه ۰۹:۴۵)", top.start % 30 === 0);
const topNoop = snapResize({ start: 540, end: 600 }, "start", 0, WIN);
check("بدون جابه‌جایی، بدون تغییر", topNoop.start === 540 && topNoop.end === 600);
const topClamp = snapResize({ start: 540, end: 600 }, "start", -10_000, WIN);
check("لبه بالا از سقف پنجره بیرون نمی‌رود", topClamp.start >= WIN.start);
check("لبه بالای کلیپ‌شده هم روی شبکه است", topClamp.start % 30 === 0);
const endClamp = snapResize({ start: 540, end: 600 }, "end", 10_000, WIN);
check("لبه پایین از کف پنجره بیرون نمی‌رود", endClamp.end <= WIN.end);
check("لبه پایین کلیپ‌شده هم روی شبکه است", endClamp.end % 30 === 0);

console.log("\n── overlap layout (§29) ──");
const solo = layoutDay([activity({ key: "a" })], WIN);
check("یک بلوک تمام عرض ستون را می‌گیرد", Math.abs(solo[0].widthPct - 94) < 0.01);
check("جابه‌جایی عمودی از مدت می‌آید", solo[0].top === minutesToY(180) + 1);

const pair = layoutDay(
  [
    activity({ key: "a", start: 540, end: 600 }),
    activity({ key: "b", start: 570, end: 630 }),
  ],
  WIN,
);
check("دو بلوک هم‌پوشان کنار هم می‌نشینند", pair[0].lanes === 2 && pair[1].lanes === 2);
check("ستون‌های متفاوت دارند", pair[0].lane !== pair[1].lane);
check("مجموع عرض + فاصله = عرض ستون", Math.abs(pair[0].leftPct + pair[0].widthPct - 47) < 0.01);

const noOverlap = layoutDay(
  [
    activity({ key: "a", start: 540, end: 600 }),
    activity({ key: "b", start: 660, end: 720 }),
  ],
  WIN,
);
check("بدون هم‌پوشانی هر دو تمام‌عرض‌اند", noOverlap.every((p) => p.lanes === 1));

const transitive = layoutDay(
  [
    activity({ key: "a", start: 540, end: 660 }),
    activity({ key: "b", start: 600, end: 720 }),
    activity({ key: "c", start: 660, end: 780 }),
  ],
  WIN,
);
check("هم‌پوشانی زنجیره‌ای یک خوشه است", transitive.every((p) => p.lanes === 2));
check("هیچ‌کدام روی هم انباشته نمی‌شوند", new Set(transitive.map((p) => p.lane)).size === 2);

const durationSized = layoutDay(
  [activity({ key: "a", start: 540, end: 570 })],
  WIN,
);
check("بلوک ۳۰ دقیقه‌ای از ۶۰ دقیقه‌ای کوتاه‌تر است", durationSized[0].height < 72);

console.log("\n── density-aware text (§11) ──");
check("بلوک خیلی کوتاه فقط عنوان نشان می‌دهد", blockDensity(20).compact && !blockDensity(20).showTime);
check("بلوک متوسط زمان را نشان می‌دهد", blockDensity(60).showTime && !blockDensity(60).showDescription);
check("بلوک بلند توضیحات را نشان می‌دهد", blockDensity(140).showDescription);

console.log("\n── colour palette (§12, §13, §36) ──");
check("۱۶ رنگ وجود دارد", TIMELINE_COLOR_KEYS.length === 16);
check("کلیدها یکتا هستند", new Set(TIMELINE_COLOR_KEYS).size === 16);
check("هر رنگ برچسب فارسی دارد", TIMELINE_COLOR_KEYS.every((k) => !!TIMELINE_COLORS[k].labelFa));
check("هر رنگ سطح و برچسب دارد", TIMELINE_COLOR_KEYS.every((k) => !!TIMELINE_COLORS[k].surface && !!TIMELINE_COLORS[k].surfaceDark));
check("رنگ ناشناخته رد می‌شود", asTimelineColorKey("chartreuse") === null);
check("رنگ ذخیره‌شده برگردانده می‌شود", asTimelineColorKey("violet") === "violet");
check("رنگ ذخیره‌شده بر fallback مقدم است", resolveActivityColor("violet", "meeting") === "violet");
check("بدون رنگ، از نوع بلوک مشتق می‌شود", resolveActivityColor(undefined, "study") === "violet");
check("نوع ناشناخته به خاکستری می‌رسد", resolveActivityColor(null, "مجهول") === "slate");
check("رنگ معنی تحمیلی ندارد (دو نوع، دو رنگ متفاوت ممکن است)", resolveActivityColor(null, "task") !== resolveActivityColor(null, "meeting"));

console.log("\n── adapter: real sources only (§20–§25, §43, §53) ──");
const tasks = [
  { _id: "t1", title: "تمام فصل زیست", status: "todo", priority: "high", estimateMinutes: 90 },
  { _id: "t2", title: "کار تمام‌شده", status: "done", priority: "low" },
];
const projects = [{ _id: "p1", name: "بازطراحی سایت" }];
const goals = [{ _id: "g1", title: "رشد مهارتی" }];
const routineItems = [{ _id: "r1", title: "ورزش صبح" }];
const habits = [{ _id: "h1", title: "مدیتیشن" }];

const acts = buildDayActivities({
  day: "2026-10-01",
  tasks,
  projects,
  goals,
  routineItems,
  habits,
  blocks: [
    block({ _id: "b1", taskId: "t1", projectId: "p1", goalId: "g1", notes: "مرور فصل سوم\nحل تست‌ها" }),
    block({ _id: "b2", routineId: "r1", startTime: "07:00", endTime: "08:00", kind: "routine" }),
    block({ _id: "b3", habitId: "h1", startTime: "08:00", endTime: "08:15", kind: "other" }),
    block({ _id: "b4", color: "violet" }),
    block({ _id: "b5", startTime: "bad", endTime: "worse" }),
    block({ _id: "b6", title: "   ", taskId: "t1" }),
  ],
  commitments: [{ id: "e1", title: "کلاس زیست", day: "2026-10-01", startTime: "11:00", endTime: "12:00", origin: "event", type: "class" }],
});

check("بلوک با بازه نامعتبر حذف می‌شود (زمان ساختگی نمی‌سازیم)", acts.every((a) => a.blockId !== "b5"));
check("رویداد تقویم هم وارد خط زمانی می‌شود", acts.some((a) => a.title === "کلاس زیست" && a.origin === "event"));
check("رویداد ثابت قابل جابه‌جایی نیست", acts.find((a) => a.title === "کلاس زیست")?.fixed === true);
const b1 = acts.find((a) => a.blockId === "b1");
check("کار متصل حفظ می‌شود", b1?.taskTitle === "تمام فصل زیست");
check("پروژه متصل حفظ می‌شود", b1?.projectName === "بازطراحی سایت");
check("هدف متصل حفظ می‌شود", b1?.goalTitle === "رشد مهارتی");
check("توضیحات چندخطی حفظ می‌شود", b1?.description === "مرور فصل سوم\nحل تست‌ها");
check("منبع بلوک = کار", b1?.origin === "task");
check("روتین قابل ردیابی است", acts.find((a) => a.blockId === "b2")?.origin === "routine");
check("عادت قابل ردیابی است", acts.find((a) => a.blockId === "b3")?.origin === "habit");
check("رنگ ذخیره‌شده بازیابی می‌شود", acts.find((a) => a.blockId === "b4")?.colorKey === "violet");
check("رنگ ذخیره‌نشده null است", acts.find((a) => a.blockId === "b4")?.storedColor === "violet");
check("بلوک بدون عنوان از کار نام می‌گیرد", acts.find((a) => a.blockId === "b6")?.title === "تمام فصل زیست");
check("بلوک با عنوان خودش عنوانش را نگه می‌دارد", acts.find((a) => a.blockId === "b4")?.title === "بلوک");
check("وضعیت انجام کار تشخیص داده می‌شود", acts.find((a) => a.blockId === "b1")?.taskDone === false);

const empty = buildDayActivities({
  day: "2026-10-01",
  tasks: [], projects: [], goals: [], routineItems: [], habits: [],
  blocks: [], commitments: [],
});
check("فضای کاری خالی، داده ساختگی نمی‌سازد", empty.length === 0);

console.log("\n── conflict gate (§18, §19) ──");
const row = block({ _id: "b1", taskId: "t1" });
const others = [
  activity({ key: "x", blockId: "bX", start: 11 * 60, end: 12 * 60 }),
];
const clean = validateMove({
  day: "2026-10-01",
  prefs: DEFAULT_SCHEDULE_PREFS,
  block: row,
  activities: others,
  commitments: [],
  tasksById: new Map(tasks.map((t) => [t._id, t])),
  proposal: { day: "2026-10-01", start: 14 * 60, end: 15 * 60 + 30 },
});
check("جابه‌جایی به ساعت آزاد با مدت کافی مجاز است", clean.blocking.length === 0);

const clash = validateMove({
  day: "2026-10-01",
  prefs: DEFAULT_SCHEDULE_PREFS,
  block: row,
  activities: others,
  commitments: [],
  tasksById: new Map(tasks.map((t) => [t._id, t])),
  proposal: { day: "2026-10-01", start: 11 * 60, end: 12 * 60 + 30 },
});
check("تداخل با بلوک دیگر گرفته می‌شود", clash.conflicts.some((c) => c.kind === "overlap"));
const hasPersian = /[\u0600-\u06FF]/;
check("هر تعارض پیام فارسی دارد", clash.blocking.length > 0 && clash.blocking.every((c) => c.detail.length > 5 && hasPersian.test(c.detail)));

const ontoEvent = validateMove({
  day: "2026-10-01",
  prefs: DEFAULT_SCHEDULE_PREFS,
  block: row,
  activities: [],
  commitments: [{ id: "e1", title: "کلاس", day: "2026-10-01", startTime: "09:00", endTime: "10:00", origin: "event", type: "class" }] as FixedCommitment[],
  tasksById: new Map(tasks.map((t) => [t._id, t])),
  proposal: { day: "2026-10-01", start: 9 * 60, end: 10 * 60 },
});
check("تداخل با تعهد ثابت گرفته می‌شود", ontoEvent.blocking.length > 0);

const outside = validateMove({
  day: "2026-10-01",
  prefs: DEFAULT_SCHEDULE_PREFS,
  block: row,
  activities: [],
  commitments: [],
  tasksById: new Map(tasks.map((t) => [t._id, t])),
  proposal: { day: "2026-10-01", start: 3 * 60, end: 4 * 60 },
});
check("بیرون از بازه کاری گرفته می‌شود", outside.blocking.some((c) => c.kind === "outside_window"));

const shortBlock = validateMove({
  day: "2026-10-01",
  prefs: DEFAULT_SCHEDULE_PREFS,
  block: row,
  activities: [],
  commitments: [],
  tasksById: new Map(tasks.map((t) => [t._id, t])),
  proposal: { day: "2026-10-01", start: 14 * 60, end: 14 * 60 + 30 },
});
check("کوتاه‌تر از تخمین کار هشدار می‌دهد", shortBlock.conflicts.some((c) => c.kind === "insufficient_duration"));
check("بلوک متصل به کار تخمین واقعی دارد", block({ _id: "x", taskId: "t1" }).taskId === "t1");

console.log("\n── formatting ──");
check("hhmm درست است", hhmm(570) === "09:30");
check("hhmm وسط شب را محدود می‌کند", hhmm(-50) === "00:00" && hhmm(5000) === "23:59");
check("ساعت فارسی ۲ رقمی است", timeFa(570) === "۰۹:۳۰");
check("بازه فارسی دارد", rangeFa(540, 630).includes("۰۹:۰۰") && rangeFa(540, 630).includes("۱۰:۳۰"));
check("مدت یک ساعته فارسی است", durationFa(60) === "۱ ساعت");
check("مدت ۹۰ دقیقه‌ای فارسی است", durationFa(90) === "۱ ساعت و ۳۰ دقیقه");
check("مدت دقیقه‌ای فارسی است", durationFa(25) === "۲۵ دقیقه");

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
