import { query, queryOne } from "@/lib/db/client";
import type { ConceptResource, ResourceKind } from "@/lib/db/types";

// A4 — external "where to learn" pointers. Routes OUT; stores no content (§5).

export async function listResourcesByConcept(conceptId: number): Promise<ConceptResource[]> {
  return query<ConceptResource>(
    `SELECT * FROM concept_resource WHERE concept_id = $1 ORDER BY priority ASC, id ASC`,
    [conceptId]
  );
}

export interface ResourceWithConcept extends ConceptResource {
  concept_name: string;
}

export async function listAllResources(): Promise<ResourceWithConcept[]> {
  return query<ResourceWithConcept>(
    `SELECT r.*, c.name AS concept_name
     FROM concept_resource r
     JOIN concept c ON c.id = r.concept_id
     ORDER BY c.name, r.priority ASC, r.id ASC`
  );
}

export async function addResource(input: {
  concept_id: number;
  kind: ResourceKind | null;
  label: string;
  url: string | null;
  priority: number;
}): Promise<ConceptResource> {
  const row = await queryOne<ConceptResource>(
    `INSERT INTO concept_resource (concept_id, kind, label, url, priority)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.concept_id, input.kind, input.label, input.url, input.priority]
  );
  return row!;
}

export async function deleteResource(id: number): Promise<void> {
  await query(`DELETE FROM concept_resource WHERE id = $1`, [id]);
}
