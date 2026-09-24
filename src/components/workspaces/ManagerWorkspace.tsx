import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { CapabilityGate } from "@/components/progress/UnlockCenter";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { TaskRow } from "@/components/tasks/TaskRow";
import { SmartTaskInput } from "@/components/tasks/SmartTaskInput";
import { WorkspaceLayout } from "./WorkspaceLayout";
import { PersonaStatsStrip } from "@/components/progress/PersonaStats";
import { Button } from "@/components/ui/button";
import { toFa } from "@/lib/persian";
import { todayKey, isOverdue } from "@/lib/task-utils";
import { useState, useMemo, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Users, FolderKanban, CalendarDays, Target, Clock,
  Plus, CheckCircle2, AlertCircle, TrendingUp, BarChart3, X,
  Search, Trash2, Pencil, Star, FileText, Zap, CircleDot,
  ListChecks, ChevronDown, Eye, UserPlus, Flag, Timer, Activity,
  Shield, AlertTriangle, Milestone, BookOpen, Settings, LayoutDashboard,
  Calendar, BarChart, PieChart, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";

/* ================================================================== */
/*  HELPERS                                                            */
/* ================================================================== */

const MEMBER_ROLES = ["manager", "lead", "member"] as const;
const GOAL_PERIODS = ["quarterly", "monthly", "weekly", "custom"] as const;

function daysUntil(dateStr: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  try { return new Date(dateStr).toLocaleDateString("fa-IR", { month: "short", day: "numeric" }); } catch { return dateStr; }
}

function projectHealth(project: any, tasks: any[], milestones: any[]): "on_track" | "needs_attention" | "at_risk" | "blocked" {
  const pTasks = tasks.filter((t) => t.projectId === project._id && t.status !== "done");
  const overdue = pTasks.filter((t) => isOverdue(t)).length;
  const total = tasks.filter((t) => t.projectId === project._id).length;
  const done = tasks.filter((t) => t.projectId === project._id && t.status === "done").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  if (overdue > 3) return "at_risk";
  if (overdue > 0) return "needs_attention";
  if (project.deadline && daysUntil(project.deadline) < 7 && pct < 60) return "at_risk";
  if (pct >= 80) return "on_track";
  if (pct >= 40) return "on_track";
  return "needs_attention";
}

const HEALTH_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  on_track: { label: "در مسیر", color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-500/10" },
  needs_attention: { label: "نیاز به توجه", color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-500/10" },
  at_risk: { label: "در خطر", color: "text-red-600", bg: "bg-red-100 dark:bg-red-500/10" },
  blocked: { label: "متوقف", color: "text-gray-600", bg: "bg-gray-100 dark:bg-gray-500/10" },
};

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
/*  TEAM OVERVIEW MODULE                                               */
/* ================================================================== */

function TeamOverviewModule() {
  const teams = useQuery(api.manager.listTeams);
  const members = useQuery(api.manager.listMembers, {});
  const tasks = useQuery(api.manager.listTeams) ? useWorkspace().tasks : [];
  const projects = useQuery(api.manager.listTeams) ? useWorkspace().projects : [];
  const createTeam = useMutation(api.manager.createTeam);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  const reset = () => { setForm({ name: "", description: "" }); setAddOpen(false); };
  const submit = async () => { if (!form.name.trim()) return; await createTeam({ name: form.name, description: form.description || undefined }); reset(); };

  const activeTeams = teams?.filter((t) => !t.archived) ?? [];
  const totalMembers = members?.filter((m) => !m.archived).length ?? 0;
  const activeTasks = tasks.filter((t) => t.status !== "done").length;
  const overdueTasks = tasks.filter((t) => t.status !== "done" && isOverdue(t)).length;

  if (teams === undefined) return <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Users className="size-4 text-blue-600" />تیم‌ها</h3>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />تیم جدید</Button>
      </div>

      {activeTeams.length === 0 ? (
        <EmptyState icon={Users} title="هنوز تیمی ایجاد نکرده‌اید" description="تیم خود را بسازید و اعضا را اضافه کنید تا مدیریت پروژه و کارها آغاز شود." action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />ایجاد تیم</Button>} />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl bg-blue-50 p-3 text-center dark:bg-blue-500/10">
              <div className="text-lg font-extrabold text-blue-600 tabular-nums">{toFa(activeTeams.length)}</div>
              <div className="text-[10px] text-muted-foreground">تیم فعال</div>
            </div>
            <div className="rounded-xl bg-violet-50 p-3 text-center dark:bg-violet-500/10">
              <div className="text-lg font-extrabold text-violet-600 tabular-nums">{toFa(totalMembers)}</div>
              <div className="text-[10px] text-muted-foreground">عضو تیم</div>
            </div>
            <div className="rounded-xl bg-primary/5 p-3 text-center">
              <div className="text-lg font-extrabold text-primary tabular-nums">{toFa(activeTasks)}</div>
              <div className="text-[10px] text-muted-foreground">وظیفه فعال</div>
            </div>
            <div className="rounded-xl bg-red-50 p-3 text-center dark:bg-red-500/10">
              <div className="text-lg font-extrabold text-red-600 tabular-nums">{toFa(overdueTasks)}</div>
              <div className="text-[10px] text-muted-foreground">عقب‌افتاده</div>
            </div>
          </div>

          {/* Team cards */}
          {activeTeams.map((team) => {
            const teamMembers = members?.filter((m) => m.teamId === team._id && !m.archived) ?? [];
            return (
              <div key={team._id} className="rounded-xl border border-border/60 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold">{team.name}</span>
                    {team.description && <p className="mt-0.5 text-[10px] text-muted-foreground">{team.description}</p>}
                  </div>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-500/10">{toFa(teamMembers.length)} عضو</span>
                </div>
                {teamMembers.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {teamMembers.map((m) => (
                      <span key={m._id} className="flex items-center gap-1 rounded-lg bg-muted/60 px-2 py-1 text-[10px] font-bold">
                        <span className="grid size-4 place-items-center rounded-full bg-primary/10 text-primary text-[9px]">{m.name[0]}</span>
                        {m.name}
                        <span className="text-muted-foreground">({m.role === "manager" ? "مدیر" : m.role === "lead" ? "سرگروه" : "عضو"})</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      <Modal open={addOpen} onClose={reset} title="ایجاد تیم جدید">
        <div className="space-y-3">
          <Field label="نام تیم"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثلاً تیم توسعه وب" /></Field>
          <Field label="توضیحات"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="اختیاری" /></Field>
          <div className="flex gap-2 pt-2">
            <Button onClick={submit} disabled={!form.name.trim()}>ایجاد</Button>
            <Button variant="ghost" onClick={reset}>لغو</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  TEAM MEMBERS MODULE                                                */
/* ================================================================== */

function TeamMembersModule() {
  const teams = useQuery(api.manager.listTeams);
  const members = useQuery(api.manager.listMembers, {});
  const createMember = useMutation(api.manager.createMember);
  const updateMember = useMutation(api.manager.updateMember);
  const deleteMember = useMutation(api.manager.deleteMember);
  const tasks = useWorkspace().tasks;
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<Id<"teamMembers"> | null>(null);
  const [form, setForm] = useState({ name: "", role: "member", email: "", capacity: "10" });

  const teamId = selectedTeam || teams?.[0]?._id;
  const teamMembers = members?.filter((m) => m.teamId === teamId && !m.archived) ?? [];

  const reset = () => { setForm({ name: "", role: "member", email: "", capacity: "10" }); setAddOpen(false); setEditId(null); };
  const submit = async () => {
    if (!form.name.trim() || !teamId) return;
    if (editId) { await updateMember({ id: editId, name: form.name, role: form.role, capacity: parseInt(form.capacity) || 10 }); }
    else { await createMember({ teamId: teamId as Id<"teams">, name: form.name, role: form.role, email: form.email || undefined, capacity: parseInt(form.capacity) || 10 }); }
    reset();
  };
  const startEdit = (m: any) => { setForm({ name: m.name, role: m.role, email: m.email ?? "", capacity: m.capacity.toString() }); setEditId(m._id); setAddOpen(true); };

  const memberStats = (m: any) => {
    const memberTasks = tasks.filter((t) => t.status !== "done");
    const assigned = memberTasks.length; // simplified — real app would use assignedTo field
    return { active: assigned, overdue: memberTasks.filter((t) => isOverdue(t)).length };
  };

  if (teams === undefined) return <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Users className="size-4 text-violet-600" />اعضای تیم</h3>
        <Button size="sm" onClick={() => setAddOpen(true)} disabled={!teamId}><UserPlus className="size-3.5" />افزودن عضو</Button>
      </div>

      {teams.length > 0 && (
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {teams.map((t) => (
            <button key={t._id} onClick={() => setSelectedTeam(t._id)} className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-colors", teamId === t._id ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:bg-muted")}>{t.name}</button>
          ))}
        </div>
      )}

      {teamMembers.length === 0 ? (
        <EmptyState icon={UserPlus} title="هنوز عضوی اضافه نشده" description="اعضای تیم را اضافه کنید تا بتوانید کارها را بین آنها تخصیص دهید." action={<Button size="sm" onClick={() => setAddOpen(true)} disabled={!teamId}><UserPlus className="size-3.5" />افزودن اولین عضو</Button>} />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {teamMembers.map((m) => {
            const stats = memberStats(m);
            return (
              <div key={m._id} className="group rounded-xl border border-border/60 p-3 transition-all hover:border-primary/30">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-primary/10 to-violet-500/10 text-sm font-bold text-primary">{m.name[0]}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold">{m.name}</div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span>{m.role === "manager" ? "مدیر" : m.role === "lead" ? "سرگروه" : "عضو"}</span>
                      <span>·</span>
                      <span>ظرفیت: {toFa(m.capacity)}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(m)} className="grid size-6 place-items-center rounded hover:bg-muted"><Pencil className="size-3" /></button>
                    <button onClick={() => deleteMember({ id: m._id })} className="grid size-6 place-items-center rounded hover:bg-destructive/10 text-destructive"><Trash2 className="size-3" /></button>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                  <div className="rounded-lg bg-muted/40 p-1.5">
                    <div className="text-xs font-extrabold tabular-nums">{toFa(stats.active)}</div>
                    <div className="text-[9px] text-muted-foreground">فعال</div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-1.5 dark:bg-emerald-500/10">
                    <div className="text-xs font-extrabold text-emerald-600 tabular-nums">—</div>
                    <div className="text-[9px] text-muted-foreground">انجام‌شده</div>
                  </div>
                  <div className="rounded-lg bg-red-50 p-1.5 dark:bg-red-500/10">
                    <div className="text-xs font-extrabold text-red-600 tabular-nums">{toFa(stats.overdue)}</div>
                    <div className="text-[9px] text-muted-foreground">عقب‌افتاده</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={addOpen} onClose={reset} title={editId ? "ویرایش عضو" : "افزودن عضو جدید"}>
        <div className="space-y-3">
          <Field label="نام"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="نام عضو" /></Field>
          <Field label="نقش"><Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="member">عضو</option><option value="lead">سرگروه</option><option value="manager">مدیر</option></Select></Field>
          <Field label="ایمیل"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="اختیاری" /></Field>
          <Field label="ظرفیت (وظیفه در هفته)"><Input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></Field>
          <div className="flex gap-2 pt-2">
            <Button onClick={submit} disabled={!form.name.trim()}>{editId ? "ذخیره" : "افزودن"}</Button>
            <Button variant="ghost" onClick={reset}>لغو</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  WORKLOAD MODULE                                                    */
/* ================================================================== */

function WorkloadModule() {
  const members = useQuery(api.manager.listMembers, {});
  const tasks = useWorkspace().tasks;
  const activeTasks = tasks.filter((t) => t.status !== "done");

  const memberWorkload = useMemo(() => {
    if (!members) return [];
    return members.filter((m) => !m.archived).map((m) => {
      const count = activeTasks.length; // simplified — would use assignedTo
      const overload = count > m.capacity;
      const utilization = m.capacity > 0 ? Math.round((count / m.capacity) * 100) : 0;
      return { ...m, taskCount: count, overload, utilization };
    });
  }, [members, activeTasks]);

  if (members === undefined) return <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-bold"><BarChart3 className="size-4 text-amber-600" />ظرفیت و بار کاری تیم</h3>

      {memberWorkload.length === 0 ? (
        <EmptyState icon={Users} title="ابتدا اعضای تیم را اضافه کنید" description="برای مدیریت بار کاری، ابتدا اعضای تیم و ظرفیت آنها را تعریف کنید." />
      ) : (
        <div className="space-y-3">
          {memberWorkload.sort((a, b) => b.utilization - a.utilization).map((m) => (
            <div key={m._id} className={cn("rounded-xl border p-3 transition-all", m.overload ? "border-red-200 bg-red-50/50 dark:border-red-500/20 dark:bg-red-500/5" : "border-border/60")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="grid size-8 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{m.name[0]}</div>
                  <div>
                    <div className="text-sm font-bold">{m.name}</div>
                    <div className="text-[10px] text-muted-foreground">{toFa(m.taskCount)} وظیفه از {toFa(m.capacity)} ظرفیت</div>
                  </div>
                </div>
                <div className="text-left">
                  <div className={cn("text-lg font-extrabold tabular-nums", m.overload ? "text-red-600" : m.utilization > 70 ? "text-amber-600" : "text-emerald-600")}>{toFa(m.utilization)}٪</div>
                  {m.overload && <div className="text-[9px] font-bold text-red-500">بیش از ظرفیت</div>}
                </div>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full transition-all", m.overload ? "bg-gradient-to-l from-red-500 to-red-400" : m.utilization > 70 ? "bg-gradient-to-l from-amber-500 to-amber-400" : "bg-gradient-to-l from-emerald-500 to-emerald-400")} style={{ width: `${Math.min(100, m.utilization)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  PROJECTS + HEALTH MODULE                                           */
/* ================================================================== */

function ProjectsModule() {
  const projects = useWorkspace().projects;
  const tasks = useWorkspace().tasks;
  const createProject = useMutation(useWorkspace() as any); // using workspace
  const milestones = useQuery(api.manager.listMilestones, {});
  const createMilestone = useMutation(api.manager.createMilestone);
  const [addOpen, setAddOpen] = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState<Id<"projects"> | null>(null);
  const [form, setForm] = useState({ name: "", description: "", deadline: "" });
  const [msForm, setMsForm] = useState({ title: "", dueDate: "" });

  const activeProjects = projects.filter((p) => p.status !== "completed");

  const reset = () => { setForm({ name: "", description: "", deadline: "" }); setAddOpen(false); };
  const msReset = () => { setMsForm({ title: "", dueDate: "" }); setMilestoneOpen(null); };

  const submitMs = async () => {
    if (!msForm.title.trim() || !milestoneOpen) return;
    await createMilestone({ projectId: milestoneOpen, title: msForm.title, dueDate: msForm.dueDate });
    msReset();
  };

  if (projects === undefined) return <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold"><FolderKanban className="size-4 text-blue-600" />پروژه‌ها و سلامت</h3>
      </div>

      {activeProjects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="هنوز پروژه‌ای وجود ندارد" description="پروژه‌ها را ایجاد کنید تا سلامت، پیشرفت و نقطه عطف هر پروژه را دنبال کنید." />
      ) : (
        <div className="space-y-3">
          {activeProjects.map((p) => {
            const health = projectHealth(p, tasks, milestones ?? []);
            const hMeta = HEALTH_LABELS[health];
            const pTasks = tasks.filter((t) => t.projectId === p._id);
            const done = pTasks.filter((t) => t.status === "done").length;
            const total = pTasks.length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const overdue = pTasks.filter((t) => t.status !== "done" && isOverdue(t)).length;
            const pMilestones = milestones?.filter((m) => m.projectId === p._id) ?? [];
            const completedMs = pMilestones.filter((m) => m.status === "completed").length;

            return (
              <div key={p._id} className="rounded-xl border border-border/60 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="size-3 rounded-sm" style={{ background: p.color }} />
                      <span className="text-sm font-bold">{p.name}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", hMeta.bg, hMeta.color)}>{hMeta.label}</span>
                    </div>
                    {p.description && <p className="mt-1 text-[10px] text-muted-foreground line-clamp-1">{p.description}</p>}
                  </div>
                  {p.deadline && <span className="shrink-0 rounded-lg bg-muted/60 px-2 py-1 text-[10px] font-bold text-muted-foreground">موعد: {formatDate(p.deadline)}</span>}
                </div>
                {/* Progress bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-muted-foreground">{toFa(done)}/{toFa(total)} وظیفه</span>
                    <span className="font-extrabold tabular-nums">{toFa(pct)}٪</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gradient-to-l from-primary to-blue-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {/* Stats row */}
                <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
                  {overdue > 0 && <span className="flex items-center gap-0.5 text-red-500"><AlertCircle className="size-3" />{toFa(overdue)} عقب‌افتاده</span>}
                  {pMilestones.length > 0 && <span className="flex items-center gap-0.5"><Milestone className="size-3" />{toFa(completedMs)}/{toFa(pMilestones.length)} نقطه عطف</span>}
                  {p.deadline && daysUntil(p.deadline) > 0 && <span>{toFa(daysUntil(p.deadline))} روز تا موعد</span>}
                  <button onClick={() => setMilestoneOpen(p._id)} className="ms-auto text-primary font-bold hover:underline">+ نقطه عطف</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Milestone modal */}
      <Modal open={!!milestoneOpen} onClose={msReset} title="افزودن نقطه عطف">
        <div className="space-y-3">
          <Field label="عنوان"><Input value={msForm.title} onChange={(e) => setMsForm({ ...msForm, title: e.target.value })} placeholder="مثلاً انتشار نسخه آلفا" /></Field>
          <Field label="تاریخ"><Input type="date" value={msForm.dueDate} onChange={(e) => setMsForm({ ...msForm, dueDate: e.target.value })} /></Field>
          <div className="flex gap-2 pt-2">
            <Button onClick={submitMs} disabled={!msForm.title.trim()}>افزودن</Button>
            <Button variant="ghost" onClick={msReset}>لغو</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  TEAM GOALS MODULE                                                  */
/* ================================================================== */

function TeamGoalsModule() {
  const teams = useQuery(api.manager.listTeams);
  const goals = useQuery(api.manager.listTeamGoals, {});
  const members = useQuery(api.manager.listMembers, {});
  const createGoal = useMutation(api.manager.createTeamGoal);
  const updateGoal = useMutation(api.manager.updateTeamGoal);
  const deleteGoal = useMutation(api.manager.deleteTeamGoal);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ teamId: "", title: "", description: "", period: "quarterly", dueDate: "" });

  const reset = () => { setForm({ teamId: teams?.[0]?._id ?? "", title: "", description: "", period: "quarterly", dueDate: "" }); setAddOpen(false); };
  const submit = async () => {
    if (!form.title.trim() || !form.teamId) return;
    await createGoal({ teamId: form.teamId as Id<"teams">, title: form.title, description: form.description || undefined, period: form.period, dueDate: form.dueDate || undefined, ownerId: undefined, relatedProjectIds: [] });
    reset();
  };

  const periodLabels: Record<string, string> = { quarterly: "فصلی", monthly: "ماهانه", weekly: "هفتگی", custom: "سفارشی" };
  const activeGoals = goals?.filter((g) => g.status === "active") ?? [];
  const completedGoals = goals?.filter((g) => g.status === "completed") ?? [];
  const atRiskGoals = goals?.filter((g) => g.status === "at_risk") ?? [];

  if (goals === undefined) return <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Target className="size-4 text-emerald-600" />اهداف تیم</h3>
        <Button size="sm" onClick={() => { reset(); setAddOpen(true); }} disabled={!teams?.length}><Plus className="size-3.5" />هدف جدید</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-emerald-50 p-3 text-center dark:bg-emerald-500/10">
          <div className="text-lg font-extrabold text-emerald-600 tabular-nums">{toFa(activeGoals.length)}</div>
          <div className="text-[10px] text-muted-foreground">فعال</div>
        </div>
        <div className="rounded-xl bg-amber-50 p-3 text-center dark:bg-amber-500/10">
          <div className="text-lg font-extrabold text-amber-600 tabular-nums">{toFa(atRiskGoals.length)}</div>
          <div className="text-[10px] text-muted-foreground">در خطر</div>
        </div>
        <div className="rounded-xl bg-blue-50 p-3 text-center dark:bg-blue-500/10">
          <div className="text-lg font-extrabold text-blue-600 tabular-nums">{toFa(completedGoals.length)}</div>
          <div className="text-[10px] text-muted-foreground">تکمیل شده</div>
        </div>
      </div>

      {goals.length === 0 ? (
        <EmptyState icon={Target} title="با تعریف اولین هدف تیم، مسیر پیشرفت تیم را مشخص کنید" description="اهداف تیم کمک می‌کنند تا همه روی نتایج مشترک تمرکز کنند." action={<Button size="sm" onClick={() => { reset(); setAddOpen(true); }} disabled={!teams?.length}><Plus className="size-3.5" />ایجاد هدف</Button>} />
      ) : (
        <div className="space-y-2">
          {goals.sort((a, b) => a.createdAt - b.createdAt).map((g) => (
            <div key={g._id} className="rounded-xl border border-border/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{g.title}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold",
                      g.status === "completed" ? "bg-emerald-100 text-emerald-600" : g.status === "at_risk" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600 dark:bg-blue-500/10"
                    )}>{g.status === "completed" ? "تکمیل" : g.status === "at_risk" ? "در خطر" : "فعال"}</span>
                    <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">{periodLabels[g.period] ?? g.period}</span>
                  </div>
                  {g.description && <p className="mt-0.5 text-[10px] text-muted-foreground">{g.description}</p>}
                </div>
                <div className="flex items-center gap-1">
                  {g.status === "active" && <button onClick={() => updateGoal({ id: g._id, status: "completed" })} className="rounded px-1.5 py-0.5 bg-emerald-100 text-emerald-600 text-[9px] font-bold hover:bg-emerald-200">تکمیل</button>}
                  <button onClick={() => deleteGoal({ id: g._id })} className="grid size-5 place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /></button>
                </div>
              </div>
              {/* Progress */}
              <div className="mt-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">پیشرفت</span>
                  <span className="font-extrabold tabular-nums">{toFa(g.progress)}٪</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-to-l from-primary to-emerald-500 transition-all" style={{ width: `${g.progress}%` }} />
                </div>
              </div>
              {g.dueDate && <p className="mt-1.5 text-[10px] text-muted-foreground">موعد: {formatDate(g.dueDate)} {daysUntil(g.dueDate) > 0 ? `(${toFa(daysUntil(g.dueDate))} روز)` : ""}</p>}
            </div>
          ))}
        </div>
      )}

      <Modal open={addOpen} onClose={reset} title="هدف جدید تیم">
        <div className="space-y-3">
          <Field label="تیم">
            <Select value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}>
              <option value="">انتخاب تیم</option>
              {teams?.filter((t) => !t.archived).map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
            </Select>
          </Field>
          <Field label="عنوان"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثلاً راه‌اندازی وب‌سایت جدید" /></Field>
          <Field label="توضیحات"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="دوره"><Select value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })}><option value="quarterly">فصلی</option><option value="monthly">ماهانه</option><option value="weekly">هفتگی</option><option value="custom">سفارشی</option></Select></Field>
            <Field label="تاریخ"><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={submit} disabled={!form.title.trim() || !form.teamId}>افزودن</Button>
            <Button variant="ghost" onClick={reset}>لغو</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  MEETINGS MODULE                                                    */
/* ================================================================== */

function MeetingsModule() {
  const teams = useQuery(api.manager.listTeams);
  const meetings = useQuery(api.manager.listMeetings, {});
  const createMeeting = useMutation(api.manager.createMeeting);
  const updateMeeting = useMutation(api.manager.updateMeeting);
  const deleteMeeting = useMutation(api.manager.deleteMeeting);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ teamId: "", title: "", date: todayKey(), time: "", participants: "", agenda: "" });

  const reset = () => { setForm({ teamId: teams?.[0]?._id ?? "", title: "", date: todayKey(), time: "", participants: "", agenda: "" }); setAddOpen(false); };
  const submit = async () => {
    if (!form.title.trim() || !form.teamId) return;
    await createMeeting({ teamId: form.teamId as Id<"teams">, title: form.title, date: form.date, time: form.time || undefined, participants: form.participants ? form.participants.split(",").map((p) => p.trim()).filter(Boolean) : [], agenda: form.agenda || undefined });
    reset();
  };

  const scheduled = meetings?.filter((m) => m.status === "scheduled") ?? [];
  const completed = meetings?.filter((m) => m.status === "completed") ?? [];

  if (meetings === undefined) return <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold"><CalendarDays className="size-4 text-cyan-600" />جلسات</h3>
        <Button size="sm" onClick={() => { reset(); setAddOpen(true); }} disabled={!teams?.length}><Plus className="size-3.5" />جلسه جدید</Button>
      </div>

      {meetings.length === 0 ? (
        <EmptyState icon={CalendarDays} title="هنوز جلسه‌ای ثبت نشده" description="جلسات تیم را برنامه‌ریزی کنید و تصمیمات و اقدامات را ثبت کنید." action={<Button size="sm" onClick={() => { reset(); setAddOpen(true); }} disabled={!teams?.length}><Plus className="size-3.5" />برنامه‌ریزی جلسه</Button>} />
      ) : (
        <>
          {scheduled.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-bold text-muted-foreground">برنامه‌ریزی شده</h4>
              <div className="space-y-2">
                {scheduled.map((m) => (
                  <div key={m._id} className="rounded-xl border border-border/60 p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-sm font-bold">{m.title}</span>
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                          <CalendarDays className="size-3" />{formatDate(m.date)} {m.time && `— ${m.time}`}
                        </div>
                        {m.participants.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {m.participants.map((p) => <span key={p} className="rounded bg-muted/60 px-1.5 py-0.5 text-[9px] font-bold">{p}</span>)}
                          </div>
                        )}
                        {m.agenda && <p className="mt-1 text-[10px] text-muted-foreground line-clamp-1">دستور: {m.agenda}</p>}
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
          {completed.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-bold text-muted-foreground">انجام شده</h4>
              <div className="space-y-1">
                {completed.map((m) => (
                  <div key={m._id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs">
                    <div>
                      <span className="font-semibold">{m.title}</span>
                      <span className="ms-2 text-muted-foreground">{formatDate(m.date)}</span>
                    </div>
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
          <Field label="تیم"><Select value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}><option value="">انتخاب تیم</option>{teams?.filter((t) => !t.archived).map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</Select></Field>
          <Field label="عنوان"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثلاً جلسه بررسی اسپرینت" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="تاریخ"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="ساعت"><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></Field>
          </div>
          <Field label="شرکت‌کنندگان (با کاما)"><Input value={form.participants} onChange={(e) => setForm({ ...form, participants: e.target.value })} placeholder="علی, سارا, رضا" /></Field>
          <Field label="دستور جلسه"><Textarea rows={3} value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} placeholder="موضوعات مورد بحث..." /></Field>
          <div className="flex gap-2 pt-2">
            <Button onClick={submit} disabled={!form.title.trim() || !form.teamId}>افزودن</Button>
            <Button variant="ghost" onClick={reset}>لغو</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  ACTIVITY FEED MODULE                                               */
/* ================================================================== */

function ActivityFeedModule() {
  const activity = useQuery(api.manager.listActivity, { limit: 30 });

  const typeIcons: Record<string, React.FC<{ className?: string }>> = {
    task_assigned: ListChecks, task_completed: CheckCircle2, task_overdue: AlertCircle,
    project_updated: FolderKanban, goal_updated: Target, meeting_scheduled: CalendarDays, member_added: UserPlus,
  };
  const typeLabels: Record<string, string> = {
    task_assigned: "وظیفه تخصیص یافت", task_completed: "وظیفه تکمیل شد", task_overdue: "وظیفه عقب افتاد",
    project_updated: "پروژه به‌روز شد", goal_updated: "هدف به‌روز شد", meeting_scheduled: "جلسه برنامه‌ریزی شد", member_added: "عضو اضافه شد",
  };

  if (activity === undefined) return <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-bold"><Activity className="size-4 text-orange-600" />فعالیت اخیر تیم</h3>

      {activity.length === 0 ? (
        <EmptyState icon={Activity} title="هنوز فعالیتی ثبت نشده" description="فعالیت‌های تیم مانند تکمیل وظایف، به‌روزرسانی پروژه و جلسات اینجا نمایش داده می‌شوند." />
      ) : (
        <div className="space-y-1.5">
          {activity.map((a) => {
            const Icon = typeIcons[a.type] ?? CircleDot;
            return (
              <div key={a._id} className="flex items-start gap-2.5 rounded-lg bg-muted/30 px-3 py-2">
                <div className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-muted/60"><Icon className="size-3 text-muted-foreground" /></div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold">{a.title}</span>
                  {a.description && <p className="mt-0.5 text-[10px] text-muted-foreground">{a.description}</p>}
                  <span className="mt-0.5 block text-[9px] text-muted-foreground">{typeLabels[a.type] ?? a.type}</span>
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
/*  ANALYTICS MODULE                                                   */
/* ================================================================== */

function TeamAnalytics() {
  const tasks = useWorkspace().tasks;
  const projects = useWorkspace().projects;
  const members = useQuery(api.manager.listMembers, {});
  const goals = useQuery(api.manager.listTeamGoals, {});

  const done = tasks.filter((t) => t.status === "done");
  const overdueTasks = tasks.filter((t) => t.status !== "done" && isOverdue(t));
  const active = tasks.filter((t) => t.status !== "done");
  const completionRate = tasks.length > 0 ? Math.round((done.length / tasks.length) * 100) : 0;
  const overdueRate = active.length > 0 ? Math.round((overdueTasks.length / active.length) * 100) : 0;
  const onTimeRate = done.length > 0 ? Math.round(((done.length - done.filter((t) => t.dueDate && new Date(t.createdAt) > new Date(t.dueDate)).length) / done.length) * 100) : 0;

  const activeProjects = projects.filter((p) => p.status !== "completed");
  const activeGoals = goals?.filter((g) => g.status === "active") ?? [];
  const completedGoals = goals?.filter((g) => g.status === "completed") ?? [];
  const goalProgress = activeGoals.length > 0 ? Math.round(activeGoals.reduce((sum, g) => sum + g.progress, 0) / activeGoals.length) : 0;

  if (!members) return <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-bold"><TrendingUp className="size-4 text-blue-600" />تحلیل تیم</h3>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-primary/5 p-3 text-center">
          <div className="text-lg font-extrabold text-primary tabular-nums">{toFa(completionRate)}٪</div>
          <div className="text-[10px] text-muted-foreground">نرخ تکمیل</div>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center dark:bg-emerald-500/10">
          <div className="text-lg font-extrabold text-emerald-600 tabular-nums">{toFa(onTimeRate)}٪</div>
          <div className="text-[10px] text-muted-foreground">نرخ به‌موقع</div>
        </div>
        <div className="rounded-xl bg-red-50 p-3 text-center dark:bg-red-500/10">
          <div className="text-lg font-extrabold text-red-600 tabular-nums">{toFa(overdueRate)}٪</div>
          <div className="text-[10px] text-muted-foreground">نرخ تأخیر</div>
        </div>
        <div className="rounded-xl bg-violet-50 p-3 text-center dark:bg-violet-500/10">
          <div className="text-lg font-extrabold text-violet-600 tabular-nums">{toFa(goalProgress)}٪</div>
          <div className="text-[10px] text-muted-foreground">پیشرفت اهداف</div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Project status */}
        <div className="rounded-xl border border-border/60 p-4">
          <h4 className="mb-2 text-xs font-bold">وضعیت پروژه‌ها</h4>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">                  <span className="text-muted-foreground">پروژه‌های فعال</span><span className="font-extrabold">{toFa(activeProjects.length)}</span></div>
            <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">وظایف کل</span><span className="font-extrabold">{toFa(tasks.length)}</span></div>
            <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">تکمیل شده</span><span className="font-extrabold text-emerald-600">{toFa(done.length)}</span></div>
            <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">عقب‌افتاده</span><span className="font-extrabold text-red-600">{toFa(overdueTasks.length)}</span></div>
          </div>
        </div>

        {/* Goal progress */}
        <div className="rounded-xl border border-border/60 p-4">
          <h4 className="mb-2 text-xs font-bold">پیشرفت اهداف تیم</h4>
          {activeGoals.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">هدفی تعریف نشده</p>
          ) : (
            <div className="space-y-2">
              {activeGoals.slice(0, 4).map((g) => (
                <div key={g._id}>
                  <div className="flex items-center justify-between text-[10px]"><span className="font-semibold truncate">{g.title}</span><span className="font-bold tabular-nums">{toFa(g.progress)}٪</span></div>
                  <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-l from-primary to-emerald-500" style={{ width: `${g.progress}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  MAIN MANAGER WORKSPACE                                             */
/* ================================================================== */

export function ManagerWorkspace() {
  const { tasks, projects, toggleDone, deleteTask, openTask, createTask } = useWorkspace();
  const [activeTab, setActiveTab] = useState<"dashboard" | "team" | "members" | "projects" | "workload" | "goals" | "meetings" | "activity" | "analytics">("dashboard");

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

  const TABS = [
    { key: "dashboard" as const, label: "داشبورد", icon: LayoutDashboard },
    { key: "team" as const, label: "تیم", icon: Users },
    { key: "members" as const, label: "اعضا", icon: UserPlus },
    { key: "projects" as const, label: "پروژه‌ها", icon: FolderKanban },
    { key: "workload" as const, label: "بار کاری", icon: BarChart3 },
    { key: "goals" as const, label: "اهداف", icon: Target },
    { key: "meetings" as const, label: "جلسات", icon: CalendarDays },
    { key: "activity" as const, label: "فعالیت", icon: Activity },
    { key: "analytics" as const, label: "تحلیل", icon: TrendingUp },
  ];

  return (
    <WorkspaceLayout>
      {/* Tab navigation */}
      <div className="mb-4 -mx-1 overflow-x-auto scrollbar-none">
        <div className="flex gap-1 px-1 pb-1">
          {TABS.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition-all", activeTab === tab.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <tab.icon className="size-3.5" />{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Dashboard Tab ── */}
      {activeTab === "dashboard" && (
        <div className="space-y-4">
          {/* Executive summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "وظایف امروز", value: allToday.length, icon: ListChecks, color: "text-foreground" },
              { label: "پروژه‌های فعال", value: activeProjects.length, icon: FolderKanban, color: "text-blue-600" },
              { label: "عقب‌افتاده", value: overdue.length, icon: AlertCircle, color: "text-red-500" },
              { label: "نرخ تکمیل", value: `${toFa(pct)}٪`, icon: CheckCircle2, color: "text-emerald-600" },
            ].map((s) => (
              <div key={s.label} className="ui-surface rounded-2xl p-3 text-center">
                <s.icon className={`mx-auto mb-1 size-5 ${s.color}`} />
                <div className="text-lg font-extrabold tabular-nums">{typeof s.value === "number" ? toFa(s.value) : s.value}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          <PersonaStatsStrip />

          {/* Overdue tasks alert */}
          {overdue.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50/50 p-3 dark:border-red-500/20 dark:bg-red-500/5">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-4 text-red-500" />
                <span className="text-sm font-bold text-red-700 dark:text-red-300">{toFa(overdue.length)} وظیفه عقب‌افتاده</span>
              </div>
              <p className="mt-1 text-[10px] text-red-600/80 dark:text-red-300/70">بهتر است وضعیت این وظایف را بررسی و پیگیری کنید.</p>
            </div>
          )}

          {/* Today's tasks */}
          <section className="ui-surface overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-bold"><span className="ui-icon-tile size-6"><ListChecks className="size-3.5 text-primary" /></span>وظایف امروز</h2>
            </div>
            {allToday.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-semibold">وظیفه‌ای برای امروز ثبت نشده.</p>
                <p className="mt-1 text-xs text-muted-foreground">وظایف جدید ایجاد کنید یا از پروژه‌ها تخصیص دهید.</p>
              </div>
            ) : (
              <ul>{allToday.map((t: any) => <TaskRow key={t._id} task={t} project={projectOf(t.projectId)} subtaskTotal={subtotals.get(t._id)?.total} subtaskDone={subtotals.get(t._id)?.done} onToggle={(done) => toggleDone(t, done)} onOpen={() => openTask(t._id)} onDelete={() => deleteTask(t._id)} />)}</ul>
            )}
          </section>

          <SmartTaskInput onCreate={(p) => createTask({ title: p.title, dueDate: p.dueDate, dueTime: p.dueTime, priority: p.priority, tags: p.tags })} />
        </div>
      )}

      {/* ── Team Tab ── */}
      {activeTab === "team" && <TeamOverviewModule />}

      {/* ── Members Tab ── */}
      {activeTab === "members" && <TeamMembersModule />}

      {/* ── Projects Tab ── */}
      {activeTab === "projects" && <ProjectsModule />}

      {/* ── Workload Tab ── */}
      {activeTab === "workload" && <WorkloadModule />}

      {/* ── Goals Tab ── */}
      {activeTab === "goals" && <TeamGoalsModule />}

      {/* ── Meetings Tab ── */}
      {activeTab === "meetings" && <MeetingsModule />}

      {/* ── Activity Tab ── */}
      {activeTab === "activity" && <ActivityFeedModule />}

      {/* ── Analytics Tab ── */}
      {activeTab === "analytics" && <TeamAnalytics />}
    </WorkspaceLayout>
  );
}
