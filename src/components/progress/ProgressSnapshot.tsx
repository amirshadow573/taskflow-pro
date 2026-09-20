import { Link } from "react-router";
import { toFa } from "@/lib/persian";
import { useProgress } from "./ProgressProvider";
import { Bar, Pill, ScoreRing, TONES } from "./progress-ui";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Flame, Gauge, Sparkles, Target } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Compact "Progress Snapshot" for the dashboard — level, XP, streak, today's
 * score and mission progress. Deliberately small so task management stays the
 * main act.
 */
export function ProgressSnapshot() {
  const p = useProgress();
  if (!p) return null;

  const xpInLevel = p.xpIntoLevel;
  const xpForLevel = Math.max(1, p.xpForNext);
  const missionPct =
    p.missions.dailyTotal > 0
      ? Math.round((p.missions.dailyDone / p.missions.dailyTotal) * 100)
      : 0;

  return (
    <section className="ui-surface ui-accent-top rounded-2xl p-4 md:p-5">
      <div className="flex flex-wrap items-start gap-5">
        {/* Level + XP */}
        <div className="flex min-w-[240px] flex-1 items-center gap-4">
          <div className="relative shrink-0">
            <div className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-[#5B5FE6] text-xl font-black text-white shadow-[0_14px_34px_-14px_rgba(37,99,235,0.95)]">
              {toFa(p.level)}
            </div>
            <span className="absolute -bottom-1 start-1/2 -translate-x-1/2 rounded-full border border-primary/25 bg-white px-2 text-[9px] font-bold text-primary dark:bg-slate-900">
              سطح
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-extrabold tracking-tight">{p.levelTitle}</h2>
              <Pill toneKey="violet">
                <Sparkles className="size-3" />
                {toFa(p.totalXp.toLocaleString("en-US"))} XP
              </Pill>
            </div>
            <Bar pct={p.progressPct} toneKey="blue" className="mt-2.5" />
            <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span className="tabular-nums">
                {toFa(xpInLevel.toLocaleString("en-US"))} / {toFa(xpForLevel.toLocaleString("en-US"))} XP
              </span>
              <span className="tabular-nums">
                {toFa(p.xpToNext.toLocaleString("en-US"))} XP تا سطح {toFa(p.level + 1)}
              </span>
            </div>
          </div>
        </div>

        {/* Mini stats */}
        <div className="grid w-full grid-cols-2 gap-2.5 sm:w-auto sm:grid-cols-3">
          <MiniStat
            icon={<Flame className="size-3.5" />}
            toneKey="amber"
            label="زنجیره"
            value={`${toFa(p.currentStreak)} روز`}
            hint={`رکورد ${toFa(p.longestStreak)} روز`}
          />
          <MiniStat
            icon={<CheckCircle2 className="size-3.5" />}
            toneKey="emerald"
            label="کار امروز"
            value={`${toFa(p.today.completedTasks)} / ${toFa(Math.max(p.today.plannedTasks, p.today.completedTasks))}`}
            hint={p.today.xpEarned > 0 ? `${toFa(p.today.xpEarned)} XP امروز` : "شروع کن"}
          />
          <MiniStat
            icon={<Target className="size-3.5" />}
            toneKey="violet"
            label="ماموریت‌ها"
            value={`${toFa(p.missions.dailyDone)} / ${toFa(p.missions.dailyTotal)}`}
            hint={p.missions.dailyTotal ? `${toFa(missionPct)}٪ امروز` : "بدون ماموریت"}
          />
        </div>

        {/* Daily score ring */}
        <div className="flex items-center gap-3">
          <ScoreRing value={p.score} size={84} strokeWidth={7} label="امتیاز امروز" />
          <div className="flex flex-col gap-2">
            <div className="hidden text-[11px] font-semibold text-muted-foreground sm:block">
              <div className="flex items-center gap-1.5">
                <Gauge className="size-3.5" />
                شرح امتیاز
              </div>
              <ul className="mt-1.5 space-y-0.5 tabular-nums">
                <li>کارها {toFa(p.scoreBreakdown.tasks)}٪</li>
                <li>روتین {toFa(p.scoreBreakdown.routines)}٪</li>
                <li>ثبات {toFa(p.scoreBreakdown.consistency)}٪</li>
              </ul>
            </div>
            <Link to="/progress">
              <Button size="sm" variant="outline" className="whitespace-nowrap">
                پیشرفت من
                <ArrowLeft className="size-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniStat({
  icon,
  label,
  value,
  hint,
  toneKey,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  toneKey: string;
}) {
  const t = TONES[(toneKey in TONES ? toneKey : "blue") as keyof typeof TONES];
  return (
    <div className="rounded-xl border border-border/60 bg-white/60 p-2.5 dark:bg-white/5">
      <div className="flex items-center gap-1.5">
        <span className={cn("grid size-6 place-items-center rounded-lg bg-gradient-to-br text-white", t.grad)}>
          {icon}
        </span>
        <span className="truncate text-[10px] font-semibold text-muted-foreground">{label}</span>
      </div>
      <div className="mt-1.5 text-sm font-extrabold tabular-nums">{value}</div>
      {hint && <div className="truncate text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
