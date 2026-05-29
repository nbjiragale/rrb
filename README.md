# RRB NTPC — Personal Learning Platform

A single-user, AI-assisted study platform for RRB NTPC prep. See [`CLAUDE.md`](./CLAUDE.md) for the full architecture, hard rules, schema, and conventions, and the four spec docs it references.

## Status: v3 (planner, mocks, and PYQ analysis)

**v1 — the daily review loop:**
- **Concept ontology** — author concepts under subject → topic → subtopic (A2).
- **Manual card creation** — hand-add review cards to a concept (A6).
- **Due queue + FSRS review loop** — rate again/hard/good/easy; `ts-fsrs` reschedules; every event logged append-only; new-card intake capped and paused on backlog (B1, B2, B3).
- **Responsive, installable PWA** on your own Postgres (L2, L3).

**v2 — practice + memory + tutor:**
- **PYQ ingestion** — tag a past-paper question to a concept with year/stage; duplicates flagged; stored verified (A5).
- **Topic practice** — pick a concept, answer MCQs; **confidence (1–5) captured before reveal**; attempts logged append-only with timing (C1, G1).
- **Student model (BKT)** — `concept_mastery.p_known` updated per attempt inside a transaction; derived mastery level (the foundation for the planner and heatmap).
- **AI tutor** — per-concept chat that assembles the read-path context (mastery + recent errors) and answers via the **provider-agnostic LLM router**; personalization is retrieval, never fine-tuning (E1, E2, K1, L1).

**v3 — planning, mocks, and PYQ analysis:**
- **Knowledge graph** — author prerequisite / contrasts-with links between concepts (A3).
- **PYQ analysis** — the nightly batch aggregates ingested PYQs into `pyq_topic_stats` and pushes frequency into `concept.exam_weight`.
- **Study planner** — priority-ordered new concepts (`exam_weight × (1 − p_known)`), gated by prerequisites, capped by capacity, energy-aware, with an exam-date backstop (I1–I5).
- **Weak-spot practice** — auto-targets the highest exam-weight, lowest-mastery questions (C2).
- **Mock tests** — full or sectional, timed, first-class skipping, real negative marking; post-mock topic/pacing analysis (D1–D5).

Later phases (diagnosis, generation, calibration, dashboard) plug in without reworking this core — see `CLAUDE.md §11`.

### Nightly batch

PYQ-stat recompute + plan generation run via the cron endpoint `GET /api/cron` (protect with `CRON_SECRET`; point Vercel Cron at it). You can also trigger a plan from the Planner page.

> Deferred within v2: offline review sync (B4) — tracked, not yet built.

## Tech

Next.js (App Router, server actions) · Postgres + pgvector · `ts-fsrs` · provider-agnostic LLM router (Anthropic-compatible) · Tailwind (Claude.ai-style tokens) · PWA.

## Tests

```bash
npm test   # pure unit tests (BKT student model), no DB needed
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
3. **Run migrations** (0001 = v1 review tables; 0002 = `question`, `attempt`, `concept_mastery`, `mock_session`):
   ```bash
   npm run db:migrate
   ```
   For the AI tutor, also set `LLM_BASE_URL` / `LLM_API_KEY` (and optional model names) in `.env`.
4. **(Optional) Seed** an exam config + sample concept/cards:
   ```bash
   node --experimental-strip-types scripts/seed.ts
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
