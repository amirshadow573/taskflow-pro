import { Plus } from "lucide-react";
import { SmartTaskInput } from "@/components/tasks/SmartTaskInput";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "./WorkspaceData";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";

/** Global "+ کار جدید" modal — one primary action per screen principle. */
export function QuickAddModal({
  open,
  onOpenChange,
  defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultProjectId?: Id<"projects">;
}) {
  const { projects, createTask } = useWorkspace();
  const [projectId, setProjectId] = useState<string>("");
  const [status, setStatus] = useState("todo");

  useEffect(() => {
    if (open) {
      setProjectId(defaultProjectId ?? "");
      setStatus("todo");
    }
  }, [open, defaultProjectId]);

  useEffect(() => {
    const handler = () => onOpenChange(true);
    window.addEventListener("quick-add-task", handler);
    return () => window.removeEventListener("quick-add-task", handler);
  }, [onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/30 p-4 pt-[14vh] backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-label="افزودن سریع کار"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-2xl border border-border bg-popover p-4 elev-3"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold">افزودن کار جدید</h2>
          <Button variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)} aria-label="بستن">
            <X className="size-4" />
          </Button>
        </div>

        <SmartTaskInput
          autoFocus
          onCreate={async (parsed) => {
            await createTask({
              title: parsed.title,
              dueDate: parsed.dueDate,
              dueTime: parsed.dueTime,
              priority: parsed.priority,
              tags: parsed.tags,
              status,
              projectId: (projectId || undefined) as Id<"projects"> | undefined,
            });
            onOpenChange(false);
          }}
        />

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-muted-foreground">
            پروژه
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-input bg-card px-2 text-sm font-normal text-foreground outline-none"
            >
              <option value="">بدون پروژه</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            وضعیت
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-input bg-card px-2 text-sm font-normal text-foreground outline-none"
            >
              <option value="todo">انجام نشده</option>
              <option value="in_progress">در حال انجام</option>
              <option value="inbox">صندوق ورودی</option>
            </select>
          </label>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
          می‌توانی تاریخ (امروز/فردا/شنبه)، ساعت، اولویت (#فوری / مهم) و #تگ را
          داخل همان جمله بنویسی.
        </p>
      </div>
    </div>
  );
}

/** Floating mobile add button. */
export function MobileFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="افزودن کار جدید"
      className="fixed bottom-20 end-4 z-40 grid size-13 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95 md:hidden"
    >
      <Plus className="size-6" />
    </button>
  );
}

// MobileFab is implemented in main.tsx (MobileFabHost); kept for API parity.
void MobileFab;
