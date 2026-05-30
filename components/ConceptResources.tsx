import { ExternalLink } from "lucide-react";
import { listResourcesByConcept } from "@/lib/db/queries/resources";

// A4 / E2 — "where to learn this" pointers for a concept. Routes out to external
// content; renders nothing when there are none. Server component.
export async function ConceptResources({ conceptId }: { conceptId: number }) {
  const resources = await listResourcesByConcept(conceptId);
  if (resources.length === 0) return null;

  return (
    <div className="rounded-lg bg-subtle p-4">
      <p className="text-caption uppercase tracking-[0.02em] text-secondary mb-2">Where to learn</p>
      <ul className="grid gap-1.5">
        {resources.map((r) => (
          <li key={r.id} className="text-small">
            {r.url ? (
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-accent-strong hover:underline"
              >
                {r.label}
                <ExternalLink size={13} strokeWidth={1.5} />
              </a>
            ) : (
              <span className="text-secondary">{r.label}</span>
            )}
            {r.kind && <span className="text-muted"> · {r.kind}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
