/**
 * Phase 15 — action validation (§8, §10, §11, §16, §34).
 *
 * This is the ONLY place where an AI-produced object is allowed to become an
 * application action. It is pure, total (never throws) and runs BEFORE the user
 * ever sees a proposal, so the UI only ever renders already-checked data.
 *
 * What it guarantees:
 *  - Only the closed `AIActionType` vocabulary survives (§10).
 *  - Level-4 / destructive shapes are refused outright (§11).
 *  - Every field is range- and format-checked; unknown keys are dropped, not
 *    merged (prompt-injection resistance: a file/response cannot smuggle a
 *    field the app does not understand).
 *  - Text is length-capped so one enormous string cannot blow up the DB.
 *
 * Ownership is deliberately NOT checked here — that needs the database and
 * lives in src/convex/ai.ts, which re-verifies every id before writing.
 */
import {
  AI_MAX_ACTIONS,
  DAY_RE,
  TASK_PRIORITIES,
  TIME_BLOCK_KINDS,
  TIME_RE,
  type AIAction,
  type AIActionType,
  type AISafetyLevel,
  type ActionPlan,
  type TaskPriority,
  type TimeBlockKind,
  type ValidatedAction,
} from "./types";

/* ------------------------------------------------------------------ */
/* Allowlist + safety table                                            */
/* ------------------------------------------------------------------ */

export const ACTION_TYPES = [
  "create_task",
  "update_task",
  "complete_task",
  "reschedule_task",
  "change_priority",
  "create_project",
  "update_project",
  "create_goal",
  "update_goal",
  "create_time_block",
  "move_time_block",
  "create_routine",
  "create_note",
] as const satisfies readonly AIActionType[];

export type KnownActionType = (typeof ACTION_TYPES)[number];

const SAFETY: Record<KnownActionType, AISafetyLevel> = {
  create_task: 2,
  update_task: 3,
  complete_task: 2,
  reschedule_task: 3,
  change_priority: 3,
  create_project: 2,
  update_project: 3,
  create_goal: 2,
  update_goal: 3,
  create_time_block: 2,
  move_time_block: 3,
  create_routine: 2,
  create_note: 2,
};

/** Human label for the action type, used in the confirmation list. */
export const ACTION_VERBS_FA: Record<KnownActionType, string> = {
  create_task: "ساخت کار",
  update_task: "ویرایش کار",
  complete_task: "تکمیل کار",
  reschedule_task: "جابه‌جایی کار",
  change_priority: "تغییر اولویت",
  create_project: "ساخت پروژه",
  update_project: "ویرایش پروژه",
  create_goal: "ساخت هدف",
  update_goal: "به‌روزرسانی هدف",
  create_time_block: "افزودن بلوک زمانی",
  move_time_block: "جابه‌جایی بلوک زمانی",
  create_routine: "ساخت روتین",
  create_note: "ثبت یادداشت",
};

const PRIORITY_FA: Record<TaskPriority, string> = {
  low: "کم",
  medium: "متوسط",
  high: "زیاد",
  urgent: "فوری",
};

export function priorityLabelFa(p: TaskPriority): string {
  return PRIORITY_FA[p];
}

export function isKnownActionType(t: unknown): t is KnownActionType {
  return typeof t === "string" && (ACTION_TYPES as readonly string[]).includes(t);
}

export function safetyFor(type: AIActionType): AISafetyLevel {
  return SAFETY[type as KnownActionType] ?? 3;
}

/* ------------------------------------------------------------------ */
/* Field helpers — all total, all length-capped                        */
/* ------------------------------------------------------------------ */

const MAX_TITLE = 160;
const MAX_BODY = 4_000;
const MAX_REASON = 300;
const MAX_TAGS = 12;

function str(v: unknown, max = MAX_TITLE): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return undefined;
  return t.length > max ? t.slice(0, max) : t;
}

function num(v: unknown, min: number, max: number): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  return Math.min(max, Math.max(min, Math.round(v)));
}

