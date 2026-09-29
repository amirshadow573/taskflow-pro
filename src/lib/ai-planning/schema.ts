/**
 * Phase 10.5 — AI plan parser / normalizer / validator.
 *
 * Pure and total: it NEVER throws on malformed input (an uploaded file is
 * untrusted data) and it never executes anything from the file — the document
 * is only read as JSON-shaped data.
 *
 * Rejection is reserved for structural problems (wrong shape, unsupported
 * schema version, missing persona/source). Malformed ITEMS are dropped with a
 * visible warning so a mostly-good plan is still usable.
 */
import {
  AI_PLAN_SCHEMA_VERSION,
  DAY_RE,
  SUPPORTED_SCHEMA_VERSIONS,
  TIME_RE,
  emptyBodyCounts,
  normalizeTitle,
  toMin,
  type AIPlanBody,
  type AIPlanCalendarEvent,
  type AIPlanHabit,
  type AIPlanInputs,
  type AIPlanMilestone,
  type AIPlanProject,
  type AIPlanRoutine,
  type AIPlanSource,
  type AIPlanSourceType,
  type AIPlanTask,
  type AIPlanTimeBlock,
  type AIPlanUserContext,
  type AIPlanGoal,
  type NormalizeResult,
  type NormalizedAIPlan,
  type PlanIssue,
} from "./types";

const PRIORITIES = new Set(["low", "medium", "high", "urgent"]);
const SOURCE_TYPES: AIPlanSourceType[] = [
  "external_chatgpt",
  "external_gemini",
  "external_claude",
  "future_api",
  "future_provider",
];
const BLOCK_KINDS = new Set([
  "focus",
  "task",
  "meeting",
  "study",
  "routine",
  "personal",
  "break",
  "review",
  "planning",
  "admin",
  "other",
]);

const MAX_TITLE = 200;
const MAX_TEXT = 2000;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function cleanStr(v: unknown, max = MAX_TITLE): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return undefined;
  return t.slice(0, max);
}

function longStr(v: unknown): string | undefined {
  return cleanStr(v, MAX_TEXT);
}

function strList(v: unknown, field: string, issues: PlanIssue[], dropped: string[]): string[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) {
    issues.push({ level: "warning", field, message: `فیلد «${field}» آرایه نبود و نادیده گرفته شد.` });
    dropped.push(field);
    return [];
  }
  const out: string[] = [];
  v.forEach((item, i) => {
    if (typeof item === "string" && item.trim()) out.push(item.trim().slice(0, MAX_TEXT));
    else if (typeof item === "number") out.push(String(item));
    else {
      issues.push({
        level: "warning",
        field: `${field}[${i}]`,
        message: `مورد نامعتبر در «${field}» حذف شد.`,
      });
    }
  });
  return out;
}

function rowList(v: unknown, field: string, issues: PlanIssue[]): Record<string, unknown>[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) {
    issues.push({ level: "warning", field, message: `بخش «${field}» آرایه نبود و نادیده گرفته شد.` });
    return [];
  }
  const out: Record<string, unknown>[] = [];
  v.forEach((item, i) => {
    if (isRecord(item)) out.push(item);
    else
      issues.push({
        level: "warning",
        field: `${field}[${i}]`,
        message: `مورد نامعتبر در «${field}» حذف شد.`,
      });
  });
  return out;
}

function day(v: unknown, field: string, issues: PlanIssue[]): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const s = String(v).trim();
  if (!DAY_RE.test(s)) {
    issues.push({ level: "warning", field, message: `تاریخ «${s}» نامعتبر بود (باید YYYY-MM-DD باشد).` });
    return undefined;
  }
  return s;
}

function time(v: unknown, field: string, issues: PlanIssue[]): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const s = String(v).trim();
  if (!TIME_RE.test(s)) {
    issues.push({ level: "warning", field, message: `ساعت «${s}» نامعتبر بود (باید HH:mm باشد).` });
    return undefined;
  }
  return s;
}

