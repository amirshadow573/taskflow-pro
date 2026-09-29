/**
 * Phase 16 — one insight, rendered with its layers kept visibly apart (§2, §13).
 *
 * The card is deliberately split into three bands:
 *
 *   1. یافتهٔ قطعی   — what the deterministic engine PROVED. Always present,
 *                      always first, never model-authored.
 *   2. تفسیر         — the model's reading of that finding. Optional; the card
 *                      is still useful when AI is unavailable.
 *   3. توصیه         — what to do, plus any OPTIONAL actions the user may apply.
 *
 * Collapsing these into one paragraph is exactly the failure mode §2 forbids:
 * the user could no longer tell a measurement from an opinion.
 */
import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  CircleCheck,
  Lightbulb,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/progress/progress-ui";
import { toFa } from "@/lib/persian";
import { cn } from "@/lib/utils";
import {
  CONFIDENCE_LABELS_FA,
  PATTERN_LABELS_FA,
  type AIInsightInterpretation,
  type AIInsightSeverity,
  type DetectedPattern,
} from "@/lib/ai/insight-types";
import type { AIAction } from "@/lib/ai/types";

const SEVERITY_TONE: Record<AIInsightSeverity, "rose" | "amber" | "slate" | "emerald"> = {
  critical: "rose",
  warning: "amber",
  info: "slate",
  positive: "emerald",
};

const SEVERITY_LABEL_FA: Record<AIInsightSeverity, string> = {
  critical: "بحرانی",
  warning: "هشدار",
  info: "اطلاع",
  positive: "خوب",
};

export interface AIInsightCardProps {
  pattern: DetectedPattern;
  /** The model's interpretation, when one exists for this pattern. */
  interpretation?: AIInsightInterpretation;
  /** The whole validated plan; indices map to `actions`. */
  actions?: AIAction[];
  /** Indices into `actions` that belong to THIS pattern. */
  actionIndexes?: number[];
  selected?: Set<number>;
  onToggle?: (index: number, on: boolean) => void;
  /** Reuses the Phase 15 confirmation gate — not a second apply path (§6). */
  onApply?: () => void;
  onDiscard?: () => void;
  applying?: boolean;
  /** Rendered greyed when the model never addressed this pattern (§11). */
  unexplained?: boolean;
}

