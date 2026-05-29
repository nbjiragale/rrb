# User Stories Plan — RRB NTPC Personal Learning Platform

*Companion to `learner-memory-architecture.md`. Single-user (you). Stories are phased to the same v1→v6 build order so you always know what to build next.*

---

## How to read this

**Personas** (both are *you*, different hats):
- **Learner** — the aspirant studying day-to-day.
- **Curator** — you in setup mode: authoring the ontology, ingesting PYQs, configuring the exam.

**Phase tags** map to the architecture's build order — build top-to-bottom, don't skip:
- **v1** review loop · **v2** PYQs + practice + mastery + tutor · **v3** planner + mocks · **v4** diagnosis + generation · **v5** calibration + memory + current affairs · **v6** graph + dashboard

**Format:** each story has *Acceptance* (testable conditions), *Touches* (tables/components), *Phase*.

> A story is "done" only when its acceptance criteria pass on real data — not when the code runs.

---

## Epic A — Setup & Content *(Curator)*

**A1 — As a Curator, I want to configure my exam's structure, so the whole system is parameterised, not hardcoded.**
- *Acceptance:* sections, marks/section, negative-marking ratio (1/3), question counts, time limits, and exam date are stored and read by mocks, the EV trainer, and the planner.
- *Touches:* `exam_config` · *Phase:* v2

**A2 — As a Curator, I want to author the concept ontology hierarchically, so every testable unit has a home.**
- *Acceptance:* I can create concepts under subject → topic → subtopic; each has a name + description; bulk import from CSV works.
- *Touches:* `concept` · *Phase:* v1

**A3 — As a Curator, I want to define prerequisite and "confuses-with" links, so the system knows learning order and confusion pairs.**
- *Acceptance:* I can add `prerequisite` and `contrasts_with` edges; the planner and tutor read them.
- *Touches:* `concept_edge` · *Phase:* v3

**A4 — As a Curator, I want to attach external learning sources to a concept, so "where to learn" is one tap away.**
- *Acceptance:* each concept can hold multiple resources (book/video/article) with a label and optional URL, shown in priority order.
- *Touches:* `concept_resource` · *Phase:* v6

**A5 — As a Curator, I want to ingest past papers and tag each question to a concept, so I have a real practice backbone.**
- *Acceptance:* I can paste/upload a PYQ; it is parsed into questions; each is tagged to a `concept_id` with `exam_year`/`exam_stage`; duplicates are flagged.
- *Touches:* `question`, `concept` · *Phase:* v2

**A6 — As a Curator, I want to create review cards for a concept (manually or AI-assisted), so the SRS has material on day one.**
- *Acceptance:* I can add cards by hand; I can also generate draft cards from a pasted passage and accept/edit them.
- *Touches:* `card` · *Phase:* v1

---

## Epic B — Daily Review *(Learner)*

**B1 — As a Learner, I want to see exactly what's due today, so I never decide what to review.**
- *Acceptance:* a single queue shows all cards with `due_at ≤ now`, ordered; count is visible; empty state is clear.
- *Touches:* `card` · *Phase:* v1

**B2 — As a Learner, I want to review a card and rate my recall, so scheduling adapts to memory.**
- *Acceptance:* I rate again/hard/good/easy; FSRS updates stability/difficulty/`due_at`; a `review` row is logged; response time captured.
- *Touches:* `card`, `review` (FSRS) · *Phase:* v1

**B3 — As a Learner, I want new cards introduced at a controlled rate, so I'm not buried.**
- *Acceptance:* a configurable daily cap on new cards; new intake pauses if due-review backlog exceeds a threshold.
- *Touches:* `card`, planner · *Phase:* v1

**B4 — As a Learner, I want to review offline and sync later, so commute/break time isn't wasted.**
- *Acceptance:* the PWA serves the queue offline; reviews queue locally and sync on reconnect with no loss.
- *Touches:* PWA / sync · *Phase:* v2

**B5 — As a Learner, I want to review by audio hands-free, so I can study when my back needs screen-off time.**
- *Acceptance:* cards can be read aloud (TTS); I can answer/rate by voice or simple tap; works in a "listen-only" mode.
- *Touches:* TTS, `card` · *Phase:* v5

---

## Epic C — Practice & Question Bank *(Learner)*

**C1 — As a Learner, I want to practise questions on a chosen topic, so I can drill deliberately.**
- *Acceptance:* I pick a concept/topic; get questions; each attempt is logged with correctness, confidence, and time.
- *Touches:* `question`, `attempt` · *Phase:* v2

