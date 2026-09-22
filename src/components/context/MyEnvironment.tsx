import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useUserProfile } from "@/hooks/use-user-profile";
import { Button } from "@/components/ui/button";
import { toFa } from "@/lib/persian";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Building2, Pencil, Plus, ChevronDown, CalendarDays, Check, X,
  Link2, ShieldCheck, Sparkles,
} from "lucide-react";

/* ================================================================== */
/*  Persona-aware presentation — the user sees "My Institute",         */
/*  "My Workplace", "My Team"… never the internal "Context Engine".    */
/* ================================================================== */

const ENV_LABELS: Record<string, { title: string; rolePlaceholder: string; types: { key: string; label: string }[] }> = {
  student: {
    title: "موسسه تحصیلی من",
    rolePlaceholder: "مثلاً: پایه ۱۲ — تجربی",
    types: [
      { key: "school", label: "مدرسه" },
      { key: "institute", label: "آموزشگاه" },
      { key: "university", label: "دانشگاه" },
      { key: "other", label: "سایر" },
    ],
  },
  employee: {
    title: "محل کار من",
    rolePlaceholder: "مثلاً: کارشناس نرم‌افزار — واحد محصول",
    types: [
      { key: "company", label: "شرکت" },
      { key: "department", label: "واحد / دپارتمان" },
      { key: "other", label: "سایر" },
    ],
  },
  manager: {
    title: "تیم من",
    rolePlaceholder: "مثلاً: سرپرست تیم محصول",
    types: [
      { key: "team", label: "تیم" },
      { key: "company", label: "شرکت" },
      { key: "department", label: "واحد سازمانی" },
      { key: "other", label: "سایر" },
    ],
  },
  freelancer: {
    title: "حوزه کاری من",
    rolePlaceholder: "مثلاً: طراح رابط کاربری — پروژه‌های آزاد",
    types: [
      { key: "clients", label: "اکوسیستم مشتریان" },
      { key: "company", label: "شرکت همکار" },
      { key: "other", label: "سایر" },
    ],
  },
  business_owner: {
    title: "کسب‌وکار من",
    rolePlaceholder: "مثلاً: بنیان‌گذار و مدیرعامل",
    types: [
      { key: "business", label: "کسب‌وکار" },
      { key: "company", label: "شرکت" },
      { key: "other", label: "سایر" },
    ],
  },
  personal: {
    title: "زندگی و تعهدا�� من",
    rolePlaceholder: "مثلاً: برنامه هفتگی شخصی",
    types: [
      { key: "personal", label: "زندگی شخصی" },
      { key: "community", label: "جامعه / محله" },
      { key: "other", label: "سایر" },
    ],
  },
};

const FALLBACK = ENV_LABELS.personal;

const WEEKDAYS = ["یک", "دو", "سه", "چهار", "پنج", "جمعه", "شنبه"];
/** Map display index (0=شنبه … 6=جمعه) to weekday number (0=Sunday … 6=Saturday). */
const WD_TO_NUM = [6, 0, 1, 2, 3, 4, 5];

const EVENT_TYPES = [
  { key: "class", label: "کلاس" },
  { key: "exam", label: "امتحان" },
  { key: "meeting", label: "جلسه" },
  { key: "deadline", label: "مهلت" },
  { key: "commitment", label: "تعهد ثابت" },
  { key: "event", label: "رویداد" },
  { key: "other", label: "سایر" },
];

function envMeta(personaKey: string) {
  return ENV_LABELS[personaKey] ?? FALLBACK;
}

/* ================================================================== */
/*  LAYER 1 — simple card (what the user sees immediately)             */
/* ================================================================== */

