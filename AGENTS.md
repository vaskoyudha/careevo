# AGENTS.md

Careevo is a Next.js 16.3.5 / React 19 learning-to-job bridge ("Learn. Verify. Earn."): HMAC attestations, a deterministic Indonesian job-board audit (Sentinel), and — since Fase 1 — **PostgreSQL as the authoritative store for identity, RBAC, sessions, audit and learning evidence**. UI copy and `<html lang>` are Indonesian (`id`). Legacy fixture data still loads through `src/lib/fixtures.ts`.

There is **no README**. `DESIGN.md` (visual language), `docs/`, and `.agents/skills/` are the prose sources.

## Vendored trees — none of these are Careevo code

Four trees are excluded from `tsconfig.json` and `eslint.config.mjs`. Do not lint, typecheck, or edit them as if they were Careevo sources.

| Path | What it is | Tracked? |
|---|---|---|
| `features/sijago/` | A second, complete Next app derived from DeepTutor, branded **AI Mastery**, framed at `/ai-mastery` | yes |
| `backend/` | The DeepTutor **FastAPI backend** AI Mastery talks to (36k files) | yes |
| `engine/` | Verbatim vendored core of career-ops, orchestrated via `child_process` from `src/lib/career-ops/` | yes |
| `career-ops/` | The original upstream career-ops checkout, kept only as a reference | **no** — gitignored |

`mockup/` is standalone static HTML/CSS: eslint-ignored, not in the build.

## Commands

- `npm run dev` — Next dev server (Turbopack by default).
- `npm run build` / `npm start` — production build and serve. `npm start` serves `.next`, so a behavioural check against it is only meaningful after a rebuild.
- `npm run typecheck` — `tsc --noEmit`; much faster than `build`.
- `npm test` — unit tests (`vitest run`). `npm run test:watch` to watch.
- `npm run test:db` — **integration** tests. Needs a live PostgreSQL. Separate config, see "Testing".
- `npm run check` — the manual gate, in order: typecheck → lint → skills:check → test. It runs **neither `build` nor `test:db`**. So a green `check` does *not* mean the schema is valid and does *not* catch client-safe/server-only import violations — only `npm run build` catches those.
- `npm run skills:check` — validates `.agents/skills/` against the Agent Skills spec.
- `npm run db:generate` (no DB needed) → read the emitted SQL → `npm run db:migrate` (touches the DB). See "PostgreSQL".
- `npm run worker`, `npm run outbox:replay` — outbox worker and dead-letter CLI. See "Outbox".
- `npm run seed:demo [-- email]` — fills **demo accounts only** with enrollments + informal module progress so `/progres` can be seen populated. Idempotent (`tandaiModulDb` is a toggle, so re-running would otherwise *undo* itself). Creates no `quiz_attempts`/`course_completions`/`attestations`: 100% there means "all modules done informally", never "certificate issued".
- `npx vitest run src/lib/scoring/scoring.test.ts` — one test file. `npx vitest run -t "A1:"` — one test by name. `npx vitest run --config vitest.integration.config.mts src/lib/outbox/worker.integration.test.ts` — one integration file.
- `npm run smoke -- [baseUrl]`, `npm run e2e:onboarding -- [baseUrl]` — need a running server. Smoke derives its route count from the `routes` array; don't hardcode one.

Fresh checkout: `npm ci` (`node_modules` is not checked in). npm with `package-lock.json` v3; no `packageManager`/`engines` pin. Vitest 5 needs Node `^22.12 || ^24 || >=26`. **There is no CI workflow and no pre-commit hook** — `npm run check` is the gate.

### Leave the whole stack running

The user asked for this explicitly. "Full web" is the whole stack, not just `next dev`:

| Port | What must be up |
|---|---|
| `:3000` | Careevo dev server (`npm run dev`) |
| `:3790` | AI Mastery, serving `features/sijago/.next/standalone` |
| `:8011` | the FastAPI backend AI Mastery calls |
| `:5432` | PostgreSQL — identity/auth lives there. See the note below before starting it. |

