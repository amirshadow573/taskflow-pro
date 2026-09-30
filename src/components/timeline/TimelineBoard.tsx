/**
 * Visual Timeline (Phase 17) — the board.
 *
 * Owns the view state (Day / Week), the selected date and the two sheets,
 * and hands the grid nothing but resolved data + callbacks. This is a
 * VIEW + INTERACTION layer: every write goes through the existing
 * `personal.createTimeBlock` / `updateTimeBlock` / `deleteTimeBlock`
 * mutations, and every read comes from the existing tables (§19, §26).
 */
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { useTimeline, type TimelineView } from "@/hooks/use-timeline";
import { toFa, formatJalaliFull } from "@/lib/persian";
import { todayKey } from "@/lib/task-utils";
import { addDays } from "@/lib/timeline/timeline-grid";
import { cn } from "@/lib/utils";
import { TimelineGrid } from "@/components/timeline/TimelineGrid";
import { TimelineActivitySheet } from "@/components/timeline/TimelineActivitySheet";
import { durationFa } from "@/lib/timeline/timeline-grid";
import type { TimelineActivity, TimelineBlockRow } from "@/lib/timeline/timeline-model";

type SheetState =
  | { mode: "create"; draft: { day: string; start: number; end: number; kind?: string } }
  | { mode: "edit"; activity: TimelineActivity }
  | null;

