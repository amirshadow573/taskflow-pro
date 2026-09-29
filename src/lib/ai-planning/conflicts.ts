/**
 * Phase 10.5 — conflict / duplicate / capacity detection (pure).
 *
 * Compares an imported plan against what already exists in the user's
 * workspace. It never mutates anything: the user always decides what lands.
 *
 * Checks performed:
 *  - duplicate tasks / projects / goals (Persian-aware title comparison)
 *  - imported blocks overlapping EXISTING blocks
 *  - imported blocks overlapping EACH OTHER
 *  - daily capacity overflow (vs the user's scheduling preference window)
 *  - references that point at a project/goal that does not exist in the file
 *  - items dated in the past
 */
import { fromMin, normalizeTitle, toMin, type NormalizedAIPlan, type PlanConflict, type PlanDuplicate } from "./types";

export interface ExistingBlock {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  title?: string;
  status?: string;
}

export interface ExistingData {
  tasks: Array<{ id: string; title: string }>;
  projects: Array<{ id: string; name: string }>;
  goals: Array<{ id: string; title: string }>;
  blocks: ExistingBlock[];
  /** Usable minutes per day from the scheduling preferences. */
  availableMinutesPerDay: number;
  /** Local YYYY-MM-DD used to flag past-dated items. */
  todayKey: string;
}

interface Interval {
  title: string;
  day: string;
  start: number;
  end: number;
  origin: "imported" | "existing";
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.day === b.day && a.start < b.end && a.end > b.start;
}

function overlapsAny(a: Interval, others: Interval[]): Interval | undefined {
  return others.find((o) => overlaps(a, o));
}

function fmtDayTitle(item: Interval): string {
  return `«${item.title}» (${item.day} ساعت ${fromMin(item.start)}–${fromMin(item.end)})`;
}

export function detectConflicts(
  plan: NormalizedAIPlan,
  existing: ExistingData,
): PlanConflict[] {
  const conflicts: PlanConflict[] = [];

  const importedBlocks: Interval[] = [
    ...plan.plan.time_blocks.map((b) => ({
      title: b.title,
      day: b.day,
      start: toMin(b.start_time),
      end: toMin(b.end_time),
      origin: "imported" as const,
    })),
    ...plan.plan.calendar_events.map((e) => ({
      title: e.title,
      day: e.day,
      start: toMin(e.start_time),
      end: toMin(e.end_time),
      origin: "imported" as const,
    })),
  ];
  const existingBlocks: Interval[] = existing.blocks
    .filter((b) => (b.status ?? "planned") !== "cancelled")
    .map((b) => ({
      title: b.title ?? "بلوک فعلی",
      day: b.day,
      start: toMin(b.startTime),
      end: toMin(b.endTime),
      origin: "existing" as const,
    }));

  // 1) Imported vs existing
  for (const b of importedBlocks) {
    const hit = overlapsAny(b, existingBlocks);
    if (hit) {
      conflicts.push({
        kind: "overlap_existing",
        day: b.day,
        detail: `«${b.title}» با بلوک موجود در تقویم هم‌زمان است.`,
        items: [fmtDayTitle(b), fmtDayTitle(hit)],
        blocking: true,
      });
    }
  }

  // 2) Imported vs imported
  for (let i = 0; i < importedBlocks.length; i++) {
    const hit = overlapsAny(importedBlocks[i], importedBlocks.slice(i + 1));
    if (hit) {
      conflicts.push({
        kind: "overlap_in_plan",
        day: importedBlocks[i].day,
        detail: `دو بلوک از خود فایل با هم تداخل دارند: «${importedBlocks[i].title}» و «${hit.title}».`,
        items: [fmtDayTitle(importedBlocks[i]), fmtDayTitle(hit)],
        blocking: true,
      });
    }
  }

  // 3) Daily capacity
  const perDay = new Map<string, number>();
  for (const b of importedBlocks) {
    perDay.set(b.day, (perDay.get(b.day) ?? 0) + (b.end - b.start));
  }
  for (const [day, minutes] of perDay) {
    if (minutes > existing.availableMinutesPerDay) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      conflicts.push({
        kind: "capacity",
        day,
        detail: `مجموع بلوک‌های این روز ${h > 0 ? `${h} ساعت` : ""}${h > 0 && m > 0 ? " و " : ""}${m > 0 ? `${m} دقیقه` : ""} است و از بازه کاری شما بیشتر می‌شود.`,
        items: [day],
        blocking: false,
      });
    }
  }

  // 4) References that do not resolve inside the file
  const projectTitles = new Set(plan.plan.projects.map((p) => normalizeTitle(p.title)));
  const goalTitles = new Set(plan.plan.goals.map((g) => normalizeTitle(g.title)));
  for (const t of plan.plan.tasks) {
    if (t.project_ref && !projectTitles.has(normalizeTitle(t.project_ref))) {
      conflicts.push({
        kind: "missing_reference",
        detail: `کار «${t.title}» به پروژه «${t.project_ref}» ارجاع داده که در فایل نیست؛ بدون پروژه وارد می‌شود.`,
        items: [t.title],
        blocking: false,
      });
    }
  }
  for (const b of plan.plan.time_blocks) {
    const taskRefs = plan.plan.tasks.filter((t) => normalizeTitle(t.title) === normalizeTitle(b.task_ref ?? ""));
    if (b.task_ref && taskRefs.length === 0) {
      conflicts.push({
        kind: "missing_reference",
        day: b.day,
        detail: `بلوک «${b.title}» به کار «${b.task_ref}» ارجاع دارد که در فایل نیست.`,
        items: [b.title],
        blocking: false,
      });
    }
  }
  for (const m of plan.plan.milestones) {
    if (m.goal_ref && !goalTitles.has(normalizeTitle(m.goal_ref))) {
      conflicts.push({
        kind: "missing_reference",
        detail: `نقطه عطف «${m.title}» به هدف «${m.goal_ref}» ارجاع دارد که در فایل نیست.`,
        items: [m.title],
        blocking: false,
      });
    }
  }
  for (const p of plan.plan.projects) {
    if (p.goal_ref && !goalTitles.has(normalizeTitle(p.goal_ref))) {
      conflicts.push({
        kind: "missing_reference",
        detail: `پروژه «${p.title}» به هدف «${p.goal_ref}» ارجاع دارد که در فایل نیست.`,
        items: [p.title],
        blocking: false,
      });
    }
  }

  // 5) Past-dated items
  const past = (dayValue?: string) => !!dayValue && dayValue < existing.todayKey;
  for (const t of plan.plan.tasks) {
    if (past(t.due_date)) {
      conflicts.push({
        kind: "past_due",
        detail: `کار «${t.title}» سررسیدش گذشته است (${t.due_date}).`,
        items: [t.title],
        blocking: false,
      });
    }
  }
  for (const b of [...plan.plan.time_blocks, ...plan.plan.calendar_events]) {
    if (past(b.day)) {
      conflicts.push({
        kind: "past_due",
        day: b.day,
        detail: `«${b.title}» برای ${b.day} برنامه‌ریزی شده که گذشته است.`,
        items: [b.title],
        blocking: false,
      });
    }
  }

  return conflicts;
}

