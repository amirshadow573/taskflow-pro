/**
 * Phase 14 — Automation Rules (the ONE definition layer for the
 * Smart Workflow & Automation Engine).
 *
 * Everything in this file is pure and deterministic: catalogs, condition
 * evaluation, validation, schedule math and templates. It is imported by BOTH
 * the Convex engine (src/convex/automations.ts) and the builder UI, so the
 * builder, the validator, the dry-run preview and the runtime can never drift
 * apart — the same rule objects flow through all of them.
 *
 * Design rules:
 *  - No DB access, no side effects, no Date.now() inside evaluation helpers
 *    (time is always passed in) → fully testable.
 *  - Every catalog entry maps to REAL data that exists in the schema. No
 *    invented fields, no speculative triggers.
 *  - Times are evaluated in a FIXED offset captured from the owner's device
 *    (automations.tzOffsetMinutes) so a schedule like «شنبه ساعت ۰۸:۰۰» fires
 *    at the same wall-clock time for the user regardless of server UTC.
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type AutomationTriggerKind = "event" | "state" | "time";

/** Which entity a trigger/condition/action operates on. */
export type AutomationEntity =
  | "task"
  | "project"
  | "goal"
  | "exam"
  | "deliverable"
  | "invoice"
  | "opportunity"
  | "block"
  | "execution"
  | "progress"
  | "any";

export type ConditionOp = "eq" | "neq" | "gte" | "lte" | "contains";

export type ConfigValue = string | number | boolean | string[] | number[] | undefined;

export interface TriggerField {
  key: string;
  label: string;
  type: "time" | "date" | "number" | "weekday" | "select" | "text";
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  default?: ConfigValue;
  help?: string;
  required?: boolean;
}

/** Date sources for «N روز قبل از …» style triggers — all real tables. */
export type DateSourceKey =
  | "exam"
  | "project_deadline"
  | "task_due"
  | "deliverable_due"
  | "invoice_due"
  | "opportunity_close";

export interface TriggerDef {
  key: string;
  kind: AutomationTriggerKind;
  /** Friendly Persian name — the WHEN row in the builder. */
  label: string;
  description: string;
  /** Entity the snapshot provides to conditions/actions. */
  entity: AutomationEntity;
  fields: TriggerField[];
  /** Only for date-source triggers (kind state/time with a source). */
  source?: DateSourceKey;
  /** "before" = days ahead of the date, "after" = the date has passed. */
  mode?: "before" | "after";
}

export interface ConditionFieldDef {
  key: string;
  label: string;
  type: "string" | "number" | "boolean";
  ops: ConditionOp[];
  options?: Array<{ value: string; label: string }>;
  /** Extra builder hint shown under the field. */
  help?: string;
  /** Entities this field exists on ("persona" = always available). */
  entities: AutomationEntity[];
}

export interface ActionField {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "time" | "date" | "select" | "project" | "boolean";
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  default?: ConfigValue;
  required?: boolean;
  help?: string;
}

export interface ActionDef {
  key: string;
  label: string;
  description: string;
  /** low = additive/reversible, medium = edits existing data, destructive = never automated. */
  risk: "low" | "medium" | "destructive";
  fields: ActionField[];
  /** When set, the action needs a snapshot of this entity. */
  needsEntity?: AutomationEntity[];
}

export interface AutomationTrigger {
  kind: AutomationTriggerKind;
  key: string;
  config?: Record<string, ConfigValue>;
}

export interface AutomationCondition {
  field: string;
  op: ConditionOp;
  value: string | number | boolean | string[];
}

export interface AutomationAction {
  key: string;
  config?: Record<string, ConfigValue>;
}

export interface AutomationDefinition {
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
}

/** Flat snapshot of the triggering object handed to conditions/actions. */
export type EntitySnapshot = Record<string, ConfigValue> & {
  entity: AutomationEntity;
  id: string;
  title: string;
  persona: string;
};

/* ------------------------------------------------------------------ */
/* Trigger catalog (§4–§5)                                             */
/* ------------------------------------------------------------------ */

const PRIORITY_OPTIONS = [
  { value: "low", label: "کم" },
  { value: "medium", label: "متوسط" },
  { value: "high", label: "زیاد" },
  { value: "urgent", label: "فوری" },
];

