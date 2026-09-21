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
  ArrowLeft, BarChart3, CheckCircle2, FolderKanban, ListChecks, Plus, Target, TrendingUp, TriangleAlert, Users, Zap,
} from "lucide-react";
import { useMemo } from "react";

const MOCK_TEAM = [
  { name: "علی", tasks: 12, projects: 3, completion: 82, color: "bg-blue-500" },
  { name: "سارا", tasks: 8, projects: 2, completion: 94, color: "bg-emerald-500" },
  { name: "رضا", tasks: 15, projects: 4, completion: 67, color: "bg-amber-500" },
  { name: "نیلوفر", tasks: 6, projects: 1, completion: 100, color: "bg-violet-500" },
  { name: "امیر", tasks: 10, projects: 2, completion: 71, color: "bg-rose-500" },
];

const MOCK_TEAM_GOALS = [
  { title: "تکمیل پروژه X تا پایان ماه", progress: 65, owner: "علی", deadline: "۱۴۰۴/۰۸/۳۰" },
  { title: "کاهش زمان پاسخ به مشتری", progress: 80, owner: "سارا", deadline: "۱۴۰۴/۰۹/۱۵" },
];

export function ManagerWorkspace() {
  const { tasks, projects, toggleDone, deleteTask, openTask, createTask } = useWorkspace();
  const tKey = todayKey();
  const root = tasks.filter((t) => !t.parentId);
  const allToday = root.filter((t) => t.dueDate === tKey);
  const overdue = root.filter((t) => isOverdue(t));
  const completed = allToday.filter((t) => t.status === "done").length;

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

  const totalTeamTasks = MOCK_TEAM.reduce((n, m) => n + m.tasks, 0);
  const avgCompletion = Math.round(MOCK_TEAM.reduce((n, m) => n + m.completion, 0) / MOCK_TEAM.length);

  return (
    <WorkspaceLayout>
      {/* ── Team Overview Stats ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "اعضای تیم", value: MOCK_TEAM.length, icon: Users, color: "text-blue-600" },
          { label: "کارهای فعال", value: totalTeamTasks, icon: ListChecks, color: "text-foreground" },
          { label: "نرخ تکمیل", value: `${toFa(avgCompletion)}٪`, icon: TrendingUp, color: "text-emerald-600" },
          { label: "مواعید عقب‌افتاده", value: overdue.length, icon: TriangleAlert, color: "text-red-600" },
        ].map((s) => (
          <div key={s.label} className="ui-surface rounded-2xl p-3 text-center">
            <s.icon className={`mx-auto mb-1 size-5 ${s.color}`} />
            <div className="text-lg font-extrabold tabular-nums">{typeof s.value === "number" ? toFa(s.value) : s.value}</div>
            <div className="text-[10px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Team Members + Workload ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Members */}
        <section className="ui-surface rounded-2xl p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <span className="ui-icon-tile size-6"><Users className="size-3.5 text-blue-600" /></span>
            اعضای تیم
          </h3>
          <div className="space-y-2">
            {MOCK_TEAM.map((m) => (
              <div key={m.name} className="flex items-center gap-3 rounded-xl border border-border/60 p-2.5">
                <div className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${m.color}`}>{m.name[0]}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{m.name}</span>
                    <span className="text-[10px] font-bold tabular-nums">{toFa(m.tasks)} کار · {toFa(m.projects)} پروژه</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${m.completion}%` }} />
                  </div>
                  <div className="mt-0.5 text-[9px] text-muted-foreground">{toFa(m.completion)}٪ تکمیل</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Team Goals */}
        <section className="ui-surface rounded-2xl p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <span className="ui-icon-tile size-6"><Target className="size-3.5 text-violet-600" /></span>
            اهداف تیم
          </h3>
          <div className="space-y-3">
            {MOCK_TEAM_GOALS.map((g, i) => (
              <div key={i} className="rounded-xl border border-border/60 p-3">
                <p className="text-sm font-bold">{g.title}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gradient-to-l from-violet-500 to-primary" style={{ width: `${g.progress}%` }} />
                  </div>
                  <span className="text-[10px] font-bold tabular-nums">{toFa(g.progress)}٪</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>مسئول: {g.owner}</span>
                  <span>ددلاین: {g.deadline}</span>
                </div>
              </div>
            ))}
          </div>
          <Button size="sm" variant="ghost" className="mt-3 w-full"><Plus className="size-3.5" />هدف جدید</Button>
        </section>
      </div>

      {/* ── Performance Overview ── */}
      <section className="ui-surface rounded-2xl p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <span className="ui-icon-tile size-6"><BarChart3 className="size-3.5 text-amber-600" /></span>
          عملکرد تیم
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {MOCK_TEAM.map((m) => (
            <div key={m.name} className="rounded-xl border border-border/60 p-2.5 text-center">
              <div className="text-lg font-extrabold tabular-nums">{toFa(m.completion)}٪</div>
              <div className="text-[10px] text-muted-foreground">{m.name}</div>
            </div>
          ))}
        </div>
      </section>

      <SmartTaskInput onCreate={(p) => createTask({ title: p.title, dueDate: p.dueDate, dueTime: p.dueTime, priority: p.priority, tags: p.tags })} />

      {/* Today's tasks */}
      <section className="ui-surface overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-bold"><span className="ui-icon-tile size-6"><ListChecks className="size-3.5 text-primary" /></span>وظایف امروز</h2>
          <Link to="/today"><Button variant="ghost" size="sm">همه<ArrowLeft className="size-3.5" /></Button></Link>
        </div>
        {allToday.length === 0 ? (
          <div className="px-4 py-8 text-center"><p className="text-sm font-semibold">وظیفه‌ای برای امروز ثبت نشده.</p></div>
        ) : (
          <ul>{allToday.map((t: any) => <TaskRow key={t._id} task={t} project={projectOf(t.projectId)} subtaskTotal={subtotals.get(t._id)?.total} subtaskDone={subtotals.get(t._id)?.done} onToggle={(done) => toggleDone(t, done)} onOpen={() => openTask(t._id)} onDelete={() => deleteTask(t._id)} />)}</ul>
        )}
      </section>

      <ProgressSnapshot />
    </WorkspaceLayout>
  );
}
