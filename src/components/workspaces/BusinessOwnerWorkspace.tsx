import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { CapabilityGate } from "@/components/progress/UnlockCenter";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { TaskRow } from "@/components/tasks/TaskRow";
import { SmartTaskInput } from "@/components/tasks/SmartTaskInput";
import { WorkspaceLayout } from "./WorkspaceLayout";
import { PersonaStatsStrip } from "@/components/progress/PersonaStats";
import { Button } from "@/components/ui/button";
import { toFa } from "@/lib/persian";
import { todayKey, isOverdue } from "@/lib/task-utils";
import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Plus, CheckCircle2, AlertCircle, TrendingUp, TrendingDown, X,
  Search, Trash2, Pencil, DollarSign, Users, FolderKanban,
  Target, BarChart3, Activity, Circle, Briefcase, CreditCard,
  ArrowUpRight, Handshake, Receipt, Zap, CircleDot, CalendarDays,
  ShoppingCart, BarChart, PieChart, Banknote, Scale, AlertTriangle,
  CheckCircle, Eye, LayoutDashboard, ListChecks,
} from "lucide-react";

/* ================================================================== */
/*  HELPERS                                                            */
/* ================================================================== */

function daysUntil(dateStr: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("fa-IR").format(n);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ================================================================== */
/*  TAB CONFIG                                                         */
/* ================================================================== */

const TABS = [
  { key: "dashboard", label: "داشبورد", icon: LayoutDashboard },
  { key: "customers", label: "مشتریان", icon: Users },
  { key: "sales", label: "فروش", icon: ShoppingCart },
  { key: "finance", label: "مالی", icon: DollarSign },
  { key: "projects", label: "پروژه‌ها", icon: FolderKanban },
  { key: "goals", label: "اهداف", icon: Target },
  { key: "operations", label: "عملیات", icon: Activity },
  { key: "payments", label: "پرداخت‌ها", icon: CreditCard },
  { key: "initiatives", label: "ابتکارات", icon: Zap },
  { key: "analytics", label: "تحلیل", icon: BarChart3 },
] as const;

type TabKey = typeof TABS[number]["key"];

/* Status labels */
const CUSTOMER_STATUS: Record<string, { label: string; color: string }> = {
  lead: { label: "سرنخ", color: "bg-blue-100 text-blue-700" },
  prospect: { label: "مشتری احتمالی", color: "bg-violet-100 text-violet-700" },
  active: { label: "فعال", color: "bg-emerald-100 text-emerald-700" },
  inactive: { label: "غیرفعال", color: "bg-gray-100 text-gray-600" },
  lost: { label: "از‌دست‌رفته", color: "bg-rose-100 text-rose-700" },
};

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  lead: { label: "سرنخ", color: "bg-blue-100 text-blue-700" },
  contacted: { label: "تماس‌گرفته", color: "bg-cyan-100 text-cyan-700" },
  qualified: { label: "تأییدشده", color: "bg-violet-100 text-violet-700" },
  proposal: { label: "پیشنهاد", color: "bg-amber-100 text-amber-700" },
  negotiation: { label: "مذاکره", color: "bg-orange-100 text-orange-700" },
  won: { label: "برنده", color: "bg-emerald-100 text-emerald-700" },
  lost: { label: "بازنده", color: "bg-rose-100 text-rose-700" },
};

const PAYMENT_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "در‌انتظار", color: "bg-amber-100 text-amber-700" },
  paid: { label: "پرداخت‌شده", color: "bg-emerald-100 text-emerald-700" },
  partial: { label: "جزئی", color: "bg-blue-100 text-blue-700" },
  overdue: { label: "سررسیدگذشته", color: "bg-rose-100 text-rose-700" },
  cancelled: { label: "لغوشده", color: "bg-gray-100 text-gray-600" },
};

const REVENUE_STATUS: Record<string, { label: string; color: string }> = {
  expected: { label: "انتظار", color: "bg-blue-100 text-blue-700" },
  invoiced: { label: "صورتحساب", color: "bg-amber-100 text-amber-700" },
  received: { label: "دریافت‌شده", color: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "لغوشده", color: "bg-gray-100 text-gray-600" },
};

const EXPENSE_CATEGORIES: Record<string, string> = {
  marketing: "بازاریابی", operations: "عملیات", software: "نرم‌افزار",
  equipment: "تجهیزات", personnel: "پرسنل", services: "خدمات", other: "سایر",
};

const GOAL_TYPES: Record<string, string> = {
  numeric: "عددی", completion: "تکمیلی", milestone: "نقته‌عطفی", binary: "دوبُعدی",
};

const INITIATIVE_STATUS: Record<string, { label: string; color: string }> = {
  planning: { label: "برنامه‌ریزی", color: "bg-blue-100 text-blue-700" },
  in_progress: { label: "درحال‌اجرا", color: "bg-amber-100 text-amber-700" },
  completed: { label: "تکمیل", color: "bg-emerald-100 text-emerald-700" },
  paused: { label: "متوقف", color: "bg-gray-100 text-gray-600" },
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-rose-100 text-rose-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-emerald-100 text-emerald-700",
};

/* ================================================================== */
/*  EmptyState                                                         */
/* ================================================================== */

