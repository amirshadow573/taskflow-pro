import { Link } from "react-router";
import { ArrowLeft, Route } from "lucide-react";
import { toFa } from "@/lib/persian";
import { Button } from "@/components/ui/button";
import { Bar, Pill } from "./progress-ui";
import { useProgress } from "./ProgressProvider";

/**
 * Active growth paths on the dashboard. Reads straight from the progression
 * snapshot the provider already subscribes to — no extra round trip — and
 * renders nothing when the user has not joined a path yet.
 */
export function ActivePathsStrip() {
  const p = useProgress();
  const paths = p?.activePaths ?? [];
  if (paths.length === 0) return null;

  return (
    <section className="ui-surface overflow-hidden rounded-2xl">
      <header className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <span className="ui-icon-tile size-6">
            <Route className="size-3.5 text-primary" />
          </span>
          مسیرهای رشد فعال
        </h2>
        <Link to="/progress?tab=paths">
          <Button variant="ghost" size="sm">
            همه مسیرها
            <ArrowLeft className="size-3.5" />
          </Button>
        </Link>
      </header>

      <ul className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {paths.map((path) => (
          <li key={path.pathKey}>
            <Link
              to={`/progress/paths/${path.pathKey}`}
              className="ui-surface ui-surface-hover flex h-full flex-col gap-2.5 rounded-2xl p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-lg">
                  {path.emoji}
                </span>
                <Pill toneKey="slate">
                  مرحله {toFa(path.stageIndex + 1)}/{toFa(path.stageCount)}
                </Pill>
              </div>

              <div className="min-w-0">
                <h3 className="truncate text-[13px] font-extrabold">{path.title}</h3>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {path.stageTitle}
                </p>
              </div>

              <div className="mt-auto">
                <Bar pct={path.progressPct} toneKey="violet" className="h-1.5" />
                <div className="mt-1.5 flex items-center justify-between text-[10px] font-semibold tabular-nums text-muted-foreground">
                  <span>{toFa(path.progressPct)}٪</span>
                  <span>
                    {toFa(path.xpEarned.toLocaleString("en-US"))} /{" "}
                    {toFa(path.xpTotal.toLocaleString("en-US"))} XP
                  </span>
                </div>
                {path.nextStageTitle && (
                  <p className="mt-1.5 truncate text-[10px] text-muted-foreground">
                    بعدی: {path.nextStageTitle}
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
