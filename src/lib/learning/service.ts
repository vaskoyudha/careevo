/**
 * Application service learning — **server-only**.
 *
 * Ini permukaan yang dipanggil Server Action / route handler untuk enrollment,
 * progres modul, dan penyelesaian kursus. Aturan yang dikunci:
 *
 * - **Tidak ada klaim bisnis yang dibaca dari browser.** Service tidak menerima
 *   `score`, `eligibility`, maupun `completion_path` sebagai argumen dari input
 *   publik. `completion_path` sebuah penyelesaian **diturunkan server-side**
 *   dari baris `module_progress` (`hitungCompletionPath`), bukan dari apa pun
 *   yang dikirim klien; sebuah modul hanya dihitung selesai bila barisnya
 *   benar-benar `state === "completed"` di database. Klien boleh meminta
 *   *tindakan* (tandai modul, selesaikan kursus), bukan *hasil*.
 * - **Kepemilikan diperiksa, bukan diasumsikan.** Setiap operasi memuat
 *   enrollment lewat `(principal.userId, courseId)` dan memeriksa ulang bahwa
 *   `enrollment.userId === principal.userId` sebelum menulis. Enrollment milik
 *   orang lain tidak pernah bisa ditulis walau id-nya diketahui.
 * - **`course_id`/`module_id` divalidasi terhadap resolver tunggal.** Modul
 *   yang tidak ada di `modulUntuk(courseId)` ditolak, sehingga id basi/palsu
 *   tidak bisa menggelembungkan progres. Resolver itu satu-satunya sumber
 *   modul; `modulKursus()` tidak pernah dipanggil langsung dari sini.
 * - **Idempotensi ditegakkan constraint database, bukan pengecekan.** Klik
 *   ganda dan request paralel ditangani `onConflictDoNothing`/upsert di
 *   repository; service tidak pernah menulis baris kedua.
 * - **Jalur informal adalah toggle; jalur terverifikasi tidak menurunkan.**
 *   Menandai ulang modul informal membatalkannya; menandai modul yang sudah
 *   terverifikasi dengan jalur informal **tidak** menghapus bukti terverifikasi
 *   itu — peningkatan informal → terverifikasi sebaliknya selalu boleh.
 * - **Completion `terverifikasi` adalah satu-satunya jalan pemulihan skor.**
 *   `selesaikanKursusDb` memanggil `pulihkanPelanggaranSetelahUlang` setelah
 *   `course_completions` terekam, sehingga pelanggaran integritas yang tercatat
 *   sebelumnya berhenti memotong skor. Jalur informal tidak memulihkan apa pun:
 *   menandai modul secara manual bukan bukti integritas, dan kalau boleh
 *   memulihkan, penalti bisa dihapus hanya dengan menekan tombol.
 *
 * Nama fungsi bisnis berbahasa Indonesia mengikuti idiom repo
 * (`daftarPengguna`, `tandaiModul`, `selesaikanKursusDb`); tipe dan helper
 * infrastruktur tetap Inggris.
 */

import {
  ambilEnrollment,
  daftarEnrollment,
  listEnrollments,
  listModulSelesai,
  listProgresModul,
  rekamCompletion,
  tandaiModulSelesai,
  batalkanModulSelesai,
  type Enrollment,
  type HasilEnrollment,
} from "@/lib/learning/repository";
import { modulUntuk } from "@/lib/courses/modul-resolver";
import { pulihkanPelanggaranSetelahUlang } from "@/lib/integritas/service";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import type { JalurPenyelesaian, CourseCompletion } from "@/lib/db/schema";
import type { SessionPrincipal } from "@/lib/auth/principal";

/* ------------------------------------------------------------------ *
 * Helper infrastruktur
 * ------------------------------------------------------------------ */

/**
 * Bentuk ringkas satu baris `module_progress` untuk evaluasi policy murni.
 *
 * Sengaja bukan `ModuleProgressRow` penuh: `completion_path` di database
 * bertipe `text`, sedangkan policy hanya mengerti dua nilai yang sah. Konversi
 * itu terjadi di `normalisasiJalur`, sekali, di satu tempat.
 */
export interface ProgresModulRingkas {
  moduleId: string;
  state: string;
  completionPath: JalurPenyelesaian | null;
}

/**
 * `completion_path` mentah dari database menjadi nilai yang sah.
 *
 * Nilai tak dikenal dipetakan ke `null`, bukan diteruskan: `null` diperlakukan
 * sebagai **informal** oleh policy, sehingga data yang rusak menurunkan klaim
 * (tidak pernah menaikkannya menjadi terverifikasi).
 */
function normalisasiJalur(nilai: string | null): JalurPenyelesaian | null {
  return nilai === "terverifikasi" || nilai === "informal" ? nilai : null;
}

