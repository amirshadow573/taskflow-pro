/**
 * Phase 15 — AI provider abstraction (§3, §26, §34).
 *
 * SERVER SIDE ONLY. This module reads credentials and performs network calls,
 * so it must only ever be imported from Convex actions/mutations — never from a
 * React component or page. API keys are read from the environment here and are
 * never placed in a return value, an error message, or any payload the client
 * can observe.
 *
 * Provider-agnostic by construction: `AIProvider` is a two-method contract and
 * the shipped implementation speaks the OpenAI-compatible chat-completions
 * protocol, which SambaNova, OpenAI, Groq, Together and most gateways expose.
 * Switching provider is an environment-variable change, not a code change.
 *
 * Failures are typed and never leak provider internals to the user (§24).
 */
import { AI_DEFAULT_TIMEOUT_MS, type AIResult, type AIFailureKind } from "./types";

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

export interface AIProviderConfig {
  /** Provider identity for usage records — never shown as raw config. */
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxTokens: number;
  temperature: number;
}

function num(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Reads provider configuration from the environment.
 * Returns null when the app is simply not configured — that is a normal,
 * fully-supported state (§24: the product works without AI).
 */
export function readProviderConfig(): AIProviderConfig | null {
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) return null;

  const baseUrl =
    process.env.AI_BASE_URL?.trim() || "https://api.sambanova.ai/v1";
  const model =
    process.env.AI_MODEL?.trim() || "Meta-Llama-3.3-70B-Instruct";

  return {
    provider: process.env.AI_PROVIDER?.trim() || "sambanova",
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    model,
    timeoutMs: num(process.env.AI_TIMEOUT_MS, AI_DEFAULT_TIMEOUT_MS, 3_000, 60_000),
    maxTokens: num(process.env.AI_MAX_TOKENS, 1_500, 256, 8_000),
    temperature: num(process.env.AI_TEMPERATURE, 0.2, 0, 1),
  };
}

/** True when an API key exists. Safe to call from a query (returns a boolean). */
export function isAIConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY?.trim());
}

/* ------------------------------------------------------------------ */
/* Request / response contracts                                        */
/* ------------------------------------------------------------------ */

export interface AICompletionRequest {
  system: string;
  /** The deterministic context block + the user's question. */
  user: string;
  /** Short assistant turns, oldest first. Never a source of truth (§22). */
  history: Array<{ role: "user" | "assistant"; content: string }>;
  /** JSON contract the model must satisfy. Kept separate for readability. */
  schemaHint: string;
}

export interface AIUsageInfo {
  promptTokens?: number;
  completionTokens?: number;
}

export interface AICompletionResult {
  content: string;
  usage: AIUsageInfo;
  latencyMs: number;
  provider: string;
  model: string;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  isConfigured(): boolean;
  complete(req: AICompletionRequest): Promise<AIResult<AICompletionResult>>;
}

/* ------------------------------------------------------------------ */
/* OpenAI-compatible client                                            */
/* ------------------------------------------------------------------ */

class OpenAICompatibleProvider implements AIProvider {
  private readonly config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  get name(): string {
    return this.config.provider;
  }

  get model(): string {
    return this.config.model;
  }

  isConfigured(): boolean {
    return true;
  }

  async complete(req: AICompletionRequest): Promise<AIResult<AICompletionResult>> {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    const messages = [
      { role: "system", content: req.system },
      ...req.history.map((h) => ({ role: h.role, content: h.content })),
      {
        role: "user",
        content: `${req.user}\n\n# قالب خروجی اجباری\n${req.schemaHint}`,
      },
    ];

    try {
      const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          // Ask for JSON mode; still parsed defensively (§16).
          response_format: { type: "json_object" },
        }),
      });

      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          failure: "provider_error",
          message: "پیکربندی دستیار هوش مصنوعی معتبر نیست.",
          retryable: false,
        };
      }
      if (res.status === 429) {
        return {
          ok: false,
          failure: "rate_limited",
          message: "درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.",
          retryable: true,
        };
      }
      if (!res.ok) {
        return {
          ok: false,
          failure: "provider_error",
          message: "دستیار هوش مصنوعی در دسترس نیست.",
          retryable: true,
        };
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const content = data.choices?.[0]?.message?.content ?? "";

      return {
        ok: true,
        data: {
          content,
          usage: {
            promptTokens: data.usage?.prompt_tokens,
            completionTokens: data.usage?.completion_tokens,
          },
          latencyMs: Date.now() - started,
          provider: this.config.provider,
          model: this.config.model,
        },
      };
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      const kind: AIFailureKind = aborted ? "timeout" : "provider_error";
      return {
        ok: false,
        failure: kind,
        message: aborted
          ? "زمان پاسخ دستیار به پایان رسید."
          : "ارتباط با دستیار هوش مصنوعی برقرار نشد.",
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Disabled provider                                                   */
/* ------------------------------------------------------------------ */

/**
 * Returned when no key is configured. Behaves like a provider so that no
 * caller needs a null check, and reports the honest `not_configured` state
 * instead of fabricating anything (§26, §28).
 */
class DisabledProvider implements AIProvider {
  readonly name = "disabled";
  readonly model = "none";
  isConfigured(): boolean {
    return false;
  }
  async complete(): Promise<AIResult<AICompletionResult>> {
    return {
      ok: false,
      failure: "not_configured",
      message: "دستیار هوش مصنوعی هنوز پیکربندی نشده است.",
      retryable: false,
    };
  }
}

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

let cached: AIProvider | null = null;

/**
 * Resolve the active provider. Cached per isolate; configuration is read from
 * the environment at first use.
 */
export function getAIProvider(): AIProvider {
  if (cached) return cached;
  const config = readProviderConfig();
  cached = config ? new OpenAICompatibleProvider(config) : new DisabledProvider();
  return cached;
}
