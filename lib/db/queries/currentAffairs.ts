import { query, queryOne } from "@/lib/db/client";
import type { CurrentAffairsItem } from "@/lib/db/types";

// H1 — store a current-affairs source. raw_text is the grounding source for all
// downstream GA generation (Hard Rule §2.1); it is required by the column.
// exam_probability (H4) is set at ingest from the category prior.
export async function insertCaItem(input: {
  ca_date: string;
  source_url?: string | null;
  raw_text: string;
  category?: string | null;
  exam_probability?: number | null;
}): Promise<CurrentAffairsItem> {
  const row = await queryOne<CurrentAffairsItem>(
    `INSERT INTO current_affairs_item (ca_date, source_url, raw_text, category, exam_probability)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      input.ca_date,
      input.source_url ?? null,
      input.raw_text,
      input.category ?? null,
      input.exam_probability ?? null,
    ]
  );
  return row!;
}

export async function getCaItem(id: number): Promise<CurrentAffairsItem | null> {
  return queryOne<CurrentAffairsItem>(`SELECT * FROM current_affairs_item WHERE id = $1`, [id]);
}

export async function listCaItems(limit = 50): Promise<CurrentAffairsItem[]> {
  return query<CurrentAffairsItem>(
    `SELECT * FROM current_affairs_item ORDER BY ca_date DESC, id DESC LIMIT $1`,
    [limit]
  );
}

// Stamp the item once cards/questions have been built from it (provenance only;
// re-generation is allowed — the stamp is informational).
export async function markCaProcessed(id: number, summary?: string | null): Promise<void> {
  await query(
    `UPDATE current_affairs_item SET processed_at = now(), summary = COALESCE($2, summary) WHERE id = $1`,
    [id, summary ?? null]
  );
}

export async function setCaSummary(id: number, summary: string): Promise<void> {
  await query(`UPDATE current_affairs_item SET summary = $2 WHERE id = $1`, [id, summary]);
}

// H3 — items for a digest day (defaults to the latest ingested day), highest
// exam-probability first.
export async function getDigest(date?: string): Promise<{ digestDate: string | null; items: CurrentAffairsItem[] }> {
  const day =
    date ??
    (await queryOne<{ d: string }>(`SELECT max(ca_date)::text AS d FROM current_affairs_item`))?.d ??
    null;
  if (!day) return { digestDate: null, items: [] };
  const items = await query<CurrentAffairsItem>(
    `SELECT * FROM current_affairs_item
     WHERE ca_date = $1
     ORDER BY exam_probability DESC NULLS LAST, id DESC`,
    [day]
  );
  return { digestDate: day, items };
}

// Nightly: items still missing a summary (bounded by the caller for cost).
export async function getUnsummarizedCaItems(limit = 10): Promise<CurrentAffairsItem[]> {
  return query<CurrentAffairsItem>(
    `SELECT * FROM current_affairs_item WHERE summary IS NULL ORDER BY ca_date DESC LIMIT $1`,
    [limit]
  );
}
