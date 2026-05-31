-- v6.1: scraper dedupe — content_hash on current_affairs_item so re-running the
-- Firecrawl ingest on the same source/day inserts zero new rows. Partial unique
-- so pre-existing rows (NULL hash) stay valid; the scraper always supplies a hash.
ALTER TABLE current_affairs_item ADD COLUMN IF NOT EXISTS content_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ca_content_hash
  ON current_affairs_item (content_hash)
  WHERE content_hash IS NOT NULL;
