import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { toFa, formatJalaliShort } from "@/lib/persian";
import { Archive, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

export default function ArchivePage() {
  const archived = useQuery(api.tasks.listArchived, {});
  const projects = useQuery(api.projects.list, {});
  const updateTask = useMutation(api.tasks.update);
  const removeTask = useMutation(api.tasks.remove);

  const projectOf = (id?: string) =>
    (projects ?? []).find((p) => p._id === id);

  const restore = async (id: Id<"tasks">) => {
    try {
      await updateTask({ id, archived: false });
      toast.success("کار بازیابی شد");
    } catch {
      toast.error("بازیابی ناموفق بود. دوباره تلاش کن.");
    }
  };

  const destroy = async (id: string) => {
    try {
      await removeTask({ id: id as Id<"tasks"> });
      toast.success("برای همیشه حذف شد");
    } catch {
      toast.error("حذف ناموفق بود.");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <Archive className="size-6 text-primary" />
          بایگانی
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          کارهای بایگانی‌شده اینجاست؛ می‌توانی بازیابی‌شان کنی یا برای همیشه حذف
          کنی.
        </p>
      </header>

      {archived === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-14 rounded-xl" />
          ))}
        </div>
      ) : archived.length === 0 ? (
        <Empty className="p-12">
          <EmptyMedia variant="icon">
            <Archive />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>بایگانی خالی است.</EmptyTitle>
            <EmptyDescription>
              کارهایی که دیگر لازم نداری را از صندوق ورودی بایگانی کن.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <section className="ui-surface overflow-hidden rounded-2xl">
          <ul>
            {archived.map((t) => {
              const p = projectOf(t.projectId);
              return (
                <li
                  key={t._id}
                  className="flex items-center gap-3 border-b border-border/70 px-4 py-3 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {p && (
                        <span className="me-2 inline-flex items-center gap-1">
                          <span className="size-1.5 rounded-sm" style={{ background: p.color }} />
                          {p.name}
                        </span>
                      )}
                      {t.dueDate && `سررسید: ${formatJalaliShort(new Date(t.dueDate + "T00:00:00"))}`}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => restore(t._id)}>
                    <RotateCcw className="size-3.5" />
                    بازیابی
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`حذف همیشگی ${t.title}`}
                    onClick={() => {
                      if (confirm(`«${t.title}» برای همیشه حذف شود؟`)) void destroy(t._id);
                    }}
                  >
                    <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {archived && archived.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {toFa(archived.length)} کار در بایگانی
        </p>
      )}
    </div>
  );
}
