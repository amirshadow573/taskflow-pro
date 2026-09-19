import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  ArrowLeft,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock,
  FolderKanban,
  Inbox,
  Keyboard,
  LayoutDashboard,
  ListChecks,
  Plus,
  Search,
  Sparkles,
  SquareCheckBig,
  Timer,
  TrendingUp,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Link, useNavigate } from "react-router";
import { toFa } from "@/lib/persian";

/* ------------------------------------------------------------------ */
/*  Animation helpers                                                  */
/* ------------------------------------------------------------------ */

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

function Anim({
  children,
  className,
  delay = 0,
  once = true,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  once?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      variants={fadeUp}
      initial={reduced ? undefined : "hidden"}
      whileInView={reduced ? undefined : "visible"}
      viewport={{ once, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Product mockups                                                    */
/* ------------------------------------------------------------------ */

const DEMO_TASKS = [
  { t: "طراحی صفحه اصلی سایت", pr: "بالا", prColor: "#ef4444", done: false, project: "بازطراحی وب‌سایت", pc: "#4f46e5", due: "امروز" },
  { t: "جلسه بررسی اسپرینت", pr: "متوسط", prColor: "#3b82f6", done: false, project: "بازطراحی وب‌سایت", pc: "#4f46e5", due: "امروز · ۱۰:۰۰" },
  { t: "مطالعه فصل سوم زیست", pr: "پایین", prColor: "#10b981", done: false, project: "پروژه دانشگاه", pc: "#f59e0b", due: "امروز · ۱۸:۰۰" },
  { t: "ارسال پروژه به مشتری", pr: "فوری", prColor: "#ef4444", done: false, project: "بازطراحی وب‌سایت", pc: "#4f46e5", due: "دیروز" },
  { t: "پاسخ به ایمیل‌ها", pr: "پایین", prColor: "#10b981", done: true, project: null, pc: "#64748b", due: "امروز" },
  { t: "مرور روزانه", pr: "پایین", prColor: "#10b981", done: true, project: "رشد شخصی", pc: "#10b981", due: "امروز" },
];

function DashboardMockup({ compact = false }: { compact?: boolean }) {
  const visible = compact ? DEMO_TASKS.slice(0, 4) : DEMO_TASKS;
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-card elev-3" dir="rtl">
      {/* Chrome bar */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
        <span className="flex gap-1.5"><span className="size-2.5 rounded-full bg-red-400/70" /><span className="size-2.5 rounded-full bg-amber-400/70" /><span className="size-2.5 rounded-full bg-emerald-400/70" /></span>
        <span className="ms-3 h-5 flex-1 rounded-md bg-card border border-border/60 px-2 text-[10px] leading-5 text-muted-foreground">taskflow.app/dashboard</span>
      </div>
      <div className="flex min-h-[280px]">
        {/* Sidebar */}
        <div className="hidden w-44 shrink-0 border-e border-border bg-card p-3 md:block">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-primary text-white"><ListChecks className="size-3.5" /></span>
            <span className="text-xs font-extrabold">تسک‌لی</span>
          </div>
          {["داشبورد","امروز","صندوق ورودی","کارهای من","پروژه‌ها","تقویم","پیشرفت"].map((l, i) => (
            <div key={l} className={`mb-0.5 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${i === 0 ? "bg-accent text-accent-foreground font-bold" : "text-muted-foreground"}`}>
              <span className="size-3.5 rounded bg-muted" />{l}
            </div>
          ))}
        </div>
        {/* Main */}
        <div className="flex-1 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground">صبح بخیر 👋</p>
              <p className="text-sm font-extrabold">امروز — چهارشنبه ۱۵ مهر</p>
            </div>
            <span className="rounded-lg bg-accent px-2 py-1 text-[10px] font-bold text-accent-foreground">۵۸٪ پیشرفت</span>
          </div>
          {/* Stats */}
          <div className="mb-3 grid grid-cols-4 gap-2">
            {[{ l: "امروز", v: "۱۲" }, { l: "انجام‌شده", v: "۷", c: "text-emerald-600" }, { l: "در حال انجام", v: "۳", c: "text-blue-600" }, { l: "عقب‌افتاده", v: "۲", c: "text-red-500" }].map((s) => (
              <div key={s.l} className="rounded-lg bg-muted/60 p-2 text-center">
                <p className={`text-base font-extrabold tabular-nums ${s.c ?? ""}`}>{s.v}</p>
                <p className="text-[9px] text-muted-foreground">{s.l}</p>
              </div>
            ))}
          </div>
          {/* Task list */}
          <div className="space-y-0.5">
            {visible.map((r) => (
              <div key={r.t} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60">
                <span className="grid size-4 shrink-0 place-items-center rounded-full border-2" style={{ borderColor: r.done ? r.prColor : "var(--border)", background: r.done ? r.prColor : "transparent" }}>
                  {r.done && <CheckCircle2 className="size-2 text-white" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[11px] font-semibold ${r.done ? "text-muted-foreground line-through" : ""}`}>{r.t}</span>
                  <span className="flex items-center gap-2 text-[9px] text-muted-foreground">
                    {r.project && <span className="inline-flex items-center gap-0.5"><span className="size-1.5 rounded-sm" style={{ background: r.pc }} />{r.project}</span>}
                    <span style={{ color: r.due === "دیروز" ? "#ef4444" : undefined }}>{r.due}</span>
                  </span>
                </span>
                <span className="hidden shrink-0 rounded border px-1 py-0.5 text-[8px] font-bold sm:inline" style={{ color: r.prColor, borderColor: `${r.prColor}40`, background: `${r.prColor}12` }}>{r.pr}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function KanbanMockup() {
  const cols: Array<{ label: string; color: string; tasks: Array<{ t: string; pr: string; prc: string; due: string; tag?: string }> }> = [
    { label: "انجام نشده", color: "#64748b", tasks: [
      { t: "طراحی صفحه قیمت‌گذاری", pr: "متوسط", prc: "#3b82f6", due: "فردا", tag: "طراحی" },
      { t: "تست ریسپانسیو موبایل", pr: "بالا", prc: "#f59e0b", due: "پس‌فردا", tag: "تست" },
    ]},
    { label: "در حال انجام", color: "#3b82f6", tasks: [
      { t: "طراحی صفحه اصلی سایت", pr: "فوری", prc: "#ef4444", due: "امروز", tag: "طراحی" },
      { t: "پیاده‌سازی API پرداخت", pr: "بالا", prc: "#f59e0b", due: "شنبه" },
    ]},
    { label: "در انتظار", color: "#f59e0b", tasks: [
      { t: "آپلود مستندات پروژه", pr: "پایین", prc: "#10b981", due: "—", tag: "اداری" },
    ]},
    { label: "انجام شده", color: "#10b981", tasks: [
      { t: "طراحی هدر سایت", pr: "متوسط", prc: "#3b82f6", due: "دیروز" },
      { t: "پاسخ به ایمیل مشتری", pr: "پایین", prc: "#10b981", due: "دیروز" },
    ]},
  ];
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-border bg-card elev-3 p-4" dir="rtl">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-extrabold">بازطراحی وب‌سایت</p>
        <span className="text-[10px] text-muted-foreground">۸ از ۱۵ تسک انجام شده</span>
      </div>
      <div className="flex gap-3" style={{ minWidth: 640 }}>
        {cols.map((col) => (
          <div key={col.label} className="min-w-[150px] flex-1 rounded-xl bg-muted/40 p-2.5">
            <div className="mb-2 flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: col.color }} />
              <span className="text-[11px] font-bold">{col.label}</span>
              <span className="text-[9px] text-muted-foreground">{col.tasks.length}</span>
            </div>
            <div className="space-y-2">
              {col.tasks.map((c) => (
                <div key={c.t} className="rounded-lg border border-border bg-card p-2.5 elev-1">
                  <p className="text-[11px] font-semibold leading-5">{c.t}</p>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[9px] text-muted-foreground">
                    <span className="rounded px-1 py-0.5 font-bold" style={{ color: c.prc, background: `${c.prc}14` }}>{c.pr}</span>
                    <span>{c.due}</span>
                    {c.tag && <span className="text-primary/80">#{c.tag}</span>}
                  </div>
                </div>
              ))}
              <button className="flex w-full items-center gap-1 rounded-lg border border-dashed border-border px-2 py-1.5 text-[10px] text-muted-foreground hover:border-primary/40"><Plus className="size-3" />افزودن</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarMockup() {
  const days = "ش ی د س چ پ ج".split(" ");
  const cells = [0,0,0,1,2,3,4, 5,6,7,8,9,10,11, 12,13,14,15,16,17,18, 19,20,21,22,23,24,25, 26,27,28,29,30,0,0];
  const tasksOnDay: Record<number, string[]> = { 5: ["جلسه تیم"], 12: ["تحویل پروژه"], 15: ["مطالعه", "ورزش"], 20: ["جلسه مشتری"], 25: ["آزمون"] };
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-card elev-3" dir="rtl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-extrabold">مهر ۱۴۰۴</p>
        <div className="flex items-center gap-1">
          <button className="grid size-6 place-items-center rounded hover:bg-muted"><ChevronLeft className="size-3.5" /></button>
          <button className="grid size-6 place-items-center rounded hover:bg-muted"><ArrowLeft className="size-3.5 rotate-180" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center">
        {days.map((d) => <div key={d} className="py-1.5 text-[10px] font-bold text-muted-foreground">{d}</div>)}
        {cells.map((n, i) => {
          if (n === 0) return <div key={i} className="min-h-[48px] border-b border-e border-border/40" />;
          const isToday = n === 15;
          const hasTasks = tasksOnDay[n];
          return (
            <div key={i} className={`relative min-h-[48px] border-b border-e border-border/40 p-1 text-start ${isToday ? "bg-accent" : ""}`}>
              <span className={`inline-grid size-5 place-items-center rounded-full text-[10px] font-bold ${isToday ? "bg-primary text-white" : ""}`}>{toFa(n)}</span>
              {hasTasks && <div className="mt-0.5 flex gap-0.5">{hasTasks.slice(0, 2).map((_, j) => <span key={j} className="h-1 w-1 rounded-full bg-primary/70" />)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnalyticsMockup() {
  const stats = [
    { label: "انجام‌شده", value: "۴۷", icon: CheckCircle2, color: "text-emerald-600" },
    { label: "کل کارها", value: "۶۲", icon: ListChecks, color: "text-foreground" },
    { label: "نرخ تکمیل", value: "۷۶٪", icon: TrendingUp, color: "text-primary" },
    { label: "زنجیره روزها", value: "۱۲", icon: Sparkles, color: "text-amber-600" },
  ];
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-card elev-3 p-4" dir="rtl">
      <p className="mb-3 text-sm font-extrabold">پیشرفت و بهره‌وری</p>
      <div className="mb-3 grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-muted/60 p-2.5">
            <s.icon className={`mb-1 size-3.5 ${s.color}`} />
            <p className="text-base font-extrabold tabular-nums">{s.value}</p>
            <p className="text-[9px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
      {/* Fake line chart */}
      <div className="relative h-28 rounded-lg bg-muted/40 p-3" dir="ltr">
        <svg viewBox="0 0 300 80" className="h-full w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0,60 C30,55 60,40 90,35 C120,30 150,45 180,25 C210,15 240,20 270,12 L300,10 L300,80 L0,80 Z" fill="url(#lg)" />
          <path d="M0,60 C30,55 60,40 90,35 C120,30 150,45 180,25 C210,15 240,20 270,12 L300,10" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <div className="absolute bottom-1.5 flex w-full justify-between px-1 text-[8px] text-muted-foreground">
          <span>شنبه</span><span>یکشنبه</span><span>دوشنبه</span><span>سه‌شنبه</span><span>چهارشنبه</span><span>پنجشنبه</span><span>جمعه</span>
        </div>
      </div>
    </div>
  );
}

function SmartInputMockup() {
  return (
    <div className="w-full rounded-2xl border border-border bg-card elev-3 p-4" dir="rtl">
      <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-accent/50 px-3 py-2.5">
        <Sparkles className="size-4 shrink-0 text-primary" />
        <span className="text-sm text-muted-foreground/70">جلسه تیم فردا ساعت ۱۰ #محصول</span>
        <span className="ms-auto shrink-0 rounded-lg bg-primary px-2.5 py-1 text-[10px] font-bold text-white">افزودن</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {[
          { icon: <CalendarDays className="size-2.5" />, text: "فردا" },
          { icon: <Clock className="size-2.5" />, text: "۱۰:۰۰" },
          { icon: <span className="size-1.5 rounded-full bg-blue-500" />, text: "محصول" },
        ].map((c) => (
          <span key={c.text} className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {c.icon}{c.text}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section label                                                      */
/* ------------------------------------------------------------------ */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-3 inline-block rounded-lg bg-accent px-3 py-1 text-[11px] font-bold text-accent-foreground">{children}</span>;
}

/* ------------------------------------------------------------------ */
/*  MAIN LANDING                                                       */
/* ------------------------------------------------------------------ */
export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const startCta = () => navigate(isAuthenticated ? "/dashboard" : "/auth");
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const navItems = [
    { label: "امکانات", href: "#features" },
    { label: "نحوه کار", href: "#how" },
    { label: "امکانات محصول", href: "#product" },
    { label: "سؤالات", href: "#faq" },
  ];

  return (
    <div className="min-h-svh bg-background" dir="rtl">
      {/* ─────────────────── HEADER ─────────────────── */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "border-b border-border/60 bg-background/80 backdrop-blur-xl shadow-sm" : "bg-transparent"}`}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><ListChecks className="size-5" /></span>
            <span className="text-lg font-extrabold tracking-tight">تسک‌لی</span>
          </a>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((n) => (
              <a key={n.href} href={n.href} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">{n.label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {!isLoading && isAuthenticated ? (
              <Button size="sm" onClick={startCta}>ورود به فضای کاری</Button>
            ) : (
              <>
                <Link to="/auth"><Button variant="ghost" size="sm" className="hidden sm:inline-flex">ورود</Button></Link>
                <Button size="sm" onClick={startCta}>شروع رایگان</Button>
              </>
            )}
            {/* Mobile hamburger */}
            <button onClick={() => setMobileOpen(!mobileOpen)} className="grid size-9 place-items-center rounded-lg hover:bg-muted md:hidden" aria-label="منو">
              <div className="flex flex-col gap-1"><span className={`h-0.5 w-4 rounded bg-foreground transition-transform ${mobileOpen ? "translate-y-1.5 rotate-45" : ""}`} /><span className={`h-0.5 w-4 rounded bg-foreground transition-opacity ${mobileOpen ? "opacity-0" : ""}`} /><span className={`h-0.5 w-4 rounded bg-foreground transition-transform ${mobileOpen ? "-translate-y-1.5 -rotate-45" : ""}`} /></div>
            </button>
          </div>
        </div>
        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-t border-border bg-card px-4 pb-4 pt-2 md:hidden">
            {navItems.map((n) => (
              <a key={n.href} href={n.href} onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted">{n.label}</a>
            ))}
            <Link to="/auth" onClick={() => setMobileOpen(false)} className="mt-2 block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted">ورود</Link>
          </div>
        )}
      </header>

      {/* ─────────────────── HERO ─────────────────── */}
      <section className="relative overflow-hidden pt-24 pb-16 sm:pt-32 sm:pb-24">
        {/* Ambient light orbs */}
        <div className="orb orb-blue animate-float pointer-events-none absolute -start-40 -top-20 size-[500px] opacity-80" />
        <div className="orb orb-cyan animate-float-slow pointer-events-none absolute -end-32 top-20 size-[400px] opacity-70" />
        <div className="orb orb-lavender animate-float pointer-events-none absolute bottom-0 start-1/3 size-[300px] opacity-50" />
        {/* Geometric accents */}
        <div className="pointer-events-none absolute top-32 start-[10%] size-64 rounded-full border border-white/30 opacity-60" />
        <div className="pointer-events-none absolute top-48 end-[8%] size-40 rounded-2xl border border-white/20 opacity-40 rotate-12" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <Anim>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.06] px-4 py-1.5 text-xs font-bold text-primary">
                <Zap className="size-3.5" />
                فضای کاری مدیریت پروژه و تسک
              </div>
            </Anim>
            <Anim delay={0.08}>
              <h1 className="text-4xl leading-[1.25] font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                همه کارهایت را
                <br />
                <span className="text-primary">در یک جریان منظم</span> مدیریت کن.
              </h1>
            </Anim>
            <Anim delay={0.16}>
              <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-muted-foreground sm:text-lg">
                تسک‌لی به تو کمک می‌کند کارها، پروژه‌ها و زمان‌ات را هوشمندانه سازماندهی کنی — از ثبت ایده تا پیگیری پیشرفت، همه در یک فضای منظم.
              </p>
            </Anim>
            <Anim delay={0.24}>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button size="lg" onClick={startCta} className="px-8 text-base">شروع رایگان<ArrowLeft className="me-1 size-4" /></Button>
                <a href="#product"><Button size="lg" variant="outline" className="px-8 text-base">مشاهده امکانات</Button></a>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">بدون کارت بانکی · بدون نصب · رایگان برای همیشه</p>
            </Anim>
          </div>
          {/* Hero product preview */}
          <Anim delay={0.3} className="mx-auto mt-12 max-w-4xl">
            <DashboardMockup />
          </Anim>
        </div>
      </section>

      {/* ─────────────────── STATS STRIP ─────────────────── */}
      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-8 px-4 py-6 sm:justify-between sm:px-6">
          {[
            { value: "۱۲۰۰+", label: "کاربر فعال" },
            { value: "۲۵۰۰۰+", label: "تسک ثبت‌شده" },
            { value: "۸۵۰+", label: "پروژه فعال" },
            { value: "۹۸٪", label: "رضایت کاربران" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-xl font-extrabold tabular-nums text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────────────── PRODUCT SHOWCASE ─────────────────── */}
      <section id="product" className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Anim className="mx-auto mb-12 max-w-2xl text-center">
            <SectionLabel>نمای کلی محصول</SectionLabel>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">فضایی طراحی شده برای تمرکز</h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">داشبورد هوشمند تسک‌لی در یک نگاه به تو می‌گوید چه کاری مهم‌تر است، چه کاری عقب افتاده و کار بعدی‌ات چیست.</p>
          </Anim>
          <Anim delay={0.1}>
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-b from-primary/[0.04] to-transparent" />
              <div className="relative">
                <DashboardMockup />
              </div>
            </div>
          </Anim>
        </div>
      </section>

      {/* ─────────────────── PROBLEM → SOLUTION ─────────────────── */}
      <section className="border-y border-border bg-muted/30 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Anim className="mx-auto max-w-2xl text-center">
            <SectionLabel>مشکل</SectionLabel>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">وقتی کارها پراکنده می‌شوند…</h2>
          </Anim>
          <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: TriangleAlert, t: "کارهای فراموش‌شده", d: "ایده‌ها و تسک‌ها در چند اپ پراکنده‌اند و هر روز چیزی از قلم می‌افتد." },
              { icon: FolderKanban, t: "پروژه‌های بدون ساختار", d: "بدون دسته‌بندی و اولویت، مدیریت پروژه‌های بزرگ تبدیل به کابوس می‌شود." },
              { icon: Clock, t: "ددلاین‌های نامشخص", d: "نمی‌دانی کدام کار فوری‌تر است و کدام را می‌توانی به بعد موکول کنی." },
              { icon: Inbox, t: "نبود دید کلی", d: "با چندین ابزار مختلف، هیچ‌وقت تصویر کاملی از وضعیت کارها نداری." },
              { icon: Timer, t: "هدررفت زمان", d: "ساعت‌ها صرف جست‌وجو در ابزارها و یادداشت‌های پراکنده می‌شود." },
              { icon: SquareCheckBig, t: "پیشرفت نامرئی", d: "بدون داشبورد و گزارش، نمی‌دانی واقعاً چقدر پیشرفت کرده‌ای." },
            ].map((p, i) => (
              <Anim key={p.t} delay={i * 0.06}>
                <div className="rounded-2xl border border-border bg-card p-5 elev-1">
                  <p.icon className="mb-3 size-5 text-destructive/70" />
                  <p className="text-sm font-bold">{p.t}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{p.d}</p>
                </div>
              </Anim>
            ))}
          </div>
          <Anim className="mx-auto mt-12 max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CheckCircle2 className="size-4" />
              تسک‌لی همه‌چیز را در یک فضای منظم قرار می‌دهد.
            </div>
          </Anim>
        </div>
      </section>

      {/* ─────────────────── FEATURES (MIXED LAYOUTS) ─────────────────── */}
      <section id="features" className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Anim className="mx-auto mb-14 max-w-2xl text-center">
            <SectionLabel>امکانات</SectionLabel>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">همه چیز برای یک روز منظم</h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">ابزارهایی که واقعاً به کارت می‌آید — بدون شلوغ‌کاری اضافه.</p>
          </Anim>

          {/* Feature 1: Large — Smart Input */}
          <Anim className="mb-6">
            <div className="grid items-center gap-6 rounded-2xl border border-border bg-card p-6 elev-1 sm:p-8 lg:grid-cols-2">
              <div>
                <span className="mb-2 inline-block rounded-lg bg-accent px-2.5 py-1 text-[10px] font-bold text-accent-foreground">۰۱</span>
                <h3 className="mt-2 text-xl font-extrabold">ثبت کار با یک جمله</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">«جلسه تیم فردا ساعت ۱۰ #محصول» — فقط تایپ کن. سیستم خودش تاریخ، ساعت و تگ را تشخیص می‌دهد.</p>
                <ul className="mt-4 space-y-2">
                  {["تشخیص خودکار تاریخ و ساعت", "اولویت‌گذاری با کلمات کلیدی", "تگ‌گذاری هوشمند"].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm"><CheckCircle2 className="size-4 shrink-0 text-emerald-500" />{f}</li>
                  ))}
                </ul>
              </div>
              <SmartInputMockup />
            </div>
          </Anim>

          {/* Feature 2+3: Side by side */}
          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <Anim delay={0.05}>
              <div className="h-full rounded-2xl border border-border bg-card p-6 elev-1">
                <span className="mb-2 inline-block rounded-lg bg-accent px-2.5 py-1 text-[10px] font-bold text-accent-foreground">۰۲</span>
                <h3 className="mt-2 text-lg font-extrabold">پروژه‌ها و تیم‌ها</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">کارهای بزرگ را به پروژه بشکن؛ پیشرفت هر پروژه را زنده ببین و عقب‌افتاده‌ها را نگیر.</p>
                <div className="mt-4 space-y-2">
                  {[{ n: "بازطراحی وب‌سایت", p: 68, c: "#4f46e5" }, { n: "پروژه دانشگاه", p: 40, c: "#f59e0b" }, { n: "رشد شخصی", p: 82, c: "#10b981" }].map((pr) => (
                    <div key={pr.n}>
                      <div className="flex items-center justify-between text-[11px]"><span className="flex items-center gap-1.5 font-bold"><span className="size-2 rounded-sm" style={{ background: pr.c }} />{pr.n}</span><span className="text-muted-foreground">{toFa(pr.p)}٪</span></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${pr.p}%`, background: pr.c }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </Anim>
            <Anim delay={0.1}>
              <div className="h-full rounded-2xl border border-border bg-card p-6 elev-1">
                <span className="mb-2 inline-block rounded-lg bg-accent px-2.5 py-1 text-[10px] font-bold text-accent-foreground">۰۳</span>
                <h3 className="mt-2 text-lg font-extrabold">تقویم شمسی</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">کارها را بکش و روی روز دلخواه رها کن؛ جابه‌جایی برنامه‌ها در چند ثانیه انجام می‌شود.</p>
                <div className="mt-4">
                  <CalendarMockup />
                </div>
              </div>
            </Anim>
          </div>

          {/* Feature 4: Large — Kanban */}
          <Anim className="mb-6">
            <div className="rounded-2xl border border-border bg-card p-6 elev-1 sm:p-8">
              <div className="mb-6 max-w-lg">
                <span className="mb-2 inline-block rounded-lg bg-accent px-2.5 py-1 text-[10px] font-bold text-accent-foreground">۰۴</span>
                <h3 className="mt-2 text-xl font-extrabold"> مدیریت پروژه با تخته Kanban</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">وضعیت هر کار را با کشیدن و رها کردن تغییر بده. از «انجام نشده» تا «انجام شده» — یک نگاه کافی است.</p>
              </div>
              <KanbanMockup />
            </div>
          </Anim>

          {/* Feature 5+6: Side by side */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Anim delay={0.05}>
              <div className="h-full rounded-2xl border border-border bg-card p-6 elev-1">
                <span className="mb-2 inline-block rounded-lg bg-accent px-2.5 py-1 text-[10px] font-bold text-accent-foreground">۰۵</span>
                <h3 className="mt-2 text-lg font-extrabold">پیشرفتت را ببین</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">نرخ تکمیل، زنجیره روزها و روند هفتگی؛ فقط عددی که به کارت می‌آید.</p>
                <div className="mt-4">
                  <AnalyticsMockup />
                </div>
              </div>
            </Anim>
            <Anim delay={0.1}>
              <div className="h-full rounded-2xl border border-border bg-card p-6 elev-1">
                <span className="mb-2 inline-block rounded-lg bg-accent px-2.5 py-1 text-[10px] font-bold text-accent-foreground">۰۶</span>
                <h3 className="mt-2 text-lg font-extrabold">جستجوی سریع</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">با Ctrl+K هر کاری را پیدا کن، هر دستوری را اجرا کن — بدون برداشتن دست از کیبورد.</p>
                <div className="mt-4 rounded-xl border border-border bg-muted/60 p-3">
                  <div className="flex items-center gap-2 rounded-lg bg-card border border-border px-3 py-2 elev-1">
                    <Search className="size-4 text-muted-foreground" />
                    <span className="flex-1 text-sm text-muted-foreground/60">جست‌وجو در کارها، پروژه‌ها…</span>
                    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">Ctrl K</kbd>
                  </div>
                  <div className="mt-2 space-y-1">
                    {["طراحی صفحه اصلی", "جلسه تیم محصول", "مطالعه فصل سوم"].map((t) => (
                      <div key={t} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] hover:bg-card">
                        <ListChecks className="size-3.5 text-muted-foreground" /><span className="flex-1">{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Anim>
          </div>
        </div>
      </section>

      {/* ─────────────────── HOW IT WORKS ─────────────────── */}
      <section id="how" className="border-y border-border bg-muted/30 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Anim className="mx-auto mb-14 max-w-2xl text-center">
            <SectionLabel>نحوه کار</SectionLabel>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">سه قدم تا شروع</h2>
          </Anim>
          <div className="relative grid gap-8 md:grid-cols-3">
            {/* Connecting line (desktop) */}
            <div className="pointer-events-none absolute top-12 hidden h-px w-full bg-border md:block" style={{ insetInlineStart: "16.67%", width: "66.66%" }} />
            {[
              { n: "۰۱", icon: Plus, title: "ثبت کن", desc: "کارهایت را با یک جمله ساده ثبت کن — تاریخ، ساعت و اولویت خودکار تنظیم می‌شوند." },
              { n: "۰۲", icon: FolderKanban, title: "سازماندهی کن", desc: "پروژه بساز، اولویت تعیین کن و کارها را در تخته Kanban مرتب کن." },
              { n: "۰۳", icon: TrendingUp, title: "پیشرفت کن", desc: "داشبورد و تقویم به‌صورت زنده پیشرفت‌ات را نشان می‌دهند." },
            ].map((s, i) => (
              <Anim key={s.n} delay={i * 0.1}>
                <div className="relative text-center">
                  <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl border-2 border-border bg-card text-2xl font-extrabold text-primary elev-2">{s.n}</div>
                  <s.icon className="mx-auto mb-2 size-5 text-primary/60" />
                  <h3 className="text-lg font-extrabold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{s.desc}</p>
                </div>
              </Anim>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────── CONTENT / EDITORIAL ─────────────────── */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Anim className="mb-12">
            <SectionLabel>برای اینکه بهتر کار کنی</SectionLabel>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">موضوعاتی که به کارت می‌آید</h2>
          </Anim>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Clock, title: "مدیریت زمان", desc: "اول کارهای مهم را انجام بده، نه هر کاری را.", color: "#4f46e5" },
              { icon: TriangleAlert, title: "اولویت‌بندی", desc: "فوری یا مهم؟ یاد بگیر چطور تشخیص بدهی.", color: "#f59e0b" },
              { icon: FolderKanban, title: "مدیریت پروژه", desc: "پروژه‌های بزرگ را به تسک‌های کوچک بشکن.", color: "#10b981" },
              { icon: Sparkles, title: "افزایش تمرکز", desc: "روش‌های عملی برای حذف حواس‌پرتی.", color: "#8b5cf6" },
            ].map((c, i) => (
              <Anim key={c.title} delay={i * 0.06}>
                <article className="group rounded-2xl border border-border bg-card p-5 transition-all elev-1 hover:-translate-y-0.5 hover:elev-2">
                  <span className="mb-3 grid size-10 place-items-center rounded-xl" style={{ background: `${c.color}12` }}><c.icon className="size-5" style={{ color: c.color }} /></span>
                  <h3 className="text-sm font-extrabold">{c.title}</h3>
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{c.desc}</p>
                </article>
              </Anim>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────── TESTIMONIALS ─────────────────── */}
      <section className="border-y border-border bg-muted/30 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Anim className="mx-auto mb-12 max-w-2xl text-center">
            <SectionLabel>نظرات کاربران</SectionLabel>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">کاربران چه می‌گویند</h2>
          </Anim>
          <div className="grid gap-5 md:grid-cols-3">
            {[
              { quote: "قبلاً کارهام پراکنده بود بین دفترچه و چند اپ. الان صبح‌ها داشبورد را باز می‌کنم و می‌دانم از کجا شروع کنم.", name: "سارا محمدی", role: "دانشجوی ارشد کامپیوتر" },
              { quote: "قابلیت ثبت کار با یک جمله برایم عادی شد؛ حالا وقتی ایده‌ای می‌آید در سه ثانیه ثبتش می‌کنم.", name: "امیر رضایی", role: "توسعه‌دهنده بک‌اند" },
              { quote: "بخش پیشرفت انگیزه‌ام را عوض کرد. دیدن زنجیره روزها باعث شد سه ماه پیوسته ورزش روزانه‌ام را انجام بدهم.", name: "نگار کریمی", role: "طراح محصول" },
            ].map((t, i) => (
              <Anim key={t.name} delay={i * 0.08}>
                <figure className="h-full rounded-2xl border border-border bg-card p-6 elev-1">
                  <div className="mb-3 flex gap-0.5">{[1,2,3,4,5].map((s) => <span key={s} className="text-amber-400">★</span>)}</div>
                  <blockquote className="text-sm leading-7 text-foreground">«{t.quote}»</blockquote>
                  <figcaption className="mt-4 flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground">{t.name[0]}</span>
                    <span><span className="block text-sm font-bold">{t.name}</span><span className="block text-[11px] text-muted-foreground">{t.role}</span></span>
                  </figcaption>
                </figure>
              </Anim>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────── FAQ ─────────────────── */}
      <section id="faq" className="py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <Anim className="mb-10 text-center">
            <SectionLabel>سؤالات</SectionLabel>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">سؤالات پرتکرار</h2>
          </Anim>
          <div className="space-y-3">
            {[
              ["شروع کار چقدر طول می‌کشد؟", "کمتر از یک دقیقه. بعد از ساخت حساب، ۴ قدم کوتاه را طی می‌کنی و اولین کار و پروژه‌ات آماده است."],
              ["اطلاعاتم کجا ذخیره می‌شود؟", "روی سرور امن فضای کاری خودت؛ فقط با حساب کاربری خودت قابل دسترسی است."],
              ["روی گوشی هم خوب کار می‌کند؟", "بله. رابط کاملاً واکنش‌گراست و برای موبایل نوار ناوبری پایین و دکمه شناور افزودن کار دارد."],
              ["امکان استفاده رایگان هست؟", "بله؛ نسخه رایگان برای استفاده شخصی کاملاً کامل است و محدودیت واقعی روی کارهای روزانه ندارد."],
            ].map(([q, a]) => (
              <details key={q} className="group rounded-xl border border-border bg-card px-5 py-4 elev-1">
                <summary className="cursor-pointer list-none text-sm font-bold marker:hidden">{q}<span className="float-start text-muted-foreground transition-transform group-open:rotate-45">+</span></summary>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────── FINAL CTA ─────────────────── */}
      <section className="px-4 pb-20 sm:px-6">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl px-6 py-16 text-center sm:py-20" style={{ background: "linear-gradient(160deg, #4f46e5, #312e81)" }}>
          {/* Decorative */}
          <div className="pointer-events-none absolute -top-20 -start-20 size-64 rounded-full bg-white/[0.06]" />
          <div className="pointer-events-none absolute -bottom-16 -end-16 size-48 rounded-2xl bg-white/[0.04] rotate-12" />
          <div className="pointer-events-none absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 size-96 rounded-full bg-white/[0.03]" />

          <Anim>
            <h2 className="relative text-3xl font-extrabold text-white sm:text-4xl">آماده‌ای کارهایت را منظم‌تر مدیریت کنی؟</h2>
            <p className="relative mx-auto mt-4 max-w-md text-sm leading-7 text-white/75">تسک‌لی را شروع کن و همه کارهایت را در یک فضای منظم مدیریت کن.</p>
            <Button size="lg" onClick={startCta} className="relative mt-8 bg-white px-10 text-base text-primary hover:bg-white/90">شروع رایگان<ArrowLeft className="me-1 size-4" /></Button>
          </Anim>
        </div>
      </section>

      {/* ─────────────────── FOOTER ─────────────────── */}
      <footer className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
            {/* Brand */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><ListChecks className="size-5" /></span>
                <span className="text-lg font-extrabold">تسک‌لی</span>
              </div>
              <p className="mt-3 max-w-xs text-sm leading-7 text-muted-foreground">فضای کاری شخصی برای مدیریت کارها، پروژه‌ها و پیشرفت روزانه — ساده، هوشمند و رایگان.</p>
            </div>
            {/* Product */}
            <div>
              <h4 className="mb-3 text-sm font-extrabold">محصول</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="transition hover:text-foreground">امکانات</a></li>
                <li><a href="#product" className="transition hover:text-foreground">نمای کلی</a></li>
                <li><a href="#how" className="transition hover:text-foreground">نحوه کار</a></li>
                <li><a href="#faq" className="transition hover:text-foreground">سؤالات</a></li>
              </ul>
            </div>
            {/* Workspace */}
            <div>
              <h4 className="mb-3 text-sm font-extrabold">فضای کاری</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/dashboard" className="transition hover:text-foreground">داشبورد</Link></li>
                <li><Link to="/projects" className="transition hover:text-foreground">پروژه‌ها</Link></li>
                <li><Link to="/calendar" className="transition hover:text-foreground">تقویم</Link></li>
                <li><Link to="/progress" className="transition hover:text-foreground">پیشرفت</Link></li>
              </ul>
            </div>
            {/* Account */}
            <div>
              <h4 className="mb-3 text-sm font-extrabold">حساب کاربری</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/auth" className="transition hover:text-foreground">ورود</Link></li>
                <li><Link to="/auth" className="transition hover:text-foreground">ثبت‌نام</Link></li>
                <li><Link to="/settings" className="transition hover:text-foreground">تنظیمات</Link></li>
                <li><Link to="/help" className="transition hover:text-foreground">راهنما</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
            <span>© {toFa(1404)} تسک‌لی — همه حقوق محفوظ است.</span>
            <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="inline-flex items-center gap-1 transition hover:text-foreground"><ArrowUp className="size-3.5" />برگشت به بالا</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