function boundedNum(v: unknown, min: number, max: number): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  if (Number.isNaN(n)) return undefined;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function priority(v: unknown, field: string, issues: PlanIssue[]): string {
  const s = String(v ?? "").trim();
  if (!s) return "medium";
  if (!PRIORITIES.has(s)) {
    issues.push({ level: "warning", field, message: `اولویت «${s}» شناخته نشد؛ «متوسط» در نظر گرفته شد.` });
    return "medium";
  }
  return s;
}

function blockKind(v: unknown, field: string, issues: PlanIssue[]): string {
  const s = String(v ?? "").trim();
  if (!s) return "other";
  if (!BLOCK_KINDS.has(s)) {
    issues.push({ level: "warning", field, message: `نوع بلوک «${s}» شناخته نشد؛ «سایر» ثبت شد.` });
    return "other";
  }
  return s;
}

/* ------------------------------------------------------------------ */
/* Per-collection normalizers                                          */
/* ------------------------------------------------------------------ */

function normGoals(rows: Record<string, unknown>[], issues: PlanIssue[]): AIPlanGoal[] {
  const out: AIPlanGoal[] = [];
  rows.forEach((r, i) => {
    const title = cleanStr(r.title);
    if (!title) {
      issues.push({ level: "warning", field: `plan.goals[${i}]`, message: "هدف بدون عنوان حذف شد." });
      return;
    }
    out.push({
      title,
      description: longStr(r.description),
      due_date: day(r.due_date, `plan.goals[${i}].due_date`, issues),
      priority: priority(r.priority, `plan.goals[${i}].priority`, issues),
      notes: longStr(r.notes),
    });
  });
  return out;
}

function normProjects(rows: Record<string, unknown>[], issues: PlanIssue[]): AIPlanProject[] {
  const out: AIPlanProject[] = [];
  rows.forEach((r, i) => {
    const title = cleanStr(r.title);
    if (!title) {
      issues.push({ level: "warning", field: `plan.projects[${i}]`, message: "پروژه بدون عنوان حذف شد." });
      return;
    }
    out.push({
      title,
      description: longStr(r.description),
      deadline: day(r.deadline, `plan.projects[${i}].deadline`, issues),
      status: cleanStr(r.status, 40),
      goal_ref: cleanStr(r.goal_ref, 200),
      notes: longStr(r.notes),
    });
  });
  return out;
}

function normTasks(rows: Record<string, unknown>[], issues: PlanIssue[]): AIPlanTask[] {
  const out: AIPlanTask[] = [];
  rows.forEach((r, i) => {
    const title = cleanStr(r.title);
    if (!title) {
      issues.push({ level: "warning", field: `plan.tasks[${i}]`, message: "کار بدون عنوان حذف شد." });
      return;
    }
    out.push({
      title,
      description: longStr(r.description),
      due_date: day(r.due_date, `plan.tasks[${i}].due_date`, issues),
      due_time: time(r.due_time, `plan.tasks[${i}].due_time`, issues),
      priority: priority(r.priority, `plan.tasks[${i}].priority`, issues),
      project_ref: cleanStr(r.project_ref, 200),
      goal_ref: cleanStr(r.goal_ref, 200),
      tags: strList(r.tags, `plan.tasks[${i}].tags`, issues, []).slice(0, 8),
      estimate_minutes: boundedNum(r.estimate_minutes, 5, 1440),
    });
  });
  return out;
}

