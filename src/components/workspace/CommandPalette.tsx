import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toFa } from "@/lib/persian";
import {
  Check,
  ChevronLeft,
  CircleDot,
  CornerDownLeft,
  FolderKanban,
  ListTree,
  Plus,
  Search,
  Tag,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

export interface SearchTask {
  _id: string;
  title: string;
  status: string;
}

export interface SearchProject {
  _id: string;
  name: string;
}

export function CommandPalette({
  open,
  onOpenChange,
  tasks,
  projects,
  onOpenTask,
  onQuickAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tasks: SearchTask[];
  projects: SearchProject[];
  onOpenTask: (id: string) => void;
  onQuickAdd: (title: string) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const actions = useMemo(
    () => [
      { id: "act-add", label: "افزودن کار جدید", icon: Plus, run: () => onQuickAdd(query.trim()) },
      { id: "act-today", label: "برو به امروز", icon: CircleDot, run: () => navigate("/today") },
      { id: "act-inbox", label: "برو به صندوق ورودی", icon: ListTree, run: () => navigate("/inbox") },
      { id: "act-projects", label: "برو به پروژه‌ها", icon: FolderKanban, run: () => navigate("/projects") },
      { id: "act-progress", label: "برو به پیشرفت", icon: ListTree, run: () => navigate("/progress") },
    ],
    [navigate, onQuickAdd, query],
  );

  const q = query.trim().toLowerCase();
  const taskHits = q
    ? tasks.filter((t) => t.title.toLowerCase().includes(q)).slice(0, 6)
    : [];
  const projectHits = q
    ? projects.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 4)
    : [];
  const actionHits = q
    ? actions.filter((a) => a.label.includes(q)).slice(0, 4)
    : actions.slice(0, 5);

  const flat = [
    ...actionHits.map((a) => ({ kind: "action" as const, item: a })),
    ...taskHits.map((t) => ({ kind: "task" as const, item: t })),
    ...projectHits.map((p) => ({ kind: "project" as const, item: p })),
  ];

  useEffect(() => setIndex(0), [query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, flat.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const sel = flat[index];
        if (!sel) return;
        if (sel.kind === "action") sel.item.run();
        if (sel.kind === "task") onOpenTask(sel.item._id);
        if (sel.kind === "project") navigate("/projects");
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, flat, index, onOpenChange, onOpenTask, navigate]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/30 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-label="جست‌وجوی سریع"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-popover elev-3"
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جست‌وجو در کارها، پروژه‌ها… یا اجرای دستور"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          />
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
          {flat.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              نتیجه‌ای پیدا نشد. عبارت دیگری را امتحان کن.
            </p>
          )}

          {actionHits.length > 0 && (
            <div className="mb-1 px-3 py-1 text-[10px] font-bold text-muted-foreground">
              دستورها
            </div>
          )}
          {actionHits.map((a, i) => {
            const gi = flat.findIndex((f) => f.kind === "action" && f.item.id === a.id);
            return (
              <button
                key={a.id}
                onClick={() => {
                  a.run();
                  onOpenChange(false);
                }}
                onMouseEnter={() => setIndex(gi)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start text-sm",
                  gi === index ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                )}
              >
                <a.icon className="size-4 text-muted-foreground" />
                {a.label}
                {gi === index && (
                  <CornerDownLeft className="ms-auto size-3.5 text-muted-foreground" />
                )}
              </button>
            );
          })}

          {taskHits.length > 0 && (
            <div className="mb-1 mt-2 px-3 py-1 text-[10px] font-bold text-muted-foreground">
              کارها
            </div>
          )}
          {taskHits.map((t) => {
            const gi = flat.findIndex((f) => f.kind === "task" && f.item._id === t._id);
            return (
              <button
                key={t._id}
                onClick={() => {
                  onOpenTask(t._id);
                  onOpenChange(false);
                }}
                onMouseEnter={() => setIndex(gi)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start text-sm",
                  gi === index ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                )}
              >
                <CircleDot className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate">{t.title}</span>
                {t.status === "done" && <Check className="size-3.5 text-emerald-500" />}
              </button>
            );
          })}

          {projectHits.length > 0 && (
            <div className="mb-1 mt-2 px-3 py-1 text-[10px] font-bold text-muted-foreground">
              پروژه‌ها
            </div>
          )}
          {projectHits.map((p) => {
            const gi = flat.findIndex((f) => f.kind === "project" && f.item._id === p._id);
            return (
              <button
                key={p._id}
                onClick={() => {
                  navigate("/projects");
                  onOpenChange(false);
                }}
                onMouseEnter={() => setIndex(gi)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start text-sm",
                  gi === index ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                )}
              >
                <FolderKanban className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate">{p.name}</span>
                <ChevronLeft className="size-3.5 text-muted-foreground" />
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Tag className="size-3" />
            {toFa(tasks.length)} کار در فضای کاری
          </span>
          <span>↑↓ حرکت · Enter انتخاب</span>
        </div>
      </div>
    </div>
  );
}
