/**
 * Phase 15 — compact dashboard AI area (§29).
 *
 * Rules encoded here:
 *  - The dashboard does NOT become a chatbot. This is one quiet strip.
 *  - Every number on it comes from a live query, never from the model (§18).
 *  - When AI is not configured it says so plainly and offers nothing fake (§26).
 */
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { ArrowLeft, Bot, CalendarClock, ListTodo, Sparkles } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { toFa } from "@/lib/persian";
import { todayKey } from "@/lib/task-utils";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/progress/progress-ui";
import { AIAssistantPanel } from "@/components/ai/AIAssistantPanel";
import { isTestMode } from "@/lib/personas";

export function AIOverviewCard() {
  const [open, setOpen] = useState(false);
  const guestMode = isTestMode();
  const status = useQuery(api.ai.status, guestMode ? "skip" : {});
  const tasks = useQuery(api.tasks.list, {});

  const facts = useMemo(() => {
    const today = todayKey();
    const all = tasks ?? [];
    const openTasks = all.filter((t) => t.status !== "done" && !t.archived);
    const dueToday = openTasks.filter((t) => t.dueDate === today);
    const overdue = openTasks.filter((t) => !!t.dueDate && t.dueDate < today);
    const upcoming = openTasks
      .filter((t) => !!t.dueDate && t.dueDate >= today)
      .sort((a, b) => ((a.dueDate as string) < (b.dueDate as string) ? -1 : 1))[0];
    const plannedMinutes = dueToday.reduce((n, t) => n + (t.estimateMinutes ?? 30), 0);
    return { dueToday: dueToday.length, overdue: overdue.length, upcoming, plannedMinutes };
  }, [tasks]);

  const configured = status?.configured ?? false;

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 md:px-8" aria-label="دستیار هوش مصنوعی">
        <div className="ui-surface rounded-2xl px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"
              aria-hidden="true"
            >
              <Bot className="size-4" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-xs font-extrabold">دستیار بهره‌وری</p>
                {configured ? (
                  <Pill toneKey="emerald">آماده</Pill>
                ) : (
                  <Pill toneKey="slate">پیکربندی نشده</Pill>
                )}
              </div>
              <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                {configured ? (
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <span className="inline-flex items-center gap-1">
                      <ListTodo className="size-3" aria-hidden="true" />
                      {toFa(facts.dueToday)} کار برای امروز
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="size-3" aria-hidden="true" />
                      {toFa(facts.plannedMinutes)} دقیقه برنامه‌ریزی‌شده
                    </span>
                    {facts.overdue > 0 && (
                      <span className="font-bold text-destructive">
                        {toFa(facts.overdue)} کار عقب‌افتاده
                      </span>
                    )}
                  </span>
                ) : (
                  "پس از افزودن کلید API، برنامه‌ریزی هوشمند فعال می‌شود. تا آن زمان همه‌چیز کار می‌کند."
                )}
              </p>
            </div>

            {configured && (
              <Button
                type="button"
                size="sm"
                className="h-8 shrink-0 text-[11px]"
                onClick={() => setOpen(true)}
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
                باز کردن دستیار
                <ArrowLeft className="size-3" aria-hidden="true" />
              </Button>
            )}
          </div>

          {configured && (status?.quickActions?.length ?? 0) > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-border/40 pt-2.5">
              {(status?.quickActions ?? []).map((q) => (
                <Button
                  key={q}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setOpen(true)}
                >
                  {q}
                </Button>
              ))}
            </div>
          )}
        </div>
      </section>

      <AIAssistantPanel open={open} onOpenChange={setOpen} feature="dashboard" />
    </>
  );
}
