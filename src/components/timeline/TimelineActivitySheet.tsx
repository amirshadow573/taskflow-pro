/**
 * Visual Timeline (Phase 17) — activity detail / editor sheet.
 *
 * One sheet serves both jobs:
 *   - `mode="create"` — the form opened by clicking empty grid space or
 *     «+ افزودن برنامه». The day and start time arrive pre-filled from the
 *     click, the user confirms, and the block is written through the existing
 *     `personal.createTimeBlock` mutation.
 *   - `mode="edit"` — the detail panel for an existing block: title,
 *     description, date, start, end, duration, colour, kind, the linked
 *     task / project / goal / routine / habit, status and priority, plus
 *     quick actions (open task, open project, complete task, delete).
 *
 * This is also the RELIABLE TOUCH-FRIENDLY EDITOR: start time, end time and
 * duration are plain form fields, so resizing never depends on a drag
 * gesture being accurate on a small screen (§42).
 *
 * The component is mounted fresh per target (keyed remount) so its local
 * state always starts from the activity — no effects, no stale drafts.
 */
import { useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  FolderKanban,
  Target,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Pill } from "@/components/progress/progress-ui";
import { toFa } from "@/lib/persian";
import { cn } from "@/lib/utils";
import {
  BLOCK_KIND_LABELS_FA,
  BLOCK_STATUS_LABELS_FA,
  blockLabel,
} from "@/lib/scheduling";
import { TimelineColorPicker } from "@/components/timeline/TimelineColorPicker";
import { TIMELINE_COLORS, asTimelineColorKey, type TimelineColorKey } from "@/lib/timeline/timeline-colors";
import { durationFa, timeFa } from "@/lib/timeline/timeline-grid";
import { hhmm, type TimelineActivity, type TimelineContext } from "@/lib/timeline/timeline-model";

/** §11 — standard durations, no invented values. */
const DURATION_CHOICES = [15, 30, 45, 60, 90, 120, 180];

const KIND_CHOICES = [
  "focus",
  "task",
  "study",
  "meeting",
  "routine",
  "personal",
  "break",
  "review",
  "planning",
  "admin",
  "other",
] as const;

const STATUS_CHOICES = ["planned", "completed", "missed", "cancelled"] as const;

export interface TimelineActivitySheetProps {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill for the create form (day + snapped start from the click). */
  draft?: { day: string; start: number; end: number; kind?: string };
  /** The block being edited. Required when `mode === "edit"`. */
  activity?: TimelineActivity | null;
  context: TimelineContext;
  onCreate: (args: {
    title: string;
    day: string;
    startTime: string;
    endTime: string;
    kind: string;
    description?: string;
    color?: string;
    taskId?: Id<"tasks">;
    projectId?: Id<"projects">;
    goalId?: Id<"personalGoals">;
    routineId?: Id<"routineItems">;
    habitId?: Id<"habits">;
    fixed?: boolean;
  }) => Promise<void>;
  onUpdate: (id: Id<"timeBlocks">, patch: Record<string, unknown>) => Promise<void>;
  onDelete: (id: Id<"timeBlocks">) => Promise<void>;
  onToggleTask: (activity: TimelineActivity) => void;
  onOpenTask: (taskId: string) => void;
  onOpenProject: (projectId: string) => void;
}

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-[11px] font-bold text-muted-foreground"
    >
      {children}
    </label>
  );
}

const selectClass =
  "ui-field h-10 w-full rounded-xl px-2.5 text-sm font-medium outline-none";

