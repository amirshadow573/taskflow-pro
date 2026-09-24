/**
 * Phase 08 — Unlock System UI.
 *
 * Philosophy: capability progression, NOT game rewards. Everything here is a
 * thin view over the centralized `unlocks` service — no rules live in the UI:
 *
 *  - UnlockCenter    — the «مرکز قابلیت‌ها» tab inside «پیشرفت من»: what is
 *                      unlocked, what is next, why something is locked and
 *                      what the user can do about it.
 *  - CapabilityGate  — wraps an ADVANCED surface and, while locked, explains
 *                      the missing requirements instead of hiding silently.
 *                      Unknown feature keys fail open (never lock by accident).
 *  - UnlockHint      — compact dashboard strip: «new capability» or «next
 *                      capability within reach». Renders null when idle.
 *  - UnlockFeedback  — self-healing sync on mount + a restrained sonner toast
 *                      when a new grant event appears. No popups/confetti.
 *
 * Core productivity is never gated — only cataloged advanced capabilities
 * defined in src/convex/unlockRules.ts.
 */
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { toFa } from "@/lib/persian";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Bar,
  EmptyHint,
  Panel,
  Pill,
  TONES,
  tone as toneOf,
} from "@/components/progress/progress-ui";
import {
  ArrowLeft,
  Building2,
  Briefcase,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Circle,
  GraduationCap,
  KeyRound,
  LineChart,
  Lock,
  Sparkles,
  Timer,
  Unlock,
  Users,
  UsersRound,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Icon tokens — unlockRules stores lucide names as plain strings      */
/* ------------------------------------------------------------------ */

const UNLOCK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LineChart,
  Users,
  GraduationCap,
  Briefcase,
  Timer,
  UsersRound,
  Building2,
  ClipboardCheck,
  KeyRound,
  Sparkles,
};

function UnlockIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = UNLOCK_ICONS[name] ?? Sparkles;
  return <Cmp className={className} />;
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

type RequirementRow = {
  type: string;
  text: string;
  met: boolean;
  current: number | null;
  target: number;
  group: "all" | "any";
};

type UnlockStatus = "locked" | "available" | "unlocked";

/** Status is never color-only: icon + Persian text always accompany it. */
function StatusPill({ status }: { status: UnlockStatus }) {
  if (status === "unlocked") {
    return (
      <Pill toneKey="emerald">
        <Check className="size-3" aria-hidden="true" />
        باز شده
      </Pill>
    );
  }
  if (status === "available") {
    return (
      <Pill toneKey="blue">
        <Unlock className="size-3" aria-hidden="true" />
        آماده فعال‌سازی
      </Pill>
    );
  }
  return (
    <Pill toneKey="slate">
      <Lock className="size-3" aria-hidden="true" />
      قفل
    </Pill>
  );
}