/** Baris repository → bentuk ringkas policy. */
function ringkasProgres(baris: {
  moduleId: string;
  state: string;
  completionPath: string | null;
}): ProgresModulRingkas {
  return {
    moduleId: baris.moduleId,
    state: baris.state,
    completionPath: normalisasiJalur(baris.completionPath),
  };
}

/**
 * Id user dari principal, atau error yang jelas.
 *
 * Principal tanpa `userId` (sesi legacy tanpa baris `users`) tidak boleh
 * menyentuh data learning sama sekali: meneruskannya hanya akan menghasilkan
 * galat database yang tidak informatif.
 */
function idPrincipal(principal: SessionPrincipal): string {
  const userId = principal?.userId?.trim();
  if (!userId) {
    throw new Error("Principal tanpa userId tidak boleh mengakses data learning.");
  }
  return userId;
}

/**
 * Pertahanan berlapis kepemilikan enrollment.
 *
 * Pemanggil selalu memuat enrollment dengan `(userId, courseId)`, jadi cabang
 * ini seharusnya tidak pernah tercapai; ia ada supaya perubahan query di masa
 * depan tidak diam-diam membuka tulisan lintas pemilik.
 */
function garansiKepemilikan(enrollment: Enrollment, userId: string): void {
  if (enrollment.userId !== userId) {
    throw new Error("Enrollment bukan milik principal ini.");
  }
}

/** Id modul yang benar-benar ada di kurikulum saat ini. */
function himpunanModulValid(modul: ModulKursus[]): Set<string> {
  return new Set(modul.map((m) => m.id));
}

/* ------------------------------------------------------------------ *
 * Policy murni — bisa diuji tanpa database
 * ------------------------------------------------------------------ */

/**
 * Jumlah modul selesai yang **masih ada** di kurikulum saat ini.
 *
 * Id basi (modul yang sudah dihapus dari kurikulum) tidak ikut dihitung, sama
 * seperti `irisModulSelesai`. Tanpa ini, satu baris lama bisa membuat laporan
 * "4 dari 5 selesai" pada kursus yang kini hanya punya 3 modul.
 */
export function hitungSelesaiValid(
  progres: readonly ProgresModulRingkas[],
  modul: readonly ModulKursus[],
): number {
  const valid = himpunanModulValid([...modul]);
  const selesai = new Set<string>();
  for (const baris of progres) {
    if (baris.state !== "completed") continue;
    if (!valid.has(baris.moduleId)) continue;
    selesai.add(baris.moduleId);
  }
  return selesai.size;
}

/**
 * Jalur penyelesaian sebuah kursus, **diturunkan dari baris `module_progress`**.
 *
 * Aturan:
 *
 * - `null` bila belum semua modul kurikulum selesai — kursus yang belum tuntas
 *   tidak punya jalur penyelesaian, bukan jalur "informal".
 * - `"terverifikasi"` bila **semua** modul selesai lewat jalur terverifikasi.
 * - `"informal"` bila ada satu saja modul yang selesai lewat jalur informal.
 *   `completionPath: null` (baris lama / data rusak) dihitung informal: bukti
 *   yang tidak menyatakan dirinya terverifikasi tidak boleh diangkat menjadi
 *   terverifikasi.
 *
 * Id modul basi — ada di `progres` tetapi tidak di `modul` — diabaikan, bukan
 * dihitung sebagai modul selesai. Sebaliknya, modul kurikulum yang tidak punya
 * baris `completed` membuat hasilnya `null`.
 */
export function hitungCompletionPath(
  progres: readonly ProgresModulRingkas[],
  modul: readonly ModulKursus[],
): JalurPenyelesaian | null {
  if (modul.length === 0) return null;

  const valid = himpunanModulValid([...modul]);
  const selesai = new Map<string, ProgresModulRingkas>();
  for (const baris of progres) {
    if (baris.state !== "completed") continue;
    if (!valid.has(baris.moduleId)) continue;
    selesai.set(baris.moduleId, baris);
  }

  for (const id of valid) {
    if (!selesai.has(id)) return null;
  }

  for (const baris of selesai.values()) {
    if (baris.completionPath !== "terverifikasi") return "informal";
  }
  return "terverifikasi";
}

/* ------------------------------------------------------------------ *
 * Enrollment
 * ------------------------------------------------------------------ */

/**
 * Daftarkan principal ke sebuah kursus.
 *
 * `slug`/`title` diisi pemanggil dari store kursus (bukan dari browser) supaya
 * cache referensi `courses` tidak bisa dibohongi judul palsu.
 */