**C2 — As a Learner, I want practice auto-targeted at my weak concepts, so my time goes where it matters.**
- *Acceptance:* a "fix my weak spots" mode selects questions by lowest `p_known` × highest `exam_weight`.
- *Touches:* `question`, `concept_mastery` · *Phase:* v3

**C3 — As a Learner, I want fresh math/reasoning questions generated on demand, so I never run out of practice.**
- *Acceptance:* generated problems pass an independent answer-verification check; only `verified=true` ones are served; difficulty targetable.
- *Touches:* `question` (generation + verify) · *Phase:* v4

**C4 — As a Learner, I want GA questions built strictly from a source passage, so I'm never taught a wrong fact.**
- *Acceptance:* generation requires a source; every fact in the question/answer traces to that text; `gen_source` recorded; ungrounded generation is blocked.
- *Touches:* `question`, `current_affairs_item` · *Phase:* v4

**C5 — As a Learner, I want adversarial variants of questions I miss, so my exact confusion gets hammered.**
- *Acceptance:* from a wrong attempt + its misconception, a variant is generated that forces the missed distinction; lineage kept via `parent_question_id`.
- *Touches:* `question`, `misconception_hit` · *Phase:* v4

**C6 — As a Learner, I want to flag a bad generated question, so quality improves over time.**
- *Acceptance:* one-tap report marks the question; flagged items are excluded and queued for review/regeneration.
- *Touches:* `question` · *Phase:* v4

---

## Epic D — Mock Tests & Exam Simulation *(Learner)*

**D1 — As a Learner, I want to take a full timed mock under exam conditions, so I build real exam temperament.**
- *Acceptance:* correct section split, question count, and timer per `exam_config`; auto-submits at time-up; no pausing.
- *Touches:* `mock_session`, `attempt` · *Phase:* v3

**D2 — As a Learner, I want sectional mocks, so I can train one section intensively.**
- *Acceptance:* I choose a section; timing scales proportionally; results stored like a full mock.
- *Touches:* `mock_session` · *Phase:* v3

**D3 — As a Learner, I want realistic negative marking with attempt/skip choices, so I practise the real decision.**
- *Acceptance:* skipping is a first-class option (`selected_option = null`); scoring applies the −1/3 penalty; attempted vs skipped tracked.
- *Touches:* `attempt`, `exam_config` · *Phase:* v3

**D4 — As a Learner, I want post-mock analysis, so I know exactly where marks leaked.**
- *Acceptance:* breakdown by topic accuracy, attempted/skipped, and marks lost to wrong vs left; weakest topics surfaced.
- *Touches:* `mock_session`, `attempt`, `concept_mastery` · *Phase:* v3

**D5 — As a Learner, I want a pacing breakdown, so I can fix where my speed collapses.**
- *Acceptance:* cumulative time-per-question chart; flags the point accuracy drops (e.g., after Q60); compares to the time budget.
- *Touches:* `mock_session.pacing_data` · *Phase:* v3

---

## Epic E — AI Tutor & Learning *(Learner)*

**E1 — As a Learner, I want to ask a doubt and get an answer tailored to my level and history, so I don't re-explain myself.**
- *Acceptance:* the tutor's context is assembled via the read-path (profile + this concept's mastery + recent errors + related concepts + semantic recall); the reply targets my actual gap.
- *Touches:* read-path, all memory tables · *Phase:* v2

**E2 — As a Learner, I want the tutor to teach a concept from scratch, so first-time learning of discrete topics is covered in-app.**
- *Acceptance:* "teach me X" produces a grounded explanation at my level, with the prerequisite I already know used as a bridge; optional links to `concept_resource`.
- *Touches:* read-path, `concept`, `concept_resource` · *Phase:* v2

**E3 — As a Learner, I want Feynman mode, so explaining out loud exposes my gaps.**
- *Acceptance:* I explain a concept (typed/voice); the model grades it, names the gaps, and the explanation is embedded into memory.
- *Touches:* `interaction` · *Phase:* v5

**E4 — As a Learner, I want the tutor to surface "the thing I confuse this with," so confusions get untangled at the point of learning.**
- *Acceptance:* when a `contrasts_with` concept has low mastery, the tutor explicitly contrasts the pair.
- *Touches:* `concept_edge`, read-path · *Phase:* v6

---

## Epic F — Diagnosis & Mistake Analysis *(Learner)*

**F1 — As a Learner, I want every wrong answer automatically diagnosed, so my mistakes become structured data.**
- *Acceptance:* a wrong attempt triggers one LLM classification → a `misconception_hit` with `kind`, label, rationale; latency is acceptable (async ok).
- *Touches:* `misconception`, `misconception_hit` · *Phase:* v4

