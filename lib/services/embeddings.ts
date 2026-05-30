import { isEmbedConfigured, embedBatch } from "@/lib/llm/embed";
import {
  getUnembeddedInteractions,
  setInteractionEmbedding,
} from "@/lib/db/queries/interactions";

// Nightly (walkthrough C.5): embed any free text stored before embeddings were
// available. Batched in one provider call; bounded by the caller for cost.
export async function backfillEmbeddings(limit = 100): Promise<{ embedded: number }> {
  if (!isEmbedConfigured()) return { embedded: 0 };
  const pending = await getUnembeddedInteractions(limit);
  if (pending.length === 0) return { embedded: 0 };

  const vectors = await embedBatch(pending.map((p) => p.content));
  let embedded = 0;
  for (let i = 0; i < pending.length; i++) {
    if (vectors[i]) {
      await setInteractionEmbedding(pending[i].id, vectors[i]);
      embedded++;
    }
  }
  return { embedded };
}
