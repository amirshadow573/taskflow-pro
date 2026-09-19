/** Color system for task sets (routines). Each set gets a distinct hue. */

export const COLOR_KEYS = [
  "blue",
  "emerald",
  "amber",
  "rose",
  "violet",
  "cyan",
] as const;

export type ColorKey = (typeof COLOR_KEYS)[number];

export const COLOR_LABELS: Record<ColorKey, string> = {
  blue: "آبی",
  emerald: "سبز",
  amber: "کهربایی",
  rose: "رز",
  violet: "بنفش",
  cyan: "فیروزه‌ای",
};

/** Text/icon color class per key. */
export const COLOR_TEXT: Record<ColorKey, string> = {
  blue: "text-blue-600",
  emerald: "text-emerald-600",
  amber: "text-amber-600",
  rose: "text-rose-600",
  violet: "text-violet-600",
  cyan: "text-cyan-600",
};

/** Solid background chip (for dots/swatches). */
export const COLOR_BG: Record<ColorKey, string> = {
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  cyan: "bg-cyan-500",
};

/** Soft translucent background tint. */
export const COLOR_SOFT: Record<ColorKey, string> = {
  blue: "bg-blue-500/10",
  emerald: "bg-emerald-500/10",
  amber: "bg-amber-500/10",
  rose: "bg-rose-500/10",
  violet: "bg-violet-500/10",
  cyan: "bg-cyan-500/10",
};

/** Border color for soft outlines. */
export const COLOR_BORDER: Record<ColorKey, string> = {
  blue: "border-blue-400/40",
  emerald: "border-emerald-400/40",
  amber: "border-amber-400/40",
  rose: "border-rose-400/40",
  violet: "border-violet-400/40",
  cyan: "border-cyan-400/40",
};

/** Raw hex (for inline styles where Tailwind can't compile dynamic classes). */
export const COLOR_HEX: Record<ColorKey, string> = {
  blue: "#3b82f6",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  violet: "#8b5cf6",
  cyan: "#06b6d4",
};

export function isColorKey(key: string): key is ColorKey {
  return (COLOR_KEYS as readonly string[]).includes(key);
}

export function colorOf(key: string): ColorKey {
  return isColorKey(key) ? key : "blue";
}

/** Pick the next color key in sequence. */
export function nextColorKey(current: string): ColorKey {
  const idx = (COLOR_KEYS as readonly string[]).indexOf(current);
  return COLOR_KEYS[(idx + 1) % COLOR_KEYS.length] ?? "blue";
}
