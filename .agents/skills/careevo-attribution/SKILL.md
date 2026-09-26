---
name: careevo-attribution
description: >-
  Licensing and attribution rules for Careevo, which ports code from MIT-licensed
  career-ops. Use when adding code adapted from another project, when copying or
  porting a module, when asked about licences or provenance, when writing file
  headers, or when preparing a release or public repo.
license: MIT
metadata:
  owner: careevo
  area: legal
---

# Careevo attribution

Careevo contains code adapted from two upstreams: **career-ops** (MIT) and
**DeepTutor** (Apache-2.0). These are licence conditions, not courtesies.
Getting either wrong is a legal problem, not a style problem.

## What was ported from career-ops (MIT)

| Careevo file | Adapted from | Licence |
|---|---|---|
| `src/lib/jobs/trust.ts` | career-ops `providers/_trust-validator.mjs` + `lib/ascii-fold.mjs` | MIT |
| `src/lib/jobs/filters.ts` | career-ops `scan.mjs` (`buildLocationFilter`, `buildContentFilter`, `buildSalaryFilter`) | MIT |
| `src/lib/career-ops/url-key.ts` | career-ops `url-key.mjs` (`normalizeUrl`, `promoteKnownFragmentIdentity`) | MIT |
| `src/lib/career-ops/match-tracker.ts` | career-ops `merge-tracker.mjs` (Pass 0 dedup precedence) + `tracker-parse.mjs` (`normalizeTextKey`) | MIT |
| `src/lib/career-ops/tracker-table.ts` | career-ops `tracker-parse.mjs` (`parseTrackerRow`, header detection) + `web/src/lib/tracker-table.mjs` | MIT |
| `src/lib/career-ops/report.ts` | career-ops `modes/id/lowongan.md` § Pasca-evaluasi + `templates/report.md` (report/TSV format) | MIT |

Upstream: <https://github.com/career-ops-hq/career-ops>
Copyright © 2026 Santiago Fernández de Valderrama.

### The vendored engine (`engine/`)

`engine/` is a **verbatim** copy of the career-ops core (1017 files, ~15 MB),
committed to the repo and spawned via `child_process` from
`src/lib/career-ops/exec-engine.ts` — it is runtime, not reference, so it must
be in version control. Its `LICENSE`, `CITATION.cff` and `TRADEMARK.md` come
along with the copy, which is what satisfies MIT's "notice appears in all
copies" condition for that tree.

`engine/` is read-only. Bugs and behaviour changes go upstream; Careevo adapts
around it in `src/lib/career-ops/`, which is why those files carry the
`Adapted from career-ops (MIT)` header. Do not edit `engine/` to make a
Careevo-side change work — mirror the change in the TS layer, or change
`portals.yml` / the data root, which are data, not code.

`career-ops/` at the repo root is the original upstream clone kept for
reference only. It is **gitignored** and is not part of the build.

## What was ported from DeepTutor (Apache-2.0)

| Careevo file | Adapted from | Licence |
|---|---|---|
| `src/components/features/learning/study-chat.tsx` | DeepTutor `web/components/chat/home/ComposerInput.tsx`, `ChatComposer.tsx`, `web/components/space/learning/MasteryComposer.tsx` | Apache-2.0 |
| `src/lib/agents/study-chat/hint.ts` | DeepTutor `deeptutor/services/chat_hints.py` | Apache-2.0 |
| `src/components/features/tutor/tutor-shell.tsx` | DeepTutor `web/components/layout/AppShell.tsx`, `web/features/chat/components/ChatWorkspace.tsx` | Apache-2.0 |
| `src/components/features/tutor/tutor-rail.tsx` | DeepTutor `web/components/sidebar/WorkspaceSidebar.tsx`, `SidebarShell.tsx`, `nav-entries.ts` | Apache-2.0 |
| `src/components/features/tutor/tutor-column.tsx` | DeepTutor `web/features/chat/components/ChatWorkspace.tsx` (centre column), `web/components/chat/home/TurnNavigator.tsx` | Apache-2.0 |
| `src/components/features/tutor/tutor-composer.tsx` | DeepTutor `web/components/chat/home/ChatComposer.tsx`, `ComposerInput.tsx` | Apache-2.0 |
| `src/components/features/tutor/tutor-activity.tsx` | DeepTutor `web/components/chat/home/SessionViewerPanel.tsx` | Apache-2.0 |
| `src/lib/mastery/scoring.ts` | DeepTutor `deeptutor/learning/mastery.py`, `deeptutor/learning/scheduler.py` | Apache-2.0 |
| `src/lib/mastery/types.ts` | DeepTutor `deeptutor/learning/models.py` | Apache-2.0 |
| `src/components/features/mastery/cincin-progres.tsx` | DeepTutor `web/components/space/learning/ProgressRing.tsx` | Apache-2.0 |
| `src/lib/book/types.ts` | DeepTutor `deeptutor/book/models.py` | Apache-2.0 |
| `src/lib/latihan/tipe-soal.ts` | DeepTutor `web/lib/quiz-question-type.ts` + `deeptutor/agents/question/pipeline.py` (concept coercion) | Apache-2.0 |
| `src/lib/latihan/types.ts` | DeepTutor `deeptutor/agents/question/pipeline.py` (`QuizTemplate` / `QuizPair` / `_normalize_quiz_payload` / `_parse_quiz_payload`) | Apache-2.0 |
| `src/lib/latihan/nilai.ts` | DeepTutor `web/components/quiz/QuizViewer.tsx` (`isAnswerCorrect`, `getUserAnswer`), notebook `score_trend` | Apache-2.0 |
| `src/lib/latihan/generator.ts` | DeepTutor `deeptutor/agents/question/pipeline.py` (Plan + per-question phases) | Apache-2.0 |
| `src/lib/llm/json.ts` | DeepTutor `deeptutor/agents/question/pipeline.py` (`_parse_quiz_payload`) | Apache-2.0 |
| `src/lib/latihan/generator-gemini.ts` | DeepTutor `deeptutor/agents/question/pipeline.py` (per-question phase + repair) | Apache-2.0 |
| `src/lib/latihan/juri.ts` | DeepTutor `deeptutor/api/routers/quiz_judge.py` (`_JUDGE_SYSTEM_PROMPTS`, `_build_judge_user_prompt`) | Apache-2.0 |
| `src/components/features/latihan/soal-kartu.tsx` | DeepTutor `web/components/quiz/QuizViewer.tsx`, `web/app/(workspace)/books/components/blocks/QuizBlock.tsx` | Apache-2.0 |
| `src/components/features/latihan/latihan-view.tsx` | DeepTutor `web/components/quiz/QuizViewer.tsx` | Apache-2.0 |
| `src/components/features/latihan/latihan-index.tsx` | DeepTutor `web/components/quiz/QuizConfigPanel.tsx` | Apache-2.0 |

