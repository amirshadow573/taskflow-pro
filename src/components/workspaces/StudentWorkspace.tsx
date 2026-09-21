import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { useAuth } from "@/hooks/use-auth";
import { TaskRow } from "@/components/tasks/TaskRow";
import { SmartTaskInput } from "@/components/tasks/SmartTaskInput";
import { ProgressSnapshot } from "@/components/progress/ProgressSnapshot";
import { TodayRoutines } from "@/components/workspace/TodayRoutines";
import { WorkspaceLayout } from "./WorkspaceLayout";
import { Button } from "@/components/ui/button";
import { toFa } from "@/lib/persian";
import { todayKey, isOverdue } from "@/lib/task-utils";
import { Link } from "react-router";
import {
  ArrowLeft, BookOpen, Calculator, Clock, GraduationCap, ListChecks,
  Loader, Plus, Target, Timer, TriangleAlert, BookMarked, CheckCircle2, Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";

/* ------------------------------------------------------------------ */
/* Mock data — will be replaced by Convex queries in Phase 3            */
/* ------------------------------------------------------------------ */

const MOCK_SUBJECTS = [
  { name: "ریاضی", progress: 72, hours: "۸ ساعت و ۴۰ دقیقه", tasks: 4, color: "bg-blue-500" },
  { name: "فیزیک", progress: 58, hours: "۶ ساعت و ۱۵ دقیقه", tasks: 3, color: "bg-violet-500" },
  { name: "زیست‌شناسی", progress: 85, hours: "۱۱ ساعت", tasks: 2, color: "bg-emerald-500" },
  { name: "شیمی", progress: 45, hours: "۵ ساعت", tasks: 6, color: "bg-amber-500" },
];

const MOCK_EXAMS = [
  { subject: "ریاضی", date: "۱۴۰۴/۰۸/۱۵", daysLeft: 12, prep: 78, importance: "high" },
  { subject: "فیزیک", date: "۱۴۰۴/۰۸/۲۲", daysLeft: 19, prep: 45, importance: "medium" },
  { subject: "شیمی", date: "۱۴۰۴/۰۹/۰۱", daysLeft: 30, prep: 20, importance: "low" },
];

const MOCK_FAVORITE_SUBJECTS: Record<string, string> = {
  student: "درس و مطالعه",
};

/* ------------------------------------------------------------------ */
/* Grade Calculator                                                    */
/* ------------------------------------------------------------------ */

function GradeCalculator() {
  const [grades, setGrades] = useState([
    { name: "ترم ۱", grade: 16, weight: 30 },
    { name: "ترم ۲", grade: 17.5, weight: 30 },
    { name: "ترم ۳", grade: 0, weight: 40 },
  ]);

  const weightedSum = grades.reduce((sum, g) => sum + (g.grade * g.weight) / 100, 0);
  const totalWeight = grades.reduce((sum, g) => sum + (g.grade > 0 ? g.weight : 0), 0);
  const currentAvg = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;

  return (
    <div className="ui-surface rounded-2xl p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
        <span className="ui-icon-tile size-6"><Calculator className="size-3.5 text-primary" /></span>
        ماشین حساب معدل
      </h3>
      <div className="space-y-2">
        {grades.map((g, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-20 truncate text-xs font-semibold text-muted-foreground">{g.name}</span>
            <input
              type="number" min={0} max={20} step={0.5}
              value={g.grade || ""}
              onChange={(e) => {
                const v = parseFloat(e.target.value) || 0;
                setGrades((prev) => prev.map((x, j) => j === i ? { ...x, grade: Math.min(20, Math.max(0, v)) } : x));
              }}
              className="w-16 rounded-lg border border-border/60 bg-background px-2 py-1.5 text-center text-xs font-bold"
              placeholder="نمره"
            />
            <span className="text-[10px] text-muted-foreground">{toFa(g.weight)}٪</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-primary/5 p-3">
        <span className="text-xs font-bold text-muted-foreground">معدل فعلی</span>
        <span className="text-lg font-extrabold text-primary tabular-nums">{toFa(Math.round(currentAvg * 10) / 10)}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Study Focus Timer                                                    */
/* ------------------------------------------------------------------ */

function StudyFocusTimer() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const start = () => {
    setRunning(true);
    const iv = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    // Store interval for cleanup
    (window as any).__studyTimer = iv;
  };
  const stop = () => {
    setRunning(false);
    clearInterval((window as any).__studyTimer);
  };
  const reset = () => { stop(); setElapsed(0); };

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <div className="ui-surface rounded-2xl p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
        <span className="ui-icon-tile size-6"><Timer className="size-3.5 text-primary" /></span>
        تایمر تمرکز مطالعه
      </h3>
      <div className="flex flex-col items-center gap-3">
        <span className="text-4xl font-black tabular-nums text-foreground">{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}</span>
        <div className="flex gap-2">
          {!running ? (
            <Button size="sm" onClick={start}><Timer className="size-3.5" />شروع</Button>
          ) : (
            <Button size="sm" variant="destructive" onClick={stop}><TriangleAlert className="size-3.5" />توقف</Button>
          )}
          <Button size="sm" variant="ghost" onClick={reset}>بازنشانی</Button>
        </div>
        <p className="text-[10px] text-muted-foreground">امروز: {toFa(Math.floor(elapsed / 60))} دقیقه مطالعه</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Student Workspace                                                    */
/* ------------------------------------------------------------------ */

export function StudentWorkspace() {
  const { tasks, projects, toggleDone, deleteTask, openTask, createTask } = useWorkspace();
  const tKey = todayKey();
  const root = tasks.filter((t) => !t.parentId);
  const todayTasks = root.filter((t) => t.dueDate === tKey && t.status !== "done");
  const overdue = root.filter((t) => isOverdue(t));
  const allToday = root.filter((t) => t.dueDate === tKey);
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
      {/* ── Student Stats ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "درس‌های فعال", value: MOCK_SUBJECTS.length, icon: BookOpen, color: "text-blue-600" },
          { label: "امتحانات پیش رو", value: MOCK_EXAMS.length, icon: GraduationCap, color: "text-violet-600" },
          { label: "کارهای امروز", value: allToday.length, icon: ListChecks, color: "text-foreground" },
          { label: "نرخ تکمیل", value: `${toFa(pct)}٪`, icon: CheckCircle2, color: "text-emerald-600" },
        ].map((s) => (
          <div key={s.label} className="ui-surface rounded-2xl p-3 text-center">
            <s.icon className={`mx-auto mb-1 size-5 ${s.color}`} />
            <div className="text-lg font-extrabold tabular-nums">{typeof s.value === "number" ? toFa(s.value) : s.value}</div>
            <div className="text-[10px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Upcoming Exams ── */}
      <section className="ui-surface rounded-2xl p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <span className="ui-icon-tile size-6"><GraduationCap className="size-3.5 text-violet-600" /></span>
          امتحانات پیش رو
        </h3>
        <div className="space-y-3">
          {MOCK_EXAMS.map((ex) => (
            <div key={ex.subject} className="rounded-xl border border-border/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">{ex.subject}</span>
                <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                  ex.importance === "high" ? "bg-red-100 text-red-700" : ex.importance === "medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                }`}>
                  {toFa(ex.daysLeft)} روز مانده
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-to-l from-primary to-violet-500" style={{ width: `${ex.prep}%` }} />
                </div>
                <span className="text-[10px] font-bold tabular-nums">{toFa(ex.prep)}٪</span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">آماده‌سازی امتحان</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Subject Progress ── */}
      <section className="ui-surface rounded-2xl p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <span className="ui-icon-tile size-6"><BookMarked className="size-3.5 text-blue-600" /></span>
          پیشرفت دروس
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {MOCK_SUBJECTS.map((s) => (
            <div key={s.name} className="rounded-xl border border-border/60 p-3">
              <div className="flex items-center gap-2">
                <span className={`size-2.5 rounded-full ${s.color}`} />
                <span className="text-sm font-bold">{s.name}</span>
                <span className="ms-auto text-xs font-bold tabular-nums">{toFa(s.progress)}٪</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${s.progress}%`, background: `linear-gradient(90deg, ${s.color.replace("bg-", "")})` }} />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>زمان مطالعه: {s.hours}</span>
                <span>{toFa(s.tasks)} کار</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Focus + Grade Calc ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StudyFocusTimer />
        <GradeCalculator />
      </div>

      <SmartTaskInput onCreate={(p) => createTask({ title: p.title, dueDate: p.dueDate, dueTime: p.dueTime, priority: p.priority, tags: p.tags })} />

      {/* Today's tasks */}
      <section className="ui-surface overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-bold"><span className="ui-icon-tile size-6"><ListChecks className="size-3.5 text-primary" /></span>کارهای امروز</h2>
          <Link to="/today"><Button variant="ghost" size="sm">همه<ArrowLeft className="size-3.5" /></Button></Link>
        </div>
        {allToday.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm font-semibold">برنامه مطالعه امروز خالی است!</p>
            <p className="mt-1 text-xs text-muted-foreground">با افزودن کارهای درسی، برنامه خود را بسازید.</p>
          </div>
        ) : (
          <ul>{allToday.map((t: any) => <TaskRow key={t._id} task={t} project={projectOf(t.projectId)} subtaskTotal={subtotals.get(t._id)?.total} subtaskDone={subtotals.get(t._id)?.done} onToggle={(done) => toggleDone(t, done)} onOpen={() => openTask(t._id)} onDelete={() => deleteTask(t._id)} />)}</ul>
        )}
      </section>

      <ProgressSnapshot />
      <TodayRoutines />
    </WorkspaceLayout>
  );
}
