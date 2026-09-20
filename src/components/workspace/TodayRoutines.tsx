import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Link } from "react-router";
import { toast } from "sonner";
import { ArrowLeft, Check, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { toFa } from "@/lib/persian";
import { todayKey } from "@/lib/task-utils";
import { Button } from "@/components/ui/button";
import { Bar } from "@/components/progress/progress-ui";
import { emitProgressionEvent } from "@/components/progress/ProgressProvider";
import type { Id } from "@/convex/_generated/dataModel";

const MAX_ROUTINES = 3;
const MAX_ITEMS_PER_ROUTINE = 6;

/**
 * Today's routines / habits on the dashboard.
 *
 * Routines already existed but were only reachable from برنامه‌ریزی, which left a
 * gap in the dashboard hierarchy: the user could see tasks but not the habits
 * they were meant to keep. This widget reuses the existing routine queries and
 * the existing check-in mutation (so XP and streaks stay in one pipeline).
 */
export function TodayRoutines() {
  const routines = useQuery(api.routines.listRoutines, {});
  const items = useQuery(api.routines.listAllItems, {});
  const day = todayKey();
  const checkins = useQuery(api.routines.listCheckinsForDay, { day });
  const toggle = useMutation(api.routines.toggleCheckin);

  if (!routines || !items || !checkins) return null;

  const doneSet = new Set(checkins.filter((c) => c.done).map((c) => c.itemId));
  const total = items.length;
  const done = items.filter((i) => doneSet.has(i._id)).length;

  const onToggle = async (itemId: Id<"routineItems">, next: boolean) => {
    try {
      const result = await toggle({ itemId, day, done: next });
      if (result && (result.levelUp || result.unlocked.length > 0)) {
        emitProgressionEvent({
          levelUp: result.levelUp,
          unlocked: result.unlocked,
          xp: result.xp,
        });
      }
    } catch {
      toast.error("ثبت انجام نشد. دوباره تلاش کن.");
    }
  };

  const visible = routines.slice(0, MAX_ROUTINES);

  return (
    <section className="ui-surface overflow-hidden rounded-2xl">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <span className="ui-icon-tile size-6">
            <Repeat className="size-3.5 text-primary" />
          </span>
          روتین‌های امروز
        </h2>
        <div className="flex items-center gap-3">
          {total > 0 && (
            <span className="text-[11px] font-bold tabular-nums text-muted-foreground">
              {toFa(done)} از {toFa(total)} انجام شد
            </span>
          )}
          <Link to="/planning">
            <Button variant="ghost" size="sm">
              برنامه‌ریزی
              <ArrowLeft className="size-3.5" />
            </Button>
          </Link>
        </div>
      </header>

      {routines.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm font-semibold">هنوز روتینی نساخته‌ای</p>
          <p className="mt-1 text-xs text-muted-foreground">
            روتین‌ها کارهای ثابت روزانه‌اند؛ با ساختشان هر روز با یک تیک جلو می‌روی.
          </p>
          <Link to="/planning">
            <Button size="sm" className="mt-4">
              ساخت روتین
            </Button>
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border/50">
          {visible.map((routine) => {
            const routineItems = items
              .filter((i) => i.routineId === routine._id)
              .sort((a, b) => a.sortOrder - b.sortOrder);
            const rDone = routineItems.filter((i) => doneSet.has(i._id)).length;
            const pct = routineItems.length
              ? Math.round((rDone / routineItems.length) * 100)
              : 0;
            const rest = routineItems.length - MAX_ITEMS_PER_ROUTINE;

            return (
              <li key={routine._id} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: routine.colorKey }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold">
                    {routine.title}
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {toFa(rDone)}/{toFa(routineItems.length)}
                  </span>
                </div>

                <Bar pct={pct} toneKey={pct === 100 ? "emerald" : "blue"} className="mt-2 h-1.5" />

                {routineItems.length > 0 && (
                  <ul className="mt-2.5 space-y-1">
                    {routineItems.slice(0, MAX_ITEMS_PER_ROUTINE).map((it) => {
                      const isDone = doneSet.has(it._id);
                      return (
                        <li key={it._id}>
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={isDone}
                            onClick={() => void onToggle(it._id, !isDone)}
                            className="group flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-start transition-colors hover:bg-white/70 dark:hover:bg-white/5"
                          >
                            <span
                              className={cn(
                                "grid size-[18px] shrink-0 place-items-center rounded-full border-2 transition-colors",
                                isDone
                                  ? "border-primary bg-primary text-white"
                                  : "border-border group-hover:border-primary/60",
                              )}
                            >
                              {isDone && <Check className="size-3" strokeWidth={3} />}
                            </span>
                            <span
                              className={cn(
                                "min-w-0 flex-1 truncate text-[13px]",
                                isDone && "text-muted-foreground line-through",
                              )}
                            >
                              {it.title}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {rest > 0 && (
                  <p className="mt-1.5 ps-7 text-[11px] text-muted-foreground">
                    و {toFa(rest)} مورد دیگر — در برنامه‌ریزی
                  </p>
                )}
                {routineItems.length === 0 && (
                  <p className="mt-2 ps-1 text-[11px] text-muted-foreground">
                    برای این روتین کاری اضافه نشده است.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {routines.length > MAX_ROUTINES && (
        <div className="border-t border-border/50 px-4 py-2.5 text-center">
          <Link
            to="/planning"
            className="text-[11px] font-bold text-primary transition-colors hover:text-primary/80"
          >
            {toFa(routines.length - MAX_ROUTINES)} روتین دیگر
          </Link>
        </div>
      )}
    </section>
  );
}
