# Dashboard: Stop Unverified Claims Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/dashboard` stops rendering a score, streak, attendance timer, Navigator list, and badge list that no database row backs, while keeping the two surfaces on that page that are real.

**Architecture:** Delete the fixture-driven `DashboardView` entirely rather than patching it, preserve its one honest block ("Cari lowongan") as a new focused component, and delete the code that becomes dead with it (`CheckinWidget`, `jalankanNavigator`). Guard the result with a source-scanning test in the idiom already established by `src/lib/learning/security.test.ts`, so the fixture dashboard cannot quietly return.

**Tech Stack:** Next.js 16.3.5 (App Router, React Server Components), React 19, Tailwind v4 CSS-first, TypeScript, Vitest 5 (`environment: node`, no jsdom).

**Spec:** This plan is the first half of the pair agreed after the dashboard review on 2026-09-27. Its sibling, `docs/superpowers/plans/2026-09-27-real-attendance-and-jadwal-score.md`, rebuilds the accountability layer for real. **Plan 1 is a precondition for Plan 2** — Plan 2 writes into the same components Plan 1 removes, so doing them in the other order means writing code that is about to be deleted.

## Global Constraints

These apply to every task in this plan.

- **UI copy and `<html lang>` are Indonesian (`id`).** Every user-visible string in this plan is Indonesian. Do not translate them to English.
- **Business-logic identifiers are Indonesian; infra/UI identifiers are English.** Match the surrounding file's language. The new component created in Task 2 is named `JobInboxCard` because it is a presentational card; everything inside it that is a business concept stays Indonesian (`InfoChip`, `CardHead`).
- **Tailwind v4 is CSS-first.** There is no `tailwind.config.js`. Reuse the existing card recipe string verbatim; do not introduce arbitrary values.
- **No new dependencies.** Vitest runs in `environment: node` with no jsdom, so no component may be rendered in a test. This is why Task 1 tests source text — the same technique `src/lib/learning/security.test.ts` already uses for exactly this reason.
- **`npm run check` is the gate** (`typecheck` → `lint` → `skills:check` → `test`). It runs neither `build` nor `test:db`, so a green `check` does not prove the client/server import boundary is intact. Task 3 covers that separately.
- **Do not touch `/challenge/[id]`, `/p/[username]`, `src/fixtures/profile.json`, `src/fixtures/tasks.json`, `src/lib/scoring/`, or `src/lib/agents/sentinel.ts`.** All are out of scope; the reasoning is recorded per file in Task 2 Step 4.

---

## File Structure

| File | Action | Responsibility after this plan |
|---|---|---|
| `src/app/(app)/dashboard/page.tsx` | Modify | Session gate, page head, two real cards. No fixture import. |
| `src/components/features/dashboard/dashboard-view.tsx` | **Delete** | Gone. It was the fixture surface. |
| `src/components/features/dashboard/checkin-widget.tsx` | **Delete** | Gone. `localStorage` timer, never sent to the server. |
| `src/components/features/dashboard/job-inbox-card.tsx` | Create | The preserved "Cari lowongan" block, and nothing else. |
| `src/lib/agents/navigator.ts` | **Delete** | Gone. Only caller was `DashboardView`. |
| `src/lib/learning/dashboard-integritas.test.ts` | Create | Guard: the learner dashboard cannot read fixture data or claim a streak. |
| `src/components/features/dashboard/dashboard-recommendations.tsx` | Unchanged | Already real — reads the signed onboarding profile. |
| `src/components/ui/progress-bar.tsx` | Unchanged | `BarRow` still used by `/p/[username]`. |

`src/lib/hooks/use-persistent-state.ts` is left in place. `CheckinWidget` was its only consumer, so it becomes unreferenced, but it is a generic hook and removing it is a separate cleanup — see Task 3 Step 3.

---

### Task 1: Regression guard for the learner dashboard

The guard is written first and must fail before anything is deleted. A test that only passes after the deletion proves nothing about the deletion; a test that fails first proves it was watching.

**Files:**
- Create: `src/lib/learning/dashboard-integritas.test.ts`
- Test: `src/lib/learning/dashboard-integritas.test.ts`

**Interfaces:**
- Consumes: nothing. This task adds no production code.
- Produces: the test file `src/lib/learning/dashboard-integritas.test.ts`, extended by Task 2 and consumed unchanged by later plans. No exported symbols.

