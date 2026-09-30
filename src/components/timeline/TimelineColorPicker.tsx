/**
 * Visual Timeline (Phase 17) — activity colour picker.
 *
 * Sixteen soft hues. Colour is cosmetic: the picker never explains what a
 * colour "means", because the user is free to organise their own week
 * however they like (§13).
 */
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TIMELINE_COLORS,
  TIMELINE_COLOR_KEYS,
  type TimelineColorKey,
} from "@/lib/timeline/timeline-colors";

export function TimelineColorPicker({
  value,
  onChange,
  idPrefix = "tl",
}: {
  value: TimelineColorKey | null;
  onChange: (key: TimelineColorKey) => void;
  idPrefix?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="رنگ فعالیت"
      className="flex flex-wrap gap-1.5"
    >
      {TIMELINE_COLOR_KEYS.map((key) => {
        const color = TIMELINE_COLORS[key];
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            id={`${idPrefix}-color-${key}`}
            aria-checked={selected}
            aria-label={color.labelFa}
            title={color.labelFa}
            onClick={() => onChange(key)}
            className={cn(
              "grid size-8 place-items-center rounded-lg border transition-all",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              color.swatch,
              selected
                ? "scale-110 border-foreground/70 shadow-[0_0_0_2px_var(--background),0_0_0_3px_var(--foreground)]"
                : "border-black/10 hover:scale-105 dark:border-white/20",
            )}
          >
            {selected && (
              <Check className="size-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" aria-hidden="true" />
            )}
            <span className="sr-only">{color.labelFa}</span>
          </button>
        );
      })}
    </div>
  );
}
