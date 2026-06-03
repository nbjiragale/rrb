# UI Redesign Spec — RRB NTPC Personal Learning Platform

> **Supersedes the look-and-feel guidance in `UIdesignspec.md` where the two conflict.** `UIdesignspec.md` defined the *palette and primitives* (keep them). This document defines the *product* — navigation, hierarchy, density, screen choreography, and the rules that stop the app reading like a feature catalogue and make it read like a focused study tool.
>
> Audience: frontend engineers. Everything here is buildable against the existing Next.js + Tailwind token system. Where a value already exists in `UIdesignspec.md §3/§10`, this doc reuses it by name (e.g. `bg-canvas`, `accent`) rather than restating hex.

---

## 0. Why we are redesigning

The current build is technically faithful to the palette but **fails the product test**: a flat sidebar of nine peers, an in-screen tab bar on top of that, and every screen opening with an `h1` plus an explanatory subtitle paragraph plus a stack of equal-weight cards. The result reads like *documentation about features* — a page per capability, each politely describing itself — instead of a tool that tells you what to do and lets you do it fast.

The fix is not new colors. It is **hierarchy, choreography, and restraint**:

- Promote *verbs* (Review, Practice, Mock), demote *authoring* (Ingest, Generate, Import).
- Replace explanatory subtitles with a **primary action on the title row** and **scannable status chips**.
- Add a **Today** command surface so the app always has an obvious next action.
- Make review and mock **focus modes**, not pages with chrome.
- Make the graph an **Obsidian-style canvas**, not a static diagram.

---

## 1. Product vision

A **calm, single-user exam cockpit.** One person, one goal (clear RRB NTPC), one app that always answers *"what should I do in the next 20 minutes, and am I on track?"*

The product is a blend, and each influence owns a specific surface:

| Influence | What we take | Where it lives |
|---|---|---|
| **Linear** | Tight hierarchy, keyboard-first, command palette, instant state, zero decorative chrome | Global shell, nav, palette, page headers |
| **Notion** | Calm bordered content blocks, progressive disclosure, comfortable reading | Tutor, Diagnosis, Current Affairs, Concept detail |
| **Duolingo** | One obvious next action, legible progress, gentle streak | Today, Review entry, Planner |
| **Anki** | Distraction-free, keyboard-rated, full-focus review | Review focus mode, Mock runner |
| **Obsidian** | Interactive knowledge graph with an inspector panel | Graph |

**Feel:** calm, intelligent, structured, fast, low-noise, practical, trustworthy. Warm light mode only. One accent. Borders and whitespace over shadows. Never loud, never gamified to the point of noise, never a wall of text.

**Anti-vision:** a dashboard zoo, a settings-heavy admin panel, a chat app with everything bolted onto the side, or a documentation site with a page per feature.

---

## 2. UX principles

Ten rules. Every screen and component is measured against them.

1. **Action-first, not content-first.** Except the Tutor, every screen leads with *what you can do*, not a description of itself. The primary action is visible without scrolling.
2. **One primary action per screen.** Exactly one coral button in view at a time. Everything else is secondary/ghost. If you need two coral buttons, the screen is doing two jobs — split it.
3. **Status is scannable in under 3 seconds.** Counts, due numbers, mastery, readiness — all expressed as chips, bars, and numerals, never as prose paragraphs.
4. **Progressive disclosure.** Show the 20% that matters; tuck the rest behind "Details", a drawer, an accordion, or a `…` menu. Authoring and configuration live in Settings, not in the daily path.
5. **Keyboard is a first-class input.** Command palette (`⌘K`), review ratings (`1–4` / `Space`), option select (`A–D`), submit (`⏎`). Every primary action has a shortcut shown in its tooltip.
6. **Reading width is sacred.** Any sustained reading (tutor, explanations, CA) caps at `max-w-read` (72ch). UI/dashboards may go wider; prose never does.
7. **Calm density.** Comfortable but not sparse. Lists are scannable rows, not big cards. We don't waste a 24px-padded card on a one-line fact.
8. **Borders and whitespace separate; shadows float.** A shadow appears only on something that literally overlays the page (menu, modal, toast, palette).
9. **Honest, non-judgmental signal.** Wrong answers, weak mastery, missed streaks use *muted* semantic color and neutral wording. Never alarm-red, never punitive.
10. **No dead chrome.** No subtitle that restates the title. No empty card "for balance". No icon without a job. If an element doesn't help the next action or convey status, delete it.

---

## 3. Information architecture

The twelve product screens reorganised into **four intent groups**, ordered by daily frequency. This is the single source of truth for nav, the palette, and breadcrumbs.

```
TODAY ──────────────  command surface / home (new)

PRACTICE  (the verbs — daily use)
  ├─ Review          spaced-repetition focus loop
  ├─ Practice        MCQ drills by concept/section
  └─ Mocks           full timed exams + results

PLAN  (orientation — frequent)
  ├─ Planner         today/this-week ordered intake
  └─ Dashboard       readiness, trends, heatmap, streak

KNOWLEDGE  (the material — browse/inspect)
  ├─ Graph           Obsidian-style concept map (entry point)
  ├─ Concepts        concept list + detail
  ├─ Cards           SRS card library
  ├─ Diagnosis       misconceptions & confident-wrong
  └─ Current Affairs grounded CA feed + digest

TUTOR ──────────────  AI chat (its own surface, reading-first)

SETTINGS  (rare — authoring & config, bottom of nav)
  ├─ Exam config     sections, dates, negative marking
  ├─ Calibration     confidence model + EV threshold
  └─ Content         Ingest · Import · Generate  (tabbed)
```

### What changed from the current build and why

