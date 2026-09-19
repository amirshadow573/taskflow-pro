import {
  isLeapJalaaliYear,
  jalaaliMonthLength,
  toGregorian,
  toJalaali,
  type JalaaliDate,
} from "jalaali-js";

export type { JalaaliDate };

export const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** Convert Latin digits to Persian digits. */
export function toFa(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/** Convert Persian/Arabic digits to a Latin string (for parsing input). */
export function toEn(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** Pad a number to two digits (Latin). */
export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Stable YYYY-MM-DD key (Gregorian, local) used for per-day records. */
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

/** Jalali {jy,jm,jd} for a JS Date (local). */
export function toJalaliDate(d: Date): JalaaliDate {
  return toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** JS Date (local midnight) for a Jalali date. */
export function fromJalali(jy: number, jm: number, jd: number): Date {
  const g = toGregorian(jy, jm, jd);
  return new Date(g.gy, g.gm - 1, g.gd);
}

/** Human-friendly Persian date, e.g. "شنبه، ۱۵ مهر ۱۴۰۴". */
export function formatJalaliFull(d: Date): string {
  const j = toJalaliDate(d);
  const wd = WEEKDAYS[persianWeekday(d)];
  return `${wd}، ${toFa(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${toFa(j.jy)}`;
}

/** Compact Persian date, e.g. "۱۵ مهر". */
export function formatJalaliShort(d: Date): string {
  const j = toJalaliDate(d);
  return `${toFa(j.jd)} ${JALALI_MONTHS[j.jm - 1]}`;
}

/** Persian month name + year, e.g. "مهر ۱۴۰۴". */
export function formatJalaliMonth(jy: number, jm: number): string {
  return `${JALALI_MONTHS[jm - 1]} ${toFa(jy)}`;
}

/** Days in a Jalali month. */
export function daysInJalaliMonth(jy: number, jm: number): number {
  return jalaaliMonthLength(jy, jm);
}

export function isLeapJalaliYear(jy: number): boolean {
  return isLeapJalaaliYear(jy);
}

export type MonthCell =
  | { type: "empty" }
  | { type: "day"; date: Date; key: string };

/** Build a Saturday-first grid of days for the Jalali month containing `d`. */
export function jalaliMonthGrid(d: Date): MonthCell[] {
  const y = d.getFullYear();
  const m = d.getMonth();
  const first = new Date(y, m, 1);
  const days = new Date(y, m + 1, 0).getDate();
  const leading = persianWeekday(first);

  const cells: MonthCell[] = [];
  for (let i = 0; i < leading; i++) cells.push({ type: "empty" });
  for (let day = 1; day <= days; day++) {
    const date = new Date(y, m, day);
    cells.push({ type: "day", date, key: dateKey(date) });
  }
  return cells;
}

/** Percentage clamped to 0..100. */
export function clampPercent(p: number): number {
  if (!Number.isFinite(p) || p < 0) return 0;
  return Math.min(100, Math.round(p));
}
