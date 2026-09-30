/**
 * Visual Timeline (Phase 17) — one scheduled activity on the grid.
 *
 * The block is a real button: keyboard focusable, activatable, and labelled
 * with everything a screen reader needs (title, range, project, and whether
 * it is in progress). Drag & resize is a POINTER enhancement layered on top —
 * every action is also reachable from the keyboard and from the detail sheet
 * (§51), so colour and dragging are never the only way to do anything.
 */
import { forwardRef } from "react";
import { Check, Lock } from "lucide-react";
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
  const density = blockDensity(activity.height);

  const subtitle =
    activity.projectName ??
    activity.goalTitle ??
    activity.routineItemTitle ??
    activity.habitTitle ??
    activity.taskTitle;

  const statusLabel = blockLabel(activity.kind, persona);
  const range = rangeFa(start, end);

  // A non-colour cue for state, so colour is never the only signal (§51).
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
        "group relative flex flex-col overflow-hidden rounded-lg border text-start transition-shadow",
        color.surface,
        color.surfaceDark,
        isDragging
          ? cn("z-30 shadow-[0_18px_40px_-16px_rgba(15,23,42,0.55)]", color.borderStrong)
          : cn("shadow-[0_1px_2px_rgba(15,23,42,0.06)]", isNow && cn("ring-2", color.borderStrong)),
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
        className="flex min-h-0 flex-1 cursor-grab flex-col gap-0.5 px-2 py-1.5 text-start active:cursor-grabbing"
        title={`${activity.title} — ${range} · ${statusLabel}`}
        aria-label={`${activity.title}، ${range}، ${statusLabel}${subtitle ? `، ${subtitle}` : ""}${stateCue ? `، ${stateCue}` : ""}`}
      >
        <span
          className={cn(
            "flex items-center gap-1 text-[12px] font-bold leading-4",
            activity.taskDone && "line-through",
          )}
        >
          {activity.fixed && <Lock className="size-3 shrink-0 opacity-70" aria-hidden="true" />}
          <span className="min-w-0 flex-1 truncate">{activity.title}</span>
        </span>

        {density.showSubtitle && subtitle && (
          <span className="truncate text-[11px] leading-4 opacity-80">{subtitle}</span>
        )}

        {density.showTime && (
          <span className="mt-auto flex items-center gap-1.5 text-[10px] font-semibold leading-4 opacity-75">
            {toFa(range)}
          </span>
        )}
      </button>

      {/* Completion control — writes to the real task, never a visual-only
          state. The ExecutionEngine + progression run through the same
          mutation every other task surface uses (§34, §45). */}
      {activity.taskId && !activity.taskDone && density.showTime && onToggleTask && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleTask(activity);
          }}
          aria-label={`علامت‌گذاری «${activity.title}» به عنوان انجام‌شده`}
          className="absolute bottom-1 end-1 grid size-5 place-items-center rounded-md border border-current/25 bg-white/70 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 dark:bg-black/30"
        >
          <Check className="size-3" aria-hidden="true" />
        </button>
      )}
      {activity.taskId && activity.taskDone && density.showTime && (
        <span
          className="pointer-events-none absolute bottom-1 end-1 grid size-5 place-items-center rounded-md border border-current/25 bg-white/70 dark:bg-black/30"
          aria-hidden="true"
        >
          <Check className="size-3" />
        </span>
      )}

      {/* Small state chip for "in progress" / "missed" — text, not colour. */}
      {stateCue && !activity.taskDone && density.showTime && (
        <span className="pointer-events-none absolute start-1.5 top-1.5 rounded bg-white/70 px-1 text-[9px] font-bold leading-4 dark:bg-black/35">
          {stateCue}
        </span>
      )}
    </div>
  );
});
