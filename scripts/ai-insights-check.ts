/**
 * Phase 16 — runtime validation for the AI Insights layer.
 *
 * The centrepiece of these tests is the HONESTY GUARANTEE: patterns exist only
 * when the deterministic engine proves them, and a model response can never
 * introduce a pattern the engine did not find (§10, §11, §28).
 *
 * Pure modules only — no Convex, no React, no provider, no API key.
 *
 * Covers §9 (six personas), §10 (pattern types), §11 (confidence),
 * §22 (failure honesty) and §26 (security).
 *
 * Run:  bun run scripts/ai-insights-check.ts
 */
import {
  detectPatterns,
  isInsufficientEvidence,
  MIN_SAMPLES,
  type PatternInput,
} from "../src/lib/ai/patterns";
import { parseInsightResponse } from "../src/lib/ai/insight-parser";
import {
  buildInsightSystemPrompt,
  insightPersonaDefinition,
  insightQuickActions,
  INSIGHT_SUPPORTED_PERSONAS,
  DAILY_SECTION_KEYS,
  WEEKLY_SECTION_KEYS,
} from "../src/lib/ai/insight-prompts";
import {
  aggregateInsightContext,
  renderInsightContextForModel,
  type InsightContextInput,
} from "../src/lib/ai/insight-context";
import {
  AI_PATTERN_TYPES,
  AI_INSIGHT_SCHEMA_VERSION,
  CONFIDENCE_LABELS_FA,
  PATTERN_LABELS_FA,
  type DetectedPattern,
} from "../src/lib/ai/insight-types";

let failed = 0;
let passed = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

/** A workspace with no history at all. */
function emptyInput(over: Partial<InsightContextInput> = {}): InsightContextInput {
  return {
    persona: "employee",
    window: "7d",
    todayKey: "2026-09-29",
    availability: { dayStart: "08:00", dayEnd: "17:00", breakMinutes: 15, maxFocusMinutes: 90 },
    tasks: [],
    blocks: [],
    sessions: [],
    goals: [],
    projects: [],
    routineDays: [],
    habits: [],
    rescheduleCount: 0,
    domainContext: [],
    ...over,
  };
}

function basePatternInput(over: Partial<PatternInput> = {}): PatternInput {
  return {
    window: "7d",
    postponed: [],
    estimates: [],
    workload: [],
    plannedCount: 0,
    completedCount: 0,
    scheduledMinutes: 0,
    actualMinutes: 0,
    focusSessions: 0,
    interruptedSessions: 0,
    shortSessionCount: 0,
    routineDays: [],
    habits: [],
    goals: [],
    projects: [],
    blockedTasks: [],
    rescheduleCount: 0,
    ...over,
  };
}

function doc(body: Record<string, unknown>): string {
  return JSON.stringify({ schema_version: AI_INSIGHT_SCHEMA_VERSION, persona: "employee", ...body });
}

/* ================================================================== */
section("1) بدون داده ⇒ بدون الگو (§11)");

const emptyAgg = aggregateInsightContext(emptyInput());
check("فضای خالی دادهٔ ناکافی اعلام می‌شود", emptyAgg.insufficient);
check("فضای خالی هیچ الگویی نمی‌سازد", emptyAgg.patterns.length === 0);
check("تشخیص ناکافی هم درست است", isInsufficientEvidence(basePatternInput()));

const thin = detectPatterns(basePatternInput({ focusSessions: 2, completedCount: 1 }));
check("دادهٔ نازک الگو نمی‌سازد", thin.length === 0);

/* ================================================================== */
section("2) تشخیص قطعی الگوها (§3, §10)");

const delay = detectPatterns(
  basePatternInput({
    postponed: [
      { id: "t1", title: "الف", postponeCount: 4, overdue: true },
      { id: "t2", title: "ب", postponeCount: 3, overdue: false },
    ],
  }),
);
check("تعویق مکرر تشخیص داده می‌شود", delay.some((p) => p.type === "repeated_delay"));
check("تعداد نمونه در یافته ثبت می‌شود", (delay.find((p) => p.type === "repeated_delay")?.sampleSize ?? 0) === 2);

const under = detectPatterns(
  basePatternInput({
    estimates: Array.from({ length: 6 }, (_, i) => ({
      id: `t${i}`,
      title: `کار ${i}`,
      estimateMinutes: 30,
      actualMinutes: 60,
    })),
  }),
);
check("کم‌برآوردی زمان تشخیص داده می‌شود", under.some((p) => p.type === "duration_underestimation"));

const accurate = detectPatterns(
  basePatternInput({
    estimates: Array.from({ length: 6 }, (_, i) => ({
      id: `t${i}`,
      title: `کار ${i}`,
      estimateMinutes: 30,
      actualMinutes: 31,
    })),
  }),
);
check("تخمین دقیق ⇒ الگوی برآورد ساخته نمی‌شود", !accurate.some((p) => p.type.includes("estimation")));