**F2 — As a Learner, I want to see my recurring misconceptions per concept, so I know my specific traps.**
- *Acceptance:* per concept, I see repeated misconception labels with counts ("confused 72/161 ×3").
- *Touches:* `misconception_hit` · *Phase:* v4

**F3 — As a Learner, I want misconception patterns aggregated across topics, so I see the shape of my errors.**
- *Acceptance:* a view shows error `kind` distribution per subject (e.g., polity = mostly confusion; math = mostly computational), implying different fixes.
- *Touches:* `misconception`, `misconception_hit` · *Phase:* v4

**F4 — As a Learner, I want forgotten-but-once-known facts detected and rescheduled, so decay isn't mistaken for ignorance.**
- *Acceptance:* a wrong attempt on a card with prior successful reviews is tagged `stale` and FSRS reschedules it rather than treating it as new.
- *Touches:* `misconception` (`stale`), `card` (FSRS) · *Phase:* v4

---

## Epic G — Confidence & Attempt Strategy *(Learner)*

**G1 — As a Learner, I want to log my confidence on each attempt, so calibration can be measured.**
- *Acceptance:* a 1–5 confidence is captured *before* the answer is revealed, on every attempt.
- *Touches:* `attempt.confidence` · *Phase:* v2

**G2 — As a Learner, I want my personal calibration, so I learn how much to trust my gut.**
- *Acceptance:* a fitted model maps my self-reported confidence to true accuracy; shown as "feel 3/5 → actually ~60% right."
- *Touches:* `calibration_model` · *Phase:* v5

**G3 — As a Learner, I want attempt/skip guidance under negative marking, so I stop losing marks to bad guesses.**
- *Acceptance:* given my calibration and the −1/3 penalty, the app shows my EV-positive threshold and flags attempts below it.
- *Touches:* `calibration_model`, `exam_config` · *Phase:* v5

**G4 — As a Learner, I want my "confident but wrong" cases highlighted, so I fix my most dangerous errors first.**
- *Acceptance:* a view lists high-confidence wrong attempts; these feed targeted review/adversarial practice.
- *Touches:* `attempt`, `misconception_hit` · *Phase:* v5

---

## Epic H — Current Affairs Engine *(Learner / Curator)*

**H1 — As a Curator, I want to ingest a daily current-affairs source, so GA stays current without manual note-taking.**
- *Acceptance:* I paste/feed an article; it's stored with date, category, and source; raw text retained for grounding.
- *Touches:* `current_affairs_item` · *Phase:* v4

**H2 — As a Learner, I want exam-relevant cards auto-built from current affairs, so today's news enters my review loop.**
- *Acceptance:* cards are generated *only* from the stored raw text (grounded), tagged to concepts, and enter SRS.
- *Touches:* `current_affairs_item`, `card` · *Phase:* v4

**H3 — As a Learner, I want a daily CA digest in my preferred format, so I can skim in minutes.**
- *Acceptance:* a concise daily summary grouped by category; readable on mobile and via audio.
- *Touches:* `current_affairs_item` · *Phase:* v5

**H4 — As a Learner, I want CA ranked by likelihood of being asked, so I prioritise high-probability items.**
- *Acceptance:* each item carries an `exam_probability`; the digest and card priority reflect it.
- *Touches:* `current_affairs_item.exam_probability` · *Phase:* v5

---

## Epic I — Study Planning *(Learner)*

**I1 — As a Learner, I want a daily/weekly plan of what to learn next, so I never stare at a blank syllabus.**
- *Acceptance:* a plan lists new concepts in priority order with a one-line reason + the review load for the period.
- *Touches:* `study_plan` · *Phase:* v3

**I2 — As a Learner, I want the plan to respect prerequisites, so I only meet concepts I'm ready for.**
- *Acceptance:* a concept appears only when its prerequisites have `p_known ≥ 0.7` and its own `p_known < 0.6`.
- *Touches:* `concept_edge`, `concept_mastery` · *Phase:* v3

**I3 — As a Learner, I want the plan to adapt to my energy, so a bad-back day isn't a failure.**
- *Acceptance:* I can mark a low-energy day; the plan switches to reviews-only and defers new intake.
- *Touches:* `study_plan.capacity_note` · *Phase:* v3

**I4 — As a Learner, I want intake paced so reviews never pile up, so the system stays sustainable.**
- *Acceptance:* new concepts + their new cards plus due reviews stay within my daily capacity.
- *Touches:* `study_plan`, `card` · *Phase:* v3

