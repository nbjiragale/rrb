"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useSpeech } from "@/lib/useSpeech";
import { Play, Pause, Square, Volume2, ExternalLink } from "lucide-react";
import type { CurrentAffairsItem, CaCitation } from "@/lib/db/types";

interface DigestEntry {
  category: string;
  list: CurrentAffairsItem[];
}

// The text shown on a card is exactly the text spoken for it (summary, falling
// back to a truncated source) — audio matches the screen (grounding, §2).
function displayText(item: CurrentAffairsItem): string {
  return item.summary ?? truncate(item.raw_text, 200);
}

// Turn the raw 0–1 likelihood into a labelled, understandable chip. A bare "85%"
// doesn't say what it measures; "High · 85%" does.
function likelihood(p: number | null): { label: string; pct: number; accent: boolean } | null {
  if (p == null) return null;
  const pct = Math.round(p * 100);
  if (p >= 0.75) return { label: "High", pct, accent: true };
  if (p >= 0.55) return { label: "Medium", pct, accent: false };
  return { label: "Low", pct, accent: false };
}

// Up to two external references for an item: explicit grounding citations if we
// have them, else the source page it was scraped from.
function references(item: CurrentAffairsItem): CaCitation[] {
  if (item.citations && item.citations.length > 0) return item.citations.slice(0, 2);
  if (item.source_url) return [{ uri: item.source_url }];
  return [];
}

// H3 — digest with browser read-aloud. The spoken playlist (category header line
// + each item) is built here so the spoken index maps exactly to an item id,
// keeping the "now reading" highlight accurate.
export function DigestPlayer({ groups, totalItems }: { groups: DigestEntry[]; totalItems: number }) {
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
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-subtle p-2">
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
          <span className="ml-auto flex items-center gap-2 pr-1 text-small text-muted">
            {speech.speaking && !speech.paused && (
              <span
                aria-hidden
                className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent"
              />
            )}
            {speech.speaking ? "Reading aloud" : `Read all ${totalItems} aloud`}
          </span>
        </div>
      )}

      <div className="grid gap-5">
        {groups.map(({ category, list }) => (
          <section key={category}>
            <div className="mb-2 flex items-baseline gap-2">
              <h2 className="text-h3">{capitalize(category)}</h2>
              <span className="font-mono text-small text-muted">{list.length}</span>
            </div>

            <Card className="divide-y divide-border overflow-hidden p-0">
              {list.map((item, i) => {
                const active = item.id === currentId;
                const odds = likelihood(item.exam_probability);
                const refs = references(item);
                return (
                  <div
                    key={item.id}
                    className={`flex gap-3 border-l-2 p-4 transition-colors duration-150 ${
                      active ? "border-accent bg-accent-subtle" : "border-transparent"
                    }`}
                  >
                    <div className="flex w-6 shrink-0 justify-center pt-0.5">
                      {active ? (
                        <Volume2
                          size={18}
                          strokeWidth={1.5}
                          className="text-accent-strong"
                          aria-label="Now reading"
                        />
                      ) : (
                        <span className="font-mono text-small text-muted">{i + 1}</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="max-w-read text-body-lg text-primary">{displayText(item)}</p>
                      {refs.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                          {refs.map((ref, j) => (
                            <a
                              key={j}
                              href={ref.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-small text-muted underline-offset-2 transition-colors duration-150 hover:text-accent-strong hover:underline"
                            >
                              <ExternalLink size={13} strokeWidth={1.5} className="shrink-0" />
                              <span className="truncate">{refLabel(ref)}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    {odds && (
                      <div className="shrink-0">
                        <Badge tone={odds.accent ? "accent" : "neutral"}>
                          {odds.label} · {odds.pct}%
                        </Badge>
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          </section>
        ))}
      </div>
    </>
  );
}

function refLabel(ref: CaCitation): string {
  if (ref.title) return truncate(ref.title, 40);
  try {
    return new URL(ref.uri).hostname.replace(/^www\./, "");
  } catch {
    return "Source";
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n).trimEnd()}…` : s;
}
