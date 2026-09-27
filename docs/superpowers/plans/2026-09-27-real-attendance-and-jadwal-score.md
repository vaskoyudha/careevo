# Real Attendance and Jadwal Score Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `/dashboard` a weekly-hours figure, a streak, and the 30-point Jadwal score that are each derived from the signed-in account's own `learning_runs` rows, replacing the hardcoded values removed by the sibling plan.

**Architecture:** Three layers, each testable on its own. A pure module (`kehadiran.ts`) turns `LearningRun[]` into a streak, attended-session count, and effective hours with no I/O. A repository query (`runDalamRentang`) reads only the trailing-week window. A service (`jadwal-service.ts`) assembles those into `hitungSkorJadwal`'s existing input shape. The UI renders what the service returns, and its ticking clock is display-only — every scored number comes from database columns.

**Tech Stack:** Next.js 16.3.5 (App Router, React Server Components + one client island), React 19, Drizzle ORM over PostgreSQL 18, Vitest 5 in two suites (`npm test` unit, `npm run test:db` integration).

**Spec:** Second half of the pair agreed after the dashboard review on 2026-09-27. Its precondition is `docs/superpowers/plans/2026-09-27-dashboard-stop-unverified-claims.md` — that plan deletes `DashboardView` and `CheckinWidget`, and this plan writes into the space it leaves. Do not start this plan before that one is merged.

## Global Constraints

These apply to every task in this plan.

- **UI copy and `<html lang>` are Indonesian (`id`).** Every user-visible string here is Indonesian.
- **Business-logic functions are named in Indonesian** (`ringkasKehadiran`, `hitungStreak`, `durasiMenit`, `jadwalPemainDb`); infra and UI names are English (`BarRow`, `SesiHariIniCard`). Match the surrounding file's language.
- **No new table, no migration.** `learning_runs` already carries `user_id`, `state`, `started_at`, `completed_at`, and `expires_at` with a `learning_runs_user_id_idx` index. Every number this plan needs is derivable from those columns. Do not add a schema change, do not run `db:generate`, and do not touch `src/lib/db/schema.ts` or `drizzle/`. The earlier estimate that this work would need "an attendance table" was wrong; the window query below is the whole data layer.
- **The scored denominators are server-owned constants.** `TARGET_JAM_MINGGUAN_SKOR` and `JUMLAH_SESI_JADWAL_MINGGUAN` live in `jadwal-service.ts` and are never read from the client, the profile, or a form. The reasoning is in "Scored denominators" below and is the single most important design decision in this plan.
- **The ticking clock is display-only.** `SesiTicker` reads `startedAt` from the server and advances with the browser's own `Date.now()`, but the scored duration is always `completed_at - started_at` from the database. A learner editing the clock in devtools changes a number on screen and nothing else.
- **Do not re-read `@/lib/fixtures` on the learner dashboard.** `src/lib/learning/dashboard-integritas.test.ts`, added by the sibling plan, fails the build if it happens.
- **`getDb()` is server-only.** It must not be reachable from a client component. Only `repository.ts` calls it, and `jadwal-service.ts` is imported by server components only.
- **`.integration.test.ts` is a contract.** A DB test that omits the suffix joins `npm test` and breaks the promise that the unit suite runs without PostgreSQL. Only Task 2 and Task 3 Step 5 add such files, and Task 2 deliberately extends an existing one instead of creating a new file.
- **Use `denganTransaksi` and thread the `TransaksiDb` you are given.** This plan only reads, so no transaction is needed — but if you find yourself adding one, `getDb()` inside `fn` escapes it and stays invisible until a rollback.

## Scored denominators

`hitungSkorJadwal` (`src/lib/scoring/jadwal.ts`) already exists, is unit-tested, and has no non-test callers. Its input wants two denominators: `scheduledSessions` and `weeklyTargetHours`. This plan does not change its formula — the 30 points stay 20 for session compliance plus 10 for hours, matching the documented jadwal(30) + karya(40) + validasi(30) scale.

The obvious source for both denominators is `profile.weeklyHours` from the onboarding cookie, and **that would be a regression.** The cookie is HMAC-signed, so a learner cannot edit the number — but they can re-run `/onboarding?edit=1` and legitimately re-declare it at any time. Scoring attendance against a denominator the scored party chooses is the "don't let the browser decide eligibility" rule in `AGENTS.md`, wearing a different hat: lower the declared target to `3` and `hoursRatio` becomes trivially `1.0`. A credential must not be inflatable by re-answering a form.

So both denominators are constants of product policy, sitting next to each other where a reviewer can see them:

- `JUMLAH_SESI_JADWAL_MINGGUAN = 3` — the baseline commitment, three attended sessions a week. Feeds the 20-point compliance term.
- `TARGET_JAM_MINGGUAN_SKOR = 5` — the hours floor, five hours a week. Feeds the 10-point hours term.

The learner's own `weeklyHours` is still read, still displayed, and still drives course recommendations in `rekomendasi.ts` — it is simply never a denominator. If a reviewer wants these numbers changed, the change is one edit in one file with a test that has to move with it.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/learning/kehadiran.ts` | Create | Pure. `LearningRun` rows → streak, attended count, effective hours. No I/O, no clock of its own. |
| `src/lib/learning/kehadiran.test.ts` | Create | Unit tests for the above, including month-boundary and grace-day cases. |
| `src/lib/learning/repository.ts` | Modify | Add `runDalamRentang(userId, dari, sampai)`. Read-only, indexed. |
| `src/lib/learning/run-service.integration.test.ts` | Modify | Extend with `runDalamRentang` cases. Reuses the file's existing `kosongkan()`. |
| `src/lib/learning/jadwal-service.ts` | Create | Window → `hitungSkorJadwal` input → scored result. Owns the two constants. |
| `src/lib/learning/jadwal-service.test.ts` | Create | Unit tests for the input assembly, with the repository call injected. |
| `src/components/features/dashboard/sesi-hari-ini-card.tsx` | Create | Server. Shows today's real session state and the check-out action. |
| `src/components/features/dashboard/sesi-ticker.tsx` | Create | Client island. Ticks elapsed time from a server-supplied `startedAt`. Display only. |
| `src/components/features/dashboard/rincian-skor-card.tsx` | Create | Server. The Jadwal row, from the service, with every number traceable. |
| `src/app/(app)/dashboard/page.tsx` | Modify | Render the two new cards above `JobInboxCard`. |
| `src/lib/learning/dashboard-integritas.test.ts` | Modify | Extend the sibling plan's guard: the dashboard must not re-import fixtures. |

---

### Task 1: Pure attendance summary

Everything downstream depends on this module, and it is the only piece with genuinely tricky logic — the streak's grace day and the day-boundary arithmetic in a fixed timezone. It is pure on purpose: no `getDb()`, no `Date.now()` default, no `next/headers`.

**Files:**
- Create: `src/lib/learning/kehadiran.ts`
- Test: `src/lib/learning/kehadiran.test.ts`

**Interfaces:**
- Consumes: nothing. No imports from `drizzle-orm`, `@/lib/db`, or `next/headers`.
- Produces — the exact surface every later task uses:
  ```ts
  export type StatusKehadiran = "active" | "completed" | "expired";
  export interface BarisKehadiran {
    startedAt: Date;
    completedAt: Date | null;
    expiresAt: Date;
    state: StatusKehadiran;
  }
  export interface RingkasanKehadiran {
    sesiHadir: number;      // runs that reached `completed`
    jamEfektif: number;     // summed minutes / 60, 2 dp
    streakHari: number;     // consecutive attended days, anchored today or yesterday
    hariAktif: string[];    // "YYYY-MM-DD" keys, ascending
  }
  export const ZONA_WAKTU_DEFAULT = "Asia/Jakarta";
  export function kunciHari(tanggal: Date, zonaWaktu?: string): string;
  export function durasiMenit(run: BarisKehadiran, now: Date): number;
  export function hitungStreak(hariAktif: ReadonlySet<string>, now: Date, zonaWaktu?: string): number;
  export function ringkasKehadiran(
    runs: readonly BarisKehadiran[],
    opsi: { now: Date; zonaWaktu?: string },
  ): RingkasanKehadiran;
  ```

- [ ] **Step 1: Write the failing test**

