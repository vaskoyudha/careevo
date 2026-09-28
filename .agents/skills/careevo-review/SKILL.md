---
name: careevo-review
description: >-
  Self-review checklist for Careevo changes, encoding real defects that shipped
  in this repo. Use before committing, when reviewing a diff or PR, when writing
  tests, when porting code from another project, or when asked to check your own
  work. Covers prototype-chain bugs, duplicated rules, field-contract drift, and
  test quality.
license: MIT
metadata:
  owner: careevo
  area: process
---

# Careevo self-review

Written after a commit of mine shipped **three real bugs** that a re-read caught.
Each rule below exists because something specific went wrong. Run this list
before committing.

## 1. Do not use `in` to check a lookup-table key

`in` walks the prototype chain. `"toString" in {}` is `true`.

```ts
// WRONG — returns the inherited toString FUNCTION where a string belongs
if (flag in LABEL_MAP) return LABEL_MAP[flag];

// RIGHT
if (Object.hasOwn(LABEL_MAP, flag)) return LABEL_MAP[flag];
```

This shipped in `labelSinyal`. Any `Record<string, T>` indexed by an
untrusted-ish string is a candidate. Use `Object.hasOwn` (or
`Object.prototype.hasOwnProperty.call`).

## 2. Never keep two copies of a rule that hides data

A filter spelled twice is two definitions free to drift — and the copy that
drifts silently is the one that leaks. In this repo, "rejected postings are
hidden" lives only in `src/lib/fixtures.ts`; `src/lib/jobs/cache.ts` delegates.

When you find yourself writing the same predicate in a second file, call the
first one instead. If a layer boundary makes that awkward, write a test that
asserts the two agree.

## 3. When you change a field's meaning, check every consumer

Renaming or re-scoping a field is a breaking change even when the type is
unchanged. `fee_flags` went from "fee-demand rules" to "every signal" — same
`string[]` type, different meaning — and two UI sites silently started lying.

Before changing semantics, `grep` every read of the field and decide
individually whether it still means what it meant.

## 4. Make the test fail first

A regression test you never saw fail is decoration. After writing one,
**reintroduce the bug** and confirm the test goes red, then restore the fix.

```bash
cp src/lib/agents/sentinel.ts /tmp/fixed.ts
# reintroduce the bug
npx vitest run src/lib/agents/sentinel.test.ts   # must FAIL
cp /tmp/fixed.ts src/lib/agents/sentinel.ts
```

If it still passes, the test does not cover the bug.

## 5. Test the invariant, not the current data

`expect(jobs.length).toBe(9)` breaks the moment a fixture is added, and it
proves nothing. Assert the *property*: `fee_flags` ⊆ `flags`; a `clean` job has
no flags; every stored verdict matches a fresh audit.

## 6. Verify behaviour, not exit codes

`npm test` green does not mean the feature works. Against a running server,
check the actual response: the rejected title is absent from the board HTML, the
quarantined posting shows no apply button, `/loker/9` renders 404 content.

Beware stale builds — `npm start` serves `.next`. Rebuild before believing a
behavioural check.

## 7. "Missing data" is not "bad data"

Filters and validators in this repo follow one convention: an absent or
unparseable field **passes**. A posting with no salary, no location, or no
apply URL must not be silently dropped or flagged as suspicious. Read
`src/lib/jobs/filters.ts` and `src/lib/jobs/trust.ts` for the pattern before
adding a predicate.

## 8. Attribution is not optional when porting

Anything adapted from another project needs the notice in the file header. See
the `careevo-attribution` skill. This is a licence condition, not politeness.

## 9. A technical constraint is not a product decision

Recorded because it actually happened: the A–H evaluation was deferred with the
reasoning "it needs an LLM, which is a product decision, not a port". The
technical read was correct. The process was not — the decision was recorded as
settled and the candidate was never offered the choice, so they had to ask twice
before it was built.

When something is out of scope because of a **cost, key, or product trade-off**,
say so and ask. Do not classify it as "rejected" on their behalf. The line to
hold is: if the blocker is technical (cannot be done), decide it. If the blocker
is a preference (should it be done), ask.

## 10. Do not add dead code

`src/lib/jobs/{ingestor,cache}.ts` sat unused for the project's life. If you
export something, wire it to a real call site in the same change, or do not add
it. Check with:

```bash
grep -rn "mySymbol" src --include='*.ts' --include='*.tsx' | grep -v 'export function mySymbol'
```

An empty result means it is dead.

Dead code is worse than absent code in marketing copy, because the fixture
that describes it is still on disk. Four names were once promised in the
Problems–Solusi section and are not in the product:

| Name | Reality |
|---|---|
| `Socrates` | `jalankanSocrates` (`src/lib/agents/socrates.ts:17`) is never called, returns `usedFallback: true` unconditionally, and its `draftScore` is `62 + testRuns*6 - pasteEvents*9`. There is no timed answer anywhere. |
| `VTS` | `hitungVts` (`src/lib/scoring/vts.ts:18`) is uncalled outside its own test; VTS is never stored. |
| `Navigator` | Nothing named Navigator is traceable to a row owned by the logged-in account — `dashboard-integritas.test.ts:76` forbids promising it. |
| camera proctoring | Zero `getUserMedia` in `src/` (the one hit is a comment at `course-session.tsx:481`). `kamera_mulai` is a value a learner picks from a radio group. |

`src/app/(verifikator)/review/[id]/page.tsx:55` already admits the first three
have no database counterpart. Before writing product copy, check that every
named feature has a call site; if it only exists in `src/fixtures/*.json` or a
plan doc, it is not a feature yet. Stale fixture rows will render the dead
name back onto the page — filter on `actor_id` AND `action` AND `summary`, since
a table that prints all three columns leaks the name through whichever survives.

## 11. Shell gotchas that have already bitten

- **Backticks in a `-m` message are command substitution.** `git commit -m "...\`flags\`..."` silently deletes the word. Use `-F file` or single quotes.
- **`grep -c` counts lines, not occurrences.** For "how many badges on the page", use `grep -o … | wc -l`.
- **zsh fails a whole loop on a glob with no match**, printing `no matches found` and skipping the loop. Guard globs or use `find`.
- **A transitive dependency is not a dependency.** `scripts/validate-skills.mjs` imports `js-yaml`, which arrived via eslint until it was declared explicitly. Anything you `import` must be in `package.json` — otherwise an unrelated upgrade removes it.

## Pre-commit sequence

```bash
npm run check   # typecheck + lint + skills:check + test
```

Then, for anything user-visible, a behavioural check against `npm run dev`.
Report what you verified and what you did not — an honest "not checked" beats a
confident guess.

`npm run check` is the single gate. `skills:check` validates `.agents/skills/`
against the Agent Skills spec, because invalid frontmatter fails *silently* —
the skill simply never loads, and nothing says why.
