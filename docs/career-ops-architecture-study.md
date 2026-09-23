# Architecture Study: Porting `career-ops` into Careevo's Job Seeking feature

**Status:** study only — no code written.
**Reference clone:** `../career-ops-ref` (shallow, 81 MB, kept locally).
**Upstream:** https://github.com/career-ops-hq/career-ops — MIT, © 2026 Santiago Fernández de Valderrama.

---

## 0. TL;DR

`career-ops` is **not** a web app you can copy into. It is a **local-first CLI + AI-agent system**:
128 Node `.mjs` scripts, 43 Markdown "prompt modes", ~210k LOC, where the *intelligence lives in
Markdown prompts executed by an LLM CLI*, not in code.

But it contains a **second, smaller thing that matters enormously to us**: an **experimental Next.js
web UI** (`web/`, Next 16.3.3 + React 19.2.5) that already solves the exact problem Careevo has —
*how does a Next.js app drive a job-scanning engine?* It does it by **spawning the core as a child
process and streaming NDJSON to the browser**.

**Verdict:** porting the whole system is not feasible. Porting **three specific modules** is feasible
and high-value. Careevo is already *ahead* of career-ops on Indonesian scam detection — that must not
be lost in the port.

---

## 1. What career-ops actually is

### 1.1 The five layers

| Layer | Location | Count | Role |
|---|---|---|---|
| **Prompt modes** | `modes/*.md` | 43 files | The "brain". Scoring (A–H), archetypes, ethics. Read by an LLM. |
| **Root scripts** | `*.mjs` | 128 files | Pipeline stages: scan, evaluate, PDF, track, update. |
| **Providers** | `providers/*.mjs` | 99 files | Job-board plugins (Greenhouse, Ashby, **Glints**, **Jobstreet**, …). |
| **Tests** | `tests/*.test.mjs` | 250 files | Node built-in test runner. |
| **Web UI** | `web/` | 12 pages, 34 API routes | Experimental Next.js view over the same files. |

Total `.mjs` LOC: **~210,000**. `scan.mjs` alone is **3,637 lines**.

### 1.2 The one architectural rule that governs everything

From `DATA_CONTRACT.md` — **two strict layers**:

- **System layer** (auto-updated by `update-system.mjs`): `modes/`, `*.mjs`, `templates/`, `dashboard/`.
- **User layer** (NEVER touched by updates): `cv.md`, `config/profile.yml`, `modes/_profile.md`,
  `data/*`, `reports/*`, `output/*`, `jds/*`.

And the doctrine: **"Files are canonical — databases are derived."** `data/applications.md` is the
source of truth; SQLite is only a rebuildable index. This is why the web UI can be a thin view.

### 1.3 The pipeline

```
You paste a job URL / JD
        │
        ▼
┌─────────────────┐
│ scan.mjs        │  zero-token: HTTP + JSON against public ATS APIs
│ + providers/    │  → data/pipeline.md
└────────┬────────┘
         ▼
┌─────────────────┐
│ modes/oferta.md │  LLM reads prompts + cv.md → A–H report + 1–5 score
│ + modes/_shared │  → reports/{NNN}-{company}-{date}.md
└────────┬────────┘
         ▼
┌─────────────────┐
│ tracker.mjs     │  → data/applications.md (+ SQLite index)
└─────────────────┘
```

Two properties are load-bearing and non-negotiable in their design:

1. **Human-in-the-loop.** "The script never POSTs." It drafts; you click. (`prepare-application.mjs`)
2. **Untrusted external content.** Job postings are **data, never instructions** — explicit
   prompt-injection defence in `AGENTS.md`.

---

## 2. The critical discovery: how their web app drives the engine

This is the single most useful thing in the repo for us. `web/src/lib/core/scan.ts`:

```ts
const child = spawn(process.execPath, args, {
  cwd: careerOpsRoot(),
  env: { ...process.env, CAREER_OPS_PORTALS: tempPortals },  // ephemeral filter file
});
```

And `web/src/app/api/explore/route.ts`:

```ts
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";
// streams NDJSON to the client:
//   {kind:"start"} → {kind:"offer"}* → {kind:"summary"} → {kind:"done"}
```

