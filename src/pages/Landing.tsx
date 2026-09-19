import { motion } from "framer-motion";
import {
  BellRing,
  CalendarCheck,
  CheckCircle2,
  Flame,
  ListChecks,
  Palette,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Link, useNavigate } from "react-router";

const FEATURES = [
  {
    icon: ListChecks,
    title: "کارهای ثابت روزانه",
    desc: "هر روز وارد شوی، لیست کارهایت منتظرت است. تیک بزن و پیش برو.",
    color: "text-blue-600 bg-blue-500/10",
  },
  {
    icon: Flame,
    title: "پیشرفت درصدی",
    desc: "پیشرفت امروز، این ماه و امسال را با نمودارهای درصدی ببین.",
    color: "text-amber-600 bg-amber-500/10",
  },
  {
    icon: Palette,
    title: "مجموعه‌های رنگی",
    desc: "برای هر مجموعه یک رنگ جدا انتخاب کن تا صفحه‌ات زنده باشد.",
    color: "text-violet-600 bg-violet-500/10",
  },
  {
    icon: CalendarCheck,
    title: "تقویم شمسی",
    desc: "همه‌چیز با تقویم جلالی و اعداد فارسی؛ دقیقاً همان‌طور که باید باشد.",
    color: "text-emerald-600 bg-emerald-500/10",
  },
  {
    icon: BellRing,
    title: "حفظ روند",
    desc: "ثبت روزانه ساده، بدون حواس‌پرتی؛ فقط تو و کارهایت.",
    color: "text-rose-600 bg-rose-500/10",
  },
  {
    icon: Sparkles,
    title: "ظاهر شیشه‌ای",
    desc: "رابط کاربری شیشه‌ای روشن، مدرن و لطیف برای استفادهٔ هر روزه.",
    color: "text-cyan-600 bg-cyan-500/10",
  },
];

const STEPS = [
  {
    n: "۱",
    title: "مجموعه بساز",
    desc: "مثلاً «روتین صبح» یا «ورزش»؛ برای هرکدام یک رنگ.",
  },
  {
    n: "۲",
    title: "کارهای ثابت را اضافه کن",
    desc: "کارهایی که هر روز باید انجام بدهی، یک‌بار برای همیشه.",
  },
  {
    روز: "۳",
    title: "هر روز تیک بزن",
    desc: "پیشرفتت را زنده ببین و انگیزه‌ات را نگه دار.",
  },
] as Array<{ n: string; title: string; desc: string }>;

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  const startCta = () => navigate(isAuthenticated ? "/dashboard" : "/auth");

  return (
    <div className="app-bg min-h-screen">
      {/* Nav */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass sticky top-4 z-30 mx-auto mt-6 flex max-w-5xl items-center justify-between rounded-2xl px-5 py-3"
      >
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/25">
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
                شروع رایگان
              </Button>
            </>
          )}
        </div>
      </motion.header>

      {/* Hero */}
      <section className="mx-auto flex max-w-5xl flex-col items-center px-4 pt-20 pb-16 text-center sm:px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="glass mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-blue-700"
        >
          <Sparkles className="size-3.5" />
          نسخه ۱ — پیگیری کارهای ثابت روزانه
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="max-w-2xl text-4xl leading-tight font-extrabold sm:text-6xl"
        >
          کارهای هر روزت را
          <span className="bg-gradient-to-l from-blue-600 to-cyan-500 bg-clip-text text-transparent">
            {" "}
            ساده و شاد
          </span>{" "}
          انجام بده
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg"
        >
          روتین‌یار برای دانشجوها، برنامه‌نویس‌ها و هر کسی که شغل دارد؛ لیست
          کارهای ثابت هر روزت را بساز، تیک بزن و پیشرفتت را با درصدهای زنده ببین.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Button size="lg" onClick={startCta}>
            <ListChecks className="size-5" />
            شروع کن — رایگان
          </Button>
          <a href="#features">
            <Button variant="glass" size="lg">
              بیشتر بدان
            </Button>
          </a>
        </motion.div>

        {/* Mini preview card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="glass mt-16 w-full max-w-xl rounded-3xl p-6 text-right"
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-bold">امروز — شنبه</span>
            <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-600">
              ۷۵٪ پیشرفت
            </span>
          </div>
          {[
            { t: "ورزش صبحگاهی", c: "#10b981", done: true },
            { t: "۳۰ دقیقه مطالعه", c: "#3b82f6", done: true },
            { t: "کدنویسی پروژه", c: "#8b5cf6", done: true },
            { t: "مرور واژگان انگلیسی", c: "#f59e0b", done: false },
          ].map((row) => (
            <div
              key={row.t}
              className="glass-row mb-2 flex items-center gap-3 rounded-xl px-4 py-2.5"
            >
              <span
                className="grid size-6 place-items-center rounded-full"
                style={{
                  background: row.done ? row.c : "transparent",
                  border: `2px solid ${row.c}`,
                }}
              >
                {row.done && <CheckCircle2 className="size-3.5 text-white" />}
              </span>
              <span
                className={
                  row.done
                    ? "flex-1 text-sm text-muted-foreground line-through"
                    : "flex-1 text-sm"
                }
              >
                {row.t}
              </span>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <h2 className="mb-3 text-center text-3xl font-extrabold">
          ساخته‌شده برای عادت‌های واقعی
        </h2>
        <p className="mx-auto mb-10 max-w-lg text-center text-sm leading-6 text-muted-foreground">
          نه بیشتر، نه کمتر؛ دقیقاً همان‌قدر که برای پیگیری روزانه لازم داری.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.05 }}
              className="glass rounded-2xl p-5 transition-transform hover:-translate-y-1"
            >
              <div
                className={`mb-4 grid size-11 place-items-center rounded-xl ${f.color}`}
              >
                <f.icon className="size-5" />
              </div>
              <h3 className="mb-1.5 font-bold">{f.title}</h3>
              <p className="text-sm leading-6 text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <h2 className="mb-10 text-center text-3xl font-extrabold">
          سه قدم تا شروع
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="glass rounded-2xl p-6 text-center"
            >
              <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-xl font-extrabold text-white shadow-lg shadow-blue-500/25">
                {s.n}
              </div>
              <h3 className="mb-1.5 font-bold">{s.title}</h3>
              <p className="text-sm leading-6 text-muted-foreground">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5 }}
          className="glass flex flex-col items-center gap-5 rounded-3xl px-6 py-12 text-center"
        >
          <h2 className="text-3xl font-extrabold">امروز را شروع کن</h2>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            یک دقیقه وقت بگذار، کارهای ثابتت را بساز و از فردا فقط تیک بزن.
          </p>
          <Button size="lg" onClick={startCta}>
            <ListChecks className="size-5" />
            ساخت اولین روتین
          </Button>
        </motion.div>
        <footer className="mt-12 text-center text-xs text-muted-foreground">
          روتین‌یار — نسخه ۱
        </footer>
      </section>
    </div>
  );
}
