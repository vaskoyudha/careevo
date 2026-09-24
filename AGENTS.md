# AGENTS.md

Careevo — Next.js prototype ("Learn. Verify. Earn."): a learning-to-job bridge with HMAC attestations, append-only audit, and a Socrates review agent. **This is a fixture-backed prototype: there is no database and no network backend.** Catalog/job data comes from `src/fixtures/*.json` via `src/lib/fixtures.ts`; the only other persistence is HMAC-signed cookies plus a small file-based store (see below).

## Commands

- `npm run dev` — dev server (Turbopack).
- `npm run build` / `npm start` — production build / serve.
- `npm run lint` — runs `eslint` (flat config). Note: **not** `next lint`.
- `npm run typecheck` — `tsc --noEmit`. Faster standalone check than a full `build`.
- `npm test` — `vitest run` (one-shot). `npm run test:watch` to watch.
- `npm run check` — **the gate**: typecheck + lint + skills:check + test.
- `npm run skills:check` — validate `.agents/skills/` against the Agent Skills spec.
- `npx vitest run src/lib/scoring/scoring.test.ts` — single file.
- `npx vitest run -t "A1:"` — single test by name.
- `npm run smoke [baseUrl]` — HTTP smoke test of 15 routes. **Requires a running server** (`npm run dev`) first; defaults to `http://localhost:3000`.

Deps use npm (`package-lock.json`); `node_modules` is not checked in — run `npm install` before any command.

## Skills

`.agents/skills/` holds Agent Skills (`SKILL.md`, [agentskills.io](https://agentskills.io/specification)) that encode this repo's non-obvious knowledge. Read the relevant one before working in its area:

- **`loker-sentinel`** — the job-board audit: verdict policy, the `flags` vs `fee_flags` contract, why verdicts are derived not stored. Read before touching `src/lib/jobs/` or the loker pages.
- **`loker-evaluasi`** — the A–H LLM evaluation: scoring model, why output is schema-constrained, the failure policy, key handling. Read before touching `src/lib/agents/evaluasi/` or the evaluation panel.
- **`careevo-review`** — self-review checklist built from real defects that shipped here. Read before committing.
- **`careevo-attribution`** — MIT notice requirements for code ported from career-ops. Read before adding adapted code.
- **`career-ops-port`** — what was adopted from career-ops, what was rejected and why. Read before proposing further integration.

A skill with invalid frontmatter fails silently, so `npm run skills:check` validates them.

## Testing quirks

- Vitest `include` is `src/**/*.test.ts` only. `.test.tsx` files are **not** picked up.
- Test environment is `node` (no jsdom) — tests cover pure logic only (`src/lib/scoring`, `src/lib/attestation`, `src/lib/resume`, plus a trivial `src/app/smoke.test.ts`).
- The file-based resume store's test points `CAREERS_DATA_DIR` at a temp dir **before** importing the module, so it never touches the repo's real `.data/`.
- `@/` alias maps to `src/` in both `tsconfig.json` and `vitest.config.mts`; keep them in sync.

## Architecture

- App Router with route groups in `src/app/`: `(marketing)` = `/`, `(public)` = masuk/daftar/loker/`p/[username]`/`verify/[token]` (plus `p/[username]/berkas/[slot]` for public CV/portfolio PDFs), `(app)` = dashboard/belajar/loker/[id]/pengaturan/submission/[id], `(focus)` = challenge/[id], `(verifikator)` = review/review/[id]/audit.
- **Auth gating lives in the group layouts**, not middleware (there is no `middleware.ts`): `(app)` and `(focus)` redirect to `/masuk` when `getSession()` is null; `(verifikator)` additionally requires `isStaffRole`. Individual pages re-check `getSession()` and `return null` if absent.
- Auth is **cookie-only**: HMAC-signed session cookie `ls_session` (`src/lib/auth/session.ts`) and registered users in an HMAC-signed `ls_users` cookie capped at 20 (`src/lib/auth/user-store.ts`). Passwords are salted SHA-256, not bcrypt.
- Env: `SESSION_SECRET` and `ATTESTATION_SECRET` are optional — both fall back to dev defaults, so the app runs with no `.env`. `.env*` is gitignored.
- `src/actions/*.ts` are `"use server"` server actions (`auth.ts`, `review.ts`, `courses.ts`, `enrollment.ts`, `evaluasi.ts`, `onboarding.ts`, `profile.ts`, `resume.ts`).
- Domain/business logic lives in `src/lib/{scoring,agents,attestation,audit,jobs,validation,profile,resume,onboarding,courses}`; UI in `src/components` (shadcn/ui under `src/components/ui`, feature components under `src/components/features`).
- **Two persistence patterns, deliberately different:**
  - **Signed cookies** (`src/lib/auth`, `src/lib/onboarding`, `src/lib/profile`) — small, tamper-evident JSON; `next/headers` is mocked in tests. The editable public profile (`src/lib/profile`) fits here because it is only a name, a bio and two downscaled images.
  - **File-based store** (`src/lib/resume`) — the LinkedIn-style resume (work/projects/education/skills/certifications, about + contact, and uploaded CV/portfolio PDFs). Unbounded in size, so it is written under `.data/` (gitignored) as JSON + files, **not** a cookie: a payload that big would silently exceed the ~4KB cookie limit and lose data with no error. Owner dirs are keyed by `sha256(email)` so a username can never traverse the tree; file names are `path.basename`-checked. Writes to `process.cwd()` fail on a read-only serverless FS — set `CAREERS_DATA_DIR` to a writable path there. Uploaded files are served publicly via `GET /p/[username]/berkas/[slot]` (product decision: a candidate shares their CV), and validated server-side (MIME + `%PDF-` magic bytes + 5MB cap) in `validasiBerkas`.

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
- **Learner pages (`/belajar`, `/belajar/[slug]`) use `LearnerShell` (top bar),
  NEVER `AppShell` (sidebar).** `AppShell` is reserved for dashboard-style
  pages (dashboard, admin, review, audit, challenge, submission, loker detail).
- Consequences: page tops under a transparent bar must be LIGHT (dark text
  stays readable); the learner navbar search is visible only in `.is-top`
  mode and hidden in pill mode (`.chrome.is-scrolled .learner-search`);
  search submits GET to `/belajar?q=`, and `BelajarPage` feeds it back as
  `queryAwal` (sliced to 120 chars).

## Stubs — do not assume these work

Several modules intentionally throw `"... belum diimplementasikan"` and are unimplemented placeholders: `logAudit` (`src/lib/audit/logger.ts`) and `runAgent`/`toAgentRun` (`src/lib/agents/orchestrator.ts`). The audit log and agent-run persistence are not wired up; pages read from fixtures instead.

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
