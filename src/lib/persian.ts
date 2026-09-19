import jalaali from "jalaali-js";

export const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** Convert Latin digits to Persian digits. */
export function toFa(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/** Convert Persian/Arabic digits to Latin. */
export function toEn(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** Pad a number to two digits (Latin). */
export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Stable YYYY-MM-DD key (Gregorian) used for per-day records. */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

/** Persian weekday names, Saturday-first like the Persian calendar. */
export const WEEKDAYS = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
];

/** Short weekday labels for grid headers (شنبه first). */
export const WEEKDAYS_SHORT = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

/** Index in 0..6 (Sat=0 ... Fri=6). */
export function persianWeekday(d: Date): number {
  // getDay(): Sun=0..Sat=6  →  Sat=0..Fri=6
  return (d.getDay() + 1) % 7;
}

/** Human-friendly Persian date, e.g. "شنبه، ۱۵ مهر ۱۴۰۴". */
export function formatJalaliFull(d: Date): string {
  const j = jalaali.toJalaali(d);
  const wd = WEEKDAYS[persianWeekday(d)];
  return `${wd}، ${toFa(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${toFa(j.jy)}`;
}

/** Compact Persian date, e.g. "۱۵ مهر". */
export function formatJalaliShort(d: Date): string {
  const j = jalaali.toJalaali(d);
  return `${toFa(j.jd)} ${JALALI_MONTHS[j.jm - 1]}`;
}

/** Persian month name + year, e.g. "مهر ۱۴۰۴". */
export function formatJalaliMonth(jy: number, jm: number): string {
  return `${JALALI_MONTHS[jm - 1]} ${toFa(jy)}`;
}

/** Number of days in a Jalali month. */
export function jalaliMonthLength(jy: number, jm: number): number {
  return jalaali.jalaaliMonthLength(jy, jm);
}

/** Days in a Gregorian month (with leap handling). */
export function gregorianDaysInMonth(year: number, month: number): number {
  // month is 1-indexed
  return new Date(year, month, 0).getDate();
}

export type MonthCell =
  | { type: "empty" }
  | { type: "day"; date: Date; key: string };

/**
 * Build a Saturday-first grid of days for the Jalali month that contains
 * `date`. Empty leading cells pad the grid so weekday columns line up.
 */
export function jalaliMonthGrid(date: Date): MonthCell[] {
  const y = date.getFullYear();
  const m = date.getMonth();
  const first = new Date(y, m, 1);
  const days = new Date(y, m + 1, 0).getDate();
  const leading = persianWeekday(first);

  const cells: MonthCell[] = [];
  for (let i = 0; i < leading; i++) cells.push({ type: "empty" });
  for (let d = 1; d <= days; d++) {
    const date2 = new Date(y, m, d);
    cells.push({ type: "day", date: date2, key: dateKey(date2) });
  }
  return cells;
}

/** Percentage clamped to 0..100. */
export function clampPercent(p: number): number {
  if (!Number.isFinite(p) || p < 0) return 0;
  return Math.min(100, Math.round(p));
}
