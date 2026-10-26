/**
 * Provider-agnostic OpenAI-compatible chat client.
 *
 * Interim: FastRouter (base https://api.fastrouter.ai/api/v1, model
 * openai/gpt-5.2). Migration (M-1): Meta Model API (base
 * https://api.meta.ai/v1, model muse-spark-1.3) plugs into this SAME
 * client via env — only the grounding adapter changes (M-2).
 *
 * The key comes from env at boot, is never logged, and usage (model +
 * token counts + cost when reported) is logged without content.
 */

export class LLMError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

export interface LLMClient {
  readonly provider: string;
  readonly model: string;
  completeJSON<T>(system: string, user: string, maxTokens?: number): Promise<T>;
}

export class OpenAICompatibleLLM implements LLMClient {
  constructor(
    readonly provider: string,
    readonly model: string,
    private baseUrl: string,
    private apiKey: string,
  ) {
    if (!apiKey) throw new LLMError("LLM API key is required");
  }

  async completeJSON<T>(system: string, user: string, maxTokens = 4000): Promise<T> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      // Generic message only. Provider error bodies are NEVER surfaced
      // to the client or the logs: a provider that echoes a rejected
      // key would leak it through the SSE trace otherwise (QA S5).
      throw new LLMError(`LLM request failed: HTTP ${res.status}`, res.status);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: Record<string, unknown>;
      model?: string;
    };
    // Usage only — never content.
    console.log(
      JSON.stringify({
        llm: { provider: this.provider, model: data.model ?? this.model, usage: data.usage ?? null },
      }),
    );
    const text = data.choices?.[0]?.message?.content ?? "";
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new LLMError("LLM did not return valid JSON");
    }
  }
}

export function llmClientFromEnv(env: NodeJS.ProcessEnv = process.env): LLMClient {
  const baseUrl = env["LLM_BASE_URL"] ?? "https://api.fastrouter.ai/api/v1";
  const model = env["LLM_MODEL"] ?? "openai/gpt-5.2";
  const isMeta = baseUrl.includes("meta.ai");
  const provider = isMeta ? "meta" : "fastrouter";
  // QA B1: M-1 puts the Meta key in MODEL_API_KEY, so a Meta base MUST
  // read MODEL_API_KEY — reading LLM_API_KEY here would either die
  // (unset) or send the FastRouter key to Meta (401). Strict: no fallback.
  const key = isMeta ? env["MODEL_API_KEY"] ?? "" : env["LLM_API_KEY"] ?? "";
  if (isMeta && !key) throw new LLMError("MODEL_API_KEY is required for a Meta base URL");
  return new OpenAICompatibleLLM(provider, model, baseUrl, key);
}
