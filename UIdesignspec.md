# UI Design Spec — Claude.ai-Style, Light Mode

> **For the AI building the frontend.** This defines the complete visual language for the RRB NTPC learning app. The aesthetic target is **Claude.ai's web interface**: warm, calm, content-first, light mode only. Use the tokens in §3 as the single source of truth — never hardcode raw hex in components; reference the CSS variables / Tailwind tokens. Stack assumption: **Next.js + Tailwind CSS**.

---

## 0. How to use this file

1. Drop §3 (CSS variables) into your global stylesheet and §10 (Tailwind config) into `tailwind.config`.
2. Build components using the tokens and the recipes in §7–§8.
3. Obey the **Design Principles (§1)** — they are what make it read as "Claude," not generic. When in doubt, choose *less*: more whitespace, fewer borders, one accent color.
4. Light mode only. Do **not** add a dark theme unless later asked.

**Accuracy note:** colors below reproduce Claude.ai's light-mode palette (warm ivory canvas + clay/coral accent + warm neutrals). The brand UI font is proprietary (**Styrene A**); since it can't be embedded, §4 gives the brand reference plus a free fallback stack that preserves the same clean, slightly-geometric character. Tune the exact hex against the live site if you want pixel-parity.

---

## 1. Design principles (the soul — follow these)

- **Warm, not cold.** The canvas is a warm ivory/cream, never stark white. Pure `#FFFFFF` is reserved for raised surfaces (cards, inputs), and even those sit on cream.
- **One accent, used sparingly.** The clay/coral accent marks *primary action and focus only*. Everything else is warm neutral. If half the screen is coral, it's wrong.
- **Hairlines over shadows.** Separate things with 1px warm borders and whitespace first; use shadows only for genuinely floating elements (menus, modals), and keep them soft and faint.
- **Generous whitespace.** Calm, uncrowded, readable. Padding is comfortable; line-length for reading text is capped (~65–72ch).
- **Quiet typography.** Regular/medium weights dominate; reserve semibold for headings. No heavy black weights. Text color is a warm near-black, not `#000`.
- **Content first.** Chrome recedes; the card / question / explanation is the hero. Decoration is minimal and purposeful.
- **Gentle motion.** Subtle, fast transitions (150–200ms ease). Nothing bouncy or attention-seeking.

---

## 2. Color philosophy

A warm-neutral foundation (ivory → white → warm grays → warm near-black) with a single clay/coral accent and a **muted, desaturated** semantic set. Semantic colors lean warm and soft so correct/wrong states never feel loud or alarming — important for a study tool used daily under stress.

---

## 3. Design tokens — CSS variables (source of truth)

