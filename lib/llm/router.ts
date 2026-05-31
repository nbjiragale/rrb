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

// A system prompt may be split into segments so the stable prefix (persona +
// nightly profile + syllabus) can carry a cache breakpoint while volatile,
// per-call context stays uncached (§8 / Hard Rule §4 cost discipline).
export interface SystemSegment {
  text: string;
  cache?: boolean; // attach a cache breakpoint (default true)
}

export interface CompleteOptions {
  system?: string | SystemSegment[];
  messages: ChatMessage[];
  task?: LlmTask;
  maxTokens?: number;
}

// Prompt caching is on by default; LLM_PROMPT_CACHE=0/false disables it as an
// escape hatch for providers that reject cache_control on the /anthropic shape.
function promptCacheEnabled(): boolean {
  const v = process.env.LLM_PROMPT_CACHE;
  return v !== "0" && v !== "false";
}

function toSegments(system?: string | SystemSegment[]): SystemSegment[] {
  if (!system) return [];
  const segs = typeof system === "string" ? [{ text: system }] : system;
  return segs.filter((s) => s.text);
}

type ApiFormat = "anthropic" | "openai";

function apiFormat(): ApiFormat {
  return process.env.LLM_API_FORMAT === "openai" ? "openai" : "anthropic";
}

// Route each task to the cheapest model that clears the bar (cost discipline).
// Strong model reserved for tasks that need it; default is the cheap bulk model.
function modelForTask(task: LlmTask): string {
  const cheap = process.env.LLM_MODEL_CHEAP ?? "deepseek/deepseek-v4-flash";
  const strong = process.env.LLM_MODEL_STRONG ?? "deepseek/deepseek-v4-pro";
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

// Render the system prompt as Anthropic content blocks, attaching a cache
// breakpoint to cacheable segments. Returns undefined when there's no system.
function anthropicSystem(system?: string | SystemSegment[]) {
  const segs = toSegments(system);
  if (segs.length === 0) return undefined;
  const cache = promptCacheEnabled();
  return segs.map((s) => ({
    type: "text" as const,
    text: s.text,
    ...(cache && s.cache !== false ? { cache_control: { type: "ephemeral" as const } } : {}),
  }));
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
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 1024,
      system: anthropicSystem(opts.system),
      messages: opts.messages,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LLM request failed (${res.status}): ${detail.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: {
      message?: { content?: string | null; reasoning?: string | null };
      finish_reason?: string;
    }[];
  };
  const choice = data.choices?.[0];
  // Some reasoning models return the answer in `reasoning` if `content` is
  // empty (e.g. budget exhausted before the final answer block). Fall back.
  const text = (choice?.message?.content ?? choice?.message?.reasoning ?? "").trim();
  if (!text) {
    throw new Error(
      `LLM returned an empty response (finish_reason=${choice?.finish_reason ?? "?"}). ` +
        `Likely the reasoning budget ate max_tokens — raise it or lower reasoning effort.`
    );
  }
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
  // OpenAI-compatible providers (OpenAI, DeepSeek, OpenRouter) cache long stable
  // prefixes automatically, so we flatten the segments into one system message
  // and don't send cache_control (some providers reject unknown fields).
  const systemText = toSegments(opts.system)
    .map((s) => s.text)
    .join("\n\n");
  const messages = systemText
    ? [{ role: "system" as const, content: systemText }, ...opts.messages]
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
      // Cap reasoning effort — keeps latency and cost down and leaves the
      // response budget for the answer. OpenRouter passes this through to
      // providers that support it; ignored by non-reasoning models.
      reasoning: { effort: "low" },
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
