import { useEffect, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  ArrowLeft,
  ArrowUp,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock,
  Flame,
  FolderKanban,
  GraduationCap,
  Laptop,
  ListChecks,
  Sparkles,
  Store,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Link, useNavigate } from "react-router";
import { toFa } from "@/lib/persian";
import {
  AnalyticsPreview,
  CalendarPreview,
  GoalsChainPreview,
  HeroDashboard,
  PlanningPreview,
  ProgressPreview,
  ProjectsPreview,
  RoutinesPreview,
  TasksPreview,
  TimelinePreview,
  TodayPreview,
  StudentPreview,
  EmployeePreview,
  FreelancerPreview,
  ManagerPreview,
  BusinessPreview,
  PersonalPreview,
} from "@/components/landing/Previews";

/* ── Animation (restrained fade-up only, §35) ── */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
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

/* Sections use px-[4%] directly: full-width layout with small side margins (§6). */

/* ── Small chip above a section heading ── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-3 inline-block rounded-lg bg-accent px-3 py-1 text-[11px] font-bold text-accent-foreground">
      {children}
    </span>
  );
}

/* ── Centered heading with the short rule from the wireframe ── */
function CenteredHeading({
  title,
  lead,
  id,
}: {
  title: string;
  lead?: string;
  id?: string;
}) {
  return (
    <Anim className="mx-auto max-w-3xl text-center">
      <h2 id={id} className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        {title}
      </h2>
      <span className="mx-auto mt-4 block h-1 w-16 rounded-full bg-foreground/70" aria-hidden="true" />
      {lead && <p className="mt-5 text-sm leading-7 text-muted-foreground sm:text-base">{lead}</p>}
    </Anim>
  );
}

/* ── Bullet list used inside feature sections ── */
function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {items.map((b) => (
        <li key={b} className="flex items-start gap-2.5 text-sm text-foreground/90">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>{b}</span>
        </li>
      ))}
    </ul>
  );
}

/* ── Two-column alternating feature layout (§30) ── */
function FeatureSection({
  id,
  label,
  title,
  lead,
  bullets,
  cta,
  media,
  mediaFirst = false,
}: {
  id?: string;
  label: string;
  title: string;
  lead: string;
  bullets?: string[];
  cta?: { label: string; href?: string; onClick?: () => void };
  media: React.ReactNode;
  mediaFirst?: boolean;
}) {
  return (
    <section id={id} className="scroll-mt-20 px-[4%] py-14 sm:py-20">
      <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
        <Anim className={mediaFirst ? "order-2" : ""}>
          <div className="max-w-xl">
            <SectionLabel>{label}</SectionLabel>
            <h2 className="text-2xl font-extrabold leading-snug tracking-tight sm:text-3xl lg:text-4xl">
              {title}
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">{lead}</p>
            {bullets && <Bullets items={bullets} />}
            {cta && (
              <div className="mt-7">
                {cta.onClick ? (
                  <Button size="lg" onClick={cta.onClick}>
                    {cta.label}
                    <ArrowLeft className="me-1 size-4" aria-hidden="true" />
                  </Button>
                ) : (
                  <Button asChild size="lg" variant="outline">
                    <a href={cta.href}>
                      {cta.label}
                      <ArrowLeft className="me-1 size-4" aria-hidden="true" />
                    </a>
                  </Button>
                )}
              </div>
            )}
          </div>
        </Anim>
        <Anim delay={0.12} className={mediaFirst ? "order-1" : ""}>
          {media}
        </Anim>
      </div>
    </section>
  );
}

/* ── Data ── */
const NAV_ITEMS = [
  { label: "امکانات", href: "#features" },
  { label: "برنامه‌ریزی", href: "#planning" },
  { label: "برای چه کسانی؟", href: "#personas" },
  { label: "پیشرفت", href: "#progress" },
  { label: "قیمت‌گذاری", href: "#pricing" },
  { label: "سوالات متداول", href: "#faq" },
];

const HERO_CARDS = [
  { icon: ListChecks, title: "کارها و پروژه‌ها", desc: "از کار روزانه تا پروژه‌های بزرگ، همه در یک فضا" },
  { icon: Clock, title: "برنامه زمانی", desc: "کارها را روی ساعت واقعی روز بچین" },
  { icon: Flame, title: "روتین‌ها و عادت‌ها", desc: "ساختار تکراری روزمره، یک‌بار تعریف کن" },
  { icon: TrendingUp, title: "پیشرفت و تحلیل", desc: "روند بهره‌وری خودت را اندازه بگیر" },
];

const SYSTEM_CHIPS = ["برنامه‌ریزی", "اجرا", "تمرکز", "پیشرفت"];

const PERSONAS = [
  { icon: GraduationCap, name: "دانشجو", desc: "مطالعه، امتحان، تکالیف، دروس، برنامه هفتگی", Preview: StudentPreview },
  { icon: Briefcase, name: "کارمند", desc: "کارهای روزانه، جلسات، پروژه‌ها، تمرکز و عملکرد", Preview: EmployeePreview },
  { icon: Laptop, name: "فریلنسر", desc: "مشتری‌ها، پروژه‌ها، تحویل‌ها، زمان و درآمد", Preview: FreelancerPreview },
  { icon: Users, name: "مدیر", desc: "تیم، تفویض کار، پروژه‌ها، ظرفیت و عملکرد", Preview: ManagerPreview },
  { icon: Store, name: "صاحب کسب‌وکار", desc: "فروش، مشتری، عملیات، درآمد و رشد", Preview: BusinessPreview },
  { icon: Sparkles, name: "بهره‌وری شخصی", desc: "اهداف، زندگی، روتین‌ها، عادت‌ها و برنامه‌ریزی", Preview: PersonalPreview },
];

