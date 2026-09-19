import { AppShell } from "./AppShell";
import { CommandPalette } from "./CommandPalette";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

/** Seeds realistic Persian sample data once per fresh account. */
function useDemoSeed(enabled: boolean) {
  const seed = useMutation(api.tasks.seedDemo);
  useEffect(() => {
    if (enabled && !localStorage.getItem("taskly-seeded")) {
      seed()
        .then(() => localStorage.setItem("taskly-seeded", "1"))
        .catch(() => void 0);
    }
  }, [enabled, seed]);
}

export interface TaskDoc {
  _id: Id<"tasks">;
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

export interface ProjectDoc {
  _id: Id<"projects">;
  name: string;
  description?: string;
  color: string;
  deadline?: string;
  status: string;
}

interface WorkspaceCtx {
  tasks: TaskDoc[];
  projects: ProjectDoc[];
  createTask: (args: {
    title: string;
    dueDate?: string;
    dueTime?: string;
    priority?: string;
    tags?: string[];
    status?: string;
    projectId?: Id<"projects">;
    parentId?: Id<"tasks">;
  }) => Promise<void>;
  updateTask: (id: Id<"tasks">, patch: Record<string, unknown>) => Promise<void>;
  toggleDone: (task: TaskDoc, done: boolean) => Promise<void>;
  deleteTask: (id: Id<"tasks">) => Promise<void>;
  createProject: (args: {
    name: string;
    description?: string;
    color?: string;
    deadline?: string;
  }) => Promise<void>;
  updateProject: (id: Id<"projects">, patch: Record<string, unknown>) => Promise<void>;
  deleteProject: (id: Id<"projects">) => Promise<void>;
  openTaskId: Id<"tasks"> | null;
  openTask: (id: Id<"tasks"> | null) => void;
}

const Ctx = createContext<WorkspaceCtx | null>(null);

export function useWorkspace() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceData");
  return ctx;
}

export function WorkspaceData({ children }: { children: React.ReactNode }) {
  const tasks = useQuery(api.tasks.list, {});
  const projects = useQuery(api.projects.list, {});

  const createTaskMut = useMutation(api.tasks.create);
  const updateTaskMut = useMutation(api.tasks.update);
  const toggleMut = useMutation(api.tasks.toggleDone);
  const deleteTaskMut = useMutation(api.tasks.remove);
  const createProjectMut = useMutation(api.projects.create);
  const updateProjectMut = useMutation(api.projects.update);
  const deleteProjectMut = useMutation(api.projects.remove);

  const [openTaskId, setOpenTaskId] = useState<Id<"tasks"> | null>(null);

  useDemoSeed(tasks !== undefined);

  // Global Ctrl+K
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (e.key.toLowerCase() === "n" && !e.ctrlKey && !e.metaKey) {
        const el = document.activeElement;
        if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("quick-add-task"));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const wrap = async (fn: () => Promise<unknown>, okMsg?: string) => {
    try {
      await fn();
      if (okMsg) toast.success(okMsg);
    } catch {
      toast.error("ارتباط با سرور برقرار نشد. دوباره تلاش کن.");
    }
  };

  const ctx: WorkspaceCtx = {
    tasks: tasks ?? [],
    projects: projects ?? [],
    createTask: (args) =>
      wrap(async () => {
        await createTaskMut({ ...args, tags: args.tags ?? [] });
        toast.success("کار ساخته شد");
      }),
    updateTask: (id, patch) => wrap(() => updateTaskMut({ id, ...patch })),
    toggleDone: (task, done) =>
      wrap(async () => {
        await toggleMut({ id: task._id, done });
        if (done) toast.success(`«${task.title}» انجام شد ✓`);
      }),
    deleteTask: (id) =>
      wrap(async () => {
        await deleteTaskMut({ id });
        setOpenTaskId(null);
        toast.success("کار حذف شد");
      }),
    createProject: (args) =>
      wrap(async () => {
        await createProjectMut(args);
        toast.success("پروژه ساخته شد");
      }),
    updateProject: (id, patch) => wrap(() => updateProjectMut({ id, ...patch })),
    deleteProject: (id) =>
      wrap(async () => {
        await deleteProjectMut({ id });
        toast.success("پروژه حذف شد");
      }),
    openTaskId,
    openTask: setOpenTaskId,
  };

  const loading = tasks === undefined || projects === undefined;

  // Derived notification list
  const todayKeyStr = (() => {
    const d = new Date();
    const p = (n: number) => (n < 10 ? `0${n}` : String(n));
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  })();

  const overdue = (tasks ?? []).filter(
    (t) => t.dueDate && t.dueDate < todayKeyStr && t.status !== "done" && !t.parentId,
  );
  const dueToday = (tasks ?? []).filter(
    (t) => t.dueDate === todayKeyStr && t.status !== "done" && !t.parentId,
  );

  const notifications = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      body: string;
      tone: "warning" | "info" | "danger";
    }> = [];
    for (const t of overdue.slice(0, 3)) {
      list.push({
        id: `ov-${t._id}`,
        title: `عقب‌افتاده: ${t.title}`,
        body: "زمان انجام این کار گذشته است.",
        tone: "danger",
      });
    }
    for (const t of dueToday.slice(0, 3)) {
      list.push({
        id: `td-${t._id}`,
        title: `امروزی: ${t.title}`,
        body: "این کار برای امروز برنامه‌ریزی شده.",
        tone: "warning",
      });
    }
    return list;
  }, [overdue, dueToday]);

  return (
    <Ctx.Provider value={ctx}>
      <AppShell
        inboxCount={(tasks ?? []).filter((t) => t.status === "inbox" && !t.parentId).length}
        overdueCount={overdue.length}
        notifications={notifications}
      >
        {loading ? (
          <PageSkeleton />
        ) : (
          children
        )}
      </AppShell>
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        tasks={(tasks ?? []).filter((t) => !t.parentId)}
        projects={projects ?? []}
        onOpenTask={(id) => setOpenTaskId(id as Id<"tasks">)}
        onQuickAdd={(title) => {
          if (title) void ctx.createTask({ title, status: "inbox" });
        }}
      />
    </Ctx.Provider>
  );
}

/** Layout-stable skeleton that preserves structure while loading. */
export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div className="skeleton h-9 w-56" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="skeleton mb-3 h-4 w-20" />
            <div className="skeleton h-7 w-14" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-0">
            <div className="skeleton size-5 rounded-full" />
            <div className="skeleton h-4 flex-1" style={{ maxWidth: `${65 - i * 6}%` }} />
            <div className="skeleton h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
