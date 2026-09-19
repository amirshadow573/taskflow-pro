import { motion } from "framer-motion";
import {
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  Circle,
  FolderKanban,
  Inbox,
  Keyboard,
  ListChecks,
  Quote,
  Sparkles,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Link, useNavigate } from "react-router";
import { toFa } from "@/lib/persian";

const FEATURES = [
  {
    icon: ListChecks,
    title: "کارهای امروز، یک‌جا",
    desc: "هر صبح که وارد می‌شوی، دقیقاً می‌دانی امروز چه کاری، به چه ترتیبی باید انجام بدهی.",
  },
  {
    icon: FolderKanban,
    title: "پروژه‌های منظم",
    desc: "کارهای بزرگ را به پروژه بشکن؛ پیشرفت هر پروژه را زنده ببین و عقب‌افتاده‌ها را نگیر.",
  },
  {
    icon: CalendarDays,
    title: "تقویم شمسی",
    desc: "کارها را بکش و روی روز دلخواه رها کن؛ جابه‌جایی برنامه‌ها در چند ثانیه انجام می‌شود.",
  },
  {
    icon: TrendingUp,
    title: "پیشرفت واقعی",
    desc: "نرخ تکمیل، زنجیره روزها و روند هفتگی؛ نه شلوغ‌کاری آماری، فقط عددی که به کارت می‌آید.",
  },
  {
    icon: Sparkles,
    title: "ثبت کار با یک جمله",
    desc: "«جلسه تیم فردا ساعت ۱۰ #محصول» — سیستم خودش تاریخ، ساعت و تگ را تشخیص می‌دهد.",
  },
  {
    icon: Keyboard,
    title: "سریع مثل فکر کردن",
    desc: "با Ctrl+K هر کاری را پیدا کن، هر دستوری را اجرا کن؛ بدون برداشتن دست از کیبورد.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "قبلاً کارهام پراکنده بود بین دفترچه و چند اپ. الان صبح‌ها داشبورد را باز می‌کنم و می‌دانم از کجا شروع کنم.",
    name: "سارا محمدی",
    role: "دانشجوی ارشد کامپیوتر",
  },
  {
    quote:
      "قابلیت ثبت کار با یک جمله برایم عادی شد؛ حالا وقتی ایده‌ای می‌آید در سه ثانیه ثبتش می‌کنم و برگردم سر کارم.",
    name: "امیر رضایی",
    role: "توسعه‌دهنده بک‌اند",
  },
  {
    quote:
      "بخش پیشرفت انگیزه‌ام را عوض کرد. دیدن زنجیره روزها باعث شد سه ماه پیوسته ورزش روزانه‌ام را انجام بدهم.",
    name: "نگار کریمی",
    role: "طراح محصول",
  },
];

const FAQ = [
  [
    "شروع کار چقدر طول می‌کشد؟",
    "کمتر از یک دقیقه. بعد از ساخت حساب، ۴ قدم کوتاه را طی می‌کنی و اولین کار و پروژه‌ات آماده است.",
  ],
  [
    "اطلاعاتم کجا ذخیره می‌شود؟",
    "روی سرور امن فضای کاری خودت؛ فقط با حساب کاربری خودت قابل دسترسی است و هر زمان می‌توانی خروجی بگیری.",
  ],
  [
    "روی گوشی هم خوب کار می‌کند؟",
    "بله. رابط کاملاً واکنش‌گراست و برای موبایل نوار ناوبری پایین و دکمه شناور افزودن کار دارد.",
  ],
  [
    "امکان استفاده رایگان هست؟",
    "بله؛ نسخه رایگان برای استفاده شخصی کاملاً کامل است و محدودیت واقعی روی کارهای روزانه ندارد.",
  ],
];

