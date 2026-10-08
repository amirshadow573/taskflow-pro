/**
 * Phase 16 — AI Insights Center (§14).
 *
 * An intelligence workspace, not a chatbot (§14). Four surfaces:
 *   الگوها و بینش‌ها → proven patterns + the model's reading
 *   مرور روزانه     → §7
 *   مرور هفتگی      → §8
 *   تاریخچه          → every past run, with its patterns preserved
 *
 * Two behaviours matter more than the layout:
 *
 *  - The DETERMINISTIC patterns render even when AI is down, unconfigured or
 *    slow. A failed provider costs the user the commentary, never the
 *    intelligence (§22, §24).
 *  - Applying an insight's actions goes through the Phase 15 confirmation gate
 *    (`ai.applyProposal`). There is no second apply path (§6).
 */
import { useCallback, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Bot,
  CalendarRange,
  ChevronDown,
  History,
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, Pill, StatTile, EmptyHint } from "@/components/progress/progress-ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toFa } from "@/lib/persian";
import { cn } from "@/lib/utils";
import {
  INSUFFICIENT_DATA_FA,
  REVIEW_SECTION_TITLES_FA,
  type AIInsightResponse,
  type AIInsightSection,
  type DetectedPattern,
} from "@/lib/ai/insight-types";
import type { AIAction } from "@/lib/ai/types";
import { AIInsightCard } from "./AIInsightCard";
import { isTestMode } from "@/lib/personas";

type Mode = "insight" | "daily_review" | "weekly_review";

const MODES: Array<{ key: Mode; label: string; icon: typeof Sparkles }> = [
  { key: "insight", label: "الگوها و بینش‌ها", icon: TrendingUp },
  { key: "daily_review", label: "مرور روزانه", icon: Target },
  { key: "weekly_review", label: "مرور هفتگی", icon: CalendarRange },
];

