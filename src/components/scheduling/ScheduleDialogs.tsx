/**
 * Phase 11 §10 / §11 / §21 / §30 — the CONFIRMED scheduling dialog flows.
 *
 *   ScheduleTaskDialog  — task → time block. Duration comes from the task
 *                         estimate or an explicit user pick — NEVER invented
 *                         (§11: "Duration unknown" until the user chooses).
 *   RescheduleDialog    — alternative slots for an existing block; the user
 *                         picks one, only then does anything change (§21).
 *   MovePreviewDialog   — bulk moves are always PREVIEWED first and applied
 *                         only after explicit confirmation (§30).
 *
 * State ownership lives in ./use-schedule-dialogs (one hook, every surface).
 * Each dialog is mounted fresh per target (keyed remount), so its local
 * selection state always starts from the target — no effects needed.
 *
 * No XP is granted here: scheduling itself never earns progression (§32).
 * Completing a task goes through the existing toggleDone path, which is the
 * single XP/stat event source.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import {
  CalendarPlus,
  CheckCircle2,
  MoveHorizontal,
  RefreshCw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyHint, Pill } from "@/components/progress/progress-ui";
import type { TaskDoc } from "@/components/workspace/WorkspaceData";
import { toFa } from "@/lib/persian";
import { cn } from "@/lib/utils";
import {
  suggestReschedule,
  suggestSlots,
  type PlacementResult,
  type ProposedMove,
  type ScheduleBlock,
} from "@/lib/scheduling";
import type { UseScheduleResult } from "@/hooks/use-schedule";
import { dayLabelFa, minutesFa, timeFa } from "./schedule-ui";

/** §11 — the standard estimation steps, plus a custom value. */
const DURATION_CHOICES = [15, 30, 45, 60, 90, 120];

/* ------------------------------------------------------------------ */
/* Slot list (shared by both placement dialogs)                        */
/* ------------------------------------------------------------------ */