Create `src/lib/learning/kehadiran.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  durasiMenit,
  hitungStreak,
  kunciHari,
  ringkasKehadiran,
  type BarisKehadiran,
} from "@/lib/learning/kehadiran";

const ZONA = "Asia/Jakarta";

/**
 * 04:00Z = 11:00 WIB. Angka tengah hari sengaja dipilih agar tanggalnya tidak
 * bergeser saat dikonversi ke `Asia/Jakarta` — uji di GMT+7 tidak boleh gagal
 * hanya karena jamnya.
 */
function jam(hari: string): Date {
  return new Date(`${hari}T04:00:00.000Z`);
}

function hari(offsetHari: number): string {
  const dasar = jam("2026-09-27");
  dasar.setUTCDate(dasar.getUTCDate() + offsetHari);
  return dasar.toISOString().slice(0, 10);
}

function selesai(
  mulai: Date,
  menit: number,
  state: BarisKehadiran["state"] = "completed",
): BarisKehadiran {
  return {
    startedAt: mulai,
    completedAt: state === "completed" ? new Date(mulai.getTime() + menit * 60_000) : null,
    expiresAt: new Date(mulai.getTime() + 120 * 60_000),
    state,
  };
}

const NOW = jam("2026-09-27");

describe("kunciHari", () => {
  it("mengkeysolusi tanggal menurut zona waktu, bukan UTC", () => {
    // 2026-09-26T20:00Z adalah 2026-09-27 03:00 WIB — hari berikutnya di lokal.
    expect(kunciHari(new Date("2026-09-26T20:00:00.000Z"), ZONA)).toBe("2026-09-27");
    // 2026-09-27T15:00Z adalah 2026-09-27 22:00 WIB — masih hari yang sama.
    expect(kunciHari(new Date("2026-09-27T15:00:00.000Z"), ZONA)).toBe("2026-09-27");
  });

  it("tanggal tidak bisa dibaca menjadi string kosong, bukan hari ini", () => {
    // Kegagalan baca harus menutup, bukan membuka: kunci yang diam-diam menjadi
    // "hari ini" akan menghitung sesi tidak valid sebagai kehadiran.
    expect(kunciHari(new Date(Number.NaN), ZONA)).toBe("");
  });
});

describe("durasiMenit", () => {
  it("run completed memakai completed_at dikurangi started_at", () => {
    expect(durasiMenit(selesai(jam("2026-09-27"), 90), NOW)).toBe(90);
  });

  it("run expired memakai expires_at dikurangi started_at", () => {
    // Peserta hadir dan memakai sebagian jendela; run-nya berakhir karena
    // kedaluwarsa, bukan karena ia selesai. Kehadiran dihitung terpisah —
    // durasi ini tidak boleh nol hanya karena state-nya `expired`.
    const run = selesai(jam("2026-09-27"), 0, "expired");
    expect(run.completedAt).toBeNull();
    expect(durasiMenit(run, NOW)).toBe(120);
  });

  it("run active dibatasi expires_at, tidak bisa melebihi jendela", () => {
    const mulai = jam("2026-09-27");
    const run: BarisKehadiran = {
      startedAt: mulai,
      completedAt: null,
      expiresAt: new Date(mulai.getTime() + 30 * 60_000),
      state: "active",
    };
    // `now` jauh lewat `expiresAt`; durasi tidak boleh ikut grew.
    expect(durasiMenit(run, new Date(mulai.getTime() + 999 * 60_000))).toBe(30);
  });

  it("tutup sebelum mulai menghasilkan 0, bukan negatif", () => {
    const run: BarisKehadiran = {
      startedAt: jam("2026-09-27"),
      completedAt: new Date(jam("2026-09-27").getTime() - 60_000),
      expiresAt: jam("2026-09-27"),
      state: "completed",
    };
    expect(durasiMenit(run, NOW)).toBe(0);
  });

  it("startedAt tidak bisa dibaca menghasilkan 0", () => {
    const run: BarisKehadiran = {
      startedAt: new Date(Number.NaN),
      completedAt: new Date("2026-09-27T05:00:00.000Z"),
      expiresAt: jam("2026-09-27"),
      state: "completed",
    };
    expect(durasiMenit(run, NOW)).toBe(0);
  });
});

describe("hitungStreak", () => {
  it("tanpa hari aktif bernilai 0", () => {
    expect(hitungStreak(new Set(), NOW, ZONA)).toBe(0);
  });

  it("sesi hari ini bernilai 1", () => {
    expect(hitungStreak(new Set(["2026-09-27"]), NOW, ZONA)).toBe(1);
  });

  it("tiga hari berturut-turut bernilai 3", () => {
    expect(
      hitungStreak(new Set(["2026-09-25", "2026-09-26", "2026-09-27"]), NOW, ZONA),
    ).toBe(3);
  });

  it("lubang satu hari memutus streak", () => {
    // 25 dan 27 ada, 26 tidak — streak-nya 1, bukan 2.
    expect(hitungStreak(new Set(["2026-09-25", "2026-09-27"]), NOW, ZONA)).toBe(1);
  });

  it("hari yang belum terjadi hari ini tidak langsung memutus streak", () => {
    // TOLERANSI: hari ini pukul 11:00 WIB dan peserta belum belajar. Streak
    // harus tetap bertahan sampai hari ini berakhir, kalau tidak setiap pagi
    // angkanya akan putus dan naik lagi di sore hari.
    expect(hitungStreak(new Set(["2026-09-26", "2026-09-25"]), NOW, ZONA)).toBe(2);
  });

  it("selesai di hari sebelum kemarin sudah terputus", () => {
    expect(hitungStreak(new Set(["2026-09-25"]), NOW, ZONA)).toBe(0);
  });

  it("melewati batas bulan tetap dihitung berurutan", () => {
    // 30 September dan 1 Oktober adalah dua hari berturut-turut. Hitungan
    // berbasis difference hari dari kunci "YYYY-MM-DD" tetap benar di sini,
    // sedangkan iterasi kalender dengan melompati bulan akan salah.
    const akhirOkt = jam("2026-10-01");
    expect(
      hitungStreak(new Set(["2026-09-29", "2026-09-30", "2026-10-01"]), akhirOkt, ZONA),
    ).toBe(3);
  });
});

describe("ringkasKehadiran", () => {
  it("tanpa run menghasilkan nol di semua field", () => {
    expect(ringkasKehadiran([], { now: NOW, zonaWaktu: ZONA })).toEqual({
      sesiHadir: 0,
      jamEfektif: 0,
      streakHari: 0,
      hariAktif: [],
    });
  });

  it("hanya run completed yang dihitung sebagai kehadiran", () => {
    const ringkasan = ringkasKehadiran(
      [
        selesai(jam("2026-09-27"), 90),
        selesai(jam("2026-09-27"), 60, "expired"),
        { ...selesai(jam("2026-09-27"), 30), state: "active" },
      ],
      { now: NOW, zonaWaktu: ZONA },
    );
    // Satu sesi hadir, tetapi ketiganya berjam-jam: 90 + 120 (expired) + 30 (active).
    expect(ringkasan.sesiHadir).toBe(1);
    expect(ringkasan.jamEfektif).toBe(4);
    expect(ringkasan.hariAktif).toEqual(["2026-09-27"]);
    expect(ringkasan.streakHari).toBe(1);
  });

  it("hariAktif unik dan terurut menaik", () => {
    const ringkasan = ringkasKehadiran(
      [
        selesai(jam("2026-09-27"), 30),
        selesai(jam("2026-09-27"), 30),
        selesai(jam("2026-09-26"), 30),
      ],
      { now: NOW, zonaWaktu: ZONA },
    );
    expect(ringkasan.sesiHadir).toBe(3);
    expect(ringkasan.hariAktif).toEqual(["2026-09-26", "2026-09-27"]);
  });

  it("jamEfektif dibulatkan dua desimal", () => {
    // 100 menit = 1,6666… jam. Skor membandingkan rasio, jadi pembulatan di sini
    // membuat angka yang ditampilkan dan angka yang diskor identik.
    const ringkasan = ringkasKehadiran([selesai(jam("2026-09-27"), 100)], {
      now: NOW,
      zonaWaktu: ZONA,
    });
    expect(ringkasan.jamEfektif).toBe(1.67);
  });

  it("run dengan startedAt rusak diabaikan tanpa menggagalkan seluruh ringkasan", () => {
    const rusak: BarisKehadiran = {
      startedAt: new Date(Number.NaN),
      completedAt: null,
      expiresAt: new Date(Number.NaN),
      state: "active",
    };
    const ringkasan = ringkasKehadiran([rusak, selesai(jam("2026-09-27"), 60)], {
      now: NOW,
      zonaWaktu: ZONA,
    });
    expect(ringkasan.sesiHadir).toBe(1);
    expect(ringkasan.jamEfektif).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/learning/kehadiran.test.ts`

Expected: FAIL — the suite cannot resolve `@/lib/learning/kehadiran`. Vitest reports a module-resolution error, not assertion failures. That is the correct failure for this step.

- [ ] **Step 3: Write the implementation**

Create `src/lib/learning/kehadiran.ts`:

```ts
/**
 * Ringkasan kehadiran dari baris `learning_runs` — **murni**.
 *
 * Modul ini tidak menyentuh database, `node:fs`, maupun `next/headers`, dan
 * tidak memanggil `Date.now()` tanpa argumen: `now` selalu datang dari pemanggil.
 * Alasannya bukan kerapian. Aturan seperti "hari yang belum terjadi hari ini
 * belum memutus streak" adalah keputusan produk yang harus bisa diuji tanpa
 * PostgreSQL dan tanpa menunggu tengah malam, dan itulah bentuk yang diuji
 * `kehadiran.test.ts`.
 *
 * Yang dikunci di sini:
 *
 * - **Kehadiran adalah `completed`, bukan "run-nya ada".** Run `expired`
 *   tetap menyumbang jam belajar (peserta memakai sebagian jendela), tetapi
 *   tidak menghitung sebagai sesi hadir. Dua klaim berbeda, dan mencampurkannya
 *   membuat "saya hadir tapi lupa menutup" terlihat sama dengan "saya tidak
 *   datang".
 * - **Tanggal dihitung di satu zona waktu yang tetap.** "Hari" untuk seorang
 *   peserta adalah hari di kalender lokal, bukan hari UTC. Tanpa ini, sesi
 *   yang dimulai pukul 23:30 WIB terhitung sebagai kehadiran hari berikutnya.
 * - **Tanggal yang tidak bisa dibaca tidak dihitung sebagai hari ini.**
 *   `kunciHari` mengembalikan string kosong, dan string kosong tidak pernah
 *   sama dengan kunci hari mana pun — sehingga baris rusak tidak bisa dihitung
 *   sebagai kehadiran.
 *
 * Nama fungsi bisnis berbahasa Indonesia; konstanta dan nama tipe mengikuti
 * pola repo.
 */

/** Status run yang durasinya bisa dihitung. Sama dengan `STATUS_RUN`. */
export type StatusKehadiran = "active" | "completed" | "expired";

/**
 * Bentuk minimum satu baris `learning_runs` yang dibutuhkan ringkasan.
 *
 * Sengaja lebih sempit dari `LearningRun`: modul ini tidak butuh `userId`,
 * `courseId`, maupun `integrityVersion`, dan dengan tidak mengambilnya ia tidak
 * bisa diam-diam ikut membaca data yang tidak ada hubungannya dengan kehadiran.
 */
export interface BarisKehadiran {
  startedAt: Date;
  completedAt: Date | null;
  expiresAt: Date;
  state: StatusKehadiran;
}

export interface RingkasanKehadiran {
  /** Run yang mencapai `completed`. */
  sesiHadir: number;
  /** Total jam belajar dihitung dari durasi run, dua desimal. */
  jamEfektif: number;
  /** Hari berturut-turut dengan sesi hadir, dihitung ke belakang dari hari ini. */
  streakHari: number;
  /** Kunci `YYYY-MM-DD` dari setiap hari dengan sesi hadir, menaik. */
  hariAktif: string[];
}

/**
 * Zona waktu tempat "hari" dihitung.
 *
 * WIB, bukan UTC dan bukan zona browser. Kalau ini mengikuti zonaimming
 * peramban, angka streak dan jam yang sama akan berbeda depending on where the
 * learner opened the page — dan angka yang diskor tidak boleh begitu.
 */
export const ZONA_WAKTU_DEFAULT = "Asia/Jakarta";

const MS_PER_HARI = 86_400_000;

const formatter = new Map<string, Intl.DateTimeFormat>();

function formatterZona(zonaWaktu: string): Intl.DateTimeFormat {
  const ada = formatter.get(zonaWaktu);
  if (ada) return ada;
  // `en-CA` menghasilkan bentuk ISO `YYYY-MM-DD`. Locale lain seperti
  // `id-ID` menghasilkan `27/09/2026`, yang tidak bisa dihitung sebagai
  // selisih hari tanpa parsing ulang.
  const dibuat = new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaWaktu,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  formatter.set(zonaWaktu, dibuat);
  return dibuat;
}

/**
 * Kunci hari kalender `YYYY-MM-DD` untuk satu momen, di zona waktu tersebut.
 *
 * Tanggal yang tidak bisa dibaca menjadi string kosong — bukan kunci hari ini.
 */
export function kunciHari(tanggal: Date, zonaWaktu: string = ZONA_WAKTU_DEFAULT): string {
  if (!(tanggal instanceof Date) || !Number.isFinite(tanggal.getTime())) return "";
  return formatterZona(zonaWaktu).format(tanggal);
}

/** Kunci hari dari bilangan hari absolut sejak epoch UTC. */
function kunciDariNomor(nomor: number): string {
  return new Date(nomor * MS_PER_HARI).toISOString().slice(0, 10);
}

/** Bilangan hari absolut dari kunci `YYYY-MM-DD`. */
function nomorDariKunci(kunci: string): number {
  return Math.floor(Date.parse(`${kunci}T00:00:00.000Z`) / MS_PER_HARI);
}

/**
 * Durasi belajar satu run, dalam menit.
 *
 * Titik penutup mengikuti status run:
 * - `completed` → `completed_at`. Ini satu-satunya sumber durasi yang dipakai
 *   untuk skor, karena ia ditulis server saat run ditutup.
 * - `expired` → `expires_at`. Peserta punya seluruh jendela itu; mengukur
 *   sampai `completed_at` akan dibaca nol, padahal `completed_at` memang null.
 * - `active` → `min(now, expires_at)`. Run yang masih hidup tidak boleh
 *  ].(menambah jam setiap kali halaman dimuat.
 *
 * Hasilnya tidak pernah negatif dan tidak pernah melebihi jendela run.
 */
export function durasiMenit(run: BarisKehadiran, now: Date): number {
  const mulai = run.startedAt instanceof Date ? run.startedAt.getTime() : Number.NaN;
  if (!Number.isFinite(mulai)) return 0;

  const batas = run.expiresAt instanceof Date ? run.expiresAt.getTime() : Number.NaN;
  const nowMs = now instanceof Date ? now.getTime() : Number.NaN;

  let tutup: number;
  if (run.state === "completed") {
    tutup = run.completedAt instanceof Date ? run.completedAt.getTime() : Number.NaN;
  } else if (run.state === "expired") {
    tutup = batas;
  } else {
    // `batas` tidak bisa dibaca → jatuh ke `now`, bukan ke tak hingga.
    tutup = Number.isFinite(batas) ? Math.min(nowMs, batas) : nowMs;
  }

  if (!Number.isFinite(tutup)) return 0;
  return Math.max(0, (tutup - mulai) / 60_000);
}

/**
 * Hari berturut-turut dengan sesi hadir, dihitung ke belakang dari hari ini.
 *
 * **Ancangnya hari ini, atau Kemarin kalau hari ini belum ada.** Tanpa
 * toleransi ini, streak EVERY participant whose breaks setiap pagi around
 * midnight and rebuilds in the afternoon — angka yang naik turun karena
 * sekarang, bukan karena belajar. Break yang sebenarnya baru terjadi ketika
 * satu hari penuh berlalu tanpa sesi.
 */
export function hitungStreak(
  hariAktif: ReadonlySet<string>,
  now: Date,
  zonaWaktu: string = ZONA_WAKTU_DEFAULT,
): number {
  const hariIni = kunciHari(now, zonaWaktu);
  if (hariIni === "") return 0;

  const nomorHariIni = nomorDariKunci(hariIni);
  const kandidat = [nomorHariIni, nomorHariIni - 1];
  const awal = kandidat.find((n) => hariAktif.has(kunciDariNomor(n)));
  if (awal === undefined) return 0;

  let hitung = 0;
  let kursor = awal;
  while (hariAktif.has(kunciDariNomor(kursor))) {
    hitung += 1;
    kursor -= 1;
  }
  return hitung;
}

/**
 * Ringkasan kehadiran dari sekumpulan baris run.
 *
 * `jamEfektif` dibulatkan dua desimal supaya angka yang ditampilkan di UI dan
 * angka yang masuk ke `hitungSkorJadwal` berasal dari pembulatan yang sama.
 */
export function ringkasKehadiran(
  runs: readonly BarisKehadiran[],
  opsi: { now: Date; zonaWaktu?: string },
): RingkasanKehadiran {
  const zonaWaktu = opsi.zonaWaktu ?? ZONA_WAKTU_DEFAULT;

  const hari = new Set<string>();
  let sesiHadir = 0;
  let menitTotal = 0;

  for (const run of runs) {
    menitTotal += durasiMenit(run, opsi.now);
    if (run.state !== "completed") continue;
    sesiHadir += 1;
    const kunci = kunciHari(run.startedAt, zonaWaktu);
    // Kunci kosong berarti `startedAt` tidak bisa dibaca; baris seperti itu
    // sudah menyumbang 0 menit lewat `durasiMenit`, jadi dilewati sepenuhnya.
    if (kunci !== "") hari.add(kunci);
  }

  const hariAktif = [...hari].sort();

  return {
    sesiHadir,
    jamEfektif: Math.round((menitTotal / 60) * 100) / 100,
    streakHari: hitungStreak(hari, opsi.now, zonaWaktu),
    hariAktif,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/learning/kehadiran.test.ts`

Expected: PASS — 19 tests across four `describe` blocks.

- [ ] **Step 5: Run the full gate**

Run: `npm run check`

Expected: PASS. Lint in particular will object to anything unused in the new file.

- [ ] **Step 6: Commit**

```bash
git add src/lib/learning/kehadiran.ts src/lib/learning/kehadiran.test.ts
git commit -m "feat(learning): ringkasan kehadiran murni dari learning_runs

ringkasKehadiran mengubah baris learning_runs menjadi sesiHadir,
jamEfektif, streakHari, dan hariAktif tanpa I/O dan tanpa Date.now()
implit — now selalu datang dari pemanggil, sehingga aturan streak bisa
diuji tanpa PostgreSQL dan tanpa menunggu tengah malam.

Kehadiran adalah run completed; run expired tetap menyumbang jam
belajar karena peserta memakai sebagian jendela, tetapi tidak dihitung
sebagai sesi hadir. 'Hari' dihitung di Asia/Jakarta supaya angka tidak
bergantung pada zona peramban, dan tanggal yang tidak bisa dibaca tidak
pernah dihitung sebagai hari ini."
```

---

### Task 2: Read only the scoring window

**Files:**
- Modify: `src/lib/learning/repository.ts` — import line 35, new function after `listRunUser`
- Modify: `src/lib/learning/run-service.integration.test.ts` — add a `describe` block

**Interfaces:**
- Consumes: `LearningRun` (already re-exported from `repository.ts:675`).
- Produces:
  ```ts
  export async function runDalamRentang(
    userId: string,
    dari: Date,
    sampai: Date,
  ): Promise<LearningRun[]>;
  ```
  Returns runs whose `started_at` falls in `[dari, sampai)`, ascending by `startedAt`. An empty array when the window holds nothing. It throws no error for an inverted window — it returns `[]`, because the repository's job is to read what is there, not to judge the caller.

This task extends an existing integration file rather than creating one. `run-service.integration.test.ts` already has the `kosongkan()` truncate helper and the `siapkanPeserta()` builder, and copying 40 lines of table list into a new file to test one query is exactly the duplication `AGENTS.md` warns about.

- [ ] **Step 1: Extend the drizzle-orm import**

In `src/lib/learning/repository.ts`, change line 35 from:

```ts
import { and, asc, desc, eq, inArray, max } from "drizzle-orm";
```

to:

```ts
import { and, asc, desc, eq, gte, inArray, lt, max } from "drizzle-orm";
```