function RequirementList({
  rows,
  compact = false,
}: {
  rows: RequirementRow[];
  compact?: boolean;
}) {
  return (
    <ul className="space-y-1.5">
      {rows.map((r, i) => (
        <li
          key={`${r.type}-${i}`}
          className={cn(
            "flex items-start gap-2 rounded-lg px-2 py-1.5 text-[11px] leading-5",
            r.met
              ? "bg-emerald-50/70 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "bg-muted/40 text-muted-foreground dark:bg-white/5",
          )}
        >
          {r.met ? (
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <Circle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          )}
          <span className={cn("min-w-0", compact && "line-clamp-2")}>
            {r.text}
            {!r.met && r.group === "any" && (
              <span className="opacity-75"> (یکی از این‌ها)</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Unlock card                                                         */
/* ------------------------------------------------------------------ */

function UnlockCard({
  item,
}: {
  item: NonNullable<NonNullable<ReturnType<typeof useCenterData>>["unlocks"]>[number];
}) {
  const t = TONES[toneOf(item.tone)];
  const unlocked = item.status === "unlocked";
  return (
    <li
      className={cn(
        "ui-surface flex flex-col gap-3 rounded-2xl p-4",
        !unlocked && item.status === "locked" && "border-dashed",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white",
            unlocked ? t.grad : "from-slate-300 to-slate-400 dark:from-white/15 dark:to-white/5",
          )}
          aria-hidden="true"
        >
          <UnlockIcon name={item.icon} className={cn("size-5", !unlocked && "opacity-70")} />
        </span>
        <StatusPill status={item.status} />
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="text-[13px] font-extrabold leading-6">{item.label}</h3>
          <Pill toneKey="slate" className="shrink-0">
            {item.categoryLabel}
          </Pill>
        </div>
        <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
          {item.description}
        </p>
      </div>

      {unlocked ? (
        <p className="mt-auto flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-300">
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          {item.unlockedAt
            ? `${toFa(new Date(item.unlockedAt).toLocaleDateString("fa-IR"))} باز شد`
            : "باز شده است"}
        </p>
      ) : (
        <>
          <div>
            <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-muted-foreground">
              <span>پیشرفت شرط‌ها</span>
              <span className="tabular-nums">
                {toFa(item.metCount)} از {toFa(item.total)}
              </span>
            </div>
            <Bar
              pct={item.progressPct}
              toneKey={item.status === "available" ? "blue" : item.tone}
              className="mt-1.5 h-1.5"
            />
          </div>
          <RequirementList rows={item.requirements} />
        </>
      )}
    </li>
  );
}

/* Helper type derived from the Convex query (no hand-written duplicates). */
function useCenterData() {
  return useQuery(api.unlocks.center);
}

/* ------------------------------------------------------------------ */
/* Unlock Center — «مرکز قابلیت‌ها» tab                                */
/* ------------------------------------------------------------------ */

export function UnlockCenter() {
  const center = useCenterData();
  const sync = useMutation(api.unlocks.sync);

  // Self-healing: grants persist even if no engine activity ran this session.
  const synced = useRef(false);
  useEffect(() => {
    if (synced.current) return;
    synced.current = true;
    sync().catch(() => void 0);
  }, [sync]);

  if (!center) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-28 rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-48 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const { unlocks, summary } = center;
  const pct =
    summary.totalCount > 0
      ? Math.round((summary.unlockedCount / summary.totalCount) * 100)
      : 0;

  if (unlocks.length === 0) {
    return (
      <EmptyHint>
        برای فضای کاری تو در حال حاضر قابلیت پیشرفته‌ای ثبت نشده است — همه امکانات
        اصلی همیشه در دسترس‌اند.
      </EmptyHint>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <Panel
        title="مرکز قابلیت‌ها"
        icon={<KeyRound className="size-4 text-primary" />}
        description="با پیشرفت واقعی، ابزارهای پیشرفته‌تر به‌تدریج در دسترس قرار می‌گیرند."
        action={
          <Pill toneKey="violet">
            {toFa(summary.unlockedCount)} از {toFa(summary.totalCount)} باز شده
          </Pill>
        }
      >
        <Bar pct={pct} toneKey="violet" className="h-2.5" />
        <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
          <span className="tabular-nums">{toFa(pct)}٪ قابلیت‌ها باز شده‌اند</span>
          <span>امکانات اصلی همیشه آزاد‌اند</span>
        </div>

        {summary.next && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
            <Sparkles className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <span className="text-[12px] font-bold">
                قدم بعدی: «{summary.next.label}»
              </span>
              {summary.next.missing.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {summary.next.missing.join("، ")}
                </p>
              )}
            </div>
          </div>
        )}
      </Panel>

      {/* Cards */}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {unlocks.map((item) => (
          <UnlockCard key={item.key} item={item} />
        ))}
      </ul>

      <p className="text-center text-[11px] leading-5 text-muted-foreground">
        قابلیت‌ها یک‌بار و برای همیشه باز می‌شوند و با پیشرفت کمتر از بین نمی‌روند.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Capability gate — locked state explains WHY + WHAT to do            */
/* ------------------------------------------------------------------ */

export function CapabilityGate({
  featureKey,
  children,
}: {
  featureKey: string;
  children: React.ReactNode;
}) {
  const cap = useQuery(api.unlocks.capability, { featureKey });

  // Loading: keep layout alive without flashing the gated content.
  if (cap === undefined) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-8">
        <div className="skeleton h-9 w-56" />
        <div className="skeleton h-48 rounded-2xl" />
      </div>
    );
  }

  // Unknown feature keys fail OPEN — a future module can never lock by accident.
  if (cap.unlocked) return <>{children}</>;

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <section
        className="ui-surface rounded-2xl p-6 text-center"
        role="status"
        aria-label={`${cap.label} قفل است`}
      >
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 text-slate-600 dark:from-white/10 dark:to-white/5 dark:text-slate-300">
          <Lock className="size-6" aria-hidden="true" />
        </span>
        <h2 className="mt-3 text-lg font-extrabold">«{cap.label}» هنوز باز نشده</h2>
        <p className="mx-auto mt-1 max-w-md text-xs leading-6 text-muted-foreground">
          {cap.description} این قابلیت زمانی مفید است که به اندازه کافی پیشرفت
          کرده باشی — تا آن زمان، همه امکانات اصلی مثل کارها، پروژه‌ها، تقویم و
          برنامه‌ریزی آزاد در دسترس‌اند.
        </p>

        {cap.missing.length > 0 && (
          <div className="mx-auto mt-4 max-w-sm text-start">
            <h3 className="mb-1.5 text-[11px] font-bold text-muted-foreground">
              برای باز شدن لازم است:
            </h3>
            <ul className="space-y-1.5">
              {cap.missing.map((m, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground dark:bg-white/5"
                >
                  <Circle className="size-3 shrink-0" aria-hidden="true" />
                  {m}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button asChild size="sm">
            <Link to="/progress?tab=unlocks">
              <KeyRound className="size-3.5" />
              مرکز قابلیت‌ها
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/progress">
              مشاهده پیشرفت
              <ArrowLeft className="size-3.5" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Compact dashboard hint                                              */
/* ------------------------------------------------------------------ */

export function UnlockHint() {
  const hint = useQuery(api.unlocks.hint);
  if (!hint) return null;

  const isNew = hint.kind === "new";

  return (
    <div className="border-b border-border/60 px-4 py-2">
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white",
            isNew
              ? "from-emerald-400 to-teal-600"
              : "from-slate-300 to-slate-400 dark:from-white/15 dark:to-white/5",
          )}
          aria-hidden="true"
        >
          {isNew ? (
            <Unlock className="size-4" />
          ) : (
            <UnlockIcon name={hint.icon} className="size-4 opacity-80" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <span className="text-[12px] font-bold">
            {isNew ? "قابلیت جدید باز شد" : "در آستانه باز شدن"}: «{hint.label}»
          </span>
          <p className="truncate text-[11px] text-muted-foreground">
            {isNew
              ? "اکنون در دسترس است — سریع سراغش برو."
              : "کافی است این شرط را برآورده کنی:"}
            {!isNew && " " + (hint as { missing?: string[] }).missing?.join("، ")}
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="h-7 shrink-0">
          <Link to="/progress?tab=unlocks">
            {isNew ? "بررسی" : "مشاهده پیشرفت"}
            <ArrowLeft className="size-3" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Restrained unlock feedback (toast, never a giant popup)             */
/* ------------------------------------------------------------------ */

/**
 * Mounted once inside the workspace shell. Establishes a baseline of already
 * known grant events (so history is never re-toasted), runs one self-healing
 * sync per mount, then toasts only genuinely new grants as they stream in.
 */
export function UnlockFeedback() {
  const recent = useQuery(api.unlocks.recent);
  const sync = useMutation(api.unlocks.sync);
  const navigate = useNavigate();
  const baseline = useRef<Set<string> | null>(null);
  const synced = useRef(false);

  useEffect(() => {
    if (recent === undefined) return;

    if (baseline.current === null) {
      // First delivery = everything that already happened. Never toast it.
      baseline.current = new Set(recent.map((e) => e.id));
    } else {
      const fresh = recent.filter((e) => !baseline.current!.has(e.id));
      for (const ev of fresh) {
        baseline.current.add(ev.id);
        toast("قابلیت جدید باز شد", {
          description: `«${ev.label}» اکنون در دسترس است.`,
          action: {
            label: "بررسی",
            onClick: () => navigate("/progress?tab=unlocks"),
          },
        });
      }
    }

    if (!synced.current) {
      synced.current = true;
      sync().catch(() => void 0);
    }
  }, [recent, sync, navigate]);

  return null;
}