- **`Today` is new.** The current home redirects straight to `/review`. That skips the single most important screen: the one that tells you what to do. Today is the new `/` (see §10.1).
- **Authoring tools demoted.** `Ingest`, `Import`, `Generate` currently sit in a top-level **Content** group, giving setup tasks the same visual rank as daily review. They move under **Settings → Content**. They are configuration, not study.
- **`Digest`, `Feynman`, `Recall` are not top-level screens.** They are *modes within* existing screens: Digest is a tab inside Current Affairs; Feynman and Recall are launch actions inside Review/Concept detail. This removes three sidebar peers that were really study micro-modes.
- **`Calibration` moves to Settings.** It's a model-tuning surface, read rarely; its *output* (the EV threshold, your calibration curve) surfaces inside Practice and Dashboard where it's actionable.
- **Diagnosis moves under Knowledge, next to Concepts/Graph** — it's about *the material you're weak on*, so it lives with the material, not buried in an "Insights" tab cluster.

Net effect: the sidebar goes from "nine equal features + nested tabs" to "a short ladder of intents, daily verbs on top, authoring at the bottom."

---

## 4. Navigation model

### 4.1 Shell — a slim rail, not a wide sidebar

Replace the 224px label-sidebar + in-screen `SectionTabs` with a **64px icon rail** plus an **optional 220px expanded drawer**. Linear's model.

```
┌──┬───────────────────────────────────────────────┐
│  │  Page header (title · status chips · action)   │
│R │───────────────────────────────────────────────│
│A │                                                │
│I │              Content region                    │
│L │              (max-w by screen)                 │
│  │                                                │
└──┴───────────────────────────────────────────────┘
```

- **Collapsed (default, 64px):** icon-only, grouped with hairline dividers between intent groups. Active item = `bg-active` pill + 3px `accent` left bar (keep the existing quiet active treatment — never a full coral fill). Tooltip on hover shows label + shortcut.
- **Expanded (220px):** icon + label + (for groups) a count badge (e.g. Review shows `12` due). Toggle with `[` or the chevron at the rail foot; preference persists. Group headers (`PRACTICE`, `PLAN`, `KNOWLEDGE`) are `caption` uppercase `text-muted`, shown only when expanded.
- **Brand mark** at top (small, `caption`/wordmark — not the current serif `h3`, which oversells it). Clicking it goes to Today.
- **Settings + streak** pinned to the rail foot.

The in-screen `SectionTabs` bar is **removed as a global element.** Sub-navigation (e.g. Content's Ingest/Import/Generate, or Current Affairs' Feed/Digest) becomes **local underline tabs inside that screen's header**, only where a screen genuinely has sibling views — not a persistent second nav layer.

### 4.2 Command palette (`⌘K` / `Ctrl+K`) — required

The keyboard spine of the app. Opens a centered overlay (`bg-surface rounded-xl shadow-lg max-w-[560px]`, scrim `#262624/30` + `backdrop-blur-[2px]`).

- **Navigate:** fuzzy-jump to any screen or any concept ("Polity → President").
- **Act:** verbs regardless of location — "Start review", "New mock", "Add card", "Ask tutor", "Ingest passage".
- **Recents** when empty. Arrow keys + `⏎`. Each row shows its global shortcut on the right.

This is the primary escape valve that lets the *visible* UI stay minimal: anything not on screen is one `⌘K` away.

### 4.3 Mobile navigation

