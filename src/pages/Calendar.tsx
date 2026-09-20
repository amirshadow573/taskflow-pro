import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { Button } from "@/components/ui/button";
import {
  JALALI_MONTHS,
  WEEKDAYS_SHORT,
  toFa,
  toJalaliDate,
  dateKey,
  persianWeekday,
  jalaliMonthGrid,
  formatJalaliFull,
} from "@/lib/persian";
import { todayKey, isOverdue } from "@/lib/task-utils";
import { PRIORITIES, type PriorityKey } from "@/components/ui/badge";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

export default function CalendarPage() {
  const { tasks, projects, updateTask, openTask, toggleDone } = useWorkspace();

  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string>(todayKey());
  const [dragTask, setDragTask] = useState<string | null>(null);

  const j = toJalaliDate(cursor);
  const monthGrid = useMemo(() => jalaliMonthGrid(cursor), [cursor]);

  const root = tasks.filter((t) => !t.parentId);
  const byDay = useMemo(() => {
    const m = new Map<string, typeof root>();
    for (const t of root) {
      if (!t.dueDate) continue;
      const arr = m.get(t.dueDate) ?? [];
      arr.push(t);
      m.set(t.dueDate, arr);
    }
    return m;
  }, [root]);

  const today = todayKey();
  const selectedTasks = byDay.get(selectedDay) ?? [];
  const projectOf = (id?: string) => projects.find((p) => p._id === id);

  const moveMonth = (dir: number) => {
    const d = new Date(cursor);
    d.setMonth(d.getMonth() + dir);
    setCursor(d);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <CalendarDays className="size-6 text-primary" />
            تقویم
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            کارها را بکش و روی روز دلخواه رها کن تا جابه‌جا شوند.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" aria-label="ماه قبل" onClick={() => moveMonth(-1)}>
            <ChevronRight className="size-4" />
          </Button>
          <span className="min-w-36 text-center text-sm font-bold">
            {JALALI_MONTHS[j.jm - 1]} {toFa(j.jy)}
          </span>
          <Button variant="outline" size="icon-sm" aria-label="ماه بعد" onClick={() => moveMonth(1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCursor(new Date());
              setSelectedDay(today);
            }}
          >
            امروز
          </Button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Month grid */}
        <section className="ui-surface overflow-hidden rounded-2xl">
          <div className="grid grid-cols-7 border-b border-border text-center">
            {WEEKDAYS_SHORT.map((w) => (
              <div key={w} className="py-2 text-xs font-bold text-muted-foreground">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthGrid.map((cell, i) => {
              if (cell.type === "empty") {
                return <div key={i} className="min-h-24 border-b border-e border-border/50" />;
              }
              const key = cell.key;
              const dayTasks = byDay.get(key) ?? [];
              const isToday = key === today;
              const isSelected = key === selectedDay;
              const open = dayTasks.filter((t) => t.status !== "done");
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDay(key)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragTask) {
                      void updateTask(dragTask as Id<"tasks">, { dueDate: key });
                      // toast handled by workspace
                    }
                    setDragTask(null);
                  }}
                  className={cn(
                    "relative min-h-24 border-b border-e border-border/50 p-1.5 text-start transition-colors hover:bg-muted/60",
                    isSelected && "bg-accent",
                  )}
                >
                  <span
                    className={cn(
                      "inline-grid size-6 place-items-center rounded-full text-[11px] font-bold tabular-nums",
                      isToday && "bg-primary text-white",
                    )}
                  >
                    {toFa(toJalaliDate(cell.date).jd)}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {open.slice(0, 2).map((t) => {
                      const pr = PRIORITIES[(t.priority as PriorityKey) in PRIORITIES ? (t.priority as PriorityKey) : "medium"];
                      return (
                        <div
                          key={t._id}
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            setDragTask(t._id);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openTask(t._id);
                          }}
                          className="cursor-grab truncate rounded px-1 py-0.5 text-[10px] font-medium active:cursor-grabbing"
                          style={{ background: `${pr.color}18`, color: pr.color }}
                        >
                          {t.title}
                        </div>
                      );
                    })}
                    {open.length > 2 && (
                      <span className="block px-1 text-[9px] text-muted-foreground">
                        +{toFa(open.length - 2)} مورد دیگر
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Day detail */}
        <aside className="ui-surface rounded-2xl p-4">
          <h2 className="text-sm font-bold">
            {formatJalaliFull(new Date(selectedDay + "T00:00:00"))}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {selectedTasks.length === 0
              ? "کاری برای این روز ثبت نشده."
              : `${toFa(selectedTasks.length)} کار`}
          </p>
          <ul className="mt-3 space-y-2">
            {selectedTasks.length === 0 && (
              <li className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                این روز خانی است. کارها را از تقویم بکش این‌جا یا کار جدید بساز.
              </li>
            )}
            {selectedTasks.map((t) => {
              const pr = PRIORITIES[(t.priority as PriorityKey) in PRIORITIES ? (t.priority as PriorityKey) : "medium"];
              const p = projectOf(t.projectId);
              const done = t.status === "done";
              return (
                <li
                  key={t._id}
                  draggable
                  onDragStart={() => setDragTask(t._id)}
                  className={cn(
                    "cursor-grab rounded-xl border border-border bg-background/60 p-2.5 active:cursor-grabbing",
                    done && "opacity-60",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span
                      role="checkbox"
                      aria-checked={done}
                      tabIndex={0}
                      aria-label={`تکمیل ${t.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleDone(t, !done);
                      }}
                      className="mt-0.5 grid size-4.5 shrink-0 cursor-pointer place-items-center rounded-full border-2"
                      style={{
                        borderColor: done ? pr.color : "var(--border)",
                        background: done ? pr.color : "transparent",
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-xs font-semibold",
                          done && "text-muted-foreground line-through",
                        )}
                      >
                        {t.title}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span style={{ color: pr.color }}>{pr.label}</span>
                        {t.dueTime && <span>{toFa(t.dueTime)}</span>}
                        {p && (
                          <span className="flex items-center gap-1">
                            <span className="size-1.5 rounded-sm" style={{ background: p.color }} />
                            {p.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
            راهنما: کار را بکش و روی روزی دیگر در تقویم رها کن.
          </p>
        </aside>
      </div>
    </div>
  );
}
