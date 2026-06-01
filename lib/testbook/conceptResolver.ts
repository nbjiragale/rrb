// Resolves a Testbook topic tag to one of our concepts. Pure and deterministic
// so it can be unit-tested without a DB. Precedence:
//   1. an explicit override from testbook_tag_map (always wins),
//   2. an exact (normalized) match on a concept name or topic — but ONLY when it
//      resolves to a single concept; an ambiguous tag stays unmapped rather than
//      being mis-attributed (which would poison BKT — see the import service).

export interface ResolverConcept {
  id: number;
  name: string;
  topic: string;
}

export type TagResolver = (tag: string | null) => number | null;

const normalize = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function buildTagResolver(
  concepts: ResolverConcept[],
  overrides: { tag: string; concept_id: number }[]
): TagResolver {
  const index = new Map<string, Set<number>>();
  const add = (key: string, id: number) => {
    if (!key) return;
    const set = index.get(key) ?? new Set<number>();
    set.add(id);
    index.set(key, set);
  };
  for (const c of concepts) {
    add(normalize(c.name), c.id);
    add(normalize(c.topic), c.id);
  }

  const overrideByKey = new Map<string, number>();
  for (const o of overrides) overrideByKey.set(normalize(o.tag), o.concept_id);

  return (tag) => {
    if (!tag) return null;
    const key = normalize(tag);
    const override = overrideByKey.get(key);
    if (override != null) return override;
    const ids = index.get(key);
    return ids && ids.size === 1 ? [...ids][0] : null;
  };
}
