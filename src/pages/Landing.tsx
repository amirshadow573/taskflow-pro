import { useEffect, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  ArrowLeft,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Flame,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Plus,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Link, useNavigate } from "react-router";
import { toFa } from "@/lib/persian";
import { InteractiveGrid } from "@/components/landing/InteractiveGrid";

/* ── Animation ── */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

function Anim({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      variants={fadeUp}
      initial={reduced ? undefined : "hidden"}
      whileInView={reduced ? undefined : "visible"}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── Section label chip ── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-3 inline-block rounded-lg bg-accent px-3 py-1 text-[11px] font-bold text-accent-foreground">
      {children}
    </span>
  );
}

/* ── Arrow between steps (RTL) ── */
function StepArrow() {
  return (
    <div className="hidden items-center justify-center text-primary/30 md:flex">
      <ArrowLeft className="size-5" />
    </div>
  );
}

/* ================================================================== */
/*  MOCKUPS — real product previews                                    */
/* ================================================================== */

const DEMO_TASKS = [
  { t: "طراحی صفحه اصلی سایت", pr: "بالا", prColor: "#ef4444", done: false, project: "بازطراحی وب‌سایت", pc: "#4f46e5", due: "امروز" },
  { t: "جلسه بررسی اسپرینت", pr: "متوسط", prColor: "#3b82f6", done: false, project: "بازطراحی وب‌سایت", pc: "#4f46e5", due: "امروز · ۱۰:۰۰" },
  { t: "مطالعه فصل سوم زیست", pr: "پایین", prColor: "#10b981", done: false, project: "پروژه دانشگاه", pc: "#f59e0b", due: "امروز · ۱۸:۰۰" },
  { t: "ارسال پروژه به مشتری", pr: "فوری", prColor: "#ef4444", done: false, project: "بازطراحی وب‌سایت", pc: "#4f46e5", due: "دیروز" },
  { t: "پاسخ به ایمیل‌ها", pr: "پایین", prColor: "#10b981", done: true, project: null, pc: "#64748b", due: "امروز" },
  { t: "مرور روزانه", pr: "پایین", prColor: "#10b981", done: true, project: "رشد شخصی", pc: "#10b981", due: "امروز" },
];

