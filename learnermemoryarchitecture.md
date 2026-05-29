# Personal Learning Memory — Schema & Retrieval Architecture

*RRB NTPC prep platform · single-user · Postgres + pgvector · stateless LLM (DeepSeek/Claude)*

---

## The mental model (hold this while reading)

- **concept** — a unit of knowledge ("Art. 72 – President's pardon power"). This is your *ontology*.
- **card / question** — assessment items *about* a concept. A **card** is an SRS review unit; a **question** is an MCQ for practice/mocks.
- **attempt / review / interaction** — append-only behavioral logs (what you actually did).
- **concept_mastery** — the live *student model*: what you know **now**, per concept. It aggregates the logs.
- **misconception / misconception_hit** — the structured *why you got it wrong*.
- **learner_profile** — a nightly LLM-written paragraph that compresses all of the above into "who you are as a learner."

> The LLM is **stateless**. Memory = these tables. Every call *retrieves the relevant slice* and feeds it in. You never train the model.

---

## ER overview

```
                       ┌──────────────┐
        concept_edge ─►│   concept    │◄─ graph: prerequisite / related / contrasts_with
       (knowledge map) │  (ontology)  │
                       └──────┬───────┘
            ┌─────────────────┼──────────────────┬────────────────────┐
            ▼                 ▼                   ▼                    ▼
        ┌────────┐       ┌──────────┐     ┌────────────────┐   ┌────────────────┐
        │  card  │       │ question │     │ concept_mastery│   │  misconception │
        │ (SRS)  │       │  (MCQ)   │     │ (student model)│   │  (why-wrong)   │
        └───┬────┘       └────┬─────┘     └────────────────┘   └───────┬────────┘
            ▼                 ▼                                         │
        ┌────────┐       ┌──────────┐                                  │
        │ review │       │ attempt  │───────────────────────────► misconception_hit
        │ (FSRS) │       │ (ALL Qs) │        (LLM tags wrong attempts)
        └────────┘       └────┬─────┘
                              ▼
                  ┌──────────────┐   ┌────────────────┐   ┌──────────────────┐
                  │ mock_session │   │  interaction   │   │  learner_profile │
                  └──────────────┘   │(text+embedding)│   │  (nightly LLM)   │
                                     └────────────────┘   └──────────────────┘
```

*Single-user, so no `user_id`. If you ever go multi-user, add `user_id` to every stateful table (everything except `concept`, `question`, `misconception`, `current_affairs_item`).*

```sql
CREATE EXTENSION IF NOT EXISTS vector;   -- pgvector
-- Embedding dim below assumes voyage-3 (1024). Change to match your embedder.
```

---

## 1. Ontology — the foundation (spend your best thinking here)

```sql
-- The taxonomy of everything testable. Hierarchical: subject > topic > subtopic > concept.
CREATE TABLE concept (
    id           BIGSERIAL PRIMARY KEY,
    name         TEXT NOT NULL,                 -- "President's pardon power (Art. 72)"
    subject      TEXT NOT NULL CHECK (subject IN ('math','reasoning','ga')),
    topic        TEXT NOT NULL,                 -- "Indian Polity"
    subtopic     TEXT,                          -- "Powers of the President"
    parent_id    BIGINT REFERENCES concept(id), -- self-ref hierarchy (nullable)
    description  TEXT,
    exam_weight  REAL DEFAULT 1.0,              -- how often it shows up in PYQs (priority)
    embedding    vector(1024),                  -- for semantic linking / graph building
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_concept_subject ON concept (subject, topic);
CREATE INDEX idx_concept_embed   ON concept USING hnsw (embedding vector_cosine_ops);

-- The knowledge graph. Some edges hand-authored (prerequisites), some derived from embedding similarity.
CREATE TABLE concept_edge (
    source_id     BIGINT NOT NULL REFERENCES concept(id),
    target_id     BIGINT NOT NULL REFERENCES concept(id),
    relation_type TEXT NOT NULL CHECK (relation_type IN
                    ('prerequisite','related','contrasts_with')),
    weight        REAL DEFAULT 1.0,             -- strength (esp. for semantic 'related')
    PRIMARY KEY (source_id, target_id, relation_type)
);
```

