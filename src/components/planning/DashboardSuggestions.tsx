/**
 * Dashboard module — «پیشنهادهای برنامه‌ریزی» (Phase 10 §21).
 *
 * A contextual, OPTIONAL module: today's load in one line plus the top
 * dismissible suggestions. Renders nothing when there is nothing to say —
 * a light, balanced day with no attention items simply shows no module.
 *
 * The «قدم بعدی» has its own dedicated dashboard module, so the
 * NEXT_ACTION recommendation type is intentionally not repeated here.
 */
import { Link } from "react-router";
import { ArrowLeft, Gauge } from "lucide-react";
import { usePlanning } from "@/hooks/use-planning";
import { PlanningSuggestions } from "./PlanningSuggestions";
import { Pill } from "@/components/progress/progress-ui";
import {
  WORKLOAD_LABELS_FA,
  type WorkloadState,
} from "@/lib/planning";

const WORKLOAD_TONE: Record<WorkloadState, "emerald" | "blue" | "amber" | "rose"> = {
  light: "emerald",
  balanced: "blue",
  heavy: "amber",
  overloaded: "rose",
};

export function DashboardSuggestions() {
  const { result, recommendations, dismiss } = usePlanning();

  const advice = recommendations.filter((r) => r.type !== "NEXT_ACTION");
  const needsAttention =
    advice.length > 0 ||
    result.workload.state === "heavy" ||
    result.workload.state === "overloaded" ||
    result.snapshot.overdueCount > 0;

  // Nothing relevant for this persona/day → render no module at all.
  if (!needsAttention) return null;

  return (
    <section className="ui-surface rounded-2xl p-4" aria-label="پیشنهادهای برنامه‌ریزی">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <span className="ui-icon-tile size-6">
            <Gauge className="size-3.5 text-primary" aria-hidden />
          </span>
          برنامه امروز
        </h2>
        <div className="flex items-center gap-2">
          <Pill toneKey={WORKLOAD_TONE[result.workload.state]}>
            بار: {WORKLOAD_LABELS_FA[result.workload.state]}
          </Pill>
          <Link
            to="/planning"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
          >
            مرکز برنامه‌ریزی
            <ArrowLeft className="size-3" aria-hidden />
          </Link>
        </div>
      </header>

      {result.workload.confidence !== "insufficient" && (
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
          {result.workload.explanation}
        </p>
      )}

      <div className="mt-3">
        <PlanningSuggestions
          recommendations={advice}
          onDismiss={dismiss}
          limit={3}
          title=""
          description=""
        />
      </div>
    </section>
  );
}
