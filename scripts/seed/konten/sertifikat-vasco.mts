/**
 * Terbitkan sertifikat HMAC **asli** untuk akun Vasco.
 *
 * Bukan hardcode: script ini menempuh alur produksi yang sama dengan
 * `scripts/seed/konten/demo-integritas.mts` —
 *   buatSubmissionDb → kirimSubmissionDb → tetapkanReviewerDb → mulaiReviewDb
 *   → putuskanReviewDb(approved)
 * — sehingga attestation-nya ditandatangani HMAC dan lolos `/verify`.
 *
 * Satu-satunya hal yang "dibuat" adalah ISI karya akhir, dan itu memang begitu
 * cara kerja submission: peserta mengirim karya, verifikator menilai.
 *
 * Akun Vasco dibuat lewat Google OAuth, jadi **tidak punya password**. Script
 * ini menambahkan kredensial lebih dulu supaya akunnya bisa dipakai demo
 * tanpa mengandalkan Google.
 *
 * Pakai:
 *   npx tsx scripts/seed/konten/sertifikat-vasco.mts          # terbitkan
 *   npx tsx scripts/seed/konten/sertifikat-vasco.mts --hapus  # bersihkan
 */

import { readFileSync } from "node:fs";
import { eq, inArray } from "drizzle-orm";

import {
  ambilKredensialCourse,
  buatSubmissionDb,
  kirimSubmissionDb,
  mulaiReviewDb,
  putuskanReviewDb,
  tetapkanReviewerDb,
  type RubrikReview,
} from "@/lib/review/service";
import { authenticatePengguna } from "@/lib/auth/auth-service";
import { ambilEnrollment } from "@/lib/learning/repository";
import { hashPassword } from "@/lib/auth/password";
import { simpanKredensial } from "@/lib/auth/identity-repository";
import type { SessionPrincipal } from "@/lib/auth/principal";
import { getDb, tutupDb } from "@/lib/db/client";
import { attestations, badges, reviews, submissions } from "@/lib/db/schema";

// --- env (pola yang sama dengan seed demo-integritas) -----------------------
const env = process.env as unknown as Record<string, string | undefined>;
env.NODE_ENV ??= "development";
for (const baris of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(baris);
  if (m && !baris.trimStart().startsWith("#")) env[m[1]] ??= m[2].trim();
}

/* ------------------------------------------------------------------ *
 * Konfigurasi
 * ------------------------------------------------------------------ */

const PESERTA_EMAIL = "vascoyudha1@gmail.com";
/** Password yang akan dipasang bila akunnya belum punya kredensial. */
const PESERTA_SANDI = "careevo-demo-2026";

const STAF_EMAIL = "e2e-integritas-staf@careevo.test";
const STAF_SANDI = "careevo-e2e-password";

/** Karya akhir yang dikirim Vasco untuk kursus Dasar C++. */
const KONTEN = {
  judul: "Karya akhir Dasar C++ — kalkulator CLI",
  catatan:
    "Karya akhir kursus Dasar C++: program kalkulator CLI dengan header iostream, " +
    "fungsi main, dan penanganan pembagian nol. Ditulis sendiri selama sesi " +
    "terverifikasi; kode tersimpan di ruang kerja.",
  berkas: [
    { path: "kalkulator.cpp", ukuran: 812 },
    { path: "README.md", ukuran: 214 },
  ],
};

/**
 * Rubrik penilaian, skala 1–4 per kriteria (`SKALA_RUBRIC_MAKS = 4`).
 * Skor akhirnya 90/100 — tinggi, tapi tidak sempurna.
 */
const RUBRIK: RubrikReview = {
  kelengkapan: 4,
  kualitas: 3,
  orisinalitas: 4,
  ketepatan_brief: 4,
  dokumentasi: 3,
};

const RASIONAL =
  "Karya akhir dinilai memenuhi brief kursus: kalkulator CLI berjalan, " +
  "penanganan galat pembagian nol ada, dan README menjelaskan cara menjalankan. " +
  "Dokumentasi dan kedalaman kualitas masih bisa ditingkatkan.";

/* ------------------------------------------------------------------ *
 * Helper
 * ------------------------------------------------------------------ */

async function cobaMasuk(email: string, password: string) {
  return authenticatePengguna({ email, password });
}

/**
 * Pastikan akun punya kredensial (Vasco dibuat lewat Google, jadi belum punya).
 * Mengembalikan principal setelah kredensialnya benar-benar bisa dipakai.
 */
async function pastikanBisaLogin(email: string, password: string): Promise<SessionPrincipal> {
  const pertama = await cobaMasuk(email, password);
  if (pertama.hasil.ok && pertama.token) return pertama.hasil.principal;

  const db = getDb();
  const user = await db.query.users.findFirst({
    where: (u, { eq: eqOp }) => eqOp(u.emailNormalized, email),
  });
  if (!user) throw new Error(`User ${email} tidak ditemukan.`);

  console.log(`  (memasang password untuk ${email} — akun ini belum punya kredensial)`);
  await simpanKredensial(db, { userId: user.id, passwordHash: await hashPassword(password) });

  const kedua = await cobaMasuk(email, password);
  if (!kedua.hasil.ok || !kedua.token) {
    throw new Error(`Masih gagal login sebagai ${email}.`);
  }
  return kedua.hasil.principal;
}

