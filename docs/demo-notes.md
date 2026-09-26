# Demo Notes — Job Seeker / Loker (Careevo)

> **Last verified:** 2026-09-26 on branch `vasco` (8 commits, not pushed).
> **Demo scope:** Indonesian-only job discovery, isolated data root. Real data untouched.

---

## 1. What this demo shows

The job-seeker side of Careevo, end to end:

1. **Masuk (sign-in)** — session-gated app shell.
2. **Onboarding** — profile that drives the career recommendations.
3. **Loker inbox (`/loker/inbox`)** — 17 real Indonesian AI/tech postings discovered by the scanner.
4. **Fraud verdict on every row** — the feature just built: each posting shows
   `Aman` / `Perlu ditinjau` / `Ditolak` / `Belum diperiksa`, derived by the
   existing Sentinel audit, not stored.

Measured on the live demo data: **16 `Aman` / 1 `Perlu ditinjau`** (the one is
the genuine `Private Advertiser`).

---

## 2. Start the demo (isolated data root)

```bash
cd ~/Documents/github/careevo

# 1. Kill any dev server on :3200
ss -ltnp | grep :3200   # note the pid, then kill it

# 2. Start dev, pointed at the throwaway demo root (NOT your real data)
env -u CAREER_OPS_DATA_DIR CAREER_OPS_ROOT=/tmp/opencode/demo-root \
  npx next dev -p 3200

# 3. Open
open http://127.0.0.1:3200/masuk
```

**Do not** start without `CAREER_OPS_ROOT=/tmp/opencode/demo-root` — the default
root is the real pipeline (486 rows). The demo root has the 17 Indonesian rows.

Restore the default server afterwards:

```bash
ss -ltnp | grep :3200   # kill it
npx next dev -p 3200    # back on the default data root
```

---

## 3. Sign in (cookie shortcut)

The app gates on an HMAC-signed `ls_profile` cookie. For a demo, inject it
instead of walking onboarding (secret: `dev-session-secret-careevo`):

```
Cookie: ls_profile=<value below>
```

```
eyJvd25lciI6ImRlbW8uaWRAY2FyZWV2by50ZXN0IiwiZXhwZXJpZW5jZSI6Im1lbmVuZ2FoIiwiYmFja2dyb3VuZCI6Im1haGFzaXN3YSIsImludGVyZXN0cyI6WyJkYXRhIiwiYWkiXSwiZ29hbCI6ImRhcGF0LWtlcmphIiwid2Vla2x5SG91cnMiOjgsIndvcmtQcmVmZXJlbmNlIjoicmVtb3RlIiwiY29tcGxldGVkQXQiOiIyMDI2LTA5LTI2VDA0OjE4OjI5LjQyOFoiLCJ2ZXJzaW9uIjoyfQ.IhNLvsk7Sf2U6Bp0Q2NODx6kSTSiiXBaKCrHpnSv1vE
```

Payload: owner `demo.ila@careevo.test`, goal `dapat-kerja`, remote preference.

If you prefer the human path: `/masuk` → sign in → `/onboarding` → complete →
redirect to `/loker/inbox`.

---

## 4. Walkthrough script

| # | Where | Say / show |
|---|-------|------------|
| 1 | `/masuk` | Sign-in gate; Careevo owns auth, not the engine. |
| 2 | `/onboarding` | Profile feeds career direction (`dapat-kerja`, remote). |
| 3 | `/loker/inbox` | "Ini 17 lowongan asli dari Jobstreet Indonesia, dipindai mesin." |
| 4 | verdict badge | Point at `Aman` on most rows. |
| 5 | `Private Advertiser` | Point at `Perlu ditinjau`, hover: *"Sinyal: Nama perusahaan tidak bisa diverifikasi"*. |
| 6 | honesty line | "Kalau datanya tidak bisa diambil, kami tulis **Belum diperiksa**, bukan Aman." |

Talking points (all measured, don't over-claim):

- Engine scanned **Jobstreet ID** with a zero-token, no-LLM provider; **Glints
  hard-blocked** (HTTP 403 firewall), so Jobstreet carries the Indonesian feed.
- Verdict is **derived at read time**, never written into `pipeline.md` — delete
  the cache and it re-derives.
- Sentinel audit reused as-is: **no new escalation policy, no new trust rules**
  (`jobstreet.com` was already allowlisted, `bit.ly` already flagged).
- Gates: `npm run check` exit 0 — **1,149 tests**, 0 errors, 7 skills valid;
  `next build` green first attempt.

---

## 5. Honest limits (say these if asked)

- **The full description is unobtainable.** Jobstreet's detail endpoint 404s and
  the job page is client-rendered, so most of the 8 fee-language rules have
  little to match. This catches *structural* and *anonymity* fraud well;
  *demand-language* fraud poorly.
- **`Ditolak` (rejected) never appeared in live data** — no real listing carried
  two independent signals. That tier is unit-tested only.
- **Cold-cache first load untimed.** The measured 556 ms load used a warm cache.
- **Filter chips are unverified as interactive** — there is a known, unresolved
  hydration issue (`no __reactProps$` keys, chips do nothing, onboarding
  `Lanjut` stays disabled). Don't click filters in the demo unless fixed.
- **CV matching is a separate subsystem** — not in this demo.

---

## 6. Screenshots (in `docs/shots/`)

| File | What |
|------|------|
| `01-masuk.png` | sign-in |
| `02-dashboard.png` | app shell |
| `03-inbox.png` | inbox (early) |
| `05-scanning.png` / `06-scan-result.png` | scan flow |
| `07-mobile-inbox.png` | mobile inbox (early) |
| `10-inbox-indonesia-desktop.png` | 17 Indonesian rows, desktop |
| `12-inbox-indonesia-mobile.png` | same, mobile |
| `13-inbox-fraud-verdict.png` | **verdict badges (this feature)** |
| `14-inbox-fraud-verdict-mobile.png` | same, mobile (chip strip 24px, no H-scroll) |
| `15-loker-course-recs-desktop.png` | `/loker/1` — course recommendations populated (full page) |
| `16-loker-course-recs-cards.png` | same, the two new cards close up |
| `17-loker-course-recs-before.png` | the cards before clicking (buttons visible) |

---

## 7. Repo facts (if asked "what did we change")

- 8 commits on `vasco` (`cafa9a4`…`a9a4ff3`), **not pushed**.
- Vendored `engine/` **untouched** — Careevo enriches after the scan.
- Plan + execution record: `docs/superpowers/plans/2026-09-26-inbox-fraud-audit.md`.
- New files: `src/lib/career-ops/jobstreet-audit.ts`, `jobstreet-enrich.ts`,
  `inbox-audit.ts` (+ tests); modified `sentinel.ts`, `inbox.ts`, `inbox-list.tsx`,
  `globals.css`, inbox page.
- Cache lives at `.data/jobstreet-cache/listings.json` (gitignored, Careevo-owned).

---

## 8. Don't touch during the demo

- `.data/career-ops/` — real 486-row pipeline (md5 `4b03228…`).
- `.next/` — shared with other sessions (`:3782`/`:3790` AI Mastery). No `rm -rf .next`.
- `:20128` — the 9Router LLM port (not used by this demo).
- `features/sijago/` — separate app, separate skill (`careevo-sijago`).
