/**
 * Bukti bahwa satu kursus benar-benar **bisa dikerjakan** sampai tuntas.
 *
 * Pakai: `npx tsx scripts/seed/konten/verifikasi-kerja.mts [slug]`
 *
 * Menjalankan jalur lengkap lewat service yang sama dengan yang dipakai
 * aplikasi:
 *
 *   1. Daftar kursus (`daftarKursusDb`).
 *   2. Mulai sesi terverifikasi (`mulaiRunDb`).
 *   3. Untuk setiap modul: buka attempt kuis (`mulaiAttemptVerified`), kirim
 *      jawaban **benar** (`kirimAttemptVerified`), lalu selesaikan modul
 *      (`selesaikanModulKuisVerified`).
 *   4. Periksa bahwa completion kursus tercapai (`completion_path`).
 *
 * Ini bukan test unit — ia menyentuh database dev dan menulis progres untuk
 * akun demo. Sesi dicabut di akhir supaya tidak meninggalkan baris sampah.
 */

import { readFileSync } from "node:fs";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, findDemoAccount } from "@/lib/auth/demo-accounts";
import { authenticatePengguna, keluarSession } from "@/lib/auth/auth-service";
import { getCourseBySlug, getKuis } from "@/lib/courses/store";
import { modulUntuk } from "@/lib/courses/modul-resolver";
import { kebijakanDefault } from "@/lib/courses/kebijakan";
import { butuhKamera } from "@/lib/learning/akses";
import { daftarKursusDb, progresKursusDb } from "@/lib/learning/service";
import {
  kirimAttemptVerified,
  mulaiAttemptVerified,
  selesaikanModulKuisVerified,
} from "@/lib/learning/assessment-service";
import { mulaiRunDb } from "@/lib/learning/run-service";
import { ambilEnrollment, ambilRunAktif } from "@/lib/learning/repository";

const env = process.env as unknown as Record<string, string | undefined>;
env.NODE_ENV ??= "development";
for (const baris of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const cocok = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (cocok) env[cocok[1]] ??= cocok[2].replace(/^["']|["']$/g, "");
}

const slug = process.argv[2] ?? "fullstack-web-development-nextjs-15-react-19";
const email = process.argv[3] ?? "user@careevo.test";
if (!findDemoAccount(email)) {
  console.error(`Bukan akun demo. Pilihan: ${DEMO_ACCOUNTS.map((a) => a.email).join(", ")}`);
  process.exit(1);
}

const kursus = await getCourseBySlug(slug);
if (!kursus) {
  console.error(`Kursus ${slug} tidak ada.`);
  process.exit(1);
}

const masuk = await authenticatePengguna({ email, password: DEMO_PASSWORD, izinkanDemo: true });
if (!masuk.token || !masuk.hasil.ok) {
  console.error(`Login gagal: ${JSON.stringify(masuk.hasil)}`);
  process.exit(1);
}
const principal = masuk.hasil.principal;
const kebijakan = kursus.kebijakan ?? kebijakanDefault();

try {
  console.log(`Kursus: ${kursus.title} (${slug})`);
  console.log(`Peserta: ${email}\n`);

  await daftarKursusDb({
    principal,
    courseId: kursus.id,
    slug: kursus.slug,
    title: kursus.title,
  });
  const enrollment = await ambilEnrollment(principal.userId, kursus.id);
  if (!enrollment) throw new Error("Enrollment tidak terbentuk.");
  console.log(`1. Terdaftar (enrollment ${enrollment.id.slice(0, 8)}…)`);

  const runAktif = await ambilRunAktif(principal.userId, kursus.id);
  if (!runAktif) {
    await mulaiRunDb({
      principal,
      enrollmentId: enrollment.id,
      courseId: kursus.id,
      policyVersion: kebijakan.versi,
      batasMenit: 240,
    });
  }
  console.log("2. Sesi terverifikasi aktif");

  const modul = await modulUntuk(kursus.id);
  console.log(`3. Kurikulum: ${modul.length} modul\n`);

  let diselesaikan = 0;
  for (const m of modul) {
    const kuis = (m.kuis ?? [])[0];
    if (!kuis) {
      console.log(`   - ${m.judul}: TANPA kuis, dilewati`);
      continue;
    }
    const definisi = await getKuis(kuis.id);
    if (!definisi) throw new Error(`Kuis ${kuis.id} tidak ada di bank.`);

    const { attempt } = await mulaiAttemptVerified({
      principal,
      enrollmentId: enrollment.id,
      quizId: kuis.id,
    });
    // Jawab semua soal dengan indeks yang benar → skor 100, pasti lulus.
    const jawaban = definisi.soal.map((s) => ({
      questionId: s.id,
      selectedOption: s.jawaban_benar,
    }));
    const kirim = await kirimAttemptVerified({ principal, attemptId: attempt.id, jawaban });
    if (!kirim.lulus) throw new Error(`Kuis "${kuis.judul}" tidak lulus (skor ${kirim.score}).`);

    await selesaikanModulKuisVerified({
      principal,
      courseId: kursus.id,
      modulId: m.id,
      quizId: kuis.id,
      attemptId: attempt.id,
      policyVersion: kebijakan.versi,
      wajibKamera: butuhKamera(kebijakan),
    });
    diselesaikan += 1;
    console.log(`   ✓ ${m.judul} — skor ${kirim.score}`);
  }

  const akhir = await progresKursusDb(principal, kursus.id);
  const selesaiValid = modul.filter((m) => akhir.selesai.includes(m.id)).length;
  console.log(
    `\n4. Progres: ${selesaiValid}/${modul.length} modul selesai ` +
      `(${diselesaikan} lewat kuis terverifikasi)`,
  );
  console.log(
    selesaiValid === modul.length
      ? "\nLULUS — seluruh modul bisa diselesaikan lewat kuis."
      : `\nCATATAN — ${modul.length - selesaiValid} modul belum selesai.`,
  );
} finally {
  await keluarSession(masuk.token);
}
