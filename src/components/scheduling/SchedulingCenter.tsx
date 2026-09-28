/**
 * Scheduling Center — Phase 11 §7 (daily), §8/§28 (weekly planning),
 * §13 (conflicts), §12 (unscheduled work) and §15/§17 (preferences).
 *
 * Rendered by the Planning page right under the Phase 10 Planning Center:
 *
 *   PlanningEngine  →  SchedulingEngine  →  Time blocks / Calendar
 *
 * Two modes share ONE hook instance:
 *   روزانه — today's timeline (fixed commitments, blocks, gaps, now marker)
 *   هفتگی  — workload per day, overloaded days, available capacity, due work
 *
 * Facts (week load, conflicts, unscheduled) and advice (recommendations)
 * stay separated exactly like Phase 10; every change still requires an
 * explicit confirmation. Nothing here earns XP (§32).
 */
import { useState } from "react";
import {
  CalendarClock,
  CalendarPlus,
  CalendarRange,
  Settings2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyHint, Panel, Pill } from "@/components/progress/progress-ui";
import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { toFa } from "@/lib/persian";
import { formatDueFa } from "@/lib/task-utils";
import { cn } from "@/lib/utils";
import {
  DAY_LOAD_LABELS_FA,
  SCHEDULING_EMPTY_STATE_FA,
  type ConflictKind,
} from "@/lib/scheduling";
import type { UsePlanningResult } from "@/hooks/use-planning";
import { useSchedule, type UseScheduleResult } from "@/hooks/use-schedule";
import { DayTimeline } from "./DayTimeline";
import { ScheduleRecommendations } from "./ScheduleRecommendations";
import {
  useScheduleDialogs,
  type ScheduleDialogActions,
} from "./use-schedule-dialogs";
import {
  LOAD_TONE,
  dayLabelFa,
  durationLabel,
  hoursFa,
  timeFa,
} from "./schedule-ui";

const CONFLICT_LABEL_FA: Record<ConflictKind, string> = {
  invalid_range: "بازه نامعتبر",
  outside_window: "بیرون از بازه روز",
  overlap: "هم‌پوشانی",
  double_booking: "دوباره‌کاری",
  insufficient_duration: "مدت ناکافی",
  deadline_conflict: "تعارض موعد",
  back_to_back: "پشت‌سرهم بدون فاصله",
};

const BUFFER_CHOICES = [0, 5, 10, 15, 30];
const BREAK_CHOICES = [5, 10, 15, 30];
const MAX_FOCUS_CHOICES = [30, 45, 60, 90, 120];
const FOCUS_CHOICES = [
  { key: "morning", label: "صبح" },
  { key: "evening", label: "عصر" },
  { key: "any", label: "فرقی نمی‌کند" },
] as const;

/* ------------------------------------------------------------------ */
/* Weekly planning (§8 / §28)                                          */
/* ------------------------------------------------------------------ */

