// Centralised env access with fail-fast semantics (§13 fail fast). Required vars
// throw a clear, actionable error the moment they're needed instead of failing
// later as an opaque connection error or a silently-ignored cost cap.

/** Required string env var. Throws with an actionable message when missing. */
export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var ${name}. Set it before running the app.`);
  }
  return v;
}

// Numeric env var with a default. A malformed value (e.g. "abc" → NaN) must NOT
// silently disable a guard — notably the CA_AUTOGEN_*/QGEN_* cost caps, where
// `NaN <= 0` is false and would bypass the disable check (Hard Rule §4). Falls
// back to the default and warns rather than propagating NaN downstream.
export function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    console.warn(`env ${name}="${raw}" is not a finite number — using default ${fallback}.`);
    return fallback;
  }
  return n;
}
