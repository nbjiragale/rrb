// Provider-agnostic LLM router (Hard Rule §4, build brief §3). Business logic
<<<<<<< HEAD
// depends on this abstraction, never on a vendor SDK. Supports two wire formats
// behind one interface (§13 dependency inversion), chosen by LLM_API_FORMAT:
//   - "anthropic" (default): /v1/messages, x-api-key   — DeepSeek direct, Anthropic
//   - "openai": /v1/chat/completions, Bearer auth       — OpenRouter, OpenAI, etc.
// Swapping providers stays a config change (base URL + key + format + model).
=======
// depends on this abstraction, never on a vendor SDK. Targets the OpenAI
// chat-completions shape, which OpenRouter, DeepSeek, Together, Groq, and most
// other gateways expose natively — switching providers is a base-URL + key +
// model change in config only.
>>>>>>> claude/claude-md-docs-eoA6V

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

<<<<<<< HEAD
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
=======
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  for (const m of opts.messages) messages.push(m);

  const task = opts.task ?? "bulk";

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
>>>>>>> claude/claude-md-docs-eoA6V
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
<<<<<<< HEAD
      model,
      max_tokens: opts.maxTokens ?? 1024,
      system: opts.system,
      messages: opts.messages,
=======
      model: modelForTask(task),
      // Reasoning models (DeepSeek V4) spend tokens on internal chain-of-thought
      // that counts against max_tokens; budget generously so the visible answer
      // isn't truncated to empty.
      max_tokens: opts.maxTokens ?? 4096,
      messages,
      // Cap reasoning effort — RRB tutor explanations don't need xhigh; keeps
      // latency and cost down and leaves the response budget for the answer.
      // OpenRouter passes this through to providers that support it; ignored
      // by non-reasoning models.
      reasoning: { effort: "low" },
>>>>>>> claude/claude-md-docs-eoA6V
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
