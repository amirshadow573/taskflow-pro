/**
 * Visual Timeline (Phase 17) — one scheduled activity on the grid.
 *
 * Visual direction (§3, §4): a compact scheduling card whose HEIGHT is its
 * duration, with a solid colour bar on the reading-start edge, a dot +
 * title, an optional secondary line (project / goal / routine / habit) and
 * the time range last. Content is revealed by height (§11), so a 30-minute
 * block stays a single clean line instead of being squeezed.
 *
 * Colour is cosmetic and every state also has a TEXT cue, so colour is never
 * the only signal (§51).
 *
 * The block is a real button — keyboard focusable and activatable. Drag and
 * resize are pointer enhancements layered on top; every action is also
 * reachable from the detail sheet, so the grid is never the only path.
 */
import { forwardRef } from "react";
import { CalendarClock, Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toFa } from "@/lib/persian";
import { blockLabel } from "@/lib/scheduling";
import { TIMELINE_COLORS } from "@/lib/timeline/timeline-colors";
import { blockDensity, rangeFa } from "@/lib/timeline/timeline-grid";
import type { PlacedActivity } from "@/lib/timeline/timeline-model";

export interface TimelineActivityCardProps {
  activity: PlacedActivity;
  persona?: string;
  isNow: boolean;
  isDragging: boolean;
  /** Live range preview while dragging / resizing. */
  preview?: { start: number; end: number } | null;
  onOpen: (activity: TimelineActivityCardProps["activity"]) => void;
  onToggleTask?: (activity: TimelineActivityCardProps["activity"]) => void;
  onPointerDownBody?: (e: React.PointerEvent) => void;
  onPointerDownResize?: (edge: "start" | "end") => (e: React.PointerEvent) => void;
}

export const TimelineActivityCard = forwardRef<
  HTMLDivElement,
  TimelineActivityCardProps
