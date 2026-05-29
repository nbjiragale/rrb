import { query } from "@/lib/db/client";
import type { RelationType } from "@/lib/db/types";

export interface EdgeView {
  source_id: number;
  target_id: number;
  relation_type: RelationType;
  source_name: string;
  target_name: string;
}

export async function listEdges(): Promise<EdgeView[]> {
  return query<EdgeView>(
    `SELECT e.source_id, e.target_id, e.relation_type,
            s.name AS source_name, t.name AS target_name
     FROM concept_edge e
     JOIN concept s ON s.id = e.source_id
     JOIN concept t ON t.id = e.target_id
     ORDER BY s.name, e.relation_type`
  );
}

// Prerequisite target ids per source concept — the planner's learnability input.
export async function getPrerequisiteMap(): Promise<Map<number, number[]>> {
  const rows = await query<{ source_id: number; target_id: number }>(
    `SELECT source_id, target_id FROM concept_edge WHERE relation_type = 'prerequisite'`
  );
  const map = new Map<number, number[]>();
  for (const r of rows) {
    const list = map.get(r.source_id) ?? [];
    list.push(r.target_id);
    map.set(r.source_id, list);
  }
  return map;
}

export async function addEdge(input: {
  source_id: number;
  target_id: number;
  relation_type: RelationType;
}): Promise<void> {
  await query(
    `INSERT INTO concept_edge (source_id, target_id, relation_type)
     VALUES ($1, $2, $3)
     ON CONFLICT (source_id, target_id, relation_type) DO NOTHING`,
    [input.source_id, input.target_id, input.relation_type]
  );
}
