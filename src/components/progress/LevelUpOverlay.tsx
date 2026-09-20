import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LEVELS, titleForLevel } from "@/convex/progression";
import { toFa } from "@/lib/persian";
import { ACHIEVEMENTS } from "@/convex/progression";
import { Button } from "@/components/ui/button";
import { AchievementIcon, TONES } from "./progress-ui";
import { Sparkles, Sparkle, Trophy } from "lucide-react";

export interface ProgressionEvent {
  level?: number;
  levelUp?: number | null;
  unlocked?: string[];
  xp?: number;
}

function Fa({ n }: { n: number }) {
  return <>{toFa(n)}</>;
}

/**
 * Premium (non-gamified) level-up + achievement reveal.
 * Triggered by the `progress:event` window event fired from the workspace data layer.
 */
export function LevelUpOverlay({
  event,
  onClose,
}: {
  event: ProgressionEvent | null;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const open = !!event && (!!event.levelUp || (event.unlocked?.length ?? 0) > 0);
  const unlockedDefs = (event?.unlocked ?? [])
    .map((k) => ACHIEVEMENTS.find((a) => a.key === k) ?? null)
    .filter((a): a is NonNullable<typeof a> => a !== null);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="levelup"
          className="fixed inset-0 z-[90] grid place-items-center bg-slate-900/25 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          role="dialog"
          aria-modal="true"
          aria-label="ارتقای سطح"
        >
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 12 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
            className="ui-frame-gradient relative w-full max-w-md rounded-3xl p-[1px] shadow-[0_30px_80px_-30px_rgba(37,99,235,0.55)]"
          >
            <div className="ui-surface relative overflow-hidden rounded-3xl p-6 text-center">
              <div className="pointer-events-none absolute -top-24 left-1/2 size-64 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />

              <div className="relative">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-extrabold tracking-wide text-primary">
                  <Sparkles className="size-3.5" />
                  {event?.levelUp ? "ارتقای سطح" : "دستاورد جدید"}
                </span>

                {event?.levelUp && (
                  <>
                    <div className="mt-5 flex items-center justify-center gap-4">
                      <span className="text-[11px] font-bold text-muted-foreground">
                        سطح {toFa(event.levelUp - 1)}
                      </span>
                      <span className="text-muted-foreground">←</span>
                      <motion.span
                        initial={reduce ? { opacity: 1 } : { scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.12, type: "spring", stiffness: 260, damping: 18 }}
                        className="grid size-20 place-items-center rounded-2xl bg-gradient-to-br from-primary to-[#5B5FE6] text-2xl font-black text-white shadow-[0_16px_40px_-16px_rgba(37,99,235,0.95)]"
                      >
                        {toFa(event.levelUp)}
                      </motion.span>
                    </div>
                    <h2 className="mt-4 text-2xl font-black tracking-tight">
                      {titleForLevel(event.levelUp)}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      سطح {toFa(event.levelUp)} — حالا یک قدم جلوتر از دیروزی.
                    </p>
                    {typeof event?.xp === "number" && (
                      <div className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-extrabold text-primary">
                        <Sparkle className="size-4" />
                        مجموع {toFa(event.xp.toLocaleString("en-US"))} XP
                      </div>
                    )}
                  </>
                )}

                {unlockedDefs.length > 0 && (
                  <div className="mt-5 border-t border-border/50 pt-4 text-start">
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                      <Trophy className="size-3.5" />
                      {unlockedDefs.length === 1 ? "دستاورد جدید" : "دستاوردهای جدید"}
                    </div>
                    <ul className="space-y-2">
                      {unlockedDefs.map((a) => (
                        <li
                          key={a.key}
                          className="flex items-center gap-3 rounded-xl border border-border/60 bg-white/60 p-2.5 dark:bg-white/5"
                        >
                          <span
                            className={`grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white ${TONES[a.tone].grad}`}
                          >
                            <AchievementIcon name={a.icon} className="size-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-xs font-bold">{a.title}</div>
                            <div className="truncate text-[11px] text-muted-foreground">
                              {a.description}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-5 flex items-center justify-center gap-2">
                  <Button onClick={onClose} className="min-w-32">
                    ادامه
                  </Button>
                  <Button variant="ghost" onClick={onClose}>
                    بعداً
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Small shared helper so all surfaces render levels the same way. */
export function LevelChip({ level }: { level: number }) {
  const named = level <= LEVELS.length;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
      سطح {toFa(level)}
      {named && <span className="opacity-70">· {titleForLevel(level)}</span>}
    </span>
  );
}

export { Fa };
