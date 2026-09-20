import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { TaskRow } from "@/components/tasks/TaskRow";
import { SmartTaskInput } from "@/components/tasks/SmartTaskInput";
import { TodayPathMissions } from "@/components/progress/TodayPathMissions";
import { Button } from "@/components/ui/button";
import { formatJalaliFull, toFa } from "@/lib/persian";
import { todayKey } from "@/lib/task-utils";
import { CalendarCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

export default function Today() {
  const { tasks, projects, toggleDone, deleteTask, openTask, createTask } =
    useWorkspace();

  const [offset, setOffset] = useState(0);
  const [showCompleted, setShowCompleted] = useState(true);

  const date = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d;
  }, [offset]);

  const dkey = todayKey();

  const root = tasks.filter((t) => !t.parentId);
  const dayTasks = root.filter((t) => t.dueDate === dkey);
  const open = dayTasks.filter((t) => t.status !== "done");
  const done = dayTasks.filter((t) => t.status === "done");
  const list = showCompleted ? dayTasks : open;
  const pct = dayTasks.length ? Math.round((done.length / dayTasks.length) * 100) : 0;

  const projectOf = (id?: string) => projects.find((p) => p._id === id);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">امروز</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatJalaliFull(date)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" aria-label="روز بعد" onClick={() => setOffset((o) => o + 1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOffset(0)}
            disabled={offset === 0}
          >
            برگشت به امروز
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="روز قبل" onClick={() => setOffset((o) => o - 1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </header>

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

      {/* Growth-path missions for right now */}
      <TodayPathMissions />

      {/* Day summary strip */}
      <div className="ui-surface flex items-center gap-4 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <CalendarCheck className="size-4 text-primary" />
          <span className="text-sm font-bold">{toFa(dayTasks.length)} کار</span>
        </div>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs font-bold tabular-nums text-emerald-600">
          {toFa(pct)}٪
        </span>
      </div>

      <section className="ui-surface overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-semibold text-muted-foreground">
              باز: {toFa(open.length)}
            </span>
            <span className="font-semibold text-emerald-600">
              انجام‌شده: {toFa(done.length)}
            </span>
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="accent-[var(--primary)]"
            />
            نمایش انجام‌شده‌ها
          </label>
        </div>

        {list.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm font-semibold">
              {showCompleted ? "کاری برای امروز نداری." : "همه کارهای امروز انجام شد!"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {showCompleted
                ? "روزت خالی است. می‌توانی برنامه‌ریزی کنی یا کار جدیدی بسازی."
                : "آفرین! می‌توانی استراحت کنی یا سراغ کارهای فردا بروی."}
            </p>
            <Button size="sm" className="mt-4" onClick={() => window.dispatchEvent(new CustomEvent("quick-add-task"))}>
              + ساخت کار
            </Button>
          </div>
        ) : (
          <ul>
            {list.map((t) => (
              <TaskRow
                key={t._id}
                task={t}
                project={projectOf(t.projectId)}
                onToggle={(d) => toggleDone(t, d)}
                onOpen={() => openTask(t._id)}
                onDelete={() => deleteTask(t._id)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
