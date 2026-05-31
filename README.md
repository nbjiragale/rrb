# RRB NTPC — Personal Learning Platform

A single-user, AI-assisted study platform for RRB NTPC prep. See [`CLAUDE.md`](./CLAUDE.md) for the full architecture, hard rules, schema, and conventions, and the four spec docs it references. **New here?** [`features.md`](./features.md) is a first-day "how do I use it?" guide; [`user-guide.md`](./user-guide.md) covers install and free hosting.

## Status: v6 (knowledge graph + insights dashboard)

**v1 — the daily review loop:**
- **Concept ontology** — author concepts under subject → topic → subtopic (A2).
- **Manual card creation** — hand-add review cards to a concept (A6).
- **Due queue + FSRS review loop** — rate again/hard/good/easy; `ts-fsrs` reschedules; every event logged append-only; new-card intake capped and paused on backlog (B1, B2, B3).
- **Responsive, installable PWA** on your own Postgres (L2, L3).

**v2 — practice + memory + tutor:**
- **PYQ ingestion** — tag a past-paper question to a concept with year/stage; duplicates flagged; stored verified (A5). Bulk-import a JSON batch on the same page — `concept` may be a name (matched against the ontology) or id; duplicates and malformed rows are skipped and reported, the rest still import (A2).
- **Topic practice** — pick a concept, answer MCQs; **confidence (1–5) captured before reveal**; attempts logged append-only with timing (C1, G1).
- **Student model (BKT)** — `concept_mastery.p_known` updated per attempt inside a transaction; derived mastery level (the foundation for the planner and heatmap).
- **AI tutor** — per-concept chat that assembles the read-path context (mastery + recent errors) and answers via the **provider-agnostic LLM router**; personalization is retrieval, never fine-tuning (E1, E2, K1, L1).

**v3 — planning, mocks, and PYQ analysis:**
- **Knowledge graph** — author prerequisite / contrasts-with links between concepts (A3).
- **PYQ analysis** — the nightly batch aggregates ingested PYQs into `pyq_topic_stats` and pushes frequency into `concept.exam_weight`.
- **Study planner** — priority-ordered new concepts (`exam_weight × (1 − p_known)`), gated by prerequisites, capped by capacity, energy-aware, with an exam-date backstop (I1–I5).
- **Weak-spot practice** — auto-targets the highest exam-weight, lowest-mastery questions (C2).
- **Mock tests** — full or sectional, timed, first-class skipping, real negative marking; post-mock topic/pacing analysis (D1–D5).

**v4 — diagnosis, generation, current affairs:**
- **Auto-diagnosis** — every wrong practice answer is classified out-of-band into one of seven misconception kinds with a reusable label + rationale, stored in `misconception` / `misconception_hit`; the nightly batch sweeps any wrong attempts the UI missed (F1).
- **Forgotten-but-once-known** — a wrong answer on a concept with a matured review card is tagged `stale` and the card is resurfaced for review, not treated as a new gap (F4).
- **Diagnosis view** — recurring traps per concept with counts, plus the error-kind shape per subject (F2, F3) at `/diagnosis`.
- **Grounded generation behind the verify gate** — math/reasoning generated freely then **independently re-solved**; GA generated **only from source text** with every fact re-checked against it; only items that clear the gate are stored `verified=true` and served (C3, C4, L4) at `/generate`.
- **Adversarial drills** — from a diagnosed mistake, generate a variant that forces the missed distinction, with lineage via `parent_question_id` (C5).
- **Flag a bad question** — one tap un-verifies it and queues it for review (C6).
- **Current affairs** — ingest a dated source whose `raw_text` is retained for grounding, then build grounded SRS cards / GA questions strictly from it (H1, H2) at `/current-affairs`.

Later phases (calibration, semantic memory, dashboard) plug in without reworking this core — see `CLAUDE.md §11`.

**v5 — memory, calibration, current-affairs engine:**
- **Feynman mode** — explain a concept in your own words; the tutor grades it for gaps and stores it as durable, recallable memory (G5, J1) at `/feynman`.
- **Semantic recall** — free text is embedded into pgvector; the tutor read-path pulls the top-5 cosine matches of your own past words for continuity, and stores each doubt back as memory (J2). Provider-agnostic embeddings (`EMBED_*`), backfilled nightly.
- **Nightly learner profile** — an LLM paragraph compressing your latest state, injected into every tutor call (J3).
- **Confidence calibration** — nightly logistic fit of stated confidence → true accuracy; per-concept `calibration_error`; the curve flags over/under-confidence (G2) at `/calibration`.
- **EV trainer** — per-confidence attempt/skip guidance with the explicit EV math under negative marking, plus a "confident but wrong" list that feeds adversarial drills (G3, G4).
- **CA digest & ranking** — each ingested item carries an exam-probability; a daily digest groups items by category, highest-yield first, with browser **read-aloud** (play/pause/stop, "now reading" highlight) so you can revise hands-free (H3, H4) at `/digest`.

