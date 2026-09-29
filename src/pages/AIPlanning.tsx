/**
 * Phase 10.5 — «برنامه‌ریزی با هوش مصنوعی خارجی».
 *
 * The flow the user actually walks:
 *   persona → questionnaire → copyable prompt → external AI → JSON file
 *   → drop zone → server-side validation → preview (new / duplicate / conflict)
 *   → explicit confirmation → apply into the EXISTING workspace models.
 *
 * Guarantees encoded here:
 *  - No AI provider, no API key, no simulated AI output (§26/§28). The only
 *    "AI" involved is the user's own external account.
 *  - Nothing is applied without an explicit confirmation step (§19).
 *  - Existing data is never deleted or silently overwritten (§19/§25).
 *  - Every mutation goes through the server-authoritative pipeline, so the
 *    Planning / Scheduling engines stay authoritative (§18).
 */
import { useMutation, useQuery } from "convex/react";
import { useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCopy,
  FileJson,
  History,
  Info,
  Layers,
  ListChecks,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Id } from "@/convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Panel, Pill, EmptyHint, StatTile } from "@/components/progress/progress-ui";
import { ImportDropzone, type PickedFile } from "@/components/ai-planning/ImportDropzone";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { useSchedulePrefs } from "@/lib/preferences";
import { toFa } from "@/lib/persian";
import { todayKey } from "@/lib/task-utils";
import { cn } from "@/lib/utils";
import {
  HOW_IT_WORKS,
  personaPlanDefinition,
  type QuestionField,
} from "@/lib/ai-planning/personas";
import {
  buildAIPlanPrompt,
  promptReadinessIssues,
  type PromptContextSnapshot,
} from "@/lib/ai-planning/prompt";
import { buildSamplePlan } from "@/lib/ai-planning/sample";
import { normalizeAIPlan, planEntityTitles } from "@/lib/ai-planning/schema";
import {
  AI_PLAN_SCHEMA_VERSION,
  SOURCE_LABELS,
  type AIPlanBody,
  type PlanConflict,
  type PlanDuplicate,
  type PlanIssue,
} from "@/lib/ai-planning/types";

/* ------------------------------------------------------------------ */
/* Labels (data only — no logic in the JSX)                            */
/* ------------------------------------------------------------------ */

type Step = "questions" | "prompt" | "import";

const STEPS: Array<{ key: Step; label: string; icon: typeof ListChecks }> = [
  { key: "questions", label: "پرسش‌ها", icon: ListChecks },
  { key: "prompt", label: "پرامپت", icon: ClipboardCopy },
  { key: "import", label: "ورود فایل", icon: Upload },
];

const ENTITY_LABELS: Record<keyof AIPlanBody, string> = {
  goals: "اهداف",
  projects: "پروژه‌ها",
  tasks: "کارها",
  calendar_events: "رویدادهای تقویم",
  time_blocks: "بلوک‌های زمانی",
  routines: "روتین‌ها",
  habits: "عادت‌ها",
  milestones: "نقاط عطف",
};

const CONFLICT_LABELS: Record<PlanConflict["kind"], string> = {
  overlap_existing: "تداخل با برنامهٔ موجود",
  overlap_in_plan: "تداخل داخل خودِ برنامه",
  capacity: "بیش از ظرفیت روزانه",
  missing_reference: "ارجاع نامعتبر",
  past_due: "تاریخ گذشته",
  impossible_time: "ساعت نامعتبر",
};