export function TimelineActivitySheet({
  mode,
  open,
  onOpenChange,
  draft,
  activity,
  context,
  onCreate,
  onUpdate,
  onDelete,
  onToggleTask,
  onOpenTask,
  onOpenProject,
}: TimelineActivitySheetProps) {
  const seed = activity;
  const [title, setTitle] = useState(seed?.title ?? "");
  const [description, setDescription] = useState(seed?.description ?? "");
  const [day, setDay] = useState(seed?.day ?? draft?.day ?? "");
  const [start, setStart] = useState(seed?.start ?? draft?.start ?? 9 * 60);
  const [end, setEnd] = useState(seed?.end ?? draft?.end ?? 10 * 60);
  const [kind, setKind] = useState(seed?.kind ?? draft?.kind ?? "focus");
  const [color, setColor] = useState<TimelineColorKey | null>(null);
  const [taskId, setTaskId] = useState<string>(seed?.taskId ?? "");
  const [projectId, setProjectId] = useState<string>(
    seed?.projectName ? projectIdOf(seed, context) : "",
  );
  const [goalId, setGoalId] = useState<string>(seed?.goalTitle ? goalIdOf(seed, context) : "");
  const [routineId, setRoutineId] = useState<string>(seed?.routineItemId ?? "");
  const [habitId, setHabitId] = useState<string>(seed?.habitId ?? "");
  const [status, setStatus] = useState<string>(seed?.status ?? "planned");
  const [fixed, setFixed] = useState<boolean>(seed?.fixed ?? false);
  const [saving, setSaving] = useState(false);

  /* The picker shows the user's own stored choice, not the kind-derived
     fallback, so re-opening the sheet never pretends a colour was chosen. */
  const effectiveColor = color ?? asTimelineColorKey(seed?.storedColor);

  const openTasks = context.tasks.filter((t) => t.status !== "done");
  const duration = Math.max(0, end - start);
  const rangeValid = end > start;

  const applyDuration = (minutes: number) => {
    setEnd(Math.min(24 * 60 - 1, start + minutes));
  };

  const setStartTime = (value: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(value);
    if (!m) return;
    const next = Number(m[1]) * 60 + Number(m[2]);
    setStart(next);
    // Keep the real duration when the start moves.
    setEnd(Math.min(24 * 60 - 1, next + (duration || 60)));
  };

  const setEndTime = (value: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(value);
    if (!m) return;
    setEnd(Number(m[1]) * 60 + Number(m[2]));
  };

  const save = async () => {
    if (!title.trim()) {
      toast.error("عنوان فعالیت الزامی است.");
      return;
    }
    if (!rangeValid) {
      toast.error("ساعت پایان باید بعد از ساعت شروع باشد.");
      return;
    }
    if (!day) {
      toast.error("تاریخ را انتخاب کن.");
      return;
    }
    setSaving(true);
    try {
      const common = {
        title: title.trim(),
        day,
        startTime: hhmm(start),
        endTime: hhmm(end),
        kind,
        notes: description.trim() || undefined,
        color: effectiveColor ?? undefined,
        fixed,
      };
      if (mode === "create") {
        await onCreate({
          ...common,
          taskId: (taskId || undefined) as Id<"tasks"> | undefined,
          projectId: (projectId || undefined) as Id<"projects"> | undefined,
          goalId: (goalId || undefined) as Id<"personalGoals"> | undefined,
          routineId: (routineId || undefined) as Id<"routineItems"> | undefined,
          habitId: (habitId || undefined) as Id<"habits"> | undefined,
        });
        toast.success("برنامه به خط زمانی اضافه شد.");
      } else if (seed?.blockId) {
        await onUpdate(seed.blockId as Id<"timeBlocks">, {
          ...common,
          status,
          taskId: (taskId || null) as Id<"tasks"> | null,
          projectId: (projectId || null) as Id<"projects"> | null,
          goalId: (goalId || null) as Id<"personalGoals"> | null,
          routineId: (routineId || null) as Id<"routineItems"> | null,
          habitId: (habitId || null) as Id<"habits"> | null,
          // Any manual time change is a reschedule, never a silent edit.
          source: "reschedule",
        });
        toast.success("تغییرات ذخیره شد.");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(
        `ذخیره نشد: ${err instanceof Error ? err.message : "خطای نامشخص"}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!seed?.blockId) return;
    setSaving(true);
    try {
      await onDelete(seed.blockId as Id<"timeBlocks">);
      toast.success("برنامه حذف شد.");
      onOpenChange(false);
    } catch (err) {
      toast.error(`حذف نشد: ${err instanceof Error ? err.message : "خطای نامشخص"}`);
    } finally {
      setSaving(false);
    }
  };

  const previewColor = TIMELINE_COLORS[effectiveColor ?? "slate"];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex w-[92vw] max-w-md flex-col gap-0 overflow-y-auto p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border/60 p-4 text-start">
          <div className="flex items-center gap-2">
            <span
              className={cn("size-3 shrink-0 rounded-full", previewColor.swatch)}
              aria-hidden="true"
            />
            <SheetTitle className="text-base font-extrabold">
              {mode === "create" ? "افزودن برنامه" : "جزئیات برنامه"}
            </SheetTitle>
          </div>
          <SheetDescription className="text-xs">
            {mode === "create"
              ? "زمان و عنوان را مشخص کن؛ بقیه اختیاری است."
              : "ویرایش بلافاصله در خط زمانی و برنامه‌ریزی ذخیره می‌شود."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 p-4">
          {/* Title — required (§10) */}
          <div>
            <Label htmlFor="tl-title">عنوان *</Label>
            <Input
              id="tl-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: مطالعه زیست"
              className="ui-field h-10 rounded-xl"
              autoComplete="off"
            />
          </div>

          {/* Multi-line description (§11) */}
          <div>
            <Label htmlFor="tl-desc">توضیحات</Label>
            <Textarea
              id="tl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder={"مرور فصل سوم زیست\nحل تست‌های مهم\nبررسی اشتباهات آزمون قبلی"}
              className="ui-field resize-y rounded-xl text-sm leading-6"
            />
          </div>

          {/* When / how long (§33) — also the touch-friendly resize path */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="tl-day">تاریخ</Label>
              <Input
                id="tl-day"
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="ui-field h-10 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="tl-kind">نوع</Label>
              <select
                id="tl-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className={selectClass}
              >
                {KIND_CHOICES.map((k) => (
                  <option key={k} value={k}>
                    {blockLabel(k, context.persona)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="tl-start">ساعت شروع</Label>
              <Input
                id="tl-start"
                type="time"
                step={300}
                value={hhmm(start)}
                onChange={(e) => setStartTime(e.target.value)}
                className="ui-field h-10 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="tl-end">ساعت پایان</Label>
              <Input
                id="tl-end"
                type="time"
                step={300}
                value={hhmm(end)}
                onChange={(e) => setEndTime(e.target.value)}
                aria-invalid={!rangeValid}
                className={cn("ui-field h-10 rounded-xl", !rangeValid && "border-destructive")}
              />
            </div>
          </div>

          <div>
            <Label>مدت</Label>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_CHOICES.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => applyDuration(d)}
                  aria-pressed={duration === d}
                  className={cn(
                    "min-h-9 rounded-lg border px-2.5 text-xs font-bold transition-colors",
                    duration === d
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 text-muted-foreground hover:bg-accent/60",
                  )}
                >
                  {toFa(durationFa(d))}
                </button>
              ))}
            </div>
            {!rangeValid && (
              <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-destructive">
                <AlertTriangle className="size-3" aria-hidden="true" />
                ساعت پایان باید بعد از ساعت شروع باشد.
              </p>
            )}
          </div>

          {/* Colour (§12, §36) */}
          <div>
            <Label>رنگ</Label>
            <TimelineColorPicker
              value={effectiveColor}
              onChange={setColor}
              idPrefix={mode === "create" ? "tl-new" : "tl-edit"}
            />
          </div>

          {/* Traceable sources (§24, §25, §43) */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="tl-task">کار مرتبط</Label>
              <select
                id="tl-task"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                className={selectClass}
              >
                <option value="">بدون کار</option>
                {openTasks.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="tl-project">پروژه</Label>
              <select
                id="tl-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className={selectClass}
              >
                <option value="">بدون پروژه</option>
                {context.projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="tl-goal">هدف</Label>
              <select
                id="tl-goal"
                value={goalId}
                onChange={(e) => setGoalId(e.target.value)}
                className={selectClass}
              >
                <option value="">بدون هدف</option>
                {context.goals.map((g) => (
                  <option key={g._id} value={g._id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="tl-routine">روتین</Label>
              <select
                id="tl-routine"
                value={routineId}
                onChange={(e) => setRoutineId(e.target.value)}
                className={selectClass}
              >
                <option value="">بدون روتین</option>
                {context.routineItems.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="tl-habit">عادت</Label>
              <select
                id="tl-habit"
                value={habitId}
                onChange={(e) => setHabitId(e.target.value)}
                className={selectClass}
              >
                <option value="">بدون عادت</option>
                {context.habits.map((h) => (
                  <option key={h._id} value={h._id}>
                    {h.title}
                  </option>
                ))}
              </select>
            </div>
            {mode === "edit" && (
              <div>
                <Label htmlFor="tl-status">وضعیت</Label>
                <select
                  id="tl-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={selectClass}
                >
                  {STATUS_CHOICES.map((s) => (
                    <option key={s} value={s}>
                      {BLOCK_STATUS_LABELS_FA[s] ?? s}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={fixed}
              onChange={(e) => setFixed(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            تعهد ثابت (جلسه، کلاس، قرار ملاقات) — با کشیدن جابه‌جا نمی‌شود
          </label>

          {/* Quick actions (§33) */}
          {mode === "edit" && seed && (
            <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
              {seed.taskId && (
                <>
                  <Button variant="soft" size="sm" onClick={() => onOpenTask(seed.taskId!)}>
                    <Check className="size-3.5" />
                    باز کردن کار
                  </Button>
                  {seed.taskDone ? (
                    <Pill toneKey="emerald">کار انجام‌شده</Pill>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => onToggleTask(seed)}>
                      <Check className="size-3.5" />
                      انجام شد
                    </Button>
                  )}
                </>
              )}
              {projectId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenProject(projectId)}
                >
                  <FolderKanban className="size-3.5" />
                  پروژه
                </Button>
              )}
              {goalId && (
                <Button variant="ghost" size="sm" asChild>
                  <a href={`/progress`}>
                    <Target className="size-3.5" />
                    هدف
                    <ExternalLink className="size-3" />
                  </a>
                </Button>
              )}
            </div>
          )}

          {mode === "edit" && (
            <div className="rounded-xl border border-border/60 bg-muted/40 p-3 text-[11px] leading-5 text-muted-foreground">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                ردیابی
              </div>
              <div>منبع: {seed?.source === "ai_import" ? "ورودی AI" : seed?.source === "planning" ? "برنامه‌ریز" : seed?.source === "reschedule" ? "جابه‌جایی" : "دستی"}</div>
              <div>نوع: {BLOCK_KIND_LABELS_FA[kind] ?? kind}</div>
              {seed?.taskPriority && <div>اولویت کار: {seed.taskPriority}</div>}
              <div>
                بازه: {toFa(`${timeFa(start)} تا ${timeFa(end)}`)} ({toFa(durationFa(duration))})
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="flex-row items-center gap-2 border-t border-border/60 p-3">
          {mode === "edit" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={remove}
              disabled={saving}
              aria-label="حذف برنامه"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button size="sm" onClick={save} disabled={saving} className="flex-1">
            {saving ? "در حال ذخیره…" : "ذخیره"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* The activity object intentionally exposes display names, not raw ids, for
   project / goal. These look the id back up so the editor can preselect it. */
function projectIdOf(activity: TimelineActivity, context: TimelineContext): string {
  return context.projects.find((p) => p.name === activity.projectName)?._id ?? "";
}
function goalIdOf(activity: TimelineActivity, context: TimelineContext): string {
  return context.goals.find((g) => g.title === activity.goalTitle)?._id ?? "";
}
