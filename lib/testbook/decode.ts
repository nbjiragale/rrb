// Testbook stems/solutions arrive as HTML, frequently double-encoded
// (`&amp;radic;` → `&radic;` → `√`) and peppered with `math-tex` LaTeX spans and
// images. This turns one such blob into clean inline text + LaTeX for storage in
// `question.stem` / `explanation`, which the practice UI renders as plain text.
// Deliberately lossy: layout HTML (tables, styling) is discarded; the math that
// matters survives as `\(...\)` LaTeX, and images degrade to a marker.

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  radic: "√", times: "×", divide: "÷", minus: "−", plusmn: "±",
  ndash: "–", mdash: "—", hellip: "…", deg: "°", prime: "′", Prime: "″",
  rArr: "⇒", lArr: "⇐", hArr: "⇔", rarr: "→", larr: "←", harr: "↔",
  there4: "∴", because: "∵", radicx: "√", infin: "∞", ne: "≠",
  le: "≤", ge: "≥", asymp: "≈", equiv: "≡", sum: "Σ", prod: "Π",
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", theta: "θ", pi: "π",
  lambda: "λ", mu: "μ", sigma: "σ", phi: "φ", omega: "ω",
};

function decodeEntitiesOnce(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) => NAMED[name] ?? m);
}

function safeCodePoint(cp: number): string {
  try {
    return Number.isFinite(cp) && cp > 0 ? String.fromCodePoint(cp) : "";
  } catch {
    return "";
  }
}

export function decodeTestbookHtml(raw: string | null | undefined): string {
  if (!raw) return "";

  // Decode entities up to twice to unwrap the common double-encoding, but stop
  // early once a pass changes nothing (avoids touching literal text like "AT&T").
  let text = raw;
  for (let i = 0; i < 2; i++) {
    const next = decodeEntitiesOnce(text);
    if (next === text) break;
    text = next;
  }

  text = text
    .replace(/<\s*(br|\/p|\/div|\/li|\/tr)\s*\/?>/gi, "\n") // block breaks → newline
    .replace(/<\s*img\b[^>]*>/gi, " [image] ") // images can't render as text
    .replace(/<[^>]+>/g, " ") // drop all remaining tags
    .replace(/[ \t\f\v]+/g, " ") // collapse intra-line whitespace
    .replace(/ *\n */g, "\n") // trim around newlines
    .replace(/\n{3,}/g, "\n\n") // cap blank runs
    .trim();

  return text;
}