Check with `ss -ltnp | grep -E ':(3000|3790|8011|5432)\b'`, not a `/dev/tcp` probe — that one reports false negatives here and will convince you the stack is down when it is up. Before reporting UI work done, confirm the ports are listening and re-launch anything you stopped. Three traps:

- **`:3790` serves a prebuilt bundle.** Edits under `features/sijago/` are invisible until you `npm run build` *there* **and** restart the server from `.next/standalone`. A `next build` leaves the old process running from a **deleted** cwd — always restart, don't just build.
- **`/ai-mastery` is a cross-origin iframe**, so a green `npm run check` says nothing about whether it works.
- **A moved route needs `npx next typegen`.** `next dev` does not reliably refresh `.next/types`; a stale `validator.ts` pointing at a deleted page breaks `npm run typecheck`.

A `307` from `/belajar` or `/ai-mastery` to `/masuk` is correct auth behaviour for a logged-out request, not a broken route.

### Starting PostgreSQL on this machine

`docs/local-db.md` says `docker compose up -d postgres`. **That does not work here: there is no `docker` CLI and no `podman-compose`** (podman exists but cannot read the compose file). Native PostgreSQL 18.6 is installed instead, and a dev cluster is already initialised to match the published dev credentials:

```bash
export PGDATA="$HOME/.local/share/pgsql/cluster"
# the socket dir must be overridden — /var/run/postgresql is not writable
pg_ctl -D "$PGDATA" -l /tmp/pg-careevo.log -o "-p 5432 -c listen_addresses=127.0.0.1 -c unix_socket_directories=$HOME/.local/share/pgsql/run" start
psql -h 127.0.0.1 -p 5432 -U careevo -d careevo -c '\dt'   # 25 tables after db:migrate
```

Skipping the `unix_socket_directories` override is the one trap: the server logs `could not create lock file "/var/run/postgresql/..."` and exits, and because the log has already been handed to the logging collector the real reason is only in `$PGDATA/log/`, not in the file you passed to `pg_ctl -l`.

## PostgreSQL / Drizzle

Read `docs/local-db.md` before touching schema or migrations. The dev credentials in `docker-compose.yml` and `src/lib/db/client.ts` (`careevo:careevo_dev`) are **published, not secret**.

- Schema source of truth is `src/lib/db/schema.ts` (25 tables: identity/auth/RBAC, `audit_events`, outbox, courses/enrollments/progress/assessment, submissions/reviews/badges/attestations). Generated SQL lands in `drizzle/` and **must be committed** — it is what runs in production.
- **Rollback is forward.** Drizzle writes no `down` files, so a bad migration is corrected by writing a *new* one. Never delete or edit an already-applied `drizzle/00NN_*.sql`; the applied set is recorded in `drizzle.__drizzle_migrations` by hash, so editing it makes dev and prod disagree silently.
- Both `scripts/migrate.ts` and `scripts/test-db-setup.ts` go through the same programmatic migrator (`src/lib/db/migrate.ts`), so the test DB cannot drift from dev.
- **In production an empty `DATABASE_URL` is a start-up failure**, never a fallback to the published dev credentials (`ambilUrlDatabase` throws `DatabaseUrlError`). `TEST_DATABASE_URL` wins over `DATABASE_URL`.
- `getDb()` is **server-only** and must not be imported from client components, nor from `src/lib/courses/{kurikulum,blok,halaman,kuis}.ts` — those four are deliberately pure/client-safe and one import drags `node:net` into the browser bundle. The pool is cached on `globalThis` so it survives dev hot-reload.
- Use `denganTransaksi(fn)` and thread the `TransaksiDb` you are given through it. Calling `getDb()` *inside* `fn` escapes the transaction — a bug that stays invisible until a rollback.
- `npx tsx scripts/bootstrap-admin.ts` grants the **first** admin. It deliberately has **no `npm run` script**, so it can't be picked up by a build/deploy gate or copied without being read. A freshly migrated DB has no admin at all, which makes `gateAdmin()` (and therefore invitations/`beriRoleAction`) unreachable until you run it.

