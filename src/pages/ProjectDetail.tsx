import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { TaskRow } from "@/components/tasks/TaskRow";
import { Button } from "@/components/ui/button";
import { PRIORITIES, type PriorityKey } from "@/components/ui/badge";
import { toFa, formatJalaliShort, formatJalaliFull } from "@/lib/persian";
import { isOverdue, todayKey } from "@/lib/task-utils";
import {
  ArrowRight,
  CalendarDays,
  LayoutGrid,
  List,
  ListTree,
  Plus,
  Settings2,
  Activity as ActivityIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { cn } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";

const KANBAN_COLS: Array<{ key: string; label: string; color: string }> = [
  { key: "todo", label: "انجام نشده", color: "#64748b" },
  { key: "in_progress", label: "در حال انجام", color: "#3b82f6" },
  { key: "review", label: "در حال بررسی", color: "#8b5cf6" },
  { key: "done", label: "انجام شده", color: "#10b981" },
];

type Tab = "overview" | "tasks" | "board" | "calendar" | "activity";

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tasks, projects, updateTask, toggleDone, openTask, createTask, deleteTask, updateProject } =
    useWorkspace();

  const [tab, setTab] = useState<Tab>("overview");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [addingIn, setAddingIn] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const project = projects.find((p) => p._id === id);
  const pts = useMemo(
    () => tasks.filter((t) => t.projectId === id && !t.parentId),
    [tasks, id],
  );
  const projectTasks = useMemo(
    () => tasks.filter((t) => t.projectId === id),
    [tasks, id],
  );
  const subtotals = new Map<string, { total: number; done: number }>();
  for (const t of projectTasks) {
    if (!t.parentId) continue;
    const cur = subtotals.get(t.parentId) ?? { total: 0, done: 0 };
    cur.total += 1;
    if (t.status === "done") cur.done += 1;
    subtotals.set(t.parentId, cur);
  }
  const done = pts.filter((t) => t.status === "done").length;
  const pct = pts.length ? Math.round((done / pts.length) * 100) : 0;
  const overdue = pts.filter((t) => isOverdue(t));

  if (!project) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center">
        <p className="text-sm font-bold">پروژه پیدا نشد.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/projects")}>
          برگشت به پروژه‌ها
        </Button>
      </div>
    );
  }

  const TABS: Array<{ key: Tab; label: string; icon: typeof List }> = [
    { key: "overview", label: "نمای کلی", icon: LayoutGrid },
    { key: "tasks", label: "کارها", icon: List },
    { key: "board", label: "برد", icon: ListTree },
    { key: "calendar", label: "تقویم", icon: CalendarDays },
    { key: "activity", label: "فعالیت", icon: ActivityIcon },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
      {/* Header */}
      <header className="space-y-4">
        <Link to="/projects" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowRight className="size-3.5" />
          همه پروژه‌ها
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-1 grid size-11 place-items-center rounded-xl text-white" style={{ background: project.color }}>
              <ListTree className="size-5" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">{project.name}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {project.description || "بدون توضیح"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setTab("overview")}>
              <Settings2 className="size-4" />
            </Button>
            <Button size="sm" onClick={() => window.dispatchEvent(new CustomEvent("quick-add-task"))}>
              <Plus className="size-4" />
              کار جدید
            </Button>
          </div>
        </div>

        {/* Progress strip */}
        <div className="ui-surface flex flex-wrap items-center gap-4 rounded-xl px-4 py-3">
          <div className="h-2 min-w-40 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: project.color }} />
          </div>
          <span className="text-sm font-extrabold tabular-nums" style={{ color: project.color }}>
            {toFa(pct)}٪
          </span>
          <span className="text-xs text-muted-foreground">
            {toFa(done)} از {toFa(pts.length)} کار
          </span>
          {project.deadline && (
            <span className="text-xs text-muted-foreground">
              ددلاین: {formatJalaliFull(new Date(project.deadline + "T00:00:00"))}
            </span>
          )}
          {overdue.length > 0 && (
            <span className="rounded-md bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {toFa(overdue.length)} عقب‌افتاده
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-border" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors",
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Overview */}
      {tab === "overview" && (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: "کل کارها", value: pts.length },
            { label: "انجام شده", value: done },
            { label: "عقب‌افتاده", value: overdue.length, danger: true },
          ].map((s) => (
            <div key={s.label} className="ui-surface rounded-2xl p-5">
              <div className={cn("text-3xl font-extrabold tabular-nums", s.danger && "text-destructive")}>
                {toFa(s.value)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
          <div className="ui-surface rounded-2xl p-5 md:col-span-3">
            <h3 className="mb-3 text-sm font-bold">کارهای عقب‌افتاده و نزدیک</h3>
            {overdue.length === 0 && pts.filter((t) => t.dueDate === todayKey() && t.status !== "done").length === 0 ? (
              <p className="text-xs text-muted-foreground">همه‌چیز مرتب است.</p>
            ) : (
              <ul>
                {[...overdue, ...pts.filter((t) => t.dueDate === todayKey() && t.status !== "done")]
                  .slice(0, 5)
                  .map((t) => (
                    <TaskRow
                      key={t._id}
                      task={t}
                      subtaskTotal={subtotals.get(t._id)?.total}
                      subtaskDone={subtotals.get(t._id)?.done}
                      onToggle={(d) => toggleDone(t, d)}
                      onOpen={() => openTask(t._id)}
                      compact
                    />
                  ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Tasks list */}
      {tab === "tasks" && (
        <section className="ui-surface overflow-hidden rounded-2xl">
          {pts.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              هنوز کاری در این پروژه نیست.
            </p>
          ) : (
            <ul>
              {pts
                .slice()
                .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
                .map((t) => (
                  <TaskRow
                    key={t._id}
                    task={t}
                    subtaskTotal={subtotals.get(t._id)?.total}
                    subtaskDone={subtotals.get(t._id)?.done}
                    onToggle={(d) => toggleDone(t, d)}
                    onOpen={() => openTask(t._id)}
                    onDelete={() => deleteTask(t._id)}
                  />
                ))}
            </ul>
          )}
        </section>
      )}

      {/* Kanban board */}
      {tab === "board" && (
        <div className="grid gap-3 overflow-x-auto pb-2 md:grid-cols-4">
          {KANBAN_COLS.map((col) => {
            const colTasks = pts.filter((t) =>
              col.key === "todo"
                ? t.status === "todo" || t.status === "inbox"
                : t.status === col.key,
            );
            return (
              <div
                key={col.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverCol(col.key);
                }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={() => {
                  if (dragId) void updateTask(dragId as Id<"tasks">, { status: col.key === "todo" ? "todo" : col.key });
                  setDragId(null);
                  setDragOverCol(null);
                }}
                className={cn(
                  "min-w-64 rounded-2xl border bg-muted/40 p-2 transition-colors",
                  dragOverCol === col.key
                    ? "border-primary/50 bg-accent/60"
                    : "border-border",
                )}
              >
                <div className="mb-2 flex items-center gap-2 px-2 py-1">
                  <span className="size-2 rounded-full" style={{ background: col.color }} />
                  <h3 className="text-xs font-bold">{col.label}</h3>
                  <span className="text-[10px] text-muted-foreground">{toFa(colTasks.length)}</span>
                </div>
                <div className="space-y-2">
                  {colTasks.map((t) => (
                    <article
                      key={t._id}
                      draggable
                      onDragStart={() => setDragId(t._id)}
                      onClick={() => openTask(t._id)}
                      className="ui-surface ui-surface-hover cursor-grab rounded-xl p-3 active:cursor-grabbing"
                    >
                      <p className={cn("text-xs font-semibold leading-5", t.status === "done" && "text-muted-foreground line-through")}>
                        {t.title}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                        {t.dueDate && (
                          <span className={cn(isOverdue(t) && "font-bold text-destructive")}>
                            {t.dueDate === todayKey() ? "امروز" : formatJalaliShort(new Date(t.dueDate + "T00:00:00"))}
                          </span>
                        )}
                        {subtotals.get(t._id) && subtotals.get(t._id)!.total > 0 && (
                          <span>
                            زیرکار {toFa(subtotals.get(t._id)!.done)}/{toFa(subtotals.get(t._id)!.total)}
                          </span>
                        )}
                        <span
                          className="ms-auto inline-flex items-center gap-1 rounded px-1 py-0.5 font-bold"
                          style={{
                            color: PRIORITIES[(t.priority as PriorityKey) in PRIORITIES ? (t.priority as PriorityKey) : "medium"].color,
                            background: PRIORITIES[(t.priority as PriorityKey) in PRIORITIES ? (t.priority as PriorityKey) : "medium"].color + "14",
                          }}
                        >
                          {PRIORITIES[(t.priority as PriorityKey) in PRIORITIES ? (t.priority as PriorityKey) : "medium"].label}
                        </span>
                      </div>
                    </article>
                  ))}
                  {addingIn === col.key ? (
                    <input
                      autoFocus
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onBlur={() => {
                        if (newTitle.trim())
                          void createTask({ title: newTitle, status: col.key === "todo" ? "todo" : col.key, projectId: id as Id<"projects"> });
                        setNewTitle("");
                        setAddingIn(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") {
                          setNewTitle("");
                          setAddingIn(null);
                        }
                      }}
                      placeholder="عنوان کار…"
                      className="w-full rounded-xl border border-primary/40 bg-card px-3 py-2 text-xs outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => setAddingIn(col.key)}
                      className="flex w-full items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      <Plus className="size-3.5" />
                      افزودن کار
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Calendar mini view */}
      {tab === "calendar" && (
        <section className="ui-surface rounded-2xl p-5">
          <p className="text-sm font-bold">تقویم پروژه</p>
          <p className="mt-1 text-xs text-muted-foreground">
            نمای کامل تقویم در صفحه «تقویم» در دسترس است؛ اینجا فقط کارهای دارای تاریخ این پروژه:
          </p>
          <ul className="mt-3">
            {pts.filter((t) => t.dueDate).length === 0 && (
              <li className="text-xs text-muted-foreground">کاری با تاریخ مشخص وجود ندارد.</li>
            )}
            {pts
              .filter((t) => t.dueDate)
              .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
              .map((t) => (
                <li key={t._id} className="border-b border-border/60 py-2 last:border-0">
                  <TaskRow
                    task={t}
                    onToggle={(d) => toggleDone(t, d)}
                    onOpen={() => openTask(t._id)}
                    compact
                  />
                </li>
              ))}
          </ul>
        </section>
      )}

      {/* Activity */}
      {tab === "activity" && (
        <section className="ui-surface rounded-2xl p-5">
          <h3 className="mb-3 text-sm font-bold">فعالیت‌های اخیر</h3>
          <ul className="space-y-2 text-xs text-muted-foreground">
            {projectTasks
              .slice()
              .sort((a, b) => b.createdAt - a.createdAt)
              .slice(0, 10)
              .map((t) => (
                <li key={t._id} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full" style={{ background: project.color }} />
                  <span className="text-foreground">{t.title}</span>
                  <span>— ساخته شده در {formatJalaliFull(new Date(t.createdAt))}</span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
