// Bearer-token guard for the app's mutating HTTP routes (cron, CA scrape,
// Testbook import). These trigger billed LLM/Firecrawl calls and write study
// data, so they must fail CLOSED: an unset secret denies access rather than
// leaving the endpoint open (the prior default). Single-user app, but anyone
// who can reach the URL could otherwise burn budget (Hard Rule §4) or poison
// the learner model. Set the matching env var to use the endpoint.
export function checkBearer(req: Request, envVar: string): { ok: boolean; reason?: string } {
  const secret = process.env[envVar];
  if (!secret) {
    return { ok: false, reason: `${envVar} is not set — endpoint disabled.` };
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return { ok: false, reason: "unauthorized" };
  }
  return { ok: true };
}

// Guard for same-origin-only routes (e.g. the in-app CA "Scrape now" button,
// which can't carry a secret without leaking it to the browser). Blocks the
// realistic threat — a cross-site page CSRF-triggering billed scrape/LLM work —
// using the browser-set Sec-Fetch-Site / Origin signals. A non-browser caller
// (no Origin, e.g. the user's own curl/cron on the box) is allowed; on this
// auth-less single-user app (Hard Rule §5) that's the same trust level as any
// server action. The cron path uses a real secret via checkBearer instead.
export function requireSameOrigin(req: Request): { ok: boolean; reason?: string } {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return { ok: false, reason: "cross-origin request rejected" };
  }
  const origin = req.headers.get("origin");
  if (origin) {
    const host = req.headers.get("host");
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return { ok: false, reason: "invalid origin" };
    }
    if (host && originHost !== host) {
      return { ok: false, reason: "cross-origin request rejected" };
    }
  }
  return { ok: true };
}