const overloaded = detectPatterns(
  basePatternInput({
    workload: [
      { day: "2026-09-27", plannedMinutes: 600, capacityMinutes: 480 },
      { day: "2026-09-28", plannedMinutes: 700, capacityMinutes: 480 },
      { day: "2026-09-29", plannedMinutes: 900, capacityMinutes: 480 },
    ],
  }),
);
check("بار بیش از ظرفیت تشخیص داده می‌شود", overloaded.some((p) => p.type === "workload_overload"));

const noOverload = detectPatterns(
  basePatternInput({
    workload: [
      { day: "2026-09-27", plannedMinutes: 200, capacityMinutes: 480 },
      { day: "2026-09-28", plannedMinutes: 100, capacityMinutes: 480 },
      { day: "2026-09-29", plannedMinutes: 50, capacityMinutes: 480 },
    ],
  }),
);
check("بار متعادل ⇒ الگو ساخته نمی‌شود", !noOverload.some((p) => p.type === "workload_overload"));

const frag = detectPatterns(
  basePatternInput({ focusSessions: 10, shortSessionCount: 6, interruptedSessions: 1 }),
);
check("پراکندگی تمرکز تشخیص داده می‌شود", frag.some((p) => p.type === "focus_fragmentation"));

const goals = detectPatterns(
  basePatternInput({
    goals: [
      { id: "g1", title: "الف", progress: 20, daysSinceUpdate: 30 },
      { id: "g2", title: "ب", progress: 40, daysSinceUpdate: 21 },
    ],
  }),
);
check("رکود هدف تشخیص داده می‌شود", goals.some((p) => p.type === "goal_stagnation"));

const freshGoals = detectPatterns(
  basePatternInput({
    goals: [{ id: "g1", title: "الف", progress: 20, daysSinceUpdate: 1 }],
  }),
);
check("هدف تازه ⇒ الگو ساخته نمی‌شود", !freshGoals.some((p) => p.type === "goal_stagnation"));

check(
  "همهٔ الگوهای تولیدشده نوع شناخته‌شده دارند",
  [...delay, ...under, ...overloaded, ...frag, ...goals].every((p) =>
    (AI_PATTERN_TYPES as readonly string[]).includes(p.type),
  ),
);
check(
  "هر الگو شواهد غیرخالی دارد",
  [...delay, ...under, ...overloaded, ...frag, ...goals].every((p) => p.evidence.length > 0),
);
check(
  "هر الگو بازهٔ زمانی دارد",
  [...delay, ...under, ...overloaded, ...frag, ...goals].every((p) => !!p.timeWindow),
);

/* ================================================================== */
section("3) مدل نمی‌تواند الگو بسازد (§11, §26)");

const proven: DetectedPattern[] = [
  {
    type: "repeated_delay",
    severity: "warning",
    confidence: "strong_pattern",
    timeWindow: "7d",
    evidence: [{ label: "کارهای تعویق‌خورده", value: "2" }],
    affectedEntityIds: ["t1"],
    sampleSize: 2,
    statement: "۲ کار تعویق خورده‌اند.",
  },
];

const sources = ["facts"];

/* --- fabricated pattern is dropped --- */
const fabricated = parseInsightResponse(
  doc({
    response_type: "insight",
    summary: "خلاصه",
    interpretations: [
      { pattern_type: "focus_fragmentation", explanation: "تمرکز تکه‌تکه است.", recommendation: "" },
    ],
  }),
  { persona: "employee", proven, contextSources: sources },
);
check("پاسخ معتبر است", fabricated.ok === true);
check(
  "الگوی ساختگی حذف می‌شود",
  fabricated.ok && fabricated.data!.response.interpretations.length === 0,
);
check(
  "دلیل حذف الگوی ساختگی به کاربر گفته می‌شود",
  fabricated.ok &&
    fabricated.data!.response.warnings.some((w) => w.includes("تشخیص داده نشده")),
);

/* --- unknown pattern type --- */
const unknownType = parseInsightResponse(
  doc({
    response_type: "insight",
    summary: "خلاصه",
    interpretations: [{ pattern_type: "made_up_pattern", explanation: "x" }],
  }),
  { persona: "employee", proven, contextSources: sources },
);
check("نوع ناشناخته حذف می‌شود", unknownType.ok && unknownType.data!.response.interpretations.length === 0);

