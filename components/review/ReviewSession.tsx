"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { rateCard } from "@/app/review/actions";
import { previewIntervals } from "@/lib/fsrs";
import type { DueCard, Rating } from "@/lib/db/types";

// Rating buttons stay neutral-bodied; only the left dot carries semantic tint
// (UIdesignspec §8). Keys 1–4 mirror Anki.
const RATINGS: { rating: Rating; label: string; dot: string }[] = [
  { rating: 1, label: "Again", dot: "bg-danger" },
  { rating: 2, label: "Hard", dot: "bg-warning" },
  { rating: 3, label: "Good", dot: "bg-success" },
  { rating: 4, label: "Easy", dot: "bg-success" },
];

export function ReviewSession({ initialQueue }: { initialQueue: DueCard[] }) {
  const router = useRouter();
  const [queue] = useState(initialQueue);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const [pending, setPending] = useState(false);
  const shownAt = useRef<number>(Date.now());

  const total = queue.length;
  const current = queue[index];
  const finished = total === 0 || index >= total;
  const progress = total === 0 ? 100 : Math.round((done / total) * 100);

  // Anki-style "next due" hints for the current card. Pure FSRS, no DB.
  const previews = useMemo(() => (current ? previewIntervals(current) : null), [current]);

  const reveal = useCallback(() => setRevealed(true), []);
  const exit = useCallback(() => router.push("/"), [router]);

  const rate = useCallback(
    async (rating: Rating) => {
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
    },
    [current, pending]
  );

  // Keyboard: Space/Enter reveal, 1–4 rate, Esc exit (UIredesignspec §12).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return; // leave ⌘K to the palette
      if (e.key === "Escape") {
        exit();
        return;
      }
      if (finished || pending) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        reveal();
      } else if (revealed && e.key >= "1" && e.key <= "4") {
        e.preventDefault();
        void rate(Number(e.key) as Rating);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished, pending, revealed, reveal, rate, exit]);

  if (finished) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-column flex-col items-center justify-center px-6 text-center">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-subtle text-success">
          <Check size={24} strokeWidth={2} />
        </span>
        <h1 className="mb-2 text-h2">All caught up</h1>
        <p className="mb-8 text-body-lg text-secondary">
          {total === 0
            ? "Nothing is due right now. Add cards or check back later."
            : `You reviewed ${done} ${done === 1 ? "card" : "cards"} today. Nice work.`}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <LinkButton href="/">Back to Today</LinkButton>
          <LinkButton href="/practice" variant="secondary">
            Practice
          </LinkButton>
        </div>
      </div>
    );
  }

  const remaining = total - done;

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Top strip: exit · progress · count — the only chrome in focus mode */}
      <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-border-subtle bg-canvas/90 px-6 py-3 backdrop-blur-sm">
        <Button variant="ghost" onClick={exit} className="-ml-3 shrink-0" aria-label="Exit review (Esc)">
          <ArrowLeft size={16} strokeWidth={1.5} className="mr-1.5" />
          Today
        </Button>
        <div className="h-1.5 flex-1 rounded-full bg-active">
          <div
            className="h-1.5 rounded-full bg-accent transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="shrink-0 font-mono text-small text-muted">
          {done}/{total}
        </span>
      </div>

      {/* Card column */}
      <div className="flex flex-1 items-start justify-center px-6 py-10">
        <div className="w-full max-w-column">
          <div className="mb-4">
            <Badge tone="neutral">{current.concept_name}</Badge>
          </div>

          <Card className="p-8">
            <p className="whitespace-pre-wrap text-body-lg">{current.front}</p>
            {revealed && (
              <>
                <hr className="my-6 border-t border-border" />
                <p className="whitespace-pre-wrap text-body-lg text-primary">{current.back}</p>
              </>
            )}
          </Card>

          <div className="mt-8">
            {!revealed ? (
              <Button onClick={reveal} className="w-full">
                Reveal answer
                <span className="ml-2 text-caption text-on-accent/70">Space</span>
              </Button>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {RATINGS.map(({ rating, label, dot }) => (
                  <Button
                    key={rating}
                    variant="secondary"
                    disabled={pending}
                    onClick={() => rate(rating)}
                    className="flex-col gap-1"
                  >
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${dot}`} />
                      {label}
                    </span>
                    <span className="font-mono text-caption text-muted">{previews?.[rating]}</span>
                  </Button>
                ))}
              </div>
            )}
          </div>

          <p className="mt-4 text-center text-small text-muted">{remaining} remaining</p>
        </div>
      </div>
    </div>
  );
}
