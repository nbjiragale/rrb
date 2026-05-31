import { revalidatePath } from "next/cache";
import { ingestFromSourcesEvents } from "@/lib/services/caScraper";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Disable all caching layers — this endpoint streams progressive results.
export const fetchCache = "force-no-store";

// Streaming endpoint for the "Scrape now" button. Returns NDJSON — one
// CaScrapeEvent per line — so the button can render live progress as each
// source is scraped, split, and ingested. The cron job uses the Promise
// wrapper in @/lib/services/caScraper and doesn't hit this route.
export async function POST(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Force the response headers to flush immediately. Without an initial
      // chunk, Next.js / Node can hold the response until the first event from
      // ingestFromSourcesEvents — which is a Firecrawl HTTP roundtrip away. The
      // padding line is a JSON object the client ignores (unknown type).
      controller.enqueue(encoder.encode(JSON.stringify({ type: "open" }) + "\n"));
      try {
        for await (const event of ingestFromSourcesEvents()) {
          // If the client navigated away, stop work — no point continuing to
          // hit Firecrawl / the LLM for results nobody will see.
          if (req.signal.aborted) return;
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(JSON.stringify({ type: "fatal", message }) + "\n"));
      } finally {
        // Revalidate so the ingested-sources list on /current-affairs refreshes
        // on the next navigation. Safe to call even on partial success.
        revalidatePath("/current-affairs");
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      // Some proxies buffer SSE-like streams unless told otherwise.
      "x-accel-buffering": "no",
    },
  });
}
