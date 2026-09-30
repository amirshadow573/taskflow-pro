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
    const h = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <div className="landing-page relative min-h-svh" dir="rtl">
      {/* One continuous, flat #F3F4F6 canvas — painted by .landing-page in index.css.
          No mesh gradients, no grid layer, no orbs, no fade band (§5, §32). */}

      {/* ═══════════ HEADER ═══════════ */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "border-b border-border/60 bg-background/85 shadow-sm backdrop-blur-xl"
            : "bg-transparent"
        }`}
      >
        <div className="flex h-14 w-full items-center justify-between px-[4%] sm:h-16">
          <Link to="/" className="flex items-center gap-2" aria-label="تسک‌لی — صفحه اصلی">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <ListChecks className="size-4.5" aria-hidden="true" />
            </span>
            <span className="text-base font-extrabold tracking-tight">تسک‌لی</span>
          </Link>

          <nav aria-label="ناوبری اصلی" className="hidden items-center gap-0.5 lg:flex">
            {NAV_ITEMS.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="rounded-lg px-2.5 py-2 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
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
              className="grid size-9 place-items-center rounded-lg hover:bg-muted lg:hidden"
              aria-label={mobileOpen ? "بستن منو" : "باز کردن منو"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
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
          <div id="mobile-nav" className="border-t border-border bg-card px-[4%] pb-4 pt-2 lg:hidden">
            <nav aria-label="ناوبری موبایل">
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
            </nav>
            <div className="mt-2 flex items-center gap-2 border-t border-border/60 pt-3">
              <Link to="/auth" onClick={() => setMobileOpen(false)} className="flex-1">
                <Button variant="outline" className="w-full">
                  ورود
                </Button>
              </Link>
              <Button
                className="flex-1"
                onClick={() => {
                  setMobileOpen(false);
                  startCta();
                }}
              >
                شروع رایگان
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* ═══════════ HERO ═══════════ */}
      <section className="px-[4%] pt-24 pb-12 sm:pt-32 sm:pb-16">
        <Anim className="mx-auto max-w-4xl text-center">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.06] px-4 py-1.5 text-xs font-bold text-primary">
            <Zap className="size-3.5" aria-hidden="true" />
            سیستم عامل بهره‌وری شخصی
          </span>
          <h1 className="text-3xl leading-[1.35] font-extrabold tracking-tight sm:text-5xl sm:leading-[1.3]">
            یک سیستم بهره‌وری که خودش را با زندگی و کار تو هماهنگ می‌کند
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
            کارها، پروژه‌ها، اهداف، برنامه روزانه، تقویم و روتین‌ها را در یک فضای کاری شخصی و منظم مدیریت کن.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" onClick={startCta} className="px-8 text-base">
              شروع رایگان
              <ArrowLeft className="me-1 size-4" aria-hidden="true" />
            </Button>
            <Button asChild size="lg" variant="outline" className="px-8 text-base">
              <a href="#features">مشاهده امکانات</a>
            </Button>
          </div>
          <div className="mt-4">
            <Link to="/test-mode">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
                <span className="ms-1 inline-block size-1.5 animate-pulse rounded-full bg-amber-500" aria-hidden="true" />
                ورود به نسخه آزمایشی
              </Button>
            </Link>
          </div>
        </Anim>

        {/* Hero product preview — large, wide, the main product showcase (§10–§11) */}
        <Anim delay={0.12} className="mt-10 sm:mt-12">
          <div id="hero-product" className="scroll-mt-24">
            <HeroDashboard />
          </div>
        </Anim>

        {/* Four small highlight cards under the hero (wireframe) */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HERO_CARDS.map((c, i) => (
            <Anim key={c.title} delay={i * 0.06} className="h-full">
              <div className="ui-surface ui-surface-hover h-full rounded-2xl p-5">
                <span className="ui-icon-tile mb-3 size-9">
                  <c.icon className="size-4.5 text-primary" aria-hidden="true" />
                </span>
                <h2 className="text-sm font-extrabold">{c.title}</h2>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{c.desc}</p>
              </div>
            </Anim>
          ))}
        </div>
      </section>

      {/* ═══════════ FEATURE 01 — text | image ═══════════ */}
      <FeatureSection
        id="features"
        label="داشبورد"
        title="همه‌چیز مهمت را در یک فضای کاری ببین"
        lead="کارهای امروز، پروژه‌ها، اهداف، برنامه زمانی و پیشرفتت را در یک فضای واحد کنار هم داشته باش تا همیشه بدانی چه چیزی مهم است و قدم بعدی چیست."
        bullets={[
          "کارهای مهم امروز",
          "پروژه‌های فعال",
          "اهداف",
          "پیشرفت",
          "برنامه زمانی",
        ]}
        cta={{ label: "داشبورد را ببین", href: "#hero-product" }}
        media={<TodayPreview />}
      />

      {/* ═══════════ FEATURE 02 — image | text ═══════════ */}
      <FeatureSection
        id="chain"
        label="از هدف تا اجرا"
        title="از هدف بزرگ تا کاری که همین حالا باید انجام دهی"
        lead="اهداف را به پروژه و پروژه‌ها را به کارهای قابل اجرا تبدیل کن؛ بدون اینکه ارتباط بین مسیر کلی و کارهای روزانه از بین برود."
        bullets={[
          "هر هدف به پروژه‌ها و پروژه‌ها به کارهای روزانه وصل است",
          "کارهای زمان‌بندی‌شده مستقیم وارد برنامه روز می‌شوند",
          "قدم بعدی همیشه مشخص است، نه فقط فهرست کارها",
        ]}
        mediaFirst
        media={<GoalsChainPreview />}
      />

      {/* ═══════════ FEATURE 03 — text | image ═══════════ */}
      <FeatureSection
        id="timeline"
        label="برنامه زمانی"
        title="برنامه روزت را روی زمان واقعی بچین"
        lead="کارها فقط در یک لیست باقی نمی‌مانند. می‌توانی آن‌ها را روی زمان واقعی روز قرار دهی و ببینی هر ساعت از روزت برای چه کاری اختصاص داده شده است."
        cta={{ label: "در یک سیستم کامل ببین", href: "#system" }}
        media={<TimelinePreview />}
      />

      {/* ═══════════ FEATURE 04 — image | text ═══════════ */}
      <FeatureSection
        id="routines"
        label="روتین‌ها"
        title="روتین‌هایت را یک‌بار تعریف کن"
        lead="کارهای تکرارشونده را به روتین تبدیل کن تا ساختار روزانه‌ات به‌صورت منظم وارد برنامه‌ریزی و جدول زمانی شود."
        bullets={[
          "الگوی هفتگی هر روتین با یک نگاه مشخص است",
          "روتین‌های فعال در Timeline روز ظاهر می‌شوند",
          "استمرار و تکمیل روزانه قابل پیگیری است",
        ]}
        cta={{ label: "شروع رایگان", onClick: startCta }}
        mediaFirst
        media={<RoutinesPreview />}
      />

      {/* ═══════════ CENTERED HEADING + CHIPS + PRODUCT GRID ═══════════ */}
      <section id="system" className="scroll-mt-20 border-t border-border/50 px-[4%] py-16 sm:py-20">
        <CenteredHeading
          title="یک سیستم کامل برای مدیریت بهره‌وری"
          lead="ابزارهای مختلف بهره‌وری را به جای استفاده جداگانه، در یک سیستم یکپارچه کنار هم داشته باش."
        />
        <Anim delay={0.08} className="mt-8">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {SYSTEM_CHIPS.map((c) => (
              <span
                key={c}
                className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-bold shadow-sm"
              >
                {c}
              </span>
            ))}
          </div>
        </Anim>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {[
            { title: "کارها", desc: "اولویت، موعد و وضعیت هر کار در یک فهرست منظم", Preview: TasksPreview },
            { title: "پروژه‌ها", desc: "پیشرفت، موعد و سلامت هر پروژه در یک نگاه", Preview: ProjectsPreview },
            { title: "تقویم و Timeline", desc: "روزها و ساعت‌ها، از نمای ماهانه تا جدول زمانی", Preview: CalendarPreview },
            { title: "پیشرفت", desc: "سطح، XP، استمرار و دستاوردهای تو", Preview: ProgressPreview },
          ].map((b, i) => (
            <Anim key={b.title} delay={0.06 * i} className="h-full">
              <div className="h-full">
                <b.Preview />
                <div className="mt-3 px-1">
                  <h3 className="text-base font-extrabold">{b.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{b.desc}</p>
                </div>
              </div>
            </Anim>
          ))}
        </div>
      </section>

      {/* ═══════════ FEATURE 05 — text | image (planning) ═══════════ */}
      <FeatureSection
        id="planning"
        label="برنامه‌ریزی"
        title="برنامه‌ریزی که با شرایط واقعی تو هماهنگ است"
        lead="برنامه‌ریزی فقط قرار دادن چند کار در یک لیست نیست؛ سیستم باید زمان، اولویت، ظرفیت، مهلت‌ها و شرایط واقعی تو را در نظر بگیرد."
        bullets={[
          "سطل‌های «باید انجام شود»، «مهم»، «انعطاف‌پذیر» و «برای روزهای بعد»",
          "مهلت‌ها، اولویت‌ها و بار کاری روز در کنار هم",
          "کارهای مسدود با دلیل مشخص، نه فقط یک هشدار",
        ]}
        cta={{ label: "برنامه امروزت را ببین", href: "#hero-product" }}
        media={<PlanningPreview />}
      />

      {/* ═══════════ FEATURE 06 — image | text (analytics) ═══════════ */}
      <FeatureSection
        id="progress"
        label="پیشرفت"
        title="پیشرفتت را اندازه بگیر، نه فقط تعداد کارها را"
        lead="با مشاهده روند پیشرفت، تمرکز، اجرای برنامه و میزان سازگاری برنامه با واقعیت، بفهم چه چیزی واقعاً به بهره‌وری تو کمک می‌کند."
        bullets={[
          "کارهای انجام‌شده و زمان تمرکز",
          "استمرار و دقت اجرای برنامه",
          "پیشرفت اهداف و سلامت پروژه‌ها",
          "روند بهره‌وری در طول هفته",
        ]}
        mediaFirst
        media={<AnalyticsPreview />}
      />

      {/* ═══════════ PERSONAS ═══════════ */}
      <section id="personas" className="scroll-mt-20 border-t border-border/50 px-[4%] py-16 sm:py-20">
        <CenteredHeading
          title="یک سیستم، شش فضای کاری متفاوت"
          lead="همه افراد به یک نوع داشبورد و یک نوع برنامه‌ریزی نیاز ندارند. سیستم بر اساس نقش و نیاز شما، فضای کاری متفاوتی ایجاد می‌کند."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {PERSONAS.map((p, i) => (
            <Anim key={p.name} delay={i * 0.05} className="h-full">
              <div className="ui-surface h-full rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <span className="ui-icon-tile size-10 shrink-0">
                    <p.icon className="size-5 text-primary" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold">{p.name}</h3>
                    <p className="truncate text-[11px] text-muted-foreground">{p.desc}</p>
                  </div>
                </div>
                <p.Preview />
              </div>
            </Anim>
          ))}
        </div>
      </section>

      {/* ═══════════ PRICING ═══════════ */}
      <section id="pricing" className="scroll-mt-20 px-[4%] py-16 sm:py-20">
        <CenteredHeading
          title="قیمت‌گذاری"
          lead="با شروع رایگان وارد شو؛ نسخه حرفه‌ای و قابلیت‌های آینده به‌زودی اعلام می‌شوند."
        />
        <div className="mx-auto mt-10 grid max-w-6xl items-start gap-5 md:grid-cols-3">
          {/* Free */}
          <Anim className="h-full">
            <div className="ui-surface flex h-full flex-col rounded-2xl p-4">
              <div className="rounded-xl bg-muted/70 p-5 text-center dark:bg-white/5">
                <h3 className="text-base font-extrabold">رایگان</h3>
                <p className="mt-1 text-xs text-muted-foreground">برای شروع</p>
                <p className="mt-3 text-3xl font-extrabold">رایگان</p>
              </div>
              <ul className="mt-5 space-y-2.5 px-2 text-sm">
                {["کارها", "پروژه‌ها", "اهداف", "تقویم", "برنامه‌ریزی پایه"].map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-6">
                <Button className="w-full" size="lg" onClick={startCta}>
                  شروع رایگان
                </Button>
              </div>
            </div>
          </Anim>

          {/* Pro — emphasized */}
          <Anim delay={0.08} className="h-full">
            <div className="ui-surface relative flex h-full flex-col rounded-2xl p-4 ring-2 ring-primary">
              <span className="absolute -top-3 start-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[10px] font-bold text-white">
                انتخاب حرفه‌ای‌ها
              </span>
              <div className="rounded-xl bg-primary p-5 text-center text-white">
                <h3 className="text-base font-extrabold">حرفه‌ای</h3>
                <p className="mt-1 text-xs text-white/80">برای بهره‌وری حرفه‌ای</p>
                <p className="mt-3 text-3xl font-extrabold">حرفه‌ای</p>
                <p className="mt-1 text-[11px] text-white/80">قیمت نهایی به‌زودی اعلام می‌شود</p>
              </div>
              <ul className="mt-5 space-y-2.5 px-2 text-sm">
                {[
                  "برنامه‌ریزی پیشرفته",
                  "Timeline (برنامه زمانی)",
                  "روتین‌ها",
                  "تحلیل پیشرفت",
                  "امکانات پیشرفته",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-6">
                <Button className="w-full" size="lg" onClick={startCta}>
                  شروع نسخه حرفه‌ای
                </Button>
              </div>
            </div>
          </Anim>

          {/* Future / Premium — neutral placeholder, no invented features or prices */}
          <Anim delay={0.16} className="h-full">
            <div className="ui-surface flex h-full flex-col rounded-2xl p-4">
              <div className="rounded-xl bg-muted/70 p-5 text-center dark:bg-white/5">
                <h3 className="text-base font-extrabold">آیندهٔ محصول</h3>
                <p className="mt-1 text-xs text-muted-foreground">قابلیت‌های در حال توسعه</p>
                <p className="mt-3 text-3xl font-extrabold text-muted-foreground">به‌زودی</p>
              </div>
              <ul className="mt-5 space-y-2.5 px-2 text-sm">
                {[
                  "لایه‌های جدید بهره‌وری",
                  "یکپارچه‌سازی‌های بیشتر",
                  "امکانات تیمی و سازمانی",
                  "دستیار برنامه‌ریزی هوشمند — به‌زودی",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-muted-foreground">
                    <Sparkles className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-6">
                <Button variant="outline" className="w-full" size="lg" onClick={startCta}>
                  اطلاع از زمان عرضه
                </Button>
              </div>
            </div>
          </Anim>
        </div>
      </section>

      {/* ═══════════ INTEGRATIONS / ECOSYSTEM ═══════════ */}
      <section id="integrations" className="scroll-mt-20 border-t border-border/50 px-[4%] py-16 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Anim>
            <div className="max-w-xl">
              <SectionLabel>یکپارچگی</SectionLabel>
              <h2 className="text-2xl font-extrabold leading-snug tracking-tight sm:text-3xl lg:text-4xl">
                همه بخش‌های بهره‌وری تو به هم متصل‌اند
              </h2>
              <span className="mt-4 block h-1 w-16 rounded-full bg-foreground/70" aria-hidden="true" />
              <p className="mt-5 text-sm leading-7 text-muted-foreground sm:text-base">
                اطلاعات بین بخش‌های مختلف سیستم گم نمی‌شود. کاری که ایجاد می‌کنی می‌تواند وارد برنامه‌ریزی شود؛
                روتین‌ها می‌توانند در Timeline ظاهر شوند و اجرای کارها روی گزارش پیشرفت اثر بگذارد.
              </p>
              <div className="mt-7">
                <Button size="lg" onClick={startCta}>
                  شروع رایگان
                  <ArrowLeft className="me-1 size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </Anim>
          <Anim delay={0.12}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {INTEGRATIONS.map((it) => (
                <div
                  key={it.label}
                  className="ui-surface ui-surface-hover flex flex-col items-center gap-2 rounded-2xl p-4 text-center"
                >
                  <span className="ui-icon-tile size-10">
                    <it.icon className="size-5 text-primary" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-bold">{it.label}</span>
                </div>
              ))}
            </div>
          </Anim>
        </div>
      </section>

      {/* ═══════════ FAQ ═══════════ */}
      <section id="faq" className="scroll-mt-20 px-[4%] py-16 sm:py-20">
        <CenteredHeading title="سوالات متداول" />
        <div className="mx-auto mt-8 max-w-4xl space-y-3">
          {FAQ_ITEMS.map(([q, a]) => (
            <details key={q} className="ui-surface group rounded-2xl px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold">
                <span>{q}</span>
                <span
                  aria-hidden="true"
                  className="grid size-6 shrink-0 place-items-center rounded-md bg-muted/60 text-base leading-none text-muted-foreground transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ═══════════ TESTIMONIALS (clearly marked placeholders) ═══════════ */}
      <section id="testimonials" className="scroll-mt-20 border-t border-border/50 px-[4%] py-16 sm:py-20">
        <CenteredHeading
          title="چه چیزی برای کاربران مهم است؟"
          lead="این کارت‌ها نمونه‌پیش‌نویس‌اند و جای نظرات واقعی کاربران را خالی نگه می‌دارند؛ نظرات واقعی پس از جمع‌آوری همین‌جا منتشر می‌شود."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Anim key={t.role} delay={i * 0.05} className="h-full">
              <figure className="ui-surface relative flex h-full flex-col rounded-2xl p-6">
                <span className="absolute end-4 top-4 rounded-md bg-muted px-2 py-0.5 text-[9px] font-bold text-muted-foreground">
                  متن نمونه
                </span>
                <blockquote className="flex-1 pt-6 text-sm leading-7 text-foreground">«{t.quote}»</blockquote>
                <figcaption className="mt-5 flex items-center gap-3 border-t border-border/60 pt-4">
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"
                    aria-hidden="true"
                  >
                    <Users className="size-4.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">کاربر نمونه</span>
                    <span className="block text-[11px] text-muted-foreground">{t.role}</span>
                  </span>
                </figcaption>
              </figure>
            </Anim>
          ))}
        </div>
      </section>

      {/* ═══════════ FINAL CTA ═══════════ */}
      <section className="px-[4%] pb-16 pt-4 sm:pb-20">
        <Anim>
          <div className="rounded-3xl bg-[#111827] px-6 py-14 text-center sm:py-16 dark:bg-white/10">
            <h2 className="text-2xl font-extrabold text-white sm:text-4xl">
              فضای بهره‌وری شخصی خودت را بساز
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/70 sm:text-base">
              کارها را مدیریت کن، زمانت را برنامه‌ریزی کن و پیشرفتت را در یک سیستم واحد ببین.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" onClick={startCta} className="px-8 text-base">
                شروع رایگان
                <ArrowLeft className="me-1 size-4" aria-hidden="true" />
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/40 bg-transparent px-8 text-base text-white hover:bg-white/10 hover:text-white"
              >
                <a href="#features">مشاهده امکانات</a>
              </Button>
            </div>
          </div>
        </Anim>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="border-t border-border/60">
        <div className="w-full px-[4%] py-14">
          <h2 className="sr-only">پیوندهای پاورقی</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:gap-y-10 lg:grid-cols-6">
            <div className="col-span-2">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <ListChecks className="size-5" aria-hidden="true" />
                </span>
                <span className="text-lg font-extrabold">تسک‌لی</span>
              </div>
              <p className="mt-3 max-w-xs text-sm leading-7 text-muted-foreground">
                سیستم عامل بهره‌وری شخصی: کارها، برنامه زمانی، روتین‌ها و پیشرفت — همه در یک فضای کاری منظم.
              </p>
            </div>
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title}>
                <h3 className="mb-3 text-sm font-extrabold">{col.title}</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      {l.soon ? (
                        <span className="inline-flex items-center gap-1.5 transition hover:text-foreground">
                          {l.label}
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold">به‌زودی</span>
                        </span>
                      ) : l.to ? (
                        <Link to={l.to} className="transition hover:text-foreground">
                          {l.label}
                        </Link>
                      ) : (
                        <a href={l.href} className="transition hover:text-foreground">
                          {l.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
            <span>© {toFa(1404)} تسک‌لی — همه حقوق محفوظ است.</span>
            <div className="flex items-center gap-4">
              <span className="transition hover:text-foreground">حریم خصوصی</span>
              <span className="transition hover:text-foreground">شرایط استفاده</span>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="inline-flex items-center gap-1 transition hover:text-foreground"
              >
                <ArrowUp className="size-3.5" aria-hidden="true" />
                برگشت به بالا
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
