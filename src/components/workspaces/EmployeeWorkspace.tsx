import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { CapabilityGate } from "@/components/progress/UnlockCenter";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { TaskRow } from "@/components/tasks/TaskRow";
import { SmartTaskInput } from "@/components/tasks/SmartTaskInput";
import { WorkspaceLayout } from "./WorkspaceLayout";
import { CommandCenter } from "@/components/workspace/command/CommandCenter";
import { PersonaStatsStrip } from "@/components/progress/PersonaStats";
import { Button } from "@/components/ui/button";
import { toFa } from "@/lib/persian";
import { todayKey, isOverdue } from "@/lib/task-utils";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Users, FolderKanban, CalendarDays, Target, Clock,
  Plus, CheckCircle2, AlertCircle, TrendingUp, BarChart3, X,
  Search, Trash2, Pencil, FileText, Zap, Brain,
  ListChecks, Timer, Activity, Calendar, BookOpen, LayoutDashboard,
  AlertTriangle, Circle, Repeat, StickyNote,
} from "lucide-react";

/* ================================================================== */
/*  HELPERS                                                            */
/* ================================================================== */

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  urgent: { label: "فوری", color: "text-red-600", bg: "bg-red-100 dark:bg-red-500/10" },
  high: { label: "مهم", color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-500/10" },
  medium: { label: "متوسط", color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-500/10" },
  low: { label: "عادی", color: "text-muted-foreground", bg: "bg-muted" },
};

const RECURRENCE_LABELS: Record<string, string> = { daily: "روزانه", weekly: "هفتگی", monthly: "ماهانه", custom: "سفارشی" };

function daysUntil(dateStr: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  try { return new Date(dateStr).toLocaleDateString("fa-IR", { month: "short", day: "numeric" }); } catch { return dateStr; }
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${toFa(h)}h ${toFa(m)}m`;
  return `${toFa(m)}m`;
}

/* ================================================================== */
/*  MODAL + FORM HELPERS                                               */
/* ================================================================== */

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-border/60 bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-extrabold">{title}</h2>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg hover:bg-muted"><X className="size-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-bold text-muted-foreground">{label}</span>{children}</label>;
}
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30", props.className)} />;
}
function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30", props.className)} />;
}
function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn("w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30 resize-none", props.className)} />;
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

/* ================================================================== */
/*  MEETINGS MODULE                                                    */
/* ================================================================== */

function MeetingsModule() {
  const meetings = useQuery(api.employee.listMyMeetings);
  const projects = useWorkspace().projects;
  const createMeeting = useMutation(api.employee.createMeeting);
  const updateMeeting = useMutation(api.employee.updateMeeting);
  const deleteMeeting = useMutation(api.employee.deleteMeeting);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ title: "", date: todayKey(), time: "", participants: "", agenda: "", projectId: "" });

  const reset = () => { setForm({ title: "", date: todayKey(), time: "", participants: "", agenda: "", projectId: "" }); setAddOpen(false); };
  const submit = async () => {
    if (!form.title.trim()) return;
    await createMeeting({ title: form.title, date: form.date, time: form.time || undefined, participants: form.participants ? form.participants.split(",").map((p) => p.trim()).filter(Boolean) : [], projectId: form.projectId ? (form.projectId as Id<"projects">) : undefined, agenda: form.agenda || undefined });
    reset();
  };

  const today = meetings?.filter((m) => m.date === todayKey()) ?? [];
  const upcoming = meetings?.filter((m) => m.date > todayKey() && m.status === "scheduled").sort((a, b) => a.date.localeCompare(b.date)) ?? [];
  const completed = meetings?.filter((m) => m.status === "completed").sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10) ?? [];
  const projectOf = (id?: Id<"projects">) => id ? projects.find((p) => p._id === id)?.name : undefined;

  if (meetings === undefined) return <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold"><CalendarDays className="size-4 text-cyan-600" />جلسات</h3>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />جلسه جدید</Button>
      </div>

      {meetings.length === 0 ? (
        <EmptyState icon={CalendarDays} title="امروز جلسه‌ای ندارید" description="زمان خوبی برای تمرکز روی کارهای مهم است. جلسات خود را برنامه‌ریزی کنید." action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />برنامه‌ریزی جلسه</Button>} />
      ) : (
        <>
          {today.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-bold text-muted-foreground">امروز</h4>
              <div className="space-y-2">
                {today.map((m) => (
                  <div key={m._id} className="rounded-xl border border-cyan-200 bg-cyan-50/50 p-3 dark:border-cyan-500/20 dark:bg-cyan-500/5">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-sm font-bold">{m.title}</span>
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                          {m.time && <span>{m.time}</span>}
                          {m.projectId && projectOf(m.projectId) && <span>· {projectOf(m.projectId)}</span>}
                        </div>
                        {m.agenda && <p className="mt-1 text-[10px] text-muted-foreground">دستور: {m.agenda}</p>}
                        {m.participants.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">{m.participants.map((p) => <span key={p} className="rounded bg-muted/60 px-1.5 py-0.5 text-[9px] font-bold">{p}</span>)}</div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => updateMeeting({ id: m._id, status: "completed" })} className="rounded px-1.5 py-0.5 bg-emerald-100 text-emerald-600 text-[9px] font-bold">اتمام</button>
                        <button onClick={() => deleteMeeting({ id: m._id })} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {upcoming.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-bold text-muted-foreground">پیش رو</h4>
              <div className="space-y-1">
                {upcoming.map((m) => (
                  <div key={m._id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs">
                    <div><span className="font-semibold">{m.title}</span><span className="ms-2 text-muted-foreground">{formatDate(m.date)} {m.time && `— ${m.time}`}</span></div>
                    <button onClick={() => deleteMeeting({ id: m._id })} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {completed.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-bold text-muted-foreground">انجام شده</h4>
              <div className="space-y-1">
                {completed.map((m) => (
                  <div key={m._id} className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2 text-xs opacity-70">
                    <span>{m.title} <span className="text-muted-foreground">{formatDate(m.date)}</span></span>
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={addOpen} onClose={reset} title="جلسه جدید">
        <div className="space-y-3">
          <Field label="عنوان"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثلاً جلسه بررسی پروژه" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="تاریخ"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="ساعت"><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></Field>
          </div>
          <Field label="شرکت‌کنندگان (با کاما)"><Input value={form.participants} onChange={(e) => setForm({ ...form, participants: e.target.value })} placeholder="علی, سارا" /></Field>
          <Field label="پروژه مرتبط"><Select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}><option value="">بدون پروژه</option>{projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</Select></Field>
          <Field label="دستور جلسه"><Textarea rows={2} value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} placeholder="موضوعات مورد بحث..." /></Field>
          <div className="flex gap-2 pt-2">
            <Button onClick={submit} disabled={!form.title.trim()}>افزودن</Button>
            <Button variant="ghost" onClick={reset}>لغو</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  FOCUS CENTER MODULE                                                */
/* ================================================================== */

function FocusCenter() {
  const sessions = useQuery(api.employee.listFocusSessions);
  const projects = useWorkspace().projects;
  const tasks = useWorkspace().tasks;
  const createSession = useMutation(api.employee.createFocusSession);

  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedTask, setSelectedTask] = useState("");
  const [targetMinutes, setTargetMinutes] = useState(25);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const progress = Math.min(100, (elapsed / (targetMinutes * 60)) * 100);

  const start = () => { setRunning(true); intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000); };
  const stop = () => { setRunning(false); if (intervalRef.current) clearInterval(intervalRef.current); };
  const complete = async () => {
    stop();
    await createSession({
      taskId: selectedTask ? (selectedTask as Id<"tasks">) : undefined,
      projectId: selectedProject ? (selectedProject as Id<"projects">) : undefined,
      plannedMinutes: targetMinutes, actualMinutes: mins, date: todayKey(), completed: true, type: "focus",
    });
    setElapsed(0);
  };
  const reset = () => { stop(); setElapsed(0); };
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const todaySessions = sessions?.filter((s) => s.date === todayKey() && s.completed) ?? [];
  const todayFocusMins = todaySessions.reduce((sum, s) => sum + s.actualMinutes, 0);
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekSessions = sessions?.filter((s) => new Date(s.date) >= weekStart && s.completed) ?? [];
  const weekFocusMins = weekSessions.reduce((sum, s) => sum + s.actualMinutes, 0);

  if (sessions === undefined) return <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-bold"><Brain className="size-4 text-violet-600" />تمرکز</h3>

      {/* Timer */}
      <div className="rounded-xl border border-border/60 p-4">
        <div className="flex flex-col items-center">
          <div className="relative mb-4">
            <svg className="size-36 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/40" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="3" className="text-primary" strokeDasharray={`${progress * 2.64} 264`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black tabular-nums">{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}</span>
              <span className="text-[10px] text-muted-foreground">{targetMinutes} دقیقه</span>
            </div>
          </div>
          <div className="mb-3 w-full max-w-xs space-y-2">
            <Select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} className="text-xs"><option value="">پروژه</option>{projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</Select>
            <Select value={selectedTask} onChange={(e) => setSelectedTask(e.target.value)} className="text-xs"><option value="">وظیفه</option>{tasks.filter((t) => t.status !== "done").map((t) => <option key={t._id} value={t._id}>{t.title}</option>)}</Select>
          </div>
          <div className="mb-3 flex gap-1.5">
            {[15, 25, 45, 60].map((m) => (
              <button key={m} onClick={() => setTargetMinutes(m)} className={cn("rounded-lg px-3 py-1.5 text-xs font-bold transition-colors", targetMinutes === m ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}>{toFa(m)} دقیقه</button>
            ))}
          </div>
          <div className="flex gap-2">
            {!running ? <Button onClick={start}><Zap className="size-3.5" />شروع</Button> : (
              <>
                <Button variant="destructive" onClick={stop}><AlertTriangle className="size-3.5" />توقف</Button>
                <Button onClick={complete} className="bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="size-3.5" />اتمام</Button>
              </>
            )}
            {elapsed > 0 && !running && <Button variant="ghost" onClick={reset}>بازنشانی</Button>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-violet-50 p-3 text-center dark:bg-violet-500/10">
          <div className="text-lg font-extrabold text-violet-600 tabular-nums">{formatDuration(todayFocusMins)}</div>
          <div className="text-[10px] text-muted-foreground">تمرکز امروز</div>
        </div>
        <div className="rounded-xl bg-blue-50 p-3 text-center dark:bg-blue-500/10">
          <div className="text-lg font-extrabold text-blue-600 tabular-nums">{formatDuration(weekFocusMins)}</div>
          <div className="text-[10px] text-muted-foreground">تمرکز این هفته</div>
        </div>
      </div>

      {/* Recent sessions */}
      {sessions.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-bold text-muted-foreground">جلسات اخیر</h4>
          <div className="space-y-1">
            {sessions.sort((a, b) => b.createdAt - a.createdAt).slice(0, 10).map((s) => (
              <div key={s._id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs">
                <span>{s.title || "تمرکز"} · {formatDate(s.date)}</span>
                <span className="tabular-nums font-bold">{formatDuration(s.actualMinutes)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  RECURRING WORK MODULE                                              */
/* ================================================================== */

function RecurringWorkModule() {
  const configs = useQuery(api.employee.listRecurringConfigs);
  const projects = useWorkspace().projects;
  const createConfig = useMutation(api.employee.createRecurringConfig);
  const updateConfig = useMutation(api.employee.updateRecurringConfig);
  const deleteConfig = useMutation(api.employee.deleteRecurringConfig);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", projectId: "", priority: "medium", estimateMinutes: "", recurrence: "daily" });

  const reset = () => { setForm({ title: "", description: "", projectId: "", priority: "medium", estimateMinutes: "", recurrence: "daily" }); setAddOpen(false); };
  const submit = async () => {
    if (!form.title.trim()) return;
    await createConfig({ title: form.title, description: form.description || undefined, projectId: form.projectId ? (form.projectId as Id<"projects">) : undefined, priority: form.priority, estimateMinutes: form.estimateMinutes ? parseInt(form.estimateMinutes) : undefined, recurrence: form.recurrence });
    reset();
  };

  if (configs === undefined) return <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Repeat className="size-4 text-orange-600" />کارهای تکرارشونده</h3>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />افزودن</Button>
      </div>
      {configs.length === 0 ? (
        <EmptyState icon={Repeat} title="هنوز کار تکرارشونده‌ای ندارید" description="وظایف تکراری مانند گزارش هفتگی یا مرور روزانه را اینجا تعریف کنید." action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />افزودن اولین کار</Button>} />
      ) : (
        <div className="space-y-2">
          {configs.map((c) => (
            <div key={c._id} className="flex items-center justify-between rounded-xl border border-border/60 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{c.title}</span>
                  <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold", PRIORITY_CONFIG[c.priority]?.bg, PRIORITY_CONFIG[c.priority]?.color)}>{PRIORITY_CONFIG[c.priority]?.label}</span>
                  <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">{RECURRENCE_LABELS[c.recurrence]}</span>
                </div>
                {c.estimateMinutes && <p className="mt-0.5 text-[10px] text-muted-foreground">تخمین: {formatDuration(c.estimateMinutes)}</p>}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateConfig({ id: c._id, active: !c.active })} className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold", c.active ? "bg-emerald-100 text-emerald-600" : "bg-muted text-muted-foreground")}>{c.active ? "فعال" : "غیرفعال"}</button>
                <button onClick={() => deleteConfig({ id: c._id })} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={addOpen} onClose={reset} title="کار تکرارشونده جدید">
        <div className="space-y-3">
          <Field label="عنوان"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثلاً گزارش هفتگی" /></Field>
          <Field label="توضیح"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="تکرار"><Select value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })}><option value="daily">روزانه</option><option value="weekly">هفتگی</option><option value="monthly">ماهانه</option></Select></Field>
            <Field label="اولویت"><Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="low">عادی</option><option value="medium">متوسط</option><option value="high">مهم</option><option value="urgent">فوری</option></Select></Field>
          </div>
          <Field label="تخمین زمان (دقیقه)"><Input type="number" value={form.estimateMinutes} onChange={(e) => setForm({ ...form, estimateMinutes: e.target.value })} placeholder="60" /></Field>
          <Field label="پروژه"><Select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}><option value="">بدون پروژه</option>{projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</Select></Field>
          <div className="flex gap-2 pt-2">
            <Button onClick={submit} disabled={!form.title.trim()}>افزودن</Button>
            <Button variant="ghost" onClick={reset}>لغو</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  WORK GOALS MODULE                                                  */
/* ================================================================== */

function WorkGoalsModule() {
  const goals = useQuery(api.employee.listWorkGoals);
  const projects = useWorkspace().projects;
  const createGoal = useMutation(api.employee.createWorkGoal);
  const updateGoal = useMutation(api.employee.updateWorkGoal);
  const deleteGoal = useMutation(api.employee.deleteWorkGoal);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", period: "monthly", dueDate: "" });

  const reset = () => { setForm({ title: "", description: "", period: "monthly", dueDate: "" }); setAddOpen(false); };
  const submit = async () => {
    if (!form.title.trim()) return;
    await createGoal({ title: form.title, description: form.description || undefined, period: form.period, dueDate: form.dueDate || undefined, relatedProjectIds: [] });
    reset();
  };

  const periodLabels: Record<string, string> = { quarterly: "فصلی", monthly: "ماهانه", weekly: "هفتگی", custom: "سفارشی" };
  const active = goals?.filter((g) => g.status === "active") ?? [];
  const completed = goals?.filter((g) => g.status === "completed") ?? [];
  const atRisk = goals?.filter((g) => g.status === "at_risk") ?? [];

  if (goals === undefined) return <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Target className="size-4 text-emerald-600" />اهداف کاری</h3>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />هدف جدید</Button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-emerald-50 p-3 text-center dark:bg-emerald-500/10"><div className="text-lg font-extrabold text-emerald-600 tabular-nums">{toFa(active.length)}</div><div className="text-[10px] text-muted-foreground">فعال</div></div>
        <div className="rounded-xl bg-amber-50 p-3 text-center dark:bg-amber-500/10"><div className="text-lg font-extrabold text-amber-600 tabular-nums">{toFa(atRisk.length)}</div><div className="text-[10px] text-muted-foreground">در خطر</div></div>
        <div className="rounded-xl bg-blue-50 p-3 text-center dark:bg-blue-500/10"><div className="text-lg font-extrabold text-blue-600 tabular-nums">{toFa(completed.length)}</div><div className="text-[10px] text-muted-foreground">تکمیل</div></div>
      </div>
      {goals.length === 0 ? (
        <EmptyState icon={Target} title="با تعریف اولین هدف کاری، مسیر پیشرفت خود را مشخص کنید" description="اهداف کاری کمک می‌کنند تا روی نتایج مهم تمرکز کنید." action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />ایجاد هدف</Button>} />
      ) : (
        <div className="space-y-2">
          {goals.sort((a, b) => a.createdAt - b.createdAt).map((g) => (
            <div key={g._id} className="rounded-xl border border-border/60 p-3">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{g.title}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold", g.status === "completed" ? "bg-emerald-100 text-emerald-600" : g.status === "at_risk" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600 dark:bg-blue-500/10")}>{g.status === "completed" ? "تکمیل" : g.status === "at_risk" ? "در خطر" : "فعال"}</span>
                    <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">{periodLabels[g.period]}</span>
                  </div>
                  {g.description && <p className="mt-0.5 text-[10px] text-muted-foreground">{g.description}</p>}
                </div>
                <div className="flex gap-1">
                  {g.status === "active" && <button onClick={() => updateGoal({ id: g._id, status: "completed" })} className="rounded px-1.5 py-0.5 bg-emerald-100 text-emerald-600 text-[9px] font-bold">تکمیل</button>}
                  <button onClick={() => deleteGoal({ id: g._id })} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /></button>
                </div>
              </div>
              <div className="mt-2">
                <div className="flex items-center justify-between text-[10px]"><span className="text-muted-foreground">پیشرفت</span><span className="font-extrabold tabular-nums">{toFa(g.progress)}٪</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-l from-primary to-emerald-500" style={{ width: `${g.progress}%` }} /></div>
              </div>
              {g.dueDate && <p className="mt-1.5 text-[10px] text-muted-foreground">موعد: {formatDate(g.dueDate)}</p>}
            </div>
          ))}
        </div>
      )}
      <Modal open={addOpen} onClose={reset} title="هدف کاری جدید">
        <div className="space-y-3">
          <Field label="عنوان"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثلاً تکمیل پروژه وب‌سایت" /></Field>
          <Field label="توضیح"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="دوره"><Select value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })}><option value="weekly">هفتگی</option><option value="monthly">ماهانه</option><option value="quarterly">فصلی</option><option value="custom">سفارشی</option></Select></Field>
            <Field label="تاریخ"><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={submit} disabled={!form.title.trim()}>افزودن</Button>
            <Button variant="ghost" onClick={reset}>لغو</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  EMPLOYEE NOTES MODULE                                              */
/* ================================================================== */

function EmployeeNotesModule() {
  const notes = useQuery(api.employee.listNotes);
  const projects = useWorkspace().projects;
  const createNote = useMutation(api.employee.createNote);
  const updateNote = useMutation(api.employee.updateNote);
  const deleteNote = useMutation(api.employee.deleteNote);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ title: "", content: "", noteType: "quick", tags: "" });

  const reset = () => { setForm({ title: "", content: "", noteType: "quick", tags: "" }); setAddOpen(false); };
  const submit = async () => {
    if (!form.title.trim()) return;
    await createNote({ title: form.title, content: form.content, noteType: form.noteType, tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [] });
    reset();
  };

  const typeLabels: Record<string, string> = { quick: "سریع", meeting: "جلسه‌ای", project: "پروژه‌ای", personal: "شخصی" };
  const filtered = notes?.filter((n) => !search || n.title.includes(search) || n.content.includes(search) || n.tags.some((t) => t.includes(search))).sort((a, b) => b.updatedAt - a.updatedAt) ?? [];

  if (notes === undefined) return <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold"><StickyNote className="size-4 text-amber-600" />یادداشت‌ها</h3>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />یادداشت جدید</Button>
      </div>
      <div className="relative">
        <Search className="absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جست‌وجو…" className="w-full rounded-lg border border-border/60 bg-background pe-8 ps-8 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/30" />
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={StickyNote} title="هنوز یادداشتی ندارید" description="یادداشت‌های کاری، جلسه‌ای یا شخصی خود را اینجا ذخیره کنید." action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />اولین یادداشت</Button>} />
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => (
            <div key={n._id} className="rounded-xl border border-border/60 p-3">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold">{n.title}</span>
                    <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">{typeLabels[n.noteType]}</span>
                  </div>
                  {n.content && <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{n.content}</p>}
                  {n.tags.length > 0 && <div className="mt-1.5 flex gap-1">{n.tags.map((t) => <span key={t} className="rounded bg-muted/60 px-1.5 py-0.5 text-[9px] text-muted-foreground">{t}</span>)}</div>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => deleteNote({ id: n._id })} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={addOpen} onClose={reset} title="یادداشت جدید">
        <div className="space-y-3">
          <Field label="عنوان"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثلاً نکات جلسه" /></Field>
          <Field label="نوع"><Select value={form.noteType} onChange={(e) => setForm({ ...form, noteType: e.target.value })}><option value="quick">سریع</option><option value="meeting">جلسه‌ای</option><option value="project">پروژه‌ای</option><option value="personal">شخصی</option></Select></Field>
          <Field label="محتوا"><Textarea rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="یادداشت..." /></Field>
          <Field label="برچسب‌ها (با کاما)"><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="مثلاً پروژه, جلسه" /></Field>
          <div className="flex gap-2 pt-2">
            <Button onClick={submit} disabled={!form.title.trim()}>ذخیره</Button>
            <Button variant="ghost" onClick={reset}>لغو</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  EMPLOYEE ANALYTICS                                                 */
/* ================================================================== */

function EmployeeAnalytics() {
  const tasks = useWorkspace().tasks;
  const projects = useWorkspace().projects;
  const focusSessions = useQuery(api.employee.listFocusSessions);
  const goals = useQuery(api.employee.listWorkGoals);

  const done = tasks.filter((t) => t.status === "done");
  const active = tasks.filter((t) => t.status !== "done");
  const overdue = active.filter((t) => isOverdue(t));
  const completionRate = tasks.length > 0 ? Math.round((done.length / tasks.length) * 100) : 0;
  const overdueRate = active.length > 0 ? Math.round((overdue.length / active.length) * 100) : 0;

  const todayFocus = focusSessions?.filter((s) => s.date === todayKey() && s.completed).reduce((sum, s) => sum + s.actualMinutes, 0) ?? 0;
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekFocus = focusSessions?.filter((s) => new Date(s.date) >= weekStart && s.completed).reduce((sum, s) => sum + s.actualMinutes, 0) ?? 0;

  const activeGoals = goals?.filter((g) => g.status === "active") ?? [];
  const completedGoals = goals?.filter((g) => g.status === "completed") ?? [];
  const goalProgress = activeGoals.length > 0 ? Math.round(activeGoals.reduce((sum, g) => sum + g.progress, 0) / activeGoals.length) : 0;

  const activeProjects = projects.filter((p) => p.status !== "completed");

  if (!focusSessions || !goals) return <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-bold"><TrendingUp className="size-4 text-blue-600" />تحلیل عملکرد</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-primary/5 p-3 text-center"><div className="text-lg font-extrabold text-primary tabular-nums">{toFa(completionRate)}٪</div><div className="text-[10px] text-muted-foreground">نرخ تکمیل</div></div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center dark:bg-emerald-500/10"><div className="text-lg font-extrabold text-emerald-600 tabular-nums">{formatDuration(weekFocus)}</div><div className="text-[10px] text-muted-foreground">تمرکز هفتگی</div></div>
        <div className="rounded-xl bg-red-50 p-3 text-center dark:bg-red-500/10"><div className="text-lg font-extrabold text-red-600 tabular-nums">{toFa(overdueRate)}٪</div><div className="text-[10px] text-muted-foreground">نرخ تأخیر</div></div>
        <div className="rounded-xl bg-violet-50 p-3 text-center dark:bg-violet-500/10"><div className="text-lg font-extrabold text-violet-600 tabular-nums">{toFa(goalProgress)}٪</div><div className="text-[10px] text-muted-foreground">پیشرفت اهداف</div></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border/60 p-4">
          <h4 className="mb-2 text-xs font-bold">وضعیت کارها</h4>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">کل وظایف</span><span className="font-extrabold">{toFa(tasks.length)}</span></div>
            <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">تکمیل شده</span><span className="font-extrabold text-emerald-600">{toFa(done.length)}</span></div>
            <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">عقب‌افتاده</span><span className="font-extrabold text-red-600">{toFa(overdue.length)}</span></div>
            <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">پروژه‌های فعال</span><span className="font-extrabold">{toFa(activeProjects.length)}</span></div>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 p-4">
          <h4 className="mb-2 text-xs font-bold">اهداف و تمرکز</h4>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">اهداف فعال</span><span className="font-extrabold">{toFa(activeGoals.length)}</span></div>
            <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">اهداف تکمیل</span><span className="font-extrabold text-emerald-600">{toFa(completedGoals.length)}</span></div>
            <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">تمرکز امروز</span><span className="font-extrabold text-violet-600">{formatDuration(todayFocus)}</span></div>
            <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">تمرکز هفتگی</span><span className="font-extrabold text-blue-600">{formatDuration(weekFocus)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  MAIN EMPLOYEE WORKSPACE                                            */
/* ================================================================== */

export function EmployeeWorkspace() {
  const { tasks, projects, toggleDone, deleteTask, openTask, createTask } = useWorkspace();
  const [activeTab, setActiveTab] = useState<"dashboard" | "today" | "tasks" | "projects" | "meetings" | "focus" | "recurring" | "goals" | "analytics" | "notes">("dashboard");

  const tKey = todayKey();
  const root = tasks.filter((t) => !t.parentId);
  const todayTasks = root.filter((t) => t.dueDate === tKey && t.status !== "done");
  const overdue = root.filter((t) => isOverdue(t));
  const allToday = root.filter((t) => t.dueDate === tKey);
  const completed = allToday.filter((t) => t.status === "done").length;
  const pct = allToday.length ? Math.round((completed / allToday.length) * 100) : 0;
  const activeProjects = projects.filter((p) => p.status !== "completed");

  const subtotals = useMemo(() => {
    const m = new Map<string, { total: number; done: number }>();
    for (const t of tasks) { if (!t.parentId) continue; const cur = m.get(t.parentId) ?? { total: 0, done: 0 }; cur.total++; if (t.status === "done") cur.done++; m.set(t.parentId, cur); }
    return m;
  }, [tasks]);
  const projectOf = (id?: string) => projects.find((p) => p._id === id);

  // Priority-sorted work queue
  const workQueue = useMemo(() => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return [...root.filter((t) => t.status !== "done")].sort((a, b) => {
      const pa = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2;
      const pb = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2;
      if (pa !== pb) return pa - pb;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });
  }, [root]);

  const TABS = [
    { key: "dashboard" as const, label: "داشبورد", icon: LayoutDashboard },
    { key: "today" as const, label: "امروز", icon: CalendarDays },
    { key: "tasks" as const, label: "وظایف", icon: ListChecks },
    { key: "projects" as const, label: "پروژه‌ها", icon: FolderKanban },
    { key: "meetings" as const, label: "جلسات", icon: Calendar },
    { key: "focus" as const, label: "تمرکز", icon: Brain },
    { key: "recurring" as const, label: "تکراری", icon: Repeat },
    { key: "goals" as const, label: "اهداف", icon: Target },
    { key: "analytics" as const, label: "تحلیل", icon: TrendingUp },
    { key: "notes" as const, label: "یادداشت", icon: StickyNote },
  ];

  return (
    <WorkspaceLayout>
      <div className="mb-4 -mx-1 overflow-x-auto scrollbar-none">
        <div className="flex gap-1 px-1 pb-1">
          {TABS.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition-all", activeTab === tab.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <tab.icon className="size-3.5" />{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Dashboard — Phase 09 command center ── */}
      {activeTab === "dashboard" && (
        <CommandCenter
          quickLinks={[
            { label: "جلسات", onClick: () => setActiveTab("meetings") },
            { label: "تمرکز", onClick: () => setActiveTab("focus") },
            { label: "اهداف کاری", onClick: () => setActiveTab("goals") },
            { label: "کار تکراری", onClick: () => setActiveTab("recurring") },
          ]}
        />
      )}

      {/* ── Today ── */}
      {activeTab === "today" && (
        <div className="space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-bold"><CalendarDays className="size-4 text-cyan-600" />برنامه امروز</h3>
          {/* Must Do */}
          <div>
            <h4 className="mb-2 text-xs font-bold text-red-600">باید انجام شود</h4>
            {workQueue.filter((t) => t.priority === "urgent" || t.priority === "high").length === 0 ? <p className="text-xs text-muted-foreground">کار فوری ندارید.</p> : (
              <ul>{workQueue.filter((t) => t.priority === "urgent" || t.priority === "high").map((t) => <TaskRow key={t._id} task={t} project={projectOf(t.projectId)} onToggle={(done) => toggleDone(t, done)} onOpen={() => openTask(t._id)} onDelete={() => deleteTask(t._id)} />)}</ul>
            )}
          </div>
          {/* Should Do */}
          <div>
            <h4 className="mb-2 text-xs font-bold text-amber-600">بهتر است انجام شود</h4>
            {workQueue.filter((t) => t.priority === "medium").length === 0 ? <p className="text-xs text-muted-foreground">کار متوسط ندارید.</p> : (
              <ul>{workQueue.filter((t) => t.priority === "medium").map((t) => <TaskRow key={t._id} task={t} project={projectOf(t.projectId)} onToggle={(done) => toggleDone(t, done)} onOpen={() => openTask(t._id)} onDelete={() => deleteTask(t._id)} />)}</ul>
            )}
          </div>
          {/* Low */}
          <div>
            <h4 className="mb-2 text-xs font-bold text-muted-foreground">سایر</h4>
            {workQueue.filter((t) => t.priority === "low" || (!["urgent", "high", "medium"].includes(t.priority))).length === 0 ? <p className="text-xs text-muted-foreground">کار دیگری ندارید.</p> : (
              <ul>{workQueue.filter((t) => t.priority === "low" || (!["urgent", "high", "medium"].includes(t.priority))).map((t) => <TaskRow key={t._id} task={t} project={projectOf(t.projectId)} onToggle={(done) => toggleDone(t, done)} onOpen={() => openTask(t._id)} onDelete={() => deleteTask(t._id)} />)}</ul>
            )}
          </div>
          {/* Completed */}
          <div>
            <h4 className="mb-2 text-xs font-bold text-emerald-600">انجام شده ({toFa(completed)})</h4>
            {allToday.filter((t) => t.status === "done").length > 0 && (
              <ul>{allToday.filter((t) => t.status === "done").map((t) => <TaskRow key={t._id} task={t} project={projectOf(t.projectId)} onToggle={(done) => toggleDone(t, done)} onOpen={() => openTask(t._id)} onDelete={() => deleteTask(t._id)} />)}</ul>
            )}
          </div>
          <SmartTaskInput onCreate={(p) => createTask({ title: p.title, dueDate: p.dueDate, dueTime: p.dueTime, priority: p.priority, tags: p.tags })} />
        </div>
      )}

      {/* ── Tasks ── */}
      {activeTab === "tasks" && (
        <div className="space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-bold"><ListChecks className="size-4 text-primary" />همه وظایف</h3>
          <section className="ui-surface overflow-hidden rounded-2xl">
            {root.length === 0 ? (
              <div className="px-4 py-8 text-center"><p className="text-sm font-semibold">هنوز وظیفه‌ای ندارید.</p></div>
            ) : (
              <ul>{root.sort((a, b) => { const po = { urgent: 0, high: 1, medium: 2, low: 3 }; return (po[a.priority as keyof typeof po] ?? 2) - (po[b.priority as keyof typeof po] ?? 2); }).map((t) => <TaskRow key={t._id} task={t} project={projectOf(t.projectId)} subtaskTotal={subtotals.get(t._id)?.total} subtaskDone={subtotals.get(t._id)?.done} onToggle={(done) => toggleDone(t, done)} onOpen={() => openTask(t._id)} onDelete={() => deleteTask(t._id)} />)}</ul>
            )}
          </section>
          <SmartTaskInput onCreate={(p) => createTask({ title: p.title, dueDate: p.dueDate, dueTime: p.dueTime, priority: p.priority, tags: p.tags })} />
        </div>
      )}

      {/* ── Projects ── */}
      {activeTab === "projects" && (
        <div className="space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-bold"><FolderKanban className="size-4 text-blue-600" />پروژه‌ها</h3>
          {activeProjects.length === 0 ? (
            <EmptyState icon={FolderKanban} title="پروژه‌ای برای نمایش وجود ندارد" description="پروژه‌ها را ایجاد کنید و پیشرفت خود را دنبال کنید." />
          ) : (
            <div className="space-y-2">
              {activeProjects.map((p) => {
                const pTasks = tasks.filter((t) => t.projectId === p._id);
                const done = pTasks.filter((t) => t.status === "done").length;
                const pct = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0;
                return (
                  <div key={p._id} className="rounded-xl border border-border/60 p-3">
                    <div className="flex items-center gap-2"><span className="size-3 rounded-sm" style={{ background: p.color }} /><span className="text-sm font-bold">{p.name}</span></div>
                    {p.deadline && <p className="mt-1 text-[10px] text-muted-foreground">موعد: {formatDate(p.deadline)} {daysUntil(p.deadline) > 0 ? `(${toFa(daysUntil(p.deadline))} روز)` : ""}</p>}
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[10px]"><span className="text-muted-foreground">{toFa(done)}/{toFa(pTasks.length)} وظیفه</span><span className="font-extrabold">{toFa(pct)}٪</span></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-l from-primary to-blue-500" style={{ width: `${pct}%` }} /></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "meetings" && <MeetingsModule />}
      {activeTab === "focus" && <FocusCenter />}
      {activeTab === "recurring" && <RecurringWorkModule />}
      {activeTab === "goals" && <WorkGoalsModule />}
      {activeTab === "analytics" && (
        <CapabilityGate featureKey="work_analytics">
          <EmployeeAnalytics />
        </CapabilityGate>
      )}
      {activeTab === "notes" && <EmployeeNotesModule />}
    </WorkspaceLayout>
  );
}
