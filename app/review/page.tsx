import { getDueCards } from "@/lib/db/queries/cards";
import { ReviewSession } from "@/components/review/ReviewSession";

export const dynamic = "force-dynamic";

// B1 — the due queue. New-card intake cap (B3) keeps sessions sustainable.
const NEW_CARD_CAP = 20;

export default async function ReviewPage() {
  const all = await getDueCards(200);

  // Apply the new-card cap: all due reviews + up to N new cards.
  const dueReviews = all.filter((c) => c.state !== "new");
  const newCards = all.filter((c) => c.state === "new").slice(0, NEW_CARD_CAP);
  const queue = [...dueReviews, ...newCards];

  return <ReviewSession initialQueue={queue} />;
}
