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
 * 5. **Jembatan ke progres ada di sini, bukan di action.**
 *    `selesaikanModulKuisVerified` adalah satu-satunya tempat attempt yang lulus
 *    menjadi baris `module_progress` + completion kursus. Ia memakai
 *    `tandaiModulDb`/`selesaikanKursusDb` dari `service.ts` (penulis tunggal
 *    progres) dan hanya membaca baris attempt lewat `ambilAttempt` — tidak ada
 *    query database langsung, dan kelulusan dihitung ulang dari snapshot,
 *    bukan dipercaya dari argumen.
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
import { modulUntuk } from "@/lib/courses/modul-resolver";
import { getKuis } from "@/lib/courses/store";
import {
  ambilAttempt,
  ambilEnrollmentById,
  buatAttemptBerikutnya,
  kirimAttempt,
  type Enrollment,
  type QuizAttempt,
} from "@/lib/learning/repository";

import {
  hitungSkorSnapshot,
  lulusSnapshot,
  snapshotKuis,
  type HasilSkorSnapshot,
} from "./assessment-snapshot";
import {
  selesaikanKursusDb,
  tandaiModulDb,
  type HasilSelesaikan,
  type HasilTandaiModul,
} from "./service";

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
  | "jawaban_tidak_lengkap"
  // Penomoran attempt terkunci pada baris enrollment, jadi ini seharusnya tidak
  // pernah muncul; ia tetap disediakan supaya pelanggaran unique yang lolos
  // (mis. bug penguncian) sampai ke pemanggil sebagai galat domain yang bisa
  // dipetakan ke pesan UI, bukan galat driver mentah.
  | "bentrok_attempt"
  // Dipakai `selesaikanModulKuisVerified`: attempt harus sudah dikirim, lulus,
  // dan berasal dari kuis yang benar-benar dipasang di modul target.
  | "attempt_belum_dikirim"
  | "attempt_belum_lulus"
  | "kuis_tidak_cocok"
  // `selesaikanModulKuisVerified`: `modulId` harus benar-benar ada di kurikulum
  // kursus, dan kursus itu harus bisa di-resolve (gagal-tertutup) — id yang tidak
  // dikenal tidak boleh menghasilkan progres terverifikasi.
  | "modul_tidak_ditemukan";

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

  // Penomoran + insert dalam satu transaksi yang mengunci baris enrollment
  // (lihat `buatAttemptBerikutnya`). Dua permintaan serentak berurutan dan
  // mendapat nomor berbeda; konflik yang tetap lolos kembali sebagai hasil
  // terkontrol, bukan galat driver mentah.
  const hasil = await buatAttemptBerikutnya({
    userId: principal.userId,
    enrollmentId,
    quizId,
    assessmentDefinitionVersion: definitionVersion,
    assessmentSnapshot: snapshot,
  });
  if (!hasil.ok) {
    if (hasil.sebab === "enrollment_tidak_ditemukan") {
      // Pesan sama dengan pemeriksaan kepemilikan di atas: pemanggil tidak
      // berhak tahu bahwa enrollment milik orang lain itu ada.
      throw new GalatAsesmen("enrollment_tidak_ditemukan", "Enrollment tidak ditemukan.");
    }
    throw new GalatAsesmen(
      "bentrok_attempt",
      "Attempt gagal dibuat karena bentrok nomor. Silakan coba lagi.",
    );
  }

  return { attempt: ringkas(hasil.attempt), totalSoal: kuis.soal.length };
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

/** Hasil `selesaikanModulKuisVerified`: tindakan modul + evaluasi completion. */
export interface HasilSelesaikanModulKuis {
  /** Attempt yang membuktikan kelulusan (baris ringkas, tanpa kunci jawaban). */
  attempt: AttemptRingkas;
  /** Skor **tersimpan** pada attempt, bukan hasil hitung ulang. */
  score: number;
  modul: HasilTandaiModul;
  /** Hasil evaluasi penyelesaian kursus setelah modul ditandai. */
  kursus: HasilSelesaikan;
}

/**
 * Selesaikan satu modul lewat bukti attempt kuis yang **sudah lulus**.
 *
 * Ini jembatan antara asesmen dan progres: satu-satunya cara modul ditandai
 * `terverifikasi` dengan `evidenceId`, dan satu-satunya tempat completion
 * kursus dievaluasi setelah sebuah kuis lulus. Aturan yang dikunci:
 *
 * - **Kelulusan dibaca dari baris attempt, bukan dari argumen.** `lulus` pernah
 *   jadi input di action; di sini ia dihitung dari `assessmentSnapshot` +
 *   `score` tersimpan lewat `lulusSnapshot`, dengan `attemptId` sebagai
 *   satu-satunya yang datang dari pemanggil. Attempt yang masih `in_progress`
 *   atau tidak lulus tidak pernah menulis progres.
 * - **Kepemilikan diperiksa di sini juga.** `kirimAttemptVerified` sudah
 *   memeriksanya saat submit, tetapi fungsi ini adalah endpoint terpisah —
 *   percaya pada pemeriksaan di tempat lain berarti satu panggilan langsung ke
 *   sini bisa menandai modul dengan attempt orang lain.
 * - **Tidak ada query database langsung.** `tandaiModulDb` (upsert modul,
 *   penulis tunggal `module_progress`) dan `selesaikanKursusDb` (penurun
 *   `completion_path` + `rekamCompletion`) yang menulis; `ambilAttempt` hanya
 *   membaca baris attempt.
 * - **Idempoten.** Memanggil dua kali tidak menggandakan apa pun: attempt
 *   `submitted` tetap mengembalikan skor pertama, `tandaiModulDb` upsert pada
 *   PK `(enrollment_id, module_id)`, dan `rekamCompletion` unique pada
 *   `enrollment_id` sehingga completion kedua melihat baris yang sudah ada
 *   (`baru: false`) alih-alih membuat baris baru.
 *
 * Perhatikan urutannya: modul ditandai **sebelum** completion dievaluasi, sebab
 * `selesaikanKursusDb` menurunkan `completion_path` dari baris `module_progress`
 * yang baru saja ditulis. `policyVersion` wajib diturunkan server-side oleh
 * pemanggil — jangan pernah dari input klien.
 */
