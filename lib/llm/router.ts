// Provider-agnostic LLM router (Hard Rule §4, build brief §3). Business logic
// depends on this abstraction, never on a vendor SDK. Supports two wire formats
// behind one interface (§13 dependency inversion), chosen by LLM_API_FORMAT:
//   - "anthropic" (default): /v1/messages, x-api-key   — DeepSeek direct, Anthropic
//   - "openai": /v1/chat/completions, Bearer auth       — OpenRouter, OpenAI, etc.
// Swapping providers stays a config change (base URL + key + format + model).

export type LlmTask = "tutor" | "classify" | "generate" | "bulk";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CompleteOptions {
  system?: string;
  messages: ChatMessage[];
  task?: LlmTask;
  maxTokens?: number;
}

type ApiFormat = "anthropic" | "openai";

function apiFormat(): ApiFormat {
  return process.env.LLM_API_FORMAT === "openai" ? "openai" : "anthropic";
}

// Route each task to the cheapest model that clears the bar (cost discipline).
// Strong model reserved for tasks that need it; default is the cheap bulk model.
function modelForTask(task: LlmTask): string {
  const cheap = process.env.LLM_MODEL_CHEAP ?? "deepseek-chat";
  const strong = process.env.LLM_MODEL_STRONG ?? cheap;
  return task === "tutor" ? strong : cheap;
}

// Lets non-core features (diagnosis, generation) degrade gracefully when the
// LLM isn't configured, instead of throwing into the user's flow.
export function isLlmConfigured(): boolean {
  return Boolean(process.env.LLM_BASE_URL && process.env.LLM_API_KEY);
}

export async function complete(opts: CompleteOptions): Promise<string> {
  const baseUrl = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;

  // Fail fast with a clear, actionable error rather than a vague network failure.
  if (!baseUrl || !apiKey) {
    throw new Error("LLM router not configured: set LLM_BASE_URL and LLM_API_KEY.");
  }

  const model = modelForTask(opts.task ?? "bulk");
  const root = baseUrl.replace(/\/$/, "");

  return apiFormat() === "openai"
    ? completeOpenAI(root, apiKey, model, opts)
    : completeAnthropic(root, apiKey, model, opts);
}

// Anthropic Messages API shape (DeepSeek's /anthropic endpoint, Anthropic).
async function completeAnthropic(
  root: string,
  apiKey: string,
  model: string,
  opts: CompleteOptions
): Promise<string> {
  const res = await fetch(`${root}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 1024,
      system: opts.system,
      messages: opts.messages,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LLM request failed (${res.status}): ${detail.slice(0, 500)}`);
  }

  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.map((b) => b.text ?? "").join("").trim();
  if (!text) throw new Error("LLM returned an empty response.");
  return text;
}

// OpenAI Chat Completions shape (OpenRouter, OpenAI, and compatibles). The
// Anthropic top-level `system` is folded into a leading system message.
async function completeOpenAI(
  root: string,
  apiKey: string,
  model: string,
  opts: CompleteOptions
): Promise<string> {
  const messages = opts.system
    ? [{ role: "system" as const, content: opts.system }, ...opts.messages]
    : opts.messages;

  const res = await fetch(`${root}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 1024,
      messages,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LLM request failed (${res.status}): ${detail.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("LLM returned an empty response.");
  return text;
}
