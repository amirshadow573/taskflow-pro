/**
 * Planning (LEVEL 4) and Longer-term (LEVEL 5) modules — Phase 09.
 *
 * PlanningAhead: tomorrow + the nearest real deadlines (project deadlines and
 * dated tasks). Never auto-fills the schedule — it only surfaces what the
 * user already planned.
 *
 * LongTermGoals: the Goal → Project → Task chain (Goal ← projects ← tasks) with
 * REAL execution progress derived from tasks, plus the active growth path.
 */
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { useMemo } from "react";
import {
  ArrowLeft,
  CalendarClock,
  Flag,
  Route as RouteIcon,
  Target,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { useGoals } from "@/hooks/use-goals";
import { Bar, EmptyHint, Panel, Pill } from "@/components/progress/progress-ui";
import { Button } from "@/components/ui/button";
import { goalExecution, isOpenGoal } from "@/lib/goals";
import { addDaysKey, todayKey } from "@/lib/task-utils";
import { toFa } from "@/lib/persian";

/* ------------------------------------------------------------------ */
/* LEVEL 4 — planning ahead                                            */
/* ------------------------------------------------------------------ */

export function PlanningAhead() {
  const { tasks, projects, openTask } = useWorkspace();
  const t = todayKey();
  const tomorrow = addDaysKey(1);
  const horizon = addDaysKey(7);

  const tomorrowTasks = useMemo(
    () =>
      tasks
        .filter((x) => !x.parentId && x.status !== "done" && x.dueDate === tomorrow)
        .slice(0, 3),
    [tasks, tomorrow],
  );
  const deadlines = useMemo(() => {
    const rows: Array<{ id: string; label: string; day: string; to: string }> = [];
    for (const p of projects) {
      if (p.deadline && p.deadline >= t && p.deadline <= horizon && p.status !== "completed") {
        rows.push({ id: `p-${p._id}`, label: p.name, day: p.deadline, to: `/projects/${p._id}` });
      }
    }
    for (const x of tasks) {
      if (x.parentId || x.status === "done" || !x.dueDate) continue;
      if (x.dueDate <= t || x.dueDate > horizon) continue;
      rows.push({ id: `t-${x._id}`, label: x.title, day: x.dueDate, to: "/tasks" });
    }
    return rows.sort((a, b) => a.day.localeCompare(b.day)).slice(0, 4);
  }, [projects, tasks, t, horizon]);

  if (tomorrowTasks.length === 0 && deadlines.length === 0) return null;

  return (
    <Panel
      title="پیش رو"
      icon={<CalendarClock className="size-4 text-primary" aria-hidden />}
      description="فردا و نزدیک‌ترین موعدها — بدون پر کردن خودکار تقویم"
      action={
        <Button asChild variant="ghost" size="sm">
          <Link to="/calendar">
            تقویم
            <ArrowLeft className="size-3.5" />
          </Link>
        </Button>
      }
    >
      <div className="space-y-3">
        {tomorrowTasks.length > 0 && (
          <ul className="space-y-1.5">
            {tomorrowTasks.map((x) => (
              <li key={x._id}>
                <button
                  type="button"
                  onClick={() => openTask(x._id)}
                  className="flex w-full items-center gap-2 rounded-xl border border-border/60 bg-white/50 px-3 py-2 text-start text-[12px] font-semibold transition-colors hover:border-primary/30 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <Pill toneKey="blue">فردا</Pill>
                  <span className="min-w-0 flex-1 truncate">{x.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {deadlines.length > 0 && (
          <div>
            <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">
              موعدهای این هفته
            </p>
            <ul className="space-y-1.5">
              {deadlines.map((d) => (
                <li key={d.id}>
                  <Link
                    to={d.to}
                    className="flex items-center gap-2 rounded-xl border border-border/60 bg-white/50 px-3 py-2 text-[12px] font-semibold transition-colors hover:border-primary/30 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10"
                  >
                    <Flag className="size-3.5 shrink-0 text-amber-500" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{d.label}</span>
                    <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">
                      {toFa(d.day.slice(5).replace("-", "/"))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* LEVEL 5 — goals → projects → tasks + growth path                    */
/* ------------------------------------------------------------------ */

export function LongTermGoals() {
  const { tasks, projects } = useWorkspace();
  const goals = useGoals();
  const paths = useQuery(api.gamification.pathsOverview);

  const activeGoals = useMemo(
    () => (goals ?? []).filter(isOpenGoal).slice(0, 3),
    [goals],
  );
  const activePath = useMemo(
    () => (paths ?? []).find((p) => p.status === "active") ?? null,
    [paths],
  );

  if (activeGoals.length === 0 && !activePath) return null;

  return (
    <Panel
      title="بلندمدت"
      icon={<Target className="size-4 text-violet-600" aria-hidden />}
      description="هدف ← پروژه ← کار — پیشرفت واقعی از روی کارها"
    >
      <div className="space-y-3">
        {activeGoals.length === 0 && (
          <EmptyHint>
            هدفی ثبت نشده — با تعریف هدف، پروژه‌ها و کارها به آن معنا پیدا می‌کنند.
          </EmptyHint>
        )}
        {activeGoals.map((g) => {
          const exec = goalExecution(g.ref, projects, tasks);
          return (
            <div
              key={g.ref}
              className="rounded-xl border border-border/60 bg-white/50 p-3 dark:bg-white/5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[12px] font-extrabold">{g.title}</span>
                {g.dueDate && (
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    موعد {toFa(g.dueDate.slice(5).replace("-", "/"))}
                  </span>
                )}
              </div>
              {exec.executionPct >= 0 ? (
                <>
                  <Bar pct={exec.executionPct} toneKey="violet" className="mt-2 h-1.5" />
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    اجرا: {toFa(exec.doneTasks)} از {toFa(exec.totalTasks)} کار
                    {exec.projects.length > 0 && (
                      <> · {toFa(exec.projects.length)} پروژه</>
                    )}
                  </p>
                  {exec.projects.length > 0 && (
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {exec.projects.map((p) => (
                        <li key={p.project._id}>
                          <Link
                            to={`/projects/${p.project._id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-1.5 py-0.5 text-[10px] font-bold hover:border-primary/40"
                          >
                            <span
                              className="size-1.5 rounded-full"
                              style={{ background: p.project.color ?? "var(--primary)" }}
                              aria-hidden
                            />
                            {p.project.name}
                            <span className="tabular-nums opacity-70">
                              {toFa(p.pct)}٪
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  هنوز پروژه‌ای به این هدف وصل نشده — برای دیدن پیشرفت واقعی،{" "}
                  یک پروژه بساز و آن را به هدف وصل کن.
                </p>
              )}
            </div>
          );
        })}

        {activePath && (
          <Link
            to={`/progress/paths/${activePath.key}`}
            className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 transition-colors hover:bg-primary/10"
          >
            <RouteIcon className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-extrabold">
                مسیر: {activePath.title}
              </span>
              <span className="block text-[10px] text-muted-foreground">
                مرحله {toFa(activePath.stageIndex + 1)} از {toFa(activePath.stageCount)} ·{" "}
                {toFa(activePath.progressPct)}٪
              </span>
            </span>
            <ArrowLeft className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        )}
      </div>
    </Panel>
  );
}
