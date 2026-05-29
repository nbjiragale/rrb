import { query, queryOne } from "@/lib/db/client";
import type { CurrentAffairsItem } from "@/lib/db/types";

// H1 — store a current-affairs source. raw_text is the grounding source for all
// downstream GA generation (Hard Rule §2.1); it is required by the column.
export async function insertCaItem(input: {
  ca_date: string;
  source_url?: string | null;
  raw_text: string;
  category?: string | null;
}): Promise<CurrentAffairsItem> {
  const row = await queryOne<CurrentAffairsItem>(
    `INSERT INTO current_affairs_item (ca_date, source_url, raw_text, category)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.ca_date, input.source_url ?? null, input.raw_text, input.category ?? null]
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
