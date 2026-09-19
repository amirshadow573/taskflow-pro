import { motion } from "framer-motion";
import {
  ArrowUp,
  CheckCircle2,
  Flame,
  ListChecks,
  Palette,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Link, useNavigate } from "react-router";
import { toFa } from "@/lib/persian";

const FEATURES = [
  {
    n: 1,
    icon: ListChecks,
    title: "کارهای ثابت روزانه",
    desc: "هر روز وارد شوی، لیست کارهایت منتظرت است. تیک بزن و پیش برو.",
  },
  {
    n: 2,
    icon: Flame,
    title: "پیشرفت درصدی",
    desc: "پیشرفت امروز، این ماه و امسال را با نمودارهای درصدی زنده ببین.",
  },
  {
    n: 3,
    icon: Palette,
    title: "مجموعه‌های رنگی",
    desc: "برای هر مجموعه یک رنگ جدا انتخاب کن تا صفحه‌ات زنده و اختصاصی باشد.",
  },
  {
    n: 4,
    icon: TrendingUp,
    title: "تقویم و روند",
    desc: "همه‌چیز با تقویم جلالی و اعداد فارسی؛ دقیقاً همان‌طور که باید باشد.",
  },
];

const STEPS = [
  {
    n: "۰۱",
    title: "مجموعه بساز",
    desc: "مثلاً «روتین صبح» یا «ورزش»؛ برای هر کدام یک رنگ.",
  },
  {
    n: "۰۲",
    title: "کارهای ثابت را اضافه کن",
    desc: "کارهایی که هر روز باید انجام بدهی، یک‌بار برای همیشه.",
  },
  {
    n: "۰۳",
    title: "هر روز تیک بزن",
    desc: "پیشرفتت را زنده ببین و انگیزه‌ات را نگه دار.",
  },
];

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  const startCta = () => navigate(isAuthenticated ? "/dashboard" : "/auth");

  return (
    <div className="app-bg min-h-screen">
      {/* Nav — like eskul's floating glass navbar */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass sticky top-4 z-30 mx-auto mt-6 flex max-w-5xl items-center justify-between rounded-2xl px-5 py-3"
      >
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-[oklch(0.72_0.19_122)] text-[oklch(0.22_0.05_130)] shadow-lg shadow-emerald-500/25">
            <ListChecks className="size-5" />
          </div>
          <div>
            <div className="text-base font-extrabold">روتین‌یار</div>
            <div className="text-[11px] text-muted-foreground">
              پیگیری کارهای ثابت روزانه
            </div>
          </div>
          <nav className="hidden items-center gap-6 pr-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition hover:text-foreground">
              امکانات
            </a>
            <a href="#how" className="transition hover:text-foreground">
              چطور کار می‌کند؟
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {!isLoading && isAuthenticated ? (
            <Button onClick={startCta} size="sm">
              ورود به داشبورد
            </Button>
          ) : (
            <>
              <Link to="/auth">
                <Button variant="ghost" size="sm">
                  ورود
                </Button>
              </Link>
              <Button onClick={startCta} size="sm">
                ساخت حساب رایگان
              </Button>
            </>
          )}
        </div>
      </motion.header>

      {/* Hero — eskul-style framed dark band with big headline */}
      <section className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-[2rem] bg-[oklch(0.22_0.02_150)] px-6 py-16 text-center sm:px-12"
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(40rem 24rem at 80% -20%, oklch(0.72 0.19 122 / 25%), transparent 60%), radial-gradient(30rem 20rem at 10% 120%, oklch(0.7 0.13 165 / 20%), transparent 60%)",
            }}
          />
          <div className="relative">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-bold text-emerald-200">
              <Sparkles className="size-3.5" />
              نسخه ۱ — پیگیری کارهای ثابت روزانه
            </div>
            <h1 className="mx-auto max-w-2xl text-4xl leading-tight font-extrabold text-white sm:text-6xl">
              از یک تیک شروع کن؛{" "}
              <span className="text-[oklch(0.82_0.19_125)]">
                هر روز کاملش کن
              </span>
              .
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-emerald-50/70 sm:text-lg">
              روتین‌یار برای دانشجوها، برنامه‌نویس‌ها و هر کسی که شغل دارد؛ لیست
              کارهای ثابت هر روزت را بساز، تیک بزن و پیشرفتت را با درصدهای زنده
              ببین.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" onClick={startCta}>
                <ListChecks className="size-5" />
                ساخت حساب رایگان
              </Button>
              <a href="#features">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                >
                  بیشتر بدان
                </Button>
              </a>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Routine sets — eskul community-room style cards */}
      <section id="communities" className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="mb-2 flex items-baseline justify-between gap-4">
          <h2 className="text-3xl font-extrabold">مجموعه‌های روتین</h2>
          <span className="section-tag">{toFa(4)} نمونه</span>
        </div>
        <p className="mb-8 text-sm leading-6 text-muted-foreground">
          کارهایت را دسته‌بندی کن؛ هر مجموعه رنگ و ریتم خودش را دارد.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              tag: "ROOM · 01",
              title: "روتین صبح",
              desc: "ورزش، مطالعه، برنامه‌ریزی روز",
              members: "۱۲ کار",
              color: "#65a30d",
            },
            {
              tag: "ROOM · 02",
              title: "روتین کاری",
              desc: "کدنویسی، جلسات، مرور پروژه",
              members: "۸ کار",
              color: "#0d9488",
            },
          ].map((room, i) => (
            <motion.div
              key={room.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="glass group relative overflow-hidden rounded-3xl p-5 transition-transform hover:-translate-y-1"
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-20"
                style={{
                  background: `radial-gradient(24rem 10rem at 85% -30%, ${room.color}, transparent 70%)`,
                }}
              />
              <div className="relative">
                <div className="mb-4 flex items-center gap-2">
                  <span
                    className="grid size-9 place-items-center rounded-xl text-white"
                    style={{ background: room.color }}
                  >
                    <ListChecks className="size-4" />
                  </span>
                  <span className="text-[11px] font-bold tracking-wide text-muted-foreground">
                    {room.tag} — کامیونیتی {toFa(i + 1)}
                  </span>
                </div>
                <h3 className="mb-1 text-lg font-extrabold">{room.title}</h3>
                <p className="text-sm text-muted-foreground">{room.desc}</p>
                <div className="mt-5 flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground">
                    {room.members}
                  </span>
                  <Button size="sm" variant="glass" onClick={startCta}>
                    بریم داخل
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Workspace flow — eskul "eskul / workspace" strip */}
      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <div className="section-frame px-6 py-10 sm:px-10">
          <div className="mb-6 flex items-center gap-3">
            <span className="rounded-lg bg-black/[.06] px-3 py-1.5 text-xs font-bold text-foreground/80">
              روتین‌یار / workspace
            </span>
          </div>
          <div className="mb-8 flex flex-wrap items-center gap-3 text-sm font-extrabold">
            <span className="text-[oklch(0.55_0.16_145)]">ایده</span>
            <span className="text-muted-foreground/50">—</span>
            <span>ساخت</span>
            <span className="text-muted-foreground/50">—</span>
            <span className="text-[oklch(0.55_0.16_145)]">اجرا</span>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <div className="mb-2 text-xs font-extrabold tracking-wide text-muted-foreground">
                  {s.n} / {s.title}
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {s.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Numbered features — eskul ۰۱..۰۴ sections */}
      <section id="features" className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <h2 className="mb-8 text-3xl font-extrabold">امکانات</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              className="glass flex items-start gap-4 rounded-3xl p-6 transition-transform hover:-translate-y-1"
            >
              <span className="text-2xl font-extrabold text-emerald-600/40 tabular-nums">
                {toFa(`0${f.n}`)}
              </span>
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <f.icon className="size-5 text-emerald-600" />
                  <h3 className="font-extrabold">{f.title}</h3>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {f.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Final CTA — eskul "قدم بعدی، با تو" */}
      <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-[2rem] bg-[oklch(0.22_0.02_150)] px-6 py-14 text-center sm:px-12"
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(36rem 20rem at 50% -30%, oklch(0.72 0.19 122 / 28%), transparent 65%)",
            }}
          />
          <div className="relative">
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
              قدم بعدی، با تو
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-emerald-50/70">
              یک دقیقه وقت بگذار، کارهای ثابتت را بساز و از فردا فقط تیک بزن.
            </p>
            <Button size="lg" className="mt-7" onClick={startCta}>
              <CheckCircle2 className="size-5" />
              منم هستم
            </Button>
          </div>
        </motion.div>
        <footer className="mt-12 flex flex-col items-center gap-3 text-center text-xs text-muted-foreground">
          <div>© {toFa(1404)} روتین‌یار — نسخه ۱</div>
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