**v6 — knowledge graph + insights dashboard:**
- **Visual knowledge graph** — concepts as nodes coloured by mastery, edges styled per relation (prerequisite / contrasts-with / related); click a node to practise. Plus edge authoring + delete (A3) at `/graph`.
- **Learning resources** — attach external "where to learn" pointers (book/video/article/notes, label + URL + priority) per concept; surfaced on the practice view. Routes out, stores nothing (A4).
- **Tutor contrast-surfacing** — when a `contrasts_with` partner is itself weak, the tutor is told to disambiguate the confused pair explicitly (E4). It likewise surfaces the concept's **weak prerequisites**, so it can point at a shaky foundation as the likely root of a struggle rather than only answering the surface question (§8 read path).
- **Insights dashboard** (`/dashboard`): weakness **heatmap** (J1), **mastery trends** over time (J2), **projected readiness** vs a target band with honest uncertainty (J3), **streak** (J4, gentle), and **syllabus coverage** (J5).
- **Mastery history** — a nightly append-only `concept_mastery_snapshot`, backfilled retroactively from the attempt log on first run so trends aren't empty.

The platform is now feature-complete across the v1–v6 plan in `CLAUDE.md §11`.

### Nightly batch

`GET /api/cron` (protect with `CRON_SECRET`; point Vercel Cron at it) recomputes derived state and tops up material in one fault-isolated pass — PYQ weights → `exam_weight`, diagnosis sweep, embedding backfill, calibration refit, CA scrape + summaries, **grounded CA cards from fresh items**, **replenished verified questions for weak high-yield concepts**, the daily mastery snapshot, the learner profile, and the day's plan. Each step is wrapped so one failure can't starve the rest (notably the plan). The two auto-generation steps are bounded/tunable via `CA_AUTOGEN_*` and `QGEN_*` (set `0` to disable) and skip when no LLM is configured. You can also trigger a plan from the Planner page.

> Deferred within v2: offline review sync (B4) — tracked, not yet built.

## Tech

Next.js (App Router, server actions) · Postgres + pgvector · `ts-fsrs` · provider-agnostic LLM router (Anthropic- or OpenAI-compatible wire formats) · Tailwind (Claude.ai-style tokens) · PWA.

## Tests

```bash
npm test   # pure unit tests (BKT, calibration, planner, scoring, readiness, streak, …), no DB needed
```

## Setup

1. **Install deps**
   ```bash
   npm install
   ```
2. **Provision Postgres** with the `pgvector` extension (Supabase or Neon free tier work) and copy the connection string:
   ```bash
   cp .env.example .env
   # edit DATABASE_URL
   ```
3. **Run migrations** (0001 = v1 review tables; 0002 = practice/mastery; 0003 = planner/mocks; 0004 = `misconception`, `misconception_hit`, `current_affairs_item`; 0005 = `interaction`, `learner_profile`, `calibration_model`; 0006 = `concept_resource`, `concept_mastery_snapshot`; 0007 = CA content-hash dedup; 0008 = `concept_mastery.confidence_count`):
   ```bash
   npm run db:migrate
   ```
   For the AI tutor, diagnosis, and question/card generation, set `LLM_BASE_URL` / `LLM_API_KEY` (and optional model names) in `.env`. For semantic recall / Feynman embeddings set `EMBED_BASE_URL` / `EMBED_API_KEY` / `EMBED_MODEL` (any OpenAI-compatible 1024-d embeddings host). All these features degrade gracefully when unconfigured — text is stored now and embedded by the nightly batch once a provider is set.
4. **Seed the concept ontology** (recommended — the RRB NTPC syllabus tree + its
   prerequisite/contrast graph, so the planner and tutor have something to work
   with from day one). Idempotent, so it's safe to re-run:
   ```bash
   npm run db:seed:ontology
   ```
   Optionally also seed an exam config + a few sample cards/PYQs for the demo loop:
   ```bash
   npm run db:seed
   ```
5. **Run the app**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 — you land on the review queue. Add concepts at `/concepts`, cards at `/cards`.

## Project layout

```
app/            App Router: /review (loop), /cards, /concepts
components/      ui/ primitives + review session + sidebar
lib/db/         pg client, typed query layer (one file per domain)
lib/fsrs/       ts-fsrs wrapper (schedule a card from a rating)
migrations/     numbered SQL; 0001 = v1 tables
scripts/        migrate + seed runners
```

## Hard rules (from `CLAUDE.md §2`)

Append-only behavioral logs (`review` is never overwritten), single-user (no auth), data ownership (one owned Postgres, exportable). Future LLM work goes behind a provider router and a verify gate — see `CLAUDE.md`.