const INTEGRATIONS = [
  { icon: ListChecks, label: "کارها" },
  { icon: FolderKanban, label: "پروژه‌ها" },
  { icon: Target, label: "اهداف" },
  { icon: CalendarDays, label: "تقویم" },
  { icon: Flame, label: "روتین‌ها" },
  { icon: Zap, label: "تمرکز" },
  { icon: TrendingUp, label: "پیشرفت" },
  { icon: Clock, label: "برنامه‌ریزی" },
];

const FAQ_ITEMS: [string, string][] = [
  [
    "این محصول چه تفاوتی با یک Task Manager دارد؟",
    "این سیستم فقط فهرستی از کارها نیست؛ اهداف، پروژه‌ها، برنامه‌ریزی، زمان، روتین‌ها، اجرا و پیشرفت را در یک فضای شخصی به هم متصل می‌کند.",
  ],
  [
    "آیا داشبورد برای هر کاربر متفاوت است؟",
    "بله. فضای کاری بر اساس نقش، اهداف و نیازهای کاربر شخصی‌سازی می‌شود.",
  ],
  [
    "آیا کارها وارد برنامه زمانی می‌شوند؟",
    "بله. کارهایی که زمان‌بندی شده‌اند می‌توانند در Timeline و برنامه روزانه نمایش داده شوند.",
  ],
  [
    "آیا روتین‌ها به‌صورت خودکار در برنامه روزانه دیده می‌شوند؟",
    "بله. روتین‌های فعال می‌توانند به برنامه زمانی و ساختار روزانه متصل شوند.",
  ],
  [
    "آیا نسخه موبایل وجود دارد؟",
    "رابط کاربری برای دسکتاپ و موبایل به‌صورت Responsive طراحی می‌شود.",
  ],
  [
    "آیا برای دانشجوها مناسب است؟",
    "بله. فضای کاری دانشجو می‌تواند شامل دروس، امتحانات، تکالیف، مطالعه و اهداف تحصیلی باشد.",
  ],
];

const TESTIMONIALS = [
  { role: "دانشجو", quote: "برنامه هفتگی‌ام را یک‌بار می‌چینم و روز به روز فقط اجرا می‌کنم؛ امتحانات دیگر غافلگیرم نمی‌کند." },
  { role: "فریلنسر", quote: "مشتری‌ها، تحویل‌ها و زمان هر پروژه کنار هم است؛ دیگر موعد تحویل از دستم در نمی‌رود." },
  { role: "کارمند", quote: "جلسات، کارهای فوری و تمرکزم در یک برنامه زمانی جمع شده‌اند و روزم آرام‌تر پیش می‌رود." },
  { role: "مدیر", quote: "بار کاری تیم را در یک نگاه می‌بینم و کارها را راحت‌تر تقسیم می‌کنم." },
  { role: "صاحب کسب‌وکار", quote: "فروش، عملیات و اهداف هفتگی در یک فضا دیده می‌شود؛ تصمیم‌گیری سریع‌تر شده است." },
  { role: "کاربر شخصی", quote: "روتین‌هایم به برنامه روز وصل شده‌اند و پیشرفت ماهانه‌ام را می‌بینم." },
];