/** Course pertama yang selesai lewat jalur terverifikasi. */
async function kursusTerverifikasi(userId: string): Promise<string | null> {
  const db = getDb();
  const rows = await db.query.enrollments.findMany({
    where: (e, { and, eq: eqOp }) =>
      and(eqOp(e.userId, userId), eqOp(e.status, "completed"), eqOp(e.completionPath, "terverifikasi")),
    limit: 1,
  });
  return rows[0]?.courseId ?? null;
}

/* ------------------------------------------------------------------ *
 * Terbitkan
 * ------------------------------------------------------------------ */

async function terbitkan(): Promise<void> {
  const peserta = await pastikanBisaLogin(PESERTA_EMAIL, PESERTA_SANDI);
  const staf = await pastikanBisaLogin(STAF_EMAIL, STAF_SANDI);

  const courseId = await kursusTerverifikasi(peserta.userId);
  if (!courseId) throw new Error(`${PESERTA_EMAIL} tidak punya course selesai lewat jalur terverifikasi.`);

  console.log(`Peserta : ${peserta.email} (${peserta.userId})`);
  console.log(`Penilai : ${staf.email} (${staf.userId})`);
  console.log(`Course  : ${courseId}`);

  const sudah = await ambilKredensialCourse(peserta, courseId);
  if (sudah) {
    console.log(`\nSudah punya sertifikat: ${sudah}`);
    console.log("Tidak ada yang dibuat. Jalankan --hapus dulu untuk menerbitkan ulang.");
    return;
  }

  const enrollment = await ambilEnrollment(peserta.userId, courseId);
  if (!enrollment) throw new Error("Enrollment tidak ditemukan.");

  console.log("\n1/5 buat submission (gerbang kelayakan ikut dijalankan)…");
  const { submission } = await buatSubmissionDb({
    principal: peserta,
    courseId,
    enrollmentId: enrollment.id,
    konten: { ...KONTEN, berkas: [...KONTEN.berkas] },
  });

  console.log("2/5 kirim submission…");
  await kirimSubmissionDb({ principal: peserta, submissionId: submission.id });

  console.log("3/5 tetapkan reviewer…");
  await tetapkanReviewerDb({ principal: staf, submissionId: submission.id, reviewerUserId: staf.userId });

  console.log("4/5 mulai review…");
  await mulaiReviewDb({ principal: staf, submissionId: submission.id });

  console.log("5/5 putuskan approved (menerbitkan attestation + badge)…");
  const keputusan = await putuskanReviewDb({
    principal: staf,
    submissionId: submission.id,
    decision: "approved",
    rubric: RUBRIK,
    rationale: RASIONAL,
  });

  const token =
    (await ambilKredensialCourse(peserta, courseId)) ?? keputusan.attestation?.publicToken ?? null;
  if (!token) throw new Error("Sertifikat tidak terbit.");

  console.log("\n=== SELESAI ===");
  console.log(`submission    : ${submission.id}`);
  console.log(`attestation   : ${keputusan.attestation?.id ?? "(tidak ada)"}`);
  console.log(`badge         : ${keputusan.badge?.id ?? "(tidak ada)"}`);
  console.log(`token publik  : ${token}`);
  console.log(`\nLogin demo    : ${PESERTA_EMAIL} / ${PESERTA_SANDI}`);
  console.log(`Buka          : http://localhost:3000/verify/${token}`);
}

/* ------------------------------------------------------------------ *
 * Hapus
 * ------------------------------------------------------------------ */

async function hapus(): Promise<void> {
  const r = await cobaMasuk(PESERTA_EMAIL, PESERTA_SANDI);
  if (!r.hasil.ok || !r.token) throw new Error(`Tidak bisa login sebagai ${PESERTA_EMAIL}.`);
  const userId = r.hasil.principal.userId;
  const db = getDb();

  const subs = await db.select({ id: submissions.id }).from(submissions).where(eq(submissions.userId, userId));
  const ids = subs.map((s) => s.id);
  console.log(`Submission milik ${PESERTA_EMAIL}: ${ids.length}`);

  // Urutan penting: reviews menunjuk submission, attestations menunjuk review.
  if (ids.length > 0) {
    const revs = await db.select({ id: reviews.id }).from(reviews).where(inArray(reviews.submissionId, ids));
    const revIds = revs.map((x) => x.id);
    if (revIds.length > 0) {
      await db.delete(attestations).where(inArray(attestations.sourceReviewId, revIds));
    }
    await db.delete(reviews).where(inArray(reviews.submissionId, ids));
  }
  // Sisa attestation/badge milik peserta ini (mis. tanpa source_review).
  await db.delete(attestations).where(eq(attestations.subjectUserId, userId));
  await db.delete(badges).where(eq(badges.userId, userId));
  await db.delete(submissions).where(eq(submissions.userId, userId));

  const sisaSub = await db.select({ id: submissions.id }).from(submissions).where(eq(submissions.userId, userId));
  const sisaAtt = await db.select({ id: attestations.id }).from(attestations).where(eq(attestations.subjectUserId, userId));
  console.log(`Dihapus. Sisa submission=${sisaSub.length}, attestation=${sisaAtt.length}`);
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

try {
  if (process.argv.includes("--hapus")) await hapus();
  else await terbitkan();
} catch (err) {
  console.error("\nGAGAL:", err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
} finally {
  await tutupDb();
}