export async function daftarKursusDb(input: {
  principal: SessionPrincipal;
  courseId: string;
  slug: string;
  title: string;
}): Promise<HasilEnrollment> {
  return daftarEnrollment({
    userId: idPrincipal(input.principal),
    courseId: input.courseId,
    slug: input.slug,
    title: input.title,
  });
}

/** Semua enrollment principal, terurut paling baru. */
export async function listKursusTerdaftarDb(
  principal: SessionPrincipal,
): Promise<Enrollment[]> {
  return listEnrollments(idPrincipal(principal));
}

/**
 * Progres modul principal pada sebuah kursus.
 *
 * `selesai` dikembalikan apa adanya dari repository (termasuk id yang mungkin
 * sudah basi); penyaringannya terhadap kurikulum adalah tugas pemanggil yang
 * sudah memegang `modulUntuk(courseId)`, persis seperti `irisModulSelesai`.
 * Service ini sengaja tidak membaca store di jalur baca ini.
 */
export async function progresKursusDb(
  principal: SessionPrincipal,
  courseId: string,
): Promise<{ enrollment: Enrollment | null; selesai: string[] }> {
  const userId = idPrincipal(principal);
  const enrollment = await ambilEnrollment(userId, courseId);
  if (!enrollment) return { enrollment: null, selesai: [] };

  garansiKepemilikan(enrollment, userId);
  return { enrollment, selesai: await listModulSelesai(enrollment.id) };
}

/* ------------------------------------------------------------------ *
 * Progres modul
 * ------------------------------------------------------------------ */

/** Hasil `tandaiModulDb` — tindakan yang benar-benar terjadi, atau alasannya. */
export type HasilTandaiModul =
  | {
      ok: true;
      aksi: "ditandai" | "dibatalkan" | "sudah_selesai";
      enrollment: Enrollment;
    }
  | { ok: false; alasan: "belum_terdaftar" | "modul_tidak_ditemukan" };

/**
 * Tandai (atau batalkan) satu modul selesai untuk principal.
 *
 * `sumber` adalah **jalur yang diklaim**, bukan bukti: klien boleh memilih
 * "saya menyelesaikannya sendiri" (informal) atau "ini lewat sesi
 * terverifikasi". Nilai terverifikasi tidak pernah dipercaya buta di sini —
 * kelayakannya baru ditentukan jalur assessment/run (Fase 2 lanjutan); service
 * ini hanya mencatat jalurnya secara eksplisit, bukan boolean.
 *
 * Perilaku:
 *
 * - Belum terdaftar → `{ ok: false, alasan: "belum_terdaftar" }`. Tidak ada
 *   modul yang ditulis untuk kursus yang tidak diikuti.
 * - Modul tidak ada di `modulUntuk(courseId)` → `{ ok: false, alasan:
 *   "modul_tidak_ditemukan" }`. Bila kurikulum tidak bisa di-resolve sama sekali
 *   (kursus tak dikenal), id diterima apa adanya — tidak ada daftar untuk
 *   memvalidasinya, dan menolak akan memblokir enrollment fixture.
 * - Belum selesai → ditandai (`evidenceId: null`; bukti nyata baru diikat oleh
 *   jalur assessment, bukan oleh klien).
 * - Sudah selesai, `sumber: "informal"`, baris lama juga informal → dibatalkan
 *   (toggle).
 * - Sudah selesai, baris lama terverifikasi → tidak ada yang dibatalkan.
 *   Toggle informal tidak boleh menghapus bukti terverifikasi.
 * - Sudah selesai, `sumber: "terverifikasi"` → peningkatan jalan (upsert
 *   memperbarui jalurnya); menandai ulang terverifikasi hanya idempoten.
 *
 * `nama` diterima agar adapter cookie lama (`tandaiModul(courseId, modulId,
 * owner, sumber, nama)`) bisa didelegasikan dengan bentuk argumen yang sama.
 * Nilai itu belum dipersistensi di sini karena `audit_events` baru terisi pada
 * Fase 3; ia bukan bagian dari keputusan apa pun.
 */