>(function TimelineActivityCard(
  {
    activity,
    persona,
    isNow,
    isDragging,
    preview,
    onOpen,
    onToggleTask,
    onPointerDownBody,
    onPointerDownResize,
  },
  ref,
) {
  const start = preview?.start ?? activity.start;
  const end = preview?.end ?? activity.end;
  const color = TIMELINE_COLORS[activity.colorKey];
  const gradientByColor: Record<string, string> = {
    blue: "from-blue-500 to-blue-300", indigo: "from-indigo-500 to-indigo-300", violet: "from-violet-500 to-violet-300", purple: "from-purple-500 to-purple-300",
    pink: "from-pink-500 to-pink-300", rose: "from-rose-500 to-rose-300", red: "from-red-500 to-red-300", orange: "from-orange-500 to-orange-300",
    amber: "from-amber-500 to-amber-300", yellow: "from-yellow-500 to-yellow-300", green: "from-green-500 to-green-300", emerald: "from-emerald-500 to-emerald-300",
    teal: "from-teal-500 to-teal-300", cyan: "from-cyan-500 to-cyan-300", sky: "from-sky-500 to-sky-300", slate: "from-slate-500 to-slate-300",
  };
  const density = blockDensity(activity.height);

  const subtitle =
    activity.projectName ??
    activity.goalTitle ??
    activity.routineItemTitle ??
    activity.habitTitle ??
    activity.taskTitle;

  const statusLabel = blockLabel(activity.kind, persona);
  const range = rangeFa(start, end);

  /* State cue — TEXT, never colour alone (§51). */
  const stateCue = activity.taskDone
    ? "انجام‌شده"
    : isNow
      ? "در حال انجام"
      : activity.status === "missed"
        ? "از دست رفته"
        : activity.status === "cancelled"
          ? "لغوشده"
          : null;

  return (
    <div
      ref={ref}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-white/70 shadow-[0_8px_22px_-12px_rgba(15,23,42,.32)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-14px_rgba(15,23,42,.38)] dark:border-white/10",
        color.surface,
        color.surfaceDark,
        isDragging
          ? cn(
              "z-30 shadow-[0_18px_40px_-16px_rgba(15,23,42,0.6)]",
              color.borderStrong,
            )
          : cn(
              "shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:shadow-[0_4px_14px_-6px_rgba(15,23,42,0.18)]",
              isNow && cn("ring-1 ring-inset", color.borderStrong),
            ),
        activity.taskDone && "opacity-70",
        activity.fixed && "border-dashed",
      )}
      style={{
        top: `${activity.top}px`,
        height: `${activity.height}px`,
        insetInlineStart: `${activity.leftPct}%`,
        width: `${activity.widthPct}%`,
      }}
    >
      <span aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-2 bg-gradient-to-r", gradientByColor[activity.colorKey] ?? "from-slate-500 to-slate-300")} />
      <span aria-hidden="true" className={cn("absolute inset-y-2 start-0 w-1 rounded-e-full", color.swatch)} />

      {/* Resize handles — desktop pointer devices only. Touch users get the
          equivalent time fields in the detail sheet (§42). */}
      {!activity.fixed && onPointerDownResize && (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onPointerDown={onPointerDownResize("start")}
            className="absolute inset-x-0 top-0 hidden h-2 cursor-ns-resize md:block"
          />
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onPointerDown={onPointerDownResize("end")}
            className="absolute inset-x-0 bottom-0 hidden h-2 cursor-ns-resize md:block"
          />
        </>
      )}

      <button
        type="button"
        onClick={() => onOpen(activity)}
        onPointerDown={onPointerDownBody}
        className={cn(
          "flex min-h-0 flex-1 cursor-grab flex-col gap-1 px-2.5 pb-2 pt-3.5 ps-3 text-start active:cursor-grabbing",
          density.compact && "py-1",
        )}
        title={`${activity.title} — ${range} · ${statusLabel}`}
        aria-label={`${activity.title}، ${range}، ${statusLabel}${subtitle ? `، ${subtitle}` : ""}${stateCue ? `، ${stateCue}` : ""}`}
      >
        {/* Title */}
        <span
          className={cn(
            "flex items-center gap-1.5 text-[12px] font-bold leading-4",
            activity.taskDone && "line-through",
          )}
        >
          <span
            aria-hidden="true"
            className={cn("size-1.5 shrink-0 rounded-full", color.swatch)}
          />
          {activity.fixed && (
            <Lock className="size-3 shrink-0 opacity-70" aria-hidden="true" />
          )}
          <span className="min-w-0 flex-1 truncate">{activity.title}</span>
        </span>

        {/* Secondary context — project / goal / routine / habit / task */}
        {density.showSubtitle && subtitle && (
          <span className="truncate ps-3.5 text-[11px] leading-4 opacity-75">
            {subtitle}
          </span>
        )}

        {/* Time range (§9) */}
        {density.showTime && (
          <span className="mt-auto flex items-center gap-1.5 ps-3.5 text-[10px] font-semibold leading-4 opacity-70">
            <CalendarClock className="size-3 shrink-0" aria-hidden="true" />
            {toFa(range)}
          </span>
        )}
      </button>

      {/* Completion control — writes to the real task through the shared
          workspace path (ExecutionEngine + progression included). The tick
          reveals on hover/focus so dense weeks stay calm (§34, §45). */}
      {activity.taskId &&
        !activity.taskDone &&
        density.showTime &&
        onToggleTask && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleTask(activity);
            }}
            aria-label={`علامت‌گذاری «${activity.title}» به عنوان انجام‌شده`}
            className="absolute bottom-1.5 end-1.5 grid size-5 place-items-center rounded-md border border-current/25 bg-white/70 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 dark:bg-black/30"
          >
            <Check className="size-3" aria-hidden="true" />
          </button>
        )}
      {activity.taskId && activity.taskDone && density.showTime && (
        <span
          className="pointer-events-none absolute bottom-1.5 end-1.5 grid size-5 place-items-center rounded-md border border-current/25 bg-white/70 dark:bg-black/30"
          aria-hidden="true"
        >
          <Check className="size-3" />
        </span>
      )}

      {/* In-progress / missed — text chip, so state is never colour-only */}
      {stateCue && !activity.taskDone && density.showSubtitle && (
        <span className="pointer-events-none absolute top-1 end-1 rounded-md bg-white/80 px-1.5 text-[9px] font-bold leading-4 ring-1 ring-black/5 dark:bg-black/40">
          {stateCue}
        </span>
      )}
    </div>
  );
});