export function AIInsightsCenter() {
  const askInsight = useAction(api.aiInsights.askInsight);
  const applyProposal = useMutation(api.ai.applyProposal);
  const discardProposal = useMutation(api.ai.discardProposal);

  const guestMode = isTestMode();
  const status = useQuery(api.aiInsights.status, guestMode ? "skip" : {});
  const evidence = useQuery(api.aiInsights.insightContext, guestMode ? "skip" : { window: "7d" });
  const history = useQuery(api.aiInsights.insightHistory, guestMode ? "skip" : { limit: 8 });

  const [mode, setMode] = useState<Mode>("insight");
  const [window_, setWindow_] = useState<"7d" | "14d" | "30d">("7d");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [result, setResult] = useState<{
    response: AIInsightResponse | null;
    patterns: DetectedPattern[];
    unexplained: Set<string>;
    messageId: Id<"aiMessages"> | null;
  } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const tzOffset = useMemo(() => -new Date().getTimezoneOffset(), []);

  const run = useCallback(
    async (target: Mode, customWindow?: "7d" | "14d" | "30d") => {
      if (busy) return;
      setBusy(true);
      setError(null);
      setResult(null);
      setSelected(new Set());
      try {
        const res = await askInsight({
          kind: target,
          window: customWindow ?? window_,
          tzOffsetMinutes: tzOffset,
        });
        if (res.ok) {
          setSelected(new Set(res.response.actions.map((_, i) => i)));
          setResult({
            response: res.response,
            patterns: res.patterns,
            unexplained: new Set(res.unexplainedPatterns.map((p) => p.type)),
            messageId: res.messageId,
          });
        } else {
          // Provider unavailable — keep the deterministic patterns (§22).
          setResult({
            response: null,
            patterns: res.patterns,
            unexplained: new Set(res.patterns.map((p) => p.type)),
            messageId: null,
          });
          setError({ message: res.message, retryable: res.retryable });
        }
      } catch {
        setError({
          message: "ارتباط با دستیار برقرار نشد. یافته‌های قطعی همچنان در دسترس است.",
          retryable: true,
        });
      } finally {
        setBusy(false);
      }
    },
    [askInsight, busy, tzOffset, window_],
  );

  /* ---- §6: reuse the Phase 15 apply gate ---- */
  const apply = useCallback(async () => {
    if (!result?.messageId || applying) return;
    setApplying(true);
    try {
      await applyProposal({
        messageId: result.messageId,
        actionIndexes: [...selected],
        confirm: true,
      });
      setResult((r) => (r ? { ...r, messageId: null } : r));
    } catch {
      setError({
        message: "اعمال تغییرات انجام نشد. فضای کاری شما دست‌نخورده باقی ماند.",
        retryable: true,
      });
    } finally {
      setApplying(false);
    }
  }, [applying, applyProposal, result, selected]);

  const discard = useCallback(async () => {
    if (!result?.messageId) return;
    try {
      await discardProposal({ messageId: result.messageId });
      setResult((r) => (r ? { ...r, messageId: null } : r));
    } catch {
      /* nothing was written either way */
    }
  }, [discardProposal, result]);

  const patterns = useMemo(
    () => result?.patterns ?? evidence?.patterns ?? [],
    [result?.patterns, evidence?.patterns],
  );
  const insufficient =
    result !== null ? result.patterns.length === 0 : (evidence?.insufficient ?? false);
  const interpretations = useMemo(
    () => result?.response?.interpretations ?? [],
    [result?.response?.interpretations],
  );
  const sections = useMemo(
    () => result?.response?.sections ?? [],
    [result?.response?.sections],
  );
  const actions: AIAction[] = useMemo(
    () => result?.response?.actions ?? [],
    [result?.response?.actions],
  );

  /** Map each action to the pattern whose entities it references. */
  const indexesByPattern = useMemo(() => {
    const map = new Map<string, number[]>();
    actions.forEach((a, i) => {
      const target = "target_id" in a ? a.target_id : undefined;
      if (!target) return;
      for (const p of patterns) {
        if (p.affectedEntityIds.includes(target)) {
          const list = map.get(p.type) ?? [];
          list.push(i);
          map.set(p.type, list);
        }
      }
    });
    return map;
  }, [actions, patterns]);

  return (
    <div className="space-y-4">
      {/* ---- header + controls ---- */}
      <Panel
        title={status?.personaLabel ?? "بینش‌های هوشمند"}
        icon={<Bot className="size-4 text-primary" aria-hidden="true" />}
        description="الگوها را موتور قطعی ثابت می‌کند؛ دستیار آن‌ها را توضیح می‌دهد و پیشنهاد می‌دهد."
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {MODES.map((m) => {
              const Icon = m.icon;
              return (
                <Button
                  key={m.key}
                  type="button"
                  variant={mode === m.key ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-[11px]"
                  onClick={() => {
                    setMode(m.key);
                    void run(m.key);
                  }}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {m.label}
                </Button>
              );
            })}
          </div>

          {mode === "insight" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-muted-foreground">بازه:</span>
              {(["7d", "14d", "30d"] as const).map((w) => (
                <Button
                  key={w}
                  type="button"
                  variant={window_ === w ? "soft" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => {
                    setWindow_(w);
                    void run("insight", w);
                  }}
                >
                  {w === "7d" ? "۷ روز" : w === "14d" ? "۱۴ روز" : "۳۰ روز"}
                </Button>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={() => void run(mode)}
                disabled={busy}
              >
                <RefreshCw className="size-3" aria-hidden="true" />
                تازه‌سازی
              </Button>
            </div>
          )}

          {status?.quickActions?.length ? (
            <div className="flex flex-wrap gap-1.5 border-t border-border/40 pt-2.5">
              {status.quickActions.map((q) => (
                <Button
                  key={q}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  disabled={busy}
                  onClick={() => void run(mode)}
                  title={q}
                >
                  <Sparkles className="size-3" aria-hidden="true" />
                  {q}
                </Button>
              ))}
            </div>
          ) : null}

          {/* ---- privacy disclosure (§20, §27) ---- */}
          {evidence && evidence.sources.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowPrivacy((v) => !v)}
                className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground"
              >
                <ChevronDown
                  className={cn("size-3 transition-transform", showPrivacy && "rotate-180")}
                  aria-hidden="true"
                />
                چه داده‌ای برای تحلیل استفاده می‌شود؟
              </button>
              {showPrivacy && (
                <div className="mt-1 space-y-1 rounded-lg bg-muted/40 px-2.5 py-2">
                  <p className="flex items-start gap-1.5 text-[10px] leading-4 text-muted-foreground">
                    <ShieldCheck className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                    کلید API فقط روی سرور است و هیچ داده‌ای از کاربر دیگری وارد تحلیل نمی‌شود.
                  </p>
                  <ul className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                    {evidence.sources.map((s) => (
                      <li key={s}>
                        <Pill toneKey="slate">{sourceLabelFa(s)}</Pill>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </Panel>

      {/* ---- loading (§33) ---- */}
      {busy && (
        <div
          role="status"
          aria-live="polite"
          className="ui-surface flex items-center gap-2 rounded-2xl px-4 py-3 text-[11px] text-muted-foreground"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          در حال محاسبهٔ شواهد و تحلیل…
        </div>
      )}

      {/* ---- error: real intelligence still shown below (§22) ---- */}
      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[11px] leading-5">{error.message}</p>
            {error.retryable && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1.5 h-7 text-[11px]"
                disabled={busy}
                onClick={() => void run(mode)}
              >
                تلاش دوباره
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ---- honest empty / insufficient (§11) ---- */}
      {insufficient && !busy && (
        <EmptyHint>{INSUFFICIENT_DATA_FA}</EmptyHint>
      )}

      {/* ---- deterministic stats (§2 layer 1) ---- */}
      {evidence?.stats?.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {evidence.stats.slice(0, 6).map((s) => (
            <StatTile key={s.label} label={s.label} value={s.value} icon={null} />
          ))}
        </div>
      ) : null}

      {/* ---- review sections (§7, §8) ---- */}
      {sections.length > 0 && (
        <Panel
          title={mode === "weekly_review" ? "مرور هفتگی" : "مرور روزانه"}
          icon={<CalendarRange className="size-4 text-primary" aria-hidden="true" />}
        >
          <div className="space-y-3">
            {sections.map((s: AIInsightSection) => (
              <div key={s.key}>
                <p className="text-[11px] font-extrabold">
                  {REVIEW_SECTION_TITLES_FA[s.key] ?? s.key}
                </p>
                <ul className="mt-1 space-y-0.5 pr-4 text-[11px] leading-5 text-muted-foreground">
                  {s.lines.map((line, i) => (
                    <li key={i} className="list-disc break-words">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ---- the patterns themselves (§2, §10) ---- */}
      {patterns.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold">
              {toFa(patterns.length)} یافتهٔ قطعی
            </h2>
            <Pill toneKey="slate">
              <ShieldCheck className="size-3" aria-hidden="true" />
              قابل ردیابی به داده
            </Pill>
          </div>

          {patterns.map((p) => (
            <AIInsightCard
              key={p.type}
              pattern={p}
              interpretation={interpretations.find((i) => i.patternType === p.type)}
              actions={actions}
              actionIndexes={indexesByPattern.get(p.type) ?? []}
              selected={selected}
              onToggle={(i, on) =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (on) next.add(i);
                  else next.delete(i);
                  return next;
                })
              }
              onApply={() => void apply()}
              onDiscard={() => void discard()}
              applying={applying}
              unexplained={result?.unexplained.has(p.type) ?? false}
            />
          ))}

          {/* orphan actions not attributable to a single pattern */}
          {actions.length > 0 && result?.messageId && (
            <div className="ui-surface space-y-2 rounded-2xl px-4 py-3">
              <p className="text-[11px] font-extrabold">
                {toFa(actions.length)} تغییر پیشنهادی دیگر
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-[11px]"
                  disabled={applying || selected.size === 0}
                  onClick={() => void apply()}
                >
                  اعمال {toFa(selected.size)} تغییر
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-[11px]"
                  disabled={applying}
                  onClick={() => void discard()}
                >
                  انصراف
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- model warnings (§11, §22) ---- */}
      {result?.response?.warnings?.length ? (
        <Panel title="ملاحظات تحلیل" icon={<Info className="size-4 text-primary" aria-hidden="true" />}>
          <ul className="space-y-1 pr-4 text-[11px] leading-5 text-muted-foreground">
            {result.response.warnings.map((w, i) => (
              <li key={i} className="list-disc break-words">
                {w}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {/* ---- history (§14) ---- */}
      <Panel
        title="تاریخچهٔ تحلیل‌ها"
        icon={<History className="size-4 text-primary" aria-hidden="true" />}
        description="هر تحلیل با یافته‌های قطعی خودش ذخیره می‌شود."
      >
        {!history || history.length === 0 ? (
          <EmptyHint>هنوز تحلیلی ذخیره نشده است.</EmptyHint>
        ) : (
          <ul className="space-y-1.5">
            {history.map((h) => (
              <li key={h._id} className="rounded-xl bg-muted/40 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <p className="text-[11px] font-bold break-words">{h.summary}</p>
                  <div className="flex shrink-0 gap-1">
                    <Pill toneKey="slate">
                      {h.kind === "weekly_review"
                        ? "هفتگی"
                        : h.kind === "daily_review"
                          ? "روزانه"
                          : "بینش"}
                    </Pill>
                    {h.insufficient && <Pill toneKey="amber">دادهٔ ناکافی</Pill>}
                  </div>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {toFa(h.patternCount)} یافتهٔ قطعی • {h.window}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function sourceLabelFa(key: string): string {
  const map: Record<string, string> = {
    facts: "آمار محاسبه‌شده",
    tasks: "کارها",
    blocks: "بلوک‌های زمانی",
    execution: "جلسات اجرا",
    estimates: "تخمین و زمان واقعی",
    goals: "اهداف",
    projects: "پروژه‌ها",
    routines: "روتین‌ها",
    habits: "عادت‌ها",
    domain: "زمینهٔ تخصصی",
  };
  return map[key] ?? key;
}
