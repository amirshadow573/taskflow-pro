import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import {
  AlarmClock,
  Ban,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Pin,
  TriangleAlert,
  ArrowLeft,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { useUserProfile } from "@/hooks/use-user-profile";
import { TaskRow } from "@/components/tasks/TaskRow";
import { SmartTaskInput } from "@/components/tasks/SmartTaskInput";
import { NextActionCard } from "@/components/workspace/command/NextActionCard";
import { TodayRoutines } from "@/components/workspace/TodayRoutines";
import { TodayPathMissions } from "@/components/progress/TodayPathMissions";
import { Bar, Pill } from "@/components/progress/progress-ui";
import { Button } from "@/components/ui/button";
import { eventTypeLabel } from "@/lib/context-events";
import { usePlanning } from "@/hooks/use-planning";
import { useSchedule } from "@/hooks/use-schedule";
import { useExecution } from "@/hooks/use-execution";
import { ExecutionAtRisk, ExecutionNow } from "@/components/execution/ExecutionNow";
import { ExecutionProgress } from "@/components/execution/ExecutionProgress";
import { AIAssistantButton } from "@/components/ai/AIAssistantPanel";
import { ExecutionRecovery } from "@/components/execution/ExecutionRecovery";
import {
  ExecutionDailyReview,
  ExecutionWeeklyReview,
} from "@/components/execution/ExecutionReview";
import { PlanningSuggestions } from "@/components/planning/PlanningSuggestions";
import { DayTimeline, ScheduleStrip } from "@/components/scheduling/DayTimeline";
import { ScheduleRecommendations } from "@/components/scheduling/ScheduleRecommendations";
import { useScheduleDialogs } from "@/components/scheduling/use-schedule-dialogs";
import { todayKey, isOverdue } from "@/lib/task-utils";
import { formatJalaliFull, toFa } from "@/lib/persian";
import { cn } from "@/lib/utils";

/** Persona-aware section labels for Today. Shared foundation, tailored wording. */
const PERSONA_SECTIONS: Record<
  string,
  {
    must: string;
    important: string;
    could: string;
    schedule: string;
    deadlines: string;
    empty: string;
  }
> = {
  student: {
    must: "باید امروز انجام شود",
    important: "مهم‌های امروز",
    could: "کارهای اختیاری امروز",
    schedule: "کلاس‌ها و آزمون‌ها",
    deadlines: "موعدهای نزدیک",
    empty: "برنامه مطالعه‌ات خالی است",
  },
  employee: {
    must: "کارهای اصلی امروز",
    important: "مهم‌های امروز",
    could: "کارهای انعطاف‌پذیر امروز",
    schedule: "جلسات و بلوک‌های کاری",
    deadlines: "موعدهای نزدیک",
    empty: "برنامه کاری امروزت خالی است",
  },
  freelancer: {
    must: "کار مشتری‌های امروز",
    important: "مهم‌های امروز",
    could: "کارهای آزاد امروز",
    schedule: "جلسات و تحویل‌ها",
    deadlines: "موعد تحویل‌ها",
    empty: "امروز کار مشتری‌ای ثبت نشده",
  },
  manager: {
    must: "اولویت‌های تیم",
    important: "مهم‌های امروز",
    could: "کارهای انعطاف‌پذیر",
    schedule: "جلسات و نقاط ریسک",
    deadlines: "موعدهای نزدیک",
    empty: "اولویت امروز تیم ثبت نشده",
  },
  business_owner: {
    must: "تصمیم‌های مهم کسب‌وکار",
    important: "مهم‌های امروز",
    could: "کارهای انعطاف‌پذیر",
    schedule: "جلسات و تعهدها",
    deadlines: "سررسیدهای مالی",
    empty: "کار فوری کسب‌وکار ثبت نشده",
  },
  personal: {
    must: "مسئولیت‌های امروز",
    important: "مهم‌های امروز",
    could: "کارهای انعطاف‌پذیر",
    schedule: "بلوک‌های زمانی امروز",
    deadlines: "موعدهای نزدیک",
    empty: "امروز هنوز برنامه‌ای نداری",
  },
};

const FALLBACK = PERSONA_SECTIONS.personal;

export default function Today() {
  const { tasks, projects, toggleDone, deleteTask, openTask, createTask } =
    useWorkspace();
  const { personaKey } = useUserProfile();
  const [offset, setOffset] = useState(0);
  const [showCompleted, setShowCompleted] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const date = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d;
  }, [offset]);

  const dkey = todayKey();
  const events = useQuery(api.context.eventsOnDay, { day: dkey });
  const sections = PERSONA_SECTIONS[personaKey] ?? FALLBACK;

  const root = useMemo(() => tasks.filter((t) => !t.parentId), [tasks]);
  const dayTasks = useMemo(
    () => root.filter((t) => t.dueDate === dkey),
    [root, dkey],
  );
  const done = useMemo(
    () => dayTasks.filter((t) => t.status === "done"),
    [dayTasks],
  );
  const overdue = useMemo(() => root.filter((t) => isOverdue(t)), [root]);
  const pct = dayTasks.length ? Math.round((done.length / dayTasks.length) * 100) : 0;

  /* Phase 10 — deterministic planning buckets + dismissible suggestions. */
  const plan = usePlanning();
  /* Phase 11 — adaptive scheduling consumes the SAME planning result (§25). */
  const schedule = useSchedule(plan);
  const scheduleActions = useScheduleDialogs(schedule);
  /* Phase 12 — adaptive execution: reality vs the plan, and how to recover. */
  const execution = useExecution(plan, schedule);
  const mustDo = plan.result.buckets.mustDo;
  const shouldDo = plan.result.buckets.shouldDo;
  const couldDo = plan.result.buckets.couldDo;
  const blocked = plan.result.buckets.blocked;
  const planningSuggestions = plan.recommendations.filter(
    (r) => r.type !== "NEXT_ACTION",
  );
  const upcoming = useMemo(
    () =>
      root
        .filter(
          (t) =>
            t.status !== "done" &&
            !!t.dueDate &&
            t.dueDate > dkey &&
            t.dueDate <= addDays(dkey, 7),
        )
        .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
        .slice(0, 5),
    [root, dkey],
  );

  const subtotals = useMemo(() => {
    const m = new Map<string, { total: number; done: number }>();
    for (const t of tasks) {
      if (t.parentId) continue;
      const cur = m.get(t._id) ?? { total: 0, done: 0 };
      cur.total += 1;
      if (t.status === "done") cur.done += 1;
      m.set(t._id, cur);
    }
    return m;
  }, [tasks]);

  const projectOf = (id?: string) => projects.find((p) => p._id === id);
  const dayEvents = events ?? [];
  const isToday = offset === 0;

  const renderRows = (list: typeof dayTasks) =>
    list.map((t) => (
      <TaskRow
        key={t._id}
        task={t}
        project={projectOf(t.projectId)}
        subtaskTotal={subtotals.get(t._id)?.total}
        subtaskDone={subtotals.get(t._id)?.done}
        onToggle={(d) => toggleDone(t, d)}
        onOpen={() => openTask(t._id)}
        onDelete={() => deleteTask(t._id)}
      />
    ));

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">امروز</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatJalaliFull(date)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="روز بعد"
            onClick={() => setOffset((o) => o + 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOffset(0)}
            disabled={isToday}
          >
            برگشت به امروز
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="روز قبل"
            onClick={() => setOffset((o) => o - 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </header>

      {!isToday && (
        <div className="ui-surface flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-muted-foreground">
          <CalendarCheck className="size-4 text-primary" aria-hidden />
          در حال مرور روزی غیر از امروز — قدم بعدی و برنامه زمانی مربوط به
          همین روز نمایش داده می‌شوند.
        </div>
      )}

      {/* Phase 15 (§30) — contextual assistant action for this day's plan. */}
      {isToday && (
        <AIAssistantButton
          feature="today"
          prompt="امروزم را بهینه کن"
          label="بهینه‌سازی امروز با دستیار"
          className="w-full sm:w-auto"
        />
      )}

      {/* Phase 12 §17 — الان: کار در حال انجام، بعدی و شروع با یک کلیک */}
      {isToday && (
        <ExecutionNow execution={execution} plan={plan} schedule={schedule} />
      )}

      {/* LEVEL 2 — Next action, only while actually on today */}
      {isToday && <NextActionCard />}

      <SmartTaskInput
        onCreate={(p) =>
          createTask({
            title: p.title,
            dueDate: p.dueDate ?? dkey,
            dueTime: p.dueTime,
            priority: p.priority,
            tags: p.tags,
          })
        }
      />

      {/* Day progress — real numbers only */}
      <div className="ui-surface space-y-2 rounded-xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarCheck className="size-4 text-primary" aria-hidden />
          <span className="text-sm font-bold">
            {toFa(dayTasks.length)} کار برای این روز
          </span>
          <Pill toneKey="emerald">{toFa(pct)}٪ انجام‌شده</Pill>
          {overdue.length > 0 && (
            <Pill toneKey="rose">{toFa(overdue.length)} عقب‌افتاده</Pill>
          )}
        </div>
        <Bar pct={pct} toneKey="emerald" className="h-2.5" />
      </div>

      {/* Phase 12 §17 — پیشرفت اجرا و کارهای در معرض خطر */}
      {isToday && <ExecutionProgress execution={execution} />}
      {isToday && <ExecutionAtRisk plan={plan} />}

      {/* Schedule — context engine + routines */}
      {(dayEvents.length > 0) && (
        <section className="ui-surface overflow-hidden rounded-2xl">
          <SectionHeader
            title={sections.schedule}
            icon={AlarmClock}
            count={dayEvents.length}
          />
          <ul className="divide-y divide-border/40">
            {dayEvents.slice(0, 6).map((e) => (
              <li
                key={e._id}
                className="flex items-center gap-2 px-4 py-2.5 text-[12px]"
              >
                <span className="shrink-0 rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-bold text-violet-600 dark:text-violet-300">
                  {eventTypeLabel(e.type)}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {e.title}
                </span>
                {e.startTime && (
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {toFa(e.startTime)}
                    {e.endTime ? `–${toFa(e.endTime)}` : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {isToday && <TodayRoutines />}

      {/* Phase 11 — "کی انجام دهم؟": next block, free time, today's timeline */}
      {isToday && (
        <div className="ui-surface flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-4 py-3">
          <ScheduleStrip schedule={schedule} className="min-w-0 flex-1" />
          <Link
            to="/planning"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
          >
            مرکز زمان‌بندی
            <ArrowLeft className="size-3" aria-hidden />
          </Link>
        </div>
      )}

      {isToday && <DayTimeline schedule={schedule} actions={scheduleActions} />}

      {/* Overdue */}
      {overdue.length > 0 && (
        <Link
          to="/tasks?filter=overdue"
          className="flex items-center gap-2 rounded-xl border border-red-200/70 bg-red-50/70 px-4 py-3 text-[12px] font-bold text-red-700 transition-colors hover:bg-red-50 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
        >
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {toFa(overdue.length)} کار عقب‌افتاده — ببین کجا گیر کرده
          <ArrowLeft className="ms-auto size-3.5" aria-hidden />
        </Link>
      )}

      {/* Must do */}
      <section className="ui-surface overflow-hidden rounded-2xl">
        <SectionHeader
          title={sections.must}
          icon={Pin}
          count={mustDo.length}
          tone="rose"
        />
        {mustDo.length === 0 ? (
          <EmptyHint
            title={sections.empty}
            description="کارهای فوری و مهم این روز اینجا جمع می‌شوند."
            actionLabel="افزودن کار"
            onAction={() =>
              window.dispatchEvent(new CustomEvent("quick-add-task"))
            }
          />
        ) : (
          <ul>{renderRows(mustDo)}</ul>
        )}
      </section>

      {/* Should do — important work toward goals/projects */}
      {shouldDo.length > 0 && (
        <section className="ui-surface overflow-hidden rounded-2xl">
          <SectionHeader
            title={sections.important}
            icon={ListChecks}
            count={shouldDo.length}
          />
          <ul>{renderRows(shouldDo)}</ul>
        </section>
      )}

      {/* Could do — useful but flexible */}
      {couldDo.length > 0 && (
        <section className="ui-surface overflow-hidden rounded-2xl">
          <SectionHeader
            title={sections.could}
            icon={ListChecks}
            count={couldDo.length}
          />
          <ul>{renderRows(couldDo)}</ul>
        </section>
      )}

      {/* Blocked — cannot progress right now (always with the reason) */}
      {blocked.length > 0 && (
        <section
          className="ui-surface overflow-hidden rounded-2xl"
          aria-label="کارهای مسدود"
        >
          <SectionHeader title="مسدود" icon={Ban} count={blocked.length} />
          <ul>
            {blocked.map((b) => (
              <li
                key={b.task._id}
                className="border-b border-border/40 px-4 py-2.5 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openTask(b.task._id)}
                    className="min-w-0 flex-1 truncate text-start text-[13px] font-bold hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    {b.task.title}
                  </button>
                  {projectOf(b.task.projectId) && (
                    <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:inline">
                      {projectOf(b.task.projectId)?.name}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  {b.reason}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Upcoming deadlines */}
      {upcoming.length > 0 && (
        <section className="ui-surface overflow-hidden rounded-2xl">
          <SectionHeader
            title={sections.deadlines}
            icon={CalendarCheck}
            count={upcoming.length}
          />
          <ul>
            {upcoming.map((t) => (
              <li
                key={t._id}
                className="flex items-center gap-3 border-b border-border/40 px-4 py-2.5 last:border-0"
              >
                <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">
                  {t.title}
                </span>
                {projectOf(t.projectId) && (
                  <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:inline">
                    {projectOf(t.projectId)?.name}
                  </span>
                )}
                <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                  {toFa(t.dueDate ?? "")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Quests / missions — only when relevant */}
      {isToday && <TodayPathMissions />}

      {/* Phase 10 — planning suggestions (dismissible, deterministic) */}
      {isToday && (
        <PlanningSuggestions
          recommendations={planningSuggestions}
          onDismiss={plan.dismiss}
          limit={4}
          title="پیشنهادهای برنامه‌ریزی"
          description="قطعی و قابل رد زدن — بدون تغییر خودکار در کارهایت"
        />
      )}

      {/* Phase 11 — schedule suggestions (confirm-first, never silent) */}
      {isToday && (
        <ScheduleRecommendations
          schedule={schedule}
          actions={scheduleActions}
          limit={3}
          title="پیشنهادهای زمان‌بندی"
          description="کِی انجام دهی — قطعی، قابل رد زدن، فقط با تأیید تو"
        />
      )}
      {/* Phase 12 §17 — بازیابی برنامه: چیزهایی که واقعیت تغییر داده است */}
      {isToday && (
        <ExecutionRecovery
          execution={execution}
          schedule={schedule}
          actions={scheduleActions}
        />
      )}

      {/* Phase 12 §25 / §26 — مرور روز و بازبینی هفته (اختیاری) */}
      {isToday && <ExecutionDailyReview execution={execution} plan={plan} />}
      {isToday && <ExecutionWeeklyReview execution={execution} />}

      {isToday && scheduleActions.dialogs}

      {/* Completed */}
      <section className="ui-surface overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between px-4 py-2.5">
          <button
            type="button"
            onClick={() => setExpanded((e) => ({ ...e, done: !e.done }))}
            aria-expanded={expanded.done ?? showCompleted}
            className="flex items-center gap-2 text-xs font-bold"
          >
            انجام‌شده‌ها
            <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
              {toFa(done.length)}
            </span>
          </button>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="accent-[var(--primary)]"
            />
            نمایش
          </label>
        </div>
        {showCompleted && (expanded.done ?? true) && done.length > 0 && (
          <ul className="border-t border-border/40">
            {renderRows(done)}
          </ul>
        )}
      </section>
    </div>
  );
}

function SectionHeader({
  title,
  icon: Icon,
  count,
  tone = "primary",
}: {
  title: string;
  icon: React.FC<{ className?: string }>;
  count: number;
  tone?: "primary" | "rose";
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <span className="ui-icon-tile size-6">
          <Icon
            className={cn(
              "size-3.5",
              tone === "rose" ? "text-rose-500" : "text-primary",
            )}
            aria-hidden
          />
        </span>
        {title}
      </h2>
      {count > 0 && <Pill toneKey="slate">{toFa(count)}</Pill>}
    </div>
  );
}

function EmptyHint({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="px-4 py-8 text-center">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
        {description}
      </p>
      <Button size="sm" className="mt-3" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}

function addDays(dayKey: string, n: number): string {
  const d = new Date(`${dayKey}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
