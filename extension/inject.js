// Runs in the PAGE's main world (so it can see Testbook's own fetch/XHR), patched
// in at document_start before the SPA boots. It watches network responses and,
// when it spots the completed-mock result payload
// (…/tests/<id>/student-test-result), forwards { url, payload } to the isolated
// content script via window.postMessage. Read-only: nothing is blocked or
// altered, and only the result endpoint is touched.
(function () {
  const RESULT_URL = /\/tests\/[^/?#]+\/student-test-result/i;

  function isResultText(url, text) {
    if (!text || text.length < 200) return false;
    if (RESULT_URL.test(url)) return true;
    // URL-format fallback: sniff the distinctive result shape cheaply.
    return text.includes('"studentResStatus"') && text.includes('"sections"');
  }

  function capture(url, text) {
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      return;
    }
    window.postMessage({ __tbCapture: true, url: String(url), payload }, "*");
  }

  function isTestbook(url) {
    return typeof url === "string" && /(^|\/\/)([^/]*\.)?testbook\.com\b/i.test(url);
  }

  // --- fetch ---
  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (...args) {
      const url = args[0] && args[0].url ? args[0].url : String(args[0] ?? "");
      const p = origFetch.apply(this, args);
      if (isTestbook(url)) {
        p.then((res) => {
          res
            .clone()
            .text()
            .then((t) => {
              if (isResultText(url, t)) capture(url, t);
            })
            .catch(() => {});
        }).catch(() => {});
      }
      return p;
    };
  }

  // --- XMLHttpRequest ---
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__tbUrl = url;
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    const xhr = this;
    if (isTestbook(xhr.__tbUrl)) {
      xhr.addEventListener("load", function () {
        try {
          let text = null;
          if (xhr.responseType === "" || xhr.responseType === "text") text = xhr.responseText;
          else if (xhr.responseType === "json" && xhr.response) text = JSON.stringify(xhr.response);
          if (text && isResultText(xhr.__tbUrl, text)) capture(xhr.__tbUrl, text);
        } catch {
          /* ignore */
        }
      });
    }
    return origSend.apply(this, arguments);
  };
})();
