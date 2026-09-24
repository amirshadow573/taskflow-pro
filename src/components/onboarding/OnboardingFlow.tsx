import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { toFa } from "@/lib/persian";
import { ONBOARDING_PERSONAS, GOALS_BY_PERSONA, PLANNING_STYLES, PRODUCTIVITY_STYLES, buildDashboardConfig, switchTestPersona, type PersonaKey } from "@/lib/personas";
import { useUserProfile } from "@/hooks/use-user-profile";
import { readStartPage } from "@/lib/preferences";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Book,
  Calendar,
  Check,
  Clock,
  Flag,
  Folder,
  ListChecks,
  Loader2,
  PartyPopper,
  Sparkles,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { cn } from "@/lib/utils";

/** Catalog icon name → component (keeps personas.ts UI-free). */
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  book: Book,
  target: Target,
  list: ListChecks,
  calendar: Calendar,
  flag: Flag,
  folder: Folder,
  users: Users,
  clock: Clock,
  zap: Zap,
  sparkles: Sparkles,
};

function Icon({ name, className }: { name: string; className?: string }) {
  const C = ICONS[name] ?? Sparkles;
  return <C className={className} />;
}

const TOTAL_STEPS = 5;

/**
 * Phase 2 — personalized onboarding (welcome → persona → goals → work
 * style → workspace generation). Persona-adaptive goals, RTL, animated
 * step transitions, fully responsive.
 */
