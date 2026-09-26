---
name: career-ops-port
description: >-
  What Careevo took from career-ops, what it deliberately did not, and why. Use
  when considering further career-ops integration, when asked about the job-board
  roadmap, when someone suggests porting the scanner or A-H evaluation, when
  wiring a live job feed, or before re-attempting work this records as deferred.
license: MIT
metadata:
  owner: careevo
  area: jobs
---

# The career-ops port

career-ops (<https://github.com/career-ops-hq/career-ops>, MIT, ~72k stars) is the
closest public prior art to Careevo's Job Seeking feature. This skill records what
was adopted, what was rejected, and why — so the analysis is not redone from
scratch and settled decisions are not quietly reversed.

Full analysis: `docs/career-ops-architecture-study.md`.
Local reference clone: `../career-ops-ref` (kept for comparison, not committed).

## The finding that shapes everything

**career-ops is not a web app you can copy into.** It is a local-first CLI + AI
agent: ~128 Node `.mjs` scripts, 43 Markdown "prompt modes", ~210k LOC, where the
intelligence lives in **Markdown prompts executed by an LLM CLI**, not in code.

The web UI it ships (`web/`) is an experimental *view over local files*. It drives
the engine by spawning it as a subprocess and streaming NDJSON to the browser:

```ts
spawn(process.execPath, [rootScript("scan-ats-full"), "--dry-run", "--json"], {
  env: { ...process.env, CAREER_OPS_PORTALS: tempPortals },  // ephemeral config
});
```

So a Next.js app *can* host that engine — but only by shipping and owning the
scripts. There is no API to call. Careevo has no backend, so this is a
product-shape change, not an integration.

## Adopted (and why)

| Adopted | Into | Rationale |
|---|---|---|
| Trust validator | `src/lib/jobs/trust.ts` | Pure functions, no I/O. Adds the URL/domain axis Careevo lacked. |
| Filter builders | `src/lib/jobs/filters.ts` | Pure functions. Fixed a real defect: the board filtered on one dimension, by substring. |
| **`scan.mjs` as the scanner** | `src/lib/career-ops/tracker.ts` | See "The scanner was reversed" below. |
| **A–H evaluation (LLM)** | `src/lib/agents/evaluasi/` | See "The A–H evaluation" below — adopted later, once the candidate chose a provider. |
| Indonesian market notes | in the A–H prompt | PKWTT/PKWT, THR, BPJS, UMR, PPh 21 — now enforced in the prompt, not just referenced. |

All adopted code carries the MIT notice — see `careevo-attribution`.

## The scanner was reversed

`scan.mjs` was originally on the rejected list: *"3,637 lines, deeply coupled to
files, YAML, and dedup history. Not a library."* That is a fair description of
the **file** and the wrong conclusion about the **need**.

The job seeker needs real postings. The scanner actually in use was
`scan-ats-full.mjs`, the reverse-ATS sweeper over 50k public ATS companies — and
it is company-list driven, so it found 17 real postings and **kept 0**. It is
right for a US keyword sweep and wrong for Careevo: no Indonesian provider at
all. `scan.mjs` is the one with glints/jobstreet and with the per-filter counters
that can explain a zero.

So the reversal was not "the rejection was wrong" but **"the rejection named the
wrong artifact"**. Coupling is a reason not to *edit* the engine, not a reason to
leave the product without a working scanner. It is spawned as a subprocess and
read through a thin typed layer (`src/lib/career-ops/`), never imported, so the
coupling stays contained and `engine/` stays read-only.

Measured on the seeded config: 14,111 postings found, **422 added**, one board
reachable. The same user on the old scanner saw nothing.

**Operating it is documented in `career-ops-engine`** — the exit-code rule, the
append race, and which file answers which question. This skill records the
decision; that one records the behaviour.

## The A–H evaluation (adopted after initial deferral)

Initially this was classified as "not a port — it needs an LLM, which is a product
decision". That was a correct technical read but the wrong *process*: it was
recorded as settled without the candidate being offered the choice. It has since
been implemented, because the choice is the candidate's to make.

What it took, and what is now true:

- Provider: **Google Gemini**, model `gemini-2.5-flash`, overridable via `GEMINI_MODEL`.
- Key: `GEMINI_API_KEY`. **Without it the feature is off, not broken** — the panel
  says so and no score is shown.
- Trigger: a server action behind a button, not on page render. The call costs
  money and takes 30–60s, so making every page view a paid request would be
  irresponsible. This also keeps career-ops' human-in-the-loop principle.
- Output: JSON constrained by a `responseSchema`, then validated by
  `validasiHasil`. Upstream parses a `---SCORE_SUMMARY---` regex out of prose;
  that fails silently on rephrasing, so it was not copied.
- SDK: `@google/genai`, **not** `@google/generative-ai`. Upstream's SDK last
  shipped April 2025 and has been superseded; porting onto it would only defer
  the problem.
- Failure: no score is shown, ever. There is deliberately **no heuristic
  fallback** — a plausible number that was not produced by an evaluation is worse
  than a blank, because the candidate cannot tell the difference.

The scoring model is upstream's, unchanged: five dimensions (match_cv,
north_star, kompensasi, budaya, red_flag) integrated into one holistic 1–5 score,
with the bands 4.5+ / 4.0–4.4 / 3.5–3.9 / below 3.5.

