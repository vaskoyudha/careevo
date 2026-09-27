---
name: loker-persiapan
description: >-
  The Careevo "persiapan lowongan" surface — the course recommendations and
  job-sourced mastery path on the loker detail page. Use when editing
  src/lib/jobs/rekomendasi-kursus.ts, src/lib/agents/kursus-loker/,
  src/lib/agents/jalur-loker/, src/actions/loker-persiapan.ts, the
  rekomendasi-kursus-panel / jalur-loker-panel components, or
  MasteryTopic.jobId / the "Buka lowongan" link in the mastery topic view; when
  a recommendation is missing, wrong, or suspicious; or when deciding how a
  failure should look without a model.
license: MIT
metadata:
  owner: careevo
  area: jobs
---

# Loker preparation — courses + mastery path

The detail page (`/loker/[id]`) has two cards under the assessment grid:
**Kursus yang cocok** and **Jalur penguasaan**. The grid above judges the
posting (Sentinel + A–H); these two build toward it. They are one feature, not
two, because they share one argument: the posting is the source of truth, and
the two failure policies are deliberately asymmetric.

## Shape

```
rekomendasiKursusLokerAction (server action)   ← auth-checked, on demand
  ├─ ambilLokerById        ← refuses rejected postings (404)
  ├─ katalogBelajar()      ← published courses + fixture resources
  ├─ rekomendasiKursusUntukLoker  ← DETERMINISTIC shortlist (no model)
  └─ jelaskanKursus (LLM)  ← decorates the shortlist, never re-picks it
       └─ validasiAlasanKursus ← drops any id NOT in the shortlist

buatJalurLokerAction (server action)           ← auth-checked, a WRITE
  ├─ listMasteryTopics    ← duplicate guard: one active topic per job per user
  ├─ susunJalurLoker (LLM) ← extracts 3–12 points from the description
  └─ createMasteryTopic   ← persists with jobId; point ids from job id + index
```

Files:

| File | Role |
|---|---|
| `src/lib/jobs/rekomendasi-kursus.ts` | `skorKursusUntukLoker`, `rekomendasiKursusUntukLoker` |
| `src/lib/agents/kursus-loker/{skema,prompt,alasan}.ts` | why each course fits |
| `src/lib/agents/jalur-loker/{skema,prompt,jalur}.ts` | the mastery path |
| `src/lib/llm/gagal.ts` | shared failure classification (also used by A–H) |
| `src/actions/loker-persiapan.ts` | both server actions |
| `src/components/features/jobs/{rekomendasi-kursus,jalur-loker}-panel.tsx` | the UI |
| `src/lib/mastery/{types,store}.ts` + `mastery-topic-view.tsx` | `jobId` source + "Buka lowongan" |

## The hybrid: deterministic pick, LLM explains

The shortlist is chosen by `rekomendasiKursusUntukLoker`, **not by the model**.
The model is only allowed to *decorate* the already-decided picks. Two rules make
that real, and both have tests:

1. **Level and free are tiebreakers, never relevance.** The first RED test caught
   it: a Godot course was passing the relevance floor on level + free alone while
   sharing zero tags with the posting. A course with no content overlap scores 0.
   Do not "soften" that — it is how the list stays about the job.
2. **The model cannot add courses.** `validasiAlasanKursus` checks every id
   against the shortlist; an invented id is dropped, not rendered. The prompt says
   "jangan memilih kursus lain" because a model asked to "recommend" will happily
   return something the ranker never picked.

## Failure policy — the asymmetry is the point

With no model:

- **The course list still renders.** The picks are deterministic and already
  correct; only the reason lines go missing. `jelaskanKursus` skips the call
  entirely for an empty shortlist, and a non-model failure returns the shortlist
  without reasons. Showing an error banner here would imply the recommendation
  broke when it did not.
- **There is no mastery path.** Its points must be read from the description, so
  no model = no path. The panel shows the typed message; a guessed tree would
  look like a considered plan and is worse than a blank. This mirrors the A–H
  panel's "no score, never a fake one".

A well-formed object carrying **no usable reason** is success with zero reasons
(not `hasil_tidak_valid`) — the shortlist stands exactly as it does with no
model. The mastery-path schema is deliberately the opposite: an empty points
array IS a real failure, because there the points are the artifact.

## Learner copy must never contain the provider's body

This feature found, in a real browser run, a bug that predates it: the shared
gateway answered 503 wrapping a nested `429 quota reached`, and `klasifikasiGagal`
passed that body through as `pesan` — ~200 characters of escaped JSON rendered at
a job seeker. The fix (`src/lib/llm/gagal.ts`) is the one place this is decided:

- `pesan` is written per `JenisGagal` and never assembled from `hasil.message`.
- `hasil.message` rides along as `detail`, which the action carries but the panel
  never renders.
- The detail rule is an **exclusion** list (`missing_api_key` adds nothing), not
  an allow-list, so a future port reason cannot silently lose its diagnostic.

Do not reintroduce `hasil.message` into a rendered string. If a new agent needs a
failure, use `klasifikasiGagal` and render `pesan` only. The A–H panel inherits
the same fix, so `gagal.ts` is shared and must stay shared — two copies are the
drift it was extracted to prevent.

## Point ids are never model-derived

`pointIdLoker(jobId, index)` → `loker-<id>::kp<n>`. Regenerating a path keeps a
point's attempt history because the id comes from the job id and the index, not
from model output. The course path does the same (`moduleId::kp<n>`). Keep both.

## One active topic per job per user

`MasteryTopic.jobId` is optional and only set for job-sourced topics. The action
guards before creating: `listMasteryTopics` → an active topic with the same
`jobId` returns that topic instead of creating a duplicate. Course-derived topics
have no `jobId` and render "Buka kursus"; job-sourced ones render "Buka
lowongan" (`mastery-topic-view.tsx`).

## The panels differ on purpose

Courses are a read: button + `useTransition`, mirroring `EvaluasiPanel`. The
mastery path is a write: a real `<form action>` + `useActionState`, which works
without JavaScript. The course summary reuses `ringkasEntri` from the dashboard
jelajah (`provider · menit · level`) rather than restating it, so the catalog
line cannot drift. Both re-check the session — a server action is a public
endpoint, and the `(app)` layout is not a gate.

## Verifying

```bash
npm run check      # typecheck + lint + skills:check + test
```

Unit tests: `rekomendasi-kursus.test.ts` (scoring + shortlist),
`kursus-loker/alasan.test.ts` (shortlist guard, no-reason = success, 429),
`jalur-loker/{skema,jalur}.test.ts` (3–12 range, unknown type rejects, fenced
JSON, no-model, 429), `src/actions/loker-persiapan.test.ts` (auth, unknown job,
rejected posting, duplicate topic, blank jobId).

**What unit tests cannot show:** the live LLM path. The whole surface was
browser-verified against a real chromium and the production build: both cards
render, 3 courses recommend with real meta, no page errors, and the failure path
under a live 503 shows the typed message. The *success* path (course reasons,
the 3–12 point path, the back-link, duplicate reuse) has only ever been exercised
against a stubbed gateway — the shared quota was exhausted at verification time.
Say "not verified live" until a real model run happens; do not claim otherwise.
