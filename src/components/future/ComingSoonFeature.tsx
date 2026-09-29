/**
 * ComingSoonFeature — the ONE reusable presentation for capabilities that are
 * planned but not implemented (Phase: "AI & Future Features").
 *
 * Rules encoded in the component:
 *  - Data only: the card renders a title/description from
 *    src/lib/future-features.ts. There is no request, no simulation and no
 *    generated content — clicking only reveals a short, honest explanation.
 *  - Disabled by design: future capabilities are not buttons that "do"
 *    something. The visible «به‌زودی» badge + dashed border carry the state in
 *    text (never by color alone), and the state is announced to screen readers.
 *  - Mobile-first: compact variant, single column, no horizontal overflow.
 *  - Accessibility: real <button>, aria-expanded/controls, visible focus ring,
 *    status region for the explanation.
 */
import { useState } from "react";
import {
  Bot,
  Briefcase,
  Building2,
  CalendarClock,
  Clock,
  FolderKanban,
  Gauge,
  GraduationCap,
  HeartPulse,
  LayoutDashboard,
  Lightbulb,
  ListTodo,
  MessageSquare,
  Receipt,
  Repeat,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/progress/progress-ui";
import { useUserProfile } from "@/hooks/use-user-profile";
import { cn } from "@/lib/utils";
import {
  featuresForPersona,
  isComingSoon,
  FUTURE_NOTE,
  type FeatureSurface,
  type FeatureCategory,
  type FutureFeatureDefinition,
} from "@/lib/future-features";

/** Icon keys defined in the catalog → real components (no network, no assets). */
const ICONS: Record<string, LucideIcon> = {
  bot: Bot,
  briefcase: Briefcase,
  "building-2": Building2,
  "calendar-clock": CalendarClock,
  clock: Clock,
  "folder-kanban": FolderKanban,
  gauge: Gauge,
  "graduation-cap": GraduationCap,
  "heart-pulse": HeartPulse,
  "layout-dashboard": LayoutDashboard,
  lightbulb: Lightbulb,
  "list-todo": ListTodo,
  "message-square": MessageSquare,
  receipt: Receipt,
  repeat: Repeat,
  "shield-check": ShieldCheck,
  sparkles: Sparkles,
  target: Target,
  "trending-up": TrendingUp,
  users: Users,
};

export function ComingSoonFeature({
  feature,
  variant = "card",
  className,
}: {
  feature: FutureFeatureDefinition;
  /** "card" = full preview, "compact" = dense row for dashboards. */
  variant?: "card" | "compact";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const Icon = ICONS[feature.icon] ?? Sparkles;
  const soon = isComingSoon(feature);
  const compact = variant === "compact";
  const noteId = `future-note-${feature.id}`;

  return (
    <section
      aria-label={`${feature.title} — قابلیت آینده`}
      className={cn(
        "ui-surface flex flex-col rounded-2xl border border-dashed border-border/70",
        compact ? "gap-2 p-3" : "gap-3 p-4",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => soon && setOpen((v) => !v)}
        disabled={!soon}
        aria-expanded={soon ? open : undefined}
        aria-controls={soon ? noteId : undefined}
        className={cn(
          "flex w-full items-start gap-3 rounded-xl text-start",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          soon ? "cursor-pointer" : "cursor-default opacity-70",
        )}
      >
        <span className="ui-icon-tile size-9 shrink-0" aria-hidden="true">
          <Icon className="size-4.5 text-primary/70" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-extrabold text-foreground">{feature.title}</span>
            {soon && (
              <Pill toneKey="slate">
                <Sparkles className="size-3" aria-hidden="true" />
                به‌زودی
              </Pill>
            )}
          </span>
          <span className="mt-1 block text-[11px] leading-5 text-muted-foreground">
            {feature.description}
          </span>
        </span>
      </button>

      {/* Status text so the state never depends on color alone. */}
      <span className="sr-only">
        {soon ? "این قابلیت هنوز فعال نیست و به‌زودی در دسترس قرار می‌گیرد." : "غیرفعال"}
      </span>

      {soon && open && (
        <div
          id={noteId}
          role="status"
          className="rounded-xl border border-border/60 bg-muted/40 p-3 text-[11px] leading-5 text-muted-foreground"
        >
          <p className="font-bold text-foreground">این قابلیت به‌زودی فعال خواهد شد.</p>
          <p className="mt-1">
            برنامه‌ریزی هوشمند در نسخه‌های آینده به محصول اضافه می‌شود. تا آن زمان، موتورهای
            قطعی فعلی (برنامه‌ریزی، زمان‌بندی، اجرا و تحلیل) مثل قبل کار می‌کنند.
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="mt-1.5 h-7 px-2 text-[11px]"
            onClick={() => setOpen(false)}
          >
            متوجه شدم
          </Button>
        </div>
      )}
    </section>
  );
}

/** Responsive grid of future capabilities. */
export function FutureFeatureGrid({
  features,
  variant = "card",
  className,
  columns = "sm:grid-cols-2 xl:grid-cols-3",
  label = "قابلیت‌های آینده",
}: {
  features: FutureFeatureDefinition[];
  variant?: "card" | "compact";
  className?: string;
  columns?: string;
  label?: string;
}) {
  if (features.length === 0) return null;
  return (
    <ul
      aria-label={label}
      className={cn("grid grid-cols-1 gap-3", columns, className)}
    >
      {features.map((f) => (
        <li key={f.id} className="min-w-0">
          <ComingSoonFeature feature={f} variant={variant} className="h-full" />
        </li>
      ))}
    </ul>
  );
}

/**
 * Small, persona-aware preview block for a specific surface (dashboard /
 * planning / insights). Renders nothing when no capability is relevant, so a
 * page never ends up with an empty "coming soon" section.
 */
export function FutureFeatureSection({
  title,
  description,
  surface,
  category,
  limit,
  variant = "compact",
  className,
  showNote = false,
}: {
  title: string;
  description?: string;
  surface: FeatureSurface;
  category?: FeatureCategory;
  /** Cap the number of cards so a page is never flooded. */
  limit?: number;
  variant?: "card" | "compact";
  className?: string;
  showNote?: boolean;
}) {
  const { personaKey } = useUserProfile();
  const features = featuresForPersona(personaKey, { surface, category, limit });
  if (features.length === 0) return null;

  return (
    <section className={cn("space-y-3", className)} aria-label={title}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-muted-foreground">{title}</h2>
        <Pill toneKey="slate">
          <Sparkles className="size-3" aria-hidden="true" />
          به‌زودی
        </Pill>
      </div>
      {description && (
        <p className="text-[11px] leading-5 text-muted-foreground">{description}</p>
      )}
      <FutureFeatureGrid features={features} variant={variant} columns="sm:grid-cols-2 xl:grid-cols-3" />
      {showNote && <p className="text-[10px] leading-4 text-muted-foreground">{FUTURE_NOTE}</p>}
    </section>
  );
}
