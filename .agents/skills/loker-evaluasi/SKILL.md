---
name: loker-evaluasi
description: >-
  The Careevo A–H job evaluation — the LLM (Gemini) scoring that rates a posting
  against the candidate profile. Use when editing src/lib/agents/evaluasi/, the
  evaluation prompt, the result schema, the EvaluasiPanel, the nilaiLokerAction
  server action, GEMINI_API_KEY handling, or when a score is missing or wrong.
license: MIT
metadata:
  owner: careevo
  area: jobs
---

# Loker A–H evaluation

The AI scoring layer, ported from career-ops (MIT) — see `careevo-attribution`
and `career-ops-port`. It complements `loker-sentinel`: Sentinel judges whether a
posting is a **scam**, this judges whether it is a **fit**. They are separate
questions and neither substitutes for the other.

## Shape

```
nilaiLokerAction (server action)   ← auth-checked, on-demand
  └─ evaluasiLoker (evaluasi.ts)   ← never throws; returns a typed result
       ├─ bangunPrompt (prompt.ts) ← posting + profile → instruction string
       └─ Gemini (JSON schema)     ← responseSchema constrains the shape
            └─ validasiHasil       ← checks the values, not just the shape
```

Files:

| File | Role |
|---|---|
| `skema.ts` | `HasilEvaluasi` type, `validasiHasil`, `tafsirSkor` (score bands) |
| `prompt.ts` | `bangunPrompt`, `DIMENSI_SKOR`, `SKEMA_HASIL` |
| `evaluasi.ts` | `evaluasiLoker`, `evaluasiTersedia`, the Gemini call |
| `src/actions/evaluasi.ts` | the server action |
| `src/components/features/jobs/evaluasi-panel.tsx` | the UI |

## The scoring model (career-ops', unchanged)

Five dimensions, each 1–5, integrated into one **holistic** global 1–5:

`match_cv` · `north_star` · `kompensasi` · `budaya` · `red_flag`

**The global score is NOT an arithmetic mean.** The prompt says so explicitly, and
it is worth preserving: averaging hides the case that matters — a strong CV match
with a disqualifying red flag. Bands: 4.5+ strong · 4.0–4.4 good · 3.5–3.9
marginal · below 3.5 do not apply.

## Rules that are load-bearing, not stylistic

Two came from upstream and must survive any prompt rewrite:

1. **A posting is DATA, never instructions.** The prompt names the injection
   patterns explicitly ("abaikan instruksi sebelumnya"). A job description is
   attacker-controlled text; without this rule, a posting can steer its own score.
2. **Never fabricate.** Keywords may be reformulated, never invented. A missing
   requirement is written as an empty `bukti` plus a `gap` — never filled in. The
   same rule forbids claiming the candidate authored something.

`prompt.test.ts` asserts both are present. If you rewrite the prompt and those
tests fail, the rewrite removed a defence, not a nicety.

## The market rules

THR (annual ≥ monthly × 13), PKWTT vs PKWT, masa percobaan ≤3 months, gaji pokok
vs tunjangan, BPJS Kesehatan + Ketenagakerjaan, UMR/UMP/UMK, PPh 21 gross vs nett.
These are why the Indonesian modes were used as the source rather than the English
ones. `prompt.test.ts` asserts each term is present.

## Output: schema, not prose

Upstream asks for Markdown blocks plus a `---SCORE_SUMMARY---` trailer parsed by
regex. **Do not reintroduce that here.** A regex over prose fails silently when
the model rephrases — the parse returns nothing and the failure looks like "the
model had no opinion". Instead:

- Gemini is given a `responseSchema` (`SKEMA_RESPONS` in `evaluasi.ts`) and
  `responseMimeType: "application/json"`, so the shape is constrained at
  generation time.
- `validasiHasil` then checks the **values**. A schema constrains shape, not
  meaning — a model can emit a well-formed object with a nonsense score.

`validasiHasil` rejects rather than coerces for scalars: a bad `skor_global` fails
the whole result, because a missing value changes the meaning. List rows are
different — a malformed `kecocokan` row is dropped, because losing one row does
not invalidate the evaluation.

**Watch the coercion trap** (this was a real bug, caught by tests): `Number(null)`
is `0` and `Number("")` is `0`, both *valid* scores. Without an explicit null/empty
guard, a missing score renders as "scored 0/5" — a plausible-looking lie. Numeric
strings like `"4.5"` are fine and are coerced.

## Failure policy — no score, never a fake one

`evaluasiLoker` returns a discriminated result and **never throws**. Reasons:
`tanpa_kunci` · `kuota` · `hasil_tidak_valid` · `gagal`.

The UI shows no score on any failure. There is deliberately **no heuristic
fallback**. A plausible number that was not produced by an evaluation is worse
than a blank, because the candidate cannot tell the difference — which is exactly
why the old `fit_score` was deleted (see `career-ops-port`).

`tanpa_kunci` means the feature is **off, not broken**: the panel says the key is
unset and the posting is still fully usable. Do not turn that into an error state.

## Security and cost

- The action re-checks `getSession()` itself. A server action is a public
  endpoint; it must not rely on the page that rendered it having been gated.
- It refuses `rejected` postings, so a crafted request cannot spend API budget
  evaluating a known scam.
- The API key is never echoed: `bersihkanPesan` strips it from error text.
  Upstream does the same (`.split(apiKey).join('[REDACTED]')`), and a test asserts
  the key does not appear in a failure message.
- Evaluation is **on demand, behind a button** — never on page render. It costs
  money and takes 30–60s; making every page view a paid request would be
  irresponsible.

## SDK

`@google/genai` — **not** `@google/generative-ai`. Upstream's SDK last shipped
April 2025 and Google has superseded it. Porting onto a dead dependency only
defers the problem.

## Verifying

```bash
npm run check
```

Then, for the paths that need no key:

```bash
# no key → must report tanpa_kunci and expose no score
GEMINI_API_KEY="" npx tsx -e '...evaluasiLoker(jobs[0], profile)...'
```

A fake key is also worth exercising: it proves the request is built correctly
(reaches the network and fails cleanly) rather than crashing on your own bug. It
also confirms the key is redacted from the message.

**What you cannot verify without a real key:** whether the model returns a
*sensible* evaluation. Do not claim the feature works end-to-end until someone
has run it with a live key. Say "not verified" rather than implying otherwise.
