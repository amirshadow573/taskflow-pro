/**
 * Presentational building blocks for the level-up / progress system.
 * Kept in one module so every surface (dashboard, My Progress, growth paths)
 * shares the same visual language.
 */
import { cn } from "@/lib/utils";
import { toFa } from "@/lib/persian";
import { formatJalaliShort } from "@/lib/persian";
import {
  Award,
  BookOpenCheck,
  Calendar,
  Check,
  Crosshair,
  Crown,
  Flag,
  Flame,
  Gem,
  Layers,
  List,
  Map,
  Medal,
  Repeat,
  Rocket,
  Route,
  Shield,
  Sparkles,
  Star,
  Swords,
  Target,
  Trophy,
  Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Tones                                                               */
/* ------------------------------------------------------------------ */

export type Tone = "blue" | "violet" | "emerald" | "amber" | "rose" | "cyan" | "slate";

/** Hex values are used by the SVG rings (CSS classes cannot colour a gradient stop). */
export const TONE_HEX: Record<Tone, string> = {
  blue: "#3b82f6",
  violet: "#8b5cf6",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  cyan: "#06b6d4",
  slate: "#94a3b8",
};

export const TONES: Record<Tone, { text: string; grad: string; soft: string }> = {
  blue: {
    text: "text-blue-600 dark:text-blue-300",
    grad: "from-sky-400 to-blue-600",
    soft: "bg-blue-50/80 border-blue-200/70 dark:bg-blue-500/10 dark:border-blue-400/20",
  },
  violet: {
    text: "text-violet-600 dark:text-violet-300",
    grad: "from-violet-400 to-purple-600",
    soft: "bg-violet-50/80 border-violet-200/70 dark:bg-violet-500/10 dark:border-violet-400/20",
  },
  emerald: {
    text: "text-emerald-600 dark:text-emerald-300",
    grad: "from-emerald-400 to-teal-600",
    soft: "bg-emerald-50/80 border-emerald-200/70 dark:bg-emerald-500/10 dark:border-emerald-400/20",
  },
  amber: {
    text: "text-amber-600 dark:text-amber-300",
    grad: "from-amber-400 to-orange-500",
    soft: "bg-amber-50/80 border-amber-200/70 dark:bg-amber-500/10 dark:border-amber-400/20",
  },
  rose: {
    text: "text-rose-600 dark:text-rose-300",
    grad: "from-rose-400 to-pink-600",
    soft: "bg-rose-50/80 border-rose-200/70 dark:bg-rose-500/10 dark:border-rose-400/20",
  },
  cyan: {
    text: "text-cyan-600 dark:text-cyan-300",
    grad: "from-cyan-400 to-sky-600",
    soft: "bg-cyan-50/80 border-cyan-200/70 dark:bg-cyan-500/10 dark:border-cyan-400/20",
  },
  slate: {
    text: "text-muted-foreground",
    grad: "from-slate-300 to-slate-500",
    soft: "bg-muted/60 border-border/60",
  },
};

export function tone(key: string | undefined): Tone {
  return (key && key in TONES ? (key as Tone) : "blue");
}

/* ------------------------------------------------------------------ */
/* Achievement icons                                                   */
/* ------------------------------------------------------------------ */

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  rocket: Rocket,
  check: Check,
  zap: Zap,
  crown: Crown,
  flame: Flame,
  medal: Medal,
  trophy: Trophy,
  repeat: Repeat,
  list: List,
  star: Star,
  sparkles: Sparkles,
  target: Target,
  crosshair: Crosshair,
  swords: Swords,
  shield: Shield,
  route: Route,
  map: Map,
  flag: Flag,
  layers: Layers,
  calendar: Calendar,
  gem: Gem,
  book: BookOpenCheck,
  award: Award,
};

export function AchievementIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Cmp = ICONS[name] ?? Award;
  return <Cmp className={className} />;
}

/* ------------------------------------------------------------------ */
/* Score ring                                                          */
/* ------------------------------------------------------------------ */

