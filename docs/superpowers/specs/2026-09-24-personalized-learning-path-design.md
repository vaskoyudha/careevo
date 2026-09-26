# Personalized Learning Path — Design Specification

**Status:** Approved MVP boundary for planning
**Date:** 2026-09-24
**Scope:** Careevo learner experience; conceptual reference from DeepTutor, not a runtime port

## 1. Decision

Build the first personalized-learning slice as a chat-driven study loop with a deterministic fallback:

```text
signed-in learner
  → study chat with the learning tutor
  → diagnostic questions and learner context
  → validated path proposal
  → learner approval
  → active learning path
  → existing course/challenge flow
```

The chat UI is adapted from the actual DeepTutor chat/composer UI, then filtered to study-only behavior. The deterministic profile/enrollment path remains the fallback and the source of current progress.

The first slice will not add RAG/document ingestion, books, immersive reading, router administration, streaming infrastructure, or a database. It may use the existing optional `@google/genai` integration for a constrained, on-demand path proposal. A generated path is a proposal until validated and explicitly approved; free-form chat never mutates mastery state.

DeepTutor is used as an architectural/UI reference only. The reviewed reference is `HKUDS/DeepTutor` at commit `a053fecf6eeca51ded680de8b8fc41ef63857b11` (v1.6.11). No DeepTutor code, assets, or runtime is copied into Careevo.

## 2. Goals

1. Give a completed-onboarding learner one obvious personalized destination from the existing learner navbar.
2. Derive a deterministic next step from the learner’s onboarding profile and current course enrollment.
3. Reuse Careevo’s existing course, enrollment, challenge, and learner-shell seams.
4. Make the current action and current progress understandable without a live tutor.
5. Establish a clean seam for later evidence, persistence, or AI-assisted study features.

## 3. Non-goals

The MVP does **not** include:

- RAG, embeddings, vector stores, document ingestion, or source retrieval.
- Books, notebooks, PDF/Markdown/Word readers, or immersive reading.
- A new chat runtime, MCP tool loop, DeepTutor WebSocket protocol, or model router.
- A new database or cross-device persistence layer.
- Numeric knowledge-mastery claims, spaced-repetition scheduling, or attestation changes.
- A new navbar/sidebar design system.
- Public anonymous access to personalized data.
- Replacing the existing `/belajar` catalog or course pages.

## 4. Existing Careevo seams

| Concern | Existing module | Reuse decision |
|---|---|---|
| Auth and onboarding gate | `src/app/(app)/layout.tsx`, `getSession()`, `hasProfile()` | Put the route under `(app)` so existing session/profile redirects remain authoritative. Re-check the session in the page, matching existing learner pages. |
| Learner shell | `src/components/ui/learner-shell.tsx`, `src/components/ui/learner-chrome.tsx` | Render the new page with `LearnerShell`; add one item to the learner navbar only. Do not use `AppShell`. |
| Personalization input | `OnboardingProfile`, `getProfile(owner)`, `rekomendasiKursus()` | Use the signed, owner-scoped onboarding profile and existing deterministic course scoring. |
| Enrollment/progress | `src/lib/courses/enrollment.ts`, `listPendaftaran()`, `cariPendaftaran()` | Reuse the signed enrollment data, but add owner scoping before exposing it as personalized progress. |
| Curriculum | `src/lib/courses/kurikulum.ts`, `modulKursus()` | Derive the ordered module list from the existing deterministic curriculum. Do not duplicate module IDs. |
| Existing learning loop | `/belajar`, `/belajar/[slug]`, `/challenge/[id]` | The path’s next action links into these routes instead of creating a second lesson system. |
| Agents | `jalankanNavigator()`, `jalankanSocrates()`, `runAgent()` | Do not use these for MVP progression. The first two are fixture/deterministic fallbacks and the orchestrator is currently a stub. |
| Verification | `npm run check`, smoke script, onboarding e2e | Extend route coverage and unit tests; do not add browser-test infrastructure solely for this slice. |

## 5. Domain module and interface

Create one deep domain module at:

```text
src/lib/learning/personalized-path.ts
```

The module must expose a small pure interface. The page supplies plain data; the module does not read cookies, call the database, import React, or call an LLM.

### Input

```ts
type PersonalizedPathInput = {
  profile: OnboardingProfile;
  catalog: EntriKatalog[];
  enrollments: Pendaftaran[];
};
```

### Output

```ts
type PersonalizedPath = {
  course: EntriKatalog | null;
  source: "active-enrollment" | "recommendation" | "empty";
  modules: PathModule[];
  nextAction: NextLearningAction | null;
};

type PathModule = {
  id: string;
  title: string;
  status: "completed" | "current" | "upcoming";
  href: string;
};

type NextLearningAction = {
  kind: "continue-course" | "start-course" | "explore-courses";
  label: string;
  href: string;
  moduleId?: string;
};
```

### Selection rules

1. Read only enrollments whose normalized `owner` matches the authenticated account.
2. If at least one owned enrollment references a catalog course, choose the most recently enrolled valid course (`enrolled_at` descending, then `course_id` ascending).
3. Otherwise, use the first result from `rekomendasiKursus(catalog, profile)`.
4. Build modules with `modulKursus(course)`.
5. Mark module IDs present in the selected account-owned enrollment as `completed`.
6. Mark the first incomplete module as `current`; all later modules are `upcoming`.
7. If all modules are completed, set `nextAction` to `null` and let the UI show a completed state with a link to the course.
8. If there is no course, return an explicit empty path and an `explore-courses` action.
9. Break recommendation ties deterministically by catalog order and stable IDs. Never use global fixture task completion as learner evidence.

The interface is the test surface. Callers should not need to know how recommendation, enrollment lookup, or module derivation works.

## 6. Enrollment ownership prerequisite

