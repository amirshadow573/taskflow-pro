/**
 * Landing product previews — the marketing layer renders the SAME visual
 * language as the signed-in product (Today, برنامه زمانی, برنامه‌ریزی،
 * روتین‌ها، اهداف، پیشرفت، تحلیل و شش فضای کاری شخصیت‌محور).
 *
 * Every "product screenshot" on the landing page is one of these live
 * components — no stock images, no fake dashboards, no unrelated UI.
 * All components are module-scope (no hooks, no per-render types).
 */
import type { ReactNode } from "react";
import {
  BookOpen,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  Droplets,
  Flame,
  FolderKanban,
  GraduationCap,
  ListChecks,
  Play,
  Target,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { toFa } from "@/lib/persian";

/* ──────────────────────────────────────────────────────────────── */
/*  Shared shell                                                    */
/* ──────────────────────────────────────────────────────────────── */

/** Browser-style frame around a product preview (white surface, hairline border). */
export function Frame({
  url,
  children,
  className = "",
}: {
  url: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      dir="rtl"
      className={`w-full overflow-hidden rounded-2xl border border-border bg-card elev-3 ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 sm:px-4">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-red-400/70" />
          <span className="size-2.5 rounded-full bg-amber-400/70" />
          <span className="size-2.5 rounded-full bg-emerald-400/70" />
        </span>
        <span className="ms-2 h-5 min-w-0 flex-1 truncate rounded-md border border-border/60 bg-card px-2 text-[10px] leading-5 text-muted-foreground">
          {url}
        </span>
      </div>
      {children}
    </div>
  );
}

/** Small stat tile used inside previews. */
function Stat({
  value,
  label,
  tone = "",
}: {
  value: string;
  label: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/60 p-2 text-center">
      <p className={`text-base font-extrabold tabular-nums ${tone}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}

/** Slim progress bar. */
function Bar({ pct, tone = "bg-primary" }: { pct: number; tone?: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** A checkbox row used by the task-centric previews. */
function TaskRow({
  title,
  meta,
  done = false,
  badge,
  badgeTone = "#3b82f6",
  dot,
}: {
  title: string;
  meta?: string;
  done?: boolean;
  badge?: string;
  badgeTone?: string;
  dot?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60">
      <span
        className="grid size-4 shrink-0 place-items-center rounded-full border-2"
        style={{
          borderColor: done ? badgeTone : "var(--border)",
          background: done ? badgeTone : "transparent",
        }}
        aria-hidden="true"
      >
        {done && <CheckCircle2 className="size-2.5 text-white" />}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[11px] font-semibold ${
            done ? "text-muted-foreground line-through" : ""
          }`}
        >
          {title}
        </span>
        {meta && (
          <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
            {dot && <span className="size-1.5 rounded-sm" style={{ background: dot }} />}
            {meta}
          </span>
        )}
      </span>
      {badge && (
        <span
          className="shrink-0 rounded border px-1 py-0.5 text-[8px] font-bold"
          style={{ color: badgeTone, borderColor: `${badgeTone}40`, background: `${badgeTone}12` }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

/** Sidebar shared by the big app previews — mirrors the real navigation. */
function Sidebar({ active }: { active: string }) {
  const rows = [
    "داشبورد",
    "امروز",
    "کارهای من",
    "پروژه‌ها",
    "تقویم",
    "برنامه زمانی",
    "برنامه‌ریزی",
    "پیشرفت",
  ];
  return (
    <div className="hidden w-40 shrink-0 border-e border-border bg-card p-3 md:block lg:w-48">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-primary text-white">
          <ListChecks className="size-3.5" />
        </span>
        <span className="text-xs font-extrabold">تسک‌لی</span>
      </div>
      {rows.map((l) => (
        <div
          key={l}
          className={`mb-0.5 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${
            l === active ? "bg-accent font-bold text-accent-foreground" : "text-muted-foreground"
          }`}
        >
          <span className="size-3.5 rounded bg-muted" aria-hidden="true" />
          {l}
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/*  HERO — main personalized dashboard                             */
/* ──────────────────────────────────────────────────────────────── */

export function HeroDashboard() {
  return (
    <Frame url="taskflow.app/dashboard">
      <div className="flex min-h-[320px] sm:min-h-[420px]">
        <Sidebar active="داشبورد" />
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground">صبح بخیر 👋</p>
              <p className="text-sm font-extrabold sm:text-base">امروز — چهارشنبه ۱۵ مهر</p>
            </div>
            <span className="rounded-lg bg-accent px-2.5 py-1 text-[10px] font-bold text-accent-foreground">
              ۵۸٪ پیشرفت هفته
            </span>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat value="۱۲" label="کار امروز" />
            <Stat value="۷" label="انجام‌شده" tone="text-emerald-600" />
            <Stat value="۳" label="در حال انجام" tone="text-blue-600" />
            <Stat value="۲" label="عقب‌افتاده" tone="text-red-500" />
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
            {/* Today tasks */}
            <div className="rounded-xl border border-border/60 p-2">
              <p className="px-2 py-1 text-[11px] font-extrabold">کارهای مهم امروز</p>
              <TaskRow title="طراحی صفحه اصلی سایت" meta="بازطراحی وب‌سایت · امروز" dot="#4f46e5" badge="بالا" badgeTone="#ef4444" />
              <TaskRow title="جلسه بررسی اسپرینت" meta="امروز · ۱۰:۰۰" dot="#4f46e5" badge="متوسط" badgeTone="#3b82f6" />
              <TaskRow title="مطالعه فصل سوم زیست" meta="پروژه دانشگاه · ۱۸:۰۰" dot="#f59e0b" badge="پایین" badgeTone="#10b981" />
              <TaskRow title="پاسخ به ایمیل‌ها" meta="انجام‌شده" done dot="#64748b" badgeTone="#10b981" />
            </div>

            {/* Right rail: progress + schedule */}
            <div className="space-y-3">
              <div className="rounded-xl border border-border/60 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-extrabold">هدف این ماه</p>
                  <span className="text-[10px] font-bold text-primary">۷۰٪</span>
                </div>
                <p className="mb-2 truncate text-[10px] text-muted-foreground">رشد مهارتی تا پایان سال</p>
                <Bar pct={70} />
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <p className="mb-2 text-[11px] font-extrabold">برنامه زمانی امروز</p>
                {[
                  { t: "۰۹:۰۰ — ۱۰:۳۰", n: "طراحی صفحه اصلی", c: "bg-blue-500" },
                  { t: "۱۰:۳۰ — ۱۱:۰۰", n: "جلسه بررسی اسپرینت", c: "bg-amber-500" },
                  { t: "۱۱:۰۰ — ۱۲:۰۰", n: "تحویل پروژه", c: "bg-rose-500" },
                ].map((b) => (
                  <div key={b.t} className="mb-1.5 flex items-center gap-2 last:mb-0">
                    <span className={`h-7 w-1 shrink-0 rounded-full ${b.c}`} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block truncate text-[10px] font-bold">{b.n}</span>
                      <span className="block text-[9px] tabular-nums text-muted-foreground">{b.t}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/*  F1 — TODAY / dashboard                                          */
/* ──────────────────────────────────────────────────────────────── */

export function TodayPreview() {
  return (
    <Frame url="taskflow.app/today">
      <div className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-extrabold">امروز — چهارشنبه ۱۵ مهر</p>
          <span className="rounded-lg bg-accent px-2 py-1 text-[10px] font-bold text-accent-foreground">
            ۵ / ۸ انجام شد
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border/60 p-2">
            <p className="px-2 py-1 text-[11px] font-extrabold">کارهای مهم امروز</p>
            <TaskRow title="بازبینی طرح صفحه قیمت" meta="امروز · ۱۱:۰۰" dot="#4f46e5" badge="بالا" badgeTone="#ef4444" />
            <TaskRow title="تماس با تیم محتوا" meta="امروز · ۱۴:۰۰" dot="#10b981" badge="متوسط" badgeTone="#3b82f6" />
            <TaskRow title="نوشتن گزارش هفتگی" meta="فردا" dot="#f59e0b" badge="پایین" badgeTone="#10b981" />
            <TaskRow title="مرور روزانه" meta="انجام‌شده" done dot="#10b981" badgeTone="#10b981" />
          </div>
          <div className="space-y-2">
            <div className="rounded-xl border border-border/60 p-3">
              <p className="mb-2 text-[11px] font-extrabold">پروژه‌های فعال</p>
              <div className="space-y-2">
                {[
                  { n: "بازطراحی وب‌سایت", p: 70, c: "#4f46e5" },
                  { n: "پروژه دانشگاه", p: 45, c: "#f59e0b" },
                ].map((pj) => (
                  <div key={pj.n}>
                    <div className="mb-1 flex items-center justify-between text-[10px]">
                      <span className="flex items-center gap-1.5 font-bold">
                        <span className="size-2 rounded-sm" style={{ background: pj.c }} />
                        {pj.n}
                      </span>
                      <span className="tabular-nums text-muted-foreground">{toFa(pj.p)}٪</span>
                    </div>
                    <Bar pct={pj.p} />
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat value="۲" label="هدف فعال" tone="text-primary" />
              <Stat value="۱۲" label="روز استمرار" tone="text-amber-600" />
              <Stat value="۷۶٪" label="نرخ تکمیل" tone="text-emerald-600" />
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/*  F2 — GOALS → PROJECTS → TASKS → PLAN → EXECUTE                  */
/* ──────────────────────────────────────────────────────────────── */

export function GoalsChainPreview() {
  const steps = [
    { icon: Target, label: "هدف", text: "رشد مهارتی تا پایان سال", tone: "bg-violet-50 text-violet-600 dark:bg-violet-500/10" },
    { icon: FolderKanban, label: "پروژه", text: "بازطراحی وب‌سایت", tone: "bg-blue-50 text-blue-600 dark:bg-blue-500/10" },
    { icon: ListChecks, label: "کار", text: "طراحی صفحه اصلی — ۹۰ دقیقه", tone: "bg-amber-50 text-amber-600 dark:bg-amber-500/10" },
    { icon: CalendarClock, label: "برنامه", text: "امروز ۰۹:۰۰ تا ۱۰:۳۰ در Timeline", tone: "bg-sky-50 text-sky-600 dark:bg-sky-500/10" },
    { icon: Play, label: "اجرا", text: "در حال انجام — ۳۵ دقیقه گذشته", tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" },
  ];
  return (
    <Frame url="taskflow.app/goals">
      <div className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-extrabold">از هدف تا اجرا</p>
          <span className="rounded-lg bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">
            ۳ پروژه وابسته
          </span>
        </div>
        <ol className="relative space-y-1">
          {steps.map((s, i) => (
            <li key={s.label}>
              <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
                <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${s.tone}`}>
                  <s.icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-bold text-muted-foreground">{s.label}</span>
                  <span className="block truncate text-xs font-extrabold">{s.text}</span>
                </span>
                {i === steps.length - 1 && (
                  <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:bg-emerald-500/10">
                    فعال
                  </span>
                )}
              </div>
              {i < steps.length - 1 && (
                <div className="flex justify-center py-0.5 text-muted-foreground/50" aria-hidden="true">
                  <ChevronDown className="size-4" />
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </Frame>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/*  F3 — TIMELINE / time blocking (07:00 – 12:00)                   */
/* ──────────────────────────────────────────────────────────────── */

export function TimelinePreview() {
  const HOUR = 64; // px per hour
  const START = 7; // first visible hour
  const END = 12;
  const hours = Array.from({ length: END - START }, (_, i) => START + i); // 7…11
  const blocks = [
    { s: 420, e: 480, title: "روتین — ورزش صبح", time: "۰۷:۰۰ — ۰۸:۰۰", cls: "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300" },
    { s: 480, e: 540, title: "مطالعه فصل سوم زیست", time: "۰۸:۰۰ — ۰۹:۰۰", cls: "bg-violet-50 border-violet-200 text-violet-800 dark:bg-violet-500/10 dark:border-violet-500/30 dark:text-violet-300" },
    { s: 540, e: 630, title: "طراحی صفحه اصلی", time: "۰۹:۰۰ — ۱۰:۳۰ · ۹۰ دقیقه", cls: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-300" },
    { s: 630, e: 660, title: "جلسه بررسی اسپرینت", time: "۱۰:۳۰ — ۱۱:۰۰", cls: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300" },
    { s: 660, e: 720, title: "تحویل پروژه به مشتری", time: "۱۱:۰۰ — ۱۲:۰۰", cls: "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300" },
  ];
  return (
    <Frame url="taskflow.app/timeline">
      <div className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-extrabold">برنامه زمانی امروز</p>
          <span className="rounded-lg bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">
            ۵ بازه · ۵ ساعت و ۳۰ دقیقه
          </span>
        </div>
        <div className="relative" dir="rtl">
          {/* hour rows */}
          <div>
            {hours.map((h) => (
              <div key={h} className="flex items-start" style={{ height: HOUR }}>
                <span className="w-12 shrink-0 pt-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                  {toFa(`${String(h).padStart(2, "0")}`)}:۰۰
                </span>
                <span className="mt-1 h-px flex-1 bg-border/60" />
              </div>
            ))}
            <div className="flex items-start">
              <span className="w-12 shrink-0 text-[10px] font-bold tabular-nums text-muted-foreground">
                ۱۲:۰۰
              </span>
              <span className="h-px flex-1 bg-border/60" />
            </div>
          </div>
          {/* blocks */}
          <div className="absolute inset-y-0 end-0 start-12">
            {blocks.map((b) => {
              const top = ((b.s - START * 60) / 60) * HOUR;
              const height = ((b.e - b.s) / 60) * HOUR;
              return (
                <div
                  key={b.title}
                  className={`absolute overflow-hidden rounded-lg border p-1.5 ${b.cls}`}
                  style={{ top: top + 4, height: height - 8, insetInlineStart: 0, insetInlineEnd: "2%" }}
                >
                  <p className="truncate text-[11px] font-extrabold">{b.title}</p>
                  <p className="truncate text-[9px] tabular-nums opacity-80">{b.time}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Frame>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/*  F4 — ROUTINES / habits                                          */
/* ──────────────────────────────────────────────────────────────── */

export function RoutinesPreview() {
  const days = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
  const rows = [
    { n: "ورزش صبح", t: "۰۷:۰۰ — ۰۸:۰۰", on: [1, 1, 1, 0, 1, 1, 0], streak: 12 },
    { n: "مطالعه روزانه", t: "۰۸:۰۰ — ۰۹:۰۰", on: [1, 1, 1, 1, 1, 0, 0], streak: 9 },
    { n: "مرور برنامه فردا", t: "۲۲:۳۰", on: [1, 1, 0, 1, 1, 1, 1], streak: 6 },
    { n: "خواب تا ۲۳:۰۰", t: "هر شب", on: [1, 0, 1, 1, 1, 1, 1], streak: 4 },
  ];
  return (
    <Frame url="taskflow.app/routines">
      <div className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-extrabold">روتین‌های من</p>
          <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600 dark:bg-emerald-500/10">
            متصل به برنامه زمانی
          </span>
        </div>
        <div className="mb-3 grid grid-cols-7 gap-1.5 px-1">
          {days.map((d) => (
            <span key={d} className="text-center text-[9px] font-bold text-muted-foreground">
              {d}
            </span>
          ))}
        </div>
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.n}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border/60 p-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-extrabold">{r.n}</span>
                <span className="block text-[9px] text-muted-foreground">{r.t}</span>
              </span>
              <span className="flex gap-1.5" aria-label={`الگوی هفتگی ${r.n}`}>
                {r.on.map((v, i) => (
                  <span
                    key={i}
                    className={`size-3.5 rounded-full ${
                      v ? "bg-emerald-500" : "border border-border bg-muted"
                    }`}
                  />
                ))}
              </span>
              <span className="flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:bg-amber-500/10">
                <Flame className="size-3" />
                {toFa(r.streak)} روز
              </span>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/*  PRODUCT GRID — Tasks / Projects / Calendar / Progress           */
/* ──────────────────────────────────────────────────────────────── */

export function TasksPreview() {
  return (
    <Frame url="taskflow.app/tasks">
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-extrabold">کارهای من</p>
          <span className="flex gap-1">
            {["همه", "امروز", "عقب‌افتاده"].map((f, i) => (
              <span
                key={f}
                className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                  i === 0
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {f}
              </span>
            ))}
          </span>
        </div>
        <TaskRow title="ارسال گزارش هفتگی" meta="امروز · ۱۶:۰۰" dot="#4f46e5" badge="فوری" badgeTone="#ef4444" />
        <TaskRow title="آماده‌سازی اسلایدها" meta="فردا" dot="#4f46e5" badge="متوسط" badgeTone="#3b82f6" />
        <TaskRow title="حل تمرین ریاضی" meta="۲۰ مهر" dot="#f59e0b" badge="پایین" badgeTone="#10b981" />
        <TaskRow title="تمیزکاری ایمیل‌ها" meta="انجام‌شده" done dot="#64748b" badgeTone="#10b981" />
        <TaskRow title="خرید هفتگی" meta="انجام‌شده" done dot="#10b981" badgeTone="#10b981" />
      </div>
    </Frame>
  );
}

export function ProjectsPreview() {
  const projects = [
    { n: "بازطراحی وب‌سایت", p: 70, done: 8, all: 12, due: "۲۰ مهر", c: "#4f46e5" },
    { n: "پروژه دانشگاه", p: 45, done: 5, all: 11, due: "۲۸ مهر", c: "#f59e0b" },
    { n: "کتابخانه شخصی", p: 25, done: 2, all: 8, due: "آبان", c: "#10b981" },
  ];
  return (
    <Frame url="taskflow.app/projects">
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-extrabold">پروژه‌های فعال</p>
          <span className="text-[9px] font-bold text-muted-foreground">۳ پروژه</span>
        </div>
        <div className="space-y-2">
          {projects.map((pj) => (
            <div key={pj.n} className="rounded-xl border border-border/60 p-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ background: pj.c }} />
                  <span className="truncate text-[11px] font-extrabold">{pj.n}</span>
                </span>
                <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">
                  {toFa(pj.done)}/{toFa(pj.all)} کار
                </span>
              </div>
              <Bar pct={pj.p} />
              <div className="mt-1.5 flex items-center justify-between text-[9px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarClock className="size-3" />
                  موعد: {pj.due}
                </span>
                <span className="font-bold" style={{ color: pj.c }}>
                  {toFa(pj.p)}٪
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

export function CalendarPreview() {
  const dayNames = "ش ی د س چ پ ج".split(" ");
  const tasksOnDay: Record<number, number> = { 5: 1, 12: 1, 15: 2, 20: 1, 25: 1 };
  return (
    <Frame url="taskflow.app/calendar">
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-extrabold">مهر ۱۴۰۴</p>
          <span className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground">
            <CalendarDays className="size-3.5" />
            تقویم شمسی
          </span>
        </div>
        <div className="grid grid-cols-7 text-center">
          {dayNames.map((d) => (
            <div key={d} className="py-1 text-[9px] font-bold text-muted-foreground">
              {d}
            </div>
          ))}
          {Array.from({ length: 35 }, (_, i) => {
            const n = i - 2;
            if (n < 1 || n > 31)
              return <div key={i} className="min-h-[34px] border-b border-e border-border/40" />;
            const isToday = n === 15;
            const dots = tasksOnDay[n] ?? 0;
            return (
              <div
                key={i}
                className={`relative min-h-[34px] border-b border-e border-border/40 p-1 text-start ${
                  isToday ? "bg-accent" : ""
                }`}
              >
                <span
                  className={`inline-grid size-4 place-items-center rounded-full text-[9px] font-bold ${
                    isToday ? "bg-primary text-white" : ""
                  }`}
                >
                  {toFa(n)}
                </span>
                {dots > 0 && (
                  <span className="mt-0.5 flex gap-0.5" aria-hidden="true">
                    {Array.from({ length: dots }).map((_, j) => (
                      <span key={j} className="size-1 rounded-full bg-primary/70" />
                    ))}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Frame>
  );
}

export function ProgressPreview() {
  return (
    <Frame url="taskflow.app/progress">
      <div className="p-4">
        <div className="mb-3 flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="grid size-14 place-items-center rounded-2xl bg-primary text-lg font-black text-white">
              {toFa(7)}
            </div>
            <span className="absolute -bottom-1.5 start-1/2 -translate-x-1/2 rounded-full border border-primary/20 bg-white px-1.5 text-[8px] font-bold text-primary dark:bg-slate-900">
              سطح
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold">متمرکز</p>
            <p className="text-[10px] text-muted-foreground">۱۲۸۰ XP از ۱۵۰۰ XP</p>
            <div className="mt-1.5">
              <Bar pct={85} />
            </div>
            <p className="mt-1 text-[9px] text-muted-foreground">۲۲۰ XP تا سطح ۸</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-muted/60 p-2 text-center">
            <Flame className="mx-auto mb-1 size-4 text-amber-600" />
            <p className="text-xs font-extrabold tabular-nums">۱۲ روز</p>
            <p className="text-[9px] text-muted-foreground">استمرار</p>
          </div>
          <div className="rounded-lg bg-muted/60 p-2 text-center">
            <Target className="mx-auto mb-1 size-4 text-primary" />
            <p className="text-xs font-extrabold tabular-nums">۸۵</p>
            <p className="text-[9px] text-muted-foreground">امتیاز امروز</p>
          </div>
          <div className="rounded-lg bg-muted/60 p-2 text-center">
            <Trophy className="mx-auto mb-1 size-4 text-violet-600" />
            <p className="text-xs font-extrabold tabular-nums">۸</p>
            <p className="text-[9px] text-muted-foreground">دستاوردها</p>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/*  PLANNING CENTER                                                 */
/* ──────────────────────────────────────────────────────────────── */

export function PlanningPreview() {
  const buckets = [
    {
      label: "باید انجام شود",
      tone: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
      items: ["ارسال گزارش هفتگی", "بازبینی طرح قیمت"],
    },
    {
      label: "مهم",
      tone: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
      items: ["جلسه با تیم محتوا", "مطالعه فصل سوم"],
    },
    {
      label: "انعطاف‌پذیر",
      tone: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
      items: ["پاسخ به ایمیل‌ها", "خرید هفتگی"],
    },
    {
      label: "برای روزهای بعد",
      tone: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
      items: ["بازطراحی راهنما", "مرور آرشیو ایده‌ها"],
    },
  ];
  return (
    <Frame url="taskflow.app/planning">
      <div className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-extrabold">برنامه امروز</p>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            بار: متعادل
          </span>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat value="۷" label="کارهای امروز" />
          <Stat value="۲" label="عقب‌افتاده" tone="text-red-500" />
          <Stat value="۳" label="نزدیک موعد" tone="text-amber-600" />
          <Stat value="۱" label="مسدود" tone="text-slate-500" />
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {buckets.map((b) => (
            <div key={b.label} className="rounded-xl border border-border/60 p-2">
              <span
                className={`mb-1.5 inline-block rounded-md px-1.5 py-0.5 text-[9px] font-bold ${b.tone}`}
              >
                {b.label}
              </span>
              {b.items.map((it) => (
                <div
                  key={it}
                  className="mb-1 flex items-center gap-1.5 rounded-lg bg-muted/50 px-1.5 py-1.5 last:mb-0"
                >
                  <Circle className="size-2.5 shrink-0 text-muted-foreground/60" />
                  <span className="truncate text-[10px] font-semibold">{it}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[9px] text-muted-foreground">
          <span className="rounded-md border border-border/60 px-1.5 py-0.5">مهلت: ۲۰ مهر</span>
          <span className="rounded-md border border-border/60 px-1.5 py-0.5">ظرفیت امروز: ۵ ساعت و ۳۰ دقیقه</span>
          <span className="rounded-md border border-border/60 px-1.5 py-0.5">۲ اولویت بالا</span>
        </div>
      </div>
    </Frame>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/*  PRODUCTIVITY ANALYTICS                                          */
/* ──────────────────────────────────────────────────────────────── */

export function AnalyticsPreview() {
  return (
    <Frame url="taskflow.app/analytics">
      <div className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-extrabold">تحلیل بهره‌وری</p>
          <span className="text-[10px] font-bold text-muted-foreground">۴ هفته اخیر</span>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat value="۴۷" label="کار انجام‌شده" tone="text-emerald-600" />
          <Stat value="۱۲س" label="زمان تمرکز" tone="text-primary" />
          <Stat value="۱۲ روز" label="استمرار" tone="text-amber-600" />
          <Stat value="۷۸٪" label="دقت برنامه" tone="text-violet-600" />
        </div>
        <div className="relative h-28 rounded-lg bg-muted/40 p-3" dir="ltr">
          <svg viewBox="0 0 300 80" className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
            <path
              d="M0,60 C30,55 60,40 90,35 C120,30 150,45 180,25 C210,15 240,20 270,12 L300,10 L300,80 L0,80 Z"
              fill="var(--primary)"
              opacity="0.08"
            />
            <path
              d="M0,60 C30,55 60,40 90,35 C120,30 150,45 180,25 C210,15 240,20 270,12 L300,10"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-x-3 bottom-1 flex justify-between text-[8px] text-muted-foreground">
            <span>شنبه</span>
            <span>یکشنبه</span>
            <span>دوشنبه</span>
            <span>سه‌شنبه</span>
            <span>چهارشنبه</span>
            <span>پنجشنبه</span>
            <span>جمعه</span>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            { n: "هدف: رشد مهارتی", p: 70, c: "bg-primary" },
            { n: "پروژه: بازطراحی وب‌سایت", p: 55, c: "bg-emerald-500" },
          ].map((x) => (
            <div key={x.n} className="rounded-xl border border-border/60 p-2.5">
              <div className="mb-1.5 flex items-center justify-between text-[10px]">
                <span className="font-bold">{x.n}</span>
                <span className="tabular-nums text-muted-foreground">سالم</span>
              </div>
              <Bar pct={x.p} tone={x.c} />
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/*  PERSONA PREVIEWS — six distinct workspaces                      */
/* ──────────────────────────────────────────────────────────────── */

/** Small wrapper: persona preview body inside the card surface. */
function MiniSurface({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 rounded-xl bg-muted/50 p-3" dir="rtl">
      {children}
    </div>
  );
}

export function StudentPreview() {
  const subjects = [
    { n: "زیست شناسی", e: "آزمون ۲۰ مهر", p: 65 },
    { n: "ریاضی", e: "تکلیف ۱۸ مهر", p: 40 },
    { n: "ادبیات", e: "کنفرانس ۲۵ مهر", p: 85 },
  ];
  return (
    <MiniSurface>
      <p className="mb-2 text-[10px] font-extrabold text-muted-foreground">دروس و امتحانات</p>
      {subjects.map((s) => (
        <div key={s.n} className="mb-2 last:mb-0">
          <div className="mb-1 flex items-center justify-between text-[10px]">
            <span className="flex items-center gap-1.5 font-bold">
              <BookOpen className="size-3 text-primary" />
              {s.n}
            </span>
            <span className="text-muted-foreground">{s.e}</span>
          </div>
          <Bar pct={s.p} />
        </div>
      ))}
    </MiniSurface>
  );
}

export function EmployeePreview() {
  return (
    <MiniSurface>
      <p className="mb-2 text-[10px] font-extrabold text-muted-foreground">جلسات و کارهای امروز</p>
      {[
        { t: "۰۹:۳۰", n: "جلسه سریع تیم", tag: "۳۰ دقیقه" },
        { t: "۱۱:۰۰", n: "بازبینی گزارش فصلی", tag: "تمرکز" },
        { t: "۱۴:۰۰", n: "تماس با مشتری", tag: "۴۵ دقیقه" },
      ].map((m) => (
        <div key={m.n} className="mb-1.5 flex items-center gap-2 rounded-lg bg-card px-2 py-1.5 last:mb-0">
          <Clock className="size-3 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-[10px] font-bold">{m.n}</span>
          <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[8px] font-bold tabular-nums text-muted-foreground">
            {m.t} · {m.tag}
          </span>
        </div>
      ))}
    </MiniSurface>
  );
}

export function FreelancerPreview() {
  return (
    <MiniSurface>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-card p-2 text-center">
          <p className="text-xs font-extrabold tabular-nums">۴</p>
          <p className="text-[8px] text-muted-foreground">مشتری فعال</p>
        </div>
        <div className="rounded-lg bg-card p-2 text-center">
          <p className="text-xs font-extrabold tabular-nums text-emerald-600">۸۵٪</p>
          <p className="text-[8px] text-muted-foreground">تحویل به‌موقع</p>
        </div>
      </div>
      <p className="mb-1.5 text-[10px] font-extrabold text-muted-foreground">تحویل‌های این هفته</p>
      {[
        { n: "طراحی لوگو — استودیو آریا", d: "۱۸ مهر", p: 75 },
        { n: "صفحه فرود — فروشگاه نوا", d: "۲۱ مهر", p: 40 },
      ].map((d) => (
        <div key={d.n} className="mb-1.5 last:mb-0">
          <div className="mb-1 flex items-center justify-between text-[10px]">
            <span className="truncate font-bold">{d.n}</span>
            <span className="shrink-0 text-muted-foreground">{d.d}</span>
          </div>
          <Bar pct={d.p} tone="bg-violet-500" />
        </div>
      ))}
    </MiniSurface>
  );
}

export function ManagerPreview() {
  return (
    <MiniSurface>
      <p className="mb-2 text-[10px] font-extrabold text-muted-foreground">بار کاری تیم</p>
      {[
        { n: "مریم — طراحی", p: 80, c: "bg-amber-500" },
        { n: "رضا — توسعه", p: 55, c: "bg-primary" },
        { n: "سارا — محتوا", p: 35, c: "bg-emerald-500" },
      ].map((m) => (
        <div key={m.n} className="mb-2 last:mb-0">
          <div className="mb-1 flex items-center justify-between text-[10px]">
            <span className="flex items-center gap-1.5 font-bold">
              <Users className="size-3 text-muted-foreground" />
              {m.n}
            </span>
            <span className="tabular-nums text-muted-foreground">{toFa(m.p)}٪</span>
          </div>
          <Bar pct={m.p} tone={m.c} />
        </div>
      ))}
    </MiniSurface>
  );
}

export function BusinessPreview() {
  return (
    <MiniSurface>
      <div className="mb-2 grid grid-cols-3 gap-1.5">
        <div className="rounded-lg bg-card p-1.5 text-center">
          <p className="text-[11px] font-extrabold tabular-nums text-emerald-600">۱۲</p>
          <p className="text-[8px] text-muted-foreground">فروش امروز</p>
        </div>
        <div className="rounded-lg bg-card p-1.5 text-center">
          <p className="text-[11px] font-extrabold tabular-nums text-primary">۵</p>
          <p className="text-[8px] text-muted-foreground">مشتری جدید</p>
        </div>
        <div className="rounded-lg bg-card p-1.5 text-center">
          <p className="text-[11px] font-extrabold tabular-nums text-violet-600">۸٪</p>
          <p className="text-[8px] text-muted-foreground">رشد هفتگی</p>
        </div>
      </div>
      <p className="mb-1.5 text-[10px] font-extrabold text-muted-foreground">عملیات امروز</p>
      {[
        { n: "پیگیری سفارش‌های جدید", done: true },
        { n: "بررسی موجودی انبار", done: true },
        { n: "گزارش هفتگی درآمد", done: false },
      ].map((o) => (
        <div key={o.n} className="mb-1 flex items-center gap-1.5 rounded-lg bg-card px-2 py-1.5 last:mb-0">
          {o.done ? (
            <CheckCircle2 className="size-3 shrink-0 text-emerald-500" />
          ) : (
            <Circle className="size-3 shrink-0 text-muted-foreground/60" />
          )}
          <span
            className={`truncate text-[10px] font-bold ${
              o.done ? "text-muted-foreground line-through" : ""
            }`}
          >
            {o.n}
          </span>
        </div>
      ))}
    </MiniSurface>
  );
}

export function PersonalPreview() {
  return (
    <MiniSurface>
      <p className="mb-2 text-[10px] font-extrabold text-muted-foreground">عادت‌های این هفته</p>
      <div className="mb-2 grid grid-cols-7 gap-1">
        {Array.from({ length: 28 }).map((_, i) => (
          <span
            key={i}
            className={`aspect-square rounded-sm ${
              i % 7 !== 3 && i % 5 !== 0 ? "bg-primary/60" : "bg-muted"
            }`}
          />
        ))}
      </div>
      <p className="mb-1.5 text-[10px] font-extrabold text-muted-foreground">حوزه‌های زندگی</p>
      {[
        { n: "سلامت", p: 70, icon: Droplets },
        { n: "یادگیری", p: 55, icon: GraduationCap },
        { n: "مالی", p: 40, icon: Wallet },
      ].map((a) => (
        <div key={a.n} className="mb-1.5 flex items-center gap-2 last:mb-0">
          <a.icon className="size-3 shrink-0 text-muted-foreground" />
          <span className="w-12 shrink-0 text-[10px] font-bold">{a.n}</span>
          <span className="min-w-0 flex-1">
            <Bar pct={a.p} tone="bg-emerald-500" />
          </span>
          <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">{toFa(a.p)}٪</span>
        </div>
      ))}
    </MiniSurface>
  );
}
