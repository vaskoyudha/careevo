# AGENTS.md

Careevo is a Next.js 16.3.5 / React 19 prototype ("Learn. Verify. Earn."): a learning-to-job bridge with HMAC attestations, fixture-backed audit data, and a deterministic Indonesian job-board audit (Sentinel). UI copy and `<html lang>` are Indonesian (`id`). Core fixture data loads through `src/lib/fixtures.ts`.

Two vendored trees live in this repo but are **not part of the Careevo build graph** (see "Vendored trees" below): `engine/` (career-ops, spawned via child_process) and `features/sijago/` (a separate Next app branded AI Mastery, framed at `/ai-mastery`). Do not lint, typecheck, or edit them as if they were Careevo sources.

## Commands

- `npm run dev` — Next dev server (Turbopack by default).
- `npm run build` / `npm start` — production build and serve.
- `npm run lint` — ESLint flat config; `next lint` is not used.
- `npm run typecheck` — `tsc --noEmit`; faster than a full `build`.
- `npm test` — `vitest run` once. `npm run test:watch` for watch mode.
- `npm run check` — the manual gate, in order: typecheck → lint → skills:check → test. It does **not** run `build`, `smoke`, or `e2e:onboarding`; `npm run build` is the only gate that catches client-safe/server-only import violations.
- `npm run skills:check` — validates `.agents/skills/` against the Agent Skills spec.
- `npx vitest run src/lib/scoring/scoring.test.ts` — one test file. `npx vitest run -t "A1:"` — one test by name.
- `npm run smoke -- [baseUrl]` and `npm run e2e:onboarding -- [baseUrl]` — both require a running server. Smoke's route count is derived from the `routes` array; don't hardcode a count.

**Always leave the full Careevo web app running.** The user asked for this
explicitly. "Full web" means the whole stack, not just `next dev`:

| Port | What must be up |
|---|---|
| `:3000` | Careevo dev server (`npm run dev`) |
| `:3790` | the framed AI Mastery app, serving `features/sijago/.next/standalone` |
| `:8011` | the FastAPI backend AI Mastery talks to |

`/ai-mastery` is a cross-origin iframe, so a green `npm run check` says nothing
about whether the page works. Before reporting any UI work done, confirm all
three ports are listening, and re-launch anything you stopped. Two traps:

- **`:3790` serves a prebuilt bundle.** Any source edit under `features/sijago/`
  is invisible until `npm run build` there *and* the server is restarted from
  `.next/standalone`. A `next build` also leaves the old process running from a
  **deleted** cwd — always restart it, don't just build.
- **A moved route needs `npx next typegen`.** `next dev` does not always refresh
  `.next/types`, and a stale `validator.ts` pointing at a deleted page breaks
  `npm run typecheck`. Run it after adding, moving, or deleting any route.

Deps: npm with `package-lock.json` v3; no `packageManager`/`engines` pin. Vitest 5.0.1 requires Node `^22.12.0 || ^24.0.0 || >=26.0.0`; Next declares `>=20.9.0`. Fresh checkout: `npm ci` (`node_modules` is not checked in). There is no CI workflow or pre-commit hook — `npm run check` is the gate.

## Skills (read before touching the area)