## Outbox

`docs/outbox-worker.md` is the runbook (and is unusually honest about what is *not* verified — read its §9 before repeating its claims). The invariants an agent is most likely to break:

- `outbox_events` has **no `status` column** — state is derived from `processed_at` / `dead_lettered_at`. A success row must never set `dead_lettered_at`, and a dead row must never set `processed_at`; filling both makes "permanently failed" read as "done".
- Business change + event row are written in **one** transaction via `tulisOutbox` / `jalankanDenganOutbox`. Other flows only get that guarantee once they're integrated with the writer.
- An event type with **no registered handler is a terminal failure** (`handler_tidak_terdaftar`), not a no-op. Today the only registered sink is `audit`. Do not register `attestation.*`, email, or `file.scan` handlers to make a gate look green — their source-of-truth tables don't exist yet, and `docs/outbox-worker.md` §6 records the deduplication proof each needs first.
- `exactly-once` is **not** promised. Internal sinks get real at-most-once via the composite PK `(event_id, sink)` on `outbox_deliveries`; network sinks need a provider-recognised idempotency key.
- `npm run worker` in loop mode exits `2` when anything dead-letters, but `--once` exits `0`. Don't alert on `--once`. `outbox:replay` takes `help` as a **positional** command, and running it with no command prints help and exits `0`.
- Replay is an audited decision, not a button: `--actor` must be an active admin UUID (checked in the DB) and `--reason` is mandatory. There is no bulk replay, on purpose.

## Testing quirks

- **Two suites, two configs.** `vitest.config.mts` runs `src/**/*.test.ts` and explicitly *excludes* `src/**/*.integration.test.ts`; `vitest.integration.config.mts` includes only that pattern and mounts `globalSetup: ./scripts/test-db-setup.ts`. The `.integration.test.ts` suffix is the **contract** that keeps `npm test` green on a machine without Docker — an integration test that forgets it will join `npm test` and break that promise.
- `npm run test:db` requires live PostgreSQL and **fails loudly** naming `docker compose up -d postgres` rather than skipping (a skipped integration test looks green and hides a broken schema). It builds a fresh ephemeral `careevo_test_<seed>` database, runs the real migrations into it, and drops it in teardown — so it also proves fresh install, and it can never touch your dev DB. The user needs `CREATEDB`.
- Integration runs are `fileParallelism: false` and `TRUNCATE ... CASCADE` per file against one shared database. Do not run two integration Vitest processes against the same server concurrently.
- Environment is `node` — no jsdom, so no browser or `.test.tsx` tests.
- `@/` → `src/` is duplicated in `tsconfig.json` **and** both vitest configs. Keep them in sync.
- `vitest.config.mts` sets `CAREEVO_PERFORMA_DIR` to a fresh temp dir per run. It can't be set inside `src/actions/enrollment.test.ts` (static imports), so the env must exist before the store module loads. File-store tests redirect `CAREERS_DATA_DIR` / `CAREEVO_DATA_DIR` to a temp dir **before** importing the module.
- `vitest.integration.config.mts` deliberately imports `./scripts/test-db-setup` **without** the `.ts` extension. Adding it silences a Vite warning but `tsc` rejects `.ts` specifiers without `allowImportingTsExtensions`, and that option loosens module resolution repo-wide. Don't "fix" it without also moving the setup to `.mjs`.
- Several docs quote point-in-time suite sizes (e.g. `docs/outbox-worker.md` §9 still says "125/125 in 8 files"; the suite has since grown). Re-run the command for current numbers rather than quoting a doc.

## Three data stores — don't confuse them

Empty PostgreSQL does not explain the other two, and vice versa.

1. **PostgreSQL** — identity, RBAC, sessions, `audit_events`, outbox, and the learning/assessment tables. Migrating *away* from the stores below is per-domain, not one cutover (plan §2.2).
2. **File stores in `.data/`** (gitignored) — resume, performa, `book`, `latihan`, `mastery`, jobstreet cache, career-ops inbox. `src/lib/resume`, `src/lib/performa`.
3. **`data/courses.json` + `data/kuis.json`** (gitignored) — courses and quizzes, with a **per-process cache** (`src/lib/courses/storage.ts`). A long-running `next dev` will not see a course another process wrote until you restart the server. Restart the server, not Postgres. The outbox is *not* like this — it is a table, so newly written rows are visible immediately.

