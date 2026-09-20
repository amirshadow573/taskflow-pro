import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Info,
  Lock,
  Route,
  Sparkles,
  Target,
  Trash2,
  Trophy,
} from "lucide-react";
import { toFa } from "@/lib/persian";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bar, EmptyHint, Panel, Pill, TONES, type Tone } from "@/components/progress/progress-ui";

const fmt = (n: number) => toFa(n.toLocaleString("en-US"));

const DIFFICULTY_TONE: Record<string, Tone> = {
  آسان: "emerald",
  متوسط: "amber",
  سخت: "rose",
};

const KIND_HINT: Record<string, string> = {
  tasks: "از کارهای کامل‌شده اندازه‌گیری می‌شود",
  routine: "از آیتم‌های روتین تیک‌خورده",
  days: "از روزهای فعال تو",
  xp: "از XP کسب‌شده در این مرحله",
  streak: "از زنجیره فعلی تو",
  manual: "خودت ثبتش می‌کنی",
};

interface PathMissionView {
  id: string;
  title: string;
  description: string;
  kind: string;
  target: number;
  xp: number;
  completed: boolean;
  locked: boolean;
}

interface PathStageView {
  key: string;
  title: string;
  days: number;
  bonus: number;
  index: number;
  state: string;
  missionsDone: number;
  missionsTotal: number;
  missions: PathMissionView[];
}

