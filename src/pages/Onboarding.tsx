import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { toFa } from "@/lib/persian";
import { ArrowLeft, Check, ListChecks, PartyPopper, Rocket } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { cn } from "@/lib/utils";

const GOALS = [
  { key: "focus", label: "تمرکز روزانه", desc: "کارهای مهم روز را بدون حواس‌پرتی تمام کنم" },
  { key: "study", label: "درس و مطالعه", desc: "برنامه مطالعه منظم داشته باشم" },
  { key: "work", label: "مدیریت کار و پروژه", desc: "پروژه‌های کاری را سازمان‌دهی کنم" },
  { key: "life", label: "زندگی شخصی", desc: "کارهای روزمره و عادت‌ها را نظم بدهم" },
];

const PROJECT_SUGGESTIONS = ["کارهای شخصی", "پروژه کاری", "درس و دانشگاه", "عادت‌های روزانه"];

export default function Onboarding() {
  const { user } = useAuth();
  const { createTask, createProject } = useWorkspace();
  const updateName = useMutation(api.profile.updateName);
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [name, setName] = useState(user?.name ?? "");
  const [goal, setGoal] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [projectName, setProjectName] = useState("");

  const steps = ["خوش آمدی", "هدفت", "اولین کار", "اولین پروژه", "آماده‌ای"];

  const finish = async () => {
    if (name.trim() && name !== (user?.name ?? "")) {
      try {
        await updateName({ name });
      } catch {
        /* non-fatal */
      }
    }
    if (projectName.trim()) {
      await createProject({ name: projectName });
    }
    if (taskTitle.trim()) {
      await createTask({ title: taskTitle, dueDate: undefined, priority: "medium", status: "todo" });
    }
    localStorage.setItem("taskly-onboarded", "1");
    navigate("/dashboard");
  };

  return (
    <div className="grid min-h-svh place-items-center bg-background p-4">
      <div className="ui-surface w-full max-w-lg rounded-3xl p-7">
        {/* Progress dots */}
        <div className="mb-6 flex items-center gap-1.5">
          {steps.map((s, i) => (
            <span
              key={s}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-all duration-300",
                i <= step
                  ? "bg-gradient-to-l from-primary to-[#5B5FE6] shadow-[0_0_10px_-2px_rgba(59,130,246,0.8)]"
                  : "bg-primary/12",
              )}
            />
          ))}
        </div>

        {step === 0 && (
          <div>
            <div className="ui-icon-tile mb-4 size-12 rounded-2xl">
              <ListChecks className="size-6 text-primary" />
            </div>
            <h1 className="text-2xl font-extrabold">سلام! خوش آمدی 👋</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              این‌جا همه کارها، پروژه‌ها و برنامه‌هات یک‌جا جمع می‌شود. فقط چند
              ثانیه وقت می‌گیرد.
            </p>
            <label className="mt-6 block text-sm font-semibold">
              اسمت چیه؟
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثلاً سارا"
                className="mt-1.5"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && setStep(1)}
              />
            </label>
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={() => navigate("/dashboard")}>
                رد کردن
              </Button>
              <Button onClick={() => setStep(1)}>
                ادامه
                <ArrowLeft className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 className="text-2xl font-extrabold">مهم‌ترین هدفت چیه؟</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              بر اساس انتخابت، صفحه داشبورد را مرتب‌تر می‌کنیم.
            </p>
            <div className="mt-5 space-y-2">
              {GOALS.map((g) => (
                <button
                  key={g.key}
                  onClick={() => setGoal(g.key)}
                  aria-pressed={goal === g.key}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl border p-3.5 text-start transition-all duration-200",
                    goal === g.key
                      ? "border-primary/40 bg-accent/70 shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
                      : "border-border/70 bg-white/50 hover:border-primary/30 hover:bg-white/80 dark:bg-white/5",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2",
                      goal === g.key && "border-primary bg-primary",
                    )}
                  >
                    {goal === g.key && <Check className="size-3 text-white" strokeWidth={3} />}
                  </span>
                  <span>
                    <span className="block text-sm font-bold">{g.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{g.desc}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(0)}>
                برگشت
              </Button>
              <Button onClick={() => setStep(2)} disabled={!goal}>
                ادامه
                <ArrowLeft className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-2xl font-extrabold">اولین کارت را بساز</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              هر کاری که امروز یا این روزها ذهنت را درگیر کرده.
            </p>
            <Input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="مثلاً: مطالعه فصل سوم زیست"
              className="mt-5"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && setStep(3)}
            />
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                برگشت
              </Button>
              <Button onClick={() => setStep(3)}>
                {taskTitle.trim() ? "بعدی" : "بعدی (بدون کار)"}
                <ArrowLeft className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="text-2xl font-extrabold">یک پروژه بساز</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              پروژه‌ها جای دسته‌بندی کارهای بزرگ‌تر هستند. یکی از پیشنهادها را
              انتخاب کن یا بنویس.
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {PROJECT_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setProjectName(s)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200",
                    projectName === s
                      ? "border-transparent bg-gradient-to-l from-primary to-[#5B5FE6] text-white shadow-[0_6px_16px_-8px_rgba(37,99,235,0.9)]"
                      : "border-border/70 bg-white/60 hover:border-primary/30 hover:bg-white/90 dark:bg-white/5",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="نام پروژه"
              className="mt-3"
              onKeyDown={(e) => e.key === "Enter" && setStep(4)}
            />
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>
                برگشت
              </Button>
              <Button onClick={() => setStep(4)}>
                بعدی
                <ArrowLeft className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="text-center">
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl border border-emerald-200/80 bg-emerald-50 text-emerald-600 shadow-[0_10px_26px_-14px_rgba(16,185,129,0.9)] dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <PartyPopper className="size-7" />
            </div>
            <h1 className="text-2xl font-extrabold">همه‌چیز آماده است!</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              {name.trim() ? `${name.trim()} عزیز، ` : ""}
              فضای کاری‌ت ساخته شد
              {projectName.trim() && ` با پروژه «${projectName.trim()}»`}
              {taskTitle.trim() && " و اولین کارت"}.
            </p>
            <ul className="mx-auto mt-5 max-w-xs space-y-1.5 text-start">
              {[
                taskTitle.trim() ? `کار: ${taskTitle.trim()}` : null,
                projectName.trim() ? `پروژه: ${projectName.trim()}` : null,
                goal ? `هدف: ${GOALS.find((g) => g.key === goal)?.label}` : null,
              ]
                .filter(Boolean)
                .map((line) => (
                  <li key={line} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="size-3.5 text-emerald-500" />
                    {line}
                  </li>
                ))}
            </ul>
            <Button size="lg" className="mt-6 w-full" onClick={finish}>
              <Rocket className="size-4" />
              ورود به فضای کاری
            </Button>
            <Button variant="ghost" className="mt-2 w-full" onClick={() => setStep(3)}>
              برگشت
            </Button>
          </div>
        )}

        <p className="mt-6 text-center text-[10px] text-muted-foreground">
          قدم {toFa(Math.min(step + 1, 5))} از {toFa(5)} · این مراحل اختیاری است
        </p>
      </div>
    </div>
  );
}
