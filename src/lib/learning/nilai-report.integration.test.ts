/**
 * Test integrasi alur nilai kuis — **butuh PostgreSQL** (`npm run test:db`).
 *
 * Berkas ini menutup integrasi antar-sumber-data yang jadi inti perbaikan:
 * sebuah attempt dibuka lewat **Server Action sungguhan**, pada kursus + modul +
 * kuis yang benar-benar dipasang di store, lalu **dibaca kembali oleh query
 * laporan staf**. Yang dibuktikan:
 *
 * 1. **Action → service → DB → laporan, tanpa cookie.** `mulaiKuisVerifiedAction`
 *    memverifikasi bahwa kuis benar-benar terpasang di modul (butuh mount nyata,
 *    bukan id sintetis), lalu `kirimDanSelesaikanKuisAction` menyimpan skor yang
 *    muncul di `listAttemptSemua`/`barisPembelajaranDariDb` — jalur yang dibaca
 *    halaman `/performa`. Tidak ada satu pun cookie `ls_enroll` yang dibuat atau
 *    dibaca: keikutsertaannya dari `enrollments`.
 * 2. **Gerbang keikutsertaan DB.** Learner tanpa enrollment ditolak action
 *    sebelum attempt dibuat (menggantikan `cariPendaftaran` cookie yang lama).
 * 3. **Gerbang mount.** Id kuis yang ada di bank tetapi **tidak dipasang** di
 *    modul ditolak — tanpa mount nyata, gerbang ini tidak bisa diuji.
 *
 * `getSession` di-mock ke principal sungguhan: sesi HTTP bukan yang sedang
 * diuji, dan mock inilah yang membuat action bisa dipanggil tanpa request
 * browser. Sisanya (store, service, repository, DB) nyata.
 *
 * `npm test` mengecualikan pola `.integration.test.ts`; berkas ini hanya
 * dijalankan `npm run test:db` bersama basis data ephemeral milik config.
 *
 * Store kursus di-load **dinamis** setelah `CAREEVO_DATA_DIR` diarahkan ke
 * direktori temp: berkas ini memakai `createKuis`/`createCourse` sungguhan, dan
 * tanpa pengalihan itu store akan menulis `data/kuis.json` milik mesin pengembang.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { sql } from "drizzle-orm";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getDb, tutupDb, type KoneksiDb } from "@/lib/db/client";
import { daftarPengguna } from "@/lib/auth/auth-service";
import {
  daftarEnrollment,
  listAttemptSemua,
  listEnrollmentStaf,
  listProgresSemua,
} from "@/lib/learning/repository";
import { barisPembelajaranDariDb } from "@/lib/learning/dashboard";

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSession: mocks.getSession }));

let db: KoneksiDb = getDb();
let store: typeof import("@/lib/courses/store");
let action: typeof import("@/actions/assessment");

beforeAll(async () => {
  process.env.CAREEVO_DATA_DIR = mkdtempSync(path.join(tmpdir(), "careevo-nilai-"));
  store = await import("@/lib/courses/store");
  // Impor action setelah mock `getSession` terpasang.
  action = await import("@/actions/assessment");
});

beforeEach(async () => {
  db = getDb();
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
});

afterAll(async () => {
  await tutupDb();
});

/** Kuis dua soal: q1 → 0, q2 → 1 (benar). */
async function buatKuisBank() {
  return store.createKuis({
    judul: "Kuis Laporan Staf",
    deskripsi: "Integrasi nilai → laporan",
    nilai_lulus: 70,
    soal: [
      { id: "q1", pertanyaan: "Satu tambah satu?", pilihan: ["2", "3"], jawaban_benar: 0 },
      { id: "q2", pertanyaan: "Langkah pertama?", pilihan: ["Turun", "Naik"], jawaban_benar: 1 },
    ],
  });
}

/** Kursus + modul nyata dengan kuis terpasang — syarat gerbang mount action. */
async function siapkanKursusBerkuis(pasang = true) {
  const kuis = await buatKuisBank();
  const kursus = await store.createCourse({
    title: "Kursus Laporan",
    slug: "kursus-laporan",
    description: "Kursus untuk test integrasi nilai",
    provider: "Careevo",
    url: "https://example.test/kursus-laporan",
    duration_min: 60,
  });
  const modul = await store.createModul(kursus.id, {
    judul: "Modul Kuis",
    ringkasan: "Modul dengan satu kuis",
    durasi_min: 15,
  });
  if (!modul) throw new Error("gagal buat modul");
  if (pasang) await store.pasangKuis(kursus.id, modul.id, kuis.id);
  return { kuis, kursus, modul };
}

