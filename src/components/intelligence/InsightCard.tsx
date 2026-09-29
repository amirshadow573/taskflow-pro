/**
 * InsightCard — Phase 13 §18 / §20 / §34.
 *
 * One insight, answering the four questions the spec demands in order:
 *   What happened?     → title
 *   Why is this shown? → description (observable facts only)
 *   Evidence           → the exact numbers behind it
 *   What can I do?     → explicit actions, plus dismiss / «مفید بود»
 *
 * Accessibility (§38): severity is always written as text next to its colour,
 * evidence is a real <dl>, actions are real buttons with labels, and every
 * interactive element is keyboard reachable with a visible focus state.
 */
import { useNavigate } from "react-router";
import { ArrowLeft, Check, ThumbsUp, X } from "lucide-react";
import { Pill } from "@/components/progress/progress-ui";
import { cn } from "@/lib/utils";
import type { Insight } from "@/lib/intelligence";
import { CATEGORY_META, SEVERITY_ICON, SEVERITY_TONE, severityLabelFa, typeLabelFa } from "./insight-ui";

export function InsightCard({
  insight,
  onDismiss,
  onUseful,
  className,
}: {
  insight: Insight;
  onDismiss?: (id: string) => void;
  onUseful?: (id: string) => void;
  className?: string;
}) {
  const navigate = useNavigate();
  const tone = SEVERITY_TONE[insight.severity];
  const SeverityIcon = SEVERITY_ICON[insight.severity];
  const Category = CATEGORY_META[insight.category];
  const titleId = `insight-title-${insight.id.replace(/[^\w:-]/g, "")}`;

  return (
    <article
      className={cn("ui-surface ui-surface-hover rounded-2xl p-4", className)}
      aria-labelledby={titleId}
    >
      <header className="flex flex-wrap items-center gap-1.5">
        <Pill toneKey={tone}>
          <SeverityIcon className="me-1 inline size-3" aria-hidden />
          {severityLabelFa(insight.severity)}
        </Pill>
        <Pill toneKey="slate">
          <Category.Icon className="me-1 inline size-3" aria-hidden />
          {typeLabelFa(insight.type)}
        </Pill>
        {insight.metric ? (
          <span className="text-[10px] font-medium text-muted-foreground">{insight.metric}</span>
        ) : null}
      </header>

      <h3 id={titleId} className="mt-2.5 text-sm font-extrabold leading-6">
        {insight.title}
      </h3>
      <p className="mt-1 text-[12px] leading-6 text-muted-foreground">{insight.description}</p>

      {insight.evidence.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {insight.evidence.map((item) => (
            <div
              key={`${item.label}-${item.value}`}
              className="rounded-xl border border-border/60 bg-white/50 px-2.5 py-1.5 dark:bg-white/5"
            >
              <dt className="text-[10px] font-semibold text-muted-foreground">{item.label}</dt>
              <dd className="mt-0.5 text-[12px] font-extrabold tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <footer className="mt-3 flex flex-wrap items-center gap-1.5">
        {insight.actions
          .filter((action) => action.kind !== "dismiss" && !!action.to)
          .map((action) => (
            <button
              key={`${action.kind}-${action.to}`}
              type="button"
              onClick={() => action.to && navigate(action.to)}
              className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary transition-colors hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {action.label}
              <ArrowLeft className="size-3" aria-hidden />
            </button>
          ))}

        {onUseful && (
          <button
            type="button"
            onClick={() => onUseful(insight.id)}
            aria-pressed={insight.status === "useful"}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {insight.status === "useful" ? (
              <Check className="size-3" aria-hidden />
            ) : (
              <ThumbsUp className="size-3" aria-hidden />
            )}
            {insight.status === "useful" ? "ثبت شد" : "مفید بود"}
          </button>
        )}

        {onDismiss && (
          <button
            type="button"
            onClick={() => onDismiss(insight.id)}
            className="ms-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label={`نادیده گرفتن: ${insight.title}`}
          >
            <X className="size-3" aria-hidden />
            نادیده بگیر
          </button>
        )}
      </footer>

      <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
        این بینش فقط از داده‌های ثبت‌شده ساخته شده است و تا پایان امروز نمایش داده می‌شود.
      </p>
    </article>
  );
}
