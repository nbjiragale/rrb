# Features & First-Day Guide

You've just opened the app for the first time. This page explains **what every
screen does and the order to use them in** so you go from an empty app to a
working daily study routine.

> Setting the app up (database, optional AI providers) is covered separately in
> **`user-guide.md`**. This guide assumes the app is already running. AI features
> (tutor, diagnosis, question/card generation, current-affairs scraping, nightly
> profile, semantic recall) are optional and degrade gracefully — everything else
> works without them.

---

## The big picture

This is a **personal RRB NTPC study companion** — not a courseware library. You
study from your own sources (NCERT, Lucent GK, PYQ papers); the app handles
everything *around* that: spaced-repetition review, MCQ practice, mock tests,
automatic mistake diagnosis, a daily "what to study next" plan, and an AI tutor
that remembers your history.

It learns you over time. The more you use it, the better it targets your weak
spots — all your data stays in your own database.

---

## How the app is organised

A slim **icon rail** runs down the left (click the toggle at its foot to show
labels; the choice is remembered). The rail holds the seven things you touch
daily, then two grouped entries that open with tabs across the top.

| Rail entry | Tabs inside | Use it to… |
|---|---|---|
| **Today** | — | See what's due and start the next thing |
| **Review** | — | Do today's spaced-repetition cards |
| **Practice** | — | Answer MCQs, weak topics first |
| **Mocks** | — | Take a timed, exam-style test |
| **Planner** | — | See what to study next |
| **Dashboard** | — | Heatmap, trends, readiness, streak |
| **Tutor** | — | Ask doubts, with your history in context |
| **Knowledge** | Graph · Concepts · Cards · Mistakes · Current affairs · Digest | Build and inspect your material |
| **Settings** | Exam · Confidence · Ingest · Import · Generate | Configure, and add study material |

**Press ⌘K (Ctrl-K on Windows) anywhere** to jump to any screen by name. Two
study modes — **Feynman** and **Recall** — live only in the palette and at their
direct URLs (`/feynman`, `/recall`); they're launched when you need them rather
than parked on the rail.

On a phone, a bottom bar shows the five you use most: **Today, Review, Practice,
Mocks, Tutor.** Everything else is a ⌘K away.

---

## Day 1 — get the app ready (about 15 minutes)

A brand-new app is empty, so it has nothing to review or quiz you on yet. Do
these steps once, in order. (On a fresh install, **Today** notices you have no
concepts and points you straight at the first two.)

### 1. Set up the exam → **Settings ▸ Exam**
Enter your sections (name, question count, marks, time), the negative-marking
ratio (−⅓ for RRB NTPC), and your **exam date**. This isn't cosmetic: mocks are
assembled from these sections, the attempt/skip trainer uses the penalty ratio,
and the planner uses the date to stop feeding you new topics in the closing
weeks.

### 2. Add your concepts → **Knowledge ▸ Concepts**
A *concept* is the smallest thing you study — e.g. "President's pardon power
(Art. 72)", "Percentages", "Blood relations". Everything else (cards, questions,
mastery, the plan) hangs off concepts.

- Add a few for the topics you're starting with: a subject (math / reasoning /
  ga), a topic, and an optional description.
- *Shortcut:* if the project was seeded with the starter ontology
  (`npm run db:seed:ontology`), a full RRB NTPC concept tree is already here —
  skip ahead.

### 3. (Optional) Link prerequisites → **Knowledge ▸ Graph**
Tell the app which concepts build on which (e.g. *compound interest* needs
*percentages*). This powers two things: the planner won't suggest a topic before
its foundations are solid, and the tutor can spot when a weak foundation is the
real cause of a struggle. You can also store "where to learn" links per concept
here.

### 4. Add things to study
You need two kinds of material:

**Cards** (for spaced review) → **Knowledge ▸ Cards.** Write front/back
flashcards for facts you want to remember long-term. These feed the Review
screen. You can also have the AI draft cards — from a passage you paste
(grounded) or as plain fact cards — and both kinds are independently re-checked
before they're saved.

**Questions** (for practice & mocks) → four ways:

- **Settings ▸ Ingest** — paste real past-exam questions (PYQs), one at a time
  or as a JSON batch. These are the gold standard and are trusted as-is.
- **Settings ▸ Import** — import a completed **Testbook** mock result (see
  *Importing your Testbook mocks* below).
- **Settings ▸ Generate** — have the AI create fresh math/reasoning questions, or
  GA questions grounded in a passage you paste.
- **Knowledge ▸ Current affairs** — paste an article, or auto-scrape your
  configured sources; the app builds grounded GA cards and questions **strictly
  from that text**.

> **Everything the AI writes is independently re-checked before you ever see it.**
> Math and reasoning questions are re-solved from scratch by a second pass, and
> the answer must match and be unique. GA questions and cards are re-read against
> the source text, fact by fact. Anything that fails is discarded, not shown. GA
> content can't be generated at all without source text — that's enforced in the
> code, not left to the model's good behaviour.

### 5. You're ready
Once you have a few cards and/or verified questions, the daily loop below comes
alive.

---

## Your daily routine

### ▸ Today — your starting point
Opens with what's due, an estimate of how long it'll take, and a **Start review**
button. Alongside it: your readiness number against your target (with an honest
range), your streak, and the top of today's plan. If you're caught up, it says so
and points you at Practice instead.

### ▸ Review — clear your due cards
Your spaced-repetition queue. Read the prompt, reveal the answer, then rate
**Again / Hard / Good / Easy**; each button shows the interval it will give you.
The app (using FSRS) schedules each card's next appearance so you review things
right before you'd forget them.