function normTimed(
  rows: Record<string, unknown>[],
  field: "calendar_events" | "time_blocks",
  issues: PlanIssue[],
): Array<AIPlanCalendarEvent | AIPlanTimeBlock> {
  const out: Array<AIPlanCalendarEvent | AIPlanTimeBlock> = [];
  rows.forEach((r, i) => {
    const title = cleanStr(r.title);
    if (!title) {
      issues.push({ level: "warning", field: `plan.${field}[${i}]`, message: "مورد بدون عنوان حذف شد." });
      return;
    }
    const d = day(r.day, `plan.${field}[${i}].day`, issues);
    const start = time(r.start_time, `plan.${field}[${i}].start_time`, issues);
    const end = time(r.end_time, `plan.${field}[${i}].end_time`, issues);
    if (!d || !start || !end) {
      issues.push({
        level: "warning",
        field: `plan.${field}[${i}]`,
        message: `«${title}» به‌دلیل ناقص بودن تاریخ/ساعت حذف شد.`,
      });
      return;
    }
    if (toMin(end) <= toMin(start)) {
      issues.push({
        level: "warning",
        field: `plan.${field}[${i}]`,
        message: `«${title}» ساعت پایان معتبری ندارد (پایان ≤ شروع) و حذف شد.`,
      });
      return;
    }
    const kind = blockKind(r.kind, `plan.${field}[${i}].kind`, issues);
    const notes = longStr(r.notes);
    if (field === "calendar_events") {
      const event: AIPlanCalendarEvent = { title, day: d, start_time: start, end_time: end, kind, notes };
      out.push(event);
    } else {
      const block: AIPlanTimeBlock = {
        title,
        day: d,
        start_time: start,
        end_time: end,
        kind,
        notes,
        task_ref: cleanStr(r.task_ref, 200),
      };
      out.push(block);
    }
  });
  return out;
}

function normRoutines(rows: Record<string, unknown>[], issues: PlanIssue[]): AIPlanRoutine[] {
  const out: AIPlanRoutine[] = [];
  rows.forEach((r, i) => {
    const title = cleanStr(r.title);
    if (!title) {
      issues.push({ level: "warning", field: `plan.routines[${i}]`, message: "روتین بدون عنوان حذف شد." });
      return;
    }
    out.push({ title, items: strList(r.items, `plan.routines[${i}].items`, issues, []).slice(0, 20) });
  });
  return out;
}

function normHabits(rows: Record<string, unknown>[], issues: PlanIssue[]): AIPlanHabit[] {
  const out: AIPlanHabit[] = [];
  rows.forEach((r, i) => {
    const title = cleanStr(r.title);
    const freq = String(r.frequency ?? "").trim();
    if (!title || (freq !== "daily" && freq !== "weekly")) {
      issues.push({
        level: "warning",
        field: `plan.habits[${i}]`,
        message: "عادت نامعتبر حذف شد (تکرار باید daily یا weekly باشد).",
      });
      return;
    }
    out.push({
      title,
      frequency: freq,
      target: boundedNum(r.target, 1, 21) ?? (freq === "daily" ? 1 : 3),
      description: longStr(r.description),
    });
  });
  return out;
}

