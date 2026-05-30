// Firecrawl client. Wraps the official SDK so callers don't bind to a specific
// API version — version drift was previously causing intermittent failures. The
// SDK is the path Firecrawl officially documents for Next.js. We keep this file
// thin and side-effect-free; the orchestrator in lib/services/caScraper.ts
// composes it with the LLM split + DB insert.
import { Firecrawl } from "firecrawl";

export function isFirecrawlConfigured(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY);
}

export interface FirecrawlScrapeResult {
  markdown: string;
  sourceUrl: string;
}

// Lazy singleton — instantiated on first use so module evaluation doesn't fail
// when the env var isn't set (e.g. during tests that don't touch scraping).
let client: Firecrawl | null = null;
function getClient(): Firecrawl {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("Firecrawl not configured: set FIRECRAWL_API_KEY.");
  }
  if (!client) client = new Firecrawl({ apiKey });
  return client;
}

export async function scrapeUrl(url: string): Promise<FirecrawlScrapeResult> {
  const fc = getClient();
  // onlyMainContent strips the navigation/footer noise so the LLM splitter
  // works on actual article text instead of menu links.
  const doc = await fc.scrape(url, { formats: ["markdown"], onlyMainContent: true });
  const markdown = doc.markdown?.trim();
  if (!markdown) {
    throw new Error(`Firecrawl returned no markdown for ${url}`);
  }
  return { markdown, sourceUrl: url };
}
