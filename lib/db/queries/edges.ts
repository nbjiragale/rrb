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

export async function removeEdge(input: {
  source_id: number;
  target_id: number;
  relation_type: RelationType;
}): Promise<void> {
  await query(
    `DELETE FROM concept_edge WHERE source_id = $1 AND target_id = $2 AND relation_type = $3`,
    [input.source_id, input.target_id, input.relation_type]
  );
}

export interface GraphNode {
  id: number;
  name: string;
  subject: string;
  topic: string;
  p_known: number;
}

export interface GraphEdge {
  source_id: number;
  target_id: number;
  relation_type: RelationType;
}

// Nodes (concepts coloured by current mastery) + edges, for the visual graph.
export async function getGraphData(): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const [nodes, edges] = await Promise.all([
    query<GraphNode>(
      `SELECT c.id, c.name, c.subject, c.topic, COALESCE(m.p_known, 0.1) AS p_known
       FROM concept c
       LEFT JOIN concept_mastery m ON m.concept_id = c.id
       ORDER BY c.subject, c.topic, c.name`
    ),
    query<GraphEdge>(
      `SELECT source_id, target_id, relation_type FROM concept_edge`
    ),
  ]);
  return { nodes, edges };
}

export interface ContrastConcept {
  concept_id: number;
  name: string;
  p_known: number;
}

// E4 — concepts this one "contrasts_with", with their mastery, so the tutor can
// explicitly disambiguate the pair the learner confuses when it's weak.
export async function getContrastConcepts(conceptId: number): Promise<ContrastConcept[]> {
  return query<ContrastConcept>(
    `SELECT t.id AS concept_id, t.name, COALESCE(m.p_known, 0.1) AS p_known
     FROM concept_edge e
     JOIN concept t ON t.id = e.target_id
     LEFT JOIN concept_mastery m ON m.concept_id = t.id
     WHERE e.source_id = $1 AND e.relation_type = 'contrasts_with'
     ORDER BY p_known ASC`,
    [conceptId]
  );
}

export interface PrerequisiteConcept {
  concept_id: number;
  name: string;
  p_known: number;
}

// §8 — the foundations this concept is built on (prerequisite edges, stored
// source=dependent → target=foundation), with their mastery, so the tutor can
// point at a weak foundation as the likely root of a struggle. Weakest first.
export async function getPrerequisiteConcepts(conceptId: number): Promise<PrerequisiteConcept[]> {
  return query<PrerequisiteConcept>(
    `SELECT t.id AS concept_id, t.name, COALESCE(m.p_known, 0.1) AS p_known
     FROM concept_edge e
     JOIN concept t ON t.id = e.target_id
     LEFT JOIN concept_mastery m ON m.concept_id = t.id
     WHERE e.source_id = $1 AND e.relation_type = 'prerequisite'
     ORDER BY p_known ASC`,
    [conceptId]
  );
}
