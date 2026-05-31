-- Grounded CA ingestion (Gemini + Google Search): per-item web provenance.
-- The Firecrawl path stores a single source_url; the Gemini path synthesises an
-- item from live search and carries the list of web sources Google Search
-- grounded it on. citations holds that list as [{ uri, title }, ...]. Additive
-- and nullable so existing rows and the Firecrawl path are unaffected.
ALTER TABLE current_affairs_item ADD COLUMN IF NOT EXISTS citations JSONB;
