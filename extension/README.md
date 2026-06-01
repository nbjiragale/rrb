# Testbook Capture — Chrome extension

Auto-imports your completed **Testbook** mock results into the RRB study app, so
you never paste JSON by hand. When you open a finished test's result page,
Testbook fetches
`…/tests/<id>/student-test-result`; the extension reads that response and POSTs
it to the app's `/api/import/testbook` endpoint. One mock → one `mock_session` +
an attempt per question, folded into BKT mastery and queued for diagnosis.

**Read-only & personal.** It only observes the result endpoint on `testbook.com`
(no automation, no other pages), and sends data solely to *your* app URL. Your
own subscription data, your own database (Hard Rule §5).

## Install (unpacked)

1. Run the study app (`npm run dev` → `http://localhost:3000`, or your deploy).
2. Chrome → `chrome://extensions` → enable **Developer mode** → **Load unpacked**
   → select this `extension/` folder.
3. Click the extension icon → set:
   - **Study app URL** — e.g. `http://localhost:3000` (a non-localhost host
     prompts once for permission).
   - **Import token** — only if you set `TESTBOOK_IMPORT_TOKEN` in the app's env;
     leave blank otherwise.
   - **Save**.

## Use

1. Take/open a completed mock on Testbook and view its **result / solutions**
   page.
2. The extension captures the result and imports it automatically. You'll see an
   in-page toast and a badge on the icon: e.g. `14✓  24✗  62–  38 imported`.
3. Re-opening the same result is a no-op (imports are idempotent).

Unmapped Testbook topics (no matching concept) are reported in the toast as
`N unmapped` and skipped — never mis-attributed. Map them once at
`/import/testbook` in the app, then re-open the result to capture them.

## How it's wired

```
inject.js (page world)  → patches fetch/XHR, sniffs the result response
   └─ window.postMessage →
content.js (isolated)   → forwards to the worker; renders the toast
   └─ chrome.runtime →
background.js (worker)  → derives test id from the URL, POSTs /api/import/testbook
```

`background.js` is the only context that talks to the app. The test id lives in
the request URL (the body omits it); the worker extracts it and the app keys
idempotency on `test id + attempt timestamp`.

## Notes

- No icon assets are bundled (Chrome uses a default); add `icons` to
  `manifest.json` if you want custom ones.
- The capture is resilient to Testbook URL tweaks: it matches the
  `student-test-result` path **and** falls back to sniffing the payload shape.
- Never share a Testbook URL that contains an `auth_code` — it's a live
  credential. The extension reads the response in your own logged-in session and
  never stores or transmits that token.
