/**
 * Phase 16 — strict insight response parsing (§11, §26, §28).
 *
 * The parser is where "AI must never invent" is actually ENFORCED at the
 * boundary. It refuses, rather than repairs:
 *
 *   - an interpretation for a `pattern_type` that `patterns.ts` did not prove;
 *   - a `severity` or `confidence` outside the closed vocabularies;
 *   - evidence lines that are not label/value pairs;
 *   - a review whose sections are not the fixed, declared keys;
 *   - any action that fails the Phase 15 validator (reused verbatim).
 *
 * Total: never throws. A malformed insight degrades to `insufficient_data`
 * with an honest warning, and the UI still renders the DETERMINISTIC patterns —
 * so a bad model response can never reduce the product to a fake answer (§22).
 */
import { validateActions } from "./actions";
import { extractJsonObject } from "./parse";
import type { AIAction, AIResult, AIFailureKind } from "./types";
import {
  AI_MAX_INSIGHTS,
  AI_MAX_REVIEW_LINES,
  AI_PATTERN_TYPES,
  CONFIDENCE_LABELS_FA,
  SEVERITY_LABELS_FA,
  SUPPORTED_AI_INSIGHT_VERSIONS,
  AI_INSIGHT_SCHEMA_VERSION,
  type AIInsightConfidence,
  type AIInsightInterpretation,
  type AIInsightResponse,
  type AIInsightResponseType,
  type AIInsightSection,
  type AIInsightSeverity,
  type AIPatternType,
  type AutomationSuggestion,
  type DetectedPattern,
} from "./insight-types";

/*
 * NOTE ON SEVERITY AND CONFIDENCE
 * The response contract still declares `severity` and `confidence` on each
 * interpretation, but the parser deliberately IGNORES them and uses the
 * deterministic verdict instead. Keeping the fields in the contract lets the
 * prompt stay self-describing; ignoring them here is what stops a model from
 * downgrading a real warning to "info" or escalating to "critical" (§11).
 */

const RESPONSE_TYPES: readonly AIInsightResponseType[] = [
  "insight",
  "review",
  "insufficient_data",
];

/* ------------------------------------------------------------------ */
/* Field readers                                                       */
/* ------------------------------------------------------------------ */

function str(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  const t = v.trim();
  return t.length > max ? t.slice(0, max) : t;
}

function patternType(v: unknown): AIPatternType | undefined {
  return typeof v === "string" && (AI_PATTERN_TYPES as readonly string[]).includes(v)
    ? (v as AIPatternType)
    : undefined;
}

function evidenceList(v: unknown, cap: number) {
  if (!Array.isArray(v)) return [];
  const out: Array<{ label: string; value: string }> = [];
  for (const item of v.slice(0, cap)) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    const label = str(r.label, 60);
    const value = str(r.value, 120);
    if (label && value) out.push({ label, value });
  }
  return out;
}

function sectionsList(v: unknown, allowed: readonly string[] | null): AIInsightSection[] {
  if (!Array.isArray(v)) return [];
  const out: AIInsightSection[] = [];
  for (const item of v.slice(0, 12)) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    const key = str(r.key, 40);
    if (!key) continue;
    if (allowed && !(allowed as readonly string[]).includes(key)) continue;
    const lines = Array.isArray(r.lines)
      ? r.lines
          .slice(0, AI_MAX_REVIEW_LINES)
          .map((l) => str(l, 220))
          .filter(Boolean)
      : [];
    if (lines.length === 0) continue;
    out.push({ key, lines });
  }
  return out;
}

function automation(v: unknown): AutomationSuggestion | null {
  if (typeof v !== "object" || v === null) return null;
  const r = v as Record<string, unknown>;
  const title = str(r.title, 100);
  const why = str(r.why, 200);
  // A suggestion is only ever TEXT shown for the user to act on (§18).
  return title && why ? { title, why } : null;
}

/* ------------------------------------------------------------------ */
/* Public entry point                                                  */
/* ------------------------------------------------------------------ */

export interface ParseInsightOptions {
  persona: string;
  /** The patterns the deterministic engine actually proved. */
  proven: DetectedPattern[];
  /** Allowed review section keys, when the response is a review. */
  allowedSections?: readonly string[];
  contextSources: string[];
}

/**
 * Parse + validate a model response.
 *
 * Returns `insufficient: true` when the model had nothing usable — the caller
 * then renders the deterministic patterns alone, which is the correct product
 * behaviour rather than showing an empty or invented insight.
 */
