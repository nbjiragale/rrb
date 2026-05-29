import { query, queryOne } from "@/lib/db/client";
import type { Concept, Subject } from "@/lib/db/types";

export async function listConcepts(): Promise<Concept[]> {
  return query<Concept>(
    `SELECT * FROM concept ORDER BY subject, topic, name`
  );
}

export async function createConcept(input: {
  name: string;
  subject: Subject;
  topic: string;
  subtopic?: string | null;
  description?: string | null;
}): Promise<Concept> {
  const row = await queryOne<Concept>(
    `INSERT INTO concept (name, subject, topic, subtopic, description)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.name, input.subject, input.topic, input.subtopic ?? null, input.description ?? null]
  );
  return row!;
}
