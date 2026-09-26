"use server";

import { getSession } from "@/lib/auth/session";
import { getCourseById } from "@/lib/courses/store";
import { kebijakanDefault } from "@/lib/courses/kebijakan";
import { modulUntuk } from "@/lib/courses/modul-resolver";
import {
  GalatAsesmen,
  OPSI_TIDAK_DIJAWAB,
  kirimAttemptVerified,
  mulaiAttemptVerified,
  selesaikanModulKuisVerified,
  type KodeGalatAsesmen,
} from "@/lib/learning/assessment-service";
import {
  progresKursusDb,
  type HasilSelesaikan,
  type HasilTandaiModul,
} from "@/lib/learning/service";
import { safeRevalidate } from "@/lib/actions-common";
import type { SessionPrincipal } from "@/lib/auth/principal";

/**
 * Server Action asesmen terverifikasi — **tipis, tanpa logika bisnis**.
 *
 * Pembagian tanggung jawabnya sengaja ketat:
 *
 * - **Action** memegang sesi, memeriksa bahwa kuis benar-benar terpasang di
 *   modul, membaca versi kebijakan kursus, lalu mendelegasikan. Ia tidak pernah
 *   menghitung skor, menentukan kelulusan, maupun menyentuh database.
 * - **Service** (`@/lib/learning/assessment-service`) memegang seluruh aturan
 *   penilaian: snapshot dibekukan saat attempt dibuka, skor dihitung dari
 *   snapshot, kepemilikan diperiksa di setiap langkah, dan progres ditulis
 *   lewat `tandaiModulDb`/`selesaikanKursusDb`.
 *
 * Yang **tidak pernah** menyeberang ke pemanggil: `assessmentSnapshot` dan
 * kunci jawaban. Sukses `mulaiKuisVerifiedAction` hanya membawa `attemptId` +
 * `totalSoal`, dan sukses pengiriman hanya membawa `score` + `lulus` — semuanya
 * dihitung server. `score`/`isCorrect`/status lulus dari klien tidak pernah
 * dibaca; satu-satunya input penilaian adalah `selectedOption` per soal.
 *
 * Principal-nya **learner** (bucket `getSession()`), bukan staf: gerbang
 * `gateStaff()` sengaja tidak dipakai di sini karena peserta yang berhak
 * mengerjakan kuis justru bukan staf.
 */

/** Hasil `mulaiKuisVerifiedAction`. Sukses tidak membawa kunci jawaban. */
export type HasilMulaiKuis =
  | { ok: true; attemptId: string; totalSoal: number }
  | { ok: false; error: string };

/** Hasil pengiriman jawaban. `score` dihitung server, bukan oleh action. */
export type HasilKirimKuis =
  | { ok: true; score: number; lulus: boolean }
  | { ok: false; error: string };

/** Hasil `kirimDanSelesaikanKuisAction`: pengiriman + efek progresnya. */
export type HasilKirimDanSelesaikan =
  | {
      ok: true;
      attemptId: string;
      score: number;
      lulus: boolean;
      /**
       * Hasil penandaan modul — **hanya ada bila `lulus`**. Tanpa kelulusan
       * tidak ada yang ditandai, jadi tidak ada yang bisa dilaporkan.
       */
      modul?: HasilTandaiModul;
      /** Evaluasi penyelesaian kursus — hanya ada bila `lulus`. */
      kursus?: HasilSelesaikan;
    }
  | { ok: false; error: string };

/**
 * Principal dari sesi yang aktif, atau pesan penolakan.
 *
 * `getSession()` mengembalikan `SessionPrincipal` dari database (bukan claim
 * cookie), jadi identitas di sini tidak bisa dipalsukan klien.
 */
async function principalAsesmen(): Promise<
  { ok: true; principal: SessionPrincipal } | { ok: false; error: string }
> {
  const principal = await getSession();
  if (!principal) {
    return { ok: false, error: "Masuk dulu untuk mengerjakan kuis terverifikasi." };
  }
  return { ok: true, principal };
}

/**
 * Pesan UI untuk galat domain asesmen.
 *
 * Dipetakan per kode, bukan memakai `err.message` apa adanya: pesan service
 * ditulis untuk log/audit, sedangkan copy yang dibaca peserta dikunci di sini
 * supaya perubahan internal tidak diam-diam mengubah kalimat di layar.
 */
