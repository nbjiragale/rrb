import { z } from "zod";
import { completeGrounded, isGroundingConfigured } from "@/lib/llm/router";
import { parseJson } from "@/lib/llm/json";
import { buildCaFetchSystemPrompt, buildCaFetchUserPrompt } from "@/lib/llm/prompts/generate";
import { caExamProbability } from "@/lib/caRanking";
import { insertCaItemDedup } from "@/lib/db/queries/currentAffairs";
import { contentHash, normaliseCategory } from "@/lib/caScraperHash";
import type { CaScrapeReport } from "@/lib/services/caScraper";

// Grounded CA ingestion strategy (alternative to the Firecrawl scraper). Gemini
// gathers recent exam-relevant news through Google Search; the synthesised text
// becomes the immutable grounding source (Hard Rule §2.1) and the search results
// are stored as citations for provenance.
//
// The grounding guarantee: the Firecrawl path keeps only excerpts that appear
// verbatim in a page we scraped (isGrounded). The analog here is the model's
// grounding metadata — if Google Search returned no web sources, the model
// answered from its own memory, which violates Hard Rule §2.1, so the whole
// batch is rejected and nothing is stored. Output is shaped to CaScrapeReport so
// the nightly cron handles both strategies uniformly.

const fetchItemSchema = z.object({
  raw_text: z.string().min(20),
  category: z.string().nullable().optional(),
});
const fetchSchema = z.array(fetchItemSchema);

function getMaxItems(): number {
  const n = Number(process.env.CA_GEMINI_MAX_ITEMS ?? 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 30) : 10;
}

export async function ingestFromGemini(opts?: { date?: string }): Promise<CaScrapeReport> {
  const report: CaScrapeReport = {
    scraped: 0,
    ingested: 0,
    skippedDuplicates: 0,
    droppedUngrounded: 0,
    errors: [],
  };

  if (!isGroundingConfigured()) {
    console.warn("ingestFromGemini: grounding not configured — set GEMINI_API_KEY.");
    return report;
  }

  const date = opts?.date ?? new Date().toISOString().slice(0, 10);
  const count = getMaxItems();

  let result;
  try {
    result = await completeGrounded({
      system: buildCaFetchSystemPrompt(),
      messages: [{ role: "user", content: buildCaFetchUserPrompt({ date, count }) }],
      // Headroom for the JSON array plus the model's grounded reasoning.
      maxTokens: 8192,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("ingestFromGemini: grounded fetch failed:", message);
    report.errors.push({ url: "gemini:google_search", message });
    return report;
  }
  report.scraped = 1;

  const items = parseJson(result.text, fetchSchema);

  // No grounding metadata ⇒ the model answered from memory, not from search.
  // Reject the whole batch (Hard Rule §2.1): ungrounded GA is impossible by
  // construction. Count what it tried to emit as dropped, store nothing.
  if (!result.grounded) {
    console.warn(`ingestFromGemini: response had no grounding metadata; dropped ${items.length} item(s).`);
    report.droppedUngrounded += items.length;
    return report;
  }

  for (const item of items) {
    const raw_text = item.raw_text.trim();
    const hash = contentHash(raw_text);
    const category = normaliseCategory(item.category ?? null);
    const row = await insertCaItemDedup({
      ca_date: date,
      source_url: result.citations[0]?.uri ?? null,
      raw_text,
      category,
      exam_probability: caExamProbability(category),
      content_hash: hash,
      citations: result.citations,
    });
    if (row) report.ingested++;
    else report.skippedDuplicates++;
  }

  return report;
}