- [ ] **Step 2: Add the query**

In the same file, immediately after `listRunUser` (which ends at line 371), insert:

```ts
/**
 * Run seorang user yang `started_at`-nya berada di dalam `[dari, sampai)`.
 *
 * Jendela **berdasarkan `started_at`, bukan `completed_at`**, dan itu pilihan
 * yang disengaja. Skor Jadwal dipakai untuk menilai minggu berjalan, sehingga
 * sesinya dihitung pada saat ia dimulai. Hitungan berdasarkan `completed_at`
 * akan membuat sesi yang dimulai sebelum tengah malam dan ditutup sesudahnya
 * hilang dari minggu yang sedang berjalan, dan membuat minggu berjalan tidak
 * bisa dihitung sampai setiap sesi ditutup.
 *
 * Batas atas **eksklusif** supaya jendela mingguan yang bersebelahan tidak
 * menghitung satu run dua kali di batas tengah malam.
 *
 * Query ini terindeks `learning_runs_user_id_idx` dan mengembalikan hanya
 * baris milik `userId` — tidak ada filter yang diterapkan setelahnya, jadi
 * tidak ada jalan bagi satu akun melihat run akun lain.
 */
export async function runDalamRentang(
  userId: string,
  dari: Date,
  sampai: Date,
): Promise<LearningRun[]> {
  return getDb()
    .select()
    .from(learningRuns)
    .where(
      and(
        eq(learningRuns.userId, userId),
        gte(learningRuns.startedAt, dari),
        lt(learningRuns.startedAt, sampai),
      ),
    )
    .orderBy(asc(learningRuns.startedAt));
}
```

- [ ] **Step 3: Write the failing integration test**

Append to `src/lib/learning/run-service.integration.test.ts`:

```ts
describe("runDalamRentang", () => {
  /**
   * Satu run `completed` sepanjang `menit`, dimulai pada `mulai`.
   *
   * Memakai `buatRun` dan bukan `mulaiRunDb` dengan sengaja: `mulaiRunDb`
   * menegakkan "satu run aktif per (user, course)" dan mengembalikan run yang
   * sudah ada pada panggilan kedua, jadi tiga run untuk satu akun tidak bisa
   * dibuat lewat sana. Yang diuji di sini adalah query pembacaan, bukan
   * lifecycle run, jadi menyisipkan langsung adalah cara yang jujur.
   */
  async function runSelesai(
    enrollmentId: string,
    userId: string,
    mulai: Date,
    menit: number,
  ): Promise<void> {
    const run = await buatRun({
      userId,
      enrollmentId,
      courseId: COURSE_ID,
      expiresAt: new Date(mulai.getTime() + 600 * 60_000),
      integrityVersion: 1,
    });
    await db
      .update(learningRuns)
      .set({
        startedAt: mulai,
        state: "completed",
        completedAt: new Date(mulai.getTime() + menit * 60_000),
      })
      .where(eq(learningRuns.id, run.id));
  }

  it("hanya mengembalikan run di dalam jendela, terurut menaik", async () => {
    const { principal, enrollment } = await siapkanPeserta();
    const dasar = new Date("2026-09-21T04:00:00.000Z");
    // Disisipkan tidak berurutan supaya urutan hasil benar-benar diuji.
    await runSelesai(enrollment.id, principal.userId, new Date(dasar.getTime() + 86_400_000), 60);
    await runSelesai(enrollment.id, principal.userId, dasar, 30);
    await runSelesai(enrollment.id, principal.userId, new Date(dasar.getTime() + 2 * 86_400_000), 90);

    const hasil = await runDalamRentang(
      principal.userId,
      new Date("2026-09-21T00:00:00.000Z"),
      new Date("2026-09-23T00:00:00.000Z"),
    );

    // Run 23 Sep ada di tabel, tetapi `startedAt`-nya tepat pada batas atas
    // yang eksklusif, jadi tidak ikut.
    expect(hasil).toHaveLength(2);
    expect(hasil.map((r) => r.startedAt.toISOString())).toEqual([
      "2026-09-21T04:00:00.000Z",
      "2026-09-22T04:00:00.000Z",
    ]);
  });

  it("hanya mengembalikan run milik pemilik", async () => {
    const budi = await siapkanPeserta("budi@contoh.test");
    const sari = await siapkanPeserta("sari@contoh.test");
    const dasar = new Date("2026-09-21T04:00:00.000Z");
    await runSelesai(budi.enrollment.id, budi.principal.userId, dasar, 30);
    await runSelesai(sari.enrollment.id, sari.principal.userId, dasar, 30);

    const hasil = await runDalamRentang(
      budi.principal.userId,
      new Date("2026-09-21T00:00:00.000Z"),
      new Date("2026-09-28T00:00:00.000Z"),
    );

    expect(hasil).toHaveLength(1);
    expect(hasil[0]!.userId).toBe(budi.principal.userId);
  });

  it("jendela kosong menghasilkan array kosong, bukan galat", async () => {
    const { principal } = await siapkanPeserta();
    const hasil = await runDalamRentang(
      principal.userId,
      new Date("2020-01-01T00:00:00.000Z"),
      new Date("2020-01-08T00:00:00.000Z"),
    );
    expect(hasil).toEqual([]);
  });

  it("jendela terbalik menghasilkan array kosong, bukan galat", async () => {
    const { principal } = await siapkanPeserta();
    const hasil = await runDalamRentang(
      principal.userId,
      new Date("2026-09-28T00:00:00.000Z"),
      new Date("2026-09-21T00:00:00.000Z"),
    );
    expect(hasil).toEqual([]);
  });
});
```

`buatRun` must be added to the existing `@/lib/learning/repository` import at the
top of the test file, alongside `runDalamRentang`. `eq`, `sql`, `learningRuns`,
`getDb`, `tutupDb`, `daftarPengguna`, and `mulaiRunDb` are already imported by the
existing tests, and `siapkanPeserta`, `COURSE_ID`, `db`, and `kosongkan` are
defined above the new block — do not redeclare any of them.

- [ ] **Step 4: Run the integration test to verify it passes**

Run: `npm run test:db -- src/lib/learning/run-service.integration.test.ts`

Expected: PASS, including the four new cases.

If it fails because PostgreSQL is not running, that is the documented loud failure from `AGENTS.md` — it names `docker compose up -d postgres`, but on this machine there is no Docker and the dev cluster is native:

```bash
export PGDATA="$HOME/.local/share/pgsql/cluster"
pg_ctl -D "$PGDATA" -l /tmp/pg-careevo.log -o "-p 5432 -c listen_addresses=127.0.0.1 -c unix_socket_directories=$HOME/.local/share/pgsql/run" start
```

Do not skip the test. A skipped integration test looks green and hides a broken query.

- [ ] **Step 5: Commit**

```bash
git add src/lib/learning/repository.ts src/lib/learning/run-service.integration.test.ts
git commit -m "feat(learning): runDalamRentang untuk jendela skor mingguan

Query terindeks user_id + started_at dengan batas atas eksklusif, jadi
jendela mingguan bersebelahan tidak menghitung satu run dua kali. Filter
pemilik ada di dalam WHERE, bukanapplied setelah query, sehingga tidak
ada jalan satu akun membaca run akun lain."
```

---

### Task 3: Assemble the Jadwal score

`hitungSkorJadwal` stays exactly as it is. This task's job is to build its input honestly and hand the two constants a visible home.

**Files:**
- Create: `src/lib/learning/jadwal-service.ts`
- Test: `src/lib/learning/jadwal-service.test.ts`

**Interfaces:**
- Consumes: `runDalamRentang` (Task 2), `hitungSkorJadwal` / `JadwalResult` from `@/lib/scoring`, `ringkasKehadiran` / `BarisKehadiran` (Task 1).
- Produces:
  ```ts
  export const TARGET_JAM_MINGGUAN_SKOR = 5;
  export const JUMLAH_SESI_JADWAL_MINGGUAN = 3;
  export interface JadwalPemain {
    streakHari: number;
    jamMingguIni: number;
    sesiMingguIni: number;
    targetJamMingguan: number;
    jadwalSesi: number;
    jadwalJam: number;
    kepatuhan: number;
    rasioJam: number;
  }
  export function susunInputJadwal(
    ringkasan: RingkasanKehadiran,
  ): { scheduledSessions: number; attendedSessions: number; actualHours: number; weeklyTargetHours: number };
  export function jadwalDariRingkasan(ringkasan: RingkasanKehadiran): JadwalPemain;
  export function jadwalPemainDb(userId: string, now?: Date): Promise<JadwalPemain>;
  ```

`susunInputJadwal` and `jadwalDariRingkasan` are pure and separately exported precisely so Task 3's unit test never has to mock the database. `jadwalPemainDb` is the only function that touches `repository.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/learning/jadwal-service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  JUMLAH_SESI_JADWAL_MINGGUAN,
  TARGET_JAM_MINGGUAN_SKOR,
  jadwalDariRingkasan,
  susunInputJadwal,
  type JadwalPemain,
} from "@/lib/learning/jadwal-service";
import { ringkasKehadiran, type BarisKehadiran } from "@/lib/learning/kehadiran";

const ZONA = "Asia/Jakarta";
const NOW = new Date("2026-09-27T04:00:00.000Z"); // 11:00 WIB

function jam(hari: string): Date {
  return new Date(`${hari}T04:00:00.000Z`);
}

function selesai(mulai: Date, menit: number): BarisKehadiran {
  return {
    startedAt: mulai,
    completedAt: new Date(mulai.getTime() + menit * 60_000),
    expiresAt: new Date(mulai.getTime() + 600 * 60_000),
    state: "completed",
  };
}

