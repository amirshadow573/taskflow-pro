/**
 * ProductivityReview — Phase 13 §23 / §24.
 *
 * Renders a deterministic review: a small stat row plus the four (weekly) or
 * five (monthly) sections the engine produces. Nothing here is authored by a
 * model or a random generator — every line comes from
 * `buildWeeklyReview` / `buildMonthlyReview` (src/lib/intelligence/reviews.ts),
 * so the same history always reads the same way (§18 determinism).
 *
 * Below the sample threshold the review says data is still being collected
 * instead of showing a number (§32 / §33) — and never fabricates analytics.
 */
import { CalendarRange, CalendarClock } from "lucide-react";
import { EmptyHint, Panel } from "@/components/progress/progress-ui";
import { INTELLIGENCE_COLLECTING_FA, type ProductivityReview } from "@/lib/intelligence";

export function ProductivityReviewPanel({
  review,
  title,
  description,
}: {
  review: ProductivityReview;
  title: string;
  description?: string;
}) {
  const Icon = review.period === "week" ? CalendarRange : CalendarClock;

  return (
    <Panel
      title={title}
      description={description}
      icon={
        <span className="ui-icon-tile size-6">
          <Icon className="size-3.5 text-primary" aria-hidden />
        </span>
      }
    >
      {!review.sufficient ? (
        <EmptyHint>{INTELLIGENCE_COLLECTING_FA}</EmptyHint>
      ) : (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {review.stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-border/60 bg-white/50 px-3 py-2 dark:bg-white/5"
              >
                <dt className="text-[10px] font-semibold text-muted-foreground">{stat.label}</dt>
                <dd className="mt-0.5 text-[15px] font-extrabold tabular-nums">{stat.value}</dd>
              </div>
            ))}
          </dl>

          <div className="grid gap-3 lg:grid-cols-2">
            {review.sections.map((section) => (
              <section key={section.title} className="rounded-2xl border border-border/60 p-3">
                <h3 className="text-[12px] font-extrabold">{section.title}</h3>
                <ul className="mt-2 space-y-1.5">
                  {section.lines.map((line, i) => (
                    <li
                      key={`${section.title}-${i}`}
                      className="flex gap-2 text-[11px] leading-5 text-muted-foreground"
                    >
                      <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <p className="text-[10px] leading-4 text-muted-foreground">
            این مرور به‌صورت خودکار از داده‌های واقعی همین بازه ساخته شده است؛ هیچ نتیجه‌گیری
            روان‌شناختی در آن وجود ندارد.
          </p>
        </div>
      )}
    </Panel>
  );
}