`contrasts_with` is the secret weapon: it explicitly links the pairs you confuse (Art. 72 ↔ Art. 161), so the tutor can pull "the thing you mix this up with" into context.

```sql
-- "WHERE to learn" pointers. The platform ROUTES to content; it does NOT store lessons.
-- One concept can map to several external sources.
CREATE TABLE concept_resource (
    id          BIGSERIAL PRIMARY KEY,
    concept_id  BIGINT NOT NULL REFERENCES concept(id),
    kind        TEXT CHECK (kind IN ('book','video','article','notes')),
    label       TEXT NOT NULL,               -- "NCERT Class 9 History, Ch. 2"
    url         TEXT,                         -- optional (YouTube, web)
    priority    SMALLINT DEFAULT 1           -- recommend lower numbers first
);
```

Content stays external (NCERT, Lucent GK, YouTube). This table only indexes *where* to go; first-time explanation is handled on demand by the AI tutor. **No syllabus content is warehoused** — that's the line that keeps this a personal tool, not a coaching institute.

---

## 2. Assessment items

```sql
-- SRS review unit. Many cards per concept. FSRS state lives here.
CREATE TABLE card (
    id            BIGSERIAL PRIMARY KEY,
    concept_id    BIGINT NOT NULL REFERENCES concept(id),
    front         TEXT NOT NULL,
    back          TEXT NOT NULL,
    card_type     TEXT NOT NULL CHECK (card_type IN ('recall','cloze','mcq')),
    source_ref    TEXT,                         -- "CA 2026-05-14" or "PYQ 2019 NTPC"
    -- FSRS scheduler state:
    stability     REAL,                         -- days; memory strength
    difficulty    REAL,                         -- FSRS difficulty (1..10)
    state         TEXT DEFAULT 'new' CHECK (state IN ('new','learning','review','relearning')),
    due_at        TIMESTAMPTZ,
    last_review   TIMESTAMPTZ,
    reps          INT DEFAULT 0,
    lapses        INT DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_card_due ON card (due_at) WHERE state <> 'new';

-- MCQs for practice/mocks (PYQs + AI-generated + adversarial variants).
CREATE TABLE question (
    id                 BIGSERIAL PRIMARY KEY,
    concept_id         BIGINT NOT NULL REFERENCES concept(id),
    stem               TEXT NOT NULL,
    options            JSONB NOT NULL,          -- ["...","...","...","..."]
    correct_option     SMALLINT NOT NULL,       -- index 0..3
    explanation        TEXT,
    difficulty         REAL DEFAULT 0.5,        -- 0 easy .. 1 hard
    source             TEXT NOT NULL CHECK (source IN ('pyq','ai_generated','adversarial')),
    is_adversarial     BOOLEAN DEFAULT FALSE,
    parent_question_id BIGINT REFERENCES question(id),  -- variant lineage
    -- PYQ provenance (when source='pyq'):
    exam_year          SMALLINT,                -- e.g. 2019
    exam_stage         TEXT,                    -- 'cbt1' / 'cbt2'
    -- generation provenance + QC (when source='ai_generated'/'adversarial'):
    gen_source         TEXT,                    -- what it was grounded in: 'ca:<id>' / 'passage' / 'pyq:<id>'
    verified           BOOLEAN DEFAULT FALSE,   -- passed the generate→verify QC gate
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ingested current affairs → source for cards & questions (GROUND generation in this text).
CREATE TABLE current_affairs_item (
    id               BIGSERIAL PRIMARY KEY,
    ca_date          DATE NOT NULL,
    source_url       TEXT,
    raw_text         TEXT NOT NULL,             -- the real article (the grounding source)
    summary          TEXT,
    category         TEXT,                      -- appointments / awards / sports / schemes / ...
    exam_probability REAL,                      -- model's estimate this becomes a question
    processed_at     TIMESTAMPTZ
);

-- PYQ ANALYSIS OUTPUT: per-topic frequency across past papers → drives exam_weight + the planner.
CREATE TABLE pyq_topic_stats (
    id                    BIGSERIAL PRIMARY KEY,
    concept_id            BIGINT REFERENCES concept(id),  -- nullable: may be topic-level only
    topic                 TEXT NOT NULL,
    exam_stage            TEXT,                  -- 'cbt1' / 'cbt2'
    total_appearances     INT DEFAULT 0,         -- raw count across all years
    recency_weighted_freq REAL,                  -- recent years weighted higher (trend signal)
    last_seen_year        SMALLINT,
    computed_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### How questions get into the bank (generation policy)

Three sources feed `question`, with very different trust levels:

**1. PYQs — ingested, never generated.** Past RRB NTPC papers are freely available as PDFs. You parse each question, tag it to a `concept_id`, and store it with `source='pyq'` + `exam_year`/`exam_stage`. These are your *anchor*: real exam questions, the highest-value practice, and the difficulty reference everything else calibrates against. Collecting + tagging them is mostly a one-time effort.

**2. AI-generated — allowed, but the rule depends on the subject:**
- **Math / Reasoning → generate freely + auto-verify.** These are procedural and *checkable*: the model produces a problem and answer, then code (or a second model pass) independently verifies the answer is correct and unique. Low hallucination risk — they don't depend on world-facts. This is where generation pays off most: effectively infinite fresh practice targeted at your weak patterns.
- **GA / GK → generate ONLY grounded in source text.** Never let the model invent a fact-MCQ from memory — it will occasionally be subtly wrong, and a wrong fact drilled through SRS is *worse* than not studying it. Instead, feed it a real passage (`current_affairs_item.raw_text` or a provided source) and instruct it to build questions *only* from that text. `gen_source` records what it was grounded in.

**3. Adversarial variants — generated from a question + your misconception data.** Take a PYQ (or one you got wrong) plus the diagnosed `misconception`, and ask the model for a variant that *forces* the distinction you keep missing (e.g. a 72-vs-161 item engineered to catch the confusion). `parent_question_id` keeps the lineage.

**The QC gate (every generated question):** generate with a cheap model (DeepSeek V4 Flash) → verify (math: recompute the answer; GA: confirm each fact traces to the source; all: exactly one correct option, distractors plausible) → only `verified=true` questions ever reach you; discard or queue the rest. This gate is what makes a budget model safe to generate with.

**PYQ *analysis* (distinct from using PYQs as practice):** the nightly batch aggregates the tagged PYQs into `pyq_topic_stats` — how often each topic appears, recency-weighted to surface trends — and that frequency *becomes* the `exam_weight` on concepts, which directly drives the planner's priority. So PYQ analysis isn't a dashboard you stare at; it's a signal that quietly steers what you study next.

---

## 3. Behavioral logs (append-only — never overwrite history)

```sql
-- EVERY question attempt, right or wrong. The richest behavioral signal.
CREATE TABLE attempt (
    id              BIGSERIAL PRIMARY KEY,
    question_id     BIGINT NOT NULL REFERENCES question(id),
    concept_id      BIGINT NOT NULL REFERENCES concept(id),  -- denormalized for fast rollups
    mock_session_id BIGINT REFERENCES mock_session(id),      -- null if standalone practice
    attempted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    selected_option SMALLINT,                  -- null = skipped (matters for mocks!)
    is_correct      BOOLEAN,
    confidence      SMALLINT CHECK (confidence BETWEEN 1 AND 5),  -- self-reported BEFORE seeing answer
    time_taken_ms   INT,
    context         TEXT CHECK (context IN ('mock','practice','feynman','quiz'))
);
CREATE INDEX idx_attempt_concept ON attempt (concept_id, attempted_at DESC);