function nilai(): RingkasanKehadiran {
  return ringkasKehadiran(
    [
      selesai(jam("2026-09-25"), 120),
      selesai(jam("2026-09-26"), 120),
      selesai(jam("2026-09-27"), 60),
    ],
    { now: NOW, zonaWaktu: ZONA },
  );
}

describe("susunInputJadwal", () => {
  it("kedua penyebut berasal dari konstanta server, bukan dari peserta", () => {
    const input = susunInputJadwal(nilai());
    // Tesis utama rencana ini: penyebut tidak pernah datang dari profil.
    expect(input.weeklyTargetHours).toBe(TARGET_JAM_MINGGUAN_SKOR);
    expect(input.scheduledSessions).toBe(JUMLAH_SESI_JADWAL_MINGGUAN);
  });

  it("penyebut tetap sama saat peserta belajar nol jam maupun banyak jam", () => {
    // Nilai construyendo ulang dengan jam 0 dan 999 jam — penyebutnya sama.
    const nol = susunInputJadwal(ringkasKehadiran([], { now: NOW, zonaWaktu: ZONA }));
    const banyak = susunInputJadwal(
      ringkasKehadiran([selesai(jam("2026-09-27"), 60 * 999)], { now: NOW, zonaWaktu: ZONA }),
    );
    expect(nol.weeklyTargetHours).toBe(banyak.weeklyTargetHours);
    expect(nol.scheduledSessions).toBe(banyak.scheduledSessions);
  });

  it("penyebut sesi tidak turun saat peserta hadir lebih dari basal", () => {
    // 5 sesi hadir di atas basal 3 → complianceRatio 1.0, bukan 1.67.
    const input = susunInputJadwal(
      ringkasKehadiran(
        [
          selesai(jam("2026-09-23"), 30),
          selesai(jam("2026-09-24"), 30),
          selesai(jam("2026-09-25"), 30),
          selesai(jam("2026-09-26"), 30),
          selesai(jam("2026-09-27"), 30),
        ],
        { now: NOW, zonaWaktu: ZONA },
      ),
    );
    expect(input.attendedSessions).toBe(5);
    expect(input.scheduledSessions).toBe(3);
  });

  it("jam aktual dibawa apa adanya dari ringkasan", () => {
    expect(susunInputJadwal(nilai()).actualHours).toBe(5);
  });
});

describe("jadwalDariRingkasan", () => {
  it("peserta penuh mencapai 30 dari 30", () => {
    // 3 sesi dari basal 3, 5 jam dari basal 5 → rasio 1.0 + 1.0.
    const hasil = jadwalDariRingkasan(nilai());
    expect(hasil.jadwalSesi).toBe(20);
    expect(hasil.jadwalJam).toBe(10);
    expect(hasil.kepatuhan).toBe(1);
    expect(hasil.rasioJam).toBe(1);
  });

  it("tanpa kehadiran bernilai nol di semua term, bukan null", () => {
    const hasil = jadwalDariRingkasan(ringkasKehadiran([], { now: NOW, zonaWaktu: ZONA }));
    expect(hasil.jadwalSesi).toBe(0);
    expect(hasil.jadwalJam).toBe(0);
    expect(hasil.sesiMingguIni).toBe(0);
    expect(hasil.jamMingguIni).toBe(0);
    expect(hasil.streakHari).toBe(0);
  });

  it("seperiuh basal pada sisi jam menghasilkan 25 dari 30", () => {
    // 3 sesi dari basal 3 → kepatuhan 1,0 (20 poin); 150 menit = 2,5 jam dari
    // basal 5 → rasio jam 0,5 (5 poin). Total 25, bukan 15: yang setengah basal
    // hanya sisi jam, sisi sesi sudah penuh.
    const hasil = jadwalDariRingkasan(
      ringkasKehadiran(
        [
          selesai(jam("2026-09-25"), 50),
          selesai(jam("2026-09-26"), 50),
          selesai(jam("2026-09-27"), 50),
        ],
        { now: NOW, zonaWaktu: ZONA },
      ),
    );
    expect(hasil.kepatuhan).toBe(1);
    expect(hasil.jadwalSesi).toBe(20);
    expect(hasil.rasioJam).toBe(0.5);
    expect(hasil.jadwalJam).toBe(5);
    expect(hasil.jadwalTotal).toBe(25);
  });

  it("satu sesi dari basal tiga menghasilkan 7 dari 20", () => {
    // 1 sesi dari basal 3 → kepatuhan 1/3, 20 * 1/3 = 6,67 → 7. Sisi jamnya
    // penuh (5 dari 5 jam), jadi `jadwalTotal` 17. Inilah alasan kedua term
    // dijumlahkan terpisah dan tidak diambil dari skor gabungan.
    const hasil = jadwalDariRingkasan(
      ringkasKehadiran([selesai(jam("2026-09-27"), 300)], { now: NOW, zonaWaktu: ZONA }),
    );
    expect(hasil.sesiMingguIni).toBe(1);
    expect(hasil.kepatuhan).toBeCloseTo(1 / 3, 5);
    expect(hasil.jadwalSesi).toBe(7);
    expect(hasil.jadwalJam).toBe(10);
    expect(hasil.jadwalTotal).toBe(17);
  });

  it("streak dan mingguan berasal dari ringkasan yang sama", () => {
    const hasil = jadwalDariRingkasan(nilai());
    expect(hasil.streakHari).toBe(3);
    expect(hasil.sesiMingguIni).toBe(3);
    expect(hasil.jamMingguIni).toBe(5);
    expect(hasil.targetJamMingguan).toBe(TARGET_JAM_MINGGUAN_SKOR);
  });

  it("bentuk hasil selalu punya semua field — tidak ada optional yang bisa hilang", () => {
    // Guard bentuk: UI membaca `hasil.streakHari` tanpa optional chaining,
    // jadi field yang hilang akan menjadi `undefined` di layar, bukan 0.
    // `jadwalTotal` ikut diperiksa karena kartu mencetaknya di angka utama,
    // jadi field yang hilang membuat judul kartu kosong.
    const hasil: JadwalPemain = jadwalDariRingkasan(nilai());
    for (const kunci of [
      "streakHari",
      "jamMingguIni",
      "sesiMingguIni",
      "targetJamMingguan",
      "jadwalSesi",
      "jadwalJam",
      "jadwalTotal",
      "kepatuhan",
      "rasioJam",
    ] as const) {
      expect(typeof hasil[kunci], `${kunci} bukan number`).toBe("number");
    }
  });
});
```

The last two cases are deliberate rather than redundant: the field-list test is
what fails if someone adds a field to `JadwalPemain` and forgets to populate it,
and the 7 + 10 = 17 case is the property that breaks silently if someone later
recovers the split terms a different way instead of from the ratios.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/learning/jadwal-service.test.ts`

Expected: FAIL — `@/lib/learning/jadwal-service` cannot be resolved.

- [ ] **Step 3: Write the implementation**

Create `src/lib/learning/jadwal-service.ts`:

