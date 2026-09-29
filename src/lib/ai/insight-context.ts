/**
 * Phase 16 — AI Insight context aggregation (§2, §5, §6, §20).
 *
 * Turns raw workspace slices into:
 *   1. a `PatternInput` — consumed by patterns.ts to PROVE patterns, and
 *   2. a rendered, Persian, deterministic evidence block — sent to the model.
 *
 * The model receives only (2), plus the list of pattern types that were
 * actually proven in (1). It is explicitly told it cannot invent a new pattern.
 *
 * Pure module: plain arrays in, plain objects out. No Convex types, so this is
 * directly testable, and no `@/` imports so the Convex bundler accepts it.
 */
import {
  detectPatterns,
  isInsufficientEvidence,
  type EstimateSample,
  type PatternInput,
  type WorkloadDayInput,
} from "./patterns";
import { AI_MAX_CONTEXT_CHARS, type AIAction } from "./types";
import {
  AI_CONTEXT_VERSION,
  AI_MAX_INSIGHTS,
  type AIInsightWindow,
  type DetectedPattern,
} from "./insight-types";

/* ------------------------------------------------------------------ */
/* Raw slices                                                          */
/* ------------------------------------------------------------------ */

export interface InsightTaskInput {
  id: string;
  title: string;
  status: string;
  dueDate?: string;
  estimateMinutes?: number;
  postponeCount?: number;
  completedAt?: number;
  projectId?: string;
  blockedCount?: number;
}

export interface InsightBlockInput {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  status?: string;
  kind: string;
}

export interface InsightSessionInput {
  id: string;
  day: string;
  kind: string;
  /** Minutes actually spent. */
  minutes: number;
  /** True when the session ended early / was abandoned. */
  interrupted: boolean;
  taskId?: string;
  plannedMinutes?: number;
}

export interface InsightGoalInput {
  id: string;
  title: string;
  progress: number;
  status: string;
  updatedAt: number;
}

export interface InsightProjectInput {
  id: string;
  name: string;
  status: string;
  openTasks: number;
  overdueTasks: number;
}

export interface InsightRoutineDayInput {
  day: string;
  done: number;
  total: number;
}

export interface InsightHabitInput {
  id: string;
  title: string;
  target: number;
  done: number;
  periods: number;
}

export interface InsightAvailability {
  dayStart: string;
  dayEnd: string;
  breakMinutes: number;
  maxFocusMinutes: number;
}

export interface InsightContextInput {
  persona: string;
  window: AIInsightWindow;
  todayKey: string;
  availability: InsightAvailability;
  tasks: InsightTaskInput[];
  blocks: InsightBlockInput[];
  sessions: InsightSessionInput[];
  goals: InsightGoalInput[];
  projects: InsightProjectInput[];
  routineDays: InsightRoutineDayInput[];
  habits: InsightHabitInput[];
  /** How many time blocks the user moved during the window. */
  rescheduleCount: number;
  /** Persona-scoped labels only (exams, clients, teams…). */
  domainContext: string[];
}

