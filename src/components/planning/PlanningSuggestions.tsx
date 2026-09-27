/**
 * Planning Suggestions — Phase 10 §16/§22 shared UI.
 *
 * Renders the deterministic recommendation list produced by the planning
 * engine. Every row explains WHY it exists, may be dismissed (local,
 * non-destructive, day-scoped) and may link to the surface where the user
 * can act. Nothing here ever mutates data — suggestions only suggest.
 */
import { Link } from "react-router";
import {
  Ban,
  CalendarClock,
  CircleAlert,
  Clock,
  Compass,
  FolderKanban,
  Gauge,
  Info,
  Lightbulb,
  ListChecks,
  RefreshCw,
  Target,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { EmptyHint, Panel, Pill } from "@/components/progress/progress-ui";
import {
  PLANNING_EMPTY_STATE_FA,
  RECOMMENDATION_META,
  type PlanningRecommendation,
  type RecommendationType,
} from "@/lib/planning";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<RecommendationType, LucideIcon> = {
  NEXT_ACTION: Compass,
  OVERDUE_WARNING: TriangleAlert,
  DEADLINE_WARNING: CalendarClock,
  WORKLOAD_WARNING: Gauge,
  SCHEDULING_SUGGESTION: Clock,
  PROJECT_ATTENTION: FolderKanban,
  GOAL_ATTENTION: Target,
  BLOCKED_TASK: Ban,
  MISSING_NEXT_ACTION: ListChecks,
  PLANNING_GAP: Info,
  REVIEW_SUGGESTION: RefreshCw,
};

const TONE_BY_SEVERITY = {
  critical: "rose",
  warning: "amber",
  info: "blue",
} as const;

const TILE_BY_SEVERITY = {
  critical:
    "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  info: "bg-primary/10 text-primary",
} as const;

function SuggestionRow({
  rec,
  onDismiss,
}: {
  rec: PlanningRecommendation;
  onDismiss?: (id: string) => void;
}) {
  const Icon = TYPE_ICON[rec.type];
  const meta = RECOMMENDATION_META[rec.type];
  return (
    <li className="rounded-xl border border-border/60 bg-white/50 px-3 py-2.5 dark:bg-white/5">
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-lg",
            TILE_BY_SEVERITY[rec.severity],
          )}
          aria-hidden
        >
          <Icon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Pill toneKey={TONE_BY_SEVERITY[rec.severity]}>{meta.labelFa}</Pill>
            <span className="text-[13px] font-extrabold leading-5">{rec.title}</span>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
            {rec.detail}
          </p>
          {rec.link && (
            <Link
              to={rec.link.to}
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
            >
              {rec.link.label}
              <span aria-hidden>←</span>
            </Link>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={() => onDismiss(rec.id)}
            aria-label={`نادیده گرفتن پیشنهاد: ${rec.title}`}
            title="برای امروز نادیده گرفته می‌شود"
            className="grid size-6 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
    </li>
  );
}

export interface PlanningSuggestionsProps {
  recommendations: PlanningRecommendation[];
  onDismiss?: (id: string) => void;
  /** Maximum rows before the «بقیه در مرکز برنامه‌ریزی» note. */
  limit?: number;
  title?: string;
  description?: string;
  /** Show the graceful empty state instead of rendering nothing. */
  showEmpty?: boolean;
  /** Extra action rendered in the panel header (e.g. a link). */
  action?: React.ReactNode;
  className?: string;
}

export function PlanningSuggestions({
  recommendations,
  onDismiss,
  limit = 6,
  title = "پیشنهادهای برنامه‌ریزی",
  description = "قطعی، قابل رد زدن — هیچ‌چیز را خودکار تغییر نمی‌دهیم",
  showEmpty = false,
  action,
  className,
}: PlanningSuggestionsProps) {
  if (recommendations.length === 0) {
    if (!showEmpty) return null;
    return (
      <Panel
        title={title}
        icon={<Lightbulb className="size-4 text-primary" aria-hidden />}
        description={description}
        className={className}
      >
        <EmptyHint>{PLANNING_EMPTY_STATE_FA}</EmptyHint>
      </Panel>
    );
  }

  const visible = recommendations.slice(0, limit);
  const hidden = recommendations.length - visible.length;

  return (
    <Panel
      title={title}
      icon={<Lightbulb className="size-4 text-primary" aria-hidden />}
      description={description}
      action={action}
      className={className}
    >
      <ul className="space-y-2">
        {visible.map((r) => (
          <SuggestionRow key={r.id} rec={r} onDismiss={onDismiss} />
        ))}
      </ul>
      {hidden > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <CircleAlert className="size-3.5 shrink-0" aria-hidden />
          {hidden} پیشنهاد دیگر در مرکز برنامه‌ریزی منتظر است —{" "}
          <Link to="/planning" className="font-bold text-primary hover:underline">
            ببینشان
          </Link>
        </p>
      )}
      <p className="mt-3 text-[10px] leading-5 text-muted-foreground">
        پیشنهادها از روی داده‌های واقعی برنامه‌ریزی محاسبه می‌شوند، نه حدس — و
        فقط با تأیید خودت اعمال می‌شوند.
      </p>
    </Panel>
  );
}

/** Compact dashboard variant — a few rows, no empty state. */
export function PlanningSuggestionsCompact(props: PlanningSuggestionsProps) {
  return <PlanningSuggestions limit={3} {...props} />;
}
