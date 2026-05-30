import Link from "next/link";
import { listConcepts } from "@/lib/db/queries/concepts";
import { listEdges, getGraphData } from "@/lib/db/queries/edges";
import { listAllResources } from "@/lib/db/queries/resources";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Label, Select } from "@/components/ui/Field";
import { GraphCanvas } from "@/components/graph/GraphCanvas";
import { ResourceManager } from "@/components/graph/ResourceManager";
import { EdgeRow } from "@/components/graph/EdgeRow";
import { addConceptEdge } from "./actions";

export const dynamic = "force-dynamic";

export default async function GraphPage() {
  const [concepts, edges, graph, resources] = await Promise.all([
    listConcepts(),
    listEdges(),
    getGraphData(),
    listAllResources(),
  ]);

  if (concepts.length < 2) {
    return (
      <div className="mx-auto max-w-column px-6 py-8">
        <Card className="p-6">
          <p className="text-body-lg">
            Add at least two concepts first —{" "}
            <Link href="/concepts" className="text-accent-strong underline">
              go to Concepts
            </Link>
            .
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-shell px-6 py-8 md:px-8">
      <h1 className="text-h1 mb-2">Knowledge graph</h1>
      <p className="text-secondary text-body mb-6">
        Prerequisites gate the planner; contrasts-with pairs feed the tutor. Node colour shows mastery.
      </p>

      <Card className="p-6 mb-8">
        <h2 className="text-h3 mb-4">Map</h2>
        {edges.length === 0 ? (
          <p className="text-secondary text-body">No links yet — add some below to see the map.</p>
        ) : (
          <GraphCanvas nodes={graph.nodes} edges={graph.edges} />
        )}
      </Card>

      <Card className="p-6 mb-8">
        <h2 className="text-h3 mb-4">Add a link</h2>
        <form action={addConceptEdge} className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="source_id">Concept</Label>
            <Select id="source_id" name="source_id" required>
              {concepts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="relation_type">Relation</Label>
            <Select id="relation_type" name="relation_type" defaultValue="prerequisite">
              <option value="prerequisite">requires (prerequisite)</option>
              <option value="contrasts_with">contrasts with</option>
              <option value="related">related to</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="target_id">Target concept</Label>
            <Select id="target_id" name="target_id" required>
              {concepts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-3">
            <Button type="submit">Add link</Button>
          </div>
        </form>
      </Card>

      {edges.length > 0 && (
        <div className="mb-10 grid gap-3">
          <h2 className="text-h3">Links</h2>
          {edges.map((e) => (
            <EdgeRow key={`${e.source_id}-${e.target_id}-${e.relation_type}`} edge={e} />
          ))}
        </div>
      )}

      <h2 className="text-h2 mb-4">Learning resources</h2>
      <ResourceManager concepts={concepts} resources={resources} />
    </div>
  );
}
