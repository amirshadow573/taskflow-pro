/**
 * Phase 15 — AI context architecture (§1, §5, §20, §26, §27).
 *
 * The AI never gets raw database access. It gets ONE typed envelope, built by
 * AIContextService (src/convex/ai.ts) out of the user's own records and then
 * serialized by `renderAIContextForModel` below.
 *
 * Two rules shape this file:
 *  1. MINIMAL — every field here is something a reasonable answer could be
 *     grounded in. Nothing else is read, let alone transmitted.
 *  2. BOUNDED — counts and string lengths are capped so a large workspace
 *     cannot produce a multi-hundred-KB prompt or a runaway bill.
 *
 * Pure module. Nothing here touches the network or the database.
 */
import { AI_MAX_CONTEXT_CHARS } from "./types";

/* ------------------------------------------------------------------ */
/* The envelope                                                        */
/* ------------------------------------------------------------------ */

export interface AIContextPersona {
  key: string;
  label: string;
  /** From Phase 02.6 context & environment — only non-identifying labels. */
  environment?: string | null;
  workStyle?: string | null;
  productivityStyle?: string | null;
}

export interface AIContextTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
  projectId?: string;
  estimateMinutes?: number;
  postponeCount?: number;
}

export interface AIContextProject {
  id: string;
  name: string;
  status: string;
  deadline?: string;
  taskCount: number;
  openTaskCount: number;
}

export interface AIContextGoal {
  id: string;
  title: string;
  status: string;
  progress: number;
  dueDate?: string;
}

export interface AIContextBlock {
  id: string;
  title: string;
  day: string;
  startTime: string;
  endTime: string;
  kind: string;
  fixed: boolean;
  taskId?: string;
}

export interface AIContextEvent {
  title: string;
  day: string;
  type: string;
}

export interface AIContextAvailability {
  dayStart: string;
  dayEnd: string;
  bufferMinutes: number;
  breakMinutes: number;
  maxFocusMinutes: number;
  focusPreference: string;
}

/**
 * Facts the DETERMINISTIC engine already computed. The AI explains these; it
 * never recomputes or contradicts them (§18, §13).
 */
export interface AIContextFacts {
  todayKey: string;
  horizonDays: number;
  todayTaskCount: number;
  openTaskCount: number;
  todayPlannedMinutes: number;
  todayCapacityMinutes: number;
  overloaded: boolean;
  upcomingDeadlines: Array<{ title: string; dueDate: string; daysLeft: number }>;
  planningAccuracyPct?: number;
  completedLast7Days: number;
  delayedLast7Days: number;
  note: string;
}

export interface AIContext {
  persona: AIContextPersona;
  availability: AIContextAvailability;
  facts: AIContextFacts;
  tasks: AIContextTask[];
  projects: AIContextProject[];
  goals: AIContextGoal[];
  blocks: AIContextBlock[];
  events: AIContextEvent[];
  routines: Array<{ title: string; doneCount: number; totalCount: number }>;
  /** Short labels only (exams, classes, clients, meetings) — §20. */
  domainContext: string[];
  /** What was actually included — powers the §27 "AI will use" disclosure. */
  sources: string[];
}

/* ------------------------------------------------------------------ */
/* Caps                                                                */
/* ------------------------------------------------------------------ */

export const AI_CONTEXT_LIMITS = {
  tasks: 40,
  projects: 12,
  goals: 10,
  blocks: 30,
  events: 15,
  domainContext: 12,
  maxTitleLength: 120,
} as const;

/* ------------------------------------------------------------------ */
/* Serialization                                                       */
/* ------------------------------------------------------------------ */