`src/lib/courses/enrollment.ts` currently stores a browser cookie containing course IDs and completed module IDs, but the enrollment record does not carry the account owner. A personalized page must not expose another account’s enrollment on a shared browser.

Before the route is enabled:

1. Extend `Pendaftaran` with an optional `owner` field so old signed cookies can still be decoded without being attributed to a new account.
2. Write a normalized owner in `daftarKursusAction` and `tandaiModulAction`.
3. Change `listPendaftaran(owner)` and `cariPendaftaran(courseId, owner)` to require an owner for personalized reads; update every existing caller to pass the authenticated session email.
4. Treat legacy entries without an owner as unowned and ignore them everywhere that would expose personalized progress. Users may re-enroll; the MVP does not migrate unattributed progress.
5. Preserve existing course-enrollment behavior for records already carrying the current owner.
6. Add tests for owner isolation, legacy entries, and cross-account reads.

This is a privacy/correctness prerequisite, not a general enrollment refactor.

## 7. Route and navigation

### New route

```text
src/app/(app)/belajar/jalur/page.tsx
```

The page will:

1. Read the session and return `null` if absent, matching existing learner page defensive checks.
2. Read the owner-scoped onboarding profile.
3. Load the catalog and owner-scoped enrollments.
4. Call the pure module’s `bangunJalurPersonalisasi(...)` function.
5. Render `LearnerShell` and the path overview.

The `(app)` layout remains responsible for redirecting missing sessions and incomplete learner profiles. The page must not create a second authentication mechanism.

### Navbar

Add one learner-only item to `LearnerChrome`:

- Label: `Jalur Belajar`
- Route: `/belajar/jalur`
- Icon: reuse an existing outline icon; do not add an icon dependency

Do not add the item to the public `Chrome` navbar in the MVP. Anonymous users should not be sent to a personalized route that immediately redirects through auth/onboarding. Preserve the existing `.chrome` scroll threshold, transition, and two-navbar contract.

### Optional path detail

Do not add a second page in the MVP. The overview links to existing course/challenge routes. A dedicated objective detail page is a later slice after the domain model and evidence rules are validated.

## 8. UI contract

The first page is an attention-oriented overview, not a course catalog. It should contain:

- A page heading that names the learner’s current path.
- A short explanation of why the course was selected, using onboarding interests/goal.
- Current course title and progress from owner-scoped enrollment.
- One prominent next action.
- An ordered module list with `completed`, `current`, and `upcoming` states.
- A secondary link back to `/belajar` when no active course exists.
- Indonesian user-facing copy, existing Tailwind v4 tokens, and existing learner-shell spacing.

Do not label completion percentage as mastery. Use language such as `Progres belajar` and `Langkah berikutnya`.

## 9. Data flow and failure behavior

```text
LearnerChrome
  → /belajar/jalur
  → getSession()
  → getProfile(session.email)
  → katalogBelajar()
  → listPendaftaran(session.email)
  → personalized-path.ts (pure policy)
  → LearnerShell + PathOverview
  → /belajar/[slug] or /challenge/[id]
```

Failure rules:

- Missing session: existing `(app)` layout redirect to `/masuk`.
- Missing/invalid onboarding profile: existing layout redirect to `/onboarding`.
- Empty catalog: render an explicit empty state with a catalog CTA.
- No owner-owned enrollment: show the top profile-based recommendation and a start CTA.
- Legacy/unowned enrollment: ignore it; never display it as personalized progress.
- Missing course referenced by an enrollment: skip that entry and continue deterministically.
- Cookie decode/write failure: preserve the current page behavior; do not fabricate progress.

No network call is allowed in the MVP request path. No LLM failure mode is required because no LLM is invoked.

## 10. Testing and acceptance

### Domain tests

Create `src/lib/learning/personalized-path.test.ts` covering:

- active enrollment takes priority over a recommendation;
- profile recommendation is used when no active enrollment exists;
- completed module IDs produce `completed`, the first incomplete module is `current`, and later modules are `upcoming`;
- empty catalog returns an explicit empty path;
- invalid/legacy enrollment records are ignored;
- recommendation ties are deterministic;
- global task fixture statuses cannot change a learner path.

### Enrollment tests

Extend the existing enrollment tests for:

- owner written on enrollment and module completion;
- owner filtering on reads;
- legacy records without owner;
- cross-account isolation.

### Route and UI acceptance

- `npm run check` exits 0.
- `npm run build` exits 0.
- `npm run dev` followed by `npm run smoke -- http://localhost:3000` includes `/belajar/jalur` and exits 0.
- `npm run e2e:onboarding -- http://localhost:3000` still passes.
- An unauthenticated request to `/belajar/jalur` redirects to `/masuk`.
- A learner without completed onboarding redirects to `/onboarding`.
- A learner with a valid profile and no enrollment sees the recommended course and a working start CTA.
- A learner with owner-owned enrollment sees the correct current module and progress.
- The learner navbar shows `Jalur Belajar` and marks it active on `/belajar/jalur`.
- At 320px width, the new link remains accessible without horizontal overflow.
- Browser console has no new errors.

## 11. Dependency order

1. Owner-scope enrollment records and add isolation tests.
2. Add the pure personalized-path module and unit tests.
3. Add `/belajar/jalur` using `LearnerShell`.
4. Add the learner navbar entry.
5. Add route/smoke coverage and run the acceptance commands.
6. Stop. Do not add live AI, evidence scoring, RAG, books, or immersive reading in this slice.

## 12. Provenance and safety

DeepTutor is an architectural reference, not copied source. If later implementation copies or adapts code, preserve the upstream license and attribution requirements and pin the reviewed commit. The current MVP should contain only Careevo-native TypeScript, existing fixtures, and the existing learner shell.
