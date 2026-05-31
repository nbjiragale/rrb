# Features & First-Day Guide

You've just opened the app for the first time. This page explains **what every
screen does and the order to use them in** so you go from an empty app to a
working daily study routine.

> Setting the app up (database, optional AI providers) is covered separately in
> **`user-guide.md`**. This guide assumes the app is already running. AI features
> (tutor, diagnosis, question/card generation, nightly profile, semantic recall)
> are optional and degrade gracefully — everything else works without them.

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

The sidebar has your **daily screens** at the top, then four **grouped screens**
(each opens with tabs across the top):

| Sidebar entry | Tabs inside | Use it to… |
|---|---|---|
| **Review** | — | Do today's spaced-repetition cards |
| **Practice** | — | Answer MCQs, weak topics first |
| **Mock** | — | Take a timed, exam-style test |
| **Planner** | — | See what to study next |
| **Digest** | — | Read the day's current-affairs revision |
| **Study aids** | Tutor · Feynman · Recall | Ask doubts, teach back, search your notes |
| **Insights** | Overview · Mistakes · Calibration | See how you're doing |
| **Content** | Ingest · Generate · Current affairs | Add study material |
| **Library** | Concepts · Cards · Graph | Build your knowledge base |

On a phone, the bottom bar shows the five things you use most: Review, Practice,
Mock, Planner, Tutor.

---

## Day 1 — get the app ready (about 15 minutes)

A brand-new app is empty, so it has nothing to review or quiz you on yet. Do
these four steps once, in order.

### 1. Add your concepts → **Library ▸ Concepts**
A *concept* is the smallest thing you study — e.g. "President's pardon power
(Art. 72)", "Percentages", "Blood relations". Everything else (cards, questions,
mastery, the plan) hangs off concepts.

- Add a few concepts for the topics you're starting with. Give each a subject
  (math / reasoning / ga), a topic, and an optional description.
- *Shortcut:* if the project was seeded with the starter ontology, you'll already
  have a full RRB NTPC concept tree here — skip ahead.

### 2. (Optional) Link prerequisites → **Library ▸ Graph**
Tell the app which concepts build on which (e.g. *compound interest* needs
*percentages*). This powers two things: the planner won't suggest a topic before
its foundations are solid, and the tutor can spot when a weak foundation is the
real cause of a struggle. You can also store "where to learn" links per concept.

### 3. Add things to study
You need two kinds of material:

- **Cards** (for spaced review) → **Library ▸ Cards.** Make front/back flashcards
  for facts you want to remember long-term. These feed the Review screen.
- **Questions** (for practice & mocks) → **Content**, three ways:
  - **Ingest** — paste real past-exam questions (PYQs), one at a time or as a
    JSON batch. These are the gold standard and are trusted as-is.
  - **Generate** — have the AI create fresh math/reasoning questions, or GA
    questions grounded in a passage you paste. *Every generated question is
    independently re-checked before it's allowed into practice* — only verified
    items are ever shown to you.
  - **Current affairs** — paste (or auto-scrape) a news article; the app builds
    grounded GA cards and questions **strictly from that text**, never from the
    model's memory.

### 4. You're ready
Once you have a few cards and/or verified questions, the daily loop below comes
alive.

---

## Your daily routine

Once set up, a typical day is just the top four screens:

### ▸ Planner — start here
Press **Generate today's plan**. It reads your mastery, exam weights, what's due,
and your exam date, then gives you a prioritised, numbered list of what to learn —
high-yield, weak topics first, never a topic whose prerequisites aren't ready. Tired?
Hit **Low-energy day** for reviews only. The note on the card always tells you why
the plan looks the way it does.

### ▸ Review — clear your due cards
Your spaced-repetition queue. Read the prompt, reveal the answer, then rate
**Again / Hard / Good / Easy**. The app (using FSRS) schedules each card's next
appearance so you review things right before you'd forget them. Cards you find
hard come back sooner.

### ▸ Practice — drill weak spots
MCQs, ordered so your weakest high-value concepts come first. **Before you see the
answer, you rate your confidence (1–5)** — this is required, and it's how the app
learns whether your confidence is trustworthy. After you answer, you get the
explanation. Wrong answers are quietly sent for diagnosis (see Insights).

### ▸ Mock — test under pressure
A timed, exam-style test built from your verified questions, with **negative
marking** like the real RRB NTPC (−⅓ per wrong answer). Distraction-free, with a
countdown timer and a question palette. Afterwards you get your score, accuracy,
a topic-by-topic breakdown, and a pacing analysis showing where you slowed down.

### ▸ Digest — current affairs
The day's current-affairs items, grouped by category, most exam-likely first.
Read them on screen or play them as audio. A quick daily habit.

---

## The AI study aids → **Study aids**

- **Tutor** — ask any doubt. It answers *with full awareness of your history*: it
  pulls your profile, your mastery on the concept, your recent mistakes, concepts
  you confuse this with, weak prerequisites underneath, and your own past notes —
  then answers. Pick the relevant concept so it tailors the depth.
- **Feynman** — explain a concept in your own words; the tutor grades your
  explanation for gaps and remembers it. The fastest way to find out what you
  *think* you know but don't.
- **Recall** — search everything you've ever written (notes, doubts, Feynman
  explanations) by meaning, not just keywords. Your personal study memory.

---

## Tracking progress → **Insights**

- **Overview** — your dashboard: a mastery heatmap across topics, trend lines,
  syllabus coverage, an honest readiness estimate vs your target (with an explicit
  uncertainty band), and a study streak.
- **Mistakes** — your recurring misconceptions, automatically diagnosed from wrong
  answers and grouped by type (confusion, factual gap, computational slip, trap,
  etc.). For any of them you can generate an **adversarial question** that forces
  the exact distinction you keep missing.
- **Calibration** — how well your confidence matches reality, plus an
  **attempt/skip trainer**: under negative marking, guessing only pays off above
  ~25% certainty, so this tells you the confidence level at which attempting is
  worth it. It also flags your "confident-but-wrong" answers — the most dangerous
  gaps.

---

## What happens automatically (you don't press anything)

- **After every answer**, your mastery for that concept updates, and wrong answers
  get diagnosed in the background.
- **Each night**, the app refreshes its picture of you: it re-reads which topics
  appear most on past papers, recomputes your confidence calibration, writes a
  fresh one-paragraph profile of you (used by the tutor), pulls and summarises new
  current affairs, and **prepares the next plan** — so a fresh plan is waiting when
  you open the app.

---

## A good first week

1. **Day 1:** add concepts, link a few prerequisites, add ~10 cards, ingest or
   generate ~20 questions.
2. **Daily:** Planner → Review → a round of Practice → skim the Digest.
3. **2–3×/week:** take a Mock; afterwards review the topic breakdown and check
   **Insights ▸ Mistakes** for patterns.
4. **Whenever stuck:** ask the **Tutor**, or use **Feynman** to pressure-test a
   concept you think you've got.
5. **Weekly:** glance at **Insights ▸ Overview** for your readiness trend and
   **Calibration** to keep your guessing discipline sharp.

That's the whole loop: the app tells you what to study, drills you on it, catches
what you get wrong, and keeps adapting to you.
