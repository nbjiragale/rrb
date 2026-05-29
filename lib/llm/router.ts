// Provider-agnostic LLM router (Hard Rule §4, build brief §3). Business logic
// depends on this abstraction, never on a vendor SDK. Targets the Anthropic
// Messages API shape; DeepSeek and others expose a compatible endpoint, so
// switching providers is a base-URL + key + model change in config only.

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

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelForTask(opts.task ?? "bulk"),
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
