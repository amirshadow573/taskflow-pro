/**
 * First steps — Phase 09 (onboarding-aware empty state).
 *
 * A returning-empty account should never show «داده‌ای وجود ندارد». This shows
 * at most three light, real steps — each with its TRUE completion state derived
 * from the user's data — and disappears as soon as the account has content.
 */
import { Link } from "react-router";
import { useMemo } from "react";
import { ArrowLeft, Check, FolderKanban, ListPlus, Route } from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { useGoals } from "@/hooks/use-goals";
import { Panel } from "@/components/progress/progress-ui";
import { Button } from "@/components/ui/button";
import { addDaysKey, todayKey } from "@/lib/task-utils";
import { toFa } from "@/lib/persian";

export function FirstSteps() {
  const { tasks, projects } = useWorkspace();
  const goals = useGoals();

  const state = useMemo(() => {
    const hasTasks = tasks.some((t) => !t.parentId);
    const hasProjects = projects.length > 0;
    const week = addDaysKey(7);
    const hasPlan = tasks.some(
      (t) => !t.parentId && !!t.dueDate && t.dueDate >= todayKey() && t.dueDate <= week,
    );
    return { hasTasks, hasProjects, hasPlan, hasGoals: (goals ?? []).length > 0 };
  }, [tasks, projects, goals]);

  // Only for a genuinely fresh workspace — a returning user never sees this.
  if (state.hasTasks || state.hasProjects) return null;

  const steps = [
    {
      key: "task",
      label: "اولین کارت را بنویس",
      hint: "کاری که امروز می‌خواهی انجام دهی",
      done: false,
      icon: ListPlus,
      action: (
        <Button
          size="sm"
          onClick={() => window.dispatchEvent(new CustomEvent("quick-add-task"))}
        >
          افزودن کار
        </Button>
      ),
    },
    {
      key: "project",
      label: "یک پروژه بساز",
      hint: "پروژه‌ها نتیجه‌های بزرگ‌تر را قابل پیگیری می‌کنند",
      done: false,
      icon: FolderKanban,
      action: (
        <Button asChild size="sm" variant="outline">
          <Link to="/projects">
            ساخت پروژه
            <ArrowLeft className="size-3.5" />
          </Link>
        </Button>
      ),
    },
    {
      key: "plan",
      label: "برای هفته برنامه بچین",
      hint: "تقویم را باز کن و کارها را تاریخ‌دار کن",
      done: state.hasPlan,
      icon: Route,
      action: (
        <Button asChild size="sm" variant="outline">
          <Link to="/planning">
            برنامه‌ریزی
            <ArrowLeft className="size-3.5" />
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <Panel
      title="شروع کار"
      icon={<Route className="size-4 text-primary" aria-hidden />}
      description="فقط سه قدم کوچک — هر وقت خواستی می‌توانی بعداً کاملش کنی."
    >
      <ol className="space-y-2">
        {steps.map((s) => (
          <li
            key={s.key}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-white/50 px-3 py-2.5 dark:bg-white/5"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <s.icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-extrabold">{s.label}</span>
              <span className="block text-[10px] text-muted-foreground">{s.hint}</span>
            </span>
            {s.done ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                <Check className="size-3.5" aria-hidden />
                انجام شد
              </span>
            ) : (
              s.action
            )}
          </li>
        ))}
      </ol>
      {state.hasGoals && (
        <p className="mt-2.5 text-[10px] text-muted-foreground">
          {toFa(1)} هدف فعال داری — با ساخت پروژه، آن را به کارهای واقعی وصل کن.
        </p>
      )}
    </Panel>
  );
}