/* --- legitimate interpretation survives --- */
const good = parseInsightResponse(
  doc({
    response_type: "insight",
    summary: "خلاصه",
    interpretations: [
      {
        pattern_type: "repeated_delay",
        explanation: "این کارها بار زیادی روی هفتهٔ آینده می‌گذارند.",
        recommendation: "یکی را جلو بیندازید.",
        severity: "info",
        confidence: "emerging_pattern",
        additional_evidence: [{ label: "میانگین تعویق", value: "۳ بار" }],
      },
    ],
  }),
  { persona: "employee", proven, contextSources: sources },
);
check("تفسیر معتبر پذیرفته می‌شود", good.ok && good.data!.response.interpretations.length === 1);
check(
  "شدتِ قطعی بر تفسیر مدل غلبه می‌کند (مدل info داده ولی قطعی warning است)",
  good.ok && good.data!.response.interpretations[0].severity === "warning",
);
check(
  "اعتمادِ قطعی بر ادعای مدل غلبه می‌کند (مدل emerging داده ولی قطعی strong است)",
  good.ok && good.data!.response.interpretations[0].confidence === "strong_pattern",
);
check(
  "اطلاعات تکمیلی مدل نگه داشته می‌شود",
  good.ok && good.data!.response.interpretations[0].additionalEvidence.length === 1,
);
check("الگوی توضیح‌داده‌نشده گزارش می‌شود", good.ok && good.data!.unexplainedPatterns.length === 0);

/* --- malformed / hostile payloads --- */
check("خروجی خالی رد می‌شود", parseInsightResponse("", { persona: "employee", proven, contextSources: sources }).failure === "empty_response");
check("بدون JSON رد می‌شود", parseInsightResponse("متن آزاد", { persona: "employee", proven, contextSources: sources }).failure === "invalid_response");
check(
  "JSON خراب رد می‌شود",
  parseInsightResponse("{ broken", { persona: "employee", proven, contextSources: sources }).failure === "invalid_response",
);
check(
  "نسخهٔ ناشناخته رد می‌شود",
  parseInsightResponse(JSON.stringify({ schema_version: "9.9", summary: "x" }), {
    persona: "employee",
    proven,
    contextSources: sources,
  }).failure === "invalid_response",
);
check(
  "خلاصهٔ خالی رد می‌شود",
  parseInsightResponse(doc({ response_type: "insight", summary: "" }), {
    persona: "employee",
    proven,
    contextSources: sources,
  }).failure === "invalid_response",
);

/* --- refusal with actions (§28) --- */
const refusal = parseInsightResponse(
  doc({
    response_type: "insight",
    summary: "نمی‌توانم",
    actions: [{ type: "delete_task", target_id: "t1", reason: "پاک کن" }],
  }),
  { persona: "employee", proven, contextSources: sources },
);
check("اقدام حذف از فیلتر بینش هم رد می‌شود", refusal.ok && refusal.data!.response.actions.length === 0);

const destructive = parseInsightResponse(
  doc({
    response_type: "insight",
    summary: "خلاصه",
    actions: [
      { type: "reschedule_task", target_id: "'; DROP TABLE tasks; --", target_date: "2026-10-01", reason: "r" },
      { type: "reschedule_task", target_id: "t9", target_date: "2026-13-45", reason: "r" },
    ],
  }),
  { persona: "employee", proven, contextSources: sources },
);
check("شناسهٔ تزریقی رد می‌شود", destructive.ok && destructive.data!.response.actions.length === 0);
check("تاریخ غیرممکن رد می‌شود", destructive.ok && destructive.data!.response.actions.length === 0);
check("هشدار برای موارد کنارگذاشته‌شده هست", destructive.ok && destructive.data!.response.warnings.length > 0);

/* ================================================================== */
section("4) مرور روزانه و هفتگی (§7, §8)");

const daily = parseInsightResponse(
  doc({
    response_type: "review",
    summary: "مرور امروز",
    sections: [
      { key: "went_well", lines: ["۳ کار مهم تمام شد"] },
      { key: "tomorrow_risk", lines: ["۳ سررسید در فردا"] },
      { key: "made_up_section", lines: ["بخش ساختگی"] },
    ],
  }),
  { persona: "employee", proven, contextSources: sources, allowedSections: DAILY_SECTION_KEYS },
);
check("مرور روزانه معتبر است", daily.ok === true);
check("بخش‌های مجاز روزانه پذیرفته می‌شوند", daily.ok && daily.data!.response.sections.length === 2);
check("بخش ساختگی حذف می‌شود", daily.ok && daily.data!.response.sections.every((s) => s.key !== "made_up_section"));

const weekly = parseInsightResponse(
  doc({
    response_type: "review",
    summary: "مرور هفته",
    sections: WEEKLY_SECTION_KEYS.map((k) => ({ key: k, lines: [`خط ${k}`] })),
  }),
  { persona: "employee", proven, contextSources: sources, allowedSections: WEEKLY_SECTION_KEYS },
);
check("هر ده بخش هفتگی پذیرفته می‌شود", weekly.ok && weekly.data!.response.sections.length === WEEKLY_SECTION_KEYS.length);

