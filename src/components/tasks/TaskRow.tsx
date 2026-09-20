import { TaskCheckbox } from "./TaskCheckbox";
import { PRIORITIES, type PriorityKey } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock,
  GripVertical,
  ListTree,
  MoreHorizontal,
  Pencil,
  Timer,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDueFa, isOverdue } from "@/lib/task-utils";
import { toFa } from "@/lib/persian";

export interface TaskLike {
  _id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
  dueTime?: string;
  projectId?: string;
  tags: string[];
  parentId?: string;
  estimateMinutes?: number;
}

export interface ProjectLite {
  _id: string;
  name: string;
  color: string;
}

export function TaskRow({
  task,
  project,
  subtaskTotal,
  subtaskDone,
  onToggle,
  onOpen,
  onDelete,
  compact = false,
}: {
  task: TaskLike;
  project?: ProjectLite;
  subtaskTotal?: number;
  subtaskDone?: number;
  onToggle: (done: boolean) => void;
  onOpen?: () => void;
  onDelete?: () => void;
  compact?: boolean;
}) {
  const done = task.status === "done";
  const overdue = isOverdue(task);
  const prio = PRIORITIES[(task.priority as PriorityKey) in PRIORITIES ? (task.priority as PriorityKey) : "medium"];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.()}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen?.();
      }}
      className={cn(
        "group relative flex w-full cursor-pointer items-center gap-3 border-b border-border/50 px-3 transition-colors last:border-0",
        "hover:bg-white/70 dark:hover:bg-white/5",
        compact ? "py-2" : "py-2.5",
        done && "opacity-60",
      )}
    >
      {/* Hover accent rail */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-gradient-to-b opacity-0 transition-opacity duration-200 group-hover:opacity-100",
          overdue ? "from-destructive to-red-400" : "from-primary to-[#5B5FE6]",
        )}
      />

      <GripVertical className="size-3.5 shrink-0 text-transparent transition-colors group-hover:text-muted-foreground/40" />
      <TaskCheckbox
        checked={done}
        onChange={(next) => onToggle(next)}
        label={done ? `علامت‌زدن ${task.title} به عنوان انجام‌نشده` : `تکمیل ${task.title}`}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "strike-reveal truncate text-sm font-semibold",
              done && "text-muted-foreground",
            )}
            data-done={done}
          >
            {task.title}
          </span>
          {subtaskTotal !== undefined && subtaskTotal > 0 && (
            <span className="ui-chip shrink-0 px-1.5">
              <ListTree className="size-3" />
              {toFa(subtaskDone ?? 0)}/{toFa(subtaskTotal)}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
          {project && (
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span
                className="size-2 rounded-full shadow-[0_0_0_2px_rgba(255,255,255,0.7)]"
                style={{ background: project.color }}
              />
              {project.name}
            </span>
          )}
          {task.dueDate && (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                overdue && "font-bold text-destructive",
              )}
            >
              <Clock className="size-3" />
              {formatDueFa(task.dueDate)}
              {task.dueTime && ` · ${toFa(task.dueTime)}`}
              {overdue && " (گذشته)"}
            </span>
          )}
          {task.estimateMinutes && (
            <span className="inline-flex items-center gap-1">
              <Timer className="size-3" />
              {toFa(task.estimateMinutes)} دقیقه
            </span>
          )}
          {task.tags.map((t) => (
            <span key={t} className="font-medium text-primary/80">
              #{t}
            </span>
          ))}
        </div>
      </div>

      <span
        className="hidden shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] sm:inline-flex"
        style={{
          color: prio.color,
          borderColor: `${prio.color}33`,
          background: `${prio.color}14`,
        }}
      >
        <span className="size-1.5 rounded-full" style={{ background: prio.color }} />
        {prio.label}
      </span>

      {/* Contextual hover actions (desktop) */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon-sm"
          title="ویرایش"
          onClick={(e) => {
            e.stopPropagation();
            onOpen?.();
          }}
        >
          <Pencil className="size-3.5 text-muted-foreground" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="بیشتر"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="size-3.5 text-muted-foreground" />
        </Button>
        {onDelete && (
          <Button
            variant="ghost"
            size="icon-sm"
            title="حذف"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
          </Button>
        )}
      </div>
    </div>
  );
}
