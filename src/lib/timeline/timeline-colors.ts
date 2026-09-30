/**
 * Visual Timeline (Phase 17) — activity colour palette.
 *
 * Sixteen soft, professional SaaS hues. Deliberately pastel surfaces with a
 * hairline border and a dark, high-contrast text colour, so a block stays
 * readable at any density and in both light and dark mode.
 *
 * IMPORTANT — colour is cosmetic only. The palette carries no semantic
 * meaning and the engine never assigns one: users may colour a study block
 * green if they like. Blocks saved before colours existed (or without one)
 * fall back to `kindTone` so the grid is never colourless.
 */

export const TIMELINE_COLOR_KEYS = [
  "blue",
  "indigo",
  "violet",
  "purple",
  "pink",
  "rose",
  "red",
  "orange",
  "amber",
  "yellow",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "slate",
] as const;

export type TimelineColorKey = (typeof TIMELINE_COLOR_KEYS)[number];

export const TIMELINE_COLOR_LABELS_FA: Record<TimelineColorKey, string> = {
  blue: "آبی",
  indigo: "نیلی",
  violet: "بنفش",
  purple: "ارغوانی",
  pink: "صورتی",
  rose: "گلی",
  red: "قرمز",
  orange: "نارنجی",
  amber: "کهربایی",
  yellow: "زرد",
  green: "سبز",
  emerald: "زمردی",
  teal: "فیروزه‌ای تیره",
  cyan: "فیروزه‌ای",
  sky: "آبی روشن",
  slate: "خاکستری",
};

export interface TimelineColor {
  key: TimelineColorKey;
  labelFa: string;
  /** Solid swatch shown in the colour picker. */
  swatch: string;
  /** Block surface + text + border (light mode). */
  surface: string;
  /** Stronger border used while dragging / while in progress. */
  borderStrong: string;
  /** Dark-mode surface + text + border. */
  surfaceDark: string;
}

const make = (
  key: TimelineColorKey,
  swatch: string,
  surface: string,
  borderStrong: string,
  surfaceDark: string,
): TimelineColor => ({
  key,
  labelFa: TIMELINE_COLOR_LABELS_FA[key],
  swatch,
  surface,
  borderStrong,
  surfaceDark,
});

export const TIMELINE_COLORS: Record<TimelineColorKey, TimelineColor> = {
  blue: make(
    "blue",
    "bg-blue-400",
    "bg-blue-50 text-blue-950 border-blue-200",
    "border-blue-400",
    "dark:bg-blue-950/55 dark:text-blue-100 dark:border-blue-800",
  ),
  indigo: make(
    "indigo",
    "bg-indigo-400",
    "bg-indigo-50 text-indigo-950 border-indigo-200",
    "border-indigo-400",
    "dark:bg-indigo-950/55 dark:text-indigo-100 dark:border-indigo-800",
  ),
  violet: make(
    "violet",
    "bg-violet-400",
    "bg-violet-50 text-violet-950 border-violet-200",
    "border-violet-400",
    "dark:bg-violet-950/55 dark:text-violet-100 dark:border-violet-800",
  ),
  purple: make(
    "purple",
    "bg-purple-400",
    "bg-purple-50 text-purple-950 border-purple-200",
    "border-purple-400",
    "dark:bg-purple-950/55 dark:text-purple-100 dark:border-purple-800",
  ),
  pink: make(
    "pink",
    "bg-pink-400",
    "bg-pink-50 text-pink-950 border-pink-200",
    "border-pink-400",
    "dark:bg-pink-950/55 dark:text-pink-100 dark:border-pink-800",
  ),
  rose: make(
    "rose",
    "bg-rose-400",
    "bg-rose-50 text-rose-950 border-rose-200",
    "border-rose-400",
    "dark:bg-rose-950/55 dark:text-rose-100 dark:border-rose-800",
  ),
  red: make(
    "red",
    "bg-red-400",
    "bg-red-50 text-red-950 border-red-200",
    "border-red-400",
    "dark:bg-red-950/55 dark:text-red-100 dark:border-red-800",
  ),
  orange: make(
    "orange",
    "bg-orange-400",
    "bg-orange-50 text-orange-950 border-orange-200",
    "border-orange-400",
    "dark:bg-orange-950/55 dark:text-orange-100 dark:border-orange-800",
  ),
  amber: make(
    "amber",
    "bg-amber-400",
    "bg-amber-50 text-amber-950 border-amber-200",
    "border-amber-400",
    "dark:bg-amber-950/55 dark:text-amber-100 dark:border-amber-800",
  ),
  yellow: make(
    "yellow",
    "bg-yellow-400",
    "bg-yellow-50 text-yellow-950 border-yellow-200",
    "border-yellow-400",
    "dark:bg-yellow-950/55 dark:text-yellow-100 dark:border-yellow-800",
  ),
  green: make(
    "green",
    "bg-green-400",
    "bg-green-50 text-green-950 border-green-200",
    "border-green-400",
    "dark:bg-green-950/55 dark:text-green-100 dark:border-green-800",
  ),
  emerald: make(
    "emerald",
    "bg-emerald-400",
    "bg-emerald-50 text-emerald-950 border-emerald-200",
    "border-emerald-400",
    "dark:bg-emerald-950/55 dark:text-emerald-100 dark:border-emerald-800",
  ),
  teal: make(
    "teal",
    "bg-teal-400",
    "bg-teal-50 text-teal-950 border-teal-200",
    "border-teal-400",
    "dark:bg-teal-950/55 dark:text-teal-100 dark:border-teal-800",
  ),
  cyan: make(
    "cyan",
    "bg-cyan-400",
    "bg-cyan-50 text-cyan-950 border-cyan-200",
    "border-cyan-400",
    "dark:bg-cyan-950/55 dark:text-cyan-100 dark:border-cyan-800",
  ),
  sky: make(
    "sky",
    "bg-sky-400",
    "bg-sky-50 text-sky-950 border-sky-200",
    "border-sky-400",
    "dark:bg-sky-950/55 dark:text-sky-100 dark:border-sky-800",
  ),
  slate: make(
    "slate",
    "bg-slate-400",
    "bg-slate-100 text-slate-900 border-slate-300",
    "border-slate-500",
    "dark:bg-slate-800/70 dark:text-slate-100 dark:border-slate-600",
  ),
};

/** Narrow an arbitrary stored string to a palette key, or null when unknown. */
export function asTimelineColorKey(value: string | null | undefined): TimelineColorKey | null {
  if (!value) return null;
  return (TIMELINE_COLOR_KEYS as readonly string[]).includes(value)
    ? (value as TimelineColorKey)
    : null;
}

export function timelineColor(key: TimelineColorKey): TimelineColor {
  return TIMELINE_COLORS[key];
}

/**
 * Fallback tone when a block has no stored colour: derived from the block
 * kind so the grid still reads as an organised schedule even for blocks
 * created before colours existed.
 */
const KIND_FALLBACK: Record<string, TimelineColorKey> = {
  focus: "indigo",
  task: "blue",
  meeting: "purple",
  study: "violet",
  routine: "emerald",
  habit: "teal",
  personal: "orange",
  break: "green",
  review: "amber",
  planning: "cyan",
  admin: "slate",
  other: "slate",
};

export function resolveActivityColor(
  stored: string | null | undefined,
  kind: string,
): TimelineColorKey {
  return asTimelineColorKey(stored) ?? KIND_FALLBACK[kind] ?? "slate";
}
