import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { TaskRow } from "@/components/tasks/TaskRow";
import { SmartTaskInput } from "@/components/tasks/SmartTaskInput";
import { Button } from "@/components/ui/button";
import { toFa, toJalaliDate, formatJalaliFull, JALALI_MONTHS } from "@/lib/persian";
import { todayKey, isOverdue } from "@/lib/task-utils";
import { Link } from "react-router";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Inbox,
  ListTodo,
  Loader,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

export default function Dashboard() {
  const { tasks, projects, toggleDone, deleteTask, openTask, createTask } =
    useWorkspace();
  const { user } = useAuth();

  const tKey = todayKey();
  const root = tasks.filter((t) => !t.parentId);
  const todayTasks = root
    .filter((t) => t.dueDate === tKey && t.status !== "done")
    .sort((a, b) => (a.dueTime ?? "").localeCompare(b.dueTime ?? ""));
  const overdue = root.filter((t) => isOverdue(t));
  const inbox = root.filter((t) => t.status === "inbox");

  // counts for overview
  const allToday = root.filter((t) => t.dueDate === tKey);
  const completed = allToday.filter((t) => t.status === "done").length;
  const inProgress = allToday.filter((t) => t.status === "in_progress").length;
  const remaining = allToday.length - completed - inProgress;
  const pct = allToday.length
    ? Math.round((completed / allToday.length) * 100)
    : 0;

  // subtask rollups
  const subtotals = new Map<string, { total: number; done: number }>();
  for (const t of tasks) {
    if (!t.parentId) continue;
    const cur = subtotals.get(t.parentId) ?? { total: 0, done: 0 };
    cur.total += 1;
    if (t.status === "done") cur.done += 1;
    subtotals.set(t.parentId, cur);
  }

  const projectOf = (id?: string) => projects.find((p) => p._id === id);

  const hour = new Date().getHours();
  const greeting =
    hour < 5 ? "شب بخیر" : hour < 12 ? "صبح بخیر" : hour < 17 ? "وقت بخیر" : "شب بخیر";

  const nextUp = root
    .filter(
      (t) =>
        t.status !== "done" &&
        t.status !== "inbox" &&
        (!t.dueDate || t.dueDate > tKey),
    )
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
    .slice(0, 4);

  const j = toJalaliDate(new Date());

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      {/* Greeting */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {greeting}{user?.name ? `، ${user.name}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            امروز چه کاری می‌خواهی انجام بدهی؟ — {formatJalaliFull(new Date())}
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          {JALALI_MONTHS[j.jm - 1]} {toFa(j.jy)}
        </div>
      </header>

      {/* Compact today overview */}
      <section className="ui-surface ui-accent-top rounded-2xl p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-5">
          {/* Ring */}
          <div className="relative grid size-20 place-items-center">
            <svg viewBox="0 0 80 80" className="size-20 -rotate-90 drop-shadow-[0_0_8px_rgba(59,130,246,0.35)]">
              <defs>
                <linearGradient id="pctGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--muted)" strokeWidth="8" />
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                stroke="url(#pctGrad)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 34}
                strokeDashoffset={2 * Math.PI * 34 * (1 - pct / 100)}
                style={{ transition: "stroke-dashoffset .6s cubic-bezier(.22,1,.36,1)" }}
              />
            </svg>
            <span className="absolute text-sm font-extrabold tabular-nums">{toFa(pct)}٪</span>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              { label: "کار امروز", value: allToday.length, color: "text-foreground", icon: ListTodo },
              { label: "انجام شده", value: completed, color: "text-emerald-600", icon: CheckCircle2 },
              { label: "در حال انجام", value: inProgress, color: "text-blue-600", icon: Loader },
              { label: "باقی‌مانده", value: Math.max(0, remaining), color: "text-amber-600", icon: Clock },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-border/60 bg-white/60 p-2.5 transition-colors hover:border-primary/30 hover:bg-white/80 dark:bg-white/5"
              >
                <div className="flex items-center gap-2">
                  <span className="ui-icon-tile size-7 shrink-0">
                    <s.icon className={`size-3.5 ${s.color}`} />
                  </span>
                  <span className={`text-xl font-extrabold tabular-nums ${s.color}`}>
                    {toFa(s.value)}
                  </span>
                </div>
                <div className="mt-1.5 text-[11px] font-medium text-muted-foreground">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            {(overdue.length > 0 || inbox.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {overdue.length > 0 && (
                  <Link to="/tasks?filter=overdue">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700 transition-colors hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                      <TriangleAlert className="size-3.5" />
                      {toFa(overdue.length)} کار عقب‌افتاده
                    </span>
                  </Link>
                )}
                {inbox.length > 0 && (
                  <Link to="/inbox">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                      <Inbox className="size-3.5" />
                      {toFa(inbox.length)} در صندوق ورودی
                    </span>
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Quick add */}
      <SmartTaskInput
        onCreate={(p) =>
          createTask({
            title: p.title,
            dueDate: p.dueDate,
            dueTime: p.dueTime,
            priority: p.priority,
            tags: p.tags,
          })
        }
      />

      {/* Today's tasks */}
      <section className="ui-surface overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <span className="ui-icon-tile size-6">
              <ListTodo className="size-3.5 text-primary" />
            </span>
            کارهای امروز
          </h2>
          <Link to="/today">
            <Button variant="ghost" size="sm">
              همه
              <ArrowLeft className="size-3.5" />
            </Button>
          </Link>
        </div>
        {todayTasks.length === 0 && allToday.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-semibold">روزت خالی است!</p>
            <p className="mt-1 text-xs text-muted-foreground">
              می‌توانی برنامه‌ریزی کنی یا یک کار جدید بسازی.
            </p>
            <Button size="sm" className="mt-4" onClick={() => window.dispatchEvent(new CustomEvent("quick-add-task"))}>
              + ساخت کار
            </Button>
          </div>
        ) : (
          <ul>
            {allToday.map((t) => (
              <TaskRow
                key={t._id}
                task={t}
                project={projectOf(t.projectId)}
                subtaskTotal={subtotals.get(t._id)?.total}
                subtaskDone={subtotals.get(t._id)?.done}
                onToggle={(done) => toggleDone(t, done)}
                onOpen={() => openTask(t._id)}
                onDelete={() => deleteTask(t._id)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Overdue + Next up */}
      <div className="grid gap-6 lg:grid-cols-2">
        {overdue.length > 0 && (
          <section className="ui-surface overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-bold text-destructive">
                <span className="grid size-6 place-items-center rounded-lg border border-red-200/70 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10">
                  <TriangleAlert className="size-3.5" />
                </span>
                عقب‌افتاده
              </h2>
              <Link to="/tasks?filter=overdue">
                <Button variant="ghost" size="sm">
                  همه
                  <ArrowLeft className="size-3.5" />
                </Button>
              </Link>
            </div>
            <ul>
              {overdue.slice(0, 4).map((t) => (
                <TaskRow
                  key={t._id}
                  task={t}
                  project={projectOf(t.projectId)}
                  onToggle={(done) => toggleDone(t, done)}
                  onOpen={() => openTask(t._id)}
                  compact
                />
              ))}
            </ul>
          </section>
        )}

        {nextUp.length > 0 && (
          <section className="ui-surface overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <span className="ui-icon-tile size-6">
                  <Sparkles className="size-3.5 text-primary" />
                </span>
                پیشنهاد بعدی
              </h2>
              <Link to="/planning">
                <Button variant="ghost" size="sm">
                  برنامه‌ریزی
                  <ArrowLeft className="size-3.5" />
                </Button>
              </Link>
            </div>
            <ul>
              {nextUp.map((t) => (
                <TaskRow
                  key={t._id}
                  task={t}
                  project={projectOf(t.projectId)}
                  onToggle={(done) => toggleDone(t, done)}
                  onOpen={() => openTask(t._id)}
                  compact
                />
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Project snapshots */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold">پروژه‌های فعال</h2>
          <Link to="/projects">
            <Button variant="ghost" size="sm">
              همه پروژه‌ها
              <ArrowLeft className="size-3.5" />
            </Button>
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.slice(0, 3).map((p) => {
            const pts = tasks.filter((t) => t.projectId === p._id && !t.parentId);
            const doneN = pts.filter((t) => t.status === "done").length;
            const pctP = pts.length ? Math.round((doneN / pts.length) * 100) : 0;
            return (
              <Link key={p._id} to={`/projects/${p._id}`}>
                <div className="ui-surface ui-surface-hover h-full rounded-2xl p-4">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: p.color }} />
                    <span className="truncate text-sm font-bold">{p.name}</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pctP}%`,
                        background: `linear-gradient(90deg, ${p.color}, ${p.color}bb)`,
                        boxShadow: `0 0 12px -3px ${p.color}`,
                      }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {toFa(doneN)} از {toFa(pts.length)} کار
                    </span>
                    <span className="font-bold" style={{ color: p.color }}>
                      {toFa(pctP)}٪
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
          {projects.length === 0 && (
            <p className="col-span-full rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              هنوز پروژه‌ای نداری. اولین پروژه‌ات را بساز!
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