function pesanGalatAsesmen(err: unknown): string {
  if (err instanceof GalatAsesmen) {
    const pesan: Record<KodeGalatAsesmen, string> = {
      kuis_tidak_ditemukan: "Kuis tidak ditemukan di bank soal.",
      enrollment_tidak_ditemukan: "Daftar kursus ini dulu sebelum mengerjakan kuis.",
      attempt_tidak_ditemukan: "Attempt kuis tidak ditemukan.",
      bukan_pemilik: "Attempt ini bukan milik Anda.",
      jawaban_tidak_lengkap: "Jawaban belum lengkap.",
      bentrok_attempt: "Gagal membuka kuis karena bentrok. Silakan coba lagi.",
      attempt_belum_dikirim: "Kuis belum dikirim, jadi belum bisa diselesaikan.",
      attempt_belum_lulus: "Kuis belum lulus; modul belum bisa diselesaikan.",
      kuis_tidak_cocok: "Attempt ini bukan untuk kuis yang terpasang di modul.",
      modul_tidak_ditemukan: "Modul tidak ditemukan pada kursus ini.",
    };
    return pesan[err.kode] ?? "Terjadi kesalahan saat memproses kuis.";
  }
  return "Terjadi kesalahan saat memproses kuis.";
}

/**
 * Normalisasi jawaban dari wire menjadi bentuk yang dinilai service.
 *
 * Boundary parsing, bukan penilaian: `selectedOption` yang bukan bilangan bulat
 * dipetakan ke `OPSI_TIDAK_DIJAWAB` (di luar rentang `pilihan[]`, jadi selalu
 * dinilai salah oleh `hitungSkorSnapshot`). Tanpa ini, nilai non-angka lolos ke
 * kolom `integer` dan gagal sebagai galat database alih-alih soal yang salah.
 * `isCorrect`/`score` **tidak** dibaca dari sini — keduanya dihitung server.
 */
function sajikanJawaban(
  input: unknown,
): Array<{ questionId: string; selectedOption: number }> {
  if (!Array.isArray(input)) return [];
  const hasil: Array<{ questionId: string; selectedOption: number }> = [];
  for (const item of input) {
    if (item === null || typeof item !== "object") continue;
    const baris = item as { questionId?: unknown; selectedOption?: unknown };
    if (typeof baris.questionId !== "string" || baris.questionId.length === 0) continue;
    hasil.push({
      questionId: baris.questionId,
      selectedOption:
        typeof baris.selectedOption === "number" && Number.isInteger(baris.selectedOption)
          ? baris.selectedOption
          : OPSI_TIDAK_DIJAWAB,
    });
  }
  return hasil;
}

/** Kirim attempt lewat service; galat domain dipetakan ke state, bukan dilempar. */
async function kirimInternal(
  principal: SessionPrincipal,
  attemptId: string,
  jawaban: unknown,
): Promise<HasilKirimKuis> {
  if (!attemptId) return { ok: false, error: "Attempt kuis tidak ditemukan." };
  try {
    const hasil = await kirimAttemptVerified({
      principal,
      attemptId,
      jawaban: sajikanJawaban(jawaban),
    });
    // `attempt` sengaja tidak diteruskan: yang dibutuhkan UI hanya skor dan
    // kelulusan, dan membawa baris attempt ke pemanggil memperbesar permukaan
    // yang bisa membocorkan snapshot kelak.
    return { ok: true, score: hasil.score, lulus: hasil.lulus };
  } catch (err) {
    return { ok: false, error: pesanGalatAsesmen(err) };
  }
}

/**
 * Buka attempt kuis terverifikasi untuk sebuah modul.
 *
 * Tiga gerbang sebelum attempt dibuat, semuanya di server:
 *
 * 1. Ada sesi — tanpa principal tidak ada pemilik attempt.
 * 2. Modul ada di `modulUntuk(courseId)` **dan** kuis benar-benar terpasang di
 *    modul itu. Tanpa pemeriksaan kedua, peserta bisa membuka attempt kuis mana
 *    pun di bank soal hanya dengan menebak id-nya.
 * 3. Peserta benar-benar terdaftar (`progresKursusDb` → `enrollment`). Attempt
 *    tanpa enrollment tidak punya tempat untuk menyimpan bukti penyelesaian.
 *
 * Definisi kuis dibekukan service saat attempt dibuat, jadi perubahan bank soal
 * setelahnya tidak bisa mengubah hasil attempt ini.
 */
