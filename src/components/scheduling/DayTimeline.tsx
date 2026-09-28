/**
 * Day Timeline — Phase 11 §7 (daily scheduling surface) + §31 (coexists
 * with the existing calendar instead of duplicating it).
 *
 * A responsive, agenda-style timeline for one day: fixed commitments
 * (context events / meetings), time blocks, real free gaps, a "now" marker
 * and the next block. Every row is keyboard-accessible and has explicit
 * button alternatives (§39) — no drag & drop required.
 *
 * Interaction rules (§2, §21, §23):
 *   - Flexible blocks: [جابه‌جایی] opens the reschedule dialog — the block
 *     only moves after the user picks a slot and confirms.
 *   - Missed blocks: [جابه‌جایی] [بی‌خیال] [انجام شد] — the linked task's
 *     status and history are never touched automatically.
 *   - Fixed commitments render as facts: no move actions, clearly badged
 *     as «ثابت».
 *
 * Pure display + callbacks: all writes flow through UseScheduleResult's
 * controlled mutations.
 */
import { Fragment, useMemo } from "react";
import { AlarmClock, CalendarDays, Coffee, Plus, Users } from "lucide-react";
import { EmptyHint, Pill } from "@/components/progress/progress-ui";
import { useUserProfile } from "@/hooks/use-user-profile";
import { toFa, formatJalaliShort } from "@/lib/persian";
import { todayKey } from "@/lib/task-utils";
import { cn } from "@/lib/utils";
import {
  DAY_LOAD_LABELS_FA,
  SCHEDULING_EMPTY_STATE_FA,
  blockLabel,
  minutesOf,
  nowMinutes,
  type FixedCommitment,
  type ScheduleBlock,
  type TimeSlot,
} from "@/lib/scheduling";
import type { UseScheduleResult } from "@/hooks/use-schedule";
import type { ScheduleDialogActions } from "./use-schedule-dialogs";
import { LOAD_TONE, hoursFa, minutesFa, timeFa } from "./schedule-ui";

/* ------------------------------------------------------------------ */
/* Row model                                                           */
/* ------------------------------------------------------------------ */

type TimelineRow =
  | { key: string; kind: "commitment"; start: number; end: number; allDay: boolean; commitment: FixedCommitment }
  | { key: string; kind: "block"; start: number; end: number; block: ScheduleBlock }
  | { key: string; kind: "gap"; start: number; end: number; gap: TimeSlot };

function buildRows(
  commitments: FixedCommitment[],
  blocks: ScheduleBlock[],
  gaps: TimeSlot[],
): TimelineRow[] {
  const rows: TimelineRow[] = [];

  for (const c of commitments) {
    const s = c.startTime ? minutesOf(c.startTime) : null;
    const e = c.endTime ? minutesOf(c.endTime) : null;
    rows.push({
      key: `c:${c.id}`,
      kind: "commitment",
      start: s ?? -1,
      end: e ?? (s ?? -1),
      allDay: s === null,
      commitment: c,
    });
  }
  for (const b of blocks) {
    if (b.status === "cancelled") continue;
    const s = minutesOf(b.startTime);
    const e = minutesOf(b.endTime);
    if (s === null || e === null) continue; // invalid range — never render lies
    rows.push({ key: `b:${b._id}`, kind: "block", start: s, end: e, block: b });
  }
  for (let i = 0; i < gaps.length; i++) {
    const g = gaps[i];
    const s = minutesOf(g.start);
    const e = minutesOf(g.end);
    if (s === null || e === null || e <= s) continue;
    rows.push({ key: `g:${i}:${g.start}`, kind: "gap", start: s, end: e, gap: g });
  }

  rows.sort((a, b) => a.start - b.start || a.end - b.end);
  return rows;
}

/* ------------------------------------------------------------------ */
/* One row                                                             */
/* ------------------------------------------------------------------ */