function clip(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/**
 * Render the envelope as the deterministic text block embedded in the user
 * message. Deliberately line-oriented and compact: models read structured
 * plain text more reliably than prose, and it keeps the prompt auditable —
 * the exact string sent to the provider is the string shown in the UI preview
 * (§26, §27).
 */
export function renderAIContextForModel(ctx: AIContext): string {
  const L = AI_CONTEXT_LIMITS;
  const lines: string[] = [];

  lines.push(`# تاریخ امروز: ${ctx.facts.todayKey}`);
  lines.push(`# افق تحلیل: ${ctx.facts.horizonDays} روز`);
  lines.push(`# شخصیت: ${ctx.persona.key}`);
  if (ctx.persona.environment) lines.push(`# محیط: ${ctx.persona.environment}`);
  if (ctx.persona.workStyle) lines.push(`# سبک کاری: ${ctx.persona.workStyle}`);
  if (ctx.persona.productivityStyle) {
    lines.push(`# سبک بهره‌وری: ${ctx.persona.productivityStyle}`);
  }

  const a = ctx.availability;
  lines.push(
    `# زمان در دسترس روزانه: ${a.dayStart} تا ${a.dayEnd} | حداکثر تمرکز پیوسته: ${a.maxFocusMinutes} دقیقه | استراحت: ${a.breakMinutes} دقیقه`,
  );

  lines.push("");
  lines.push("## واقعیت‌های محاسبه‌شده توسط موتور برنامه‌ریزی (مبنای پاسخ تو)");
  lines.push(ctx.facts.note);
  lines.push(
    `کارهای امروز: ${ctx.facts.todayTaskCount} | کارهای باز: ${ctx.facts.openTaskCount} | زمان برنامه‌ریزی‌شدهٔ امروز: ${ctx.facts.todayPlannedMinutes} دقیقه | ظرفیت امروز: ${ctx.facts.todayCapacityMinutes} دقیقه`,
  );
  lines.push(
    ctx.facts.overloaded
      ? "هشدار موتور: بار امروز بیش از ظرفیت است."
      : "موتور: بار امروز در محدودهٔ ظرفیت است.",
  );
  lines.push(
    `هفتهٔ گذشته: ${ctx.facts.completedLast7Days} کار انجام‌شده، ${ctx.facts.delayedLast7Days} کار به تعویق‌افتاده.`,
  );
  if (ctx.facts.planningAccuracyPct !== undefined) {
    lines.push(`دقت برنامه‌ریزی: ${ctx.facts.planningAccuracyPct}٪`);
  }
  if (ctx.facts.upcomingDeadlines.length > 0) {
    lines.push("سررسیدهای نزدیک:");
    for (const d of ctx.facts.upcomingDeadlines) {
      lines.push(`- ${clip(d.title, L.maxTitleLength)} — ${d.dueDate} (${d.daysLeft} روز مانده)`);
    }
  }

  if (ctx.projects.length > 0) {
    lines.push("");
    lines.push("## پروژه‌ها");
    for (const p of ctx.projects.slice(0, L.projects)) {
      lines.push(
        `- [${p.id}] ${clip(p.name, L.maxTitleLength)} — وضعیت: ${p.status} — کار باز: ${p.openTaskCount}/${p.taskCount}${p.deadline ? ` — سررسید: ${p.deadline}` : ""}`,
      );
    }
  }

  if (ctx.tasks.length > 0) {
    lines.push("");
    lines.push("## کارها");
    for (const t of ctx.tasks.slice(0, L.tasks)) {
      lines.push(
        `- [${t.id}] ${clip(t.title, L.maxTitleLength)} — ${t.status} — اولویت: ${t.priority}${t.dueDate ? ` — سررسید: ${t.dueDate}` : ""}${t.estimateMinutes ? ` — تخمین: ${t.estimateMinutes} دقیقه` : ""}${t.projectId ? ` — پروژه: ${t.projectId}` : ""}`,
      );
    }
  }

  if (ctx.goals.length > 0) {
    lines.push("");
    lines.push("## اهداف");
    for (const g of ctx.goals.slice(0, L.goals)) {
      lines.push(
        `- [${g.id}] ${clip(g.title, L.maxTitleLength)} — ${g.status} — پیشرفت: ${g.progress}٪${g.dueDate ? ` — سررسید: ${g.dueDate}` : ""}`,
      );
    }
  }

  if (ctx.blocks.length > 0) {
    lines.push("");
    lines.push("## بلوک‌های زمانی");
    for (const b of ctx.blocks.slice(0, L.blocks)) {
      lines.push(
        `- [${b.id}] ${b.day} ${b.startTime}–${b.endTime} — ${clip(b.title, L.maxTitleLength)} (${b.kind}${b.fixed ? "، ثابت" : ""})`,
      );
    }
  }

  if (ctx.events.length > 0) {
    lines.push("");
    lines.push("## رویدادهای پیش‌رو");
    for (const e of ctx.events.slice(0, L.events)) {
      lines.push(`- ${e.day} — ${clip(e.title, L.maxTitleLength)} (${e.type})`);
    }
  }

  if (ctx.routines.length > 0) {
    lines.push("");
    lines.push("## روتین‌ها");
    for (const r of ctx.routines) {
      lines.push(`- ${clip(r.title, L.maxTitleLength)} — ${r.doneCount}/${r.totalCount} انجام‌شده`);
    }
  }

  if (ctx.domainContext.length > 0) {
    lines.push("");
    lines.push("## زمینهٔ تخصصی (برچسب‌ها)");
    for (const c of ctx.domainContext.slice(0, L.domainContext)) {
      lines.push(`- ${clip(c, L.maxTitleLength)}`);
    }
  }

  return lines.join("\n").slice(0, AI_MAX_CONTEXT_CHARS);
}

/** Persian one-liner per source, for the "AI will use" disclosure (§27). */
export const CONTEXT_SOURCE_LABELS_FA: Record<string, string> = {
  persona: "شخصیت و سبک کاری شما",
  availability: "ساعات کاری و محدودیت تمرکز",
  facts: "آمار محاسبه‌شدهٔ برنامه‌ریزی",
  tasks: "کارهای باز",
  projects: "پروژه‌های فعال",
  goals: "اهداف",
  blocks: "بلوک‌های زمانی",
  events: "رویدادهای پیش‌رو",
  routines: "روتین‌ها",
  domain: "زمینهٔ تخصصی",
};

export function describeContextSources(ctx: AIContext): string[] {
  return ctx.sources
    .map((s) => CONTEXT_SOURCE_LABELS_FA[s] ?? s)
    .filter(Boolean);
}
