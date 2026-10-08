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
import { cn } from "@/lib/utils";
import { toFa, WEEKDAYS_SHORT, formatJalaliShort } from "@/lib/persian";
import { todayKey } from "@/lib/task-utils";
import type { FixedCommitment, ScheduleBlock } from "@/lib/scheduling";
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
  activityAsBlock,
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
const MIN_COL_PX = 136;
/** Width of the time axis column. */
const AXIS_PX = 56;

type DragMode = "move" | "resize-start" | "resize-end";

interface DragState {
  key: string;
  blockId: string;
  /** The row being moved — derived task rows have no block, so carry it. */
  activity: TimelineActivity;
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
  /**
   * Persist a completed move/resize. The board routes it: a time-block row
   * goes through the SchedulingEngine mutation, a derived task row goes back
   * onto the task itself.
   */
  onMove: (
    activity: TimelineActivity,
    next: { day: string; start: number; end: number },
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
  onMove,
  onToggleTask,
}: TimelineGridProps) {
  const today = todayKey();
  const scrollRef = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const movedRef = useRef(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [now, setNow] = useState(() => nowMinutes());

  /* ---- drag-to-create on empty space (§28): mouse only, touch keeps tap ---
   * The live range lives in a ref for the pointer handlers and mirrors into
   * state purely for the preview highlight. */
  const creatingRef = useRef<{ day: string; start: number; end: number } | null>(null);
  const createMovedRef = useRef(false);
  const [creating, setCreating] = useState<{ day: string; start: number; end: number } | null>(
    null,
  );

  /* Re-render periodically so the "now" line advances on its own (§27). */
  useEffect(() => {
    const t = setInterval(() => setNow(nowMinutes()), 30_000);
    return () => clearInterval(t);
  }, []);

  /* ---- fixed 24-hour day cycle: 05:00 → 05:00 next day ------------- */
  const TIMELINE_START = 5 * 60;
  const TIMELINE_END = 29 * 60;

  const win = useMemo(() => {
    // The visual day always spans a full 24 hours, starting at 05:00.
    // Existing stored tasks remain in normal 00:00–24:00 minutes; tasks
    // before 05:00 are rendered after midnight at the bottom of the cycle.
    return { start: TIMELINE_START, end: TIMELINE_END };
  }, []);

  const lines = useMemo(() => gridLines(win, TIMELINE_SNAP_MINUTES), [win]);
  const height = windowHeight(win);

  const placedByDay = useMemo(() => {
    const map = new Map<string, ReturnType<typeof layoutDay>>();
    for (const day of dayKeys) {
      const placed = layoutDay(activitiesByDay.get(day) ?? [], win);
      // 00:00–05:00 belongs at the bottom of a 05:00-starting visual day.
      // Keep the underlying activity times untouched so persistence stays
      // compatible with the existing scheduling model.
      map.set(
        day,
        placed.map((activity) =>
          activity.start < TIMELINE_START
            ? {
                ...activity,
                top: activity.top + minutesToY(24 * 60),
              }
            : activity,
        ),
      );
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
    (activity: TimelineActivity, day: string, start: number, end: number): string[] => {
      // A block-backed row is checked from its stored document; a derived
      // task row is projected into the same shape purely for validation.
      const row: ScheduleBlock | undefined = activity.blockId
        ? (blocksByDay.get(day) ?? []).find((b) => b._id === activity.blockId) ??
          [...blocksByDay.values()].flat().find((b) => b._id === activity.blockId)
        : activityAsBlock(activity);
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
      // Fixed commitments are facts (never move). Block rows and DERIVED task
      // rows are both movable — the board decides where each write lands.
      if (activity.fixed || (!activity.blockId && !activity.taskId)) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      const start = () => {
        movedRef.current = false;
        setDrag({
          key: activity.key,
          blockId: activity.blockId ?? activity.key,
          activity,
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

    const handlePointerMove = (e: PointerEvent) => {
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

      const problems = validate(d.activity, next.day, next.start, next.end);
      if (problems.length > 0) {
        // The draft is simply discarded, so the block visually snaps back and
        // the reason is shown — nothing is silently overwritten (§18, §49).
        toast.error(problems[0], { duration: 6000 });
        return;
      }
      void onMove(d.activity, { day: next.day, start: next.start, end: next.end }).catch(
        (err) => {
          console.error("[timeline] move failed", { key: d.activity.key, next, err });
          toast.error("تغییر ذخیره نشد. لطفاً دوباره تلاش کنید.");
        },
      );
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [drag, columns, dayKeys, win, validate, onMove]);

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
    // The pointerup of a drag-to-create also produces a click; skip it so the
    // sheet opens exactly once, with the dragged range already prefilled.
    if (createMovedRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const visualStart = snapMinutes(win.start + (e.clientY - rect.top) / PX_PER_MINUTE);
    const start = visualStart >= 24 * 60 ? visualStart - 24 * 60 : visualStart;
    const end = Math.min(24 * 60, start + 60);
    onCreateAt(day, start, end);
  };

  /**
   * Drag across empty space → prefill Date + Start + End (§28 method 2).
   * Touch is deliberately excluded: there the surface stays a tap target so
   * vertical scrolling of the grid keeps working with a finger.
   */
  const beginCreate = (day: string, e: React.PointerEvent<HTMLDivElement>) => {
    if (drag || creatingRef.current) return;
    if (e.pointerType !== "mouse" || e.button !== 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const startY = e.clientY;
    const toMinutes = (clientY: number) =>
      Math.max(
        win.start,
        Math.min(win.end, snapMinutes(win.start + (clientY - rect.top) / PX_PER_MINUTE)),
      );
    const anchor = toMinutes(e.clientY);
    createMovedRef.current = false;

    const handleCreateMove = (ev: PointerEvent) => {
      if (!createMovedRef.current) {
        if (Math.abs(ev.clientY - startY) <= DRAG_THRESHOLD_PX) return;
        createMovedRef.current = true;
      }
      const cur = toMinutes(ev.clientY);
      const start = Math.min(anchor, cur);
      const end = Math.max(Math.max(anchor, cur), start + TIMELINE_SNAP_MINUTES);
      const next = { day, start, end };
      creatingRef.current = next;
      setCreating(next);
    };

    const handleCreateUp = () => {
      window.removeEventListener("pointermove", handleCreateMove);
      window.removeEventListener("pointerup", handleCreateUp);
      const range = creatingRef.current;
      creatingRef.current = null;
      setCreating(null);
      // `click` fires right after `pointerup`; keep the flag until the next
      // tick so it can swallow that click.
      setTimeout(() => {
        createMovedRef.current = false;
      }, 0);
      if (range && createMovedRef.current) onCreateAt(range.day, range.start, range.end);
    };

    window.addEventListener("pointermove", handleCreateMove);
    window.addEventListener("pointerup", handleCreateUp);
  };

  const visualNow = now < TIMELINE_START ? now + 24 * 60 : now;
  const isWeek = columns > 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Both axes scroll from one container so the pinned time column and
          the pinned day header stay put while the grid pans. */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-x-auto overflow-y-clip overscroll-x-contain bg-[#f7f8fc] p-3 dark:bg-slate-950 md:overflow-auto md:overscroll-contain md:p-4"
      >
        <div
          className="grid overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_18px_50px_-35px_rgba(15,23,42,.35)] dark:border-white/10 dark:bg-slate-900"
          style={{
            gridTemplateColumns: `${AXIS_PX}px repeat(${columns}, minmax(0, 1fr))`,
            gridTemplateRows: `auto ${height}px`,
            minWidth: isWeek ? `${AXIS_PX + columns * MIN_COL_PX}px` : undefined,
          }}
        >
          {/* corner */}
          <div
            style={{ gridColumn: 1, gridRow: 1 }}
            className="sticky start-0 top-0 z-30 border-e border-b border-slate-200 bg-white py-3 text-center text-[9px] font-black text-slate-400 dark:border-white/10 dark:bg-slate-900 dark:text-slate-500"
          >
            ساعت
          </div>

          {/* day headers (Layer 2 — §2) */}
          {dayKeys.map((day, i) => {
            const d = new Date(`${day}T00:00:00`);
            const isToday = day === today;
            return (
              <div
                key={day}
                style={{ gridColumn: i + 2, gridRow: 1 }}
                className={cn(
                  "relative sticky top-0 z-20 border-e border-b border-slate-200 bg-white px-1 py-3 text-center last:border-e-0 dark:border-white/10 dark:bg-slate-900",
                  isToday && "bg-blue-50/80 dark:bg-blue-500/[0.08]",
                )}
              >
                <div
                  className={cn(
                    "truncate text-[11px] font-semibold leading-4",
                    isToday ? "text-blue-600" : "text-slate-400 dark:text-slate-500",
                  )}
                >
                  {WEEKDAYS_SHORT[d.getDay()]}
                </div>
                <div
                  className={cn(
                    "truncate text-[13px] font-extrabold leading-5",
                    isToday ? "text-blue-700 dark:text-blue-300" : "text-slate-800 dark:text-slate-200",
                  )}
                >
                  {formatJalaliShort(d)}
                </div>
                {isToday && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-blue-600"
                  />
                )}
              </div>
            );
          })}

          {/* time axis (Layer 3 — §2) */}
          <div
            style={{ gridColumn: 1, gridRow: 2 }}
            className="sticky start-0 z-10 border-e border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900"
          >
            {lines.map((l) => (
              <div
                key={l.minutes}
                className={cn(
                  "absolute end-1 -translate-y-1/2 text-[10px] leading-none",
                  l.labelled
                    ? "font-bold text-foreground/75"
                    : "font-medium text-muted-foreground/55",
                )}
                style={{ top: `${l.y}px` }}
              >
                {l.labelled ? toFa(timeFa(l.minutes % (24 * 60))) : toFa(timeFa(l.minutes % (24 * 60))).slice(3)}
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
                  "relative border-e border-slate-200/80 last:border-e-0 dark:border-white/10",
                  isToday && "bg-blue-50/[0.22] dark:bg-blue-500/[0.025]",
                )}
              >
                {/* grid lines + click/drag-to-create surface (§7, §10, §28) */}
                <div
                  role="presentation"
                  onClick={(e) => onGridClick(day, e)}
                  onPointerDown={(e) => beginCreate(day, e)}
                  className="absolute inset-0"
                >
                  {creating && creating.day === day && (
                    <div
                      className="pointer-events-none absolute inset-x-1 z-10 rounded-lg border border-primary/45 bg-primary/10"
                      style={{
                        top: `${minutesToY(creating.start - win.start)}px`,
                        height: `${(creating.end - creating.start) * PX_PER_MINUTE}px`,
                      }}
                    />
                  )}
                  {lines.map((l) => (
                    <div
                      key={l.minutes}
                      className={cn(
                        "absolute inset-x-0",
                        // Hour boundaries read as structure; the 30-minute
                        // lines stay a whisper so the grid never looks like
                        // a spreadsheet.
                        l.labelled
                          ? "border-t border-border/60"
                          : "border-t border-dashed border-border/25",
                      )}
                      style={{ top: `${l.y}px` }}
                    />
                  ))}
                </div>

                {/* "now" line — follows the 05:00 → 05:00 visual cycle */}
                {isToday && visualNow >= win.start && visualNow <= win.end && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                    style={{ top: `${minutesToY(visualNow - win.start)}px` }}
                    aria-hidden="true"
                  >
                    <span className="size-1.5 shrink-0 rounded-full bg-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,.12)]" />
                    <span className="h-px flex-1 bg-rose-400/50" />
                    <span className="shrink-0 rounded-md bg-rose-500 px-1 text-[9px] font-bold leading-4 text-white">
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
                      preview={
                        preview
                          ? {
                              start: preview.start < TIMELINE_START ? preview.start + 24 * 60 : preview.start,
                              end: preview.end <= TIMELINE_START ? preview.end + 24 * 60 : preview.end,
                            }
                          : null
                      }
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