export async function mulaiKuisVerifiedAction(input: {
  courseId: string;
  modulId: string;
  quizId: string;
}): Promise<HasilMulaiKuis> {
  const auth = await principalAsesmen();
  if (!auth.ok) return auth;

  // Resolver tunggal, bukan `modulKursus()`: modul tersimpan menang atas
  // turunan, dan hanya resolver ini yang memegang aturan itu.
  const modul = await modulUntuk(input.courseId);
  const target = modul.find((m) => m.id === input.modulId);
  if (!target) {
    return { ok: false, error: "Modul tidak ditemukan pada kurikulum kursus ini." };
  }
  if (!(target.kuis ?? []).some((k) => k.id === input.quizId)) {
    return { ok: false, error: "Kuis ini tidak terpasang pada modul tersebut." };
  }

  const { enrollment } = await progresKursusDb(auth.principal, input.courseId);
  if (!enrollment) {
    return { ok: false, error: "Daftar kursus ini dulu." };
  }

  try {
    const { attempt, totalSoal } = await mulaiAttemptVerified({
      principal: auth.principal,
      enrollmentId: enrollment.id,
      quizId: input.quizId,
    });
    // Hanya id + jumlah soal: baris attempt membawa `assessmentSnapshot` yang
    // memuat kunci jawaban, dan itu tidak boleh keluar dari service.
    return { ok: true, attemptId: attempt.id, totalSoal };
  } catch (err) {
    return { ok: false, error: pesanGalatAsesmen(err) };
  }
}

/**
 * Kirim jawaban attempt; skor dihitung service dari snapshot.
 *
 * Action ini **tidak** menyentuh progres: mengirim jawaban bukan menyelesaikan
 * modul. Peserta yang lulus memakai `kirimDanSelesaikanKuisAction` (atau
 * memanggil penyelesaian terpisah) supaya keputusan "modul selesai" selalu
 * lewat jalur yang memverifikasi kelulusan.
 */
export async function kirimKuisVerifiedAction(input: {
  attemptId: string;
  jawaban: Array<{ questionId: string; selectedOption: number }>;
}): Promise<HasilKirimKuis> {
  const auth = await principalAsesmen();
  if (!auth.ok) return auth;
  return kirimInternal(auth.principal, input.attemptId, input.jawaban);
}

/**
 * Kirim jawaban lalu selesaikan modul — **hanya bila lulus**.
 *
 * Pengiriman dan penyelesaian sengaja satu action karena keduanya harus
 * memakai attempt yang sama: menyerahkan penyelesaian ke panggilan klien
 * terpisah berarti klien bisa melewatkannya (modul tidak pernah selesai), atau
 * memanggilnya dengan attempt yang belum tentu lulus. Di sini kelulusan
 * dihitung ulang service dari baris attempt, bukan dipercaya dari argumen.
 *
 * `policyVersion` diturunkan server-side dari kebijakan kursus — **tidak pernah**
 * dari input pemanggil. Versi itu jejak audit, bukan otorisasi.
 */
export async function kirimDanSelesaikanKuisAction(input: {
  courseId: string;
  modulId: string;
  quizId: string;
  attemptId: string;
  jawaban: Array<{ questionId: string; selectedOption: number }>;
}): Promise<HasilKirimDanSelesaikan> {
  const auth = await principalAsesmen();
  if (!auth.ok) return auth;

  const kirim = await kirimInternal(auth.principal, input.attemptId, input.jawaban);
  if (!kirim.ok) return kirim;

  // Belum lulus bukan kegagalan sistem: jawaban sudah tersimpan dan peserta
  // boleh mencoba lagi. Tidak ada modul yang ditandai, jadi tidak ada
  // penyelesaian progres yang diklaim.
  if (!kirim.lulus) {
    return { ok: true, attemptId: input.attemptId, score: kirim.score, lulus: false };
  }

  if (!input.courseId || !input.modulId || !input.quizId) {
    return { ok: false, error: "Data modul tidak lengkap untuk menyelesaikan kuis." };
  }

  try {
    const kursus = await getCourseById(input.courseId);
    const selesai = await selesaikanModulKuisVerified({
      principal: auth.principal,
      courseId: input.courseId,
      modulId: input.modulId,
      quizId: input.quizId,
      attemptId: input.attemptId,
      // Fallback `kebijakanDefault()` sama dengan pemanggil lain: kursus tanpa
      // kebijakan tersimpan tetap memakai default aman, bukan "tanpa kebijakan".
      policyVersion: kursus?.kebijakan?.versi ?? kebijakanDefault().versi,
    });

    safeRevalidate("/belajar", ...(kursus?.slug ? [`/belajar/${kursus.slug}`] : []));
    return {
      ok: true,
      attemptId: input.attemptId,
      score: kirim.score,
      lulus: true,
      modul: selesai.modul,
      kursus: selesai.kursus,
    };
  } catch (err) {
    return { ok: false, error: pesanGalatAsesmen(err) };
  }
}
