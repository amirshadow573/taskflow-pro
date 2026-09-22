import { useWorkspace, type TaskDoc } from "@/components/workspace/WorkspaceData";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { TaskRow } from "@/components/tasks/TaskRow";
import { SmartTaskInput } from "@/components/tasks/SmartTaskInput";
import { TodayRoutines } from "@/components/workspace/TodayRoutines";
import { ProgressSnapshot } from "@/components/progress/ProgressSnapshot";
import { ActivePathsStrip } from "@/components/progress/ActivePathsStrip";
import { WorkspaceLayout } from "./WorkspaceLayout";
import { Button } from "@/components/ui/button";
import { toFa } from "@/lib/persian";
import { todayKey, isOverdue, dateKeyOf } from "@/lib/task-utils";
import { cn } from "@/lib/utils";
import { Link } from "react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import {
  ArrowLeft, LayoutDashboard, Sun, Inbox as InboxIcon, ListChecks, FolderKanban,
  Heart, Target, Repeat, Flame, CalendarClock, Timer, TrendingUp, ClipboardCheck,
  StickyNote, Plus, Trash2, X, CheckCircle2, TriangleAlert, Clock, Sparkles,
  Play, Pause, RotateCcw, Search, Pencil, BookOpen, Activity,
} from "lucide-react";

