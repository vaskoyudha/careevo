/**
 * E2E: anti-cheat (skor kejujuran) — dari catatan staf sampai pemulihan.
 *
 * Pakai: `npx tsx scripts/seed/konten/e2e-integritas.mts [slug]`
 *
 * Yang diuji adalah aturan yang dikunci di `AGENTS.md` § "Skor kejujuran",
 * lewat service produksi — bukan `hitungSkorIntegritas` langsung — supaya
 * terbukti pada jalur yang benar-benar dipakai aplikasi:
 *
 *   1. Catat pelanggaran oleh staf → skor **turun**.
 *   2. Penalti adalah **snapshot** bobot katalog, bukan referensi.
 *   3. Batas **20 poin per course**, dijepit per course (bukan per total).
 *   4. `learning_events` **tidak pernah** menurunkan skor.
 *   5. Menyelesaikan ulang lewat jalur **terverifikasi** → `expunged` otomatis
 *      → skor kembali. Baris **tidak dihapus**, hanya berubah status.
 *   6. Pelanggaran yang dicatat **setelah** completion tidak ikut dipulihkan
 *      (batas waktu `created_at <= completedAt`).
 *   7. Jalur **informal** tidak memulihkan apa pun.
 *   8. Skor **tidak tersimpan** — dibaca ulang dari baris `active` saja.
 *
 * Menjalankan skrip ini menulis ke database (violation, progress, completion).
 * Peserta dibuat baru setiap kali, jadi tidak ada state lama yang bisa menutupi
 * pengujian.
 */

import { readFileSync } from "node:fs";
import { daftarPengguna, authenticatePengguna, keluarSession } from "@/lib/auth/auth-service";
import { beriRole } from "@/lib/auth/invitation";
import type { SessionPrincipal } from "@/lib/auth/principal";
import { getCourseBySlug, getKuis } from "@/lib/courses/store";
import { modulUntuk } from "@/lib/courses/modul-resolver";
import { kebijakanDefault } from "@/lib/courses/kebijakan";
import { butuhKamera } from "@/lib/learning/akses";
import { daftarKursusDb, selesaikanKursusDb, tandaiModulDb } from "@/lib/learning/service";
import {
  kirimAttemptVerified,
  mulaiAttemptVerified,
  selesaikanModulKuisVerified,
} from "@/lib/learning/assessment-service";
import { mulaiRunDb } from "@/lib/learning/run-service";
import { ambilEnrollment, ambilRunAktif } from "@/lib/learning/repository";
import {
  catatPelanggaranDb,
  listSemuaPelanggaran,
  ringkasanPelanggaranCourseDb,
  skorIntegritasDb,
} from "@/lib/integritas/service";
import { getDb } from "@/lib/db/client";
import { sql } from "drizzle-orm";