export const AUTOMATION_TRIGGERS: Record<string, TriggerDef> = {
  /* ── Event triggers (fired from the mutation that produced the event) ── */
  task_created: {
    key: "task_created",
    kind: "event",
    entity: "task",
    label: "کار جدیدی ساخته می‌شود",
    description: "وقتی از هر مسیری یک کار تازه ایجاد شود.",
    fields: [],
  },
  task_updated: {
    key: "task_updated",
    kind: "event",
    entity: "task",
    label: "کاری تغییر می‌کند",
    description: "وضعیت، اولویت یا سررسید یک کار عوض می‌شود.",
    fields: [],
  },
  task_completed: {
    key: "task_completed",
    kind: "event",
    entity: "task",
    label: "کاری تمام می‌شود",
    description: "از چک‌باکس، پنل جزئیات یا موتور اجرا.",
    fields: [],
  },
  project_created: {
    key: "project_created",
    kind: "event",
    entity: "project",
    label: "پروژه جدیدی ساخته می‌شود",
    description: "هنگام ایجاد پروژه.",
    fields: [],
  },
  project_updated: {
    key: "project_updated",
    kind: "event",
    entity: "project",
    label: "پروژه‌ای تغییر می‌کند",
    description: "وضعیت یا سررسید پروژه عوض می‌شود.",
    fields: [],
  },
  goal_created: {
    key: "goal_created",
    kind: "event",
    entity: "goal",
    label: "هدف جدیدی ساخته می‌شود",
    description: "در هر یک از مسیرهای اهداف شخصی، کاری، تیمی یا کسب‌وکار.",
    fields: [],
  },
  goal_updated: {
    key: "goal_updated",
    kind: "event",
    entity: "goal",
    label: "هدفی به‌روزرسانی می‌شود",
    description: "پیشرفت یا وضعیت یک هدف تغییر می‌کند.",
    fields: [],
  },
  execution_completed: {
    key: "execution_completed",
    kind: "event",
    entity: "execution",
    label: "یک نشست اجرا تمام می‌شود",
    description: "پایان نشست تمرکز/کار در موتور اجرا.",
    fields: [],
  },
  focus_session_completed: {
    key: "focus_session_completed",
    kind: "event",
    entity: "execution",
    label: "جلسه تمرکز کامل ثبت می‌شود",
    description: "وقتی یک جلسه تمرکز به «کامل» تغییر می‌کند.",
    fields: [],
  },
  level_reached: {
    key: "level_reached",
    kind: "event",
    entity: "progress",
    label: "سطح جدیدی باز می‌شود",
    description: "با رسیدن به سطح بالاتر. از شرط «سطح ≥ …» استفاده کن.",
    fields: [],
  },
  achievement_unlocked: {
    key: "achievement_unlocked",
    kind: "event",
    entity: "progress",
    label: "دستاوردی باز می‌شود",
    description: "هنگام آزاد شدن یک دستاورد یا قابلیت جدید.",
    fields: [],
  },

  /* ── State triggers (evaluated by the deterministic daily/hourly sweep) ── */
  task_overdue: {
    key: "task_overdue",
    kind: "state",
    entity: "task",
    label: "کاری از سررسیدش می‌گذرد",
    description: "سررسید کار امروز یا زودتر بوده و هنوز تمام نشده است.",
    fields: [],
    source: "task_due",
    mode: "after",
  },
  task_due_soon: {
    key: "task_due_soon",
    kind: "state",
    entity: "task",
    label: "کاری نزدیک سررسید است",
    description: "چند روز مانده به سررسید کار.",
    fields: [{ key: "days", label: "چند روز قبل", type: "number", min: 1, max: 30, default: 1, required: true }],
    source: "task_due",
    mode: "before",
  },
  project_deadline_soon: {
    key: "project_deadline_soon",
    kind: "state",
    entity: "project",
    label: "سررسید پروژه نزدیک است",
    description: "چند روز مانده به ددلاین پروژه.",
    fields: [{ key: "days", label: "چند روز قبل", type: "number", min: 1, max: 90, default: 1, required: true }],
    source: "project_deadline",
    mode: "before",
  },
  project_completion_reached: {
    key: "project_completion_reached",
    kind: "state",
    entity: "project",
    label: "پروژه به درصد تکمیل می‌رسد",
    description: "درصد انجام کارهای پروژه به آستانه برسد (مثلاً ۸۰٪).",
    fields: [
      { key: "thresholdPct", label: "درصد آستانه", type: "number", min: 1, max: 100, default: 80, required: true },
    ],
  },
  goal_inactive: {
    key: "goal_inactive",
    kind: "state",
    entity: "goal",
    label: "هدفی بدون فعالیت می‌ماند",
    description: "چند روز هیچ کار مرتبطی با هدف تمام نشده باشد.",
    fields: [{ key: "days", label: "بدون فعالیت چند روز", type: "number", min: 1, max: 90, default: 7, required: true }],
  },
  exam_upcoming: {
    key: "exam_upcoming",
    kind: "state",
    entity: "exam",
    label: "آزمونی نزدیک است",
    description: "چند روز مانده به تاریخ آزمون (دانش‌آموز).",
    fields: [{ key: "days", label: "چند روز قبل", type: "number", min: 1, max: 60, default: 7, required: true }],
    source: "exam",
    mode: "before",
  },
  deliverable_overdue: {
    key: "deliverable_overdue",
    kind: "state",
    entity: "deliverable",
    label: "تحویل‌پذیر مشتری عقب می‌افتد",
    description: "سررسید تحویل گذشته و هنوز نهایی نشده (فریلنسر).",
    fields: [],
    source: "deliverable_due",
    mode: "after",
  },
  invoice_due_soon: {
    key: "invoice_due_soon",
    kind: "state",
    entity: "invoice",
    label: "فاکتور نزدیک سررسید است",
    description: "چند روز مانده به سررسید فاکتور پرداخت‌نشده (فریلنسر).",
    fields: [{ key: "days", label: "چند روز قبل", type: "number", min: 1, max: 45, default: 3, required: true }],
    source: "invoice_due",
    mode: "before",
  },
  opportunity_closing_soon: {
    key: "opportunity_closing_soon",
    kind: "state",
    entity: "opportunity",
    label: "فرصت فروش بسته می‌شود",
    description: "نزدیک تاریخ بسته‌شدن فرصت فروش باز (کسب‌وکار).",
    fields: [{ key: "days", label: "چند روز قبل", type: "number", min: 1, max: 60, default: 3, required: true }],
    source: "opportunity_close",
    mode: "before",
  },
  time_block_missed: {
    key: "time_block_missed",
    kind: "state",
    entity: "block",
    label: "بلوک زمانی از دست می‌رود",
    description: "بلوک زمانی برنامه‌ریزی‌شده گذشته و انجام نشده است.",
    fields: [],
  },

  /* ── Time triggers (pure schedule, computed in the owner's fixed offset) ── */
  time_once: {
    key: "time_once",
    kind: "time",
    entity: "any",
    label: "در یک زمان مشخص",
    description: "یک‌بار در تاریخ و ساعت انتخابی.",
    fields: [
      { key: "date", label: "تاریخ", type: "date", required: true },
      { key: "time", label: "ساعت", type: "time", default: "09:00", required: true },
    ],
  },
  time_daily: {
    key: "time_daily",
    kind: "time",
    entity: "any",
    label: "هر روز",
    description: "در ساعت انتخابی، هر روز.",
    fields: [{ key: "time", label: "ساعت", type: "time", default: "09:00", required: true }],
  },
  time_weekly: {
    key: "time_weekly",
    kind: "time",
    entity: "any",
    label: "هر هفته در روز انتخابی",
    description: "مثلاً هر دوشنبه ساعت ۰۸:۰۰ — یا هر روز هفته کاری.",
    fields: [
      {
        key: "weekday",
        label: "روز هفته",
        type: "weekday",
        required: true,
        default: 1,
        help: "یک روز، یا چند روز (روزهای هفته کاری).",
      },
      { key: "time", label: "ساعت", type: "time", default: "08:00", required: true },
    ],
  },
  time_monthly: {
    key: "time_monthly",
    kind: "time",
    entity: "any",
    label: "هر ماه",
    description: "روز مشخصی از هر ماه در ساعت انتخابی.",
    fields: [
      { key: "dayOfMonth", label: "روز ماه", type: "number", min: 1, max: 28, default: 1, required: true },
      { key: "time", label: "ساعت", type: "time", default: "09:00", required: true },
    ],
  },
};

