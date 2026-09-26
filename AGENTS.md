# AGENTS.md

Careevo is a Next.js prototype ("Learn. Verify. Earn."): a learning-to-job bridge with HMAC attestations, fixture-backed audit data, and a Socrates review agent. Core fixture data is loaded through `src/lib/fixtures.ts`. Auth and onboarding use cookie state; courses, their modules, and their materials are persisted to `data/courses.json` on disk (see `src/lib/courses/storage.ts`), with uploads under `public/uploads/`. The editable public profile uses a signed cookie, and the LinkedIn-style resume (work/projects/education/skills/CV uploads) uses a small file-based store under `.data/` (see below). Gemini evaluation is an optional, on-demand network call.

## Commands

- `npm run dev` starts the Next 16 dev server; `next dev` uses Turbopack by default.
- `npm run build` / `npm start` build and serve production output.
- `npm run lint` runs ESLint with flat config; `next lint` is not used.
- `npm run typecheck` runs `tsc --noEmit`, a faster standalone check than a full `build`.
- `npm test` runs `vitest run` once. `npm run test:watch` starts watch mode.
- `npm run check` is the manual gate, in this order: typecheck -> lint -> skills:check -> test. It does not run `build`, `smoke`, or `e2e:onboarding`.
- `npm run skills:check` validates `.agents/skills/` against the Agent Skills spec.
- `npx vitest run src/lib/scoring/scoring.test.ts` runs one test file.
- `npx vitest run -t "A1:"` runs one test by name.
- `npm run smoke -- [baseUrl]` runs the HTTP smoke check and requires a running server. Its route count is derived from the `routes` array; the source comment is stale, so do not hardcode a count here.
- `npm run e2e:onboarding -- [baseUrl]` runs the signed-cookie onboarding gate check and requires a running server.

Deps use npm with `package-lock.json` v3. The root `package.json` has no `packageManager` or `engines` pin. The current Vitest 5.0.1 requires Node `^22.12.0 || ^24.0.0 || >=26.0.0`; Next declares Node `>=20.9.0`. For a clean checkout, run `npm ci` (`node_modules` is not checked in).

There is no repository-managed CI workflow or pre-commit hook. Treat `npm run check` as a manual gate.

## Skills