export async function selesaikanModulKuisVerified(input: {
  principal: SessionPrincipal;
  courseId: string;
  modulId: string;
  /** Kuis yang dipasang di modul; dicocokkan dengan `attempt.quizId`. */
  quizId: string;
  attemptId: string;
  policyVersion: number;
}): Promise<HasilSelesaikanModulKuis> {
  const { principal, courseId, modulId, quizId, attemptId, policyVersion } = input;

  const attempt = await ambilAttempt(attemptId);
  if (!attempt) {
    throw new GalatAsesmen("attempt_tidak_ditemukan", "Attempt tidak ditemukan.");
  }
  if (attempt.userId !== principal.userId) {
    throw new GalatAsesmen("bukan_pemilik", "Attempt ini bukan milik Anda.");
  }
  // Ikat bukti attempt ke kursus yang hendak ditandai. `courseId` datang dari
  // pemanggil action dan tidak boleh dipercaya hanya karena `modulId` tampak
  // cocok; enrollment adalah sumber kebenaran relasi attempt↔kursus.
  const enrollmentAttempt = await ambilEnrollmentById(attempt.enrollmentId);
  if (!enrollmentAttempt || enrollmentAttempt.userId !== principal.userId) {
    throw new GalatAsesmen("enrollment_tidak_ditemukan", "Enrollment tidak ditemukan.");
  }
  if (enrollmentAttempt.courseId !== courseId) {
    throw new GalatAsesmen("kuis_tidak_cocok", "Attempt ini bukan untuk kursus tersebut.");
  }
  // Attempt yang belum dikirim tidak punya skor; ia tidak bisa membuktikan apa pun.
  if (attempt.status !== "submitted") {
    throw new GalatAsesmen("attempt_belum_dikirim", "Attempt ini belum dikirim.");
  }
  // Snapshot yang tidak bisa dibaca / skor hilang → tidak lulus (gagal-tertutup),
  // bukan dilewati. `lulusSnapshot` mengembalikan `false` untuk keduanya.
  const score = attempt.score ?? Number.NaN;
  const lulus = lulusSnapshot(attempt.assessmentSnapshot, score);
  if (!lulus || !Number.isFinite(score)) {
    throw new GalatAsesmen("attempt_belum_lulus", "Attempt ini belum lulus.");
  }
  // Attempt dari kuis lain tidak boleh menyelesaikan modul ini — tanpa
  // pencocokan ini, kelulusan kuis mana pun bisa dipakai untuk modul mana pun.
  if (attempt.quizId !== quizId) {
    throw new GalatAsesmen("kuis_tidak_cocok", "Attempt ini bukan untuk kuis tersebut.");
  }
  // Kecocokan di atas hanya membuktikan `quizId` = kuis attempt; ia **tidak**
  // membuktikan kuis itu memang dipasang di `modulId`. Tanpa pemeriksaan ini,
  // attempt yang lulus untuk modul A bisa menandai modul B `terverifikasi`
  // dengan mengirim `modulId` B — bukti yang menempel pada modul yang salah.
  //
  // Resolver modul adalah sumber tunggal pemasangan kuis (`Modul.kuis`). Jalur
  // ini **gagal-tertutup**: daftar modul yang kosong berarti kurikulum tidak
  // bisa di-resolve (kursus tak dikenal / fixture), dan bukti terverifikasi
  // tidak boleh ditulis tanpa daftar pembanding. Ini sengaja lebih ketat dari
  // `tandaiModulDb`, yang menerima id apa adanya saat daftar kosong untuk tidak
  // memblokir enrollment fixture — di sini yang dipertaruhkan adalah
  // `completion_path: "terverifikasi"`, jadi id yang tidak bisa diverifikasi
  // harus ditolak, bukan dipercaya.
  const modulKursus = await modulUntuk(courseId);
  const modulTarget = modulKursus.find((m) => m.id === modulId);
  if (!modulTarget) {
    throw new GalatAsesmen("modul_tidak_ditemukan", "Modul tidak ditemukan pada kursus ini.");
  }
  if (!(modulTarget.kuis ?? []).some((k) => k.id === quizId)) {
    throw new GalatAsesmen("kuis_tidak_cocok", "Kuis ini tidak terpasang pada modul tersebut.");
  }

  const modul = await tandaiModulDb({
    principal,
    courseId,
    modulId,
    // Jalur terverifikasi tidak pernah lahir dari klien: hanya fungsi ini yang
    // memasangkannya, dan hanya setelah attempt lulus di atas.
    sumber: "terverifikasi",
    nama: principal.nama,
    // Bukti yang mengikat penyelesaian ini ke asesmennya.
    evidenceId: attemptId,
  });

  const kursus = await selesaikanKursusDb({ principal, courseId, policyVersion });

  return { attempt: ringkas(attempt), score, modul, kursus };
}