export function ScoreRing({
  value,
  size = 96,
  strokeWidth = 8,
  label,
  sub,
  toneKey = "blue",
  className,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sub?: string;
  toneKey?: Tone;
  className?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const key = tone(toneKey);
  const gradId = `progress-ring-${key}`;
  return (
    <div className={cn("relative grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90" width={size} height={size}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={TONE_HEX[key]} />
            <stop offset="100%" stopColor="#5B5FE6" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset .7s cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-lg font-extrabold tabular-nums leading-none">
            {toFa(Math.round(pct))}٪
          </div>
          {label && <div className="mt-0.5 text-[10px] font-semibold text-muted-foreground">{label}</div>}
          {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Layout helpers                                                      */
/* ------------------------------------------------------------------ */

export function Panel({
  title,
  icon,
  action,
  children,
  className,
  description,
}: {
  title?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  description?: string;
}) {
  return (
    <section className={cn("ui-surface rounded-2xl", className)}>
      {title && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              {icon}
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
            )}
          </div>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function StatTile({
  icon,
  label,
  value,
  hint,
  toneKey = "blue",
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  toneKey?: Tone;
  className?: string;
}) {
  const t = TONES[tone(toneKey)];
  return (
    <div className={cn("ui-surface ui-surface-hover rounded-2xl p-3.5", className)}>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-[0_6px_16px_-8px_rgba(37,99,235,0.9)]",
            t.grad,
          )}
        >
          {icon}
        </span>
        <span className="truncate text-[11px] font-semibold text-muted-foreground">{label}</span>
      </div>
      <div className="mt-2.5 text-2xl font-extrabold tabular-nums leading-none">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Bar({
  pct,
  toneKey = "blue",
  className,
}: {
  pct: number;
  toneKey?: Tone;
  className?: string;
}) {
  const t = TONES[tone(toneKey)];
  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-primary/10 shadow-[inset_0_1px_2px_rgba(30,64,175,0.08)] dark:bg-white/10",
        className,
      )}
    >
      <div
        className={cn("h-full rounded-full bg-gradient-to-l transition-all duration-700", t.grad)}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

export function Pill({
  children,
  toneKey = "slate",
  className,
}: {
  children: React.ReactNode;
  toneKey?: Tone;
  className?: string;
}) {
  const t = TONES[tone(toneKey)];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold",
        t.soft,
        t.text,
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Activity heatmap                                                    */
/* ------------------------------------------------------------------ */

export function ActivityHeatmap({
  rows,
}: {
  rows: Array<{ day: string; score: number; tasks: number; routine: number; xp: number }>;
}) {
  const cellTone = (score: number) => {
    if (score >= 100) return "bg-emerald-500";
    if (score >= 75) return "bg-emerald-400/90";
    if (score >= 50) return "bg-emerald-400/60";
    if (score >= 25) return "bg-emerald-400/35";
    if (score > 0) return "bg-emerald-400/20";
    return "bg-muted/70 dark:bg-white/5";
  };

  // Group into weeks (7 days), oldest first.
  const weeks: Array<Array<(typeof rows)[number]>> = [];
  for (let i = 0; i < rows.length; i += 7) weeks.push(rows.slice(i, i + 7));

  return (
    <div dir="ltr" className="overflow-x-auto pb-1">
      <div className="flex gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((cell) => (
              <div
                key={cell.day}
                title={`${formatJalaliShort(new Date(cell.day + "T00:00:00"))} — ${toFa(cell.score)}٪`}
                className={cn("size-3 rounded-[3px] transition-transform hover:scale-125", cellTone(cell.score))}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
        <span>کم</span>
        <span className="size-3 rounded-[3px] bg-muted/70 dark:bg-white/5" />
        <span className="size-3 rounded-[3px] bg-emerald-400/35" />
        <span className="size-3 rounded-[3px] bg-emerald-400/60" />
        <span className="size-3 rounded-[3px] bg-emerald-400/90" />
        <span className="size-3 rounded-[3px] bg-emerald-500" />
        <span>زیاد</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mission row                                                         */
/* ------------------------------------------------------------------ */

export function MissionRow({
  title,
  description,
  progress,
  target,
  xp,
  completed,
  toneKey = "blue",
  action,
}: {
  title: string;
  description?: string;
  progress: number;
  target: number;
  xp: number;
  completed: boolean;
  toneKey?: Tone;
  action?: React.ReactNode;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0;
  return (
    <li
      className={cn(
        "rounded-xl border p-3 transition-colors",
        completed
          ? "border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-500/20 dark:bg-emerald-500/5"
          : "border-border/60 bg-white/50 hover:border-primary/25 dark:bg-white/5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {completed && <Check className="size-3.5 shrink-0 text-emerald-600" />}
            <span className="truncate text-[13px] font-bold">{title}</span>
          </div>
          {description && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
          )}
        </div>
        <Pill toneKey={completed ? "emerald" : toneKey} className="shrink-0">
          {completed ? "انجام شد" : `+${toFa(xp)} XP`}
        </Pill>
      </div>
      <div className="mt-2.5 flex items-center gap-3">
        <Bar pct={pct} toneKey={completed ? "emerald" : toneKey} className="h-1.5 flex-1" />
        <span className="shrink-0 text-[11px] font-bold tabular-nums text-muted-foreground">
          {toFa(Math.min(progress, target))} / {toFa(target)}
        </span>
      </div>
      {action && <div className="mt-2.5">{action}</div>}
    </li>
  );
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
      {children}
    </p>
  );
}

export const XP_KIND_TONE: Record<string, Tone> = {
  task: "blue",
  subtask: "cyan",
  routine: "emerald",
  mission: "violet",
  challenge: "rose",
  path: "amber",
  stage: "amber",
  streak: "amber",
  bonus: "cyan",
};

export { Trophy };
