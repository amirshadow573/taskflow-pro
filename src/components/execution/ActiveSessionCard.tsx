/**
 * ActiveSessionCard — Phase 12 §5 / §17 / §31 / §33 / §34.
 *
 * The single place where the user actually works. It shows the live timer for
 * the CURRENT session, the pause/resume/complete controls and an OPTIONAL,
 * minimal feedback chooser (§8). The timer ticks entirely locally — one
 * `setInterval` per second while running — and only real state changes reach
 * the backend, so there is no polling (§31).
 *
 * Truthfulness contract (§34 / §35): the card renders whatever the SERVER says
 * the session is. If a session is paused server-side, no interval runs and the
 * clock freezes; if the session disappeared (another tab completed it), the
 * parent stops rendering this card. The UI can never report "running" while the
 * backend disagrees.
 *
 * Accessibility (§33): the timer carries `role="timer"` plus a Persian
 * `aria-label` in whole minutes, every control is a real button with a label,
 * state is communicated by text as well as color, and motion is CSS-only.
 */
import { useEffect, useState } from "react";
import {
  Ban,
  Check,
  Hourglass,
  Pause,
  Play,
  Timer,
} from "lucide-react";
import { Bar, Pill } from "@/components/progress/progress-ui";
import { useUserProfile } from "@/hooks/use-user-profile";
import { Button } from "@/components/ui/button";
import {
  FEEDBACK_OPTIONS_FA,
  sessionElapsedMs,
  sessionLabel,
  type ExecutionSession,
} from "@/lib/execution";
import { minutesFa } from "@/components/scheduling/schedule-ui";
import { cn } from "@/lib/utils";
import { stateLabelFa, timerFa, timerLabelFa } from "./execution-ui";
import type { UseExecutionResult } from "@/hooks/use-execution";

export function ActiveSessionCard({
  execution,
  session,
}: {
  execution: UseExecutionResult;
  session: ExecutionSession;
}) {
  const { personaKey } = useUserProfile();
  const [tick, setTick] = useState(() => Date.now());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const running = session.state === "in_progress";

  /* Local 1-second clock — only while the server says we are running. */
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const elapsedMs = sessionElapsedMs(session, tick);
  const elapsedMinutes = Math.max(0, Math.round(elapsedMs / 60000));
  const planned = session.plannedMinutes ?? null;
  const pct = planned && planned > 0 ? Math.min(100, Math.round((elapsedMinutes / planned) * 100)) : 0;

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="ui-surface overflow-hidden rounded-2xl border-primary/30"
      aria-label="اجرای در حال انجام"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <span className="ui-icon-tile size-6">
            <Timer className="size-3.5 text-primary" aria-hidden />
          </span>
          الان
        </h2>
        <div className="flex items-center gap-2">
          <Pill toneKey={running ? "emerald" : "amber"}>{stateLabelFa(session.state)}</Pill>
          <Pill toneKey="slate">{sessionLabel(session.kind, personaKey)}</Pill>
        </div>
      </header>

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-extrabold">{session.title}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              شروع: {new Date(session.startedAt).toLocaleTimeString("fa-IR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {planned ? ` — تخمین ${minutesFa(planned)}` : " — بدون تخمین ثبت‌شده"}
            </p>
          </div>
          <div className="text-start">
            <div
              role="timer"
              aria-live="off"
              aria-atomic="true"
              aria-label={`زمان اجرا: ${timerLabelFa(elapsedMs)}`}
              className={cn(
                "text-3xl font-extrabold tabular-nums leading-none",
                running ? "text-primary" : "text-muted-foreground",
              )}
            >
              {timerFa(elapsedMs)}
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {running ? "در حال ثبت زمان" : "متوقف — زمان ثبت نمی‌شود"}
            </p>
          </div>
        </div>

        {planned ? (
          <div className="space-y-1">
            <Bar pct={pct} toneKey={pct > 100 ? "rose" : "blue"} className="h-2" />
            <p className="text-[10px] text-muted-foreground">
              {pct < 100
                ? `${timerLabelFa(elapsedMs)} از ${minutesFa(planned)} تخمینی`
                : `از تخمین ${minutesFa(planned)} گذشته — زمان واقعی ثبت می‌شود، تخمین دست‌نخورده می‌ماند.`}
            </p>
          </div>
        ) : null}

        {/* Controlled lifecycle — nothing happens without a click (§29) */}
        <div className="flex flex-wrap items-center gap-1.5">
          {running ? (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void run(() => execution.pause(session._id as never))}
            >
              <Pause className="size-3.5" aria-hidden />
              توقف موقت
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void run(() => execution.resume(session._id as never))}
            >
              <Play className="size-3.5" aria-hidden />
              ادامه
            </Button>
          )}

          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              void run(() =>
                execution.complete(session._id as never, feedback ? { feedback } : undefined),
              )
            }
          >
            <Check className="size-3.5" aria-hidden />
            پایان کار
          </Button>

          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() =>
              void run(() =>
                execution.abandon(session._id as never, feedback ? { feedback } : undefined),
              )
            }
          >
            <Ban className="size-3.5" aria-hidden />
            رها کردن
          </Button>
        </div>

        {/* Optional, minimal feedback (§8) — never mandatory, never a rating */}
        <div>
          <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">
            بازخورد (اختیاری)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {FEEDBACK_OPTIONS_FA.map((opt) => {
              const active = feedback === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFeedback(active ? null : opt.value)}
                  className={cn(
                    "rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/70 bg-white/60 text-muted-foreground hover:border-primary/40 dark:bg-white/5",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
            <Hourglass className="size-3" aria-hidden />
            با «پایان کار» زمان واقعی ثبت می‌شود و همان بازخورد ذخیره می‌گردد.
          </p>
        </div>
      </div>
    </section>
  );
}