function normMilestones(rows: Record<string, unknown>[], issues: PlanIssue[]): AIPlanMilestone[] {
  const out: AIPlanMilestone[] = [];
  rows.forEach((r, i) => {
    const title = cleanStr(r.title);
    if (!title) {
      issues.push({ level: "warning", field: `plan.milestones[${i}]`, message: "نقطه عطف بدون عنوان حذف شد." });
      return;
    }
    out.push({
      title,
      goal_ref: cleanStr(r.goal_ref, 200),
      due_date: day(r.due_date, `plan.milestones[${i}].due_date`, issues),
      notes: longStr(r.notes),
    });
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export function normalizeAIPlan(
  raw: unknown,
  opts: { expectedPersona: string; now: number },
): NormalizeResult {
  const issues: PlanIssue[] = [];
  const dropped: string[] = [];

  if (!isRecord(raw)) {
    return {
      plan: null,
      rejected: true,
      issues: [
        {
          level: "error",
          field: "file",
          message: "محتوای فایل یک شیء JSON معتبر نیست. فقط فایل JSON برنامه پذیرفته می‌شود.",
        },
      ],
    };
  }

  const version = String(raw.schema_version ?? "").trim();
  if (!version) {
    issues.push({
      level: "error",
      field: "schema_version",
      message: "شماره نسخه ساختار (schema_version) در فایل نیست.",
    });
  } else if (!SUPPORTED_SCHEMA_VERSIONS.includes(version)) {
    issues.push({
      level: "error",
      field: "schema_version",
      message: `نسخه «${version}» پشتیبانی نمی‌شود. نسخه مورد انتظار: ${AI_PLAN_SCHEMA_VERSION}.`,
    });
  }

  const persona = String(raw.persona ?? "").trim();
  if (!persona) {
    issues.push({ level: "error", field: "persona", message: "persona در فایل مشخص نشده است." });
  } else if (persona !== opts.expectedPersona) {
    issues.push({
      level: "warning",
      field: "persona",
      message: `این فایل برای شخصیت «${persona}» ساخته شده ولی شخصیت فعال شما «${opts.expectedPersona}» است.`,
    });
  }

  let source: AIPlanSource = { type: "external_chatgpt", provider: "نامشخص" };
  if (!isRecord(raw.source)) {
    issues.push({
      level: "error",
      field: "source",
      message: "بخش source (منبع برنامه) در فایل نیست.",
    });
  } else {
    const type = String(raw.source.type ?? "").trim() as AIPlanSourceType;
    const provider = cleanStr(raw.source.provider, 60);
    if (!provider) {
      issues.push({ level: "error", field: "source.provider", message: "نام ارائه‌دهنده AI مشخص نشده است." });
    }
    if (!SOURCE_TYPES.includes(type)) {
      issues.push({
        level: "warning",
        field: "source.type",
        message: `نوع منبع «${type || "نامشخص"}» شناخته نشد؛ external_chatgpt در نظر گرفته شد.`,
      });
    }
    source = {
      type: SOURCE_TYPES.includes(type) ? type : "external_chatgpt",
      provider: provider ?? "نامشخص",
      generated_at: cleanStr(raw.source.generated_at, 40),
    };
  }

  if (!isRecord(raw.plan)) {
    issues.push({ level: "error", field: "plan", message: "بخش plan در فایل نیست." });
  }

  const ucRaw = isRecord(raw.user_context) ? raw.user_context : {};
  const userContext: Required<AIPlanUserContext> = {
    profile: strList(ucRaw.profile, "user_context.profile", issues, dropped),
    environment: strList(ucRaw.environment, "user_context.environment", issues, dropped),
    constraints: strList(ucRaw.constraints, "user_context.constraints", issues, dropped),
    preferences: strList(ucRaw.preferences, "user_context.preferences", issues, dropped),
  };

  const inRaw = isRecord(raw.planning_inputs) ? raw.planning_inputs : {};
  const inputs: Required<AIPlanInputs> = {
    fixed_schedule: strList(inRaw.fixed_schedule, "planning_inputs.fixed_schedule", issues, dropped),
    availability: strList(inRaw.availability, "planning_inputs.availability", issues, dropped),
    goals: strList(inRaw.goals, "planning_inputs.goals", issues, dropped),
    priorities: strList(inRaw.priorities, "planning_inputs.priorities", issues, dropped),
    deadlines: strList(inRaw.deadlines, "planning_inputs.deadlines", issues, dropped),
    commitments: strList(inRaw.commitments, "planning_inputs.commitments", issues, dropped),
    subjects: strList(inRaw.subjects, "planning_inputs.subjects", issues, dropped),
    projects: strList(inRaw.projects, "planning_inputs.projects", issues, dropped),
  };

  const body: AIPlanBody = {
    goals: normGoals(rowList(isRecord(raw.plan) ? raw.plan.goals : [], "plan.goals", issues), issues),
    projects: normProjects(
      rowList(isRecord(raw.plan) ? raw.plan.projects : [], "plan.projects", issues),
      issues,
    ),
    tasks: normTasks(rowList(isRecord(raw.plan) ? raw.plan.tasks : [], "plan.tasks", issues), issues),
    calendar_events: normTimed(
      rowList(isRecord(raw.plan) ? raw.plan.calendar_events : [], "plan.calendar_events", issues),
      "calendar_events",
      issues,
    ) as AIPlanCalendarEvent[],
    time_blocks: normTimed(
      rowList(isRecord(raw.plan) ? raw.plan.time_blocks : [], "plan.time_blocks", issues),
      "time_blocks",
      issues,
    ) as AIPlanTimeBlock[],
    routines: normRoutines(
      rowList(isRecord(raw.plan) ? raw.plan.routines : [], "plan.routines", issues),
      issues,
    ),
    habits: normHabits(
      rowList(isRecord(raw.plan) ? raw.plan.habits : [], "plan.habits", issues),
      issues,
    ),
    milestones: normMilestones(
      rowList(isRecord(raw.plan) ? raw.plan.milestones : [], "plan.milestones", issues),
      issues,
    ),
  };

  // Every warning raised while normalizing a plan item is, by definition, a
  // field/item that was present but malformed and therefore dropped. Recording
  // them here keeps the audit trail complete (the UI shows it verbatim).
  for (const issue of issues) {
    if (issue.level === "warning" && issue.field.startsWith("plan.") && !dropped.includes(issue.field)) {
      dropped.push(issue.field);
    }
  }

  const planning_assumptions = strList(
    raw.planning_assumptions,
    "planning_assumptions",
    issues,
    dropped,
  );
  const explanations = strList(raw.explanations, "explanations", issues, dropped);
  const fileWarnings = strList(raw.warnings, "warnings", issues, dropped);
  const fileConflicts = strList(raw.conflicts, "conflicts", issues, dropped);

  const counts: NormalizedAIPlan["meta"]["counts"] = {
    ...emptyBodyCounts(),
    assumptions: planning_assumptions.length,
    explanations: explanations.length,
  };
  for (const key of Object.keys(body) as Array<keyof AIPlanBody>) {
    counts[key] = body[key].length;
  }

  const totalItems = (Object.keys(body) as Array<keyof AIPlanBody>).reduce(
    (n, key) => n + body[key].length,
    0,
  );
  if (totalItems === 0) {
    issues.push({
      level: "error",
      field: "plan",
      message: "هیچ مورد قابل وارد کردنی در فایل پیدا نشد.",
    });
  }

  const rejected = issues.some((i) => i.level === "error");
  if (rejected) {
    return { plan: null, issues, rejected };
  }

  const plan: NormalizedAIPlan = {
    schema_version: version || AI_PLAN_SCHEMA_VERSION,
    source,
    persona: persona || opts.expectedPersona,
    user_context: userContext,
    planning_inputs: inputs,
    planning_assumptions,
    plan: body,
    explanations,
    warnings: fileWarnings,
    conflicts: fileConflicts,
    meta: { importedAt: opts.now, dropped, counts },
  };
  return { plan, issues, rejected: false };
}

/** Quick check used before the server call: does this text look like our plan? */
export function looksLikeAIPlanText(text: string): { ok: boolean; message?: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, message: "فایل خالی است." };
  if (trimmed.length > 4_000_000) return { ok: false, message: "فایل بیش از حد بزرگ است." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, message: "محتوای فایل JSON معتبر نیست." };
  }
  if (!isRecord(parsed)) return { ok: false, message: "ساختار فایل باید یک شیء JSON باشد." };
  if (!("schema_version" in parsed)) {
    return { ok: false, message: "این فایل «schema_version» ندارد؛ قالب باید نسخه ۱.۰ باشد." };
  }
  return { ok: true };
}

/** Titles helper used by the preview + duplicate report. */
export function planEntityTitles(plan: NormalizedAIPlan): Record<keyof AIPlanBody, string[]> {
  return {
    goals: plan.plan.goals.map((g) => g.title),
    projects: plan.plan.projects.map((p) => p.title),
    tasks: plan.plan.tasks.map((t) => t.title),
    calendar_events: plan.plan.calendar_events.map((e) => e.title),
    time_blocks: plan.plan.time_blocks.map((b) => b.title),
    routines: plan.plan.routines.map((r) => r.title),
    habits: plan.plan.habits.map((h) => h.title),
    milestones: plan.plan.milestones.map((m) => m.title),
  };
}

export { normalizeTitle };