Upstream: <https://github.com/HKUDS/DeepTutor>
Local checkout used: commit `a5eafa89072f6d7290a6854a6afc4ba060053beb` (v1.6.8).

### DeepTutor's licence obligations

Apache-2.0 requires that recipients of a copy or substantial portion get the
licence and a NOTICE of any upstream attributions. For every file above the
header carries:

```
Adapted from DeepTutor (HKUDS), v1.6.8. Apache License 2.0.
Source: <upstream path>
Source: https://github.com/HKUDS/DeepTutor
Source commit: <sha>
Original license: Apache License 2.0
Modified for Careevo: <what diverged>
```

Keep the `Adapted from` line, the upstream paths, the commit, and the
`Modified for` note. The note matters most: it is what stops a reader
diffing against upstream from mistaking a deliberate divergence for a bug.

Apache-2.0 also requires a **modified-files notice** when you distribute
derivatives. If the ported surface grows further, add a `NOTICE` file listing
these files alongside the DeepTutor licence text. The repo has no `NOTICE` yet;
it has not been distributed as a derivative.

## The rule

**Every file containing adapted code carries the notice in its header.** The
existing files show the exact form. For career-ops (MIT):

```ts
/**
 * trust.ts — URL/domain trust validation for job postings.
 *
 * Adapted from career-ops (MIT), © 2026 Santiago Fernández de Valderrama.
 * Source: providers/_trust-validator.mjs + lib/ascii-fold.mjs
 * https://github.com/career-ops-hq/career-ops
 */
```

For DeepTutor (Apache-2.0), the form shown in the table above: `Adapted from`,
`Source:` path(s), repository URL, `Source commit`, `Original license`, and
`Modified for Careevo`.

Keep the `Adapted from` line, the upstream URL, and the specific upstream
file(s) so a reader can diff against them.

## What MIT permits, and what it does not

MIT is permissive: use, copy, modify, merge, publish, distribute, sublicense,
and sell. The one condition is that the copyright notice and permission notice
appear in all copies or substantial portions.

MIT covers the **code**. It does **not** grant the name or brand. career-ops'
`TRADEMARK.md` is explicit: the code is free, the "career-ops" name is reserved
for the project and its maintainers.

Therefore, in Careevo:

- **Do** reuse and adapt the code, with the header notice.
- **Do** say "adapted from career-ops" or "based on career-ops" if describing lineage.
- **Do not** brand anything as "career-ops", or imply endorsement by that project.
- **Do not** reuse its logos or visual identity.

## Adding a new port

1. Put the notice in the new file's header, naming the upstream file(s).
2. Add a row to the table in this skill.
3. If the port is substantial, consider a top-level `NOTICE` file listing every
   adapted file — the repo does not have one yet, and adding it is the safest
   option if the ported surface grows.
4. Note any behavioural changes you made, especially deliberate divergences.
   `src/lib/jobs/trust.ts` adds Indonesian boards (Glints, Jobstreet, Kalibrr) to
   the ATS allowlist, which upstream does not have — a reader diffing the two
   should not mistake that for a mistake.

## Third-party data

Separate from licensing: the Indonesian job-board providers in career-ops scrape
Glints and Jobstreet through undocumented endpoints. Careevo has **not** adopted
those (the live feed is deferred). If it ever does, the endpoints' own terms of
service become Careevo's problem, and that is a decision to make deliberately
rather than by copying a file.

## When unsure

Prefer attribution. Adding a correct notice costs one comment block; omitting a
required one is a licence violation. If a port's provenance is unclear, say so
in the header rather than leaving it silent.