-- Each SRS review event (drives FSRS).
CREATE TABLE review (
    id            BIGSERIAL PRIMARY KEY,
    card_id       BIGINT NOT NULL REFERENCES card(id),
    reviewed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    rating        SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 4), -- FSRS: again/hard/good/easy
    response_ms   INT,
    prev_stability REAL,
    new_stability  REAL,
    new_due_at     TIMESTAMPTZ
);

-- Free-text for semantic memory: Feynman explanations, doubt-chat turns, notes.
CREATE TABLE interaction (
    id           BIGSERIAL PRIMARY KEY,
    type         TEXT NOT NULL CHECK (type IN ('feynman','doubt','note')),
    concept_id   BIGINT REFERENCES concept(id),   -- nullable
    content      TEXT NOT NULL,                   -- what YOU said
    ai_feedback  TEXT,                            -- grading / response (nullable)
    embedding    vector(1024) NOT NULL,           -- of `content`
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_interaction_embed ON interaction USING hnsw (embedding vector_cosine_ops);

-- A mock test instance.
CREATE TABLE mock_session (
    id              BIGSERIAL PRIMARY KEY,
    type            TEXT NOT NULL,               -- full_cbt1 / full_cbt2 / sectional
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    total_questions INT,
    attempted_count INT,
    score           REAL,
    accuracy        REAL,
    time_limit_s    INT,
    pacing_data     JSONB                        -- per-question cumulative timing for pacing analysis
);
```

---

## 4. Diagnosis — the misconception layer (what you asked about)

Two tables. `misconception` is the **taxonomy of *why* things go wrong**; `misconception_hit` links a specific wrong attempt to a diagnosed reason. **The LLM does the interpretation; code writes the row.**

```sql
-- The catalog of failure modes, scoped to a concept.
CREATE TABLE misconception (
    id          BIGSERIAL PRIMARY KEY,
    concept_id  BIGINT NOT NULL REFERENCES concept(id),
    label       TEXT NOT NULL,                  -- "confuses_president_governor_pardon"
    description TEXT NOT NULL,                  -- human-readable explanation
    kind        TEXT NOT NULL CHECK (kind IN (
                    'confusion',     -- mixes two similar concepts
                    'factual_gap',   -- simply doesn't know the fact
                    'partial_rule',  -- knows rule, misses an edge case
                    'computational', -- right method, arithmetic slip
                    'conceptual',    -- wrong underlying mental model
                    'trap',          -- fell for a distractor / misread the question
                    'stale'          -- knew it once, forgot (correlates with FSRS lapse)
                 )),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Links an attempt to its diagnosed misconception(s).
CREATE TABLE misconception_hit (
    id               BIGSERIAL PRIMARY KEY,
    attempt_id       BIGINT NOT NULL REFERENCES attempt(id),
    misconception_id BIGINT NOT NULL REFERENCES misconception(id),
    ai_confidence    REAL,                      -- model's certainty in this diagnosis
    ai_rationale     TEXT,                      -- why the model thinks this
    diagnosed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mhit_attempt ON misconception_hit (attempt_id);
```

**The two-level structure** is what makes this powerful:

- The **specific** `label` lets the tutor say *"you've confused 72 and 161 three times."*
- The **`kind`** lets the dashboard aggregate *across* concepts: *"60% of your polity errors are `confusion`-type, but your math errors are `computational` — different fixes entirely."*

`stale` is special: when an attempt is wrong **and** the linked card has prior successful reviews, tag it `stale` and let FSRS reschedule — it's a memory-decay problem, not a knowledge gap.

---

## 5. The student model

```sql
-- The LIVE state per concept. One row per concept. Updated on every attempt (BKT).
CREATE TABLE concept_mastery (
    concept_id        BIGINT PRIMARY KEY REFERENCES concept(id),
    attempts          INT DEFAULT 0,
    correct           INT DEFAULT 0,
    wrong             INT DEFAULT 0,
    p_known           REAL DEFAULT 0.1,         -- BKT P(you know this) — the headline number
    avg_confidence    REAL,
    calibration_error REAL,                     -- |avg_confidence_normed − accuracy|; high = miscalibrated
    mastery_level     TEXT DEFAULT 'new' CHECK (mastery_level IN
                        ('new','learning','review','mastered')),  -- derived bucket from p_known
    last_seen_at      TIMESTAMPTZ,
    last_correct_at   TIMESTAMPTZ
);

-- Tiny per-scope logistic-regression params for confidence → P(correct), + the EV threshold.
CREATE TABLE calibration_model (
    id            BIGSERIAL PRIMARY KEY,
    scope         TEXT NOT NULL,               -- 'global' or a subject
    params        JSONB NOT NULL,              -- {w0, w_confidence, ...}
    ev_threshold  REAL,                        -- min true P(correct) where attempting beats skipping
    fitted_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The compressed long-term self. Regenerated nightly by an LLM. Keep history.
CREATE TABLE learner_profile (
    id                  BIGSERIAL PRIMARY KEY,
    generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    summary_text        TEXT NOT NULL,         -- the paragraph injected into every tutor prompt
    strengths           JSONB,                 -- [{topic, p_known}, ...]
    weaknesses          JSONB,
    behavioral_patterns JSONB,                 -- {pacing_dropoff_q: 60, overconfident_topics: [...]}
    model_version       TEXT
);
```

---

## 6. The Study Planner — which + when to learn

Everything above is the *practice + memory* engine. The planner is the thin layer that answers **"what do I study next, and when"** — using only data you already have, no new content. It writes one row per day/week.

```sql
CREATE TABLE study_plan (
    id            BIGSERIAL PRIMARY KEY,
    plan_date     DATE NOT NULL,
    horizon       TEXT CHECK (horizon IN ('day','week')),
    new_concepts  JSONB NOT NULL,    -- ordered: [{concept_id, order, priority, reason}]
    review_load   INT,               -- # cards due this period (from FSRS)
    capacity_note TEXT,              -- energy-aware, e.g. "low-energy day → reviews only"
    generated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**The scheduling logic (runs nightly, ~deterministic, no LLM needed):**

```
1. LEARNABLE = concepts where every 'prerequisite' edge points to a concept
   with p_known ≥ 0.7  AND  this concept's own p_known < 0.6
   (you're ready for it, and you don't own it yet)

2. PRIORITY(c) = exam_weight(c) × (1 − p_known(c))
   → high-yield, weak topics rise to the top.
   (exam_weight comes straight from pyq_topic_stats — this is where PYQ analysis pays off)

3. INTAKE CAP: today's new concepts must fit alongside review_load, so that
   new_cards_generated + due_reviews ≤ daily_capacity.
   Never introduce so much new material that reviews pile up uncleared.

4. EXAM-DATE BACKSTOP: as July-2027 nears, intake → 0 and the mix shifts fully
   to review + mocks, so retention peaks ON exam day, not weeks before.
```

What you see: *"This week — learn [Art. 72 → Art. 161 → pardon limits], in that order; clear 40 due reviews. Tuesday's a low-energy day → reviews only."*

This is the **only** place "when to first learn something" is decided. FSRS decides when to *re-see* a card; the planner decides when to *first meet* a concept. Together they cover the whole timeline.

---

## 7. The student-model math (the legitimate "ML", all tiny)

**Bayesian Knowledge Tracing** — updates `p_known` on each attempt. Four params per skill: `p_L0` (init), `p_T` (learn), `p_S` (slip), `p_G` (guess).

```
Step 1 — posterior given the observed answer:
  if correct:    P(L|obs) =  p·(1−S)              / [ p·(1−S) + (1−p)·G ]
  if incorrect:  P(L|obs) =  p·S                  / [ p·S     + (1−p)·(1−G) ]
        (p = current p_known)

Step 2 — apply learning:
  p_known_new = P(L|obs) + (1 − P(L|obs))·p_T

Predict next:  P(correct) = p_known·(1−S) + (1−p_known)·G
```

Start with sane defaults (`p_T=0.15, p_S=0.1, p_G=0.25`), refine later. This is ~15 lines of code, no library needed.

**FSRS** — `ts-fsrs` handles card scheduling from the `review` log. It's already a small fitted model predicting forgetting. Free.

**Confidence → EV (negative-marking trainer).** RRB NTPC penalises wrong answers by **1/3 mark**. Break-even:

```
EV(attempt) = P(correct)·(+1) + (1 − P(correct))·(−1/3)
EV = 0  ⇒  P(correct) = 0.25
```

So attempting only pays when your **true** P(correct) > 25%. The `calibration_model` maps your *self-reported* confidence to *true* accuracy, so the platform learns rules like: *"when you feel 3/5 sure you're actually ~60% right → attempt; when you feel 2/5 you're actually ~20% → skip."* That alone protects 8–15 marks on exam day.

---

## 8. Read path — assembling ONE tutor call

This is the whole game: the model looks like it remembers you, but it's pure retrieval.

```python
def assemble_tutor_context(concept_id, user_message):
    # Layer 3 — compressed self (CACHED in the prompt → ~free)
    profile = sql("""SELECT summary_text, behavioral_patterns
                     FROM learner_profile ORDER BY generated_at DESC LIMIT 1""")

    # Layer 1 — exact state for THIS concept
    mastery = sql("SELECT * FROM concept_mastery WHERE concept_id = %s", concept_id)

    recent_errors = sql("""
        SELECT a.attempted_at, m.label, m.kind, mh.ai_rationale
        FROM attempt a
        JOIN misconception_hit mh ON mh.attempt_id = a.id
        JOIN misconception     m  ON m.id = mh.misconception_id
        WHERE a.concept_id = %s AND a.is_correct = FALSE
        ORDER BY a.attempted_at DESC LIMIT 5""", concept_id)

    # Knowledge graph — prerequisites + the concept you confuse this with
    related = sql("""
        SELECT c.name, e.relation_type, cm.p_known
        FROM concept_edge e
        JOIN concept         c  ON c.id = e.target_id
        JOIN concept_mastery cm ON cm.concept_id = c.id
        WHERE e.source_id = %s
          AND e.relation_type IN ('prerequisite','contrasts_with')""", concept_id)

    # Layer 2 — semantic recall of past struggles (pgvector cosine: <=>)
    qvec = embed(user_message)
    similar_past = sql("""
        SELECT content, ai_feedback, created_at
        FROM interaction
        ORDER BY embedding <=> %s
        LIMIT 5""", qvec)

    return build_prompt(profile, mastery, recent_errors, related, similar_past, user_message)
```

**The assembled prompt:**

```
[SYSTEM — cached]   tutor persona + RRB syllabus context + the misconception `kind` reference

[MEMORY — profile cached, rest fresh]
  • Learner profile: "Strong arithmetic/reasoning. Weak polity & schemes.
    Accuracy drops after Q60 (pacing). Overconfident on history dates."
  • This concept (Art. 72): 4 attempts, 1 correct, p_known = 0.35, level = learning.
  • Recent errors: 12 May — confused 72/161 (kind: confusion). 5 May — same.
  • Graph: prerequisite 'fundamental rights' p_known = 0.82 (solid);
    contrasts_with 'Governor's pardon (161)' p_known = 0.40 (weak — likely the root).
  • Similar past struggle (Feynman): "<your own earlier explanation excerpt>"

[USER]  <user_message>
```

→ single call to DeepSeek V4 Flash / Sonnet. It now teaches *you specifically* — targeting the 72/161 confusion, leaning on the prerequisite you already own, at a depth that respects your pacing pattern.

---

## 9. Write path — after each interaction

1. **Code** inserts the `attempt` (with confidence + timing), updates `concept_mastery` via the BKT step, refreshes `mastery_level`.
2. **If wrong:** one LLM call classifies the failure → matches/creates a `misconception` and inserts a `misconception_hit` (`kind`, rationale, confidence). *AI interprets, code stores.*
3. **If a card was reviewed:** run FSRS → write `review` + update the card's stability/due.
4. **Any free text** (Feynman answer, doubt) → embed → insert `interaction`.
5. **Nightly batch** (cheap, via Batch API): regenerate `learner_profile`, recompute semantic `concept_edge`s, refit the `calibration_model`, run FSRS scheduling, recompute `pyq_topic_stats` → refresh each concept's `exam_weight`, and generate tomorrow's `study_plan`.

---

## 10. Build order (so this doesn't become the procrastination project)

- **v1 (one weekend):** `concept`, `card`, `review` + FSRS + manual cards + review loop. **Then start studying.**
- **v2:** ingest **PYQs** into `question` (your first real practice bank) + `attempt` + `concept_mastery` + BKT; the read-path tutor call (profile can be a hardcoded stub at first).
- **v3:** `pyq_topic_stats` (PYQ analysis → `exam_weight`) + the **`study_plan`** planner; `mock_session` + pacing.
- **v4:** `misconception` + `misconception_hit` (the LLM diagnosis write-step); grounded **question generation** (math/reasoning auto-verified, GA-from-source) behind the verify gate.
- **v5:** `interaction` + pgvector semantic recall; `calibration_model` + EV trainer; nightly `learner_profile`.
- **v6:** `concept_edge` knowledge graph + `concept_resource` pointers + the dashboard.

The schema is built so each layer plugs in without reworking the last. Start with v1 and let the rest grow around real usage.