- [ ] **Step 1: Write the failing test**

Create `src/lib/learning/dashboard-integritas.test.ts`:

```ts
/**
 * Pemeriksaan statis untuk halaman dashboard peserta — **bukan** uji render.
 *
 * Repositori ini menjalankan Vitest di `environment: node` (tanpa jsdom), jadi
 * komponen server tidak bisa dirender di sini. Properti yang dijagapun adalah
 * properti *batas*: halaman dashboard tidak boleh membaca data fixture dan
 * tidak boleh menampilkan klaim yang tidak bisa ditelusuri ke baris milik akun
 * yang sedang masuk. Pendekatan sumber-teks ini sama dengan yang dipakai
 * `src/lib/learning/security.test.ts`, dan alasannailsnya juga sama: yang hilang
 * paling cepat di sini adalah sebuah kartu yang ditambahkan kembali.
 *
 * Uji ini sengaja memindai seluruh folder komponen dashboard, bukan satu
 * berkas. Akar masalahnya bukan satu file yang salah — itu_folder_ yang
 *কেholds the prototype, dan file berikutnya akan menirunya.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");
const BERKAS_DASHBOARD = path.join(ROOT, "src/app/(app)/dashboard/page.tsx");
const DIR_DASHBOARD = path.join(ROOT, "src/components/features/dashboard");

/** Sumber seluruh komponen dashboard peserta. */
function sumberKomponenDashboard(): Array<{ nama: string; isi: string }> {
  return readdirSync(DIR_DASHBOARD)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => ({ nama: f, isi: readFileSync(path.join(DIR_DASHBOARD, f), "utf8") }));
}

describe("dashboard peserta tidak mengklaim angka yang tidak bisa ditelusuri", () => {
  it("halaman dashboard tidak mengimpor profil fixture", () => {
    // `src/fixtures/profile.json` adalah profil fiktif "@budi" dengan skor 87/100.
    // Membacanya di sini membuat setiap akun yang masuk melihat rekam jejak orang
    // lain seolah-olah miliknya sendiri — dan itulah yang terjadi sebelum rencana ini.
    expect(readFileSync(BERKAS_DASHBOARD, "utf8")).not.toContain("@/lib/fixtures");
  });

  it("tidak ada komponen dashboard yang membaca profil fixture", () => {
    for (const { nama, isi } of sumberKomponenDashboard()) {
      expect(`${nama}: ${isi}`, `${nama} mengimpor @/lib/fixtures`).not.toContain(
        "@/lib/fixtures",
      );
    }
  });

  it("kartu yang dihapus tidak kembali sebagai nama komponen", () => {
    // both the file and the exported name are checked: a file can be renamed to
    // dodge the first check, but it still has to render something.
    for (const { nama } of sumberKomponenDashboard()) {
      expect(nama).not.toBe("checkin-widget.tsx");
      expect(nama).not.toBe("dashboard-view.tsx");
    }
  });

  it("copy halaman tidak lagi menjanjikan streak dan Navigator", () => {
    // `PageHead.lead` di halaman ini masih menyebut "Jadwal, streak, rekomendasi
    // Navigator" — janji yang tidak lagi didukung halaman apa pun setelah Task 2.
    const isi = readFileSync(BERKAS_DASHBOARD, "utf8");
    expect(isi).not.toMatch(/streak/i);
    expect(isi).not.toMatch(/navigator/i);
  });

  it("halaman tetap menampilkan dua permukaan nyata", () => {
    // Penjaga penutup. Tanpa ini, cara palingcheap untuk membuat semua uji di
    // atas hijau adalah mengosongkan halaman — dan halaman kosong juga lolos.
    // Rekomendasi personal dan tauran lowongan adalah dua hal yang benar-benar
    // ada, jadi keduanya harus tetap di sini.
    const isi = readFileSync(BERKAS_DASHBOARD, "utf8");
    expect(isi).toContain("DashboardRecommendations");
    expect(isi).toContain("JobInboxCard");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/learning/dashboard-integritas.test.ts`

Expected: FAIL. All five cases fail, each for the right reason:

- `halaman dashboard tidak mengimpor profil fixture` — the page does not import `@/lib/fixtures` today, so this one **passes** already. The four that fail are the ones that matter:
  - `tidak ada komponen dashboard yang membaca profil fixture` fails on `dashboard-view.tsx`, which has `import { getTask, tasks, profile, cleanJobs } from "@/lib/fixtures";`.
  - `kartu yang dihapus tidak kembali sebagai nama komponen` fails on both `checkin-widget.tsx` and `dashboard-view.tsx` being present.
  - `copy halaman tidak lagi menjanjikan streak dan Navigator` fails on `page.tsx` line 23, whose lead reads `"Jadwal, streak, rekomendasi Navigator, dan skor terverifikasi dalam satu tempat."`.
  - `halaman tetap menampilkan dua permukaan nyata` fails on `JobInboxCard`, which does not exist yet.

Read the failure output and confirm each failing assertion names the file you expect. If `halaman dashboard tidak mengimpor profil fixture` fails, something other than this plan changed the page — stop and re-read it.

- [ ] **Step 3: Commit the failing guard**

```bash
git add src/lib/learning/dashboard-integritas.test.ts
git commit -m "test: guard dashboard peserta dari klaim yang tidak bisa ditelusuri

Uji sumber-teks (tanpa jsdom) yang menjaga dua batas: dashboard tidak
membaca @/lib/fixtures, dan copy-nya tidak menjanjikan streak/Navigator
yang tidak lagi ada. Ditutup uji 'dua permukaan nyata' supaya halaman
tidak bisa dihoskan dengan mengosongkannya."
```

A red test committed on its own is intentional here: it records the defect the plan removes, so the removal is provable in the history.

---

### Task 2: Remove the fixture dashboard surface

**Files:**
- Delete: `src/components/features/dashboard/dashboard-view.tsx`
- Delete: `src/components/features/dashboard/checkin-widget.tsx`
- Delete: `src/lib/agents/navigator.ts`
- Create: `src/components/features/dashboard/job-inbox-card.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx:1-31`
- Test: `src/lib/learning/dashboard-integritas.test.ts`

**Interfaces:**
- Consumes: `InfoChip`-equivalent styling copied inline; `/loker/inbox` route.
- Produces:
  - `export function JobInboxCard(): JSX.Element` — a server component with no props, rendering one card. Imported by `src/app/(app)/dashboard/page.tsx`.

Verified before planning, so you do not have to re-check:

- `jalankanNavigator` has exactly one caller — `dashboard-view.tsx:90`.
- `CheckinWidget` has exactly one caller — `dashboard-view.tsx:131`.
- `DashboardView` has exactly one importer — `src/app/(app)/dashboard/page.tsx:6`.
- `BarRow` has a second, surviving caller — `src/app/(public)/p/[username]/page.tsx:65` — so `src/components/ui/progress-bar.tsx` must **not** be deleted.
- `profile` from `@/lib/fixtures` is still consumed by `src/app/(public)/p/[username]/page.tsx`, so `src/fixtures/profile.json` and `getProfile` stay.

- [ ] **Step 1: Create the preserved card**

Create `src/components/features/dashboard/job-inbox-card.tsx`:

```tsx
import Link from "next/link";

/**
 * Kartu "Cari lowongan" — satu-satunya blok di dashboard lama yang kebetulan
 * benar: isinya hanya penjelasan dan tautan ke `/loker/inbox`, tanpa satu pun
 * angka. Blocks ini dipisah dari `DashboardView` supaya halaman dashboard
 * tidak lagi needing a wrapper yang menyamar sebagai "the dashboard".
 *
 * Kartu memakai resep kartu katalog belajar yang sama dengan blok lain di
 * aplikasi (`rounded-xl`, `border-gray-200`, `shadow-xs`) supaya dashboard dan
 * katalog terbaca sebagai satu produk.
 */
export function JobInboxCard() {
  return (
    <section
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs"
      aria-labelledby="cari-title"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="text-base font-bold text-gray-900" id="cari-title">
            Cari lowongan
          </h2>
          <p className="mt-0.5 text-[13px] text-gray-500">
            Pindai papan lowongan publik, lalu buka dan lacak yang kamu minati
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-[#0056D2]">
          Job seeker
        </span>
      </div>
      <p className="text-xs leading-relaxed text-gray-500">
        Lowongan ditemukan disimpan sebagai inbox, belum jadi lamaran. Tidak ada
        yang dikirim otomatis — kamu yang memutuskan.
      </p>
      <Link
        className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-[#0056D2] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#00419e]"
        href="/loker/inbox"
      >
        Buka lowongan ditemukan
      </Link>
    </section>
  );
}
```