const MINUTES_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toMin(hhmm: string): number {
  if (!MINUTES_RE.test(hhmm)) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function capacityMinutesOf(a: InsightAvailability): number {
  return Math.max(0, toMin(a.dayEnd) - toMin(a.dayStart) - a.breakMinutes);
}

/* ------------------------------------------------------------------ */
/* Aggregation                                                         */
/* ------------------------------------------------------------------ */

export interface InsightAggregation {
  patternInput: PatternInput;
  patterns: DetectedPattern[];
  insufficient: boolean;
  /** Deterministic headline numbers shown in the UI before/without AI. */
  stats: Array<{ label: string; value: string }>;
  sources: string[];
}

/**
 * Compute the evidence. Deterministic, pure, and the ONLY place patterns may
 * come from.
 */
export function aggregateInsightContext(input: InsightContextInput): InsightAggregation {
  const now = Date.now();
  const capacity = capacityMinutesOf(input.availability);
  const sources: string[] = ["facts"];

  /* ---- estimation: finished work with a real estimate ---- */
  const estimates: EstimateSample[] = [];
  for (const t of input.tasks) {
    if (t.status !== "done" || !t.estimateMinutes || !t.completedAt) continue;
    const actual = minutesSpentOn(input.sessions, t.id);
    if (actual > 0) {
      estimates.push({
        id: t.id,
        title: t.title,
        estimateMinutes: t.estimateMinutes,
        actualMinutes: actual,
      });
    }
  }

  /* ---- postponement ---- */
  const today = input.todayKey;
  const open = input.tasks.filter((t) => t.status !== "done");
  const postponed = open
    .filter((t) => (t.postponeCount ?? 0) > 0)
    .map((t) => ({
      id: t.id,
      title: t.title,
      postponeCount: t.postponeCount ?? 0,
      overdue: !!t.dueDate && t.dueDate < today,
    }));

  /* ---- workload per day ---- */
  const days = new Set<string>([
    ...input.blocks.map((b) => b.day),
    ...input.tasks.map((t) => t.dueDate ?? ""),
  ]);
  const workload: WorkloadDayInput[] = [...days]
    .filter((d) => !!d)
    .sort()
    .map((day) => {
      const plannedMinutes = input.tasks
        .filter((t) => t.dueDate === day && t.status !== "done")
        .reduce((n, t) => n + (t.estimateMinutes ?? 30), 0);
      return { day, plannedMinutes, capacityMinutes: capacity };
    });

  /* ---- execution ---- */
  const actualMinutes = input.sessions.reduce((n, s) => n + s.minutes, 0);
  const scheduledMinutes = input.blocks.reduce((n, b) => n + (toMin(b.endTime) - toMin(b.startTime)), 0);
  const interrupted = input.sessions.filter((s) => s.interrupted).length;
  const shortSessions = input.sessions.filter((s) => s.minutes > 0 && s.minutes < 20).length;

  /* ---- completion ---- */
  const completed = input.tasks.filter((t) => t.status === "done" && t.completedAt).length;

  if (estimates.length > 0) sources.push("estimates");
  if (open.length > 0) sources.push("tasks");
  if (input.blocks.length > 0) sources.push("blocks");
  if (input.sessions.length > 0) sources.push("execution");
  if (input.goals.length > 0) sources.push("goals");
  if (input.projects.length > 0) sources.push("projects");
  if (input.routineDays.length > 0) sources.push("routines");
  if (input.habits.length > 0) sources.push("habits");
  if (input.domainContext.length > 0) sources.push("domain");

  const patternInput: PatternInput = {
    window: input.window,
    postponed,
    estimates,
    workload,
    plannedCount: open.length + completed,
    completedCount: completed,
    scheduledMinutes,
    actualMinutes,
    focusSessions: input.sessions.length,
    interruptedSessions: interrupted,
    shortSessionCount: shortSessions,
    routineDays: input.routineDays,
    habits: input.habits,
    goals: input.goals
      .filter((g) => g.status === "active")
      .map((g) => ({
        id: g.id,
        title: g.title,
        progress: g.progress,
        daysSinceUpdate: Math.max(0, Math.floor((now - g.updatedAt) / 86_400_000)),
      })),
    projects: input.projects
      .filter((p) => p.status === "active")
      .map((p) => ({
        id: p.id,
        name: p.name,
        openTasks: p.openTasks,
        overdueTasks: p.overdueTasks,
        progressPct: p.openTasks > 0 ? Math.round(((p.openTasks - p.overdueTasks) / p.openTasks) * 100) : null,
      })),
    blockedTasks: open
      .filter((t) => (t.blockedCount ?? 0) > 0)
      .map((t) => ({ id: t.id, title: t.title, blockCount: t.blockedCount ?? 0 })),
    rescheduleCount: input.rescheduleCount,
  };

  const patterns = detectPatterns(patternInput).slice(0, AI_MAX_INSIGHTS);
  const insufficient = isInsufficientEvidence(patternInput);

  const adherence = scheduledMinutes > 0 ? Math.round((actualMinutes / scheduledMinutes) * 100) : null;

  return {
    patternInput,
    patterns,
    insufficient,
    stats: [
      { label: "کارهای انجام‌شده", value: String(completed) },
      { label: "کارهای باز", value: String(open.length) },
      { label: "زمان برنامه‌ریزی‌شده", value: `${scheduledMinutes} دقیقه` },
      { label: "زمان اجراشده", value: `${actualMinutes} دقیقه` },
      { label: "نرخ پیروی از برنامه", value: adherence === null ? "—" : `${adherence}٪` },
      { label: "الگوهای شناسایی‌شده", value: String(patterns.length) },
    ],
    sources,
  };
}

function minutesSpentOn(sessions: InsightSessionInput[], taskId: string): number {
  return sessions
    .filter((s) => s.taskId === taskId)
    .reduce((n, s) => n + s.minutes, 0);
}

/* ------------------------------------------------------------------ */
/* Model-facing rendering (§26, §27)                                    */
/* ------------------------------------------------------------------ */

/**
 * The exact text sent to the provider, and the same text the user can inspect
 * in the privacy panel. Deterministic by construction: every line below is a
 * number we already computed.
 */
export function renderInsightContextForModel(
  input: InsightContextInput,
  agg: InsightAggregation,
): string {
  const lines: string[] = [];

  lines.push(`# شخصیت: ${input.persona}`);
  lines.push(`# بازهٔ تحلیل: ${input.window}`);
  lines.push(`# امروز: ${input.todayKey}`);
  lines.push(
    `# ظرفیت روزانه: ${input.availability.dayStart} تا ${input.availability.dayEnd} (${capacityMinutesOf(input.availability)} دقیقه مفید)`,
  );

  lines.push("");
  lines.push("## آمار قطعی محاسبه‌شده توسط موتور بهره‌وری");
  for (const s of agg.stats) lines.push(`- ${s.label}: ${s.value}`);

  lines.push("");
  lines.push("## الگوهای شناسایی‌شده (قطعی — فقط همین‌ها واقعی هستند)");
  if (agg.patterns.length === 0) {
    lines.push("- هیچ الگویی با اطمینان کافی تشخیص داده نشد.");
  } else {
    agg.patterns.forEach((p, i) => {
      lines.push(`${i + 1}. [${p.type}] شدت: ${p.severity} | اطمینان: ${p.confidence} | بازه: ${p.timeWindow} | نمونه: ${p.sampleSize}`);
      lines.push(`   یافتهٔ قطعی: ${p.statement}`);
      for (const e of p.evidence) lines.push(`   - ${e.label}: ${e.value}`);
      if (p.affectedEntityIds.length > 0) {
        lines.push(`   شناسه‌های درگیر: ${p.affectedEntityIds.join("، ")}`);
      }
    });
  }

  if (input.domainContext.length > 0) {
    lines.push("");
    lines.push("## زمینهٔ تخصصی (برچسب‌ها)");
    for (const d of input.domainContext) lines.push(`- ${d}`);
  }

  return lines.join("\n").slice(0, AI_MAX_CONTEXT_CHARS);
}

/* ------------------------------------------------------------------ */
/* Progression + automation hooks (§18, §19)                           */
/* ------------------------------------------------------------------ */

/** §19 — real progression numbers, explained not gamified. */
export interface ProgressionContext {
  level: number;
  totalXp: number;
  xpThisMonth: number;
  statDeltas: Array<{ key: string; label: string; deltaPct: number | null }>;
  questsActive: number;
  questsDone: number;
}

export function renderProgressionForModel(p: ProgressionContext): string {
  const lines: string[] = [];
  lines.push("## پیشرفت و آمار (واقعی)");
  lines.push(`- سطح: ${p.level} | XP کل: ${p.totalXp} | XP این ماه: ${p.xpThisMonth}`);
  for (const s of p.statDeltas) {
    lines.push(`- ${s.label}: ${s.deltaPct === null ? "دادهٔ کافی نیست" : `${s.deltaPct > 0 ? "+" : ""}${s.deltaPct}٪ نسبت به بازهٔ قبل`}`);
  }
  lines.push(`- ماموریت‌ها: ${p.questsDone} انجام‌شده از ${p.questsActive} فعال`);
  return lines.join("\n");
}

/** §6 — actions a review may propose. Reuses the Phase 15 vocabulary. */
export const ADAPTIVE_ACTION_TYPES: AIAction["type"][] = [
  "reschedule_task",
  "change_priority",
  "update_task",
  "create_time_block",
  "move_time_block",
  "update_project",
  "update_goal",
  "create_note",
];

/** §25 — the version string echoed back in the response for auditability. */
export function contextVersion(): string {
  return AI_CONTEXT_VERSION;
}