export async function tandaiModulDb(input: {
  principal: SessionPrincipal;
  courseId: string;
  modulId: string;
  sumber: JalurPenyelesaian;
  nama: string;
  /** Id bukti (attempt/run) yang mengikat penyelesaian ini — hanya jalur server. */
  evidenceId?: string | null;
}): Promise<HasilTandaiModul> {
  const userId = idPrincipal(input.principal);
  const enrollment = await ambilEnrollment(userId, input.courseId);
  if (!enrollment) return { ok: false, alasan: "belum_terdaftar" };
  garansiKepemilikan(enrollment, userId);

  // Validasi terhadap resolver tunggal. Daftar kosong berarti kurikulum tidak
  // bisa di-resolve (kursus tak dikenal / fixture) — dalam kasus itu tidak ada
  // daftar pembanding, jadi id diterima; validasi hanya berlaku bila daftarnya
  // benar-benar ada.
  const modul = await modulUntuk(input.courseId);
  if (modul.length > 0 && !modul.some((m) => m.id === input.modulId)) {
    return { ok: false, alasan: "modul_tidak_ditemukan" };
  }

  const progres = await listProgresModul(enrollment.id);
  const baris = progres.find((p) => p.moduleId === input.modulId);
  const selesaiSekarang = baris?.state === "completed";
  const jalurSekarang = normalisasiJalur(baris?.completionPath ?? null);

  if (selesaiSekarang && input.sumber === "informal") {
    if (jalurSekarang === "terverifikasi") {
      // Jangan turunkan bukti terverifikasi menjadi "belum selesai".
      return { ok: true, aksi: "sudah_selesai", enrollment };
    }
    await batalkanModulSelesai(enrollment.id, input.modulId);
    return { ok: true, aksi: "dibatalkan", enrollment };
  }

  if (selesaiSekarang && input.sumber === "terverifikasi" && jalurSekarang === "terverifikasi") {
    // Idempoten: tidak menulis ulang baris yang sudah benar.
    return { ok: true, aksi: "sudah_selesai", enrollment };
  }

  await tandaiModulSelesai({
    enrollmentId: enrollment.id,
    moduleId: input.modulId,
    completionPath: input.sumber,
    // Bukti dipasang oleh jalur assessment/run, tidak pernah dari klien.
    evidenceId: input.evidenceId ?? null,
  });
  return { ok: true, aksi: "ditandai", enrollment };
}

/* ------------------------------------------------------------------ *
 * Completion kursus
 * ------------------------------------------------------------------ */

/** Hasil `selesaikanKursusDb`: completion yang terekam, atau alasan belum tuntas. */
export type HasilSelesaikan =
  | { selesai: true; completion: CourseCompletion; baru: boolean }
  | { selesai: false; selesaiCount: number; total: number };

/**
 * Evaluasi policy penyelesaian kursus dan rekam completion bila tuntas.
 *
 * Urutannya sengaja: muat modul lewat resolver tunggal → muat progres aktual
 * dari database → turunkan jalur penyelesaian → rekam. Jalur **tidak pernah**
 * datang dari klien; yang dikirim klien hanya niat "saya rasa kursus ini
 * selesai", dan server membuktikannya sendiri dari baris `module_progress`.
 *
 * `policyVersion` dicatat sebagai jejak audit (versi kebijakan yang berlaku saat
 * completion), bukan sebagai otorisasi. Pemanggil wajib menurunkannya
 * server-side dari `getCourseById(courseId)?.kebijakan?.versi ??
 * kebijakanDefault().versi` — jangan pernah dari `FormData`.
 *
 * Idempoten lewat `unique(enrollment_id)` di repository: dua request paralel
 * menghasilkan satu baris, yang kalah melihat baris yang sudah ada
 * (`baru: false`).
 */
export async function selesaikanKursusDb(input: {
  principal: SessionPrincipal;
  courseId: string;
  policyVersion: number;
}): Promise<HasilSelesaikan> {
  const userId = idPrincipal(input.principal);
  const modul = await modulUntuk(input.courseId);
  const enrollment = await ambilEnrollment(userId, input.courseId);
  if (!enrollment) return { selesai: false, selesaiCount: 0, total: modul.length };
  garansiKepemilikan(enrollment, userId);

  const ringkas = (await listProgresModul(enrollment.id)).map(ringkasProgres);
  const completionPath = hitungCompletionPath(ringkas, modul);

  if (!completionPath) {
    return {
      selesai: false,
      selesaiCount: hitungSelesaiValid(ringkas, modul),
      total: modul.length,
    };
  }

  const { completion, baru } = await rekamCompletion({
    userId,
    courseId: input.courseId,
    enrollmentId: enrollment.id,
    completionPath,
    policyVersion: input.policyVersion,
  });

  // Pemulihan skor kejujuran: menyelesaikan course_clean adalah jalan pulang
  // dari pelanggaran yang tercatat **sebelum** course itu selesai. Hook-nya di
  // sini, bukan di action, karena yang memicu adalah `course_completions` yang
  // sah — bukan permintaan dari mana pun.
  //
  // Hanya jalur `terverifikasi` yang memulihkan. Jalur informal (modul ditandai
  // manual) bukan bukti apa pun tentang integritas, jadi memulihkan skor dari
  // sana akan membuat peserta bisa menghapus penalti hanya dengan menekan tombol.
  if (completionPath === "terverifikasi") {
    await pulihkanPelanggaranSetelahUlang(userId, input.courseId, completion.completedAt);
  }

  return { selesai: true, completion, baru };
}
