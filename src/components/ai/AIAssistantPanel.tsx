/**
 * Phase 15 — AI Productivity Assistant (desktop panel / mobile full screen).
 *
 * Deliberately NOT a chat app. It opens onto contextual suggestions drawn from
 * the user's real data (§7), and every answer that touches the workspace arrives
 * as a REVIEWABLE list of concrete changes (§12) — never as prose that implies
 * something already happened.
 *
 * States are explicit because §33 is not optional: loading, empty, error,
 * timeout, retry, not-configured, and the "already applied / already discarded"
 * terminal states are all distinct and all reachable.
 *
 * The client cannot invent an action. It sends the prompt, receives a validated
 * plan, and can only submit INDEXES into the plan the server stored.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Lock,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/progress/progress-ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toFa } from "@/lib/persian";
import { cn } from "@/lib/utils";
import type { ValidatedAction } from "@/lib/ai/types";

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

export function AIAssistantBody({
  feature = "assistant",
  initialPrompt,
  onClose,
}: {
  /** Which surface opened it — used for usage attribution (§23). */
  feature?: string;
  /** Pre-filled suggestion, e.g. "Optimize today" from the Today page (§30). */
  initialPrompt?: string;
  onClose?: () => void;
}) {
  const status = useQuery(api.ai.status);
  const history = useQuery(api.ai.history, { limit: 30 });
  const ask = useAction(api.ai.ask);
  const recordTurn = useMutation(api.ai.recordTurn);
  const applyProposal = useMutation(api.ai.applyProposal);
  const discardProposal = useMutation(api.ai.discardProposal);
  const clearConversation = useMutation(api.ai.clearConversation);

  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [answer, setAnswer] = useState<{
    summary: string;
    sections: Array<{ key: string; title: string; body: string }>;
    notes: string[];
    sources: string[];
    plan: { actions: ValidatedAction[]; maxSafety: number; droppedCount: number };
    messageId: Id<"aiMessages"> | null;
    applied: boolean;
  } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);
  const [showContext, setShowContext] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationId = history?.conversationId ?? undefined;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [answer, busy]);

  const reset = useCallback(() => {
    setAnswer(null);
    setSelected(new Set());
    setError(null);
  }, []);

  /* ---- send (§33: never an infinite spinner; timeout is a real state) ---- */
  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || busy) return;

      setBusy(true);
      setError(null);
      setPrompt("");
      reset();

      const HORIZON_MS = 45_000;
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
      }, HORIZON_MS);

      try {
        const tzOffset = -new Date().getTimezoneOffset();
        const result = await ask({
          prompt: question,
          feature,
          conversationId,
          horizonDays: 7,
          tzOffsetMinutes: tzOffset,
        });
        clearTimeout(timer);

        if (timedOut) {
          setError({
            message: "پاسخ بیش از حد طول کشید. می‌توانید دوباره تلاش کنید.",
            retryable: true,
          });
          return;
        }

        if (!result.ok) {
          setError({ message: result.message, retryable: result.retryable });
          void recordTurn({
            prompt: question,
            feature,
            conversationId,
            ok: false,
            failure: result.failure,
            provider: result.telemetry?.provider,
            model: result.telemetry?.model,
            latencyMs: result.telemetry?.latencyMs,
          });
          return;
        }

        const messageId = await recordTurn({
          prompt: question,
          feature,
          conversationId,
          ok: true,
          summary: result.response.summary,
          responseType: result.response.response_type,
          plan: JSON.stringify(result.plan),
          contextSources: JSON.stringify(result.contextSources),
          provider: result.telemetry.provider,
          model: result.telemetry.model,
          latencyMs: result.telemetry.latencyMs,
          promptTokens: result.telemetry.promptTokens,
          completionTokens: result.telemetry.completionTokens,
        });

        const indices = result.plan.actions.map((_, i) => i);
        setSelected(new Set(indices));
        setAnswer({
          summary: result.response.summary,
          sections: result.response.sections,
          notes: result.response.notes,
          sources: result.contextSources,
          plan: result.plan,
          messageId: messageId ?? null,
          applied: false,
        });
      } catch (err) {
        clearTimeout(timer);
        setError({
          message:
            err instanceof Error && err.message
              ? "ارتباط با دستیار برقرار نشد. دوباره تلاش کنید."
              : "خطای نامشخص رخ داد.",
          retryable: true,
        });
      } finally {
        clearTimeout(timer);
        setBusy(false);
      }
    },
    [ask, busy, conversationId, feature, recordTurn, reset],
  );

  /* ---- §12 apply ---- */
  const apply = useCallback(async () => {
    if (!answer?.messageId || applying) return;
    setApplying(true);
    try {
      const res = await applyProposal({
        messageId: answer.messageId,
        actionIndexes: [...selected],
        confirm: true,
      });
      setAnswer((a) =>
        a
          ? {
              ...a,
              applied: true,
              plan: {
                ...a.plan,
                actions: a.plan.actions.filter((_, i) => selected.has(i)),
              },
            }
          : a,
      );
      void res;
    } catch {
      setError({
        message: "اعمال تغییرات انجام نشد. فضای کاری شما دست‌نخورده باقی ماند.",
        retryable: true,
      });
    } finally {
      setApplying(false);
    }
  }, [answer, applying, applyProposal, selected]);

  /* ---- §12 cancel ---- */
  const discard = useCallback(async () => {
    if (!answer?.messageId) return;
    try {
      await discardProposal({ messageId: answer.messageId });
      setAnswer((a) => (a ? { ...a, applied: true } : a));
    } catch {
      /* nothing was written either way */
    }
  }, [answer, discardProposal]);

  const actions = answer?.plan.actions ?? [];
  const selectedCount = selected.size;
  const needsCare = (answer?.plan.maxSafety ?? 1) >= 3;
  const configured = status?.configured ?? true;

  const quickActions = useMemo(() => status?.quickActions ?? [], [status]);
  const priorTurns = (history?.messages ?? []).slice(-6);

  return (
    <div className="flex h-full min-h-0 flex-col">
        <header className="shrink-0 space-y-1 border-b border-border/50 px-4 py-3 text-start">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-extrabold">
              <Sparkles className="size-4 text-primary" aria-hidden="true" />
              {status?.personaLabel ?? "دستیار بهره‌وری"}
            </h2>
            {onClose && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                aria-label="بستن دستیار"
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            )}
          </div>
          <p className="text-[11px] leading-5 text-muted-foreground">
            پیشنهاد می‌دهد؛ شما تأیید می‌کنید؛ فضای کاری شما تغییر می‌کند.
          </p>
        </header>

        {/* ---------- transcript ---------- */}
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {priorTurns.map((m) => (
            <p
              key={m.id}
              className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-[11px] leading-5",
                m.role === "user"
                  ? "me-0 bg-primary/10 text-foreground"
                  : "ms-0 bg-muted/50 text-muted-foreground",
              )}
            >
              {m.content}
            </p>
          ))}

          {/* empty state = contextual suggestions, never a blank chat (§7) */}
          {!answer && !busy && !error && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-muted-foreground">
                دربارهٔ چه چیزی کار می‌کنید؟
              </p>
              <div className="flex flex-wrap gap-1.5">
                {quickActions.map((q) => (
                  <Button
                    key={q}
                    type="button"
                    variant="soft"
                    size="sm"
                    className="h-auto py-1.5 text-start text-[11px]"
                    disabled={!configured}
                    onClick={() => void send(q)}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* loading (§33) */}
          {busy && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground"
            >
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              در حال بررسی فضای کاری شما…
            </div>
          )}

          {/* error / timeout / not configured (§24, §33) */}
          {error && (
            <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
              <p className="flex items-start gap-1.5 text-[11px] leading-5">
                <AlertTriangle
                  className="mt-0.5 size-3.5 shrink-0 text-amber-600"
                  aria-hidden="true"
                />
                {error.message}
              </p>
              <p className="text-[10px] leading-4 text-muted-foreground">
                فضای کاری شما بدون دستیار هم کاملاً کار می‌کند.
              </p>
              {error.retryable && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => void send(prompt || quickActions[0] || "")}
                >
                  <RefreshCw className="size-3" aria-hidden="true" />
                  تلاش دوباره
                </Button>
              )}
            </div>
          )}

          {/* answer */}
          {answer && (
            <div className="space-y-3">
              <div className="rounded-2xl rounded-ee-sm bg-muted/50 px-3 py-2">
                <p className="text-[12px] font-bold leading-6">{answer.summary}</p>
              </div>

              {answer.sections.map((s) => (
                <div key={s.key} className="rounded-xl border border-border/60 px-3 py-2">
                  <p className="text-[11px] font-extrabold">{s.title}</p>
                  <p className="mt-0.5 whitespace-pre-line text-[11px] leading-5 text-muted-foreground">
                    {s.body}
                  </p>
                </div>
              ))}

              {answer.notes.length > 0 && (
                <ul className="space-y-0.5 text-[10px] leading-4 text-muted-foreground">
                  {answer.notes.map((n, i) => (
                    <li key={i}>• {n}</li>
                  ))}
                </ul>
              )}

              {/* ---------- action preview (§12) ---------- */}
              {actions.length > 0 && (
                <div
                  className={cn(
                    "space-y-2 rounded-xl border p-3",
                    needsCare ? "border-amber-500/40 bg-amber-500/5" : "border-primary/30 bg-primary/5",
                  )}
                >
                  <p className="text-[11px] font-extrabold">
                    {answer.applied
                      ? "نتیجهٔ اعمال"
                      : `دستیار ${toFa(actions.length)} تغییر پیشنهاد می‌دهد`}
                  </p>

                  {!answer.applied &&
                    (needsCare ? (
                      <p className="flex items-start gap-1.5 text-[10px] leading-4 text-amber-700">
                        <Lock className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                        بعضی از این تغییرات روی داده‌های موجود اثر می‌گذارند؛ هیچ‌کدام بدون تأیید شما اعمال نمی‌شود.
                      </p>
                    ) : null)}

                  <ul className="space-y-1.5">
                    {actions.map((a, i) => (
                      <li key={i}>
                        <label className="flex items-start gap-2 text-[11px] leading-5">
                          <input
                            type="checkbox"
                            className="mt-1 size-3.5 shrink-0 accent-primary"
                            checked={selected.has(i)}
                            disabled={answer.applied}
                            onChange={(e) =>
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(i);
                                else next.delete(i);
                                return next;
                              })
                            }
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-bold">{a.label}</span>
                            {a.detail && (
                              <span className="block text-muted-foreground">{a.detail}</span>
                            )}
                            <span className="block break-words text-muted-foreground">
                              {a.action.reason}
                            </span>
                          </span>
                          {a.safety >= 3 && <Pill toneKey="amber">تغییر موجود</Pill>}
                        </label>
                      </li>
                    ))}
                  </ul>

                  {!answer.applied && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 text-[11px]"
                        disabled={applying || selectedCount === 0}
                        onClick={() => void apply()}
                      >
                        {applying ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        )}
                        اعمال {toFa(selectedCount)} تغییر
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
                  )}

                  {answer.applied && (
                    <p className="text-[10px] text-muted-foreground">
                      این پیشنهاد بسته شد و دوباره اعمال نمی‌شود.
                    </p>
                  )}
                </div>
              )}

              {/* data disclosure (§27) */}
              {answer.sources.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowContext((v) => !v)}
                    className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground"
                  >
                    <ChevronDown
                      className={cn("size-3 transition-transform", showContext && "rotate-180")}
                      aria-hidden="true"
                    />
                    دستیار چه چیزی دیده است؟
                  </button>
                  {showContext && (
                    <ul className="mt-1 space-y-0.5 ps-4 text-[10px] leading-4 text-muted-foreground">
                      {answer.sources.map((s) => (
                        <li key={s}>• {s}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ---------- composer ---------- */}
        <div className="shrink-0 space-y-2 border-t border-border/50 px-4 py-3">
          {!configured && (
            <p className="rounded-lg bg-muted/50 px-2.5 py-1.5 text-[10px] leading-4 text-muted-foreground">
              دستیار هوش مصنوعی هنوز پیکربندی نشده است. تا آن زمان برنامه‌ریزی، زمان‌بندی و
              اجرای شما مثل قبل کار می‌کند.
            </p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(prompt);
                }
              }}
              rows={2}
              maxLength={1000}
              disabled={busy || !configured}
              placeholder="مثلاً: فردا بیش از ظرفیتم کار دارم"
              className="ui-field min-h-[2.5rem] flex-1 resize-none text-[11px] leading-5"
            />
            <Button
              type="button"
              size="icon"
              onClick={() => void send(prompt)}
              disabled={busy || !configured || !prompt.trim()}
              aria-label="ارسال"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">
              Enter می‌فرستد • Shift+Enter خط جدید
            </p>
            {history?.conversationId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[10px]"
                onClick={() => {
                  reset();
                  setPrompt("");
                  void clearConversation({});
                }}
              >
                <Trash2 className="size-3" aria-hidden="true" />
                گفتگوی جدید
              </Button>
            )}
          </div>
        </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slide-over shell (desktop)                                          */
/* ------------------------------------------------------------------ */

export function AIAssistantPanel({
  open,
  onOpenChange,
  feature = "assistant",
  initialPrompt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: string;
  initialPrompt?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md lg:max-w-lg"
      >
        <SheetTitle className="sr-only">دستیار بهره‌وری</SheetTitle>
        <SheetDescription className="sr-only">
          پیشنهادهای مبتنی بر فضای کاری شما. هیچ تغییری بدون تأیید شما اعمال نمی‌شود.
        </SheetDescription>
        <AIAssistantBody
          key={initialPrompt ?? "default"}
          feature={feature}
          initialPrompt={initialPrompt}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Button trigger (§7 — contextual, not a top-level nav item)          */
/* ------------------------------------------------------------------ */

export function AIAssistantButton({
  feature = "assistant",
  prompt,
  label = "دستیار هوش مصنوعی",
  className,
}: {
  feature?: string;
  /** Opens the panel with this suggestion pre-filled (§30). */
  prompt?: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState<string | undefined>(prompt);

  return (
    <>
      <Button
        type="button"
        variant="soft"
        size="sm"
        className={className}
        onClick={() => {
          setSeed(prompt);
          setOpen(true);
        }}
      >
        <Sparkles className="size-3.5" aria-hidden="true" />
        {label}
      </Button>
      <AIAssistantPanel
        open={open}
        onOpenChange={setOpen}
        feature={feature}
        initialPrompt={seed}
      />
    </>
  );
}
