# User Guide — Running the RRB NTPC Learning Platform (free, online)

This guide takes you from zero to a running app, using a **free hosted Postgres**
and (optionally) free LLM + embedding providers. No paid services are required to
run the core app; AI features are optional and degrade gracefully when unconfigured.

> **What's required vs optional**
> - **Required:** Node 22+ and a Postgres database with the `pgvector` extension.
> - **Optional:** an LLM provider (tutor, diagnosis, question/card generation, nightly profile) and an embeddings provider (semantic recall, Feynman memory). Without them, the review loop, manual practice, mocks, planner, dashboard, and graph all still work.

---

## 0. Prerequisites

- **Node.js 22 or newer** (the project uses `node --experimental-strip-types`, which needs Node 22+).
  Check: `node --version`. Get it from <https://nodejs.org> or via `nvm`.
- **Git**, to clone the repo.
- A terminal.

---

## 1. Get a free Postgres database (with pgvector)

You need Postgres **with the `pgvector` extension** (the schema runs
`CREATE EXTENSION IF NOT EXISTS vector`). Two good free options — pick one.

### Option A — Neon (recommended: serverless, generous free tier)

1. Go to <https://neon.tech> and sign up (free, no card).
2. Create a project (any name, e.g. `rrb`). Pick the region closest to you.
3. pgvector is available out of the box — no toggle needed.
4. On the project dashboard, open **Connection string** and copy the
   **pooled** connection string. It looks like:
   ```
   postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require
   ```
   Keep the `?sslmode=require` — Neon requires SSL and `pg` reads it from the URL.

### Option B — Supabase

1. Go to <https://supabase.com>, sign up, create a project (free tier).
   Set a database password when prompted — save it.
2. In the dashboard: **Database → Extensions**, search `vector`, and **enable** it.
3. Get the connection string: **Project Settings → Database → Connection string → URI**.
   Use the connection-pooler URI and append `?sslmode=require` if not present:
   ```
   postgresql://postgres.PROJECT:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?sslmode=require
   ```

> **Either way**, you now have a `DATABASE_URL`. Hold onto it for step 3.

---

## 2. Clone and install

```bash
git clone <your-repo-url> rrb
cd rrb
npm install
```

---

## 3. Configure environment

Copy the example and edit it:

```bash
cp .env.example .env
```

Open `.env` and set **at minimum** `DATABASE_URL` to the string from step 1:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
```

That's all you need to run the core app. The AI keys below are **optional** —
add them later when you want those features (see §7).

```bash
# --- LLM (optional): tutor, diagnosis, question/card generation, nightly profile ---
# Any Anthropic-compatible /v1/messages endpoint. DeepSeek is cheap and works.
# LLM_BASE_URL=https://api.deepseek.com/anthropic
# LLM_API_KEY=sk-...
# LLM_MODEL_CHEAP=deepseek-chat
# LLM_MODEL_STRONG=deepseek-reasoner

# --- Embeddings (optional): semantic recall + Feynman memory ---
# Any OpenAI-compatible /v1/embeddings endpoint, 1024-dim model.
# EMBED_BASE_URL=https://api.voyageai.com
# EMBED_API_KEY=...
# EMBED_MODEL=voyage-3