export const TRIGGER_LIST: TriggerDef[] = Object.values(AUTOMATION_TRIGGERS);

export function triggerDef(key: string): TriggerDef | undefined {
  return AUTOMATION_TRIGGERS[key];
}

export function triggersByKind(kind: AutomationTriggerKind): TriggerDef[] {
  return TRIGGER_LIST.filter((t) => t.kind === kind);
}

/* ------------------------------------------------------------------ */
/* Condition fields (§6) — only data that exists                      */
/* ------------------------------------------------------------------ */

export const AUTOMATION_CONDITIONS: ConditionFieldDef[] = [
  {
    key: "persona",
    label: "شخصیت فعال",
    type: "string",
    ops: ["eq", "neq"],
    entities: ["any"],
    options: [
      { value: "student", label: "دانش‌آموز" },
      { value: "employee", label: "کارمند" },
      { value: "freelancer", label: "فریلنسر" },
      { value: "manager", label: "مدیر" },
      { value: "business_owner", label: "صاحب کسب‌وکار" },
      { value: "personal", label: "بهره‌وری شخصی" },
      { value: "team", label: "تیم" },
      { value: "custom", label: "سفارشی" },
    ],
  },
  {
    key: "priority",
    label: "اولویت",
    type: "string",
    ops: ["eq", "neq"],
    entities: ["task", "deliverable"],
    options: PRIORITY_OPTIONS,
  },
  {
    key: "status",
    label: "وضعیت",
    type: "string",
    ops: ["eq", "neq"],
    entities: ["task", "project", "goal", "deliverable", "invoice"],
    options: [
      { value: "inbox", label: "صندوق ورودی" },
      { value: "todo", label: "برای انجام" },
      { value: "in_progress", label: "در حال انجام" },
      { value: "review", label: "بازبینی" },
      { value: "active", label: "فعال" },
      { value: "paused", label: "متوقف" },
      { value: "completed", label: "تکمیل‌شده" },
      { value: "at_risk", label: "در معرض خطر" },
      { value: "pending", label: "در انتظار" },
      { value: "delivered", label: "تحویل‌شده" },
      { value: "approved", label: "تأییدشده" },
      { value: "sent", label: "ارسال‌شده" },
      { value: "paid", label: "پرداخت‌شده" },
      { value: "overdue", label: "عقب‌افتاده" },
    ],
  },
  {
    key: "inProject",
    label: "کار در پروژه باشد",
    type: "boolean",
    ops: ["eq"],
    entities: ["task"],
  },
  {
    key: "tag",
    label: "برچسب",
    type: "string",
    ops: ["contains", "eq", "neq"],
    entities: ["task"],
    help: "مقایسه روی برچسب‌های کار.",
  },
  {
    key: "completionPct",
    label: "درصد تکمیل پروژه",
    type: "number",
    ops: ["gte", "lte"],
    entities: ["project"],
  },
  {
    key: "daysToDeadline",
    label: "روز مانده به سررسید",
    type: "number",
    ops: ["lte", "gte"],
    entities: ["project", "exam", "invoice", "opportunity", "deliverable", "task"],
  },
  {
    key: "progress",
    label: "درصد پیشرفت هدف",
    type: "number",
    ops: ["gte", "lte"],
    entities: ["goal"],
  },
  {
    key: "inactiveDays",
    label: "روزهای بدون فعالیت",
    type: "number",
    ops: ["gte", "lte"],
    entities: ["goal"],
  },
  {
    key: "level",
    label: "سطح جاری",
    type: "number",
    ops: ["gte", "lte"],
    entities: ["progress"],
  },
  {
    key: "actualMinutes",
    label: "مدت نشست (دقیقه)",
    type: "number",
    ops: ["gte", "lte"],
    entities: ["execution"],
  },
];

export function conditionDefsFor(entity: AutomationEntity): ConditionFieldDef[] {
  return AUTOMATION_CONDITIONS.filter(
    (c) => c.entities.includes(entity) || c.entities.includes("any") || entity === "any",
  );
}

export function conditionDef(key: string): ConditionFieldDef | undefined {
  return AUTOMATION_CONDITIONS.find((c) => c.key === key);
}

/* ------------------------------------------------------------------ */
/* Condition engine (§6) — AND semantics, deterministic                */
/* ------------------------------------------------------------------ */

export interface ConditionResult {
  ok: boolean;
  /** Persian explanation of the first condition that failed. */
  reason?: string;
}

function valueOf(snapshot: EntitySnapshot, field: string): ConfigValue {
  return snapshot[field];
}

export function evaluateCondition(cond: AutomationCondition, snapshot: EntitySnapshot): ConditionResult {
  const def = conditionDef(cond.field);
  const actual = valueOf(snapshot, cond.field);
  if (actual === undefined || actual === null) {
    return { ok: false, reason: `داده «${def?.label ?? cond.field}» برای این رویداد در دسترس نیست.` };
  }
  switch (cond.op) {
    case "eq": {
      const ok = Array.isArray(actual)
        ? false
        : String(actual) === String(cond.value as string | number | boolean);
      return ok ? { ok: true } : { ok: false, reason: `${def?.label ?? cond.field} برابر «${String(cond.value)}» نیست.` };
    }
    case "neq": {
      const ok = !Array.isArray(actual) && String(actual) !== String(cond.value as string);
      return ok ? { ok: true } : { ok: false, reason: `${def?.label ?? cond.field} برابر «${String(cond.value)}» است.` };
    }
    case "gte": {
      const a = Number(actual);
      const b = Number(cond.value);
      if (Number.isNaN(a) || Number.isNaN(b)) return { ok: false, reason: `مقایسه «${def?.label ?? cond.field}» نامعتبر است.` };
      return a >= b ? { ok: true } : { ok: false, reason: `${def?.label ?? cond.field} (${a}) کمتر از ${b} است.` };
    }
    case "lte": {
      const a = Number(actual);
      const b = Number(cond.value);
      if (Number.isNaN(a) || Number.isNaN(b)) return { ok: false, reason: `مقایسه «${def?.label ?? cond.field}» نامعتبر است.` };
      return a <= b ? { ok: true } : { ok: false, reason: `${def?.label ?? cond.field} (${a}) بیشتر از ${b} است.` };
    }
    case "contains": {
      const needle = String(cond.value ?? "");
      const hay = Array.isArray(actual) ? actual.map(String).join(" ") : String(actual);
      return hay.includes(needle)
        ? { ok: true }
        : { ok: false, reason: `«${needle}» در ${def?.label ?? cond.field} پیدا نشد.` };
    }
    default:
      return { ok: false, reason: `عملگر نامعتبر: ${String(cond.op)}` };
  }
}