/** Main dashboard mockup — used in hero, showcase, and two-column sections. */
function DashboardMockup({ compact = false }: { compact?: boolean }) {
  const visible = compact ? DEMO_TASKS.slice(0, 4) : DEMO_TASKS;
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-card elev-3" dir="rtl">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-red-400/70" />
          <span className="size-2.5 rounded-full bg-amber-400/70" />
          <span className="size-2.5 rounded-full bg-emerald-400/70" />
        </span>
        <span className="ms-3 h-5 flex-1 rounded-md border border-border/60 bg-card px-2 text-[10px] leading-5 text-muted-foreground">
          taskflow.app/dashboard
        </span>
      </div>
      <div className="flex min-h-[280px]">
        <div className="hidden w-44 shrink-0 border-e border-border bg-card p-3 md:block">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-primary text-white">
              <ListChecks className="size-3.5" />
            </span>
            <span className="text-xs font-extrabold">تسک‌لی</span>
          </div>
          {["داشبورد", "امروز", "صندوق ورودی", "کارهای من", "پروژه‌ها", "تقویم", "پیشرفت"].map((l, i) => (
            <div
              key={l}
              className={`mb-0.5 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${i === 0 ? "bg-accent text-accent-foreground font-bold" : "text-muted-foreground"}`}
            >
              <span className="size-3.5 rounded bg-muted" />
              {l}
            </div>
          ))}
        </div>
        <div className="flex-1 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground">صبح بخیر 👋</p>
              <p className="text-sm font-extrabold">امروز — چهارشنبه ۱۵ مهر</p>
            </div>
            <span className="rounded-lg bg-accent px-2 py-1 text-[10px] font-bold text-accent-foreground">۵۸٪ پیشرفت</span>
          </div>
          <div className="mb-3 grid grid-cols-4 gap-2">
            {[{ l: "امروز", v: "۱۲" }, { l: "انجام‌شده", v: "۷", c: "text-emerald-600" }, { l: "در حال انجام", v: "۳", c: "text-blue-600" }, { l: "عقب‌افتاده", v: "۲", c: "text-red-500" }].map((s) => (
              <div key={s.l} className="rounded-lg bg-muted/60 p-2 text-center">
                <p className={`text-base font-extrabold tabular-nums ${s.c ?? ""}`}>{s.v}</p>
                <p className="text-[9px] text-muted-foreground">{s.l}</p>
              </div>
            ))}
          </div>
          <div className="space-y-0.5">
            {visible.map((r) => (
              <div key={r.t} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60">
                <span
                  className="grid size-4 shrink-0 place-items-center rounded-full border-2"
                  style={{ borderColor: r.done ? r.prColor : "var(--border)", background: r.done ? r.prColor : "transparent" }}
                >
                  {r.done && <CheckCircle2 className="size-2 text-white" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[11px] font-semibold ${r.done ? "text-muted-foreground line-through" : ""}`}>
                    {r.t}
                  </span>
                  <span className="flex items-center gap-2 text-[9px] text-muted-foreground">
                    {r.project && (
                      <span className="inline-flex items-center gap-0.5">
                        <span className="size-1.5 rounded-sm" style={{ background: r.pc }} />
                        {r.project}
                      </span>
                    )}
                    <span style={{ color: r.due === "دیروز" ? "#ef4444" : undefined }}>{r.due}</span>
                  </span>
                </span>
                <span
                  className="hidden shrink-0 rounded border px-1 py-0.5 text-[8px] font-bold sm:inline"
                  style={{ color: r.prColor, borderColor: `${r.prColor}40`, background: `${r.prColor}12` }}
                >
                  {r.pr}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Calendar mockup — used in daily planning section. */
function CalendarMockup() {
  const days = "ش ی د س چ پ ج".split(" ");
  const cells = [0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 0, 0];
  const tasksOnDay: Record<number, string[]> = { 5: ["جلسه تیم"], 12: ["تحویل پروژه"], 15: ["مطالعه", "ورزش"], 20: ["جلسه مشتری"], 25: ["آزمون"] };
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-card elev-3" dir="rtl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-extrabold">مهر ۱۴۰۴</p>
        <div className="flex items-center gap-1">
          <button className="grid size-6 place-items-center rounded hover:bg-muted"><ChevronLeft className="size-3.5" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center">
        {days.map((d) => (
          <div key={d} className="py-1.5 text-[10px] font-bold text-muted-foreground">{d}</div>
        ))}
        {cells.map((n, i) => {
          if (n === 0) return <div key={i} className="min-h-[48px] border-b border-e border-border/40" />;
          const isToday = n === 15;
          const hasTasks = tasksOnDay[n];
          return (
            <div key={i} className={`relative min-h-[48px] border-b border-e border-border/40 p-1 text-start ${isToday ? "bg-accent" : ""}`}>
              <span className={`inline-grid size-5 place-items-center rounded-full text-[10px] font-bold ${isToday ? "bg-primary text-white" : ""}`}>
                {toFa(n)}
              </span>
              {hasTasks && (
                <div className="mt-0.5 flex gap-0.5">
                  {hasTasks.slice(0, 2).map((_, j) => (
                    <span key={j} className="h-1 w-1 rounded-full bg-primary/70" />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Analytics mockup — productivity section. */
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

/** Level-Up mockup — progress section. */
function ProgressMockup() {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-card elev-3 p-5" dir="rtl">
      <div className="mb-4 flex items-center gap-4">
        <div className="relative shrink-0">
          <div className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-[#5B5FE6] text-xl font-black text-white shadow-lg shadow-primary/25">
            {toFa(7)}
          </div>
          <span className="absolute -bottom-1 start-1/2 -translate-x-1/2 rounded-full border border-primary/20 bg-white px-2 text-[9px] font-bold text-primary dark:bg-slate-900">
            سطح
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-extrabold">متمرکز</p>
          <p className="text-[11px] text-muted-foreground">۱۲۸۰ XP از ۱۵۰۰ XP</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-l from-primary to-[#5B5FE6]" style={{ width: "85%" }} />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">۲۲۰ XP تا سطح ۸</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Flame, label: "استمرار", value: "۱۲ روز", color: "text-amber-600" },
          { icon: Target, label: "امتیاز امروز", value: "۸۵", color: "text-primary" },
          { icon: Trophy, label: "دستاوردها", value: "۸", color: "text-violet-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-muted/50 p-2 text-center">
            <s.icon className={`mx-auto mb-1 size-4 ${s.color}`} />
            <p className="text-sm font-extrabold tabular-nums">{s.value}</p>
            <p className="text-[9px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  MAIN LANDING PAGE                                                  */
/* ================================================================== */
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

  const NAV_ITEMS = [
    { label: "ویژگی‌ها", href: "#features" },
    { label: "نحوه کار", href: "#how" },
    { label: "پیشرفت من", href: "#progress" },
    { label: "نظرات کاربران", href: "#testimonials" },
    { label: "سؤالات", href: "#faq" },
  ];

  return (
    <div className="relative min-h-svh" dir="rtl">
      {/* ═══════════ GLOBAL BACKGROUND CANVAS ═══════════ */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="bg-page-light absolute inset-0 dark:hidden" />
        <div className="bg-page-dark absolute inset-0 hidden dark:block" />
        <InteractiveGrid />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-white/60 to-transparent dark:from-[#0c1222]/80" />
      </div>

      <div className="relative z-10">
        {/* ═══════════ 1. HEADER ═══════════ */}
        <header
          className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
            scrolled
              ? "border-b border-border/60 bg-background/80 backdrop-blur-xl shadow-sm"
              : "bg-transparent"
          }`}
        >
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
            <a href="/" className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
                <ListChecks className="size-5" />
              </span>
              <span className="text-lg font-extrabold tracking-tight">تسک‌لی</span>
            </a>
            <nav className="hidden items-center gap-1 md:flex">
              {NAV_ITEMS.map((n) => (
                <a
                  key={n.href}
                  href={n.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  {n.label}
                </a>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              {!isLoading && isAuthenticated ? (
                <Button size="sm" onClick={startCta}>
                  ورود به فضای کاری
                </Button>
              ) : (
                <>
                  <Link to="/auth">
                    <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                      ورود
                    </Button>
                  </Link>
                  <Button size="sm" onClick={startCta}>
                    شروع رایگان
                  </Button>
                </>
              )}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="grid size-9 place-items-center rounded-lg hover:bg-muted md:hidden"
                aria-label="منو"
              >
                <div className="flex flex-col gap-1">
                  <span className={`h-0.5 w-4 rounded bg-foreground transition-transform ${mobileOpen ? "translate-y-1.5 rotate-45" : ""}`} />
                  <span className={`h-0.5 w-4 rounded bg-foreground transition-opacity ${mobileOpen ? "opacity-0" : ""}`} />
                  <span className={`h-0.5 w-4 rounded bg-foreground transition-transform ${mobileOpen ? "-translate-y-1.5 -rotate-45" : ""}`} />
                </div>
              </button>
            </div>
          </div>
          {mobileOpen && (
            <div className="border-t border-border bg-card px-4 pb-4 pt-2 md:hidden">
              {NAV_ITEMS.map((n) => (
                <a
                  key={n.href}
                  href={n.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
                >
                  {n.label}
                </a>
              ))}
              <Link
                to="/auth"
                onClick={() => setMobileOpen(false)}
                className="mt-2 block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                ورود
              </Link>
            </div>
          )}
        </header>

        {/* ═══════════ 2. HERO ═══════════ */}
        <section className="relative overflow-hidden pt-24 pb-8 sm:pt-32 sm:pb-12">
          <div className="orb orb-blue animate-float pointer-events-none absolute -start-40 -top-20 size-[500px] opacity-80" />
          <div className="orb orb-cyan animate-float-slow pointer-events-none absolute -end-32 top-20 size-[400px] opacity-70" />
          <div className="orb orb-lavender animate-float pointer-events-none absolute bottom-0 start-1/3 size-[300px] opacity-50" />

          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.2fr]">
              {/* Text side */}
              <Anim className="order-2 text-center lg:order-1 lg:text-start">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.06] px-4 py-1.5 text-xs font-bold text-primary">
                  <Zap className="size-3.5" />
                  فضای کاری مدیریت پروژه و تسک
                </div>
                <h1 className="text-4xl leading-[1.25] font-extrabold tracking-tight text-foreground sm:text-5xl">
                  همه کارهایت را
                  <br />
                  <span className="text-primary">در یک جریان منظم</span> مدیریت کن.
                </h1>
                <p className="mx-auto mt-6 max-w-lg text-base leading-8 text-muted-foreground sm:text-lg lg:mx-0">
                  کارها، برنامه‌های روزانه، عادت‌ها و اهداف خودت را در یک محیط منظم مدیریت کن، پیشرفتت را ببین و هر روز یک قدم جلوتر برو.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                  <Button size="lg" onClick={startCta} className="px-8 text-base">
                    شروع رایگان
                    <ArrowLeft className="me-1 size-4" />
                  </Button>
                  <a href="#product">
                    <Button size="lg" variant="outline" className="px-8 text-base">
                      مشاهده داشبورد
                    </Button>
                  </a>
                </div>
              </Anim>
              {/* Image side */}
              <Anim delay={0.15} className="order-1 lg:order-2">
                <div className="relative mx-auto max-w-xl">
                  <div className="pointer-events-none absolute -inset-6 rounded-3xl bg-gradient-to-b from-primary/[0.04] to-transparent" />
                  <div className="relative">
                    <DashboardMockup />
                  </div>
                </div>
              </Anim>
            </div>
          </div>
        </section>

        {/* ═══════════ 3. STATS STRIP ═══════════ */}
        <section className="border-y border-border/50">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-8 px-4 py-6 sm:justify-between sm:px-6">
            {[
              { value: "۱۲۰۰+", label: "کاربر فعال" },
              { value: "۲۵۰۰۰+", label: "تسک ثبت‌شده" },
              { value: "۸۵۰+", label: "پروژه فعال" },
              { value: "۹۸٪", label: "رضایت کاربران" },
              { value: "۱۲+", label: "روز استمرار متوسط" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3 text-center">
                <span className="size-2 rounded-full bg-primary/40" />
                <div>
                  <p className="text-lg font-extrabold tabular-nums text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════ 4. FULL-WIDTH PRODUCT SHOWCASE ═══════════ */}
        <section id="product" className="py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Anim className="mx-auto mb-12 max-w-2xl text-center">
              <SectionLabel>نمای کلی محصول</SectionLabel>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">مدیریت تمام کارها در یک نگاه</h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                از ثبت یک کار ساده تا پیگیری برنامه روزانه، همه چیز را در یک محیط یکپارچه و قابل مدیریت در اختیار داشته باش.
              </p>
            </Anim>
            <Anim delay={0.1}>
              <DashboardMockup />
            </Anim>
          </div>
        </section>

        {/* ═══════════ 5. TWO-COLUMN: TASK MANAGEMENT ═══════════ */}
        <section id="features" className="border-y border-border/50 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <Anim className="order-2 lg:order-1">
                <DashboardMockup compact />
              </Anim>
              <Anim delay={0.1} className="order-1 lg:order-2">
                <SectionLabel>مدیریت کارها</SectionLabel>
                <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">کارهایت را ساده‌تر مدیریت کن</h2>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                  کارهای روزانه و مهمت را در یک فضای منظم ببین، اولویت‌بندی کن و وضعیت انجام آن‌ها را همیشه در اختیار داشته باش.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    { icon: ListChecks, title: "لیست کارها", desc: "همه کارهایت در یک فضای منظم و قابل فیلتر" },
                    { icon: Target, title: "کارهای مهم", desc: "اولویت‌بندی هوشمند برای تمرکز روی مهم‌ها" },
                    { icon: CalendarDays, title: "کارهای روزانه", desc: "برنامه روزانه خودت را هر صبح ببین" },
                    { icon: CheckCircle2, title: "پیگیری انجام", desc: "وضعیت هر کار را لحظه‌ای ببین" },
                  ].map((f) => (
                    <li key={f.title} className="flex items-start gap-3">
                      <span className="ui-icon-tile mt-0.5 size-8 shrink-0">
                        <f.icon className="size-4 text-primary" />
                      </span>
                      <div>
                        <p className="text-sm font-bold">{f.title}</p>
                        <p className="text-xs text-muted-foreground">{f.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Anim>
            </div>
          </div>
        </section>

        {/* ═══════════ 6. TWO-COLUMN: DAILY PLANNING ═══════════ */}
        <section className="py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <Anim className="order-1">
                <SectionLabel>برنامه‌ریزی روزانه</SectionLabel>
                <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">روز خودت را هوشمندانه برنامه‌ریزی کن</h2>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                  کارهای روزانه، برنامه‌های آینده و وظایف تکرارشونده را در کنار هم ببین تا بدانی امروز چه کاری باید انجام شود.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    { icon: LayoutDashboard, title: "برنامه روزانه", desc: "کارهای امروز را یکجا ببین" },
                    { icon: CalendarDays, title: "تقویم شمسی", desc: "کارها را روی تقویم ببین و جابه‌جا کن" },
                    { icon: Inbox, title: "کارهای تکرارشونده", desc: "روتین‌های روزانه و هفتگی خودت را تنظیم کن" },
                    { icon: Zap, title: "اولویت‌بندی", desc: "مهم‌ترین کارها همیشه بالای لیست باشند" },
                  ].map((f) => (
                    <li key={f.title} className="flex items-start gap-3">
                      <span className="ui-icon-tile mt-0.5 size-8 shrink-0">
                        <f.icon className="size-4 text-primary" />
                      </span>
                      <div>
                        <p className="text-sm font-bold">{f.title}</p>
                        <p className="text-xs text-muted-foreground">{f.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Anim>
              <Anim delay={0.1} className="order-2">
                <CalendarMockup />
              </Anim>
            </div>
          </div>
        </section>

        {/* ═══════════ 7. PRODUCTIVITY CARDS ═══════════ */}
        <section className="border-y border-border/50 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Anim className="mx-auto mb-12 max-w-2xl text-center">
              <SectionLabel>بهره‌وری</SectionLabel>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">پیشرفت خودت را ببین</h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                فقط کارهایت را انجام نده؛ ببین چقدر پیشرفت کرده‌ای و روند عملکردت را در طول زمان دنبال کن.
              </p>
            </Anim>
            <div className="grid gap-5 md:grid-cols-3">
              <Anim delay={0.05}>
                <div className="ui-surface h-full rounded-2xl p-5">
                  <span className="mb-3 grid size-10 place-items-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
                    <CheckCircle2 className="size-5 text-emerald-600" />
                  </span>
                  <h3 className="text-base font-extrabold">تکمیل کارها</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">نرخ تکمیل روزانه و هفتگی خودت را ببین.</p>
                  <div className="mt-4">
                    <AnalyticsMockup />
                  </div>
                </div>
              </Anim>
              <Anim delay={0.1}>
                <div className="ui-surface relative h-full overflow-hidden rounded-2xl p-5 ring-2 ring-primary/20">
                  <span className="mb-3 grid size-10 place-items-center rounded-xl bg-primary/10">
                    <TrendingUp className="size-5 text-primary" />
                  </span>
                  <h3 className="text-base font-extrabold">روند عملکرد</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">نمودار هفتگی و ماهانه پیشرفت.</p>
                  <div className="mt-4 rounded-xl bg-muted/40 p-3" dir="ltr">
                    <svg viewBox="0 0 300 60" className="h-20 w-full" preserveAspectRatio="none">
                      <path d="M0,45 C40,40 80,25 120,30 C160,35 200,15 240,10 L300,5" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
              </Anim>
              <Anim delay={0.15}>
                <div className="ui-surface h-full rounded-2xl p-5">
                  <span className="mb-3 grid size-10 place-items-center rounded-xl bg-amber-50 dark:bg-amber-500/10">
                    <Flame className="size-5 text-amber-600" />
                  </span>
                  <h3 className="text-base font-extrabold">استمرار و زنجیره</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">روزهای پیوسته فعالیت خودت را حفظ کن.</p>
                  <div className="mt-4 grid grid-cols-7 gap-1">
                    {Array.from({ length: 28 }).map((_, i) => {
                      const active = i < 12 || (i > 15 && i < 22);
                      return (
                        <div
                          key={i}
                          className={`aspect-square rounded-sm ${active ? "bg-primary/60" : "bg-muted/60"}`}
                        />
                      );
                    })}
                  </div>
                  <p className="mt-2 text-center text-[10px] text-muted-foreground">۱۲ روز استمرار</p>
                </div>
              </Anim>
            </div>
          </div>
        </section>

        {/* ═══════════ 8. LEVEL-UP / PERSONAL PROGRESS ═══════════ */}
        <section id="progress" className="py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Anim className="mx-auto mb-12 max-w-2xl text-center">
              <SectionLabel>پیشرفت شخصی</SectionLabel>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">هر کاری که انجام می‌دهی، بخشی از پیشرفت توست</h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                با انجام کارها، حفظ استمرار و رسیدن به اهداف، پیشرفت خودت را ثبت کن و در مسیر سطح‌های بالاتر حرکت کن.
              </p>
            </Anim>
            <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
              <Anim>
                <ProgressMockup />
              </Anim>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { icon: CheckCircle2, title: "ماموریت‌های روزانه", value: "۳ / ۵", desc: "امروز", color: "text-emerald-600" },
                  { icon: Flame, title: "چالش فعال", value: "۱۴ روز تمرکز", desc: "روز ۸ / ۱۴", color: "text-amber-600" },
                  { icon: Trophy, title: "آخرین دستاورد", value: "۷ روز استمرار", desc: "۱۵ مهر ۱۴۰۴", color: "text-violet-600" },
                  { icon: Target, title: "مسیر فعال", value: "رشد فردی", desc: "مرحله ۳ / ۶", color: "text-primary" },
                ].map((c, i) => (
                  <Anim key={c.title} delay={i * 0.06}>
                    <div className="ui-surface rounded-2xl p-4">
                      <div className="flex items-center gap-2">
                        <c.icon className={`size-4 ${c.color}`} />
                        <span className="text-xs font-bold">{c.title}</span>
                      </div>
                      <p className="mt-2 text-lg font-extrabold">{c.value}</p>
                      <p className="text-[11px] text-muted-foreground">{c.desc}</p>
                    </div>
                  </Anim>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ 9. HOW IT WORKS — 4 STEPS ═══════════ */}
        <section id="how" className="border-y border-border/50 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Anim className="mx-auto mb-14 max-w-2xl text-center">
              <SectionLabel>نحوه کار</SectionLabel>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">چهار قدم تا پیشرفت</h2>
            </Anim>
            <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-start md:gap-0">
              {[
                { n: "۰۱", icon: LayoutDashboard, title: "برنامه‌ریزی", desc: "کارها و اهدافت را ثبت کن و اولویت‌بندی کن." },
                { n: "۰۲", icon: CheckCircle2, title: "انجام کارها", desc: "هر روز کارهایت را انجام بده و تیک بزن." },
                { n: "۰۳", icon: TrendingUp, title: "ثبت پیشرفت", desc: "پیشرفت و استمرارت را در داشبورد ببین." },
                { n: "۰۴", icon: Target, title: "رسیدن به هدف", desc: "با XP و سطح‌بندی به اهدافت نزدیک‌تر شو." },
              ].map((s, i) => (
                <Anim key={s.n} delay={i * 0.08} className="flex-1">
                  <div className="flex flex-col items-center text-center md:flex-row md:text-start">
                    {i > 0 && <StepArrow />}
                    <div className="flex-1 px-2 py-2">
                      <div className="ui-icon-tile mx-auto mb-3 size-14 text-xl font-extrabold text-primary md:mx-0">{s.n}</div>
                      <s.icon className="mb-2 size-5 text-primary/60" />
                      <h3 className="text-base font-extrabold">{s.title}</h3>
                      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{s.desc}</p>
                    </div>
                  </div>
                </Anim>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ 10. BENEFITS ═══════════ */}
        <section className="py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Anim className="mx-auto mb-12 max-w-2xl text-center">
              <SectionLabel>مزایا</SectionLabel>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">همه چیز برای یک روز منظم</h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                ابزارهایی که کمک می‌کنند کارهای روزانه‌ات را بهتر مدیریت کنی و مسیر پیشرفتت را ببینی.
              </p>
            </Anim>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: ListChecks, title: "نظم بیشتر", desc: "همه کارها در یک فضای منظم" },
                { icon: Zap, title: "تمرکز بیشتر", desc: "مهم‌ترین کارها همیشه در دید" },
                { icon: Clock, title: "مدیریت زمان", desc: "برنامه‌ریزی دقیق روزانه" },
                { icon: TrendingUp, title: "پیگیری پیشرفت", desc: "نمودار و آمار زنده" },
                { icon: Inbox, title: "مدیریت عادت‌ها", desc: "روتین‌های تکراری روزانه" },
                { icon: Target, title: "رسیدن به اهداف", desc: "با مسیرهای مشخص" },
                { icon: Flame, title: "انگیزه روزانه", desc: "XP و سطح‌بندی" },
                { icon: Trophy, title: "دستاوردها", desc: "باز کردن قفل موفقیت‌ها" },
              ].map((c, i) => (
                <Anim key={c.title} delay={i * 0.04}>
                  <div className="ui-surface ui-surface-hover rounded-2xl p-5">
                    <c.icon className="mb-3 size-5 text-primary" />
                    <h3 className="text-sm font-extrabold">{c.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{c.desc}</p>
                  </div>
                </Anim>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ 11. TESTIMONIALS ═══════════ */}
        <section id="testimonials" className="border-y border-border/50 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Anim className="mx-auto mb-12 max-w-2xl text-center">
              <SectionLabel>نظرات کاربران</SectionLabel>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">کاربران چه می‌گویند؟</h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                تجربه کاربرانی که برای مدیریت بهتر کارهایشان از پلتفرم استفاده می‌کنند.
              </p>
            </Anim>
            <div className="grid gap-5 md:grid-cols-3">
              {[
                {
                  quote: "بالاخره توانستم کارهای روزانه‌ام را از حالت پراکنده خارج کنم و همه چیز را یکجا ببینم.",
                  name: "سارا محمدی",
                  role: "دانشجوی ارشد کامپیوتر",
                },
                {
                  quote: "نمایش پیشرفت باعث شده استمرار بیشتری در انجام کارها داشته باشم.",
                  name: "امیر رضایی",
                  role: "توسعه‌دهنده بک‌اند",
                },
                {
                  quote: "برای برنامه‌ریزی روزانه و پیگیری کارها، محیط ساده و کاربردی‌ای دارد.",
                  name: "نگار کریمی",
                  role: "طراح محصول",
                },
              ].map((t, i) => (
                <Anim key={t.name} delay={i * 0.08}>
                  <figure className="ui-surface h-full rounded-2xl p-6">
                    <div className="mb-3 flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span key={s} className="text-amber-400">★</span>
                      ))}
                    </div>
                    <blockquote className="text-sm leading-7 text-foreground">«{t.quote}»</blockquote>
                    <figcaption className="mt-4 flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                        {t.name[0]}
                      </span>
                      <span>
                        <span className="block text-sm font-bold">{t.name}</span>
                        <span className="block text-[11px] text-muted-foreground">{t.role}</span>
                      </span>
                    </figcaption>
                  </figure>
                </Anim>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ 12. FAQ ═══════════ */}
        <section id="faq" className="py-20 sm:py-28">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <Anim className="mb-10 text-center">
              <SectionLabel>سؤالات</SectionLabel>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight">سؤالات متداول</h2>
            </Anim>
            <div className="space-y-3">
              {([
                ["این پلتفرم برای چه کسانی مناسب است؟", "برای هر کسی که می‌خواهد کارهای روزانه، پروژه‌ها، عادت‌ها و اهدافش را منظم مدیریت کند — دانشجو، برنامه‌نویس، کارمند یا هر کسی با برنامه روزانه شلوغ."],
                ["چه نوع کارهایی را می‌توانم مدیریت کنم؟", "کارهای روزانه، پروژه‌های بزرگ، وظایف تکرارشونده، عادت‌ها، روتین‌ها و اهداف شخصی — همه در یک فضا."],
                ["آیا می‌توانم عادت‌ها و روتین‌های خودم را پیگیری کنم؟", "بله. روتین‌های روزانه و هفتگی بساز و هر بار که انجامشان می‌دهی تیک بزن. زنجیره استمرارت را ببین."],
                ["آیا امکان برنامه‌ریزی روزانه و استفاده از تقویم وجود دارد؟", "بله. تقویم شمسی با قابلیت کشیدن و رها کردن کارها، برنامه روزانه و هفتگی."],
                ["سیستم سطح‌بندی و XP چگونه کار می‌کند؟", "هر کار انجام‌شده XP می‌دهد. با XP جمع‌آوری‌شده سطح بالا می‌روی و دستاوردها باز می‌کنی."],
                ["مسیرهای رشد چیست؟", "مسیرهای از پیش طراحی‌شده شخصی‌سازی با مراحل مشخص، مأموریت‌ها و پاداش XP."],
                ["آیا می‌توانم پیشرفت خودم را در طول زمان مشاهده کنم؟", "بله. نمودار هفتگی و ماهانه، آمار تکمیل کارها، زنجیره استمرار و دستاوردها."],
              ] as [string, string][]).map(([q, a]) => (
                <details key={q} className="ui-surface group rounded-2xl px-5 py-4">
                  <summary className="cursor-pointer list-none text-sm font-bold marker:hidden">
                    {q}
                    <span className="float-start ms-2 text-muted-foreground transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ 13. FINAL CTA ═══════════ */}
        <section className="px-4 pb-20 sm:px-6">
          <div
            className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl px-6 py-16 text-center sm:py-20"
            style={{ background: "linear-gradient(160deg, #4f46e5, #312e81)" }}
          >
            <div className="pointer-events-none absolute -top-20 -start-20 size-64 rounded-full bg-white/[0.06]" />
            <div className="pointer-events-none absolute -bottom-16 -end-16 size-48 rounded-2xl bg-white/[0.04] rotate-12" />
            <div className="pointer-events-none absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 size-96 rounded-full bg-white/[0.03]" />
            <Anim>
              <h2 className="relative text-3xl font-extrabold text-white sm:text-4xl">
                آماده‌ای کارهایت را منظم‌تر مدیریت کنی؟
              </h2>
              <p className="relative mx-auto mt-4 max-w-md text-sm leading-7 text-white/75">
                از امروز کارهایت را بهتر مدیریت کن، پیشرفتت را ببین و قدم‌به‌قدم به اهداف خودت نزدیک‌تر شو.
              </p>
              <Button
                size="lg"
                onClick={startCta}
                className="relative mt-8 bg-white px-10 text-base text-primary hover:bg-white/90"
              >
                شروع رایگان
                <ArrowLeft className="me-1 size-4" />
              </Button>
            </Anim>
          </div>
        </section>

        {/* ═══════════ 14. FOOTER ═══════════ */}
        <footer className="border-t border-border/50">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
                    <ListChecks className="size-5" />
                  </span>
                  <span className="text-lg font-extrabold">تسک‌لی</span>
                </div>
                <p className="mt-3 max-w-xs text-sm leading-7 text-muted-foreground">
                  یک فضای منظم برای مدیریت کارها، برنامه‌ریزی روزانه و پیگیری پیشرفت.
                </p>
              </div>
              <div>
                <h4 className="mb-3 text-sm font-extrabold">محصول</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="#features" className="transition hover:text-foreground">ویژگی‌ها</a></li>
                  <li><a href="#product" className="transition hover:text-foreground">نمای کلی</a></li>
                  <li><a href="#how" className="transition hover:text-foreground">نحوه کار</a></li>
                  <li><a href="#progress" className="transition hover:text-foreground">پیشرفت من</a></li>
                </ul>
              </div>
              <div>
                <h4 className="mb-3 text-sm font-extrabold">فضای کاری</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><Link to="/dashboard" className="transition hover:text-foreground">داشبورد</Link></li>
                  <li><Link to="/projects" className="transition hover:text-foreground">پروژه‌ها</Link></li>
                  <li><Link to="/calendar" className="transition hover:text-foreground">تقویم</Link></li>
                  <li><Link to="/progress" className="transition hover:text-foreground">پیشرفت</Link></li>
                </ul>
              </div>
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
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="inline-flex items-center gap-1 transition hover:text-foreground"
              >
                <ArrowUp className="size-3.5" />
                برگشت به بالا
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
