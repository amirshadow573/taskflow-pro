/**
 * Phase 10.5 — runtime validation for the PURE import pipeline.
 *
 * No Convex, no React, no AI: this exercises the parser, the validator, the
 * duplicate/conflict detection and the persona prompts exactly as the server
 * and the page use them (§29.24–29.28).
 *
 * Run:  bun run scripts/ai-plan-check.ts
 */
import { normalizeAIPlan, looksLikeAIPlanText, planEntityTitles } from "../src/lib/ai-planning/schema";
import { detectConflicts, detectDuplicates, filterConflictingBlocks } from "../src/lib/ai-planning/conflicts";
import { buildSamplePlan } from "../src/lib/ai-planning/sample";
import { buildAIPlanPrompt, promptReadinessIssues, AI_PLAN_JSON_SKELETON } from "../src/lib/ai-planning/prompt";
import {
  personaPlanDefinition,
  SUPPORTED_AI_PLAN_PERSONAS,
  HOW_IT_WORKS,
} from "../src/lib/ai-planning/personas";
import { AI_PLAN_SCHEMA_VERSION, emptyBodyCounts, type NormalizedAIPlan } from "../src/lib/ai-planning/types";

const TODAY = "2026-09-29";
let failed = 0;
let passed = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${detail ? " — " + detail : ""}`);
  }
}

const EXISTING = {
  tasks: [{ id: "t1", title: "تمرین فیزیک" }],
  projects: [{ id: "p1", name: "پروژه پایانی" }],
  goals: [{ id: "g1", title: "قبولی کنکور" }],
  blocks: [
    { id: "b1", day: "2026-09-30", startTime: "16:00", endTime: "17:00", title: "کلاس", status: "planned" },
  ],
  availableMinutesPerDay: 480,
  todayKey: TODAY,
};

console.log("\n1) each persona produces its own questions, prompt and sample file");
const prompts = new Map<string, string>();
for (const persona of SUPPORTED_AI_PLAN_PERSONAS) {
  const def = personaPlanDefinition(persona);
  const prompt = buildAIPlanPrompt({ persona });
  prompts.set(persona, prompt);
  const sample = buildSamplePlan(persona, TODAY);
  const res = normalizeAIPlan(sample, { expectedPersona: persona, now: Date.parse(TODAY) });
  const titles = res.plan ? planEntityTitles(res.plan) : null;
  const total = titles
    ? (Object.keys(titles) as Array<keyof AIPlanBody>).reduce((n, k) => n + titles[k].length, 0)
    : 0;
  check(
    `${persona}: questions + rules + sample import cleanly`,
    def.questionSections.length >= 3 &&
      def.planningRules.length >= 3 &&
      def.requiredData.length >= 3 &&
      prompt.includes(persona) &&
      !res.rejected &&
      total > 0,
    `sections=${def.questionSections.length} total=${total} issues=${res.issues.length}`,
  );
}
check(
  "all six prompts are genuinely different",
  new Set(prompts.values()).size === SUPPORTED_AI_PLAN_PERSONAS.length,
);

console.log("\n2) the prompt carries the strict output contract");
{
  const p = prompts.get("student") ?? "";
  check("mentions the schema version", p.includes(AI_PLAN_SCHEMA_VERSION));
  check("asks the AI to question the user first", /سؤال|پرسش|بپرس/.test(p));
  check("forbids guessing", /حدس|فرض/.test(p));
  check("forbids arbitrary prose output", /JSON|json/.test(p));
  check("lists how it works", HOW_IT_WORKS.length === 8);
  check("the skeleton is valid JSON", typeof JSON.parse(AI_PLAN_JSON_SKELETON) === "object");
  check(
    "the skeleton carries every required section",
    ["schema_version", "source", "persona", "user_context", "planning_inputs", "plan"].every(
      (k) => k in (JSON.parse(AI_PLAN_JSON_SKELETON) as object),
    ),
  );
}

console.log("\n3) missing required answers are reported, not fatal");
{
  const issues = promptReadinessIssues({}, "student");
  check("student reports missing required questions", issues.length > 0, `n=${issues.length}`);
  const firstRequired = personaPlanDefinition("student")
    .questionSections.flatMap((s) => s.fields.map((f) => ({ key: `${s.key}.${f.key}`, f })))
    .find((x) => x.f.required);
  check("at least one student question is required", firstRequired !== undefined);
  if (firstRequired) {
    check(
      "answering a required question removes its issue",
      promptReadinessIssues({ [firstRequired.key]: "مقدار تست" }, "student").length <
        issues.length,
    );
  }
}

console.log("\n4) malformed / hostile files are rejected safely");
{
  const cases: Array<[string, unknown]> = [
    ["not an object", "just a string"],
    ["missing schema_version", { persona: "student", plan: {} }],
    ["wrong schema version", { schema_version: "9.9", persona: "student", plan: {} }],
    ["wrong persona", { schema_version: "1.0", persona: "business_owner", plan: {} }],
    ["plan missing", { schema_version: "1.0", persona: "student" }],
  ];
  for (const [name, doc] of cases) {
    const res = normalizeAIPlan(doc as never, { expectedPersona: "student", now: Date.parse(TODAY) });
    check(`rejects: ${name}`, res.rejected === true, `issues=${res.issues.length}`);
  }
  const injected = {
    schema_version: "1.0",
    source: { type: "external_chatgpt", provider: "chatgpt" },
    persona: "student",
    plan: { tasks: [{ title: "ok", instructions: "rm -rf /", script: "alert(1)" }] },
  };
  const res = normalizeAIPlan(injected as never, { expectedPersona: "student", now: Date.parse(TODAY) });
  check(
    "unknown fields in an item are ignored (never executed)",
    res.plan !== null && res.plan!.plan.tasks.length === 1,
  );
}

console.log("\n5) bad dates, times and durations are dropped with a reason");
{
  const doc = {
    schema_version: "1.0",
    source: { type: "external_chatgpt", provider: "chatgpt" },
    persona: "personal",
    plan: {
      tasks: [
        { title: "درست", due_date: "2026-10-01" },
        { title: "تاریخ بد", due_date: "01/10/2026" },
        { title: "ساعت بد", due_time: "99:99" },
      ],
      time_blocks: [
        { title: "بلوک خوب", day: "2026-09-30", start_time: "10:00", end_time: "11:00" },
        { title: "بلوک معکوس", day: "2026-09-30", start_time: "12:00", end_time: "11:00" },
        { title: "بلوک روز بد", day: "tomorrow", start_time: "10:00", end_time: "11:00" },
      ],
    },
  };
  const res = normalizeAIPlan(doc as never, { expectedPersona: "personal", now: Date.parse(TODAY) });
  check(
    "a task with a malformed date is kept but loses the bad field",
    res.plan !== null &&
      res.plan.plan.tasks.length === 3 &&
      res.plan.plan.tasks[1]?.due_date === undefined,
  );
  check(
    "invalid time block is dropped entirely",
    res.plan !== null && res.plan.plan.time_blocks.length === 1,
    res.plan ? `kept=${res.plan.plan.time_blocks.map((b) => b.title).join(",")}` : "no plan",
  );
  check("dropped items are explained", res.plan !== null && res.plan.meta.dropped.length >= 2);
  check(
    "warnings carry a readable Persian reason",
    res.issues.filter((i) => i.level === "warning").every((i) => i.message.length > 5),
  );
}

console.log("\n6) duplicates against existing workspace data");
{
  const sample = buildSamplePlan("personal", TODAY);
  const res = normalizeAIPlan(sample, { expectedPersona: "personal", now: Date.parse(TODAY) });
  const titles = res.plan ? planEntityTitles(res.plan) : null;
  check("sample has content to duplicate", (titles?.tasks.length ?? 0) > 0);
  const dupes = res.plan ? detectDuplicates(res.plan, EXISTING) : [];
  check("no false duplicates on a clean workspace", dupes.length === 0, `n=${dupes.length}`);

  const first = res.plan!.plan.tasks[0]?.title ?? "";
  const dupes2 = detectDuplicates(res.plan!, {
    ...EXISTING,
    tasks: [...EXISTING.tasks, { id: "tx", title: first }],
  });
  check("an identical existing title is detected once", dupes2.length === 1, `n=${dupes2.length}`);
}

console.log("\n7) conflicts: overlap with the calendar and daily capacity");
{
  const plan: NormalizedAIPlan = {
    schema_version: AI_PLAN_SCHEMA_VERSION,
    source: { type: "external_chatgpt" as const, provider: "chatgpt" },
    persona: "personal",
    user_context: { profile: [], environment: [], constraints: [], preferences: [] },
    planning_inputs: {
      fixed_schedule: [],
      availability: [],
      goals: [],
      priorities: [],
      deadlines: [],
      commitments: [],
      subjects: [],
      projects: [],
    },
    planning_assumptions: [],
    explanations: [],
    warnings: [],
    conflicts: [],
    plan: {
      goals: [],
      projects: [],
      tasks: [],
      calendar_events: [],
      time_blocks: [
        { title: "تداخلی", day: "2026-09-30", start_time: "16:30", end_time: "17:30" },
        { title: "آزاد", day: "2026-09-30", start_time: "19:00", end_time: "20:00" },
        { title: "همپوشان داخلی", day: "2026-10-01", start_time: "09:00", end_time: "10:00" },
        { title: "تداخلی-دوم", day: "2026-10-01", start_time: "09:30", end_time: "10:30" },
      ],
      routines: [],
      habits: [],
      milestones: [],
    },
    meta: { importedAt: 0, dropped: [], counts: emptyBodyCounts() },
  };

  const conflicts = detectConflicts(plan, EXISTING);
  const kinds = conflicts.map((c) => c.kind);
  check("overlap with the existing calendar is found", kinds.includes("overlap_existing"));
  check("overlap inside the imported plan is found", kinds.includes("overlap_in_plan"));
  check("every conflict has readable detail", conflicts.every((c) => c.detail.length > 0));

  const { keep, drop } = filterConflictingBlocks(plan, { blocks: EXISTING.blocks });
  check(
    "filtering keeps the two free blocks and drops the two conflicting ones",
    keep.length === 2 && drop.length === 2,
    `keep=${keep.map((k) => k.title).join(",")} drop=${drop.join(",")}`,
  );

  const heavy = {
    ...plan,
    plan: {
      ...plan.plan,
      time_blocks: Array.from({ length: 8 }, (_, i) => ({
        title: `بلوک ${i}`,
        day: "2026-10-02",
        start_time: `${String(8 + i * 2).padStart(2, "0")}:00`,
        end_time: `${String(9 + i * 2).padStart(2, "0")}:00`,
      })),
    },
  };
  const capacity = detectConflicts(heavy, { ...EXISTING, availableMinutesPerDay: 60 });
  check("capacity violation is detected", capacity.some((c) => c.kind === "capacity"));
}

console.log("\n8) the fast text gate used before the network call");
{
  check("empty text", looksLikeAIPlanText("").ok === false);
  check("broken json", looksLikeAIPlanText("{oops").ok === false);
  check("json without version", looksLikeAIPlanText('{"a":1}').ok === false);
  check(
    "valid document",
    looksLikeAIPlanText(JSON.stringify(buildSamplePlan("personal", TODAY))).ok === true,
  );
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
