---
name: loker-sentinel
description: >-
  The Careevo job-board Sentinel audit — how loker postings are judged safe,
  quarantined, or rejected. Use when editing the loker board or detail page,
  changing auditLoker / deteksiFee / the trust validator, adding a scam rule,
  touching fee_flags or sentinel_status, or debugging why a posting shows the
  wrong verdict.
license: MIT
metadata:
  owner: careevo
  area: jobs
---

# Loker Sentinel

The deterministic audit behind `/loker`. It is the product's differentiator: a
rule-based Indonesian recruitment-scam detector, not an LLM prompt.

## Two independent signal families

Both feed one verdict. Keep them distinct — they have different trust levels and
different failure modes.

| Family | Source | Signals |
|---|---|---|
| **Content** (scam modus) | `deteksiFee` + inline checks, `src/lib/agents/sentinel.ts` | `biaya_administrasi`, `rekening_pribadi`, `tiket_travel`, `pungutan_seragam`, `panen_data`, `link_apk`, `email_pribadi`, `domain_baru` |
| **Structural** (URL/domain trust) | `nilaiKepercayaan`, `src/lib/jobs/trust.ts` | `url_tidak_valid`, `link_pendek`, `domain_tidak_cocok`, `tanpa_url_lamaran` |

Family 2 is adapted from career-ops (MIT) — see the `careevo-attribution` skill.
Family 1 is Careevo's own and has no upstream equivalent. **Never replace
family 1 with family 2**; they cover different scams.

## The three verdicts and the escalation policy

```
rejected    if  link_apk
            or  >=2 content signals
            or  url_tidak_valid
            or  >=1 content signal AND >=1 strong structural signal

quarantined if  exactly 1 content signal
            or  exactly 1 strong structural signal

clean       otherwise
```

`FLAG_KEPERCAYAAN_KUAT` = `["url_tidak_valid", "link_pendek"]`.

Two rules in that policy are load-bearing and easy to break:

- **`tanpa_url_lamaran` never escalates.** It means "we don't know", not "this is
  a scam". Counting it would quarantine every posting that omits a link and empty
  the board.
- **`domain_tidak_cocok` is not a "strong" flag.** It is the weakest rule and the
  most false-positive-prone (a company using an unlisted ATS looks identical to a
  mismatch). It may quarantine, but it must not combine with one fee flag to
  reject.

A shortener URL fires **both** `link_pendek` and `domain_tidak_cocok` — the
shortener *causes* the mismatch. Do not "fix" that double penalty by counting
both as independent signals; that over-escalates one cause. `link_pendek` is
strong, the mismatch is not, so the policy above stays correct.

## The field contract — read this before touching either field

`SentinelOutput` exposes **two different lists**. Conflating them is the bug that
already shipped once.

| Field | Contains | Used for |
|---|---|---|
| `flags` | **everything** — both families | display, the detail page's signal list |
| `fee_flags` | **demand signals only** (`SINYAL_FEE`) | the board's "Tanpa sinyal fee" filter |

`SINYAL_FEE` is **derived** from `FEE_RULES` (`ID_ATURAN_FEE`), not listed again.
A hand-written copy drifts silently: add a rule to `FEE_RULES`, forget the copy,
and the "no-fee" filter stops recognising the new demand while the audit still
flags it — filter and verdict disagree, and nothing errors. It deliberately
excludes `email_pribadi`, `domain_baru`, and every trust flag.

Why it matters: when `fee_flags` held every signal, the "no-fee" toggle hid a job
for a *domain mismatch*, and the detail page could show an **AMAN** badge beside
"no signals" while listing flags. A "no-fee" filter must mean *money was not
requested* — nothing else.

Invariant, asserted in `src/lib/fixtures.test.ts`: `fee_flags` ⊆ `flags`, and a
`clean` job has empty `flags`.

## Derive, never hardcode

`src/fixtures/jobs.json` stores **no** `sentinel_status` or `fee_flags`. Both are
computed by `auditLoker` via `auditJob()` in `src/lib/fixtures.ts`.

This was deliberate. Hand-written verdicts let the fixture claim `clean` while
its own description demanded a fee — the audit was decorative. If you need to
change a posting's verdict, **change its content** (description, email, URL,
domain age), not a status field. `fixtures.test.ts` re-audits every posting and
will fail if the stored values drift from the computed ones.

## One definition of "hidden"

The rule "`rejected` postings are not reachable" lives **only** in
`src/lib/fixtures.ts` (`visibleJobs`, `cleanJobs`, `getVisibleJob`).
`src/lib/jobs/cache.ts` delegates to those — it must never re-spell the filter.
Two copies are two definitions free to drift, and the copy that drifts silently
is the one that leaks a scam listing to the public board.

`getVisibleJob` (not `getJob`) is what the detail page uses, so a direct URL to a
rejected posting 404s. Keep it that way.

## Adding a scam rule

1. Add the `{rule, label, pattern}` entry to `FEE_RULES` in
   `src/lib/agents/rules/fee-rules.ts`. Patterns are case-insensitive and
   Indonesian; keep `[^.]{0,N}` gaps bounded so a pattern cannot span a paragraph.
2. If the rule means "money or data was demanded", add its id to `SINYAL_FEE` in
   `src/lib/agents/sentinel.ts`.
3. Add its label to `LABEL_KEPERCAYAAN` (trust) or rely on `labelAturan` (fee).
   `labelSinyal` resolves both families — use it in UI, never index a label map
   with `in` (see `careevo-review`).
4. Add a case to `src/lib/agents/sentinel.test.ts` and, if it changes a fixture's
   verdict, check the demo still shows all three tiers.

## The demo must show all three tiers

`fixtures.test.ts` asserts at least one `clean`, one `quarantined`, and one
`rejected` posting. The UI copy promises "Karantina bisa dibanding" — an empty
quarantine tier makes that a lie. If a rule change empties a tier, adjust a
fixture's *content* until the tier is populated again.

## Verifying

```bash
npm test                                     # includes the audit + fixture invariants
npm run typecheck && npm run lint
npm run dev                                  # then check /loker and /loker/1
```

Against a running server, confirm behaviour rather than assuming it: the public
board must not list rejected titles, `/loker/9` must render the 404 page with no
scam content, and a quarantined posting must render its flags with **no** apply
button.

## Known limitation

`notFound()` in the `(app)` group renders the 404 page but returns **HTTP 200**,
because `(app)/loading.tsx` opens a Suspense boundary that streams the response
before the status can be set. Pre-existing and app-wide (`/submission/999`
behaves the same; `/challenge/999` returns a real 404 only because `(focus)` has
no `loading.tsx`). Do not treat it as a regression in this area.
