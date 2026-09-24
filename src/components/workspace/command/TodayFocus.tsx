/**
 * Today module — Phase 09 (LEVEL 1).
 *
 * The most important surface: quick capture, today's real progress, the day's
 * schedule (context events: classes / exams / meetings / deadlines) and only the
 * tasks that genuinely matter (must-do + overdue). No feature catalogue.
 */
import { Link } from "react-router";
import { useMemo } from "react";
import { useQuery } from "convex/react";
import {
  AlarmClock,
  ArrowLeft,
  CalendarCheck,
  ListChecks,
  Pin,
  TriangleAlert,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { TaskRow } from "@/components/tasks/TaskRow";
import { SmartTaskInput } from "@/components/tasks/SmartTaskInput";
import { Bar, Pill } from "@/components/progress/progress-ui";
import { Button } from "@/components/ui/button";
import { eventTypeLabel } from "@/lib/context-events";
import { todayKey, isOverdue } from "@/lib/task-utils";
import { toFa } from "@/lib/persian";

const MAX_TASKS = 5;

export function TodayFocus() {
  const { tasks, projects, createTask, toggleDone, openTask, deleteTask } = useWorkspace();
  const dayKey = todayKey();
  const events = useQuery(api.context.eventsOnDay, { day: dayKey });

  const root = tasks.filter((t) => !t.parentId);
  const today = root.filter((t) => t.dueDate === dayKey);
  const done = today.filter((t) => t.status === "done");
  const open = today.filter((t) => t.status !== "done");
  const overdue = root.filter((t) => isOverdue(t));
  const pct = today.length ? Math.round((done.length / today.length) * 100) : 0;

  const mustDo = useMemo(() => {
    const urgentToday = open
      .filter((t) => t.priority === "urgent" || t.priority === "high")
      .sort((a, b) => (a.dueTime ?? "99").localeCompare(b.dueTime ?? "99"));
    const rest = open
      .filter((t) => t.priority !== "urgent" && t.priority !== "high")
      .sort((a, b) => (a.dueTime ?? "99").localeCompare(b.dueTime ?? "99"));
    return [...urgentToday, ...rest].slice(0, MAX_TASKS);
  }, [open]);

  const subtotals = useMemo(() => {
    const m = new Map<string, { total: number; done: number }>();
    for (const t of tasks) {
      if (!t.parentId) continue;
      const cur = m.get(t.parentId) ?? { total: 0, done: 0 };
      cur.total += 1;
      if (t.status === "done") cur.done += 1;
      m.set(t.parentId, cur);
    }
    return m;
  }, [tasks]);

  const projectOf = (id?: string) => projects.find((p) => p._id === id);
  const dayEvents = events ?? [];
  const hasNothing = today.length === 0 && overdue.length === 0;

  return (
    <section className="ui-surface rounded-2xl" aria-label="امروز">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <span className="ui-icon-tile size-6">
            <ListChecks className="size-3.5 text-primary" aria-hidden />
          </span>
          امروز
        </h2>
        <div className="flex items-center gap-2">
          <Pill toneKey="slate">{toFa(today.length)} کار</Pill>
          {today.length > 0 && <Pill toneKey="emerald">{toFa(pct)}٪</Pill>}
          <Link to="/today" className="hidden sm:block">
            <Button variant="ghost" size="sm">
              صفحه امروز
              <ArrowLeft className="size-3.5" />
            </Button>
          </Link>
        </div>
      </header>

      <div className="space-y-4 p-4">
        {/* Real day progress */}
        {today.length > 0 && (
          <div className="flex items-center gap-3">
            <Bar pct={pct} toneKey="emerald" className="h-2.5 flex-1" />
            <span className="shrink-0 text-[11px] font-bold text-muted-foreground">
              {toFa(done.length)} از {toFa(today.length)} انجام شده
            </span>
          </div>
        )}

        {/* Quick capture */}
        <SmartTaskInput
          onCreate={(p) =>
            createTask({
              title: p.title,
              dueDate: p.dueDate ?? dayKey,
              dueTime: p.dueTime,
              priority: p.priority,
              tags: p.tags,
            })
          }
        />

        {/* Today's schedule from the context engine */}
        {dayEvents.length > 0 && (
          <ul className="space-y-1.5" aria-label="برنامه زمانی امروز">
            {dayEvents.slice(0, 3).map((e) => (
              <li
                key={e._id}
                className="flex items-center gap-2 rounded-xl border border-border/60 bg-white/50 px-3 py-2 text-[12px] dark:bg-white/5"
              >
                <AlarmClock className="size-3.5 shrink-0 text-violet-500" aria-hidden />
                <span className="shrink-0 rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-bold text-violet-600 dark:text-violet-300">
                  {eventTypeLabel(e.type)}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">{e.title}</span>
                {e.startTime && (
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {toFa(e.startTime)}
                    {e.endTime ? `–${toFa(e.endTime)}` : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Overdue alert */}
        {overdue.length > 0 && (
          <Link
            to="/tasks?filter=overdue"
            className="flex items-center gap-2 rounded-xl border border-red-200/70 bg-red-50/70 px-3 py-2 text-[12px] font-bold text-red-700 transition-colors hover:bg-red-50 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
          >
            <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
            {toFa(overdue.length)} کار عقب‌افتاده
            <ArrowLeft className="ms-auto size-3.5" aria-hidden />
          </Link>
        )}

        {/* Must-do list */}
        {mustDo.length > 0 ? (
          <ul>
            {mustDo.map((t) => (
              <li key={t._id}>
                <TaskRow
                  task={t}
                  project={projectOf(t.projectId)}
                  subtaskTotal={subtotals.get(t._id)?.total}
                  subtaskDone={subtotals.get(t._id)?.done}
                  onToggle={(d) => toggleDone(t, d)}
                  onOpen={() => openTask(t._id)}
                  onDelete={() => deleteTask(t._id)}
                />
              </li>
            ))}
            {open.length > MAX_TASKS && (
              <li className="px-3 py-2 text-[11px] font-semibold text-muted-foreground">
                و {toFa(open.length - MAX_TASKS)} کار دیگر —{" "}
                <Link to="/today" className="text-primary hover:underline">
                  همه را ببین
                </Link>
              </li>
            )}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-border/70 p-5 text-center">
            <CalendarCheck className="mx-auto mb-2 size-5 text-muted-foreground" aria-hidden />
            <p className="text-[13px] font-bold">
              {hasNothing ? "برای امروز هنوز برنامه‌ای نچیدی" : "کارهای امروز تمام شده"}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-[11px] leading-5 text-muted-foreground">
              {hasNothing
                ? "یک کار بنویس تا قدم بعدی را برایت انتخاب کنیم، یا از کارهای فردا شروع کن."
                : "کار دیگری برای امروز نمانده — اگر زودتر تمام کردی، سراغ فردا یا کارهای عقب‌افتاده برو."}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {hasNothing && (
                <Button
                  size="sm"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("quick-add-task"))
                  }
                >
                  <Pin className="size-3.5" />
                  افزودن اولین کار امروز
                </Button>
              )}
              <Button asChild size="sm" variant="outline">
                <Link to="/planning">
                  برنامه‌ریزی
                  <ArrowLeft className="size-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
