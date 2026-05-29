import { z } from "zod";

// Models wrap JSON in prose or ```json fences despite instructions. Pull out the
// first balanced {...} or [...] block and parse it, then validate with Zod so a
// malformed generation fails fast (§13 fail-fast) rather than flowing downstream.
export function parseJson<T>(raw: string, schema: z.ZodType<T>): T {
  const text = extractJsonBlock(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`LLM did not return valid JSON: ${raw.slice(0, 200)}`);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`LLM JSON failed validation: ${result.error.issues[0]?.message ?? "invalid"}`);
  }
  return result.data;
}

function extractJsonBlock(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? raw).trim();
  const start = body.search(/[[{]/);
  if (start === -1) return body;
  const open = body[start];
  const close = open === "{" ? "}" : "]";
  const end = body.lastIndexOf(close);
  return end > start ? body.slice(start, end + 1) : body;
}