const env = process.env as unknown as Record<string, string | undefined>;
env.NODE_ENV ??= "development";
for (const baris of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const cocok = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (cocok) env[cocok[1]] ??= cocok[2].replace(/^["']|["']$/g, "");
}

const slug = process.argv[2] ?? "it-security-fundamental";
const emailStaf = "e2e-integritas-staf@careevo.test";
const sandi = "careevo-e2e-password";
const stempel = Date.now().toString(36);
const emailPeserta = `e2e-integritas-${stempel}@careevo.test`;

let lulus = 0;
let gagal = 0;

/** Satu klaim yang harus benar; kegagalan tidak menghentikan skrip. */
function klaim(nama: string, benar: boolean, detail = ""): void {
  if (benar) {
    lulus += 1;
    console.log(`   ✓ ${nama}${detail ? ` — ${detail}` : ""}`);
  } else {
    gagal += 1;
    console.log(`   ✗ ${nama}${detail ? ` — ${detail}` : ""}`);
  }
}

function PastikanBolehMenulis(): void {
  const url = env.DATABASE_URL ?? "";
  if (!url) throw new Error("DATABASE_URL kosong.");
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();
  if (process.env.CAREEVO_IZIN_TULIS_PROD === "1") return;
  if (host && !/^(localhost|127\.0\.0\.1)/.test(host)) {
    throw new Error(`Menolak menulis ke database non-lokal (${host}).`);
  }
}

async function staf(): Promise<SessionPrincipal> {
  const masuk = await authenticatePengguna({ email: emailStaf, password: sandi });
  if (masuk.token && masuk.hasil.ok) return masuk.hasil.principal;
  const dibuat = await daftarPengguna({
    nama: "Staf Integritas E2E",
    username: `intstaf${stempel}`,
    email: emailStaf,
    password: sandi,
  });
  if (!dibuat.ok) throw new Error(`Gagal membuat staf: ${dibuat.alasan}`);
  const r = await beriRole({ userId: dibuat.principal.userId, role: "admin", grantedByUserId: null });
  if (!r.ok) throw new Error("Gagal memberi role admin ke staf.");
  const m2 = await authenticatePengguna({ email: emailStaf, password: sandi });
  if (!m2.token || !m2.hasil.ok) throw new Error("Login staf gagal.");
  return m2.hasil.principal;
}

async function pesertaBaru(): Promise<{ p: SessionPrincipal; token: string }> {
  const dibuat = await daftarPengguna({
    nama: "Peserta Integritas E2E",
    username: `intpes${stempel}`,
    email: emailPeserta,
    password: sandi,
  });
  if (!dibuat.ok) throw new Error(`Gagal membuat peserta: ${dibuat.alasan}`);
  const m = await authenticatePengguna({ email: emailPeserta, password: sandi });
  if (!m.token || !m.hasil.ok) throw new Error("Login peserta gagal.");
  return { p: m.hasil.principal, token: m.token };
}

async function main() {
  PastikanBolehMenulis();

  const kursus = await getCourseBySlug(slug);
  if (!kursus) throw new Error(`Kursus ${slug} tidak ada.`);
  const kebijakan = kursus.kebijakan ?? kebijakanDefault();
  const staff = await staf();
  const { p: learner, token: tokenLearner } = await pesertaBaru();

  console.log(`Kursus  : ${kursus.title} (${kursus.id})`);
  console.log(`Peserta : ${emailPeserta}`);
  console.log(`Staf    : ${emailStaf}\n`);

  try {
    await daftarKursusDb({ principal: learner, courseId: kursus.id, slug: kursus.slug, title: kursus.title });
    const enrollment = await ambilEnrollment(learner.userId, kursus.id);
    if (!enrollment) throw new Error("Enrollment tidak terbentuk.");

    // Sesi terverifikasi dibuka lebih awal karena `learning_events` berikatan ke
    // `learning_run_id` — tanpa run sungguhan tidak ada cara menyimulasikan sinyal
    // peramban, dan persis itulah yang tidak boleh memotong skor.
    await mulaiRunDb({
      principal: learner,
      enrollmentId: enrollment.id,
      courseId: kursus.id,
      policyVersion: kebijakan.versi,
      batasMenit: 240,
    });
    const run = await ambilRunAktif(learner.userId, kursus.id);
    if (!run) throw new Error("Run terverifikasi tidak terbentuk.");

    /* --- 0. Baseline ------------------------------------------------ */
    const awal = await skorIntegritasDb(learner.userId);
    klaim("skor awal peserta = 100", awal.skor === 100, `skor=${awal.skor}`);

    /* --- 1. Staf mencatat pelanggaran → skor turun ------------------ */
    const v1 = await catatPelanggaranDb({
      principal: staff,
      userId: learner.userId,
      courseId: kursus.id,
      kind: "pola_salin_tempel",
      reason: "Bahan ditempel dalam jumlah besar saat menjawab asesmen.",
    });
    const setelah1 = await skorIntegritasDb(learner.userId);
    klaim("1 pelanggaran (pola_salin_tempel, bobot 10) → skor 90", setelah1.skor === 90, `skor=${setelah1.skor}`);
    klaim("penalti = snapshot bobot katalog (10)", v1.penalty === 10, `penalty=${v1.penalty}`);

    /* --- 2. learning_events TIDAK boleh menurunkan skor ------------ */
    for (const [i, kind] of ["blur", "window_blur", "visibility_hidden"].entries()) {
      await getDb().execute(sql`
        insert into learning_events (learning_run_id, kind, sequence, occurred_at)
        values (${run.id}, ${kind}, ${900 + i}, now())
      `);
    }
    const setelahEvent = await skorIntegritasDb(learner.userId);
    klaim(
      "3 learning_events (blur/visibility) tidak menurunkan skor",
      setelahEvent.skor === setelah1.skor,
      `skor tetap ${setelahEvent.skor}`,
    );

    /* --- 3. Batas 20 poin per course -------------------------------- */
    for (let i = 0; i < 3; i += 1) {
      await catatPelanggaranDb({
        principal: staff,
        userId: learner.userId,
        courseId: kursus.id,
        kind: "meninggalkan_sesi",
        reason: `Ditinggalkan saat sesi terverifikasi berjalan (kejadian ${i + 1}).`,
      });
    }
    const penuh = await skorIntegritasDb(learner.userId);
    // 10 + 5 + 5 + 5 = 25 mentah, dijepit ke 20 per course → skor 80.
    klaim("batas 20 poin per course menjepit 25 → 20", penuh.skor === 80, `skor=${penuh.skor}`);
    klaim("rincian menandai penjepitan (dipotong)", penuh.perCourse[0]?.dipotong === true);
    klaim("penalti total = 20 (bukan 25)", penuh.penaltiTotal === 20, `total=${penuh.penaltiTotal}`);

    /* --- 4. Laporan: katalog utuh, termasuk yang 0 ------------------ */
    const tabel = await ringkasanPelanggaranCourseDb(learner.userId, kursus.id);
    klaim("tabel report memuat 3 jenis katalog utuh", tabel.length === 3, `baris=${tabel.length}`);
    klaim("jumlah baris dihitung termasuk yang dipulihkan", tabel.reduce((n, b) => n + b.jumlah, 0) === 4);

    /* --- 5. Pemulihan manual oleh staf ----------------------------- */
    const semuaSebelum = await listSemuaPelanggaran(learner.userId);
    klaim("tercatat 4 baris pelanggaran", semuaSebelum.length === 4, `n=${semuaSebelum.length}`);

    /* --- 6. Selesaikan course lewat jalur terverifikasi --------------- */
    // Run sudah dibuka di atas; di sini hanya mengisi modul lewat kuis.
    const modul = await modulUntuk(kursus.id);
    for (const m of modul) {
      const kuis = (m.kuis ?? [])[0];
      if (!kuis) continue;
      const definisi = await getKuis(kuis.id);
      if (!definisi) throw new Error(`Kuis ${kuis.id} tidak ada.`);
      const { attempt } = await mulaiAttemptVerified({
        principal: learner,
        enrollmentId: enrollment.id,
        quizId: kuis.id,
      });
      const kirim = await kirimAttemptVerified({
        principal: learner,
        attemptId: attempt.id,
        jawaban: definisi.soal.map((s) => ({ questionId: s.id, selectedOption: s.jawaban_benar })),
      });
      if (!kirim.lulus) throw new Error(`Kuis "${kuis.judul}" tidak lulus.`);
      await selesaikanModulKuisVerified({
        principal: learner,
        courseId: kursus.id,
        modulId: m.id,
        quizId: kuis.id,
        attemptId: attempt.id,
        policyVersion: kebijakan.versi,
        wajibKamera: butuhKamera(kebijakan),
      });
    }
    const completion = await selesaikanKursusDb({
      principal: learner,
      courseId: kursus.id,
      policyVersion: kebijakan.versi,
    });
    klaim("course selesai lewat jalur terverifikasi", completion.selesai && completion.completion.completionPath === "terverifikasi");

    const setelahSelesai = await skorIntegritasDb(learner.userId);
    klaim(
      "penyelesaian ulang memulihkan skor ke 100",
      setelahSelesai.skor === 100,
      `skor=${setelahSelesai.skor}`,
    );

    const semuaSesudah = await listSemuaPelanggaran(learner.userId);
    klaim(
      "baris TIDAK dihapus, hanya jadi expunged",
      semuaSesudah.length === 4,
      `n=${semuaSesudah.length}`,
    );
    klaim(
      "semua baris berstatus expunged",
      semuaSesudah.every((b) => b.status === "expunged"),
      `aktif=${setelahSelesai.jumlahAktif}`,
    );
    klaim(
      "expunged punya expunged_at (bentuk CHECK terpenuhi)",
      semuaSesudah.every((b) => b.expungedAt !== null),
    );

    /* --- 7. Pelanggaran SETELAH completion tidak dipulihkan -------- */
    await catatPelanggaranDb({
      principal: staff,
      userId: learner.userId,
      courseId: kursus.id,
      kind: "plagiarisme",
      reason: "Karya WTF yang menyalin pekerjaan orang lain, dilaporkan setelah kursus selesai.",
    });
    const setelahBaru = await skorIntegritasDb(learner.userId);
    klaim(
      "pelanggaran baru sesudah completion memotong lagi (batas waktu)",
      setelahBaru.skor === 80,
      `skor=${setelahBaru.skor}`,
    );
    const barisBaru = (await listSemuaPelanggaran(learner.userId)).find((b) => b.kind === "plagiarisme");
    klaim("baris plagiarisme tetap active", barisBaru?.status === "active");

    /* --- 8. Jalur informal TIDAK memulihkan ------------------------- */
    const kursusKedua = "ui-ux-design-fundamental";
    const k2 = await getCourseBySlug(kursusKedua);
    if (k2) {
      await daftarKursusDb({ principal: learner, courseId: k2.id, slug: k2.slug, title: k2.title });
      const e2 = await ambilEnrollment(learner.userId, k2.id);
      if (e2) {
        await catatPelanggaranDb({
          principal: staff,
          userId: learner.userId,
          courseId: k2.id,
          kind: "pola_salin_tempel",
          reason: "Pola salin-tempel pada course kedua.",
        });
        const sebelumInformal = await skorIntegritasDb(learner.userId);
        for (const m of await modulUntuk(k2.id)) {
          await tandaiModulDb({
            principal: learner,
            courseId: k2.id,
            modulId: m.id,
            sumber: "informal",
            nama: learner.nama,
          });
        }
        const informal = await selesaikanKursusDb({
          principal: learner,
          courseId: k2.id,
          policyVersion: (k2.kebijakan ?? kebijakanDefault()).versi,
        });
        const sesudahInformal = await skorIntegritasDb(learner.userId);
        klaim(
          "jalur informal TIDAK memulihkan pelanggaran",
          informal.selesai &&
            informal.completion.completionPath === "informal" &&
            sesudahInformal.skor === sebelumInformal.skor,
          `skor ${sebelumInformal.skor} → ${sesudahInformal.skor}`,
        );
      }
    }

    /* --- 9. Skor tidak tersimpan ------------------------------------- */
    const kolomSkor = await getDb().execute(sql`
      select column_name from information_schema.columns
      where table_name = 'integrity_violations'
    `);
    const adaKolomSkor = JSON.stringify(kolomSkor).includes("score");
    klaim("tidak ada kolom score tersimpan di integrity_violations", !adaKolomSkor);

    console.log(`\n=== RINGKASAN ===`);
    console.log(`Lulus : ${lulus}`);
    console.log(`Gagal : ${gagal}`);
    console.log(gagal === 0 ? "\nHASIL: anti-cheat bekerja end-to-end." : "\nHASIL: ada klaim yang gagal.");
    if (gagal > 0) process.exitCode = 1;
  } finally {
    await keluarSession(tokenLearner);
  }
}

main().catch((err: unknown) => {
  console.error("\nE2E INTEGRITAS GAGAL:", err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