/** All conditions must pass (AND). Empty list always passes. */
export function evaluateConditions(
  conditions: AutomationCondition[],
  snapshot: EntitySnapshot,
): ConditionResult {
  for (const c of conditions) {
    const r = evaluateCondition(c, snapshot);
    if (!r.ok) return r;
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Action catalog (§7–§8)                                              */
/* ------------------------------------------------------------------ */

export const AUTOMATION_ACTIONS: Record<string, ActionDef> = {
  notify: {
    key: "notify",
    label: "به من اطلاع بده",
    description: "اعلان در زنگوله موجود (همان سیستم اعلان فعلی).",
    risk: "low",
    fields: [
      { key: "title", label: "عنوان اعلان", type: "text", required: true, default: "یادآوری خودکار" },
      {
        key: "body",
        label: "متن اعلان",
        type: "textarea",
        help: "از {{title}} برای عنوان مورد و {{date}} برای تاریخ استفاده کن.",
      },
    ],
  },
  create_task: {
    key: "create_task",
    label: "کار جدید بساز",
    description: "یک کار اضافه‌شدنی در سیستم کارها — قابل ویرایش و حذف.",
    risk: "low",
    fields: [
      { key: "title", label: "عنوان کار", type: "text", required: true },
      {
        key: "due",
        label: "سررسید",
        type: "select",
        default: "today",
        options: [
          { value: "today", label: "امروز" },
          { value: "tomorrow", label: "فردا" },
          { value: "in_days", label: "چند روز دیگر" },
          { value: "none", label: "بدون سررسید" },
        ],
      },
      { key: "days", label: "تعداد روز (برای «چند روز دیگر»)", type: "number", min: 0, max: 60, default: 1 },
      {
        key: "priority",
        label: "اولویت",
        type: "select",
        default: "medium",
        options: PRIORITY_OPTIONS,
      },
      { key: "tag", label: "برچسب", type: "text" },
      { key: "projectId", label: "پروژه", type: "project" },
    ],
  },
  add_tag: {
    key: "add_tag",
    label: "برچسب اضافه کن",
    description: "برچسب روی کارِ موردِ رویداد می‌نشیند (برگشت‌پذیر).",
    risk: "low",
    needsEntity: ["task"],
    fields: [{ key: "tag", label: "برچسب", type: "text", required: true }],
  },
  set_priority: {
    key: "set_priority",
    label: "اولویت کار را تغییر بده",
    description: "فقط روی کارِ موردِ رویداد؛ همیشه قابل بازگشت.",
    risk: "medium",
    needsEntity: ["task"],
    fields: [
      {
        key: "priority",
        label: "اولویت جدید",
        type: "select",
        required: true,
        default: "high",
        options: PRIORITY_OPTIONS,
      },
    ],
  },
  create_time_block: {
    key: "create_time_block",
    label: "بلوک زمانی بساز",
    description: "با بررسی تداخل و ساعات کاری — در صورت تداخل، جای خالی بعدی انتخاب می‌شود.",
    risk: "low",
    fields: [
      { key: "title", label: "عنوان بلوک", type: "text", required: true },
      {
        key: "day",
        label: "روز",
        type: "select",
        default: "today",
        options: [
          { value: "today", label: "امروز" },
          { value: "tomorrow", label: "فردا" },
        ],
      },
      { key: "start", label: "ساعت شروع", type: "time", default: "09:00", required: true },
      { key: "minutes", label: "مدت (دقیقه)", type: "number", min: 15, max: 480, default: 60, required: true },
      {
        key: "kind",
        label: "نوع",
        type: "select",
        default: "focus",
        options: [
          { value: "focus", label: "تمرکز" },
          { value: "task", label: "کار" },
          { value: "study", label: "مطالعه" },
          { value: "planning", label: "برنامه‌ریزی" },
          { value: "review", label: "بازبینی" },
          { value: "other", label: "سایر" },
        ],
      },
    ],
  },
  create_note: {
    key: "create_note",
    label: "یادداشت بساز",
    description: "یادداشت شخصی با متن از پیش تعریف‌شده.",
    risk: "low",
    fields: [
      { key: "title", label: "عنوان یادداشت", type: "text", required: true },
      { key: "body", label: "متن", type: "textarea" },
    ],
  },
};

export const ACTION_LIST: ActionDef[] = Object.values(AUTOMATION_ACTIONS);

export function actionDef(key: string): ActionDef | undefined {
  return AUTOMATION_ACTIONS[key];
}

/* ------------------------------------------------------------------ */
/* Validation service (§24 / §30)                                      */
/* ------------------------------------------------------------------ */

export interface ValidationResult {
  ok: boolean;
  issues: string[];
}

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateTrigger(trigger: AutomationTrigger): string[] {
  const issues: string[] = [];
  const def = triggerDef(trigger.key);
  if (!def) {
    issues.push("رویداد (WHEN) انتخاب‌شده معتبر نیست.");
    return issues;
  }
  if (def.kind !== trigger.kind) issues.push("نوع رویداد با کلید آن هم‌خوانی ندارد.");
  const cfg = trigger.config ?? {};
  for (const f of def.fields) {
    const raw = cfg[f.key];
    const missing = raw === undefined || raw === "" || (Array.isArray(raw) && raw.length === 0);
    if (f.required && missing) {
      issues.push(`«${f.label}» الزامی است.`);
      continue;
    }
    if (missing) continue;
    if (f.type === "time" && !TIME_RE.test(String(raw))) issues.push(`ساعت «${f.label}» باید به شکل ۰۸:۳۰ باشد.`);
    if (f.type === "date" && !DAY_KEY_RE.test(String(raw))) issues.push(`تاریخ «${f.label}» باید به شکل ۱۴۰۴-۰۱-۰۱ باشد.`);
    if (f.type === "number") {
      const n = Number(raw);
      if (Number.isNaN(n)) issues.push(`«${f.label}» باید عدد باشد.`);
      else {
        if (f.min !== undefined && n < f.min) issues.push(`«${f.label}» نمی‌تواند کمتر از ${f.min} باشد.`);
        if (f.max !== undefined && n > f.max) issues.push(`«${f.label}» نمی‌تواند بیشتر از ${f.max} باشد.`);
      }
    }
    if (f.type === "weekday") {
      const days = Array.isArray(raw) ? raw : [raw];
      for (const d of days) {
        const n = Number(d);
        if (!Number.isInteger(n) || n < 0 || n > 6) issues.push("روز هفته باید بین ۰ (یکشنبه) تا ۶ (شنبه) باشد.");
      }
    }
    if (f.type === "select" && f.options && !f.options.some((o) => o.value === String(raw))) {
      issues.push(`گزینه انتخاب‌شده برای «${f.label}» معتبر نیست.`);
    }
  }
  return issues;
}

export function validateAutomation(def: AutomationDefinition): ValidationResult {
  const issues: string[] = [];
  if (!def.name || !def.name.trim()) issues.push("نام اتوماسیون الزامی است.");
  if (!def.trigger) issues.push("رویداد (WHEN) را انتخاب کن.");
  else issues.push(...validateTrigger(def.trigger));

  const entity = def.trigger ? (triggerDef(def.trigger.key)?.entity ?? "any") : "any";
  if (!Array.isArray(def.conditions)) issues.push("شرایط (IF) باید فهرست باشند.");
  else {
    if (def.conditions.length > 6) issues.push("حداکثر ۶ شرط می‌توانید تعریف کنید.");
    for (const c of def.conditions) {
      const cd = conditionDef(c.field);
      if (!cd) {
        issues.push(`شرط «${c.field}» پشتیبانی نمی‌شود.`);
        continue;
      }
      if (!cd.entities.includes(entity) && !cd.entities.includes("any") && entity !== "any") {
        issues.push(`شرط «${cd.label}» برای این رویداد در دسترس نیست.`);
      }
      if (!cd.ops.includes(c.op)) issues.push(`عملگر برای «${cd.label}» مجاز نیست.`);
      if ((c.op === "gte" || c.op === "lte") && Number.isNaN(Number(c.value))) {
        issues.push(`مقدار «${cd.label}» باید عدد باشد.`);
      }
    }
  }

  if (!Array.isArray(def.actions) || def.actions.length === 0) {
    issues.push("حداقل یک عمل (THEN) انتخاب کن.");
  } else {
    if (def.actions.length > 5) issues.push("حداکثر ۵ عمل می‌توانید تعریف کنید.");
    for (const a of def.actions) {
      const ad = actionDef(a.key);
      if (!ad) {
        issues.push(`عمل «${a.key}» پشتیبانی نمی‌شود.`);
        continue;
      }
      if (ad.risk === "destructive") {
        issues.push(`عمل «${ad.label}» مخرب است و به‌صورت خودکار مجاز نیست.`);
      }
      if (ad.needsEntity && !ad.needsEntity.includes(entity) && entity !== "any") {
        issues.push(`عمل «${ad.label}» به رویدادِ مرتبط با ${ad.needsEntity.join("/")} نیاز دارد.`);
      }
      const cfg = a.config ?? {};
      for (const f of ad.fields) {
        const raw = cfg[f.key];
        const missing = raw === undefined || raw === "";
        if (f.required && missing) issues.push(`در عمل «${ad.label}»، فیلد «${f.label}» الزامی است.`);
        if (f.type === "time" && raw !== undefined && raw !== "" && !TIME_RE.test(String(raw))) {
          issues.push(`ساعت «${f.label}» باید به شکل ۰۸:۳۰ باشد.`);
        }
        if (f.type === "number" && raw !== undefined && raw !== "" && Number.isNaN(Number(raw))) {
          issues.push(`«${f.label}» باید عدد باشد.`);
        }
      }
    }
  }
  return { ok: issues.length === 0, issues };
}

/* ------------------------------------------------------------------ */
/* Schedule math — FIXED offset (minutes east of UTC), DST-free        */
/* ------------------------------------------------------------------ */

export interface LocalParts {
  y: number;
  m: number; // 1-12
  d: number; // 1-31
  weekday: number; // 0=Sunday … 6=Saturday
  hh: number;
  mm: number;
}

/** Wall-clock parts of an instant for a fixed UTC offset. */
export function localParts(ms: number, tzOffsetMinutes: number): LocalParts {
  const shifted = new Date(ms + tzOffsetMinutes * 60_000);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    d: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hh: shifted.getUTCHours(),
    mm: shifted.getUTCMinutes(),
  };
}

/** Inverse of localParts: instant of a wall-clock time at a fixed offset. */
export function wallToMs(y: number, m: number, d: number, hh: number, mm: number, tzOffsetMinutes: number): number {
  return Date.UTC(y, m - 1, d, hh, mm) - tzOffsetMinutes * 60_000;
}

export function dayKeyAt(ms: number, tzOffsetMinutes: number): string {
  const p = localParts(ms, tzOffsetMinutes);
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

function parseTimeOfDay(raw: string | undefined, fallbackMinutes: number): number {
  if (!raw || !TIME_RE.test(raw)) return fallbackMinutes;
  const [h, m] = raw.split(":").map(Number);
  return h * 60 + m;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Next fire time (epoch ms, strictly after `fromMs`) for a PURE time trigger.
 * Returns null when the trigger can never fire again (expired "once") or is
 * not a pure schedule (date-source triggers are evaluated by the sweep).
 */
export function nextTimeAt(trigger: AutomationTrigger, tzOffsetMinutes: number, fromMs: number): number | null {
  const cfg = trigger.config ?? {};
  const startOfDay = (p: LocalParts) => wallToMs(p.y, p.m, p.d, 0, 0, tzOffsetMinutes);

  if (trigger.key === "time_once") {
    const date = String(cfg.date ?? "");
    const time = parseTimeOfDay(String(cfg.time ?? ""), 9 * 60);
    if (!DAY_KEY_RE.test(date)) return null;
    const [y, m, d] = date.split("-").map(Number);
    const at = wallToMs(y, m, d, Math.floor(time / 60), time % 60, tzOffsetMinutes);
    return at > fromMs ? at : null;
  }

  const time = parseTimeOfDay(String(cfg.time ?? ""), 9 * 60);
  const p = localParts(fromMs, tzOffsetMinutes);
  const todayAt = startOfDay(p) + time * 60_000;

  if (trigger.key === "time_daily") {
    return todayAt > fromMs ? todayAt : startOfDay(p) + 24 * 60 * 60_000 + time * 60_000;
  }

  if (trigger.key === "time_weekly") {
    const raw = cfg.weekday;
    const days = (Array.isArray(raw) ? raw : [raw ?? 1]).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
    if (days.length === 0) return null;
    for (let offset = 0; offset <= 7; offset++) {
      const candidate = todayAt + offset * 24 * 60 * 60_000;
      const cp = localParts(candidate, tzOffsetMinutes);
      if (days.includes(cp.weekday) && candidate > fromMs) return candidate;
    }
    return null;
  }

  if (trigger.key === "time_monthly") {
    const dayOfMonth = Math.min(28, Math.max(1, Number(cfg.dayOfMonth ?? 1)));
    for (let offset = 0; offset <= 32; offset++) {
      const candidate = todayAt + offset * 24 * 60 * 60_000;
      const cp = localParts(candidate, tzOffsetMinutes);
      if (cp.d === dayOfMonth && candidate > fromMs) return candidate;
    }
    // Fallback (e.g., clock jumped): next month's occurrence.
    const y = p.m === 12 ? p.y + 1 : p.y;
    const m = p.m === 12 ? 1 : p.m + 1;
    const d = Math.min(dayOfMonth, daysInMonth(y, m));
    return wallToMs(y, m, d, Math.floor(time / 60), time % 60, tzOffsetMinutes);
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Persian descriptions (cards, history, preview)                      */
/* ------------------------------------------------------------------ */

const WEEKDAYS_FA = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];

export function weekdayLabel(value: ConfigValue): string {
  const days = (Array.isArray(value) ? value : [value ?? 1]).map(Number).filter((n) => n >= 0 && n <= 6);
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return "روزهای کاری هفته";
  return days.map((d) => WEEKDAYS_FA[d] ?? String(d)).join("، ");
}

function cfgNumber(cfg: Record<string, ConfigValue> | undefined, key: string, fallback: number): number {
  const raw = cfg?.[key];
  const n = raw === undefined ? NaN : Number(raw);
  return Number.isNaN(n) ? fallback : n;
}

export function describeTrigger(trigger: AutomationTrigger): string {
  const def = triggerDef(trigger.key);
  if (!def) return "رویداد نامعتبر";
  const cfg = trigger.config ?? {};
  switch (trigger.key) {
    case "time_once":
      return `یک‌بار — ${String(cfg.date ?? "")} ساعت ${String(cfg.time ?? "")}`;
    case "time_daily":
      return `هر روز ساعت ${String(cfg.time ?? "")}`;
    case "time_weekly":
      return `${weekdayLabel(cfg.weekday)} — ساعت ${String(cfg.time ?? "")}`;
    case "time_monthly":
      return `هر ماه ${toFaNum(cfgNumber(cfg, "dayOfMonth", 1))} — ساعت ${String(cfg.time ?? "")}`;
    case "project_completion_reached":
      return `پروژه به ${toFaNum(cfgNumber(cfg, "thresholdPct", 80))}٪ تکمیل برسد`;
    case "goal_inactive":
      return `هدف ${toFaNum(cfgNumber(cfg, "days", 7))} روز بدون فعالیت بماند`;
    case "task_due_soon":
      return `${toFaNum(cfgNumber(cfg, "days", 1))} روز مانده به سررسید کار`;
    case "project_deadline_soon":
      return `${toFaNum(cfgNumber(cfg, "days", 1))} روز مانده به سررسید پروژه`;
    case "exam_upcoming":
      return `${toFaNum(cfgNumber(cfg, "days", 7))} روز مانده به آزمون`;
    case "invoice_due_soon":
      return `${toFaNum(cfgNumber(cfg, "days", 3))} روز مانده به سررسید فاکتور`;
    case "opportunity_closing_soon":
      return `${toFaNum(cfgNumber(cfg, "days", 3))} روز مانده به بسته‌شدن فرصت فروش`;
    default:
      return def.label;
  }
}

export function describeCondition(c: AutomationCondition): string {
  const def = conditionDef(c.field);
  const label = def?.label ?? c.field;
  const valueOpt = def?.options?.find((o) => o.value === String(c.value))?.label;
  const value = valueOpt ?? String(c.value);
  switch (c.op) {
    case "eq":
      return `${label} = ${value}`;
    case "neq":
      return `${label} ≠ ${value}`;
    case "gte":
      return `${label} ≥ ${value}`;
    case "lte":
      return `${label} ≤ ${value}`;
    case "contains":
      return `${label} شامل «${value}»`;
    default:
      return `${label} ${String(c.op)} ${value}`;
  }
}

export function describeAction(a: AutomationAction): string {
  const def = actionDef(a.key);
  if (!def) return "عمل نامعتبر";
  const cfg = a.config ?? {};
  if (a.key === "create_task") return `ساخت کار «${String(cfg.title ?? "")}»`;
  if (a.key === "notify") return `اعلان «${String(cfg.title ?? "")}»`;
  if (a.key === "add_tag") return `افزودن برچسب «${String(cfg.tag ?? "")}»`;
  if (a.key === "set_priority") return `تغییر اولویت به ${def.fields[0]?.options?.find((o) => o.value === String(cfg.priority))?.label ?? String(cfg.priority ?? "")}`;
  if (a.key === "create_time_block")
    return `بلوک زمانی «${String(cfg.title ?? "")}» (${toFaNum(cfgNumber(cfg, "minutes", 60))} دقیقه)`;
  if (a.key === "create_note") return `یادداشت «${String(cfg.title ?? "")}»`;
  return def.label;
}

/** Small Persian digit helper local to this module (no lib import needed). */
export function toFaNum(n: number | string): string {
  const digits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(n).replace(/\d/g, (d) => digits[Number(d)]);
}

/* ------------------------------------------------------------------ */
/* Template substitution (deterministic, no expressions)               */
/* ------------------------------------------------------------------ */

/**
 * Replaces {{key}} tokens with provided values. Unknown tokens are left as
 *-is (visible in preview, never a crash).
 */
export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match,
  );
}

/* ------------------------------------------------------------------ */
/* Templates (§14–§15) — persona-aware                                 */
/* ------------------------------------------------------------------ */

export interface AutomationTemplate {
  key: string;
  label: string;
  description: string;
  /** Persona keys it is offered to; "all" = every persona. */
  personas: string[];
  icon: string;
  definition: AutomationDefinition;
}

const ALL_PERSONAS = ["all"];

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    key: "weekly_planning",
    label: "برنامه‌ریزی هفتگی",
    description: "هر دوشنبه ساعت ۰۸:۰۰ یک کار «برنامه‌ریزی هفتگی» می‌سازد.",
    personas: ALL_PERSONAS,
    icon: "calendar",
    definition: {
      name: "برنامه‌ریزی هفتگی",
      description: "شروع منظم هفته با یک کار ثابت.",
      trigger: { kind: "time", key: "time_weekly", config: { weekday: 1, time: "08:00" } },
      conditions: [],
      actions: [
        {
          key: "create_task",
          config: { title: "برنامه‌ریزی هفتگی", due: "today", priority: "high", tag: "برنامه‌ریزی" },
        },
      ],
    },
  },
  {
    key: "deadline_reminder",
    label: "یادآور سررسید پروژه",
    description: "یک روز قبل از سررسید پروژه اعلان می‌دهد.",
    personas: ALL_PERSONAS,
    icon: "bell",
    definition: {
      name: "یادآور سررسید پروژه",
      description: "هیچ ددلاینی غافلگیرت نمی‌کند.",
      trigger: { kind: "state", key: "project_deadline_soon", config: { days: 1 } },
      conditions: [],
      actions: [
        {
          key: "notify",
          config: { title: "سررسید پروژه نزدیک است", body: "«{{title}}» فردا سررسید دارد." },
        },
      ],
    },
  },
  {
    key: "goal_review",
    label: "بازبینی هدف بی‌فعالیت",
    description: "اگر هدفی ۷ روز بدون فعالیت ماند، کار بازبینی می‌سازد.",
    personas: ALL_PERSONAS,
    icon: "target",
    definition: {
      name: "بازبینی هدف بی‌فعالیت",
      description: "اهداف را زنده نگه می‌دارد.",
      trigger: { kind: "state", key: "goal_inactive", config: { days: 7 } },
      conditions: [{ field: "status", op: "eq", value: "active" }],
      actions: [
        {
          key: "create_task",
          config: { title: "بازبینی هدف: {{title}}", due: "tomorrow", priority: "medium", tag: "بازبینی" },
        },
      ],
    },
  },
  {
    key: "project_review",
    label: "بازبینی پروژه در ۸۰٪",
    description: "وقتی پروژه به ۸۰٪ تکمیل رسید، یادآور بازبینی نشان می‌دهد.",
    personas: ALL_PERSONAS,
    icon: "folder",
    definition: {
      name: "بازبینی پروژه در ۸۰٪",
      description: "قبل از بستن پروژه، یک نگاه آخر.",
      trigger: { kind: "state", key: "project_completion_reached", config: { thresholdPct: 80 } },
      conditions: [{ field: "status", op: "neq", value: "completed" }],
      actions: [
        {
          key: "notify",
          config: { title: "پروژه آماده بازبینی است", body: "«{{title}}» به درصد تکمیل رسید." },
        },
      ],
    },
  },
  {
    key: "overdue_high",
    label: "کار عقب‌افتاده با اولویت زیاد",
    description: "اولویت‌های زیاد/فوری که عقب می‌افتند را اعلان می‌کند.",
    personas: ALL_PERSONAS,
    icon: "alert",
    definition: {
      name: "کار عقب‌افتاده با اولویت زیاد",
      description: "خطرها را زود می‌بینی.",
      trigger: { kind: "state", key: "task_overdue", config: {} },
      conditions: [{ field: "priority", op: "eq", value: "high" }],
      actions: [
        { key: "notify", config: { title: "کار عقب‌افتاده", body: "«{{title}}» از سررسید گذشته است." } },
      ],
    },
  },
  {
    key: "exam_prep",
    label: "آمادگی آزمون (دانش‌آموز)",
    description: "۷ روز قبل از آزمون، کار مرور برنامه مطالعه می‌سازد.",
    personas: ["student"],
    icon: "book",
    definition: {
      name: "آمادگی آزمون",
      description: "برای آزمون‌ها سریع‌تر آماده می‌شوی.",
      trigger: { kind: "state", key: "exam_upcoming", config: { days: 7 } },
      conditions: [],
      actions: [
        {
          key: "create_task",
          config: { title: "مرور برنامه مطالعه برای {{title}}", due: "today", priority: "high", tag: "مطالعه" },
        },
        { key: "notify", config: { title: "آزمون نزدیک است", body: "۷ روز تا «{{title}}» مانده است." } },
      ],
    },
  },
  {
    key: "client_followup",
    label: "پیگیری تحویل مشتری (فریلنسر)",
    description: "وقتی تحویل‌پذیر مشتری عقب افتاد، کار پیگیری می‌سازد.",
    personas: ["freelancer"],
    icon: "briefcase",
    definition: {
      name: "پیگیری تحویل مشتری",
      description: "روابط مشتری را سرپا نگه می‌داری.",
      trigger: { kind: "state", key: "deliverable_overdue", config: {} },
      conditions: [],
      actions: [
        {
          key: "create_task",
          config: { title: "پیگیری تحویل: {{title}}", due: "today", priority: "high", tag: "پیگیری" },
        },
      ],
    },
  },
  {
    key: "invoice_reminder",
    label: "یادآور فاکتور (فریلنسر)",
    description: "۳ روز قبل از سررسید فاکتور پرداخت‌نشده اعلان می‌دهد.",
    personas: ["freelancer"],
    icon: "receipt",
    definition: {
      name: "یادآور فاکتور",
      description: "پرداخت‌ها را فراموش نمی‌کنی.",
      trigger: { kind: "state", key: "invoice_due_soon", config: { days: 3 } },
      conditions: [{ field: "status", op: "eq", value: "sent" }],
      actions: [
        { key: "notify", config: { title: "فاکتور نزدیک سررسید است", body: "«{{title}}» تا ۳ روز دیگر سررسید دارد." } },
      ],
    },
  },
  {
    key: "weekday_focus",
    label: "بلوک تمرکز روزهای کاری",
    description: "شنبه تا چهارشنبه ساعت ۰۹:۰۰ یک بلوک تمرکز می‌سازد.",
    personas: ["employee", "manager", "business_owner"],
    icon: "clock",
    definition: {
      name: "بلوک تمرکز روزهای کاری",
      description: "کار عمیق را در تقویم قفل می‌کنی.",
      trigger: { kind: "time", key: "time_weekly", config: { weekday: [6, 0, 1, 2, 3], time: "09:00" } },
      conditions: [],
      actions: [
        { key: "create_time_block", config: { title: "تمرکز صبحگاهی", day: "today", start: "09:00", minutes: 60, kind: "focus" } },
      ],
    },
  },
  {
    key: "weekly_work_review",
    label: "بازبینی هفتگی کار",
    description: "پنجشنبه ساعت ۱۷:۰۰ کار بازبینی هفتگی می‌سازد.",
    personas: ["employee", "manager"],
    icon: "check",
    definition: {
      name: "بازبینی هفتگی کار",
      description: "هفته را با نگاه جمع‌بسته می‌بندی.",
      trigger: { kind: "time", key: "time_weekly", config: { weekday: 4, time: "17:00" } },
      conditions: [],
      actions: [
        {
          key: "create_task",
          config: { title: "بازبینی هفتگی کار", due: "today", priority: "medium", tag: "بازبینی" },
        },
      ],
    },
  },
  {
    key: "team_goal_review",
    label: "بازبینی هدف تیم (مدیر)",
    description: "اگر هدف تیمی ۷ روز بدون فعالیت ماند، کار بازبینی می‌سازد.",
    personas: ["manager"],
    icon: "users",
    definition: {
      name: "بازبینی هدف تیم",
      description: "اهداف تیم را رها نمی‌کنی.",
      trigger: { kind: "state", key: "goal_inactive", config: { days: 7 } },
      conditions: [],
      actions: [
        {
          key: "create_task",
          config: { title: "بازبینی هدف تیم: {{title}}", due: "tomorrow", priority: "high", tag: "تیم" },
        },
      ],
    },
  },
  {
    key: "business_review",
    label: "بازبینی ماهانه کسب‌وکار",
    description: "اول هر ماه ساعت ۰۹:۰۰ کار بازبینی کسب‌وکار می‌سازد.",
    personas: ["business_owner"],
    icon: "building",
    definition: {
      name: "بازبینی ماهانه کسب‌وکار",
      description: "ماه را با نگاه ارقام شروع می‌کنی.",
      trigger: { kind: "time", key: "time_monthly", config: { dayOfMonth: 1, time: "09:00" } },
      conditions: [],
      actions: [
        {
          key: "create_task",
          config: { title: "بازبینی ماهانه کسب‌وکار", due: "today", priority: "high", tag: "کسب‌وکار" },
        },
      ],
    },
  },
  {
    key: "opportunity_followup",
    label: "پیگیری فرصت فروش (کسب‌وکار)",
    description: "۳ روز قبل از بسته‌شدن فرصت فروش اعلان می‌دهد.",
    personas: ["business_owner"],
    icon: "trending",
    definition: {
      name: "پیگیری فرصت فروش",
      description: "معامله‌های نزدیک را از دست نمی‌دهی.",
      trigger: { kind: "state", key: "opportunity_closing_soon", config: { days: 3 } },
      conditions: [],
      actions: [
        { key: "notify", config: { title: "فرصت فروش نزدیک بسته شدن", body: "«{{title}}» به تاریخ بسته‌شدن نزدیک است." } },
      ],
    },
  },
  {
    key: "habit_review",
    label: "بازبینی هفتگی عادات",
    description: "جمعه ساعت ۱۸:۰۰ کار بازبینی عادات می‌سازد.",
    personas: ["personal", "student"],
    icon: "repeat",
    definition: {
      name: "بازبینی هفتگی عادات",
      description: "استمرارت را هفتگی جمع‌بندی می‌کنی.",
      trigger: { kind: "time", key: "time_weekly", config: { weekday: 5, time: "18:00" } },
      conditions: [],
      actions: [
        {
          key: "create_task",
          config: { title: "بازبینی عادات هفته", due: "today", priority: "low", tag: "عادت" },
        },
      ],
    },
  },
  {
    key: "missed_block_recovery",
    label: "بازیابی بلوک از دست رفته",
    description: "وقتی بلوک زمانی از دست رفت، اعلان بازیابی می‌دهد.",
    personas: ALL_PERSONAS,
    icon: "refresh",
    definition: {
      name: "بازیابی بلوک از دست رفته",
      description: "یک بلوک از دست‌رفته = یک بازیابی سریع.",
      trigger: { kind: "state", key: "time_block_missed", config: {} },
      conditions: [],
      actions: [
        { key: "notify", config: { title: "بلوک زمانی از دست رفت", body: "«{{title}}» انجام نشد — یک فرصت دیگر بساز." } },
      ],
    },
  },
];

export function templatesForPersona(persona: string): AutomationTemplate[] {
  return AUTOMATION_TEMPLATES.filter((t) => t.personas.includes("all") || t.personas.includes(persona));
}
