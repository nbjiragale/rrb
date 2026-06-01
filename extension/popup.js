const DEFAULTS = { endpoint: "http://localhost:3000", token: "" };

const $ = (id) => document.getElementById(id);

async function load() {
  const cfg = await chrome.storage.sync.get(DEFAULTS);
  $("endpoint").value = cfg.endpoint;
  $("token").value = cfg.token;

  const { lastResult } = await chrome.storage.local.get("lastResult");
  if (lastResult) {
    const when = new Date(lastResult.at).toLocaleString();
    $("last").innerHTML = "";
    const line = document.createElement("div");
    line.className = lastResult.ok ? "ok" : "err";
    line.textContent = (lastResult.title ? lastResult.title + " — " : "") + lastResult.summary;
    const time = document.createElement("div");
    time.style.color = "#82807a";
    time.style.marginTop = "2px";
    time.textContent = when;
    $("last").append(line, time);
  }
}

function status(text, ok) {
  const el = $("status");
  el.textContent = text;
  el.className = ok ? "ok" : "err";
}

// Origins outside the manifest's static host_permissions need a runtime grant
// before the worker can POST to them.
function originPattern(endpoint) {
  try {
    const u = new URL(endpoint);
    return `${u.protocol}//${u.host}/*`;
  } catch {
    return null;
  }
}

async function ensureHostPermission(endpoint) {
  const u = new URL(endpoint);
  if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true; // already in manifest
  const pattern = originPattern(endpoint);
  if (!pattern) return false;
  const has = await chrome.permissions.contains({ origins: [pattern] });
  if (has) return true;
  return chrome.permissions.request({ origins: [pattern] });
}

$("save").addEventListener("click", async () => {
  const endpoint = $("endpoint").value.trim().replace(/\/+$/, "");
  const token = $("token").value;
  if (!endpoint) return status("Enter the app URL.", false);
  try {
    new URL(endpoint);
  } catch {
    return status("That's not a valid URL.", false);
  }

  const granted = await ensureHostPermission(endpoint).catch(() => false);
  if (!granted) return status("Permission for that host was denied.", false);

  await chrome.storage.sync.set({ endpoint, token });
  status("Saved.", true);
});

load();
