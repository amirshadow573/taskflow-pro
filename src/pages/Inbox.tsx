import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { TaskRow } from "@/components/tasks/TaskRow";
import { SmartTaskInput } from "@/components/tasks/SmartTaskInput";
import { Button } from "@/components/ui/button";
import { Badge, PRIORITIES, type PriorityKey } from "@/components/ui/badge";
import { toFa } from "@/lib/persian";
import { todayKey, addDaysKey } from "@/lib/task-utils";
import { Inbox as InboxIcon, Inbox, MoveRight, CalendarClock, Flag, Archive } from "lucide-react";
import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";

export default function InboxPage() {
  const { tasks, projects, createTask, updateTask, toggleDone, deleteTask, openTask } =
    useWorkspace();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const root = tasks.filter((t) => !t.parentId && t.status === "inbox");
  const projectOf = (id?: string) => projects.find((p) => p._id === id);

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const bulk = async (fn: (id: string) => Promise<void>) => {
    for (const id of selected) await fn(id);
    setSelected(new Set());
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <InboxIcon className="size-6 text-primary" />
          صندوق ورودی
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          هر چیزی که به ذهنت می‌رسد را اینجا بریز؛ بعداً مرتبش می‌کنی.
        </p>
      </header>

      <SmartTaskInput
        defaultStatus="inbox"
        placeholder="هر چیزی که به ذهن می‌رسد… بعداً مرتب می‌کنی"
        onCreate={(p) =>
          createTask({
            title: p.title,
            dueDate: p.dueDate,
            dueTime: p.dueTime,
            priority: p.priority,
            tags: p.tags,
            status: "inbox",
          })
        }
      />

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-accent px-3 py-2 elev-2">
          <span className="text-xs font-bold text-accent-foreground">
            {toFa(selected.size)} کار انتخاب شده
          </span>
          <div className="ms-auto flex flex-wrap items-center gap-1.5">
            <select
              onChange={(e) => {
                const pid = e.target.value;
                if (pid) void bulk((id) => updateTask(id as Id<"tasks">, { projectId: pid as Id<"projects"> }));
              }}
              defaultValue=""
              className="h-8 rounded-md border border-input bg-card px-2 text-xs outline-none"
              aria-label="اختصاص به پروژه"
            >
              <option value="">پروژه…</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={() => bulk((id) => updateTask(id as Id<"tasks">, { dueDate: todayKey(), status: "todo" }))}>
              <CalendarClock className="size-3.5" />
              انتقال به امروز
            </Button>
            <Button variant="outline" size="sm" onClick={() => bulk((id) => updateTask(id as Id<"tasks">, { dueDate: addDaysKey(1), status: "todo" }))}>
              فردا
            </Button>
            <select
              onChange={(e) => {
                const pr = e.target.value;
                if (pr) void bulk((id) => updateTask(id as Id<"tasks">, { priority: pr }));
              }}
              defaultValue=""
              className="h-8 rounded-md border border-input bg-card px-2 text-xs outline-none"
              aria-label="تغییر اولویت"
            >
              <option value="">اولویت…</option>
              {(Object.keys(PRIORITIES) as PriorityKey[]).map((k) => (
                <option key={k} value={k}>
                  {PRIORITIES[k].label}
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={() => bulk((id) => updateTask(id as Id<"tasks">, { archived: true }))}>
              <Archive className="size-3.5" />
              بایگانی
            </Button>
          </div>
        </div>
      )}

      <section className="ui-surface overflow-hidden rounded-2xl">
        {root.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-accent">
              <Inbox className="size-6 text-accent-foreground" />
            </div>
            <p className="text-sm font-semibold">صندوق ورودی خالی است.</p>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
              هر ایده یا کاری که به ذهنت می‌رسد را همین‌جا بنویس؛ بعداً با آرامش
              مرتبش می‌کنی.
            </p>
          </div>
        ) : (
          <ul>
            {root.map((t) => (
              <li key={t._id} className="flex items-center gap-2 border-b border-border/70 pe-3 last:border-0">
                <input
                  type="checkbox"
                  checked={selected.has(t._id)}
                  onChange={() => toggleSelect(t._id)}
                  aria-label={`انتخاب ${t.title}`}
                  className="ms-3 size-3.5 shrink-0 accent-[var(--primary)]"
                />
                <div className="min-w-0 flex-1">
                  <TaskRow
                    task={t}
                    project={projectOf(t.projectId)}
                    onToggle={(d) => toggleDone(t, d)}
                    onOpen={() => openTask(t._id)}
                    onDelete={() => deleteTask(t._id)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-center text-xs text-muted-foreground">
        نکته: روی هر کار کلیک کن تا جزئیاتش را ببینی و سریع مرتبش کنی.
      </p>
    </div>
  );
}