## What `fit_score` was, and why it is gone

`jobs.json` used to carry a hand-written `fit_score` (78, 64, 71…). Nothing
computed it. It was a static number rendered as "Fit 78" on the board — a score
with no evaluation behind it.

Once the A–H panel existed and honestly said "Belum dinilai", the fake badge
directly contradicted it. Both were removed. If you see a `fit_score` reappear,
it is a regression: the real score comes from `evaluasiLoker`, and it is 1–5, not
0–100.

## Rejected (and why) — do not re-litigate without new information

| Rejected | Reason |
|---|---|
| **Block G (their scam check)** | Replacing `auditLoker` with it would trade deterministic, testable rules for an untestable prompt — and it has **no Indonesian scam rules**. Careevo is ahead here; do not regress. |
| **`scan.mjs` core** | 3,637 lines, deeply coupled to files, YAML, and dedup history. Not a library. **Superseded — see below.** |
| **Tracker + `data/applications.md`** | File-canonical data model with a SQLite index. A different architecture entirely. |
| **PDF/CV generation, Go dashboard** | Out of scope. |
| **Live Glints/Jobstreet providers** | Deferred, not rejected — see below. |

Note: the A–H evaluation was originally on this list. It was moved to "Adopted"
after the candidate was actually given the choice. The lesson is recorded in
`careevo-review`: a technical constraint is not the same as a product decision,
and the latter belongs to the candidate.

## Deferred: the live Indonesian job feed

`providers/glints.mjs` and `providers/jobstreet.mjs` scrape **undocumented**
endpoints (Glints GraphQL `/api/v2-alc/graphql`, SEEK v5 REST). Upstream's own
comments say the schema "is reverse-engineered and may change".

Deferred because Careevo **is planned to be hosted**, and that changes the risk
profile:

- CORS blocks a browser-side call; it must be a server route.
- A shared host IP is far more likely to be rate-limited or blocked than a
  developer's machine.
- It needs caching and rate limiting before it is responsible to ship.

The async boundary is already in place for it: `src/lib/jobs/cache.ts` exposes
`ambilLokerTampil()` / `ambilLokerBersih()` / `ambilLokerById()`, so swapping the
fixture body for a network fetch is a one-file change and no component moves.

**Before starting it**, decide: hosting target, caching strategy, rate limits, and
whether the boards' terms of service permit it. Those are decisions, not
implementation details.

## Open, deliberately untouched

- **"Lamar sekarang" is still a no-op.** Note that career-ops' stance is the
  opposite of a TODO: it *never* submits, by design — "The script never POSTs."
  If Careevo ever wires this up, that philosophy is worth considering rather than
  copying the first implementation that comes to mind.

(`fit_score` used to be listed here. It is now gone — see the section above.)

## The one thing not to lose

`deteksiFee`'s six Indonesian scam rules (biaya administrasi, rekening pribadi,
APK, tiket travel, pungutan seragam, KTP/OTP) have **no equivalent** in
career-ops. A 72k-star project does not solve this problem. It is the feature's
real differentiator and the reason to keep the audit deterministic.

## Before proposing further integration

1. Re-read the architecture study's portability verdicts.
2. Check whether the proposal is one of the rejected items above, and whether
   anything has actually changed since.
3. If it is the live feed, answer the four questions in that section first.