`.agents/skills/` holds Agent Skills (`SKILL.md`, [agentskills.io](https://agentskills.io/specification)) that encode this repo's non-obvious knowledge. Read the relevant one before working in its area:

- **`loker-sentinel`** — the job-board audit: verdict policy, the `flags` vs `fee_flags` contract, why verdicts are derived not stored. Read before touching `src/lib/jobs/` or the loker pages.
- **`loker-evaluasi`** — the A–H LLM evaluation: scoring model, why output is schema-constrained, the failure policy, key handling. Read before touching `src/lib/agents/evaluasi/` or the evaluation panel.
- **`careevo-review`** — self-review checklist built from real defects that shipped here. Read before committing.
- **`careevo-browser-verify`** — how to prove a user-visible feature works by driving it in a real browser: the dev-server/local-model runbook, the four measurement probes (geometry, focus order, focusability, network counts), and the defect classes only a browser finds. Read before claiming any page, flow or UI fix is done — `npm run check` was fully green while the tutor's mobile layout dropped 36px of every answer and rename silently did nothing. Pairs with `careevo-review`, which is the static pass.
- **`careevo-attribution`** — MIT notice requirements for code ported from career-ops. Read before adding adapted code.
- **`career-ops-port`** — what was adopted from career-ops, what was rejected and why. Read before proposing further integration.
- **`career-ops-engine`** — driving the vendored `engine/`: the exit-2-is-success rule, which of `pipeline.md` / `scan-history.tsv` / `scan-runs.tsv` answers which question, why the receipt cannot explain a zero, and the append race that duplicates postings into duplicate React keys. Read before running or debugging a scan, or before changing what the inbox reads.

`docs/career-ops-architecture-study.md` is historical. The current port decision source is the `career-ops-port` skill.

A skill with invalid frontmatter fails silently, so `npm run skills:check` is the validator. `scripts/validate-skills.mjs` imports `js-yaml`, which is a direct dependency in `package.json`.

## Testing quirks

- Vitest `include` is exactly `src/**/*.test.ts`; `.test.tsx` and browser tests are not included.
- Test environment is `node`, with no jsdom or browser test runner — tests cover pure logic only (e.g. `src/lib/scoring`, `src/lib/attestation`, `src/lib/resume`, `src/app/smoke.test.ts`).
- The file-based resume store's test points `CAREERS_DATA_DIR` at a temp dir **before** importing the module, so it never touches the repo's real `.data/`.
- `@/` alias maps to `src/` in both `tsconfig.json` and `vitest.config.mts`; keep them in sync.

## Architecture

- App Router uses route groups in `src/app/`: `(marketing)` (`/`, `/careevo-plus`), `(public)` (for example `/masuk`, `/kerja`, `/loker`, `/p/[username]`, `/verify/[token]`, and catalog routes such as `/explore/most-popular-courses` and `/specializations/[slug]`; plus `p/[username]/berkas/[slot]` for public CV/portfolio PDFs), `(onboarding)` (`/onboarding`, `/onboarding/demo`), plus learner `(app)`, focus `(focus)`, and staff `(verifikator)` pages.
- **Auth gating lives in the group layouts**, not middleware (there is no `middleware.ts`): `(app)` redirects missing sessions to `/masuk` and learner sessions without a completed profile to `/onboarding`; `(focus)` checks the session and completed profile, redirecting missing profiles to `/onboarding`; `(verifikator)` checks the session and `isStaffRole()`. Individual pages re-check `getSession()` and `return null` if absent.
- Auth is **cookie-only**: HMAC-signed session cookie `ls_session` (`src/lib/auth/session.ts`) and registered users in an HMAC-signed `ls_users` cookie capped at 20 (`src/lib/auth/user-store.ts`). Passwords are salted SHA-256, not bcrypt.
- Env: `SESSION_SECRET` and `ATTESTATION_SECRET` are optional and fall back to dev defaults, so the app runs with no `.env`. Model access is optional and configured through the LLM port: `CAREERVO_LLM_BASE_URL` + `CAREERVO_LLM_MODEL` (+ optional `CAREERVO_LLM_API_KEY`) for any OpenAI-compatible endpoint, or `GEMINI_API_KEY` for Gemini; with neither, generated text falls back to deterministic stubs. `.env*` is gitignored.
- `src/actions/*.ts` are `"use server"` server actions: `auth.ts`, `review.ts`, `onboarding.ts`, `profile.ts`, `enrollment.ts`, `courses.ts`, `evaluasi.ts`, and `resume.ts`.
- Domain/business logic lives in `src/lib/{scoring,agents,attestation,audit,jobs,validation,courses,onboarding,profile,resume}`; UI in `src/components` (shadcn/ui under `src/components/ui`, feature components under `src/components/features`).
- **Persistence patterns, deliberately different — do not "unify" them:**
  - **Signed cookies** (`src/lib/auth`, `src/lib/onboarding`, `src/lib/profile`) — small, tamper-evident JSON; `next/headers` is mocked in tests. The editable public profile (`src/lib/profile`) fits here because it is only a name, a bio and two downscaled images.
  - **`data/courses.json`** (`src/lib/courses/storage.ts`) — courses/modules/materials (and formatted prose pages), written to disk with uploads under `public/uploads/`. See the curriculum section below.
  - **File-based resume store** (`src/lib/resume`) — the LinkedIn-style resume (work/projects/education/skills/certifications, about + contact, and uploaded CV/portfolio PDFs). Unbounded in size, so it is written under `.data/` (gitignored) as JSON + files, **not** a cookie: a payload that big would silently exceed the ~4KB cookie limit and lose data with no error. Owner dirs are keyed by `sha256(email)` so a username can never traverse the tree; file names are `path.basename`-checked. Writes to `process.cwd()` fail on a read-only serverless FS — set `CAREERS_DATA_DIR` to a writable path there. Uploaded files are served publicly via `GET /p/[username]/berkas/[slot]` (product decision: a candidate shares their CV), and validated server-side (MIME + `%PDF-` magic bytes + 5MB cap) in `validasiBerkas`.
  - **File-based tutor sessions** (`src/lib/tutor/session-store.ts`) — the
    DeepTutor-style workspace at `/belajar/tutor`. The inline `StudyChat` card
    on `/belajar/jalur` still uses the signed `ls_study_chat` cookie (capped
    at 6 messages / 1800 chars, which is all a single card needs), but a
    sidebar of conversations is unbounded, so sessions live under
    `.data/tutor/<sha256(email)>/<sessionId>.json` and share the resume
    store's `CAREERS_DATA_DIR` override and write-to-temp-then-rename rule.
    Session ids come from the URL and are therefore untrusted: they are
    validated against `SESSION_ID_PATTERN` *and* re-checked with
    `path.basename`, and a file whose `owner` disagrees with its directory is
    ignored. A well-formed id owned by someone else is a **404**, never a
    leak that the id exists.
  - **File-based mastery topics** (`src/lib/mastery/store.ts`) — the same
    pattern under `.data/mastery/<sha256(email)>/<topicId>.json`, holding a
    topic's knowledge points, attempt history and review states. The
    *pedagogy* is ported verbatim from DeepTutor and is the part worth not
    touching: `hitungPenguasaan` is a recency-weighted score with a
    confidence cap (one correct answer can never reach 1.0), and
    `INTERVAL_SEQUENCES` fixes the review spacing per knowledge type. Two
    correct answers in a row skip an interval (0 → 1 → 3). Both are pure and
    covered by `src/lib/mastery/scoring.test.ts`, whose expected values were
    taken from DeepTutor's own Python — change them only with a reason.
  - **File-based books** (`src/lib/book/store.ts`) — one JSON file per book
    under `.data/book/<sha256(email)>/<bookId>.json` holding the book, its
    spine and all its pages together, so a page can never be written without
    the spine that lists it. Content is a discriminated union of 11 block
    types rendered as React children; there is **no** `dangerouslySetInnerHTML`
    in a book, and a block that fails `isBlock` is dropped rather than
    rendered half-formed.
  - **File-based practice quizzes** (`src/lib/latihan/store.ts`) — one JSON
    file per latihan under `.data/latihan/<sha256(email)>/<latihanId>.json`,
    holding the question set and its attempts together, under the same
    write-chain and owner-mismatch rules as the stores above. This is
    deliberately **not** the course quiz bank (`src/lib/courses/kuis.ts`):
    that one grades in the browser and stores nothing, and this one is the
    DeepTutor notebook port, so it has to keep a history. Six question types
    (`choice`, `concept`, `fill_in_blank`, `short_answer`, `written`, `coding`)
    come from `src/lib/latihan/tipe-soal.ts`; only the first three are graded
    deterministically (`nilaiOtomatis`), and the rest stay `null` — *unjudged*,
    never counted as wrong — until self-graded or judged. The six-type contract
    is shared between the generator and the renderer, so it is a single module
    and one guard (`normalisasiSoal`) on both sides.

## Navigation — navbar contract (do not regress)

- There are exactly two navbars, both built on the same morph mechanism in
  `src/app/globals.css` (`.chrome` sticky; `.is-top` = transparent full-width
  bar; `.is-scrolled` = floating glass pill; flips at `scrollY > 24` with a
  320ms transition). Any new navbar MUST reuse these classes and the same
  scroll threshold — never invent a third navbar style.
- `Chrome` (`src/components/ui/chrome.tsx`) = public/marketing navbar
  (Masuk/Daftar actions). Used by `(marketing)` and `(public)` layouts.
- `LearnerChrome` (`src/components/ui/learner-chrome.tsx`) = logged-in
  learner navbar with the SAME structure/behavior: brand, `ExploreMenu` mega
  dropdown, icon+label nav items (Belajar/Loker/Plus), navbar search, avatar
  account menu. Used via `LearnerShell` (`src/components/ui/learner-shell.tsx`).
- **Learner pages (`/belajar`, `/belajar/[slug]`, `/belajar/jalur`) use
  `LearnerShell` (top bar), NEVER `AppShell` (sidebar).** `AppShell` is
  reserved for dashboard-style pages (dashboard, admin, review, audit,
  challenge, submission, loker detail).
- **Exception: `/belajar/tutor` is a focus-mode workspace, not a learner
  catalog page.** It lives in `(focus)` and renders its own `h-dvh` 3-pane
  shell (`src/components/features/tutor/tutor-shell.tsx`) with a left icon
  rail, a 960px chat column, and a right Activity drawer — a port of
  DeepTutor's chat workspace, not an `AppShell` and not a `LearnerShell`. It
  therefore has no `Chrome`/`LearnerChrome` navbar at all. Do not "fix" this
  by wrapping it in `LearnerShell`; the transcript owns its own scrolling and
  a page-level navbar would break the pinned composer.
- **Same exception for `/belajar/mastery`, `/belajar/buku` and
  `/belajar/latihan`** — also `(focus)`, also navbar-less, for the same reason
  (they are workspaces, not catalog pages). All four are reachable from the
  hand-off buttons on `/belajar/jalur`.
- **The LLM is behind a port** (`src/lib/llm/port.ts`). `getLlm()` resolves, per
  call (so adding a key needs no restart), in this order:
  1. an **OpenAI-compatible endpoint** when `CAREERVO_LLM_BASE_URL` *and*
     `CAREERVO_LLM_MODEL` are set (optional `CAREERVO_LLM_API_KEY`) — this is
     what points the app at a local 9Router/vLLM/Ollama;
  2. the real **Gemini** client when `GEMINI_API_KEY` is set;
  3. a deterministic **stub** otherwise.
  The compat endpoint wins over a Gemini key on purpose: both set is a
  configuration mistake, and a written-down base URL is the more specific
  intent. `hasLlm()` is true when *either* real route is reachable;
  `hasLlmKey()` keeps its narrower Gemini-only meaning. Features must stay
  usable with no key: mastery, books, practice quizzes and the tutor's whole
  shell all work, and only generated *text* degrades. **Never branch on
  `process.env.GEMINI_API_KEY` outside this port** — doing so is what once left
  the tutor chat dead while the quiz generator, which did use the port, worked.
- **The tutor chat goes through the port too** (`src/lib/agents/study-chat/model.ts`).
  Careevo's reply shape (`{ message, followUpQuestion, pathProposal }`, validated
  in `study-chat/schema.ts`) is **our own design, not a DeepTutor port**:
  upstream chat has no structured reply at all — a turn streams plain Markdown
  from an agent loop, and nothing parses the answer into fields. What *is*
  borrowed from upstream is its one-provider rule: every LLM call resolves a
  single provider from a single configuration
  (`deeptutor/services/llm/provider_factory.py`), so chat, quizzes and books all
  reach the same model by the same route. `getLlm()` is the Careevo equivalent.
  With no provider `model.ts` returns a deterministic *demo reply* in the
  study-reply shape (rather than `StubLlm` prose, which cannot satisfy the
  schema), and it says plainly that it is a demo.
- **Model JSON is parsed tolerantly** (`src/lib/llm/json.ts`) — a fenced
  ```json block or a reply with trailing prose is still a correct answer, so
  neither may read as a provider fault. Shared by the quiz and the tutor.
- Consequences: page tops under a transparent bar must be LIGHT (dark text
  stays readable); the learner navbar search is visible only in `.is-top`
  mode and hidden in pill mode (`.chrome.is-scrolled .learner-search`);
  search submits GET to `/belajar?q=`, and `BelajarPage` feeds it back as
  `queryAwal` (sliced to 120 chars).

## Stubs — do not assume these work

Several modules intentionally throw `"... belum diimplementasikan"` and are unimplemented placeholders: `logAudit` (`src/lib/audit/logger.ts`) and `runAgent`/`toAgentRun` (`src/lib/agents/orchestrator.ts`). The audit log and agent-run persistence are not wired up; pages read from fixtures instead.

## Course curriculum — stored vs derived

Module lists come in two flavours and the distinction is load-bearing:

- **Derived** — `modulKursus()` (`src/lib/courses/kurikulum.ts`) always generates exactly 5 modules with positional ids (`${courseId}-m1`…`-m5`). This is what every course and fixture resource uses until an admin edits its curriculum. Those ids are the ones stored in real users' `ls_enroll` progress cookies.
- **Stored** — `Course.modul` holds `Modul[]`, each with its own `materi` array (`Materi` is a discriminated union over `video | pdf`), `halaman` array, and `kuis` id list. Editing a course's curriculum in `/admin/courses/[id]` switches that course to stored modules with new ids; old progress is then dropped safely by `irisModulSelesai()`.

`src/lib/courses/modul-resolver.ts` is the single resolver (`modulUntuk` / `modulUntukSumber`): stored wins, otherwise derived. **Never call `modulKursus()` directly from a page or action** — divergence between the four call sites was the bug this split fixes, and `enrollment.test.ts` pins the derived ids to catch regressions.

**One recorded exception: `src/lib/learning/path-context.ts`.** It calls `modulKursus()` and must keep doing so. The `currentModuleId` it looks up is produced by `bangunJalurPersonalisasi`, which calls `modulKursus()` too (`personalized-path.ts`), so both sides speak the derived `<courseId>-m1`..`-m5` ids. Resolving through `modulUntukSumber` there would answer with *stored* ids for an admin-edited course, miss, and hand the tutor a `null` module — a new divergence, which is the exact class of bug the resolver split exists to prevent. It is also the reason the two tutor actions share this one module instead of each carrying a copy: a rule spelled twice is two definitions free to drift, and the copy that drifts is the one that leaks (careevo-review rule #2). Migrating `personalized-path.ts` to the resolver is the real fix, and it is *not* a drop-in: it moves the module ids that real users' `ls_enroll` progress cookies are keyed by.

That resolver must stay server-only. `kurikulum.ts` is imported by client components (`detail-kursus.tsx`), so putting the store import (`→ storage.ts → node:fs`) there breaks the production Turbopack build with "chunking context does not support external modules". Keep `kurikulum.ts` pure.

Persistence and uploads, both worth knowing before debugging "my change vanished":

- Courses are written to `data/courses.json` (gitignored) via write-to-temp-then-rename, cached in memory per process. Quizzes live in a sibling `data/kuis.json` and are written through the **same serialized write chain**, so a mutation touching both (mounting a quiz, deleting one) keeps their order. `resetCourses()` in tests disables disk writes entirely, so unit tests never touch your dev data.
- ⚠️ That cache is **per process**. A second `next start` / script that writes the same file is invisible to an already-running server until it restarts — a newly created course can 404 on a long-running `next dev` that hydrated before it existed.
- `POST /api/unggah` writes to `public/uploads/courses/<courseId>/<subjectId>/`. Its session gate lives *inside* the handler (route handlers sit outside the gated layouts), filename extensions come from the verified MIME rather than the submitted name, and it returns a `/uploads/...` path. In `next dev` new files are served immediately; under `next start`, `public/` is snapshotted at startup.

## Halaman berformat — prosa lives here, not in materi

A module holds three collections. **halaman** (formatted prose, written by admins) and **materi** (attachments: video/PDF) are *owned* by the module; **kuis** (assessment) is *referenced* from a separate bank — see the next section. `TipeMateri` is deliberately `video | pdf`: there is **no `teks` variant** (prose has one home now) and **no `kuis` variant** (assessment does). Legacy `teks` materials in `courses.json` are promoted into pages on read by `normalisasiHalamanLama()` (`src/lib/courses/halaman.ts`); the migration is lazy, idempotent (page ids derive from material ids), and runs in `pastikanTermuat()`.

`Modul.halaman` is nested, like `materi`, so deleting a module takes its pages with it. `createModul` accepts `jumlah_halaman` and creates that many empty pages in **one** disk write; `updateModul` deliberately does *not* accept it, so editing a module's title can never silently add pages.

### Content is structured blocks, never HTML

`BlokHalaman` is a discriminated union (`paragraf | heading | daftar | kutipan | gambar`) stored as JSON. `halaman-view.tsx` maps it to React elements and `<strong>`/`<em>` — there is **no `dangerouslySetInnerHTML` anywhere**, and none should be added. This repo has no sanitizer, so rendering admin-authored HTML would turn a dormant hole into stored XSS. The editor enforces the same rule from the other side: `blok-editor.tsx` uses `contentEditable` but serialises only recognised text nodes and `b/strong`, `i/em`, and allow-listed `a[href]` — anything pasted in from elsewhere loses its markup before it can reach disk.

### Backlinks and section anchors

Anchors are **derived** from heading text (`daftarSection()` in `src/lib/courses/blok.ts`), not stored, and `petaSection()` is what the renderer uses to install the matching `id`. Duplicate headings on one page get `-2`, `-3` suffixes. Two consequences worth knowing:

- Renaming a heading changes its anchor, so an existing backlink to it dies. That is the accepted trade-off: anchors always match the visible text. Admin repair is via the picker.
- Because HTML anchors are page-local, backlinks are **page-scoped only**. The editor's link picker offers nothing but sections of the page being edited, plus external URLs. Cross-page movement is what the Sebelumnya/Berikutnya pager is for.
- `rangkumBacklink()` resolves incoming links so a heading can show "ditautkan dari". Links to anchors that don't exist on the page are ignored rather than shown — displaying them would claim something untrue.

Link shape is validated in `validation/blok.ts`: `#slug` (regex, never free text) or http/https via the shared `skemaUrlHttp`, which rejects `javascript:`.

## Kuis — asesmen is a bank, not an attachment

A module holds three independent collections: **halaman** (formatted prose), **materi** (attachments: video/PDF), and **kuis** (assessment). The first two are *owned* by the module; the third is **referenced**.

- `Kuis` lives in its own store — `data/kuis.json`, its own `storage.ts` functions, its own `store.ts` CRUD — because one quiz is routinely reused across modules and courses. Editing it in the bank takes effect everywhere it is mounted, and there is exactly one source of truth for each question.
- `Modul.kuis` is therefore an **array of ids**, not copies. Consequence you must handle: a reference can go stale.
  - `deleteKuis()` clears the reference from every module that used it, in the same operation, and returns how many modules it touched. That count is **modules, not courses** — one course can hold several modules using the same quiz.
  - `kuisUntukModul()` ignores ids missing from the bank rather than yielding an empty entry. Displaying a dangling reference would promise an assessment that cannot be taken.
  - Deleting a *module* does not delete its quizzes — they are not owned by it.
- `TipeMateri` is deliberately `video | pdf` — there is **no `kuis` variant**. Legacy `kuis` materials in `courses.json` are promoted into the bank by `promosiKuisLama()` (`src/lib/courses/kuis.ts`) inside `pastikanTermuat()`, in the same lazy pass as the `teks` → halaman migration. It is idempotent (quiz id derives from material id, `kuis-<material id>`) and it **never overwrites a bank entry that already has that id** — an admin who edited a migrated quiz must not lose the edit.
- A legacy quiz whose questions are *all* unusable is **not** promoted, and its material entry is deliberately left in `materi[]` rather than deleted, so it does not vanish without a trace.
- `kuisSchema` keeps its `.default()` values out of the shared field object, because `updateKuisSchema` is derived via `.partial()` — and `partial()` does **not** strip `.default()`. Putting the default on the shared object makes `nilai_lulus` default to 70 on every partial update, silently resetting an admin's passing score whenever they rename a quiz. Defaults belong only on the create path.
- The passing score is client-side only: `kuis-view.tsx` grades in the browser and stores nothing. Because correct answers ship to the renderer, this is a practice tool, **not a cheat-resistant exam** — revisit that decision before using quizzes for certification.

### Module boundaries for this feature

`blok.ts`, `halaman.ts`, and `kuis.ts` are **pure and client-safe** and must stay that way — renderers are client components. `slugBagian()` in `blok.ts` intentionally duplicates slug logic rather than importing `slugify` from `store.ts`, because that import chain reaches `node:fs`. Do not "de-duplicate" them. `npm run build` is the gate that catches a violation here; `npm run check` does not.

`ModulKursus.kuis` holds **resolved `Kuis` objects**, not ids, because the learner UI cannot touch the store. Resolution happens in `modul-resolver.ts`, which reads the bank once per course and passes it to `dariTersimpan()` — not once per module.

## Conventions that differ from defaults

- **Business-logic functions are named in Indonesian** (`hitungSkorJadwal`, `hitungSkorVts`, `jalankanNavigator`, `jalankanSocrates`, `auditLoker`, `ambilLokerDariCache`, `deteksiFee`) while infra/UI code is English. Match the surrounding file's language; don't "translate" existing identifiers.
- User-facing copy and `<html lang>` are Indonesian (`id`).
- Styling is **Tailwind v4 CSS-first**: there is no `tailwind.config.js`; theme tokens live in `src/app/globals.css` (~2.9k lines, `@import "tailwindcss"` + `@theme`). Prefer editing tokens there over adding arbitrary values.
- Scoring is a 100-point scale: jadwal (30) + karya (40) + validasi (30), clamped/rounded in `hitungSkorTotal`. Attestation signatures canonicalize payload keys (sorted) before HMAC-SHA256 — reordering keys must not change the signature (covered by tests).
- `mockup/` is standalone static HTML/CSS reference, excluded from eslint and not part of the Next build.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
