/**
 * Backfill cookie `ls_enroll` → tabel PostgreSQL — **server-only**.
 *
 * Migrasi plan §7 butir 6. Aturan yang dikunci:
 *
 * - **Cookie dibaca pemanggil, bukan di sini.** Modul ini murni service: ia
 *   menerima `Pendaftaran[]` yang **sudah didekode** dan principal pemiliknya
 *   sebagai argumen. Tidak ada `cookies()`, tidak ada `node:fs`. Adapter yang
 *   membaca cookie (`src/lib/courses/enrollment.ts`) hanya boleh dipanggil dari
 *   Server Action setelah `getSession()` memberi principal — artinya backfill
 *   hanya berjalan di dalam session pemilik cookie itu sendiri, tidak pernah
 *   untuk cookie yang ditemukan di tempat lain.
 * - **Id modul disaring `irisModulSelesai()` terhadap resolver tunggal.**
 *   `modulUntuk(courseId)` adalah satu-satunya sumber modul; id basi yang tidak
 *   ada lagi di kurikulum dibuang sebelum apa pun ditulis. Tanpa saringan ini,
 *   riwayat modul yang sudah dihapus admin akan ikut masuk database sebagai
 *   progres yang tidak bisa dirender.
 * - **Idempoten.** `daftarEnrollment` dan `tandaiModulSelesai` keduanya
 *   upsert/`onConflictDoNothing`, jadi memanggil backfill dua kali tidak
 *   menggandakan baris. Lapisan tambahan di atasnya juga: baris progres yang
 *   sudah `completed` tidak ditulis ulang sama sekali (lihat di bawah).
 * - **Score/evidence klien legacy bukan bukti credential.** Cookie lama tidak
 *   memuat bukti apa pun yang bisa diverifikasi, jadi setiap baris backfill
 *   ditulis `completionPath: "informal"` dan `evidenceId: null` — tidak pernah
 *   `terverifikasi`. Ini juga sebabnya backfill **tidak menimpa** baris yang
 *   sudah ada: menimpa progres terverifikasi hasil penilaian server dengan
 *   "informal" dari cookie akan **menurunkan** bukti, bukan memigrasikannya.
 * - **Kursus yang tidak bisa di-resolve tetap dimigrasikan enroll-nya.**
 *   Fixture resource (`r1`, …) tidak ada di store JSON, jadi `modulUntuk()`
 *   mengembalikan daftar kosong. Kasus itu bukan alasan membuang enrollment —
 *   enrollment-nya tetap ditulis dengan `slug`/`title` = `course_id`, dan
 *   `selesai_modul` diperlakukan sebagai kosong supaya tidak ada id basi yang
 *   ditulis tanpa daftar pembanding.
 *
 * Nama fungsi bisnis berbahasa Indonesia mengikuti idiom repo; tipe dan helper
 * infrastruktur tetap Inggris.
 */

import { getCourseById } from "@/lib/courses/store";
import { irisModulSelesai } from "@/lib/courses/kurikulum";
import { modulUntuk } from "@/lib/courses/modul-resolver";
import {
  daftarEnrollment,
  listProgresModul,
  tandaiModulSelesai,
} from "@/lib/learning/repository";
import type { SessionPrincipal } from "@/lib/auth/principal";
// `import type` hilang saat kompilasi, sehingga modul ini tidak menarik
// `next/headers`/toko performa milik adapter cookie ke dalam grafnya.
import type { Pendaftaran } from "@/lib/courses/enrollment";

/** Hasil satu kali backfill, untuk dilaporkan action ke pemanggil. */
export interface HasilBackfill {
  /** Jumlah enrollment yang diproses dan **baru** dibuat di database. */
  migrasi: number;
  /** Jumlah enrollment yang sudah ada / dilewati (sudah atau tidak bisa diproses). */
  ignored: number;
  /** Jumlah baris `module_progress` yang benar-benar ditulis. */
  modul: number;
}

/**
 * Backfill daftar enrollment cookie pemilik ke database.
 *
 * `daftar` adalah hasil `listPendaftaran(owner)` untuk principal yang sama —
 * fungsi ini tidak memverifikasi ulang kepemilikan, karena satu-satunya cara
 * mendapat `principal` adalah dari session, dan satu-satunya cara
 * `listPendaftaran` mengembalikan entri adalah bila `owner`-nya cocok dengan
 * principal itu. Yang dijaga di sini adalah **principal punya `userId`**:
 * sesi legacy tanpa baris `users` tidak punya kunci kepemilikan, jadi tidak
 * boleh menulis apa pun.
 */
export async function backfillEnrollmentDariCookie(input: {
  principal: SessionPrincipal;
  daftar: Pendaftaran[];
}): Promise<HasilBackfill> {
  const userId = input.principal?.userId?.trim();
  if (!userId) {
    throw new Error("Backfill butuh principal dengan userId (session database).");
  }

  const hasil: HasilBackfill = { migrasi: 0, ignored: 0, modul: 0 };
  const dikunjungi = new Set<string>();

  for (const pendaftaran of input.daftar) {
    const courseId = pendaftaran.course_id?.trim();
    if (!courseId) {
      hasil.ignored += 1;
      continue;
    }

    // Cookie bisa memuat entri kembar (ditulis sebelum `daftarKursus`
    // idempoten). Menghitungnya sekali menjaga laporan tetap jujur.
    if (dikunjungi.has(courseId)) {
      hasil.ignored += 1;
      continue;
    }
    dikunjungi.add(courseId);

    const kursus = await getCourseById(courseId);
    const slug = kursus?.slug ?? pendaftaran.slug ?? courseId;
    const title = kursus?.title ?? courseId;

    const { enrollment, baru } = await daftarEnrollment({
      userId,
      courseId,
      slug,
      title,
    });
    if (baru) hasil.migrasi += 1;
    else hasil.ignored += 1;

    // Resolver tunggal. Untuk kursus yang tidak ada di store, hasilnya `[]`
    // dan `irisModulSelesai` otomatis membuang seluruh `selesai_modul` —
    // perilaku yang memang diinginkan (jangan menulis id tanpa pembanding).
    const modul = await modulUntuk(courseId);
    const selesai = irisModulSelesai(pendaftaran.selesai_modul ?? [], modul);
    if (selesai.length === 0) continue;

    // Baca dulu supaya baris yang sudah `completed` tidak pernah ditimpa:
    // menulis ulang dengan jalur informal akan menurunkan progres
    // terverifikasi yang mungkin sudah dinilai server.
    const sudah = new Set(
      (await listProgresModul(enrollment.id))
        .filter((baris) => baris.state === "completed")
        .map((baris) => baris.moduleId),
    );

    for (const moduleId of selesai) {
      if (sudah.has(moduleId)) continue;
      // Jalur sengaja "informal" dan bukti `null`: cookie lama tidak memuat
      // bukti yang bisa diverifikasi, jadi tidak ada yang boleh diklaim
      // sebagai credential terverifikasi.
      await tandaiModulSelesai({
        enrollmentId: enrollment.id,
        moduleId,
        completionPath: "informal",
        evidenceId: null,
      });
      hasil.modul += 1;
    }
  }

  return hasil;
}
