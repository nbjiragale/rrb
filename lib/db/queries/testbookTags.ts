import { query, type Executor } from "@/lib/db/client";

// Manual tag→concept overrides for the Testbook import resolver (migration 0009).

export async function getTagMap(
  executor?: Executor
): Promise<{ tag: string; concept_id: number }[]> {
  return query<{ tag: string; concept_id: number }>(
    `SELECT tag, concept_id FROM testbook_tag_map`,
    [],
    executor
  );
}

export async function setTagMapping(tag: string, conceptId: number): Promise<void> {
  await query(
    `INSERT INTO testbook_tag_map (tag, concept_id)
     VALUES ($1, $2)
     ON CONFLICT (tag) DO UPDATE SET concept_id = EXCLUDED.concept_id`,
    [tag.trim(), conceptId]
  );
}
