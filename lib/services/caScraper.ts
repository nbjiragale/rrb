import { z } from "zod";
import { complete, isLlmConfigured } from "@/lib/llm/router";
import { parseJson } from "@/lib/llm/json";
import {
  buildCaSplitSystemPrompt,
  buildCaSplitUserPrompt,
} from "@/lib/llm/prompts/generate";
import { isFirecrawlConfigured, scrapeUrl } from "@/lib/services/firecrawl";
import { caExamProbability } from "@/lib/caRanking";
import { insertCaItemDedup } from "@/lib/db/queries/currentAffairs";
import {
  addUtcDays,
  contentHash,
  expandSourceUrl,
  getCaSourceUrls,
  getMaxLookbackDays,
  isGrounded,
  normaliseCategory,
} from "@/lib/caScraperHash";

const splitItemSchema = z.object({
  raw_text: z.string().min(20),
  category: z.string().nullable().optional(),
});
const splitSchema = z.array(splitItemSchema);

export interface CaScrapeReport {
  scraped: number;
  ingested: number;
  skippedDuplicates: number;
  droppedUngrounded: number; // LLM emitted them but the excerpt wasn't in the source
  errors: { url: string; message: string }[];
}

// Re-export the env reader so server actions can check "are sources configured?"
// without pulling in the whole orchestrator's transitive deps.
export { getCaSourceUrls } from "@/lib/caScraperHash";

// Typed progress events streamed by ingestFromSourcesEvents. The streaming
// route serialises these as NDJSON so the button can render live progress.
// Keep the shape stable — clients pattern-match on `type`.
export type CaScrapeEvent =
  | { type: "skip"; reason: string }
  | { type: "start"; sources: number; date: string }
  | { type: "source-start"; url: string; index: number; total: number }
  | { type: "scrape-done"; url: string; chars: number }
  // The requested date's page had no extractable news (typically a not-yet-
  // published date serving a listing/fallback page) — walking back to an
  // earlier day.
  | { type: "date-skip"; url: string; date: string }
  | { type: "split-done"; url: string; emitted: number; grounded: number }
  | { type: "item"; url: string; ingested: number; skipped: number; remaining: number }
  | { type: "source-done"; url: string; ingested: number; skippedDuplicates: number; droppedUngrounded: number }
  | { type: "source-error"; url: string; message: string }
  | { type: "done"; report: CaScrapeReport };

export interface SplitResult {
  items: { raw_text: string; category: string | null }[];
  emitted: number; // total items the LLM returned (before grounding filter)
}

export async function splitCaPage(markdown: string): Promise<SplitResult> {
  const raw = await complete({
    system: buildCaSplitSystemPrompt(),
    messages: [{ role: "user", content: buildCaSplitUserPrompt({ sourceText: markdown }) }],
    task: "bulk",
    // Verbatim copy-out of source excerpts into JSON — no chain-of-thought needed.
    // Disabling reasoning stops thinking tokens from eating the budget (which
    // truncated the JSON and returned empty content, finish_reason=length).
    reasoning: { enabled: false },
    // Generous ceiling for the JSON array; OpenRouter clamps to the model's
    // actual output limit.
    maxTokens: 50000,
  });
  const parsed = parseJson(raw, splitSchema);
  const items: { raw_text: string; category: string | null }[] = [];
  for (const item of parsed) {
    if (!isGrounded(item.raw_text, markdown)) {
      // Log the dropped excerpt so the user can see why it failed — usually the
      // LLM paraphrased instead of copying verbatim.
      console.warn(`splitCaPage: dropped ungrounded item: ${item.raw_text.slice(0, 120)}…`);
      continue;
    }
    items.push({
      raw_text: item.raw_text.trim(),
      category: normaliseCategory(item.category ?? null),
    });
  }
  return { items, emitted: parsed.length };
}

