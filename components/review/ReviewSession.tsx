"use client";

import { useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { rateCard } from "@/app/review/actions";
import type { DueCard, Rating } from "@/lib/db/types";

// Rating buttons stay neutral-bodied; only the left dot carries semantic tint (UIdesignspec §8).
const RATINGS: { rating: Rating; label: string; dot: string }[] = [
  { rating: 1, label: "Again", dot: "bg-danger" },
  { rating: 2, label: "Hard", dot: "bg-warning" },
  { rating: 3, label: "Good", dot: "bg-success" },
  { rating: 4, label: "Easy", dot: "bg-success" },
];

export function ReviewSession({ initialQueue }: { initialQueue: DueCard[] }) {
  const [queue] = useState(initialQueue);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const [pending, setPending] = useState(false);
  const shownAt = useRef<number>(Date.now());

  const total = queue.length;
  const current = queue[index];
  const progress = useMemo(
    () => (total === 0 ? 100 : Math.round((done / total) * 100)),
    [done, total]
  );

  function reveal() {
    setRevealed(true);
  }

  async function rate(rating: Rating) {
    if (!current || pending) return;
    setPending(true);
    const responseMs = Date.now() - shownAt.current;
    try {
      await rateCard({ cardId: current.id, rating, responseMs });
      setDone((d) => d + 1);
      setRevealed(false);
      shownAt.current = Date.now();
      setIndex((i) => i + 1);
    } finally {
      setPending(false);
    }
  }

  if (total === 0 || index >= total) {
    return (
      <div className="mx-auto max-w-column px-6 py-16 text-center">
        <h1 className="text-h2 mb-2">All clear</h1>
        <p className="text-secondary text-body-lg">
          {total === 0
            ? "Nothing is due right now. Add cards or check back later."
            : `You reviewed ${done} ${done === 1 ? "card" : "cards"} today. Nice work.`}
        </p>
      </div>
    );
  }

  const remaining = total - done;

  return (
    <div className="mx-auto max-w-column px-6 py-8">
      {/* Slim progress + remaining count */}
      <div className="mb-8">
        <div className="h-2 w-full rounded-full bg-active">
          <div
            className="h-2 rounded-full bg-accent transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-small text-muted">{remaining} remaining today</p>
      </div>

      <div className="mb-4">
        <Badge tone="neutral">{current.concept_name}</Badge>
      </div>

      <Card className="p-8">
        <p className="text-body-lg whitespace-pre-wrap">{current.front}</p>
        {revealed && (
          <>
            <hr className="my-6 border-t border-border" />
            <p className="text-body-lg whitespace-pre-wrap text-primary">{current.back}</p>
          </>
        )}
      </Card>

      <div className="mt-8">
        {!revealed ? (
          <Button onClick={reveal} className="w-full">
            Reveal answer
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {RATINGS.map(({ rating, label, dot }) => (
              <Button
                key={rating}
                variant="secondary"
                disabled={pending}
                onClick={() => rate(rating)}
                className="gap-2"
              >
                <span className={`h-2 w-2 rounded-full ${dot}`} />
                {label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