async function siapkanLearner(suffix: string) {
  const hasil = await daftarPengguna({
    nama: `Learner ${suffix}`,
    username: `learner_${suffix}`,
    email: `learner_${suffix}@contoh.test`,
    password: "rahasia-panjang",
  });
  if (!hasil.ok) throw new Error("gagal buat akun learner");
  return hasil.principal;
}

describe("nilai kuis terbaca laporan staf tanpa cookie", () => {
  it("action mulai/kirim pada kursus+modul nyata → skor muncul di laporan staf", async () => {
    const principal = await siapkanLearner("lapor");
    mocks.getSession.mockResolvedValue(principal);
    const { kuis, kursus, modul } = await siapkanKursusBerkuis();

    // Keikutsertaan lewat `enrollments` (bukan cookie `ls_enroll`).
    await daftarEnrollment({
      userId: principal.userId,
      courseId: kursus.id,
      slug: kursus.slug,
      title: kursus.title,
    });

    // Action learner sungguhan: buka attempt, lalu kirim `selectedOption` saja.
    const mulai = await action.mulaiKuisVerifiedAction({
      courseId: kursus.id,
      modulId: modul.id,
      quizId: kuis.id,
    });
    expect(mulai).toMatchObject({ ok: true, totalSoal: 2 });
    if (!mulai.ok) throw new Error(mulai.error);

    const kirim = await action.kirimDanSelesaikanKuisAction({
      courseId: kursus.id,
      modulId: modul.id,
      quizId: kuis.id,
      attemptId: mulai.attemptId,
      jawaban: [
        { questionId: "q1", selectedOption: 0 }, // benar
        { questionId: "q2", selectedOption: 1 }, // benar
      ],
    });
    expect(kirim).toMatchObject({ ok: true, score: 100, lulus: true });
    if (!kirim.ok) throw new Error(kirim.error);
    // Kuis lulus menyelesaikan modul lewat jalur terverifikasi.
    expect(kirim.modul).toMatchObject({ ok: true });

    // Query yang benar-benar dipakai halaman `/performa`.
    const [enrollments, progress, attempts] = await Promise.all([
      listEnrollmentStaf(),
      listProgresSemua(),
      listAttemptSemua(),
    ]);
    const baris = barisPembelajaranDariDb({ enrollments, progress, attempts });

    const milikPeserta = baris.find((b) => b.owner === principal.email);
    expect(milikPeserta).toMatchObject({ nama: principal.nama, rataRataKuis: 100, terverifikasi: 1 });

    // Detail per peserta: attempt-nya tersimpan dengan skor server.
    expect(attempts).toHaveLength(1);
    expect(attempts[0].score).toBe(100);
  });

  it("menolak action untuk learner tanpa enrollment di DB", async () => {
    const principal = await siapkanLearner("tanpaenroll");
    mocks.getSession.mockResolvedValue(principal);
    const { kuis, kursus, modul } = await siapkanKursusBerkuis();

    // Tidak ada enrollment — jalur cookie lama tidak lagi dipakai sebagai bukti.
    const hasil = await action.mulaiKuisVerifiedAction({
      courseId: kursus.id,
      modulId: modul.id,
      quizId: kuis.id,
    });

    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.error).toContain("Daftar kursus ini dulu");
    expect(await listAttemptSemua()).toHaveLength(0);
  });

  it("menolak kuis yang ada di bank tetapi tidak dipasang di modul", async () => {
    const principal = await siapkanLearner("belumdipasang");
    mocks.getSession.mockResolvedValue(principal);
    const { kuis, kursus, modul } = await siapkanKursusBerkuis(false);
    await daftarEnrollment({
      userId: principal.userId,
      courseId: kursus.id,
      slug: kursus.slug,
      title: kursus.title,
    });

    const hasil = await action.mulaiKuisVerifiedAction({
      courseId: kursus.id,
      modulId: modul.id,
      quizId: kuis.id,
    });

    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.error).toContain("tidak terpasang");
    expect(await listAttemptSemua()).toHaveLength(0);
  });
});