Review runs in **focus mode** — the rail, tabs, and mobile bar disappear so
there's nothing on screen but the card, and you can drive the whole session from
the keyboard. ⌘K still gets you out.

### ▸ Practice — drill weak spots
MCQs, ordered so your weakest high-value concepts come first. **Before you see
the answer, you rate your confidence (1–5)** — this is required, and it's how the
app learns whether your confidence is trustworthy. After you answer, you get the
explanation. Wrong answers are quietly sent for diagnosis. Anything that looks
broken you can flag.

### ▸ Mocks — test under pressure
A timed, exam-style test built from your verified questions, following the
sections you configured, with **negative marking** (−⅓ per wrong answer).
Distraction-free, with a countdown timer and a question palette. Afterwards you
get your score, accuracy, a topic-by-topic breakdown (weakest first), and a
pacing analysis showing where you slowed down.

### ▸ Planner — what to learn next
Press **Generate today's plan**. It reads your mastery, exam weights, what's due,
and your exam date, then gives you a prioritised, numbered list — high-yield,
weak topics first, and never a topic whose prerequisites aren't ready yet. Tired?
Hit **Low-energy day** for reviews only. As the exam closes in, new intake stops
automatically so you're revising, not cramming new material.

The note on the card always tells you *why* the plan looks the way it does —
including when it's empty, and whether that's because nothing's unlocked yet or
because you've already mastered everything.

### ▸ Knowledge ▸ Digest — current affairs
The day's items, grouped by category, most exam-likely first. Read them on screen
or **play them as audio** and listen while you're doing something else.

---

## The AI study aids (⌘K, or direct URL)

- **Tutor** (rail) — ask any doubt. It answers *with full awareness of your
  history*: it pulls your profile, your mastery on the concept, your recent
  mistakes, concepts you confuse this with, weak prerequisites underneath, and
  your own past notes — then answers. Pick the relevant concept so it tailors the
  depth. Maths renders properly, and when web grounding is configured, factual
  answers arrive with **source links you can check**.
- **Feynman** (`/feynman`) — explain a concept in your own words; the tutor grades
  your explanation for gaps and remembers it. The fastest way to find out what you
  *think* you know but don't.
- **Recall** (`/recall`) — search everything you've ever written (notes, doubts,
  Feynman explanations) by meaning, not just keywords. You can jot notes straight
  into it too. Your personal study memory.

---

## Tracking progress

- **Dashboard** (rail) — a mastery heatmap across topics, trend lines from your
  nightly snapshots, syllabus coverage, an honest readiness estimate vs your
  target (with an explicit uncertainty band), and a study streak.
- **Knowledge ▸ Mistakes** — your recurring misconceptions, automatically
  diagnosed from wrong answers and grouped by type (confusion, factual gap,
  computational slip, trap, and so on). For any of them you can generate an
  **adversarial question** that forces the exact distinction you keep missing.
- **Settings ▸ Confidence** — how well your confidence matches reality, written
  as a plain-language report: how often you're right at each confidence level,
  **when to attempt and when to skip** (under negative marking, guessing only
  pays off above ~25% certainty, so this names the confidence level where
  attempting starts being worth it), and your **most costly mistakes** — the
  confident-but-wrong answers.

---

## Importing your Testbook mocks

If you practise on Testbook, you don't have to re-enter anything.

- **Settings ▸ Import** takes a completed mock's result payload and turns it into
  one mock session plus a recorded attempt per question — folded into your
  mastery and queued for diagnosis exactly like a mock taken in the app.
- Re-importing the same mock does nothing, so you can't double-count.
- Testbook topics that don't match one of your concepts are **listed for you to
  map, never guessed** — a mis-attributed attempt would poison your mastery. Map
  a topic once and it's remembered.
- **The Chrome extension in `extension/` does this automatically.** Load it
  unpacked, point it at your app, and just opening a finished result page imports
  it — you'll see a toast with the tally. Setup is in `extension/README.md`.

---

## What happens automatically (you don't press anything)

- **After every answer**, your mastery for that concept updates, and wrong
  answers get diagnosed in the background.
- **Each night**, the app refreshes its picture of you and tops up your material:
  it re-reads which topics appear most on past papers, recomputes your confidence
  calibration, writes a fresh one-paragraph profile of you (used by the tutor),
  pulls and summarises new current affairs, **turns those fresh items into review
  cards**, **generates a few new practice questions for your weakest high-yield
  topics**, records a mastery snapshot for your trend lines, and **prepares the
  next plan** — so when you open the app, there's a fresh plan, new cards, and
  targeted questions waiting, with no clicks from you.
- Each nightly step is independent: if one fails, the rest still run. The
  auto-generation is capped every night to keep costs tiny, and simply skips if
  you haven't set up an AI provider.

---

## A good first week

1. **Day 1:** set up the exam, add concepts, link a few prerequisites, add ~10
   cards, ingest or generate ~20 questions.
2. **Daily:** Today → Review → a round of Practice → skim the Digest.
3. **2–3×/week:** take a Mock (or import one from Testbook); afterwards read the
   topic breakdown and check **Knowledge ▸ Mistakes** for patterns.
4. **Whenever stuck:** ask the **Tutor**, or use **Feynman** to pressure-test a
   concept you think you've got.
5. **Weekly:** glance at the **Dashboard** for your readiness trend, and
   **Settings ▸ Confidence** to keep your guessing discipline sharp.

That's the whole loop: the app tells you what to study, drills you on it, catches
what you get wrong, and keeps adapting to you.