Note on the two blocks of code above: the class strings are copied verbatim from `dashboard-view.tsx:183-199`, including the `InfoChip` styling that was previously produced by the local `InfoChip` helper. The helper is not recreated — one chip does not justify a component.

- [ ] **Step 2: Rewrite the dashboard page**

Replace the whole of `src/app/(app)/dashboard/page.tsx`:

```tsx
import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/onboarding/store";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { DashboardRecommendations } from "@/components/features/dashboard/dashboard-recommendations";
import { JobInboxCard } from "@/components/features/dashboard/job-inbox-card";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * Dashboard peserta.
 *
 * Permukaan ini hanya menampilkan yang bisa ditelusuri ke akun yang sedang
 * masuk: rekomendasi dari profil onboarding yang ditandatangani, dan tautan ke
 * inbox lowongan. Skor, streak, dan absensi **tidak** ada di sini — angka
 * tersebut dibangun dari `learning_runs` di
 * `docs/superpowers/plans/2026-09-27-real-attendance-and-jadwal-score.md`.
 *
 * `dashboard-integritas.test.ts` menjaga batas ini.
 */
export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const profile = await getProfile(session.email);

  return (
    <AppShell session={session} current="/dashboard">
      <PageHead
        title={`Halo, ${session.nama}`}
        lead="Rekomendasi belajar dan lowongan yang sudah disesuaikan dengan minatmu."
      />
      {profile ? (
        <div className="mb-6">
          <DashboardRecommendations profile={profile} />
        </div>
      ) : null}
      <div className="grid gap-6">
        <JobInboxCard />
      </div>
    </AppShell>
  );
}
```

The `lead` prop is the load-bearing change: the old string promised "Jadwal, streak, rekomendasi Navigator, dan skor terverifikasi". A page head that advertises removed features is the same defect as the cards themselves, in text form.

- [ ] **Step 3: Delete the fixture surface**

```bash
git rm src/components/features/dashboard/dashboard-view.tsx
git rm src/components/features/dashboard/checkin-widget.tsx
git rm src/lib/agents/navigator.ts
```

`src/lib/scoring/jadwal.ts` and `src/lib/scoring/validasi.ts` stay, and so does `src/lib/scoring/scoring.test.ts`. They have no non-test callers today and will get real ones in the sibling plan; deleting them here would throw away a tested scoring contract that Plan 2 is about to wire up.

- [ ] **Step 4: Run the guard test to verify it passes**

Run: `npx vitest run src/lib/learning/dashboard-integritas.test.ts`

Expected: PASS, 5/5.

If `tidak ada komponen dashboard yang membaca profil fixture` fails, a file in that folder still imports `@/lib/fixtures`. `readdirSync` in the test is not filtered by git, so an untracked leftover will still be caught — which is the intent.

- [ ] **Step 5: Run the full gate**

Run: `npm run check`

Expected: PASS — typecheck, lint, `skills:check`, and the unit suite.

Typecheck is the real test for a deletion: any surviving reference to `DashboardView`, `CheckinWidget`, `jalankanNavigator`, `BarRow`-from-dashboard, or `InfoChip` shows up here as an unresolved import or an unused-symbol error.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(dashboard): hapus skor, streak, timer, dan Navigator fixture

Empat blok dashboard di /dashboard menampilkan angka yang tidak ditopang
baris database mana pun: skor 87/100 dan 3 badge dari profil fixture,
streak \"5 hari\" dan \"kepatuhan 82%\" sebagai string literal,
7/10 jam dari konstanta, dan Navigator yang micro-sorting berdasarkan
level. Timer check-in menulis ke localStorage dan tidak pernah dikirim
ke server, sehingga tidak bisa memindahkan skor seperti yang diklaim
keterangan di bawahnya.

Blok 'Cari lowongan' adalah satu-satunya yang benar (tautan saja, tanpa
angka), jadi ia dipertahankan sebagai JobInboxCard. Rekomendasi personal
yang sudah nyata tidak berubah.

