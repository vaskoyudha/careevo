# Mastery Path + Book Generation — Implementation Plan

> For agentic workers: implement task-by-task, verify each before moving on.

**Goal:** Add DeepTutor's two flagship learning surfaces to Careevo — a
Mastery Path (topic tree → knowledge points → spaced review) and a generated
Book (spine → pages → typed blocks → reader), both usable **without an LLM key**
via a deterministic stub compiler.

**Why now:** `/belajar/tutor` is built (DeepTutor 3-pane chat). Mastery Path is
DeepTutor's structured answer to "what should I learn next", and Book
Generation is its long-form teaching artifact. Both are heavily used in
DeepTutor's own navigation (`PRIMARY_NAV` lists *Book* and *Mastery Path*
ahead of *Learning Space*), so they belong in Careevo.

## Upstream reference (explored at `/home/vyns/DeepTutor` @ `a5eafa89`, v1.6.8)

### Mastery Path

| Concern | Upstream file | LOC |
|---|---|---|
| Mastery scoring (recency-weighted, confidence-capped) | `deeptutor/learning/mastery.py` | 40 |
| Spaced-repetition scheduler + interval sequences | `deeptutor/learning/scheduler.py` | 101 |
| Models (topic, knowledge point, repetition state, review task) | `deeptutor/learning/models.py` | — |
| Learning policy (due queue, progression) | `deeptutor/learning/policy.py` | ~400 |
| REST/WS routes | `deeptutor/api/routers/mastery_path.py` | 1085 |
| Topic wizard | `web/components/space/learning/TopicWizardSteps.tsx` | 511 |
| Path board, atlas, review trail, progress ring | `web/components/space/learning/*.tsx` | ~2000 |
| Routes | `web/app/(utility)/mastery/[pathId]/**` | — |

### Book Generation

| Concern | Upstream file | LOC |
|---|---|---|
| Orchestrating engine | `deeptutor/book/engine.py` | — |
| Ideation → spine → pages pipeline | `deeptutor/book/agents/*.py` | 2285 |
| Block model + renderers (15 types) | `deeptutor/book/blocks/*.py`, `web/app/(workspace)/books/components/blocks/*.tsx` | — |
| Reader, library, sidebar, outline nav, spine editor | `web/app/(workspace)/books/components/*.tsx` | 5291 |

**Licence:** Apache-2.0, same as the tutor port. Every adapted file gets the
same header block and a row in the `careevo-attribution` skill.

## The two algorithms we port verbatim (they are the pedagogy)

`compute_mastery` — recency-weighted accuracy with a low-confidence cap, so
one lucky answer cannot "master" a point:

```python
_RECENCY_WEIGHTS = (0.5, 0.7, 0.85, 0.95, 1.0)
_CONFIDENCE_CAP = {1: 0.5, 2: 0.8}
```

`INTERVAL_SEQUENCES` — days, by knowledge type:

```python
MEMORY:    [0, 1, 3, 7, 14, 30, 60]
CONCEPT:   [3, 7, 14, 30]
PROCEDURE: [3, 7, 14]
DESIGN:    [14, 28]
```

Two correct in a row jumps two intervals; a wrong answer steps back one.
These are small, pure, and testable — we port them exactly rather than
inventing our own spacing, because the schedule is the product.

## Decision: stub LLM, no key

The user chose **"build both shells, stub the LLM"**. So:

- A **`LlmPort` interface** with two implementations: `GeminiLlmPort` (real,
  already used by `generateStudyReply`) and `StubLlmPort` (deterministic,
  used when `GEMINI_API_KEY` is absent). Chosen by env, not by a flag, so a
  key added later switches over with no code change.
- **Mastery Path needs no LLM for its structure.** The topic tree, knowledge
  points, mastery math and review schedule are all deterministic. Only the
  study/review *conversation* is LLM-backed, and it already degrades to
  "Tutor Gemini belum dikonfigurasi."
- **Book generation is stubbed at the compiler boundary.** `StubBookCompiler`
  derives a spine and pages from the learner's **existing course catalog and
  quiz bank** — so a generated book is real, readable, and specific to the
  course they are studying, not lorem ipsum. A book is always producible.

Careevo-specific reuse (do not duplicate these):
- Course modules/pages → `katalogBelajar()`, `modulKursus()`
- Quiz questions → `soalKuisSchema` bank (`src/lib/validation/kuis.ts`)
- Formatted prose blocks → `BlokHalaman` (`src/lib/courses/blok.ts`) — pure,
  client-safe, **no HTML**
- Tutor sessions → `src/lib/tutor/session-store.ts`
- Persistence → file-backed store, same `.data/` + `CAREERS_DATA_DIR` pattern

## Constraints

- No new npm dependencies. No WebSockets. No database.
- No `dangerouslySetInnerHTML` (repo rule). Book blocks are structured data.
- Indonesian user-facing copy.
- `npm run check` **and** `npm run build` both gate this (build catches the
  client-safe/server-only split that check misses).
- Do not touch `src/components/ui/{chrome,learner-chrome}.tsx`, `layout.tsx`,
  `globals.css`, `(marketing)/page.tsx`, or `problems-solutions.tsx` — another
  agent owns those right now.

## Phase 1 — Mastery Path

**Status: complete. 735/735 tests, `check` + `build` + `e2e` (28) + `smoke` (25) green.**