export default function OnboardingFlow() {
  const { user } = useAuth();
  const { createTask, createProject } = useWorkspace();
  const { saveProfile, testMode } = useUserProfile();
  const updateName = useMutation(api.profile.updateName);
  const navigate = useNavigate();

  const [step, setStep] = useState(0); // 0 welcome · 1 persona · 2 goals · 3 style · 4 result
  const [dir, setDir] = useState<1 | -1>(1); // animation direction (RTL: +1 slides left)
  const [saving, setSaving] = useState(false);

  // Answers
  const [name, setName] = useState(user?.name ?? "");
  const [personaKey, setPersonaKey] = useState<PersonaKey | null>(null);
  const [goals, setGoals] = useState<string[]>([]);
  const [planningStyle, setPlanningStyle] = useState<string | null>(null);
  const [productivityStyle, setProductivityStyle] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [projectName, setProjectName] = useState("");

  const goalOptions = personaKey ? GOALS_BY_PERSONA[personaKey] : [];

  const canContinue = useMemo(() => {
    if (step === 1) return !!personaKey;
    if (step === 2) return goals.length > 0;
    if (step === 3) return !!planningStyle && !!productivityStyle;
    return true;
  }, [step, personaKey, goals, planningStyle, productivityStyle]);

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  /**
   * Audit fix: skipping onboarding navigated away WITHOUT persisting
   * `completedOnboarding`, so the onboarding gate treated the user as a new
   * account and the flow re-appeared on every later visit to /onboarding.
   */
  const skipOnboarding = async () => {
    try {
      await saveProfile({ completedOnboarding: true });
    } catch {
      /* non-fatal — still leave the flow */
    }
    localStorage.setItem("taskly-onboarded", "1");
    navigate(readStartPage());
  };

  const toggleGoal = (key: string) =>
    setGoals((g) => (g.includes(key) ? g.filter((k) => k !== key) : [...g, key]));

  /** Persist everything, then show the personalized-result step. */
  const finishOnboarding = async () => {
    if (!personaKey || saving) return;
    setSaving(true);
    try {
      const config = buildDashboardConfig({
        personaKey,
        goals,
        workStyle: {
          planningStyle: (planningStyle ?? null) as never,
          productivityStyle: (productivityStyle ?? null) as never,
        },
      });

      if (testMode) {
        // Audit fix: in test mode every Convex mutation throws "Not
        // authenticated", so onboarding always fell into the catch and the
        // user's persona was never saved. Persist locally instead.
        switchTestPersona(personaKey);
        localStorage.setItem("taskly-test-dashboard", JSON.stringify(config));
        localStorage.setItem("taskly-onboarded", "1");
        go(4);
        return;
      }

      if (name.trim() && name !== (user?.name ?? "")) {
        try {
          await updateName({ name });
        } catch {
          /* non-fatal */
        }
      }
      if (projectName.trim()) await createProject({ name: projectName });
      if (taskTitle.trim()) {
        await createTask({ title: taskTitle, priority: "medium", status: "todo" });
      }

      await saveProfile({
        personaKey,
        personaSource: "onboarding",
        goals,
        workStyle: planningStyle ?? undefined,
        productivityStyle: productivityStyle ?? undefined,
        dashboardConfig: JSON.stringify(config),
        completedOnboarding: true,
      });

      localStorage.setItem("taskly-onboarded", "1");
      go(4);
    } catch {
      // Never trap the user in onboarding — but say why it happened.
      toast.error("ذخیره شخصی‌سازی کامل نشد؛ فعلاً با تنظیمات پیش‌فرض ادامه می‌دهی.");
      localStorage.setItem("taskly-onboarded", "1");
      navigate("/dashboard");
    } finally {
      setSaving(false);
    }
  };

  /** Generation transition shown while data persists (Step 5). */
  const generating = saving;

  const checklist = [
    { label: "نمایش اطلاعات شما", done: step >= 4 || !!personaKey },
    { label: "انتخاب نوع و اهداف مناسب", done: step >= 4 || goals.length > 0 },
    { label: "تنظیم امکانات و ابزارها", done: step >= 4 || !!planningStyle },
    { label: "آماده‌سازی داشبورد", done: step >= 4 },
  ];

  return (
    <div className="grid min-h-svh place-items-center bg-background p-4">
      <div className="ui-surface w-full max-w-2xl overflow-hidden rounded-3xl">
        {/* Progress header — visible from the persona step on */}
        {step > 0 && (
          <div className="border-b border-border/60 px-5 py-3.5">
            <div className="flex items-center justify-between">
              <button
                onClick={() => go(step - 1)}
                disabled={saving}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                aria-label="مرحله قبل"
              >
                <ArrowRight className="size-3.5" />
                بازگشت
              </button>
              <span className="text-xs font-bold text-muted-foreground tabular-nums">
                {toFa(step)} از {toFa(TOTAL_STEPS)}
              </span>
            </div>
            <div className="mt-2.5 flex gap-1.5" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={TOTAL_STEPS}>
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-all duration-300",
                    i < step
                      ? "bg-gradient-to-l from-primary to-[#5B5FE6]"
                      : "bg-primary/12",
                  )}
                />
              ))}
            </div>
          </div>
        )}

        <div className="relative">
          {/* Step transition animation — subtle, purposeful (RTL slide) */}
          <div
            key={step}
            className={cn(
              "p-5 sm:p-7",
              dir === 1 ? "animate-in slide-in-from-left-4 fade-in duration-300" : "animate-in slide-in-from-right-4 fade-in duration-300",
            )}
          >
            {/* ------------------------------ Step 1 — Welcome */}
            {step === 0 && (
              <div className="text-center">
                <div className="mx-auto mb-5 grid size-16 place-items-center rounded-3xl bg-gradient-to-br from-primary to-[#5B5FE6] text-white shadow-[0_16px_36px_-14px_rgba(37,99,235,0.9)]">
                  <ListChecks className="size-8" />
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                  بیایید فضای کاری شما را بسازیم.
                </h1>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                  با پاسخ به چند سوال، تجربه‌ی ۱۰ برابر بهتری برای شما ایجاد می‌کنیم.
                  فضای کاری مناسب شما را فراهم می‌کنیم.
                </p>
                <div className="mx-auto mt-6 grid max-w-sm gap-2 text-start">
                  {[
                    { icon: Sparkles, text: "داشبورد متناسب با نیازهای شما" },
                    { icon: Target, text: "پیشنهادهای هدفمند، نه عمومی" },
                    { icon: Clock, text: "کل فرایند کمتر از یک دقیقه" },
                  ].map((b) => (
                    <div
                      key={b.text}
                      className="flex items-center gap-3 rounded-2xl border border-border/60 bg-white/50 p-3 dark:bg-white/5"
                    >
                      <span className="ui-icon-tile size-9 shrink-0">
                        <b.icon className="size-4.5 text-primary" />
                      </span>
                      <span className="text-sm font-semibold">{b.text}</span>
                    </div>
                  ))}
                </div>
                <label className="mt-6 block max-w-sm text-start text-sm font-semibold">
                  اسمت چیه؟ <span className="text-xs font-normal text-muted-foreground">(اختیاری)</span>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثلاً سارا"
                    className="mt-1.5 bg-background"
                    onKeyDown={(e) => e.key === "Enter" && go(1)}
                  />
                </label>
                <Button size="lg" className="mt-6 w-full max-w-xs" onClick={() => go(1)}>
                  شروع کنیم
                  <ArrowLeft className="size-4" />
                </Button>
                <button
                  onClick={skipOnboarding}
                  className="mt-3 block w-full text-center text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  رد کردن
                </button>
              </div>
            )}

            {/* ------------------------------ Step 2 — Persona */}
            {step === 1 && (
              <div>
                <h1 className="text-center text-xl font-extrabold tracking-tight sm:text-2xl">
                  بیشتر برای چه کاری از این پلتفرم استفاده می‌کنید؟
                </h1>
                <p className="mx-auto mt-2 max-w-md text-center text-sm leading-6 text-muted-foreground">
                  لطفاً نقش اصلی خود را انتخاب کنید. این به ما کمک می‌کند امکانات
                  ویژه‌ای متناسب با نقش شما فراهم کنیم.
                </p>
                <div className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="انتخاب نقش">
                  {ONBOARDING_PERSONAS.map((p) => (
                    <button
                      key={p.key}
                      role="radio"
                      aria-checked={personaKey === p.key}
                      onClick={() => {
                        setPersonaKey(p.key);
                        setGoals([]); // reset goals — catalog is persona-adaptive
                      }}
                      className={cn(
                        "group relative flex min-h-24 flex-col items-start gap-2 rounded-2xl border p-3.5 text-start transition-all duration-200 focus-visible:outline-2 focus-visible:outline-primary",
                        personaKey === p.key
                          ? "border-primary/50 bg-accent/70 shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
                          : "border-border/70 bg-white/50 hover:border-primary/30 hover:bg-white/80 dark:bg-white/5",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "absolute end-3 top-3 grid size-5 place-items-center rounded-full border-2 transition-colors",
                          personaKey === p.key ? "border-primary bg-primary" : "border-border",
                        )}
                      >
                        {personaKey === p.key && <Check className="size-3 text-white" strokeWidth={3} />}
                      </span>
                      <span className="text-2xl">{p.emoji}</span>
                      <span className="text-sm font-bold leading-5">{p.label}</span>
                      <span className="text-[11px] leading-4 text-muted-foreground">{p.description}</span>
                    </button>
                  ))}
                </div>
                <StepActions onBack={() => go(0)} onNext={() => go(2)} disabled={!canContinue} saving={saving} />
              </div>
            )}

            {/* ------------------------------ Step 3 — Goals (persona-adaptive) */}
            {step === 2 && (
              <div>
                <h1 className="text-center text-xl font-extrabold tracking-tight sm:text-2xl">
                  مهم‌ترین اهدافت کدام‌اند؟
                </h1>
                <p className="mx-auto mt-2 max-w-md text-center text-sm leading-6 text-muted-foreground">
                  می‌توانید چند مورد را انتخاب کنید. بر اساس نقش شما، گزینه‌های
                  متناسب پیشنهاد شده‌اند.
                </p>
                <div className="mt-6 grid gap-2.5 sm:grid-cols-2" role="group" aria-label="انتخاب اهداف">
                  {goalOptions.map((g) => {
                    const selected = goals.includes(g.key);
                    return (
                      <button
                        key={g.key}
                        role="checkbox"
                        aria-checked={selected}
                        onClick={() => toggleGoal(g.key)}
                        className={cn(
                          "flex min-h-20 items-start gap-3 rounded-2xl border p-3.5 text-start transition-all duration-200 focus-visible:outline-2 focus-visible:outline-primary",
                          selected
                            ? "border-primary/50 bg-accent/70 shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
                            : "border-border/70 bg-white/50 hover:border-primary/30 hover:bg-white/80 dark:bg-white/5",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors",
                            selected ? "border-primary bg-primary" : "border-border",
                          )}
                        >
                          {selected && <Check className="size-3 text-white" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 text-sm font-bold">
                            <Icon name={g.icon} className="size-4 shrink-0 text-primary" />
                            {g.label}
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{g.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <StepActions onBack={() => go(1)} onNext={() => go(3)} disabled={!canContinue} saving={saving} />
              </div>
            )}

            {/* ------------------------------ Step 4 — Work style */}
            {step === 3 && (
              <div>
                <h1 className="text-center text-xl font-extrabold tracking-tight sm:text-2xl">
                  چطور دوست دارید برنامه‌ریزی کنید؟
                </h1>
                <p className="mx-auto mt-2 max-w-md text-center text-sm leading-6 text-muted-foreground">
                  بهترین روش برنامه‌ریزی برای شما چیسْت؟
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label="روش برنامه‌ریزی">
                  {PLANNING_STYLES.map((s) => (
                    <button
                      key={s.key}
                      role="radio"
                      aria-checked={planningStyle === s.key}
                      onClick={() => setPlanningStyle(s.key)}
                      className={cn(
                        "flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 text-center transition-all duration-200 focus-visible:outline-2 focus-visible:outline-primary",
                        planningStyle === s.key
                          ? "border-primary/50 bg-accent/70 shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
                          : "border-border/70 bg-white/50 hover:border-primary/30 hover:bg-white/80 dark:bg-white/5",
                      )}
                    >
                      <Icon name={s.icon} className="size-5 text-primary" />
                      <span className="text-sm font-bold">{s.label}</span>
                      <span className="text-[10px] leading-4 text-muted-foreground">{s.description}</span>
                    </button>
                  ))}
                </div>

                <h2 className="mt-7 text-center text-base font-extrabold">
                  سبک بهره‌وری شما مورد علاقه چیسْت؟
                </h2>
                <p className="mx-auto mt-1.5 max-w-md text-center text-xs text-muted-foreground">
                  سبک کاری خود را انتخاب کنید تا فضای کاری متناسب با آن تنظیم شود.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label="سبک بهره‌وری">
                  {PRODUCTIVITY_STYLES.map((s) => (
                    <button
                      key={s.key}
                      role="radio"
                      aria-checked={productivityStyle === s.key}
                      onClick={() => setProductivityStyle(s.key)}
                      className={cn(
                        "flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition-all duration-200 focus-visible:outline-2 focus-visible:outline-primary",
                        productivityStyle === s.key
                          ? "border-primary/50 bg-accent/70 shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
                          : "border-border/70 bg-white/50 hover:border-primary/30 hover:bg-white/80 dark:bg-white/5",
                      )}
                    >
                      <Icon name={s.icon} className="size-4.5 text-primary" />
                      <span className="text-sm font-bold">{s.label}</span>
                      <span className="text-[10px] leading-4 text-muted-foreground">{s.description}</span>
                    </button>
                  ))}
                </div>

                {/* Optional quick start — carried over from the legacy flow */}
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-muted-foreground">
                    اولین کار (اختیاری)
                    <Input
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      placeholder="مثلاً: مطالعه فصل سوم زیست"
                      className="mt-1.5 bg-background"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    اولین پروژه (اختیاری)
                    <Input
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="نام پروژه"
                      className="mt-1.5 bg-background"
                    />
                  </label>
                </div>

                <StepActions onBack={() => go(2)} onNext={finishOnboarding} disabled={!canContinue} saving={saving} nextLabel="ساخت فضای کاری" />
              </div>
            )}

            {/* ------------------------------ Step 5 — Personalization result */}
            {step === 4 && (
              <div className="py-6 text-center">
                {generating ? (
                  <>
                    <Loader2 className="mx-auto size-10 animate-spin text-primary" />
                    <h1 className="mt-4 text-xl font-extrabold">در حال آماده‌سازی فضای کاری شما…</h1>
                    <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                      بر اساس پاسخ‌های شما، یک فضای کاری شخصی‌سازی‌شده ایجاد می‌کنیم.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mx-auto mb-4 grid size-16 place-items-center rounded-3xl border border-emerald-200/80 bg-emerald-50 text-emerald-600 shadow-[0_10px_26px_-14px_rgba(16,185,129,0.9)] dark:border-emerald-500/20 dark:bg-emerald-500/10">
                      <PartyPopper className="size-7" />
                    </div>
                    <h1 className="text-2xl font-extrabold">فضای کاری شما آماده است.</h1>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                      {name.trim() ? `${name.trim()} عزیز، ` : ""}
                      داشبورد شما بر اساس نقش، اهداف و سبک کاری‌ات تنظیم شد.
                    </p>
                    <ul className="mx-auto mt-5 max-w-xs space-y-1.5 text-start">
                      {checklist.map((c) => (
                        <li key={c.label} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span
                            className={cn(
                              "grid size-5 shrink-0 place-items-center rounded-full border-2",
                              c.done ? "border-primary bg-primary" : "border-border",
                            )}
                          >
                            {c.done && <Check className="size-3 text-white" strokeWidth={3} />}
                          </span>
                          {c.label}
                        </li>
                      ))}
                    </ul>
                    <Button size="lg" className="mt-6 w-full max-w-xs" onClick={skipOnboarding}>
                      ورود به داشبورد من
                      <ArrowLeft className="size-4" />
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Shared back/continue footer used by steps 2–4. */
function StepActions({
  onBack,
  onNext,
  disabled,
  saving,
  nextLabel = "ادامه",
}: {
  onBack: () => void;
  onNext: () => void;
  disabled?: boolean;
  saving?: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="mt-7 flex items-center justify-between gap-3 border-t border-border/60 pt-4">
      <Button variant="ghost" onClick={onBack} disabled={saving}>
        بازگشت
      </Button>
      <Button onClick={onNext} disabled={disabled || saving}>
        {saving ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            در حال ذخیره…
          </>
        ) : (
          <>
            {nextLabel}
            <ArrowLeft className="size-4" />
          </>
        )}
      </Button>
    </div>
  );
}
