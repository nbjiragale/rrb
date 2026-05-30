// Provider-agnostic LLM router (Hard Rule §4, build brief §3). Business logic
// depends on this abstraction, never on a vendor SDK. Targets the OpenAI
// chat-completions shape, which OpenRouter, DeepSeek, Together, Groq, and most
// other gateways expose natively — switching providers is a base-URL + key +
// model change in config only.

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

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  for (const m of opts.messages) messages.push(m);

  const task = opts.task ?? "bulk";

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
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