export function AIInsightCard({
  pattern,
  interpretation,
  actions = [],
  actionIndexes = [],
  selected,
  onToggle,
  onApply,
  onDiscard,
  applying,
  unexplained,
}: AIInsightCardProps) {
  const [open, setOpen] = useState(false);
  const picked = actionIndexes.filter((i) => selected?.has(i)).length;

  return (
    <article className="ui-surface overflow-hidden rounded-2xl">
      {/* ---- band 1: the deterministic finding ---- */}
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border/50 px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-sm font-extrabold">
              {PATTERN_LABELS_FA[pattern.type] ?? pattern.type}
            </h3>
            <Pill toneKey={SEVERITY_TONE[pattern.severity]}>
              {SEVERITY_LABEL_FA[pattern.severity]}
            </Pill>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{pattern.statement}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Pill toneKey="slate">
            <ShieldCheck className="size-3" aria-hidden="true" />
            {CONFIDENCE_LABELS_FA[pattern.confidence] ?? pattern.confidence}
          </Pill>
          <span className="text-[10px] text-muted-foreground">
            {toFa(pattern.sampleSize)} نمونه • {pattern.timeWindow}
          </span>
        </div>
      </header>

      <div className="space-y-3 px-4 py-3">
        {/* ---- evidence: always shown, always factual ---- */}
        <dl className="grid gap-1.5 sm:grid-cols-2">
          {pattern.evidence.map((e, i) => (
            <div key={i} className="flex items-baseline justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5">
              <dt className="text-[11px] text-muted-foreground">{e.label}</dt>
              <dd className="text-[11px] font-extrabold tabular-nums">{e.value}</dd>
            </div>
          ))}
        </dl>

        {interpretation?.additionalEvidence?.length ? (
          <dl className="grid gap-1.5 sm:grid-cols-2">
            {interpretation.additionalEvidence.map((e, i) => (
              <div key={i} className="flex items-baseline justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5">
                <dt className="text-[11px] text-muted-foreground">{e.label}</dt>
                <dd className="text-[11px] font-extrabold tabular-nums">{e.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {/* ---- band 2: the AI's reading ---- */}
        {interpretation ? (
          <div className="space-y-1.5 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2">
            <p className="flex items-center gap-1.5 text-[11px] font-extrabold">
              <Lightbulb className="size-3.5 text-primary" aria-hidden="true" />
              تفسیر دستیار
            </p>
            <p className="text-[11px] leading-5">{interpretation.explanation}</p>
            {interpretation.recommendation && (
              <p className="flex items-start gap-1.5 text-[11px] leading-5">
                <CircleCheck className="mt-0.5 size-3 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <span className="font-bold">توصیه: </span>
                  {interpretation.recommendation}
                </span>
              </p>
            )}
          </div>
        ) : (
          <p className="flex items-start gap-1.5 rounded-xl bg-muted/40 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
            <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            {unexplained
              ? "این یافتهٔ قطعی هنوز توسط دستیار توضیح داده نشده است. یافته همچنان معتبر است."
              : "برای تفسیر این یافته، دستیار باید در دسترس باشد."}
          </p>
        )}

        {/* ---- §18 automation: a suggestion, never an action ---- */}
        {interpretation?.automationSuggestion && (
          <div className="rounded-xl border border-dashed border-border px-3 py-2">
            <p className="text-[11px] font-bold">پیشنهاد خودکارسازی</p>
            <p className="text-[11px] leading-5 text-muted-foreground">
              {interpretation.automationSuggestion.title} — {interpretation.automationSuggestion.why}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              هیچ قانونی خودکار ساخته نشد؛ ساختن آن باید خودتان انجام شود.
            </p>
          </div>
        )}

        {/* ---- band 3: optional, user-confirmed actions ---- */}
        {actionIndexes.length > 0 && !unexplained && (
          <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/5 px-3 py-2">
            <p className="flex items-center gap-1.5 text-[11px] font-extrabold">
              <Lock className="size-3 text-amber-600" aria-hidden="true" />
              {toFa(actionIndexes.length)} تغییر پیشنهادی — هیچ‌کدام خودکار اعمال نمی‌شود
            </p>
            <ul className="space-y-1">
              {actionIndexes.map((i) => {
                const a = actions[i];
                if (!a) return null;
                return (
                  <li key={i}>
                    <label className="flex items-start gap-2 text-[11px] leading-5">
                      <input
                        type="checkbox"
                        className="mt-1 size-3.5 shrink-0 accent-primary"
                        checked={selected?.has(i) ?? false}
                        disabled={!onToggle || applying}
                        onChange={(e) => onToggle?.(i, e.target.checked)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="break-words font-bold">
                          {a.type === "reschedule_task"
                            ? `جابه‌جایی «${targetLabel(a)}» به ${a.target_date}`
                            : a.type === "create_time_block"
                              ? `بلوک ${a.start_time}–${a.end_time}: ${a.title}`
                              : a.type === "create_note"
                                ? `یادداشت: ${a.title}`
                                : `${a.type}`}
                        </span>
                        <span className="block break-words text-muted-foreground">{a.reason}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap gap-2 pt-0.5">
              <Button
                type="button"
                size="sm"
                className="h-8 text-[11px]"
                disabled={applying || picked === 0}
                onClick={onApply}
              >
                {applying ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <CircleCheck className="size-3.5" aria-hidden="true" />
                )}
                اعمال {toFa(picked)} تغییر
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-[11px]"
                disabled={applying}
                onClick={onDiscard}
              >
                انصراف
              </Button>
            </div>
          </div>
        )}

        {pattern.affectedEntityIds.length > 0 && (
          <details
            open={open}
            className="text-[11px]"
            onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
          >
            <summary className="flex cursor-pointer items-center gap-1 font-bold text-muted-foreground">
              <ChevronDown
                className={cn("size-3 transition-transform", open && "rotate-180")}
                aria-hidden="true"
              />
              {toFa(pattern.affectedEntityIds.length)} مورد درگیر
            </summary>
            <ul className="mt-1 space-y-0.5 break-all ps-4 text-[10px] text-muted-foreground">
              {pattern.affectedEntityIds.map((id) => (
                <li key={id}>{id}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </article>
  );
}

function targetLabel(a: AIAction): string {
  return "target_id" in a ? String(a.target_id).slice(-8) : a.type;
}
