# RRB NTPC — Personal Learning Platform

A single-user, AI-assisted study platform for RRB NTPC prep. See [`CLAUDE.md`](./CLAUDE.md) for the full architecture, hard rules, schema, and conventions, and the four spec docs it references.

## Status: v1 (the daily review loop)

This phase ships the core spaced-repetition loop end-to-end:

- **Concept ontology** — author concepts under subject → topic → subtopic (A2).
- **Manual card creation** — hand-add review cards to a concept (A6).
- **Due queue + FSRS review loop** — see what's due, rate again/hard/good/easy; `ts-fsrs` reschedules and every event is logged append-only (B1, B2, B3).
- **Responsive, installable PWA** on your own Postgres (L2, L3).

Later phases (PYQ practice, mastery/BKT, tutor, planner, mocks, diagnosis, generation, dashboard) plug in without reworking this core — see `CLAUDE.md §11`.

## Tech

Next.js (App Router, server actions) · Postgres + pgvector · `ts-fsrs` · Tailwind (Claude.ai-style tokens) · PWA.

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
3. **Run migrations** (creates `exam_config`, `concept`, `card`, `review`):
   ```bash
   npm run db:migrate
   ```
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