```css
:root {
  /* ---- Surfaces / backgrounds ---- */
  --bg-canvas:        #FAF9F5;  /* app background — warm ivory, the signature Claude cream */
  --bg-subtle:        #F0EEE6;  /* sidebar, secondary panels, subtle fills */
  --bg-surface:       #FFFFFF;  /* raised cards, inputs, popovers */
  --bg-hover:         #F2F0E9;  /* row / item hover on cream */
  --bg-active:        #EBE8DF;  /* pressed / selected neutral state */

  /* ---- Text ---- */
  --text-primary:     #262624;  /* warm near-black — headings & body */
  --text-secondary:   #5C5A54;  /* supporting text */
  --text-muted:       #82807A;  /* captions, placeholders, meta */
  --text-on-accent:   #FFFFFF;  /* text on coral */
  --text-on-dark:     #FAF9F5;  /* text on dark surfaces */

  /* ---- Borders / dividers ---- */
  --border-default:   #E6E3DA;  /* hairline borders, dividers */
  --border-strong:    #D8D4C8;  /* input borders, more defined edges */
  --border-subtle:    #EFEDE4;  /* faint internal separators */

  /* ---- Accent (clay / coral — Claude orange) ---- */
  --accent:           #D97757;  /* primary actions, active states, focus */
  --accent-hover:     #C2603F;  /* hover / pressed — deeper clay */
  --accent-strong:    #BF5D3B;  /* use behind white text when extra contrast needed */
  --accent-subtle:    #F6E9E2;  /* tinted backgrounds, selected highlights */
  --accent-border:    #E8C4B4;  /* borders on accent-tinted surfaces */
  --focus-ring:       rgba(217, 119, 87, 0.35); /* focus halo */

  /* ---- Semantic (muted, warm) ---- */
  --success:          #5B8C6E;  /* correct, mastered */
  --success-subtle:   #E7EFE8;
  --warning:          #C9912F;  /* developing, caution */
  --warning-subtle:   #F6EDD9;
  --danger:           #BF5340;  /* wrong, weak — muted clay-red, NOT bright red */
  --danger-subtle:    #F4E4DF;
  --info:             #5A7A99;  /* neutral info */
  --info-subtle:      #E5ECF1;

  /* ---- Mastery scale (heatmap: weak → strong, all desaturated) ---- */
  --mastery-0:        #E6E3DA;  /* new / untouched (neutral) */
  --mastery-1:        #E8C9BC;  /* weak */
  --mastery-2:        #EBD2A6;  /* learning */
  --mastery-3:        #CFD9B8;  /* developing */
  --mastery-4:        #A9C7B0;  /* strong / mastered */

  /* ---- Radius ---- */
  --radius-sm:   6px;   /* badges, small chips */
  --radius-md:   10px;  /* buttons, inputs */
  --radius-lg:   16px;  /* cards, panels */
  --radius-xl:   24px;  /* large feature cards, modals */
  --radius-full: 9999px;/* pills, avatars */

  /* ---- Shadows (soft, warm-tinted, low opacity) ---- */
  --shadow-xs: 0 1px 2px rgba(40, 38, 36, 0.04);
  --shadow-sm: 0 1px 3px rgba(40, 38, 36, 0.06), 0 1px 2px rgba(40, 38, 36, 0.04);
  --shadow-md: 0 4px 12px rgba(40, 38, 36, 0.08);
  --shadow-lg: 0 12px 28px rgba(40, 38, 36, 0.12);  /* modals, menus only */

  /* ---- Spacing base ---- */
  --space-unit: 4px; /* scale: 4 8 12 16 20 24 32 40 48 64 */
}
```

### Contrast rules (accessibility — don't skip)
- `--accent` on white is ~3.4:1: **fine for fills, icons, and large/bold text; NOT for small body text.** For coral text on light, only use it ≥16px medium, otherwise use `--accent-strong` or `--text-primary`.
- White text on `--accent`: acceptable for **button labels at ≥15px medium**. If a label is smaller or thin, switch the button bg to `--accent-strong`.
- Body text always `--text-primary` on canvas/surface (≈12:1, excellent).

---

## 4. Typography

```css
:root {
  /* Brand reference: Styrene A (proprietary, can't embed).
     Fallback stack preserves the clean, slightly-geometric grotesque character. */
  --font-sans: "Styrene A", ui-sans-serif, system-ui, -apple-system,
               "Segoe UI", "Helvetica Neue", "Inter", Arial, sans-serif;

  /* Optional serif for large display/marketing headings only (Claude uses a serif there).
     Brand reference: Tiempos Text. Free fallback: */
  --font-serif: "Tiempos Text", "Source Serif 4", "Georgia", serif;

  /* Numerals, timers, code */
  --font-mono: ui-monospace, "SF Mono", "JetBrains Mono", "Menlo", monospace;
}
```

**Default everything to `--font-sans`.** Use `--font-serif` *only* for an optional large hero/heading on the dashboard if you want extra Claude-marketing warmth — never for UI labels or body. Use `--font-mono` for the mock-test timer and any numeric stats so digits align.

### Type scale (px / line-height / weight)

