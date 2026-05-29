# CLAUDE.md — RRB NTPC Personal Learning Platform

> This file is the single source of truth for any AI assistant working in this repo. Read it fully before touching any code. The four companion documents in the repo root expand on every section below:
> - `UIdesignspec.md` — visual language, tokens, component recipes
> - `RRBNTPCbuildbrief.md` — product brief, hard rules, full schema, build order, user stories
> - `learnermemoryarchitecture.md` — schema narrative + retrieval/write path detail
> - `userstoriesplan.md` — phased story backlog (v1–v6)

---

## 1. What this is

A **single-user, AI-assisted study platform** for one person preparing for the RRB NTPC exam. It is a **practice + memory + diagnosis engine plus a study planner** — not a content/courseware platform. The learner studies external sources (NCERT, Lucent GK, PYQ papers); the app handles everything around that: spaced-repetition review, MCQ practice and mock tests, automatic mistake diagnosis, confidence/attempt-strategy training, and a daily plan of what to study next. An AI tutor answers doubts with full awareness of the learner's history.

**Core paradigm:** the LLM is **stateless**. All memory lives in Postgres and is retrieved into the prompt at call time. Personalization = retrieval + a small classical student model (BKT + FSRS + logistic regression). Never fine-tune.

### Three memory layers (the mental model)
All three live in Postgres:
- **Structured (source of truth):** exact per-concept stats, error logs, mastery — plain SQL tables (`concept_mastery`, `attempt`, `misconception_hit`, …).
- **Semantic:** free text (Feynman explanations, doubts, notes) embedded into pgvector (`interaction.embedding`) for fuzzy recall.
- **Profile:** a nightly LLM-written paragraph (`learner_profile.summary_text`) compressing the whole learner, cached into every tutor prompt.

### Working agreement (how to build)
- **Build in phases (§11). Ship v1 completely and get it running before starting v2.** The app must run end-to-end at every phase boundary.
- **Ask for clarification only when genuinely blocked.** Otherwise proceed and state your assumptions inline.
- Each phase delivers: migrations + the runnable increment + updated README run steps.
- Align all code to the schema in §5. If you need a new column/table, add a migration and note why — don't silently drift from the schema.

---

## 2. Hard rules — non-negotiable acceptance gates

These are enforced *everywhere* in the codebase. A feature is not done if any are violated.

