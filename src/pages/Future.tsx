/**
 * قابلیت‌های آینده (Advanced showcase) — the structured home for planned
 * capabilities.
 *
 * Structure mirrors the product's philosophy:
 *   Available now  → deterministic engines (real, working, linked)
 *   Coming soon    → planned capabilities (disabled, «به‌زودی»)
 *
 * No AI provider, no simulated output, no fake data: the page only reads the
 * centralized catalog in src/lib/future-features.ts.
 */
import { Link } from "react-router";
import { CheckCircle2, Sparkles, ArrowLeft } from "lucide-react";
import { Panel, Pill } from "@/components/progress/progress-ui";
import { FutureFeatureGrid } from "@/components/future/ComingSoonFeature";
import { useUserProfile } from "@/hooks/use-user-profile";
import {
  CURRENT_CAPABILITIES,
  FEATURE_CATEGORY_LABELS,
  FUTURE_NOTE,
  featuresForPersona,
  type FeatureCategory,
} from "@/lib/future-features";

const CATEGORY_ORDER: FeatureCategory[] = [
  "planning",
  "assistant",
  "insights",
  "workspace",
  "agents",
];

export default function FutureCapabilitiesPage() {
  const { personaKey } = useUserProfile();
  const future = featuresForPersona(personaKey, { surface: "advanced" });

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    rows: future.filter((f) => f.category === category),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <Sparkles className="size-6 text-primary" aria-hidden="true" />
            قابلیت‌های آینده
          </h1>
          <Pill toneKey="slate">
            <Sparkles className="size-3" aria-hidden="true" />
            به‌زودی
          </Pill>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          مسیر آیندهٔ محصول در یک نگاه: چه چیزی امروز واقعاً کار می‌کند، و چه قابلیت‌هایی در
          نسخه‌های بعدی اضافه خواهند شد. هیچ‌کدام از قابلیت‌های آینده هنوز فعال نیستند و هیچ
          سرویس هوش مصنوعی در این نسخه استفاده نمی‌شود.
        </p>
      </header>

      {/* ── اکنون در دسترس (real, deterministic) ─────────────────────────── */}
      <Panel
        title="اکنون در دسترس"
        icon={<CheckCircle2 className="size-4 text-emerald-600" />}
        description="قابلیت‌های فعال و قطعی محصول — بدون هیچ وابستگی به هوش مصنوعی."
      >
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {CURRENT_CAPABILITIES.map((c) => (
            <li key={c.key} className="rounded-2xl border border-border/60 bg-white/50 p-3 dark:bg-white/5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[12px] font-extrabold">{c.title}</h3>
                <Pill toneKey="emerald">فعال</Pill>
              </div>
              <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">{c.description}</p>
              {c.route && (
                <Link
                  to={c.route}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded"
                >
                  <ArrowLeft className="size-3" aria-hidden="true" />
                  رفتن به بخش
                </Link>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      {/* ── در آینده (coming soon, disabled) ─────────────────────────────── */}
      <section className="space-y-4" aria-label="قابلیت‌هایی که به‌زودی می‌رسند">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-extrabold">در آینده</h2>
          <span className="text-[11px] text-muted-foreground">
            مخصوص شخصیت «{personaLabel(personaKey)}»
          </span>
        </div>
        <p className="text-[11px] leading-5 text-muted-foreground">{FUTURE_NOTE}</p>

        {grouped.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/70 p-4 text-[12px] text-muted-foreground">
            برای این شخصیت هنوز قابلیت آینده‌ای تعریف نشده است.
          </p>
        ) : (
          <div className="space-y-5">
            {grouped.map((g) => (
              <section key={g.category} className="space-y-2.5" aria-label={FEATURE_CATEGORY_LABELS[g.category]}>
                <h3 className="text-[12px] font-bold text-muted-foreground">
                  {FEATURE_CATEGORY_LABELS[g.category]}
                </h3>
                <FutureFeatureGrid features={g.rows} label={FEATURE_CATEGORY_LABELS[g.category]} />
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Small local label (avoids importing persona metadata into this page). */
function personaLabel(persona: string): string {
  switch (persona) {
    case "student":
      return "دانش‌آموز";
    case "employee":
      return "کارمند";
    case "freelancer":
      return "فریلنسر";
    case "manager":
    case "team":
      return "مدیر";
    case "business_owner":
      return "صاحب کسب‌وکار";
    case "custom":
      return "شخصی";
    default:
      return "بهره‌وری شخصی";
  }
}
