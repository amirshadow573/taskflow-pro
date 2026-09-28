/**
 * useScheduleDialogs — Phase 11 §21 / §23 / §30.
 *
 * One owner for every scheduling confirmation flow, shared by the Today
 * page, the Scheduling Center and any future surface:
 *
 *   openScheduleTask(task)   → ScheduleTaskDialog (duration → slots → confirm)
 *   openReschedule(block)    → RescheduleDialog   (pick alternative → confirm)
 *   openMoves(moves, title)  → MovePreviewDialog  (preview → apply / cancel)
 *   completeBlock(block)     → linked TASK via the existing toggleDone path
 *                              (single XP/stat event — §24/§32), or the block
 *                              itself when no task is attached
 *   keepUnscheduled(block)   → cancel the block only; the task keeps its
 *                              status and history untouched (§23)
 *
 * Dialogs are mounted conditionally with a key, so each target starts from
 * clean local state (no state-reset effects).
 */
import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { useWorkspace, type TaskDoc } from "@/components/workspace/WorkspaceData";
import type { ProposedMove, ScheduleBlock } from "@/lib/scheduling";
import type { UseScheduleResult } from "@/hooks/use-schedule";
import { MovePreviewDialog, RescheduleDialog, ScheduleTaskDialog } from "./ScheduleDialogs";

export interface ScheduleDialogActions {
  /** Open the task → block flow (duration, then proposed slots). */
  openScheduleTask: (task: TaskDoc) => void;
  /** Open the reschedule flow for an existing block. */
  openReschedule: (block: ScheduleBlock) => void;
  /** Open the preview-then-apply flow for a list of proposed moves. */
  openMoves: (moves: ProposedMove[], title?: string) => void;
  /** Complete the linked task (existing service) or mark the block done. */
  completeBlock: (block: ScheduleBlock) => Promise<void>;
  /** Keep unscheduled: cancel the block, preserve the task untouched (§23). */
  keepUnscheduled: (block: ScheduleBlock) => Promise<void>;
}

export function useScheduleDialogs(
  schedule: UseScheduleResult,
): ScheduleDialogActions & { dialogs: React.ReactNode } {
  const { tasks, toggleDone } = useWorkspace();

  const [taskTarget, setTaskTarget] = useState<TaskDoc | null>(null);
  const [blockTarget, setBlockTarget] = useState<ScheduleBlock | null>(null);
  const [movesTarget, setMovesTarget] = useState<{
    title: string;
    moves: ProposedMove[];
  } | null>(null);

  const completeBlock = useCallback(
    async (block: ScheduleBlock) => {
      const task = block.taskId
        ? tasks.find((t) => t._id === block.taskId)
        : undefined;
      try {
        if (task) {
          if (task.status !== "done") await toggleDone(task, true);
          toast.success("کار انجام شد — بلوک و پیشرفت با هم به‌روز شدند.");
        } else {
          await schedule.updateBlock(block._id as Id<"timeBlocks">, {
            status: "completed",
          });
          toast.success("بلوک به‌عنوان انجام‌شده علامت خورد.");
        }
      } catch {
        toast.error("ثبت انجام ناموفق بود — دوباره تلاش کن.");
      }
    },
    [tasks, toggleDone, schedule],
  );

  const keepUnscheduled = useCallback(
    async (block: ScheduleBlock) => {
      try {
        await schedule.updateBlock(block._id as Id<"timeBlocks">, {
          status: "cancelled",
        });
        toast.success("بلوک از برنامه حذف شد — خود کار دست‌نخورده ماند.");
      } catch {
        toast.error("حذف بلوک ناموفق بود — دوباره تلاش کن.");
      }
    },
    [schedule],
  );

  const dialogs = (
    <>
      {taskTarget && (
        <ScheduleTaskDialog
          key={taskTarget._id}
          schedule={schedule}
          task={taskTarget}
          onClose={() => setTaskTarget(null)}
        />
      )}
      {blockTarget && (
        <RescheduleDialog
          key={blockTarget._id}
          schedule={schedule}
          block={blockTarget}
          onClose={() => setBlockTarget(null)}
        />
      )}
      {movesTarget && (
        <MovePreviewDialog
          key={`${movesTarget.title}:${movesTarget.moves.length}`}
          schedule={schedule}
          target={movesTarget}
          onClose={() => setMovesTarget(null)}
        />
      )}
    </>
  );

  return {
    openScheduleTask: setTaskTarget,
    openReschedule: setBlockTarget,
    openMoves: (moves, title) =>
      moves.length > 0 && setMovesTarget({ title: title ?? "انتقال پیشنهادی", moves }),
    completeBlock,
    keepUnscheduled,
    dialogs,
  };
}
