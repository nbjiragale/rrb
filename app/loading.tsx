// Every route is dynamic and DB-backed. Without a Suspense boundary the App
// Router holds the previous screen, unpainted, until the server render finishes
// — navigation reads as a freeze. This skeleton lets the shell paint instantly
// and covers all nested routes that don't define their own loading state.
export default function Loading() {
  return (
    <div className="mx-auto max-w-shell px-6 py-8 md:px-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="h-7 w-48 rounded-md bg-subtle motion-safe:animate-pulse" />
      <div className="mt-3 h-4 w-72 rounded-md bg-subtle motion-safe:animate-pulse" />
      <div className="mt-8 grid gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-[72px] rounded-lg border border-border bg-surface motion-safe:animate-pulse"
            // Stagger so the group reads as one settling surface, not five blinking boxes.
            style={{ animationDelay: `${i * 90}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