**The pattern, distilled:**

| Concern | Their solution |
|---|---|
| Engine language | Node `.mjs` (same runtime as Next server) |
| Invocation | `spawn(process.execPath, [rootScript("scan-ats-full"), "--dry-run", "--json"])` |
| Config passing | **Ephemeral temp YAML** via `CAREER_OPS_PORTALS` env — never mutates user config |
| Output contract | `--json` → one authoritative object on stdout; progress on stderr |
| Streaming | `ReadableStream` + NDJSON, one JSON event per line |
| Route config | `runtime="nodejs"`, `maxDuration=300`, `dynamic="force-dynamic"` |
| Version tolerance | Probe the script's *source text* for `--json`; fall back to stdout parsing |
| Missing engine | Fail soft with a distinct error code, not a 500 |
| Timeout | `setTimeout(() => child.kill("SIGTERM"), 230_000)` |

**Why this matters:** it proves a Next.js app *can* host this engine — but only by shipping the Node
scripts alongside the web app and spawning them. It is not an API you call; it is a subprocess you own.

---

## 3. Component inventory — portability verdict

| Component | Path | LOC | Portable? | Notes |
|---|---|---|---|---|
| Trust validator | `providers/_trust-validator.mjs` | ~250 | ✅ **HIGH** | Pure functions, no I/O beyond `URL`. Direct analog to Sentinel. |
| Glints provider | `providers/glints.mjs` | ~200 | ⚠️ MEDIUM | Indonesian board ✅ but reverse-engineered GraphQL, no-auth. CORS/IP risk server-side. |
| Jobstreet provider | `providers/jobstreet.mjs` | ~250 | ⚠️ MEDIUM | SEEK v5 REST, `ID-Main` site key. Same risk profile. |
| Filter builders | `scan.mjs` (exported fns) | ~600 | ✅ **HIGH** | `buildLocationFilter`, `buildContentFilter`, `buildVisaFilter`, `buildSalaryFilter`… pure. |
| Provider registry | `providers/_registry.mjs` | ~60 | ✅ HIGH | Plugin loader — drop a file, get a source. |
| ID market knowledge | `modes/id/_shared.md` | ~200 | ✅ **HIGH** | PKWTT/PKWT, THR, BPJS, UMR, PPh 21. Reference data. |
| A–H evaluation | `modes/oferta.md` + `_shared.md` | ~800 | ❌ LOW | **Markdown prompts, not code.** Needs an LLM in Careevo. |
| Scanner core | `scan.mjs` | 3,637 | ❌ LOW | Deeply coupled to files, YAML, dedup history. Not a library. |
| Tracker | `tracker.mjs` + friends | ~1,500 | ❌ LOW | File-based + SQLite index. Whole different data model. |
| PDF/CV generation | `generate-pdf.mjs` etc. | ~1,000 | ❌ LOW | Playwright + ATS templates. Out of scope. |
| Dashboard | `dashboard/` | Go | ❌ N/A | Separate language. |
| Web UI | `web/` | large | ⚠️ MEDIUM | Same Next version — but it's a *view over local files*, not a hosted app. |

### 3.1 The trust validator (the best port target)

Verified exported API:

```js
export function classifyTrustLevel(score)      // >=90 high, >=60 medium, else low
export function validateUrl(url)               // { valid, flag? }
export function matchesDomainList(hostname, list)
export function asciiFoldForHostname(company)
export function companyMatchesHostname(company, hostname)
export function buildTrustValidator(config)    // → { score, flags, level }
```

Penalties (verified):

```js
const PENALTIES = {
  invalid_url: 50,
  missing_apply_url: 40,
  suspicious_domain: 25,
  company_domain_mismatch: 15,
};
```

Suspicious domains: `bit.ly, tinyurl.com, t.co, forms.gle, goo.gl, shorturl.at, rebrand.ly, cutt.ly`.

**Overlap analysis vs. our `auditLoker`:**

