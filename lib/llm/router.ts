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

// Reasoning models (DeepSeek V3.1 hybrid, etc.) bill thinking tokens against
// max_tokens, so leaving reasoning on for a deterministic task can starve the
// answer and return empty content (finish_reason=length). `{ enabled: false }`
// turns thinking off; an effort level caps it. Honoured on the OpenAI wire
// format (OpenRouter); the Anthropic format ignores it for now.
export type ReasoningOption = { enabled: false } | { effort: "low" | "medium" | "high" };

export interface CompleteOptions {
  system?: string | SystemSegment[];
  messages: ChatMessage[];
  task?: LlmTask;
  maxTokens?: number;
  reasoning?: ReasoningOption;
  // §8 escalation: a tutor turn flagged complex uses the strong model. Every
  // other case stays on the cheap model (Hard Rule §4 cost discipline).
  complex?: boolean;
  // Enable live web search for this call (OpenRouter web plugin). Only honoured
  // on the OpenAI wire format; ignored otherwise. Used by the tutor for accuracy.
  web?: boolean;
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

// Route each task to the cheapest model that clears the bar (Hard Rule §4).
// Tutor turns can run on a dedicated model (LLM_MODEL_TUTOR) independent of the
// bulk cheap/strong models — e.g. a Gemini Flash via OpenRouter for nicer
// explanations while generation stays on DeepSeek. When that's unset, tutor uses
// the strong model only when a turn is flagged complex (§8), else the cheap one.
// Every other task uses the cheap model. Defaults match .env.example's
// DeepSeek-direct option so a clean setup resolves to real slugs.
function modelForTask(task: LlmTask, complex = false): string {
  const cheap = process.env.LLM_MODEL_CHEAP ?? "deepseek-chat";
  const strong = process.env.LLM_MODEL_STRONG ?? "deepseek-reasoner";
  if (task === "tutor") {
    return process.env.LLM_MODEL_TUTOR ?? (complex ? strong : cheap);
  }
  return cheap;
}

// Per-call reasoning override wins; otherwise LLM_REASONING_EFFORT sets the
// default (none/off disables thinking, low/medium/high caps it), falling back
// to a low cap. Keeps reasoning policy in config, not hardcoded per call.
function reasoningConfig(override?: ReasoningOption): ReasoningOption {
  if (override) return override;
  const e = process.env.LLM_REASONING_EFFORT?.toLowerCase();
  if (e === "none" || e === "off" || e === "0") return { enabled: false };
  if (e === "low" || e === "medium" || e === "high") return { effort: e };
  return { effort: "low" };
}

// Lets non-core features (diagnosis, generation) degrade gracefully when the
// LLM isn't configured, instead of throwing into the user's flow.
export function isLlmConfigured(): boolean {
  return Boolean(process.env.LLM_BASE_URL && process.env.LLM_API_KEY);
}

// Whether the tutor should run with live web search. On by default but only
// effective on the OpenAI wire format (the web plugin is OpenRouter's), so a
// DeepSeek-direct (anthropic) setup transparently runs without it. Set
// LLM_TUTOR_WEB_SEARCH=0 to disable (cost — web results are billed per call).
export function tutorWebSearchEnabled(): boolean {
  const v = process.env.LLM_TUTOR_WEB_SEARCH;
  const on = v !== "0" && v !== "false";
  return on && apiFormat() === "openai";
}

function webMaxResults(): number {
  return Number(process.env.LLM_WEB_MAX_RESULTS ?? 3);
}

// --- Grounded provider (Gemini + Google Search) -----------------------------
// A dedicated path for calls that must be grounded in live web search with
// citations, kept separate from the global LLM_API_FORMAT so bulk generation and
// verification stay on the cheap provider (Hard Rule §4). Gemini's native
// generateContent is the only wire format that returns groundingMetadata, so it
// lives behind its own adapter. Business logic calls completeGrounded() without
// knowing the vendor (§13 dependency inversion).

export interface Citation {
  uri: string;
  title?: string;
}

export interface GroundedResult {
  text: string;
  citations: Citation[];
  // True when the response carried grounding metadata (Google Search actually
  // ran and returned ≥1 web source). False means the model answered from its
  // own memory — callers that require grounding (CA ingestion, Hard Rule §2.1)
  // must reject the result.
  grounded: boolean;
}

export function isGroundingConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function groundingBaseUrl(): string {
  return (process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta").replace(
    /\/$/,
    ""
  );
}

function groundingModel(): string {
  return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
}

// One grounded turn. Folds system segments into Gemini's system_instruction and
// maps assistant→model roles. Enables the google_search tool so the response is
// grounded and carries citations.
export async function completeGrounded(opts: {
  system?: string | SystemSegment[];
  messages: ChatMessage[];
  maxTokens?: number;
}): Promise<GroundedResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Grounding provider not configured: set GEMINI_API_KEY.");
  }

  const systemText = toSegments(opts.system)
    .map((s) => s.text)
    .join("\n\n");

  const body = {
    ...(systemText ? { system_instruction: { parts: [{ text: systemText }] } } : {}),
    contents: opts.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    tools: [{ google_search: {} }],
    generationConfig: { maxOutputTokens: opts.maxTokens ?? 4096 },
  };

  const res = await fetch(`${groundingBaseUrl()}/models/${groundingModel()}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Grounded LLM request failed (${res.status}): ${detail.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    candidates?: {
      content?: { parts?: { text?: string }[] };
      finishReason?: string;
      groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] };
    }[];
  };
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text) {
    throw new Error(
      `Grounded LLM returned an empty response (finishReason=${candidate?.finishReason ?? "?"}) — ` +
        `raise maxTokens.`
    );
  }

  const chunks = candidate?.groundingMetadata?.groundingChunks ?? [];
  const citations: Citation[] = [];
  const seen = new Set<string>();
  for (const c of chunks) {
    const uri = c.web?.uri;
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    citations.push({ uri, ...(c.web?.title ? { title: c.web.title } : {}) });
  }

  return { text, citations, grounded: citations.length > 0 };
}

export async function complete(opts: CompleteOptions): Promise<string> {
  const baseUrl = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;

  // Fail fast with a clear, actionable error rather than a vague network failure.
  if (!baseUrl || !apiKey) {
    throw new Error("LLM router not configured: set LLM_BASE_URL and LLM_API_KEY.");
  }

  const model = modelForTask(opts.task ?? "bulk", opts.complex);
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

// Anthropic Messages API shape (DeepSeek's /anthropic endpoint, Anthropic):
// x-api-key + anthropic-version auth, and a content-block response (NOT OpenAI
// `choices`). The system prompt rides as content blocks so the cacheable prefix
// can carry a cache_control breakpoint (§8 / Hard Rule §4).
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
      system: anthropicSystem(opts.system),
      messages: opts.messages,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LLM request failed (${res.status}): ${detail.slice(0, 500)}`);
  }

  // Messages API returns content blocks; concatenate the text blocks and skip
  // any non-text (e.g. thinking) blocks. There is no OpenAI-style `choices`.
  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
    stop_reason?: string;
  };
  const text = (data.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text!.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
  if (!text) {
    throw new Error(
      `LLM returned an empty response (stop_reason=${data.stop_reason ?? "?"}). ` +
        `Likely the output budget was exhausted — raise max_tokens or lower reasoning effort.`
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
      // Reasoning policy (config-driven, per-call override). Off keeps the whole
      // budget for the answer; a cap keeps thinking from eating max_tokens.
      // OpenRouter passes this through; ignored by non-reasoning models.
      reasoning: reasoningConfig(opts.reasoning),
      // Live web search via OpenRouter's web plugin, when requested (tutor).
      ...(opts.web ? { plugins: [{ id: "web", max_results: webMaxResults() }] } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LLM request failed (${res.status}): ${detail.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
  };
  const choice = data.choices?.[0];
  const text = choice?.message?.content?.trim();
  if (!text) {
    const reason = choice?.finish_reason ?? "?";
    const hint =
      reason === "length"
        ? " — output truncated by the token budget; raise maxTokens or disable reasoning (LLM_REASONING_EFFORT=none)"
        : " — likely the reasoning budget ate max_tokens; raise it or lower reasoning effort";
    throw new Error(`LLM returned an empty response (finish_reason=${reason})${hint}`);
  }
  return text;
}