# --- Cron secret (optional): protects the nightly batch endpoint ---
# CRON_SECRET=some-long-random-string
```

> `.env` is gitignored — your secrets stay local.

---

## 4. Create the database schema (migrations)

This runs all numbered migrations (0001–0006) in order, including enabling
pgvector and creating every table:

```bash
npm run db:migrate
```

This auto-loads your `.env` (so make sure `DATABASE_URL` is set there in step 3).
You should see `apply 0001_v1_init.sql … migrations complete`. Re-running is
safe — already-applied migrations are skipped.

> **`DATABASE_URL is not set`?** You're missing a `.env` file (you may have only
> edited `.env.example`). Run `cp .env.example .env`, set `DATABASE_URL` in it,
> and try again. Or pass it inline once:
> `DATABASE_URL='your-neon-string' npm run db:migrate`.

**If it errors on `CREATE EXTENSION vector`:** your database doesn't have
pgvector enabled — revisit step 1 (Supabase needs the extension toggled on;
Neon has it by default).

---

## 5. (Optional but recommended) Seed starter data

Adds one `exam_config` (RRB NTPC sections + 1/3 negative marking) and a few
sample concepts/cards so the review loop and dashboard aren't empty:

```bash
npm run db:seed
```

---

## 6. Run the app

```bash
npm run dev
```

Open <http://localhost:3000>. You'll land on the **Dashboard**; the left
sidebar has every feature (Review, Practice, Mock, Planner, Tutor, Feynman,
Diagnosis, Calibration, Generate, Current affairs, Digest, Cards, Concepts,
Graph, Ingest).

**First steps to try without any AI keys:**
1. **Concepts** → add a concept (or use the seeded ones).
2. **Cards** → add a review card → **Review** to rate it (spaced repetition works).
3. **Ingest** → paste a past-paper MCQ → **Practice** it (confidence + grading).
4. **Mock** → run a timed test.
5. **Graph** → add prerequisite/contrast links and learning resources.
6. **Dashboard** → heatmap, coverage, streak, readiness fill in as you use the app.

---

## 7. Enable the AI features (optional)

### LLM provider (tutor, auto-diagnosis, question generation, nightly profile)

The app calls an **Anthropic-compatible** `/v1/messages` endpoint through its
router, so you can use DeepSeek, Anthropic, or any compatible host.

**DeepSeek (cheap, recommended for cost):**
1. Sign up at <https://platform.deepseek.com>, add a little credit, create an API key.
2. In `.env`:
   ```bash
   LLM_BASE_URL=https://api.deepseek.com/anthropic
   LLM_API_KEY=sk-your-key
   LLM_MODEL_CHEAP=deepseek-chat
   LLM_MODEL_STRONG=deepseek-reasoner
   ```

**Anthropic (Claude) instead:**
```bash
LLM_BASE_URL=https://api.anthropic.com
LLM_API_KEY=sk-ant-...
LLM_MODEL_CHEAP=claude-haiku-4-5-20251001
LLM_MODEL_STRONG=claude-sonnet-4-6
```

Restart `npm run dev` after editing `.env`.

### Embeddings provider (semantic recall + Feynman memory)

Needs an **OpenAI-compatible** `/v1/embeddings` endpoint returning **1024-dim**
vectors (the DB column is `vector(1024)`).

- **Voyage AI** (<https://voyageai.com>) — free tier; `voyage-3` is 1024-dim:
  ```bash
  EMBED_BASE_URL=https://api.voyageai.com
  EMBED_API_KEY=pa-...
  EMBED_MODEL=voyage-3
  ```
- Any other host works as long as it's OpenAI-compatible and **1024 dimensions**.
  If you pick a model with different dimensions, the vectors won't fit the column.

> Free text you write **before** configuring embeddings is stored immediately and
> embedded later by the nightly batch (§8) once a provider is set — nothing is lost.

---

## 8. The nightly batch (keeps insights fresh)

A single endpoint recomputes derived state: PYQ weights, misconception
diagnosis sweep, embedding backfill, calibration refit, current-affairs
summaries, the daily mastery snapshot (for trends), and tomorrow's plan.

Trigger it manually any time:

```bash
# no secret set:
curl http://localhost:3000/api/cron

# if you set CRON_SECRET:
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron
```

On a deployed host, point a scheduler at `GET /api/cron` once a day (see §9).

---

## 9. (Optional) Deploy online for free — Vercel

To use the app from your phone/anywhere instead of just `localhost`:

1. Push your repo to GitHub.
2. Go to <https://vercel.com>, sign up, **Add New → Project**, import the repo.
3. In **Settings → Environment Variables**, add the same keys from your `.env`
   (`DATABASE_URL` required; `LLM_*`, `EMBED_*`, `CRON_SECRET` as desired).
4. Deploy. Vercel builds and gives you a URL.
5. **Schedule the nightly batch:** add a `vercel.json` at the repo root:
   ```json
   {
     "crons": [{ "path": "/api/cron", "schedule": "0 2 * * *" }]
   }
   ```
   Set `CRON_SECRET` in Vercel; Vercel Cron sends the `Authorization: Bearer`
   header automatically when the env var is present. Commit and redeploy.

> Migrations don't run automatically on deploy. Run `npm run db:migrate` locally
> (it points at the same hosted `DATABASE_URL`), or run it once from your machine
> against the production database before/after first deploy.

It's a PWA — on mobile, open the URL and "Add to Home Screen" to install it.

---

## 10. Quick verification

```bash
npm test    # 53 pure unit tests (BKT, calibration, readiness, streak, verify gate…)
npm run build   # type-checks the whole app
```

Both should pass clean.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `CREATE EXTENSION "vector" … could not open extension control file` | pgvector not available — use Neon, or enable the `vector` extension in Supabase (Database → Extensions). |
| `self-signed certificate` / SSL errors on migrate or run | Ensure `?sslmode=require` is in `DATABASE_URL` (hosted Postgres requires SSL). |
| `LLM router not configured` when using Tutor/Generate | Set `LLM_BASE_URL` and `LLM_API_KEY` in `.env`, restart dev. |
| Semantic recall / Feynman do nothing | Set `EMBED_BASE_URL` / `EMBED_API_KEY` / `EMBED_MODEL` (1024-dim). Text is backfilled by the next nightly batch run. |
| Embedding insert fails on dimension | Your embedding model isn't 1024-dim. Use a 1024-dim model (e.g. `voyage-3`, `bge-m3`). |
| `node: --experimental-strip-types is not allowed` | Node is older than 22. Upgrade Node. |
| Dashboard trends say "collecting data" | Trends need ≥2 days of snapshots; run `/api/cron` over a couple of days (or it backfills from your attempt history on first run). |
| Connection pool errors on a serverless host | Use the **pooled** connection string (Neon `-pooler`, Supabase port `6543`). |

---

## Cost summary

- **Database:** Neon / Supabase free tier — **$0**.
- **Hosting:** Vercel Hobby — **$0**.
- **LLM:** optional; DeepSeek is pay-as-you-go and the app is built for cost
  discipline (cheap model by default, prompt-sized retrieval) — typically a few
  cents to single-digit dollars/month with normal study use.
- **Embeddings:** optional; Voyage and similar have free tiers sufficient for
  single-user study data.

Running the **core app costs nothing**. AI features add a small, optional LLM cost only.