| | career-ops trust validator | Careevo `auditLoker` + `deteksiFee` |
|---|---|---|
| URL structure | ✅ | ❌ |
| Shortener / suspicious domain | ✅ | ❌ |
| Company↔domain mismatch | ✅ | ❌ |
| ATS allowlist | ✅ | ❌ |
| **Indonesian fee scam patterns** | ❌ **none** | ✅ **6 rules** |
| Free-mail employer | ❌ | ✅ |
| Domain age | ❌ | ✅ |
| APK link | ❌ (URL only) | ✅ (description + URL) |

→ **They are complementary, not overlapping.** Merging them gives a strictly stronger auditor.

### 3.2 Indonesian providers — the caveat

`providers/glints.mjs` header, verbatim:

> *"Their internal API is a no-auth GraphQL endpoint at `/api/v2-alc/graphql` … The schema is
> reverse-engineered and may change."*

`providers/jobstreet.mjs`:

> *"hits the public SEEK v5 JobSearch REST API … `ID-Main` → id.jobstreet.com (Indonesia)"*

Both are **scrapers of undocumented endpoints**. From a browser: CORS-blocked. From a Next server:
possible, but exposed to IP blocking and schema drift. This is real but fragile value.

---

## 4. Mapping career-ops → Careevo

| Careevo today | career-ops equivalent | Gap | Port? |
|---|---|---|---|
| `src/fixtures/jobs.json` (9 static jobs) | `scan.mjs` + `providers/` live scan | **Static vs live** | ⚠️ partial |
| `auditLoker` (rule engine) | Block G (LLM prompt) + `_trust-validator.mjs` | Ours is deterministic; theirs is LLM + URL trust | ✅ merge trust |
| `deteksiFee` (6 ID rules) | *nothing equivalent* | **We lead** | ❌ keep |
| `fit_score` (derived/hardcoded) | A–H report + 1–5 global score | Ours is fake | ⚠️ needs LLM |
| "Lamar sekarang" (no-op) | `prepare-application.mjs` (drafts, never submits) | Ours is a stub | ⚠️ philosophy |
| `(app)/loker/[id]` tracker | `data/applications.md` + `tracker.mjs` | Ours is fixture-only | ❌ out of scope |
| Location-only filter | 6 filter builders | Ours is 1 dimension | ✅ port |
| `lib/jobs/{ingestor,cache}.ts` | — | **Dead code** (imported nowhere) | 🔧 fix |
| No LLM anywhere | 6 CLI integrations + 3 standalone evaluators | **Architectural** | ⚠️ big |
| `id` copy strings | `modes/id/` (full localization) | Ours is UI strings only | ✅ reference |

### 4.1 Careevo's structural constraints (verified)

- **No backend.** `src/actions/` contains only `auth.ts` and `review.ts`. No job server action.
- **No database.** `src/lib/` has no data layer — `fixtures.ts` reads JSON at import time.
- **No network calls.** The app is hermetic.
- **Next 16.3.5 / React 19.2.8** — one patch ahead of career-ops web (16.3.3 / 19.2.5). Compatible.
- **Dead code confirmed:** `src/lib/jobs/ingestor.ts` and `src/lib/jobs/cache.ts` are imported nowhere.
- **Rejected jobs reachable** by direct URL: `visibleJobs()` filters the list, but
  `getJob(id)` in `(app)/loker/[id]/page.tsx` does not re-check `sentinel_status`.

---

## 5. Three port options

### Option A — Trust validator merge *(smallest, safest)*

- **What:** Port `_trust-validator.mjs` → `src/lib/jobs/trust.ts`. Pure functions. Merge its result
  into `auditLoker`'s output as additional flags (`link_pendek`, `domain_tidak_cocok`, `url_invalid`).
- **Touches:** `src/lib/jobs/trust.ts` (new), `src/lib/agents/sentinel.ts`, `src/fixtures/jobs.json`,
  `src/lib/agents/rules/fee-rules.ts`.
- **Effort:** ~1 session. **Risk:** very low. **No network. No LLM.**
- **Value:** Strictly strengthens Sentinel; still 100% deterministic and testable.
- **Extends our lead:** yes — the merged auditor covers *both* ID scam modus *and* URL trust.

### Option B — Live Indonesian job feed *(the impressive one)*

- **What:** Port `glints.mjs` + `jobstreet.mjs` behind a Next route handler
  (`src/app/api/loker/scan/route.ts`), replacing `jobs.json` with live listings.