const STATUS_LABELS: Record<string, { label: string; tone: "emerald" | "amber" | "rose" | "slate" }> = {
  uploaded: { label: "بارگذاری‌شده", tone: "slate" },
  validated: { label: "اعتبارسنجی‌شده", tone: "emerald" },
  needs_review: { label: "نیازمند بازبینی", tone: "amber" },
  applied: { label: "اعمال‌شده", tone: "emerald" },
  partially_applied: { label: "اعمال ناقص", tone: "amber" },
  rejected: { label: "رد‌شده", tone: "rose" },
  failed: { label: "ناموفق", tone: "rose" },
};

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function faDate(ms: number): string {
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(ms);
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AIPlanningPage() {
  const { personaKey } = useUserProfile();
  const def = personaPlanDefinition(personaKey);
  const { tasks, projects } = useWorkspace();
  const goals = useQuery(api.personal.listGoals, {});
  const blocks = useQuery(api.personal.listTimeBlocks, {});
  const [prefs] = useSchedulePrefs();

  const [step, setStep] = useState<Step>("questions");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<Partial<Record<keyof AIPlanBody, boolean>>>({});
  const [includeConflicts, setIncludeConflicts] = useState(false);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [openImportId, setOpenImportId] = useState<Id<"aiPlanningImports"> | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  /** Titles parsed locally purely so the user can INSPECT each item (§14).
   *  The server stays authoritative for validation and for what is applied. */
  const [previewTitles, setPreviewTitles] = useState<Record<keyof AIPlanBody, string[]> | null>(
    null,
  );
  const previewRef = useRef<HTMLDivElement>(null);

  const analyzeMutation = useMutation(api.aiPlanning.analyze);
  const applyMutation = useMutation(api.aiPlanning.apply);
  const discardMutation = useMutation(api.aiPlanning.discard);
  const historyRows = useQuery(api.aiPlanning.history, { limit: 12 });

  /* --- workspace snapshot handed to the prompt (honest, non-sensitive) --- */
  const context: PromptContextSnapshot = useMemo(() => {
    const open = tasks.filter((t) => t.status !== "done");
    const soon = todayKey();
    return {
      todayKey: soon,
      horizonDays: 14,
      taskCount: tasks.length,
      openTaskCount: open.length,
      projectCount: projects.length,
      goalCount: (goals ?? []).filter((g: { status?: string }) => g.status !== "completed").length,
      blockCountThisWeek: (blocks ?? []).length,
      topTaskTitles: open.slice(0, 6).map((t) => t.title),
      projectNames: projects.slice(0, 5).map((p) => p.name),
      goalTitles: (goals ?? [])
        .slice(0, 5)
        .map((g: { title: string }) => g.title),
      upcomingDeadlines: open
        .filter((t) => t.dueDate)
        .slice(0, 6)
        .map((t) => `${t.title} — ${t.dueDate}`),
      workingWindow: `${prefs.dayStart} تا ${prefs.dayEnd}`,
    };
  }, [tasks, projects, goals, blocks, prefs.dayStart, prefs.dayEnd]);

  const prompt = useMemo(
    () => buildAIPlanPrompt({ persona: personaKey, answers, context }),
    [personaKey, answers, context],
  );
  const readiness = useMemo(
    () => promptReadinessIssues(answers, personaKey),
    [answers, personaKey],
  );
  const sample = useMemo(
    () => buildSamplePlan(personaKey, todayKey()),
    [personaKey],
  );

  const availableMinutes = useMemo(() => {
    const [h1, m1] = prefs.dayStart.split(":").map(Number);
    const [h2, m2] = prefs.dayEnd.split(":").map(Number);
    return Math.max(30, (h2 * 60 + m2 - (h1 * 60 + m1)) || 480);
  }, [prefs.dayStart, prefs.dayEnd]);

  /* --- actions ---------------------------------------------------- */

  const handleFile = async (file: PickedFile) => {
    try {
      const res = await analyzeMutation({
        raw: file.json,
        tzOffsetMinutes: -new Date().getTimezoneOffset(),
        availableMinutesPerDay: availableMinutes,
      });
      setAnalysis(res);
      if (res.ok) {
        setSelection({});
        const local = normalizeAIPlan(file.json, {
          expectedPersona: res.persona,
          now: Date.now(),
        });
        setPreviewTitles(local.plan ? planEntityTitles(local.plan) : null);
        toast.success("فایل بررسی شد. قبل از اعمال، خلاصه را ببینید.");
      } else {
        setPreviewTitles(null);
        toast.error("این فایل رد شد؛ دلیل‌ها در خلاصه آمده است.");
      }
      window.setTimeout(() => previewRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "بررسی فایل ممکن نشد.");
    }
  };

  const handleApply = async () => {
    if (!analysis?.ok) return;
    setConfirming(true);
    try {
      const res = await applyMutation({
        importId: analysis.importId,
        selection,
        includeConflictingBlocks: includeConflicts,
        includeDuplicates,
        tzOffsetMinutes: -new Date().getTimezoneOffset(),
      });
      const total = Object.values(res.applied).reduce((n, c) => n + c, 0);
      toast.success(
        res.status === "applied"
          ? `${toFa(total)} مورد وارد فضای کاری شد.`
          : `${toFa(total)} مورد وارد شد و ${toFa(res.rejected.length)} مورد کنار گذاشته شد.`,
      );
      setAnalysis(null);
      setStep("import");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "اعمال برنامه ممکن نشد.");
    } finally {
      setConfirming(false);
    }
  };

  const setAnswer = (key: string, value: string) =>
    setAnswers((prev) => ({ ...prev, [key]: value }));

  /* --- render ----------------------------------------------------- */

  const totalNew = analysis?.ok
    ? Object.values(analysis.newCounts).reduce((n, c) => n + c, 0)
    : 0;
  const selectedTotal = analysis?.ok
    ? (Object.keys(ENTITY_LABELS) as Array<keyof AIPlanBody>).reduce(
        (n, key) => n + (selection[key] === false ? 0 : analysis.newCounts[key]),
        0,
      )
    : 0;
  const blockingCount = analysis?.conflicts.filter((c) => c.blocking).length ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 pb-24 md:p-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <FileJson className="size-6 text-primary" aria-hidden="true" />
            {def.pageTitle}
          </h1>
          <Pill toneKey="emerald">
            <CheckCircle2 className="size-3" aria-hidden="true" />
            همین حالا فعال
          </Pill>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {def.pageDescription}
        </p>
        <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <Info className="size-3" aria-hidden="true" />
          این صفحه به هیچ سرویس هوش مصنوعی وصل نیست. شما از حساب خودتان در ChatGPT استفاده
          می‌کنید و فقط فایل خروجی او را اینجا وارد می‌کنید.
        </p>
      </header>

      {/* ── stepper ── */}
      <nav aria-label="مراحل واردسازی برنامه" className="ui-surface rounded-2xl p-2">
        <ol className="grid grid-cols-3 gap-1.5">
          {STEPS.map((s, i) => {
            const active = step === s.key;
            const Icon = s.icon;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => setStep(s.key)}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex w-full items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold transition-colors",
                    active
                      ? "bg-primary text-white shadow-[0_8px_20px_-12px_rgba(37,99,235,0.9)]"
                      : "text-muted-foreground hover:bg-primary/5 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">
                    {toFa(i + 1)}. {s.label}
                  </span>
                  <span className="sm:hidden">{s.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* ── step 1: questionnaire ── */}
      {step === "questions" && (
        <div className="space-y-4">
          <Panel
            title="پرسش‌های مخصوص شخصیت شما"
            icon={<ListChecks className="size-4 text-primary" aria-hidden="true" />}
            description="هرچه بیشتر پر کنید، برنامهٔ نهایی دقیق‌تر می‌شود. موارد خالی را خودِ هوش مصنوعی در گفت‌وگو می‌پرسد."
          >
            <div className="space-y-5">
              {def.questionSections.map((section) => (
                <fieldset key={section.key} className="space-y-2.5">
                  <legend className="text-xs font-extrabold">{section.title}</legend>
                  {section.intro && (
                    <p className="text-[11px] text-muted-foreground">{section.intro}</p>
                  )}
                  <div className="grid gap-3 md:grid-cols-2">
                    {section.fields.map((f) => (
                      <QuestionInput
                        key={`${section.key}.${f.key}`}
                        field={f}
                        value={answers[`${section.key}.${f.key}`] ?? ""}
                        onChange={(v) => setAnswer(`${section.key}.${f.key}`, v)}
                      />
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button onClick={() => setStep("prompt")}>
                مرحلهٔ بعد: ساخت پرامپت
                <ArrowLeft className="size-4" aria-hidden="true" />
              </Button>
              {readiness.length > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  {toFa(readiness.length)} پرسش کلیدی هنوز خالی است — قابل رد کردن.
                </span>
              )}
            </div>
          </Panel>
        </div>
      )}

      {/* ── step 2: prompt ── */}
      {step === "prompt" && (
        <div className="space-y-4">
          <Panel
            title={def.promptTitle}
            icon={<ClipboardCopy className="size-4 text-primary" aria-hidden="true" />}
            description={def.promptIntro}
            action={
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(prompt);
                    toast.success("پرامپت کپی شد.");
                  } catch {
                    toast.error("کپی ممکن نشد؛ متن را دستی انتخاب کنید.");
                  }
                }}
              >
                <ClipboardCopy className="size-4" aria-hidden="true" />
                کپی پرامپت
              </Button>
            }
          >
            <details className="mb-3">
              <summary className="cursor-pointer text-xs font-bold text-primary">
                این کار چطور انجام می‌شود؟
              </summary>
              <ol className="mt-2 list-decimal space-y-1 pr-5 text-[11px] leading-5 text-muted-foreground">
                {HOW_IT_WORKS.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
            </details>
            <pre
              dir="rtl"
              aria-label="متن پرامپت آمادهٔ کپی"
              className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-border/60 bg-muted/40 p-3 text-[11px] leading-6"
            >
              {prompt}
            </pre>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep("questions")}>
                <ArrowRight className="size-4" aria-hidden="true" />
                بازگشت به پرسش‌ها
              </Button>
              <Button size="sm" onClick={() => setStep("import")}>
                فایل را آماده کردم
                <ArrowLeft className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </Panel>

          <div className="grid gap-3 md:grid-cols-2">
            <Panel title="چه چیزهایی از شما لازم است">
              <ul className="list-disc space-y-1 pr-5 text-[11px] leading-5">
                {def.requiredData.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </Panel>
            <Panel title="اختیاری ولی مفید">
              <ul className="list-disc space-y-1 pr-5 text-[11px] leading-5 text-muted-foreground">
                {def.optionalData.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </Panel>
            <Panel title="قواعدی که رعایت می‌شوند">
              <ul className="list-disc space-y-1 pr-5 text-[11px] leading-5">
                {def.planningRules.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </Panel>
            <Panel title="خروجی مورد انتظار">
              <ul className="list-disc space-y-1 pr-5 text-[11px] leading-5 text-muted-foreground">
                {def.outputExpectations.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      )}

      {/* ── step 3: import ── */}
      {step === "import" && (
        <div className="space-y-4">
          <Panel
            title="وارد کردن فایل برنامه"
            icon={<Upload className="size-4 text-primary" aria-hidden="true" />}
            description={`قالب: JSON • نسخهٔ ساختار ${AI_PLAN_SCHEMA_VERSION} • منبع: ${SOURCE_LABELS.external_chatgpt}`}
          >
            <ImportDropzone
              onPicked={(f) => void handleFile(f)}
              onError={(m) => toast.error(m)}
              sampleJson={sample}
            />
          </Panel>

          <div ref={previewRef}>
            {analysis && (
              <ImportPreview
                analysis={analysis}
                selection={selection}
                onToggle={(k, v) => setSelection((s) => ({ ...s, [k]: v }))}
                includeConflicts={includeConflicts}
                setIncludeConflicts={setIncludeConflicts}
                includeDuplicates={includeDuplicates}
                setIncludeDuplicates={setIncludeDuplicates}
                totalNew={totalNew}
                selectedTotal={selectedTotal}
                blockingCount={blockingCount}
                onApply={() => void handleApply()}
                applying={confirming}
                titles={previewTitles}
                onDiscard={async () => {
                  if (!analysis.ok) return;
                  await discardMutation({ id: analysis.importId });
                  setAnalysis(null);
                  toast.success("این واردسازی حذف شد؛ فضای کاری دست‌نخورده است.");
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* ── history ── */}
      <Panel
        title="سابقهٔ واردسازی"
        icon={<History className="size-4 text-primary" aria-hidden="true" />}
        description="هر واردسازی با وضعیت، تعداد اقلام و زمان اعمال نگه داشته می‌شود. با باز کردن هر ردیف می‌بینید برنامه بر پایهٔ چه اطلاعاتی ساخته شده است."
      >
        {historyRows === undefined ? (
          <p className="text-xs text-muted-foreground">در حال بارگذاری…</p>
        ) : historyRows.length === 0 ? (
          <EmptyHint>هنوز فایلی وارد نکرده‌اید.</EmptyHint>
        ) : (
          <ul className="space-y-2">
            {historyRows.map((row) => {
              const counts = parseJson<Record<string, number>>(row.appliedCounts, {});
              const total = Object.values(counts).reduce((n, c) => n + c, 0);
              const st = STATUS_LABELS[row.status] ?? { label: row.status, tone: "slate" as const };
              const canDiscard = row.status !== "applied" && row.status !== "partially_applied";
              return (
                <li key={row._id} className="ui-surface space-y-2 rounded-xl px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold">
                        {row.sourceProvider} • ساختار {row.schemaVersion || "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {faDate(row.createdAt)}
                        {row.appliedAt ? ` — اعمال: ${faDate(row.appliedAt)}` : ""}
                      </p>
                    </div>
                    <Pill toneKey={st.tone}>
                      {toFa(total)} مورد • {st.label}
                    </Pill>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-expanded={openImportId === row._id}
                      onClick={() =>
                        setOpenImportId((prev) => (prev === row._id ? null : row._id))
                      }
                    >
                      {openImportId === row._id ? "بستن" : "زمینهٔ برنامه‌ریزی"}
                    </Button>
                    {canDiscard && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="حذف این واردسازی"
                        onClick={async () => {
                          try {
                            await discardMutation({ id: row._id });
                            setOpenImportId((prev) => (prev === row._id ? null : prev));
                            toast.success("حذف شد.");
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "حذف ممکن نشد.");
                          }
                        }}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                  {openImportId === row._id && <PlanningContextView importId={row._id} />}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Planning context (§13) — the two layers must stay visually separate */
/* ------------------------------------------------------------------ */

const INPUT_LABELS: Record<string, string> = {
  profile: "مشخصات فردی",
  environment: "محیط",
  constraints: "محدودیت‌ها",
  preferences: "ترجیحات",
  fixed_schedule: "برنامهٔ ثابت",
  availability: "زمان در دسترس",
  goals: "اهداف",
  priorities: "اولویت‌ها",
  deadlines: "سررسیدها",
  commitments: "تعهدات",
  subjects: "موضوعات",
  projects: "پروژه‌ها",
};

function PlanningContextView({ importId }: { importId: Id<"aiPlanningImports"> }) {
  const detail = useQuery(api.aiPlanning.detail, { id: importId });
  const context = parseJson<{
    user_context?: Record<string, string[]>;
    planning_inputs?: Record<string, string[]>;
    planning_assumptions?: string[];
    explanations?: string[];
  } | null>(detail?.contextSnapshot, null);
  const plan = parseJson<Record<keyof AIPlanBody, Array<{ title: string }>> | null>(
    detail?.planSnapshot,
    null,
  );

  if (detail === undefined) {
    return <p className="text-[11px] text-muted-foreground">در حال بارگذاری…</p>;
  }
  if (!context && !plan) {
    return (
      <p className="text-[11px] text-muted-foreground">
        برای این واردسازی زمینه‌ای ذخیره نشده است.
      </p>
    );
  }

  const inputGroups = [
    ...Object.entries(context?.user_context ?? {}),
    ...Object.entries(context?.planning_inputs ?? {}),
  ].filter(([, v]) => Array.isArray(v) && v.length > 0);

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-muted/25 p-3">
      {/* layer 1 — what the user told the external AI */}
      <div>
        <p className="text-[11px] font-extrabold text-foreground">اطلاعاتی که شما دادید</p>
        {inputGroups.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">موردی ثبت نشده است.</p>
        ) : (
          <dl className="mt-1 space-y-1.5">
            {inputGroups.map(([key, values]) => (
              <div key={key} className="grid gap-0.5 sm:grid-cols-[9rem_1fr]">
                <dt className="text-[11px] font-bold text-muted-foreground">
                  {INPUT_LABELS[key] ?? key}
                </dt>
                <dd className="text-[11px] leading-5">{values.join(" • ")}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* layer 2 — what the AI decided on top of those inputs */}
      <div>
        <p className="text-[11px] font-extrabold text-foreground">
          فرض‌ها و تصمیم‌های هوش مصنوعی
        </p>
        {context?.planning_assumptions?.length || context?.explanations?.length ? (
          <ul className="mt-1 list-disc space-y-0.5 pr-4 text-[11px] leading-5 text-muted-foreground">
            {(context?.planning_assumptions ?? []).map((a, i) => (
              <li key={`a${i}`}>{a}</li>
            ))}
            {(context?.explanations ?? []).map((e, i) => (
              <li key={`e${i}`}>{e}</li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-muted-foreground">فرضی اعلام نشده است.</p>
        )}
      </div>

      {/* layer 3 — the plan itself */}
      {plan && (
        <div>
          <p className="text-[11px] font-extrabold text-foreground">برنامهٔ تولیدشده</p>
          <ul className="mt-1 space-y-0.5">
            {(Object.keys(ENTITY_LABELS) as Array<keyof AIPlanBody>)
              .filter((k) => (plan[k] ?? []).length > 0)
              .map((k) => (
                <li key={k} className="text-[11px] leading-5">
                  <span className="font-bold">{ENTITY_LABELS[k]}:</span>{" "}
                  <span className="text-muted-foreground">
                    {plan[k].map((i) => i.title).join(" • ")}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Questionnaire field                                                 */
/* ------------------------------------------------------------------ */
function QuestionInput({
  field,
  value,
  onChange,
}: {
  field: QuestionField;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = `q-${field.key}`;
  const wide = field.type === "textarea";
  return (
    <div className={cn("space-y-1.5", wide && "md:col-span-2")}>
      <label htmlFor={id} className="flex items-center gap-1 text-[11px] font-bold">
        {field.label}
        {field.required && (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        )}
        {field.required && <span className="sr-only">(الزامی)</span>}
      </label>
      {field.type === "textarea" ? (
        <Textarea
          id={id}
          rows={3}
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.type === "boolean" ? (
        <label className="flex items-center gap-2 text-[11px]">
          <input
            id={id}
            type="checkbox"
            checked={value === "true"}
            onChange={(e) => onChange(e.target.checked ? "true" : "")}
            className="size-4 accent-primary"
          />
          {field.hint ?? "بله"}
        </label>
      ) : (
        <Input
          id={id}
          type={field.type === "number" ? "number" : "text"}
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.hint && field.type !== "boolean" && (
        <p className="text-[10px] text-muted-foreground">{field.hint}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Preview + confirmation                                               */
/* ------------------------------------------------------------------ */

interface AnalysisResult {
  ok: boolean;
  importId: Id<"aiPlanningImports">;
  rejected: boolean;
  issues: PlanIssue[];
  conflicts: PlanConflict[];
  duplicates: PlanDuplicate[];
  newCounts: Record<keyof AIPlanBody, number>;
  persona: string;
  status?: string;
  schemaVersion?: string;
  source?: { type: keyof typeof SOURCE_LABELS; provider: string };
}

function ImportPreview({
  analysis,
  selection,
  onToggle,
  includeConflicts,
  setIncludeConflicts,
  includeDuplicates,
  setIncludeDuplicates,
  totalNew,
  selectedTotal,
  blockingCount,
  onApply,
  applying,
  titles,
  onDiscard,
}: {
  analysis: AnalysisResult;
  selection: Partial<Record<keyof AIPlanBody, boolean>>;
  onToggle: (k: keyof AIPlanBody, v: boolean) => void;
  includeConflicts: boolean;
  setIncludeConflicts: (v: boolean) => void;
  includeDuplicates: boolean;
  setIncludeDuplicates: (v: boolean) => void;
  totalNew: number;
  selectedTotal: number;
  blockingCount: number;
  onApply: () => void;
  applying: boolean;
  titles: Record<keyof AIPlanBody, string[]> | null;
  onDiscard: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (analysis.rejected) {
    return (
      <Panel
        title="این فایل پذیرفته نشد"
        icon={<TriangleAlert className="size-4 text-destructive" aria-hidden="true" />}
        description="هیچ داده‌ای وارد فضای کاری نشده است."
      >
        <ul className="space-y-1.5">
          {analysis.issues.map((i, idx) => (
            <li key={idx} className="text-xs text-destructive">
              • {i.message}
            </li>
          ))}
        </ul>
        <Button variant="outline" size="sm" className="mt-3" onClick={onDiscard}>
          بستن و شروع دوباره
        </Button>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <Panel
        title="خلاصهٔ پیش‌نمایش"
        icon={<Layers className="size-4 text-primary" aria-hidden="true" />}
        description="چیزی هنوز اعمال نشده است. انتخاب‌ها و تعارض‌ها را ببینید، بعد تأیید کنید."
        action={
          <Button variant="ghost" size="sm" onClick={onDiscard}>
            انصراف
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile icon={<Sparkles className="size-4" />} label="موارد جدید" value={toFa(totalNew)} />
          <StatTile
            icon={<Layers className="size-4" />}
            label="تداخل‌ها"
            value={toFa(analysis.conflicts.length)}
            toneKey={analysis.conflicts.length ? "amber" : "slate"}
          />
          <StatTile
            icon={<ClipboardCopy className="size-4" />}
            label="تکراری‌ها"
            value={toFa(analysis.duplicates.length)}
            toneKey={analysis.duplicates.length ? "amber" : "slate"}
          />
          <StatTile
            icon={<AlertTriangle className="size-4" />}
            label="هشدارها"
            value={toFa(analysis.issues.filter((i) => i.level === "warning").length)}
            toneKey={analysis.issues.some((i) => i.level === "warning") ? "amber" : "slate"}
          />
        </div>

        {/* what will be created */}
        <fieldset className="mt-4 space-y-2">
          <legend className="text-xs font-extrabold">مواردی که وارد فضای کاری می‌شوند</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {(Object.keys(ENTITY_LABELS) as Array<keyof AIPlanBody>).map((key) => {
              const n = analysis.newCounts[key] ?? 0;
              return (
                <label
                  key={key}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs",
                    n === 0 && "opacity-50",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selection[key] !== false}
                    disabled={n === 0}
                    onChange={(e) => onToggle(key, e.target.checked)}
                    className="size-4 accent-primary"
                  />
                  <span className="flex-1">{ENTITY_LABELS[key]}</span>
                  <span className="font-extrabold tabular-nums">{toFa(n)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {titles && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-bold text-primary">
              مشاهدهٔ فهرست موارد ({toFa(selectedTotal)} مورد)
            </summary>
            <ul className="mt-1.5 space-y-1.5">
              {(Object.keys(ENTITY_LABELS) as Array<keyof AIPlanBody>)
                .filter((k) => (titles[k] ?? []).length > 0)
                .map((k) => (
                  <li key={k} className="text-[11px] leading-5">
                    <span className="font-bold">{ENTITY_LABELS[k]}:</span>{" "}
                    <span className="text-muted-foreground">{titles[k].join(" • ")}</span>
                  </li>
                ))}
            </ul>
          </details>
        )}

        {analysis.issues.length > 0 && (
          <details className="mt-3" open={expanded}>
            <summary
              className="cursor-pointer text-xs font-bold text-amber-600"
              onClick={() => setExpanded((v) => !v)}
            >
              هشدارها و فیلدهای کنارگذاشته‌شده ({toFa(analysis.issues.length)})
            </summary>
            <ul className="mt-1.5 space-y-1">
              {analysis.issues.map((i, idx) => (
                <li key={idx} className="text-[11px] text-muted-foreground">
                  • <span className="font-bold">{i.field}</span>: {i.message}
                </li>
              ))}
            </ul>
          </details>
        )}

        {analysis.conflicts.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-extrabold">تعارض‌های زمان‌بندی</p>
            <ul className="space-y-1.5">
              {analysis.conflicts.map((c, idx) => (
                <li
                  key={idx}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-[11px]",
                    c.blocking ? "border-amber-500/50 bg-amber-500/5" : "border-border/60",
                  )}
                >
                  <span className="font-bold">{CONFLICT_LABELS[c.kind]}</span>
                  {c.day && <span> — {c.day}</span>}
                  <p className="text-muted-foreground">{c.detail}</p>
                  {c.items.length > 0 && (
                    <p className="mt-0.5 text-muted-foreground">موارد: {c.items.join("، ")}</p>
                  )}
                </li>
              ))}
            </ul>
            <label className="flex items-center gap-2 text-[11px]">
              <input
                type="checkbox"
                checked={includeConflicts}
                onChange={(e) => setIncludeConflicts(e.target.checked)}
                className="size-4 accent-primary"
              />
              با وجود این تعارض‌ها، بلوک‌های زمانی را هم وارد کن
            </label>
          </div>
        )}

        {analysis.duplicates.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-extrabold">موارد تکراری (در فضای کاری وجود دارند)</p>
            <ul className="space-y-1">
              {analysis.duplicates.slice(0, 8).map((d, idx) => (
                <li key={idx} className="text-[11px] text-muted-foreground">
                  • {d.importedTitle} ← {d.existingTitle}
                </li>
              ))}
            </ul>
            <label className="flex items-center gap-2 text-[11px]">
              <input
                type="checkbox"
                checked={includeDuplicates}
                onChange={(e) => setIncludeDuplicates(e.target.checked)}
                className="size-4 accent-primary"
              />
              این موارد تکراری را هم بساز (پیش‌فرض: رد می‌شوند)
            </label>
          </div>
        )}

        {/* confirmation */}
        <div className="mt-4 space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs font-extrabold">برنامه اعمال شود؟</p>
          <p className="text-[11px] leading-5 text-muted-foreground">
            {toFa(selectedTotal)} مورد انتخاب‌شده به فضای کاری شما اضافه می‌شود. هیچ کار، پروژه،
            هدف یا رویداد موجودی حذف یا بازنویسی نمی‌شود.
            {blockingCount > 0 && (
              <span className="block font-bold text-amber-600">
                {toFa(blockingCount)} تعارض نیاز به تصمیم شما دارد.
              </span>
            )}
          </p>
          <Button
            onClick={onApply}
            disabled={applying || selectedTotal === 0}
            className="w-full sm:w-auto"
          >
            {applying ? "در حال اعمال…" : "بله، برنامه را اعمال کن"}
            <CheckCircle2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </Panel>
    </div>
  );
}