export function detectDuplicates(
  plan: NormalizedAIPlan,
  existing: { tasks: Array<{ id: string; title: string }>; projects: Array<{ id: string; name: string }>; goals: Array<{ id: string; title: string }> },
): PlanDuplicate[] {
  const out: PlanDuplicate[] = [];
  const taskIndex = new Map(existing.tasks.map((t) => [normalizeTitle(t.title), t]));
  for (const t of plan.plan.tasks) {
    const hit = taskIndex.get(normalizeTitle(t.title));
    if (hit) {
      out.push({ entity: "task", importedTitle: t.title, existingId: hit.id, existingTitle: hit.title });
    }
  }
  const projectIndex = new Map(existing.projects.map((p) => [normalizeTitle(p.name), p]));
  for (const p of plan.plan.projects) {
    const hit = projectIndex.get(normalizeTitle(p.title));
    if (hit) {
      out.push({ entity: "project", importedTitle: p.title, existingId: hit.id, existingTitle: hit.name });
    }
  }
  const goalIndex = new Map(existing.goals.map((g) => [normalizeTitle(g.title), g]));
  for (const g of plan.plan.goals) {
    const hit = goalIndex.get(normalizeTitle(g.title));
    if (hit) {
      out.push({ entity: "goal", importedTitle: g.title, existingId: hit.id, existingTitle: hit.title });
    }
  }
  return out;
}

/**
 * Drop imported blocks that collide with existing ones — used when the user
 * chooses "skip conflicts" at confirmation time. Blocks already verified as
 * free are returned untouched.
 */
export function filterConflictingBlocks(
  plan: NormalizedAIPlan,
  existing: { blocks: ExistingBlock[] },
): { keep: NormalizedAIPlan["plan"]["time_blocks"]; drop: string[] } {
  const busy: Interval[] = existing.blocks
    .filter((b) => (b.status ?? "planned") !== "cancelled")
    .map((b) => ({
      title: b.title ?? "بلوک فعلی",
      day: b.day,
      start: toMin(b.startTime),
      end: toMin(b.endTime),
      origin: "existing" as const,
    }));
  const keep: NormalizedAIPlan["plan"]["time_blocks"] = [];
  const keptIntervals: Interval[] = [];
  const drop: string[] = [];
  for (const b of plan.plan.time_blocks) {
    const candidate: Interval = {
      title: b.title,
      day: b.day,
      start: toMin(b.start_time),
      end: toMin(b.end_time),
      origin: "imported",
    };
    if (overlapsAny(candidate, [...busy, ...keptIntervals])) {
      drop.push(b.title);
    } else {
      keep.push(b);
      keptIntervals.push(candidate);
    }
  }
  return { keep, drop };
}
