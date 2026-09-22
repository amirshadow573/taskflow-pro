/**
 * Persona Stats (Phase 04) — the user-facing surface of the stat engine.
 *
 * Two components, one visual language:
 *  - PersonaStatsStrip: compact dashboard widget (simple surface → deeper
 *    information when requested).
 *  - PersonaStatsPanel: the full Stats area inside /progress?tab=stats —
 *    values, tiers, trends, growth and a per-stat history chart.
 *
 * All numbers come from the centralized Convex stat service; this file only
 * renders. Trends are communicated with symbol + text (never color alone)
 * and insufficient data renders as "—" instead of a fake value.
 */
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useState } from "react";
import { Link } from "react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlarmClock,
  ArrowLeft,
  BookOpen,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  Compass,
  FolderKanban,
  Flame,
  Minus,
  Settings,
  ShieldCheck,
  Target,
  Timer,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { toFa, formatJalaliShort } from "@/lib/persian";
import { personaMeta } from "@/lib/personas";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Bar, EmptyHint, Panel, Pill, TONES, type Tone } from "./progress-ui";
import { STATS_NO_DATA, TREND_META, type StatTrend } from "@/convex/statRules";

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  timer: Timer,
  flame: Flame,
  calendar: CalendarCheck,
  book: BookOpen,
  check: CheckCircle2,
  alarm: AlarmClock,
  briefcase: Briefcase,
  users: Users,
  folder: FolderKanban,
  compass: Compass,
  trending: TrendingUp,
  settings: Settings,
  shield: ShieldCheck,
  target: Target,
};

function StatIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = ICONS[name] ?? Target;
  return <Cmp className={className} />;
}

const TREND_TONE: Record<StatTrend, Tone> = { up: "emerald", flat: "slate", down: "amber" };

/** Symbol + text (accessible: not color-only). */
function TrendMark({ trend, className }: { trend: StatTrend | null; className?: string }) {
  if (!trend) return null;
  const meta = TREND_META[trend];
  const Icon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-extrabold",
        TONES[TREND_TONE[trend]].text,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {meta.label}
    </span>
  );
}

interface StatView {
  key: string;
  label: string;
  description?: string | null;
  icon: string;
  tone: string;
  hasData: boolean;
  value: number;
  previousValue?: number | null;
  trend: StatTrend | null;
  tier?: { key: string; label: string; min: number };
  reason?: string | null;
}

function toneOf(key: string): Tone {
  return (key && key in TONES ? key : "blue") as Tone;
}

/* ------------------------------------------------------------------ */
/* Compact dashboard strip (§22)                                       */
/* ------------------------------------------------------------------ */