```ts
import {
  ringkasKehadiran,
  ZONA_WAKTU_DEFAULT,
  type BarisKehadiran,
  type RingkasanKehadiran,
} from "@/lib/learning/kehadiran";
import { runDalamRentang } from "@/lib/learning/repository";
import { hitungSkorJadwal, type JadwalResult } from "@/lib/scoring";

/**
 * Skor Jadwal (30 poin) dari kehadiran nyata — **server-only**.
 *
 * Modul ini tidak mengarang jadwal, dan tidak membiarkan peserta menentukan
 * penyebut skornya sendiri.
 *
 * **Mengapa dua konstanta di bawah, dan bukan `profile.weeklyHours`.** Penyebut
 * yang paling menggoda adalah target yang peserta deklarasikan saat onboarding,
 * dan itu justru yang salah. Cookie-nya memang ditandatangani HMAC, jadi
 * angkanya tidak bisa disunting di tempat — tetapi `/onboarding?edit=1`
 * membiarkan siapa saja mendeklarasikan ulang kapan saja. Menyorot kehadiran
 * terhadap penyebut yang boleh dipilih sendiri oleh pihak yang discor akan
 * membuat strategi termurah adalah mendeklarasikan `3` dan mengumpulkan skor
 * penuh dengan dua jam seminggu. Kredensial tidak boleh bisa diginflation dengan
 * mengisi ulang formulir, jadi kedua penyebut hidup di sini sebagai kebijakan,
 * di sebelah test yang memenginnya.
 *
 * `weeklyHours` milik peserta tetap dibaca `rekomendasi.ts` untuk pencocokan
 * kursus dan tetap ditampilkan di `DashboardRecommendations`. Ia hanya tidak
 * pernah menjadi penyebut di sini.
 */

/** Sesi hadir per minggu yang dianggap memenuhi basal. Mengalap 20 dari 30 poin. */
export const JUMLAH_SESI_JADWAL_MINGGUAN = 3;

/** Jam belajar per minggu yang dianggap memenuhi basal. Mengalap 10 dari 30 poin. */
export const TARGET_JAM_MINGGUAN_SKOR = 5;

export interface JadwalPemain {
  /** Hari berturut-turut dengan sesi hadir. */
  streakHari: number;
  /** Jam belajar di dalam jendela 7 hari, dua desimal. */
  jamMingguIni: number;
  /** Run `completed` di dalam jendela 7 hari. */
  sesiMingguIni: number;
  /** Penyebut jam yang dipakai skor — konstanta, bukan pilihan peserta. */
  targetJamMingguan: number;
  /** 20 dari 30, dari kepatuhan sesi. */
  jadwalSesi: number;
  /** 10 dari 30, dari rasio jam. */
  jadwalJam: number;
  /** Gabungan keduanya, sama dengan `score` dari `hitungSkorJadwal`. */
  jadwalTotal: number;
  /** attendedSessions / scheduledSessions, sudah dijepit di 1. */
  kepatuhan: number;
  /** actualHours / weeklyTargetHours, sudah dijepit di 1. */
  rasioJam: number;
}

/**
 * Bentuk input `hitungSkorJadwal`, dibangun dari ringkasan dan konstanta.
 *
 * Diekspor terpisah dari `jadwalPemainDb` supaya aturan penyebut bisa diuji
 * tanpa database — itulah satu-satunya aturan yang tidak boleh bergeser diam-diam.
 */
export function susunInputJadwal(ringkasan: RingkasanKehadiran): {
  scheduledSessions: number;
  attendedSessions: number;
  actualHours: number;
  weeklyTargetHours: number;
} {
  return {
    scheduledSessions: JUMLAH_SESI_JADWAL_MINGGUAN,
    attendedSessions: ringkasan.sesiHadir,
    actualHours: ringkasan.jamEfektif,
    weeklyTargetHours: TARGET_JAM_MINGGUAN_SKOR,
  };
}

/** Bentuk yang lengkap untuk UI: skor, pecahan term, dan angka pendukungnya. */
export function jadwalDariRingkasan(ringkasan: RingkasanKehadiran): JadwalPemain {
  const { score, complianceRatio, hoursRatio } = hitungSkorJadwal(
    susunInputJadwal(ringkasan),
  );

  // `hitungSkorJadwal` mengembalikan satu skor gabungan; UI butuh dua term
  // terpisah supaya bisa menampilkan "20/20 sesi" di samping "10/10 jam", dan
  // tidak membuat peserta menebak term mana yang kurang. Keduanya diambil dari
  // rasio, jadi persis — tanpa menghitung ulang dan tanpa pencatatan kedua.
  const jadwalSesi = Math.round(complianceRatio * 20);
  const jadwalJam = Math.round(hoursRatio * 10);

  return {
    streakHari: ringkasan.streakHari,
    jamMingguIni: ringkasan.jamEfektif,
    sesiMingguIni: ringkasan.sesiHadir,
    targetJamMingguan: TARGET_JAM_MINGGUAN_SKOR,
    jadwalSesi,
    jadwalJam,
    jadwalTotal: score,
    kepatuhan: complianceRatio,
    rasioJam: hoursRatio,
  };
}

/**
 * Jadwal seorang pemilik, dibaca dari `learning_runs` di dalam jendela 7 hari
 * yang berakhir pada `now`.
 *
 * **Jendelanya trailing, bukan kalender.** "Minggu ini" yang diartikan sebagai
 * "Senin sampai Minggu" membuat angkanya berubah makna setiap Senin pagi dan
 * kembali ke nol; 7 hari trailing bisa dibandingkan dengan dirinya sendiri.
 * Batasnya memakai `Asia/Jakarta` yang sama dengan `kunciHari`, jadi "hari"
 * berarti hal yang sama di kedua tempat.
 */
export async function jadwalPemainDb(userId: string, now: Date = new Date()): Promise<JadwalPemain> {
  const sampai = now;
  const dari = new Date(now.getTime() - 7 * 86_400_000);

  const runs: BarisKehadiran[] = await runDalamRentang(userId, dari, sampai);
  return jadwalDariRingkasan(
    ringkasKehadiran(runs, { now, zonaWaktu: ZONA_WAKTU_DEFAULT }),
  );
}
```

The explicit return annotation on `susunInputJadwal` above is what lets the
`JadwalResult` type import go. Change the import line to:

```ts
import { hitungSkorJadwal } from "@/lib/scoring";
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/learning/jadwal-service.test.ts`

Expected: PASS, 10 tests across two `describe` blocks.

- [ ] **Step 5: Add one integration test for the real read**

Create `src/lib/learning/jadwal-service.integration.test.ts`:

```ts
/**
 * Test integrasi skor Jadwal dari `learning_runs` — **butuh PostgreSQL**
 * (`npm run test:db`).
 *
 * Unit test `jadwal-service.test.ts` membuktikan aturan penyebutnya; yang
 * dibuktikan di sini adalah bahwa angka itu benar-benar berasal dari baris
 * `learning_runs` dan bukan dari fixture: hanya run di dalam jendela 7 hari
 * yang dihitung, run milik akun lain tidak terlihat, dan run `expired`
 * menyumbang jam tanpa menyumbang sesi hadir.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";

import { getDb, tutupDb, type KoneksiDb } from "@/lib/db/client";
import { learningRuns } from "@/lib/db/schema";
import { daftarPengguna } from "@/lib/auth/auth-service";
import type { SessionPrincipal } from "@/lib/auth/principal";
import { daftarEnrollment, mulaiRunDb } from "@/lib/learning/repository";
import { jadwalPemainDb } from "@/lib/learning/jadwal-service";

let db: KoneksiDb = getDb();

async function kosongkan() {
  await db.execute(
    sql`truncate table
      outbox_events,
      audit_events,
      email_verification_tokens,
      password_reset_tokens,
      sessions,
      staff_invitations,
      user_credentials,
      user_profiles,
      user_roles,
      users,
      courses,
      enrollments,
      module_progress,
      learning_runs,
      learning_events,
      quiz_attempts,
      quiz_attempt_answers,
      course_completions
      cascade`,
  );
}

beforeEach(async () => {
  db = getDb();
  await kosongkan();
});

afterAll(async () => {
  await tutupDb();
});

const COURSE_ID = "kursus-jadwal";

/** Akun + enrollment, dengan satu run yang ditutup pada `selesaiAt`. */
async function pesertaDenganRun(
  email: string,
  mulai: Date,
  menit: number,
  state: "completed" | "expired" = "completed",
): Promise<SessionPrincipal> {
  const hasil = await daftarPengguna({
    nama: "Peserta Uji",
    username: email.split("@")[0]!,
    email,
    password: "rahasia-panjang",
  });
  if (!hasil.ok) throw new Error(`gagal buat akun ${email}: ${hasil.alasan}`);
  const principal = hasil.principal;

  const { enrollment } = await daftarEnrollment({
    userId: principal.userId,
    courseId: COURSE_ID,
  });
  if (!enrollment) throw new Error("gagal mendaftar");

  const { run } = await mulaiRunDb({
    principal,
    enrollmentId: enrollment.id,
    courseId: COURSE_ID,
    policyVersion: 1,
    batasMenit: 600,
  });

  await db
    .update(learningRuns)
    .set({
      startedAt: mulai,
      state,
      completedAt: state === "completed" ? new Date(mulai.getTime() + menit * 60_000) : null,
    })
    .where(eq(learningRuns.id, run.id));

  return principal;
}

describe("jadwalPemainDb", () => {
  it("tidak memiliki run menghasilkan nol, bukan null", async () => {
    const hasil = await daftarPengguna({
      nama: "Peserta Uji",
      username: "kosong",
      email: "kosong@contoh.test",
      password: "rahasia-panjang",
    });
    if (!hasil.ok) throw new Error(`gagal buat akun: ${hasil.alasan}`);

    const jadwal = await jadwalPemainDb(hasil.principal.userId);
    expect(jadwal.jamMingguIni).toBe(0);
    expect(jadwal.sesiMingguIni).toBe(0);
    expect(jadwal.streakHari).toBe(0);
    expect(jadwal.jadwalTotal).toBe(0);
  });

  it("run di dalam jendela dihitung, run di luar jendela tidak", async () => {
    const now = new Date("2026-09-27T04:00:00.000Z");
    const principal = await pesertaDenganRun(
      "budi@contoh.test",
      new Date("2026-09-26T04:00:00.000Z"),
      180,
    );
    // 20 hari lalu: jauh di luar jendela 7 hari.
    await pesertaDenganRun(
      "lama@contoh.test",
      new Date("2026-09-07T04:00:00.000Z"),
      600,
    );

    const jadwal = await jadwalPemainDb(principal.userId, now);
    expect(jadwal.sesiMingguIni).toBe(1);
    expect(jadwal.jamMingguIni).toBe(3);
  });

  it("run expired menyumbang jam tetapi bukan sesi hadir", async () => {
    const now = new Date("2026-09-27T04:00:00.000Z");
    const principal = await pesertaDenganRun(
      "kedaluwarsa@contoh.test",
      new Date("2026-09-26T04:00:00.000Z"),
      120,
      "expired",
    );

    const jadwal = await jadwalPemainDb(principal.userId, now);
    expect(jadwal.sesiMingguIni).toBe(0);
    // `mulaiRunDb` memberi expiresAt default; jamnya dihitung dari jendela itu.
    expect(jadwal.jamMingguIni).toBeGreaterThan(0);
    expect(jadwal.kepatuhan).toBe(0);
  });

  it("hanya membaca run milik pemilik yang diminta", async () => {
    const now = new Date("2026-09-27T04:00:00.000Z");
    const budi = await pesertaDenganRun("budi@contoh.test", new Date("2026-09-26T04:00:00.000Z"), 60);
    await pesertaDenganRun("sari@contoh.test", new Date("2026-09-26T04:00:00.000Z"), 60);

    const jadwal = await jadwalPemainDb(budi.userId, now);
    expect(jadwal.sesiMingguIni).toBe(1);
    expect(jadwal.jamMingguIni).toBe(1);
  });
});
```

- [ ] **Step 6: Run the integration test**

Run: `npm run test:db -- src/lib/learning/jadwal-service.integration.test.ts`

Expected: PASS, 4 tests.

- [ ] **Step 7: Commit**

