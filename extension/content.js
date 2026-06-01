// Isolated-world bridge: receives a captured payload from the page-world
// injector and hands it to the background worker (the only context allowed to
// fetch the app's import endpoint). Also renders a small in-page toast with the
// import outcome.

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const d = event.data;
  if (!d || d.__tbCapture !== true) return;
  chrome.runtime.sendMessage({ type: "tb-result", url: d.url, payload: d.payload });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "tb-toast") showToast(msg.text, msg.ok);
});

function showToast(text, ok) {
  const id = "tb-capture-toast";
  const existing = document.getElementById(id);
  if (existing) existing.remove();

  const el = document.createElement("div");
  el.id = id;
  el.textContent = (ok ? "✓ " : "✕ ") + text;
  Object.assign(el.style, {
    position: "fixed",
    zIndex: "2147483647",
    bottom: "20px",
    right: "20px",
    maxWidth: "360px",
    padding: "12px 16px",
    borderRadius: "10px",
    font: "500 13px/1.45 system-ui, -apple-system, Segoe UI, sans-serif",
    color: "#262624",
    background: "#FFFFFF",
    border: "1px solid " + (ok ? "#A9C7B0" : "#BF5340"),
    boxShadow: "0 4px 12px rgba(40,38,36,0.12)",
  });
  document.documentElement.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}
