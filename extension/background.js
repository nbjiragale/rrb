// Service worker: the only context that talks to the study app. Validates the
// captured payload's shape, derives the test id from the request URL (the body
// doesn't carry it), and POSTs to /api/import/testbook. Dedupes within a session
// so a page that re-fetches doesn't spam — and the server import is idempotent
// anyway. Feedback via the toolbar badge + an in-page toast.

const DEFAULTS = { endpoint: "http://localhost:3000", token: "" };
const RESULT_RE = /\/tests\/([^/?#]+)\/student-test-result/i;
const seen = new Set();

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === "tb-result") handle(msg, sender);
});

function looksLikeResult(payload) {
  try {
    const secs = payload.data.sections;
    return (
      Array.isArray(secs) &&
      secs.some(
        (s) =>
          Array.isArray(s.responses) &&
          s.responses.some((r) => r && r.question && r.question._id)
      )
    );
  } catch {
    return false;
  }
}

async function handle(msg, sender) {
  if (!looksLikeResult(msg.payload)) return;

  const cfg = await chrome.storage.sync.get(DEFAULTS);
  const m = RESULT_RE.exec(msg.url || "");
  const externalTestId = m ? m[1] : null;
  const attemptedOn = (msg.payload.data && msg.payload.data.attemptedOn) || "";
  const key = externalTestId + ":" + attemptedOn;
  if (seen.has(key)) return;
  seen.add(key);

  badge("…", "#C9912F");
  try {
    const url = cfg.endpoint.replace(/\/+$/, "") + "/api/import/testbook";
    const headers = { "content-type": "application/json" };
    if (cfg.token) headers.authorization = "Bearer " + cfg.token;

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ payload: msg.payload, externalTestId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "HTTP " + res.status);

    const summary = formatSummary(data.result);
    await chrome.storage.local.set({
      lastResult: { at: Date.now(), ok: true, summary, title: data.result && data.result.title },
    });
    badge("✓", "#5B8C6E");
    toast(sender, summary, true);
  } catch (e) {
    seen.delete(key); // allow a retry on the next capture
    const message = (e && e.message) || String(e);
    await chrome.storage.local.set({ lastResult: { at: Date.now(), ok: false, summary: message } });
    badge("!", "#BF5340");
    toast(sender, "Import failed: " + message, false);
  }
}

function formatSummary(r) {
  if (!r) return "Imported.";
  if (r.alreadyImported) return "Already imported — no change.";
  const parts = [r.correct + "✓", r.wrong + "✗", r.unattempted + "–", r.imported + " imported"];
  if (r.skippedUnmapped) parts.push(r.skippedUnmapped + " unmapped");
  if (r.rushed) parts.push(r.rushed + " rushed");
  return parts.join("  ");
}

function badge(text, color) {
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text });
  if (text === "✓") setTimeout(() => chrome.action.setBadgeText({ text: "" }), 8000);
}

function toast(sender, text, ok) {
  const tabId = sender && sender.tab && sender.tab.id;
  if (tabId != null) chrome.tabs.sendMessage(tabId, { type: "tb-toast", text, ok }).catch(() => {});
}