const hhmmOf = (minutes: number): string => {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export function TimelineBoard() {
  const navigate = useNavigate();
  const { tasks, openTask, toggleDone, updateTask } = useWorkspace();
  const [view, setView] = useState<TimelineView>("day");
  const [anchor, setAnchor] = useState<string>(() => todayKey());
  const [sheet, setSheet] = useState<SheetState>(null);

  const tl = useTimeline({ dayKey: anchor, view });

  /**
   * The grid validates a drag against the exact stored row, including its
   * real estimate and `fixed` flag — reconstructed from the activities the
   * adapter already produced, so no second subscription is created.
   */
  const blocksByDay = useMemo(() => {
    const map = new Map<string, TimelineBlockRow[]>();
    for (const day of tl.dayKeys) {
      map.set(
        day,
        (tl.byDay.get(day) ?? [])
          .filter((a) => a.blockId)
          .map(
            (a) =>
              ({
                _id: a.blockId!,
                title: a.title,
                day: a.day,
                startTime: hhmmOf(a.start),
                endTime: hhmmOf(a.end),
                kind: a.kind,
                status: a.status,
                fixed: a.fixed,
                source: a.source ?? "manual",
                taskId: a.taskId,
                color: a.storedColor ?? undefined,
                notes: a.description,
              }) as TimelineBlockRow,
          ),
      );
    }
    return map;
  }, [tl.byDay, tl.dayKeys]);

  /* --- date navigation: the anchor survives Day ↔ Week switches (§6) --- */
  const shift = useCallback(
    (delta: number) => {
      setAnchor((a) => (view === "week" ? addDays(a, delta * 7) : addDays(a, delta)));
    },
    [view],
  );

  const periodLabel = useMemo(() => {
    if (view === "day") return formatJalaliFull(new Date(`${anchor}T00:00:00`));
    const first = tl.dayKeys[0];
    const last = tl.dayKeys[tl.dayKeys.length - 1];
    return `${formatJalaliFull(new Date(`${first}T00:00:00`))} تا ${formatJalaliFull(
      new Date(`${last}T00:00:00`),
    )}`;
  }, [view, anchor, tl.dayKeys]);

  /* --- how much of the visible range is actually committed (§1) ------- */
  const scheduledMinutes = useMemo(() => {
    let total = 0;
    for (const day of tl.dayKeys) {
      for (const a of tl.byDay.get(day) ?? []) total += a.end - a.start;
    }
    return total;
  }, [tl.byDay, tl.dayKeys]);

  /**
   * Completion writes to the REAL task through the shared workspace context,
   * which is the single path every other task surface uses. The Execution
   * Engine, progression and Productivity Intelligence all run off that same
   * mutation, so there is no second completion state anywhere (§34, §45).
   */
  const onToggleTask = useCallback(
    (activity: TimelineActivity) => {
      if (!activity.taskId) return;
      const task = tasks.find((t) => t._id === activity.taskId);
      if (!task) return;
      void toggleDone(task, task.status !== "done");
    },
    [tasks, toggleDone],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ---- Controls (§5, §6, §31) ---- */}
      <div className="app-chrome shrink-0 border-b border-border/60 px-3 py-2 md:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-sm font-extrabold">برنامه زمانی</h1>

          <div className="ms-auto flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              aria-label={view === "week" ? "هفته قبل" : "روز قبل"}
              onClick={() => shift(-1)}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-2.5 text-xs"
              onClick={() => setAnchor(todayKey())}
            >
              امروز
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              aria-label={view === "week" ? "هفته بعد" : "روز بعد"}
              onClick={() => shift(1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
          </div>

          {/* Day / Week switcher — the anchor date is preserved (§6) */}
          <div
            role="tablist"
            aria-label="نمای خط زمانی"
            className="flex items-center gap-0.5 rounded-xl border border-border/60 p-0.5"
          >
            {(["day", "week"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "min-h-9 rounded-lg px-3 text-xs font-bold transition-colors",
                  view === v ? "ui-nav-active" : "text-muted-foreground hover:bg-accent/60",
                )}
              >
                {v === "day" ? "روز" : "هفته"}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            className="h-9"
            onClick={() =>
              setSheet({ mode: "create", draft: { day: anchor, start: 9 * 60, end: 10 * 60 } })
            }
          >
            <CalendarPlus className="size-4" />
            افزودن برنامه
          </Button>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">{periodLabel}</span>
          <span aria-hidden="true">·</span>
          <span>زمان‌بندی‌شده: {toFa(durationFa(scheduledMinutes))}</span>
          <span className="hidden md:inline" aria-hidden="true">·</span>
          <span className="hidden md:inline">
            بازه کاری: {toFa(`${tl.prefs.dayStart} تا ${tl.prefs.dayEnd}`)}
          </span>
        </div>
      </div>

      {/* ---- The grid ---- */}
      <TimelineGrid
        dayKeys={tl.dayKeys}
        activitiesByDay={tl.byDay}
        commitmentsByDay={tl.commitmentsByDay}
        blocksByDay={blocksByDay}
        context={tl.context}
        prefs={tl.prefs}
        columns={tl.dayKeys.length}
        onOpenActivity={(activity) => setSheet({ mode: "edit", activity })}
        onCreateAt={(day, start, end) => setSheet({ mode: "create", draft: { day, start, end } })}
        onMove={async (activity, next) => {
          if (activity.blockId) {
            // SchedulingEngine mutation — the block is the source of truth.
            await tl.updateBlock(activity.blockId as Id<"timeBlocks">, {
              day: next.day,
              startTime: hhmmOf(next.start),
              endTime: hhmmOf(next.end),
              source: "reschedule",
            });
          } else if (activity.taskId) {
            // Derived row: write back onto the task so My Tasks agrees.
            await tl.moveDerivedTask(activity.taskId, next);
          }
        }}
        onToggleTask={onToggleTask}
      />

      {/* ---- Create / edit sheet, remounted per target ---- */}
      {sheet && (
        <TimelineActivitySheet
          key={sheet.mode === "edit" ? `edit:${sheet.activity.key}` : "create"}
          mode={sheet.mode}
          open
          onOpenChange={(next) => {
            if (!next) setSheet(null);
          }}
          draft={sheet.mode === "create" ? sheet.draft : undefined}
          activity={sheet.mode === "edit" ? sheet.activity : null}
          context={tl.context}
          onCreate={tl.createBlock}
          onUpdate={async (id, patch) => {
            try {
              await tl.updateBlock(id, patch);
            } catch (err) {
              toast.error(
                `ذخیره نشد: ${err instanceof Error ? err.message : "خطای نامشخص"}`,
              );
              throw err;
            }
          }}
          onDelete={tl.deleteBlock}
          onUpdateDerived={async (taskId, next) => {
            await tl.moveDerivedTask(taskId, {
              day: next.day,
              start: next.start,
              end: next.end,
            });
            // Title / description live on the task, not the schedule.
            await updateTask(taskId as Id<"tasks">, {
              title: next.title,
              description: next.description ?? null,
            });
          }}
          onToggleTask={onToggleTask}
          onOpenTask={(id) => {
            openTask(id as Id<"tasks">);
            setSheet(null);
          }}
          onOpenProject={(id) => {
            navigate(`/projects/${id}`);
            setSheet(null);
          }}
        />
      )}
    </div>
  );
}