```bash
git add src/lib/learning/jadwal-service.ts src/lib/learning/jadwal-service.test.ts src/lib/learning/jadwal-service.integration.test.ts
git commit -m "feat(learning): skor Jadwal 30 dari learning_runs

jadwalPemainDb membaca jendela 7 hari trailing dari learning_runs lalu
menyerangkannya ke hitungSkorJadwal yang sudah ada; formula 30 poin
tidak berubah.

Kedua penyebab berasal dari konstanta server, bukan weeklyHours yang
dideklarasikan peserta: cookie-nya memang ditandatangani, tetapi
/onboarding?edit=1 memungkinkan anyone mendeklarasikan ulang, dan
menykoragainst penyebut yang boleh dipilih yang diskor berarti kredensial
bisainflation dengan mengisi ulang formulir. weeklyHours tetap dipakai
untuk rekomendasi kursus dan tetap ditampilkan — hanya tidak pernah
menjadi penyebut."
```

---

### Task 4: Render the real numbers

**Files:**
- Create: `src/components/features/dashboard/sesi-hari-ini-card.tsx`
- Create: `src/components/features/dashboard/sesi-ticker.tsx`
- Create: `src/components/features/dashboard/rincian-skor-card.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/lib/learning/dashboard-integritas.test.ts`

**Interfaces:**
- Consumes: `jadwalPemainDb` / `JadwalPemain` (Task 3), `listEnrollments` (`repository.ts:143`), `akhiriSesiAction` / `mulaiSesiAction` (`src/actions/learning.ts`), `BarRow` (`src/components/ui/progress-bar.tsx`), `StatusBadge`, `Button`.
- Produces:
  ```ts
  // sesi-ticker.tsx — "use client"
  export function SesiTicker(props: { mulaiAt: string; berakhir: boolean }): JSX.Element;
  // sesi-hari-ini-card.tsx — server, no props
  export function SesiHariIniCard(props: { jadwal: JadwalPemain }): JSX.Element;
  // rincian-skor-card.tsx — server, no props
  export function RincianSkorCard(props: { jadwal: JadwalPemain }): JSX.Element;
  ```

There is no new "check in" action. `mulaiSesiAction` and `akhiriSesiAction` already exist and already enforce enrolment, course policy, camera gates, and HMAC proof. What the deleted `CheckinWidget` did was a `localStorage` timer that fed nothing; what replaces it is the real session, which is the only thing in the app that can honestly be called attendance.

- [ ] **Step 1: Create the display-only ticker**

Create `src/components/features/dashboard/sesi-ticker.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

/**
 * Jam berjalan untuk run yang sedang aktif — **display only**.
 *
 * `mulaiAt` datang dari server (`learning_runs.started_at`) dan dihitung ulang
 * di peramban dengan `Date.now()` lokal, jadi angka di layar bisa menyimpang
 * bila jam perangkat salah. Itu disengaja dan tidak berbahaya: **skor tidak
 * pernah membaca komponen ini**. Durasi yang diskor selalu
 * `completed_at - started_at` dari database, dihitung server di
 * `jadwal-service.ts`. Mengubah jam perangkat hanya mengubah angka yang
 * sedang dibacakan.
 */
export function SesiTicker({
  mulaiAt,
  berakhir,
}: {
  mulaiAt: string;
  berakhir: boolean;
}) {
  const mulai = Date.parse(mulaiAt);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (berakhir || !Number.isFinite(mulai)) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [berakhir, mulai]);

  // Tanggal yang tidak bisa dibaca menampilkan 00:00:00, bukan "NaN:NaN:NaN" —
  // dan angka itu tidak pernah masuk ke skor.
  const detik = Number.isFinite(mulai) ? Math.max(0, Math.floor((now - mulai) / 1000)) : 0;
  const jam = Math.floor(detik / 3600);
  const menit = Math.floor((detik % 3600) / 60);
  const sisa = detik % 60;
  const tampil = [jam, menit, sisa].map((n) => String(n).padStart(2, "0")).join(":");

  return (
    <div className="score-hero" style={{ margin: "0.75rem 0" }}>
      <b className="mono">{tampil}</b>
      <span>{berakhir ? "sesi selesai" : "sesi berjalan"}</span>
    </div>
  );
}
```

- [ ] **Step 2: Create the session card**

Create `src/components/features/dashboard/sesi-hari-ini-card.tsx`:

```tsx
import Link from "next/link";
import { akhiriSesiAction } from "@/actions/learning";
import { getCourseById } from "@/lib/courses/store";
import type { LearningRun } from "@/lib/db/schema";
import type { Enrollment } from "@/lib/learning/repository";
import type { JadwalPemain } from "@/lib/learning/jadwal-service";
import { SesiTicker } from "./sesi-ticker";

/**
 * Kehadiran nyata untuk hari ini.
 *
 * Menggantikan timer `localStorage` yang dihapus bersama `DashboardView`: angka
 * di sini berasal dari baris `learning_runs`, dan mengakhiri sesi memanggil
 * `akhiriSesiAction` sehingga `completed_at` terisi — dan itulah yang membuat
 * sesi dihitung sebagai kehadiran oleh `jadwal-service.ts`.
 *
 * Ketika tidak ada run aktif, kartu ini tidak menawarkan tombol memulai sesi.
 * Memulai sesi adalah tugas halaman kursus (`CourseSessionPrompt` di
 * `src/components/features/learning/`), karena sesi terikat pada sebuah kursus
 * dan tunduk pada kebijakan kursus itu; menawarkannya di sini berarti membuka
 * jalur kedua menuju aksi yang berpintu kebijakan.
 */
export function SesiHariIniCard({
  run,
  enrollments,
}: {
  run: LearningRun | null;
  enrollments: Enrollment[];
}) {
  const judulKursus = run ? getCourseById(run.courseId) : undefined;

  return (
    <section
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs"
      aria-labelledby="sesi-title"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="text-base font-bold text-gray-900" id="sesi-title">
            Sesi belajar hari ini
          </h2>
          <p className="mt-0.5 text-[13px] text-gray-500">
            {run
              ? `Berjalan di ${judulKursus?.title ?? run.courseId}`
              : "Belum ada sesi yang dimulai hari ini."}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-[#0056D2]">
          {run ? "Berjalan" : "Belum mulai"}
        </span>
      </div>

      {run ? (
        <>
          <p className="caption muted">
            Durasi dihitung dari `learning_runs`. Sesi yang ditutup tercatat sebagai
            kehadiran; yang berakhir sendiri karena kedaluwarsa hanya menambah jam.
          </p>
          <SesiTicker mulaiAt={run.startedAt.toISOString()} berakhir={false} />
          <form action={akhiriSesiAction.bind(null, run.id)}>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-full bg-[#0056D2] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#00419e]"
            >
              Akhiri sesi
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="caption muted">
            Mulai sesi dari halaman kursus. Sesi terverifikasi yang ditutup
            terhitung sebagai kehadiran di skor Jadwal.
          </p>
          {enrollments.length > 0 ? (
            <ul className="m-0 list-none p-0">
              {enrollments.map((enrollment) => {
                const kursus = getCourseById(enrollment.courseId);
                return (
                  <li key={enrollment.id} className="border-b border-gray-100 py-3 last:border-b-0">
                    <Link
                      href={kursus ? `/belajar/${kursus.slug}` : "/belajar"}
                      className="text-sm font-bold text-gray-900 hover:text-[#0056D2]"
                    >
                      {kursus?.title ?? enrollment.courseId}
                    </Link>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {kursus ? `${kursus.duration_min} menit` : "Buka daftar kursus"}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Link
              className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-[#0056D2] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#00419e]"
              href="/belajar"
            >
              Cari kursus
            </Link>
          )}
        </>
      )}
    </section>
  );
}
```

`listEnrollments` is imported for the empty-state course list, `getCourseById`
resolves each `courseId` to a title and slug, and neither is a client import —
this file is a server component, which is what lets it call `getCourseById`
directly. `JadwalPemain` is deliberately not imported here: a session card shows
today's session, and the Jadwal totals belong to `RincianSkorCard`.

- [ ] **Step 3: Create the score card**

Create `src/components/features/dashboard/rincian-skor-card.tsx`:

```tsx
import { BarRow } from "@/components/ui/progress-bar";
import {
  JUMLAH_SESI_JADWAL_MINGGUAN,
  TARGET_JAM_MINGGUAN_SKOR,
  type JadwalPemain,
} from "@/lib/learning/jadwal-service";

/**
 * Jadwal 30 dari 30 — komponen pertama dari skor 100.
 *
 * Hanya Jadwal yang dihitung di sini. Karya (40) dan Validasi (30) belum punya
 * pemanggil selain `scoring/`, jadi menampilkan total 100 sekarang akan
 * menjumlahkan dua angka yang tidak ada. Ketika keduanya sudah terhubung, kartu
 * ini mendapat dua `BarRow` dan sebuah total — dan total itu tidak boleh
 * dirender sebelum itu.
 *
 * Setiap angka yang ditampilkan adalah nilai balik `jadwalPemainDb`, yang
 * berasal dari `learning_runs`. Keterangan di bawah menyebut penyebutnya secara
 * terbuka, karena skor tanpa penyebut yang terlihat adalah klaim yang tidak bisa
 * diperiksa peserta.
 */
export function RincianSkorCard({ jadwal }: { jadwal: JadwalPemain }) {
  return (
    <section
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs"
      aria-labelledby="jadwal-title"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="text-base font-bold text-gray-900" id="jadwal-title">
            Jadwal
          </h2>
          <p className="mt-0.5 text-[13px] text-gray-500">
            Kehadiran 7 hari terakhir, dari sesi terverifikasi yang kamu tutup
          </p>
        </div>
        <span className="flex shrink-0 items-baseline gap-1">
          <b className="font-mono text-2xl text-gray-900">{jadwal.jadwalTotal}</b>
          <span className="text-sm text-gray-500">/30</span>
        </span>
      </div>

      <BarRow
        label={`Sesi hadir (${jadwal.sesiMingguIni}/${JUMLAH_SESI_JADWAL_MINGGUAN})`}
        value={jadwal.jadwalSesi}
        max={20}
        tone={jadwal.kepatuhan >= 0.8 ? "ok" : "warn"}
      />
      <BarRow
        label={`Jam belajar (${jadwal.jamMingguIni}/${TARGET_JAM_MINGGUAN_SKOR} jam)`}
        value={jadwal.jadwalJam}
        max={10}
        tone={jadwal.rasioJam >= 0.8 ? "ok" : "warn"}
      />

      <p className="mt-3 text-xs text-gray-500">
        {jadwal.streakHari > 0
          ? `Beruntun ${jadwal.streakHari} hari.`
          : "Belum ada sesi beruntun dalam 7 hari terakhir."}{" "}
        Penyebut {JUMLAH_SESI_JADWAL_MINGGUAN} sesi dan {TARGET_JAM_MINGGUAN_SKOR} jam
        adalah ketentuan sistem, bukan target yang kamu pilih sendiri.
      </p>
    </section>
  );
}
```