## Architecture — decisions that are locked, not style

From `docs/backend-production-plan.md` §2.2. Breaking these is a regression even when types still check.

- **Don't let the browser decide eligibility.** Application services must not accept a browser-supplied claim that determines eligibility (pass score, target username, course completion, role). Verified quiz scores and completion paths are computed and authorized server-side.
- **Assessment is an immutable snapshot** (ADR 0003): the server reads `assessment_snapshot` and never re-reads `data/kuis.json`. Practice-mode feedback may be local, but anything affecting verified completion or a credential is not.
- **Content stays structured data.** Page blocks are structured; no raw HTML, no `dangerouslySetInnerHTML`.
- **Don't prematurely unify** the cookie, course, resume and performa persistence paths — they differ for product reasons and are migrated one domain at a time.
- **Four-value `jalur` labels in reports are derived, not stored.** `completion_path` stays two values (`terverifikasi`/`informal`, CHECKed via `JALUR_PENYELESAIAN` in `schema.ts`); the four-value label is computed in `src/lib/performa/jalur-selesai.ts`. Do not "simplify" this by adding a column.
- **`wajib_kamera` is enforced server-side from `kamera_mulai`, never from a client boolean.** Two gates: `selesaikanMateriAction` (the `perlu_kamera` branch of `putuskanAkses`) and `selesaikanModulKuisVerified` (code `perlu_kamera`).
- **`module_progress.evidence_id` holds two kinds of id.** The materi path stores a `learning_runs.id`, or `null` when there is no verified session evidence — that is the case for the `opsional` course, which mandates no session so its evidence is never computed; the quiz path stores a `quiz_attempts.id`. The `null` is the **writer's choice** (`evidenceId: bukti?.id ?? null`), not a property of the course: `mulaiSesiAction` doesn't restrict runs to a policy, so `opsional` can have a run — it just never becomes evidence here. It is also a deliberately **soft** reference (uuid, no FK) so attempt cleanup can't cascade into credential evidence. Anything mapping evidence to a run must check the kind first: `null` does not mean "no run", and an id missing from the run map does not mean "no camera".
- **Audit is real now** — `audit_events` is append-only, and redaction happens **before** insert (`src/lib/auth/audit.ts`): forbidden keys are dropped, raw PII is masked, ≥32-char opaque strings are treated as tokens (UUIDs exempt), and nested payloads are filtered recursively. The name `payload_redacted` is the reminder. The old `logAudit` (`src/lib/audit/logger.ts`) and `runAgent`/`toAgentRun` (`src/lib/agents/orchestrator.ts`) are **gone**; there is still no agent-run persistence — agents call the LLM port directly.
- **In production the server refuses to start** on a default/placeholder/short `SESSION_SECRET` or `ATTESTATION_SECRET`. `src/instrumentation.ts` calls `verifikasiKonfigurasiSecret()` once at boot, so misconfiguration fails before the first request. Error messages never contain the secret value.
- Review is a state machine with an authoritative attestation lifecycle (ADR 0004) — see `src/lib/review/service.ts` and ADR 0003/0004 before changing `submissions`/`reviews`/`badges`/`attestations`.

### Course curriculum — stored vs derived

- **Derived** — `modulKursus()` (`src/lib/courses/kurikulum.ts`) always generates exactly 5 modules with positional ids (`${courseId}-m1`…`-m5`); these are what real users' `ls_enroll` progress cookies are keyed by.
- **Stored** — `Course.modul`, each with its own `materi`, `halaman`, `kuis` id list. Editing a curriculum in `/admin/courses/[id]` switches that course to stored modules; old progress is dropped safely by `irisModulSelesai()`.
- `src/lib/courses/modul-resolver.ts` is the **single** resolver (`modulUntuk` / `modulUntukSumber`): stored wins, otherwise derived. Never call `modulKursus()` directly from a page or action. One recorded exception: `src/lib/learning/personalized-path.ts` must keep calling it, because `bangunJalurPersonalisasi` is the one consumer speaking derived ids on both sides — resolving there would mix stored and derived.