export function MyEnvironment({ compact = false }: { compact?: boolean }) {
  const { personaKey } = useUserProfile();
  const meta = envMeta(personaKey);
  const ctx = useQuery(api.context.workspaceContext, { from: new Date().toISOString().slice(0, 10) });
  const confirmations = useQuery(api.context.listConfirmations);
  const resolveConfirmation = useMutation(api.context.resolveConfirmation);

  const [editing, setEditing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  if (ctx === undefined) {
    // Non-blocking loading state — never delays the dashboard.
    return (
      <div className="ui-surface animate-pulse rounded-2xl p-4">
        <div className="h-4 w-40 rounded bg-muted" />
        <div className="mt-2 h-3 w-64 rounded bg-muted" />
      </div>
    );
  }

  const env = ctx.environment;
  const pending = (confirmations ?? []).filter((c) => c.status === "pending");

  if (env && editing) {
    return (
      <EnvironmentEditor
        meta={meta}
        environment={env}
        attributes={ctx.attributes}
        pending={pending}
        onDone={() => setEditing(false)}
        showCancel
        onResolve={(id, accepted) => resolveConfirmation({ id, accepted })}
      />
    );
  }

  // No environment yet — a slim, non-intrusive CTA (never a giant form).
  if (!env) {
    if (editing) {
      return (
        <EnvironmentEditor
          meta={meta}
          environment={null}
          attributes={ctx.attributes}
          pending={pending}
          onDone={() => setEditing(false)}
          showCancel={false}
          onResolve={(id, accepted) => resolveConfirmation({ id, accepted })}
        />
      );
    }
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border/70 px-4 py-3 text-start transition-colors hover:border-primary/40 hover:bg-muted/40"
      >
        <span className="ui-icon-tile size-8 shrink-0 rounded-lg">
          <Building2 className="size-4 text-muted-foreground" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold">{meta.title} را معرفی کنید</span>
          <span className="block text-[11px] text-muted-foreground">
            با دانستن محیطتان، برنامه و تقویم هوشمنتر می‌شود — فقط وقتی بخواهید.
          </span>
        </span>
        <Plus className="size-4 shrink-0 text-muted-foreground" />
      </button>
    );
  }

  // ── Layer 1: clean summary ──
  return (
    <div className="ui-surface overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <span className="ui-icon-tile size-10 shrink-0 rounded-xl">
          <Building2 className="size-5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-muted-foreground">{meta.title}</p>
          <p className="truncate text-sm font-extrabold">{env.name}</p>
          {env.membershipLabel && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{env.membershipLabel}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" />ویرایش
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowDetails((v) => !v)}>
            جزئیات
            <ChevronDown className={cn("size-3.5 transition-transform", showDetails && "rotate-180")} />
          </Button>
        </div>
      </div>

      {/* Connected checkmarks — what the system already knows */}
      <div className="flex flex-wrap gap-2 border-t border-border/50 px-4 py-2.5">
        <ConnectedChip ok label={`${toFa(ctx.attributes.length)} اطلاعات متصل`} />
        <ConnectedChip ok label={`${toFa(ctx.upcoming.length)} رویداد پیش رو`} />
        {env.schedule.length > 0 && (
          <ConnectedChip
            ok
            label={`هفته کاری: ${env.schedule.map((d) => WEEKDAYS[WD_TO_NUM.indexOf(d)] ?? "؟").join("، ")}`}
          />
        )}
      </div>

      {/* Upcoming contextual events — context influencing the workspace */}
      {ctx.upcoming.length > 0 && !compact && (
        <ul className="divide-y divide-border/50 border-t border-border/50">
          {ctx.upcoming.slice(0, 3).map((e, i) => (
            <li key={i} className="flex items-center gap-2 px-4 py-2 text-xs">
              <CalendarDays className="size-3.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate font-bold">{e.title}</span>
              {e.startTime && <span className="shrink-0 tabular-nums text-muted-foreground">{toFa(e.startTime)}</span>}
              <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold">
                {toFa(e.date.slice(8, 10))}/{toFa(e.date.slice(5, 7))}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Layer 3 — advanced: sources & confirmation queue (collapsed by default) */}
      {showDetails && (
        <div className="border-t border-border/50">
          <DetailsPanel environmentId={env._id as Id<"environments">} />
        </div>
      )}
    </div>
  );
}

function ConnectedChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold",
        ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-muted text-muted-foreground",
      )}
    >
      <Check className="size-3" />
      {label}
    </span>
  );
}

/* ================================================================== */
/*  LAYER 2 — editor (only missing info is asked)                      */
/* ================================================================== */

