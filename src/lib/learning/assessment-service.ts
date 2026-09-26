/**
 * Application service asesmen terverifikasi — **server-only**.
 *
 * Alur yang dijaga di sini (ADR 0003, plan §7):
 *
 * 1. **Definisi dibekukan saat attempt dibuka.** `mulaiAttemptVerified` membaca
 *    kuis dari bank sekali, membuat snapshot + `definitionVersion`, lalu
 *    menyimpannya di baris attempt. Setelah itu penilaian tidak pernah membaca
 *    bank lagi — admin boleh mengubah atau menghapus kuis, dan attempt yang
 *    sudah berjalan tetap dinilai dengan definisi yang ia pegang.
 * 2. **Skor dihitung server dari snapshot.** `kirimAttemptVerified` hanya
 *    menerima `selectedOption` per soal. Tidak ada jalur di mana klien
 *    mengirim `score`, `isCorrect`, atau status lulus — semuanya dihitung di
 *    sini lewat `hitungSkorSnapshot`.
 * 3. **Kepemilikan diverifikasi di setiap langkah.** Attempt hanya bisa dikirim
 *    oleh `userId` pemiliknya, dan attempt hanya bisa dibuka pada enrollment
 *    milik pemanggil. Tanpa ini, seorang learner bisa menulis jawaban ke
 *    attempt/enrollment orang lain.
 * 4. **Idempotensi diserahkan ke repository.** `kirimAttempt` mengembalikan
 *    attempt yang sudah `submitted` apa adanya; skor yang dipakai untuk
 *    laporan adalah skor yang **tersimpan**, bukan hasil hitung ulang, sehingga
 *    pengiriman kedua dengan jawaban berbeda tidak mengubah skor historis.
 *
 * **Kunci jawaban tidak pernah dikembalikan ke pemanggil.** Baik `attempt` di
 * `mulaiAttemptVerified` maupun di `kirimAttemptVerified` bertipe
 * `AttemptRingkas` — baris attempt tanpa kolom `assessment_snapshot` (yang
 * memuat `jawaban_benar`). Pemanggil UI hanya butuh id + jumlah soal; membawa
 * snapshot ke layer atas berarti kunci jawaban ikut terkirim ke peramban.
 *
 * Nama fungsi bisnis berbahasa Indonesia; nama tipe/helper infrastruktur
 * Inggris.
 */

import type { SessionPrincipal } from "@/lib/auth/principal";
import { getKuis } from "@/lib/courses/store";
import {
  ambilAttempt,
  ambilEnrollmentById,
  buatAttempt,
  kirimAttempt,
  nomorAttemptBerikutnya,
  type Enrollment,
  type QuizAttempt,
} from "@/lib/learning/repository";

import {
  hitungSkorSnapshot,
  lulusSnapshot,
  snapshotKuis,
  type HasilSkorSnapshot,
} from "./assessment-snapshot";

/** Versi algoritma penilaian yang dipakai service ini. Lihat ADR 0003. */
export const GRADING_VERSION = 1;

/**
 * Sentinel untuk soal yang tidak dijawab klien.
 *
 * Di luar rentang indeks `pilihan[]` yang sah, sehingga selalu dinilai salah —
 * nilai ini tidak pernah bisa membuat soal tampak benar. Dipakai (bukan
 * melewatkan barisnya) supaya setiap soal snapshot punya tepat satu baris
 * jawaban, dan "tidak dijawab" tercatat eksplisit alih-alih hilang.
 */
export const OPSI_TIDAK_DIJAWAB = -1;

/**
 * Baris attempt **tanpa** `assessmentSnapshot`.
 *
 * Pemotongan ini bukan kerapian: `assessmentSnapshot` memuat `jawaban_benar`
 * setiap soal, dan service tidak boleh menyerahkan kunci jawaban ke pemanggil.
 * Yang tersisa tetap cukup untuk navigasi (`id`), audit versi definisi
 * (`assessmentDefinitionVersion`), dan pelaporan skor.
 */
export type AttemptRingkas = Omit<QuizAttempt, "assessmentSnapshot">;

/** Kode galat domain asesmen yang bisa dibedakan pemanggil. */
export type KodeGalatAsesmen =
  | "kuis_tidak_ditemukan"
  | "enrollment_tidak_ditemukan"
  | "attempt_tidak_ditemukan"
  | "bukan_pemilik"
  | "jawaban_tidak_lengkap";

/** Galat domain asesmen — bukan galat database, supaya bisa dipetakan ke pesan UI. */
export class GalatAsesmen extends Error {
  readonly kode: KodeGalatAsesmen;

  constructor(kode: KodeGalatAsesmen, message: string) {
    super(message);
    this.name = "GalatAsesmen";
    this.kode = kode;
  }
}

/**
 * Susun `AttemptRingkas` dari baris attempt.
 *
 * Field didaftar eksplisit — **tidak** `{ ...attempt, assessmentSnapshot: undefined }` —
 * supaya kolom yang memuat kunci jawaban tidak punya jalan keluar dari modul ini,
 * bahkan bila kelak ada helper serialisasi yang membuang `undefined` atau
 * menyalin sisa field. Menambah kolom baru ke `quiz_attempts` berarti
 * memutuskan secara sadar apakah ia boleh sampai ke pemanggil.
 */
function ringkas(attempt: QuizAttempt): AttemptRingkas {
  return {
    id: attempt.id,
    userId: attempt.userId,
    enrollmentId: attempt.enrollmentId,
    quizId: attempt.quizId,
    assessmentDefinitionVersion: attempt.assessmentDefinitionVersion,
    status: attempt.status,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    score: attempt.score,
    gradingVersion: attempt.gradingVersion,
    attemptNumber: attempt.attemptNumber,
  };
}

