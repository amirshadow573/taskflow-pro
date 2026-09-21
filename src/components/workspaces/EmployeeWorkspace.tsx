import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { TaskRow } from "@/components/tasks/TaskRow";
import { SmartTaskInput } from "@/components/tasks/SmartTaskInput";
import { ProgressSnapshot } from "@/components/progress/ProgressSnapshot";
import { WorkspaceLayout } from "./WorkspaceLayout";
import { Button } from "@/components/ui/button";
import { toFa } from "@/lib/persian";
import { todayKey, isOverdue } from "@/lib/task-utils";
import { Link } from "react-router";
import {
  ArrowLeft, Calendar, CheckCircle2, Clock, ListChecks, Plus, Target, TriangleAlert, Users, Zap,
} from "lucide-react";
import { useMemo } from "react";

const MOCK_MEETINGS = [
  { title: "جلسه بررسی پروژه", time: "۱۰:۰۰", duration: "۴۵ دقیقه", type: "team" },
  { title: "جلسه با مشتری", time: "۱۴:۰۰", duration: "۱ ساعت", type: "client" },
  { title: "بریفینگ صبح", time: "۰۸:۳۰", duration: "۱۵ دقیقه", type: "daily" },
];

const MOCK_WORK_GOALS = [
  { title: "تکمیل گزارش فصلی", progress: 70, deadline: "۱۴۰۴/۰۸/۲۵" },
  { title: "آماده‌سازی ارائه مدیریت", progress: 40, deadline: "۱۴۰۴/۰۹/۰۱" },
];

export function EmployeeWorkspace() {
  const { tasks, projects, toggleDone, deleteTask, openTask, createTask } = useWorkspace();
  const tKey = todayKey();
  const root = tasks.filter((t) => !t.parentId);
  const allToday = root.filter((t) => t.dueDate === tKey && t.status !== "done");
  const overdue = root.filter((t) => isOverdue(t));
  const completed = allToday.filter((t) => t.status === "done").length;
  const pct = allToday.length ? Math.round((completed / allToday.length) * 100) : 0;

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
  const projectOf = (id?: string) => projects.find((p) => p._id === id);

  return (
    <WorkspaceLayout>
      {/* ── Work Stats ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "وظایف امروز", value: allToday.length, icon: ListChecks, color: "text-foreground" },
          { label: "انجام شده", value: completed, icon: CheckCircle2, color: "text-emerald-600" },
          { label: "جلسات", value: MOCK_MEETINGS.length, icon: Users, color: "text-blue-600" },
          { label: "عقب‌افتاده", value: overdue.length, icon: TriangleAlert, color: "text-red-600" },
        ].map((s) => (
          <div key={s.label} className="ui-surface rounded-2xl p-3 text-center">
            <s.icon className={`mx-auto mb-1 size-5 ${s.color}`} />
            <div className="text-lg font-extrabold tabular-nums">{toFa(s.value)}</div>
            <div className="text-[10px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Meetings ── */}
      <section className="ui-surface rounded-2xl p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <span className="ui-icon-tile size-6"><Users className="size-3.5 text-blue-600" /></span>
          جلسات امروز
        </h3>
        <div className="space-y-2">
          {MOCK_MEETINGS.map((m, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border/60 p-2.5">
              <div className={`grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold text-white ${
                m.type === "team" ? "bg-blue-500" : m.type === "client" ? "bg-violet-500" : "bg-emerald-500"
              }`}>
                <Calendar className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-bold">{m.title}</span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">{m.time} · {m.duration}</span>
              </div>
              <span className={`text-[9px] font-bold rounded-full px-1.5 py-0.5 ${
                m.type === "team" ? "bg-blue-100 text-blue-700" : m.type === "client" ? "bg-violet-100 text-violet-700" : "bg-emerald-100 text-emerald-700"
              }`}>
                {m.type === "team" ? "تیمی" : m.type === "client" ? "مشتری" : "روزانه"}
              </span>
            </div>
          ))}
        </div>
        <Button size="sm" variant="ghost" className="mt-2 w-full"><Plus className="size-3.5" />جلسه جدید</Button>
      </section>

      {/* ── Work Goals + Deadlines ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="ui-surface rounded-2xl p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <span className="ui-icon-tile size-6"><Target className="size-3.5 text-amber-600" /></span>
            اهداف کاری
          </h3>
          <div className="space-y-3">
            {MOCK_WORK_GOALS.map((g, i) => (
              <div key={i} className="rounded-xl border border-border/60 p-3">
                <p className="text-sm font-bold">{g.title}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gradient-to-l from-amber-500 to-primary" style={{ width: `${g.progress}%` }} />
                  </div>
                  <span className="text-[10px] font-bold tabular-nums">{toFa(g.progress)}٪</span>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">ددلاین: {g.deadline}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="ui-surface rounded-2xl p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <span className="ui-icon-tile size-6"><Clock className="size-3.5 text-red-600" /></span>
            ددلاین‌های مهم
          </h3>
          <div className="space-y-2">
            {overdue.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">ددلاین عقب‌افتاده‌ای وجود ندارد.</p>
            ) : (
              overdue.slice(0, 5).map((t: any) => (
                <div key={t._id} className="rounded-xl border border-red-200/60 bg-red-50/50 p-2.5 dark:border-red-500/20 dark:bg-red-500/5">
                  <span className="text-xs font-bold text-red-700 dark:text-red-300">{t.title}</span>
                  <span className="mt-0.5 block text-[10px] text-red-600/80">ددلاین: {t.dueDate}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <SmartTaskInput onCreate={(p) => createTask({ title: p.title, dueDate: p.dueDate, dueTime: p.dueTime, priority: p.priority, tags: p.tags })} />

      <section className="ui-surface overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-bold"><span className="ui-icon-tile size-6"><ListChecks className="size-3.5 text-primary" /></span>کارهای امروز</h2>
          <Link to="/today"><Button variant="ghost" size="sm">همه<ArrowLeft className="size-3.5" /></Button></Link>
        </div>
        {allToday.length === 0 ? (
          <div className="px-4 py-8 text-center"><p className="text-sm font-semibold">کاری برای امروز ثبت نشده.</p></div>
        ) : (
          <ul>{allToday.map((t: any) => <TaskRow key={t._id} task={t} project={projectOf(t.projectId)} subtaskTotal={subtotals.get(t._id)?.total} subtaskDone={subtotals.get(t._id)?.done} onToggle={(done) => toggleDone(t, done)} onOpen={() => openTask(t._id)} onDelete={() => deleteTask(t._id)} />)}</ul>
        )}
      </section>

      <ProgressSnapshot />
    </WorkspaceLayout>
  );
}