function EmptyState({ icon: Icon, title, description, action }: {
  icon: React.FC<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-white/40 py-12 text-center">
      <Icon className="mb-3 size-8 text-muted-foreground/40" />
      <p className="mb-1 text-sm font-bold text-foreground/70">{title}</p>
      <p className="mb-4 max-w-xs text-xs text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

/* ================================================================== */
/*  MODAL                                                              */
/* ================================================================== */

function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-white p-6 shadow-xl dark:bg-slate-900" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-extrabold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted"><X className="size-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  MAIN COMPONENT                                                     */
/* ================================================================== */

export function BusinessOwnerWorkspace() {
  const { tasks, projects, toggleDone, openTask, deleteTask, createTask } = useWorkspace();
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");

  /* Convex queries */
  const customers = useQuery(api.business.listCustomers) ?? [];
  const sales = useQuery(api.business.listSales) ?? [];
  const revenue = useQuery(api.business.listRevenue) ?? [];
  const expenses = useQuery(api.business.listExpenses) ?? [];
  const payments = useQuery(api.business.listPayments) ?? [];
  const goals = useQuery(api.business.listBusinessGoals) ?? [];
  const initiatives = useQuery(api.business.listInitiatives) ?? [];

  /* Mutations */
  const createCustomer = useMutation(api.business.createCustomer);
  const updateCustomer = useMutation(api.business.updateCustomer);
  const deleteCustomer = useMutation(api.business.deleteCustomer);
  const createSale = useMutation(api.business.createSale);
  const updateSale = useMutation(api.business.updateSale);
  const deleteSale = useMutation(api.business.deleteSale);
  const createRevenue = useMutation(api.business.createRevenue);
  const updateRevenue = useMutation(api.business.updateRevenue);
  const deleteRevenue = useMutation(api.business.deleteRevenue);
  const createExpense = useMutation(api.business.createExpense);
  const updateExpense = useMutation(api.business.updateExpense);
  const deleteExpense = useMutation(api.business.deleteExpense);
  const createPayment = useMutation(api.business.createPayment);
  const updatePayment = useMutation(api.business.updatePayment);
  const deletePayment = useMutation(api.business.deletePayment);
  const createGoal = useMutation(api.business.createBusinessGoal);
  const updateGoal = useMutation(api.business.updateBusinessGoal);
  const deleteGoal = useMutation(api.business.deleteBusinessGoal);
  const createInit = useMutation(api.business.createInitiative);
  const updateInit = useMutation(api.business.updateInitiative);
  const deleteInit = useMutation(api.business.deleteInitiative);

  /* Modal states */
  const [modals, setModals] = useState<Record<string, boolean>>({});
  const openModal = (key: string) => setModals(m => ({ ...m, [key]: true }));
  const closeModal = (key: string) => setModals(m => ({ ...m, [key]: false }));

  /* Computed metrics */
  const metrics = useMemo(() => {
    const todayKey_ = today();
    const received = revenue.filter(r => r.status === "received").reduce((s, r) => s + r.amount, 0);
    const expected = revenue.filter(r => r.status === "expected" || r.status === "invoiced").reduce((s, r) => s + r.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const pendingIncoming = payments.filter(p => p.type === "incoming" && p.status === "pending").reduce((s, p) => s + p.amount, 0);
    const pendingOutgoing = payments.filter(p => p.type === "outgoing" && p.status === "pending").reduce((s, p) => s + p.amount, 0);
    const overduePayments = payments.filter(p => p.status === "overdue").length;
    const activeSales = sales.filter(s => s.stage !== "won" && s.stage !== "lost");
    const wonSales = sales.filter(s => s.stage === "won");
    const pipelineValue = activeSales.reduce((s, o) => s + o.value, 0);
    const activeCustomers = customers.filter(c => c.status === "active").length;
    const overdueTasks = tasks.filter(t => t.status !== "done" && t.dueDate && isOverdue(t)).length;
    const completedTasks = tasks.filter(t => t.status === "done").length;
    const totalTasks = tasks.length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const activeProjects = projects.length;
    const activeGoals = goals.filter(g => g.status === "active");
    const overdueGoals = goals.filter(g => g.status === "at_risk");

    return {
      received, expected, totalExpenses, pendingIncoming, pendingOutgoing,
      overduePayments, activeSales: activeSales.length, wonSales: wonSales.length,
      pipelineValue, activeCustomers, overdueTasks, completedTasks, totalTasks,
      completionRate, activeProjects, activeGoals: activeGoals.length, overdueGoals: overdueGoals.length,
    };
  }, [revenue, expenses, payments, sales, customers, tasks, projects, goals]);

  /* Tab content */
  const renderContent = () => {
    switch (activeTab) {
      case "dashboard": return <DashboardTab metrics={metrics} tasks={tasks} projects={projects} goals={goals} revenue={revenue} expenses={expenses} payments={payments} sales={sales} customers={customers} toggleDone={toggleDone} openTask={openTask} deleteTask={deleteTask} createTask={createTask} />;
      case "customers": return <CustomersTab customers={customers} createCustomer={createCustomer} updateCustomer={updateCustomer} deleteCustomer={deleteCustomer} />;
      case "sales": return <SalesTab sales={sales} customers={customers} createSale={createSale} updateSale={updateSale} deleteSale={deleteSale} />;
      case "finance": return <FinanceTab revenue={revenue} expenses={expenses} createRevenue={createRevenue} updateRevenue={updateRevenue} deleteRevenue={deleteRevenue} createExpense={createExpense} updateExpense={updateExpense} deleteExpense={deleteExpense} />;
      case "projects": return <ProjectsTab projects={projects} tasks={tasks} />;
      case "goals": return <GoalsTab goals={goals} createGoal={createGoal} updateGoal={updateGoal} deleteGoal={deleteGoal} />;
      case "operations": return <OperationsTab tasks={tasks} projects={projects} toggleDone={toggleDone} openTask={openTask} deleteTask={deleteTask} />;
      case "payments": return <PaymentsTab payments={payments} createPayment={createPayment} updatePayment={updatePayment} deletePayment={deletePayment} />;
      case "initiatives": return <InitiativesTab initiatives={initiatives} goals={goals} projects={projects} createInit={createInit} updateInit={updateInit} deleteInit={deleteInit} />;
      case "analytics":
        return (
          <CapabilityGate featureKey="business_analytics">
            <AnalyticsTab metrics={metrics} revenue={revenue} expenses={expenses} sales={sales} goals={goals} />
          </CapabilityGate>
        );
      default: return null;
    }
  };

  return (
    <WorkspaceLayout>
      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border/60 bg-white/50 p-1 dark:bg-white/5">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all",
                activeTab === t.key ? "bg-primary text-primary-shadow shadow-sm" : "text-muted-foreground hover:bg-muted/60"
              )}>
              <Icon className="size-3.5" />{t.label}
            </button>
          );
        })}
      </div>
      {renderContent()}
    </WorkspaceLayout>
  );
}

/* ================================================================== */
/*  DASHBOARD                                                          */
/* ================================================================== */

