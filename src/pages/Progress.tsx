import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { FutureFeatureSection } from "@/components/future/ComingSoonFeature";
import { toFa, toJalaliDate } from "@/lib/persian";
import { todayKey, addDaysKey } from "@/lib/task-utils";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flame,
  FolderKanban,
  ListTodo,
  MoreHorizontal,
  Target,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";

const DAY_LABELS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
const PRIORITY_META: Record<string, { label: string; color: string }> = {
  urgent: { label: "فوری", color: "#ef4444" },
  high: { label: "زیاد", color: "#f97316" },
  medium: { label: "متوسط", color: "#6366f1" },
  low: { label: "کم", color: "#38bdf8" },
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[1.35rem] border border-slate-200/80 bg-white shadow-[0_18px_55px_-40px_rgba(15,23,42,.42)] dark:border-white/10 dark:bg-slate-900 ${className}`}>
      {children}
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  change,
  tone = "blue",
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
  change: string;
  tone?: "blue" | "violet" | "pink" | "amber";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300",
    pink: "bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-300",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
  };
  return (
    <div className="group rounded-[1.2rem] border border-slate-200/80 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <span className={`grid size-10 place-items-center rounded-xl ${tones[tone]}`}><Icon className="size-5" /></span>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">{change}</span>
      </div>
      <div className="mt-4 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-black tracking-tight text-slate-950 dark:text-white">{value}</div>
    </div>
  );
}

export default function ProgressPage() {
  const { tasks, projects } = useWorkspace();
  const root = useMemo(() => tasks.filter((t) => !t.parentId), [tasks]);
  const done = useMemo(() => root.filter((t) => t.status === "done"), [root]);

  const stats = useMemo(() => {
    const today = todayKey();
    const week: Array<{ label: string; planned: number; completed: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const key = addDaysKey(-i);
      const d = new Date(key + "T00:00:00");
      week.push({
        label: DAY_LABELS[(d.getDay() + 1) % 7],
        planned: root.filter((t) => t.dueDate === key).length,
        completed: done.filter((t) => t.completedAt && new Date(t.completedAt).toISOString().slice(0, 10) === key).length,
      });
    }

    let streak = 0;
    for (let i = 0; i < 60; i++) {
      const key = addDaysKey(-i);
      if (done.some((t) => t.completedAt && new Date(t.completedAt).toISOString().slice(0, 10) === key)) streak++;
      else if (i > 0) break;
      else continue;
    }

    const priority = Object.keys(PRIORITY_META).map((key) => ({
      key,
      name: PRIORITY_META[key].label,
      value: root.filter((t) => t.priority === key && t.status !== "done").length,
      color: PRIORITY_META[key].color,
    })).filter((x) => x.value > 0);

    const upcoming = root
      .filter((t) => t.status !== "done" && t.dueDate && t.dueDate >= today)
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
      .slice(0, 5);

    const recent = [...done]
      .sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt))
      .slice(0, 5);

    const totalEstimate = done.reduce((sum, t) => sum + (t.estimateMinutes ?? 0), 0);
    const overdue = root.filter((t) => t.dueDate && t.dueDate < today && t.status !== "done").length;
    const active = root.filter((t) => t.status !== "done").length;
    const completionRate = root.length ? Math.round((done.length / root.length) * 100) : 0;
    const growthScore = Math.min(100, Math.round(completionRate * 0.65 + Math.min(streak * 5, 25) + Math.min(projects.length * 2, 10)));

    return { week, priority, upcoming, recent, totalEstimate, overdue, active, streak, completionRate, growthScore };
  }, [root, done, projects.length]);

  const projectRows = useMemo(() => projects.map((p) => {
    const pts = root.filter((t) => t.projectId === p._id);
    const completed = pts.filter((t) => t.status === "done").length;
    const pct = pts.length ? Math.round((completed / pts.length) * 100) : 0;
    return { ...p, total: pts.length, completed, pct };
  }).sort((a, b) => b.pct - a.pct).slice(0, 6), [projects, root]);

  const formatDate = (value?: string) => {
    if (!value) return "بدون تاریخ";
    const d = new Date(value + "T00:00:00");
    const j = toJalaliDate(d);
    return `${toFa(j.jd)} ${["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"][j.jm - 1]}`;
  };

  return (
    <div className="min-h-full bg-[#f7f8fc] dark:bg-slate-950">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-5 md:px-7 md:py-7">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 text-[10px] font-black tracking-[0.18em] text-blue-600">PRODUCTIVITY ANALYTICS</div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white md:text-3xl">تحلیل بهره‌وری</h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">تصویر روشن‌تری از اجرای برنامه، تمرکز، پروژه‌ها و روند پیشرفتت.</p>
          </div>
          <Link to="/planning" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-extrabold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">
            <CalendarDays className="size-4" /> مشاهده برنامه <ArrowUpRight className="size-3.5" />
          </Link>
        </header>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard icon={TrendingUp} label="نمره رشد" value={`${toFa(stats.growthScore)}٪`} change="بر اساس عملکرد" tone="violet" />
          <MetricCard icon={CheckCircle2} label="نرخ تکمیل" value={`${toFa(stats.completionRate)}٪`} change={`${toFa(done.length)} تکمیل‌شده`} tone="blue" />
          <MetricCard icon={FolderKanban} label="پروژه‌های فعال" value={toFa(projects.filter((p) => p.status !== "done").length)} change={`${toFa(projects.length)} پروژه`} tone="pink" />
          <MetricCard icon={Clock3} label="زمان ثبت‌شده" value={`${toFa(Math.round(stats.totalEstimate / 60))} ساعت`} change="از برآورد کارها" tone="amber" />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(280px,.8fr)_minmax(280px,.8fr)]">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="text-sm font-black">روند عملکرد</h2><p className="mt-1 text-[11px] text-slate-400">برنامه‌ریزی‌شده در برابر کارهای واقعاً تکمیل‌شده</p></div>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500 dark:bg-white/5 dark:text-slate-400">۷ روز اخیر</span>
            </div>
            <div className="mt-5 h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.week} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="analyticsCompleted" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.28}/><stop offset="100%" stopColor="#6366f1" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 11 }} />
                  <Area type="monotone" dataKey="planned" name="برنامه‌ریزی‌شده" stroke="#38bdf8" strokeWidth={2} fill="transparent" />
                  <Area type="monotone" dataKey="completed" name="تکمیل‌شده" stroke="#6366f1" strokeWidth={3} fill="url(#analyticsCompleted)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between"><div><h2 className="text-sm font-black">توزیع کارها</h2><p className="mt-1 text-[11px] text-slate-400">کارهای باز بر اساس اولویت</p></div><MoreHorizontal className="size-4 text-slate-400" /></div>
            <div className="mt-3 h-44" dir="ltr">
              {stats.priority.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.priority} dataKey="value" nameKey="name" innerRadius={50} outerRadius={70} paddingAngle={3}>
                      {stats.priority.map((p) => <Cell key={p.key} fill={p.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="grid h-full place-items-center text-xs text-slate-400">کار باز برای تحلیل وجود ندارد.</div>}
            </div>
            <div className="space-y-2">
              {stats.priority.map((p) => <div key={p.key} className="flex items-center justify-between text-[11px]"><span className="flex items-center gap-2 font-bold"><span className="size-2 rounded-full" style={{background:p.color}} />{p.name}</span><span className="font-black">{toFa(p.value)}</span></div>)}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between"><div><h2 className="text-sm font-black">فعالیت اخیر</h2><p className="mt-1 text-[11px] text-slate-400">آخرین کارهای تکمیل‌شده</p></div><CheckCircle2 className="size-4 text-emerald-500" /></div>
            <div className="mt-4 divide-y divide-slate-100 dark:divide-white/5">
              {stats.recent.length ? stats.recent.map((t) => (
                <div key={t._id} className="flex gap-2.5 py-2.5 first:pt-0">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.10)]" />
                  <div className="min-w-0"><p className="truncate text-[11px] font-bold text-slate-700 dark:text-slate-200">{t.title}</p><p className="mt-0.5 text-[10px] text-slate-400">{t.completedAt ? new Date(t.completedAt).toLocaleTimeString("fa-IR", {hour:"2-digit",minute:"2-digit"}) : "تکمیل‌شده"}</p></div>
                </div>
              )) : <div className="py-8 text-center text-xs text-slate-400">هنوز فعالیت تکمیل‌شده‌ای ثبت نشده.</div>}
            </div>
          </Card>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.75fr)]">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/5">
              <div><h2 className="text-sm font-black">پروژه‌های فعال</h2><p className="mt-1 text-[11px] text-slate-400">پیشرفت واقعی بر اساس کارهای پروژه</p></div>
              <Link to="/projects" className="text-[11px] font-extrabold text-blue-600 hover:text-blue-700">مشاهده همه</Link>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[620px]">
                {projectRows.length ? projectRows.map((p) => (
                  <Link key={p._id} to={`/projects/${p._id}`} className="grid grid-cols-[1.5fr_.7fr_1fr_.65fr] items-center gap-4 border-b border-slate-100 px-5 py-4 transition hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/[.025]">
                    <div className="flex items-center gap-2.5"><span className="size-9 rounded-xl" style={{background:`${p.color}22`, border:`1px solid ${p.color}44`}}><span className="mx-auto mt-2 block size-2 rounded-full" style={{background:p.color}} /></span><div><p className="text-xs font-extrabold">{p.name}</p><p className="mt-0.5 text-[10px] text-slate-400">{toFa(p.completed)}/{toFa(p.total)} کار</p></div></div>
                    <span className="text-[11px] font-semibold text-slate-500">{p.deadline ? formatDate(p.deadline) : "بدون مهلت"}</span>
                    <div><div className="mb-1 flex justify-between text-[10px]"><span className="text-slate-400">پیشرفت</span><span className="font-black">{toFa(p.pct)}٪</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className="h-full rounded-full" style={{width:`${p.pct}%`,background:`linear-gradient(90deg,${p.color},#6366f1)`}} /></div></div>
                    <span className="justify-self-end rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">{p.status === "done" ? "کامل‌شده" : "در حال اجرا"}</span>
                  </Link>
                )) : <div className="p-8 text-center text-xs text-slate-400">پروژه‌ای برای نمایش وجود ندارد.</div>}
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between"><div><h2 className="text-sm font-black">کارهای پیش‌رو</h2><p className="mt-1 text-[11px] text-slate-400">نزدیک‌ترین موعدها</p></div><Link to="/today" className="text-[11px] font-extrabold text-blue-600">امروز</Link></div>
            <div className="mt-4 space-y-2.5">
              {stats.upcoming.length ? stats.upcoming.map((t) => (
                <Link key={t._id} to="/today" className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5 transition hover:border-blue-200 hover:bg-blue-50/40 dark:border-white/5 dark:hover:bg-blue-500/5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"><ListTodo className="size-4" /></span>
                  <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold">{t.title}</p><p className="mt-0.5 text-[10px] text-slate-400">{formatDate(t.dueDate)}{t.dueTime ? ` · ${t.dueTime}` : ""}</p></div>
                </Link>
              )) : <div className="py-8 text-center text-xs text-slate-400">کار زمان‌دار پیش‌رو وجود ندارد.</div>}
            </div>
          </Card>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <Card className="p-5 md:col-span-2">
            <div className="flex items-center justify-between"><div><h2 className="text-sm font-black">روند ماهانه</h2><p className="mt-1 text-[11px] text-slate-400">تعداد کارهای تکمیل‌شده در ماه‌های اخیر</p></div><BarChart className="size-4 text-violet-500" /></div>
            <div className="mt-4 h-44" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={Array.from({length:6},(_,i)=>{const d=new Date(); d.setMonth(d.getMonth()-(5-i)); const j=toJalaliDate(d); const prefix=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; return {label:["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"][j.jm-1],count:done.filter(t=>t.completedAt && new Date(t.completedAt).toISOString().startsWith(prefix)).length};})}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false}/>
                  <XAxis dataKey="label" tick={{fontSize:10,fill:"var(--muted-foreground)"}} axisLine={false} tickLine={false}/>
                  <YAxis allowDecimals={false} tick={{fontSize:10,fill:"var(--muted-foreground)"}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{background:"var(--popover)",border:"1px solid var(--border)",borderRadius:12,fontSize:11}}/>
                  <Bar dataKey="count" name="تکمیل‌شده" fill="#6366f1" radius={[7,7,0,0]} maxBarSize={32}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 p-5 text-white shadow-[0_25px_60px_-30px_rgba(99,102,241,.65)]">
            <div className="relative z-10">
              <span className="inline-flex rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold backdrop-blur">رشد شخصی</span>
              <div className="mt-5 text-5xl font-black">{toFa(stats.growthScore)}<span className="text-2xl">٪</span></div>
              <p className="mt-2 text-xs leading-6 text-white/80">امتیاز ترکیبی از نرخ تکمیل، استمرار و حجم واقعی پروژه‌ها.</p>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-white" style={{width:`${stats.growthScore}%`}} /></div>
              <div className="mt-4 flex items-center justify-between text-[10px] text-white/75"><span>زنجیره {toFa(stats.streak)} روز</span><span>{toFa(stats.overdue)} عقب‌افتاده</span></div>
            </div>
            <TrendingUp className="absolute -bottom-5 -end-3 size-32 text-white/10" />
          </Card>
        </div>

        <Card className="p-5">
          <div className="flex items-center gap-2"><TriangleAlert className="size-4 text-amber-500"/><h2 className="text-sm font-black">هشدارهای عملکرد</h2></div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-500/10"><div className="text-xs font-black">{toFa(stats.overdue)} کار عقب‌افتاده</div><div className="mt-1 text-[10px] text-amber-700/70 dark:text-amber-300/70">{stats.overdue ? "این کارها مستقیماً روی اجرای برنامه اثر می‌گذارند." : "وضعیت موعدها مناسب است."}</div></div>
            <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-500/10"><div className="text-xs font-black">{toFa(stats.active)} کار باز</div><div className="mt-1 text-[10px] text-blue-700/70 dark:text-blue-300/70">{stats.active > 20 ? "حجم کار باز بالاست؛ اولویت‌ها را مرور کن." : "حجم کار باز قابل مدیریت است."}</div></div>
            <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-500/10"><div className="text-xs font-black">{toFa(stats.streak)} روز استمرار</div><div className="mt-1 text-[10px] text-emerald-700/70 dark:text-emerald-300/70">{stats.streak ? "استمرار فعلی در امتیاز رشد لحاظ شده." : "با انجام یک کار واقعی، زنجیره را شروع کن."}</div></div>
          </div>
        </Card>

        <FutureFeatureSection
          title="بینش‌های هوشمند"
          surface="insights"
          category="insights"
          description="تحلیل فعلی بهره‌وری کاملاً قطعی است؛ تحلیل هوشمند شخصی‌سازی‌شده در نسخه‌های آینده اضافه خواهد شد."
        />
      </div>
    </div>
  );
}
