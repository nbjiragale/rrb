"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Trash2 } from "lucide-react";
import { removeConceptEdge } from "@/app/graph/actions";
import type { EdgeView } from "@/lib/db/queries/edges";

const relationTone = (r: string) =>
  r === "prerequisite" ? "accent" : r === "contrasts_with" ? "warning" : "neutral";

// A3 — a graph link with one-tap delete.
export function EdgeRow({ edge }: { edge: EdgeView }) {
  const [pending, start] = useTransition();
  const [removed, setRemoved] = useState(false);
  if (removed) return null;

  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="text-body font-medium">{edge.source_name}</span>
      <Badge tone={relationTone(edge.relation_type)}>{edge.relation_type.replace("_", " ")}</Badge>
      <span className="text-body font-medium">{edge.target_name}</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await removeConceptEdge({
              source_id: edge.source_id,
              target_id: edge.target_id,
              relation_type: edge.relation_type,
            });
            setRemoved(true);
          })
        }
        className="ml-auto text-muted hover:text-danger disabled:opacity-50"
        aria-label="Delete link"
      >
        <Trash2 size={16} strokeWidth={1.5} />
      </button>
    </Card>
  );
}
