/**
 * Skills & Evolution panel — Phase 05 data, surfaced in the Progress Center
 * (Phase 09 integration).
 *
 * Reads ONLY the existing `skills.snapshot` / `skills.events` queries — no new
 * progression system, no invented percentages. Every bar is the real derived
 * progress Convex computes from actual activity.
 */
import { useQuery } from "convex/react";
import { Route, Sparkles, TrendingUp } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Bar, Panel, Pill } from "@/components/progress/progress-ui";
import { toFa } from "@/lib/persian";

export function SkillsPanel() {
  const snapshot = useQuery(api.skills.snapshot);
  const events = useQuery(api.skills.events, { limit: 8 });

  if (!snapshot) {
    return (
      <Panel title="مهارت‌ها و مسیر رشد">
        <div className="skeleton h-24 rounded-2xl" />
      </Panel>
    );
  }

  const skills = snapshot.skills ?? [];
  const hasData = skills.some((s) => s.hasData);

  return (
    <Panel title="مهارت‌ها و مسیر رشد">
      <div className="space-y-4">
        {/* Evolution stage */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-white/50 p-3 dark:bg-white/5">
          <span className="ui-icon-tile size-8">
            <Route className="size-4 text-primary" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-muted-foreground">
              مرحله فعلی مسیر
            </p>
            <p className="truncate text-sm font-extrabold">
              {snapshot.stageLabel}
            </p>
          </div>
          <Pill toneKey="violet">
            مرحله {toFa(snapshot.stageIndex + 1)} از {toFa(snapshot.stageCount)}
          </Pill>
        </div>

        {skills.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 p-5 text-center">
            <p className="text-sm font-bold">هنوز داده‌ای نیست</p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-6 text-muted-foreground">
              با انجام کارهای واقعی، مهارت‌هایت به‌تدریج رشد می‌کنند.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {skills.map((s) => (
              <li
                key={s.key}
                className="rounded-2xl border border-border/60 p-3"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13px] font-bold">{s.label}</span>
                  <span className="flex items-center gap-1.5">
                    {s.level > 0 && (
                      <Pill toneKey="blue">سطح {toFa(s.level)}</Pill>
                    )}
                    <span className="text-[11px] font-bold tabular-nums text-muted-foreground">
                      {toFa(Math.round(s.progress))}٪
                    </span>
                  </span>
                </div>
                <Bar
                  pct={Math.min(100, Math.max(0, s.progress))}
                  toneKey={s.hasData ? "violet" : "slate"}
                  className="h-2"
                />
                {!s.hasData && (
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    هنوز فعالیتی برای این مهارت ثبت نشده — با انجام کارهای مرتبط
                    شروع کن.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {hasData && (events ?? []).length > 0 && (
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <TrendingUp className="size-3.5" />
              آخرین رشدها
            </h3>
            <ul className="space-y-1.5">
              {(events ?? []).map((e, i) => (
                <li
                  key={`${e.skillKey}-${e.createdAt}-${i}`}
                  className="flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-[11px]"
                >
                  <Sparkles className="size-3.5 shrink-0 text-amber-500" />
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {e.label ?? e.skillKey}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {e.from > 0 ? `${toFa(e.from)} → ${toFa(e.to)}` : toFa(e.to)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}
