# RRB NTPC Personal Learning Platform — Build Brief

> **Hand this entire file to your AI coding agent (Claude / GPT / Claude Code).** It is self-contained: product, hard rules, tech stack, full database schema, build order, and user stories. The data model in §5 is the source of truth.

---

## 0. Instructions to the builder — READ FIRST

You are a senior full-stack engineer building a **single-user personal learning web app** for one person preparing for the RRB NTPC exam. Work as follows:

1. **Build in phases (§6). Ship v1 completely and get it running before starting v2.** Do not attempt to build all features at once. After each phase, the app must run end-to-end.
2. **Single user.** No authentication, no multi-tenancy, no user accounts unless explicitly asked later. Everything serves one owner.
3. **The Hard Rules (§2) are non-negotiable acceptance gates**, not suggestions. A feature is not done if it violates one.
4. **Use the stack in §3** unless you have a strong, stated reason to deviate (flag it, don't silently swap).
5. **Abstract the LLM provider behind a router** (model-selected-by-task), so DeepSeek / Claude / Gemini / Sarvam are swappable via config — never hardcode one vendor in business logic.
6. **Deliver runnable code each phase:** database migrations, app scaffold, and the increment for that phase. Include a README with run steps.
7. **Ask for clarification only when genuinely blocked.** Otherwise proceed and state your assumptions inline.
8. Align all code to the schema in §5. If you need a new column/table, add a migration and note why.

---

## 1. What you're building

A personal, AI-assisted study platform for one aspirant. It is a **practice + memory + diagnosis engine plus a study planner** — NOT a content/courseware platform. It does not host lessons; learners study from external sources (NCERT, etc.) and the app handles everything around that: spaced-repetition review, practice and mock tests, automatic diagnosis of mistakes, confidence/attempt-strategy training, current-affairs cards, and a daily plan of what to study next. An AI tutor answers doubts with full awareness of the learner's history.

**Core paradigm:** the LLM is **stateless**. All memory lives in the database and is *retrieved* into the prompt at call time. **You never fine-tune a model.** Personalization = retrieval + a small classical student model, not training.

---

## 2. Hard rules (non-negotiable acceptance gates)

1. **No fact generation from model memory for GA/GK.** General-awareness questions and cards must be generated **only** from supplied source text (a `current_affairs_item.raw_text` or provided passage). Every fact must trace to that source. Ungrounded GA generation must be impossible by construction. *(A wrong fact drilled via spaced repetition is worse than not studying it.)*
2. **Every AI-generated question passes a verify gate before display.** Math/reasoning: independently recompute and confirm the answer is correct and unique. GA: confirm each fact traces to source. All: exactly one correct option, distractors plausible. Only `verified = true` items reach the user.
3. **No model fine-tuning.** Personalization is retrieval-augmented (RAG over the learner's own data) + small models (BKT, FSRS, logistic regression). Do not propose or build a fine-tuning pipeline.
4. **Cost discipline.** Route tasks to the cheapest model that clears the quality bar; use batch processing for non-interactive jobs and prompt caching for reused context (syllabus, learner profile). Target single-digit-dollars/month.
5. **Single-user & data ownership.** One owned Postgres database; study data is exportable; no third-party persistence of study data beyond the transient LLM API call.
6. **Append-only behavioral logs.** Never overwrite history in `attempt`, `review`, `interaction`. Derived state (`concept_mastery`) is updated; raw events are immutable.
7. **Selective retrieval, never dump-everything.** Assemble the *relevant slice* into context; do not stuff the whole database into prompts (cost + degraded model performance).

---

## 3. Tech stack

- **Frontend + Backend:** Next.js (App Router, server actions as the API — no separate backend). Ship as a **PWA** (offline review queue, sync on reconnect).
- **Database:** Postgres with the **pgvector** extension. (Supabase or Neon for managed hosting; free tier is sufficient.)
- **Spaced repetition:** **FSRS** via `ts-fsrs` (not SM-2).
- **LLM access:** provider-agnostic router. Default cheap model for bulk (e.g. DeepSeek V4 Flash), stronger model only when needed. DeepSeek exposes an Anthropic-compatible endpoint, so the Anthropic SDK works by swapping base URL + key.
- **Embeddings:** a multilingual embedding model into pgvector (e.g. BGE-M3 / multilingual-e5 / Voyage).
- **Audio (optional, later):** browser Web Speech API first; upgrade to a dedicated TTS later if needed.
- **Hosting:** Vercel (app) + managed Postgres. Background/nightly jobs via cron + batch LLM API.

---

## 4. Architecture in one screen

**Three memory layers** (all in Postgres):
- **Structured (source of truth):** exact per-concept stats, error logs, mastery — plain SQL tables.
- **Semantic:** free-text (explanations, doubts) embedded into pgvector for fuzzy recall.
- **Profile:** a nightly LLM-written paragraph summarizing the learner, cached into every tutor prompt.

**Read path (one tutor call):** load cached profile → SQL-pull this concept's mastery + recent errors → pull prerequisite/contrasts concepts from the graph → vector-search related past struggles → assemble → single LLM call. The model *appears* to remember; it's retrieval.

**Write path (after each interaction):** insert the `attempt` + update `concept_mastery` via BKT (deterministic code) → if wrong, one LLM call classifies the misconception and code stores it → embed any free text → if a card was reviewed, run FSRS. **Nightly batch:** regenerate profile, recompute `pyq_topic_stats` → `exam_weight`, refit calibration, generate tomorrow's `study_plan`.

**Question sources:** PYQs are *ingested* (real exam questions, the backbone); math/reasoning are *generated + auto-verified*; GA is *generated only from source text*; adversarial variants are *generated from the learner's own mistakes*.

**Student model (small, classical):** Bayesian Knowledge Tracing updates `p_known` per concept; FSRS predicts forgetting per card; a logistic regression maps self-reported confidence → true accuracy for the negative-marking EV threshold (RRB penalty = 1/3, so attempting pays only when true P(correct) > 0.25).

---

## 5. Data model — full schema (SOURCE OF TRUTH)

Create in this order (respects foreign keys).

```sql
CREATE EXTENSION IF NOT EXISTS vector;   -- pgvector. Embedding dim 1024 assumes a 1024-d model; adjust to your embedder.

-- Exam parameterisation. One row per instance. Holds locale so the app is language-configurable.
CREATE TABLE exam_config (
    id                  BIGSERIAL PRIMARY KEY,
    exam_name           TEXT NOT NULL,            -- 'RRB NTPC'
    exam_date           DATE,                     -- target exam date (drives planner backstop)
    negative_mark_ratio REAL DEFAULT 0.3333,      -- 1/3 for RRB NTPC
    locale              TEXT DEFAULT 'en',        -- 'en' / 'kn' / ... (instance language)
    sections            JSONB NOT NULL,           -- [{name, questions, marks, time_s}, ...]
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ONTOLOGY: every testable unit. Hierarchical subject > topic > subtopic > concept.
CREATE TABLE concept (
    id           BIGSERIAL PRIMARY KEY,
    name         TEXT NOT NULL,                   -- "President's pardon power (Art. 72)"
    subject      TEXT NOT NULL CHECK (subject IN ('math','reasoning','ga')),
    topic        TEXT NOT NULL,                   -- "Indian Polity"
    subtopic     TEXT,
    parent_id    BIGINT REFERENCES concept(id),   -- self-ref hierarchy (nullable)
    description  TEXT,
    exam_weight  REAL DEFAULT 1.0,                -- frequency in PYQs (priority); set by pyq_topic_stats
    embedding    vector(1024),                    -- for semantic linking / graph building
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_concept_subject ON concept (subject, topic);
CREATE INDEX idx_concept_embed   ON concept USING hnsw (embedding vector_cosine_ops);

-- KNOWLEDGE GRAPH. 'contrasts_with' links the pairs the learner confuses.
CREATE TABLE concept_edge (
    source_id     BIGINT NOT NULL REFERENCES concept(id),
    target_id     BIGINT NOT NULL REFERENCES concept(id),
    relation_type TEXT NOT NULL CHECK (relation_type IN ('prerequisite','related','contrasts_with')),
    weight        REAL DEFAULT 1.0,
    PRIMARY KEY (source_id, target_id, relation_type)
);

-- "WHERE to learn" pointers. The app ROUTES to external content; it does NOT store lessons.
CREATE TABLE concept_resource (
    id          BIGSERIAL PRIMARY KEY,
    concept_id  BIGINT NOT NULL REFERENCES concept(id),
    kind        TEXT CHECK (kind IN ('book','video','article','notes')),
    label       TEXT NOT NULL,                   -- "NCERT Class 9 History, Ch. 2"
    url         TEXT,
    priority    SMALLINT DEFAULT 1
);

-- SRS review unit. Many cards per concept. FSRS state lives here.
CREATE TABLE card (
    id            BIGSERIAL PRIMARY KEY,
    concept_id    BIGINT NOT NULL REFERENCES concept(id),
    front         TEXT NOT NULL,
    back          TEXT NOT NULL,
    card_type     TEXT NOT NULL CHECK (card_type IN ('recall','cloze','mcq')),
    source_ref    TEXT,                           -- "CA 2026-05-14" / "PYQ 2019"
    stability     REAL,
    difficulty    REAL,
    state         TEXT DEFAULT 'new' CHECK (state IN ('new','learning','review','relearning')),
    due_at        TIMESTAMPTZ,
    last_review   TIMESTAMPTZ,
    reps          INT DEFAULT 0,
    lapses        INT DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_card_due ON card (due_at) WHERE state <> 'new';

-- MCQs for practice/mocks. source = pyq (ingested) / ai_generated / adversarial.
CREATE TABLE question (
    id                 BIGSERIAL PRIMARY KEY,
    concept_id         BIGINT NOT NULL REFERENCES concept(id),
    stem               TEXT NOT NULL,
    options            JSONB NOT NULL,            -- ["...","...","...","..."]
    correct_option     SMALLINT NOT NULL,         -- index 0..3
    explanation        TEXT,
    difficulty         REAL DEFAULT 0.5,
    source             TEXT NOT NULL CHECK (source IN ('pyq','ai_generated','adversarial')),
    is_adversarial     BOOLEAN DEFAULT FALSE,
    parent_question_id BIGINT REFERENCES question(id),
    exam_year          SMALLINT,                  -- PYQ provenance
    exam_stage         TEXT,                      -- 'cbt1' / 'cbt2'
    gen_source         TEXT,                      -- grounding ref: 'ca:<id>' / 'passage' / 'pyq:<id>'
    verified           BOOLEAN DEFAULT FALSE,     -- MUST be true before display (verify gate)
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ingested current affairs → grounding source for cards/questions.
CREATE TABLE current_affairs_item (
    id               BIGSERIAL PRIMARY KEY,
    ca_date          DATE NOT NULL,
    source_url       TEXT,
    raw_text         TEXT NOT NULL,               -- the grounding source; never generate GA without it
    summary          TEXT,
    category         TEXT,                        -- appointments / awards / sports / schemes / ...
    exam_probability REAL,
    processed_at     TIMESTAMPTZ
);

-- PYQ ANALYSIS OUTPUT: per-topic frequency across past papers → drives exam_weight + planner.
CREATE TABLE pyq_topic_stats (
    id                    BIGSERIAL PRIMARY KEY,
    concept_id            BIGINT REFERENCES concept(id),
    topic                 TEXT NOT NULL,
    exam_stage            TEXT,
    total_appearances     INT DEFAULT 0,
    recency_weighted_freq REAL,                   -- recent years weighted higher
    last_seen_year        SMALLINT,
    computed_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A mock test instance (created before `attempt` because attempt references it).
CREATE TABLE mock_session (
    id              BIGSERIAL PRIMARY KEY,
    type            TEXT NOT NULL,                -- full_cbt1 / full_cbt2 / sectional
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    total_questions INT,
    attempted_count INT,
    score           REAL,
    accuracy        REAL,
    time_limit_s    INT,
    pacing_data     JSONB                         -- per-question cumulative timing
);

-- EVERY question attempt, right or wrong (append-only). Richest behavioral signal.
CREATE TABLE attempt (
    id              BIGSERIAL PRIMARY KEY,
    question_id     BIGINT NOT NULL REFERENCES question(id),
    concept_id      BIGINT NOT NULL REFERENCES concept(id),  -- denormalized for fast rollups
    mock_session_id BIGINT REFERENCES mock_session(id),      -- null if standalone practice
    attempted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    selected_option SMALLINT,                     -- null = skipped (matters for mocks)
    is_correct      BOOLEAN,
    confidence      SMALLINT CHECK (confidence BETWEEN 1 AND 5),  -- captured BEFORE revealing answer
    time_taken_ms   INT,
    context         TEXT CHECK (context IN ('mock','practice','feynman','quiz'))
);
CREATE INDEX idx_attempt_concept ON attempt (concept_id, attempted_at DESC);

-- Each SRS review event (drives FSRS) (append-only).
CREATE TABLE review (
    id             BIGSERIAL PRIMARY KEY,
    card_id        BIGINT NOT NULL REFERENCES card(id),
    reviewed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    rating         SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 4),  -- again/hard/good/easy
    response_ms    INT,
    prev_stability REAL,
    new_stability  REAL,
    new_due_at     TIMESTAMPTZ
);

-- Free-text for semantic memory: Feynman explanations, doubt-chat, notes (append-only).
CREATE TABLE interaction (
    id           BIGSERIAL PRIMARY KEY,
    type         TEXT NOT NULL CHECK (type IN ('feynman','doubt','note')),
    concept_id   BIGINT REFERENCES concept(id),
    content      TEXT NOT NULL,                   -- what the learner said
    ai_feedback  TEXT,                            -- grading / response (nullable)
    embedding    vector(1024) NOT NULL,           -- of content
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_interaction_embed ON interaction USING hnsw (embedding vector_cosine_ops);

-- DIAGNOSIS: catalog of failure modes, scoped to a concept. Two-level: specific label + general kind.
CREATE TABLE misconception (
    id          BIGSERIAL PRIMARY KEY,
    concept_id  BIGINT NOT NULL REFERENCES concept(id),
    label       TEXT NOT NULL,                   -- "confuses_president_governor_pardon"
    description TEXT NOT NULL,
    kind        TEXT NOT NULL CHECK (kind IN (
                    'confusion','factual_gap','partial_rule',
                    'computational','conceptual','trap','stale')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Links a wrong attempt to its diagnosed misconception(s). AI interprets, code stores.
CREATE TABLE misconception_hit (
    id               BIGSERIAL PRIMARY KEY,
    attempt_id       BIGINT NOT NULL REFERENCES attempt(id),
    misconception_id BIGINT NOT NULL REFERENCES misconception(id),
    ai_confidence    REAL,
    ai_rationale     TEXT,
    diagnosed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mhit_attempt ON misconception_hit (attempt_id);

-- STUDENT MODEL: live state per concept. One row per concept. Updated via BKT on each attempt.
CREATE TABLE concept_mastery (
    concept_id        BIGINT PRIMARY KEY REFERENCES concept(id),
    attempts          INT DEFAULT 0,
    correct           INT DEFAULT 0,
    wrong             INT DEFAULT 0,
    p_known           REAL DEFAULT 0.1,           -- BKT P(known) — headline number
    avg_confidence    REAL,
    calibration_error REAL,                       -- |avg_confidence_normed − accuracy|
    mastery_level     TEXT DEFAULT 'new' CHECK (mastery_level IN ('new','learning','review','mastered')),
    last_seen_at      TIMESTAMPTZ,
    last_correct_at   TIMESTAMPTZ
);

-- Tiny logistic-regression params: confidence → P(correct), + the EV threshold.
CREATE TABLE calibration_model (
    id           BIGSERIAL PRIMARY KEY,
    scope        TEXT NOT NULL,                   -- 'global' or a subject
    params       JSONB NOT NULL,
    ev_threshold REAL,                            -- min true P(correct) where attempting beats skipping
    fitted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Compressed long-term self. Regenerated nightly by an LLM. Keep history.
CREATE TABLE learner_profile (
    id                  BIGSERIAL PRIMARY KEY,
    generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    summary_text        TEXT NOT NULL,            -- injected (cached) into every tutor prompt
    strengths           JSONB,
    weaknesses          JSONB,
    behavioral_patterns JSONB,                    -- {pacing_dropoff_q: 60, overconfident_topics: [...]}
    model_version       TEXT
);

-- PLANNER OUTPUT: what to learn next + when. One row per day/week.
CREATE TABLE study_plan (
    id            BIGSERIAL PRIMARY KEY,
    plan_date     DATE NOT NULL,
    horizon       TEXT CHECK (horizon IN ('day','week')),
    new_concepts  JSONB NOT NULL,                 -- ordered [{concept_id, order, priority, reason}]
    review_load   INT,                            -- # cards due this period
    capacity_note TEXT,                           -- energy-aware: "low-energy → reviews only"
    generated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Key algorithms to implement

**BKT update** (per concept, on each attempt; params: `p_T` learn, `p_S` slip, `p_G` guess; defaults `0.15 / 0.1 / 0.25`):
```
if correct:   post = p·(1−S) / [ p·(1−S) + (1−p)·G ]
if incorrect: post = p·S     / [ p·S     + (1−p)·(1−G) ]
p_known_new = post + (1 − post)·p_T
predict P(correct) = p_known·(1−S) + (1−p_known)·G
```

**Negative-marking EV** (RRB penalty 1/3): `EV = P·1 − (1−P)·(1/3)`; break-even at `P = 0.25`. The calibration model maps self-reported confidence → true P.

**Planner priority:** `PRIORITY(c) = exam_weight(c) × (1 − p_known(c))`; a concept is *learnable* only when all its `prerequisite` targets have `p_known ≥ 0.7` and its own `p_known < 0.6`; cap intake so `new_cards + due_reviews ≤ daily_capacity`; as `exam_date` nears, intake → 0.

---

## 6. Build order — build in this sequence, ship v1 before anything else

- **v1** — `concept`, `card`, `review`, `exam_config`; FSRS via `ts-fsrs`; manual card creation; the due-review loop; responsive PWA on owned Postgres. **Then the owner starts studying.**
- **v2** — ingest **PYQs** into `question`; `attempt`; `concept_mastery` + BKT; the read-path AI tutor (profile may be a hardcoded stub at first); confidence capture; LLM provider router.
- **v3** — `pyq_topic_stats` (PYQ analysis → `exam_weight`); the **`study_plan`** planner (incl. energy-aware + exam-date backstop); `mock_session` + pacing analysis.
- **v4** — `misconception` + `misconception_hit` (LLM diagnosis write-step); grounded **question generation** (math/reasoning auto-verified, GA-from-source) behind the verify gate; current-affairs ingestion + grounded CA cards.
- **v5** — `interaction` + pgvector semantic recall; Feynman mode; `calibration_model` + EV/attempt-strategy trainer; nightly `learner_profile`; CA digest + probability ranking; audio review.
- **v6** — `concept_edge` knowledge graph + tutor contrast-surfacing; `concept_resource` links; the insights dashboard (heatmap, trends, readiness, streak, coverage).

Each layer plugs in without reworking the last.

---

## 7. User stories

Personas (both are the owner): **Learner** (studying) and **Curator** (setup: ontology, PYQ ingestion, config). Each story: *Acceptance* (testable), *Touches* (tables), *Phase*.

### Epic A — Setup & Content (Curator)
- **A1 — Configure the exam's structure** so the system is parameterised, not hardcoded. *Acceptance:* sections, marks, negative-marking ratio, counts, time limits, exam date stored and read by mocks/EV/planner. *Touches:* `exam_config`. *Phase:* v2
- **A2 — Author the concept ontology hierarchically.** *Acceptance:* create concepts under subject→topic→subtopic; bulk CSV import. *Touches:* `concept`. *Phase:* v1
- **A3 — Define prerequisite & confuses-with links.** *Acceptance:* add `prerequisite`/`contrasts_with` edges; planner & tutor read them. *Touches:* `concept_edge`. *Phase:* v3
- **A4 — Attach external learning sources to a concept.** *Acceptance:* multiple resources per concept with label/URL in priority order. *Touches:* `concept_resource`. *Phase:* v6
- **A5 — Ingest past papers and tag each question to a concept.** *Acceptance:* upload PYQ → parsed into questions → tagged with `exam_year`/`exam_stage`; duplicates flagged. *Touches:* `question`. *Phase:* v2
- **A6 — Create review cards (manual or AI-assisted).** *Acceptance:* hand-add cards; generate draft cards from a pasted passage, accept/edit. *Touches:* `card`. *Phase:* v1

### Epic B — Daily Review (Learner)
- **B1 — See exactly what's due today.** *Acceptance:* one queue of `due_at ≤ now`, ordered; count visible; clear empty state. *Touches:* `card`. *Phase:* v1
- **B2 — Review a card and rate recall.** *Acceptance:* again/hard/good/easy → FSRS updates stability/`due_at`; `review` logged; response time captured. *Touches:* `card`, `review`. *Phase:* v1
- **B3 — New cards introduced at a controlled rate.** *Acceptance:* configurable daily cap; intake pauses if backlog exceeds threshold. *Touches:* `card`, planner. *Phase:* v1
- **B4 — Review offline and sync later.** *Acceptance:* PWA serves queue offline; reviews queue locally and sync on reconnect, no loss. *Touches:* PWA/sync. *Phase:* v2
- **B5 — Review by audio hands-free.** *Acceptance:* cards read aloud; answer/rate by voice or tap; listen-only mode. *Touches:* TTS, `card`. *Phase:* v5

### Epic C — Practice & Question Bank (Learner)
- **C1 — Practise questions on a chosen topic.** *Acceptance:* pick concept/topic; attempts logged with correctness, confidence, time. *Touches:* `question`, `attempt`. *Phase:* v2
- **C2 — Practice auto-targeted at weak concepts.** *Acceptance:* mode selects by lowest `p_known` × highest `exam_weight`. *Touches:* `question`, `concept_mastery`. *Phase:* v3
- **C3 — Fresh math/reasoning questions on demand.** *Acceptance:* generated problems pass independent answer-verification; only `verified` served; difficulty targetable. *Touches:* `question`. *Phase:* v4
- **C4 — GA questions built strictly from a source passage.** *Acceptance:* generation requires a source; every fact traces to it; `gen_source` recorded; ungrounded generation blocked. *Touches:* `question`, `current_affairs_item`. *Phase:* v4
- **C5 — Adversarial variants of missed questions.** *Acceptance:* from a wrong attempt + its misconception, generate a variant forcing the distinction; lineage via `parent_question_id`. *Touches:* `question`, `misconception_hit`. *Phase:* v4
- **C6 — Flag a bad generated question.** *Acceptance:* one-tap report excludes it and queues for review/regeneration. *Touches:* `question`. *Phase:* v4

### Epic D — Mock Tests & Exam Simulation (Learner)
- **D1 — Full timed mock under exam conditions.** *Acceptance:* correct split/count/timer per `exam_config`; auto-submit at time-up; no pausing. *Touches:* `mock_session`, `attempt`. *Phase:* v3
- **D2 — Sectional mocks.** *Acceptance:* choose a section; timing scales; results stored like a full mock. *Touches:* `mock_session`. *Phase:* v3
- **D3 — Realistic negative marking with attempt/skip.** *Acceptance:* skipping is first-class (`selected_option = null`); −1/3 applied; attempted vs skipped tracked. *Touches:* `attempt`, `exam_config`. *Phase:* v3
- **D4 — Post-mock analysis.** *Acceptance:* breakdown by topic accuracy, attempted/skipped, marks lost to wrong vs left; weakest topics surfaced. *Touches:* `mock_session`, `attempt`, `concept_mastery`. *Phase:* v3
- **D5 — Pacing breakdown.** *Acceptance:* cumulative time-per-question chart; flags where accuracy drops (e.g. after Q60) vs the time budget. *Touches:* `mock_session.pacing_data`. *Phase:* v3

### Epic E — AI Tutor & Learning (Learner)
- **E1 — Ask a doubt, get an answer tailored to my level/history.** *Acceptance:* context assembled via read-path (profile + mastery + recent errors + related concepts + semantic recall); reply targets the actual gap. *Touches:* read-path, all memory tables. *Phase:* v2
- **E2 — Tutor teaches a concept from scratch.** *Acceptance:* "teach me X" → grounded explanation at my level, bridging from a known prerequisite; optional `concept_resource` links. *Touches:* read-path, `concept`, `concept_resource`. *Phase:* v2
- **E3 — Feynman mode.** *Acceptance:* I explain (typed/voice); model grades, names gaps; explanation embedded into memory. *Touches:* `interaction`. *Phase:* v5
- **E4 — Tutor surfaces "the thing I confuse this with."** *Acceptance:* when a `contrasts_with` concept has low mastery, the tutor explicitly contrasts the pair. *Touches:* `concept_edge`, read-path. *Phase:* v6

### Epic F — Diagnosis & Mistake Analysis (Learner)
- **F1 — Every wrong answer auto-diagnosed.** *Acceptance:* wrong attempt → one LLM classification → `misconception_hit` with kind/label/rationale (async ok). *Touches:* `misconception`, `misconception_hit`. *Phase:* v4
- **F2 — See recurring misconceptions per concept.** *Acceptance:* per concept, repeated labels with counts. *Touches:* `misconception_hit`. *Phase:* v4
- **F3 — Misconception patterns aggregated across topics.** *Acceptance:* error-`kind` distribution per subject implying different fixes. *Touches:* `misconception`, `misconception_hit`. *Phase:* v4
- **F4 — Forgotten-but-once-known facts detected and rescheduled.** *Acceptance:* wrong attempt on a card with prior successes is tagged `stale`; FSRS reschedules rather than treating as new. *Touches:* `misconception` (`stale`), `card`. *Phase:* v4

### Epic G — Confidence & Attempt Strategy (Learner)
- **G1 — Log confidence on each attempt.** *Acceptance:* 1–5 confidence captured before the answer is revealed, every attempt. *Touches:* `attempt.confidence`. *Phase:* v2
- **G2 — Personal calibration.** *Acceptance:* fitted model maps confidence → true accuracy; shown as "feel 3/5 → actually ~60%." *Touches:* `calibration_model`. *Phase:* v5
- **G3 — Attempt/skip guidance under negative marking.** *Acceptance:* given calibration + −1/3, show EV-positive threshold; flag attempts below it. *Touches:* `calibration_model`, `exam_config`. *Phase:* v5
- **G4 — Highlight "confident but wrong."** *Acceptance:* list high-confidence wrong attempts; feed targeted review/adversarial practice. *Touches:* `attempt`, `misconception_hit`. *Phase:* v5

### Epic H — Current Affairs Engine (Learner / Curator)
- **H1 — Ingest a daily current-affairs source.** *Acceptance:* paste/feed an article; stored with date/category/source; raw text retained for grounding. *Touches:* `current_affairs_item`. *Phase:* v4
- **H2 — Auto-build exam-relevant cards from CA.** *Acceptance:* cards generated only from stored raw text, tagged to concepts, entered into SRS. *Touches:* `current_affairs_item`, `card`. *Phase:* v4
- **H3 — Daily CA digest in my format.** *Acceptance:* concise daily summary grouped by category; mobile + audio readable. *Touches:* `current_affairs_item`. *Phase:* v5
- **H4 — CA ranked by likelihood of being asked.** *Acceptance:* each item carries `exam_probability`; digest + card priority reflect it. *Touches:* `current_affairs_item.exam_probability`. *Phase:* v5

### Epic I — Study Planning (Learner)
- **I1 — Daily/weekly plan of what to learn next.** *Acceptance:* priority-ordered new concepts with a one-line reason + the period's review load. *Touches:* `study_plan`. *Phase:* v3
- **I2 — Plan respects prerequisites.** *Acceptance:* a concept appears only when prerequisites `p_known ≥ 0.7` and its own `p_known < 0.6`. *Touches:* `concept_edge`, `concept_mastery`. *Phase:* v3
- **I3 — Plan adapts to my energy.** *Acceptance:* mark a low-energy day → plan switches to reviews-only, defers new intake. *Touches:* `study_plan.capacity_note`. *Phase:* v3
- **I4 — Intake paced so reviews never pile up.** *Acceptance:* new concepts + new cards + due reviews stay within daily capacity. *Touches:* `study_plan`, `card`. *Phase:* v3
- **I5 — Plan shifts to review+mocks as exam nears.** *Acceptance:* as `exam_date` approaches, new intake → 0; mocks/review dominate. *Touches:* `study_plan`, `exam_config`. *Phase:* v3

### Epic J — Progress & Insights (Learner)
- **J1 — Weakness heatmap.** *Acceptance:* topic × mastery grid coloured by `p_known`; tappable into concepts. *Touches:* `concept_mastery`. *Phase:* v6
- **J2 — Mastery trends over time.** *Acceptance:* per-topic `p_known` over weeks. *Touches:* `concept_mastery` history. *Phase:* v6
- **J3 — Projected readiness vs cutoff.** *Acceptance:* forecast expected CBT score from trajectory vs a target band, with honest uncertainty. *Touches:* `concept_mastery`, `mock_session`, `pyq_topic_stats`. *Phase:* v6
- **J4 — Streak/consistency tracking.** *Acceptance:* streak for completing the daily plan; gentle, non-punitive on misses. *Touches:* `study_plan`, `review`. *Phase:* v6
- **J5 — Syllabus coverage.** *Acceptance:* % concepts seen / in-progress / mastered, by subject. *Touches:* `concept`, `concept_mastery`. *Phase:* v6

### Epic K — Personalization & Memory (cross-cutting infra)
- **K1 — Tutor remembers my history without repetition.** *Acceptance:* responses reflect my specific past errors/mastery for the concept — via retrieval, zero fine-tuning. *Touches:* read-path, all memory tables. *Phase:* v2
- **K2 — Nightly-regenerated learner profile.** *Acceptance:* batch rewrites `learner_profile` from current data; cached into every tutor call. *Touches:* `learner_profile`, batch. *Phase:* v5
- **K3 — Semantic recall of past struggles.** *Acceptance:* vector search over `interaction` returns most-relevant prior moments. *Touches:* `interaction` (pgvector). *Phase:* v5

### Epic L — Platform & Non-functional (cross-cutting)
- **L1 — LLM cost kept minimal.** *Acceptance:* tasks route by difficulty; batch + caching enabled; single-digit-dollar monthly spend. *Touches:* model router. *Phase:* v2+
- **L2 — Works well on phone/tablet.** *Acceptance:* responsive installable PWA; core flows one-handed. *Touches:* frontend. *Phase:* v1
- **L3 — My data is mine.** *Acceptance:* single owned Postgres; one-click export; no third-party storage beyond the LLM call. *Touches:* DB. *Phase:* v1
- **L4 — Generation safety enforced everywhere.** *Acceptance:* every `ai_generated` item is `verified=true` before display; ungrounded GA generation impossible by construction. *Touches:* `question` verify gate. *Phase:* v4

---

## 8. Definition of done & working agreement

- A feature is done only when its **acceptance criteria pass on real data** and **no Hard Rule (§2) is violated**.
- After each phase, deliver: migrations, the runnable increment, and updated README run steps. The app must run end-to-end at every phase boundary.
- Keep the LLM provider behind a router; keep generation behind the verify gate; keep behavioral logs append-only.
- Do not add scope not in this brief (no auth, no social, no native app, no multi-tenancy) without asking.

---

## 9. Out of scope (do not build now)

- Multi-user / second-instance support and non-English (Kannada) localisation. *(The schema is already exam- and language-agnostic — `exam_config.locale` exists — so this is later reconfiguration, not a rewrite.)*
- Knowledge-graph recommendations beyond prerequisites/contrasts.
- Native mobile app, leaderboards, discussion forums, video hosting.
