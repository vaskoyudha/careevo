# AGENTS.md

Careevo — Next.js prototype ("Learn. Verify. Earn."): a learning-to-job bridge with HMAC attestations, append-only audit, and a Socrates review agent. **This is a fixture-backed prototype: there is no database and no network backend.** All app data comes from `src/fixtures/*.json` via `src/lib/fixtures.ts`.

## Commands

- `npm run dev` — dev server (Turbopack).
- `npm run build` / `npm start` — production build / serve.
- `npm run lint` — runs `eslint` (flat config). Note: **not** `next lint`.
- `npm run typecheck` — `tsc --noEmit`. Faster standalone check than a full `build`.
- `npm test` — `vitest run` (one-shot). `npm run test:watch` to watch.
- `npx vitest run src/lib/scoring/scoring.test.ts` — single file.
- `npx vitest run -t "A1:"` — single test by name.
- `npm run smoke [baseUrl]` — HTTP smoke test of 15 routes. **Requires a running server** (`npm run dev`) first; defaults to `http://localhost:3000`.

Deps use npm (`package-lock.json`); `node_modules` is not checked in — run `npm install` before any command.

## Testing quirks

- Vitest `include` is `src/**/*.test.ts` only. `.test.tsx` files are **not** picked up.
- Test environment is `node` (no jsdom) — tests cover pure logic only (`src/lib/scoring`, `src/lib/attestation`, plus a trivial `src/app/smoke.test.ts`).
- `@/` alias maps to `src/` in both `tsconfig.json` and `vitest.config.mts`; keep them in sync.

## Architecture

- App Router with route groups in `src/app/`: `(marketing)` = `/`, `(public)` = masuk/daftar/loker/`p/[username]`/`verify/[token]`, `(app)` = dashboard/belajar/loker/[id]/pengaturan/submission/[id], `(focus)` = challenge/[id], `(verifikator)` = review/review/[id]/audit.
- **Auth gating lives in the group layouts**, not middleware (there is no `middleware.ts`): `(app)` and `(focus)` redirect to `/masuk` when `getSession()` is null; `(verifikator)` additionally requires `isStaffRole`. Individual pages re-check `getSession()` and `return null` if absent.
- Auth is **cookie-only**: HMAC-signed session cookie `ls_session` (`src/lib/auth/session.ts`) and registered users in an HMAC-signed `ls_users` cookie capped at 20 (`src/lib/auth/user-store.ts`). Passwords are salted SHA-256, not bcrypt.
- Env: `SESSION_SECRET` and `ATTESTATION_SECRET` are optional — both fall back to dev defaults, so the app runs with no `.env`. `.env*` is gitignored.
- `src/actions/*.ts` are `"use server"` server actions (`auth.ts`, `review.ts`).
- Domain/business logic lives in `src/lib/{scoring,agents,attestation,audit,jobs,validation}`; UI in `src/components` (shadcn/ui under `src/components/ui`, feature components under `src/components/features`).

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
