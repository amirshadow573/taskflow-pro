import { toFa, toJalaliDate, JALALI_MONTHS } from "@/lib/persian";

/* ------------------------------------------------------------------ */
/* Priority & status maps                                              */
/* ------------------------------------------------------------------ */

export const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 } as const;
export type Priority = keyof typeof PRIORITY_ORDER;

export const STATUS_ORDER = {
  inbox: 0,
  todo: 1,
  in_progress: 2,
  review: 3,
  done: 4,
} as const;
export type Status = keyof typeof STATUS_ORDER;

/* ------------------------------------------------------------------ */
/* Natural-language smart task input (Persian)                         */
/* ------------------------------------------------------------------ */

const DAY_PATTERNS: Array<[RegExp, number]> = [
  [/امروز/, 0],
  [/فردا/, 1],
  [/پس\s?فردا/, 2],
];

const WEEKDAY_MAP: Record<string, number> = {
  "شنبه": 0,
  "یکشنبه": 1,
  "دوشنبه": 2,
  "سه شنبه": 3,
  "سه‌شنبه": 3,
  "چهارشنبه": 4,
  "پنجشنبه": 5,
  "جمعه": 6,
};

export interface ParsedTask {
  title: string;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  priority?: Priority;
  tags: string[];
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function dateKeyOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Parses a Persian natural-language task string.
 * Supported: امروز/فردا/پس‌فردا, weekday names, "تا X ساعت" / "ساعت X",
 * priorities (#فوری / مهم), and #تگ.
 */
export function parseSmartInput(input: string): ParsedTask {
  let text = ` ${input.trim()} `;
  const result: ParsedTask = { title: "", tags: [] };

  // Extract #tags (keep Persian + latin)
  text = text.replace(/#([\p{L}\p{N}_-]+)/gu, (_m, tag: string) => {
    result.tags.push(tag);
    return " ";
  });

  // Priority keywords
  if (/\bفوری\b/.test(text)) {
    result.priority = "urgent";
    text = text.replace(/\bفوری\b/, " ");
  } else if (/\bمهم\b/.test(text)) {
    result.priority = "high";
    text = text.replace(/\bمهم\b/, " ");
  } else if (/\bکم\s?اهمیت\b/.test(text)) {
    result.priority = "low";
    text = text.replace(/\bکم\s?اهمیت\b/, " ");
  }

  // Relative days
  let matched = false;
  for (const [re, offset] of DAY_PATTERNS) {
    if (re.test(text)) {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      result.dueDate = dateKeyOf(d);
      text = text.replace(re, " ");
      matched = true;
      break;
    }
  }

  // Weekday names → next occurrence
  if (!matched) {
    for (const [name, target] of Object.entries(WEEKDAY_MAP)) {
      if (text.includes(name)) {
        const today = new Date();
        const diff = (target - ((today.getDay() + 1) % 7) + 7) % 7 || 7;
        const d = new Date();
        d.setDate(d.getDate() + diff);
        result.dueDate = dateKeyOf(d);
        text = text.replace(name, " ");
        break;
      }
    }
  }

  // Explicit date ۱۴۰۳/۰۷/۱۴ or 2025-10-06
  const jalaliMatch = text.match(/\b1[34]\d{2}\/\d{1,2}\/\d{1,2}\b/);
  if (jalaliMatch) text = text.replace(jalaliMatch[0], " ");

  // Time: ساعت ۱۰ صبح / ۱۰:۳۰ / تا ۳ عصر
  const timeMatch = text.match(
    /(?:ساعت\s*)?(\d{1,2})(?::(\d{2}))?\s*(صبح|ظهر|عصر|شب)?(?=\s*(?:تا|باید|میخوام|می‌خوام)|$)/,
  );
  if (timeMatch && /(ساعت|\d{1,2}:\d{2})/.test(timeMatch[0])) {
    let hour = Number(timeMatch[1]);
    const minute = timeMatch[2] ? Number(timeMatch[2]) : 0;
    const period = timeMatch[3];
    if (period === "عصر" || period === "شب") {
      if (hour < 12) hour += 12;
    } else if (period === "ظهر" && hour < 12) {
      hour += 12;
    }
    if (hour >= 0 && hour <= 23) {
      result.dueTime = `${pad(hour)}:${pad(minute)}`;
    }
    text = text.replace(timeMatch[0], " ");
  }

  result.title = text.replace(/\s+/g, " ").trim();
  if (!result.title) result.title = input.trim();
  return result;
}

/* ------------------------------------------------------------------ */
/* Date helpers                                                        */
/* ------------------------------------------------------------------ */

export function todayKey(): string {
  return dateKeyOf(new Date());
}

export function addDaysKey(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return dateKeyOf(d);
}

export function isOverdue(task: { dueDate?: string; status: string }): boolean {
  if (!task.dueDate || task.status === "done") return false;
  return task.dueDate < todayKey();
}

export function formatDueFa(key: string): string {
  const today = todayKey();
  if (key === today) return "امروز";
  if (key === addDaysKey(1)) return "فردا";
  if (key === addDaysKey(-1)) return "دیروز";
  const d = new Date(key + "T00:00:00");
  return toFa(`${toJalaliDate(d).jd} ${JALALI_MONTHS[toJalaliDate(d).jm - 1]}`);
}

export function monthKeysOf(year: number, month: number): string[] {
  // month: 1-12
  const days = new Date(year, month, 0).getDate();
  const keys: string[] = [];
  for (let d = 1; d <= days; d++) {
    keys.push(`${year}-${pad(month)}-${pad(d)}`);
  }
  return keys;
}
