import { getDueCards } from "@/lib/db/queries/cards";
import { ReviewSession } from "@/components/review/ReviewSession";
import { NEW_CARD_CAP, REVIEW_BACKLOG_THRESHOLD } from "@/lib/config";

export const dynamic = "force-dynamic";

// B1 — the due queue: all due reviews first, then capped new cards (B3).
export default async function ReviewPage() {
  const all = await getDueCards(200);

  const dueReviews = all.filter((c) => c.state !== "new");

  // B3 — pause new intake when the due-review backlog is too high; otherwise cap it.
  const newAllowed = dueReviews.length >= REVIEW_BACKLOG_THRESHOLD ? 0 : NEW_CARD_CAP;
  const newCards = all.filter((c) => c.state === "new").slice(0, newAllowed);

  const queue = [...dueReviews, ...newCards];

  return <ReviewSession initialQueue={queue} />;
}
