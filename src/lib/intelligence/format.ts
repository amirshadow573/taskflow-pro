/**
 * Persian formatting helpers for the intelligence layer.
 *
 * Kept local to `src/lib/intelligence` so the pure engine never has to import
 * from the component tree (no lib → components dependency), while every
 * surface still words numbers, hours and dates identically.
 */
import { formatJalaliShort, toFa } from "@/lib/persian";

/** "< 60 → ۴۵ دقیقه", otherwise "۱٫۵ ساعت" (rounded to half hours). */
export function hoursFa(minutes: number | null | undefined): string {
  if (minutes == null || Number.isNaN(minutes)) return "—";
  if (minutes < 60) return `${toFa(Math.round(minutes))} دقیقه`;
  const h = Math.round(minutes / 30) / 2;
  return `${toFa(h)} ساعت`;
}

/** Exact Persian duration — "۱ ساعت و ۳۰ دقیقه". */
export function minutesFa(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 60) return `${toFa(rounded)} دقیقه`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m > 0 ? `${toFa(h)} ساعت و ${toFa(m)} دقیقه` : `${toFa(h)} ساعت`;
}

/** 0..1 (or null) → "۸۲٪". */
export function ratioPctFa(ratio: number | null | undefined): string {
  if (ratio == null || Number.isNaN(ratio)) return "—";
  return `${toFa(Math.round(ratio * 100))}٪`;
}

/** 0..100 (or null) → "۸۲٪". */
export function pctFa(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(pct)) return "—";
  return `${toFa(Math.round(pct))}٪`;
}

export function countFa(value: number): string {
  return toFa(value);
}

/** Signed percentage for a trend, e.g. "+۲۳٪" / "−۱۲٪". */
export function signedPctFa(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(pct)) return "—";
  const sign = pct >= 0 ? "+" : "−";
  return `${sign}${toFa(Math.abs(Math.round(pct)))}٪`;
}

/**
 * Deliverable status → Persian label.
 *
 * The freelancer workspace stores a status, not a percentage; the intelligence
 * layer therefore REPORTS the status instead of inventing progress (§39 — never
 * fabricate analytics).
 */
export const DELIVERABLE_STATUS_LABELS_FA: Record<string, string> = {
  pending: "در انتظار",
  in_progress: "در حال انجام",
  delivered: "تحویل شده",
  revised: "بازنگری",
  approved: "تأیید شده",
};

export function deliverableStatusFa(status: string): string {
  return DELIVERABLE_STATUS_LABELS_FA[status] ?? status;
}

/** Gregorian day key → short Jalali label ("۱۵ مهر"). */
export function dayFa(day: string): string {
  return formatJalaliShort(new Date(`${day}T00:00:00`));
}