`.agents/skills/` holds Agent Skills ([agentskills.io](https://agentskills.io/specification)) that encode this repo's non-obvious knowledge. Read the relevant one first:

- **`loker-sentinel`** — `/loker` audit: verdict policy, `flags` vs `fee_flags`, why verdicts are derived not stored. Before touching `src/lib/jobs/` or loker pages.
- **`loker-evaluasi`** — the A–H LLM evaluation: scoring model, schema-constrained output, failure policy. Before touching `src/lib/agents/evaluasi/`.
- **`loker-persiapan`** — the loker detail page's course recommendations + job-sourced mastery path: the deterministic shortlist, the LLM reasons that only decorate it, the mastery-path agent, `MasteryTopic.jobId`, and the asymmetric failure policy (course list survives without a model, mastery path does not). Before touching `src/lib/jobs/rekomendasi-kursus.ts`, `src/lib/agents/{kursus-loker,jalur-loker}/`, `src/actions/loker-persiapan.ts`, or the two panels.
- **`careevo-review`** — self-review checklist built from real defects that shipped here. Before committing.
- **`careevo-browser-verify`** — proving UI fixes in a real browser; `npm run check` was green while the tutor's mobile layout dropped 36px of every answer. Before claiming a page/flow is done.
- **`careevo-attribution`** — MIT notice requirements for code ported from career-ops.
- **`careevo-sijago`** — the framed `features/sijago/` app (branded **AI Mastery**): the `:8001`/`:8011`/`:3782`/`:3790` topology, the model-catalog API and why "No active LLM model is configured" is usually a stale profile, why `o2a/space-bunny-free` can't drive it, verifying the cross-origin frame, and the brand-rename split (rename the visible name, keep the `features/sijago/` path and internal `deeptutor` identifiers). Before editing or restarting anything under `features/sijago/`, or when an AI Mastery chat turn fails.
- **`career-ops-port`** — what was adopted from career-ops, what was rejected. Before proposing further integration.
- **`career-ops-engine`** — driving the vendored `engine/`: exit-2-is-success, which of `pipeline.md` / `scan-history.tsv` / `scan-runs.tsv` answers what, the append race that duplicates postings. Before running/debugging a scan or changing what the inbox reads.

A skill with invalid frontmatter fails **silently** — `npm run skills:check` is the validator (`scripts/validate-skills.mjs`, which imports the direct dep `js-yaml`). `docs/career-ops-architecture-study.md` is historical; the current port decision is `career-ops-port`.

## Testing quirks

- Vitest `include` is exactly `src/**/*.test.ts`; `.test.tsx` and browser tests are not included.
- Environment is `node` (no jsdom/browser) — pure logic only.
- File-based store tests redirect their data dir (`CAREERS_DATA_DIR` / `CAREEVO_DATA_DIR`) to a temp dir **before** importing the module, so they never touch the repo's real `.data/` or `data/`.
- `@/` alias maps to `src/` in both `tsconfig.json` and `vitest.config.mts`; keep them in sync.
- `vitest.config.mts` sets `CAREEVO_PERFORMA_DIR` to a fresh temp dir on every run. It cannot be set inside `src/actions/enrollment.test.ts` because that file uses static imports, so the env has to be in place before the store module loads. Test files that need isolation from parallel siblings override it again in `beforeEach` — `tempatPerforma()` reads the env per call, so that works despite static imports.

## Architecture

- **Label jalur di laporan diturunkan, bukan disimpan.** `completion_path` tetap
  dua nilai (`terverifikasi`/`informal`, CHECK di `schema.ts:473`); label empat
  nilai dihitung di `src/lib/performa/jalur-selesai.ts`. Jangan
  "menyederhanakan" dengan menambah nilai kolom baru.
- **`wajib_kamera` ditegakkan server dari `kamera_mulai`, bukan dari boolean
  klien.** Dua gerbang: `selesaikanMateriAction` (cabang `perlu_kamera` dari
  `putuskanAkses`) dan `selesaikanModulKuisVerified` (kode `perlu_kamera`).
- **`module_progress.evidence_id` berisi dua jenis id.** Jalur materi mengisi
  `learning_runs.id`, atau `null` ketika tidak ada bukti sesi yang diverifikasi —
  itulah kasusnya pada course `opsional`, yang tidak mewajibkan sesi sehingga
  buktinya tidak pernah dihitung; jalur kuis mengisi `quiz_attempts.id`.
  `null` itu pilihan **penulisnya** (`evidenceId: bukti?.id ?? null`), bukan sifat
  course: `mulaiSesiAction` tidak membatasi run ke kebijakan tertentu, jadi
  course `opsional` pun bisa punya run — hanya run itu tidak pernah jadi bukti
  di sini. Apa pun yang memetakan bukti ke run harus memeriksa jenisnya lebih
  dulu, bukan menganggap `null` berarti "course ini tidak punya run", dan bukan
  menganggap id yang tidak ditemukan di peta run berarti "tidak ada kamera".

## Navigation — navbar contract (do not regress)

- **Three** navbars, all on the `.chrome` base in `src/app/globals.css` (`position: sticky`). Two of them morph; the third does not. Any new navbar reuses these classes rather than inventing a fourth style.
- The two **morphing** bars share the same mechanism: `.is-top` transparent full-width, `.is-scrolled` floating glass pill, flipping at `scrollY > 24`. These are `Chrome` (`src/components/ui/chrome.tsx`, public/marketing) and `LearnerChrome` (`learner-chrome.tsx`, logged-in learner). Their `navItems` lists differ on purpose (learner has `/belajar/jalur`) — do not merge them. Learner bar items live in `chrome-parts.tsx` with `AccountMenu`.
- The **Explore mega-menu card** (`explore-menu.tsx`, portalled to `<body>`) draws in the floating pill's box — `min(var(--max), calc(100% - 2 * var(--page-pad)))`, centred — in *both* bar states, from `.explore-mega-menu` in `globals.css`. Only its `top` is measured, from the trigger. Do not re-anchor its `left`/`width` to the bar's own rect: in `.is-top` the bar is `width: 100%`, and the card stretched edge-to-edge and read as a second navbar. The pill's rule is the source of truth.
- The third bar, `AiMasteryNavbar` (`ai-mastery-navbar.tsx`), is `/ai-mastery` only: same light colour and same items, but **wings** at its top corners and **no `is-scrolled` state** — the framed app owns its scrolling, so the document never scrolls and a morph would have an unreachable state. The wings are ported from the notch bar in `vyns.ko/decks/01-hero-deck.html` (`.projects-notch-bar`): two pseudo-elements parked *outside* the bar's top corners, each a `--wing` square with a transparent circle punched out of it, so the square-minus-circle is a concave "ear". Do **not** redraw them as an SVG path across the top edge — that was tried and it cannot work here, because the path has to span the full bar and any dip deep enough to read as a wing eats the surface the nav row sits on (a 38px dip on a 64px bar leaves 26px, so the links spill out above the fill and the shadow halo cuts through them). The notch is additive and costs the bar's own height nothing. Three consequences: the bar's width subtracts `2 * var(--wing)` so the ears do not hang off the viewport; the bar sits **flush** at the top (`margin: 0 auto`, as in vyns.ko — a `margin-top` leaves a band of page above it that reads as a mistake, and as the shell's first-child margin it also collapses through the parent); and `--app-chrome-h`, published by `shellClassName="ai-mastery-shell"`, is therefore just the bar's height — **85px** under 769px (it wraps to two rows) and **64px** above.
- `Chrome` = public/marketing. `LearnerChrome` = logged-in learner. Learner pages (`/belajar`, `/belajar/[slug]`, `/belajar/jalur`) use `LearnerShell` (top bar), **never** `AppShell` (sidebar) — `AppShell` is for dashboard-style pages (dashboard, admin, review, audit, challenge, submission, loker detail).
- **Exception:** `/belajar/mastery`, `/belajar/buku`, `/belajar/latihan` are focus-mode workspaces in `(focus)` with **no** navbar at all — they render their own full-height shell. Do not "fix" them by wrapping in `LearnerShell`; the workspace owns its own scrolling. (`/belajar/tutor` used to be a fourth; it was removed in favour of the framed AI Mastery app at `/ai-mastery`.)
- Page tops under the transparent bar must be light (dark text stays readable). Learner navbar search is visible only in `.is-top` mode; it GETs `/belajar?q=` and `BelajarPage` feeds it back as `queryAwal` (sliced to 120 chars).

## Stubs — do not assume these work

`logAudit` (`src/lib/audit/logger.ts`) and `runAgent`/`toAgentRun` (`src/lib/agents/orchestrator.ts`) throw `"... belum diimplementasikan"`. Audit log and agent-run persistence are not wired up; pages read fixtures instead.

## Course curriculum — stored vs derived

- **Derived** — `modulKursus()` (`src/lib/courses/kurikulum.ts`) always generates exactly 5 modules with positional ids (`${courseId}-m1`…`-m5`). These ids are what real users' `ls_enroll` progress cookies are keyed by.
- **Stored** — `Course.modul` (each with its own `materi`, `halaman`, `kuis` id list). Editing a curriculum in `/admin/courses/[id]` switches that course to stored modules; old progress is dropped safely by `irisModulSelesai()`.
- `src/lib/courses/modul-resolver.ts` is the single resolver (`modulUntuk` / `modulUntukSumber`): stored wins, otherwise derived. **Never call `modulKursus()` directly from a page or action.** One recorded exception: `src/lib/learning/personalized-path.ts` must keep calling it, because `bangunJalurPersonalisasi` is the one consumer that speaks derived ids on both sides; resolving through the resolver there would mix stored/derived.

## Halaman berformat & Kuis



## Conventions that differ from defaults

- Business-logic functions are named in Indonesian (`hitungSkorJadwal`, `auditLoker`, `deteksiFee`, `ambilLokerDariCache`) while infra/UI code is English. Match the surrounding file's language; don't translate existing identifiers.
- Styling is **Tailwind v4 CSS-first**: no `tailwind.config.js`; theme tokens live in `src/app/globals.css` (`@import "tailwindcss"` + `@theme`). Prefer editing tokens over arbitrary values.
- Scoring is a 100-point scale: jadwal (30) + karya (40) + validasi (30), clamped/rounded in `hitungSkorTotal`. Attestation signatures canonicalize payload keys (sorted) before HMAC-SHA256 — reordering keys must not change the signature.
- `mockup/` is standalone static HTML/CSS reference, excluded from eslint and not part of the build.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