/**
 * Shape is not enough: "2026-13-45" matches the regex but is not a real date,
 * and a garbage dueDate silently breaks every downstream comparison
 * (planning buckets, deadline maths, insights). Round-trip through Date to
 * prove the calendar agrees.
 */
function isRealDay(s: string): boolean {
  if (!DAY_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

function day(v: unknown): string | undefined {
  const s = str(v, 10);
  return s && isRealDay(s) ? s : undefined;
}

function time(v: unknown): string | undefined {
  const s = str(v, 5);
  return s && TIME_RE.test(s) ? s : undefined;
}

function priority(v: unknown): TaskPriority | undefined {
  return typeof v === "string" && (TASK_PRIORITIES as readonly string[]).includes(v)
    ? (v as TaskPriority)
    : undefined;
}

function kind(v: unknown): TimeBlockKind | undefined {
  return typeof v === "string" && (TIME_BLOCK_KINDS as readonly string[]).includes(v)
    ? (v as TimeBlockKind)
    : undefined;
}

function id(v: unknown): string | undefined {
  const s = str(v, 64);
  if (!s || !/^[a-zA-Z0-9_:-]+$/.test(s)) return undefined;
  return s;
}

/** Persian digits are accepted from a model and normalized for our enums. */
function normalizePriorityToken(v: unknown): TaskPriority | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim().toLowerCase();
  const direct = priority(t);
  if (direct) return direct;
  const fa: Record<string, TaskPriority> = {
    کم: "low",
    پایین: "low",
    متوسط: "medium",
    متوسط_نرمال: "medium",
    عادی: "medium",
    زیاد: "high",
    بالا: "high",
    فوری: "urgent",
    خیلی_مهم: "urgent",
  };
  return fa[t];
}

/* ------------------------------------------------------------------ */
/* Per-type validation                                                 */
/* ------------------------------------------------------------------ */

function validateOne(raw: unknown): { action?: AIAction; issues: string[] } {
  const issues: string[] = [];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { issues: ["ساختار پیشنهاد معتبر نیست."] };
  }
  const r = raw as Record<string, unknown>;
  const type = r.type;

  if (!isKnownActionType(type)) {
    return { issues: ["نوع اقدام شناخته‌شده نیست و نادیده گرفته شد."] };
  }
  const t = type;

  const reason = str(r.reason, MAX_REASON) ?? "";
  if (!reason) issues.push("دلیل پیشنهاد ارائه نشده بود.");

  const base = { reason };

  switch (t) {
    /* ---- tasks ---- */
    case "create_task": {
      const title = str(r.title);
      if (!title) return { issues: ["عنوان کار خالی است."] };
      return {
        action: {
          ...base,
          type: t,
          title,
          description: str(r.description, MAX_BODY),
          priority: normalizePriorityToken(r.priority),
          due_date: day(r.due_date ?? r.dueDate),
          project_id: id(r.project_id ?? r.projectId),
          estimate_minutes: num(r.estimate_minutes ?? r.estimateMinutes, 5, 12 * 60),
        },
        issues,
      };
    }
    case "update_task": {
      const target = id(r.target_id ?? r.task_id ?? r.id);
      if (!target) return { issues: ["شناسهٔ کار معتبر نیست."] };
      const title = str(r.title);
      const description = str(r.description, MAX_BODY);
      if (!title && !description) {
        return { issues: ["هیچ تغییری برای اعمال پیشنهاد نشده بود."] };
      }
      return { action: { ...base, type: t, target_id: target, title, description }, issues };
    }
    case "complete_task": {
      const target = id(r.target_id ?? r.task_id ?? r.id);
      if (!target) return { issues: ["شناسهٔ کار معتبر نیست."] };
      return { action: { ...base, type: t, target_id: target }, issues };
    }
    case "reschedule_task": {
      const target = id(r.target_id ?? r.task_id ?? r.id);
      const d = day(r.target_date ?? r.date ?? r.due_date);
      if (!target) return { issues: ["شناسهٔ کار معتبر نیست."] };
      if (!d) return { issues: ["تاریخ مقصد معتبر نیست."] };
      return { action: { ...base, type: t, target_id: target, target_date: d }, issues };
    }
    case "change_priority": {
      const target = id(r.target_id ?? r.task_id ?? r.id);
      const p = normalizePriorityToken(r.priority);
      if (!target) return { issues: ["شناسهٔ کار معتبر نیست."] };
      if (!p) return { issues: ["اولویت درخواستی شناخته‌شده نیست."] };
      return { action: { ...base, type: t, target_id: target, priority: p }, issues };
    }

    /* ---- projects ---- */
    case "create_project": {
      const name = str(r.name ?? r.title);
      if (!name) return { issues: ["نام پروژه خالی است."] };
      return {
        action: {
          ...base,
          type: t,
          name,
          description: str(r.description, MAX_BODY),
          deadline: day(r.deadline),
        },
        issues,
      };
    }
    case "update_project": {
      const target = id(r.target_id ?? r.project_id ?? r.id);
      if (!target) return { issues: ["شناسهٔ پروژه معتبر نیست."] };
      const name = str(r.name ?? r.title);
      const description = str(r.description, MAX_BODY);
      const deadline = day(r.deadline);
      if (!name && !description && !deadline) {
        return { issues: ["هیچ تغییری برای اعمال پیشنهاد نشده بود."] };
      }
      return { action: { ...base, type: t, target_id: target, name, description, deadline }, issues };
    }

    /* ---- goals ---- */
    case "create_goal": {
      const title = str(r.title);
      if (!title) return { issues: ["عنوان هدف خالی است."] };
      return {
        action: {
          ...base,
          type: t,
          title,
          description: str(r.description, MAX_BODY),
          due_date: day(r.due_date ?? r.dueDate),
        },
        issues,
      };
    }
    case "update_goal": {
      const target = id(r.target_id ?? r.goal_id ?? r.id);
      if (!target) return { issues: ["شناسهٔ هدف معتبر نیست."] };
      const progress = num(r.progress, 0, 100);
      const status =
        r.status === "active" || r.status === "paused" || r.status === "completed"
          ? r.status
          : undefined;
      if (progress === undefined && !status) {
        return { issues: ["هیچ تغییری برای اعمال پیشنهاد نشده بود."] };
      }
      return { action: { ...base, type: t, target_id: target, progress, status }, issues };
    }

    /* ---- schedule ---- */
    case "create_time_block": {
      const title = str(r.title);
      const d = day(r.day ?? r.date);
      const start = time(r.start_time ?? r.startTime ?? r.start);
      const end = time(r.end_time ?? r.endTime ?? r.end);
      if (!title) return { issues: ["عنوان بلوک زمانی خالی است."] };
      if (!d) return { issues: ["روز بلوک زمانی معتبر نیست."] };
      if (!start || !end) return { issues: ["ساعت شروع یا پایان معتبر نیست."] };
      if (end <= start) {
        return { issues: ["ساعت پایان باید بعد از ساعت شروع باشد."] };
      }
      return {
        action: {
          ...base,
          type: t,
          title,
          day: d,
          start_time: start,
          end_time: end,
          kind: kind(r.kind),
          task_id: id(r.task_id ?? r.taskId),
          project_id: id(r.project_id ?? r.projectId),
        },
        issues,
      };
    }
    case "move_time_block": {
      const target = id(r.target_id ?? r.block_id ?? r.id);
      const d = day(r.day ?? r.date);
      const start = time(r.start_time ?? r.startTime ?? r.start);
      const end = time(r.end_time ?? r.endTime ?? r.end);
      if (!target) return { issues: ["شناسهٔ بلوک معتبر نیست."] };
      if (!d) return { issues: ["روز مقصد معتبر نیست."] };
      if (!start || !end) return { issues: ["ساعت شروع یا پایان معتبر نیست."] };
      if (end <= start) {
        return { issues: ["ساعت پایان باید بعد از ساعت شروع باشد."] };
      }
      return {
        action: { ...base, type: t, target_id: target, day: d, start_time: start, end_time: end },
        issues,
      };
    }

    /* ---- routines & notes ---- */
    case "create_routine": {
      const title = str(r.title ?? r.name);
      if (!title) return { issues: ["عنوان روتین خالی است."] };
      return {
        action: { ...base, type: t, title, color_key: str(r.color_key ?? r.colorKey, 24) },
        issues,
      };
    }
    case "create_note": {
      const title = str(r.title);
      const body = str(r.body ?? r.content, MAX_BODY);
      if (!title) return { issues: ["عنوان یادداشت خالی است."] };
      if (!body) return { issues: ["متن یادداشت خالی است."] };
      const tags = Array.isArray(r.tags)
        ? r.tags
            .map((x) => str(x, 32))
            .filter((x): x is string => Boolean(x))
            .slice(0, MAX_TAGS)
        : undefined;
      return { action: { ...base, type: t, title, body, tags }, issues };
    }

    default:
      return { issues: ["نوع اقدام پشتیبانی نمی‌شود."] };
  }
}

