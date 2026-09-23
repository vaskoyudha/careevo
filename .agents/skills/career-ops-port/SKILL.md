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
| Indonesian market notes | referenced in `loker-sentinel` | PKWTT/PKWT, THR, BPJS, UMR, PPh 21 — design reference. |

All adopted code carries the MIT notice — see `careevo-attribution`.

## Rejected (and why) — do not re-litigate without new information

| Rejected | Reason |
|---|---|
| **A–H evaluation / 1–5 score** | It is Markdown prompts, not code. Adopting it means adding an LLM dependency (key, cost, latency) to a hermetic app. That is a product decision, not a port. |
| **Block G (their scam check)** | Replacing `auditLoker` with it would trade deterministic, testable rules for an untestable prompt — and it has **no Indonesian scam rules**. Careevo is ahead here; do not regress. |
| **`scan.mjs` core** | 3,637 lines, deeply coupled to files, YAML, and dedup history. Not a library. |
| **Tracker + `data/applications.md`** | File-canonical data model with a SQLite index. A different architecture entirely. |
| **PDF/CV generation, Go dashboard** | Out of scope. |
| **Live Glints/Jobstreet providers** | Deferred, not rejected — see below. |

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

Both are product decisions with a cost attached, not oversights:

- **`fit_score` is still fake.** `job.fit_score ?? matched.length * 15` is
  presented as a score. A real one needs an LLM (see A–H above). Until then it is
  a derived number wearing a score's clothes.
- **"Lamar sekarang" is still a no-op.** Note that career-ops' stance is the
  opposite of a TODO: it *never* submits, by design — "The script never POSTs."
  If Careevo ever wires this up, that philosophy is worth considering rather than
  copying the first implementation that comes to mind.

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