function WeekPlanningPanel({ schedule }: { schedule: UseScheduleResult }) {
  const week = schedule.result.week;
  const overloaded = week.filter((w) => w.load === "overloaded");

  return (
    <Panel
      title="هفته پیش رو"
      icon={<CalendarRange className="size-4 text-primary" aria-hidden />}
      description="بار کاری هر روز در برابر ظرفیت واقعی همان روز — قبل از هر تغییری مرور کن"
      action={
        overloaded.length > 0 ? (
          <Pill toneKey="rose">{toFa(overloaded.length)} روز بیش از ظرفیت</Pill>
        ) : undefined
      }
    >
      <ul className="space-y-2.5">
        {week.map((w) => {
          const avail = w.availability;
          const unknown = avail.unknown;
          const capacity = unknown ? null : avail.availableMinutes + w.plannedMinutes;
          const pct =
            capacity && capacity > 0
              ? Math.min(100, Math.round((w.plannedMinutes / capacity) * 100))
              : 0;
          return (
            <li
              key={w.day}
              className={cn(
                "rounded-xl border px-3 py-2.5",
                w.isToday
                  ? "border-primary/50 bg-primary/5"
                  : "border-border/60 bg-white/50 dark:bg-white/5",
              )}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[12px] font-extrabold">
                  {dayLabelFa(w.day)}
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {toFa(w.day)}
                </span>
                <Pill toneKey={LOAD_TONE[w.load]}>
                  {DAY_LOAD_LABELS_FA[w.load]}
                </Pill>
                <span className="ms-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                  <span>
                    کار: <b className="text-foreground">{hoursFa(w.plannedMinutes)}</b>
                  </span>
                  <span>
                    خالی:{" "}
                    <b className="text-foreground">
                      {unknown ? "نامشخص" : hoursFa(avail.availableMinutes)}
                    </b>
                  </span>
                  {w.unscheduledMinutes > 0 && (
                    <span>
                      بدون برنامه:{" "}
                      <b className="text-amber-600 dark:text-amber-300">
                        {hoursFa(w.unscheduledMinutes)}
                      </b>
                    </span>
                  )}
                  {w.dueTaskCount > 0 && (
                    <span>{toFa(w.dueTaskCount)} کار موعددار</span>
                  )}
                </span>
              </div>
              <div className="mt-2">
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-muted/70 dark:bg-white/10"
                  role="img"
                  aria-label={`بار روز ${dayLabelFa(w.day)}: ${DAY_LOAD_LABELS_FA[w.load]}`}
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      w.load === "overloaded"
                        ? "bg-rose-500"
                        : w.load === "heavy"
                          ? "bg-amber-500"
                          : w.load === "balanced"
                            ? "bg-blue-500"
                            : "bg-emerald-500",
                    )}
                    style={{ width: `${unknown ? 0 : pct}%` }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {overloaded.length > 0 && (
        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-5 text-amber-700 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {overloaded.map((w) => dayLabelFa(w.day)).join("، ")} بیش از ظرفیت
          برنامه‌ریزی شده — پیشنهاد انتقال بلوک‌های انعطاف‌پذیر در پایین منتظر
          بررسی و تأیید توست.
        </p>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Conflicts (§13) — facts, never auto-fixed                           */
/* ------------------------------------------------------------------ */

function ConflictsPanel({ schedule }: { schedule: UseScheduleResult }) {
  const dayKey = schedule.dayKey;
  const conflicts = [...schedule.result.conflicts]
    .sort((a, b) => {
      if (a.day === dayKey && b.day !== dayKey) return -1;
      if (b.day === dayKey && a.day !== dayKey) return 1;
      return a.day.localeCompare(b.day);
    })
    .slice(0, 8);

  return (
    <Panel
      title="تعارض‌های برنامه"
      icon={<TriangleAlert className="size-4 text-amber-500" aria-hidden />}
      description="هم‌پوشانی‌ها، بازه‌های نامعتبر و فاصله‌های غیرواقعی — فقط گزارش، بدون تغییر خودکار"
    >
      {conflicts.length === 0 ? (
        <EmptyHint>
          تعارضی بین بلوک‌ها، جلسات و بازه روز پیدا نشد — برنامه از نظر زمانی
          سالم است.
        </EmptyHint>
      ) : (
        <ul className="space-y-2">
          {conflicts.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-amber-200/70 bg-amber-50/60 px-3 py-2.5 dark:border-amber-500/20 dark:bg-amber-500/10"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Pill toneKey="amber">{CONFLICT_LABEL_FA[c.kind]}</Pill>
                <span className="text-[10px] font-bold tabular-nums text-muted-foreground">
                  {dayLabelFa(c.day)}
                </span>
                <span className="text-[11px] font-bold">
                  {c.a.title}
                  {c.b ? ` ← → ${c.b.title}` : ""}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                {c.detail}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Unscheduled important work (§12) — planning feeds scheduling (§25)  */
/* ------------------------------------------------------------------ */

function UnscheduledPanel({
  plan,
  schedule,
  actions,
  limit = 6,
}: {
  plan: UsePlanningResult;
  schedule: UseScheduleResult;
  actions: ScheduleDialogActions;
  limit?: number;
}) {
  const { tasks } = useWorkspace();

  const scoreOf = new Map<string, number>(
    plan.result.priorities.map((p) => [String(p.task._id), p.attention.score]),
  );
  const ranked = [...schedule.result.unscheduled]
    .sort(
      (a, b) =>
        (scoreOf.get(String(b._id)) ?? 0) - (scoreOf.get(String(a._id)) ?? 0) ||
        (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"),
    )
    .slice(0, limit);

  if (ranked.length === 0) return null;

  return (
    <Panel
      title="کارهای بدون برنامه"
      icon={<CalendarPlus className="size-4 text-primary" aria-hidden />}
      description="کارهای ریشه‌ای باز که در این هفته هیچ بلوک زمانی ندارند — زمان‌بندی فقط با انتخاب تو"
      action={
        <Pill toneKey="slate">
          {toFa(schedule.result.unscheduled.length)} مورد
        </Pill>
      }
    >
      <ul className="space-y-2">
        {ranked.map((t) => {
          const doc = tasks.find((x) => x._id === t._id);
          if (!doc) return null;
          return (
            <li
              key={t._id}
              className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl border border-border/60 bg-white/50 px-3 py-2.5 dark:bg-white/5"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold">
                {t.title}
              </span>
              <Pill toneKey={t.estimateMinutes ? "blue" : "amber"}>
                {durationLabel(t.estimateMinutes)}
              </Pill>
              {t.dueDate && (
                <span className="text-[10px] font-bold tabular-nums text-muted-foreground">
                  {formatDueFa(t.dueDate)}
                </span>
              )}
              <Button
                size="sm"
                variant="soft"
                className="h-7 rounded-lg px-2.5 text-[11px]"
                onClick={() => actions.openScheduleTask(doc)}
              >
                زمان‌بندی
              </Button>
            </li>
          );
        })}
      </ul>
      {schedule.result.unscheduled.length > limit && (
        <p className="mt-2.5 text-[11px] text-muted-foreground">
          {toFa(schedule.result.unscheduled.length - limit)} مورد دیگر هم هست —
          پیشنهادهای زمان‌بندی پایین مهم‌ترین‌ها را اول می‌آورند.
        </p>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Preferences (§15 buffer, §16 breaks, §17 focus) — existing store    */
/* ------------------------------------------------------------------ */

function SchedulePrefsPanel({ schedule }: { schedule: UseScheduleResult }) {
  const { prefs, savePrefs } = schedule;
  const update = (patch: Partial<typeof prefs>) => savePrefs({ ...prefs, ...patch });

  const selectCls =
    "h-8 rounded-md border border-input bg-card px-2 text-xs font-bold outline-none focus-visible:outline-2 focus-visible:outline-primary";

  return (
    <Panel
      title="تنظیمات زمان‌بندی"
      icon={<Settings2 className="size-4 text-primary" aria-hidden />}
      description="بافر، استراحت و ساعات تمرکز — تغییرها فوراً روی محاسبات و پیشنهادها اثر می‌گذارند"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex items-center justify-between gap-2 text-[12px] font-semibold">
          بازه قابل استفاده روز
          <span className="flex items-center gap-1">
            <input
              type="time"
              value={prefs.dayStart}
              onChange={(e) => update({ dayStart: e.target.value || prefs.dayStart })}
              aria-label="شروع بازه روز"
              className={cn(selectCls, "tabular-nums")}
            />
            <span aria-hidden className="text-muted-foreground">–</span>
            <input
              type="time"
              value={prefs.dayEnd}
              onChange={(e) => update({ dayEnd: e.target.value || prefs.dayEnd })}
              aria-label="پایان بازه روز"
              className={cn(selectCls, "tabular-nums")}
            />
          </span>
        </label>

        <label className="flex items-center justify-between gap-2 text-[12px] font-semibold">
          بافر بین بلوک‌ها
          <select
            value={prefs.bufferMinutes}
            onChange={(e) => update({ bufferMinutes: Number(e.target.value) })}
            aria-label="بافر بین بلوک‌ها به دقیقه"
            className={selectCls}
          >
            {BUFFER_CHOICES.map((m) => (
              <option key={m} value={m}>
                {m === 0 ? "بدون بافر" : `${toFa(m)} دقیقه`}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center justify-between gap-2 text-[12px] font-semibold">
          استراحت پیشنهادی
          <select
            value={prefs.breakMinutes}
            onChange={(e) => update({ breakMinutes: Number(e.target.value) })}
            aria-label="مدت استراحت پیشنهادی به دقیقه"
            className={selectCls}
          >
            {BREAK_CHOICES.map((m) => (
              <option key={m} value={m}>
                {toFa(m)} دقیقه
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center justify-between gap-2 text-[12px] font-semibold">
          حداکثر تمرکز پیوسته
          <select
            value={prefs.maxFocusMinutes}
            onChange={(e) => update({ maxFocusMinutes: Number(e.target.value) })}
            aria-label="حداکثر مدت تمرکز پیوسته به دقیقه"
            className={selectCls}
          >
            {MAX_FOCUS_CHOICES.map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${toFa(m)} دقیقه` : `${toFa(m / 60)} ساعت`}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center justify-between gap-2 text-[12px] font-semibold sm:col-span-2 lg:col-span-1">
          ساعات تمرکز ترجیحی
          <div className="flex gap-1" role="radiogroup" aria-label="ساعات تمرکز ترجیحی">
            {FOCUS_CHOICES.map((f) => (
              <button
                key={f.key}
                type="button"
                role="radio"
                aria-checked={prefs.focusPreference === f.key}
                onClick={() => update({ focusPreference: f.key })}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                  prefs.focusPreference === f.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/70 bg-white/60 text-muted-foreground hover:border-primary/40 dark:bg-white/5",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Page section                                                        */
/* ------------------------------------------------------------------ */

export function SchedulingCenter({ plan }: { plan: UsePlanningResult }) {
  const schedule = useSchedule(plan);
  const actions = useScheduleDialogs(schedule);
  const [mode, setMode] = useState<"day" | "week">("day");

  const today = schedule.result.today;
  const summary = schedule.result.week.find((w) => w.day === schedule.dayKey);

  const modeBtn = (key: "day" | "week", label: string) => (
    <button
      key={key}
      type="button"
      aria-pressed={mode === key}
      onClick={() => setMode(key)}
      className={cn(
        "rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-primary",
        mode === key
          ? "bg-gradient-to-l from-primary to-[#5B5FE6] text-white shadow-[0_6px_16px_-12px_rgba(37,99,235,0.95)]"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <CalendarClock className="size-5 text-primary" aria-hidden />
            زمان‌بندی و بلوک‌های زمانی
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            از «چه کاری؟» به «کی انجامش دهم؟» — محاسبات قطعی، تغییرات فقط با
            تأیید تو.
          </p>
        </div>
        <div
          aria-label="حالت زمان‌بندی"
          className="inline-flex rounded-xl border border-border/70 bg-white/60 p-1 dark:bg-white/5"
        >
          {modeBtn("day", "روزانه")}
          {modeBtn("week", "هفتگی")}
        </div>
      </div>

      {/* Quick facts — real numbers only */}
      <div className="flex flex-wrap gap-1.5">
        <Pill toneKey="slate">
          پنجره امروز {timeFa(schedule.prefs.dayStart)}–{timeFa(schedule.prefs.dayEnd)}
        </Pill>
        <Pill toneKey="emerald">خالی امروز {hoursFa(today.availableMinutes)}</Pill>
        {summary && (
          <Pill toneKey={LOAD_TONE[summary.load]}>
            بار امروز: {DAY_LOAD_LABELS_FA[summary.load]}
          </Pill>
        )}
        <Pill toneKey="amber">
          بدون برنامه: {toFa(schedule.result.unscheduled.length)}
        </Pill>
        {schedule.result.conflicts.length > 0 && (
          <Pill toneKey="rose">
            {toFa(schedule.result.conflicts.length)} تعارض
          </Pill>
        )}
      </div>

      {mode === "day" ? (
        <DayTimeline schedule={schedule} actions={actions} />
      ) : (
        <WeekPlanningPanel schedule={schedule} />
      )}

      <ConflictsPanel schedule={schedule} />

      <UnscheduledPanel plan={plan} schedule={schedule} actions={actions} limit={6} />

      <ScheduleRecommendations
        schedule={schedule}
        actions={actions}
        limit={8}
        showEmpty
      />

      <SchedulePrefsPanel schedule={schedule} />

      {today.unknown && (
        <p className="text-[11px] text-muted-foreground">
          {SCHEDULING_EMPTY_STATE_FA}
        </p>
      )}

      {actions.dialogs}
    </div>
  );
}
