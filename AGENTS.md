# AGENTS.md

Careevo is a Next.js prototype ("Learn. Verify. Earn."): a learning-to-job bridge with HMAC attestations, fixture-backed audit data, and a Socrates review agent. Core fixture data is loaded through `src/lib/fixtures.ts`. Auth, onboarding, and course state also use cookie or in-process state. Gemini evaluation is an optional, on-demand network call.

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
- **`careevo-attribution`** — MIT notice requirements for code ported from career-ops. Read before adding adapted code.
- **`career-ops-port`** — what was adopted from career-ops, what was rejected and why. Read before proposing further integration.

`docs/career-ops-architecture-study.md` is historical. The current port decision source is the `career-ops-port` skill.

A skill with invalid frontmatter fails silently, so `npm run skills:check` is the validator. `scripts/validate-skills.mjs` imports `js-yaml`, which is a direct dependency in `package.json`.

## Testing quirks

- Vitest `include` is exactly `src/**/*.test.ts`; `.test.tsx` and browser tests are not included.
- Test environment is `node`, with no jsdom or browser test runner.
- `@/` alias maps to `src/` in both `tsconfig.json` and `vitest.config.mts`; keep them in sync.

## Architecture

- App Router uses route groups in `src/app/`: `(marketing)` (`/`, `/careevo-plus`), `(public)` (for example `/masuk`, `/kerja`, `/loker`, `/p/[username]`, `/verify/[token]`, and catalog routes such as `/explore/most-popular-courses` and `/specializations/[slug]`), `(onboarding)` (`/onboarding`, `/onboarding/demo`), plus learner `(app)`, focus `(focus)`, and staff `(verifikator)` pages.
- **Auth gating lives in the group layouts**, not middleware (there is no `middleware.ts`): `(app)` redirects missing sessions to `/masuk` and learner sessions without a completed profile to `/onboarding`; `(focus)` checks the session and completed profile, redirecting missing profiles to `/onboarding`; `(verifikator)` checks the session and `isStaffRole()`. Individual pages re-check `getSession()` and `return null` if absent.
- Auth is **cookie-only**: HMAC-signed session cookie `ls_session` (`src/lib/auth/session.ts`) and registered users in an HMAC-signed `ls_users` cookie capped at 20 (`src/lib/auth/user-store.ts`). Passwords are salted SHA-256, not bcrypt.
- Env: `SESSION_SECRET` and `ATTESTATION_SECRET` are optional and fall back to dev defaults, so the app runs with no `.env`; `GEMINI_API_KEY` is optional and enables the on-demand evaluation. `.env*` is gitignored.
- `src/actions/*.ts` are `"use server"` server actions: `auth.ts`, `review.ts`, `onboarding.ts`, `profile.ts`, `enrollment.ts`, `courses.ts`, and `evaluasi.ts`.
- Domain/business logic lives in `src/lib/{scoring,agents,attestation,audit,jobs,validation,courses,onboarding,profile}`; UI in `src/components` (shadcn/ui under `src/components/ui`, feature components under `src/components/features`).

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