// Streaming entry point — yields progress events for the UI. The cron job uses
// the Promise wrapper below; the streaming /api/ca/scrape route iterates this
// generator directly to push live updates to the button.
export async function* ingestFromSourcesEvents(
  opts?: { date?: string }
): AsyncGenerator<CaScrapeEvent, void, void> {
  const report: CaScrapeReport = {
    scraped: 0,
    ingested: 0,
    skippedDuplicates: 0,
    droppedUngrounded: 0,
    errors: [],
  };

  if (!isFirecrawlConfigured()) {
    yield { type: "skip", reason: "Firecrawl not configured — set FIRECRAWL_API_KEY." };
    yield { type: "done", report };
    return;
  }
  if (!isLlmConfigured()) {
    yield { type: "skip", reason: "LLM not configured — set LLM_BASE_URL and LLM_API_KEY." };
    yield { type: "done", report };
    return;
  }
  const templates = getCaSourceUrls();
  if (templates.length === 0) {
    yield { type: "skip", reason: "No sources configured — set CA_SOURCE_URLS." };
    yield { type: "done", report };
    return;
  }

  // Default to yesterday, not today: CA sites publish a day's page late, so
  // today's URL is almost always an unpublished listing/fallback page. Starting
  // from yesterday lands on real content in one scrape on the common path. An
  // explicit opts.date (e.g. a backfill) overrides this. The walk-back below
  // still covers the rare case yesterday isn't published either.
  const today = new Date().toISOString().slice(0, 10);
  const targetDate = opts?.date ?? addUtcDays(today, -1).toISOString().slice(0, 10);
  const maxLookback = getMaxLookbackDays();

  yield { type: "start", sources: templates.length, date: targetDate };

  for (let i = 0; i < templates.length; i++) {
    // Walk back from the requested date until a day actually has content. CA
    // sites publish a day's page late, so the target date often serves a
    // listing/fallback page (LLM emits 0 items); the previous published day is
    // what the user actually wants. Each item is stored under the date it came
    // from, so ca_date stays accurate. Dedup makes re-running idempotent.
    for (let back = 0; back <= maxLookback; back++) {
      const dateObj = addUtcDays(targetDate, -back);
      const date = dateObj.toISOString().slice(0, 10);
      const url = expandSourceUrl(templates[i], dateObj);
      yield { type: "source-start", url, index: i + 1, total: templates.length };

      try {
        const { markdown } = await scrapeUrl(url);
        report.scraped++;
        yield { type: "scrape-done", url, chars: markdown.length };

        const { items, emitted } = await splitCaPage(markdown);

        // No news found. A real page with genuine content always yields at
        // least one item, so emitted === 0 means this date isn't published —
        // step back a day. (Templates with no date token can't walk back, so
        // the loop naturally ends after this single attempt.)
        if (emitted === 0 && expandSourceUrl(templates[i], addUtcDays(targetDate, -(back + 1))) !== url) {
          yield { type: "date-skip", url, date };
          continue;
        }

        const droppedHere = emitted - items.length;
        report.droppedUngrounded += droppedHere;
        yield { type: "split-done", url, emitted, grounded: items.length };

        let ingestedHere = 0;
        let skippedHere = 0;
        for (let j = 0; j < items.length; j++) {
          const item = items[j];
          const hash = contentHash(item.raw_text);
          const row = await insertCaItemDedup({
            ca_date: date,
            source_url: url,
            raw_text: item.raw_text,
            category: item.category,
            exam_probability: caExamProbability(item.category),
            content_hash: hash,
          });
          if (row) {
            report.ingested++;
            ingestedHere++;
          } else {
            report.skippedDuplicates++;
            skippedHere++;
          }
          yield {
            type: "item",
            url,
            ingested: ingestedHere,
            skipped: skippedHere,
            remaining: items.length - (j + 1),
          };
        }

        yield {
          type: "source-done",
          url,
          ingested: ingestedHere,
          skippedDuplicates: skippedHere,
          droppedUngrounded: droppedHere,
        };
        // Found content for this source — stop walking back.
        break;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`ingestFromSources(${url}) failed:`, message);
        report.errors.push({ url, message });
        yield { type: "source-error", url, message };
        // A scrape/network error isn't a "not published" signal — don't hammer
        // Firecrawl walking back through older days; move to the next source.
        break;
      }
    }
  }

  yield { type: "done", report };
}

// Promise wrapper for non-streaming callers (cron job). Consumes the generator
// and returns the final report so existing callers keep working unchanged.
export async function ingestFromSources(opts?: { date?: string }): Promise<CaScrapeReport> {
  let final: CaScrapeReport | null = null;
  for await (const event of ingestFromSourcesEvents(opts)) {
    if (event.type === "done") final = event.report;
  }
  // `done` is always the last event emitted by the generator above, so this is
  // unreachable in practice — but TypeScript needs the assertion.
  if (!final) throw new Error("ingestFromSources: generator finished without a done event");
  return final;
}