function SlotList({
  placement,
  value,
  onChange,
  emptyTitle,
}: {
  placement: PlacementResult;
  value: string | null;
  onChange: (key: string) => void;
  emptyTitle: string;
}) {
  if (placement.needsDuration) {
    return <EmptyHint>{placement.notes[0] ?? "مدت این کار مشخص نیست."}</EmptyHint>;
  }
  if (placement.slots.length === 0) {
    return (
      <div className="space-y-2">
        <EmptyHint>{emptyTitle}</EmptyHint>
        {placement.notes.map((n) => (
          <p key={n} className="text-[11px] leading-5 text-muted-foreground">
            {n}
          </p>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <ul className="space-y-2" role="radiogroup" aria-label="بازه‌های پیشنهادی">
        {placement.slots.map((slot, i) => {
          const key = `${slot.day}:${slot.start}`;
          const active =
            (value ?? `${placement.slots[0].day}:${placement.slots[0].start}`) === key;
          return (
            <li key={key}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange(key)}
                className={cn(
                  "w-full rounded-xl border px-3 py-2.5 text-start transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                  active
                    ? "border-primary/60 bg-primary/5"
                    : "border-border/60 bg-white/50 hover:border-primary/30 dark:bg-white/5",
                )}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Pill toneKey={active ? "blue" : "slate"}>
                    {dayLabelFa(slot.day)} {timeFa(slot.start)}–{timeFa(slot.end)}
                  </Pill>
                  <span className="text-[11px] font-bold text-muted-foreground">
                    {i === 0 ? "بهترین پیشنهاد" : `پیشنهاد ${toFa(i + 1)}`} ·{" "}
                    {minutesFa(slot.minutes)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  {slot.reason}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
      {placement.notes.map((n) => (
        <p key={n} className="text-[11px] leading-5 text-muted-foreground">
          {n}
        </p>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1 — Task → time block                                               */
/* ------------------------------------------------------------------ */

export function ScheduleTaskDialog({
  schedule,
  task,
  onClose,
}: {
  schedule: UseScheduleResult;
  task: TaskDoc;
  onClose: () => void;
}) {
  /* Mounted fresh per task (keyed), so initial state seeds from the task. */
  const [minutes, setMinutes] = useState<number | null>(() => task.estimateMinutes ?? null);
  const [custom, setCustom] = useState(() =>
    task.estimateMinutes ? String(task.estimateMinutes) : "",
  );
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const placement = useMemo<PlacementResult | null>(() => {
    if (!minutes || minutes <= 0) return null;
    return suggestSlots({
      target: {
        taskId: task._id,
        title: task.title,
        minutes,
        dueDate: task.dueDate,
        priority: task.priority,
        projectId: task.projectId,
      },
      days: schedule.result.days,
      prefs: schedule.prefs,
    });
  }, [task, minutes, schedule.result.days, schedule.prefs]);

  const slots = placement?.slots ?? [];
  const activeKey = picked ?? (slots[0] ? `${slots[0].day}:${slots[0].start}` : null);
  const active = slots.find((s) => `${s.day}:${s.start}` === activeKey);

  const confirm = async () => {
    if (!active || busy) return;
    setBusy(true);
    try {
      await schedule.scheduleTask(task, { day: active.day, start: active.start, end: active.end });
      toast.success(`«${task.title}» زمان‌بندی شد`, {
        description: `${toFa(active.day)} — ${timeFa(active.start)} تا ${timeFa(active.end)}`,
      });
      onClose();
    } catch {
      toast.error("زمان‌بندی انجام نشد — دوباره تلاش کن.");
    } finally {
      setBusy(false);
    }
  };

  const pickDuration = (m: number | null) => {
    setMinutes(m);
    setPicked(null);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="size-4 text-primary" aria-hidden />
            زمان‌بندی «{task.title}»
          </DialogTitle>
          <DialogDescription>
            اول مدت را انتخاب کن، بعد یکی از بازه‌های پیشنهادی را انتخاب و تأیید کن —
            هیچ چیزی بدون تأیید تو ساخته نمی‌شود.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Duration — from estimate or explicit user pick (§11) */}
          <div>
            <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">
              مدت انجام
              {task.estimateMinutes ? (
                <span className="ms-1 font-normal">
                  (تخمین ثبت‌شده: {minutesFa(task.estimateMinutes)})
                </span>
              ) : (
                <span className="ms-1 font-normal">— مدت نامشخص است، خودت انتخاب کن</span>
              )}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_CHOICES.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={minutes === m}
                  onClick={() => pickDuration(m)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                    minutes === m
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/70 bg-white/60 text-muted-foreground hover:border-primary/40 dark:bg-white/5",
                  )}
                >
                  {m < 60 ? `${toFa(m)} دقیقه` : `${toFa(m / 60)} ساعت`}
                </button>
              ))}
              <label className="flex items-center gap-1 rounded-lg border border-border/70 bg-white/60 px-2 dark:bg-white/5">
                <span className="text-[11px] font-bold text-muted-foreground">سفارشی</span>
                <input
                  type="number"
                  min={5}
                  max={600}
                  step={5}
                  value={custom}
                  onChange={(e) => {
                    setCustom(e.target.value);
                    const v = Number(e.target.value);
                    pickDuration(Number.isFinite(v) && v > 0 ? v : null);
                  }}
                  aria-label="مدت دلخواه به دقیقه"
                  className="h-8 w-14 bg-transparent text-[12px] font-bold tabular-nums outline-none"
                />
              </label>
            </div>
          </div>

          {/* Proposed slots — deterministic, explained */}
          {minutes && minutes > 0 && placement ? (
            <div>
              <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">
                بازه‌های پیشنهادی
              </p>
              <SlotList
                placement={placement}
                value={activeKey}
                onChange={setPicked}
                emptyTitle="در روزهای آینده جای خالی به اندازه این مدت پیدا نشد."
              />
            </div>
          ) : (
            <p className="text-[11px] leading-5 text-muted-foreground">
              برای پیشنهاد زمان، اول یک مدت انتخاب کن — مدت را حدس نمی‌زنیم.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            <X className="size-4" />
            انصراف
          </Button>
          <Button onClick={() => void confirm()} disabled={!active || busy}>
            <CalendarPlus className="size-4" />
            زمان‌بندی کن
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* 2 — Reschedule an existing block                                    */
/* ------------------------------------------------------------------ */

export function RescheduleDialog({
  schedule,
  block,
  onClose,
}: {
  schedule: UseScheduleResult;
  block: ScheduleBlock;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const placement = useMemo<PlacementResult>(
    () => suggestReschedule(block, schedule.result.days, schedule.prefs),
    [block, schedule.result.days, schedule.prefs],
  );

  const slots = placement.slots;
  const activeKey = picked ?? (slots[0] ? `${slots[0].day}:${slots[0].start}` : null);
  const active = slots.find((s) => `${s.day}:${s.start}` === activeKey);

  const confirm = async () => {
    if (!active || busy) return;
    setBusy(true);
    try {
      await schedule.updateBlock(block._id as Id<"timeBlocks">, {
        day: active.day,
        startTime: active.start,
        endTime: active.end,
        source: "reschedule",
      });
      toast.success(`«${block.title}» جابه‌جا شد`, {
        description: `${toFa(active.day)} — ${timeFa(active.start)} تا ${timeFa(active.end)}`,
      });
      onClose();
    } catch {
      toast.error("جابه‌جایی انجام نشد — دوباره تلاش کن.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="size-4 text-primary" aria-hidden />
            زمان‌بندی مجدد «{block.title}»
          </DialogTitle>
          <DialogDescription>
            بازه فعلی {timeFa(block.startTime)}–{timeFa(block.endTime)} است؛ یکی از
            جایگزین‌های زیر را انتخاب کن تا اعمال شود.
          </DialogDescription>
        </DialogHeader>

        <SlotList
          placement={placement}
          value={activeKey}
          onChange={setPicked}
          emptyTitle="جایگزین خالی پیدا نشد — تعهدهای این روز را بازبینی کن."
        />

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            <X className="size-4" />
            انصراف
          </Button>
          <Button onClick={() => void confirm()} disabled={!active || busy}>
            <MoveHorizontal className="size-4" />
            انتقال به این بازه
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* 3 — Bulk move preview (§30: never apply silently)                   */
/* ------------------------------------------------------------------ */

export function MovePreviewDialog({
  schedule,
  target,
  onClose,
}: {
  schedule: UseScheduleResult;
  target: { title: string; moves: ProposedMove[] };
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await schedule.applyMoves(target.moves);
      toast.success(`${toFa(target.moves.length)} تغییر اعمال شد.`);
      onClose();
    } catch {
      toast.error("اعمال تغییرات ناموفق بود — دوباره تلاش کن.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MoveHorizontal className="size-4 text-primary" aria-hidden />
            پیش‌نمایش تغییرات پیشنهادی
          </DialogTitle>
          <DialogDescription>
            {target.title} — هیچ‌چیز هنوز تغییر نکرده است. بازبینی کن و بعد تصمیم بگیر.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2">
          {target.moves.map((m) => (
            <li
              key={`${m.blockId}:${m.from.day}:${m.from.start}`}
              className="rounded-xl border border-border/60 bg-white/50 px-3 py-2.5 dark:bg-white/5"
            >
              <p className="text-[12px] font-extrabold">{m.title}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                <span className="rounded-md bg-muted px-1.5 py-0.5 font-bold tabular-nums">
                  {toFa(m.from.day)} {timeFa(m.from.start)}–{timeFa(m.from.end)}
                </span>
                <span aria-hidden>←</span>
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-bold tabular-nums text-primary">
                  {toFa(m.to.day)} {timeFa(m.to.start)}–{timeFa(m.to.end)}
                </span>
              </p>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            <X className="size-4" />
            انصراف
          </Button>
          <Button onClick={() => void confirm()} disabled={busy || target.moves.length === 0}>
            <CheckCircle2 className="size-4" />
            اعمال تغییرات ({toFa(target.moves.length)})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
