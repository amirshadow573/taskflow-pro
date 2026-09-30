/**
 * Visual Timeline (Phase 17) — the time grid.
 *
 * Chronological axis on the vertical (top = earlier, always), days as
 * columns. In RTL the columns read right-to-left like the rest of the app,
 * but the TIME axis is never mirrored: 07:00 is above 08:00 in every layout
 * and every language (§39).
 *
 * Layout (§30, §40): one CSS grid holds the sticky time axis, the sticky day
 * header row and the day columns. On desktop the week fills the width; on a
 * phone the grid keeps a minimum column width and scrolls HORIZONTALLY, so
 * seven days are never crushed into seven unreadable slivers, and the time
 * axis stays pinned while you scroll.
 *
 * Interaction (§14–§19, §42):
 *   - Click an empty slot  → opens the create sheet, pre-filled with that
 *     exact time. Available on mouse, touch and keyboard.
 *   - Drag a block        → moves it in time (and across days in Week view),
 *     snapped to the grid, previewed live, then validated by the EXISTING
 *     ConflictService before anything is written.
 *   - Resize a block      → drags its top or bottom edge, same snap + rules.
 *   - On touch, a drag starts after a short hold so vertical scrolling of
 *     the grid still works with a finger.
 *
 * Nothing is written optimistically: if validation fails, or the write
 * throws, the block stays where it is and the reason is shown (§49). The UI
 * is never left disagreeing with the database.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { toFa, WEEKDAYS_SHORT, formatJalaliShort } from "@/lib/persian";
import { todayKey } from "@/lib/task-utils";
import type { FixedCommitment } from "@/lib/scheduling";
import type { SchedulePrefs } from "@/lib/preferences";
import { TimelineActivityCard } from "@/components/timeline/TimelineActivityCard";
import {
  PX_PER_MINUTE,
  TIMELINE_SNAP_MINUTES,
  gridLines,
  minutesOf,
  minutesToY,
  nowMinutes,
  snapMinutes,
  timeFa,
  visibleWindow,
  windowHeight,
} from "@/lib/timeline/timeline-grid";
import {
  hhmm,
  layoutDay,
  snapMove,
  snapResize,
  validateMove,
  type TimelineActivity,
  type TimelineBlockRow,
  type TimelineContext,
} from "@/lib/timeline/timeline-model";

/** Hold duration before a touch drag begins, so scrolling still works. */
const TOUCH_HOLD_MS = 240;
/** A drag is "real" past this many pixels; below it the tap opens the sheet. */
const DRAG_THRESHOLD_PX = 5;
/** Minimum day-column width — below this a week column is unreadable (§30). */
const MIN_COL_PX = 150;
/** Width of the time axis column. */
const AXIS_PX = 56;

type DragMode = "move" | "resize-start" | "resize-end";

interface DragState {
  key: string;
  blockId: string;
  mode: DragMode;
  originDay: string;
  startY: number;
  startX: number;
  original: { start: number; end: number; day: string };
  /** Live preview while the pointer is down. */
  preview: { start: number; end: number; day: string };
  pointerId: number;
}

export interface TimelineGridProps {
  dayKeys: string[];
  activitiesByDay: Map<string, TimelineActivity[]>;
  commitmentsByDay: Map<string, FixedCommitment[]>;
  blocksByDay: Map<string, TimelineBlockRow[]>;
  context: TimelineContext;
  /** The user's real availability window + buffers (§8) — never invented. */
  prefs: SchedulePrefs;
  /** 7 = week columns, 1 = day column. */
  columns: number;
  onOpenActivity: (activity: TimelineActivity) => void;
  onCreateAt: (day: string, start: number, end: number) => void;
  onMoveBlock: (
    blockId: Id<"timeBlocks">,
    patch: { day: string; startTime: string; endTime: string },
  ) => Promise<void>;
  onToggleTask: (activity: TimelineActivity) => void;
}