**I5 — As a Learner, I want the plan to shift toward review and mocks as the exam nears, so retention peaks on exam day.**
- *Acceptance:* as the `exam_config` date approaches, new intake trends to zero and mocks/review dominate.
- *Touches:* `study_plan`, `exam_config` · *Phase:* v3

---

## Epic J — Progress & Insights *(Learner)*

**J1 — As a Learner, I want a weakness heatmap, so I see at a glance where I stand.**
- *Acceptance:* topic × mastery grid coloured by `p_known`; tappable into the underlying concepts.
- *Touches:* `concept_mastery` · *Phase:* v6

**J2 — As a Learner, I want mastery trends over time, so I can see I'm improving.**
- *Acceptance:* per-topic `p_known` plotted over weeks.
- *Touches:* `concept_mastery` (history) · *Phase:* v6

**J3 — As a Learner, I want a projected readiness estimate, so I know if I'm on track for the cutoff.**
- *Acceptance:* a forecast of expected CBT score from current trajectory, shown against a target/cutoff band, with honest uncertainty.
- *Touches:* `concept_mastery`, `mock_session`, `pyq_topic_stats` · *Phase:* v6

**J4 — As a Learner, I want streak/consistency tracking, so the daily habit is protected.**
- *Acceptance:* a streak counter for completing the daily plan; gentle, non-punitive on misses.
- *Touches:* `study_plan`, `review` · *Phase:* v6

**J5 — As a Learner, I want syllabus coverage, so I know what I haven't touched yet.**
- *Acceptance:* % of concepts seen / in-progress / mastered, by subject.
- *Touches:* `concept`, `concept_mastery` · *Phase:* v6

---

## Epic K — Personalization & Memory *(cross-cutting infra)*

**K1 — As a Learner, I want the tutor to remember my history without me repeating it, so it feels like a personal mentor.**
- *Acceptance:* responses reflect my specific past errors and mastery for the concept at hand — via retrieval, with zero model fine-tuning.
- *Touches:* read-path, all memory tables · *Phase:* v2

**K2 — As a Learner, I want a nightly-regenerated profile of me as a learner, so the big picture is always fresh and cheap to inject.**
- *Acceptance:* a batch job rewrites `learner_profile` (strengths, weaknesses, behavioural patterns) from current data; it's cached into every tutor call.
- *Touches:* `learner_profile`, batch · *Phase:* v5

**K3 — As a Learner, I want semantic recall of past struggles, so related earlier difficulties resurface even across differently-named topics.**
- *Acceptance:* a vector search over `interaction` returns the most relevant prior moments to the current query.
- *Touches:* `interaction` (pgvector) · *Phase:* v5

---

## Epic L — Platform & Non-functional *(cross-cutting)*

**L1 — As the owner, I want LLM cost kept minimal, so the app is effectively free to run.**
- *Acceptance:* tasks route by difficulty (cheap model for bulk, stronger only when needed); batch + prompt caching enabled; monthly spend stays in single digits.
- *Touches:* model router · *Phase:* v2+

**L2 — As a Learner, I want it to work well on phone and tablet, so I can study in any spare moment.**
- *Acceptance:* responsive PWA; installable; core flows usable one-handed.
- *Touches:* frontend · *Phase:* v1

**L3 — As the owner, I want my data to be mine, so I'm never locked in.**
- *Acceptance:* single owned Postgres; one-click export of cards/attempts/progress; no third-party storage of study data beyond the LLM call.
- *Touches:* DB · *Phase:* v1

**L4 — As the owner, I want generation safety enforced everywhere, so no unverified fact ever reaches review.**
- *Acceptance:* every `ai_generated` item carries `verified=true` before display; ungrounded GA generation is impossible by construction.
- *Touches:* `question` (verify gate) · *Phase:* v4

---

## Suggested first sprint (v1)

Ship the smallest loop that earns daily use, then **start studying**:
1. **A2** minimal ontology + **A6** manual cards
2. **B1 / B2 / B3** the due-queue + FSRS review loop
3. **L2 / L3** responsive PWA on your own Postgres

Everything else plugs in on later weekends without reworking this core.

---

## Deferred (revisit later)

- Multi-instance / second-user support and non-English (Kannada) localisation — the schema is already exam- and language-agnostic and the config seams exist, so this is a reconfiguration job for later, not a rewrite. Out of scope for now.
- Knowledge-graph-driven recommendations beyond prerequisites/contrasts (v6+).
- Native mobile app, social/leaderboard features — intentionally excluded.
