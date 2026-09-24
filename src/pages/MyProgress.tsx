import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Link, useSearchParams } from "react-router";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Flame,
  Gift,
  Gauge,
  LayoutDashboard,
  Lock,
  Medal,
  Play,
  Route,
  Sparkles,
  Swords,
  Target,
  TrendingUp,
  Trophy,
  Unlock,
  Users,
  Zap,
} from "lucide-react";
import { toFa } from "@/lib/persian";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProgress } from "@/components/progress/ProgressProvider";
import {
  AchievementIcon,
  Bar,
  EmptyHint,
  MissionRow,
  Panel,
  Pill,
  ScoreRing,
  StatTile,
  TONES,
  type Tone,
} from "@/components/progress/progress-ui";
import {
  AchievementsPanel,
  LeaderboardPanel,
  PathsPanel,
  RewardsPanel,
  StatsPanel,
  XpHistoryPanel,
  type AchievementRow,
  type PathRow,
  type XpEventRow,
} from "@/components/progress/ProgressSections";
import { PersonaStatsPanel } from "@/components/progress/PersonaStats";
import { SkillsPanel } from "@/components/progress/SkillsPanel";
import {
  CapabilityGate,
  UnlockCenter,
} from "@/components/progress/UnlockCenter";

const fmt = (n: number) => toFa(n.toLocaleString("en-US"));

const DIFFICULTY_TONE: Record<string, Tone> = {
  آسان: "emerald",
  متوسط: "amber",
  سخت: "rose",
};