/* ================================================================== */
/*  HELPERS                                                            */
/* ================================================================== */

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  urgent: { label: "فوری", color: "text-red-600", bg: "bg-red-100 dark:bg-red-500/10" },
  high: { label: "مهم", color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-500/10" },
  medium: { label: "معمولی", color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-500/10" },
  low: { label: "اختیاری", color: "text-muted-foreground", bg: "bg-muted" },
};

const AREA_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

const BLOCK_KINDS: Record<string, { label: string; color: string }> = {
  focus: { label: "تمرکز", color: "text-violet-600 bg-violet-100 dark:bg-violet-500/10" },
  exercise: { label: "ورزش", color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-500/10" },
  learning: { label: "یادگیری", color: "text-blue-600 bg-blue-100 dark:bg-blue-500/10" },
  routine: { label: "روتین", color: "text-amber-600 bg-amber-100 dark:bg-amber-500/10" },
  personal: { label: "شخصی", color: "text-pink-600 bg-pink-100 dark:bg-pink-500/10" },
  other: { label: "سایر", color: "text-muted-foreground bg-muted" },
};

function weekStartKey(day: string): string {
  const d = new Date(`${day}T00:00:00`);
  const back = (d.getDay() + 1) % 7; // Week starts Saturday (Persian)
  d.setDate(d.getDate() - back);
  return dateKeyOf(d);
}

function shiftKey(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + n);
  return dateKeyOf(d);
}

function EmptyState({ icon: Icon, title, description, action }: { icon: React.FC<{ className?: string }>; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-muted/60"><Icon className="size-5 text-muted-foreground" /></div>
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30", props.className)} />;
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn("w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30 resize-none", props.className)} />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30", props.className)} />;
}

function SectionCard({ title, icon: Icon, action, children }: { title: string; icon: React.FC<{ className?: string }>; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="ui-surface overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold"><span className="ui-icon-tile size-6"><Icon className="size-3.5 text-primary" /></span>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function TaskList({ tasks, projectOf, subtotals, compact }: { tasks: TaskDoc[]; projectOf: (id?: Id<"projects">) => { _id: string; name: string; color: string } | undefined; subtotals: Map<string, { total: number; done: number }>; compact?: boolean }) {
  const { toggleDone, openTask, deleteTask } = useWorkspace();
  if (tasks.length === 0) return null;
  return (
    <ul>
      {tasks.map((t) => (
        <TaskRow
          key={t._id}
          task={t}
          project={projectOf(t.projectId)}
          subtaskTotal={subtotals.get(t._id)?.total}
          subtaskDone={subtotals.get(t._id)?.done}
          onToggle={(done) => toggleDone(t, done)}
          onOpen={() => openTask(t._id)}
          onDelete={() => deleteTask(t._id)}
          compact={compact}
        />
      ))}
    </ul>
  );
}

/* ================================================================== */
/*  DASHBOARD — calm decision & action center                          */
/* ================================================================== */

function DashboardTab({ goTab }: { goTab: (t: TabKey) => void }) {
  const { tasks, projects, createTask } = useWorkspace();
  const tKey = todayKey();
  const routines = useQuery(api.routines.listRoutines);
  const habits = useQuery(api.personal.habitsState, { day: tKey });
  const goals = useQuery(api.personal.listGoals);
  const blocks = useQuery(api.personal.listTimeBlocks, { day: tKey });
  const sessions = useQuery(api.employee.listFocusSessions);

  const root = tasks.filter((t) => !t.parentId && t.status !== "inbox");
  const allToday = root.filter((t) => t.dueDate === tKey);
  const done = allToday.filter((t) => t.status === "done");
  const remaining = allToday.filter((t) => t.status !== "done");
  const pct = allToday.length ? Math.round((done.length / allToday.length) * 100) : 0;
  const overdue = root.filter((t) => isOverdue(t));
  const inboxCount = tasks.filter((t) => t.status === "inbox").length;

  const priorities = useMemo(
    () =>
      [...remaining]
        .sort((a, b) => {
          const po: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
          return (po[a.priority] ?? 2) - (po[b.priority] ?? 2);
        })
        .slice(0, 5),
    [remaining],
  );

  const upcoming = useMemo(
    () =>
      root
        .filter((t) => t.status !== "done" && t.dueDate && t.dueDate > tKey)
        .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
        .slice(0, 4),
    [root, tKey],
  );

  const topGoals = useMemo(
    () =>
      (goals ?? [])
        .filter((g) => g.status === "active")
        .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
        .slice(0, 3),
    [goals],
  );

  const activeHabits = (habits ?? []).slice(0, 4);
  const nextBlock = (blocks ?? [])
    .filter((b) => b.endTime >= new Date().toTimeString().slice(0, 5))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
  const focusToday = (sessions ?? [])
    .filter((s) => s.date === tKey)
    .reduce((n, s) => n + s.actualMinutes, 0);
  const habitsDone = (habits ?? []).filter((h) => h.doneToday).length;

  const weekStart = weekStartKey(tKey);
  const activeDays = new Set(
    root.filter((t) => t.status === "done" && t.dueDate && t.dueDate >= weekStart && t.dueDate <= tKey).map((t) => t.dueDate),
  ).size;
  const daysElapsed = Math.max(1, Math.round((Date.parse(tKey) - Date.parse(weekStart)) / 86400000) + 1);
  const weekConsistency = Math.min(100, Math.round((activeDays / Math.min(7, daysElapsed)) * 100));

  const subtotals = useMemo(() => {
    const m = new Map<string, { total: number; done: number }>();
    for (const t of tasks) {
      if (!t.parentId) continue;
      const cur = m.get(t.parentId) ?? { total: 0, done: 0 };
      cur.total++;
      if (t.status === "done") cur.done++;
      m.set(t.parentId, cur);
    }
    return m;
  }, [tasks]);
  const projectOf = (id?: Id<"projects">) => projects.find((p) => p._id === id);

  return (
    <div className="space-y-5">
      {/* A. Personal overview — calm, concise */}
      <section className="ui-surface ui-accent-top rounded-2xl p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-5">
          <div className="relative grid size-20 place-items-center">
            <svg viewBox="0 0 80 80" className="size-20 -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--muted)" strokeWidth="8" />
              <circle cx="40" cy="40" r="34" fill="none" stroke="url(#pctGrad2)" strokeWidth="8" strokeLinecap="round" strokeDasharray={2 * Math.PI * 34} strokeDashoffset={2 * Math.PI * 34 * (1 - pct / 100)} style={{ transition: "stroke-dashoffset .6s cubic-bezier(.22,1,.36,1)" }} />
              <defs><linearGradient id="pctGrad2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#8b5cf6" /></linearGradient></defs>
            </svg>
            <span className="absolute text-sm font-extrabold tabular-nums">{toFa(pct)}٪</span>
          </div>
          <div className="min-w-0">
            <p className="text-lg font-extrabold">امروز</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span><b className="text-foreground">{toFa(allToday.length)}</b> کار</span>
              <span><b className="text-emerald-600">{toFa(done.length)}</b> انجام شده</span>
              <span><b className="text-amber-600">{toFa(remaining.length)}</b> باقی مانده</span>
              {remaining.some((t) => t.priority === "urgent" || t.priority === "high") && (
                <span className="font-bold text-red-600">{toFa(remaining.filter((t) => t.priority === "urgent" || t.priority === "high").length)} مورد مهم</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {overdue.length > 0 && (
              <Link to="/tasks?filter=overdue">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                  <TriangleAlert className="size-3.5" />{toFa(overdue.length)} عقب‌افتاده
                </span>
              </Link>
            )}
            {inboxCount > 0 && (
              <button onClick={() => goTab("inbox")}>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                  <InboxIcon className="size-3.5" />{toFa(inboxCount)} در صندوق
                </span>
              </button>
            )}
          </div>
        </div>
      </section>

      <SmartTaskInput onCreate={(p) => createTask({ title: p.title, dueDate: p.dueDate, dueTime: p.dueTime, priority: p.priority, tags: p.tags })} />

      {/* B. Today's priorities — not all tasks, only what matters */}
      <SectionCard
        title="اولویت‌های امروز"
        icon={Sun}
        action={<Button variant="ghost" size="sm" onClick={() => goTab("today")}>همه<ArrowLeft className="size-3.5" /></Button>}
      >
        {priorities.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm font-semibold">امروز کار مهمی نداری.</p>
            <p className="mt-1 text-xs text-muted-foreground">می‌توانی برنامه‌ریزی کنی یا اولویت بعدی‌ات را انتخاب کنی.</p>
          </div>
        ) : (
          <TaskList tasks={priorities} projectOf={projectOf} subtotals={subtotals} compact />
        )}
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* C. Upcoming */}
        {upcoming.length > 0 && (
          <SectionCard
            title="پیش رو"
            icon={Clock}
            action={<Link to="/calendar"><Button variant="ghost" size="sm">تقویم<ArrowLeft className="size-3.5" /></Button></Link>}
          >
            <TaskList tasks={upcoming} projectOf={projectOf} subtotals={subtotals} compact />
          </SectionCard>
        )}

        {/* D. Goals progress — top 3 only, or a teaching empty state */}
        <SectionCard
          title="اهداف"
          icon={Target}
          action={<Button variant="ghost" size="sm" onClick={() => goTab("goals")}>همه<ArrowLeft className="size-3.5" /></Button>}
        >
          {topGoals.length === 0 ? (
            <EmptyState
              icon={Target}
              title="هنوز هدفی نداری"
              description="اهداف کارهای روزانه‌ات را به چیزهایی که برایت مهم است متصل می‌کنند."
              action={<Button size="sm" onClick={() => goTab("goals")}><Plus className="size-3.5" />اولین هدف</Button>}
            />
          ) : (
            <div className="space-y-3 p-4">
              {topGoals.map((g) => (
                <div key={g._id}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate font-bold">{g.title}</span>
                    <span className="font-extrabold tabular-nums">{toFa(g.progress)}٪</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gradient-to-l from-primary to-blue-500 transition-all duration-500" style={{ width: `${g.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* E. Routines + Habits — lightweight, only if used */}
        {(routines && routines.length > 0) && (
          <div><TodayRoutines /></div>
        )}
        {activeHabits.length > 0 && (
          <SectionCard
            title="عادات امروز"
            icon={Flame}
            action={<span className="text-xs font-bold text-muted-foreground">{toFa(habitsDone)}/{toFa((habits ?? []).length)}</span>}
          >
            <div className="flex flex-wrap gap-2 p-4">
              {activeHabits.map((h) => (
                <HabitChip key={h._id} habit={h} day={tKey} />
              ))}
            </div>
          </SectionCard>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* F. Focus — next block or start now */}
        <SectionCard
          title="تمرکز بعدی"
          icon={Timer}
          action={<Button variant="ghost" size="sm" onClick={() => goTab("focus")}>شروع<ArrowLeft className="size-3.5" /></Button>}
        >
          <div className="p-4">
            {nextBlock ? (
              <div className="flex items-center gap-3">
                <span className={cn("rounded-lg px-2 py-1 text-[11px] font-bold", BLOCK_KINDS[nextBlock.kind]?.color ?? BLOCK_KINDS.other.color)}>
                  {BLOCK_KINDS[nextBlock.kind]?.label ?? "سایر"}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{nextBlock.title}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{toFa(nextBlock.startTime)} – {toFa(nextBlock.endTime)}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">حالت تمرکز</p>
                  <p className="text-xs text-muted-foreground">{focusToday > 0 ? `امروز ${toFa(focusToday)} دقیقه تمرکز` : "یک جلسه تمرکز شروع کنید."}</p>
                </div>
                <Button size="sm" onClick={() => goTab("focus")}><Play className="size-3.5" />شروع</Button>
              </div>
            )}
          </div>
        </SectionCard>

        {/* G. Compact progress */}
        <SectionCard title="پیشرفت" icon={TrendingUp} action={<Button variant="ghost" size="sm" onClick={() => goTab("progress")}>جزئیات<ArrowLeft className="size-3.5" /></Button>}>
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            {[
              { label: "امروز", value: `${toFa(pct)}٪`, icon: CheckCircle2, color: "text-emerald-600" },
              { label: "هماهنگی هفتگی", value: `${toFa(weekConsistency)}٪`, icon: Activity, color: "text-blue-600" },
              { label: "عادات امروز", value: `${toFa(habitsDone)}/${toFa((habits ?? []).length)}`, icon: Flame, color: "text-amber-600" },
              { label: "تمرکز امروز", value: `${toFa(focusToday)}′`, icon: Timer, color: "text-violet-600" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border/60 bg-muted/40 p-2.5 text-center dark:bg-white/5">
                <s.icon className={cn("mx-auto mb-1 size-4", s.color)} />
                <div className="text-sm font-extrabold tabular-nums">{s.value}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  HABIT CHIP (dashboard)                                             */
/* ================================================================== */

function HabitChip({ habit, day }: { habit: { _id: Id<"habits">; title: string; color?: string; doneToday: boolean; streak: number }; day: string }) {
  const toggle = useMutation(api.personal.toggleHabitLog);
  return (
    <button
      onClick={() => toggle({ habitId: habit._id, day, done: !habit.doneToday })}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all",
        habit.doneToday
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "border-border/60 bg-background hover:border-primary/40",
      )}
    >
      <span className="size-2 rounded-full" style={{ background: habit.color ?? "#f59e0b" }} />
      {habit.title}
      {habit.streak > 0 && <span className="text-[10px] text-muted-foreground">🔥{toFa(habit.streak)}</span>}
    </button>
  );
}

/* ================================================================== */
/*  TODAY — what should I do today?                                    */
/* ================================================================== */

function TodayTab() {
  const { tasks, projects, createTask, toggleDone, openTask, deleteTask } = useWorkspace();
  const tKey = todayKey();
  const goals = useQuery(api.personal.listGoals);
  const habits = useQuery(api.personal.habitsState, { day: tKey });
  const routines = useQuery(api.routines.listRoutines);

  const root = tasks.filter((t) => !t.parentId && t.status !== "inbox");
  const allToday = root.filter((t) => t.dueDate === tKey);
  const doneList = allToday.filter((t) => t.status === "done");
  const open = allToday.filter((t) => t.status !== "done");

  const goalProjectIds = useMemo(() => new Set((goals ?? []).flatMap((g) => g.relatedProjectIds)), [goals]);

  const assigned = new Set<string>();
  const pick = (fn: (t: TaskDoc) => boolean) => {
    const list = open.filter((t) => !assigned.has(t._id) && fn(t));
    list.forEach((t) => assigned.add(t._id));
    return list;
  };

  const mustDo = pick((t) => t.priority === "urgent" || t.priority === "high");
  const towardGoal = pick((t) => !!t.projectId && goalProjectIds.has(t.projectId));
  const focusWork = pick((t) => (t.estimateMinutes ?? 0) >= 45);
  const important = pick((t) => t.priority === "medium");
  const optional = pick((t) => true); // everything else

  const subtotals = useMemo(() => {
    const m = new Map<string, { total: number; done: number }>();
    for (const t of tasks) {
      if (!t.parentId) continue;
      const cur = m.get(t.parentId) ?? { total: 0, done: 0 };
      cur.total++;
      if (t.status === "done") cur.done++;
      m.set(t.parentId, cur);
    }
    return m;
  }, [tasks]);
  const projectOf = (id?: Id<"projects">) => projects.find((p) => p._id === id);

  const sections: { key: string; label: string; color: string; tasks: TaskDoc[] }[] = [
    { key: "must", label: "باید انجام شود", color: "text-red-600", tasks: mustDo },
    { key: "goal", label: "در مسیر هدف", color: "text-primary", tasks: towardGoal },
    { key: "focus", label: "کار تمرکزی", color: "text-violet-600", tasks: focusWork },
    { key: "important", label: "مهم", color: "text-amber-600", tasks: important },
    { key: "optional", label: "اختیاری", color: "text-muted-foreground", tasks: optional },
  ].filter((s) => s.tasks.length > 0); // hide empty sections

  const openHabits = (habits ?? []).filter((h) => !h.doneToday);

  return (
    <div className="space-y-5">
      <SmartTaskInput onCreate={(p) => createTask({ title: p.title, dueDate: p.dueDate ?? tKey, dueTime: p.dueTime, priority: p.priority, tags: p.tags })} />

      {/* Habits scheduled for today */}
      {openHabits.length > 0 && (
        <SectionCard title="عادات امروز" icon={Flame}>
          <div className="flex flex-wrap gap-2 p-4">
            {openHabits.map((h) => <HabitChip key={h._id} habit={h} day={tKey} />)}
          </div>
        </SectionCard>
      )}

      {/* Contextual task sections — intelligently hidden when empty */}
      {sections.map((s) => (
        <SectionCard key={s.key} title={s.label} icon={ListChecks}>
          <ul>
            {s.tasks.map((t) => (
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
        </SectionCard>
      ))}

      {sections.length === 0 && openHabits.length === 0 && (
        <SectionCard title="برنامه امروز" icon={Sun}>
          <EmptyState
            icon={Sun}
            title="برای امروز کاری ثبت نشده"
            description="اولویت امروزت را اضافه کن تا بدانی روی چه چیزی تمرکز کنی."
            action={<span className="text-xs text-muted-foreground">از جعبه بالا یک کار بنویس.</span>}
          />
        </SectionCard>
      )}

      {/* Routines */}
      {routines && routines.length > 0 && <TodayRoutines />}

      {/* Completed */}
      {doneList.length > 0 && (
        <SectionCard title={`انجام شده (${toFa(doneList.length)})`} icon={CheckCircle2}>
          <TaskList tasks={doneList} projectOf={projectOf} subtotals={subtotals} compact />
        </SectionCard>
      )}
    </div>
  );
}

/* ================================================================== */
/*  INBOX — capture first, clarify later                               */
/* ================================================================== */

function InboxTab() {
  const { tasks, projects, updateTask, deleteTask, openTask, createTask } = useWorkspace();
  const items = tasks.filter((t) => t.status === "inbox");
  const projectOf = (id?: Id<"projects">) => projects.find((p) => p._id === id);

  return (
    <div className="space-y-4">
      <SmartTaskInput
        defaultStatus="inbox"
        placeholder="چیزی بگیر و ذخیره کن… بعداً تبدیلش کن (ایده، یادآوری، مسئولیت…)"
        onCreate={(p) => createTask({ title: p.title, status: "inbox", tags: p.tags })}
      />

      <SectionCard
        title={`صندوق ورودی (${toFa(items.length)})`}
        icon={InboxIcon}
        action={<span className="text-[11px] text-muted-foreground">سریع بگیر، بعداً سازماندهی کن</span>}
      >
        {items.length === 0 ? (
          <EmptyState
            icon={InboxIcon}
            title="صندوق خالی است"
            description="هر فکر، ایده یا یادآوری را همین‌جا سریع ثبت کن؛ بعداً تبدیلش کن به کار یا برنامه."
          />
        ) : (
          <ul>
            {items.map((t) => (
              <li key={t._id} className="border-b border-border/50 last:border-0">
                <TaskRow task={t} project={projectOf(t.projectId)} onToggle={() => {}} onOpen={() => openTask(t._id)} compact />
                <div className="flex flex-wrap gap-1.5 px-3 pb-2.5">
                  <Button size="sm" variant="secondary" className="h-7 px-2 text-[11px]" onClick={() => updateTask(t._id, { status: "todo", priority: "medium" })}>
                    <CheckCircle2 className="size-3" />تبدیل به کار
                  </Button>
                  <Button size="sm" variant="secondary" className="h-7 px-2 text-[11px]" onClick={() => updateTask(t._id, { status: "todo", dueDate: todayKey() })}>
                    <Sun className="size-3" />برنامه امروز
                  </Button>
                  <Button size="sm" variant="secondary" className="h-7 px-2 text-[11px]" onClick={() => updateTask(t._id, { priority: "high" })}>
                    <TriangleAlert className="size-3" />مهم
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-destructive" onClick={() => deleteTask(t._id)}>
                    <Trash2 className="size-3" />حذف
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

/* ================================================================== */
/*  TASKS                                                              */
/* ================================================================== */

type TaskFilter = "all" | "today" | "overdue" | "done";

function TasksTab() {
  const { tasks, projects, createTask, toggleDone, openTask, deleteTask } = useWorkspace();
  const [filter, setFilter] = useState<TaskFilter>("all");
  const tKey = todayKey();
  const root = tasks.filter((t) => !t.parentId);

  const filtered = root.filter((t) => {
    if (filter === "today") return t.dueDate === tKey && t.status !== "done";
    if (filter === "overdue") return isOverdue(t);
    if (filter === "done") return t.status === "done";
    return t.status !== "inbox";
  });

  const subtotals = useMemo(() => {
    const m = new Map<string, { total: number; done: number }>();
    for (const t of tasks) {
      if (!t.parentId) continue;
      const cur = m.get(t.parentId) ?? { total: 0, done: 0 };
      cur.total++;
      if (t.status === "done") cur.done++;
      m.set(t.parentId, cur);
    }
    return m;
  }, [tasks]);
  const projectOf = (id?: Id<"projects">) => projects.find((p) => p._id === id);

  const FILTERS: { key: TaskFilter; label: string }[] = [
    { key: "all", label: "همه" },
    { key: "today", label: "امروز" },
    { key: "overdue", label: "عقب‌افتاده" },
    { key: "done", label: "انجام‌شده" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-bold transition-all",
              filter === f.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <SectionCard title="کارها" icon={ListChecks}>
        {filtered.length === 0 ? (
          <EmptyState icon={ListChecks} title="کاری برای نمایش نیست" description="فیلتر دیگری انتخاب کن یا کار جدیدی اضافه کن." />
        ) : (
          <ul>
            {filtered.map((t) => (
              <TaskRow key={t._id} task={t} project={projectOf(t.projectId)} subtaskTotal={subtotals.get(t._id)?.total} subtaskDone={subtotals.get(t._id)?.done} onToggle={(d) => toggleDone(t, d)} onOpen={() => openTask(t._id)} onDelete={() => deleteTask(t._id)} />
            ))}
          </ul>
        )}
      </SectionCard>

      <SmartTaskInput onCreate={(p) => createTask({ title: p.title, dueDate: p.dueDate, dueTime: p.dueTime, priority: p.priority, tags: p.tags })} />
    </div>
  );
}

/* ================================================================== */
/*  PROJECTS                                                           */
/* ================================================================== */

function ProjectsTab() {
  const { tasks, projects, createProject } = useWorkspace();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const active = projects.filter((p) => p.status !== "completed");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold"><FolderKanban className="size-4 text-blue-600" />پروژه‌های شخصی</h3>
        <Button size="sm" onClick={() => setAdding((v) => !v)}><Plus className="size-3.5" />پروژه جدید</Button>
      </div>

      {adding && (
        <div className="ui-surface flex gap-2 rounded-2xl p-3">
          <Input placeholder="مثلاً: اسباب‌کشی، سفر، یادگیری فتوشاپ…" value={name} onChange={(e) => setName(e.target.value)} />
          <Button
            size="sm"
            disabled={!name.trim()}
            onClick={async () => {
              await createProject({ name: name.trim(), color: AREA_COLORS[Math.floor(Math.random() * AREA_COLORS.length)] });
              setName("");
              setAdding(false);
            }}
          >
            ایجاد
          </Button>
        </div>
      )}

      {active.length === 0 ? (
        <SectionCard title="پروژه‌ها" icon={FolderKanban}>
          <EmptyState
            icon={FolderKanban}
            title="هنوز پروژه‌ای نداری"
            description="پروژه‌ها نتایج بزرگ‌تری مثل «اسباب‌کشی» یا «یادگیری فتوشاپ» را دنبال می‌کنند."
            action={<Button size="sm" onClick={() => setAdding(true)}><Plus className="size-3.5" />اولین پروژه</Button>}
          />
        </SectionCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((p) => {
            const pts = tasks.filter((t) => t.projectId === p._id && !t.parentId);
            const done = pts.filter((t) => t.status === "done").length;
            const pct = pts.length ? Math.round((done / pts.length) * 100) : 0;
            return (
              <Link key={p._id} to={`/projects/${p._id}`}>
                <div className="ui-surface ui-surface-hover h-full rounded-2xl p-4">
                  <div className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: p.color }} /><span className="truncate text-sm font-bold">{p.name}</span></div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${p.color}, ${p.color}bb)` }} /></div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground"><span>{toFa(done)} از {toFa(pts.length)} کار</span><span className="font-bold" style={{ color: p.color }}>{toFa(pct)}٪</span></div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  LIFE AREAS                                                         */
/* ================================================================== */

function LifeAreasTab() {
  const areas = useQuery(api.personal.listLifeAreas);
  const goals = useQuery(api.personal.listGoals);
  const habits = useQuery(api.personal.listHabits);
  const notes = useQuery(api.personal.listNotes);
  const createArea = useMutation(api.personal.createLifeArea);
  const deleteArea = useMutation(api.personal.deleteLifeArea);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(AREA_COLORS[0]);

  const list = (areas ?? []).filter((a) => !a.archived);

  const countFor = (id: Id<"lifeAreas">) =>
    (goals ?? []).filter((g) => g.lifeAreaId === id).length +
    (habits ?? []).filter((h) => h.lifeAreaId === id).length +
    (notes ?? []).filter((n) => n.lifeAreaId === id).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold"><Heart className="size-4 text-pink-600" />حوزه‌های زندگی</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">کجا داری توجهت رو می‌ذاری؟</p>
        </div>
        <Button size="sm" onClick={() => setAdding((v) => !v)}><Plus className="size-3.5" />حوزه جدید</Button>
      </div>

      {adding && (
        <div className="ui-surface space-y-3 rounded-2xl p-4">
          <Input placeholder="نام حوزه، مثلاً: سلامت، خانواده، یادگیری…" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex gap-2">
            {AREA_COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} className={cn("size-7 rounded-full border-2 transition-transform", color === c ? "scale-110 border-foreground" : "border-transparent")} style={{ background: c }} />
            ))}
          </div>
          <Button
            size="sm"
            disabled={!name.trim()}
            onClick={async () => {
              await createArea({ name: name.trim(), color });
              setName("");
              setAdding(false);
            }}
          >
            ایجاد
          </Button>
        </div>
      )}

      {list.length === 0 ? (
        <SectionCard title="حوزه‌ها" icon={Heart}>
          <EmptyState
            icon={Heart}
            title="هنوز حوزه‌ای تعریف نکرده‌ای"
            description="حوزه‌های زندگی کمک می‌کنند ببینی توجهت بین جنبه‌های مختلف زندگی‌ات چطور تقسیم شده."
            action={<Button size="sm" onClick={() => setAdding(true)}><Plus className="size-3.5">اولین حوزه</Plus></Button>}
          />
        </SectionCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((a) => (
            <div key={a._id} className="ui-surface rounded-2xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full" style={{ background: a.color }} />
                  <span className="text-sm font-bold">{a.emoji ? `${a.emoji} ` : ""}{a.name}</span>
                </div>
                <button onClick={() => deleteArea({ id: a._id })} className="text-muted-foreground transition-colors hover:text-destructive"><Trash2 className="size-3.5" /></button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{toFa(countFor(a._id))} مورد مرتبط</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  GOALS — hierarchy: goal → milestones → tasks                       */
/* ================================================================== */

function GoalsTab() {
  const goals = useQuery(api.personal.listGoals);
  const areas = useQuery(api.personal.listLifeAreas);
  const createGoal = useMutation(api.personal.createGoal);
  const updateGoal = useMutation(api.personal.updateGoal);
  const deleteGoal = useMutation(api.personal.deleteGoal);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState("");
  const [areaId, setAreaId] = useState("");
  const [milestonesText, setMilestonesText] = useState("");

  const list = goals ?? [];

  const submit = async () => {
    if (!title.trim()) return;
    const milestones = milestonesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((t) => ({ title: t, done: false }));
    await createGoal({
      title: title.trim(),
      description: desc.trim() || undefined,
      dueDate: due || undefined,
      lifeAreaId: (areaId || undefined) as Id<"lifeAreas"> | undefined,
      milestones,
      relatedProjectIds: [],
    });
    setTitle(""); setDesc(""); setDue(""); setAreaId(""); setMilestonesText(""); setAdding(false);
  };

  const toggleMilestone = (goal: (typeof list)[number], idx: number) => {
    const milestones = goal.milestones.map((m, i) => (i === idx ? { ...m, done: !m.done } : m));
    updateGoal({ id: goal._id, milestones });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold"><Target className="size-4 text-primary" />اهداف شخصی</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">هدف ← گام‌ها ← کارهای روزانه</p>
        </div>
        <Button size="sm" onClick={() => setAdding((v) => !v)}><Plus className="size-3.5" />هدف جدید</Button>
      </div>

      {adding && (
        <div className="ui-surface space-y-3 rounded-2xl p-4">
          <Input placeholder="عنوان هدف، مثلاً: بهبود آمادگی جسمانی" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="توضیح (اختیاری)" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
          <Textarea placeholder="گام‌ها — هر خط یک گام (مثلاً: هفته‌ای ۳ بار ورزش)" rows={3} value={milestonesText} onChange={(e) => setMilestonesText(e.target.value)} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            <Select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">بدون حوزه</option>
              {(areas ?? []).filter((a) => !a.archived).map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </Select>
          </div>
          <Button size="sm" disabled={!title.trim()} onClick={submit}>ایجاد هدف</Button>
        </div>
      )}

      {list.length === 0 ? (
        <SectionCard title="اهداف" icon={Target}>
          <EmptyState
            icon={Target}
            title="هنوز هدفی نداری"
            description="اهداف کارهای روزانه‌ات را به چیزهایی که برایت مهم است متصل می‌کنند."
            action={<Button size="sm" onClick={() => setAdding(true)}><Plus className="size-3.5" />اولین هدف</Button>}
          />
        </SectionCard>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((g) => {
            const area = (areas ?? []).find((a) => a._id === g.lifeAreaId);
            return (
              <div key={g._id} className="ui-surface rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{g.title}</p>
                    {g.description && <p className="mt-0.5 text-xs text-muted-foreground">{g.description}</p>}
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                      {area && <span className="rounded-md px-1.5 py-0.5 font-bold" style={{ background: `${area.color}22`, color: area.color }}>{area.name}</span>}
                      {g.dueDate && <span className="rounded-md bg-muted px-1.5 py-0.5 font-bold">موعد: {toFa(g.dueDate)}</span>}
                      <span className={cn("rounded-md px-1.5 py-0.5 font-bold", g.status === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10" : g.status === "paused" ? "bg-muted text-muted-foreground" : "bg-blue-100 text-blue-700 dark:bg-blue-500/10")}>
                        {g.status === "completed" ? "تکمیل" : g.status === "paused" ? "متوقف" : "فعال"}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => deleteGoal({ id: g._id })} className="text-muted-foreground transition-colors hover:text-destructive"><Trash2 className="size-3.5" /></button>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px]"><span className="text-muted-foreground">پیشرفت</span><span className="font-extrabold tabular-nums">{toFa(g.progress)}٪</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-l from-primary to-blue-500 transition-all duration-500" style={{ width: `${g.progress}%` }} /></div>
                </div>

                {g.milestones.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {g.milestones.map((m, i) => (
                      <li key={i}>
                        <button onClick={() => toggleMilestone(g, i)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-right text-xs transition-colors hover:bg-muted/60">
                          <span className={cn("grid size-4 shrink-0 place-items-center rounded-md border", m.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-border")}>
                            {m.done && <CheckCircle2 className="size-3" />}
                          </span>
                          <span className={cn(m.done && "text-muted-foreground line-through")}>{m.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex gap-1.5">
                  {g.status === "active" && (
                    <>
                      <Button size="sm" variant="secondary" className="h-7 px-2 text-[11px]" onClick={() => updateGoal({ id: g._id, status: "paused" })}>توقف</Button>
                      <Button size="sm" variant="secondary" className="h-7 px-2 text-[11px]" onClick={() => updateGoal({ id: g._id, status: "completed", progress: 100, milestones: g.milestones.map((m) => ({ ...m, done: true })) })}>تکمیل</Button>
                    </>
                  )}
                  {g.status !== "active" && (
                    <Button size="sm" variant="secondary" className="h-7 px-2 text-[11px]" onClick={() => updateGoal({ id: g._id, status: "active" })}>فعال‌سازی</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  ROUTINES — reuse the shared routine system                         */
/* ================================================================== */

function RoutinesTab() {
  const tKey = todayKey();
  const routines = useQuery(api.routines.listRoutines);
  const items = useQuery(api.routines.listAllItems);
  const checkins = useQuery(api.routines.listCheckinsForDay, { day: tKey });
  const createRoutine = useMutation(api.routines.createRoutine);
  const createItem = useMutation(api.routines.createItem);
  const toggleCheckin = useMutation(api.routines.toggleCheckin);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [newItem, setNewItem] = useState<Record<string, string>>({});

  const doneIds = new Set((checkins ?? []).filter((c) => c.done).map((c) => c.itemId));
  const list = routines ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold"><Repeat className="size-4 text-amber-600" />روتین‌ها</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">دنباله‌های تکرارشونده روزانه مثل روتین صبح یا شب</p>
        </div>
        <Button size="sm" onClick={() => setAdding((v) => !v)}><Plus className="size-3.5" />روتین جدید</Button>
      </div>

      {adding && (
        <div className="ui-surface flex gap-2 rounded-2xl p-3">
          <Input placeholder="مثلاً: روتین صبح" value={name} onChange={(e) => setName(e.target.value)} />
          <Button size="sm" disabled={!name.trim()} onClick={async () => { await createRoutine({ title: name.trim(), colorKey: "blue" }); setName(""); setAdding(false); }}>ایجاد</Button>
        </div>
      )}

      {list.length === 0 ? (
        <SectionCard title="روتین‌ها" icon={Repeat}>
          <EmptyState
            icon={Repeat}
            title="هنوز روتینی نداری"
            description="روتین‌ها مسیرهای تکرارشونده مثل «صبح‌ها» یا «شب‌ها» هستند که هر روز چک می‌کنی."
            action={<Button size="sm" onClick={() => setAdding(true)}><Plus className="size-3.5" />اولین روتین</Button>}
          />
        </SectionCard>
      ) : (
        <div className="space-y-3">
          {list.map((r) => {
            const rItems = (items ?? []).filter((i) => i.routineId === r._id).sort((a, b) => a.sortOrder - b.sortOrder);
            const doneCount = rItems.filter((i) => doneIds.has(i._id)).length;
            return (
              <SectionCard
                key={r._id}
                title={r.title}
                icon={Repeat}
                action={<span className="text-xs font-bold text-muted-foreground">{toFa(doneCount)}/{toFa(rItems.length)}</span>}
              >
                <div className="divide-y divide-border/50">
                  {rItems.length === 0 && <p className="px-4 py-4 text-center text-xs text-muted-foreground">مرحله‌ای اضافه کنید تا روتین کامل شود.</p>}
                  {rItems.map((it) => (
                    <button
                      key={it._id}
                      onClick={() => toggleCheckin({ itemId: it._id, day: tKey, done: !doneIds.has(it._id) })}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-right transition-colors hover:bg-white/60 dark:hover:bg-white/5"
                    >
                      <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border transition-colors", doneIds.has(it._id) ? "border-emerald-500 bg-emerald-500 text-white" : "border-border")}>
                        {doneIds.has(it._id) && <CheckCircle2 className="size-3.5" />}
                      </span>
                      <span className={cn("text-sm", doneIds.has(it._id) && "text-muted-foreground line-through")}>{it.title}</span>
                    </button>
                  ))}
                  <div className="flex gap-2 px-4 py-2.5">
                    <Input
                      placeholder="مرحله جدید…"
                      value={newItem[r._id] ?? ""}
                      onChange={(e) => setNewItem((s) => ({ ...s, [r._id]: e.target.value }))}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" && (newItem[r._id] ?? "").trim()) {
                          await createItem({ routineId: r._id, title: newItem[r._id].trim() });
                          setNewItem((s) => ({ ...s, [r._id]: "" }));
                        }
                      }}
                      className="py-1.5 text-xs"
                    />
                  </div>
                </div>
              </SectionCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  HABITS — frequency, streak, consistency                            */
/* ================================================================== */

function HabitsTab() {
  const tKey = todayKey();
  const habits = useQuery(api.personal.habitsState, { day: tKey });
  const areas = useQuery(api.personal.listLifeAreas);
  const createHabit = useMutation(api.personal.createHabit);
  const deleteHabit = useMutation(api.personal.deleteHabit);
  const toggleLog = useMutation(api.personal.toggleHabitLog);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [freq, setFreq] = useState("daily");
  const [areaId, setAreaId] = useState("");

  const list = habits ?? [];
  const weekDays = [...Array(7)].map((_, i) => shiftKey(tKey, -(6 - i)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold"><Flame className="size-4 text-amber-600" />عادات</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">رفتارهای تکرارشونده — با پیگیری، استمرار و ثبات</p>
        </div>
        <Button size="sm" onClick={() => setAdding((v) => !v)}><Plus className="size-3.5" />عادت جدید</Button>
      </div>

      {adding && (
        <div className="ui-surface space-y-3 rounded-2xl p-4">
          <Input placeholder="مثلاً: ۲۰ دقیقه مطالعه" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Select value={freq} onChange={(e) => setFreq(e.target.value)}>
              <option value="daily">هر روز</option>
              <option value="weekly">هر هفته</option>
            </Select>
            <Select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">بدون حوزه</option>
              {(areas ?? []).filter((a) => !a.archived).map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </Select>
          </div>
          <Button
            size="sm"
            disabled={!title.trim()}
            onClick={async () => {
              await createHabit({ title: title.trim(), frequency: freq, target: freq === "daily" ? 1 : 3, lifeAreaId: (areaId || undefined) as Id<"lifeAreas"> | undefined });
              setTitle(""); setAreaId(""); setAdding(false);
            }}
          >
            ایجاد
          </Button>
        </div>
      )}

      {list.length === 0 ? (
        <SectionCard title="عادات" icon={Flame}>
          <EmptyState
            icon={Flame}
            title="هنوز عادتی نداری"
            description="عادت‌ها رفتارهای کوچک تکرارشونده‌اند مثل مطالعه یا ورزش روزانه که ثباتت را می‌سازند."
            action={<Button size="sm" onClick={() => setAdding(true)}><Plus className="size-3.5" />اولین عادت</Button>}
          />
        </SectionCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((h) => (
            <div key={h._id} className="ui-surface rounded-2xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: h.color ?? "#f59e0b" }} />
                  <span className="text-sm font-bold">{h.title}</span>
                </div>
                <button onClick={() => deleteHabit({ id: h._id })} className="text-muted-foreground transition-colors hover:text-destructive"><Trash2 className="size-3.5" /></button>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                <span>{h.frequency === "daily" ? "هر روز" : "هر هفته"}</span>
                <span>🔥 {toFa(h.streak)} روز پیوسته</span>
                <span>این هفته: {toFa(h.weekDone)}/{toFa(h.frequency === "daily" ? 7 : h.target)}</span>
              </div>
              <button
                onClick={() => toggleLog({ habitId: h._id, day: tKey, done: !h.doneToday })}
                className={cn(
                  "mt-3 w-full rounded-xl border px-3 py-2 text-xs font-bold transition-all",
                  h.doneToday
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                    : "border-border/60 hover:border-primary/40",
                )}
              >
                {h.doneToday ? "✓ امروز انجام شد" : "انجام امروز"}
              </button>
            </div>
          ))}
        </div>
      )}
      {/* week strip reference (visualizes consistency at a glance) */}
      {list.length > 0 && (
        <p className="text-center text-[11px] text-muted-foreground">هفته جاری: {weekDays.map((d) => toFa(d.slice(8, 10))).join(" / ")}</p>
      )}
    </div>
  );
}

/* ================================================================== */
/*  TIME BLOCKS — when I intend to do things                           */
/* ================================================================== */

function TimeBlocksTab() {
  const tKey = todayKey();
  const [day, setDay] = useState(tKey);
  const blocks = useQuery(api.personal.listTimeBlocks, { day });
  const tasks = useQuery(api.tasks.list, {});
  const createBlock = useMutation(api.personal.createTimeBlock);
  const deleteBlock = useMutation(api.personal.deleteTimeBlock);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [kind, setKind] = useState("focus");

  const sorted = [...(blocks ?? [])].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const openTasks = (tasks ?? []).filter((t) => t.status !== "done" && t.status !== "inbox" && !t.parentId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold"><CalendarClock className="size-4 text-violet-600" />بلوک‌های زمانی</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">«چه کاری» با «کی می‌خوام انجامش بدم» فرق داره</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setDay(shiftKey(day, -1))}>روز قبل</Button>
          <span className="text-xs font-bold tabular-nums">{toFa(day)}</span>
          <Button size="sm" variant="secondary" onClick={() => setDay(shiftKey(day, 1))}>روز بعد</Button>
          <Button size="sm" onClick={() => setAdding((v) => !v)}><Plus className="size-3.5" />بلوک</Button>
        </div>
      </div>

      {adding && (
        <div className="ui-surface space-y-3 rounded-2xl p-4">
          <Input placeholder="عنوان، مثلاً: کار عمیق — پروژه سایت" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              {Object.entries(BLOCK_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
            <Button size="sm" disabled={!title.trim() || end <= start} onClick={async () => { await createBlock({ title: title.trim(), day, startTime: start, endTime: end, kind }); setTitle(""); setAdding(false); }}>ایجاد</Button>
          </div>
          {openTasks.length > 0 && (
            <p className="text-[11px] text-muted-foreground">نکته: برای اتصال بلوک به کار، از کارها صفحه اقدام کنید.</p>
          )}
        </div>
      )}

      <SectionCard title="برنامه روز" icon={CalendarClock}>
        {sorted.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="برای این روز بلوکی نداری"
            description="بلوک زمانی مشخص می‌کند که قرار است کی روی چه کاری تمرکز کنی."
            action={<Button size="sm" onClick={() => setAdding(true)}><Plus className="size-3.5" />اولین بلوک</Button>}
          />
        ) : (
          <div className="divide-y divide-border/50">
            {sorted.map((b) => (
              <div key={b._id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-24 shrink-0 text-xs font-extrabold tabular-nums text-muted-foreground">{toFa(b.startTime)} – {toFa(b.endTime)}</span>
                <span className={cn("shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold", BLOCK_KINDS[b.kind]?.color ?? BLOCK_KINDS.other.color)}>
                  {BLOCK_KINDS[b.kind]?.label ?? "سایر"}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{b.title}</span>
                <button onClick={() => deleteBlock({ id: b._id })} className="text-muted-foreground transition-colors hover:text-destructive"><Trash2 className="size-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ================================================================== */
/*  FOCUS — distraction-free execution mode                            */
/* ================================================================== */

const FOCUS_PRESETS = [15, 25, 50];

function FocusTab() {
  const tKey = todayKey();
  const { tasks } = useWorkspace();
  const sessions = useQuery(api.employee.listFocusSessions);
  const createSession = useMutation(api.employee.createFocusSession);

  const [planned, setPlanned] = useState(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [taskId, setTaskId] = useState("");
  const startedRef = useRef(false);

  const openTasks = tasks.filter((t) => t.status !== "done" && t.status !== "inbox" && !t.parentId);
  const selected = openTasks.find((t) => t._id === taskId);

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(iv);
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [running]);

  const saveSession = async (actualMinutes: number, completed: boolean) => {
    await createSession({
      taskId: (taskId || undefined) as Id<"tasks"> | undefined,
      title: selected?.title,
      plannedMinutes: planned,
      actualMinutes,
      date: tKey,
      completed,
      type: "focus",
    });
  };

  const stop = async (completed: boolean) => {
    setRunning(false);
    const actual = Math.max(1, Math.round((planned * 60 - remaining) / 60));
    if (startedRef.current) {
      await saveSession(actual, completed);
      startedRef.current = false;
    }
    setRemaining(planned * 60);
  };

  const start = () => {
    startedRef.current = true;
    setRunning(true);
  };

  const pct = planned > 0 ? (planned * 60 - remaining) / (planned * 60) : 0;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  const todaySessions = (sessions ?? []).filter((s) => s.date === tKey);
  const todayMinutes = todaySessions.reduce((n, s) => n + s.actualMinutes, 0);
  const weekStart = weekStartKey(tKey);
  const weekMinutes = (sessions ?? []).filter((s) => s.date >= weekStart && s.date <= tKey).reduce((n, s) => n + s.actualMinutes, 0);

  return (
    <div className="space-y-5">
      {/* Distraction-free timer */}
      <section className="ui-surface ui-accent-top rounded-2xl p-6 text-center md:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">حالت تمرکز</p>

        <div className="relative mx-auto mt-5 grid size-48 place-items-center">
          <svg viewBox="0 0 100 100" className="size-48 -rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" stroke="var(--muted)" strokeWidth="7" />
            <circle
              cx="50" cy="50" r="44" fill="none" stroke="url(#focusGrad)" strokeWidth="7" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 44}
              strokeDashoffset={2 * Math.PI * 44 * (1 - pct)}
              style={{ transition: "stroke-dashoffset .5s linear" }}
            />
            <defs><linearGradient id="focusGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#3b82f6" /></linearGradient></defs>
          </svg>
          <div>
            <div className="text-4xl font-extrabold tabular-nums">{mm}:{ss}</div>
            <div className="mt-1 text-xs text-muted-foreground">{toFa(planned)} دقیقه</div>
          </div>
        </div>

        {selected && (
          <p className="mt-4 text-sm font-bold">
            <Timer className="inline size-3.5 text-violet-600" /> {selected.title}
          </p>
        )}

        <div className="mt-5 flex justify-center gap-2">
          {FOCUS_PRESETS.map((m) => (
            <button
              key={m}
              disabled={running}
              onClick={() => { setPlanned(m); setRemaining(m * 60); setRunning(false); startedRef.current = false; }}
              className={cn("rounded-xl px-3 py-1.5 text-xs font-bold transition-all disabled:opacity-50", planned === m ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:bg-muted")}
            >
              {toFa(m)}′
            </button>
          ))}
        </div>

        <div className="mt-4 flex justify-center gap-2">
          {!running ? (
            <Button onClick={start}><Play className="size-4" />شروع تمرکز</Button>
          ) : (
            <Button variant="secondary" onClick={() => setRunning(false)}><Pause className="size-4" />مکث</Button>
          )}
          {(running || remaining < planned * 60) && (
            <Button variant="ghost" onClick={() => stop(remaining === 0)}><RotateCcw className="size-4" />پایان و ذخیره</Button>
          )}
        </div>

        <div className="mx-auto mt-5 max-w-sm text-right">
          <label className="mb-1 block text-[11px] font-bold text-muted-foreground">کار مرتبط (اختیاری)</label>
          <Select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            <option value="">بدون کار خاص</option>
            {openTasks.slice(0, 30).map((t) => <option key={t._id} value={t._id}>{t.title}</option>)}
          </Select>
        </div>
      </section>

      {/* Session stats + history */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="ui-surface rounded-2xl p-4 text-center">
          <div className="text-2xl font-extrabold tabular-nums text-violet-600">{toFa(todayMinutes)}′</div>
          <div className="text-xs text-muted-foreground">تمرکز امروز</div>
        </div>
        <div className="ui-surface rounded-2xl p-4 text-center">
          <div className="text-2xl font-extrabold tabular-nums text-blue-600">{toFa(weekMinutes)}′</div>
          <div className="text-xs text-muted-foreground">تمرکز این هفته</div>
        </div>
      </div>

      <SectionCard title="جلسات اخیر" icon={Clock}>
        {todaySessions.length === 0 && (sessions ?? []).length === 0 ? (
          <EmptyState icon={Timer} title="هنوز جلسه تمرکزی نداری" description="یک جلسه تمرکز شروع کن تا زمان تمرکزت ثبت و پیگیری شود." />
        ) : (
          <ul className="divide-y divide-border/50">
            {[...(sessions ?? [])].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8).map((s) => (
              <li key={s._id} className="flex items-center justify-between px-4 py-2.5 text-xs">
                <span className="min-w-0 truncate font-bold">{s.title ?? "تمرکز آزاد"}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">{toFa(s.actualMinutes)}′ / {toFa(s.plannedMinutes)}′ · {toFa(s.date)}</span>
                <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 font-bold", s.completed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10" : "bg-muted text-muted-foreground")}>
                  {s.completed ? "کامل" : "ناقص"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

/* ================================================================== */
/*  PROGRESS — purposeful personal analytics                           */
/* ================================================================== */

function ProgressTab() {
  const tKey = todayKey();
  const { tasks } = useWorkspace();
  const habits = useQuery(api.personal.habitsState, { day: tKey });
  const goals = useQuery(api.personal.listGoals);
  const sessions = useQuery(api.employee.listFocusSessions);
  const areas = useQuery(api.personal.listLifeAreas);
  const notes = useQuery(api.personal.listNotes);

  const root = tasks.filter((t) => !t.parentId && t.status !== "inbox");
  const allToday = root.filter((t) => t.dueDate === tKey);
  const todayPct = allToday.length ? Math.round((allToday.filter((t) => t.status === "done").length / allToday.length) * 100) : 0;

  const weekStart = weekStartKey(tKey);
  const days = [...Array(7)].map((_, i) => shiftKey(weekStart, i)).filter((d) => d <= tKey);
  const dayStats = days.map((d) => {
    const planned = root.filter((t) => t.dueDate === d);
    const done = planned.filter((t) => t.status === "done");
    return { day: d, planned: planned.length, done: done.length };
  });
  const activeDays = dayStats.filter((d) => d.done > 0).length;
  const weekConsistency = days.length ? Math.round((activeDays / days.length) * 100) : 0;

  const activeGoals = (goals ?? []).filter((g) => g.status === "active");
  const avgGoal = activeGoals.length ? Math.round(activeGoals.reduce((n, g) => n + g.progress, 0) / activeGoals.length) : 0;

  const habitList = habits ?? [];
  const habitConsistency = habitList.length
    ? Math.round((habitList.reduce((n, h) => n + Math.min(1, h.weekDone / (h.frequency === "daily" ? 7 : h.target)), 0) / habitList.length) * 100)
    : 0;

  const weekStartMs = Date.parse(weekStart);
  const focusWeek = (sessions ?? []).filter((s) => s.date >= weekStart && s.date <= tKey).reduce((n, s) => n + s.actualMinutes, 0);

  // Life-area distribution (where attention goes) — from linked goals/habits/notes
  const areaDist = (areas ?? [])
    .filter((a) => !a.archived)
    .map((a) => ({
      name: a.name,
      color: a.color,
      count:
        (goals ?? []).filter((g) => g.lifeAreaId === a._id).length +
        (habitList.filter((h) => h.lifeAreaId === a._id).length) +
        (notes ?? []).filter((n) => n.lifeAreaId === a._id).length,
    }))
    .filter((a) => a.count > 0)
    .sort((a, b) => b.count - a.count);
  const areaMax = Math.max(1, ...areaDist.map((a) => a.count));

  void weekStartMs;

  return (
    <div className="space-y-5">
      {/* Summary metrics — each answers a real question */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { q: "امروز را چقدر انجام دادم؟", value: `${toFa(todayPct)}٪`, icon: CheckCircle2, color: "text-emerald-600" },
          { q: "این هفته چقدر منظم بودم؟", value: `${toFa(weekConsistency)}٪`, icon: Activity, color: "text-blue-600" },
          { q: "اهدافم چقدر جلو رفته؟", value: `${toFa(avgGoal)}٪`, icon: Target, color: "text-primary" },
          { q: "روی عادت‌هام استمرار دارم؟", value: `${toFa(habitConsistency)}٪`, icon: Flame, color: "text-amber-600" },
        ].map((m) => (
          <div key={m.q} className="ui-surface rounded-2xl p-4">
            <m.icon className={cn("mb-2 size-4", m.color)} />
            <div className="text-xl font-extrabold tabular-nums">{m.value}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{m.q}</div>
          </div>
        ))}
      </div>

      {/* Weekly consistency chart — planned vs done */}
      <SectionCard title="کارهای این هفته (انجام‌شده نسبت به برنامه)" icon={TrendingUp}>
        <div className="flex items-end justify-between gap-2 p-4" style={{ height: 160 }}>
          {dayStats.map((d) => {
            const h = d.planned ? Math.round((d.done / d.planned) * 100) : 0;
            return (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[10px] font-bold tabular-nums text-muted-foreground">{d.done}/{d.planned}</span>
                <div className="relative w-full max-w-10 flex-1 overflow-hidden rounded-lg bg-muted">
                  <div className="absolute bottom-0 w-full rounded-lg bg-gradient-to-t from-primary to-blue-400 transition-all duration-500" style={{ height: `${h}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground">{toFa(new Date(`${d.day}T00:00:00`).toLocaleDateString("en", { weekday: "short" }))}</span>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Where does my attention go? */}
        {areaDist.length > 0 && (
          <SectionCard title="توجه من کجا می‌رود؟" icon={Heart}>
            <div className="space-y-3 p-4">
              {areaDist.map((a) => (
                <div key={a.name}>
                  <div className="flex items-center justify-between text-xs"><span className="font-bold">{a.name}</span><span className="tabular-nums text-muted-foreground">{toFa(a.count)} مورد</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${(a.count / areaMax) * 100}%`, background: a.color }} />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Focus trend */}
        <SectionCard title="تمرکز" icon={Timer}>
          <div className="grid grid-cols-2 gap-3 p-4">
            <div className="rounded-xl border border-border/60 p-3 text-center">
              <div className="text-lg font-extrabold tabular-nums text-violet-600">{toFa(focusWeek)}′</div>
              <div className="text-[11px] text-muted-foreground">این هفته</div>
            </div>
            <div className="rounded-xl border border-border/60 p-3 text-center">
              <div className="text-lg font-extrabold tabular-nums text-violet-600">{toFa((sessions ?? []).length)}</div>
              <div className="text-[11px] text-muted-foreground">کل جلسات</div>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Goal progress list */}
      {activeGoals.length > 0 && (
        <SectionCard title="کدام اهداف جلو می‌روند؟" icon={Target}>
          <div className="space-y-3 p-4">
            {activeGoals.map((g) => (
              <div key={g._id}>
                <div className="flex items-center justify-between text-xs"><span className="truncate font-bold">{g.title}</span><span className="font-extrabold tabular-nums">{toFa(g.progress)}٪</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-l from-primary to-blue-500" style={{ width: `${g.progress}%` }} /></div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Gamification snapshot lives here — not on the dashboard */}
      <ProgressSnapshot />
      <ActivePathsStrip />
    </div>
  );
}

/* ================================================================== */
/*  REVIEWS — daily / weekly / monthly reflection                      */
/* ================================================================== */

type ReviewType = "daily" | "weekly" | "monthly";

function ReviewsTab() {
  const tKey = todayKey();
  const [type, setType] = useState<ReviewType>("daily");
  const reviews = useQuery(api.personal.listReviews, {});
  const saveReview = useMutation(api.personal.saveReview);
  const deleteReview = useMutation(api.personal.deleteReview);

  const periodKey = type === "daily" ? tKey : type === "weekly" ? weekStartKey(tKey) : tKey.slice(0, 7);

  const existing = (reviews ?? []).find((r) => r.type === type && r.periodKey === periodKey);
  const [form, setForm] = useState({ completedWork: "", remainingWork: "", wentWell: "", focusNext: "" });
  const [loadedKey, setLoadedKey] = useState("");
  const [saved, setSaved] = useState(false);

  // Prefill from existing review when period changes (no conditional hooks).
  const prefillKey = `${type}:${periodKey}:${existing?.updatedAt ?? "none"}`;
  useEffect(() => {
    if (prefillKey !== loadedKey) {
      setForm({
        completedWork: existing?.completedWork ?? "",
        remainingWork: existing?.remainingWork ?? "",
        wentWell: existing?.wentWell ?? "",
        focusNext: existing?.focusNext ?? "",
      });
      setLoadedKey(prefillKey);
      setSaved(false);
    }
  }, [prefillKey, loadedKey, existing]);

  const FIELDS: { key: keyof typeof form; label: string; placeholder: string }[] = [
    { key: "completedWork", label: "چه چیزهایی انجام شد؟", placeholder: "کارهای تکمیل‌شده…" },
    { key: "remainingWork", label: "چه چیزهایی باقی ماند؟", placeholder: "باقی‌مانده برای بعد…" },
    { key: "wentWell", label: "چه چیزی خوب پیش رفت؟", placeholder: "نکات مثبت…" },
    { key: "focusNext", label: "بعد روی چه چیزی تمرکز کنم؟", placeholder: "اولویت بعدی…" },
  ];

  const TYPES: { key: ReviewType; label: string }[] = [
    { key: "daily", label: "روزانه" },
    { key: "weekly", label: "هفتگی" },
    { key: "monthly", label: "ماهانه" },
  ];

  const recent = (reviews ?? []).filter((r) => !(r.type === type && r.periodKey === periodKey)).slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold"><ClipboardCheck className="size-4 text-emerald-600" />بازتاب‌ها</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">مرور سبک و کاربردی — نه فرم طولانی</p>
        </div>
        <div className="flex gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              className={cn("rounded-xl px-3 py-1.5 text-xs font-bold transition-all", type === t.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/60 text-muted-foreground hover:bg-muted")}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ui-surface space-y-3 rounded-2xl p-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="mb-1 block text-xs font-bold">{f.label}</label>
            <Textarea rows={2} placeholder={f.placeholder} value={form[f.key]} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} />
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={async () => {
              await saveReview({ type, periodKey, ...form });
              setSaved(true);
            }}
          >
            <CheckCircle2 className="size-3.5" />{existing ? "به‌روزرسانی" : "ذخیره بازتاب"}
          </Button>
          {saved && <span className="text-xs font-bold text-emerald-600">ذخیره شد ✓</span>}
        </div>
      </div>

      {recent.length > 0 && (
        <SectionCard title="بازتاب‌های اخیر" icon={BookOpen}>
          <ul className="divide-y divide-border/50">
            {recent.map((r) => (
              <li key={r._id} className="flex items-start justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold">
                    {r.type === "daily" ? "روزانه" : r.type === "weekly" ? "هفتگی" : "ماهانه"} · {toFa(r.periodKey)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.completedWork || r.wentWell || "—"}</p>
                </div>
                <button onClick={() => deleteReview({ id: r._id })} className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"><Trash2 className="size-3.5" /></button>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

/* ================================================================== */
/*  NOTES                                                              */
/* ================================================================== */

function NotesTab() {
  const notes = useQuery(api.personal.listNotes);
  const areas = useQuery(api.personal.listLifeAreas);
  const createNote = useMutation(api.personal.createNote);
  const updateNote = useMutation(api.personal.updateNote);
  const deleteNote = useMutation(api.personal.deleteNote);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [areaId, setAreaId] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [q, setQ] = useState("");

  const list = (notes ?? []).filter(
    (n) => !q || n.title.includes(q) || n.body.includes(q),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold"><StickyNote className="size-4 text-amber-600" />یادداشت‌ها</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">یادداشت‌های شخصی — ساده، بدون پیچیدگی</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="جستجو…" value={q} onChange={(e) => setQ(e.target.value)} className="w-36 py-1.5 pr-8 text-xs" />
          </div>
          <Button size="sm" onClick={() => setAdding((v) => !v)}><Plus className="size-3.5" />یادداشت</Button>
        </div>
      </div>

      {adding && (
        <div className="ui-surface space-y-3 rounded-2xl p-4">
          <Input placeholder="عنوان" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="متن یادداشت…" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex gap-2">
            <Select value={areaId} onChange={(e) => setAreaId(e.target.value)} className="max-w-48">
              <option value="">بدون حوزه</option>
              {(areas ?? []).filter((a) => !a.archived).map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </Select>
            <Button
              size="sm"
              disabled={!title.trim()}
              onClick={async () => {
                await createNote({ title: title.trim(), body, lifeAreaId: (areaId || undefined) as Id<"lifeAreas"> | undefined, tags: [] });
                setTitle(""); setBody(""); setAreaId(""); setAdding(false);
              }}
            >
              ذخیره
            </Button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <SectionCard title="یادداشت‌ها" icon={StickyNote}>
          <EmptyState
            icon={StickyNote}
            title="هنوز یادداشتی نداری"
            description="یادداشت‌ها برای فکرها و نکات کوتاه‌اند — می‌توانند به حوزه‌ها و اهداف متصل شوند."
            action={<Button size="sm" onClick={() => setAdding(true)}><Plus className="size-3.5" />اولین یادداشت</Button>}
          />
        </SectionCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((n) => {
            const area = (areas ?? []).find((a) => a._id === n.lifeAreaId);
            return (
              <div key={n._id} className="ui-surface flex flex-col rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold">{n.title}</p>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => { setEditing(editing === n._id ? null : n._id); setEditBody(n.body); }} className="text-muted-foreground transition-colors hover:text-primary"><Pencil className="size-3.5" /></button>
                    <button onClick={() => deleteNote({ id: n._id })} className="text-muted-foreground transition-colors hover:text-destructive"><Trash2 className="size-3.5" /></button>
                  </div>
                </div>
                {editing === n._id ? (
                  <div className="mt-2 space-y-2">
                    <Textarea rows={4} value={editBody} onChange={(e) => setEditBody(e.target.value)} />
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-7 px-2 text-[11px]" onClick={async () => { await updateNote({ id: n._id, body: editBody }); setEditing(null); }}>ذخیره</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => setEditing(null)}>انصراف</Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 flex-1 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{n.body || "—"}</p>
                )}
                {area && (
                  <span className="mt-2 w-fit rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${area.color}22`, color: area.color }}>{area.name}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  MAIN PERSONAL PRODUCTIVITY WORKSPACE                               */
/* ================================================================== */

type TabKey =
  | "dashboard" | "today" | "inbox" | "tasks" | "projects"
  | "areas" | "goals" | "routines" | "habits"
  | "blocks" | "focus"
  | "progress" | "reviews" | "notes";

const TAB_GROUPS: { label: string; tabs: { key: TabKey; label: string; icon: React.FC<{ className?: string }> }[] }[] = [
  {
    label: "هسته",
    tabs: [
      { key: "dashboard", label: "داشبورد", icon: LayoutDashboard },
      { key: "today", label: "امروز", icon: Sun },
      { key: "inbox", label: "صندوق", icon: InboxIcon },
      { key: "tasks", label: "وظایف", icon: ListChecks },
      { key: "projects", label: "پروژه‌ها", icon: FolderKanban },
    ],
  },
  {
    label: "زندگی",
    tabs: [
      { key: "areas", label: "حوزه‌ها", icon: Heart },
      { key: "goals", label: "اهداف", icon: Target },
      { key: "routines", label: "روتین‌ها", icon: Repeat },
      { key: "habits", label: "عادات", icon: Flame },
    ],
  },
  {
    label: "اجرا",
    tabs: [
      { key: "blocks", label: "بلوک زمانی", icon: CalendarClock },
      { key: "focus", label: "تمرکز", icon: Timer },
    ],
  },
  {
    label: "بازتاب",
    tabs: [
      { key: "progress", label: "پیشرفت", icon: TrendingUp },
      { key: "reviews", label: "بازتاب", icon: ClipboardCheck },
      { key: "notes", label: "یادداشت", icon: StickyNote },
    ],
  },
];

export function PersonalWorkspace() {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const goTab = (t: TabKey) => setActiveTab(t);

  return (
    <WorkspaceLayout>
      {/* Grouped navigation: Core → Life → Execution → Reflection */}
      <nav className="-mx-1 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1 px-1 pb-1">
          {TAB_GROUPS.map((g, gi) => (
            <div key={g.label} className="flex items-center gap-1">
              {gi > 0 && <span className="mx-1 h-5 w-px shrink-0 bg-border/60" />}
              <span className="hidden shrink-0 px-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground md:inline">{g.label}</span>
              {g.tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition-all",
                    activeTab === tab.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <tab.icon className="size-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </nav>

      {activeTab === "dashboard" && <DashboardTab goTab={goTab} />}
      {activeTab === "today" && <TodayTab />}
      {activeTab === "inbox" && <InboxTab />}
      {activeTab === "tasks" && <TasksTab />}
      {activeTab === "projects" && <ProjectsTab />}
      {activeTab === "areas" && <LifeAreasTab />}
      {activeTab === "goals" && <GoalsTab />}
      {activeTab === "routines" && <RoutinesTab />}
      {activeTab === "habits" && <HabitsTab />}
      {activeTab === "blocks" && <TimeBlocksTab />}
      {activeTab === "focus" && <FocusTab />}
      {activeTab === "progress" && <ProgressTab />}
      {activeTab === "reviews" && <ReviewsTab />}
      {activeTab === "notes" && <NotesTab />}
    </WorkspaceLayout>
  );
}
