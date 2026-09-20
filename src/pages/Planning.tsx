import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { TaskRow } from "@/components/tasks/TaskRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { emitProgressionEvent } from "@/components/progress/ProgressProvider";
import { useAuth } from "@/hooks/use-auth";
import {
  toFa,
  formatJalaliFull,
  dateKey,
  toJalaliDate,
  JALALI_MONTHS,
} from "@/lib/persian";
import { todayKey, addDaysKey, dateKeyOf } from "@/lib/task-utils";
import {
  CalendarClock,
  CheckCircle2,
  Circle,
  Plus,
  Repeat,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";

const ROUTINE_COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function PlanningPage() {
  const { user } = useAuth();
  const { tasks, projects, toggleDone, openTask, deleteTask } = useWorkspace();

  const routines = useQuery(api.routines.listRoutines, {});
  const items = useQuery(api.routines.listAllItems, {});
  const tKey = todayKey();
  const checkins = useQuery(api.routines.listCheckinsForDay, { day: tKey });

  const createRoutine = useMutation(api.routines.createRoutine);
  const deleteRoutine = useMutation(api.routines.deleteRoutine);
  const createItem = useMutation(api.routines.createItem);
  const toggleCheckin = useMutation(api.routines.toggleCheckin);

  const [newRoutine, setNewRoutine] = useState("");
  const [newItems, setNewItems] = useState<Record<string, string>>({});

  const doneSet = new Set(
    (checkins ?? []).filter((c) => c.done).map((c) => c.itemId),
  );

  const handleAddRoutine = async () => {
    const t = newRoutine.trim();
    if (!t) return;
    await createRoutine({
      title: t,
      colorKey: ROUTINE_COLORS[(routines?.length ?? 0) % ROUTINE_COLORS.length],
    });
    setNewRoutine("");
  };

  const handleAddItem = async (rid: Id<"routines">) => {
    const t = (newItems[rid] ?? "").trim();
    if (!t) return;
    await createItem({ routineId: rid, title: t });
    setNewItems((s) => ({ ...s, [rid]: "" }));
  };

  const routineTotal = items?.length ?? 0;
  const routineDone = (checkins ?? []).filter((c) => c.done).length;
  const routinePct = routineTotal ? Math.round((routineDone / routineTotal) * 100) : 0;

  // Upcoming tasks (next 14 days) grouped by day
  const root = tasks.filter((t) => !t.parentId && t.status !== "done");
  const upcoming = useMemo(() => {
    const groups: Array<{ key: string; label: string; items: typeof root }> = [];
    for (let i = 0; i <= 14; i++) {
      const key = addDaysKey(i);
      const items2 = root.filter((t) => t.dueDate === key);
      if (items2.length === 0) continue;
      const d = new Date(key + "T00:00:00");
      groups.push({
        key,
        label:
          i === 0
            ? `امروز — ${formatJalaliFull(d)}`
            : i === 1
              ? "فردا"
              : formatJalaliFull(d),
        items: items2,
      });
    }
    return groups;
  }, [root]);

  const projectOf = (id?: string) => projects.find((p) => p._id === id);
  const jj = toJalaliDate(new Date());

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <Repeat className="size-6 text-primary" />
          برنامه‌ریزی
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          روتین‌های ثابت روزانه و نقشه کارهای دو هفته آینده.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Routines */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">روتین‌های ثابت روزانه</h2>
            <span className="text-[11px] text-muted-foreground">
              امروز: {toFa(routineDone)} از {toFa(routineTotal)} · {toFa(routinePct)}٪
            </span>
          </div>

          {(routines ?? []).map((r) => {
            const rItems = (items ?? []).filter((it) => it.routineId === r._id);
            const doneN = rItems.filter((it) => doneSet.has(it._id)).length;
            const pct = rItems.length ? Math.round((doneN / rItems.length) * 100) : 0;
            return (
              <div key={r._id} className="ui-surface overflow-hidden rounded-2xl">
                <div className="flex items-center justify-between border-b border-border/70 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-sm"
                      style={{
                        background: ROUTINE_COLORS[(r.colorKey.length + r.title.length) % ROUTINE_COLORS.length],
                      }}
                    />
                    <h3 className="text-sm font-bold">{r.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold tabular-nums text-muted-foreground">
                      {toFa(doneN)}/{toFa(rItems.length)}
                    </span>
                    <button
                      onClick={() => {
                        if (confirm(`حذف روتین «${r.title}»؟`)) void deleteRoutine({ id: r._id });
                      }}
                      aria-label={`حذف ${r.title}`}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
                <ul className="px-2 py-1.5">
                  {rItems.length === 0 && (
                    <li className="px-2 py-3 text-xs text-muted-foreground">
                      هنوز کاری اضافه نشده.
                    </li>
                  )}
                  {rItems.map((it) => {
                    const done = doneSet.has(it._id);
                    return (
                      <li key={it._id} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/60">
                        <button
                          role="checkbox"
                          aria-checked={done}
                          aria-label={`تکمیل ${it.title}`}
                          onClick={async () => {
                            const result = await toggleCheckin({
                              itemId: it._id,
                              day: tKey,
                              done: !done,
                            });
                            if (result && (result.levelUp || result.unlocked.length > 0)) {
                              emitProgressionEvent({
                                levelUp: result.levelUp,
                                unlocked: result.unlocked,
                                xp: result.xp,
                              });
                            }
                          }}
                          className={cn(
                            "grid size-5 shrink-0 place-items-center rounded-full border-2",
                            done && "task-pop",
                          )}
                          style={{
                            borderColor: done ? "var(--primary)" : "var(--border)",
                            background: done ? "var(--primary)" : "transparent",
                          }}
                        >
                          {done && <CheckCircle2 className="size-3 text-white" />}
                        </button>
                        <span
                          className={cn(
                            "flex-1 text-sm",
                            done && "text-muted-foreground line-through",
                          )}
                        >
                          {it.title}
                        </span>
                      </li>
                    );
                  })}
                  <li className="flex items-center gap-2 px-2 py-1">
                    <Plus className="size-3.5 text-muted-foreground" />
                    <input
                      value={newItems[r._id] ?? ""}
                      onChange={(e) => setNewItems((s) => ({ ...s, [r._id]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && handleAddItem(r._id)}
                      placeholder="کار ثابت جدید…"
                      className="flex-1 bg-transparent py-1 text-xs outline-none placeholder:text-muted-foreground/60"
                    />
                  </li>
                </ul>
              </div>
            );
          })}

          <div className="flex gap-2">
            <Input
              value={newRoutine}
              onChange={(e) => setNewRoutine(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddRoutine()}
              placeholder="روتین جدید؛ مثلاً روتین صبح"
              className="bg-card"
            />
            <Button onClick={handleAddRoutine} disabled={!newRoutine.trim()}>
              <Plus className="size-4" />
              افزودن
            </Button>
          </div>
        </section>

        {/* Upcoming */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold">دو هفته آینده</h2>
          {upcoming.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <CalendarClock className="mx-auto mb-2 size-6 text-muted-foreground" />
              <p className="text-sm font-semibold">در ۱۴ روز آینده کاری ثبت نشده.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                برای برنامه‌ریزی بهتر، کارهایت را تاریخ‌دار کن.
              </p>
            </div>
          )}
          {upcoming.map((g) => (
            <div key={g.key} className="ui-surface overflow-hidden rounded-2xl">
              <div className="border-b border-border/70 px-4 py-2 text-xs font-bold text-muted-foreground">
                {g.label}
                <span className="ms-2 text-[10px]">
                  {toFa(g.items.length)} کار
                </span>
              </div>
              <ul>
                {g.items.map((t) => (
                  <TaskRow
                    key={t._id}
                    task={t}
                    project={projectOf(t.projectId)}
                    onToggle={(d) => toggleDone(t, d)}
                    onOpen={() => openTask(t._id)}
                    onDelete={() => deleteTask(t._id)}
                    compact
                  />
                ))}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

export default PlanningPage;
