"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useSpeech } from "@/lib/useSpeech";
import { Play, Pause, Square, Volume2 } from "lucide-react";
import type { CurrentAffairsItem } from "@/lib/db/types";

interface DigestEntry {
  category: string;
  list: CurrentAffairsItem[];
}

// The text shown on a card is exactly the text spoken for it (summary, falling
// back to a truncated source) — audio matches the screen.
function displayText(item: CurrentAffairsItem): string {
  return item.summary ?? truncate(item.raw_text, 200);
}

// H3 — digest with browser read-aloud. The spoken playlist (category header line
// + each item) is built here so the spoken index maps exactly to an item id,
// keeping the "now reading" highlight accurate.
export function DigestPlayer({ groups }: { groups: DigestEntry[] }) {
  const speech = useSpeech();

  const { spoken, idForIndex } = useMemo(() => {
    const spoken: string[] = [];
    const idForIndex: (number | null)[] = [];
    for (const { category, list } of groups) {
      spoken.push(`${category}.`);
      idForIndex.push(null); // header line — no card to highlight
      for (const item of list) {
        spoken.push(displayText(item));
        idForIndex.push(item.id);
      }
    }
    return { spoken, idForIndex };
  }, [groups]);

  const currentId = speech.current != null ? idForIndex[speech.current] ?? null : null;

  return (
    <>
      {speech.supported && (
        <div className="mb-6 flex items-center gap-2">
          {!speech.speaking ? (
            <Button onClick={() => speech.speakQueue(spoken)}>
              <Play size={16} strokeWidth={1.5} className="mr-2" />
              Play digest
            </Button>
          ) : (
            <>
              {speech.paused ? (
                <Button onClick={speech.resume}>
                  <Play size={16} strokeWidth={1.5} className="mr-2" />
                  Resume
                </Button>
              ) : (
                <Button variant="secondary" onClick={speech.pause}>
                  <Pause size={16} strokeWidth={1.5} className="mr-2" />
                  Pause
                </Button>
              )}
              <Button variant="secondary" onClick={speech.stop}>
                <Square size={16} strokeWidth={1.5} className="mr-2" />
                Stop
              </Button>
            </>
          )}
        </div>
      )}

      <div className="grid gap-6">
        {groups.map(({ category, list }) => (
          <section key={category}>
            <h2 className="text-caption uppercase tracking-[0.02em] text-secondary mb-2">{category}</h2>
            <div className="grid gap-2">
              {list.map((item) => {
                const active = item.id === currentId;
                return (
                  <Card
                    key={item.id}
                    className={`p-4 transition-colors duration-150 ${
                      active ? "border-accent bg-accent-subtle" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-body-lg max-w-read flex items-start gap-2">
                        {active && (
                          <Volume2
                            size={18}
                            strokeWidth={1.5}
                            className="mt-1 shrink-0 text-accent-strong"
                            aria-label="Now reading"
                          />
                        )}
                        <span>{displayText(item)}</span>
                      </p>
                      {item.exam_probability != null && (
                        <Badge tone={item.exam_probability >= 0.7 ? "accent" : "neutral"}>
                          {Math.round(item.exam_probability * 100)}%
                        </Badge>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n).trimEnd()}…` : s;
}
