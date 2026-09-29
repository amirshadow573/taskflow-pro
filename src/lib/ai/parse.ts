/**
 * Phase 15 — structured response parsing (§4, §16, §25).
 *
 * Provider text is untrusted input. This module turns it into a typed
 * `AIResponse` plus a validated `ActionPlan`, or into a typed failure. It is
 * total: it never throws, never evaluates, and never repairs silently.
 *
 * Models routinely wrap JSON in prose or fences even under strict JSON mode,
 * so we extract the outermost balanced object first — then validate what came
 * out. Extraction is only about FINDING the payload; correctness is decided by
 * `validateActions`, not by the extraction.
 */
import { validateActions } from "./actions";
import {
  AI_RESPONSE_SCHEMA_VERSION,
  SUPPORTED_AI_RESPONSE_VERSIONS,
  type AIResponse,
  type AIResponseSection,
  type AIResponseType,
  type AIFailureKind,
  type AIResult,
  type ActionPlan,
} from "./types";

const MAX_SUMMARY = 400;
const MAX_SECTION_BODY = 2_000;
const MAX_SECTIONS = 8;
const MAX_LIST_ITEMS = 10;

const RESPONSE_TYPES: readonly AIResponseType[] = [
  "analysis",
  "action_plan",
  "refusal",
  "clarify",
];

function text(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  const t = v.trim();
  return t.length > max ? t.slice(0, max) : t;
}

function list(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v.slice(0, maxItems)) {
    const s = text(item, maxLen);
    if (s) out.push(s);
  }
  return out;
}

/**
 * Pull the first balanced `{...}` out of arbitrary text.
 * String-aware so a `}` inside a JSON string does not end the scan early.
 */
export function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      if (inString) escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}

function parseSections(raw: unknown): AIResponseSection[] {
  if (!Array.isArray(raw)) return [];
  const out: AIResponseSection[] = [];
  for (const item of raw.slice(0, MAX_SECTIONS)) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    const title = text(r.title, 80);
    const body = text(r.body, MAX_SECTION_BODY);
    if (!title && !body) continue;
    out.push({ key: text(r.key, 40) || `s${out.length + 1}`, title, body });
  }
  return out;
}

/**
 * Parse a provider's raw content string.
 *
 * Returns `ok: true` with an empty action plan for non-action responses; a
 * malformed document yields a typed failure rather than an exception.
 */
export function parseAIResponse(
  rawContent: string,
  opts: { contextSources: string[] },
): AIResult<{ response: AIResponse; plan: ActionPlan }> {
  const fail = (
    failure: AIFailureKind,
    message: string,
    retryable = false,
  ): AIResult<{ response: AIResponse; plan: ActionPlan }> => ({
    ok: false,
    failure,
    message,
    retryable,
  });

  if (!rawContent || rawContent.trim().length === 0) {
    return fail("empty_response", "پاسخی از دستیار دریافت نشد.", true);
  }

  const candidate = extractJsonObject(rawContent);
  if (!candidate) {
    return fail("invalid_response", "پاسخ دستیار قابل خواندن نبود.", true);
  }

  let doc: unknown;
  try {
    doc = JSON.parse(candidate) as unknown;
  } catch {
    return fail("invalid_response", "ساختار پاسخ دستیار معتبر نبود.", true);
  }

  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    return fail("invalid_response", "ساختار پاسخ دستیار معتبر نبود.", true);
  }

  const d = doc as Record<string, unknown>;

  /* ---- version gate: unknown contract → refuse, never guess (§9) ---- */
  const version = typeof d.schema_version === "string" ? d.schema_version : "";
  if (!version || !(SUPPORTED_AI_RESPONSE_VERSIONS as readonly string[]).includes(version)) {
    return fail(
      "invalid_response",
      "نسخهٔ قالب پاسخ پشتیبانی نمی‌شود؛ درخواست دوباره ارسال نشد.",
    );
  }

  const type = RESPONSE_TYPES.includes(d.response_type as AIResponseType)
    ? (d.response_type as AIResponseType)
    : "analysis";

  const summary = text(d.summary, MAX_SUMMARY);
  if (!summary) {
    return fail("invalid_response", "خلاصهٔ پاسخ دستیار خالی بود.", true);
  }

  /* ---- actions go through the allowlist validator ---- */
  const plan = validateActions(d.actions);
  const issues = [...plan.actions.flatMap((a) => a.issues)];
  if (plan.droppedCount > 0) {
    issues.push(`${plan.droppedCount} پیشنهاد نامعتبر کنار گذاشته شد.`);
  }

  const response: AIResponse = {
    schema_version: AI_RESPONSE_SCHEMA_VERSION,
    response_type: type,
    summary,
    sections: parseSections(d.sections),
    actions: plan.actions.map((a) => a.action),
    question: type === "clarify" ? text(d.question, 300) || undefined : undefined,
    context_sources: opts.contextSources,
    notes: [...list(d.notes, MAX_LIST_ITEMS, 200), ...issues],
  };

  /*
   * A refusal that still carries actions is contradictory: the model both
   * declined and asked to change something. Strip the actions rather than
   * showing the user a "no" next to a change list.
   */
  if (type === "refusal" || type === "clarify") {
    response.actions = [];
    response.sections = response.sections.slice(0, 2);
  }

  return {
    ok: true,
    data: {
      response,
      plan: { ...plan, actions: type === "refusal" || type === "clarify" ? [] : plan.actions },
    },
  };
}