## Navigation — navbar contract (do not regress)

- **Three** navbars, all on the `.chrome` base in `src/app/globals.css` (`position: sticky`). Two morph; the third cannot. (`DESIGN.md` still says "exactly two" — it predates `AiMasteryNavbar`; the code is the truth.)
- The two **morphing** bars share one mechanism: `.is-top` transparent full-width, `.is-scrolled` floating glass pill, flipping at `scrollY > 24`. These are `Chrome` (`src/components/ui/chrome.tsx`, public/marketing) and `LearnerChrome` (`learner-chrome.tsx`). They hold the same five destinations today, but only by coincidence — they are separate lists and do not merge them (one is signed-in wayfinding, the other a marketing bar deciding at render time whether there is a session). Learner items live in `chrome-parts.tsx` with `AccountMenu`. `Project` (ex-`Karya`) and `Progres` (ex-`Jalur Belajar`, at `/progres`) were moved *out* of the navbar and into the dashboard sidebar (`dashboard-sidebar.tsx`, `USER_GROUPS`) — so they are `AppShell` destinations, with no navbar entry on the `LearnerShell` pages.
- The **Explore mega-menu card** (`explore-menu.tsx`, portalled to `<body>`) is **viewport-anchored**: `left`/`right` + `margin-inline: auto`, `width: max-content`, `max-width: min(var(--max), calc(100% - 2 * var(--page-pad)))`, from `.explore-mega-menu`. Only its `top` is measured, from the trigger, because the bar is sticky and flips between `.is-top` and `.is-scrolled`. Do not re-anchor `left`/`width` to the bar's own rect: in `.is-top` the bar is `width: 100%` and the card stretched edge-to-edge, reading as a second navbar. `max-content` is deliberate — the card hugs its content instead of reserving a full pill-width box that dumps its slack into `justify-between` gutters; the pill's inset stays the ceiling via `max-width`.
- The panel's **contents are computed from the catalog**, not from a static list. `src/lib/courses/explore-facets.ts` is the single source: every item's `jumlah` comes from the *same* helper its destination page uses (`getProgramsByRole` / `getProgramsByCategory` / `getProgramsBySearch` / `getProgramsByQuery`), items with 0 programs are excluded and counted into `tanpaIsi`, and the panel says so out loud. Do not add a hand-maintained Explore list — a 0-item tile is the failure mode, and `explore-facets.test.ts` walks the App Router to catch hrefs that 404. `EXPLORE_FALLBACKS.freeCourses` is deliberately **unlinked**: the registry has no `price` field, so "gratis" cannot be answered from the catalog.
- The panel is a **disclosure-navigation** mega-menu, not a menubar: rail rows are `<Link>`s to each facet's full page (so they are Tab-able, screen-reader reachable, and crawlable) rather than hover-only panes. `Escape` closes and restores focus. Also: the trigger's hover handler is gated on `pointerType === "mouse"`, because on touch `pointerenter` fires before `click` and an ungated pair opens then immediately re-closes the panel on the first tap.
- The third bar, `AiMasteryNavbar` (`ai-mastery-navbar.tsx`), is `/ai-mastery` only: same light colour and items, but **wings** at its top corners and **no `is-scrolled` state** — the framed app owns its scrolling, so the document never scrolls and a morph would have an unreachable state. The wings are ported from the notch bar in `vyns.ko/decks/01-hero-deck.html` (`.projects-notch-bar`): two pseudo-elements parked *outside* the bar's top corners, each a `--wing` square with a transparent circle punched out, so square-minus-circle is a concave "ear". Do **not** redraw them as an SVG path across the top edge — that was tried and cannot work, because the path must span the full bar and any dip deep enough to read as a wing eats the surface the nav row sits on (a 38px dip on a 64px bar leaves 26px, so links spill above the fill and the shadow halo cuts through them). The notch is additive and costs the bar no height. Three consequences: the bar's width subtracts `2 * var(--wing)` so the ears don't hang off the viewport; the bar sits **flush** at the top (`margin: 0 auto` — a `margin-top` leaves a band of page above that reads as a mistake, and as the shell's first-child margin it also collapses through the parent); and `--app-chrome-h`, published by `shellClassName="ai-mastery-shell"`, is therefore just the bar's height — **85px** under 769px (wraps to two rows), **64px** above.
- `Chrome` = public/marketing. `LearnerChrome` = logged-in learner. Learner pages (`/belajar`, `/belajar/[slug]`, `/profil`, `/ai-mastery`) use `LearnerShell` (top bar), **never** `AppShell` (sidebar) — `AppShell` is for dashboard-style pages (dashboard, progres, jelajah, admin, review, audit, challenge, submission, loker detail).
- **Exception:** `/belajar/mastery`, `/belajar/buku`, `/belajar/latihan` are focus-mode workspaces in `(focus)` with **no** navbar; they render their own full-height shell and own their own scrolling. Do not "fix" them with `LearnerShell`. (`/belajar/tutor` was a fourth; removed in favour of the framed app at `/ai-mastery`.)
- Page tops under the transparent bar must be light, so dark text stays readable. Learner navbar search is visible only in `.is-top` mode; it GETs `/belajar?q=` and `BelajarPage` feeds it back as `queryAwal` (sliced to 120 chars).

