import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Link } from "react-router";
import { toast } from "sonner";
import { ArrowLeft, Check, Route, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { toFa } from "@/lib/persian";
import { Button } from "@/components/ui/button";
import { Pill } from "./progress-ui";

/**
 * Growth-path missions woven into the normal daily workflow, so an active path
 * does not require opening the progress section every day.
 */
export function TodayPathMissions() {
  const missions = useQuery(api.gamification.todayPathMissions);
  const complete = useMutation(api.gamification.completePathMission);

  if (!missions || missions.length === 0) return null;

  const onManual = async (pathKey: string, id: string, title: string) => {
    try {
      await complete({ pathKey, missionId: id });
      toast.success(`«${title}» ثبت شد ✓`);
    } catch {
      toast.error("ثبت ماموریت انجام نشد.");
    }
  };

  const pathTitle = missions[0]?.pathTitle ?? "";
  const stageTitle = missions[0]?.stageTitle ?? "";

  return (
    <section className="ui-surface overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <span className="ui-icon-tile size-6">
            <Route className="size-3.5 text-primary" />
          </span>
          ماموریت‌های مسیر امروز
        </h2>
        <Link to="/progress">
          <Button variant="ghost" size="sm">
            مسیرها
            <ArrowLeft className="size-3.5" />
          </Button>
        </Link>
      </div>
      <p className="px-4 pt-3 text-[11px] text-muted-foreground">
        {pathTitle}
        {stageTitle ? ` · ${stageTitle}` : ""}
      </p>
      <ul className="space-y-2 p-4 pt-2">
        {missions.map((m) => (
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
              {m.description && (
                <div className="truncate text-[10px] text-muted-foreground">{m.description}</div>
              )}
            </div>
            {m.completed ? (
              <Pill toneKey="emerald">انجام شد</Pill>
            ) : m.kind === "manual" ? (
              <Button size="sm" variant="outline" onClick={() => onManual(m.pathKey, m.id, m.title)}>
                ثبت
              </Button>
            ) : (
              <Pill toneKey="violet">+{toFa(m.xp)} XP</Pill>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