- **Bottom tab bar, 5 items max:** Today · Review · Practice · Mocks · Tutor. (Keep the existing `MobileTabBar` pattern; reorder to lead with Today, drop Planner from the bar — Planner is reachable from Today's header and the palette.)
- Active tab = icon + label in `accent-strong`, inactive `text-secondary`.
- Everything else (Plan, Knowledge, Settings) lives behind a **"More" sheet** opened from Today's header avatar/menu, or via search.
- **Focus modes (Review, Mock) hide the tab bar** for full immersion.

### 4.4 Within-screen navigation rules

- **Breadcrumb** only where there's real depth: `Concepts / Polity / President`. One line, `small`, `text-muted` with `text-primary` leaf. Never on top-level screens.
- **Back affordance** in detail/focus views is an explicit ghost button (`← Concepts`), not reliance on browser back.
- **Local tabs** (underline style) only for true sibling views of one screen. Max 3–4 tabs; more than that means it should be separate nav entries.

---

## 5. Layout system

### 5.1 Three canonical layouts

Every screen is one of three. This consistency is most of what makes it feel "structured."

**A. Cockpit** — orientation screens (Today, Dashboard, Planner).
`max-w-shell` (1200px). A responsive grid of **status modules** of deliberately *unequal* weight: one hero module (readiness / due-summary) spanning 2 columns, supporting modules at 1. Modules are bordered blocks, not shadowed cards. Page gutter 32 desktop / 24 mobile.

**B. Workbench** — list + detail screens (Concepts, Cards, Diagnosis, Current Affairs, Settings/Content).
Two-pane on desktop: **left list/filter rail (~320px)** + **right detail (`max-w-read` for prose, fluid for tables)**. The list is dense scannable rows; the detail is a calm Notion-style block stack. On mobile this collapses to list → push-to-detail.

**C. Focus** — single-task immersion (Review, Practice session, Mock runner, Tutor).
Rail collapses or hides. **One centered column.** Review/Practice/Mock-question = `max-w-column` (720px). Tutor = 720–760px. Nothing competes with the task. A slim top progress strip is the only chrome.

### 5.2 Page header (the anti-documentation rule)

**This single pattern kills the "documentation" feel.** Every Cockpit/Workbench screen header is exactly one row:

```
[ Title (h1, 28px) ]        [ status chips ]        [ Primary action ▸ ]
```

- **No subtitle paragraph.** The current `text-secondary text-small` descriptive sentence under every `h1` (e.g. *"Where you stand, how you're trending…"*) is **deleted everywhere.** If a screen genuinely needs a one-line orienting note, it goes as a single `small text-muted` line *inside the first module*, not under the title.
- **Status chips** sit between title and action: e.g. Review → `12 due` · `4 new`; Dashboard → `Readiness 41/100` · `7-day streak`.
- **Primary action** is the one coral button, right-aligned. Secondary actions collapse into a `⋯` overflow menu.
- Header is **sticky** on scroll for long screens, shrinking to a 48px condensed bar (title + action only).

### 5.3 Content region

- Cockpit modules: `bg-surface border border-default rounded-lg`, padding 24 (feature module 32, compact 20). Gap between modules: 24.
- Workbench list rows: 56px tall, `px-4`, hairline divider between rows, hover `bg-hover`, selected `bg-active` + 2px accent left bar.
- Focus column: generous vertical rhythm, 32–48px between the task and its controls.

---

## 6. Typography system

Keep the existing scale and tokens from `UIdesignspec.md §4` verbatim (`display/h1/h2/h3/body-lg/body/small/caption`, weights 400/500/600 only, `--font-sans` default, `--font-mono` for numerals/timers). The redesign adds **usage discipline**, not new tokens:

- **`h1` (28/600)** — screen title only, once per screen.
- **`h2` (22/600)** — module/section heading inside Cockpit and detail panes.
- **`h3` (18/600)** — list-row primary text, card-face label, concept titles.
- **`body-lg` (17/1.6)** — *reading surfaces only*: card faces, tutor answers, explanations, CA passages. Never for dense UI.
- **`body` (15/1.55)** — default UI text, list rows, form fields.
- **`small` (13)** — meta, reasons, secondary row text.
- **`caption` (12/500, +0.02em, often UPPERCASE)** — chips, group headers, status labels.
- **`--font-mono`** — every number that benefits from alignment: mock timer, readiness score, due counts, EV %, stats columns. Tabular numerals.
- **Serif (`--font-serif`)** — *one* optional use: the Today greeting / Dashboard hero number. Nowhere else. (The current serif sidebar brand mark is removed.)

**Prose rule:** reading blocks get `leading-relaxed` and a hard `max-w-read`. No reading text ever spans the full shell width.

---

## 7. Color system

**No palette change.** The tokens in `UIdesignspec.md §3/§10` already satisfy "warm light, one accent, muted semantics, mastery scale." The redesign tightens *how* they're used:

### 7.1 Accent budget
`accent` (coral) is allowed on, at most, **one element per viewport**:
- the single primary button, **or**
- the active-nav left bar, **or**
- the focus ring, **or**
- the primary data series in a chart, **or**
- the "current" cell in the mock palette.

It is **never** used for: decorative headings, large fills, multiple competing CTAs, icon color (except the one active item), or section dividers. If coral appears twice in a screenshot competing for attention, it's a bug.

### 7.2 Semantic usage
- `success / warning / danger` always via their `-subtle` background + saturated foreground, never full-saturation fills. Used for answer correctness, mastery bands, confident-wrong markers.
- Wrong/weak states are **muted clay-red (`danger`)**, never bright red. Reinforced by §2.9.

### 7.3 Mastery scale
The 5-step `mastery-0…4` scale is the *only* place a sequential color ramp appears: Graph nodes, Dashboard heatmap, Concept mastery bars, Planner priority dots. Consistency here makes mastery instantly readable app-wide. A fixed legend (`New · Weak · Learning · Developing · Strong`) appears wherever the ramp is used.

### 7.4 Surfaces
Canvas `bg-canvas` everywhere; `bg-surface` (white) only for raised blocks/inputs/rows-on-hover; `bg-subtle` for the rail, secondary panels, and user chat bubbles. Never a pure-white page.

---

## 8. Spacing and density

Keep the 4px scale (`4 8 12 16 20 24 32 40 48 64`). Density is **per layout**, deliberately tuned:

| Context | Vertical rhythm | Padding | Notes |
|---|---|---|---|
| **Focus** (Review/Mock/Tutor) | 32–48 between task & controls | card face 32 | Roomy, meditative |
| **Cockpit** (Today/Dashboard) | 24 between modules | module 24, hero 32 | Calm, breathable |
| **Workbench list** | 0 (hairline rows) | row `py-3 px-4`, 56px tall | **Dense and scannable** |
| **Workbench detail** | 16 grouped / 24 sections | pane 24–32 | Notion-calm |
| **Forms (Settings)** | 16 between fields, 24 between groups | — | Labels `caption`, fields full-width to ~480px |

**Key correction to the current build:** stop rendering every list item as a 24px-padded `Card`. Lists (concepts, cards, mistakes, CA items, plan rows) are **hairline-separated rows**, not stacked cards. Cards are reserved for Cockpit status modules and genuinely standalone objects (the review card face). This single change roughly doubles scannable density on the browse screens and removes the "feature-card catalogue" look.

---

## 9. Core components

Format per component: **purpose · style · spacing · states · interactions · usage rules.** All reference existing tokens. Primitives already present (`Button`, `Card`, `Badge`, `Field`, `Segmented`, `Markdown`) are extended, not replaced.

### 9.1 Button
- **Purpose:** trigger an action; rank communicates importance.
- **Style:** Primary `bg-accent text-on-accent rounded-md px-5 h-10 font-medium`; Secondary `bg-surface border border-strong`; Ghost `text-secondary hover:bg-hover`; Destructive = secondary + `text-danger border-danger/40`.
- **Spacing:** 10px gap between adjacent buttons; primary always rightmost in a group.
- **States:** hover (`accent-hover`), focus (`ring-4 ring-focus`), active (translate-y-0, no bounce), disabled (`opacity-50`), **loading** (inline spinner replaces label, width locked to prevent reflow).
- **Interactions:** `transition-colors 150ms`. Primary actions show their shortcut in a tooltip.
- **Rules:** one Primary per screen. Never two coral buttons adjacent. Icon-only buttons require an `aria-label` and tooltip.

### 9.2 Status chip
- **Purpose:** render a single fact (count, state, band) scannably; the backbone of §5.2 headers.
- **Style:** `rounded-full px-2.5 py-0.5 caption`. Neutral `bg-subtle text-secondary`; semantic variants use `-subtle` bg + semantic fg; **count chips** put the number in `--font-mono`.
- **Spacing:** 8px gap in a chip row.
- **States:** static; optional small leading dot (semantic) or icon. Interactive variant (filter chip) adds hover `bg-hover` and a selected `bg-active` + accent ring.
- **Rules:** chips convey status, not actions. Max ~4 in a header row before they become a `⋯` overflow.

### 9.3 List row
- **Purpose:** the atom of every Workbench screen (concept, card, mistake, CA item, plan item).
- **Style:** 56px, `flex items-center gap-3 px-4`, hairline `border-b border-subtle`. Left: optional mastery dot / icon. Center: `body`/`h3` primary + `small text-muted` secondary on one line each. Right: status chip(s) + a `⋯` menu (appears on hover/focus).
- **Spacing:** internal `gap-3`; secondary line `mt-0.5`.
- **States:** hover `bg-hover`, selected `bg-active` + 2px accent left bar, focus ring, loading skeleton variant.
- **Interactions:** whole row clickable → detail; `⋯` opens row actions; right-arrow key drills in. Optional leading checkbox for bulk (cards).
- **Rules:** never wrap a row in a `Card`. Keep to one primary + one secondary line; deeper data lives in the detail pane.

### 9.4 Status module (Cockpit card)
- **Purpose:** a single, glanceable unit of orientation (readiness, due-summary, streak, trend).
- **Style:** `bg-surface border border-default rounded-lg p-6`. Header row = `h2`/`h3` + optional `⋯`. Body = one chart/number/short list. **No shadow.**
- **Spacing:** 24 internal; hero module `p-8` and spans 2 grid cols.
- **States:** loaded, skeleton, empty (one muted line + a relevant action), error (inline retry).
- **Rules:** one idea per module. A module that needs a scrollbar is two modules. Modules have *unequal* weight — never an even grid of identical tiles (that's the dashboard-zoo anti-pattern).

### 9.5 Segmented control
- **Purpose:** small mutually-exclusive choice — confidence (1–5), Review rating, energy toggle, local view switch.
- **Style:** `bg-subtle rounded-md p-0.5`, segments `rounded-[7px] px-3 py-1.5 body`; selected `bg-surface text-primary shadow-xs`.
- **States:** hover, selected, focus (roving tabindex), disabled.
- **Interactions:** arrow keys move; number keys jump (confidence `1–5`). `150ms` thumb slide; respect reduced-motion (cross-fade instead).
- **Rules:** ≤5 segments. More → use a Select. Confidence segmented control is **required before reveal** in Practice (Hard Rule, schema captures confidence pre-reveal).

### 9.6 Option row (Practice/Mock answer)
- **Purpose:** selectable MCQ answer.
- **Style:** full-width `bg-surface border border-default rounded-md p-4`, leading `A–D` key in a `caption` mono pill.
- **States:** default; hover `bg-hover`; selected `border-accent bg-accent-subtle`; **post-submit** correct `border-success bg-success-subtle`, chosen-wrong `border-danger bg-danger-subtle`, others dim to `text-secondary`.
- **Interactions:** click or press `A–D`; `⏎` submits. Lock after submit. `200ms` color settle on reveal.
- **Rules:** exactly one correct (verify gate guarantees this). Never animate position; only color.

### 9.7 Progress strip
- **Purpose:** show position in a finite task (review queue, mock).
- **Style:** `h-1.5 bg-active rounded-full`, fill `bg-accent`; or segmented ticks for mock questions. Count in `small text-muted` / mono beside it.
- **States:** determinate; in mock the strip pairs with the palette (§10.7).
- **Rules:** review/mock only. Not a generic page loader.

### 9.8 Mastery indicator
- **Purpose:** one concept's strength, consistently, everywhere.
- **Style:** a `mastery-0…4` dot (8px) for rows, a filled bar (track `bg-active`, fill = mastery color) for detail, a heatmap cell for grids.
- **States:** static; tooltip with `p_known` % (mono) + band name.
- **Rules:** mastery is the *only* sequential ramp in the app. Always pair color with the band word for colorblind safety.

### 9.9 Command palette
- **Purpose:** navigate + act from anywhere (§4.2).
- **Style:** overlay `bg-surface rounded-xl shadow-lg`, search field top, grouped results, right-aligned shortcut hints.
- **States:** empty (recents), typing (fuzzy results), no-match (one muted line), loading (concept search debounced).
- **Interactions:** `⌘K` open, type to filter, ↑↓ + `⏎`, `Esc` close. Result groups: Go to · Actions · Concepts.
- **Rules:** every primary action in the app must be reachable here. Keeps visible chrome minimal.

### 9.10 Drawer / sheet
- **Purpose:** progressive disclosure of secondary detail without leaving context (graph node inspector, card editor, mistake detail, mobile "More").
- **Style:** right-side panel (desktop, 360–420px) or bottom sheet (mobile), `bg-surface border-l border-default shadow-md`.
- **States:** open/close `200ms` slide (reduced-motion: fade), focus-trapped.
- **Rules:** for *inspecting/editing one thing*; multi-step flows still get a real screen.

### 9.11 Toast & inline feedback
- **Purpose:** confirm an async result quietly.
- **Style:** `bg-surface border border-default rounded-lg shadow-md p-4`, leading semantic dot, auto-dismiss ~4s, top-right stack.
- **Rules:** confirmations and recoverable errors only. Destructive/blocking decisions use a modal. Never toast something the user can already see succeed.

### 9.12 Empty state
- **Purpose:** turn a blank screen into a first action.
- **Style:** centered in the content region: one muted `lucide` line icon (40px), one `body` line of guidance, one Primary button. Max ~320px wide.
- **Rules:** always offer the action that fills the void (see each screen's empty state in §10). Never a bare "No data."

---

## 10. Screen design

Per screen: **purpose · primary action · layout · content hierarchy · key components · empty state · mobile.** Layout type (Cockpit/Workbench/Focus) named for each.

### 10.1 Today — *new home* (Cockpit)
- **Purpose:** answer "what do I do now and am I on track" in one glance. Replaces the `/ → /review` redirect.
- **Primary action:** **Start review** (`▸`, shows due count) — the single coral button, top-right and echoed in the hero.
- **Layout:** Cockpit. Hero module (2-col) = a one-line greeting (`body-lg`, optional serif) + the day's headline: *"12 reviews due, 4 new concepts, ~25 min."* + Start review. Supporting 1-col modules: **Today's plan** (top 3 plan rows + "Open planner"), **Readiness** (number + band, links to Dashboard), **Streak** (quiet counter), **Continue** (resume last mock/practice/tutor thread if any).
- **Hierarchy:** next action → today's plan → standing → streak. Descending commitment.
- **Key components:** status module, status chip, progress strip (today's completion), mastery-tinted plan rows.
- **Empty state (fresh install):** hero becomes onboarding — *"Add your first concepts to begin"* → Primary "Set up content" (Settings → Content). Hide modules with no data rather than show zeros.
- **Mobile:** single column, hero first; modules stack; Start review is a full-width sticky button above the tab bar.

### 10.2 Review (Focus)
- **Purpose:** the Anki loop — clear today's due SRS cards with minimal friction.
- **Primary action:** **Reveal** (Space), then **rate** (1–4).
- **Layout:** Focus. Rail collapses, tab bar hidden. Top: slim progress strip + `n left` (mono) + `Esc` to exit. Center `max-w-column`: concept `caption` chip → card face `body-lg` on `bg-surface rounded-lg p-8` → (after reveal) hairline divider → answer.
- **Hierarchy:** progress (ambient) → card face (hero) → rating row (on reveal).
- **Key components:** card face, progress strip, **rating row** = Again/Hard/Good/Easy as secondary buttons, left dot tinted danger→warning→success→success, each showing its FSRS next-interval in `caption` mono and its key (`1–4`). Neutral-bodied buttons (calm, not traffic-light).
- **Empty state:** *"All caught up."* — a single check icon, today's count done, and secondary "Practice instead" → Practice. Celebratory but quiet (no confetti).
- **Mobile:** identical; rating row is a 2×2 grid; large tap targets; swipe disabled to avoid mis-rates.

### 10.3 Practice (Focus, with a setup step)
- **Purpose:** targeted MCQ drilling by concept/section, with confidence + EV training.
- **Primary action:** **Submit** (after select), then **Next**.
- **Layout:** Focus. A lightweight *setup* card first (pick concept/section, count, optional "weak concepts only") → Start. Then per-question Focus column: stem `body-lg` → 4 option rows → **confidence segmented (1–5), required, before reveal** → Submit.
- **Hierarchy:** stem → options → confidence → submit; post-submit: correctness coloring → explanation block (`bg-subtle rounded-lg p-4`) → Next.
- **Key components:** option row, segmented (confidence), explanation block, an **EV hint** (`small text-muted`: *"Below your 0.25 break-even — skipping is +EV"*) sourced from the calibration model. Progress strip across the set.
- **Empty state:** no verified questions for the filter → *"No verified questions here yet"* + secondary "Generate from a passage" (→ Settings → Content → Generate, scoped to the concept).
- **Mobile:** options full-width rows; confidence segmented full-width above Submit (sticky).

### 10.4 Mocks (Workbench → Focus runner → Cockpit result)
- **Purpose:** full timed exam simulation + honest post-analysis.
- **Primary action:** **Start mock** (list) → **Submit** (runner).
- **Layout:**
  - *List (Workbench):* header "Mocks" + Start mock. Rows of past sessions: date, score (mono), accuracy, pacing flag chips. `New mock` opens a small config (section mix from `exam_config`, length).
  - *Runner (Focus, chrome-stripped):* sticky top = **mono timer** (→ warning <5min, → danger <1min) + attempted/skipped counts + **question palette** toggle. Center = question (reuses option rows, *no* confidence, *no* immediate reveal). Bottom: Prev / Mark / Next. Submit → confirm modal.
  - *Result (Cockpit):* score vs target band, section breakdown, **pacing chart** (time per question with the danger overruns marked), "review wrong answers" → feeds Diagnosis/Practice.
- **Key components:** mock timer, **question palette** (grid: `mastery-0` unanswered, `accent-subtle` answered, `border-accent` current, dot = marked), confirm modal, pacing chart.
- **Empty state:** *"No mocks yet — simulate exam day."* + Start mock. If `exam_config` unset → nudge to Settings → Exam config first.
- **Mobile:** palette in a bottom sheet; timer pinned; one question per screen; Submit confirm is a full sheet.

### 10.5 Planner (Cockpit)
- **Purpose:** show today's/this-week's ordered intake (priority + intake cap + exam backstop).
- **Primary action:** **Start today's plan** (→ Review/Practice queue).
- **Layout:** Cockpit. Top module = load summary: `reviews due` · `new concepts` · `est. minutes` chips + **"Low-energy day → reviews only"** toggle (segmented). Below: ordered **plan rows** — concept name (`h3`) + one-line `small text-muted` reason ("prereqs met, high yield") + priority chip + mastery dot. A muted "This week" accordion beneath (progressive disclosure).
- **Hierarchy:** load/energy → today's ordered list → week (collapsed).
- **Key components:** list row, segmented (energy), priority chip, mastery dot.
- **Empty state:** exam date/concepts missing → *"Set your exam date to get a plan"* → Settings → Exam config.
- **Mobile:** summary chips wrap; rows stack; Start is sticky full-width.

### 10.6 Graph (Focus canvas + inspector — Obsidian)
- **Purpose:** explore the concept ontology and prerequisite/related/contrast edges; see mastery spatially.
- **Primary action:** **select a node** → inspect; secondary "Focus subtree".
- **Layout:** near-full-bleed interactive canvas (collapse rail). Nodes colored by `mastery-0…4`, sized by `exam_weight`; edges styled by type (prereq solid, related hairline, contrasts dashed). **Right inspector drawer** on select: concept name, mastery bar, prereqs (with their mastery), "contrasts-with" pairs, resources (route-out links), and actions (Practice this · Add card · Ask tutor).
- **Hierarchy:** canvas (explore) → inspector (act on one concept).
- **Key components:** graph canvas, node, edge, drawer, mastery legend (pinned corner), zoom/fit controls (bottom-right, ghost).
- **Empty state:** *"Your map grows as you add concepts."* + "Add concepts" → Concepts/Content.
- **Mobile:** canvas pan/pinch; tap node → bottom sheet inspector; default to a filtered subgraph (current subject) to stay legible.

### 10.7 Diagnosis (Workbench)
- **Purpose:** surface recurring misconceptions and confident-wrong patterns, non-judgmentally.
- **Primary action:** **Drill this misconception** (→ adversarial practice).
- **Layout:** Workbench. Left list = misconceptions grouped by concept: label + count chip + `kind` tag (semantic-subtle tint per kind) + a `danger` marker if confident-wrong. Right detail = the misconception explained, the wrong attempts that triggered it (read-only, append-only log), the contrast it's missing, and Drill / Ask tutor actions.
- **Hierarchy:** weakest/most-frequent first → detail → drill.
- **Key components:** list row, kind tag, count chip, `danger` confident-wrong marker, explanation block.
- **Empty state:** *"No diagnosed mistakes yet — they appear as you practise."* Neutral, even reassuring. + secondary "Practice".
- **Mobile:** list → push detail; kind filter as a chip row up top.

### 10.8 Dashboard (Cockpit)
- **Purpose:** honest standing, trend, and readiness — orientation, not a metrics dump.
- **Primary action:** none is coral here; the screen is read-only. The implicit next step is the **Readiness module's "What to fix" → Planner/Diagnosis** link.
- **Layout:** Cockpit. Hero (2-col) = **Readiness**: a single honest number vs target band with explicit uncertainty wording (mono number, optional serif). Supporting modules: **Trend** (thin-stroke line, accent primary series), **Mastery heatmap** (mastery ramp grid, tap cell → concept), **Coverage bars**, **Streak**.
- **Hierarchy:** readiness → trend → mastery detail → coverage → streak.
- **Key components:** status module, readiness number, trend chart (hairline gridlines, `text-muted` axes), heatmap, coverage bar, streak counter.
- **Empty state (current copy kept but trimmed):** one line + "Start practising" → Practice. **Delete the existing explanatory subtitle** under the title per §5.2.
- **Mobile:** modules stack; heatmap horizontally scrolls within its module; readiness first.

### 10.9 Current Affairs (Workbench, two local tabs)
- **Purpose:** grounded CA feed (source-of-truth `raw_text`) + the daily digest. Every fact traces to source (Hard Rule).
- **Primary action:** **Generate cards from today** (grounded) — or in Digest tab, **Play digest**.
- **Layout:** Workbench with header local tabs **Feed · Digest**. *Feed:* left list of CA items (date, source, title, a "grounded" check); right detail = the `raw_text` passage (`body-lg`, `max-w-read`) with generated questions/cards shown as *traceable to this source*. *Digest:* a Notion-style reading column + audio/play control.
- **Hierarchy:** item list → source passage → grounded artifacts.
- **Key components:** list row, source/grounded chip, reading block, digest player, "Generate cards" (writes only grounded items).
- **Empty state:** *"No current-affairs items yet"* + "Ingest a passage" (→ Settings → Content → Ingest). Generation is **disabled** with a tooltip until a source exists (enforces no-ungrounded-GA at the UI layer).
- **Mobile:** tabs at top; list → push to passage; digest player pinned bottom.

### 10.10 Tutor Chat (Focus, reading-first — *the one content surface*)
- **Purpose:** ask doubts; the model appears to remember you (pure retrieval behind the scenes).
- **Primary action:** **Send** (composer).
- **Layout:** Focus, centered 720–760px on `bg-canvas`. **Assistant messages = plain text on canvas, no bubble** (Claude-style), `body-lg`, `max-w-read`. **User messages = `bg-subtle rounded-xl px-4 py-3`.** Composer pinned bottom: `bg-surface border border-strong rounded-xl`, send = primary (icon-only when empty). A subtle **context strip** above the composer (`caption text-muted`) names what the tutor is grounded on right now (e.g. "Polity · President — using your last 5 misses") — quiet proof of memory, collapsible.
- **Hierarchy:** conversation (hero) → composer → context strip.
- **Key components:** message (assistant/user variants), composer, thinking indicator (three quiet dots), streaming caret, context strip, "Open in tutor" deep-links from concepts/diagnosis.
- **Empty state:** a few **suggested prompts** as ghost chips drawn from current weak concepts ("Explain Articles 72 vs 161"), not a blank box.
- **Mobile:** full-height column; composer above the (hidden-on-focus) tab bar; context strip collapses to a single chip.

### 10.11 Concepts (Workbench)
- **Purpose:** browse/inspect the ontology; jump to study a concept.
- **Primary action:** **Add concept** (header) / on detail: **Practice this**.
- **Layout:** Workbench. Left = filterable tree/list (subject → topic → subtopic → concept) with mastery dot + search; right = concept detail: mastery bar, exam weight, prereqs (mastery-aware), edges, resources (route-out), recent attempts summary, and actions (Practice · Add card · Ask tutor · Show in graph).
- **Hierarchy:** find concept → understand its state → act.
- **Key components:** tree/list row, mastery bar, edge list, resource links, breadcrumb.
- **Empty state:** *"No concepts yet"* + "Add concepts" / "Import" (→ Content).
- **Mobile:** searchable list → push detail; tree flattened with section headers.

### 10.12 Cards (Workbench)
- **Purpose:** manage the SRS card library (FSRS state lives on the card).
- **Primary action:** **New card** (header).
- **Layout:** Workbench. Left = card list with filters (concept, state: new/learning/review/due, search); rows show front snippet + concept chip + due (mono) + state. Right = card editor/detail (front, back, concept, FSRS state read-out, history). Bulk select for tag/suspend/delete (delete confirms).
- **Hierarchy:** filter → scan → edit one.
- **Key components:** list row (with checkbox), card editor (drawer or pane), state chip, due (mono), filter chip row.
- **Empty state:** *"No cards yet — create your first review card"* + New card. Offer "Generate cards" as secondary.
- **Mobile:** list → push editor; bulk actions in a bottom action bar when selecting.

### 10.13 Settings (Workbench, sectioned)
- **Purpose:** the home for all *configuration and authoring* — deliberately out of the daily path.
- **Primary action:** contextual per section (Save / Ingest / Generate).
- **Layout:** Workbench. Left = settings sections: **Exam** (sections JSONB editor, dates, negative-marking, locale), **Calibration** (confidence→accuracy curve, EV threshold, Refit), **Content** (local tabs: Ingest · Import · Generate), **Data** (export — single-user data ownership), **Appearance** (density, reduced-motion). Right = the active section's form/tools.
- **Hierarchy:** pick section → configure → save/run with clear result feedback.
- **Key components:** form fields (`Field`), Save button with loading state, JSON/section editors, ingest/generate forms (moved here), calibration refit + curve viz, **verify-gate feedback** on generation (shows how many passed/failed the gate — never silently sets `verified=true`).
- **Empty state:** Exam config unset is the *primary* first-run nudge surfaced on Today; the section itself shows a friendly default form.
- **Mobile:** sections as a top select / accordion; one form at a time.

---

## 11. States and feedback

Every data view defines four states. No screen ships with only the happy path.

- **Loading:** **skeletons that match final layout** (gray `bg-active` blocks at the real row/module dimensions), not spinners-on-blank. Focus screens (review/mock) show a centered slim progress only. Skeletons appear after ~150ms to avoid flash on fast loads.
- **Empty:** the §9.12 pattern — icon + one line + the action that fills it. Per-screen copy specified in §10. Never "No data."
- **Error:** inline within the module/region, not a full-page takeover: one `danger` line + **Retry** (ghost). Network/save errors → toast with Retry. Generation/verify failures explain *why* (gate failed: ungrounded fact / no unique answer) so it's actionable.
- **Success:** quiet. Inline check + state change for in-context actions; toast only for async/background results. Review completion = a calm "All caught up", never confetti.

**Optimistic UI** for ratings, card edits, marking — apply immediately, reconcile, and roll back with a toast on failure. Behavioral logs (`attempt`/`review`/`interaction`) are append-only: the UI never shows an "edit history" affordance on them.

**Destructive actions** (delete card/concept) → confirm modal naming the object; the button is the destructive style; never a toast-only undo for permanent deletes.

---

## 12. Accessibility

- **Contrast:** body always `text-primary` on canvas/surface (~12:1). Honor `UIdesignspec §3` accent rules — coral text only ≥16px medium, else `accent-strong`/`text-primary`. White-on-accent only for ≥15px medium labels. **No small coral body text.**
- **Color is never the only signal:** correctness pairs color with an icon/word; mastery pairs ramp with the band name; the mock palette pairs state-color with shape (current = ring, marked = dot).
- **Keyboard:** full operability — `⌘K` palette, review `1–4`/Space, options `A–D`, `⏎` submit, `Esc` exits focus modes and closes overlays. Visible focus ring (`ring-4 ring-focus`) on every interactive element; logical tab order; focus trapped in modals/drawers and restored on close.
- **Screen readers:** semantic landmarks (`nav`/`main`/`header`); icon-only buttons have `aria-label`; live regions announce timer thresholds, streaming tutor tokens (politely), and toast results; the question palette is a labeled grid.
- **Targets:** ≥44px on mobile (rating grid, tab bar, palette cells).
- **Motion:** `prefers-reduced-motion` disables slides/fades/streaming-caret animation; transitions become instant or simple opacity. Mock timer never flashes (it recolors, doesn't blink).
- **Forms:** label every field, errors tied via `aria-describedby`, validation messages are text + color.

---

## 13. Motion and micro-interactions

Calm and functional; motion clarifies state change, never decorates. Keep `UIdesignspec §9` timings.

- **Durations:** color 150ms, transform/opacity 200ms, `ease`/`ease-out`. Nothing over 250ms. No bounce, spring, parallax, or scale-pop.
- **Page entrance:** one subtle fade-up (`opacity 0→1`, `translateY 4px→0`) per view, light list stagger (≤40ms). Once — not on every element.
- **Review reveal:** answer fades/expands below the divider (180ms). Rating press = instant color settle + advance; no card-flip theatrics.
- **Practice submit:** option rows settle into correct/wrong colors over 200ms; explanation block fades in.
- **Mock timer:** smooth recolor at thresholds; under 1 min a *gentle* 1s pulse on the digits (disabled under reduced-motion).
- **Tutor streaming:** tokens append live with a blinking caret; three quiet dots while thinking.
- **Nav/drawer/palette:** 200ms slide/fade; rail expand 150ms width.
- **Hover:** background/border color shifts only — no lift/scale on rows or cards.
- **Reduced-motion:** all of the above degrade to instant or opacity-only.

---

## 14. Responsive behavior

Three breakpoints: **mobile <768 · tablet 768–1024 · desktop >1024.**

- **Shell:** desktop = icon rail (expandable); tablet = collapsed rail only; mobile = bottom tab bar (§4.3) + "More" sheet.
- **Cockpit:** desktop multi-col grid → tablet 2-col → mobile single column, hero first, modules stack, empties hidden.
- **Workbench:** desktop two-pane → tablet two-pane with narrower list (or list-over-detail toggle) → mobile single pane, list → push-to-detail, back button returns.
- **Focus:** identical intent at all sizes; controls become sticky full-width on mobile (Submit, Start, rating grid). Tab bar hidden in Review/Mock.
- **Tutor:** column shrinks to full width with side gutters; composer sits above the (focus-hidden) tab bar.
- **Graph:** desktop canvas + side drawer → mobile canvas + bottom-sheet inspector, defaulting to a filtered subgraph for legibility.
- **Tables/heatmaps:** scroll horizontally inside their module rather than reflowing or shrinking text below `small`.
- **Touch:** larger targets, sheets over hover-menus, no hover-only affordances (row `⋯` is always visible on touch).

---

## 15. Implementation notes

Concrete, against the current codebase.

- **Tokens:** keep `UIdesignspec.md §3/§10` as-is — no token churn. This redesign is structure, not palette.
- **Nav refactor:** rework `lib/nav.ts` to the four intent groups (§3). Rebuild `components/Sidebar.tsx` as the icon rail + expandable drawer; **delete the global `components/SectionTabs.tsx`** usage from `app/layout.tsx` and move any genuine sub-views to **local in-header underline tabs** (Content, Current Affairs).
- **New: Today.** Change `app/page.tsx` from `redirect("/review")` to a real `Today` Cockpit screen composed of existing query functions (`getReviewDays`, readiness, planner, streak).
- **New: command palette.** Add a client `CommandPalette` (e.g. `cmdk`) mounted in `layout.tsx`; source destinations from `lib/nav.ts` and concepts/actions from the query layer. Wire `⌘K`.
- **Header component:** add a shared `PageHeader` (`title` + `chips` + `action` + optional `tabs`) and adopt it on every Cockpit/Workbench screen — this is the mechanism that removes the per-screen subtitle paragraphs in one pass.
- **List vs Card:** introduce a `ListRow` primitive and migrate Concepts/Cards/Diagnosis/Current-Affairs/Planner off stacked `Card` wrappers (§8 correction).
- **Move authoring:** relocate `app/ingest`, `app/import/testbook`, `app/generate`, `app/calibration`, `app/exam` under a `Settings` shell (routes can stay; nav and headers reframe them as Settings sections with local tabs). `app/feynman`, `app/recall`, `app/digest` become modes/tabs (Feynman/Recall launched from Review/Concept; Digest a tab in Current Affairs).
- **Focus modes:** Review/Practice-session/Mock-runner render in a layout variant that collapses the rail and hides the mobile tab bar (a `focus` route group or a layout flag).
- **Skeletons:** add per-screen skeleton components sized to final layout; gate behind a 150ms delay.
- **Verify gate at the UI edge:** generation/CA actions must keep throwing without a grounding source and must surface gate pass/fail counts (Hard Rules §2 — never set `verified=true` from the client).
- **Build order:** ship the shell + `PageHeader` + Today + palette first (biggest perceived change), then migrate screens group-by-group (Practice verbs → Plan → Knowledge → Settings), then states/skeletons polish. Each step keeps the app runnable (working agreement: ship increments).
- **a11y/motion:** centralize `prefers-reduced-motion` handling in `globals.css` and a `useReducedMotion` hook; add the focus-ring utility globally.

---

## 16. Do / Do not

**Do**
- Lead every non-Tutor screen with a **primary action**, not a description.
- Express status as **chips, numerals, bars** — scannable in seconds.
- Use **hairline rows** for lists; reserve cards for Cockpit modules and the review face.
- Keep **one coral element** per viewport; everything else neutral.
- Make the keyboard work everywhere; show shortcuts in tooltips and the palette.
- Cap reading surfaces at `max-w-read`; give Focus screens room to breathe.
- Provide **all four states** (loading/empty/error/success) on every data view.
- Hide authoring/config in **Settings**; surface only its *outputs* in the daily path.

**Do not**
- ❌ Open a screen with an `h1` + explanatory subtitle paragraph (the documentation tell).
- ❌ Render lists as stacks of padded cards.
- ❌ Show an even grid of identical dashboard tiles (the dashboard zoo).
- ❌ Put two coral buttons in view, or color decorative things coral.
- ❌ Use spinners-on-blank where a skeleton fits, or confetti/bouncy motion.
- ❌ Add a second persistent nav layer (the old global `SectionTabs`).
- ❌ Treat the app like a chat app — only the Tutor reads as conversation.
- ❌ Use bright/alarm semantic colors, heavy shadows, `#000` text, pure-white pages, or dark mode.

---

## 17. Final summary

The platform already has the right *palette*; it lacked the right *product structure*. This redesign fixes the "documentation feel" with five structural moves:

1. **A Today command surface** so the app always has an obvious next action (Duolingo).
2. **An icon rail + command palette**, intent-grouped, authoring demoted to Settings (Linear).
3. **A strict action-first page header** — title + status chips + one primary action, *no subtitle paragraphs* — applied uniformly.
4. **Hairline rows over card stacks**, three canonical layouts (Cockpit/Workbench/Focus), and disciplined per-context density (Notion calm, Anki focus).
5. **Two signature interactive surfaces** done properly: an Anki-grade Review focus mode and an Obsidian-grade Graph canvas with an inspector.

Hold the line on the ten UX principles (§2) and the accent budget (§7.1), give every screen its four states (§11), and the result is a calm, intelligent, fast, trustworthy exam cockpit — not a catalogue of features.

*Pair with `UIdesignspec.md` (tokens & primitives) and `CLAUDE.md` (architecture, schema, hard rules). Where this document and the look-and-feel notes in `CLAUDE.md §6` or `UIdesignspec.md §8` conflict on structure/hierarchy, this document wins; on raw tokens, `UIdesignspec.md` wins.*