const FOOTER_COLUMNS: { title: string; links: { label: string; to?: string; href?: string; soon?: boolean }[] }[] = [
  {
    title: "محصول",
    links: [
      { label: "داشبورد", to: "/dashboard" },
      { label: "کارها", to: "/tasks" },
      { label: "پروژه‌ها", to: "/projects" },
      { label: "اهداف", href: "#chain" },
      { label: "برنامه‌ریزی", to: "/planning" },
      { label: "تقویم", to: "/calendar" },
    ],
  },
  {
    title: "امکانات",
    links: [
      { label: "Timeline", to: "/timeline" },
      { label: "روتین‌ها", href: "#routines" },
      { label: "تمرکز", href: "#system" },
      { label: "پیشرفت", to: "/progress" },
      { label: "تحلیل بهره‌وری", to: "/analytics" },
    ],
  },
  {
    title: "برای چه کسانی؟",
    links: [
      { label: "دانشجو", href: "#personas" },
      { label: "کارمند", href: "#personas" },
      { label: "فریلنسر", href: "#personas" },
      { label: "مدیر", href: "#personas" },
      { label: "صاحب کسب‌وکار", href: "#personas" },
      { label: "بهره‌وری شخصی", href: "#personas" },
    ],
  },
  {
    title: "منابع",
    links: [
      { label: "سوالات متداول", href: "#faq" },
      { label: "راهنما", to: "/help" },
      { label: "وبلاگ", soon: true },
      { label: "پشتیبانی", to: "/help" },
    ],
  },
];

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
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <div className="landing-page min-h-svh overflow-x-hidden bg-[#f7f8fc] text-slate-950 dark:bg-[#080d18] dark:text-white" dir="rtl">
      {/* Ambient background: intentionally subtle, never competing with product UI. */}
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-40 top-24 h-[32rem] w-[32rem] rounded-full bg-blue-500/[0.06] blur-3xl" />
        <div className="absolute -left-48 top-[42rem] h-[30rem] w-[30rem] rounded-full bg-indigo-500/[0.045] blur-3xl" />
      </div>

      {/* ───────── Floating SaaS header ───────── */}
      <header
        className={`fixed inset-x-0 top-0 z-50 px-3 pt-3 transition-all duration-300 sm:px-5 ${
          scrolled ? "pt-2" : "pt-3"
        }`}
      >
        <div
          className={`mx-auto flex h-14 max-w-7xl items-center justify-between rounded-2xl border px-2.5 shadow-[0_16px_45px_-30px_rgba(15,23,42,.45)] backdrop-blur-xl transition-all sm:h-16 sm:px-3 ${
            scrolled
              ? "border-slate-200/80 bg-white/92 dark:border-white/10 dark:bg-slate-950/88"
              : "border-white/80 bg-white/78 dark:border-white/10 dark:bg-slate-950/72"
          }`}
        >
          <Link to="/" className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20">
              <ListChecks className="size-4.5" aria-hidden="true" />
            </span>
            <span className="text-base font-black tracking-tight sm:text-lg">تسک‌لی</span>
          </Link>

          <nav aria-label="ناوبری اصلی" className="hidden items-center gap-1 lg:flex">
            {NAV_ITEMS.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="rounded-xl px-3 py-2 text-[12px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
              >
                {n.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {!isLoading && isAuthenticated ? (
              <Button onClick={startCta} className="h-10 rounded-xl px-4 text-xs font-bold sm:px-5 sm:text-sm">
                ورود به فضای کاری
                <ArrowLeft className="me-1.5 size-4" aria-hidden="true" />
              </Button>
            ) : (
              <>
                <Link to="/auth" className="hidden sm:block">
                  <Button variant="ghost" className="h-10 rounded-xl px-4 text-xs font-bold">ورود</Button>
                </Link>
                <Button onClick={startCta} className="h-10 rounded-xl px-4 text-xs font-bold sm:px-5 sm:text-sm">
                  شروع رایگان
                  <ArrowLeft className="me-1.5 size-4" aria-hidden="true" />
                </Button>
              </>
            )}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white/70 lg:hidden dark:border-white/10 dark:bg-white/5"
              aria-label={mobileOpen ? "بستن منو" : "باز کردن منو"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
            >
              <div className="flex flex-col gap-1">
                <span className={`h-0.5 w-4 rounded bg-current transition-transform ${mobileOpen ? "translate-y-1.5 rotate-45" : ""}`} />
                <span className={`h-0.5 w-4 rounded bg-current transition-opacity ${mobileOpen ? "opacity-0" : ""}`} />
                <span className={`h-0.5 w-4 rounded bg-current transition-transform ${mobileOpen ? "-translate-y-1.5 -rotate-45" : ""}`} />
              </div>
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div id="mobile-nav" className="mx-auto mt-2 max-w-7xl rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/10 lg:hidden dark:border-white/10 dark:bg-slate-950">
            <nav aria-label="ناوبری موبایل" className="grid gap-1">
              {NAV_ITEMS.map((n) => (
                <a
                  key={n.href}
                  href={n.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                >
                  {n.label}
                </a>
              ))}
            </nav>
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 dark:border-white/10">
              <Link to="/auth" onClick={() => setMobileOpen(false)}>
                <Button variant="outline" className="w-full rounded-xl">ورود</Button>
              </Link>
              <Button onClick={() => { setMobileOpen(false); startCta(); }} className="rounded-xl">شروع رایگان</Button>
            </div>
          </div>
        )}
      </header>

      {/* ───────── Hero ───────── */}
      <main className="relative z-10">
        <section className="mx-auto max-w-7xl px-4 pb-12 pt-28 sm:px-6 sm:pb-16 sm:pt-36 lg:px-8 lg:pt-40">
          <div className="grid items-center gap-10 lg:grid-cols-[.86fr_1.14fr] lg:gap-14">
            <Anim className="max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-white/80 px-3.5 py-2 text-[11px] font-extrabold text-blue-700 shadow-sm dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300">
                <span className="grid size-5 place-items-center rounded-full bg-blue-600 text-white">
                  <Zap className="size-3" aria-hidden="true" />
                </span>
                سیستم عامل بهره‌وری شخصی
              </div>

              <h1 className="max-w-2xl text-4xl font-black leading-[1.18] tracking-[-0.04em] sm:text-5xl lg:text-[4.15rem]">
                کارها را فقط مدیریت نکن؛
                <span className="block bg-gradient-to-l from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  روزت را طراحی کن.
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg dark:text-slate-300">
                تسک‌لی کارها، پروژه‌ها، اهداف، زمان، روتین‌ها و پیشرفت را به یک جریان واحد تبدیل می‌کند؛
                تا بدانی امروز چه چیزی مهم است و قدم بعدی چیست.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button onClick={startCta} size="lg" className="h-12 rounded-xl px-7 text-sm font-extrabold shadow-xl shadow-blue-600/20">
                  شروع رایگان
                  <ArrowLeft className="me-1.5 size-4" aria-hidden="true" />
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 rounded-xl border-slate-200 bg-white/70 px-6 text-sm font-bold dark:border-white/10 dark:bg-white/5">
                  <a href="#features">مشاهده محصول</a>
                </Button>
                <Link to="/test-mode" className="basis-full text-xs font-semibold text-slate-500 hover:text-blue-600 sm:basis-auto dark:text-slate-400">
                  <span className="ms-1 inline-block size-1.5 animate-pulse rounded-full bg-amber-500" />
                  ورود مستقیم به نسخه آزمایشی
                </Link>
              </div>

              <div className="mt-9 flex flex-wrap gap-x-7 gap-y-3 border-t border-slate-200/80 pt-5 text-xs font-semibold text-slate-500 dark:border-white/10 dark:text-slate-400">
                <span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-500" /> بدون پیچیدگی اضافه</span>
                <span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-500" /> دسکتاپ و موبایل</span>
                <span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-500" /> فضای کاری شخصی</span>
              </div>
            </Anim>

            <Anim delay={0.1} className="relative">
              <div className="absolute -inset-5 -z-10 rounded-[2.5rem] bg-gradient-to-br from-blue-500/[0.10] via-indigo-500/[0.07] to-transparent blur-2xl" />
              <div id="hero-product" className="scroll-mt-24 rounded-[1.75rem] border border-slate-200/90 bg-white p-2 shadow-[0_35px_90px_-45px_rgba(37,99,235,.55)] dark:border-white/10 dark:bg-slate-900/90 sm:p-3">
                <HeroDashboard />
              </div>
              <div className="absolute -bottom-5 -start-3 hidden rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xl shadow-slate-900/10 sm:block dark:border-white/10 dark:bg-slate-900">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
                    <TrendingUp className="size-4" />
                  </span>
                  <span>
                    <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400">پیشرفت این هفته</span>
                    <span className="block text-sm font-black">۵۸٪ <span className="text-emerald-500">+۱۲٪</span></span>
                  </span>
                </div>
              </div>
            </Anim>
          </div>

          <div className="mt-16 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {HERO_CARDS.map((c, i) => (
              <Anim key={c.title} delay={i * 0.05} className="h-full">
                <div className="group h-full rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-[0_12px_35px_-28px_rgba(15,23,42,.5)] transition hover:-translate-y-1 hover:border-blue-200 hover:bg-white hover:shadow-[0_20px_45px_-30px_rgba(37,99,235,.38)] dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-blue-400/20">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                      <c.icon className="size-4.5" aria-hidden="true" />
                    </span>
                    <div>
                      <h2 className="text-sm font-extrabold">{c.title}</h2>
                      <p className="mt-0.5 text-[11px] leading-5 text-slate-500 dark:text-slate-400">{c.desc}</p>
                    </div>
                  </div>
                </div>
              </Anim>
            ))}
          </div>
        </section>

        {/* ───────── Product-first feature showcase ───────── */}
        <section id="features" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <Anim className="mx-auto max-w-3xl text-center">
            <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-extrabold text-slate-500 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              PRODUCT EXPERIENCE
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">یک داشبورد زیبا کافی نیست؛<br className="hidden sm:block" /> جریان کار باید واضح باشد.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base dark:text-slate-400">
              طراحی را حول چیزی ساخته‌ایم که هر روز می‌بینی: اولویت‌ها، کارهای امروز، زمان و پیشرفت.
            </p>
          </Anim>

          <div className="mt-12 grid gap-5 lg:grid-cols-12">
            <Anim className="lg:col-span-7">
              <div className="h-full overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-2 shadow-[0_28px_70px_-45px_rgba(15,23,42,.45)] dark:border-white/10 dark:bg-slate-900">
                <TodayPreview />
              </div>
            </Anim>
            <Anim delay={0.08} className="lg:col-span-5">
              <div className="flex h-full flex-col justify-between rounded-[1.75rem] border border-slate-200 bg-white p-7 shadow-[0_28px_70px_-45px_rgba(15,23,42,.35)] dark:border-white/10 dark:bg-slate-900">
                <div>
                  <span className="grid size-11 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                    <ListChecks className="size-5" />
                  </span>
                  <h3 className="mt-6 text-2xl font-black">امروز، بدون شلوغی</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-400">
                    مهم‌ترین کارهای امروز را از میان پروژه‌ها و اهداف بیرون بکش؛ سپس اجرا را با زمان واقعی روز هماهنگ کن.
                  </p>
                  <ul className="mt-6 space-y-3">
                    {["کارهای مهم و اولویت‌ها", "پروژه‌های فعال", "اهداف در مسیر", "نرخ تکمیل و استمرار"].map((x) => (
                      <li key={x} className="flex items-center gap-2.5 text-sm font-semibold">
                        <span className="grid size-5 place-items-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
                          <CheckCircle2 className="size-3.5" />
                        </span>
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
                <a href="#chain" className="mt-8 inline-flex w-fit items-center gap-2 text-sm font-extrabold text-blue-600 hover:text-blue-700">
                  ببین چطور به هدف وصل می‌شود
                  <ArrowLeft className="size-4" />
                </a>
              </div>
            </Anim>
          </div>
        </section>

        {/* ───────── Goal → execution workflow ───────── */}
        <section id="chain" className="scroll-mt-24 border-y border-slate-200/70 bg-white/55 dark:border-white/10 dark:bg-white/[0.02]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
              <Anim className="lg:col-span-5">
                <span className="text-[11px] font-black tracking-[0.16em] text-blue-600">GOAL → EXECUTE</span>
                <h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">از هدف بزرگ تا کاری که همین الان باید انجام شود.</h2>
                <p className="mt-5 text-sm leading-7 text-slate-500 sm:text-base dark:text-slate-400">
                  مسیر بهره‌وری را در چند ابزار جدا نکن. هدف، پروژه، کار، برنامه و اجرا یک زنجیره قابل مشاهده می‌سازند.
                </p>
                <div className="mt-7 grid grid-cols-2 gap-3">
                  {[
                    ["اهداف", Target],
                    ["پروژه‌ها", FolderKanban],
                    ["کارها", ListChecks],
                    ["زمان", Clock],
                  ].map(([label, Icon]) => (
                    <div key={label as string} className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-white/10 dark:bg-white/[0.035]">
                      <Icon className="size-4 text-blue-600 dark:text-blue-300" />
                      <p className="mt-2 text-xs font-extrabold">{label as string}</p>
                    </div>
                  ))}
                </div>
              </Anim>
              <Anim delay={0.1} className="lg:col-span-7">
                <div className="rounded-[1.75rem] border border-slate-200 bg-white p-2 shadow-[0_30px_80px_-50px_rgba(37,99,235,.5)] dark:border-white/10 dark:bg-slate-900">
                  <GoalsChainPreview />
                </div>
              </Anim>
            </div>
          </div>
        </section>

        {/* ───────── Timeline + routines ───────── */}
        <section id="timeline" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <Anim className="mx-auto max-w-3xl text-center">
            <span className="text-[11px] font-black tracking-[0.16em] text-blue-600">TIME & ROUTINES</span>
            <h2 className="mt-4 text-3xl font-black sm:text-4xl">زمان و روتین، بدون شلوغ کردن صفحه.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-500 sm:text-base dark:text-slate-400">زمان‌بندی و عادت‌های تکراری بخشی از همان سیستم روزانه‌اند؛ لازم نیست برای هرکدام یک ابزار جدا داشته باشی.</p>
          </Anim>
          <div className="mt-9 grid gap-4 md:grid-cols-2">
            <Anim><div className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
              <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"><Clock className="size-5" /></span><div><p className="text-[10px] font-black text-blue-600">TIMELINE</p><h3 className="mt-1 text-lg font-black">زمان را هم‌سطح کارها ببین.</h3></div></div>
              <p className="mt-4 text-sm leading-7 text-slate-500 dark:text-slate-400">کارهای زمان‌بندی‌شده روی روز واقعی می‌نشینند تا ظرفیت روز را قبل از تعهدهای جدید ببینی.</p>
              <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500">{["جلسه","تمرکز","کار عمیق","زمان آزاد"].map(x=><span key={x} className="rounded-lg bg-slate-100 px-2.5 py-1.5 dark:bg-white/5">{x}</span>)}</div>
            </div></Anim>
            <Anim delay={0.08}><div id="routines" className="h-full scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
              <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"><Flame className="size-5" /></span><div><p className="text-[10px] font-black text-emerald-600">ROUTINES</p><h3 className="mt-1 text-lg font-black">چیزهای تکراری را از ذهنت خارج کن.</h3></div></div>
              <p className="mt-4 text-sm leading-7 text-slate-500 dark:text-slate-400">روتین‌ها یک‌بار تعریف می‌شوند و در برنامه روزانه و گزارش استمرار قابل پیگیری می‌مانند.</p>
              <div className="mt-5 flex items-center gap-3 text-xs font-bold"><span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><span className="block h-full w-[78%] rounded-full bg-emerald-500" /></span><span>۷ روز استمرار</span></div>
            </div></Anim>
          </div>
        </section>

        {/* ───────── System modules ───────── */}
        <section id="system" className="scroll-mt-24 bg-slate-950 text-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
            <Anim className="mx-auto max-w-3xl text-center">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black tracking-wide text-blue-200">THE SYSTEM</span>
              <h2 className="mt-5 text-3xl font-black sm:text-5xl">یک سیستم واحد، نه هفت ابزار جدا.</h2>
              <p className="mt-4 text-sm leading-7 text-slate-400 sm:text-base">هر بخش نقش مشخصی دارد، اما اطلاعات بین آن‌ها جریان پیدا می‌کند.</p>
            </Anim>
            <div className="mt-10 grid gap-4 lg:grid-cols-12">
              <Anim className="lg:col-span-7"><div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.055] p-2 shadow-2xl shadow-black/20">
                <div className="px-4 pb-4 pt-3"><p className="text-[10px] font-black text-blue-300">TASKS</p><h3 className="mt-1 text-xl font-black">کارها، نقطه شروع اجرا.</h3><p className="mt-2 max-w-xl text-xs leading-6 text-slate-400">اولویت، وضعیت، موعد و پروژه را یکجا ببین و از همان‌جا وارد اجرا شو.</p></div>
                <TasksPreview />
              </div></Anim>
              <Anim delay={0.08} className="lg:col-span-5"><div className="grid gap-3">
                {[{title:"پروژه‌ها",desc:"کارهای مرتبط را کنار هم نگه دار.",icon:FolderKanban},{title:"تقویم",desc:"زمان و تعهدها را با کارها هماهنگ کن.",icon:CalendarDays},{title:"پیشرفت",desc:"نتیجه را با روند واقعی اجرا بسنج.",icon:TrendingUp}].map(b=><div key={b.title} className="rounded-2xl border border-white/10 bg-white/[0.045] p-5"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-blue-400/10 text-blue-300"><b.icon className="size-4" /></span><div><h3 className="text-sm font-extrabold">{b.title}</h3><p className="mt-1 text-[11px] leading-5 text-slate-400">{b.desc}</p></div></div></div>)}
              </div></Anim>
            </div>
          </div>
        </section>

        {/* ───────── Planning ───────── */}
        <section id="planning" className="scroll-mt-24 mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
            <Anim className="lg:col-span-5">
              <span className="text-[11px] font-black tracking-[0.16em] text-blue-600">PLANNING</span>
              <h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">برنامه‌ریزی برای دنیای واقعی.</h2>
              <p className="mt-5 text-sm leading-7 text-slate-500 sm:text-base dark:text-slate-400">
                ظرفیت روز، مهلت‌ها، اولویت‌ها و کارهای انعطاف‌پذیر را کنار هم ببین تا برنامه‌ای بسازی که قابل اجرا باشد.
              </p>
              <Button onClick={startCta} className="mt-7 rounded-xl px-5 font-extrabold">
                برنامه‌ریزی را تجربه کن
                <ArrowLeft className="me-1.5 size-4" />
              </Button>
            </Anim>
            <Anim delay={0.1} className="lg:col-span-7">
              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-2 shadow-[0_30px_80px_-50px_rgba(37,99,235,.45)] dark:border-white/10 dark:bg-slate-900">
                <PlanningPreview />
              </div>
            </Anim>
          </div>
        </section>

        {/* ───────── Progress ───────── */}
        <section id="progress" className="scroll-mt-24 border-y border-slate-200/70 bg-white/55 dark:border-white/10 dark:bg-white/[0.02]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="mx-auto max-w-5xl">
              <Anim className="text-center">
                <span className="text-[11px] font-black tracking-[0.16em] text-emerald-600">PROGRESS</span>
                <h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">پیشرفت را با شواهد ببین.</h2>
                <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base dark:text-slate-400">روند تمرکز، اجرای برنامه، اهداف و استمرار را در یک تصویر قابل فهم دنبال کن.</p>
              </Anim>
              <Anim delay={0.08} className="mt-9">
                <div className="rounded-[1.75rem] border border-slate-200 bg-white p-2 shadow-[0_30px_80px_-50px_rgba(37,99,235,.45)] dark:border-white/10 dark:bg-slate-900">
                  <AnalyticsPreview />
                </div>
              </Anim>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[["اجرای برنامه","۷۶٪"],["استمرار","۱۲ روز"],["تمرکز","۴.۸ ساعت"],["اهداف","۷۰٪"]].map(([l,v]) => (
                  <div key={l} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]">
                    <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400">{l}</span>
                    <span className="mt-1 block text-xl font-black">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ───────── Personas ───────── */}
        <section id="personas" className="scroll-mt-24 mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <Anim className="mx-auto max-w-3xl text-center">
            <span className="text-[11px] font-black tracking-[0.16em] text-blue-600">PERSONALIZED WORKSPACE</span>
            <h2 className="mt-4 text-3xl font-black sm:text-4xl">یک محصول؛ برای هر نفر، یک فضای کاری متفاوت.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-500 sm:text-base dark:text-slate-400">تفاوت فقط در ظاهر نیست؛ اولویت‌ها، اطلاعات و جریان کاری بر اساس نقش کاربر تغییر می‌کند.</p>
          </Anim>
          <div className="mt-9 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {PERSONAS.map((p,i)=><Anim key={p.name} delay={i*0.03} className="h-full"><div className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 dark:border-white/10 dark:bg-slate-900">
              <div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"><p.icon className="size-5" /></span><h3 className="text-sm font-black">{p.name}</h3></div>
              <p className="mt-4 text-xs leading-6 text-slate-500 dark:text-slate-400">{p.desc}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">{(p.name==="دانشجو"?["دروس","امتحان","مطالعه"]:p.name==="کارمند"?["جلسات","وظایف","تمرکز"]:p.name==="فریلنسر"?["مشتری","تحویل","زمان"]:p.name==="مدیر"?["تیم","تفویض","ظرفیت"]:p.name==="صاحب کسب‌وکار"?["عملیات","فروش","رشد"]:["اهداف","روتین","عادت"]).map(x=><span key={x} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 dark:bg-white/5 dark:text-slate-400">{x}</span>)}</div>
            </div></Anim>)}
          </div>
        </section>

        {/* ───────── Pricing ───────── */}
        <section id="pricing" className="scroll-mt-24 bg-slate-100/70 dark:bg-white/[0.025]">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <Anim className="text-center">
              <span className="text-[11px] font-black tracking-[0.16em] text-blue-600">PRICING</span>
              <h2 className="mt-4 text-3xl font-black sm:text-5xl">ساده شروع کن؛ حرفه‌ای ادامه بده.</h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-500 dark:text-slate-400">نسخه رایگان برای شروع آماده است و جزئیات پلن‌های حرفه‌ای در ادامه مسیر اعلام می‌شوند.</p>
            </Anim>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900">
                <p className="text-sm font-black">رایگان</p>
                <p className="mt-1 text-xs text-slate-500">برای شروع</p>
                <p className="mt-6 text-3xl font-black">رایگان</p>
                <ul className="mt-6 space-y-3 text-sm">
                  {["کارها", "پروژه‌ها", "اهداف", "تقویم", "برنامه‌ریزی پایه"].map((f) => <li key={f} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 text-blue-600" />{f}</li>)}
                </ul>
                <Button onClick={startCta} className="mt-8 w-full rounded-xl">شروع رایگان</Button>
              </div>
              <div className="relative rounded-[1.5rem] border-2 border-blue-600 bg-white p-6 shadow-[0_25px_70px_-35px_rgba(37,99,235,.45)] dark:bg-slate-900">
                <span className="absolute -top-3 end-5 rounded-full bg-blue-600 px-3 py-1 text-[10px] font-black text-white">پیشنهاد حرفه‌ای</span>
                <p className="text-sm font-black">حرفه‌ای</p>
                <p className="mt-1 text-xs text-slate-500">برای بهره‌وری عمیق‌تر</p>
                <p className="mt-6 text-3xl font-black">به‌زودی</p>
                <ul className="mt-6 space-y-3 text-sm">
                  {["برنامه‌ریزی پیشرفته", "Timeline", "روتین‌ها", "تحلیل پیشرفت", "امکانات پیشرفته"].map((f) => <li key={f} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 text-blue-600" />{f}</li>)}
                </ul>
                <Button onClick={startCta} className="mt-8 w-full rounded-xl">ورود به محصول</Button>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900">
                <p className="text-sm font-black">آینده محصول</p>
                <p className="mt-1 text-xs text-slate-500">قابلیت‌های در حال توسعه</p>
                <p className="mt-6 text-3xl font-black text-slate-400">به‌زودی</p>
                <ul className="mt-6 space-y-3 text-sm text-slate-500 dark:text-slate-400">
                  {["لایه‌های جدید بهره‌وری", "یکپارچه‌سازی‌های بیشتر", "امکانات تیمی و سازمانی", "دستیار برنامه‌ریزی هوشمند"].map((f) => <li key={f} className="flex gap-2"><Sparkles className="mt-0.5 size-4" />{f}</li>)}
                </ul>
                <Button variant="outline" onClick={startCta} className="mt-8 w-full rounded-xl">ورود به محصول</Button>
              </div>
            </div>
          </div>
        </section>

        {/* ───────── Integrations ───────── */}
        <section id="integrations" className="scroll-mt-24 mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-5">
            <Anim className="lg:col-span-2">
              <span className="text-[11px] font-black tracking-[0.16em] text-blue-600">CONNECTED WORKFLOW</span>
              <h2 className="mt-4 text-3xl font-black sm:text-4xl">هر بخش، بخشی از یک سیستم بزرگ‌تر است.</h2>
              <p className="mt-4 text-sm leading-7 text-slate-500 dark:text-slate-400">
                کاری که ایجاد می‌کنی می‌تواند به پروژه و هدف وصل شود، زمان بگیرد، وارد برنامه روز شود و روی گزارش پیشرفت اثر بگذارد.
              </p>
            </Anim>
            <Anim delay={0.08} className="lg:col-span-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {INTEGRATIONS.map((it) => (
                  <div key={it.label} className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm transition hover:-translate-y-1 hover:border-blue-200 dark:border-white/10 dark:bg-white/[0.035]">
                    <span className="mx-auto grid size-10 place-items-center rounded-xl bg-slate-100 text-blue-600 dark:bg-white/5 dark:text-blue-300">
                      <it.icon className="size-4.5" />
                    </span>
                    <p className="mt-2 text-xs font-extrabold">{it.label}</p>
                  </div>
                ))}
              </div>
            </Anim>
          </div>
        </section>

        {/* ───────── FAQ ───────── */}
        <section id="faq" className="scroll-mt-24 border-t border-slate-200/70 bg-white/55 dark:border-white/10 dark:bg-white/[0.02]">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
            <Anim className="text-center">
              <span className="text-[11px] font-black tracking-[0.16em] text-blue-600">FAQ</span>
              <h2 className="mt-4 text-3xl font-black sm:text-5xl">سوالات متداول</h2>
            </Anim>
            <div className="mt-9 space-y-3">
              {FAQ_ITEMS.map(([q, a]) => (
                <details key={q} className="group rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-extrabold">
                    <span>{q}</span>
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 transition-transform group-open:rotate-45 dark:bg-white/5">+</span>
                  </summary>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500 dark:text-slate-400">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ───────── Testimonials placeholder / trust ───────── */}
        <section id="testimonials" className="scroll-mt-24 mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <Anim className="max-w-2xl">
            <span className="text-[11px] font-black tracking-[0.16em] text-blue-600">TRUST & EXPERIENCE</span>
            <h2 className="mt-4 text-3xl font-black sm:text-4xl">وقتی ساختار روشن باشد، اجرا هم روشن‌تر می‌شود.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-500 dark:text-slate-400">نمونه‌های زیر جایگاه محتوای واقعی کاربران را نشان می‌دهند و فعلاً به‌عنوان متن نمونه علامت‌گذاری شده‌اند.</p>
          </Anim>
          <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Anim key={t.role} delay={i * 0.04} className="h-full">
                <figure className="relative flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
                  <span className="absolute end-4 top-4 rounded-md bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500 dark:bg-white/5">متن نمونه</span>
                  <blockquote className="pt-7 text-sm leading-7">«{t.quote}»</blockquote>
                  <figcaption className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-white/10">
                    <span className="grid size-9 place-items-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"><Users className="size-4" /></span>
                    <span><span className="block text-xs font-black">کاربر نمونه</span><span className="text-[10px] text-slate-500">{t.role}</span></span>
                  </figcaption>
                </figure>
              </Anim>
            ))}
          </div>
        </section>

        {/* ───────── Final CTA ───────── */}
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-24 lg:px-8">
          <Anim>
            <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-14 text-center text-white shadow-[0_35px_90px_-45px_rgba(15,23,42,.75)] sm:px-10 sm:py-20">
              <div className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-blue-600/20 blur-3xl" />
              <div className="pointer-events-none absolute -left-24 -bottom-32 size-80 rounded-full bg-indigo-600/15 blur-3xl" />
              <div className="relative">
                <span className="text-[11px] font-black tracking-[0.18em] text-blue-300">READY TO PLAN?</span>
                <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-black sm:text-5xl">فضای بهره‌وری خودت را بساز.</h2>
                <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
                  از کارهای پراکنده به یک سیستم منظم برای برنامه‌ریزی، اجرا و پیشرفت برو.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Button onClick={startCta} size="lg" className="h-12 rounded-xl bg-white px-7 text-sm font-black text-slate-950 hover:bg-slate-100">
                    شروع رایگان
                    <ArrowLeft className="me-1.5 size-4" />
                  </Button>
                  <Button asChild size="lg" variant="outline" className="h-12 rounded-xl border-white/20 bg-white/5 px-7 text-sm font-bold text-white hover:bg-white/10 hover:text-white">
                    <a href="#features">مشاهده محصول</a>
                  </Button>
                </div>
              </div>
            </div>
          </Anim>
        </section>
      </main>

      {/* ───────── Premium Footer ───────── */}
      <footer className="relative overflow-hidden border-t border-slate-200/80 bg-slate-950 text-white dark:border-white/10">
        <div className="pointer-events-none absolute -end-32 -top-32 size-80 rounded-full bg-blue-600/15 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -start-40 bottom-0 size-96 rounded-full bg-indigo-600/10 blur-3xl" aria-hidden="true" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Footer CTA */}
          <div className="border-b border-white/10 py-10 sm:py-12">
            <div className="flex flex-col gap-6 rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20 sm:flex-row sm:items-center sm:justify-between sm:p-7">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-2 text-[10px] font-black tracking-[0.16em] text-blue-300">
                  <span className="size-1.5 rounded-full bg-blue-400" />
                  BUILD YOUR WORKSPACE
                </span>
                <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                  آماده‌ای روزت را منظم‌تر مدیریت کنی؟
                </h2>
                <p className="mt-2 text-xs leading-6 text-slate-400 sm:text-sm">
                  فضای کاری خودت را بساز و کارها، پروژه‌ها، زمان و پیشرفت را در یک سیستم ببین.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button onClick={startCta} className="h-11 rounded-xl bg-white px-5 text-xs font-black text-slate-950 hover:bg-slate-100">
                  شروع رایگان
                  <ArrowLeft className="me-1.5 size-4" />
                </Button>
                <Button asChild variant="outline" className="h-11 rounded-xl border-white/15 bg-white/[0.04] px-5 text-xs font-bold text-white hover:bg-white/10 hover:text-white">
                  <a href="#features">مشاهده محصول</a>
                </Button>
              </div>
            </div>
          </div>

          {/* Main footer */}
          <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8 lg:py-14">
            <div className="lg:col-span-4">
              <Link to="/" className="inline-flex items-center gap-2.5">
                <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-900/30">
                  <ListChecks className="size-5" />
                </span>
                <span className="text-xl font-black tracking-tight">تسک‌لی</span>
              </Link>
              <p className="mt-5 max-w-sm text-sm leading-7 text-slate-400">
                سیستم عامل بهره‌وری شخصی برای وصل کردن کارها، اهداف، زمان، روتین‌ها و پیشرفت در یک فضای کاری منظم.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["Tasks", "Projects", "Planning", "Progress"].map((label) => (
                  <span key={label} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-bold text-slate-300">
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="lg:col-span-8">
              <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
                {FOOTER_COLUMNS.map((col) => (
                  <div key={col.title}>
                    <h3 className="text-[11px] font-black text-white">{col.title}</h3>
                    <ul className="mt-4 space-y-3 text-xs text-slate-400">
                      {col.links.map((l) => (
                        <li key={l.label}>
                          {l.soon ? (
                            <span className="inline-flex items-center gap-1.5">
                              {l.label}
                              <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] text-slate-500">به‌زودی</span>
                            </span>
                          ) : l.to ? (
                            <Link to={l.to} className="inline-flex transition-colors hover:text-white">{l.label}</Link>
                          ) : (
                            <a href={l.href} className="inline-flex transition-colors hover:text-white">{l.label}</a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex flex-col gap-4 border-t border-white/10 py-5 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span>© {toFa(1405)} تسک‌لی</span>
              <span className="hidden size-1 rounded-full bg-slate-700 sm:block" />
              <span>همه حقوق محفوظ است.</span>
            </div>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="group inline-flex w-fit items-center gap-2 rounded-lg px-2 py-1.5 font-bold text-slate-400 transition hover:bg-white/5 hover:text-white"
            >
              برگشت به بالا
              <ArrowUp className="size-3.5 transition-transform group-hover:-translate-y-0.5" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
