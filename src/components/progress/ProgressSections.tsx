import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  Award,
  CalendarCheck,
  CheckCircle2,
  Crown,
  Flame,
  Gift,
  Lock,
  Medal,
  Repeat,
  Route,
  Sparkles,
  Target,
  Timer,
  Trophy,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toFa, WEEKDAYS_SHORT, persianWeekday } from "@/lib/persian";
import { XP_FILTERS, XP_KIND_LABELS, type XpKind } from "@/convex/progression";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AchievementIcon,
  ActivityHeatmap,
  Bar as MiniBar,
  EmptyHint,
  Panel,
  Pill,
  ScoreRing,
  StatTile,
  TONES,
  XP_KIND_TONE,
  type Tone,
} from "./progress-ui";

const fmtNum = (n: number) => toFa(n.toLocaleString("en-US"));

/* ------------------------------------------------------------------ */
/* XP history                                                          */
/* ------------------------------------------------------------------ */

export interface XpEventRow {
  id: string;
  amount: number;
  kind: string;
  label: string;
  day: string;
  createdAt: number;
}

export function XpHistoryPanel({
  events,
  limit,
  compact,
}: {
  events: XpEventRow[];
  limit?: number;
  compact?: boolean;
}) {
  const [filter, setFilter] = useState("all");
  const rows = useMemo(() => {
    const group = XP_FILTERS.find((f) => f.key === filter);
    const kinds = (group?.kinds ?? []) as XpKind[];
    const filtered =
      filter === "all" ? events : events.filter((e) => kinds.includes(e.kind as XpKind));
    return limit ? filtered.slice(0, limit) : filtered;
  }, [events, filter, limit]);

  return (
    <Panel
      title="تاریخچه XP"
      icon={<Sparkles className="size-4 text-primary" />}
      description="هر امتیاز از یک فعالیت واقعی آمده است."
      action={
        !compact ? (
          <div className="flex flex-wrap gap-1">
            {XP_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-lg px-2 py-1 text-[11px] font-bold transition-colors",
                  filter === f.key
                    ? "bg-gradient-to-l from-primary to-[#5B5FE6] text-white shadow-[0_6px_16px_-9px_rgba(37,99,235,0.9)]"
                    : "text-muted-foreground hover:bg-white/70 hover:text-foreground dark:hover:bg-white/5",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <EmptyHint>هنوز XP ثبت نشده. اولین کارت را انجام بده تا شروع شود.</EmptyHint>
      ) : (
        <ul className="divide-y divide-border/50">
          {rows.map((e) => {
            const t = TONES[(XP_KIND_TONE[e.kind] ?? "blue") as Tone];
            return (
              <li key={e.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-[10px] font-black text-white",
                    t.grad,
                  )}
                >
                  +{toFa(e.amount)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold">{e.label}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {XP_KIND_LABELS[e.kind] ?? "پاداش"} ·{" "}
                    {toFa(new Date(e.createdAt).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }))}
                  </div>
                </div>
                <span className="shrink-0 text-[11px] font-bold tabular-nums text-emerald-600 dark:text-emerald-300">
                  +{toFa(e.amount)} XP
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Achievements                                                        */
/* ------------------------------------------------------------------ */

export interface AchievementRow {
  key: string;
  title: string;
  description: string;
  icon: string;
  tone: string;
  unlocked: boolean;
  unlockedAt: number | null;
  group: string;
}

export function AchievementsPanel({ items }: { items: AchievementRow[] }) {
  const [only, setOnly] = useState<"all" | "unlocked" | "locked">("all");
  const rows = items.filter((a) =>
    only === "all" ? true : only === "unlocked" ? a.unlocked : !a.unlocked,
  );
  const unlocked = items.filter((a) => a.unlocked).length;

  return (
    <Panel
      title="دستاوردها"
      icon={<Medal className="size-4 text-primary" />}
      description={`${toFa(unlocked)} از ${toFa(items.length)} دستاورد باز شده.`}
      action={
        <div className="flex gap-1">
          {([
            ["all", "همه"],
            ["unlocked", "باز شده"],
            ["locked", "قفل"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setOnly(key)}
              className={cn(
                "rounded-lg px-2 py-1 text-[11px] font-bold transition-colors",
                only === key
                  ? "bg-gradient-to-l from-primary to-[#5B5FE6] text-white"
                  : "text-muted-foreground hover:bg-white/70 hover:text-foreground dark:hover:bg-white/5",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      {rows.length === 0 ? (
        <EmptyHint>در این بخش دستاوردی وجود ندارد.</EmptyHint>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((a) => {
            const t = TONES[(a.tone in TONES ? a.tone : "blue") as Tone];
            return (
              <li
                key={a.key}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border p-3 transition-colors",
                  a.unlocked
                    ? "border-border/60 bg-white/60 dark:bg-white/5"
                    : "border-dashed border-border/70 bg-muted/25 dark:bg-white/[0.02]",
                )}
              >
                <span
                  className={cn(
                    "relative grid size-11 shrink-0 place-items-center rounded-2xl text-white",
                    a.unlocked ? `bg-gradient-to-br ${t.grad}` : "bg-muted dark:bg-white/10",
                  )}
                >
                  {a.unlocked ? (
                    <AchievementIcon name={a.icon} className="size-5" />
                  ) : (
                    <Lock className="size-4 text-muted-foreground" />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "truncate text-[13px] font-bold",
                        !a.unlocked && "text-muted-foreground",
                      )}
                    >
                      {a.title}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                    {a.description}
                  </p>
                  {a.unlocked && a.unlockedAt && (
                    <Pill toneKey="emerald" className="mt-1.5">
                      <CheckCircle2 className="size-3" />
                      {toFa(new Date(a.unlockedAt).toLocaleDateString("fa-IR"))}
                    </Pill>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Growth paths                                                        */
/* ------------------------------------------------------------------ */

export interface PathRow {
  key: string;
  title: string;
  emoji: string;
  category: string;
  difficulty: string;
  summary: string;
  goal: string;
  totalDays: number;
  stageCount: number;
  missionCount: number;
  totalXp: number;
  completionXp: number;
  status: string;
  stageIndex: number;
  progressPct: number;
  xpEarned: number;
}

const DIFFICULTY_TONE: Record<string, Tone> = {
  آسان: "emerald",
  متوسط: "amber",
  سخت: "rose",
};

export function PathsPanel({ paths }: { paths: PathRow[] }) {
  const [category, setCategory] = useState("همه");
  const [difficulty, setDifficulty] = useState("همه");
  const [duration, setDuration] = useState("همه");
  const join = useMutation(api.gamification.joinPath);

  const categories = useMemo(
    () => ["همه", ...Array.from(new Set(paths.map((p) => p.category)))],
    [paths],
  );
  const active = paths.filter((p) => p.status === "active");
  const completed = paths.filter((p) => p.status === "completed");

  const rows = paths.filter((p) => {
    if (category !== "همه" && p.category !== category) return false;
    if (difficulty !== "همه" && p.difficulty !== difficulty) return false;
    if (duration === "کمتر از ۷ روز" && p.totalDays >= 7) return false;
    if (duration === "۷ تا ۱۴ روز" && (p.totalDays < 7 || p.totalDays > 14)) return false;
    if (duration === "۱۵ تا ۳۰ روز" && (p.totalDays < 15 || p.totalDays > 30)) return false;
    if (duration === "بیشتر از ۳۰ روز" && p.totalDays <= 30) return false;
    return true;
  });

  const onJoin = async (key: string, title: string) => {
    try {
      await join({ pathKey: key });
      toast.success(`مسیر «${title}» شروع شد`);
    } catch {
      toast.error("شروع مسیر انجام نشد. دوباره تلاش کن.");
    }
  };

  return (
    <div className="space-y-5">
      {active.length > 0 && (
        <Panel
          title="مسیرهای فعال"
          icon={<Route className="size-4 text-primary" />}
          description="مسیرهایی که همین حالا در حال طی کردنشان هستی."
        >
          <ul className="space-y-3">
            {active.map((p) => (
              <li key={p.key} className="rounded-2xl border border-border/60 bg-white/60 p-4 dark:bg-white/5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-lg">
                      {p.emoji}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold">{p.title}</div>
                      <div className="text-[11px] text-muted-foreground">
                        مرحله {toFa(p.stageIndex + 1)} از {toFa(p.stageCount)}
                      </div>
                    </div>
                  </div>
                  <Link to={`/progress/paths/${p.key}`}>
                    <Button size="sm" variant="outline">
                      ادامه مسیر
                      <ArrowLeft className="size-3.5" />
                    </Button>
                  </Link>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <MiniBar pct={p.progressPct} toneKey="blue" className="flex-1" />
                  <span className="shrink-0 text-[11px] font-bold tabular-nums text-muted-foreground">
                    {toFa(p.progressPct)}٪
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="tabular-nums">
                    {fmtNum(p.xpEarned)} / {fmtNum(p.totalXp)} XP
                  </span>
                  <span>{toFa(p.totalDays)} روز · {toFa(p.missionCount)} ماموریت</span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {completed.length > 0 && (
        <Panel
          title="مسیرهای تکمیل‌شده"
          icon={<Trophy className="size-4 text-amber-500" />}
          description="مسیرهایی که تا خط پایان رفتی."
        >
          <ul className="space-y-2">
            {completed.map((p) => (
              <li
                key={p.key}
                className="flex items-center gap-3 rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/5"
              >
                <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white">
                  <CheckCircle2 className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold">{p.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {toFa(p.stageCount)} مرحله · {fmtNum(p.xpEarned)} XP
                  </div>
                </div>
                <Pill toneKey="emerald">تکمیل شد</Pill>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        title="مسیرهای رشد"
        icon={<Target className="size-4 text-primary" />}
        description="مسیرها را انتخاب کن، مرحله به مرحله جلو برو و XP بگیر."
      >
        <div className="mb-4 space-y-2">
          <FilterRow
            label="دسته"
            value={category}
            options={categories}
            onChange={setCategory}
          />
          <FilterRow
            label="سختی"
            value={difficulty}
            options={["همه", "آسان", "متوسط", "سخت"]}
            onChange={setDifficulty}
          />
          <FilterRow
            label="مدت"
            value={duration}
            options={["همه", "کمتر از ۷ روز", "۷ تا ۱۴ روز", "۱۵ تا ۳۰ روز", "بیشتر از ۳۰ روز"]}
            onChange={setDuration}
          />
        </div>

        {rows.length === 0 ? (
          <EmptyHint>با این فیلترها مسیری پیدا نشد.</EmptyHint>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((p) => {
              const toneKey = DIFFICULTY_TONE[p.difficulty] ?? "blue";
              return (
                <li
                  key={p.key}
                  className="ui-surface ui-surface-hover flex flex-col gap-3 rounded-2xl p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-xl">
                      {p.emoji}
                    </span>
                    <Pill toneKey={toneKey}>{p.difficulty}</Pill>
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold leading-6">{p.title}</h3>
                    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{p.summary}</p>
                  </div>
                  <ul className="grid grid-cols-3 gap-2 text-center">
                    <MiniStat label="مرحله" value={toFa(p.stageCount)} />
                    <MiniStat label="روز" value={toFa(p.totalDays)} />
                    <MiniStat label="XP" value={fmtNum(p.totalXp)} />
                  </ul>
                  <div className="mt-auto flex items-center gap-2">
                    <Link to={`/progress/paths/${p.key}`} className="flex-1">
                      <Button size="sm" variant="outline" className="w-full">
                        جزئیات مسیر
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => onJoin(p.key, p.title)}
                      disabled={p.status === "active"}
                    >
                      {p.status === "active" ? "فعال" : "شروع مسیر"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function FilterRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
      <span className="shrink-0 text-[10px] font-bold text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={cn(
              "shrink-0 rounded-lg border px-2 py-0.5 text-[11px] font-semibold transition-colors",
              value === o
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border/60 text-muted-foreground hover:bg-white/70 hover:text-foreground dark:hover:bg-white/5",
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <li className="rounded-xl border border-border/60 bg-white/50 py-1.5 dark:bg-white/5">
      <div className="text-sm font-extrabold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

export function StatsPanel() {
  const stats = useQuery(api.gamification.overviewStats);
  const heatmap = useQuery(api.gamification.activityHeatmap, { days: 119 });

  if (!stats) {
    return (
      <Panel title="آمار شخصی" icon={<TrendingUp className="size-4 text-primary" />}>
        <div className="space-y-3">
          <div className="skeleton h-24 rounded-2xl" />
          <div className="skeleton h-40 rounded-2xl" />
        </div>
      </Panel>
    );
  }

  const trend = stats.xpTrend.map((row) => {
    const d = new Date(row.day + "T00:00:00");
    return {
      ...row,
      label: `${WEEKDAYS_SHORT[persianWeekday(d)]} ${toFa(d.getDate())}`,
    };
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={<Sparkles className="size-4" />}
          toneKey="violet"
          label="XP کل"
          value={fmtNum(stats.totalXp)}
          hint={`سطح ${toFa(stats.level)} · ${stats.levelTitle}`}
        />
        <StatTile
          icon={<CheckCircle2 className="size-4" />}
          toneKey="emerald"
          label="کارهای کامل‌شده"
          value={fmtNum(stats.tasksCompleted)}
          hint={`${toFa(stats.completionRate)}٪ نرخ تکمیل`}
        />
        <StatTile
          icon={<Flame className="size-4" />}
          toneKey="amber"
          label="زنجیره فعلی"
          value={`${toFa(stats.currentStreak)} روز`}
          hint={`رکورد ${toFa(stats.longestStreak)} روز`}
        />
        <StatTile
          icon={<CalendarCheck className="size-4" />}
          toneKey="cyan"
          label="روزهای فعال"
          value={toFa(stats.activeDays)}
          hint={`${toFa(stats.perfectDays)} روز بی‌نقص`}
        />
      </div>

      <Panel
        title="روند XP"
        icon={<TrendingUp className="size-4 text-primary" />}
        description="۳۰ روز گذشته — فقط XP کسب‌شده از فعالیت واقعی."
      >
        <div className="h-56" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="xpFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                interval={4}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="xp"
                name="XP"
                stroke="var(--primary)"
                strokeWidth={2.4}
                fill="url(#xpFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="کارهای تکمیل‌شده در ۳۰ روز"
          icon={<CheckCircle2 className="size-4 text-emerald-600" />}
        >
          <div className="h-44" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  interval={6}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="tasks" name="کار" fill="var(--chart-2)" radius={[5, 5, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="کیفیت روزها" icon={<Target className="size-4 text-primary" />}>
          <div className="flex flex-wrap items-center justify-around gap-4">
            <ScoreRing value={stats.completionRate} size={104} label="نرخ تکمیل" toneKey="blue" />
            <ScoreRing value={stats.avgScore} size={104} label="میانگین امتیاز" toneKey="violet" />
            <ScoreRing
              value={
                stats.activeDays > 0
                  ? Math.min(100, Math.round((stats.perfectDays / stats.activeDays) * 100))
                  : 0
              }
              size={104}
              label="روزهای بی‌نقص"
              toneKey="emerald"
            />
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
            <li className="rounded-xl border border-border/60 p-2 text-center dark:border-white/10">
              <div className="text-lg font-extrabold tabular-nums">{toFa(stats.missionsDone)}</div>
              <div className="text-muted-foreground">ماموریت</div>
            </li>
            <li className="rounded-xl border border-border/60 p-2 text-center dark:border-white/10">
              <div className="text-lg font-extrabold tabular-nums">{toFa(stats.challengesDone)}</div>
              <div className="text-muted-foreground">چالش</div>
            </li>
            <li className="rounded-xl border border-border/60 p-2 text-center dark:border-white/10">
              <div className="text-lg font-extrabold tabular-nums">{toFa(stats.pathsCompleted)}</div>
              <div className="text-muted-foreground">مسیر کامل</div>
            </li>
            <li className="rounded-xl border border-border/60 p-2 text-center dark:border-white/10">
              <div className="text-lg font-extrabold tabular-nums">{toFa(stats.routineDone)}</div>
              <div className="text-muted-foreground">آیتم روتین</div>
            </li>
          </ul>
        </Panel>
      </div>

      <Panel
        title="تقویم فعالیت"
        icon={<CalendarCheck className="size-4 text-emerald-600" />}
        description="۱۷ هفته گذشته — رنگ پررنگ‌تر یعنی روز پربارتر."
      >
        <ActivityHeatmap rows={heatmap ?? []} />
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Leaderboard                                                         */
/* ------------------------------------------------------------------ */

export function LeaderboardPanel() {
  const [range, setRange] = useState("week");
  const board = useQuery(api.gamification.leaderboard, { range });

  if (!board) {
    return (
      <Panel title="رده‌بندی" icon={<Users className="size-4 text-primary" />}>
        <div className="skeleton h-40 rounded-2xl" />
      </Panel>
    );
  }

  const ranges = [
    ["week", "این هفته"],
    ["month", "این ماه"],
    ["all", "همیشه"],
  ] as const;

  return (
    <div className="space-y-5">
      <Panel
        title="رده‌بندی"
        icon={<Users className="size-4 text-primary" />}
        description="بر اساس XP واقعی کاربران این پلتفرم."
        action={
          <div className="flex gap-1">
            {ranges.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setRange(key)}
                className={cn(
                  "rounded-lg px-2 py-1 text-[11px] font-bold transition-colors",
                  range === key
                    ? "bg-gradient-to-l from-primary to-[#5B5FE6] text-white"
                    : "text-muted-foreground hover:bg-white/70 hover:text-foreground dark:hover:bg-white/5",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        {board.rows.length <= 1 ? (
          <EmptyHint>
            تا حالا فقط {toFa(board.rows.length)} کاربر XP گرفته. رده‌بندی وقتی پر می‌شود که
            کاربرهای بیشتری فعال شوند — پیشرفت شخصی مهم‌تر از رقابت است.
          </EmptyHint>
        ) : (
          <ul className="space-y-2">
            {board.rows.map((row) => (
              <li
                key={row.userId}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-2.5",
                  board.me?.userId === row.userId
                    ? "border-primary/30 bg-primary/8"
                    : "border-border/60 bg-white/50 dark:bg-white/5",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-lg text-[11px] font-black tabular-nums",
                    row.rank === 1
                      ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white"
                      : row.rank <= 3
                        ? "bg-gradient-to-br from-slate-300 to-slate-500 text-white"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {row.rank === 1 ? <Crown className="size-3.5" /> : toFa(row.rank)}
                </span>
                <Avatar className="size-8 shrink-0">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-[#5B5FE6] text-[11px] font-bold text-white">
                    {(row.name || "ک").slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold">{row.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    سطح {toFa(row.level)} · {row.levelTitle}
                  </div>
                </div>
                <div className="shrink-0 text-end">
                  <div className="text-sm font-extrabold tabular-nums">{fmtNum(row.xp)}</div>
                  <div className="text-[10px] text-muted-foreground">XP</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {board.me && (
        <Panel title="جایگاه تو" icon={<Trophy className="size-4 text-amber-500" />}>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="ui-surface rounded-2xl p-4 text-center">
              <div className="text-2xl font-black tabular-nums">#{toFa(board.me.rank)}</div>
              <div className="text-[11px] text-muted-foreground">
                از {toFa(board.participants)} کاربر
              </div>
            </div>
            <div className="ui-surface rounded-2xl p-4 text-center">
              <div className="text-2xl font-black tabular-nums">{fmtNum(board.me.xp)}</div>
              <div className="text-[11px] text-muted-foreground">XP در این بازه</div>
            </div>
            <div className="ui-surface rounded-2xl p-4 text-center">
              <div className="text-2xl font-black tabular-nums">
                {board.gapToNext > 0 ? fmtNum(board.gapToNext) : "—"}
              </div>
              <div className="text-[11px] text-muted-foreground">XP تا جایگاه بالاتر</div>
            </div>
          </div>
          {board.weekDeltaPct !== null && (
            <p className="mt-3 flex items-center gap-1.5 rounded-xl border border-border/60 bg-white/50 p-3 text-[11px] text-muted-foreground dark:bg-white/5">
              <TrendingUp className="size-3.5 text-primary" />
              این هفته {toFa(Math.abs(board.weekDeltaPct))}٪{" "}
              {board.weekDeltaPct >= 0 ? "بیشتر" : "کمتر"} از هفته گذشته XP گرفتی.
            </p>
          )}
        </Panel>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rewards                                                             */
/* ------------------------------------------------------------------ */

export function RewardsPanel() {
  const rewards = useQuery(api.gamification.rewardsList);
  const rows = rewards ?? [];

  return (
    <div className="space-y-5">
      <Panel
        title="پاداش‌ها و بازکردنی‌ها"
        icon={<Gift className="size-4 text-primary" />}
        description="همه پاداش‌ها فقط تزئینی‌اند؛ با رسیدن به سطح‌ها باز می‌شوند."
      >
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <li
              key={r.key}
              className={cn(
                "flex items-start gap-3 rounded-2xl border p-3",
                r.current
                  ? "border-border/60 bg-white/60 dark:bg-white/5"
                  : "border-dashed border-border/70 bg-muted/25 dark:bg-white/[0.02]",
              )}
            >
              <span
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br",
                  r.current ? r.preview : "from-slate-200 to-slate-400 dark:from-white/10 dark:to-white/5",
                )}
              >
                {r.current ? (
                  <Sparkles className="size-5 text-white" />
                ) : (
                  <Lock className="size-4 text-muted-foreground" />
                )}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-bold">{r.title}</div>
                <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                  {r.description}
                </p>
                <Badge variant={r.current ? "success" : "outline"} className="mt-1.5">
                  {r.current ? "باز شد" : `سطح ${toFa(r.level)}`}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="قواعد XP"
        icon={<Award className="size-4 text-primary" />}
        description="شفاف و بدون ابهام — امتیاز فقط برای کار واقعی."
      >
        <ul className="grid gap-2 text-[11px] sm:grid-cols-2 xl:grid-cols-3">
          {[
            { icon: CheckCircle2, label: "کار معمولی", value: "+۵ تا +۲۲ XP بر اساس اولویت" },
            { icon: Repeat, label: "آیتم روتین", value: "+۱۰ XP برای هر آیتم" },
            { icon: Target, label: "ماموریت روزانه", value: "+۲۰ تا +۴۰ XP" },
            { icon: Target, label: "ماموریت هفتگی", value: "+۱۵۰ XP" },
            { icon: Trophy, label: "چالش", value: "+۲۰۰ تا +۱۰۰۰ XP" },
            { icon: Route, label: "مرحله مسیر", value: "+۱۰۰ تا +۱۸۰ XP + پاداش مرحله" },
            { icon: Flame, label: "نقاط عطف زنجیره", value: "+۱۰۰ تا +۱۰۰۰ XP" },
            { icon: Timer, label: "روز کامل (همه کارها)", value: "+۳۰ XP" },
            { icon: Sparkles, label: "روتین کامل روز", value: "+۲۰ XP" },
          ].map((r) => (
            <li
              key={r.label}
              className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-white/50 p-2.5 dark:bg-white/5"
            >
              <span className="ui-icon-tile size-8">
                <r.icon className="size-4 text-primary" />
              </span>
              <div className="min-w-0">
                <div className="font-bold">{r.label}</div>
                <div className="text-muted-foreground">{r.value}</div>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 rounded-xl border border-border/60 bg-muted/40 p-3 text-[11px] leading-5 text-muted-foreground">
          برای جلوگیری از سوءاستفاده، حداکثر ۱۲ کار در هر روز برای XP شمرده می‌شود، آیتم‌های
          تکراری و کارهای تکراری دوباره امتیاز نمی‌گیرند و هر امتیاز فقط یک بار ثبت می‌شود.
        </p>
      </Panel>
    </div>
  );
}