Dashboard sekarang hanya menampilkan yang bisa ditelusuri ke akun yang
sedang masuk. Absensi dan skor Jadwal dibangun ulang di rencana
2026-09-27-real-attendance-and-jadwal-score.md."
```

---

### Task 3: Verify the real page in a browser

`npm run check` being green says nothing about whether the page still renders. This repo has shipped a green `check` alongside a page that dropped 36px of every answer, so the browser pass is not optional.

**Files:**
- No code changes expected. If a change is needed, it belongs in Task 2.
- Verify: the running app at `http://localhost:3000/dashboard`

**Interfaces:**
- Consumes: the page from Task 2.
- Produces: no code. Evidence that the change works, recorded in the commit message of any fix.

- [ ] **Step 1: Confirm the stack is up**

Run: `ss -ltnp | grep -E ':(3000|3790|8011|5432)\b'`

Expected: port `3000` listening. Do **not** use a `/dev/tcp` probe — it reports false negatives on this machine and will convince you the server is down when it is up.

If `3000` is not listening, start it with `npm run dev` before continuing. A `307` redirect from `/dashboard` to `/masuk` is correct behaviour for a logged-out request, not a broken route.

- [ ] **Step 2: Sign in and read the page**

Open `http://localhost:3000/dashboard` in a signed-in session. Confirm all four of the following, and confirm each is absent:

| Must be present | Must be absent |
|---|---|
| `Halo, <name>` page head, lead reads "Rekomendasi belajar dan lowongan yang sudah disesuaikan dengan minatmu." | the string "Streak" |
| "Dipilih untukmu" card, if the account finished onboarding | "Kepatuhan jadwal" |
| "Cari lowongan" card with a working "Buka lowongan ditemukan" button | "Check-in sekarang" |
| | "Skor total" and the four stat tiles |
| | "Rincian skor" |
| | "Rekomendasi Navigator" |
| | "Badge terbaru" |

The "must be absent" column is the actual acceptance criterion. A page that renders fewer cards than before but still shows a score is not done.

- [ ] **Step 3: Follow the surviving link**

Click "Buka lowongan ditemukan" and confirm it lands on `/loker/inbox` without a 404 or a redirect loop.

- [ ] **Step 4: Confirm the two deliberately-untouched surfaces still work**

These are out of scope for this plan and must be unchanged. A green `check` does not prove a route still renders, so verify them explicitly:

- `http://localhost:3000/p/budi` — public profile, still shows the 87/100 score bars and the "HMAC OK" badges.
- `http://localhost:3000/challenge/2` — fixture challenge workbench, still renders its brief and criteria.

- [ ] **Step 5: Run a production build**

Run: `npm run build`

Expected: PASS. This is the only step in the plan that catches a client/server import violation, because `check` does not run `build`. `JobInboxCard` has no `"use client"` and no data access, so it must build as a server component without complaint.

- [ ] **Step 6: Record the outcome**

If every check passed, there is nothing to commit. If Step 2 found a leftover card, fix it in `src/app/(app)/dashboard/page.tsx`, re-run `npm run check`, and commit:

```bash
git add -A
git commit -m "fix(dashboard): buang kartu sisa yang masih menampilkan klaim fixture"
```

---

## Out of Scope

Recorded here so a later reader — or a later agent — does not treat these as oversights.

- **`/challenge/[id]`** (`src/app/(focus)/challenge/[id]/page.tsx`) stays fixture-backed. It is a challenge workbench reachable by direct URL, and removing it deletes a demo surface without touching the false-claim problem, which is specific to a page a signed-in user reads as their own record.
- **`/p/[username]`** (`src/app/(public)/p/[username]/page.tsx`) stays fixture-backed. It presents a public credential page for a named account (`@budi`) reachable by URL. The claim it makes is "this is what `@budi`'s public profile looks like", which is a different claim from "this is your score". It would need the same treatment eventually, but it is a separate surface with a separate audience.
- **`src/fixtures/profile.json`, `src/fixtures/tasks.json`, `getProfile`, `getTask`, `cleanJobs`** all stay. They still have live consumers after this plan.
- **`src/lib/scoring/jadwal.ts` and `validasi.ts`** stay, tested and still uncalled. The sibling plan wires them up.
- **`src/lib/hooks/use-persistent-state.ts`** becomes unreferenced when `CheckinWidget` is deleted, and is left in place. It is a generic hook with a `parseJson` / `setPersistentValue` / `usePersistentValue` surface; removing it is a separate cleanup that should happen either when a second consumer appears or when the dead-code sweep is done on purpose, not as a side effect of this plan.