export function PersonaStatsStrip() {
  const snap = useQuery(api.personaStats.snapshot);
  if (!snap) return null;
  const anyData = snap.stats.some((s) => s.hasData);
  const stats = snap.stats.slice(0, 5);

  return (
    <section className="ui-surface rounded-2xl p-4" aria-label="الگوی پیشرفت من">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <span className="ui-icon-tile size-6">
              <TrendingUp className="size-3.5 text-primary" aria-hidden />
            </span>
            الگوی پیشرفت من
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {personaMeta(snap.persona).label} — بر اساس کارهای واقعی اخیر
          </p>
        </div>
        <Link to="/progress?tab=stats">
          <Button size="sm" variant="outline" className="whitespace-nowrap">
            مشاهده پیشرفت
            <ArrowLeft className="size-3.5" aria-hidden />
          </Button>
        </Link>
      </header>

      {!anyData ? (
        <EmptyHint>{snap.emptyState}</EmptyHint>
      ) : (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s) => (
            <li
              key={s.key}
              className="rounded-xl border border-border/60 bg-white/60 p-2.5 dark:bg-white/5"
              aria-label={s.hasData ? `${s.label}: ${s.value} از ۱۰۰` : `${s.label}: ${STATS_NO_DATA}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                  <StatIcon name={s.icon} className="size-3.5 shrink-0" />
                  <span className="truncate">{s.label}</span>
                </span>
                <TrendMark trend={s.trend as StatTrend | null} />
              </div>
              {s.hasData ? (
                <>
                  <div className="mt-1.5 text-lg font-extrabold leading-none tabular-nums">
                    {toFa(s.value)}
                    <span className="text-[10px] font-bold text-muted-foreground"> / ۱۰۰</span>
                  </div>
                  <Bar pct={s.value} toneKey={toneOf(s.tone)} className="mt-1.5 h-1.5" />
                </>
              ) : (
                <>
                  <div className="mt-1.5 text-lg font-extrabold leading-none text-muted-foreground">
                    —
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{STATS_NO_DATA}</div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Full stats panel — Progress / Stats center (§23)                    */
/* ------------------------------------------------------------------ */

export function PersonaStatsPanel() {
  const [windowDays, setWindowDays] = useState<number>(30);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const data = useQuery(api.personaStats.overview, { windowDays });
  const effectiveKey = selectedKey ?? data?.stats[0]?.key ?? null;
  const history = useQuery(
    api.personaStats.history,
    effectiveKey ? { statKey: effectiveKey, days: Math.max(14, windowDays) } : "skip",
  );

  if (data === undefined) {
    return (
      <Panel title="آمار شخصی" icon={<TrendingUp className="size-4 text-primary" />}>
        <div className="space-y-3">
          <div className="skeleton h-20 rounded-2xl" />
          <div className="skeleton h-40 rounded-2xl" />
        </div>
      </Panel>
    );
  }

  if (data === null) {
    return (
      <Panel title="آمار شخصی" icon={<TrendingUp className="size-4 text-primary" />}>
        <EmptyHint>برای دیدن آمار، ابتدا وارد حساب کاربری شو.</EmptyHint>
      </Panel>
    );
  }

  const stats = data.stats as StatView[];
  const anyData = stats.some((s) => s.hasData);
  const improving = stats.filter((s) => s.trend === "up");
  const selected = stats.find((s) => s.key === effectiveKey) ?? stats[0];
  const chartRows = (history ?? []).map((r) => ({
    ...r,
    label: formatJalaliShort(new Date(r.day + "T00:00:00")),
  }));

  return (
    <div className="space-y-5">
      <Panel
        title="آمار شخصی"
        icon={<TrendingUp className="size-4 text-primary" />}
        description={`${personaMeta(data.persona).emoji} ${personaMeta(data.persona).label} — مقایسه ${toFa(data.windowDays)} روز اخیر با ${toFa(data.windowDays)} روز قبل‌تر`}
        action={
          <div className="flex gap-1" role="group" aria-label="بزه زمانی">
            {[7, 30].map((d) => (
              <button
                key={d}
                onClick={() => setWindowDays(d)}
                aria-pressed={windowDays === d}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors",
                  windowDays === d
                    ? "bg-gradient-to-l from-primary to-[#5B5FE6] text-white shadow-[0_6px_16px_-9px_rgba(37,99,235,0.9)]"
                    : "text-muted-foreground hover:bg-white/70 hover:text-foreground dark:hover:bg-white/5",
                )}
              >
                {toFa(d)} روز اخیر
              </button>
            ))}
          </div>
        }
      >
        {!anyData ? (
          <EmptyHint>{data.emptyState}</EmptyHint>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {stats.map((s) => {
              const t = TONES[toneOf(s.tone)];
              return (
                <li key={s.key}>
                  <button
                    onClick={() => setSelectedKey(s.key)}
                    aria-pressed={selected?.key === s.key}
                    aria-label={`${s.label} — ${
                      s.hasData
                        ? `${s.value} از ۱۰۰${s.trend ? `، ${TREND_META[s.trend].label}` : ""}`
                        : STATS_NO_DATA
                    }`}
                    className={cn(
                      "h-full w-full rounded-2xl border p-4 text-start transition-colors",
                      selected?.key === s.key
                        ? "border-primary/40 bg-primary/5"
                        : "border-border/60 bg-white/60 hover:border-primary/25 dark:bg-white/5",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={cn(
                            "grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-[0_6px_16px_-8px_rgba(37,99,235,0.9)]",
                            t.grad,
                          )}
                        >
                          <StatIcon name={s.icon} className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-extrabold">{s.label}</div>
                          <div className="truncate text-[10px] text-muted-foreground">
                            {s.description}
                          </div>
                        </div>
                      </div>
                      {s.hasData && s.tier && <Pill toneKey={toneOf(s.tone)}>{s.tier.label}</Pill>}
                    </div>

                    <div className="mt-3 flex items-end justify-between gap-2">
                      {s.hasData ? (
                        <span className="text-2xl font-black leading-none tabular-nums">
                          {toFa(s.value)}
                          <span className="text-[11px] font-bold text-muted-foreground"> / ۱۰۰</span>
                        </span>
                      ) : (
                        <span className="text-xl font-black leading-none text-muted-foreground">—</span>
                      )}
                      <TrendMark trend={s.trend} />
                    </div>

                    {s.hasData ? (
                      <Bar pct={s.value} toneKey={toneOf(s.tone)} className="mt-2.5 h-2" />
                    ) : (
                      <div className="mt-2.5 rounded-lg border border-dashed border-border/70 px-2 py-1.5 text-[10px] text-muted-foreground">
                        {STATS_NO_DATA}
                      </div>
                    )}

                    {s.hasData && s.reason && (
                      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{s.reason}</p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {anyData && (
        <Panel
          title="بهبودهای اخیر"
          icon={<TrendingUp className="size-4 text-emerald-600" />}
          description={`تغییرها نسبت به ${toFa(data.windowDays)} روز قبل‌تر — فقط بر اساس فعالیت واقعی.`}
        >
          {improving.length === 0 ? (
            <EmptyHint>در این بازه تغییر محسوسی ثبت نشده — ادامه بده.</EmptyHint>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {improving.map((s) => {
                const prev = s.previousValue ?? null;
                const delta = prev != null ? s.value - prev : null;
                return (
                  <li
                    key={s.key}
                    className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50/60 px-3 py-2.5 dark:border-emerald-500/20 dark:bg-emerald-500/5"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-[13px] font-bold">
                      <StatIcon name={s.icon} className="size-4 shrink-0 text-emerald-600" />
                      <span className="truncate">{s.label}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {delta != null && delta > 0 && (
                        <span className="text-[12px] font-black tabular-nums text-emerald-700 dark:text-emerald-300">
                          +{toFa(delta)}
                        </span>
                      )}
                      <span className="text-sm font-black tabular-nums">{toFa(s.value)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}

      {anyData && selected && (
        <Panel
          title={`روند «${selected.label}»`}
          icon={<StatIcon name={selected.icon} className="size-4 text-primary" />}
          description={`${toFa(Math.max(14, data.windowDays))} روز اخیر — هر نقطه، ارزش محاسبه‌شده همان روز است.`}
        >
          {history === undefined ? (
            <div className="skeleton h-44 rounded-2xl" />
          ) : chartRows.length < 2 ? (
            <EmptyHint>هنوز داده کافی برای نمودار وجود ندارد — چند روز فعالیت کن تا روند شکل بگیرد.</EmptyHint>
          ) : (
            <div className="h-48" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartRows} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="statFill" x1="0" y1="0" x2="0" y2="1">
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
                    interval={Math.max(0, Math.floor(chartRows.length / 6))}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "var(--foreground)", fontWeight: 700 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    name={selected.label}
                    stroke="var(--primary)"
                    strokeWidth={2.4}
                    fill="url(#statFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
