/**
 * Phase 16 — compact dashboard insight strip (§15).
 *
 * "Show only the most relevant 1–3 insights" — so this renders the top three
 * DETERMINISTIC findings and nothing else. No model call happens on the
 * dashboard: these are already-computed patterns, which is why the strip is
 * instant and works with no provider configured (§15, §24).
 */
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { ArrowLeft, ShieldCheck, Sparkles } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Pill } from "@/components/progress/progress-ui";
import { toFa } from "@/lib/persian";
import { PATTERN_LABELS_FA } from "@/lib/ai/insight-types";
import { isTestMode } from "@/lib/personas";

export function AIInsightStrip() {
  const evidence = useQuery(api.aiInsights.insightContext, isTestMode() ? "skip" : { window: "7d" });

  const top = (evidence?.patterns ?? []).slice(0, 3);
  if (!evidence || evidence.insufficient || top.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 md:px-8" aria-label="بینش‌های هوشمند">
      <div className="ui-surface rounded-2xl px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-extrabold">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            بینش‌های بهره‌وری
          </p>
          <Pill toneKey="slate">
            <ShieldCheck className="size-3" aria-hidden="true" />
            یافته‌های قطعی
          </Pill>
        </div>

        <ul className="mt-2 space-y-1">
          {top.map((p) => (
            <li
              key={p.type}
              className="flex flex-wrap items-baseline justify-between gap-1.5 rounded-lg bg-muted/40 px-2.5 py-1.5"
            >
              <span className="min-w-0 flex-1 text-[11px] leading-5">
                <span className="font-bold">{PATTERN_LABELS_FA[p.type] ?? p.type}</span>
                <span className="block break-words text-muted-foreground">{p.statement}</span>
              </span>
              {p.severity === "critical" || p.severity === "warning" ? (
                <Pill toneKey={p.severity === "critical" ? "rose" : "amber"}>نیازمند توجه</Pill>
              ) : null}
            </li>
          ))}
        </ul>

        <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-border/40 pt-2">
          <Link
            to="/ai-insights"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
          >
            بررسی و توضیح {toFa(top.length)} یافته
            <ArrowLeft className="size-3" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