| Token | Size | Line-height | Weight | Use |
|---|---|---|---|---|
| `display` | 36 | 1.15 | 500 | dashboard hero (rare) |
| `h1` | 28 | 1.25 | 600 | page titles |
| `h2` | 22 | 1.3 | 600 | section headings |
| `h3` | 18 | 1.4 | 600 | card titles |
| `body-lg` | 17 | 1.6 | 400 | tutor answers, card faces, reading |
| `body` | 15 | 1.55 | 400 | default UI text |
| `small` | 13 | 1.5 | 400 | meta, secondary |
| `caption` | 12 | 1.45 | 500 | labels, tags (often uppercase, +0.02em tracking) |

- Weights: **400** body, **500** medium emphasis, **600** headings. Avoid 700+.
- Reading containers (tutor replies, explanations): cap width at **65–72ch**.
- Letter-spacing: near-zero for body; tiny positive tracking (`0.02em`) only on uppercase captions/labels.

---

## 5. Spacing & layout

- **Scale (px):** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Use multiples of 4 only.
- **Page gutters:** 24 mobile, 32–48 desktop.
- **Card padding:** 20 (compact) / 24 (default) / 32 (feature).
- **Stack rhythm:** 8 between tight elements, 16 between grouped, 24–32 between sections.
- **Content max-width:** app shell ~1200px; centered reading/review column ~680–720px; tutor chat column ~720–760px.
- **Layout shell:** left sidebar (nav) on `--bg-subtle` + main area on `--bg-canvas`. Sidebar collapsible; on mobile it becomes a bottom tab bar or a drawer.

---

## 6. Iconography & imagery

- Line icons, ~1.5px stroke, rounded joins (lucide-react fits well). Default icon color `--text-secondary`; `--accent` only when marking the active/primary thing.
- No photographic imagery in the core app. Empty states use a small, simple line illustration or a single muted icon + one line of guidance.

---

## 7. Component recipes

All examples in Tailwind-ish utility terms referencing the tokens (assumes §10 maps tokens to Tailwind names).

### Buttons
- **Primary:** `bg-accent text-on-accent rounded-md px-5 py-2.5 text-[15px] font-medium` · hover `bg-accent-hover` · focus `ring-4 ring-focus` · disabled `opacity-50`. Height ~40px.
- **Secondary:** `bg-surface text-primary border border-strong rounded-md px-5 py-2.5 font-medium` · hover `bg-hover`.
- **Ghost/tertiary:** `text-secondary rounded-md px-3 py-2` · hover `bg-hover text-primary`.
- **Destructive:** secondary style but `text-danger border-danger/40` · hover `bg-danger-subtle`. Use rarely.
- Transitions: `transition-colors duration-150`.

### Cards / panels
`bg-surface border border-default rounded-lg p-6` · optional `shadow-xs`. No heavy shadow. Section panels on `--bg-subtle` can be borderless.

### Inputs / textarea / select
`bg-surface border border-strong rounded-md px-3.5 py-2.5 text-[15px] text-primary placeholder:text-muted` · focus `border-accent ring-4 ring-focus outline-none`. Label `caption text-secondary mb-1.5`. Error: `border-danger` + helper text `text-danger small`.

### Badges / chips / tags
`rounded-full px-2.5 py-0.5 caption` on a subtle tint, e.g. status: `bg-success-subtle text-success`, `bg-warning-subtle text-warning`, `bg-danger-subtle text-danger`, neutral `bg-subtle text-secondary`.

### Navigation (sidebar)
- Container: `bg-subtle` full height, `p-3`, items `rounded-md px-3 py-2 text-[15px] text-secondary`.
- Hover: `bg-hover text-primary`. **Active:** `bg-active text-primary font-medium` with a 2–3px `accent` left indicator bar (the Claude-style quiet active state — avoid filling the whole item with coral).

### Tabs
Underline style: row of `text-secondary` labels; active label `text-primary` with a 2px `accent` underline. Light, not boxed.

### Modal / dialog
Centered `bg-surface rounded-xl p-6 shadow-lg max-w-md`, scrim `bg-[#262624]/30 backdrop-blur-[2px]`. Title `h3`, actions right-aligned (primary + ghost cancel).

### Toast
`bg-surface border border-default rounded-lg shadow-md p-4`, small accent/semantic dot or icon at left. Auto-dismiss; non-blocking.