export function parseInsightResponse(
  raw: string,
  opts: ParseInsightOptions,
): AIResult<{
  response: AIInsightResponse;
  unexplainedPatterns: DetectedPattern[];
  insufficient: boolean;
  confidence: AIInsightConfidence;
}> {
  const fail = (failure: AIFailureKind, message: string): AIResult<never> => ({
    ok: false,
    failure,
    message,
    retryable: true,
  });

  const provenByType = new Map(opts.proven.map((p) => [p.type, p]));
  const warnings: string[] = [];

  if (!raw || raw.trim().length === 0) {
    return fail("empty_response", "پاسخی از دستیار دریافت نشد.");
  }
  const candidate = extractJsonObject(raw);
  if (!candidate) return fail("invalid_response", "پاسخ دستیار قابل خواندن نبود.");

  let doc: unknown;
  try {
    doc = JSON.parse(candidate) as unknown;
  } catch {
    return fail("invalid_response", "ساختار پاسخ دستیار معتبر نبود.");
  }
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    return fail("invalid_response", "ساختار پاسخ دستیار معتبر نبود.");
  }

  const d = doc as Record<string, unknown>;

  /* ---- version gate ---- */
  const version = typeof d.schema_version === "string" ? d.schema_version : "";
  if (!version || !(SUPPORTED_AI_INSIGHT_VERSIONS as readonly string[]).includes(version)) {
    return fail("invalid_response", "نسخهٔ قالب بینش پشتیبانی نمی‌شود؛ پاسخ استفاده نشد.");
  }

  const type = RESPONSE_TYPES.includes(d.response_type as AIInsightResponseType)
    ? (d.response_type as AIInsightResponseType)
    : "insight";

  const summary = str(d.summary, 600);
  if (!summary) return fail("invalid_response", "خلاصهٔ پاسخ دستیار خالی بود.");

  /* ---- interpretations: MUST map to proven patterns ---- */
  const interpretations: AIInsightInterpretation[] = [];
  const addressed = new Set<AIPatternType>();

  if (Array.isArray(d.interpretations)) {
    for (const item of d.interpretations.slice(0, AI_MAX_INSIGHTS)) {
      if (typeof item !== "object" || item === null) continue;
      const r = item as Record<string, unknown>;

      const pt = patternType(r.pattern_type);
      if (!pt) {
        warnings.push("یک تفسیر با نوع الگوی ناشناخته کنار گذاشته شد.");
        continue;
      }
      if (!provenByType.has(pt)) {
        // The model tried to discuss something the engine never detected.
        warnings.push("تفسیری برای الگویی که تشخیص داده نشده بود نادیده گرفته شد.");
        continue;
      }
      if (addressed.has(pt)) continue;

      const explanation = str(r.explanation, 900);
      const recommendation = str(r.recommendation, 600);
      if (!explanation) continue;

      const proven = provenByType.get(pt) as DetectedPattern;
      interpretations.push({
        patternType: pt,
        explanation,
        // A pattern with no recommendation is legitimate — better empty than
        // invented advice.
        recommendation,
        // Severity and confidence ALWAYS come from the deterministic verdict.
        // The model's own `severity` / `confidence` fields are ignored on
        // purpose: letting the model downgrade a warning to "info" would hide
        // a real signal, and letting it escalate to "critical" would invent
        // alarm. Both would violate §11.
        severity: proven.severity,
        confidence: proven.confidence,
        additionalEvidence: evidenceList(r.additional_evidence, 4),
        automationSuggestion: automation(r.automation_suggestion),
      });
      addressed.add(pt);
    }
  }

  /* ---- actions reuse the Phase 15 allowlist verbatim (§6) ---- */
  const plan = validateActions(d.actions);

  /* ---- sections ---- */
  const sections = sectionsList(d.sections, opts.allowedSections ?? null);
  if (opts.allowedSections && sections.length === 0 && type === "review") {
    warnings.push("بخش‌های مرور با کلیدهای مورد انتظار مطابقت نداشت.");
  }

  /* ---- raw warnings from the model, capped ---- */
  if (Array.isArray(d.warnings)) {
    for (const w of d.warnings.slice(0, 5)) {
      const s = str(w, 200);
      if (s) warnings.push(s);
    }
  }

  const unexplained = opts.proven.filter((p) => !addressed.has(p.type));
  if (unexplained.length > 0) {
    warnings.push(
      `${unexplained.length} الگوی شناسایی‌شده توسط دستیار توضیح داده نشد.`,
    );
  }
  if (plan.droppedCount > 0) {
    warnings.push(`${plan.droppedCount} پیشنهاد نامعتبر کنار گذاشته شد.`);
  }

  const insufficient = type === "insufficient_data" && interpretations.length === 0;

  // Overall confidence is the WEAKEST interpretation, never the strongest.
  const overall: AIInsightConfidence = interpretations.some(
    (i) => i.confidence === "limited_data",
  )
    ? "limited_data"
    : interpretations.some((i) => i.confidence === "emerging_pattern")
      ? "emerging_pattern"
      : interpretations.length > 0
        ? "strong_pattern"
        : "limited_data";

  const response: AIInsightResponse = {
    schema_version: AI_INSIGHT_SCHEMA_VERSION,
    response_type: insufficient ? "insufficient_data" : type,
    persona: str(d.persona, 40) || opts.persona,
    summary,
    interpretations,
    sections,
    actions: plan.actions.map((a) => a.action),
    warnings,
    unexplainedPatterns: unexplained.map((p) => p.type),
    context_version: str(d.context_version, 40),
    generated_at: Date.now(),
  };

  return {
    ok: true,
    data: {
      response,
      unexplainedPatterns: unexplained,
      insufficient,
      confidence: overall,
    },
  };
}

/** Persian label helper used by the UI. */
export function confidenceLabelFa(c: AIInsightConfidence): string {
  return CONFIDENCE_LABELS_FA[c] ?? c;
}

export function severityLabelFa(s: AIInsightSeverity): string {
  return SEVERITY_LABELS_FA[s] ?? s;
}

/** Re-export so callers can type stored plans without importing two modules. */
export type { AIAction };