const PLANS = [
  {
    name: "رایگان",
    price: "۰",
    period: "همیشه",
    features: ["کارهای نامحدود", "۳ پروژه", "تقویم شمسی", "ثبت کار با زبان طبیعی"],
    cta: "شروع رایگان",
    highlight: false,
  },
  {
    name: "حرفه‌ای",
    price: "۹۹",
    period: "ماهانه / هزار تومان",
    features: [
      "همه امکانات رایگان",
      "پروژه‌های نامحدود",
      "زیرکار و وابستگی",
      "گزارش‌های پیشرفته",
      "پشتیبانی اولویت‌دار",
    ],
    cta: "۱۴ روز رایگان امتحان کن",
    highlight: true,
  },
  {
    name: "تیمی",
    price: "تماس",
    period: "برای تیم‌های +۵ نفر",
    features: ["همه امکانات حرفه‌ای", "کارهای گروهی", "دسترسی نقش‌محور", "فاکتور رسمی"],
    cta: "تماس با ما",
    highlight: false,
  },
];

/** Realistic dashboard preview used in hero + sections. */
function DashboardPreview() {
  const rows = [
    { t: "طراحی صفحه اصلی سایت", p: "بالا", d: "امروز", color: "#ef4444", done: false, project: "بازطراحی وب‌سایت", pc: "#4f46e5" },
    { t: "ارسال پروژه به مشتری", p: "فوری", d: "دیروز", color: "#ef4444", done: false, project: "بازطراحی وب‌سایت", pc: "#4f46e5" },
    { t: "مطالعه فصل سوم زیست", p: "متوسط", d: "امروز · ۱۸:۰۰", color: "#3b82f6", done: false, project: "پروژه دانشگاه", pc: "#f59e0b" },
    { t: "پاسخ به ایمیل‌ها", p: "پایین", d: "امروز", color: "#10b981", done: true, project: null, pc: "#64748b" },
  ];
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-card text-start elev-3" dir="rtl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-md bg-primary text-white">
            <ListChecks className="size-3.5" />
          </span>
          <span className="text-xs font-bold">امروز — چهارشنبه ۱۵ مهر</span>
        </div>
        <span className="rounded-md bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
          ۵۸٪ پیشرفت
        </span>
      </div>
      <ul>
        {rows.map((r) => (
          <li key={r.t} className="flex items-center gap-2.5 border-b border-border/60 px-4 py-2.5 last:border-0">
            <span
              className="grid size-4.5 shrink-0 place-items-center rounded-full border-2"
              style={{ borderColor: r.done ? r.color : "var(--border)", background: r.done ? r.color : "transparent" }}
            >
              {r.done && <CheckCircle2 className="size-2.5 text-white" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-xs font-semibold ${r.done ? "text-muted-foreground line-through" : ""}`}>
                {r.t}
              </span>
              <span className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                {r.project && (
                  <span className="inline-flex items-center gap-1">
                    <span className="size-1.5 rounded-sm" style={{ background: r.pc }} />
                    {r.project}
                  </span>
                )}
                <span style={{ color: r.d === "دیروز" ? "#ef4444" : undefined }}>
                  {r.d === "دیروز" && <TriangleAlert className="me-0.5 inline size-2.5" />}
                  {r.d}
                </span>
              </span>
            </span>
            <span
              className="hidden shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold sm:inline"
              style={{ color: r.color, borderColor: `${r.color}40`, background: `${r.color}12` }}
            >
              {r.p}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const startCta = () => navigate(isAuthenticated ? "/dashboard" : "/auth");

  return (
    <div className="min-h-svh bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <ListChecks className="size-5" />
            </span>
            <span className="text-lg font-extrabold">تسک‌لی</span>
          </div>
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition hover:text-foreground">امکانات</a>
            <a href="#workflow" className="transition hover:text-foreground">روش کار</a>
            <a href="#pricing" className="transition hover:text-foreground">تعرفه‌ها</a>
            <a href="#faq" className="transition hover:text-foreground">سؤالات</a>
          </nav>
          <div className="flex items-center gap-2">
            {!isLoading && isAuthenticated ? (
              <Button size="sm" onClick={startCta}>ورود به فضای کاری</Button>
            ) : (
              <>
                <Link to="/auth"><Button variant="ghost" size="sm">ورود</Button></Link>
                <Button size="sm" onClick={startCta}>شروع رایگان</Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(52rem 30rem at 70% -10%, color-mix(in oklab, var(--primary) 9%, transparent), transparent 65%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-2 lg:pt-24">
          <div className="text-center lg:text-start">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-bold text-accent-foreground">
              <Sparkles className="size-3.5" />
              ثبت کار با یک جمله — بدون فرم
            </div>
            <h1 className="text-4xl leading-[1.2] font-extrabold tracking-tight sm:text-5xl lg:text-[3.4rem]">
              کارهایت را منظم کن؛{" "}
              <span className="text-primary">سر چیزی که مهم است</span> تمرکز کن.
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-base leading-8 text-muted-foreground lg:mx-0">
              یک فضای کاری ساده و هوشمند برای مدیریت کارهای روزانه، پروژه‌ها،
              برنامه‌ها و پیشرفت شخصی — همه در یک‌جا.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Button size="lg" onClick={startCta}>
                شروع رایگان
              </Button>
              <a href="#workflow">
                <Button size="lg" variant="outline">
                  ببین چطور کار می‌کند
                </Button>
              </a>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              بدون کارت بانکی · بدون نصب · رایگان برای همیشه
            </p>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <DashboardPreview />
          </motion.div>
        </div>
      </section>

      {/* Problem */}
      <section className="border-y border-border bg-muted/40 py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-extrabold tracking-tight">
            کارهایت نباید بین ده‌ها ابزار گم شوند.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
            یک کار در دفترچه، یک یادآور در گوشی، یک لیست در گروه خانواده و یک
            دیزاین در نوت بوک… نتیجه؟ هیچ‌کدام سر وقت انجام نمی‌شوند. تسک‌لی همه
            را یک‌جا جمع می‌کند.
          </p>
        </div>
      </section>

      {/* Features grid */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight">
            همه چیز برای یک روز منظم
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            کمترین فاصله بین «فکر کردم» و «انجام شد».
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.article
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: (i % 3) * 0.06 }}
              className="rounded-2xl border border-border bg-card p-6 transition-shadow elev-1 hover:elev-2"
            >
              <span className="mb-4 grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                <f.icon className="size-5" />
              </span>
              <h3 className="mb-1.5 font-bold">{f.title}</h3>
              <p className="text-sm leading-6 text-muted-foreground">{f.desc}</p>
            </motion.article>
          ))}
        </div>
      </section>

      {/* Workflow / Today */}
      <section id="workflow" className="border-y border-border bg-muted/40 py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <span className="mb-2 inline-block rounded-md bg-accent px-2.5 py-1 text-[11px] font-bold text-accent-foreground">
              امروز
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight">
              صبح‌ها با یک نگاه، روزت را بشناس
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              صفحه «امروز» فقط یک چیز نشان می‌دهد: چه کاری الان مهم است. کارهای
              عقب‌افتاده قرمز می‌شوند، پیشرفت روز بالای صفحه است و کار بعدی همیشه
              یک کلیک فاصله دارد.
            </p>
            <ul className="mt-6 space-y-2.5">
              {[
                "۱۲ کار امروز، ۷ انجام‌شده، ۵ باقی‌مانده — در یک نوار جمع‌بندی",
                "اولویت‌ها با رنگ و برچسب، نه فقط رنگ",
                "کار بعدی را سیستم پیشنهاد می‌دهد",
              ].map((li) => (
                <li key={li} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  <span className="leading-6">{li}</span>
                </li>
              ))}
            </ul>
          </div>
          <DashboardPreview />
        </div>
      </section>

      {/* Projects + Calendar */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <div className="overflow-hidden rounded-2xl border border-border bg-card elev-2" dir="rtl">
            <div className="border-b border-border px-4 py-3 text-xs font-bold">پروژه‌ها</div>
            <ul className="divide-y divide-border/60">
              {[
                { n: "بازطراحی وب‌سایت", p: 68, c: "#4f46e5", t: "۱۷ از ۲۵" },
                { n: "پروژه دانشگاه", p: 40, c: "#f59e0b", t: "۶ از ۱۵" },
                { n: "رشد شخصی", p: 82, c: "#10b981", t: "۹ از ۱۱" },
              ].map((p) => (
                <li key={p.n} className="px-4 py-3">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-bold">
                      <span className="size-2.5 rounded-sm" style={{ background: p.c }} />
                      {p.n}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{p.t}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${p.p}%`, background: p.c }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <span className="mb-2 inline-block rounded-md bg-accent px-2.5 py-1 text-[11px] font-bold text-accent-foreground">
            پروژه‌ها و تقویم
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight">
            از پروژه بزرگ تا قرار کوچک
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            پروژه‌ها پیشرفت زنده دارند و تقویم شمسی اجازه می‌دهد هر کاری را با
            کشیدن و رها کردن به روز دیگری ببری — بدون باز کردن هیچ فرمی.
          </p>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-y border-border bg-muted/40 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="mb-10 text-center text-3xl font-extrabold tracking-tight">
            کاربران چه می‌گویند
          </h2>
          <div className="grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className="rounded-2xl border border-border bg-card p-6 elev-1">
                <Quote className="mb-3 size-5 text-primary/40" />
                <blockquote className="text-sm leading-7">{t.quote}</blockquote>
                <figcaption className="mt-4 flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                    {t.name.slice(0, 1)}
                  </span>
                  <span>
                    <span className="block text-xs font-bold">{t.name}</span>
                    <span className="block text-[11px] text-muted-foreground">{t.role}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight">تعرفه‌ها</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            رایگان شروع کن؛ هر وقت خواستی ارتقا بده.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {PLANS.map((p) => (
            <article
              key={p.name}
              className={
                p.highlight
                  ? "relative rounded-2xl border-2 border-primary bg-card p-6 elev-2"
                  : "rounded-2xl border border-border bg-card p-6 elev-1"
              }
            >
              {p.highlight && (
                <span className="absolute -top-3 start-6 rounded-full bg-primary px-3 py-0.5 text-[10px] font-bold text-white">
                  پیشنهاد ما
                </span>
              )}
              <h3 className="font-bold">{p.name}</h3>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold tabular-nums">{p.price}</span>
                <span className="text-xs text-muted-foreground">{p.period}</span>
              </div>
              <ul className="mt-5 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-6 w-full"
                variant={p.highlight ? "default" : "outline"}
                onClick={startCta}
              >
                {p.cta}
              </Button>
            </article>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border bg-muted/40 py-20">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <h2 className="mb-8 text-center text-3xl font-extrabold tracking-tight">
            سؤال‌های پرتکرار
          </h2>
          <div className="space-y-3">
            {FAQ.map(([q, a]) => (
              <details
                key={q}
                className="group rounded-xl border border-border bg-card px-5 py-4 elev-1"
              >
                <summary className="cursor-pointer list-none text-sm font-bold marker:hidden">
                  {q}
                  <span className="float-start text-muted-foreground transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div
          className="relative overflow-hidden rounded-3xl px-6 py-16 text-center"
          style={{
            background:
              "linear-gradient(160deg, var(--primary), color-mix(in oklab, var(--primary) 70%, #0f172a))",
          }}
        >
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            امروز را منظم شروع کن
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-white/80">
            کمتر از یک دقیقه تا اولین کارِ ثبت‌شده‌ات فاصله است.
          </p>
          <Button
            size="lg"
            onClick={startCta}
            className="mt-7 bg-white text-primary hover:bg-white/90"
          >
            شروع رایگان
          </Button>
        </div>
        <footer className="mt-14 flex flex-col items-center gap-2 text-center text-xs text-muted-foreground">
          <span>© {toFa(1404)} تسک‌لی — فضای کاری شخصی مدیریت کار</span>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="inline-flex items-center gap-1 transition hover:text-foreground"
          >
            <ArrowUp className="size-3.5" />
            برگشت به بالا
          </button>
        </footer>
      </section>
    </div>
  );
}