## Conventions that differ from defaults

- Business-logic functions are named in Indonesian (`hitungSkorJadwal`, `auditLoker`, `deteksiFee`, `ambilUrlDatabase`) while infra/UI code is English. Match the surrounding file's language; don't translate existing identifiers.
- Styling is **Tailwind v4 CSS-first**: no `tailwind.config.js`; theme tokens live in `src/app/globals.css` (`@import "tailwindcss"` + `@theme`). Prefer editing tokens over arbitrary values. `DESIGN.md` is the visual source of truth, including the deliberate pale `#bfdbfe` gradient tail that is *not* AA-safe — don't silently re-darken it.
- Scoring is a 100-point scale: jadwal (30) + karya (40) + validasi (30), clamped/rounded in `hitungSkorTotal`. Attestation signatures canonicalize payload keys (sorted) before HMAC-SHA256 — reordering keys must not change the signature.
- `next.config.ts` lifts security headers from `src/lib/security/headers.ts`, and `experimental.serverActions.bodySizeLimit` must stay `>= MAKS_UKURAN_BYTE` in `src/app/api/unggah/route.ts` or the two disagree (the route carries the real message).

## Progres per kursus — satu helper, jangan dua

`listProgresKursus()` (`src/lib/learning/progres-kursus.ts`) adalah **satu-satunya** tempat menghitung "kursus ini sudah berapa modul selesai, berapa persennya" untuk UI. Dua pemanggil: `/progres` (halaman, `AppShell` + sidebar) dan section "Pembelajaran saya" di `/belajar`. Keduanya **wajib** memakainya — jangan menulis loop `modulUntukSumber` + `progresKursusDb` + `hitungProgres` sendiri di halaman atau komponen baru, karena dua hitungan akan menyimpang diam-diam saat kurikulum berubah.

Helper itu sudah menaati aturan yang berlaku di seluruh repo: modul dari resolver tunggal, `irisModulSelesai` sebelum menghitung (id basi tidak boleh menggelembungkan angka), progres diturunkan bukan disimpan, dan angka hanya dari database — tidak ada persentase dari peramban. Enrollment yang kursusnya hilang dari katalog dilewati, bukan dirender dengan `course_id` mentah.

Rute lama `/belajar/jalur` masih ada **hanya** sebagai stub `redirect("/progres")` (dulu "Jalur Belajar": satu jalur personal ke satu kursus, sekarang digantikan daftar semua kursus). Jangan menambah halaman di bawahnya lagi. Perhatikan redirect dari situ **in-band** (`<meta http-equiv="refresh">`, status **200**, bukan 307) karena halamannya sudah streaming — assertions yang mengharapkan 307 akan gagal.