/* ------------------------------------------------------------------ */
/* Labels                                                              */
/* ------------------------------------------------------------------ */

/** A short Persian "what will happen" line for the confirmation UI. */
export function describeActionFa(action: AIAction): { label: string; detail?: string } {
  const verb = ACTION_VERBS_FA[action.type as KnownActionType];
  switch (action.type) {
    case "create_task":
      return { label: `${verb}: «${action.title}»`, detail: action.due_date ? `سررسید ${action.due_date}` : undefined };
    case "create_time_block":
      return {
        label: `${verb}: «${action.title}»`,
        detail: `${action.day} — ${action.start_time} تا ${action.end_time}`,
      };
    case "move_time_block":
      return { label: verb, detail: `${action.day} — ${action.start_time} تا ${action.end_time}` };
    case "reschedule_task":
      return { label: verb, detail: `تاریخ جدید: ${action.target_date}` };
    case "change_priority":
      return { label: verb, detail: `اولویت جدید: ${priorityLabelFa(action.priority)}` };
    case "complete_task":
      return { label: verb };
    case "create_routine":
      return { label: `${verb}: «${action.title}»` };
    case "create_project":
      return { label: `${verb}: «${action.name}»` };
    case "create_goal":
      return { label: `${verb}: «${action.title}»` };
    case "create_note":
      return { label: `${verb}: «${action.title}»` };
    case "update_goal":
      return {
        label: verb,
        detail:
          action.progress !== undefined
            ? `پیشرفت: ${action.progress}٪`
            : action.status
              ? `وضعیت: ${action.status}`
              : undefined,
      };
    case "update_task":
    case "update_project":
      return { label: verb };
    default:
      return { label: verb };
  }
}

/* ------------------------------------------------------------------ */
/* Public entry point                                                  */
/* ------------------------------------------------------------------ */

/**
 * Turn a raw, untrusted `actions` array into a validated plan.
 *
 * Never throws. Malformed entries are dropped and counted, never "fixed"
 * silently — a proposal we had to reinterpret is a proposal the user should
 * not trust as-is.
 */
export function validateActions(raw: unknown): ActionPlan {
  const out: ValidatedAction[] = [];
  let dropped = 0;

  const list = Array.isArray(raw) ? raw : [];
  const capped = list.slice(0, AI_MAX_ACTIONS);
  if (list.length > AI_MAX_ACTIONS) dropped += list.length - AI_MAX_ACTIONS;

  for (const item of capped) {
    const { action, issues } = validateOne(item);
    if (!action) {
      dropped += 1;
      continue;
    }
    const { label, detail } = describeActionFa(action);
    out.push({
      action,
      safety: safetyFor(action.type),
      label,
      detail,
      issues,
      applicable: true,
    });
  }

  const maxSafety = out.reduce<AISafetyLevel>(
    (m, a) => (a.safety > m ? a.safety : m),
    1,
  );

  return { actions: out, maxSafety, droppedCount: dropped };
}