| # | Task | Files | Status |
|---|---|---|---|
| M1 | Port `compute_mastery` + interval sequences as pure TS, with tests | `src/lib/mastery/scoring.ts`, `.test.ts` | ✅ verified against DeepTutor's Python output |
| M2 | Types: topic, knowledge point, attempt, repetition state, review task | `src/lib/mastery/types.ts` | ✅ incl. runtime guards |
| M3 | File-backed mastery store (topics + attempts + review queue per owner) | `src/lib/mastery/store.ts`, `.test.ts` | ✅ owner-isolated, path-safe |
| M4 | Topic tree derivation from a course (deterministic — the stub "generator") | `src/lib/mastery/topic-tree.ts`, `.test.ts` | ✅ |
| M5 | `LlmPort` + `StubLlm` + `GeminiLlm` + env selection | `src/lib/llm/port.ts` | ✅ |
| M6 | Server actions: create topic, record attempt, archive/delete, start session | `src/actions/mastery.ts` | ✅ |
| M7 | Routes: `/belajar/mastery`, `/belajar/mastery/[topicId]` | `src/app/(focus)/belajar/mastery/**` | ✅ |
| M8 | UI: progress ring, topic list, knowledge-point rows, due queue, review schedule | `src/components/features/mastery/*` | ✅ |
| M9 | Study hand-off — a point's button opens a tutor session pre-seeded with that point | ✅ via `mulaiSesiTopikAction` |
| M10 | Attribution + docs | skill, `AGENTS.md`, this plan | ✅ |

### Nav entry deferred, deliberately

`src/components/ui/learner-chrome.tsx` is **owned by another agent** at the time
of writing (a parallel design pass is editing `layout.tsx`, `globals.css`, both
`chrome*.tsx`, `(marketing)/page.tsx` and `problems-solutions.tsx`). Adding a nav
item there would collide. Mastery is instead reachable from:

- `/belajar/jalur` — a "Jalur Penguasaan" button beside "Buka Tutor"
- the tutor's own left rail

Add the navbar item when that work lands; it is a three-line change.

### Findings worth keeping

- **The port is verified against upstream, not assumed.** `compute_mastery([F,F,T])`
  is `0.357` in both implementations and `[T,T,F]` is `0.643` — the recency
  weights favour *older* attempts at short histories, which is the opposite of
  the intuitive reading. Two tests were wrong before the code was.
- **The "two correct = skip an interval" rule is 0 → 1 → 3**, not 0 → 1 → 2:
  the second correct adds a bonus step *on top of* the normal one. Confirmed by
  running DeepTutor's `schedule_next` directly.
- `antreanJatuhTempo` had a real bug caught by tests: it took `now: number` and
  called `Date.parse(now)`, so every comparison was `NaN` and **nothing was ever
  due**. That is the kind of bug that makes a review feature look alive (the
  queue renders) while being permanently empty.
- The store test must use a **dynamic** `import("./store")`. A static import is
  hoisted above the `CAREERS_DATA_DIR` assignment, so `DATA_ROOT` binds to the
  real cwd and the test writes into the repo's `.data/`. This actually happened
  and was cleaned up.
- `reviewQueueFor` originally returned the *whole* schedule, so "due" was a
  lie. It now filters by `now` (injectable, so it is testable) — and the
  full schedule is still available for the review trail.



## Phase 2 — Book Generation

**Status: complete. 757/757 tests, `check` + `build` + `e2e` (33) + `smoke` (26) green.**

| # | Task | Files | Status |
|---|---|---|---|
| B1 | Book model: book, spine, chapter, page, block union | `src/lib/book/types.ts` | ✅ 11 block types, all with runtime guards |
| B2 | Block renderer — structured data, no HTML | `src/components/features/book/blok-renderer.tsx` | ✅ |
| B3 | `BookCompiler` + `StubBookCompiler` | `src/lib/book/compiler.ts`, `.test.ts` | ✅ depth genuinely changes length |
| B4 | `GeminiBookCompiler` + `parseBlocks` | `src/lib/book/compiler-gemini.ts` | ✅ malformed blocks dropped, not fatal |
| B5 | File-backed book store (one file per book) | `src/lib/book/store.ts` | ✅ owner-isolated, path-safe |
| B6 | Server actions: build a book, delete it | `src/actions/book.ts` | ✅ |
| B7 | Routes: `/belajar/buku`, `/belajar/buku/[bookId]` | `src/app/(focus)/belajar/buku/**` | ✅ |
| B8 | UI: library (with depth + intent form), reader (collapsible contents, pager) | `src/components/features/book/*` | ✅ |
| B9 | Attribution + docs + hand-off button | skill, `AGENTS.md`, `jalur-belajar-view.tsx` | ✅ |

### How a book works with no key

`buatBukuAction` picks the compiler: `GeminiBookCompiler` when a key exists,
`StubBookCompiler` otherwise. The stub assembles a real book from the course's
own material — module summaries become prose, a list of points, flashcards, a
deep-dive and a graded question. The depth control (`brief` / `standard` /
`deep`) scales the actual content, not just a number quoted in a sentence.

### Block taxonomy: 11 of DeepTutor's 19

Shipped: `text`, `heading`, `list`, `callout`, `code`, `figure`, `quiz`,
`flashcards`, `timeline`, `deepDive`, `userNote`.

Dropped on purpose — each needs an engine this repo does not have, and a block
that renders as an empty grey box is worse than no block:
`conceptGraph` (force-directed layout), `animation` (server-rendered Manim),
`interactive` (GeoGebra), and the five guided-learning assessment blocks
(`diagnostic`, `pretest`, `retrievalPractice`, `errorDiagnosis`, `moduleTest`,
`progressDashboard`) which duplicate what Mastery Path now does better.


## Global constraints

- Indonesian user-facing copy.
- Tailwind v4, existing tokens. No new theme system.
- No new npm dependencies. No WebSockets. No database.
- No `dangerouslySetInnerHTML` (repo rule).
- `npm run check` + `npm run build` both gate this work.