1. **No fact generation from model memory for GA/GK.** GA/GK questions and cards must be generated only from supplied source text (`current_affairs_item.raw_text` or a provided passage). Every fact must trace to that source. Ungrounded GA generation must be impossible by construction.
2. **Every AI-generated question passes a verify gate before display.** Math/reasoning: independently recompute the answer. GA: confirm each fact traces to source. All: exactly one correct option, distractors plausible. Only `verified = true` items reach the user.
3. **No model fine-tuning.** Personalization is retrieval-augmented (RAG over the learner's own data) + small classical models. No fine-tuning pipeline.
4. **Cost discipline.** Route tasks to the cheapest model that clears the quality bar; use batch processing for non-interactive jobs and prompt caching for reused context (syllabus, learner profile). Target single-digit-dollars/month.
5. **Single-user & data ownership.** One owned Postgres database; study data is exportable; no third-party persistence of study data beyond the transient LLM API call.
6. **Append-only behavioral logs.** Never overwrite history in `attempt`, `review`, `interaction`. Derived state (`concept_mastery`) is updated; raw events are immutable.
7. **Selective retrieval, never dump-everything.** Assemble the *relevant slice* into context; never stuff the whole database into prompts.

---

## 3. Tech stack

| Layer | Technology |
|---|---|
| Frontend + Backend | Next.js (App Router, server actions as API) |
| Database | Postgres + **pgvector** extension (Supabase or Neon free tier) |
| Spaced repetition | **FSRS** via `ts-fsrs` (not SM-2) |
| LLM access | Provider-agnostic router; default cheap model (DeepSeek V4 Flash); Anthropic SDK works for DeepSeek too (swap base URL + key) |
| Embeddings | Multilingual 1024-d model (BGE-M3 / multilingual-e5 / Voyage) into pgvector |
| Styling | **Tailwind CSS** with custom tokens from `UIdesignspec.md §10` |
| Hosting | Vercel (app) + managed Postgres; cron for nightly batch jobs |
| PWA | Offline review queue, sync on reconnect |

### LLM router rule
Abstract the provider behind a router so DeepSeek / Claude / Gemini / Sarvam are swappable via config. **Never hardcode one vendor in business logic.**

---

## 4. Project structure (target — build this)

```
/
├── app/                        # Next.js App Router
│   ├── (review)/               # Daily review loop (v1)
│   ├── (practice)/             # Question bank + practice (v2)
│   ├── (mock)/                 # Mock tests (v3)
│   ├── (tutor)/                # AI tutor chat (v2)
│   ├── (planner)/              # Study planner (v3)
│   ├── (diagnosis)/            # Mistakes & misconceptions (v4)
│   ├── (dashboard)/            # Insights & heatmap (v6)
│   ├── api/                    # Route handlers (if server actions insufficient)
│   └── layout.tsx              # Root layout with sidebar shell
├── components/
│   ├── ui/                     # Primitive components (Button, Card, Badge, Input…)
│   ├── review/                 # CardFace, RatingRow, ReviewProgress
│   ├── practice/               # QuestionStem, OptionRow, ExplanationBlock
│   ├── mock/                   # MockTimer, QuestionPalette, PacingChart
│   ├── tutor/                  # ChatBubble, Composer, ThinkingIndicator
│   ├── planner/                # PlanCard, EnergyToggle
│   └── dashboard/              # MasteryHeatmap, TrendChart, ReadinessCard
├── lib/
│   ├── db/
│   │   ├── schema.sql           # Canonical migration (source of truth)
│   │   └── queries/             # One file per domain (cards.ts, attempts.ts…)
│   ├── fsrs/                   # FSRS wrapper around ts-fsrs
│   ├── bkt.ts                  # Bayesian Knowledge Tracing (15 lines)
│   ├── llm/
│   │   ├── router.ts            # Model router (cheap / strong selection)
│   │   ├── prompts/             # Prompt builders per task
│   │   └── verify.ts            # Verify gate for generated questions
│   ├── planner.ts              # Priority + intake-cap logic
│   └── calibration.ts          # Logistic regression + EV threshold
├── public/
│   └── manifest.json           # PWA manifest
├── migrations/                 # Numbered SQL migrations
├── tailwind.config.ts          # Custom tokens (see §6 below)
├── globals.css                 # CSS variables (design tokens)
└── CLAUDE.md                   # This file
```

---

## 5. Database schema (source of truth)

Create tables in this order (respects FK constraints). Full annotated SQL lives in `RRBNTPCbuildbrief.md §5` and `learnermemoryarchitecture.md`.

```sql
CREATE EXTENSION IF NOT EXISTS vector;  -- pgvector; embedding dim 1024

-- Exam parameterisation (one row per instance)
exam_config         -- sections JSONB + negative_mark_ratio + locale + exam_date

-- Core ontology
concept             -- subject > topic > subtopic > concept hierarchy
concept_edge        -- prerequisite / related / contrasts_with graph
concept_resource    -- external "where to learn" pointers (routes OUT, stores nothing)

-- Assessment items
card                -- SRS review units; FSRS state lives here
question            -- MCQs: pyq | ai_generated | adversarial; verified gate
current_affairs_item -- grounding source for GA generation (raw_text is sacred)
pyq_topic_stats     -- PYQ frequency analysis → exam_weight on concepts

-- Behavioral logs (APPEND-ONLY — never overwrite)
attempt             -- every question attempt; confidence captured BEFORE reveal
review              -- every SRS review event (drives FSRS)
interaction         -- Feynman/doubt/note free-text + pgvector embedding
mock_session        -- mock test instances + pacing_data JSONB

-- Student model (live derived state)
concept_mastery     -- BKT p_known + mastery_level; updated per attempt
calibration_model   -- confidence → P(correct) logistic params + EV threshold
learner_profile     -- nightly LLM-written paragraph; injected into every tutor call

-- Planner output
study_plan          -- daily/weekly ordered new_concepts + review_load
```

### Key constraints to enforce in code
- `question.verified` **must be `true`** before any question is shown to the user.
- `current_affairs_item.raw_text` must be present before any GA question generation.
- `attempt`, `review`, `interaction` rows are INSERT-only; never UPDATE or DELETE.
- `concept_mastery` is the only table that gets UPDATE (derived state).

### `exam_config` — parameterise, never hardcode
The exam structure is data, not code. Mocks, the EV trainer, and the planner all read it.
```
sections            JSONB   -- [{name, questions, marks, time_s}, ...]
negative_mark_ratio REAL    -- 0.3333 (1/3) for RRB NTPC
exam_date           DATE    -- drives the planner's exam-date backstop
locale              TEXT    -- 'en' default; schema is language-agnostic for later
```

### Question sources (three trust levels feeding `question`)
- **PYQ — ingested, never generated.** Real past papers tagged to `concept_id` with `exam_year`/`exam_stage`. The difficulty anchor everything else calibrates against.
- **AI-generated — math/reasoning generated freely + auto-verified; GA generated ONLY from source text.** `gen_source` records the grounding (`ca:<id>` / `passage` / `pyq:<id>`).
- **Adversarial — generated from a wrong attempt + its diagnosed misconception** to force the missed distinction; lineage via `parent_question_id`.

---

## 6. Design system

The visual language mirrors **Claude.ai's web interface**: warm ivory canvas, one clay/coral accent, hairline borders, generous whitespace. Full token definitions live in `UIdesignspec.md`.

### CSS variables (paste into `globals.css`)

```css
:root {
  --bg-canvas:      #FAF9F5;   /* app background */
  --bg-subtle:      #F0EEE6;   /* sidebar, secondary panels */
  --bg-surface:     #FFFFFF;   /* raised cards, inputs */
  --bg-hover:       #F2F0E9;
  --bg-active:      #EBE8DF;
  --text-primary:   #262624;
  --text-secondary: #5C5A54;
  --text-muted:     #82807A;
  --text-on-accent: #FFFFFF;
  --text-on-dark:   #FAF9F5;   /* text on dark surfaces (tooltips) */
  --border-default: #E6E3DA;
  --border-strong:  #D8D4C8;
  --accent:         #D97757;   /* primary actions ONLY */
  --accent-hover:   #C2603F;
  --accent-subtle:  #F6E9E2;
  --focus-ring:     rgba(217,119,87,0.35);
  --success:        #5B8C6E;  --success-subtle: #E7EFE8;
  --warning:        #C9912F;  --warning-subtle: #F6EDD9;
  --danger:         #BF5340;  --danger-subtle:  #F4E4DF;
  --mastery-0: #E6E3DA; --mastery-1: #E8C9BC; --mastery-2: #EBD2A6;
  --mastery-3: #CFD9B8; --mastery-4: #A9C7B0;
  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 16px; --radius-xl: 24px; --radius-full: 9999px;
  --shadow-xs: 0 1px 2px rgba(40,38,36,0.04);
  --shadow-sm: 0 1px 3px rgba(40,38,36,0.06),0 1px 2px rgba(40,38,36,0.04);
  --shadow-md: 0 4px 12px rgba(40,38,36,0.08);
  --shadow-lg: 0 12px 28px rgba(40,38,36,0.12);  /* modals/menus only */
  --space-unit: 4px;  /* scale: 4 8 12 16 20 24 32 40 48 64 */

  /* Fonts — Styrene A is proprietary; fallback stack keeps the clean grotesque character */
  --font-sans:  "Styrene A", ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Inter", Arial, sans-serif;
  --font-serif: "Tiempos Text", "Source Serif 4", "Georgia", serif;  /* large hero headings ONLY */
  --font-mono:  ui-monospace, "SF Mono", "JetBrains Mono", "Menlo", monospace;  /* timers + numeric stats */
}
```

### Typography
Default everything to `--font-sans`. Use `--font-serif` only for an optional large dashboard hero. Use `--font-mono` for the mock-test timer and any numeric stats so digits align.

| Token | Size | Line-height | Weight | Use |
|---|---|---|---|---|
| `display` | 36 | 1.15 | 500 | dashboard hero (rare) |
| `h1` | 28 | 1.25 | 600 | page titles |
| `h2` | 22 | 1.3 | 600 | section headings |
| `h3` | 18 | 1.4 | 600 | card titles |
| `body-lg` | 17 | 1.6 | 400 | tutor answers, card faces, reading |
| `body` | 15 | 1.55 | 400 | default UI text |
| `small` | 13 | 1.5 | 400 | meta, secondary |
| `caption` | 12 | 1.45 | 500 | labels/tags (often uppercase, +0.02em tracking) |

- Weights **400 / 500 / 600 only** — never 700+.
- Reading containers (tutor replies, explanations): cap width at **65–72ch**.

### Spacing & layout
- **Scale (px):** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 — multiples of 4 only.
- **Page gutters:** 24 mobile, 32–48 desktop.
- **Card padding:** 20 compact / 24 default / 32 feature.
- **Stack rhythm:** 8 tight, 16 grouped, 24–32 between sections.
- **Content max-widths:** app shell ~1200px; reading/review column ~680–720px; tutor chat column ~720–760px.
- **Layout shell:** left sidebar (nav) on `--bg-subtle` + main area on `--bg-canvas`. Sidebar collapsible; on mobile it becomes a bottom tab bar or drawer.

### Accessibility & contrast (don't skip)
- `--accent` on white is ~3.4:1 — fine for fills, icons, and large/bold text, **NOT for small body text.** For coral text on light, use ≥16px medium, else use `--accent-strong` or `--text-primary`.
- White text on `--accent`: OK for button labels ≥15px medium; if smaller/thin, switch button bg to `--accent-strong`.
- Body text always `--text-primary` on canvas/surface (~12:1).
- Respect `prefers-reduced-motion`: disable non-essential motion.

### Iconography
Line icons, ~1.5px stroke, rounded joins (**lucide-react** fits). Default icon color `--text-secondary`; `--accent` only for the active/primary thing. No photographic imagery in the core app; empty states use a single muted icon + one line of guidance.

### Tailwind config key extensions

```ts
colors: {
  canvas: "#FAF9F5", subtle: "#F0EEE6", surface: "#FFFFFF",
  hover: "#F2F0E9", active: "#EBE8DF",
  primary: "#262624", secondary: "#5C5A54", muted: "#82807A",
  border: "#E6E3DA", "border-strong": "#D8D4C8",
  accent: { DEFAULT:"#D97757", hover:"#C2603F", strong:"#BF5D3B", subtle:"#F6E9E2", border:"#E8C4B4" },
  success: { DEFAULT:"#5B8C6E", subtle:"#E7EFE8" },
  warning: { DEFAULT:"#C9912F", subtle:"#F6EDD9" },
  danger:  { DEFAULT:"#BF5340", subtle:"#F4E4DF" },
  mastery: { 0:"#E6E3DA", 1:"#E8C9BC", 2:"#EBD2A6", 3:"#CFD9B8", 4:"#A9C7B0" },
}
```

Also extend `fontFamily` (sans/serif/mono), `fontSize` (the type-scale tokens above), `borderRadius` (sm/md/lg/xl/full), `boxShadow` (xs/sm/md/lg), `ringColor.focus`, and `maxWidth` (`read: "72ch"`, `shell: "1200px"`, `column: "720px"`). The complete config is in `UIdesignspec.md §10` — copy it verbatim.

### Design principles (enforce in every component)

- **Warm ivory canvas** (`--bg-canvas`). Never `#FFFFFF` backgrounds; white is for raised cards.
- **One accent** (`--accent` coral/clay) for primary actions and focus rings only. Nothing else is coral.
- **Hairlines over shadows.** Use `border border-default` to separate; `shadow-*` only for floating elements.
- **Generous whitespace.** Card padding: 20 (compact) / 24 (default) / 32 (feature).
- **Quiet typography.** Weights 400/500/600 only. No 700+. Warm near-black `--text-primary`, not `#000`.
- **Gentle motion.** `transition-colors duration-150`, `duration-200` for transforms. No bounce.
- **Light mode only.** No dark theme.

### Component quick-reference

```
Button primary:    bg-accent text-on-accent rounded-md px-5 py-2.5 font-medium h-[40px]
Button secondary:  bg-surface text-primary border border-strong rounded-md px-5 py-2.5
Button ghost:      text-secondary rounded-md px-3 py-2 hover:bg-hover
Card:              bg-surface border border-default rounded-lg p-6 shadow-xs
Input:             bg-surface border border-strong rounded-md px-3.5 py-2.5 focus:border-accent ring-focus
Badge (success):   bg-success-subtle text-success rounded-full px-2.5 py-0.5 caption
Badge (danger):    bg-danger-subtle text-danger rounded-full px-2.5 py-0.5 caption
Nav item active:   bg-active text-primary font-medium + 2-3px accent left border (NOT full coral fill)
Tab active:        text-primary + 2px accent underline (underline style, not boxed)
Modal:             bg-surface rounded-xl p-6 shadow-lg max-w-md; scrim bg-[#262624]/30 backdrop-blur-[2px]
Toast:             bg-surface border border-default rounded-lg shadow-md p-4 + semantic dot; auto-dismiss
Tooltip:           bg-[#262624] text-on-dark caption rounded-md px-2 py-1 shadow-md (small, dark, quiet)
Progress:          track bg-active rounded-full h-2, fill bg-accent (use mastery color for mastery bars)
Destructive btn:   secondary style but text-danger border-danger/40, hover bg-danger-subtle (rare)
```

### Do / Don't
- ❌ Pure white page backgrounds or `#000` text.
- ❌ Coral on large areas, multiple competing accents, or bright saturated semantic colors.
- ❌ Heavy drop shadows, thick borders, boxed/cluttered layouts.
- ❌ Bold 700+ weights, cramped spacing, bouncy/parallax motion.
- ❌ Dark mode, or full-coral active nav items.

---

## 7. Key algorithms

### BKT — Bayesian Knowledge Tracing (`lib/bkt.ts`)

Updates `concept_mastery.p_known` after every attempt. Default params: `p_T=0.15, p_S=0.1, p_G=0.25`.

```ts
// Step 1 — posterior
const post = correct
  ? (p * (1 - pS)) / (p * (1 - pS) + (1 - p) * pG)
  : (p * pS)       / (p * pS       + (1 - p) * (1 - pG));

// Step 2 — apply learning
const pKnownNew = post + (1 - post) * pT;

// Predict next answer
const pCorrect = pKnownNew * (1 - pS) + (1 - pKnownNew) * pG;
```

### Negative-marking EV (`lib/calibration.ts`)

RRB penalty = 1/3. Break-even at P(correct) = 0.25. The calibration model maps self-reported confidence (1–5) → true accuracy using logistic regression.

```
EV(attempt) = P · 1 − (1−P) · (1/3)
EV = 0  ⟹  P = 0.25   ← only attempt above this threshold
```

### Planner priority (`lib/planner.ts`)

```
LEARNABLE = concepts where every prerequisite has p_known ≥ 0.70
            AND own p_known < 0.60
PRIORITY(c) = exam_weight(c) × (1 − p_known(c))
INTAKE CAP:  new_cards + due_reviews ≤ daily_capacity
EXAM BACKSTOP: as exam_date nears, new intake → 0
```

### FSRS scheduling

Use `ts-fsrs` directly. Write `review` rows on every rating. Update `card.stability`, `card.difficulty`, `card.due_at`, `card.state`. Never re-implement FSRS — use the library.

### Misconception taxonomy (diagnosis)

Two-level structure: the specific `label` ("confuses_president_governor_pardon") lets the tutor say *"you've confused 72 and 161 three times"*; the `kind` lets the dashboard aggregate across concepts. The seven `kind` values:

| kind | meaning |
|---|---|
| `confusion` | mixes two similar concepts |
| `factual_gap` | simply doesn't know the fact |
| `partial_rule` | knows the rule, misses an edge case |
| `computational` | right method, arithmetic slip |
| `conceptual` | wrong underlying mental model |
| `trap` | fell for a distractor / misread the question |
| `stale` | knew it once, forgot (correlates with FSRS lapse) |

**`stale` is special:** when an attempt is wrong **and** the linked card has prior successful reviews, tag it `stale` and let FSRS reschedule — it's memory decay, not a knowledge gap. Don't treat it as new.

---

## 8. LLM read path — assembling a tutor prompt

The model looks like it remembers the learner, but it is pure retrieval:

```
[SYSTEM — cached]   tutor persona + RRB syllabus context + misconception kind reference
[MEMORY]
  • Learner profile (cached nightly paragraph)
  • This concept's concept_mastery row
  • Last 5 wrong attempts + misconception labels/kinds for this concept
  • prerequisite + contrasts_with edges from concept_edge (with p_known values)
  • Top-5 semantic matches from interaction table via pgvector cosine search
[USER]   <user message>
```

Rules:
- Cache the system prompt + learner profile using prompt-caching headers to minimize cost.
- Never send the whole database; only the relevant slice above.
- Use the **cheap model** (DeepSeek V4 Flash) for this call unless the question is flagged as complex.

---

## 9. LLM write path — after each attempt

1. **Code** inserts `attempt` + runs BKT → updates `concept_mastery`.
2. **If wrong:** one async LLM call classifies the failure → upserts `misconception`, inserts `misconception_hit`. AI interprets; code stores.
3. **If card reviewed:** `ts-fsrs` computes new state → insert `review` + update `card`.
4. **Free text** (Feynman/doubt): embed → insert `interaction`.
5. **Nightly batch:** regenerate `learner_profile`, recompute `pyq_topic_stats` → refresh `exam_weight`, refit `calibration_model`, run FSRS bulk scheduling, generate tomorrow's `study_plan`.

---

## 10. Question generation & verify gate

```
generate(cheap model) → verify gate → verified=true → serve
                                    → verified=false → discard / queue
```

**Verify gate rules by source:**
- `math/reasoning`: code independently recomputes the answer; must match and be unique.
- `ga/gk`: every fact in stem + options must trace back to the `current_affairs_item.raw_text` or supplied passage; no model-memory facts.
- All: exactly one correct option; distractors plausible but distinct.

Never set `verified=true` in application code without running all checks. The gate is a function in `lib/llm/verify.ts`.

---

## 11. Build phases

Build and **fully ship** each phase before starting the next. The app must run end-to-end at every phase boundary.

| Phase | Core deliverable | New tables |
|---|---|---|
| **v1** | Concept ontology, manual card creation, FSRS review loop, responsive PWA | `concept`, `card`, `review`, `exam_config` |
| **v2** | PYQ ingestion, MCQ practice, BKT mastery, AI tutor (read path), confidence capture, LLM router | `question`, `attempt`, `concept_mastery`, `calibration_model` stub |
| **v3** | Study planner, mock tests, pacing analysis, PYQ topic stats | `mock_session`, `pyq_topic_stats`, `study_plan` |
| **v4** | Misconception diagnosis, grounded question generation + verify gate, current-affairs ingestion | `misconception`, `misconception_hit`, `current_affairs_item` |
| **v5** | Feynman mode, semantic recall, calibration model, EV trainer, nightly profile, CA digest | `interaction`, `learner_profile`, `calibration_model` (full) |
| **v6** | Knowledge graph, concept resources, insights dashboard (heatmap, trends, readiness, streak) | `concept_edge`, `concept_resource` |

---

## 12. Screen-level requirements

### Daily Review (v1)
- Centered single column ~680px. Card face in `body-lg` on `bg-surface rounded-lg p-8`.
- Concept shown as a `caption` chip above the card.
- Reveal → answer appears below a hairline divider.
- Rating row: **Again / Hard / Good / Easy** as secondary buttons; tint left dot using semantic scale (Again→danger, Hard→warning, Good→success, Easy→success). Buttons stay neutral-bodied.
- Top: slim progress bar + remaining count in `small text-muted`.

### Practice & Question Bank (v2)
- Question stem `body-lg`. Options as full-width rows: `bg-surface border border-default rounded-md p-4`; selected `border-accent bg-accent-subtle`.
- After submit: correct `border-success bg-success-subtle`; chosen-wrong `border-danger bg-danger-subtle`.
- Explanation in `bg-subtle rounded-lg p-4` beneath.
- Confidence (1–5) captured **before** reveal via segmented control — required.

### Mock Test (v3)
- Distraction-free: hide sidebar. Sticky top bar with **monospace timer** (`--font-mono`); turns `warning` under 5 min, `danger` under 1 min.
- Question palette: grid of numbered cells — `mastery-0` default, `accent-subtle` answered, `border-accent` current, dot for marked.
- Submit triggers a confirm modal.

### AI Tutor Chat (v2, mirroring Claude.ai)
- Centered column ~740px on `bg-canvas`.
- Assistant messages: plain text on canvas in `body-lg` — **no bubble**.
- User messages: `bg-subtle rounded-xl px-4 py-3`.
- Composer: `bg-surface border border-strong rounded-xl` pinned to bottom.
- Streaming: render tokens as they arrive; blinking caret; three quiet dots for thinking.

### Study Planner (v3)
- `bg-surface rounded-lg` card; concept rows with name + `small text-muted` reason + priority chip.
- Review-load summary at the top. "Low-energy day → reviews only" toggle.

### Diagnosis / Mistakes (v4)
- Per-concept list of recurring misconceptions: label + count chip + `kind` tag (semantic-subtle tints per kind).
- "Confident-but-wrong" items flagged with a small `danger` marker.
- Keep the tone and color factual and non-judgmental.

### Dashboard / Insights (v6)
- Heatmap: concept/topic grid colored by mastery scale (0–4). Legend below. Tap → drill-in.
- Charts: thin strokes, `accent` for primary series, neutrals for context, minimal gridlines.
- Readiness: single honest number vs target band, explicit uncertainty wording.
- Streak: quiet counter, never punitive.

---

## 13. Development conventions

### General
- **No hardcoded hex colors** in components. Always reference CSS variables or Tailwind tokens.
- **No dark mode.** Do not add it unless explicitly requested.
- **No auth, no multi-tenancy.** Single user. No `user_id` columns (schema is already built without them).
- **No scope creep.** Build only what a phase requires. No speculative abstractions.
- Minimal comments — only when the *why* is non-obvious. No docblocks.

### Database
- All schema changes go into a numbered migration in `/migrations/`.
- `lib/db/queries/` has one file per domain (`cards.ts`, `attempts.ts`, `mastery.ts`, etc.).
- Never write raw SQL in component/action files; always go through the query layer.
- `attempt`, `review`, `interaction` are INSERT-only. Add a lint comment if you ever write UPDATE/DELETE against them.

### LLM / AI
- All LLM calls go through `lib/llm/router.ts`. Never call an SDK directly from a component or server action.
- Prompts are built in `lib/llm/prompts/`. One file per task.
- The verify gate (`lib/llm/verify.ts`) is called before setting `verified=true`.
- GA generation without a `current_affairs_item.id` or explicit source passage must throw at the call site.

### TypeScript
- Strict mode on.
- Database row types auto-generated from schema or manually kept in `lib/db/types.ts`.
- Zod validation at all server action boundaries.

### Testing
- For v1/v2 core loops: write integration tests against a local Postgres instance.
- BKT and calibration logic: pure unit tests — no DB needed.
- The verify gate: unit tests with fixture questions.

---

## 14. Out of scope (do not build)

- Multi-user / second-instance support
- Non-English (Kannada) localisation *(schema is ready for it via `exam_config.locale`, but don't build it)*
- Native mobile app, leaderboards, discussion forums, video hosting
- Dark mode
- Authentication / user accounts

---

## 15. Definition of done

A feature is complete only when:
1. Its acceptance criteria (from `userstoriesplan.md`) pass on **real data**.
2. No Hard Rule (§2 above) is violated.
3. Migrations are included and run cleanly.
4. The app runs end-to-end at the current phase boundary.