export default function GrowthPathDetail() {
  const { pathKey = "" } = useParams();
  const navigate = useNavigate();
  const detail = useQuery(api.gamification.pathDetail, { pathKey });
  const live = useQuery(api.pathLive.stage, { pathKey });
  const joinPath = useMutation(api.gamification.joinPath);
  const leavePath = useMutation(api.gamification.leavePath);
  const completeMission = useMutation(api.gamification.completePathMission);

  if (detail === undefined) {
    return (
      <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-8">
        <div className="skeleton h-8 w-40" />
        <div className="skeleton h-48 rounded-2xl" />
        <div className="skeleton h-72 rounded-2xl" />
      </div>
    );
  }

  if (detail === null) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-8">
        <EmptyHint>این مسیر پیدا نشد یا حذف شده است.</EmptyHint>
        <Link to="/progress" className="mt-3 inline-block">
          <Button variant="outline" size="sm">
            بازگشت به پیشرفت من
          </Button>
        </Link>
      </div>
    );
  }

  const { path } = detail;
  const enrolled = detail.enrolled;
  const liveValueFor = new Map((live?.missions ?? []).map((m) => [m.id, m.value]));

  const onJoin = async () => {
    try {
      await joinPath({ pathKey: path.key });
      toast.success(`مسیر «${path.title}» شروع شد — مرحله اول باز است.`);
    } catch {
      toast.error("شروع مسیر انجام نشد.");
    }
  };

  const onLeave = async () => {
    try {
      await leavePath({ pathKey: path.key });
      toast.success("از این مسیر خارج شدی.");
      navigate("/progress");
    } catch {
      toast.error("خروج از مسیر انجام نشد.");
    }
  };

  const onManual = async (missionId: string, title: string) => {
    try {
      await completeMission({ pathKey: path.key, missionId });
      toast.success(`«${title}» ثبت شد ✓`);
    } catch {
      toast.error("ثبت ماموریت انجام نشد.");
    }
  };

  const completedStages = detail.stages.filter((s) => s.state === "completed").length;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-8">
      <Link
        to="/progress"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowRight className="size-3.5" />
        پیشرفت من
      </Link>

      {/* Header */}
      <section className="ui-surface ui-accent-top rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-2xl">
              {path.emoji}
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-black tracking-tight">{path.title}</h1>
              <p className="mt-1 max-w-2xl text-[12px] leading-6 text-muted-foreground">
                {path.summary}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <Pill toneKey={DIFFICULTY_TONE[path.difficulty] ?? "blue"}>
                  سختی: {path.difficulty}
                </Pill>
                <Pill toneKey="slate">{path.category}</Pill>
                <Pill toneKey="cyan">
                  <Clock className="size-3" />
                  {toFa(path.totalDays)} روز
                </Pill>
                <Pill toneKey="violet">
                  <Route className="size-3" />
                  {toFa(detail.stages.length)} مرحله
                </Pill>
                <Pill toneKey="amber">
                  <Sparkles className="size-3" />
                  {fmt(path.totalXp)} XP
                </Pill>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-2">
            {!enrolled && (
              <Button onClick={onJoin} className="min-w-40">
                شروع مسیر
                <ArrowLeft className="size-3.5" />
              </Button>
            )}
            {enrolled && detail.status === "active" && (
              <Badge variant="gradient" className="justify-center py-1.5">
                مسیر فعال · مرحله {toFa(detail.currentStage + 1)}
              </Badge>
            )}
            {detail.status === "completed" && (
              <Badge variant="success" className="justify-center py-1.5">
                <Trophy className="size-3" />
                مسیر تکمیل شده
              </Badge>
            )}
            {enrolled && (
              <Button variant="ghost" size="sm" onClick={onLeave}>
                <Trash2 className="size-3.5" />
                خروج از مسیر
              </Button>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span>پیشرفت مسیر</span>
              <span className="tabular-nums">
                {fmt(detail.xpEarned)} / {fmt(path.totalXp)} XP
              </span>
            </div>
            <Bar pct={detail.progressPct} toneKey="violet" className="mt-2 h-2.5" />
            <p className="mt-2 text-[11px] text-muted-foreground">
              هدف: {path.goal}
            </p>
          </div>
          <MiniBox label="مراحل کامل" value={`${toFa(completedStages)} / ${toFa(detail.stages.length)}`} />
          <MiniBox
            label="پاداش تکمیل"
            value={`+${toFa(path.completionXp)} XP`}
            accent="text-amber-600 dark:text-amber-300"
          />
        </div>
      </section>

      {/* Info */}
      <div className="flex items-start gap-2.5 rounded-2xl border border-primary/20 bg-primary/5 p-3.5 text-[11px] leading-5 text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
        <p>
          ماموریت‌های هر مرحله به‌صورت خودکار از فعالیت واقعی تو (کارهای کامل‌شده، روتین‌ها و
          روزهای فعال) سنجیده می‌شوند؛ فقط ماموریت‌های عادتی را خودت ثبت می‌کنی. با کامل شدن
          همه ماموریت‌های یک مرحله، پاداش مرحله و مرحله بعدی باز می‌شود.
        </p>
      </div>

      {/* Timeline */}
      <Panel
        title="مراحل مسیر"
        icon={<Target className="size-4 text-primary" />}
        description="از مرحله اول شروع کن و مرحله به مرحله جلو برو."
      >
        <ol className="relative space-y-4">
          <span className="absolute inset-y-2 start-3 w-0.5 rounded-full bg-border/70" aria-hidden />
          {detail.stages.map((stage: PathStageView) => {
            const showMissions = stage.state !== "locked";
            const stagePct =
              stage.missionsTotal > 0
                ? Math.round((stage.missionsDone / stage.missionsTotal) * 100)
                : 0;
            return (
              <li key={stage.key} className="relative ps-10">
                <span
                  className={cn(
                    "absolute start-0 top-1 grid size-6 place-items-center rounded-full text-[10px] font-black",
                    stage.state === "completed"
                      ? "bg-gradient-to-br from-emerald-400 to-teal-600 text-white"
                      : stage.state === "active"
                        ? "bg-gradient-to-br from-primary to-[#5B5FE6] text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.95)]"
                        : "bg-muted text-muted-foreground dark:bg-white/10",
                  )}
                >
                  {stage.state === "completed" ? (
                    <Check className="size-3.5" />
                  ) : stage.state === "locked" ? (
                    <Lock className="size-3" />
                  ) : (
                    toFa(stage.index + 1)
                  )}
                </span>

                <div
                  className={cn(
                    "rounded-2xl border p-3.5",
                    stage.state === "active"
                      ? "border-primary/30 bg-primary/5"
                      : "border-border/60 bg-white/50 dark:bg-white/5",
                    stage.state === "locked" && "opacity-80",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="flex items-center gap-2 text-[13px] font-extrabold">
                        مرحله {toFa(stage.index + 1)} — {stage.title}
                      </h3>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{toFa(stage.days)} روز</span>
                        <span>·</span>
                        <span>
                          {toFa(stage.missionsDone)} از {toFa(stage.missionsTotal)} ماموریت
                        </span>
                        <span>·</span>
                        <span className="tabular-nums">پاداش مرحله +{toFa(stage.bonus)} XP</span>
                      </div>
                    </div>
                    {stage.state === "completed" ? (
                      <Pill toneKey="emerald">
                        <CheckCircle2 className="size-3" />
                        کامل شد
                      </Pill>
                    ) : stage.state === "active" ? (
                      <Pill toneKey="blue">مرحله فعلی</Pill>
                    ) : stage.state === "locked" ? (
                      <Pill toneKey="slate">
                        <Lock className="size-3" />
                        قفل
                      </Pill>
                    ) : (
                      <Pill toneKey="slate">باز</Pill>
                    )}
                  </div>

                  {stage.missionsTotal > 0 && stage.state !== "locked" && (
                    <Bar pct={stagePct} toneKey={stage.state === "completed" ? "emerald" : "blue"} className="mt-3 h-1.5" />
                  )}

                  {showMissions ? (
                    <ul className="mt-3 space-y-2">
                      {stage.missions.map((m) => {
                        const value = m.completed ? m.target : (liveValueFor.get(m.id) ?? 0);
                        const pct =
                          m.target > 0 ? Math.min(100, Math.round((value / m.target) * 100)) : 0;
                        const canAct = stage.state === "active" && !m.completed;
                        return (
                          <li
                            key={m.id}
                            className={cn(
                              "rounded-xl border p-2.5",
                              m.completed
                                ? "border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-500/20 dark:bg-emerald-500/5"
                                : "border-border/60 bg-white/60 dark:bg-white/5",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {m.completed && <Check className="size-3.5 shrink-0 text-emerald-600" />}
                                  <span className="text-[12px] font-bold">{m.title}</span>
                                </div>
                                <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
                                  {m.description} — {KIND_HINT[m.kind] ?? ""}
                                </p>
                              </div>
                              <Pill toneKey={m.completed ? "emerald" : "violet"} className="shrink-0">
                                {m.completed ? "انجام شد" : `+${toFa(m.xp)} XP`}
                              </Pill>
                            </div>
                            <div className="mt-2 flex items-center gap-3">
                              {m.kind !== "manual" && (
                                <>
                                  <Bar
                                    pct={pct}
                                    toneKey={m.completed ? "emerald" : "blue"}
                                    className="h-1.5 flex-1"
                                  />
                                  <span className="shrink-0 text-[10px] font-bold tabular-nums text-muted-foreground">
                                    {toFa(Math.min(value, m.target))} / {toFa(m.target)}
                                  </span>
                                </>
                              )}
                              {m.kind === "manual" && canAct && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onManual(m.id, m.title)}
                                >
                                  ثبت انجام
                                </Button>
                              )}
                              {m.kind === "manual" && !canAct && !m.completed && (
                                <span className="text-[10px] text-muted-foreground">
                                  با رسیدن نوبت این مرحله فعال می‌شود
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-3 rounded-xl border border-dashed border-border/70 p-3 text-[11px] text-muted-foreground">
                      ماموریت‌های این مرحله وقتی باز می‌شود که مرحله فعلی را کامل کنی.
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </Panel>

      {/* Completion reward */}
      <Panel title="پاداش تکمیل مسیر" icon={<Trophy className="size-4 text-amber-500" />}>
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 to-orange-500 text-white shadow-[0_14px_30px_-14px_rgba(245,158,11,0.9)]">
            <Trophy className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-extrabold">
              نشان «تکمیل {path.title}» + {toFa(path.completionXp)} XP
            </div>
            <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
              با تمام شدن همه مراحل، پاداش تکمیل و نشان اختصاصی این مسیر در بخش دستاوردها
              ثبت می‌شود.
            </p>
          </div>
          <Pill toneKey={detail.status === "completed" ? "emerald" : "slate"}>
            {detail.status === "completed" ? "دریافت شد" : "در انتظار"}
          </Pill>
        </div>
        <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-3 text-[11px] leading-5 text-muted-foreground">
          درصد پیشرفت بر اساس XP ماموریت‌ها و پاداش مراحل محاسبه می‌شود؛ XP همه مسیرها در یک
          سیستم امتیاز مشترک جمع می‌شود و به سطح کلی تو اضافه می‌گردد.
        </div>
      </Panel>
    </div>
  );
}

function MiniBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-white/60 p-3 dark:bg-white/5">
      <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-lg font-extrabold tabular-nums", accent)}>{value}</div>
    </div>
  );
}