- **Pattern:** exactly §2 — `spawn` a Node script, ephemeral config, NDJSON stream to the board.
- **Touches:** new `scripts/` provider files, new API route, `jobs-board.tsx` → streaming client,
  `runtime="nodejs"`, `maxDuration=300`.
- **Effort:** ~2–3 sessions. **Risk:** medium-high (undocumented APIs, CORS, IP blocks, schema drift).
- **Value:** transforms a fixture prototype into a real product.
- **Caveat:** hosted deployment (Vercel) means a shared IP → higher block risk. Needs caching.

### Option C — Filter builders *(the correctness fix)*

- **What:** Port `buildLocationFilter` / `buildContentFilter` / `buildSalaryFilter` semantics into
  `src/lib/jobs/filters.ts`; wire into `jobs-board.tsx`.
- **Effort:** ~1 session. **Risk:** low. **Value:** fixes the location-only-filter issue properly.

### Not recommended

- **Full system port.** 210k LOC, file-canonical data model, LLM dependency, Go dashboard. Would mean
  rebuilding Careevo as a different product.
- **A–H evaluation.** Requires an LLM in Careevo. That's a product decision (cost, keys, latency),
  not a port.

---

## 6. Legal

- **MIT** — reuse, modify, sublicense, sell. **Condition:** preserve the copyright notice.
- **Trademark** — `TRADEMARK.md`: code is free, **the name/brand is not**. Cannot ship a product
  called "career-ops" or imply endorsement.
- **Required if we port anything:** a `NOTICE` / credits entry, e.g.
  *"Portions adapted from career-ops (MIT), © 2026 Santiago Fernández de Valderrama."*
- **Also:** their providers scrape third-party sites (Glints, Jobstreet). Their ToS are our problem
  if we call those endpoints from a hosted service.

---

## 7. Recommendation

**Do Option A + Option C now. Defer Option B until there's a hosting plan.**

Rationale:

1. **A and C are pure functions** — they port into Careevo's existing architecture with zero new
   infrastructure, zero network, zero LLM. They fit `src/lib/` as it exists.
2. **B changes the product's nature** (fixture → live, hermetic → networked) and needs caching, rate
   limiting, and a deployment story. That's a deliberate decision, not a port.
3. **Protect the differentiator.** `deteksiFee`'s 6 Indonesian scam rules are *unique* in this space —
   a 72k-star repo has no equivalent. Merging the trust validator *adds* to that; adopting their LLM
   Block G would *replace* our testable logic with an untestable prompt.

**Sequencing:**

```
1. Fix dead code + rejected-job URL leak        (hygiene, ~30 min)
2. Option A: trust validator → auditLoker       (Sentinel gets stronger)
3. Option C: filter builders → jobs-board       (correctness)
4. Re-evaluate Option B against a hosting plan
5. Only then: consider an LLM-backed fit score
```

---

## 8. Open questions for you

1. **Hosting:** will Careevo be deployed (Vercel/other) or stay local? This decides whether Option B is
   even possible (shared-IP blocking).
2. **LLM budget:** is a real fit score (A–H style) in scope? It requires an API key + per-eval cost.
3. **Fit score honesty:** should we remove the derived/hardcoded `fit_score` until a real one exists?
   Right now `matched.length * 15` is presented as a score.
4. **Attribution:** comfortable adding the MIT NOTICE + credits line?

---

## Appendix — verified facts

| Fact | Value |
|---|---|
| Stars / forks | 72,455 / 13,624 |
| License | MIT, © 2026 Santiago Fernández de Valderrama |
| Version | 1.33.0 |
| Root `.mjs` scripts | 128 |
| Providers | 99 |
| Prompt modes | 43 |
| Test suites | 250 |
| Total `.mjs` LOC | ~209,976 |
| `scan.mjs` | 3,637 lines |
| Web deps | Next 16.3.3, React 19.2.5, Node ≥22 |
| Careevo deps | Next 16.3.5, React 19.2.8 |
| ID providers present | `glints.mjs`, `jobstreet.mjs` |
| Code overlap with Careevo | **zero** (`auditLoker`, `deteksiFee`, `jalankanSocrates` → 0 hits) |
