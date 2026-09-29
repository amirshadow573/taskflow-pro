/**
 * Phase 10.5 — compact dashboard entry (§22).
 *
 * Two states, both honest:
 *  - no import yet  → a short "get a plan from your own external AI" CTA
 *  - import exists  → the RESULT summary (counts + when), not the mechanism
 *
 * No AI API, no simulated data: everything comes from the real import history.
 */
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { ArrowLeft, FileJson, Sparkles } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { toFa } from "@/lib/persian";
import { personaPlanDefinition } from "@/lib/ai-planning/personas";
import { useUserProfile } from "@/hooks/use-user-profile";

const DAY = 86_400_000;

function relativeFa(at: number): string {
  const diff = Date.now() - at;
  if (diff < 3_600_000) return "کمتر از یک ساعت پیش";
  if (diff < DAY) return `${toFa(Math.round(diff / 3_600_000))} ساعت پیش`;
  if (diff < 2 * DAY) return "دیروز";
  return `${toFa(Math.round(diff / DAY))} روز پیش`;
}

export function AIPlanEntryCard() {
  const { personaKey } = useUserProfile();
  const def = personaPlanDefinition(personaKey);
  const history = useQuery(api.aiPlanning.history, { limit: 5 });

  const applied = (history ?? []).find(
    (row) => row.status === "applied" || row.status === "partially_applied",
  );

  if (applied) {
    let total = 0;
    try {
      const counts = JSON.parse(applied.appliedCounts) as Record<string, number>;
      total = Object.values(counts).reduce((n, c) => n + c, 0);
    } catch {
      total = 0;
    }
    return (
      <section className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="ui-surface flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600"
            aria-hidden="true"
          >
            <FileJson className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold">برنامهٔ واردشده از AI</p>
            <p className="text-[11px] text-muted-foreground">
              {relativeFa(applied.appliedAt ?? applied.createdAt)} • {toFa(total)} مورد وارد
              فضای کاری شد
            </p>
          </div>
          <Link
            to="/ai-planning"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
          >
            مشاهدهٔ برنامه
            <ArrowLeft className="size-3" aria-hidden="true" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 md:px-8">
      <div className="ui-surface flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"
          aria-hidden="true"
        >
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold">برنامه‌ریزی با هوش مصنوعی خارجی</p>
          <p className="text-[11px] leading-5 text-muted-foreground">
            {def.pageDescription}
          </p>
        </div>
        <Link
          to="/ai-planning"
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-3 text-[11px] font-bold text-white shadow-[0_8px_20px_-12px_rgba(37,99,235,0.9)]"
        >
          شروع کنید
          <ArrowLeft className="size-3" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
