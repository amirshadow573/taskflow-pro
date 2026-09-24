import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { useGoals } from "@/hooks/use-goals";
import { findGoal } from "@/lib/goals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { toFa, formatJalaliShort } from "@/lib/persian";
import { isOverdue } from "@/lib/task-utils";
import {
  FolderKanban,
  LayoutGrid,
  List,
  Plus,
  Trash2,
  TriangleAlert,
  Target,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

const PROJECT_COLORS = [
  "#4f46e5",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#64748b",
];

export default function Projects() {
  const { tasks, projects, createProject, deleteProject } = useWorkspace();
  const goals = useGoals();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [deadline, setDeadline] = useState("");
  const [goalRef, setGoalRef] = useState("");

  const statsOf = (pid: string) => {
    const pts = tasks.filter((t) => t.projectId === pid && !t.parentId);
    const done = pts.filter((t) => t.status === "done").length;
    const overdue = pts.filter((t) => isOverdue(t)).length;
    return { total: pts.length, done, overdue, pct: pts.length ? Math.round((done / pts.length) * 100) : 0 };
  };

  const submit = async () => {
    if (!name.trim()) return;
    await createProject({
      name,
      description: desc || undefined,
      color,
      deadline: deadline || undefined,
      goalRef: goalRef || undefined,
    });
    setName("");
    setDesc("");
    setDeadline("");
    setGoalRef("");
    setCreating(false);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <FolderKanban className="size-6 text-primary" />
            پروژه‌ها
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {toFa(projects.length)} پروژه فعال
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-border">
            <button
              onClick={() => setView("grid")}
              aria-label="نمایش شبکه‌ای"
              className={cn(
                "grid size-9 place-items-center",
                view === "grid" ? "bg-accent text-accent-foreground" : "bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              onClick={() => setView("list")}
              aria-label="نمایش لیستی"
              className={cn(
                "grid size-9 place-items-center border-s border-border",
                view === "list" ? "bg-accent text-accent-foreground" : "bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              <List className="size-4" />
            </button>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            پروژه جدید
          </Button>
        </div>
      </header>

      {/* Create dialog */}
      {creating && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4 backdrop-blur-sm"
          onClick={() => setCreating(false)}
        >
          <div
            role="dialog"
            aria-label="ساخت پروژه جدید"
            onClick={(e) => e.stopPropagation()}
            className="ui-popover w-full max-w-md rounded-2xl p-5"
          >
            <h2 className="mb-4 text-base font-bold">پروژه جدید</h2>
            <div className="space-y-3">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="نام پروژه؛ مثلاً بازطراحی وب‌سایت"
                aria-label="نام پروژه"
                autoFocus
              />
              <Textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="توضیح کوتاه (اختیاری)"
                aria-label="توضیح پروژه"
                className="min-h-16"
              />
              {(goals ?? []).length > 0 && (
                <div>
                  <label
                    htmlFor="project-goal"
                    className="mb-1 block text-[11px] font-bold text-muted-foreground"
                  >
                    این پروژه کدام هدف را جلو می‌برد؟ (اختیاری)
                  </label>
                  <select
                    id="project-goal"
                    value={goalRef}
                    onChange={(e) => setGoalRef(e.target.value)}
                    className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">بدون هدف</option>
                    {(goals ?? []).map((g) => (
                      <option key={g.ref} value={g.ref}>
                        {g.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  aria-label="ددلاین"
                  className="flex-1"
                />
                <div className="flex gap-1.5">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      aria-label={`رنگ ${c}`}
                      className={cn(
                        "size-6 rounded-full border-2 transition-transform",
                        color === c ? "scale-110 border-foreground/50" : "border-transparent",
                      )}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreating(false)}>
                انصراف
              </Button>
              <Button onClick={submit} disabled={!name.trim()}>
                ساخت پروژه
              </Button>
            </div>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <Empty className="p-12">
          <EmptyMedia variant="icon">
            <FolderKanban />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>هنوز پروژه‌ای نداری.</EmptyTitle>
            <EmptyDescription>
              پروژه‌ها جای دسته‌بندی کارهای بزرگ‌تر هستند؛ مثلاً «بازطراحی سایت» یا
              «پروژه دانشگاه».
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              ساخت اولین پروژه
            </Button>
          </EmptyContent>
        </Empty>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const s = statsOf(p._id);
            const g = findGoal(goals, p.goalRef);
            return (
              <Link key={p._id} to={`/projects/${p._id}`}>
                <article className="group ui-surface ui-surface-hover h-full rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="grid size-9 place-items-center rounded-lg text-white"
                        style={{ background: p.color }}
                      >
                        <FolderKanban className="size-4" />
                      </span>
                      <div>
                        <h2 className="text-sm font-bold">{p.name}</h2>
                        <p className="text-[11px] text-muted-foreground">
                          {toFa(s.total)} کار
                          {p.deadline && ` · تا ${formatJalaliShort(new Date(p.deadline + "T00:00:00"))}`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        if (confirm(`حذف پروژه «${p.name}»؟ کارهایش حذف نمی‌شوند.`))
                          void deleteProject(p._id);
                      }}
                      aria-label={`حذف ${p.name}`}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                  {g && (
                    <p className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-primary">
                      <Target className="size-3" aria-hidden />
                      هدف: {g.title}
                    </p>
                  )}
                  {p.description && (
                    <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {p.description}
                    </p>
                  )}
                  <div className="mt-4">
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${s.pct}%`, background: p.color }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        {toFa(s.done)}/{toFa(s.total)} انجام شده
                      </span>
                      <span className="flex items-center gap-2">
                        {s.overdue > 0 && (
                          <span className="inline-flex items-center gap-0.5 font-bold text-destructive">
                            <TriangleAlert className="size-3" />
                            {toFa(s.overdue)}
                          </span>
                        )}
                        <span className="font-extrabold" style={{ color: p.color }}>
                          {toFa(s.pct)}٪
                        </span>
                      </span>
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      ) : (
        <section className="ui-surface overflow-hidden rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-start text-xs text-muted-foreground">
                <th className="px-4 py-3 text-start font-semibold">پروژه</th>
                <th className="px-4 py-3 text-start font-semibold">پیشرفت</th>
                <th className="hidden px-4 py-3 text-start font-semibold sm:table-cell">کارها</th>
                <th className="hidden px-4 py-3 text-start font-semibold md:table-cell">ددلاین</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const s = statsOf(p._id);
                return (
                  <tr key={p._id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link to={`/projects/${p._id}`} className="flex items-center gap-2 font-semibold hover:text-primary">
                        <span className="size-2.5 rounded-sm" style={{ background: p.color }} />
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: p.color }} />
                        </div>
                        <span className="text-xs font-bold tabular-nums">{toFa(s.pct)}٪</span>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">
                      {toFa(s.done)}/{toFa(s.total)}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">
                      {p.deadline ? formatJalaliShort(new Date(p.deadline + "T00:00:00")) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