check("کلیدهای روزانه ثابت‌اند", DAILY_SECTION_KEYS.length === 6);
check("کلیدهای هفتگی ثابت‌اند", WEEKLY_SECTION_KEYS.length === 10);

/* ================================================================== */
section("5) شش شخصیت (§9)");

const insightPrompts = new Map<string, string>();
for (const p of INSIGHT_SUPPORTED_PERSONAS) {
  const prompt = buildInsightSystemPrompt(p, "insight", ["repeated_delay"]);
  insightPrompts.set(p, prompt);
  check(`پرامپت بینش برای ${p} ساخته شد`, prompt.length > 250);
}
check("شش پرامپت بینش کاملاً متفاوت‌اند", new Set([...insightPrompts.values()]).size === 6);
check(
  "پیشنهادهای سریع هر شخصیت متفاوت است",
  new Set(INSIGHT_SUPPORTED_PERSONAS.map((p) => insightQuickActions(p).join("|"))).size === 6,
);
check(
  "پرامپت فقط الگوهای مجاز را می‌نامد",
  buildInsightSystemPrompt("student", "insight", ["repeated_delay"]).includes("repeated_delay") &&
    !buildInsightSystemPrompt("student", "insight", ["repeated_delay"]).includes("habit_break"),
);
check(
  "وقتی الگویی نیست، مدل صریحاً محدود می‌شود",
  buildInsightSystemPrompt("student", "insight", []).includes("هیچ الگویی شناسایی نشده"),
);
check(
  "پرامپت ساختن الگو را ممنوع می‌کند",
  buildInsightSystemPrompt("manager", "insight", ["workload_overload"]).includes("ممنوع است الگویی بسازی"),
);
check("شخصیت مدیر تیمی است", insightPersonaDefinition("manager").focus.includes("تیم"));
check("تیم به مدیر نگاشت می‌شود", insightPersonaDefinition("team").persona === "manager");
check("شخصیت ناشناخته امن است", insightPersonaDefinition("zzz").persona === "personal");

/* ================================================================== */
section("6) زمینه و حریم خصوصی (§20, §26)");

const rich = aggregateInsightContext(
  emptyInput({
    persona: "student",
    tasks: Array.from({ length: 60 }, (_, i) => ({
      id: `t${i}`,
      title: `کار ${i}`,
      status: i % 3 === 0 ? "done" : "todo",
      dueDate: "2026-09-29",
      estimateMinutes: 30,
      postponeCount: i % 5 === 0 ? 3 : 0,
      completedAt: i % 3 === 0 ? Date.now() : undefined,
    })),
    blocks: Array.from({ length: 12 }, (_, i) => ({
      id: `b${i}`,
      day: "2026-09-29",
      startTime: "09:00",
      endTime: "10:00",
      kind: "focus",
    })),
    sessions: Array.from({ length: 6 }, (_, i) => ({
      id: `s${i}`,
      day: "2026-09-29",
      kind: "focus",
      minutes: i % 2 === 0 ? 10 : 60,
      interrupted: false,
    })),
    domainContext: ["امتحان: فیزیک — 2026-10-15"],
  }),
);
check("زمینهٔ غنی الگو تولید می‌کند", rich.patterns.length > 0);
check("منابع زمینه فهرست می‌شوند", rich.sources.includes("tasks"));

const renderedCtx = renderInsightContextForModel(emptyInput({ persona: "student" }), rich);
check("متن زمینه الگوهای ثابت را در بر دارد", renderedCtx.includes("الگوهای شناسایی‌شده"));
check("متن زمینه بازه را می‌گوید", renderedCtx.includes("بازهٔ تحلیل"));
check("متن زمینه سقف اندازه دارد", renderedCtx.length <= 24_000);
check("برچسب شخصیت در متن می‌آید", renderedCtx.includes("student"));

/* ================================================================== */
section("7) برچسب‌های صادقانه (§11)");

check("برچسب فارسی برای هر سطح اعتماد وجود دارد", Object.keys(CONFIDENCE_LABELS_FA).length === 3);
check("اعتماد عددی نیست", Object.values(CONFIDENCE_LABELS_FA).every((l) => !/\d/.test(l)));
check("برچسب فارسی برای هر الگو وجود دارد", AI_PATTERN_TYPES.every((t) => !!PATTERN_LABELS_FA[t]));
check("حداقل نمونه‌ها اعلام شده است", MIN_SAMPLES.estimate >= 3 && MIN_SAMPLES.focusSessions >= 3);

/* ================================================================== */
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
