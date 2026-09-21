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
  ArrowLeft, Building2, CheckCircle2, Clock, FolderKanban, ListChecks, Plus, Timer, TriangleAlert, Zap,
} from "lucide-react";
import { useMemo, useState } from "react";

const MOCK_CLIENTS = [
  { name: "شرکت فناوری آریا", projects: 2, deadline: "۱۴۰۴/۰۸/۲۰", status: "active" },
  { name: "استارتاپ نوآوران", projects: 1, deadline: "۱۴۰۴/۰۹/۰۵", status: "active" },
  { name: "فروشگاه دیجی‌کالا", projects: 1, deadline: "۱۴۰۴/۰۷/۳۰", status: "urgent" },
];

export function FreelancerWorkspace() {
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

  // Focus timer
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const startTimer = () => {
    setTimerRunning(true);
    (window as any).__freelancerTimer = setInterval(() => setTimerElapsed((e) => e + 1), 1000);
  };
  const stopTimer = () => { setTimerRunning(false); clearInterval((window as any).__freelancerTimer); };
  const timerMins = Math.floor(timerElapsed / 60);
  const timerSecs = timerElapsed % 60;

  return (
    <WorkspaceLayout>
      {/* ── Freelancer Stats ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "مشتریان فعال", value: MOCK_CLIENTS.filter((c) => c.status !== "completed").length, icon: Building2, color: "text-blue-600" },
          { label: "پروژه‌های فعال", value: projects.length, icon: FolderKanban, color: "text-violet-600" },
          { label: "ددلاین‌ها", value: overdue.length, icon: TriangleAlert, color: "text-red-600" },
          { label: "زمان امروز", value: `${toFa(timerMins)}د`, icon: Clock, color: "text-emerald-600" },
        ].map((s) => (
          <div key={s.label} className="ui-surface rounded-2xl p-3 text-center">
            <s.icon className={`mx-auto mb-1 size-5 ${s.color}`} />
            <div className="text-lg font-extrabold tabular-nums">{typeof s.value === "number" ? toFa(s.value) : s.value}</div>
            <div className="text-[10px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Clients + Time Tracking ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Clients */}
        <section className="ui-surface rounded-2xl p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <span className="ui-icon-tile size-6"><Building2 className="size-3.5 text-blue-600" /></span>
            مشتریان
          </h3>
          <div className="space-y-2">
            {MOCK_CLIENTS.map((c) => (
              <div key={c.name} className="flex items-center gap-3 rounded-xl border border-border/60 p-2.5">
                <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{c.name[0]}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-xs font-bold">{c.name}</span>
                    <span className={`text-[9px] font-bold rounded-full px-1.5 py-0.5 ${c.status === "urgent" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {c.status === "urgent" ? "فوری" : "فعال"}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{toFa(c.projects)} پروژه</span>
                    <span>ددلاین: {c.deadline}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Button size="sm" variant="ghost" className="mt-2 w-full"><Plus className="size-3.5" />مشتری جدید</Button>
        </section>

        {/* Time Tracking */}
        <section className="ui-surface rounded-2xl p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <span className="ui-icon-tile size-6"><Timer className="size-3.5 text-emerald-600" /></span>
            پیگیری زمان
          </h3>
          <div className="flex flex-col items-center gap-3 py-2">
            <span className="text-4xl font-black tabular-nums">{String(timerMins).padStart(2, "0")}:{String(timerSecs).padStart(2, "0")}</span>
            <div className="flex gap-2">
              {!timerRunning ? (
                <Button size="sm" onClick={startTimer}><Zap className="size-3.5" />شروع</Button>
              ) : (
                <Button size="sm" variant="destructive" onClick={stopTimer}>توقف</Button>
              )}
            </div>
          </div>
          <div className="mt-3 space-y-1.5 text-[10px] text-muted-foreground">
            <div className="flex justify-between"><span>ساعت امروز</span><span className="font-bold">{toFa(timerMins)} دقیقه</span></div>
            <div className="flex justify-between"><span>ساعت این هفته</span><span className="font-bold">{toFa(timerMins + 180)} دقیقه</span></div>
            <div className="flex justify-between"><span>میانگین روزانه</span><span className="font-bold">{toFa(4.5)} ساعت</span></div>
          </div>
        </section>
      </div>

      {/* ── Active Projects (prominent for freelancers) ── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold">پروژه‌های فعال مشتری</h2>
          <Link to="/projects"><Button variant="ghost" size="sm">همه پروژه‌ها<ArrowLeft className="size-3.5" /></Button></Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.slice(0, 3).map((p) => {
            const pts = tasks.filter((t) => t.projectId === p._id && !t.parentId);
            const doneN = pts.filter((t) => t.status === "done").length;
            const pctP = pts.length ? Math.round((doneN / pts.length) * 100) : 0;
            return (
              <Link key={p._id} to={`/projects/${p._id}`}>
                <div className="ui-surface ui-surface-hover h-full rounded-2xl p-4">
                  <div className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: p.color }} /><span className="truncate text-sm font-bold">{p.name}</span></div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${pctP}%`, background: `linear-gradient(90deg, ${p.color}, ${p.color}bb)`, boxShadow: `0 0 12px -3px ${p.color}` }} /></div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground"><span>{toFa(doneN)} از {toFa(pts.length)} کار</span><span className="font-bold" style={{ color: p.color }}>{toFa(pctP)}٪</span></div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

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