/** Enrollment milik principal, atau galat domain. */
async function enrollmentMilik(
  principal: SessionPrincipal,
  enrollmentId: string,
): Promise<Enrollment> {
  const enrollment = await ambilEnrollmentById(enrollmentId);
  if (!enrollment) {
    throw new GalatAsesmen("enrollment_tidak_ditemukan", "Enrollment tidak ditemukan.");
  }
  if (enrollment.userId !== principal.userId) {
    // Pesan yang sama dengan "tidak ditemukan": pemanggil tidak berhak tahu
    // bahwa enrollment milik orang lain itu ada.
    throw new GalatAsesmen("enrollment_tidak_ditemukan", "Enrollment tidak ditemukan.");
  }
  return enrollment;
}

/**
 * Buka attempt terverifikasi: bekukan definisi kuis lalu simpan attempt
 * `in_progress` dengan nomor attempt berikutnya.
 *
 * Kuis dibaca dari bank (`getKuis`) — server-side, bukan dari klien. Kuis yang
 * tidak ada di bank ditolak, bukan dinilai dengan snapshot kosong.
 */
export async function mulaiAttemptVerified(input: {
  principal: SessionPrincipal;
  enrollmentId: string;
  quizId: string;
}): Promise<{ attempt: AttemptRingkas; totalSoal: number }> {
  const { principal, enrollmentId, quizId } = input;

  await enrollmentMilik(principal, enrollmentId);

  const kuis = await getKuis(quizId);
  if (!kuis) {
    throw new GalatAsesmen("kuis_tidak_ditemukan", `Kuis "${quizId}" tidak ada di bank soal.`);
  }

  const { definitionVersion, snapshot } = snapshotKuis(kuis);
  const attemptNumber = await nomorAttemptBerikutnya(enrollmentId, quizId);

  const attempt = await buatAttempt({
    userId: principal.userId,
    enrollmentId,
    quizId,
    assessmentDefinitionVersion: definitionVersion,
    assessmentSnapshot: snapshot,
    attemptNumber,
  });

  return { attempt: ringkas(attempt), totalSoal: kuis.soal.length };
}

/**
 * Jawaban yang dipilih klien, dipetakan `questionId → selectedOption`.
 *
 * Pengiriman ganda untuk satu soal memakai yang **pertama**, sama seperti
 * `hitungSkorSnapshot`, supaya pemetaan baris jawaban tidak bisa berbeda dari
 * dasar perhitungan skornya.
 */
function petaJawaban(
  jawaban: Array<{ questionId: string; selectedOption: number }>,
): Map<string, number> {
  const peta = new Map<string, number>();
  for (const item of jawaban) {
    if (typeof item?.questionId !== "string" || item.questionId.length === 0) continue;
    if (!peta.has(item.questionId)) peta.set(item.questionId, item.selectedOption);
  }
  return peta;
}

/** Baris `quiz_attempt_answers` dari hasil penilaian snapshot. */
function barisJawaban(
  hasil: HasilSkorSnapshot,
  peta: Map<string, number>,
): Array<{
  questionId: string;
  selectedOption: number;
  isCorrect: boolean;
  questionSnapshotRef: string;
}> {
  return hasil.perSoal.map((soal) => ({
    questionId: soal.questionId,
    selectedOption: peta.get(soal.questionId) ?? OPSI_TIDAK_DIJAWAB,
    isCorrect: soal.isCorrect,
    // Snapshot adalah sumber soal; referensinya menunjuk id soal di dalamnya.
    questionSnapshotRef: soal.questionId,
  }));
}

/**
 * Kirim attempt terverifikasi.
 *
 * Skor dihitung terhadap `attempt.assessmentSnapshot` — salinan definisi yang
 * dibekukan saat attempt dibuka — sehingga perubahan bank soal setelahnya tidak
 * bisa mengubah hasil. Pengiriman ulang bersifat idempoten: baris jawaban tidak
 * bertambah (PK komposit) dan skor yang dilaporkan adalah skor tersimpan.
 */
export async function kirimAttemptVerified(input: {
  principal: SessionPrincipal;
  attemptId: string;
  jawaban: Array<{ questionId: string; selectedOption: number }>;
}): Promise<{ attempt: AttemptRingkas; score: number; lulus: boolean }> {
  const { principal, attemptId, jawaban } = input;

  const attempt = await ambilAttempt(attemptId);
  if (!attempt) {
    throw new GalatAsesmen("attempt_tidak_ditemukan", "Attempt tidak ditemukan.");
  }
  if (attempt.userId !== principal.userId) {
    throw new GalatAsesmen("bukan_pemilik", "Attempt ini bukan milik Anda.");
  }

  const hasil = hitungSkorSnapshot(attempt.assessmentSnapshot, jawaban);

  const tersimpan = await kirimAttempt({
    attemptId,
    score: hasil.score,
    answers: barisJawaban(hasil, petaJawaban(jawaban)),
  });
  if (!tersimpan) {
    throw new GalatAsesmen("attempt_tidak_ditemukan", "Attempt tidak ditemukan.");
  }

  // Pengiriman ulang memakai skor tersimpan (yang pertama menang), bukan hasil
  // hitung ulang atas jawaban yang mungkin berbeda — skor historis tidak boleh
  // berubah karena percobaan submit kedua.
  const score = tersimpan.score ?? hasil.score;

  return {
    attempt: ringkas(tersimpan),
    score,
    lulus: lulusSnapshot(tersimpan.assessmentSnapshot, score),
  };
}
