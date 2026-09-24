/**
 * Next Action card — Phase 09 (LEVEL 2).
 *
 * Answers «الان چه کاری را شروع کنم؟» with ONE deterministic recommendation
 * derived from real data (see src/lib/next-action.ts). The two next candidates
 * are shown as lightweight alternatives so the user can choose instead of being
 * forced. Architecture resolves through the future-AI provider contract
 * (src/lib/ai/adapters.ts) without any UI change.
 */
import { Link } from "react-router";
import { ArrowLeft, Compass, Play, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { useUserProfile } from "@/hooks/use-user-profile";
import { Pill } from "@/components/progress/progress-ui";
import { Button } from "@/components/ui/button";
import { pickAlternatives, rankActions, type ScoredAction } from "@/lib/next-action";
import { todayKey } from "@/lib/task-utils";
import { toFa } from "@/lib/persian";
import { cn } from "@/lib/utils";

function ActionRow({
  action,
  onOpen,
  projectName,
}: {
  action: ScoredAction;
  onOpen: () => void;
  projectName?: string;
}) {
  const due = action.task.dueDate;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-white/60 px-3 py-2.5 text-start transition-colors hover:border-primary/30 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-[#5B5FE6] text-white">
        <Compass className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold">{action.task.title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
          {projectName ? `پروژه: ${projectName}` : "بدون پروژه"}
          {due ? ` · ${due}` : ""}
        </span>
      </span>
      <Pill toneKey="blue">{action.reason}</Pill>
    </button>
  );
}

export function NextActionCard() {
  const { tasks, projects, openTask } = useWorkspace();
  const { personaKey } = useUserProfile();
  const dayKey = todayKey();

  const ranked = useMemo(
    () => rankActions(tasks, projects, personaKey, dayKey),
    [tasks, projects, personaKey, dayKey],
  );
  const primary = ranked[0];
  const alternatives = pickAlternatives(ranked, primary?.task._id, 2);
  const projectOf = (id?: string) => projects.find((p) => p._id === id);

  if (!primary) {
    return (
      <section className="ui-surface rounded-2xl p-4" aria-label="قدم بعدی">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <span className="ui-icon-tile size-6">
            <Compass className="size-3.5 text-primary" aria-hidden />
          </span>
          قدم بعدی
        </h2>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          کار بازی برای شروع نداری. یک کار برای امروز بنویس، یا برنامه فردا را
          در تقویم بچین — وقتی کاری ثبت شود، اینجا قدم بعدی را پیشنهاد می‌دهد.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent("quick-add-task"))}
          >
            افزودن کار
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/calendar">
              برنامه‌ریزی
              <ArrowLeft className="size-3.5" />
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="ui-surface rounded-2xl p-4" aria-label="قدم بعدی">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <span className="ui-icon-tile size-6">
            <Compass className="size-3.5 text-primary" aria-hidden />
          </span>
          قدم بعدی
        </h2>
        <Pill toneKey="emerald">
          <Sparkles className="size-3" aria-hidden />
          {toFa(Math.round(primary.score))} امتیاز فوریت
        </Pill>
      </header>

      {/* Primary action */}
      <div className="mt-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-primary">پیشنهاد سیستم</p>
            <p className="mt-0.5 text-sm font-extrabold leading-6">
              {primary.task.title}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {primary.reason}
              {primary.task.projectId
                ? ` · پروژه: ${projectOf(primary.task.projectId)?.name ?? "—"}`
                : ""}
            </p>
          </div>
          <Button size="sm" onClick={() => openTask(primary.task._id as never)}>
            <Play className="size-3.5" />
            شروع کن
          </Button>
        </div>
      </div>

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <ul className="mt-3 space-y-2">
          {alternatives.map((a) => (
            <li key={a.task._id}>
              <ActionRow
                action={a}
                onOpen={() => openTask(a.task._id as never)}
                projectName={projectOf(a.task.projectId)?.name}
              />
            </li>
          ))}
        </ul>
      )}
      <p className={cn("mt-3 text-[10px] leading-5 text-muted-foreground")}>
        پیشنهاد بر اساس سررسید، اولویت، زمان‌بندی، پروژه و شرایط فعلی تو محاسبه
        می‌شود — نه حدس.
      </p>
    </section>
  );
}
