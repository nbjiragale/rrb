// Pure helpers for the Firecrawl → CA ingest pipeline. Lives outside lib/services
// so the test runner (plain Node, no path-alias resolver) can import it directly
// without dragging in DB / LLM / Firecrawl dependencies. The orchestrator in
// lib/services/caScraper.ts composes these with the I/O layer.

import { createHash } from "node:crypto";

// Allowed CA categories — kept in sync with the prior table in lib/caRanking.ts.
// Anything outside this set is treated as null so caExamProbability falls back
// to the neutral 0.5 prior rather than silently grading on an unknown bucket.
export const ALLOWED_CATEGORIES = [
  "appointments",
  "schemes",
  "awards",
  "defence",
  "summits",
  "agreements",
  "sports",
  "economy",
  "science",
  "technology",
  "days",
  "obituaries",
  "books",
] as const;

// Read CA_SOURCE_URLS as comma-separated URL templates. Templates may contain
// date tokens that get resolved per-run by expandSourceUrl (see below).
export function getCaSourceUrls(): string[] {
  const raw = process.env.CA_SOURCE_URLS ?? "";
  return raw
    .split(",")
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

// Expand date tokens in a source URL template. Tokens (using UTC to match the
// rest of the codebase's date handling — ingestFromSources passes the same date
// it stores in ca_date):
//   {day}       — day of month, unpadded   ("30", "5")
//   {day2}      — day of month, zero-padded ("30", "05")
//   {month}     — full month name lowercase ("may", "june")
//   {month2}    — numeric month zero-padded ("05", "12")
//   {year}      — 4-digit year              ("2026")
// Example: "https://affairscloud.com/current-affairs-{day}-{month}-{year}/"
// resolves to "https://affairscloud.com/current-affairs-30-may-2026/" on
// 2026-05-30. A template with no tokens passes through unchanged.
export function expandSourceUrl(template: string, date: Date): string {
  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth();
  const day = date.getUTCDate();
  const tokens: Record<string, string> = {
    "{day}": String(day),
    "{day2}": String(day).padStart(2, "0"),
    "{month}": MONTH_NAMES[monthIndex],
    "{month2}": String(monthIndex + 1).padStart(2, "0"),
    "{year}": String(year),
  };
  let out = template;
  for (const [token, value] of Object.entries(tokens)) {
    out = out.split(token).join(value);
  }
  return out;
}

// Lowercase + collapse whitespace so trivial reformatting (line breaks, double
// spaces) doesn't defeat dedupe.
export function normaliseForHash(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function contentHash(text: string): string {
  return createHash("sha256").update(normaliseForHash(text)).digest("hex");
}

export function normaliseCategory(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return (ALLOWED_CATEGORIES as readonly string[]).includes(key) ? key : null;
}

// Aggressive normalisation for the grounding check. The LLM rarely returns a
// truly verbatim slice of the source: it strips markdown decorations (**bold**,
// [text](url)), folds smart quotes to straight, drops zero-width chars, etc.
// We don't want to reject that — it's cosmetic. So we collapse BOTH sides to
// lowercase alphanumeric-only tokens before comparing. That preserves the
// "no inventing facts" guarantee (every word in the excerpt must still appear
// in the source, in order) while tolerating any cosmetic reformatting.
function normaliseForGrounding(text: string): string {
  return text
    .toLowerCase()
    // Strip raw URLs entirely — the LLM is told to skip these and we don't want
    // a URL in the source to dominate the comparison.
    .replace(/https?:\/\/\S+/g, " ")
    // Image syntax: ![alt](url) — drop entirely.
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    // Link syntax: [text](url) — keep the visible text only.
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    // Everything non-alphanumeric (punctuation, markdown markers *_#, Unicode
    // quotes/dashes/ellipsis, NBSP, zero-width) collapses to a single space.
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Grounding check — the LLM is instructed to return a substring of the SOURCE,
// but we re-verify in code so a misbehaving model can never sneak an invented
// "raw_text" into current_affairs_item (Hard Rule §2.1). Comparison is on the
// alphanumeric-only normalised form, so the LLM's cosmetic cleanup (stripped
// markdown, folded punctuation) doesn't drop a genuinely grounded excerpt.
//
// Even with reasoning off and a "verbatim" instruction, the model routinely
// elides an inline parenthetical or appositive from the middle of a sentence —
// e.g. source "...Company Limited (\"Canara HSBC Life Insurance\") to strengthen..."
// becomes "...Company Limited to strengthen...". That's still faithful (every
// word traces to the source, in order), just not a contiguous substring. So we
// fall back from substring to an ORDERED-SUBSEQUENCE match bounded to a local
// window: every excerpt word must appear in the source, in order, with only a
// few interspersed source words skipped. The window bound is what preserves the
// "no invented facts" guarantee — it stops a model from stitching words
// together from distant, unrelated parts of the page.
export function isGrounded(excerpt: string, source: string): boolean {
  const needleText = normaliseForGrounding(excerpt);
  if (needleText.length < 20) return false;
  const normSource = normaliseForGrounding(source);
  // Fast path: the fully-verbatim case (most excerpts).
  if (normSource.includes(needleText)) return true;

  const needle = needleText.split(" ");
  const hay = normSource.split(" ");
  // Allow up to ~50% of the excerpt length in skipped source tokens (min 12) —
  // enough for several inline parentheticals, far too few to bridge two items.
  const maxExtra = Math.max(12, Math.ceil(needle.length * 0.5));
  for (let start = 0; start < hay.length; start++) {
    if (hay[start] !== needle[0]) continue;
    const limit = start + needle.length + maxExtra;
    let n = 1;
    for (let h = start + 1; h < hay.length && h <= limit && n < needle.length; h++) {
      if (hay[h] === needle[n]) n++;
    }
    if (n === needle.length) return true;
  }
  return false;
}