Script `scripts/e2e-onboarding.mjs` **sudah usang dan tidak bisa dipakai sebagai gerbang**: ia masih mencetak cookie sesi payload lama bertanda tangan HMAC, sedangkan `getSession()` sekarang membaca token dari tabel `sessions`. Semua pemeriksaan bertanda tangannya berakhir `307 → /masuk`. Jalankan hanya kalau kamu sudah memperbarui cara membuat sesinya.

## Skills (read before touching the area)

`.agents/skills/` holds Agent Skills ([agentskills.io](https://agentskills.io/specification)) encoding this repo's non-obvious knowledge. Read the relevant one first:

- **`careevo-review`** — self-review checklist from real defects that shipped here (prototype-chain `in`, duplicated rules, field-contract drift, test quality, shell gotchas). Before committing.
- **`careevo-browser-verify`** — proving UI fixes in a real browser; `npm run check` was green while the tutor's mobile layout dropped 36px of every answer. Before claiming a page/flow is done.
- **`careevo-sijago`** — the framed `features/sijago/` app (branded **AI Mastery**): the `:8001`/`:8011`/`:3782`/`:3790` topology, the model-catalog API and why "No active LLM model is configured" is usually a stale profile, why `o2a/space-bunny-free` can't drive it, verifying the cross-origin frame, and the brand-rename split (rename the visible name; keep the `features/sijago/` path and internal `deeptutor` identifiers). Before editing or restarting anything under `features/sijago/`, or when a chat turn fails.
- **`loker-sentinel`** — the `/loker` audit: verdict policy, `flags` vs `fee_flags`, why verdicts are derived not stored. Before touching `src/lib/jobs/` or loker pages.
- **`loker-evaluasi`** — the A–H LLM evaluation: scoring model, schema-constrained output, failure policy. Before touching `src/lib/agents/evaluasi/`.
- **`loker-persiapan`** — the loker detail page's course recommendations + job-sourced mastery path: the deterministic shortlist, the LLM reasons that only decorate it, and the asymmetric failure policy (course list survives without a model, mastery path does not). Before touching `src/lib/jobs/rekomendasi-kursus.ts`, `src/lib/agents/{kursus-loker,jalur-loker}/`, `src/actions/loker-persiapan.ts`, or the two panels.
- **`careevo-attribution`** — MIT notice requirements for code ported from career-ops. Both vendor trees carry their own licences.
- **`career-ops-port`** — what was adopted from career-ops, what was rejected. Before proposing further integration. (`docs/career-ops-architecture-study.md` is historical.)
- **`career-ops-engine`** — driving the vendored `engine/`: exit-2-is-success, which of `pipeline.md` / `scan-history.tsv` / `scan-runs.tsv` answers what, the append race that duplicates postings. Before running/debugging a scan or changing what the inbox reads.

A skill with invalid frontmatter fails **silently** — `npm run skills:check` is the validator (`scripts/validate-skills.mjs`, which imports the direct dep `js-yaml`).

## Docs worth opening before non-trivial work

- `docs/local-db.md` — running/testing PostgreSQL locally, migrations, the rollback-as-forward runbook, admin bootstrap, reset, troubleshooting.
- `docs/outbox-worker.md` — worker/dead-letter runbook, lease & backoff, idempotency boundaries, and an explicit list of what is *not* verified.
- `docs/backend-production-plan.md` — the phase plan (Fase 0–6) and §2.2's "must not regress" list.
- `docs/adr/0001`–`0004` — deployment topology, PostgreSQL+Drizzle choice, immutable assessment snapshot, review/attestation state machine. **0001 and 0002 are still "proposed, not approved"** — do not treat the production topology as settled.
- `docs/security-release-checklist.md` — M0 release gate; it tracks *evidence*, not just code, and forbids self-approval.
- `DESIGN.md` — visual language, tokens, the catalog course card recipe.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
