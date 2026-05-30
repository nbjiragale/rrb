import { Card } from "@/components/ui/Card";
import { Flame } from "lucide-react";
import type { StreakResult } from "@/lib/streak";

// J4 — quiet, non-punitive streak. No red, no shame for a missed day.
export function StreakCounter({ streak }: { streak: StreakResult }) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3">
        <Flame
          size={22}
          strokeWidth={1.5}
          className={streak.current > 0 ? "text-accent-strong" : "text-muted"}
        />
        <div>
          <p className="font-mono text-h2 leading-none">{streak.current}</p>
          <p className="text-small text-muted">day{streak.current === 1 ? "" : "s"} in a row</p>
        </div>
      </div>
      <p className="mt-3 text-small text-secondary">
        {streak.studiedToday
          ? "Reviewed today — nice."
          : streak.current > 0
            ? "Your streak is alive; a quick review keeps it going."
            : "A few reviews today starts a fresh streak."}
      </p>
      <p className="mt-1 text-small text-muted">Longest: {streak.longest} days.</p>
    </Card>
  );
}