### Progress
Track `bg-active rounded-full h-2`, fill `bg-accent rounded-full`. For mastery bars use the mastery scale color, not accent.

### Tooltip
`bg-[#262624] text-on-dark caption rounded-md px-2 py-1 shadow-md`. Small, dark, quiet.

---

## 8. Screen-level guidance (this app specifically)

Keep every screen calm and single-focus. One primary action per view.

### Daily Review (the core loop)
- Centered single column (~680px). Big **card face** in `body-lg` on a `bg-surface rounded-lg` card with generous padding (32). Concept/topic shown as a small `caption` chip above.
- Reveal answer → back content appears below a hairline divider.
- Rating row of 4 buttons — **Again / Hard / Good / Easy** — as *secondary* buttons in one row; tint their left dot subtly using the mastery/semantic scale (Again→danger, Hard→warning, Good→success-muted, Easy→success). Keep the buttons neutral-bodied, not full-color, to stay calm.
- Top: a slim progress bar (cards done / due today) + remaining count in `small text-muted`.

### Practice & Question Bank
- Question stem in `body-lg`. Four options as full-width selectable rows: `bg-surface border border-default rounded-md p-4`, hover `bg-hover`, selected `border-accent bg-accent-subtle`.
- After submit: correct row `border-success bg-success-subtle`, chosen-wrong row `border-danger bg-danger-subtle`. Explanation in a `bg-subtle rounded-lg p-4` block beneath.
- Confidence prompt (1–5) appears **before** reveal — a small segmented control; required.

### Mock Test (exam simulation)
- Distraction-free: hide the sidebar. Sticky top bar with **timer in `--font-mono`** (turns `warning` under 5 min, `danger` under 1 min) + attempted/skipped counts.
- Question palette: a grid of small number cells — `mastery-0` default, `accent-subtle` for answered, `border-accent` for current, faint dot for "marked for review". Skipping is explicit and never penalized in the UI flow.
- Submit triggers a confirm modal. Post-mock analysis uses the dashboard components below.

### AI Tutor (chat) — mirror Claude.ai's chat
- Single centered column (~740px) on `bg-canvas`.
- **Assistant messages:** plain text directly on the canvas in `body-lg`, no bubble — exactly like Claude. Comfortable line-length cap.
- **User messages:** contained in a soft bubble `bg-subtle rounded-xl px-4 py-3`, aligned right or full-width-tinted.
- Input: a rounded `bg-surface border border-strong rounded-xl` composer pinned to bottom, send button = primary, icon-only when empty.
- Streaming: render tokens as they arrive; a subtle blinking caret. Keep "thinking" indicators minimal (three quiet dots).

### Study Planner (today/this week)
- A `bg-surface rounded-lg` card listing today's concepts in priority order: each row = concept name (`h3`/`body` medium) + a one-line `small text-muted` reason + a tiny priority chip. Review-load summary at top. A clear "low-energy day → reviews only" toggle.

### Diagnosis / Mistakes
- Per-concept list of recurring misconceptions: label + count chip + `kind` tag (use semantic-subtle tints per kind). "Confident-but-wrong" items flagged with a small `danger` marker. Keep it factual and non-judgmental in tone and color.

### Dashboard / Insights
- **Heatmap:** grid of concept/topic cells colored by the 5-step **mastery scale**. Legend below. Tap a cell → drill-in.
- **Trend lines / charts:** thin strokes, `accent` for the primary series, neutrals for context, lots of whitespace, no gridline clutter. (Use a lightweight chart lib; style axes in `text-muted`, hairline gridlines in `border-subtle`.)
- **Readiness:** a single honest number vs a target band, with explicit uncertainty wording — restrained, not a giant gauge.
- **Streak:** quiet counter; never punitive coloring on a missed day.

---

## 9. Motion

- Transitions: `150ms` colors, `200ms` transforms/opacity, `ease`/`ease-out`. 
- Page/section entrance: a single subtle fade-up (`opacity 0→1`, `translateY 4px→0`) with small staggered delay for lists — used once per view, not everywhere.
- Card reveal (review answer): quick fade/expand.
- Respect `prefers-reduced-motion`: disable non-essential motion.
- No bounce, no large scale pops, no parallax. Calm.