function EnvironmentEditor({
  meta,
  environment,
  attributes,
  pending,
  onDone,
  showCancel,
  onResolve,
}: {
  meta: ReturnType<typeof envMeta>;
  environment: { _id: Id<"environments">; name: string; type: string; schedule: number[]; membershipLabel: string | null; role: string } | null;
  attributes: { _id: Id<"contextAttributes">; key: string; value: string; origin: string; userConfirmed: boolean }[];
  pending: { _id: Id<"contextConfirmations">; kind: string; payload: string; confidence: string }[];
  onDone: () => void;
  showCancel: boolean;
  onResolve: (id: Id<"contextConfirmations">, accepted: boolean) => void;
}) {
  const createEnvironment = useMutation(api.context.createEnvironment);
  const updateEnvironment = useMutation(api.context.updateEnvironment);
  const setAttribute = useMutation(api.context.setAttribute);

  const [name, setName] = useState(environment?.name ?? "");
  const [type, setType] = useState(environment?.type ?? meta.types[0].key);
  const [roleLabel, setRoleLabel] = useState(environment?.membershipLabel ?? "");
  const [schedule, setSchedule] = useState<number[]>(
    environment?.schedule ?? [6, 0, 1, 2, 3, 4], // شنبه تا چهارشنبه
  );
  const [website, setWebsite] = useState("");
  const [saving, setSaving] = useState(false);

  // Persona-relevant example context (Layer 2 asks only what matters).
  const extraKeys: Record<string, { key: string; label: string }[]> = {
    student: [
      { key: "education_level", label: "مقطع تحصیلی" },
      { key: "field_of_study", label: "رشته" },
      { key: "exam_system", label: "نظام آزمون" },
    ],
    employee: [
      { key: "department", label: "واحد سازمانی" },
      { key: "work_location", label: "محل کار" },
    ],
    manager: [{ key: "team_size", label: "اندازه تیم" }],
    freelancer: [{ key: "services", label: "خدمات" }, { key: "availability", label: "میزان در دسترسی" }],
    business_owner: [{ key: "industry", label: "حوزه فعالیت" }, { key: "priority", label: "اولویت فعلی" }],
    personal: [{ key: "commitments", label: "تعهدهای ثابت" }],
  };
  const personaKey = Object.keys(ENV_LABELS).find((k) => ENV_LABELS[k].title === meta.title) ?? "personal";
  const extras = extraKeys[personaKey] ?? [];

  const attrOf = (key: string) => attributes.find((a) => a.key === key)?.value ?? "";

  const toggleDay = (idx: number) => {
    const num = WD_TO_NUM[idx];
    setSchedule((cur) => (cur.includes(num) ? cur.filter((d) => d !== num) : [...cur, num].sort()));
  };

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (environment) {
        await updateEnvironment({
          id: environment._id,
          name: name.trim(),
          type,
          schedule,
          membershipLabel: roleLabel.trim() || undefined,
          website: website.trim() || undefined,
        });
      } else {
        await createEnvironment({
          name: name.trim(),
          type,
          schedule,
          role: "member",
          membershipLabel: roleLabel.trim() || undefined,
          website: website.trim() || undefined,
        });
      }
      // Persona-relevant attributes the user actually filled in.
      for (const k of extras) {
        const el = document.getElementById(`attr-${k.key}`) as HTMLInputElement | null;
        const val = el?.value.trim();
        if (val && val !== attrOf(k.key)) {
          await setAttribute({ key: k.key, value: val });
        }
      }
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ui-surface space-y-4 rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-extrabold">{meta.title}</p>
        <span className="text-[11px] text-muted-foreground">
          {environment ? "اطلاعات موجود را ویرایش کنید" : "فقط چیزهایی که واقعاً لازم است"}
        </span>
      </div>

      {/* Lightweight confirmation — never applied automatically */}
      {pending.length > 0 && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-500/20 dark:bg-amber-500/5">
          <p className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
            <Sparkles className="size-3.5" />اطلاعاتی پیدا شده — تأیید شما لازم است
          </p>
          {pending.map((c) => {
            let label = "";
            try {
              const p = JSON.parse(c.payload) as Record<string, unknown>;
              label = String(p.name ?? p.title ?? p.key ?? "مورد پیشنهادی");
            } catch {
              label = "مورد پیشنهادی";
            }
            return (
              <div key={c._id} className="flex flex-wrap items-center gap-2 rounded-lg bg-background/70 px-2.5 py-2">
                <span className="min-w-0 flex-1 truncate text-xs font-bold">{label}</span>
                <Button size="sm" className="h-7 px-2 text-[11px]" onClick={() => onResolve(c._id, true)}>
                  <Check className="size-3" />بله، استفاده کن
                </Button>
                <Button size="sm" variant="secondary" className="h-7 px-2 text-[11px]" onClick={() => onResolve(c._id, false)}>
                  <X className="size-3" />نیست
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-bold">نام</label>
          <input
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30"
            placeholder={personaKey === "student" ? "مثلاً: آموزشگاه مَد" : "نام محل یا محیط"}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold">نوع</label>
          <select
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {meta.types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-bold">نقش / وضعیت شما <span className="font-normal text-muted-foreground">(اختیاری)</span></label>
          <input
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30"
            placeholder={meta.rolePlaceholder}
            value={roleLabel}
            onChange={(e) => setRoleLabel(e.target.value)}
          />
        </div>
      </div>

      {/* Weekly schedule */}
      <div>
        <label className="mb-1.5 block text-xs font-bold">روزهای فعال در هفته</label>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((d, idx) => {
            const active = schedule.includes(WD_TO_NUM[idx]);
            return (
              <button
                key={d}
                onClick={() => toggleDay(idx)}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all",
                  active ? "border-primary bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:border-primary/40",
                )}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {/* Persona-relevant attributes — prefilled, ask only for missing */}
      {extras.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {extras.map((k) => (
            <div key={k.key}>
              <label className="mb-1 block text-xs font-bold">
                {k.label} {attrOf(k.key) && <Check className="inline size-3 text-emerald-600" />}
              </label>
              <input
                id={`attr-${k.key}`}
                defaultValue={attrOf(k.key)}
                placeholder={attrOf(k.key) || "اختیاری"}
                className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" disabled={!name.trim() || saving} onClick={save}>
          <Check className="size-3.5" />{saving ? "در حال ذخیره…" : "ذخیره"}
        </Button>
        {showCancel && (
          <Button size="sm" variant="ghost" onClick={onDone}>انصراف</Button>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  LAYER 3 — details: events manager, sources, provenance             */
/* ================================================================== */

function DetailsPanel({ environmentId }: { environmentId: Id<"environments"> }) {
  const events = useQuery(api.context.listEvents);
  const sources = useQuery(api.context.listSources);
  const attrs = useQuery(api.context.listAttributes);
  const createEvent = useMutation(api.context.createContextEvent);
  const deleteEvent = useMutation(api.context.deleteContextEvent);
  const addSource = useMutation(api.context.addSource);
  const removeSource = useMutation(api.context.removeSource);
  const setAttribute = useMutation(api.context.setAttribute);
  const resolveAttribute = useMutation(api.context.resolveAttribute);

  const [title, setTitle] = useState("");
  const [type, setType] = useState("class");
  const [time, setTime] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [date, setDate] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [showSources, setShowSources] = useState(false);

  const envEvents = (events ?? []).filter((e) => e.environmentId === environmentId);
  const envSources = (sources ?? []).filter((s) => s.environmentId === environmentId);
  const unconfirmed = (attrs ?? []).filter((a) => !a.userConfirmed && a.origin !== "user_provided");

  const toggleWd = (idx: number) => {
    const num = WD_TO_NUM[idx];
    setWeekdays((cur) => (cur.includes(num) ? cur.filter((d) => d !== num) : [...cur, num].sort()));
  };

  const saveEvent = async () => {
    if (!title.trim()) return;
    if (!date && weekdays.length === 0) return;
    await createEvent({
      title: title.trim(),
      type,
      environmentId,
      date: date || undefined,
      weekdays,
      startTime: time || undefined,
      origin: "user",
    });
    setTitle(""); setDate(""); setTime(""); setWeekdays([]);
  };

  const ORIGIN_LABEL: Record<string, string> = {
    user_provided: "توسط شما",
    discovered: "کشف‌شده",
    imported: "درون‌ریزی‌شده",
    inferred: "استنباط‌شده",
  };
  const CONF_LABEL: Record<string, string> = {
    known: "محفوظ",
    inferred: "استنباطی",
    unknown: "نامشخص",
  };

  return (
    <div className="space-y-4 p-4">
      {/* Contextual events → Calendar */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold">
          <CalendarDays className="size-3.5 text-primary" />رویدادهای این محیط (کلاس، امتحان، جلسه…)
        </p>
        {envEvents.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-[11px] text-muted-foreground">
            هنوز رویدادی نیست. کلاس‌ها یا جلسات ثابت را اضافه کنید تا در تقویم و «امروز» نمایش داده شوند.
          </p>
        ) : (
          <ul className="mb-2 space-y-1.5">
            {envEvents.map((e) => (
              <li key={e._id} className="flex items-center gap-2 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs">
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold">
                  {EVENT_TYPES.find((t) => t.key === e.type)?.label ?? "رویداد"}
                </span>
                <span className="min-w-0 flex-1 truncate font-bold">{e.title}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {e.date
                    ? toFa(e.date)
                    : `هر ${e.weekdays.map((d) => WEEKDAYS[WD_TO_NUM.indexOf(d)]).join("، ")}`}
                  {e.startTime ? ` — ${toFa(e.startTime)}` : ""}
                </span>
                <button onClick={() => deleteEvent({ id: e._id })} className="shrink-0 text-muted-foreground hover:text-destructive">
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <input
            placeholder="عنوان رویداد، مثلاً: آزمون هفتگی جمعه"
            className="rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/30"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select
            className="rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs font-medium outline-none"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {EVENT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <input
            type="date"
            className="rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs font-medium outline-none"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <input
            type="time"
            className="rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs font-medium outline-none"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold text-muted-foreground">تکرار هفتگی:</span>
          {WEEKDAYS.map((d, idx) => (
            <button
              key={d}
              onClick={() => toggleWd(idx)}
              className={cn(
                "rounded-md border px-1.5 py-0.5 text-[10px] font-bold transition-all",
                weekdays.includes(WD_TO_NUM[idx]) ? "border-primary bg-primary/10 text-primary" : "border-border/60 text-muted-foreground",
              )}
            >
              {d}
            </button>
          ))}
          <Button size="sm" className="h-6 px-2 text-[10px]" disabled={!title.trim() || (!date && weekdays.length === 0)} onClick={saveEvent}>
            <Plus className="size-3" />افزودن
          </Button>
        </div>
      </div>

      {/* Provenance — known vs inferred vs user-confirmed */}
      {unconfirmed.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-500/20 dark:bg-blue-500/5">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-blue-800 dark:text-blue-300">
            <ShieldCheck className="size-3.5" />اطلاعات کشف‌شده — برای استفاده تأیید کنید
          </p>
          {unconfirmed.map((a) => (
            <div key={a._id} className="mb-1.5 flex flex-wrap items-center gap-2 rounded-lg bg-background/70 px-2.5 py-1.5 text-xs">
              <span className="font-bold">{a.key}:</span>
              <span className="min-w-0 flex-1 truncate">{a.value}</span>
              <span className="text-[10px] text-muted-foreground">
                {ORIGIN_LABEL[a.origin] ?? a.origin} · {CONF_LABEL[a.confidence] ?? a.confidence}
              </span>
              <Button size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => resolveAttribute({ id: a._id, confirmed: true })}>
                <Check className="size-3" />تأیید
              </Button>
              <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={() => resolveAttribute({ id: a._id, confirmed: false })}>
                <X className="size-3" />غلط است
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Sources — references only, user-managed */}
      <div>
        <button
          onClick={() => setShowSources((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-extrabold text-muted-foreground hover:text-foreground"
        >
          <Link2 className="size-3.5" />
          منابع اطلاعاتی ({toFa(envSources.length)})
          <ChevronDown className={cn("size-3 transition-transform", showSources && "rotate-180")} />
        </button>
        {showSources && (
          <div className="mt-2 space-y-2">
            <p className="text-[10px] leading-4 text-muted-foreground">
              فقط پیوندها و منابع عمومی ذخیره می‌شوند — هیچ دسترسی خصوصی یا احراز هویت دور زده نمی‌شود.
            </p>
            {envSources.map((s) => (
              <div key={s._id} className="flex items-center gap-2 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs">
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold">
                  {s.sourceType === "public_website" ? "وب‌سایت عمومی" : s.sourceType === "manual" ? "دستی" : s.sourceType}
                </span>
                <span className="min-w-0 flex-1 truncate font-bold">{s.name}</span>
                {s.url && <span className="max-w-32 shrink-0 truncate text-[10px] text-muted-foreground">{s.url}</span>}
                <button onClick={() => removeSource({ id: s._id })} className="shrink-0 text-muted-foreground hover:text-destructive">
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                placeholder="نام منبع، مثلاً: سایت آموزشگاه"
                className="rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/30"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
              />
              <input
                placeholder="پیوند عمومی (اختیاری)"
                className="rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/30"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
              />
              <Button
                size="sm"
                className="h-7 px-2 text-[10px]"
                disabled={!sourceName.trim()}
                onClick={async () => {
                  await addSource({ name: sourceName.trim(), sourceType: "public_website", url: sourceUrl.trim() || undefined, environmentId });
                  setSourceName(""); setSourceUrl("");
                }}
              >
                <Plus className="size-3" />افزودن
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
