import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { TaskRow } from "@/components/tasks/TaskRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PRIORITIES, type PriorityKey } from "@/components/ui/badge";
import { toFa } from "@/lib/persian";
import { todayKey, addDaysKey, isOverdue } from "@/lib/task-utils";
import { CircleDot, Filter, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import type { Id } from "@/convex/_generated/dataModel";

type QuickFilter = "all" | "today" | "upcoming" | "overdue" | "completed";

const QUICK: Array<{ key: QuickFilter; label: string }> = [
  { key: "all", label: "همه" },
  { key: "today", label: "امروز" },
  { key: "upcoming", label: "آینده" },
  { key: "overdue", label: "عقب‌افتاده" },
  { key: "completed", label: "انجام‌شده" },
];

export default function MyTasks() {
  const { tasks, projects, toggleDone, deleteTask, openTask } = useWorkspace();
  const [params, setParams] = useSearchParams();

  // Audit fix: the quick filter was read from the URL only on first mount, so
  // following a `/tasks?filter=overdue` link while already on /tasks silently
  // did nothing. The URL is now the single source of truth and stays in sync,
  // so refresh and back/forward both restore the exact view.
  const quick = (params.get("filter") as QuickFilter) || "all";
  const setQuick = (next: QuickFilter) => {
    const p = new URLSearchParams(params);
    if (next === "all") p.delete("filter");
    else p.set("filter", next);
    setParams(p, { replace: true });
  };
  const projectId = params.get("project") ?? "";
  const setProjectId = (next: string) => {
    const p = new URLSearchParams(params);
    if (next) p.set("project", next);
    else p.delete("project");
    setParams(p, { replace: true });
  };
  const [priority, setPriority] = useState<string>("");
  const [tag, setTag] = useState<string>("");
  const [groupBy, setGroupBy] = useState<"none" | "project" | "date">("project");
  const [search, setSearch] = useState("");

  const root = tasks.filter((t) => !t.parentId);
  const projectOf = (id?: string) => projects.find((p) => p._id === id);
  const allTags = useMemo(
    () => Array.from(new Set(root.flatMap((t) => t.tags))).slice(0, 12),
    [root],
  );

  const filtered = useMemo(() => {
    let list = root;
    if (quick === "today") list = list.filter((t) => t.dueDate === todayKey());
    if (quick === "upcoming") list = list.filter((t) => t.dueDate && t.dueDate > todayKey() && t.status !== "done");
    if (quick === "overdue") list = list.filter((t) => isOverdue(t));
    if (quick === "completed") list = list.filter((t) => t.status === "done");
    if (projectId) list = list.filter((t) => t.projectId === projectId);
    if (priority) list = list.filter((t) => t.priority === priority);
    if (tag) list = list.filter((t) => t.tags.includes(tag));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q));
    }
    return list;
  }, [root, quick, projectId, priority, tag, search]);

  const subtotals = new Map<string, { total: number; done: number }>();
  for (const t of tasks) {
    if (!t.parentId) continue;
    const cur = subtotals.get(t.parentId) ?? { total: 0, done: 0 };
    cur.total += 1;
    if (t.status === "done") cur.done += 1;
    subtotals.set(t.parentId, cur);
  }

  const TaskList = ({ items }: { items: typeof root }) => (
    <ul>
      {items.map((t) => (
        <TaskRow
          key={t._id}
          task={t}
          project={projectOf(t.projectId)}
          subtaskTotal={subtotals.get(t._id)?.total}
          subtaskDone={subtotals.get(t._id)?.done}
          onToggle={(done) => toggleDone(t, done)}
          onOpen={() => openTask(t._id)}
          onDelete={() => deleteTask(t._id)}
        />
      ))}
    </ul>
  );

  const hasFilters = quick !== "all" || projectId || priority || tag || search;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <CircleDot className="size-6 text-primary" />
            کارهای من
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {toFa(filtered.length)} کار {hasFilters ? "(فیلترشده)" : ""}
          </p>
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="جست‌وجو در کارها…"
          aria-label="جست‌وجو در کارها"
          className="h-9 w-full max-w-56"
        />
      </header>

      {/* Quick filters */}
      <div className="flex flex-wrap items-center gap-1.5">
        {QUICK.map((f) => (
          <button
            key={f.key}
            onClick={() => setQuick(f.key)}
            className={
              quick === f.key
                ? "rounded-lg bg-gradient-to-l from-primary to-[#5B5FE6] px-3 py-1.5 text-xs font-bold text-white shadow-[0_8px_20px_-12px_rgba(37,99,235,0.95)]"
                : "ui-field rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Advanced filters row */}
      <div className="ui-field flex flex-wrap items-center gap-2 rounded-xl p-2">
        <span className="flex items-center gap-1 ps-1 text-xs font-bold text-muted-foreground">
          <Filter className="size-3.5" />
          فیلترها:
        </span>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="h-8 rounded-md border border-input bg-card px-2 text-xs outline-none"
          aria-label="فیلتر پروژه"
        >
          <option value="">همه پروژه‌ها</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="h-8 rounded-md border border-input bg-card px-2 text-xs outline-none"
          aria-label="فیلتر اولویت"
        >
          <option value="">همه اولویت‌ها</option>
          {(Object.keys(PRIORITIES) as PriorityKey[]).map((k) => (
            <option key={k} value={k}>
              {PRIORITIES[k].label}
            </option>
          ))}
        </select>
        {allTags.length > 0 && (
          <select
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="h-8 rounded-md border border-input bg-card px-2 text-xs outline-none"
            aria-label="فیلتر تگ"
          >
            <option value="">همه تگ‌ها</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                #{t}
              </option>
            ))}
          </select>
        )}
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
          className="h-8 rounded-md border border-input bg-card px-2 text-xs outline-none"
          aria-label="گروه‌بندی"
        >
          <option value="project">گروه: پروژه</option>
          <option value="date">گروه: تاریخ</option>
          <option value="none">بدون گروه</option>
        </select>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="ms-auto"
            onClick={() => {
              setQuick("all");
              setProjectId("");
              setPriority("");
              setTag("");
              setSearch("");
              setParams({});
            }}
          >
            <X className="size-3.5" />
            پاک کردن فیلترها
          </Button>
        )}
      </div>

      {/* Grouped lists */}
      {filtered.length === 0 ? (
        <Empty className="p-12">
          <EmptyMedia variant="icon">
            <CircleDot />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>کاری با این فیلترها پیدا نشد.</EmptyTitle>
            <EmptyDescription>
              فیلترها را تغییر بده یا کار جدیدی بساز.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : groupBy === "none" ? (
        <section className="ui-surface overflow-hidden rounded-2xl">
          <TaskList items={filtered} />
        </section>
      ) : (
        <div className="space-y-5">
          {(() => {
            const groups = new Map<string, typeof filtered>();
            for (const t of filtered) {
              const key =
                groupBy === "project"
                  ? t.projectId ?? "none"
                  : t.dueDate ?? "بدون تاریخ";
              const arr = groups.get(key) ?? [];
              arr.push(t);
              groups.set(key, arr);
            }
            return Array.from(groups.entries()).map(([key, items]) => {
              const label =
                groupBy === "project"
                  ? key === "none"
                    ? "بدون پروژه"
                    : projectOf(key)?.name ?? "بدون پروژه"
                  : key;
              const color =
                groupBy === "project" ? projectOf(key)?.color : undefined;
              return (
                <section key={key} className="ui-surface overflow-hidden rounded-2xl">
                  <div className="flex items-center gap-2 border-b border-border/70 px-4 py-2.5">
                    {color && <span className="size-2.5 rounded-sm" style={{ background: color }} />}
                    <h2 className="text-sm font-bold">{label}</h2>
                    <span className="text-[11px] text-muted-foreground">
                      {toFa(items.length)} کار
                    </span>
                  </div>
                  <TaskList items={items} />
                </section>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}
