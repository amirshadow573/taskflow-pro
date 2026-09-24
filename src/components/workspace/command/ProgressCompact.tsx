/**
 * Compact progression module — Phase 09 (LEVEL 3).
 *
 * One calm panel that shows only the progression relevant right now: level/XP
 * (always), then the current skill, the active quest/mission and the latest
 * achievement — each only when real data exists. Never a badge wall, never
 * every system at once. Full detail stays in the Progress Center.
 */
import { Link } from "react-router";
import { useMemo } from "react";
import { useQuery } from "convex/react";
import {
  ArrowLeft,
  Flame,
  Medal,
  Route,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useProgress } from "@/components/progress/ProgressProvider";
import {
  AchievementIcon,
  Bar,
  Pill,
  TONES,
  tone as toneOf,
} from "@/components/progress/progress-ui";
import { Button } from "@/components/ui/button";
import { toFa } from "@/lib/persian";
import { cn } from "@/lib/utils";

function Row({
  icon,
  label,
  value,
  hint,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  to: string;
}) {
  return (
    <li>
      <Link
        to={to}
        className="flex items-center gap-3 rounded-xl border border-border/60 bg-white/50 px-3 py-2 transition-colors hover:border-primary/30 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold text-muted-foreground">{label}</span>
          <span className="block truncate text-[12px] font-bold">{value}</span>
          {hint && <span className="block truncate text-[10px] text-muted-foreground">{hint}</span>}
        </span>
        <ArrowLeft className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

export function ProgressCompact() {
  const p = useProgress();
  const skills = useQuery(api.skills.snapshot);
  const achievements = useQuery(api.gamification.achievementsList);

  const activeSkill = useMemo(
    () => (skills?.skills ?? []).find((s) => s.hasData && s.level > 0) ?? (skills?.skills ?? [])[0],
    [skills],
  );
  const latestAchievement = useMemo(() => {
    const list = (achievements ?? [])
      .filter((a) => a.unlocked && a.unlockedAt)
      .sort((a, b) => (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0));
    return list[0];
  }, [achievements]);

  if (!p) return null;

  const dailyDone = p.missions.dailyDone ?? 0;
  const dailyTotal = p.missions.dailyTotal ?? 0;
  const weeklyDone = p.missions.weeklyDone ?? 0;
  const weeklyTotal = p.missions.weeklyTotal ?? 0;
  const hasMissions = dailyTotal > 0 || weeklyTotal > 0;

  return (
    <section className="ui-surface rounded-2xl p-4" aria-label="پیشرفت من">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <span className="ui-icon-tile size-6">
            <TrendingUp className="size-3.5 text-primary" aria-hidden />
          </span>
          پیشرفت
        </h2>
        <div className="flex items-center gap-1.5">
          <Pill toneKey="violet">
            <Sparkles className="size-3" aria-hidden />
            سطح {toFa(p.level)} · {p.levelTitle}
          </Pill>
          {p.currentStreak > 0 && (
            <Pill toneKey="amber">
              <Flame className="size-3" aria-hidden />
              {toFa(p.currentStreak)} روز
            </Pill>
          )}
        </div>
      </header>

      <div className="mt-3">
        <Bar pct={p.progressPct} toneKey="violet" className="h-2.5" />
        <div className="mt-1.5 flex items-center justify-between text-[10px] font-semibold text-muted-foreground">
          <span className="tabular-nums">
            {toFa(p.xpIntoLevel.toLocaleString("en-US"))} /{" "}
            {toFa(Math.max(1, p.xpForNext).toLocaleString("en-US"))} XP
          </span>
          <span className="tabular-nums">
            {toFa(p.xpToNext.toLocaleString("en-US"))} XP تا سطح {toFa(p.level + 1)}
          </span>
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {activeSkill && (
          <Row
            icon={<Route className="size-3.5" aria-hidden />}
            label="رشد فعلی"
            value={`${activeSkill.label}${activeSkill.level > 0 ? ` — سطح ${toFa(activeSkill.level)}` : ""}`}
            hint={
              skills?.stageLabel
                ? `مرحله: ${skills.stageLabel} · ${toFa(Math.round(activeSkill.progress))}٪`
                : `${toFa(Math.round(activeSkill.progress))}٪`
            }
            to="/progress?tab=skills"
          />
        )}

        {hasMissions && (
          <Row
            icon={<Target className="size-3.5" aria-hidden />}
            label={dailyTotal > 0 ? "ماموریت امروز" : "ماموریت هفتگی"}
            value={
              dailyTotal > 0
                ? `${toFa(dailyDone)} از ${toFa(dailyTotal)} ماموریت امروز`
                : `${toFa(weeklyDone)} از ${toFa(weeklyTotal)} ماموریت هفته`
            }
            hint={
              weeklyTotal > 0
                ? `هفته: ${toFa(weeklyDone)} از ${toFa(weeklyTotal)}`
                : "ماموریت‌ها را کامل کن"
            }
            to="/progress?tab=quests"
          />
        )}

        {latestAchievement && (
          <Row
            icon={
              <Medal
                className={cn(
                  "size-3.5",
                  TONES[toneOf(latestAchievement.tone)].text,
                )}
                aria-hidden
              />
            }
            label="آخرین دستاورد"
            value={latestAchievement.title}
            hint={
              latestAchievement.unlockedAt
                ? toFa(new Date(latestAchievement.unlockedAt).toLocaleDateString("fa-IR"))
                : undefined
            }
            to="/progress?tab=achievements"
          />
        )}

        {!activeSkill && !hasMissions && !latestAchievement && (
          <li className="flex items-center gap-2 rounded-xl border border-dashed border-border/70 px-3 py-2.5 text-[11px] text-muted-foreground">
            <AchievementIcon name="route" className="size-3.5" aria-hidden />
            با انجام کارهای واقعی، مهارت‌ها و دستاوردهایت اینجا زنده می‌شوند.
          </li>
        )}
      </ul>

      <div className="mt-3">
        <Button asChild size="sm" variant="outline" className="w-full">
          <Link to="/progress">
            مرکز پیشرفت
            <ArrowLeft className="size-3.5" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