function TimelineRowView({
  row,
  isToday,
  now,
  isNext,
  actions,
}: {
  row: TimelineRow;
  isToday: boolean;
  now: number;
  isNext: boolean;
  actions: ScheduleDialogActions;
}) {
  const { personaKey } = useUserProfile();

  const gutter =
    row.kind === "gap"
      ? `${timeFa(row.gap.start)}–${timeFa(row.gap.end)}`
      : row.kind === "commitment" && row.allDay
        ? "تمام روز"
        : `${timeFa(minutesToHm(row.start))}${
            row.end > row.start ? `–${timeFa(minutesToHm(row.end))}` : ""
          }`;

  /* ---- commitment row (fact: never movable here) ---- */
  if (row.kind === "commitment") {
    const c = row.commitment;
    const Icon = c.origin === "meeting" ? Users : CalendarDays;
    return (
      <li className="flex items-start gap-3 border-s-2 border-violet-400/70 px-4 py-2.5">
        <div className="w-16 shrink-0 text-end">
          <span className="text-[11px] font-bold tabular-nums text-muted-foreground">
            {gutter}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Pill toneKey="violet">تعهد ثابت</Pill>
            {isNext && <Pill toneKey="blue">بعدی</Pill>}
            <span className="min-w-0 truncate text-[13px] font-bold">{c.title}</span>
          </div>
        </div>
        <span className="mt-1 shrink-0 text-muted-foreground" aria-hidden>
          <Icon className="size-3.5" />
        </span>
      </li>
    );
  }

  /* ---- gap row ---- */
  if (row.kind === "gap") {
    return (
      <li className="flex items-start gap-3 border-s-2 border-dashed border-border px-4 py-2">
        <div className="w-16 shrink-0 text-end">
          <span className="text-[11px] font-bold tabular-nums text-muted-foreground">
            {gutter}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Pill toneKey="slate">بازه آزاد</Pill>
            <span className="text-[12px] text-muted-foreground">
              {minutesFa(row.gap.minutes)} — جای مناسب زمان‌بندی کار جدید
            </span>
          </div>
        </div>
      </li>
    );
  }

  /* ---- block row (the only actionable kind) ---- */
  const b = row.block;
  const missed = b.status === "missed";
  const completed = b.status === "completed";
  const paused = b.status === "missed" && isToday && row.end < now;

  return (
    <li
      className={cn(
        "flex items-start gap-3 border-s-2 px-4 py-2.5",
        completed
          ? "border-emerald-400/70 opacity-75"
          : missed || paused
            ? "border-amber-400 bg-amber-50/40 dark:bg-amber-500/5"
            : b.fixed
              ? "border-slate-400"
              : "border-primary/60",
      )}
    >
      <div className="w-16 shrink-0 text-end">
        <div className="text-[11px] font-bold tabular-nums">{gutter}</div>
        <div className="text-[10px] tabular-nums text-muted-foreground">
          {minutesFa(Math.max(0, row.end - row.start))}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Pill toneKey={completed ? "emerald" : missed ? "amber" : "blue"}>
            {blockLabel(b.kind, personaKey)}
          </Pill>
          {b.fixed && <Pill toneKey="slate">ثابت</Pill>}
          {completed && <Pill toneKey="emerald">انجام‌شده</Pill>}
          {missed && <Pill toneKey="amber">از دست رفته</Pill>}
          {isNext && !completed && <Pill toneKey="blue">بعدی</Pill>}
          <span
            className={cn(
              "min-w-0 truncate text-[13px] font-bold",
              completed && "text-muted-foreground line-through",
            )}
          >
            {b.title}
          </span>
        </div>

        {/* Explicit button actions — accessible alternatives to any DnD (§39) */}
        {!completed && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {!b.fixed && (
              <button
                type="button"
                onClick={() => actions.openReschedule(b)}
                aria-label={`جابه‌جایی ${b.title}`}
                className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-white/60 px-2 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary dark:bg-white/5"
              >
                <AlarmClock className="size-3" aria-hidden />
                جابه‌جایی
              </button>
            )}
            <button
              type="button"
              onClick={() => void actions.completeBlock(b)}
              aria-label={`انجام ${b.title}`}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-300/70 bg-emerald-50/70 px-2 py-1 text-[11px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-primary dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
            >
              انجام شد
            </button>
            {missed && (
              <button
                type="button"
                onClick={() => void actions.keepUnscheduled(b)}
                aria-label={`حذف ${b.title} از برنامه بدون تغییر کار`}
                className="inline-flex items-center gap-1 rounded-lg border border-border/70 px-2 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
              >
                بی‌خیال
              </button>
            )}
            {b.fixed && (
              <span className="text-[10px] text-muted-foreground">
                تعهد ثابت — جابه‌جا نمی‌شود
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function minutesToHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Timeline                                                            */
/* ------------------------------------------------------------------ */

export function DayTimeline({
  schedule,
  actions,
  title = "برنامه زمانی امروز",
  className,
}: {
  schedule: UseScheduleResult;
  actions: ScheduleDialogActions;
  title?: string;
  className?: string;
}) {
  const { result, prefs } = schedule;
  const day = result.days.find((d) => d.day === result.today.day) ?? result.today;
  const summary = result.week.find((w) => w.day === day.day);
  const dayKey = todayKey();
  const isToday = day.day === dayKey;
  const now = nowMinutes();

  const rows = useMemo(
    () =>
      buildRows(
        result.commitments.get(day.day) ?? [],
        result.blocks.filter((b) => b.day === day.day),
        day.gaps,
      ),
    [result.commitments, result.blocks, day],
  );

  /* The next block: first planned, non-finished work/commitment at or after now. */
  const nextKey = useMemo(() => {
    if (!isToday) return null;
    for (const r of rows) {
      if (r.kind === "block") {
        if (r.block.status === "planned" && r.end >= now) return r.key;
      } else if (r.kind === "commitment" && (r.allDay || r.end >= now)) {
        return r.key;
      }
    }
    return null;
  }, [rows, isToday, now]);

  const hasAnything = rows.length > 0;

  /* Where the "now" line belongs — before the first row that starts later. */
  const markerIndex =
    isToday &&
    now >= (minutesOf(prefs.dayStart) ?? 0) &&
    now <= (minutesOf(prefs.dayEnd) ?? 24 * 60) &&
    rows.length > 0
      ? (() => {
          const i = rows.findIndex((r) => r.start > now);
          return i === -1 ? rows.length : i;
        })()
      : -1;

  const nowMarker =
    markerIndex >= 0 ? (
      <li
        className="flex items-center gap-2 px-4 py-1"
        aria-label={`الان ${minutesToHm(now)}`}
      >
        <span className="text-[10px] font-extrabold tabular-nums text-rose-500">
          الان {toFa(minutesToHm(now))}
        </span>
        <span className="h-px flex-1 bg-rose-400/60" aria-hidden />
      </li>
    ) : null;

  return (
    <section
      className={cn("ui-surface overflow-hidden rounded-2xl", className)}
      aria-label={title}
    >
      {/* Header — availability facts (§6), never fabricated */}
      <header className="space-y-2 border-b border-border/50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <span className="ui-icon-tile size-6">
              <CalendarDays className="size-3.5 text-primary" aria-hidden />
            </span>
            {title}
            <span className="text-[11px] font-normal text-muted-foreground">
              {formatJalaliShort(new Date(`${day.day}T00:00:00`))}
            </span>
          </h2>
          {summary && (
            <Pill toneKey={LOAD_TONE[summary.load]}>
              بار روز: {DAY_LOAD_LABELS_FA[summary.load]}
            </Pill>
          )}
        </div>

        {day.unknown ? (
          <p className="text-[11px] text-muted-foreground">{SCHEDULING_EMPTY_STATE_FA}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            <Pill toneKey="slate">
              پنجره روز {timeFa(prefs.dayStart)}–{timeFa(prefs.dayEnd)}
            </Pill>
            <Pill toneKey="violet">تعهد ثابت {hoursFa(day.fixedMinutes)}</Pill>
            <Pill toneKey="blue">برنامه‌ریزی‌شده {hoursFa(day.scheduledMinutes)}</Pill>
            <Pill toneKey="emerald">خالی {hoursFa(day.availableMinutes)}</Pill>
            {day.reservedMinutes > 0 && (
              <Pill toneKey="amber">استراحت {hoursFa(day.reservedMinutes)}</Pill>
            )}
          </div>
        )}
      </header>

      {!hasAnything ? (
        <EmptyHint>
          {day.unknown
            ? SCHEDULING_EMPTY_STATE_FA
            : "امروز هنوز بلوکی نداری — از پیشنهادهای زمان‌بندی شروع کن."}
        </EmptyHint>
      ) : (
        <ul className="divide-y divide-border/40">
          {rows.map((row, i) => (
            <Fragment key={row.key}>
              {i === markerIndex && nowMarker}
              <TimelineRowView
                row={row}
                isToday={isToday}
                now={now}
                isNext={row.key === nextKey}
                actions={actions}
              />
            </Fragment>
          ))}
          {markerIndex === rows.length && nowMarker}
        </ul>
      )}

      {/* Legend — events / meetings / task blocks / breaks are visually distinct (§31) */}
      <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/50 px-4 py-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-sm bg-violet-400" aria-hidden />
          تعهد تقویمی / جلسه
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-sm bg-primary" aria-hidden />
          بلوک کاری
        </span>
        <span className="flex items-center gap-1">
          <Coffee className="size-3" aria-hidden />
          استراحت
        </span>
        <span className="flex items-center gap-1">
          <Plus className="size-3" aria-hidden />
          بازه آزاد
        </span>
        <span className="ms-auto hidden sm:inline">
          تقویم کامل در صفحه تقویم — اینجا فقط برنامه امروز است.
        </span>
      </footer>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Compact strip — dashboard / Today header (§26)                      */
/* ------------------------------------------------------------------ */

export function ScheduleStrip({
  schedule,
  className,
}: {
  schedule: UseScheduleResult;
  className?: string;
}) {
  const { result } = schedule;
  const snap = result.snapshot;
  const summary = result.week.find((w) => w.day === result.today.day);

  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]", className)}
    >
      <span className="flex min-w-0 items-center gap-1.5 font-bold">
        <AlarmClock className="size-3.5 shrink-0 text-primary" aria-hidden />
        {snap.nextBlock ? (
          <>
            <span className="text-muted-foreground">بعدی:</span>
            <span className="tabular-nums text-primary">
              {timeFa(snap.nextBlock.start)}
            </span>
            <span className="min-w-0 truncate">{snap.nextBlock.title}</span>
          </>
        ) : (
          <span className="text-muted-foreground">
            بلوک بعدی‌ای برنامه‌ریزی نشده
          </span>
        )}
      </span>
      <span className="text-muted-foreground">
        خالی:{" "}
        <span className="font-bold text-foreground">
          {result.today.unknown ? "نامشخص" : hoursFa(result.today.availableMinutes)}
        </span>
      </span>
      {summary && (
        <Pill toneKey={LOAD_TONE[summary.load]}>
          بار: {DAY_LOAD_LABELS_FA[summary.load]}
        </Pill>
      )}
    </div>
  );
}