---

## 10. Tailwind config (paste into `tailwind.config.{js,ts}`)

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas:  "#FAF9F5",
        subtle:  "#F0EEE6",
        surface: "#FFFFFF",
        hover:   "#F2F0E9",
        active:  "#EBE8DF",
        primary:   "#262624",   // text-primary
        secondary: "#5C5A54",
        muted:     "#82807A",
        border:        "#E6E3DA",
        "border-strong": "#D8D4C8",
        "border-subtle": "#EFEDE4",
        accent: {
          DEFAULT: "#D97757",
          hover:   "#C2603F",
          strong:  "#BF5D3B",
          subtle:  "#F6E9E2",
          border:  "#E8C4B4",
        },
        success: { DEFAULT: "#5B8C6E", subtle: "#E7EFE8" },
        warning: { DEFAULT: "#C9912F", subtle: "#F6EDD9" },
        danger:  { DEFAULT: "#BF5340", subtle: "#F4E4DF" },
        info:    { DEFAULT: "#5A7A99", subtle: "#E5ECF1" },
        mastery: {
          0: "#E6E3DA", 1: "#E8C9BC", 2: "#EBD2A6", 3: "#CFD9B8", 4: "#A9C7B0",
        },
      },
      fontFamily: {
        sans:  ['"Styrene A"', "ui-sans-serif", "system-ui", "-apple-system", '"Segoe UI"', '"Inter"', "Arial", "sans-serif"],
        serif: ['"Tiempos Text"', '"Source Serif 4"', "Georgia", "serif"],
        mono:  ["ui-monospace", '"SF Mono"', '"JetBrains Mono"', "Menlo", "monospace"],
      },
      fontSize: {
        caption:  ["12px", { lineHeight: "1.45", fontWeight: "500" }],
        small:    ["13px", { lineHeight: "1.5" }],
        body:     ["15px", { lineHeight: "1.55" }],
        "body-lg":["17px", { lineHeight: "1.6" }],
        h3:       ["18px", { lineHeight: "1.4", fontWeight: "600" }],
        h2:       ["22px", { lineHeight: "1.3", fontWeight: "600" }],
        h1:       ["28px", { lineHeight: "1.25", fontWeight: "600" }],
        display:  ["36px", { lineHeight: "1.15", fontWeight: "500" }],
      },
      borderRadius: {
        sm: "6px", md: "10px", lg: "16px", xl: "24px", full: "9999px",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(40,38,36,0.04)",
        sm: "0 1px 3px rgba(40,38,36,0.06), 0 1px 2px rgba(40,38,36,0.04)",
        md: "0 4px 12px rgba(40,38,36,0.08)",
        lg: "0 12px 28px rgba(40,38,36,0.12)",
      },
      ringColor: { focus: "rgba(217,119,87,0.35)" },
      maxWidth: { read: "72ch", shell: "1200px", column: "720px" },
    },
  },
  plugins: [],
};
```

---

## 11. Do / Don't (quick reference)

**Do**
- Warm ivory canvas; white only for raised surfaces.
- One coral accent for primary action + focus; everything else neutral.
- Hairline borders + whitespace to separate; faint shadows only when floating.
- Regular/medium weights; warm near-black text; comfortable line-height.
- Calm, fast, subtle motion.

**Don't**
- ❌ Pure white page backgrounds or `#000` text.
- ❌ Coral on large areas, multiple competing accent colors, or bright saturated semantic colors.
- ❌ Heavy drop shadows, thick borders, or boxed/cluttered layouts.
- ❌ Bold 700+ weights everywhere; cramped spacing; bouncy/parallax motion.
- ❌ Dark mode (not in scope).
- ❌ Full-coral active nav items — use the quiet left-indicator instead.

---

*Pair this with `RRB-NTPC-build-brief.md` (architecture, schema, stories). This file governs look & feel; that file governs structure & behavior.*
