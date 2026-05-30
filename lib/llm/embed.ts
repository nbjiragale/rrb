// Provider-agnostic embeddings (CLAUDE.md §3). Targets the de-facto standard
// OpenAI-compatible `/v1/embeddings` shape, which BGE-M3 / multilingual-e5 /
// Voyage hosts all expose — switching providers is a base-URL + key + model
// change in config only. 1024-d to match the pgvector column.

export const EMBED_DIM = 1024;

export function isEmbedConfigured(): boolean {
  return Boolean(process.env.EMBED_BASE_URL && process.env.EMBED_API_KEY);
}

function model(): string {
  return process.env.EMBED_MODEL ?? "bge-m3";
}

// Embed a batch in one request. Returns vectors aligned to the input order.
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const baseUrl = process.env.EMBED_BASE_URL;
  const apiKey = process.env.EMBED_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("Embeddings not configured: set EMBED_BASE_URL and EMBED_API_KEY.");
  }
  if (texts.length === 0) return [];

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/embeddings`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: model(), input: texts }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Embedding request failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as { data?: { embedding: number[] }[] };
  const vectors = data.data?.map((d) => d.embedding);
  if (!vectors || vectors.length !== texts.length) {
    throw new Error("Embedding response shape unexpected.");
  }
  return vectors;
}

export async function embed(text: string): Promise<number[]> {
  const [v] = await embedBatch([text]);
  return v;
}

// pgvector accepts a bracketed literal; cast with ::vector at the call site.
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

// Best-effort single embed for interactive write paths: returns null (store text
// now, backfill nightly) instead of throwing when embeddings aren't configured
// or the provider errors (graceful degradation, like the tutor/diagnosis paths).
export async function tryEmbed(text: string): Promise<number[] | null> {
  if (!isEmbedConfigured()) return null;
  try {
    return await embed(text);
  } catch (err) {
    console.error("embed failed:", err);
    return null;
  }
}
