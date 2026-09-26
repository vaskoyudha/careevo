---
name: career-ops-engine
description: >-
  How to drive the vendored career-ops engine in src/lib/career-ops — its exit
  codes, the files it appends to, why a scan receipt cannot explain a zero, and
  the append race that duplicates postings. Use when running or debugging a scan,
  touching pipeline.md / scan-history.tsv / scan-runs.tsv, changing what the
  inbox renders, or when a scan "found nothing". For what was adopted from
  career-ops and why, see career-ops-port; for the A–H scoring, loker-evaluasi.
license: MIT
metadata:
  owner: careevo
  area: jobs
---

# The career-ops engine

`engine/` is a read-only vendored copy of career-ops (MIT, © 2026 Santiago
Fernández de Valderrama) — ~128 Node `.mjs` scripts. `career-ops-port` records
*whether* to adopt it; this records **how it behaves once you drive it**, which
is the part that is not derivable by reading the code and cost real time to learn.

All numbers below are measured on this repo's seeded config, not estimated.

## Running it

`jalankanScan()` in `src/lib/career-ops/tracker.ts` spawns a subprocess:

```
node engine/scan.mjs --json --quiet [--since N] [--dry-run] [--company SUBSTR]
```

**There is no `--limit` and no `--seeds`.** Those belong to `scan-ats-full.mjs`,
the reverse-ATS sweeper that was replaced. Passing an unknown flag makes
`validateFlags` exit before any work happens, so the symptom is "scan does
nothing" with no error. Narrow with `--company` (substring on an entry name) or
the `--posted-*` / `--since` bounds instead.

A real run takes **~150s** and finds ~14,000 postings to add ~18. It is not
interactive and not fast; do not put it behind a request that has a short timeout.

## Exit code 2 is SUCCESS

`scan.mjs` ends:

```js
emitJsonReceipt(receipt, errors.length > 0 ? 2 : 0);
```

So **exit 2 means "the scan completed and some providers failed"**, and the
receipt on stdout is still valid. Exit 1 is a fatal `main()` throw and writes no
receipt at all.

Judging the run by its exit code reported a real 422-posting scan as a failure.
**Success is "a receipt came back"** — test `typeof data.added === "number"`, and
treat the error list as a diagnostic, never as the verdict. This is pinned by
`scan-contract.test.ts`.

## The receipt cannot explain a zero

`receipt.filtered` is a **summed total of eleven filter counters**. It tells you
how much was dropped, never which filter dropped it. A run that adds nothing is
indistinguishable from a dead provider.

The per-filter breakdown lives in **`data/scan-runs.tsv`**, written by the engine
— one row per run, one column per counter, 19 columns. `bacaRiwayatScan()` in
`src/lib/career-ops/scan-runs.ts` is the only surface that can say "1,539 were
too old". That is the whole reason it exists; do not fold it into the receipt.

Its header is copied verbatim from `SCAN_RUNS_HEADER` (`engine/scan.mjs`), and
the column→field map is **derived from that header** rather than hand-listed. A
hand-typed index list is a second source of truth for the engine's schema and
misreads every row the day a column moves. A row shorter than the header is
skipped, not read past the end: `Number(undefined)` is `NaN`, which renders as a
confident zero for a column that was never measured.

## pipeline.md is append-only, and that has consequences

This is the trap that cost the most. `pipeline.md` is a Markdown file the engine
**appends** to. It has no transaction, no lock, and no rewrite.

**A scan's dedupe is a read-then-decide.** It reads the file, decides which
postings are new, then appends. Two scans therefore interleave badly: both read
the same pre-scan state, both judge their postings new, and both append.

Measured: two scans **168ms apart** produced `pipeline.md` with **486 rows
holding 443 distinct URLs** — 29 URLs duplicated, from 9 before the race.

`jalankanScan` is therefore wrapped in a promise chain (`antreScan`, mirroring
`antre` in `src/lib/courses/storage.ts`). **It serializes the whole run, not
just the write** — a lock around the append alone still lets both engines decide
"new" from the same snapshot, and then append in an order neither chose.
`scan-serial.test.ts` proves it and has been seen red (`expected 3 to be 1`).

This is **per process**, like the courses cache. Two `next start` instances on
one data root still race. Fixing that needs a lock file the vendored engine
respects — a change to `engine/`, not to this layer. Recorded rather than fixed.

### Duplicate rows are a rendering bug, not a cosmetic repeat

Because the UI keys each row by `r.url`, a duplicate URL is a **duplicate React
key**, and React mis-reconciles: it strands stale nodes in the DOM. Observed
directly — filtering by *Allianz* showed "44 lowongan" in the counter while 53
rows sat in the list, and rows from **BMW Group survived the filter**.

`bacaInboxUnik()` in `src/lib/career-ops/inbox.ts` is the defence, and
`bacaInboxDenganTanggal()` goes through it. Keeping the first occurrence is
unambiguous rather than a policy choice: all 9 measured duplicate groups were
byte-identical apart from position, so there is no field to reconcile. **If you
change what the inbox reads, keep the URL unique or the filter breaks.**

## The data files, and who owns each

| File | Written by | Read by | Note |
|---|---|---|---|
| `data/pipeline.md` | engine, **appends** | `bacaInbox*` | the postings. Markdown, hand-editable, gitignored |
| `data/scan-history.tsv` | engine | `bacaTanggalScan()` | `url → first_seen`, the freshness fallback |
| `data/scan-runs.tsv` | engine | `bacaRiwayatScan()` | per-filter counters, see above |
| `portals.yml` | **user**, seeded from `engine/templates/portals.example.yml` | engine | 202 entries: 25 boards, 138 companies |

`bootstrapCareerOps()` seeds the skeleton, the scan-runs header, and that
`portals.yml` — write-once, so a fresh data root renders empty instead of
throwing. It deliberately leaves a legacy `kuis` material row alone rather than
deleting it (see AGENTS.md, kuis section).

**`portals.yml` is now user-editable data, and the seed skews West.** The 138
tracked companies are US/EU, so a default run returns Allianz, DeepSeek and
BMW Group postings and nothing Indonesian. For an Indonesian product that is the
first thing to change — and it is a data edit, not a code change.

## The engine never submits anything

It appends to a local file. Nothing is POSTed to any job board, ever. That is
upstream's design, not an omission — `career-ops-port` records it, and "Lamar
sekarang" is still deliberately a no-op. The inbox is read-only for the same
reason: the only action is opening the posting on its own site.

## Before changing how the engine is called

1. Re-read the exit-code rule. It is the single easiest thing to get wrong.
2. Check whether the change makes a scan *concurrent* with anything. If so, it
   needs the chain, not just a wider timeout.
3. If you touch a reader, check the URL is still unique in what you hand the UI.
4. `npm run build` is the gate for anything a client component imports — the
   readers reach `node:fs`, and only the build catches a client bundle doing it.