export function TimelineGrid({
  dayKeys,
  activitiesByDay,
  commitmentsByDay,
  blocksByDay,
  context,
  prefs,
  columns,
  onOpenActivity,
  onCreateAt,
  onMoveBlock,
  onToggleTask,
}: TimelineGridProps) {
  const today = todayKey();
  const scrollRef = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const movedRef = useRef(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [now, setNow] = useState(() => nowMinutes());

  /* Re-render periodically so the "now" line advances on its own (§27). */
  useEffect(() => {
    const t = setInterval(() => setNow(nowMinutes()), 30_000);
    return () => clearInterval(t);
  }, []);

  /* ---- visible window: the user's own availability, widened to content --- */
  const win = useMemo(() => {
    const spans: { start: number; end: number }[] = [];
    for (const day of dayKeys) {
      for (const a of activitiesByDay.get(day) ?? []) spans.push({ start: a.start, end: a.end });
    }
    return visibleWindow(
      {
        start: minutesOf(prefs.dayStart) ?? 8 * 60,
        end: minutesOf(prefs.dayEnd) ?? 22 * 60,
      },
      spans,
    );
  }, [dayKeys, activitiesByDay, prefs]);

  const lines = useMemo(() => gridLines(win, TIMELINE_SNAP_MINUTES), [win]);
  const height = windowHeight(win);

  const placedByDay = useMemo(() => {
    const map = new Map<string, ReturnType<typeof layoutDay>>();
    for (const day of dayKeys) {
      map.set(day, layoutDay(activitiesByDay.get(day) ?? [], win));
    }
    return map;
  }, [dayKeys, activitiesByDay, win]);

  const totalCount = useMemo(
    () => dayKeys.reduce((n, d) => n + (activitiesByDay.get(d)?.length ?? 0), 0),
    [dayKeys, activitiesByDay],
  );

  /* ---- scroll to "now" once, on first paint ---------------------------- */
  const didScroll = useRef(false);
  useEffect(() => {
    if (didScroll.current || !scrollRef.current) return;
    didScroll.current = true;
    const el = scrollRef.current;
    el.scrollTop = Math.max(0, minutesToY(now - win.start) - el.clientHeight / 3);
  }, [now, win.start]);

  /* ---- conflict validation via the existing ConflictService ----------- */
  const validate = useCallback(
    (blockId: string, day: string, start: number, end: number): string[] => {
      const row =
        (blocksByDay.get(day) ?? []).find((b) => b._id === blockId) ??
        [...blocksByDay.values()].flat().find((b) => b._id === blockId);
      if (!row) return [];
      const tasksById = new Map(
        context.tasks.map((t) => [
          t._id,
          {
            title: t.title,
            estimateMinutes: t.estimateMinutes,
            dueDate: t.dueDate,
            status: t.status,
          },
        ]),
      );
      const { blocking } = validateMove({
        day,
        prefs,
        block: row,
        activities: activitiesByDay.get(day) ?? [],
        commitments: commitmentsByDay.get(day) ?? [],
        tasksById,
        proposal: { day, start, end },
      });
      return blocking.map((c) => c.detail);
    },
    [blocksByDay, context.tasks, activitiesByDay, commitmentsByDay, prefs],
  );

  /* ---- pointer interaction ------------------------------------------- */
  const beginDrag = useCallback(
    (activity: TimelineActivity, mode: DragMode, e: React.PointerEvent) => {
      if (activity.fixed || !activity.blockId) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      const start = () => {
        movedRef.current = false;
        setDrag({
          key: activity.key,
          blockId: activity.blockId!,
          mode,
          originDay: activity.day,
          startY: e.clientY,
          startX: e.clientX,
          original: { start: activity.start, end: activity.end, day: activity.day },
          preview: { start: activity.start, end: activity.end, day: activity.day },
          pointerId: e.pointerId,
        });
      };

      if (e.pointerType === "mouse") {
        start();
        return;
      }
      // Touch / pen: hold briefly so a vertical swipe still scrolls the grid.
      holdTimer.current = setTimeout(start, TOUCH_HOLD_MS);
    },
    [],
  );

  /* Clear a pending touch-hold if the finger lifts before it fires. */
  useEffect(() => {
    const cancel = () => {
      if (holdTimer.current) {
        clearTimeout(holdTimer.current);
        holdTimer.current = null;
      }
    };
    window.addEventListener("pointerup", cancel);
    window.addEventListener("pointercancel", cancel);
    return () => {
      cancel();
      window.removeEventListener("pointerup", cancel);
      window.removeEventListener("pointercancel", cancel);
    };
  }, []);

  useEffect(() => {
    if (!drag) return;

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      const dy = e.clientY - drag.startY;
      const dx = e.clientX - drag.startX;
      if (Math.abs(dy) > DRAG_THRESHOLD_PX || Math.abs(dx) > DRAG_THRESHOLD_PX) {
        movedRef.current = true;
      }
      const deltaMinutes = dy / PX_PER_MINUTE;

      // Week view: horizontal movement changes the DAY column. The grid's
      // measured width minus the pinned axis gives the real column pitch.
      let day = drag.original.day;
      if (columns > 1) {
        const grid = scrollRef.current?.firstElementChild as HTMLElement | null;
        const colWidth = grid ? (grid.clientWidth - AXIS_PX) / columns : 0;
        if (colWidth > 0) {
          const colDelta = Math.round(dx / colWidth);
          const index = dayKeys.indexOf(drag.original.day) + colDelta;
          day = dayKeys[Math.max(0, Math.min(dayKeys.length - 1, index))];
        }
      }

      setDrag((d) => {
        if (!d) return d;
        const base = { start: d.original.start, end: d.original.end };
        const next =
          d.mode === "move"
            ? snapMove(base, deltaMinutes, win)
            : snapResize(base, d.mode === "resize-start" ? "start" : "end", deltaMinutes, win);
        return { ...d, preview: { ...next, day } };
      });
    };

    const onUp = () => {
      const d = drag;
      setDrag(null);
      if (!d) return;
      const next = d.preview;
      const unchanged =
        next.start === d.original.start &&
        next.end === d.original.end &&
        next.day === d.original.day;

      // `click` fires after `pointerup`; clear the flag on the next tick so a
      // real drag never also opens the editor.
      setTimeout(() => {
        movedRef.current = false;
      }, 0);

      if (unchanged || !movedRef.current) return;

      const problems = validate(d.blockId, next.day, next.start, next.end);
      if (problems.length > 0) {
        // The draft is simply discarded, so the block visually snaps back and
        // the reason is shown — nothing is silently overwritten (§18, §49).
        toast.error(problems[0], { duration: 6000 });
        return;
      }
      void onMoveBlock(d.blockId as Id<"timeBlocks">, {
        day: next.day,
        startTime: hhmm(next.start),
        endTime: hhmm(next.end),
      }).catch((err) => {
        toast.error(
          `تغییر ذخیره نشد: ${err instanceof Error ? err.message : "خطای نامشخص"}`,
        );
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [drag, columns, dayKeys, win, validate, onMoveBlock]);

  /** Open the editor — ignored when the pointer just finished a drag. */
  const openActivity = useCallback(
    (activity: TimelineActivity) => {
      if (movedRef.current) return;
      onOpenActivity(activity);
    },
    [onOpenActivity],
  );

  /** Click on empty grid space → create at that exact time (§14 method 1). */
  const onGridClick = (day: string, e: React.MouseEvent<HTMLDivElement>) => {
    if (drag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const start = snapMinutes(win.start + (e.clientY - rect.top) / PX_PER_MINUTE);
    onCreateAt(day, start, start + 60);
  };

  const isWeek = columns > 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Both axes scroll from one container so the pinned time column and
          the pinned day header stay put while the grid pans. */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-auto overscroll-contain bg-app-bg"
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: `${AXIS_PX}px repeat(${columns}, minmax(0, 1fr))`,
            gridTemplateRows: `auto ${height}px`,
            minWidth: isWeek ? `${AXIS_PX + columns * MIN_COL_PX}px` : undefined,
          }}
        >
          {/* corner */}
          <div
            style={{ gridColumn: 1, gridRow: 1 }}
            className="sticky start-0 top-0 z-30 border-e border-b border-border/60 bg-app-bg py-2 text-center text-[10px] font-bold text-muted-foreground"
          >
            ساعت
          </div>

          {/* day headers */}
          {dayKeys.map((day, i) => {
            const d = new Date(`${day}T00:00:00`);
            const isToday = day === today;
            return (
              <div
                key={day}
                style={{ gridColumn: i + 2, gridRow: 1 }}
                className={cn(
                  "sticky top-0 z-20 border-e border-b border-border/60 bg-app-bg px-1 py-2 text-center last:border-e-0",
                  isToday && "bg-primary/5",
                )}
              >
                <div
                  className={cn(
                    "truncate text-[12px] font-extrabold",
                    isToday ? "text-primary" : "text-foreground",
                  )}
                >
                  {WEEKDAYS_SHORT[d.getDay()]}
                  {isToday && <span className="ms-1 text-[10px]">امروز</span>}
                </div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {formatJalaliShort(d)}
                </div>
              </div>
            );
          })}

          {/* time axis */}
          <div
            style={{ gridColumn: 1, gridRow: 2 }}
            className="sticky start-0 z-10 border-e border-border/60 bg-app-bg"
          >
            {lines.map((l) => (
              <div
                key={l.minutes}
                className="absolute end-1 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground"
                style={{ top: `${l.y}px` }}
              >
                {l.labelled ? toFa(timeFa(l.minutes)) : ""}
              </div>
            ))}
          </div>

          {/* day columns */}
          {dayKeys.map((day, i) => {
            const isToday = day === today;
            return (
              <div
                key={day}
                style={{ gridColumn: i + 2, gridRow: 2 }}
                className={cn(
                  "relative border-e border-border/60 last:border-e-0",
                  isToday && "bg-primary/[0.03]",
                )}
              >
                {/* grid lines + click-to-create surface */}
                <div
                  role="presentation"
                  onClick={(e) => onGridClick(day, e)}
                  className="absolute inset-0"
                >
                  {lines.map((l) => (
                    <div
                      key={l.minutes}
                      className={cn(
                        "absolute inset-x-0 border-t",
                        l.labelled ? "border-border/70" : "border-dashed border-border/35",
                      )}
                      style={{ top: `${l.y}px` }}
                    />
                  ))}
                </div>

                {/* "now" line (§27) — only on today's column */}
                {isToday && now >= win.start && now <= win.end && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                    style={{ top: `${minutesToY(now - win.start)}px` }}
                    aria-hidden="true"
                  >
                    <span className="size-2 shrink-0 rounded-full bg-destructive" />
                    <span className="h-px flex-1 bg-destructive/70" />
                    <span className="shrink-0 bg-destructive px-1 text-[9px] font-bold text-white">
                      {toFa(timeFa(now))}
                    </span>
                  </div>
                )}

                {/* activities */}
                {(placedByDay.get(day) ?? []).map((activity) => {
                  const preview = drag && drag.key === activity.key ? drag.preview : null;
                  const isNowActivity =
                    isToday &&
                    activity.start <= now &&
                    now < activity.end &&
                    activity.status !== "cancelled";
                  return (
                    <TimelineActivityCard
                      key={activity.key}
                      activity={activity}
                      persona={context.persona}
                      isNow={isNowActivity}
                      isDragging={Boolean(preview)}
                      preview={preview ? { start: preview.start, end: preview.end } : null}
                      onOpen={openActivity}
                      onToggleTask={onToggleTask}
                      onPointerDownBody={(e) => beginDrag(activity, "move", e)}
                      onPointerDownResize={(edge) => (e) =>
                        beginDrag(activity, edge === "start" ? "resize-start" : "resize-end", e)
                      }
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {totalCount === 0 && (
        <p className="shrink-0 border-t border-border/60 bg-app-bg px-4 py-2 text-center text-[11px] text-muted-foreground">
          هیچ برنامه‌ای برای این بازه ثبت نشده است. روی یک ساعت خالی کلیک کن یا «+ افزودن برنامه» را بزن.
        </p>
      )}
    </div>
  );
}