interface BizMetrics {
  received: number; expected: number; totalExpenses: number;
  pendingIncoming: number; pendingOutgoing: number; overduePayments: number;
  activeSales: number; wonSales: number; pipelineValue: number;
  activeCustomers: number; overdueTasks: number; completedTasks: number;
  totalTasks: number; completionRate: number; activeProjects: number;
  activeGoals: number; overdueGoals: number;
}

function DashboardTab({ metrics, tasks, projects, goals, revenue, expenses, payments, sales, customers, toggleDone, openTask, deleteTask, createTask }: {
  metrics: BizMetrics;
  tasks: any[]; projects: any[]; goals: any[];
  revenue: any[]; expenses: any[]; payments: any[]; sales: any[]; customers: any[];
  toggleDone: any; openTask: any; deleteTask: any; createTask: any;
}) {
  const todayTasks = tasks.filter(t => t.status !== "done");
  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard icon={DollarSign} label="درآمد دریافتی" value={fmtCurrency(metrics.received)} color="text-emerald-600" />
        <MetricCard icon={TrendingDown} label="هزینه‌ها" value={fmtCurrency(metrics.totalExpenses)} color="text-rose-600" />
        <MetricCard icon={Users} label="مشتریان فعال" value={toFa(metrics.activeCustomers)} color="text-blue-600" />
        <MetricCard icon={Target} label="اهداف فعال" value={toFa(metrics.activeGoals)} color="text-violet-600" />
      </div>

      <PersonaStatsStrip />

      {/* Second row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard icon={FolderKanban} label="پروژه‌ها" value={toFa(metrics.activeProjects)} color="text-amber-600" />
        <MetricCard icon={Handshake} label="فرصت‌های فروش" value={toFa(metrics.activeSales)} color="text-cyan-600" />
        <MetricCard icon={AlertTriangle} label="کارهای عقب‌افتاده" value={toFa(metrics.overdueTasks)} color="text-rose-600" />
        <MetricCard icon={CheckCircle2} label="نرخ تکمیل" value={`${toFa(metrics.completionRate)}%`} color="text-emerald-600" />
      </div>

      {/* Financial Overview */}
      <div className="rounded-xl border border-border/60 bg-white/60 p-4 dark:bg-white/5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold">
          <Banknote className="size-4 text-emerald-600" />نمای کلی مالی
        </h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div><p className="text-xs text-muted-foreground">درآمد انتظاری</p><p className="text-sm font-bold text-blue-600">{fmtCurrency(metrics.expected)}</p></div>
          <div><p className="text-xs text-muted-foreground">پرداخت‌های دریافتی</p><p className="text-sm font-bold text-emerald-600">{fmtCurrency(metrics.pendingIncoming)}</p></div>
          <div><p className="text-xs text-muted-foreground">پرداخت‌های خروجی</p><p className="text-sm font-bold text-rose-600">{fmtCurrency(metrics.pendingOutgoing)}</p></div>
          <div><p className="text-xs text-muted-foreground">پرداخت‌های سررسیدگذشته</p><p className="text-sm font-bold text-rose-600">{toFa(metrics.overduePayments)}</p></div>
        </div>
        <div className="mt-3 rounded-lg bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">ارزش خط لوله فروش</p>
          <p className="text-lg font-extrabold">{fmtCurrency(metrics.pipelineValue)}</p>
        </div>
      </div>

      {/* Today's Tasks */}
      <div className="rounded-xl border border-border/60 bg-white/60 p-4 dark:bg-white/5">
        <h3 className="mb-3 text-sm font-extrabold">کارهای جاری</h3>
        {todayTasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">کار فعالی وجود ندارد.</p>
        ) : (
          <div className="space-y-2">
            {todayTasks.slice(0, 8).map(t => <TaskRow key={t._id} task={t} onToggle={(done) => toggleDone(t, done)} onOpen={() => openTask(t._id)} onDelete={() => deleteTask(t._id)} />)}
          </div>
        )}
      </div>

      {/* Goal Progress */}
      {goals.filter(g => g.status === "active").length > 0 && (
        <div className="rounded-xl border border-border/60 bg-white/60 p-4 dark:bg-white/5">
          <h3 className="mb-3 text-sm font-extrabold">پیشرفت اهداف</h3>
          <div className="space-y-3">
            {goals.filter(g => g.status === "active").slice(0, 4).map(g => (
              <div key={g._id}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{g.title}</span>
                  <span className="text-[10px] text-muted-foreground">{toFa(g.progress)}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${g.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <SmartTaskInput onCreate={(p) => createTask({ title: p.title, dueDate: p.dueDate, dueTime: p.dueTime, priority: p.priority, tags: p.tags })} />
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color }: {
  icon: React.FC<{ className?: string }>; label: string; value: string; color: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-white/60 p-3 dark:bg-white/5">
      <div className="flex items-center gap-2">
        <div className={cn("rounded-lg bg-muted/60 p-1.5", color)}><Icon className="size-3.5" /></div>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 text-lg font-extrabold">{value}</p>
    </div>
  );
}

/* ================================================================== */
/*  CUSTOMERS                                                          */
/* ================================================================== */

function CustomersTab({ customers, createCustomer, updateCustomer, deleteCustomer }: {
  customers: any[]; createCustomer: any; updateCustomer: any; deleteCustomer: any;
}) {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "", status: "lead", source: "", tags: "", notes: "", color: "bg-blue-500" });

  const filtered = useMemo(() => {
    if (!search) return customers;
    const q = search.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q));
  }, [customers, search]);

  const handleSubmit = async () => {
    await createCustomer({
      name: form.name, company: form.company || undefined, email: form.email || undefined,
      phone: form.phone || undefined, status: form.status, source: form.source || undefined,
      tags: form.tags ? form.tags.split(",").map((t: string) => t.trim()) : [],
      notes: form.notes || undefined, color: form.color,
    });
    setAddOpen(false);
    setForm({ name: "", company: "", email: "", phone: "", status: "lead", source: "", tags: "", notes: "", color: "bg-blue-500" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold">مشتریان</h3>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو..." className="rounded-lg border border-border/60 bg-white/60 py-1.5 pr-7 pl-2 text-xs dark:bg-white/5" />
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />افزودن</Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="هنوز مشتری ندارید" description="اولین مشتری خود را اضافه کنید تا مدیریت کسب‌وکار شروع شود." action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />افزودن مشتری</Button>} />
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c._id} className="flex items-center justify-between rounded-xl border border-border/60 p-3">
              <div className="flex items-center gap-3">
                <div className={cn("size-8 rounded-full", c.color || "bg-blue-500")} />
                <div>
                  <p className="text-sm font-bold">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground">{c.company || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold", CUSTOMER_STATUS[c.status]?.color)}>
                  {CUSTOMER_STATUS[c.status]?.label}
                </span>
                <button onClick={() => { setEditItem(c); setForm({ name: c.name, company: c.company || "", email: c.email || "", phone: c.phone || "", status: c.status, source: c.source || "", tags: c.tags?.join(", ") || "", notes: c.notes || "", color: c.color || "bg-blue-500" }); }} className="rounded p-1 hover:bg-muted"><Pencil className="size-3" /></button>
                <button onClick={() => deleteCustomer({ id: c._id })} className="rounded p-1 hover:bg-rose-50"><Trash2 className="size-3 text-rose-500" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={addOpen || !!editItem} onClose={() => { setAddOpen(false); setEditItem(null); }} title={editItem ? "ویرایش مشتری" : "مشتری جدید"}>
        <div className="space-y-3">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="نام مشتری" className="w-full rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5" />
          <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="شرکت" className="w-full rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5" />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="ایمیل" className="rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5" />
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="تلفن" className="rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5" />
          </div>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5">
            {Object.entries(CUSTOMER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <div className="flex gap-1">
            {["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500"].map(c => (
              <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} className={cn("size-6 rounded-full border-2", c, form.color === c ? "border-foreground" : "border-transparent")} />
            ))}
          </div>
          <Button size="sm" className="w-full" onClick={handleSubmit}>{editItem ? "ذخیره" : "افزودن"}</Button>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  SALES PIPELINE                                                     */
/* ================================================================== */

function SalesTab({ sales, customers, createSale, updateSale, deleteSale }: {
  sales: any[]; customers: any[]; createSale: any; updateSale: any; deleteSale: any;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ title: "", value: "", customerId: "", stage: "lead", expectedCloseDate: "", notes: "" });

  const pipelineValue = sales.filter(s => s.stage !== "won" && s.stage !== "lost").reduce((s, o) => s + o.value, 0);
  const wonCount = sales.filter(s => s.stage === "won").length;
  const lostCount = sales.filter(s => s.stage === "lost").length;
  const activeCount = sales.length - wonCount - lostCount;

  const handleSubmit = async () => {
    const data = {
      title: form.title, value: Number(form.value) || 0, currency: "تومان",
      stage: form.stage, customerId: form.customerId || undefined,
      expectedCloseDate: form.expectedCloseDate || undefined, notes: form.notes || undefined,
    };
    if (editItem) { await updateSale({ id: editItem._id, ...data }); }
    else { await createSale(data); }
    setAddOpen(false); setEditItem(null);
    setForm({ title: "", value: "", customerId: "", stage: "lead", expectedCloseDate: "", notes: "" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold">خط لوله فروش</h3>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />فرصت جدید</Button>
      </div>

      {/* Pipeline stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard icon={ShoppingCart} label="فرصت‌های فعال" value={toFa(activeCount)} color="text-blue-600" />
        <MetricCard icon={TrendingUp} label="برنده" value={toFa(wonCount)} color="text-emerald-600" />
        <MetricCard icon={TrendingDown} label="بازنده" value={toFa(lostCount)} color="text-rose-600" />
        <MetricCard icon={Banknote} label="ارزش خط لوله" value={fmtCurrency(pipelineValue)} color="text-violet-600" />
      </div>

      {sales.length === 0 ? (
        <EmptyState icon={Handshake} title="هنوز فرصتی ثبت نشده" description="اولین فرصت فروش خود را اضافه کنید." action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />افزودن فرصت</Button>} />
      ) : (
        <div className="space-y-2">
          {sales.map(s => (
            <div key={s._id} className="flex items-center justify-between rounded-xl border border-border/60 p-3">
              <div>
                <p className="text-sm font-bold">{s.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {fmtCurrency(s.value)} تومان {s.expectedCloseDate && `— تا ${s.expectedCloseDate}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold", STAGE_LABELS[s.stage]?.color)}>
                  {STAGE_LABELS[s.stage]?.label}
                </span>
                <select value={s.stage} onChange={e => updateSale({ id: s._id, stage: e.target.value })}
                  className="rounded border border-border/60 bg-white/60 px-1 py-0.5 text-[9px] dark:bg-white/5">
                  {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <button onClick={() => { setEditItem(s); setForm({ title: s.title, value: String(s.value), customerId: s.customerId || "", stage: s.stage, expectedCloseDate: s.expectedCloseDate || "", notes: s.notes || "" }); }} className="rounded p-1 hover:bg-muted"><Pencil className="size-3" /></button>
                <button onClick={() => deleteSale({ id: s._id })} className="rounded p-1 hover:bg-rose-50"><Trash2 className="size-3 text-rose-500" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={addOpen || !!editItem} onClose={() => { setAddOpen(false); setEditItem(null); }} title={editItem ? "ویرایش فرصت" : "فرصت فروش جدید"}>
        <div className="space-y-3">
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="نام فرصت" className="w-full rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5" />
          <input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="مبلغ (تومان)" className="w-full rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5" />
          <select value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))} className="w-full rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5">
            <option value="">مشتری (اختیاری)</option>
            {customers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))} className="w-full rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5">
            {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <input type="date" value={form.expectedCloseDate} onChange={e => setForm(f => ({ ...f, expectedCloseDate: e.target.value }))} className="w-full rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5" />
          <Button size="sm" className="w-full" onClick={handleSubmit}>{editItem ? "ذخیره" : "افزودن"}</Button>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  FINANCE (Revenue + Expenses)                                       */
/* ================================================================== */

function FinanceTab({ revenue, expenses, createRevenue, updateRevenue, deleteRevenue, createExpense, updateExpense, deleteExpense }: {
  revenue: any[]; expenses: any[];
  createRevenue: any; updateRevenue: any; deleteRevenue: any;
  createExpense: any; updateExpense: any; deleteExpense: any;
}) {
  const [subTab, setSubTab] = useState<"revenue" | "expenses">("revenue");
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);

  const [revForm, setRevForm] = useState({ title: "", amount: "", status: "expected", category: "", date: today(), notes: "" });
  const [expForm, setExpForm] = useState({ title: "", amount: "", category: "operations", date: today(), notes: "" });

  const totalRevenue = revenue.filter(r => r.status === "received").reduce((s, r) => s + r.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  const handleRevSubmit = async () => {
    const data = { title: revForm.title, amount: Number(revForm.amount) || 0, currency: "تومان", status: revForm.status, date: revForm.date, category: revForm.category || undefined, notes: revForm.notes || undefined };
    if (editItem) { await updateRevenue({ id: editItem._id, ...data }); }
    else { await createRevenue(data); }
    setAddOpen(false); setEditItem(null);
    setRevForm({ title: "", amount: "", status: "expected", category: "", date: today(), notes: "" });
  };

  const handleExpSubmit = async () => {
    const data = { title: expForm.title, amount: Number(expForm.amount) || 0, currency: "تومان", category: expForm.category, date: expForm.date, notes: expForm.notes || undefined };
    if (editItem) { await updateExpense({ id: editItem._id, ...data }); }
    else { await createExpense(data); }
    setAddOpen(false); setEditItem(null);
    setExpForm({ title: "", amount: "", category: "operations", date: today(), notes: "" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold">مالی</h3>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />افزودن</Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:bg-emerald-900/10">
          <p className="text-xs text-emerald-700">درآمد</p>
          <p className="text-lg font-extrabold text-emerald-700">{fmtCurrency(totalRevenue)}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 dark:bg-rose-900/10">
          <p className="text-xs text-rose-700">هزینه‌ها</p>
          <p className="text-lg font-extrabold text-rose-700">{fmtCurrency(totalExpenses)}</p>
        </div>
      </div>

      <div className="flex gap-1 rounded-lg border border-border/60 bg-white/50 p-1">
        {(["revenue", "expenses"] as const).map(st => (
          <button key={st} onClick={() => setSubTab(st)}
            className={cn("flex-1 rounded-md px-3 py-1.5 text-xs font-bold transition-all", subTab === st ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60")}>
            {st === "revenue" ? "درآمد" : "هزینه‌ها"}
          </button>
        ))}
      </div>

      {subTab === "revenue" ? (
        revenue.length === 0 ? (
          <EmptyState icon={DollarSign} title="هنوز درآمدی ثبت نشده" description="اولین درآمد خود را ثبت کنید." action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />افزودن درآمد</Button>} />
        ) : (
          <div className="space-y-2">
            {revenue.map(r => (
              <div key={r._id} className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                <div>
                  <p className="text-sm font-bold">{r.title}</p>
                  <p className="text-[10px] text-muted-foreground">{fmtCurrency(r.amount)} تومان — {r.date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold", REVENUE_STATUS[r.status]?.color)}>{REVENUE_STATUS[r.status]?.label}</span>
                  <button onClick={() => { setEditItem(r); setRevForm({ title: r.title, amount: String(r.amount), status: r.status, category: r.category || "", date: r.date, notes: r.notes || "" }); }} className="rounded p-1 hover:bg-muted"><Pencil className="size-3" /></button>
                  <button onClick={() => deleteRevenue({ id: r._id })} className="rounded p-1 hover:bg-rose-50"><Trash2 className="size-3 text-rose-500" /></button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        expenses.length === 0 ? (
          <EmptyState icon={Receipt} title="هنوز هزینه‌ای ثبت نشده" description="هزینه‌های خود را ثبت کنید." action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />افزودن هزینه</Button>} />
        ) : (
          <div className="space-y-2">
            {expenses.map(e => (
              <div key={e._id} className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                <div>
                  <p className="text-sm font-bold">{e.title}</p>
                  <p className="text-[10px] text-muted-foreground">{fmtCurrency(e.amount)} تومان — {EXPENSE_CATEGORIES[e.category] || e.category}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditItem(e); setExpForm({ title: e.title, amount: String(e.amount), category: e.category, date: e.date, notes: e.notes || "" }); }} className="rounded p-1 hover:bg-muted"><Pencil className="size-3" /></button>
                  <button onClick={() => deleteExpense({ id: e._id })} className="rounded p-1 hover:bg-rose-50"><Trash2 className="size-3 text-rose-500" /></button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      <Modal open={addOpen || !!editItem} onClose={() => { setAddOpen(false); setEditItem(null); }} title={editItem ? "ویرایش" : (subTab === "revenue" ? "درآمد جدید" : "هزینه جدید")}>
        {subTab === "revenue" ? (
          <div className="space-y-3">
            <input value={revForm.title} onChange={e => setRevForm(f => ({ ...f, title: e.target.value }))} placeholder="عنوان" className="w-full rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5" />
            <input type="number" value={revForm.amount} onChange={e => setRevForm(f => ({ ...f, amount: e.target.value }))} placeholder="مبلغ (تومان)" className="w-full rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5" />
            <select value={revForm.status} onChange={e => setRevForm(f => ({ ...f, status: e.target.value }))} className="w-full rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5">
              {Object.entries(REVENUE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <input type="date" value={revForm.date} onChange={e => setRevForm(f => ({ ...f, date: e.target.value }))} className="w-full rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5" />
            <Button size="sm" className="w-full" onClick={handleRevSubmit}>{editItem ? "ذخیره" : "افزودن"}</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <input value={expForm.title} onChange={e => setExpForm(f => ({ ...f, title: e.target.value }))} placeholder="عنوان" className="w-full rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5" />
            <input type="number" value={expForm.amount} onChange={e => setExpForm(f => ({ ...f, amount: e.target.value }))} placeholder="مبلغ (تومان)" className="w-full rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5" />
            <select value={expForm.category} onChange={e => setExpForm(f => ({ ...f, category: e.target.value }))} className="w-full rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5">
              {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="date" value={expForm.date} onChange={e => setExpForm(f => ({ ...f, date: e.target.value }))} className="w-full rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5" />
            <Button size="sm" className="w-full" onClick={handleExpSubmit}>{editItem ? "ذخیره" : "افزودن"}</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  PROJECTS                                                           */
/* ================================================================== */

function ProjectsTab({ projects, tasks }: { projects: any[]; tasks: any[] }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-extrabold">پورتفولیوی پروژه‌ها</h3>
      {projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="هنوز پروژه‌ای وجود ندارد" description="اولین پروژه خود را ایجاد کنید." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map(p => {
            const pTasks = tasks.filter(t => t.projectId === p._id);
            const done = pTasks.filter(t => t.status === "done").length;
            const total = pTasks.length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <div key={p._id} className="rounded-xl border border-border/60 bg-white/60 p-4 dark:bg-white/5">
                <p className="text-sm font-bold">{p.name}</p>
                <p className="text-[10px] text-muted-foreground">{p.description || "بدون توضیح"}</p>
                <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{toFa(done)} / {toFa(total)} وظیفه</span>
                  <span>{toFa(pct)}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
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
/*  BUSINESS GOALS                                                     */
/* ================================================================== */

function GoalsTab({ goals, createGoal, updateGoal, deleteGoal }: {
  goals: any[]; createGoal: any; updateGoal: any; deleteGoal: any;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ title: "", description: "", type: "numeric", period: "monthly", target: "", current: "", unit: "", progress: "", status: "active", dueDate: "" });

  const handleSubmit = async () => {
    const data = {
      title: form.title, description: form.description || undefined, type: form.type,
      period: form.period, target: Number(form.target) || undefined, current: Number(form.current) || 0,
      unit: form.unit || undefined, progress: Number(form.progress) || 0, status: form.status,
      dueDate: form.dueDate || undefined, relatedProjectIds: [],
    };
    if (editItem) { await updateGoal({ id: editItem._id, ...data }); }
    else { await createGoal(data); }
    setAddOpen(false); setEditItem(null);
    setForm({ title: "", description: "", type: "numeric", period: "monthly", target: "", current: "", unit: "", progress: "", status: "active", dueDate: "" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold">اهداف کسب‌وکار</h3>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />هدف جدید</Button>
      </div>

      {goals.length === 0 ? (
        <EmptyState icon={Target} title="هنوز هدفی تعریف نشده" description="اولین هدف استراتژیک خود را تعریف کنید." action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />افزودن هدف</Button>} />
      ) : (
        <div className="space-y-2">
          {goals.map(g => (
            <div key={g._id} className="rounded-xl border border-border/60 bg-white/60 p-3 dark:bg-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">{g.title}</p>
                  <p className="text-[10px] text-muted-foreground">{GOAL_TYPES[g.type] || g.type} — {g.period}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold", g.status === "active" ? "bg-emerald-100 text-emerald-700" : g.status === "at_risk" ? "bg-rose-100 text-rose-700" : "bg-gray-100 text-gray-600")}>
                    {g.status === "active" ? "فعال" : g.status === "at_risk" ? "درخطر" : g.status === "completed" ? "تکمیل" : "متوقف"}
                  </span>
                  <button onClick={() => { setEditItem(g); setForm({ title: g.title, description: g.description || "", type: g.type, period: g.period, target: String(g.target || ""), current: String(g.current), unit: g.unit || "", progress: String(g.progress), status: g.status, dueDate: g.dueDate || "" }); }} className="rounded p-1 hover:bg-muted"><Pencil className="size-3" /></button>
                  <button onClick={() => deleteGoal({ id: g._id })} className="rounded p-1 hover:bg-rose-50"><Trash2 className="size-3 text-rose-500" /></button>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{toFa(g.progress)}% تکمیل</span>
                {g.target && <span>هدف: {fmtCurrency(g.target)} {g.unit || ""}</span>}
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${g.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={addOpen || !!editItem} onClose={() => { setAddOpen(false); setEditItem(null); }} title={editItem ? "ویرایش هدف" : "هدف جدید"}>
        <div className="space-y-3">
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="عنوان هدف" className="w-full rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5" />
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="توضیحات" className="w-full rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5" />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5">
              {Object.entries(GOAL_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))} className="rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5">
              <option value="weekly">هفتگی</option><option value="monthly">ماهانه</option><option value="quarterly">فصلی</option><option value="annual">سالانه</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} placeholder="مقدار هدف" className="rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5" />
            <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="واحد (تومان/مشتری/...)" className="rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5" />
          </div>
          <input type="number" value={form.progress} onChange={e => setForm(f => ({ ...f, progress: e.target.value }))} placeholder="پیشرفت (0-100)" className="w-full rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5" />
          <Button size="sm" className="w-full" onClick={handleSubmit}>{editItem ? "ذخیره" : "افزودن"}</Button>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  OPERATIONS                                                         */
/* ================================================================== */

function OperationsTab({ tasks, projects, toggleDone, openTask, deleteTask }: { tasks: any[]; projects: any[]; toggleDone: any; openTask: any; deleteTask: any }) {    const overdue = tasks.filter(t => t.status !== "done" && t.dueDate && isOverdue(t));
    const critical = tasks.filter(t => t.status !== "done" && t.priority === "urgent");
  const thisWeek = tasks.filter(t => {
    if (t.status === "done" || !t.dueDate) return false;
    const d = daysUntil(t.dueDate ?? "");
    return d >= 0 && d <= 7;
  });

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-extrabold">مرکز عملیات</h3>

      {/* Overdue */}
      <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 dark:bg-rose-900/10">
        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-rose-700"><AlertCircle className="size-3.5" />عقب‌افتاده ({toFa(overdue.length)})</h4>
        {overdue.length === 0 ? <p className="text-[10px] text-rose-600">کار عقب‌افتاده‌ای نیست.</p> : (
          <div className="space-y-1">            {overdue.slice(0, 5).map(t => <TaskRow key={t._id} task={t} onToggle={(done) => toggleDone(t, done)} onOpen={() => openTask(t._id)} onDelete={() => deleteTask(t._id)} />)}</div>
        )}
      </div>

      {/* Critical */}
      <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4 dark:bg-orange-900/10">
        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-orange-700"><Zap className="size-3.5" />فوری ({toFa(critical.length)})</h4>
        {critical.length === 0 ? <p className="text-[10px] text-orange-600">کار فوری نیست.</p> : (
          <div className="space-y-1">            {critical.slice(0, 5).map(t => <TaskRow key={t._id} task={t} onToggle={(done) => toggleDone(t, done)} onOpen={() => openTask(t._id)} onDelete={() => deleteTask(t._id)} />)}</div>
        )}
      </div>

      {/* This week */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:bg-amber-900/10">
        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-amber-700"><CalendarDays className="size-3.5" />سررسید این هفته ({toFa(thisWeek.length)})</h4>
        {thisWeek.length === 0 ? <p className="text-[10px] text-amber-600">سررسیدی این هفته نیست.</p> : (
          <div className="space-y-1">            {thisWeek.slice(0, 5).map(t => <TaskRow key={t._id} task={t} onToggle={(done) => toggleDone(t, done)} onOpen={() => openTask(t._id)} onDelete={() => deleteTask(t._id)} />)}</div>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  PAYMENTS                                                           */
/* ================================================================== */

function PaymentsTab({ payments, createPayment, updatePayment, deletePayment }: {
  payments: any[]; createPayment: any; updatePayment: any; deletePayment: any;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ title: "", amount: "", type: "incoming", status: "pending", dueDate: today(), notes: "" });

  const handleSubmit = async () => {
    const data = {
      title: form.title, amount: Number(form.amount) || 0, currency: "تومان",
      type: form.type, status: form.status, dueDate: form.dueDate, notes: form.notes || undefined,
    };
    if (editItem) { await updatePayment({ id: editItem._id, ...data }); }
    else { await createPayment(data); }
    setAddOpen(false); setEditItem(null);
    setForm({ title: "", amount: "", type: "incoming", status: "pending", dueDate: today(), notes: "" });
  };

  const overdueCount = payments.filter(p => p.status === "overdue").length;
  const pendingCount = payments.filter(p => p.status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold">پرداخت‌ها</h3>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />پرداخت جدید</Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:bg-amber-900/10">
          <p className="text-xs text-amber-700">در‌انتظار</p>
          <p className="text-lg font-extrabold text-amber-700">{toFa(pendingCount)}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 dark:bg-rose-900/10">
          <p className="text-xs text-rose-700">سررسیدگذشته</p>
          <p className="text-lg font-extrabold text-rose-700">{toFa(overdueCount)}</p>
        </div>
      </div>

      {payments.length === 0 ? (
        <EmptyState icon={CreditCard} title="هنوز پرداختی ثبت نشده" description="پرداخت‌های خود را پیگیری کنید." action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />افزودن پرداخت</Button>} />
      ) : (
        <div className="space-y-2">
          {payments.map(p => (
            <div key={p._id} className="flex items-center justify-between rounded-xl border border-border/60 p-3">
              <div>
                <p className="text-sm font-bold">{p.title}</p>
                <p className="text-[10px] text-muted-foreground">{fmtCurrency(p.amount)} تومان — {p.type === "incoming" ? "دریافتی" : "پرداختی"} — {p.dueDate}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold", PAYMENT_STATUS[p.status]?.color)}>{PAYMENT_STATUS[p.status]?.label}</span>
                <select value={p.status} onChange={e => updatePayment({ id: p._id, status: e.target.value })}
                  className="rounded border border-border/60 bg-white/60 px-1 py-0.5 text-[9px] dark:bg-white/5">
                  {Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <button onClick={() => { setEditItem(p); setForm({ title: p.title, amount: String(p.amount), type: p.type, status: p.status, dueDate: p.dueDate, notes: p.notes || "" }); }} className="rounded p-1 hover:bg-muted"><Pencil className="size-3" /></button>
                <button onClick={() => deletePayment({ id: p._id })} className="rounded p-1 hover:bg-rose-50"><Trash2 className="size-3 text-rose-500" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={addOpen || !!editItem} onClose={() => { setAddOpen(false); setEditItem(null); }} title={editItem ? "ویرایش پرداخت" : "پرداخت جدید"}>
        <div className="space-y-3">
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="عنوان" className="w-full rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5" />
          <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="مبلغ (تومان)" className="w-full rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5" />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5">
              <option value="incoming">دریافتی</option><option value="outgoing">پرداختی</option>
            </select>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5">
              {Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className="w-full rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5" />
          <Button size="sm" className="w-full" onClick={handleSubmit}>{editItem ? "ذخیره" : "افزودن"}</Button>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  INITIATIVES                                                        */
/* ================================================================== */

function InitiativesTab({ initiatives, goals, projects, createInit, updateInit, deleteInit }: {
  initiatives: any[]; goals: any[]; projects: any[];
  createInit: any; updateInit: any; deleteInit: any;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ title: "", description: "", status: "planning", goalId: "", projectId: "", priority: "medium", dueDate: "", progress: "" });

  const handleSubmit = async () => {
    const data = {
      title: form.title, description: form.description || undefined, status: form.status,
      goalId: form.goalId || undefined, projectId: form.projectId || undefined,
      priority: form.priority, dueDate: form.dueDate || undefined, progress: Number(form.progress) || 0,
    };
    if (editItem) { await updateInit({ id: editItem._id, ...data }); }
    else { await createInit(data); }
    setAddOpen(false); setEditItem(null);
    setForm({ title: "", description: "", status: "planning", goalId: "", projectId: "", priority: "medium", dueDate: "", progress: "" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold">ابتکارات استراتژیک</h3>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />ابتکار جدید</Button>
      </div>

      {initiatives.length === 0 ? (
        <EmptyState icon={Zap} title="هنوز ابتکاری تعریف نشده" description="ابتکارات استراتژیک خود را تعریف کنید." action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />افزودن ابتکار</Button>} />
      ) : (
        <div className="space-y-2">
          {initiatives.map(i => (
            <div key={i._id} className="rounded-xl border border-border/60 bg-white/60 p-3 dark:bg-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">{i.title}</p>
                  <p className="text-[10px] text-muted-foreground">{i.dueDate ? `تا ${i.dueDate}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold", INITIATIVE_STATUS[i.status]?.color)}>{INITIATIVE_STATUS[i.status]?.label}</span>
                  <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold", PRIORITY_COLORS[i.priority])}>{i.priority}</span>
                  <button onClick={() => { setEditItem(i); setForm({ title: i.title, description: i.description || "", status: i.status, goalId: i.goalId || "", projectId: i.projectId || "", priority: i.priority, dueDate: i.dueDate || "", progress: String(i.progress) }); }} className="rounded p-1 hover:bg-muted"><Pencil className="size-3" /></button>
                  <button onClick={() => deleteInit({ id: i._id })} className="rounded p-1 hover:bg-rose-50"><Trash2 className="size-3 text-rose-500" /></button>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{toFa(i.progress)}% پیشرفت</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${i.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={addOpen || !!editItem} onClose={() => { setAddOpen(false); setEditItem(null); }} title={editItem ? "ویرایش ابتکار" : "ابتکار جدید"}>
        <div className="space-y-3">
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="عنوان ابتکار" className="w-full rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5" />
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="توضیحات" className="w-full rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5" />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5">
              {Object.entries(INITIATIVE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5">
              <option value="critical">بحرانی</option><option value="high">بالا</option><option value="medium">متوسط</option><option value="low">پایین</option>
            </select>
          </div>
          {goals.length > 0 && (
            <select value={form.goalId} onChange={e => setForm(f => ({ ...f, goalId: e.target.value }))} className="w-full rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5">
              <option value="">هدف مرتبط (اختیاری)</option>
              {goals.map(g => <option key={g._id} value={g._id}>{g.title}</option>)}
            </select>
          )}
          {projects.length > 0 && (
            <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} className="w-full rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5">
              <option value="">پروژه مرتبط (اختیاری)</option>
              {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          )}
          <input type="number" value={form.progress} onChange={e => setForm(f => ({ ...f, progress: e.target.value }))} placeholder="پیشرفت (0-100)" className="w-full rounded-lg border border-border/60 bg-white/60 px-3 py-2 text-xs dark:bg-white/5" />
          <Button size="sm" className="w-full" onClick={handleSubmit}>{editItem ? "ذخیره" : "افزودن"}</Button>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  ANALYTICS                                                          */
/* ================================================================== */

function AnalyticsTab({ metrics, revenue, expenses, sales, goals }: {
  metrics: BizMetrics;
  revenue: any[]; expenses: any[]; sales: any[]; goals: any[];
}) {
  const wonSales = sales.filter(s => s.stage === "won");
  const lostSales = sales.filter(s => s.stage === "lost");
  const activeSales = sales.filter(s => s.stage !== "won" && s.stage !== "lost");
  const totalGoalProgress = goals.length > 0 ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length) : 0;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-extrabold">تحلیل کسب‌وکار</h3>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-white/60 p-4 dark:bg-white/5">
          <p className="text-xs text-muted-foreground">درآمد</p>
          <p className="mt-1 text-xl font-extrabold text-emerald-600">{fmtCurrency(metrics.received)}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-white/60 p-4 dark:bg-white/5">
          <p className="text-xs text-muted-foreground">هزینه‌ها</p>
          <p className="mt-1 text-xl font-extrabold text-rose-600">{fmtCurrency(metrics.totalExpenses)}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-white/60 p-4 dark:bg-white/5">
          <p className="text-xs text-muted-foreground">نتالی مالی</p>
          <p className={cn("mt-1 text-xl font-extrabold", metrics.received - metrics.totalExpenses >= 0 ? "text-emerald-600" : "text-rose-600")}>
            {fmtCurrency(metrics.received - metrics.totalExpenses)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-white/60 p-4 dark:bg-white/5">
          <p className="text-xs text-muted-foreground">فرصت‌های فعال</p>
          <p className="mt-1 text-xl font-extrabold text-blue-600">{toFa(activeSales.length)}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-white/60 p-4 dark:bg-white/5">
          <p className="text-xs text-muted-foreground">برنده / بازنده</p>
          <p className="mt-1 text-xl font-extrabold">
            <span className="text-emerald-600">{toFa(wonSales.length)}</span>
            <span className="mx-1 text-muted-foreground">/</span>
            <span className="text-rose-600">{toFa(lostSales.length)}</span>
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-white/60 p-4 dark:bg-white/5">
          <p className="text-xs text-muted-foreground">میانگین پیشرفت اهداف</p>
          <p className="mt-1 text-xl font-extrabold text-violet-600">{toFa(totalGoalProgress)}%</p>
        </div>
      </div>

      {/* Revenue vs Expenses */}
      <div className="rounded-xl border border-border/60 bg-white/60 p-4 dark:bg-white/5">
        <h4 className="mb-3 text-xs font-bold">مقایسه درآمد و هزینه</h4>
        <div className="space-y-2">
          {["received", "expected", "invoiced"].map(status => {
            const rev = revenue.filter(r => r.status === status).reduce((s, r) => s + r.amount, 0);
            const maxVal = Math.max(metrics.received, metrics.totalExpenses, 1);
            const pct = Math.min((rev / maxVal) * 100, 100);
            return (
              <div key={status}>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">{REVENUE_STATUS[status]?.label}</span>
                  <span className="font-bold">{fmtCurrency(rev)}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          <div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">هزینه‌ها</span>
              <span className="font-bold">{fmtCurrency(metrics.totalExpenses)}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-rose-500 transition-all" style={{ width: `${Math.min((metrics.totalExpenses / Math.max(metrics.received, 1)) * 100, 100)}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Task metrics */}
      <div className="rounded-xl border border-border/60 bg-white/60 p-4 dark:bg-white/5">
        <h4 className="mb-3 text-xs font-bold">عملکرد کاری</h4>
        <div className="grid grid-cols-2 gap-3">
          <div><p className="text-[10px] text-muted-foreground">کل وظایف</p><p className="text-sm font-bold">{toFa(metrics.totalTasks)}</p></div>
          <div><p className="text-[10px] text-muted-foreground">تکمیل‌شده</p><p className="text-sm font-bold">{toFa(metrics.completedTasks)}</p></div>
          <div><p className="text-[10px] text-muted-foreground">عقب‌افتاده</p><p className="text-sm font-bold text-rose-600">{toFa(metrics.overdueTasks)}</p></div>
          <div><p className="text-[10px] text-muted-foreground">نرخ تکمیل</p><p className="text-sm font-bold">{toFa(metrics.completionRate)}%</p></div>
        </div>
      </div>
    </div>
  );
}
