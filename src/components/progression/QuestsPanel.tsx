/**
 * Quests panel — surfaces the existing Phase 06 quest instances in the Progress
 * Center. Reads `api.quests.list`; every number comes from the stored quest
 * row (progress is derived server-side from real activity, never client-side).
 */
import { useQuery } from "convex/react";
import { Target } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Bar, Panel, Pill } from "@/components/progress/progress-ui";
import { toFa } from "@/lib/persian";

interface QuestRow {
  id: string;
  questKey: string;
  title: string;
  description: string;
  type: string;
  typeLabel: string;
  difficulty: string;
  difficultyLabel: string;
  progress: number;
  target: number;
  xp: number;
  status: string;
  countsText: string | null;
}

export function QuestsPanel() {
  const quests = useQuery(api.quests.list, { limit: 40 });

  if (quests === undefined) {
    return (
      <Panel title="ماموریت‌ها">
        <div className="skeleton h-24 rounded-2xl" />
      </Panel>
    );
  }

  const active = quests.filter((q) => q.status === "active");
  const done = quests.filter((q) => q.status === "completed");

  return (
    <Panel title="ماموریت‌ها">
      <div className="space-y-4">
        {quests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 p-5 text-center">
            <p className="text-sm font-bold">هنوز ماموریتی فعال نیست</p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-6 text-muted-foreground">
              ماموریت‌ها از کارهای واقعی هفته جاری ساخته می‌شوند. وقتی کارها را
              انجام بدهی، ماموریت‌های روزانه و هفتگی اینجا ظاهر می‌شوند.
            </p>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <ul className="space-y-3">
                {active.map((q) => (
                  <QuestItem key={q.id} q={q} />
                ))}
              </ul>
            )}
            {done.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-bold text-muted-foreground">
                  ماموریت‌های انجام‌شده
                </h3>
                <ul className="space-y-2">
                  {done.slice(0, 6).map((q) => (
                    <li
                      key={q.id}
                      className="flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-[12px]"
                    >
                      <Target className="size-3.5 shrink-0 text-emerald-500" />
                      <span className="min-w-0 flex-1 truncate font-semibold">
                        {q.title}
                      </span>
                      <Pill toneKey="emerald">انجام شد</Pill>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

function QuestItem({ q }: { q: QuestRow }) {
  const pct = q.target > 0 ? Math.min(100, Math.round((q.progress / q.target) * 100)) : 0;
  return (
    <li className="rounded-2xl border border-border/60 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-bold">{q.title}</span>
        <Pill toneKey="slate">{q.typeLabel}</Pill>
        <Pill toneKey="amber">{q.difficultyLabel}</Pill>
        <span className="ms-auto text-[11px] font-bold tabular-nums text-muted-foreground">
          {toFa(q.progress)} از {toFa(q.target)}
        </span>
      </div>
      {q.description && (
        <p className="mb-2 text-[11px] leading-5 text-muted-foreground">
          {q.description}
        </p>
      )}
      <Bar pct={pct} toneKey="violet" className="h-2" />
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
        {q.countsText && <span>{q.countsText}</span>}
        <span className="ms-auto">پاداش: {toFa(q.xp)} XP</span>
      </div>
    </li>
  );
}