- [ ] **Step 4: Wire both cards into the page**

In `src/app/(app)/dashboard/page.tsx`, add imports:

```tsx
import { listEnrollments, listRunUser } from "@/lib/learning/repository";
import { jadwalPemainDb } from "@/lib/learning/jadwal-service";
import { SesiHariIniCard } from "@/components/features/dashboard/sesi-hari-ini-card";
import { RincianSkorCard } from "@/components/features/dashboard/rincian-skor-card";
```

`listRunUser` already exists at `repository.ts:365` and returns every run for the
account, so no new query is needed. A participant may have several courses, so
`runs.find((r) => r.state === "active")` picks the active one; `take` over the
whole array is what makes the choice deterministic — `listRunUser` is ordered
`startedAt` descending, so with more than one active run the most recent wins.

Insert this immediately after the `const profile = await getProfile(...)` line in
the page, before the `return`:

```tsx
  const [jadwal, enrollments, runs] = await Promise.all([
    jadwalPemainDb(session.userId),
    listEnrollments(session.userId),
    listRunUser(session.userId),
  ]);
  const runAktif = runs.find((r) => r.state === "active") ?? null;
```

and insert this inside the returned `<AppShell>`, above the `JobInboxCard`
wrapper:

```tsx
      <div className="grid gap-4 md:grid-cols-2">
        <SesiHariIniCard run={runAktif} enrollments={enrollments} />
        <RincianSkorCard jadwal={jadwal} />
      </div>
```

The `jadwalPemainDb` call uses the default `now = new Date()`, which is correct:
this is a live read of the trailing week at request time. All three reads are
independent, so `Promise.all` is right; none of them writes, so there is no
transaction.

- [ ] **Step 5: Extend the guard test**

In `src/lib/learning/dashboard-integritas.test.ts`, add to the existing `describe` block:

```ts
  it("skor dashboard dibaca dari database, bukan dari fixture", () => {
    const isi = readFileSync(BERKAS_DASHBOARD, "utf8");
    // Angka Jadwal hanya sah kalau halaman ini memanggil
    // `jadwalPemainDb`, satu-satunya pembaca `learning_runs` untuk keperluan ini.
    expect(isi).toContain("jadwalPemainDb");
  });

  it("jam berjalan tidak pernah masuk ke jalur skor", () => {
    // `SesiTicker` memanggil `Date.now()` di peramban. Yang dijaga adalah
    // bahwa tidak ada modul di jalur skor yang mem-import-nya.
    const isiJadwal = readFileSync(
      path.join(ROOT, "src/lib/learning/jadwal-service.ts"),
      "utf8",
    );
    expect(isiJadwal).not.toContain("Date.now()");
    expect(isiJadwal).not.toContain("sesi-ticker");
  });
```

The second test is the load-bearing one for the design decision in this plan: it fails if anyone later wires the browser clock into the scoring path.

- [ ] **Step 6: Run the unit suite**

Run: `npm test`

Expected: PASS, including the two new guard cases.

- [ ] **Step 7: Commit**

```bash
git add src/components/features/dashboard/ src/app/\(app\)/dashboard/page.tsx src/lib/learning/dashboard-integritas.test.ts
git commit -m "feat(dashboard): tampilkan kehadiran dan skor Jadwal dari learning_runs

Sesi belajar hari ini sekarang menampilkan run yang benar-benar sedang
berjalan dari learning_runs, dan mengakhirinya memanggil akhiriSesiAction
sehingga completed_at terisi — itulah yang membuat sesi dihitung sebagai
kehadiran. Tidak ada aksi check-in baru: sesi terikat kursus dan tunduk
kebijakan kursus itu, jadi tetap dimulai dari halaman kursus.

RincianSkorCard menampilkan dua term Jadwal (20 sesi, 10 jam) beserta
penyebutnya, dan tidak menampilkan total 100 karena Karya dan Validasi
belum punya pemanggil.

SesiTicker berdetak dari Date.now() peramban, tetapi hanya untuk
tampilan; durasi yang diskor tetap completed_at - started_at dari
database, dan dashboard-integritas.test.ts menjaga kedua hal itu
terpisah."
```

---

### Task 5: Verify in a browser and in a build

**Files:**
- No code changes expected.
- Verify: `http://localhost:3000/dashboard`

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: no code. Evidence.

- [ ] **Step 1: Confirm the stack is up**

Run: `ss -ltnp | grep -E ':(3000|3790|8011|5432)\b'`

Expected: `3000` and `5432` both listening. PostgreSQL is required this time — the dashboard now reads `learning_runs`, and a signed-in account with no runs must still render a zeroed card rather than an error. If `3000` is serving a stale build from a deleted cwd, restart it rather than only building.

- [ ] **Step 2: Check the signed-out and signed-in paths**

`http://localhost:3000/dashboard` while logged out must `307` to `/masuk`. That is correct auth behaviour, not a broken route.

Signed in as an account with **no** runs, confirm:

- "Sesi belajar hari ini" reads "Belum ada sesi yang dimulai hari ini." with a "Belum mulai" chip.
- "Jadwal" shows `0/30`, both `BarRow`s at zero with the `warn` tone, and the caption reads "Belum ada sesi beruntun dalam 7 hari terakhir."
- No error boundary, no `NaN`, no `undefined` anywhere on the page.

An account with no runs is the case that breaks naive implementations, because every derived number is a divide-by-zero. Check it first.

- [ ] **Step 3: Check a real session end to end**

Enrol in a published course, start a session from the course page, then return to `/dashboard`:

- The session card shows the course title, a "Berjalan" chip, and a ticking clock.
- Press "Akhiri sesi". The page revalidates, the run is gone, and the card returns to the "Belum mulai" state.
- `Jadwal` now shows `1` of `3` sessions and the elapsed minutes in the hours bar. Confirm the hours figure is **not** zero — a run closed in seconds should show a small non-zero value, because `durasiMenit` floors at 0 minutes but a run of a few seconds yields a fraction of an hour rounded to two decimals. If it shows `0`, check that `selesai` was actually written before assuming the query is wrong.

Verify directly in the database that the number on screen matches the row:

```bash
psql -h 127.0.0.1 -p 5432 -U careevo -d careevo -c \
  "select state, started_at, completed_at from learning_runs order by started_at desc limit 3;"
```

- [ ] **Step 4: Confirm the fixture claims are still gone**

The must-be-absent list from the sibling plan's Task 3 Step 2 still applies: no "Streak" stat tile, no "Rincian skor" fixture card, no "Rekomendasi Navigator", no "Badge terbaru", no "Check-in sekarang". `RincianSkorCard` is titled "Jadwal", not "Rincian skor" — the two are different things and the old title must not reappear.

- [ ] **Step 5: Run both suites and a production build**

```bash
npm run check
npm run test:db
npm run build
```

All three must pass. `test:db` matters here in a way it did not for the sibling plan, because this plan added DB reads. `build` is the only step that catches a client/server import violation, and `sesi-ticker.tsx` is the only `"use client"` file in the new set — if `jadwal-service.ts` ever becomes reachable from it, the build fails on `getDb()`.

- [ ] **Step 6: Record the outcome**

Nothing to commit if all checks passed. If Step 2 or 3 surfaced a defect, fix it, re-run `npm run check && npm run test:db`, and commit with a message naming the symptom rather than the fix.

---

## Out of Scope

- **Karya (40) and Validasi (30).** `hitungSkorKarya` is wired into `src/lib/review/service.ts` and `hitungSkorValidasi` has no caller. Neither has a learner-facing surface, so `RincianSkorCard` deliberately stops at 30 and renders no total. Adding the total before both exist would sum two absent numbers.
- **`profile.weeklyHours` as a displayed personal goal on the score card.** It is already displayed by `DashboardRecommendations` and already drives course recommendations. Repeating it next to a system-owned denominator would invite the reader to think it feeds the score, which is precisely the confusion this plan's design decision removes.
- **A schedule table.** `scheduledSessions` is a policy constant, not a learner-declared calendar. If the product later wants per-learner scheduling, that is a new table, a new migration, and a new integrity question about whether a declared schedule may be rescheduled mid-week — out of scope here.
- **Per-day breakdown of the trailing week.** `hariAktif` is computed and tested but not rendered. A week strip is a reasonable next card; it is not needed for the score to be honest.
- **`/p/[username]`, `/challenge/[id]`, and the fixture files.** Unchanged, for the reasons recorded in the sibling plan's "Out of Scope" section.
