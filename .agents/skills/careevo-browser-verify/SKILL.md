---
name: careevo-browser-verify
description: >-
  Prove a user-visible Careevo feature actually works, by driving it in a real
  browser against a running dev server and measuring what happens. Use before
  claiming a page, flow, or UI fix is done; when asked to verify, test, demo,
  screenshot, or "check the real flow" end to end; when a fix touches layout,
  focus, forms, server actions, or mobile; and when a reviewer asks for evidence
  rather than a re-read. Covers the local-model runbook, the four measurement
  probes, the bug classes only a browser finds, and the repo traps that break
  verification mid-run.
license: MIT
metadata:
  owner: careevo
  area: process
---

# Browser verification

Written after verifying the (since-removed) AI Tutor end to end and finding
**twelve** defects that a careful re-read had missed — including a 36px column
of every assistant answer hidden behind a sidebar on mobile, a rename that
reported success and changed nothing, and UI copy that lied about where the
user's data is stored. Not one of them was visible in the source. All of them
were one measurement away.

This is a **manual** gate, and it has to be. This repo has no browser test
runner: `vitest.config.mts` sets `environment: "node"` and includes only
`.test.ts`. Nothing here is automatable today, so the value is entirely in
knowing *what to measure* rather than in whether you remembered to look.

`npm run check` is not this. It is typecheck + lint + skills:check + unit
tests, and it was **fully green** while the mobile layout was broken and rename
did nothing. `npm run build` is a separate, also-mandatory gate — it is what
catches a client bundle reaching `node:fs`. Run both, then do this.

The `careevo-review` skill is the *static* pass. This is the *behavioural* one.
Read both; they overlap only in the report at the end.

## Runbook

**1. A dev server, and know which one is yours.**

```bash
# A stale one may already hold .next — Next refuses to start a second.
ss -ltnp | grep next-server
npm run dev            # or: npx next dev -p 3000
```

`next dev` prints `⨯ Another next dev server is already running` with the PID.
Kill *that* PID rather than reaching for `pkill -f next-server` — the pattern
also matches the production server and will kill your own build.

**2. A real model, if the flow calls one.**

The app reads `CAREERVO_LLM_BASE_URL` / `_MODEL` / `_API_KEY` from `.env.local`
(see the `loker-evaluasi` skill for which model to pick and why — do not
re-derive that). To test against a *specific* model, edit `.env.local` and
restart; `getLlm()` resolves per call but the dev server populates
`process.env` at boot.

9Router is on `127.0.0.1:20128`. `GET /v1/models` is open; `POST
/v1/chat/completions` is **not** — it needs a key, and the key is in
`~/.9router/db/data.sqlite`, table `apiKeys`, column `key`. Model ids are
gateway routing namespaces (`o2a/…`, `ag/…`); take the exact id from that
`/v1/models` list rather than hand-assembling one.

**3. A signed-in learner with a completed profile.** Auth is cookie-only and
the `(focus)`/`(app)` layouts redirect to `/onboarding` without a profile, so a
fresh registration cannot reach most of the app. An existing browser session is
usually the fastest way in.

**4. If the page navigates under you, suspect another tab.** In this harness the
active tab can change between calls — check `browser_tabs({action:"list"})`
before concluding your click missed. A probe that suddenly reports
`querySelector(...)` of `null` is this, not a broken selector.

## Measure, don't squint

A screenshot tells you *that* something is wrong. These four probes tell you
what, and they are the difference between a bug report and a guess.

**Geometry** — for any layout claim, in the units the user sees:

```js
// Sidebar and the content it was overlapping, by their own selectors.
const rail = document.querySelector('[data-<your-rail>]').getBoundingClientRect();
const row  = document.querySelector('[data-<your-scroll-region>] article').getBoundingClientRect();
({ hiddenPx: Math.max(0, Math.round(rail.right - row.left)) });  // → 36, not "looks fine"
```

Resize to the real viewport first (`390x844` for a phone). Assert on numbers you
can paste into the report; "the rail overlaps the transcript" is not evidence.

**Focus order** — for anything with `aria-hidden`, a collapsed panel, or an
overlay. Never conclude from the JSX; `aria-hidden` does **not** remove a
subtree from the tab order, only from the accessibility tree:

```js
document.querySelector('#some-input').focus();
for (let i = 0; i < 6; i++) {
  await press('Tab');
  ({ inHiddenPanel: !!document.activeElement.closest('[aria-hidden="true"]') });
}
```

**Focusability of a "closed" thing** — the same bug, found without tabbing:

```js
const d = document.querySelector('[data-<your-drawer>]');
({ state: d.getAttribute('data-state'), inert: d.hasAttribute('inert'),
   stillFocusable: d.querySelectorAll('a[href],button:not([disabled])').length });
```

**Network** — for "did that action really run, and did it run *twice*". Server
actions are `POST`s to the page's own route, so they are countable:

```js
const n = String(await browser_network_requests({filter: "belajar/latihan"}))
          .match(/POST/g).length;   // before/after a round trip
```

This is how the ask-hint cache was proven: a second visit to the same session
must add **0** POSTs, because the hint is a second model call per turn.

**Screenshot before and after**, into a versioned folder
(`docs/<feature>-verify/NN-what.png`), and keep the "before" — it is the
evidence that the bug was real. Name them for the state, not the step
(`09-mobile-overlap.png` beats `screenshot-9.png`).

## The classes a browser finds

Each of these shipped in this repo. The detection is the useful part.