export default function MyProgress() {
  const p = useProgress();
  const [params, setParams] = useSearchParams();
  const activeTab = params.get("tab") ?? "overview";
  const missions = useQuery(api.gamification.missionsState);
  const challenges = useQuery(api.gamification.challengesState);
  const achievements = useQuery(api.gamification.achievementsList) as
    | AchievementRow[]
    | undefined;
  const ladder = useQuery(api.gamification.levelLadder);
  const paths = useQuery(api.gamification.pathsOverview) as PathRow[] | undefined;
  const history = useQuery(api.gamification.xpHistory, { limit: 120 }) as
    | XpEventRow[]
    | undefined;
  const pathMissions = useQuery(api.gamification.todayPathMissions);
  const startChallenge = useMutation(api.gamification.startChallenge);
  const completePathMission = useMutation(api.gamification.completePathMission);

  if (!p) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <div className="skeleton h-10 w-56" />
        <div className="skeleton h-40 rounded-2xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  const achievementsUnlocked = (achievements ?? []).filter((a) => a.unlocked).length;
  const unlockedList = (achievements ?? [])
    .filter((a) => a.unlocked && a.unlockedAt)
    .sort((a, b) => (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0))
    .slice(0, 4);
  const activePaths = (paths ?? []).filter((x) => x.status === "active");
  const daily = missions?.daily ?? [];
  const weekly = missions?.weekly ?? [];

  const onStartChallenge = async (key: string, title: string) => {
    try {
      await startChallenge({ key });
      toast.success(`«${title}» شروع شد — موفق باشی!`);
    } catch {
      toast.error("شروع چالش انجام نشد. دوباره تلاش کن.");
    }
  };

  const onManualMission = async (pathKey: string, missionId: string) => {
    try {
      await completePathMission({ pathKey, missionId });
      toast.success("ماموریت انجام شد ✓");
    } catch {
      toast.error("ثبت ماموریت انجام نشد.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <span className="ui-icon-tile size-9">
              <Trophy className="size-4.5 text-primary" />
            </span>
            پیشرفت من
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            هر کار واقعی که انجام می‌دهی، تو را یک قدم جلو می‌برد.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill toneKey="violet">
            <Sparkles className="size-3" />
            سطح {toFa(p.level)} · {p.levelTitle}
          </Pill>
          <Pill toneKey="amber">
            <Flame className="size-3" />
            {toFa(p.currentStreak)} روز زنجیره
          </Pill>
          <Pill toneKey="emerald">{fmt(p.totalXp)} XP</Pill>
        </div>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          setParams(v === "overview" ? {} : { tab: v }, { replace: true })
        }
        className="gap-4"
      >
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">
            <LayoutDashboard className="size-3.5" />
            نمای کلی
          </TabsTrigger>
          <TabsTrigger value="level">
            <Sparkles className="size-3.5" />
            سطح و XP
          </TabsTrigger>
          <TabsTrigger value="missions">
            <Target className="size-3.5" />
            ماموریت‌ها
          </TabsTrigger>
          <TabsTrigger value="paths">
            <Route className="size-3.5" />
            مسیرهای رشد
          </TabsTrigger>
          <TabsTrigger value="achievements">
            <Medal className="size-3.5" />
            دستاوردها
          </TabsTrigger>
          <TabsTrigger value="skills">
            <Route className="size-3.5" />
            مهارت‌ها
          </TabsTrigger>
          <TabsTrigger value="stats">
            <TrendingUp className="size-3.5" />
            آمار
          </TabsTrigger>
          <TabsTrigger value="unlocks">
            <Unlock className="size-3.5" />
            قابلیت‌ها
          </TabsTrigger>
          <TabsTrigger value="leaderboard">
            <Users className="size-3.5" />
            رده‌بندی
          </TabsTrigger>
          <TabsTrigger value="rewards">
            <Gift className="size-3.5" />
            پاداش‌ها
          </TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------------- */}
        <TabsContent value="overview" className="space-y-5">
          {/* Level hero */}
          <section className="ui-surface ui-accent-top rounded-2xl p-4 md:p-5">
            <div className="flex flex-wrap items-center gap-5">
              <div className="relative shrink-0">
                <div className="grid size-20 place-items-center rounded-3xl bg-gradient-to-br from-primary to-[#5B5FE6] text-2xl font-black text-white shadow-[0_18px_40px_-16px_rgba(37,99,235,0.95)]">
                  {toFa(p.level)}
                </div>
                <span className="absolute -bottom-1.5 start-1/2 -translate-x-1/2 rounded-full border border-primary/25 bg-white px-2 text-[9px] font-bold text-primary dark:bg-slate-900">
                  سطح
                </span>
              </div>

              <div className="min-w-[220px] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-black tracking-tight">{p.levelTitle}</h2>
                  <Badge variant="gradient">{fmt(p.totalXp)} XP</Badge>
                </div>
                <Bar pct={p.progressPct} toneKey="violet" className="mt-3 h-2.5" />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-muted-foreground">
                  <span className="tabular-nums">
                    {fmt(p.xpIntoLevel)} / {fmt(Math.max(1, p.xpForNext))} XP در این سطح
                  </span>
                  <span className="tabular-nums">
                    {fmt(p.xpToNext)} XP تا سطح {toFa(p.level + 1)}
                  </span>
                </div>

                {/* Level ladder dots */}
                <ul className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-2" aria-label="نردبان سطح‌ها">
                  {(ladder ?? []).map((l) => (
                    <li key={l.level} className="flex items-center gap-1.5">
                      <span
                        title={`${l.title} — ${fmt(l.xp)} XP`}
                        className={cn(
                          "grid size-7 place-items-center rounded-lg text-[10px] font-black tabular-nums",
                          l.state === "done"
                            ? "bg-gradient-to-br from-emerald-400 to-teal-600 text-white"
                            : l.state === "current"
                              ? "bg-gradient-to-br from-primary to-[#5B5FE6] text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.95)]"
                              : "bg-muted text-muted-foreground dark:bg-white/10",
                        )}
                      >
                        {l.state === "done" ? <Check className="size-3.5" /> : toFa(l.level)}
                      </span>
                      {l.level !== (ladder ?? []).length && (
                        <span className="h-0.5 w-2 rounded-full bg-border" />
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center gap-4">
                <ScoreRing value={p.score} size={112} strokeWidth={9} label="امتیاز امروز" toneKey="emerald" />
                <div className="space-y-1.5 text-[11px]">
                  <ScoreLine label="کارها" value={p.scoreBreakdown.tasks} toneKey="blue" />
                  <ScoreLine label="روتین‌ها" value={p.scoreBreakdown.routines} toneKey="emerald" />
                  <ScoreLine label="ثبات" value={p.scoreBreakdown.consistency} toneKey="amber" />
                  <ScoreLine label="ماموریت‌ها" value={p.scoreBreakdown.missions} toneKey="violet" />
                </div>
              </div>
            </div>
          </section>

          {/* Periods */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="امروز" icon={<Gauge className="size-4 text-primary" />}>
              <ul className="space-y-3">
                <Row label="کارهای انجام‌شده" value={`${toFa(p.today.completedTasks)} کار`} />
                <Row
                  label="کارهای باقی‌مانده"
                  value={`${toFa(Math.max(0, p.today.plannedTasks - p.today.completedTasks))} کار`}
                />
                <Row
                  label="درصد تکمیل"
                  value={`${toFa(p.scoreBreakdown.tasks)}٪`}
                  progress={p.scoreBreakdown.tasks}
                />
                <Row label="XP امروز" value={`${fmt(p.today.xpEarned)} XP`} />
                <Row
                  label="ماموریت‌ها"
                  value={`${toFa(p.missions.dailyDone)} از ${toFa(p.missions.dailyTotal)}`}
                  progress={
                    p.missions.dailyTotal
                      ? Math.round((p.missions.dailyDone / p.missions.dailyTotal) * 100)
                      : 0
                  }
                />
              </ul>
            </Panel>

            <Panel title="این هفته" icon={<TrendingUp className="size-4 text-primary" />}>
              <ul className="space-y-3">
                <Row label="XP هفته" value={`${fmt(p.week.xp)} XP`} />
                <Row label="کارهای تکمیل‌شده" value={`${toFa(p.week.tasks)} کار`} />
                <Row
                  label="روزهای فعال"
                  value={`${toFa(p.week.activeDays)} از ۷ روز`}
                  progress={Math.round((p.week.activeDays / 7) * 100)}
                />
                <Row label="میانگین امتیاز روزانه" value={`${toFa(p.week.avgScore)}٪`} progress={p.week.avgScore} />
                <Row
                  label="ماموریت‌های هفتگی"
                  value={`${toFa(p.missions.weeklyDone)} از ${toFa(p.missions.weeklyTotal)}`}
                  progress={
                    p.missions.weeklyTotal
                      ? Math.round((p.missions.weeklyDone / p.missions.weeklyTotal) * 100)
                      : 0
                  }
                />
              </ul>
            </Panel>

            <Panel title="بلندمدت" icon={<Trophy className="size-4 text-amber-500" />}>
              <ul className="space-y-3">
                <Row label="XP کل" value={fmt(p.totalXp)} />
                <Row label="سطح فعلی" value={`${toFa(p.level)} — ${p.levelTitle}`} />
                <Row label="XP این ماه" value={fmt(p.monthXp)} />
                <Row
                  label="بلندترین زنجیره"
                  value={`${toFa(p.longestStreak)} روز`}
                  progress={Math.min(100, p.longestStreak * 3)}
                />
                <Row
                  label="دستاوردها"
                  value={`${toFa(achievementsUnlocked)} از ${toFa((achievements ?? []).length)}`}
                  progress={
                    (achievements ?? []).length
                      ? Math.round((achievementsUnlocked / (achievements ?? []).length) * 100)
                      : 0
                  }
                />
              </ul>
            </Panel>
          </div>

          {/* Active paths + today's path missions */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="مسیرهای فعال"
              icon={<Route className="size-4 text-primary" />}
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setParams({ tab: "paths" }, { replace: true })}
                >
                  همه مسیرها
                  <ArrowLeft className="size-3.5" />
                </Button>
              }
            >
              {activePaths.length === 0 ? (
                <EmptyHint>
                  هنوز مسیری را شروع نکرده‌ای. از تب «مسیرهای رشد» یک مسیر انتخاب کن.
                </EmptyHint>
              ) : (
                <ul className="space-y-3">
                  {activePaths.slice(0, 3).map((x) => (
                    <li key={x.key} className="rounded-xl border border-border/60 bg-white/50 p-3 dark:bg-white/5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="text-lg">{x.emoji}</span>
                          <span className="truncate text-[13px] font-bold">{x.title}</span>
                        </span>
                        <Pill toneKey={DIFFICULTY_TONE[x.difficulty] ?? "blue"}>{x.difficulty}</Pill>
                      </div>
                      <div className="mt-2.5 flex items-center gap-3">
                        <Bar pct={x.progressPct} toneKey="blue" className="h-1.5 flex-1" />
                        <span className="shrink-0 text-[11px] font-bold tabular-nums text-muted-foreground">
                          {toFa(x.progressPct)}٪
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>
                          مرحله {toFa(x.stageIndex + 1)}/{toFa(x.stageCount)} · {fmt(x.xpEarned)} XP
                        </span>
                        <Link to={`/progress/paths/${x.key}`} className="font-bold text-primary">
                          ادامه
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              title="ماموریت‌های مسیر امروز"
              icon={<Target className="size-4 text-violet-500" />}
              description="بدون رفتن به صفحه مسیرها هم می‌توانی پیش بروی."
            >
              {pathMissions && pathMissions.length > 0 ? (
                <ul className="space-y-2.5">
                  {pathMissions.map((m) => (
                    <li
                      key={`${m.pathKey}-${m.id}`}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-2.5",
                        m.completed
                          ? "border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-500/20 dark:bg-emerald-500/5"
                          : "border-border/60 bg-white/50 dark:bg-white/5",
                      )}
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 text-white">
                        {m.completed ? <Check className="size-4" /> : <Target className="size-3.5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-bold">{m.title}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {m.pathTitle} · {m.stageTitle}
                        </div>
                      </div>
                      {m.completed ? (
                        <Pill toneKey="emerald">انجام شد</Pill>
                      ) : m.kind === "manual" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onManualMission(m.pathKey, m.id)}
                        >
                          ثبت انجام
                        </Button>
                      ) : (
                        <Pill toneKey="violet">+{toFa(m.xp)} XP</Pill>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyHint>با شروع یک مسیر رشد، ماموریت‌های امروزت اینجا نشان داده می‌شود.</EmptyHint>
              )}
            </Panel>
          </div>

          {/* Missions preview + XP history preview */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="ماموریت‌های امروز"
              icon={<Target className="size-4 text-primary" />}
              action={<Pill toneKey="violet">{toFa(daily.filter((d) => d.completed).length)} / {toFa(daily.length)}</Pill>}
            >
              {daily.length === 0 ? (
                <EmptyHint>ماموریتی برای امروز تعریف نشده.</EmptyHint>
              ) : (
                <ul className="space-y-2.5">
                  {daily.slice(0, 3).map((m) => (
                    <MissionRow
                      key={m.key}
                      title={m.title}
                      description={m.description}
                      progress={m.progress}
                      target={m.target}
                      xp={m.xp}
                      completed={m.completed}
                    />
                  ))}
                </ul>
              )}
            </Panel>

            <XpHistoryPanel events={history ?? []} limit={5} compact />
          </div>

          {/* Recent achievements + duel */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel
              title="آخرین دستاوردها"
              icon={<Medal className="size-4 text-primary" />}
              className="lg:col-span-2"
            >
              {unlockedList.length === 0 ? (
                <EmptyHint>هنوز دستاوردی باز نشده — با اولین کار کامل‌شده شروع می‌شود.</EmptyHint>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {unlockedList.map((a) => (
                    <li
                      key={a.key}
                      className="flex items-center gap-3 rounded-xl border border-border/60 bg-white/60 p-2.5 dark:bg-white/5"
                    >
                      <span
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white",
                          TONES[(a.tone in TONES ? a.tone : "blue") as Tone].grad,
                        )}
                      >
                        <AchievementIcon name={a.icon} className="size-4.5" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-bold">{a.title}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {a.unlockedAt
                            ? toFa(new Date(a.unlockedAt).toLocaleDateString("fa-IR"))
                            : ""}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <DuelPreview />
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------- */}
        <TabsContent value="level" className="space-y-5">
          <section className="ui-frame-gradient rounded-3xl p-[1px]">
            <div className="ui-surface rounded-3xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-[#5B5FE6] text-xl font-black text-white shadow-[0_14px_34px_-14px_rgba(37,99,235,0.95)]">
                    {toFa(p.level)}
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-muted-foreground">سطح فعلی</div>
                    <h2 className="text-xl font-black tracking-tight">{p.levelTitle}</h2>
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-2xl font-black tabular-nums">{fmt(p.totalXp)}</div>
                  <div className="text-[11px] text-muted-foreground">XP کل</div>
                </div>
              </div>
              <div className="mt-4">
                <Bar pct={p.progressPct} toneKey="blue" className="h-3" />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-muted-foreground">
                  <span className="tabular-nums">
                    {fmt(p.xpIntoLevel)} / {fmt(Math.max(1, p.xpForNext))} XP
                  </span>
                  <span className="tabular-nums">{fmt(p.xpToNext)} XP تا سطح {toFa(p.level + 1)}</span>
                </div>
              </div>
            </div>
          </section>

          <Panel title="نردبان سطح‌ها" icon={<Sparkles className="size-4 text-primary" />}>
            <ul className="grid gap-2 sm:grid-cols-2">
              {(ladder ?? []).map((l) => (
                <li
                  key={l.level}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3",
                    l.state === "current"
                      ? "border-primary/30 bg-primary/8"
                      : "border-border/60 bg-white/50 dark:bg-white/5",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-xl text-[11px] font-black",
                      l.state === "done"
                        ? "bg-gradient-to-br from-emerald-400 to-teal-600 text-white"
                        : l.state === "current"
                          ? "bg-gradient-to-br from-primary to-[#5B5FE6] text-white"
                          : "bg-muted text-muted-foreground dark:bg-white/10",
                    )}
                  >
                    {l.state === "done" ? <Check className="size-4" /> : toFa(l.level)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold">{l.title}</div>
                    <div className="text-[11px] tabular-nums text-muted-foreground">
                      از {fmt(l.xp)} XP
                    </div>
                  </div>
                  {l.state === "current" && <Pill toneKey="blue">سطح فعلی</Pill>}
                  {l.state === "locked" && <Lock className="size-3.5 text-muted-foreground" />}
                </li>
              ))}
            </ul>
          </Panel>

          <XpHistoryPanel events={history ?? []} />
        </TabsContent>

        {/* ---------------------------------------------------------- */}
        <TabsContent value="missions" className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="ماموریت‌های امروز"
              icon={<Target className="size-4 text-primary" />}
              description="هر روز ساعت ۰۰:۰۰ بامداد بازنشانی می‌شود."
              action={
                <Pill toneKey="violet">
                  {toFa(daily.filter((d) => d.completed).length)} / {toFa(daily.length)}
                </Pill>
              }
            >
              {daily.length === 0 ? (
                <EmptyHint>ماموریتی برای امروز موجود نیست.</EmptyHint>
              ) : (
                <ul className="space-y-2.5">
                  {daily.map((m) => (
                    <MissionRow
                      key={m.key}
                      title={m.title}
                      description={m.description}
                      progress={m.progress}
                      target={m.target}
                      xp={m.xp}
                      completed={m.completed}
                      toneKey="blue"
                    />
                  ))}
                </ul>
              )}
              {!missions?.hasRoutines && (
                <p className="mt-3 rounded-xl border border-dashed border-border/70 p-3 text-[11px] text-muted-foreground">
                  برای دیدن ماموریت‌های روتین، از صفحه «برنامه‌ریزی» یک روتین بساز.
                </p>
              )}
            </Panel>

            <Panel
              title="ماموریت‌های هفتگی"
              icon={<TrendingUp className="size-4 text-violet-500" />}
              description="یک هفته فرصت داری؛ شنبه‌ها بازنشانی می‌شود."
              action={
                <Pill toneKey="violet">
                  {toFa(weekly.filter((w) => w.completed).length)} / {toFa(weekly.length)}
                </Pill>
              }
            >
              {weekly.length === 0 ? (
                <EmptyHint>ماموریت هفتگی موجود نیست.</EmptyHint>
              ) : (
                <ul className="space-y-2.5">
                  {weekly.map((m) => (
                    <MissionRow
                      key={m.key}
                      title={m.title}
                      description={m.description}
                      progress={m.progress}
                      target={m.target}
                      xp={m.xp}
                      completed={m.completed}
                      toneKey="violet"
                    />
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <Panel
            title="چالش‌ها"
            icon={<Swords className="size-4 text-rose-500" />}
            description="چالش‌ها بزرگ‌تر از ماموریت‌ها هستند و چند روز طول می‌کشند."
          >
            {!challenges ? (
              <div className="skeleton h-32 rounded-2xl" />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {challenges.map((c) => {
                  const t = TONES[(c.tone in TONES ? c.tone : "blue") as Tone];
                  const pct = c.target > 0 ? Math.min(100, Math.round((c.progress / c.target) * 100)) : 0;
                  return (
                    <li key={c.key} className="ui-surface ui-surface-hover flex flex-col gap-3 rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-2">
                        <span className={cn("grid size-11 place-items-center rounded-2xl bg-gradient-to-br text-xl text-white", t.grad)}>
                          {c.emoji}
                        </span>
                        <StatusPill status={c.status} />
                      </div>
                      <div>
                        <h3 className="text-[13px] font-extrabold leading-6">{c.title}</h3>
                        <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                          {c.description}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Bar
                            pct={pct}
                            toneKey={c.status === "completed" ? "emerald" : (c.tone as Tone)}
                            className="h-1.5 flex-1"
                          />
                          <span className="shrink-0 text-[11px] font-bold tabular-nums text-muted-foreground">
                            {toFa(Math.min(c.progress, c.target))}/{toFa(c.target)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{toFa(c.days)} روز · +{toFa(c.xp)} XP</span>
                          {c.status === "active" && c.daysLeft !== null && (
                            <span>{toFa(c.daysLeft)} روز مانده</span>
                          )}
                        </div>
                      </div>
                      <div className="mt-auto">
                        {c.status === "available" && (
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => onStartChallenge(c.key, c.title)}
                          >
                            <Play className="size-3.5" />
                            شروع چالش
                          </Button>
                        )}
                        {c.status === "active" && (
                          <Badge variant="accent" className="w-full justify-center py-1">
                            در جریان است
                          </Badge>
                        )}
                        {c.status === "completed" && (
                          <Badge variant="success" className="w-full justify-center py-1">
                            <CheckCircle2 className="size-3" />
                            تکمیل شد
                          </Badge>
                        )}
                        {(c.status === "failed" || c.status === "expired") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => onStartChallenge(c.key, c.title)}
                          >
                            تلاش دوباره
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <DuelPreview />
        </TabsContent>

        {/* ---------------------------------------------------------- */}
        <TabsContent value="paths">
          <PathsPanel paths={paths ?? []} />
        </TabsContent>

        <TabsContent value="achievements">
          <AchievementsPanel items={achievements ?? []} />
        </TabsContent>

        <TabsContent value="skills" className="space-y-5">
          <SkillsPanel />
        </TabsContent>

        <TabsContent value="stats" className="space-y-5">
          {/* Persona stats (Phase 04) — what the user is becoming better at */}
          <PersonaStatsPanel />
          {/* Generic progression statistics (XP, streaks, quality) */}
          <StatsPanel />
        </TabsContent>

        <TabsContent value="unlocks">
          <UnlockCenter />
        </TabsContent>

        <TabsContent value="leaderboard">
          <CapabilityGate featureKey="leaderboard">
            <LeaderboardPanel />
          </CapabilityGate>
        </TabsContent>

        <TabsContent value="rewards">
          <RewardsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* local bits                                                          */
/* ------------------------------------------------------------------ */

function Row({
  label,
  value,
  progress,
}: {
  label: string;
  value: string;
  progress?: number;
}) {
  return (
    <li>
      <div className="flex items-center justify-between gap-3 text-[12px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-bold tabular-nums">{value}</span>
      </div>
      {progress !== undefined && (
        <Bar pct={progress} toneKey="blue" className="mt-1.5 h-1.5" />
      )}
    </li>
  );
}

function ScoreLine({ label, value, toneKey }: { label: string; value: number; toneKey: Tone }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-muted-foreground">{label}</span>
      <span className="w-16">
        <Bar pct={value} toneKey={toneKey} className="h-1.5" />
      </span>
      <span className="font-bold tabular-nums">{toFa(value)}٪</span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "active") return <Pill toneKey="blue">در جریان</Pill>;
  if (status === "completed") return <Pill toneKey="emerald">تکمیل شد</Pill>;
  if (status === "failed") return <Pill toneKey="rose">ناموفق</Pill>;
  return <Pill toneKey="slate">آماده شروع</Pill>;
}

/**
 * Duel is intentionally a preview: the data model and metrics are already in
 * place, but head-to-head matches are not enabled yet.
 */
function DuelPreview() {
  return (
    <section className="ui-surface rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <span className="ui-icon-tile size-6">
            <Swords className="size-3.5 text-primary" />
          </span>
          دوئل
        </h2>
        <Pill toneKey="slate">
          <Zap className="size-3" />
          به‌زودی
        </Pill>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
        دوئل یک مقایسه دوستانه در یک بازه مشخص است: XP، کارهای انجام‌شده، روتین‌ها و
        ماموریت‌ها. معماری داده‌اش آماده است و در نسخه بعدی فعال می‌شود.
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        {["XP کسب‌شده", "کارهای کامل‌شده", "روتین‌های حفظ‌شده", "ماموریت‌ها"].map((m) => (
          <li
            key={m}
            className="flex items-center gap-1.5 rounded-xl border border-dashed border-border/70 p-2 text-muted-foreground"
          >
            <CheckCircle2 className="size-3.5" />
            {m}
          </li>
        ))}
      </ul>
      <Button size="sm" variant="outline" className="mt-3 w-full" disabled>
        ۷ روزه · به‌زودی
      </Button>
    </section>
  );
}
