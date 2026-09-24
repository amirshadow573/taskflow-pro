import { AppShell } from "./AppShell";
import { CommandPalette } from "./CommandPalette";
import { ProgressProvider, emitProgressionEvent } from "@/components/progress/ProgressProvider";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

/**
 * Seeds realistic Persian sample data once per fresh account.
 * Returns true once any seeding attempt has settled, so the progression
 * bootstrap can wait and rebuild history from the seeded work.
 */
function useDemoSeed(enabled: boolean): boolean {
  const seed = useMutation(api.tasks.seedDemo);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    if (localStorage.getItem("taskly-seeded")) {
      setSettled(true);
      return;
    }
    seed()
      .then(() => localStorage.setItem("taskly-seeded", "1"))
      .catch(() => void 0)
      .finally(() => setSettled(true));
  }, [enabled, seed]);
  return settled;
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
  /** Phase 09: `${kind}:${goalId}` — links a project to the goal it serves. */
  goalRef?: string;
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
    /** Phase 09: links the project to a goal (`${kind}:${goalId}`). */
    goalRef?: string;
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

export function WorkspaceData({
  children,
  chrome = true,
}: {
  children: React.ReactNode;
  /** When false, renders children without the app shell (used by onboarding). */
  chrome?: boolean;
}) {
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

  const seedSettled = useDemoSeed(tasks !== undefined);

  // Global Ctrl+K
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    const openPalette = () => setPaletteOpen(true);
    window.addEventListener("open-command-palette", openPalette);
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
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("open-command-palette", openPalette);
    };
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
        // The mutation returns progression info (XP, level-up, achievements).
        const result = await toggleMut({ id: task._id, done });
        if (done) toast.success(`«${task.title}» انجام شد ✓`);
        if (result && (result.levelUp || result.unlocked.length > 0)) {
          emitProgressionEvent({
            levelUp: result.levelUp,
            unlocked: result.unlocked,
            xp: result.xp,
          });
        }
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
    // Phase 09: project deadlines closing in — capped to avoid notification spam.
    const soon = todayKeyStr;
    for (const p of (projects ?? [])) {
      if (!p.deadline || p.deadline < soon) continue;
      const days = Math.round(
        (Date.parse(`${p.deadline}T00:00:00`) - Date.parse(`${soon}T00:00:00`)) /
          86400000,
      );
      if (days > 7) continue;
      list.push({
        id: `pdl-${p._id}`,
        title: `نزدیک ددلاین پروژه: ${p.name}`,
        body:
          days === 0
            ? "ددلاین این پروژه امروز است."
            : `${new Intl.NumberFormat("fa-IR").format(days)} روز تا ددلاین این پروژه باقی مانده.`,
        tone: "warning",
      });
    }
    return list;
  }, [overdue, dueToday, projects, todayKeyStr]);

  const palette = (
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
  );

  return (
    <Ctx.Provider value={ctx}>
      <ProgressProvider ready={seedSettled && !loading}>
        {chrome ? (
          <>
            <AppShell
              inboxCount={(tasks ?? []).filter((t) => t.status === "inbox" && !t.parentId).length}
              overdueCount={overdue.length}
              notifications={notifications}
            >
              {loading ? <PageSkeleton /> : children}
            </AppShell>
            {palette}
          </>
        ) : loading ? (
          <PageSkeleton />
        ) : (
          children
        )}
      </ProgressProvider>
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
          <div key={i} className="ui-surface rounded-xl p-4">
            <div className="skeleton mb-3 h-4 w-20" />
            <div className="skeleton h-7 w-14" />
          </div>
        ))}
      </div>
      <div className="ui-surface overflow-hidden rounded-xl">
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