- **An absolute overlay with no inset for its sibling.** A `max-md:absolute`
  sidebar leaves the flex row, so the centre column runs *underneath* it. The
  comment usually says "it is opaque so nothing shows through" — true, and
  beside the point. Look for an element that leaves flow with no
  `pl-*`/`pr-*` reserved for it on the sibling. **Detect:** geometry probe.
- **A form that cannot be submitted.** `event.preventDefault()` on Enter inside
  a form **cancels implicit submission**. Pairing it with a state update in the
  same handler is the tell: it reads like "close the field" and is actually
  "never save". **Detect:** type a valid value, press Enter, check the server.
- **A result that is computed and then thrown away.** `const [, action, pending]
  = useActionState(...)` compiles, lints, and types. Every message the action
  carefully returns is unreachable. Grep for a discarded first tuple element.
  **Detect:** trigger the failure and look for *any* user-visible change.
- **A write that lands and a list that disagrees.** `revalidatePath("/x/1")`
  does not refresh `/x`, which is where the sidebar rendering that list actually
  lives. Confirm against disk (`cat .data/...`) before blaming the UI.
- **Copy that describes a product that does not exist.** The strongest find of
  the twelve: the drawer claimed transcripts were "in your browser" and "lost
  when you clear site data" while they sat in a server-side `.data/` tree. Read
  user-facing claims about storage, limits, privacy and provenance *against the
  code*, and delete any sentence you cannot point at a line for.
- **Internal ids in the learner's face.** `r1`, `r1-m1` are join keys, not
  course names. If the UI shows an id, persist the human string beside it — do
  not make the client join.
- **Focusable but hidden.** A closed panel that is translated off-screen and
  `aria-hidden` but still mounted. `inert={!open}` closes both gaps at once.
- **A two-model-call turn with no cache.** If a feature fires a second call per
  turn, check whether re-entering re-buys it. Count the POSTs.
- **A feature that lives in an iframe you cannot reach.** `/ai-mastery` frames
  `features/sijago/` on a *different origin* (`:3200` parent, `:3790` child), so
  `page.evaluate` returns the parent's DOM and every selector reads `null` — or,
  worse, matches something in the chrome and "works". Drive the child with
  `page.frameLocator('iframe')`, and read it with
  `page.frames().find(f => f.url().includes('3790'))`. `page.screenshot()` with no
  args still captures the composed page, which is what you want here. See the
  `careevo-sijago` skill for the framing and hydration details.

## Traps that break the run

- **`npm run check` passing tells you nothing about the browser.** Neither does a
  green `build`. Both are necessary and neither is sufficient.
- **Logic inside a `.tsx` client component is untestable here** — vitest will
  not import it (`.test.ts` only, `node` env, no DOM). That is not a reason to
  leave it there; it is the reason a real bug in it survived. A greeting
  function chained three ternaries, left one branch unreachable, and greeted a
  learner at 23:00 with "Selamat sore." Move the logic to a pure `.ts` module
  and it becomes assertable. **If you cannot test it, that is the finding.**
- **`react-hooks` v6 rejects `setState` in an effect.** Do not "fix" it by
  adding an eslint-disable; derive during render instead. The pattern that
  worked: pair the piece of UI state with the value it was opened under, and
  treat "that value changed" as the close condition.
- **A watch out for a typo in a constant name** — `KUNTEK_KEYS` vs
  `KUNTEKS_KEYS` passed a re-read and failed `tsc`. Run the gate.
- **Beware stale builds.** `npm start` serves `.next`. Rebuild before believing
  a behavioural check. The same trap is worse for `features/sijago`, whose `:3790`
  server runs from **`.next/standalone`** — a source edit is invisible there until
  that bundle is rebuilt and the server restarted.
- **A UI that still shows the old name after you renamed it.** Usually not a
  failed edit: check *which bundle is being served* before re-grepping source.
- **`data/` and `.data/` are gitignored and real.** A behavioural check mutates
  a learner's actual data. It is a dev store, so that is fine, but do not delete
  it to "reset" without asking.

## Report honestly

The last section of the `careevo-review` pre-commit sequence asks for this, and
it is the part most often skipped. State what you verified, how, and — in a
list — what you did not. "Not checked: the provider-failure path, delete, IME
composition" is worth more than a confident summary, because it tells the next
person where the risk actually is. If a claim is analytic rather than measured,
say *analytic*; if a test has never been seen red, say so.

## When verification finds things

Fix the measured bug, not the reported one — the twelfth is usually a second
copy of the first. Then:

- Add the regression test **and make it fail first** (the `careevo-review`
  rule). A new-behaviour test has never been red, so it has never been proven
  to cover anything.
- If you change a field's shape, grep every consumer (the `careevo-review`
  rule). Adding `courseTitle` beside `courseId` touches a validator, a
  projection, a client component and a test.
- **Do not "fix" a documented decision to satisfy a bug you found.** The
  markdown renderer (`src/lib/markdown/ringan.ts`) leaves an unmatched `**`
  literal, on purpose and with a test. A model that emits sloppy Markdown is a
  model problem; reversing a recorded rendering policy to hide it is not a fix.
- If the fix required breaking a stated rule, **write the exception down**.
  `personalized-path.ts` must call `modulKursus()` even though AGENTS.md forbids
  it from actions, because the ids on both sides come from the derived branch.
  Recorded in AGENTS.md, because an undocumented exception gets "fixed" back by
  the next agent to read the rule.
