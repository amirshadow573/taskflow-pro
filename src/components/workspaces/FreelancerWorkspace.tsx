import { useWorkspace } from "@/components/workspace/WorkspaceData";
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
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Users, FolderKanban, CalendarDays, Target, Clock,
  Plus, CheckCircle2, AlertCircle, TrendingUp, BarChart3, X,
  Search, Trash2, Pencil, Star, FileText, Zap, CircleDot,
  ListChecks, Timer, Activity, DollarSign, Send, Eye, LayoutDashboard,
  ArrowUpRight, Briefcase, CreditCard, Timer as TimerIcon, CircleDot as Dot,
  Mail, Phone, Building, CheckCircle, AlertTriangle, Circle,
} from "lucide-react";

/* ================================================================== */
/*  HELPERS                                                            */
/* ================================================================== */

const CLIENT_COLORS = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500"];

function daysUntil(dateStr: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  try { return new Date(dateStr).toLocaleDateString("fa-IR", { month: "short", day: "numeric" }); } catch { return dateStr; }
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${toFa(h)}h ${toFa(m)}m`;
  return `${toFa(m)}m`;
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `${toFa(Math.round(amount / 1_000_000))}M`;
  if (amount >= 1_000) return `${toFa(Math.round(amount / 1_000))}K`;
  return toFa(amount);
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
/*  CLIENTS MODULE                                                     */
/* ================================================================== */

function ClientsModule() {
  const clients = useQuery(api.freelancer.listClients);
  const createClient = useMutation(api.freelancer.createClient);
  const updateClient = useMutation(api.freelancer.updateClient);
  const deleteClient = useMutation(api.freelancer.deleteClient);
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<Id<"clients"> | null>(null);
  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "", color: CLIENT_COLORS[0] });

  const reset = () => { setForm({ name: "", company: "", email: "", phone: "", color: CLIENT_COLORS[0] }); setAddOpen(false); setEditId(null); };
  const submit = async () => {
    if (!form.name.trim()) return;
    if (editId) { await updateClient({ id: editId, name: form.name, company: form.company || undefined, email: form.email || undefined, phone: form.phone || undefined, color: form.color }); }
    else { await createClient({ name: form.name, company: form.company || undefined, email: form.email || undefined, phone: form.phone || undefined, color: form.color }); }
    reset();
  };
  const startEdit = (c: any) => { setForm({ name: c.name, company: c.company ?? "", email: c.email ?? "", phone: c.phone ?? "", color: c.color }); setEditId(c._id); setAddOpen(true); };

  if (clients === undefined) return <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;
  const active = clients.filter((c) => !c.archived);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Users className="size-4 text-violet-600" />مشتریان</h3>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />مشتری جدید</Button>
      </div>
      {active.length === 0 ? (
        <EmptyState icon={Users} title="هنوز مشتری ثبت نشده" description="مشتریان خود را اضافه کنید تا پروژه‌ها، فاکتورها و تایم‌شیت‌ها را به آنها متصل کنید." action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />افزودن اولین مشتری</Button>} />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {active.map((c) => (
            <div key={c._id} className="group rounded-xl border border-border/60 p-3 transition-all hover:border-primary/30">
              <div className="flex items-center gap-2.5">
                <div className={cn("grid size-9 place-items-center rounded-full text-xs font-bold text-white", c.color)}>{c.name[0]}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">{c.name}</div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    {c.company && <><Building className="size-3" />{c.company}</>}
                    {c.email && <><Mail className="size-3" />{c.email}</>}
                    {c.phone && <><Phone className="size-3" />{c.phone}</>}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(c)} className="grid size-6 place-items-center rounded hover:bg-muted"><Pencil className="size-3" /></button>
                  <button onClick={() => deleteClient({ id: c._id })} className="grid size-6 place-items-center rounded hover:bg-destructive/10 text-destructive"><Trash2 className="size-3" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={addOpen} onClose={reset} title={editId ? "ویرایش مشتری" : "مشتری جدید"}>
        <div className="space-y-3">
          <Field label="نام"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="نام مشتری" /></Field>
          <Field label="شرکت"><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="اختیاری" /></Field>
          <Field label="ایمیل"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="اختیاری" /></Field>
          <Field label="تلفن"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="اختیاری" /></Field>
          <Field label="رنگ">
            <div className="flex gap-1.5">{CLIENT_COLORS.map((c) => <button key={c} onClick={() => setForm({ ...form, color: c })} className={cn("size-7 rounded-full border-2 transition-all", c, form.color === c ? "border-foreground scale-110" : "border-transparent")} />)}</div>
          </Field>
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
/*  TIME TRACKING MODULE                                               */
/* ================================================================== */

function TimeTrackingModule() {
  const entries = useQuery(api.freelancer.listTimeEntries);
  const clients = useQuery(api.freelancer.listClients);
  const projects = useWorkspace().projects;
  const createTimeEntry = useMutation(api.freelancer.createTimeEntry);
  const updateTimeEntry = useMutation(api.freelancer.updateTimeEntry);
  const deleteTimeEntry = useMutation(api.freelancer.deleteTimeEntry);

  const [running, setRunning] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [description, setDescription] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ clientId: "", projectId: "", description: "", hours: "", minutes: "30", billable: "true", hourlyRate: "" });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clientName = useCallback((id?: Id<"clients">) => id ? clients?.find((c) => c._id === id)?.name ?? "—" : "—", [clients]);

  const startTimer = () => { setRunning(true); setStartTime(Date.now()); setElapsed(0); intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000); };
  const stopTimer = () => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };
  const saveTimer = async () => {
    await createTimeEntry({
      clientId: selectedClient ? (selectedClient as Id<"clients">) : undefined,
      projectId: selectedProject ? (selectedProject as Id<"projects">) : undefined,
      description: description || undefined,
      startTime, endTime: Date.now(), duration: elapsed,
      billable: true, hourlyRate: undefined, date: todayKey(),
    });
    stopTimer(); setElapsed(0); setSelectedClient(""); setSelectedProject(""); setDescription("");
  };
  const resetTimer = () => { stopTimer(); setElapsed(0); };

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const reset = () => { setForm({ clientId: "", projectId: "", description: "", hours: "", minutes: "30", billable: "true", hourlyRate: "" }); setAddOpen(false); };
  const submitManual = async () => {
    const mins = (parseInt(form.hours) || 0) * 60 + (parseInt(form.minutes) || 0);
    if (mins <= 0) return;
    await createTimeEntry({
      clientId: form.clientId ? (form.clientId as Id<"clients">) : undefined,
      projectId: form.projectId ? (form.projectId as Id<"projects">) : undefined,
      description: form.description || undefined,
      startTime: Date.now() - mins * 60000, endTime: Date.now(), duration: mins * 60,
      billable: form.billable === "true", hourlyRate: form.hourlyRate ? parseFloat(form.hourlyRate) : undefined,
      date: todayKey(),
    });
    reset();
  };

  // Stats
  const todayEntries = entries?.filter((e) => e.date === todayKey()) ?? [];
  const todaySeconds = todayEntries.reduce((s, e) => s + e.duration, 0);
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEntries = entries?.filter((e) => new Date(e.date) >= weekStart) ?? [];
  const weekSeconds = weekEntries.reduce((s, e) => s + e.duration, 0);
  const billableSeconds = entries?.filter((e) => e.billable).reduce((s, e) => s + e.duration, 0) ?? 0;
  const totalRevenue = entries?.filter((e) => e.billable && e.hourlyRate).reduce((s, e) => s + (e.duration / 3600) * (e.hourlyRate ?? 0), 0) ?? 0;

  if (entries === undefined) return <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Timer className="size-4 text-cyan-600" />پیگیری زمان</h3>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />ثبت دستی</Button>
      </div>

      {/* Timer */}
      <div className="rounded-xl border border-border/60 p-4">
        <div className="flex flex-col items-center">
          <span className="text-4xl font-black tabular-nums text-foreground">{formatDuration(elapsed)}</span>
          <div className="mt-3 w-full max-w-xs space-y-2">
            <Select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="text-xs">
              <option value="">مشتری (اختیاری)</option>
              {clients?.filter((c) => !c.archived).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </Select>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="توضیح کار..." className="w-full rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs" />
          </div>
          <div className="mt-3 flex gap-2">
            {!running ? (
              <Button onClick={startTimer}><Zap className="size-3.5" />شروع</Button>
            ) : (
              <>
                <Button variant="destructive" onClick={stopTimer}>توقف</Button>
                <Button onClick={saveTimer} className="bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="size-3.5" />ذخیره</Button>
              </>
            )}
            {elapsed > 0 && !running && <Button variant="ghost" onClick={resetTimer}>بازنشانی</Button>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-cyan-50 p-3 text-center dark:bg-cyan-500/10">
          <div className="text-lg font-extrabold text-cyan-600 tabular-nums">{formatDuration(todaySeconds)}</div>
          <div className="text-[10px] text-muted-foreground">امروز</div>
        </div>
        <div className="rounded-xl bg-blue-50 p-3 text-center dark:bg-blue-500/10">
          <div className="text-lg font-extrabold text-blue-600 tabular-nums">{formatDuration(weekSeconds)}</div>
          <div className="text-[10px] text-muted-foreground">این هفته</div>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center dark:bg-emerald-500/10">
          <div className="text-lg font-extrabold text-emerald-600 tabular-nums">{formatDuration(billableSeconds)}</div>
          <div className="text-[10px] text-muted-foreground">قابل صورتحساب</div>
        </div>
        <div className="rounded-xl bg-amber-50 p-3 text-center dark:bg-amber-500/10">
          <div className="text-lg font-extrabold text-amber-600 tabular-nums">{formatCurrency(totalRevenue)}</div>
          <div className="text-[10px] text-muted-foreground">درآمد</div>
        </div>
      </div>

      {/* Recent entries */}
      <div>
        <h4 className="mb-2 text-xs font-bold text-muted-foreground">ورودهای اخیر</h4>
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">هنوز ورودی ثبت نشده.</p>
        ) : (
          <div className="space-y-1">
            {entries.sort((a, b) => b.createdAt - a.createdAt).slice(0, 15).map((e) => (
              <div key={e._id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs">
                <div className="min-w-0 flex-1">
                  <span className="font-semibold">{e.description || "بدون توضیح"}</span>
                  <span className="ms-2 text-muted-foreground">{clientName(e.clientId)} · {formatDate(e.date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums font-bold">{formatDuration(e.duration)}</span>
                  {e.billable && <span className="rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-bold text-emerald-600 dark:bg-emerald-500/10">صورتحساب</span>}
                  <button onClick={() => deleteTimeEntry({ id: e._id })} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={addOpen} onClose={reset} title="ثبت زمان به صورت دستی">
        <div className="space-y-3">
          <Field label="مشتری"><Select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}><option value="">بدون مشتری</option>{clients?.filter((c) => !c.archived).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select></Field>
          <Field label="پروژه"><Select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}><option value="">بدون پروژه</option>{projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</Select></Field>
          <Field label="توضیح"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="توضیح کار انجام شده" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ساعت"><Input type="number" min={0} value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} placeholder="0" /></Field>
            <Field label="دقیقه"><Input type="number" min={0} max={59} value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="قابل صورتحساب"><Select value={form.billable} onChange={(e) => setForm({ ...form, billable: e.target.value })}><option value="true">بله</option><option value="false">خیر</option></Select></Field>
            <Field label="نرخ ساعتی"><Input type="number" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} placeholder="اختیاری" /></Field>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={submitManual}>ذخیره</Button>
            <Button variant="ghost" onClick={reset}>لغو</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  DELIVERABLES MODULE                                                */
/* ================================================================== */

function DeliverablesModule() {
  const deliverables = useQuery(api.freelancer.listDeliverables);
  const clients = useQuery(api.freelancer.listClients);
  const createDeliverable = useMutation(api.freelancer.createDeliverable);
  const updateDeliverable = useMutation(api.freelancer.updateDeliverable);
  const deleteDeliverable = useMutation(api.freelancer.deleteDeliverable);
  const [addOpen, setAddOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [form, setForm] = useState({ clientId: "", title: "", description: "", dueDate: "", priority: "medium" });

  const clientName = useCallback((id: Id<"clients">) => clients?.find((c) => c._id === id)?.name ?? "—", [clients]);
  const reset = () => { setForm({ clientId: "", title: "", description: "", dueDate: "", priority: "medium" }); setAddOpen(false); };
  const submit = async () => {
    if (!form.clientId || !form.title.trim() || !form.dueDate) return;
    await createDeliverable({ clientId: form.clientId as Id<"clients">, title: form.title, description: form.description || undefined, dueDate: form.dueDate, priority: form.priority });
    reset();
  };

  const filtered = deliverables?.filter((d) => filter === "all" || d.status === filter) ?? [];
  const pending = deliverables?.filter((d) => d.status === "pending" || d.status === "in_progress").length ?? 0;
  const overdue = deliverables?.filter((d) => d.status !== "approved" && d.status !== "delivered" && daysUntil(d.dueDate) < 0).length ?? 0;

  const statusLabels: Record<string, string> = { pending: "در انتظار", in_progress: "در حال انجام", delivered: "تحویل شده", revised: "بازنگری", approved: "تأیید شده" };
  const statusColors: Record<string, string> = { pending: "bg-muted text-muted-foreground", in_progress: "bg-blue-100 text-blue-600 dark:bg-blue-500/10", delivered: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10", revised: "bg-amber-100 text-amber-600 dark:bg-amber-500/10", approved: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10" };

  if (deliverables === undefined) return <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Briefcase className="size-4 text-amber-600" />تحویل‌ها
          {overdue > 0 && <span className="rounded-full bg-red-100 px-1.5 text-[10px] font-bold text-red-600">{toFa(overdue)}</span>}
        </h3>
        <Button size="sm" onClick={() => setAddOpen(true)} disabled={!clients?.length}><Plus className="size-3.5" />تحویل جدید</Button>
      </div>
      <div className="flex gap-1 overflow-x-auto scrollbar-none">
        {[["all", "همه"], ["pending", "در انتظار"], ["in_progress", "در حال انجام"], ["delivered", "تحویل شده"], ["approved", "تأیید شده"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-colors", filter === k ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:bg-muted")}>{l}</button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={Briefcase} title="تحویلی ثبت نشده" description="تحویل‌های پروژه را پیگیری کنید تا زمان تحویل و وضعیت هر کدام مشخص باشد." action={<Button size="sm" onClick={() => setAddOpen(true)} disabled={!clients?.length}><Plus className="size-3.5" />افزودن</Button>} />
      ) : (
        <div className="space-y-2">
          {filtered.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map((d) => {
            const days = daysUntil(d.dueDate);
            const isOver = days < 0 && d.status !== "approved" && d.status !== "delivered";
            return (
              <div key={d._id} className={cn("rounded-xl border p-3 transition-all", isOver ? "border-red-200 bg-red-50/50 dark:border-red-500/20 dark:bg-red-500/5" : "border-border/60")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{d.title}</span>
                      <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold", statusColors[d.status])}>{statusLabels[d.status]}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span>{clientName(d.clientId)}</span>
                      <span>·</span>
                      <span>{formatDate(d.dueDate)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {d.status !== "approved" && d.status !== "delivered" && (
                      <button onClick={() => updateDeliverable({ id: d._id, status: d.status === "pending" ? "in_progress" : d.status === "in_progress" ? "delivered" : "approved" })} className="rounded px-1.5 py-0.5 bg-emerald-100 text-emerald-600 text-[9px] font-bold">
                        {d.status === "pending" ? "شروع" : d.status === "in_progress" ? "تحویل" : "تأیید"}
                      </button>
                    )}
                    <button onClick={() => deleteDeliverable({ id: d._id })} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /></button>
                  </div>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold", d.priority === "urgent" ? "bg-red-100 text-red-600" : d.priority === "high" ? "bg-amber-100 text-amber-600" : "bg-muted text-muted-foreground")}>{d.priority === "urgent" ? "فوری" : d.priority === "high" ? "مهم" : d.priority === "medium" ? "متوسط" : "عادی"}</span>
                  {isOver && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-600">عقب‌افتاده</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Modal open={addOpen} onClose={reset} title="تحویل جدید">
        <div className="space-y-3">
          <Field label="مشتری"><Select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}><option value="">انتخاب مشتری</option>{clients?.filter((c) => !c.archived).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select></Field>
          <Field label="عنوان"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثلاً لوگوی برند" /></Field>
          <Field label="توضیح"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="تاریخ تحویل"><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
            <Field label="اولویت"><Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="low">عادی</option><option value="medium">متوسط</option><option value="high">مهم</option><option value="urgent">فوری</option></Select></Field>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={submit} disabled={!form.clientId || !form.title.trim() || !form.dueDate}>افزودن</Button>
            <Button variant="ghost" onClick={reset}>لغو</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  INVOICES MODULE                                                    */
/* ================================================================== */

function InvoicesModule() {
  const invoices = useQuery(api.freelancer.listInvoices);
  const clients = useQuery(api.freelancer.listClients);
  const createInvoice = useMutation(api.freelancer.createInvoice);
  const updateInvoice = useMutation(api.freelancer.updateInvoice);
  const deleteInvoice = useMutation(api.freelancer.deleteInvoice);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ clientId: "", title: "", amount: "", currency: "IRR", dueDate: "", notes: "" });

  const clientName = useCallback((id: Id<"clients">) => clients?.find((c) => c._id === id)?.name ?? "—", [clients]);
  const reset = () => { setForm({ clientId: "", title: "", amount: "", currency: "IRR", dueDate: "", notes: "" }); setAddOpen(false); };
  const submit = async () => {
    if (!form.clientId || !form.title.trim() || !form.amount) return;
    await createInvoice({ clientId: form.clientId as Id<"clients">, title: form.title, amount: parseFloat(form.amount), currency: form.currency, status: "draft", dueDate: form.dueDate || todayKey(), notes: form.notes || undefined });
    reset();
  };

  const statusLabels: Record<string, string> = { draft: "پیش‌نویس", sent: "ارسال شده", paid: "پرداخت شده", overdue: "سررسید گذشته", cancelled: "لغو شده" };
  const statusColors: Record<string, string> = { draft: "bg-muted text-muted-foreground", sent: "bg-blue-100 text-blue-600 dark:bg-blue-500/10", paid: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10", overdue: "bg-red-100 text-red-600 dark:bg-red-500/10", cancelled: "bg-gray-100 text-gray-600" };

  const totalPaid = invoices?.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0) ?? 0;
  const totalPending = invoices?.filter((i) => i.status === "sent" || i.status === "draft").reduce((s, i) => s + i.amount, 0) ?? 0;
  const totalOverdue = invoices?.filter((i) => i.status === "overdue").reduce((s, i) => s + i.amount, 0) ?? 0;

  if (invoices === undefined) return <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold"><CreditCard className="size-4 text-emerald-600" />صورتحساب‌ها</h3>
        <Button size="sm" onClick={() => setAddOpen(true)} disabled={!clients?.length}><Plus className="size-3.5" />صورتحساب جدید</Button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-emerald-50 p-3 text-center dark:bg-emerald-500/10">
          <div className="text-lg font-extrabold text-emerald-600 tabular-nums">{formatCurrency(totalPaid)}</div>
          <div className="text-[10px] text-muted-foreground">پرداخت شده</div>
        </div>
        <div className="rounded-xl bg-blue-50 p-3 text-center dark:bg-blue-500/10">
          <div className="text-lg font-extrabold text-blue-600 tabular-nums">{formatCurrency(totalPending)}</div>
          <div className="text-[10px] text-muted-foreground">در انتظار</div>
        </div>
        <div className="rounded-xl bg-red-50 p-3 text-center dark:bg-red-500/10">
          <div className="text-lg font-extrabold text-red-600 tabular-nums">{formatCurrency(totalOverdue)}</div>
          <div className="text-[10px] text-muted-foreground">سررسید گذشته</div>
        </div>
      </div>
      {invoices.length === 0 ? (
        <EmptyState icon={CreditCard} title="هنوز صورتحسابی صادر نشده" description="صورتحساب‌ها را برای مشتریان ایجاد و وضعیت پرداخت را پیگیری کنید." action={<Button size="sm" onClick={() => setAddOpen(true)} disabled={!clients?.length}><Plus className="size-3.5" />ایجاد صورتحساب</Button>} />
      ) : (
        <div className="space-y-1.5">
          {invoices.sort((a, b) => b.createdAt - a.createdAt).map((inv) => (
            <div key={inv._id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2.5 text-xs">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{inv.title}</span>
                  <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold", statusColors[inv.status])}>{statusLabels[inv.status]}</span>
                </div>
                <div className="mt-0.5 text-muted-foreground">{clientName(inv.clientId)} · موعد: {formatDate(inv.dueDate)}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tabular-nums">{formatCurrency(inv.amount)}</span>
                <div className="flex gap-0.5">
                  {inv.status === "draft" && <button onClick={() => updateInvoice({ id: inv._id, status: "sent" })} className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-600">ارسال</button>}
                  {inv.status === "sent" && <button onClick={() => updateInvoice({ id: inv._id, status: "paid", paidAt: Date.now() })} className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600">پرداخت</button>}
                  <button onClick={() => deleteInvoice({ id: inv._id })} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={addOpen} onClose={reset} title="صورتحساب جدید">
        <div className="space-y-3">
          <Field label="مشتری"><Select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}><option value="">انتخاب مشتری</option>{clients?.filter((c) => !c.archived).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select></Field>
          <Field label="عنوان"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثلاً طراحی لوگو" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="مبلغ"><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="مبلغ" /></Field>
            <Field label="واحد"><Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}><option value="IRR">تومان</option><option value="USD">دلار</option></Select></Field>
          </div>
          <Field label="تاریخ سررسید"><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          <Field label="یادداشت"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex gap-2 pt-2">
            <Button onClick={submit} disabled={!form.clientId || !form.title.trim() || !form.amount}>ایجاد</Button>
            <Button variant="ghost" onClick={reset}>لغو</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  PROPOSALS MODULE                                                   */
/* ================================================================== */

function ProposalsModule() {
  const proposals = useQuery(api.freelancer.listProposals);
  const clients = useQuery(api.freelancer.listClients);
  const createProposal = useMutation(api.freelancer.createProposal);
  const updateProposal = useMutation(api.freelancer.updateProposal);
  const deleteProposal = useMutation(api.freelancer.deleteProposal);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ clientId: "", title: "", description: "", amount: "", currency: "IRR", validUntil: "" });

  const clientName = useCallback((id: Id<"clients">) => clients?.find((c) => c._id === id)?.name ?? "—", [clients]);
  const reset = () => { setForm({ clientId: "", title: "", description: "", amount: "", currency: "IRR", validUntil: "" }); setAddOpen(false); };
  const submit = async () => {
    if (!form.clientId || !form.title.trim() || !form.amount) return;
    await createProposal({ clientId: form.clientId as Id<"clients">, title: form.title, description: form.description || undefined, amount: parseFloat(form.amount), currency: form.currency, validUntil: form.validUntil || undefined });
    reset();
  };

  const statusLabels: Record<string, string> = { draft: "پیش‌نویس", sent: "ارسال شده", accepted: "پذیرفته شده", rejected: "رد شده", expired: "منقضی شده" };
  const statusColors: Record<string, string> = { draft: "bg-muted text-muted-foreground", sent: "bg-blue-100 text-blue-600 dark:bg-blue-500/10", accepted: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10", rejected: "bg-red-100 text-red-600 dark:bg-red-500/10", expired: "bg-gray-100 text-gray-600" };
  const acceptedAmount = proposals?.filter((p) => p.status === "accepted").reduce((s, p) => s + p.amount, 0) ?? 0;
  const pendingAmount = proposals?.filter((p) => p.status === "sent" || p.status === "draft").reduce((s, p) => s + p.amount, 0) ?? 0;

  if (proposals === undefined) return <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Send className="size-4 text-blue-600" />پیشنهادات</h3>
        <Button size="sm" onClick={() => setAddOpen(true)} disabled={!clients?.length}><Plus className="size-3.5" />پیشنهاد جدید</Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-emerald-50 p-3 text-center dark:bg-emerald-500/10">
          <div className="text-lg font-extrabold text-emerald-600 tabular-nums">{formatCurrency(acceptedAmount)}</div>
          <div className="text-[10px] text-muted-foreground">پذیرفته شده</div>
        </div>
        <div className="rounded-xl bg-blue-50 p-3 text-center dark:bg-blue-500/10">
          <div className="text-lg font-extrabold text-blue-600 tabular-nums">{formatCurrency(pendingAmount)}</div>
          <div className="text-[10px] text-muted-foreground">در انتظار</div>
        </div>
      </div>
      {proposals.length === 0 ? (
        <EmptyState icon={Send} title="هنوز پیشنهادی ارسال نشده" description="پیشنهادات کاری خود را برای مشتریان ثبت و پیگیری کنید." action={<Button size="sm" onClick={() => setAddOpen(true)} disabled={!clients?.length}><Plus className="size-3.5" />ایجاد پیشنهاد</Button>} />
      ) : (
        <div className="space-y-1.5">
          {proposals.sort((a, b) => b.createdAt - a.createdAt).map((p) => (
            <div key={p._id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2.5 text-xs">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{p.title}</span>
                  <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold", statusColors[p.status])}>{statusLabels[p.status]}</span>
                </div>
                <div className="mt-0.5 text-muted-foreground">{clientName(p.clientId)} {p.validUntil ? `· اعتبار تا ${formatDate(p.validUntil)}` : ""}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tabular-nums">{formatCurrency(p.amount)}</span>
                <div className="flex gap-0.5">
                  {p.status === "draft" && <button onClick={() => updateProposal({ id: p._id, status: "sent" })} className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-600">ارسال</button>}
                  {p.status === "sent" && <button onClick={() => updateProposal({ id: p._id, status: "accepted" })} className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600">پذیرش</button>}
                  <button onClick={() => deleteProposal({ id: p._id })} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={addOpen} onClose={reset} title="پیشنهاد جدید">
        <div className="space-y-3">
          <Field label="مشتری"><Select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}><option value="">انتخاب مشتری</option>{clients?.filter((c) => !c.archived).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select></Field>
          <Field label="عنوان"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثلاً طراحی وب‌سایت" /></Field>
          <Field label="توضیح"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="مبلغ"><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label="واحد"><Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}><option value="IRR">تومان</option><option value="USD">دلار</option></Select></Field>
          </div>
          <Field label="تاریخ اعتبار"><Input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} /></Field>
          <div className="flex gap-2 pt-2">
            <Button onClick={submit} disabled={!form.clientId || !form.title.trim() || !form.amount}>ایجاد</Button>
            <Button variant="ghost" onClick={reset}>لغو</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  FREELANCER ANALYTICS                                               */
/* ================================================================== */

function FreelancerAnalytics() {
  const clients = useQuery(api.freelancer.listClients);
  const invoices = useQuery(api.freelancer.listInvoices);
  const entries = useQuery(api.freelancer.listTimeEntries);
  const deliverables = useQuery(api.freelancer.listDeliverables);
  const proposals = useQuery(api.freelancer.listProposals);
  const tasks = useWorkspace().tasks;

  if (!clients || !invoices || !entries || !deliverables || !proposals) return <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  const activeClients = clients.filter((c) => !c.archived).length;
  const totalRevenue = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const totalPending = invoices.filter((i) => i.status === "sent" || i.status === "draft").reduce((s, i) => s + i.amount, 0);
  const totalOverdue = invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.amount, 0);
  const acceptanceRate = proposals.length > 0 ? Math.round((proposals.filter((p) => p.status === "accepted").length / proposals.length) * 100) : 0;
  const completionRate = deliverables.length > 0 ? Math.round((deliverables.filter((d) => d.status === "approved" || d.status === "delivered").length / deliverables.length) * 100) : 0;
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekSeconds = entries.filter((e) => new Date(e.date) >= weekStart).reduce((s, e) => s + e.duration, 0);

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-bold"><TrendingUp className="size-4 text-violet-600" />تحلیل فریلنسری</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-violet-50 p-3 text-center dark:bg-violet-500/10">
          <div className="text-lg font-extrabold text-violet-600 tabular-nums">{toFa(activeClients)}</div>
          <div className="text-[10px] text-muted-foreground">مشتری فعال</div>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center dark:bg-emerald-500/10">
          <div className="text-lg font-extrabold text-emerald-600 tabular-nums">{formatCurrency(totalRevenue)}</div>
          <div className="text-[10px] text-muted-foreground">درآمد</div>
        </div>
        <div className="rounded-xl bg-cyan-50 p-3 text-center dark:bg-cyan-500/10">
          <div className="text-lg font-extrabold text-cyan-600 tabular-nums">{Math.round(weekSeconds / 3600)}h</div>
          <div className="text-[10px] text-muted-foreground">ساعت این هفته</div>
        </div>
        <div className="rounded-xl bg-amber-50 p-3 text-center dark:bg-amber-500/10">
          <div className="text-lg font-extrabold text-amber-600 tabular-nums">{toFa(acceptanceRate)}٪</div>
          <div className="text-[10px] text-muted-foreground">نرخ پذیرش</div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border/60 p-4">
          <h4 className="mb-2 text-xs font-bold">درآمد و پرداخت</h4>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">پرداخت شده</span><span className="font-extrabold text-emerald-600">{formatCurrency(totalRevenue)}</span></div>
            <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">در انتظار</span><span className="font-extrabold text-blue-600">{formatCurrency(totalPending)}</span></div>
            <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">سررسید گذشته</span><span className="font-extrabold text-red-600">{formatCurrency(totalOverdue)}</span></div>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 p-4">
          <h4 className="mb-2 text-xs font-bold">عملکرد</h4>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">نرخ پذیرش پیشنهادات</span><span className="font-extrabold">{toFa(acceptanceRate)}٪</span></div>
            <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">نرخ تکمیل تحویل‌ها</span><span className="font-extrabold">{toFa(completionRate)}٪</span></div>
            <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">کل پیشنهادات</span><span className="font-extrabold">{toFa(proposals.length)}</span></div>
            <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">کل تحویل‌ها</span><span className="font-extrabold">{toFa(deliverables.length)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  MAIN FREELANCER WORKSPACE                                          */
/* ================================================================== */

export function FreelancerWorkspace() {
  const { tasks, projects, toggleDone, deleteTask, openTask, createTask } = useWorkspace();
  const [activeTab, setActiveTab] = useState<"dashboard" | "clients" | "projects" | "time" | "deliverables" | "invoices" | "proposals" | "analytics">("dashboard");

  const tKey = todayKey();
  const root = tasks.filter((t) => !t.parentId);
  const todayTasks = root.filter((t) => t.dueDate === tKey && t.status !== "done");
  const overdue = root.filter((t) => isOverdue(t));
  const allToday = root.filter((t) => t.dueDate === tKey);
  const completed = allToday.filter((t) => t.status === "done").length;
  const pct = allToday.length ? Math.round((completed / allToday.length) * 100) : 0;

  const subtotals = useMemo(() => {
    const m = new Map<string, { total: number; done: number }>();
    for (const t of tasks) { if (!t.parentId) continue; const cur = m.get(t.parentId) ?? { total: 0, done: 0 }; cur.total++; if (t.status === "done") cur.done++; m.set(t.parentId, cur); }
    return m;
  }, [tasks]);
  const projectOf = (id?: string) => projects.find((p) => p._id === id);

  const TABS = [
    { key: "dashboard" as const, label: "داشبورد", icon: LayoutDashboard },
    { key: "clients" as const, label: "مشتریان", icon: Users },
    { key: "projects" as const, label: "پروژه‌ها", icon: FolderKanban },
    { key: "time" as const, label: "زمان", icon: Clock },
    { key: "deliverables" as const, label: "تحویل‌ها", icon: Briefcase },
    { key: "invoices" as const, label: "صورتحساب", icon: CreditCard },
    { key: "proposals" as const, label: "پیشنهادات", icon: Send },
    { key: "analytics" as const, label: "تحلیل", icon: TrendingUp },
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

      {activeTab === "dashboard" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "کارهای امروز", value: allToday.length, icon: ListChecks, color: "text-foreground" },
              { label: "عقب‌افتاده", value: overdue.length, icon: AlertCircle, color: "text-red-500" },
              { label: "پروژه‌های فعال", value: projects.filter((p) => p.status !== "completed").length, icon: FolderKanban, color: "text-blue-600" },
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
          {overdue.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50/50 p-3 dark:border-red-500/20 dark:bg-red-500/5">
              <div className="flex items-center gap-2"><AlertCircle className="size-4 text-red-500" /><span className="text-sm font-bold text-red-700 dark:text-red-300">{toFa(overdue.length)} کار عقب‌افتاده</span></div>
            </div>
          )}
          <section className="ui-surface overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-bold"><span className="ui-icon-tile size-6"><ListChecks className="size-3.5 text-primary" /></span>کارهای امروز</h2>
            </div>
            {allToday.length === 0 ? (
              <div className="px-4 py-8 text-center"><p className="text-sm font-semibold">برنامه امروز خالی است!</p></div>
            ) : (
              <ul>{allToday.map((t: any) => <TaskRow key={t._id} task={t} project={projectOf(t.projectId)} subtaskTotal={subtotals.get(t._id)?.total} subtaskDone={subtotals.get(t._id)?.done} onToggle={(done) => toggleDone(t, done)} onOpen={() => openTask(t._id)} onDelete={() => deleteTask(t._id)} />)}</ul>
            )}
          </section>
          <SmartTaskInput onCreate={(p) => createTask({ title: p.title, dueDate: p.dueDate, dueTime: p.dueTime, priority: p.priority, tags: p.tags })} />
        </div>
      )}

      {activeTab === "clients" && <ClientsModule />}
      {activeTab === "projects" && (
        <div className="space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-bold"><FolderKanban className="size-4 text-blue-600" />پروژه‌ها</h3>
          {projects.filter((p) => p.status !== "completed").length === 0 ? (
            <EmptyState icon={FolderKanban} title="هنوز پروژه‌ای ندارید" description="پروژه‌ها را ایجاد کنید و آنها را به مشتریان متصل کنید." />
          ) : (
            <div className="space-y-2">
              {projects.filter((p) => p.status !== "completed").map((p) => {
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
      {activeTab === "time" && <TimeTrackingModule />}
      {activeTab === "deliverables" && <DeliverablesModule />}
      {activeTab === "invoices" && <InvoicesModule />}
      {activeTab === "proposals" && <ProposalsModule />}
      {activeTab === "analytics" && <FreelancerAnalytics />}
    </WorkspaceLayout>
  );
}
