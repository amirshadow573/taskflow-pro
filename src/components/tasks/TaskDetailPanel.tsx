import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge, PRIORITIES, STATUSES, type PriorityKey, type StatusKey } from "@/components/ui/badge";
import { TaskCheckbox } from "./TaskCheckbox";
import {
  CalendarDays,
  Clock,
  FolderOpen,
  Hash,
  MessageSquare,
  Paperclip,
  Plus,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { formatJalaliFull, toFa } from "@/lib/persian";
import { formatDueFa, isOverdue } from "@/lib/task-utils";
import { cn } from "@/lib/utils";
import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";

export interface TaskDetailData {
  _id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  dueTime?: string;
  projectId?: Id<"projects">;
  tags: string[];
  parentId?: Id<"tasks">;
  estimateMinutes?: number;
  createdAt: number;
}

const STATUS_OPTIONS: StatusKey[] = ["inbox", "todo", "in_progress", "review", "done"];
const PRIORITY_OPTIONS: PriorityKey[] = ["urgent", "high", "medium", "low"];

export function TaskDetailPanel({
  task,
  project,
  subtasks,
  onClose,
  onUpdate,
  onToggleDone,
  onDelete,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
}: {
  task: TaskDetailData;
  project?: { _id: string; name: string; color: string };
  subtasks: TaskDetailData[];
  onClose: () => void;
  onUpdate: (patch: Record<string, unknown>) => void;
  onToggleDone: (done: boolean) => void;
  onDelete: () => void;
  onAddSubtask: (title: string) => void;
  onToggleSubtask: (id: Id<"tasks">, done: boolean) => void;
  onDeleteSubtask: (id: Id<"tasks">) => void;
}) {
  const done = task.status === "done";
  const overdue = isOverdue(task);
  const [newSubtask, setNewSubtask] = useState("");
  const [newTag, setNewTag] = useState("");

  const subDone = subtasks.filter((s) => s.status === "done").length;

  return (
    <aside
      role="dialog"
      aria-label={`جزئیات کار: ${task.title}`}
      className="flex h-full w-full flex-col overflow-hidden border-s bg-card"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <span className="text-xs font-semibold text-muted-foreground">
          جزئیات کار
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            title="حذف کار"
            onClick={onDelete}
          >
            <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
          </Button>
          <Button variant="ghost" size="icon-sm" title="بستن" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {/* Title + completion */}
        <div className="flex items-start gap-3">
          <TaskCheckbox
            checked={done}
            onChange={(next) => onToggleDone(next)}
            label={done ? "علامت به عنوان انجام‌نشده" : "تکمیل کار"}
            className="mt-1"
          />
          <textarea
            value={task.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            rows={2}
            aria-label="عنوان کار"
            className="w-full resize-none rounded-lg bg-transparent text-base font-bold leading-7 outline-none hover:bg-muted/50 focus:bg-muted/50"
          />
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Status */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              وضعیت
            </label>
            <select
              value={task.status}
              onChange={(e) => onUpdate({ status: e.target.value })}
              className="h-9 w-full rounded-lg border border-input bg-card px-2 text-sm outline-none"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STATUSES[s].label}
                </option>
              ))}
            </select>
          </div>
          {/* Priority */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              اولویت
            </label>
            <select
              value={task.priority}
              onChange={(e) => onUpdate({ priority: e.target.value })}
              className="h-9 w-full rounded-lg border border-input bg-card px-2 text-sm outline-none"
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {PRIORITIES[p].label}
                </option>
              ))}
            </select>
          </div>
          {/* Due date */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              تاریخ سررسید
            </label>
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={task.dueDate ?? ""}
                onChange={(e) => onUpdate({ dueDate: e.target.value || null })}
                className="h-9 flex-1 text-xs"
                aria-label="تاریخ سررسید"
              />
            </div>
            {task.dueDate && (
              <p
                className={cn(
                  "mt-1 text-[11px]",
                  overdue ? "font-semibold text-destructive" : "text-muted-foreground",
                )}
              >
                {formatDueFa(task.dueDate)} · {formatJalaliFull(new Date(task.dueDate + "T00:00:00"))}
              </p>
            )}
          </div>
          {/* Time + estimate */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              ساعت
            </label>
            <div className="flex gap-1">
              <Input
                type="time"
                value={task.dueTime ?? ""}
                onChange={(e) => onUpdate({ dueTime: e.target.value || null })}
                className="h-9 flex-1 text-xs"
                aria-label="ساعت انجام"
              />
              <Input
                type="number"
                min={5}
                step={5}
                placeholder="دقیقه"
                value={task.estimateMinutes ?? ""}
                onChange={(e) =>
                  onUpdate({
                    estimateMinutes: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="h-9 w-20 text-xs"
                aria-label="زمان تخمینی (دقیقه)"
              />
            </div>
          </div>
        </div>

        {/* Project */}
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <FolderOpen className="size-3.5" />
            پروژه
          </label>
          {project ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
              <span className="size-2.5 rounded-sm" style={{ background: project.color }} />
              <span className="text-sm font-medium">{project.name}</span>
              <Button
                variant="ghost"
                size="sm"
                className="ms-auto h-6 px-2 text-[11px]"
                onClick={() => onUpdate({ projectId: null })}
              >
                جدا کردن
              </Button>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              بدون پروژه
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">
            توضیحات
          </label>
          <Textarea
            value={task.description ?? ""}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="توضیح بیشتری بنویس…"
            className="min-h-20 text-sm"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Hash className="size-3.5" />
            تگ‌ها
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {task.tags.map((t) => (
              <Badge key={t} variant="accent" className="gap-1">
                #{t}
                <button
                  onClick={() =>
                    onUpdate({ tags: task.tags.filter((x) => x !== t) })
                  }
                  aria-label={`حذف تگ ${t}`}
                  className="ms-0.5 hover:text-destructive"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
            <input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTag.trim()) {
                  onUpdate({ tags: [...task.tags, newTag.trim()] });
                  setNewTag("");
                }
              }}
              placeholder="افزودن تگ…"
              className="w-24 rounded-md border border-dashed border-border bg-transparent px-2 py-0.5 text-[11px] outline-none"
            />
          </div>
        </div>

        {/* Subtasks */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground">
              زیرکارها
            </label>
            {subtasks.length > 0 && (
              <span className="text-[11px] font-semibold text-muted-foreground">
                {toFa(subDone)} از {toFa(subtasks.length)}
              </span>
            )}
          </div>
          {subtasks.length > 0 && (
            <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${(subDone / subtasks.length) * 100}%` }}
              />
            </div>
          )}
          <ul className="space-y-1">
            {subtasks.map((s) => (
              <li
                key={s._id}
                className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-muted/60"
              >
                <TaskCheckbox
                  checked={s.status === "done"}
                  onChange={(next) => onToggleSubtask(s._id as Id<"tasks">, next)}
                  label={`تکمیل ${s.title}`}
                />
                <span
                  className={cn(
                    "flex-1 text-sm",
                    s.status === "done" && "text-muted-foreground line-through",
                  )}
                >
                  {s.title}
                </span>
                <button
                  onClick={() => onDeleteSubtask(s._id as Id<"tasks">)}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label={`حذف ${s.title}`}
                >
                  <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Plus className="size-3.5 text-muted-foreground" />
            <input
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newSubtask.trim()) {
                  onAddSubtask(newSubtask.trim());
                  setNewSubtask("");
                }
              }}
              placeholder="افزودن زیرکار…"
              className="flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        {/* Activity */}
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <MessageSquare className="size-3.5" />
            فعالیت‌ها
          </div>
          <ul className="space-y-1.5 text-[11px] text-muted-foreground">
            <li>
              ایجاد در {formatJalaliFull(new Date(task.createdAt))}
            </li>
            {task.dueDate && (
              <li className="flex items-center gap-1">
                <CalendarDays className="size-3" />
                سررسید: {formatDueFa(task.dueDate)}
                {task.dueTime && ` ساعت ${toFa(task.dueTime)}`}
              </li>
            )}
            {task.estimateMinutes && (
              <li className="flex items-center gap-1">
                <Timer className="size-3" />
                تخمین {toFa(task.estimateMinutes)} دقیقه
              </li>
            )}
            <li className="flex items-center gap-1 text-muted-foreground/60">
              <Paperclip className="size-3" />
              پیوست‌ها به‌زودی
            </li>
          </ul>
        </div>
      </div>
    </aside>
  );
}
