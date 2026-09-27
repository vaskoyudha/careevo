import { ambilRunAktif, listEventRun } from "./repository";
import { kedaluwarsaDb } from "./run-service";
import { buktiBaru } from "./session";
import { kejadianDariEvent } from "./dashboard";
import type { KejadianIntegritas } from "./session";
import type { LearningEvent } from "@/lib/db/schema";

/**
 * Batas jumlah kejadian yang di-seed ke klien — **sama dengan batas penulisan**.
 *
 * `catatKejadian` (jalur berkas) memotong daftarnya ke 500 terakhir, dan tiap
 * balasan `catatKejadianAction` mengirim run lengkap lewat `sessionRunDariDb`.
 * Tanpa batas di sini, satu run panjang (mis. peserta yang berkali-kali pindah
 * tab) mengirim seluruh riwayatnya ke HTML render pertama — payload yang tumbuh
 * tanpa batas, untuk data yang panelnya sendiri hanya menampilkan lima terakhir
 * dan dua angka ringkasan. Yang diambil adalah **ekor** daftar (kejadian
 * terbaru), konsisten dengan pemotongan `slice(-500)` di jalur penulisan.
 */
const BATAS_KEJADIAN_AWAL = 500;

/**
 * Batas yang sama untuk event yang dibaca dari database.
 *
 * Dipotong **sebelum** pemetaan, dari ekor `listEventRun` (urut sequence
 * menaik), bukan kepalanya: ringkasan panel dan lima baris terakhirnya bicara
 * tentang keadaan sekarang.
 *
 * Catatan jujur soal jangkauannya: `listEventRun` masih membaca **seluruh**
 * event run dari database; yang dibatasi di sini adalah yang dikirim ke klien.
 * Membatasi di query berarti mengubah tanda tangan `listEventRun`, dan itu
 * menyentuh pemanggil lain (server action, halaman staf, `petaKameraMulaiPemilik`)
 * yang justru butuh daftar penuh — di luar lingkup perbaikan ini, dan dilakukan
 * lewat jalur lebar yang memang tidak boleh reward. Yang dijaga sekarang adalah
 * payload render pertama tidak tumbuh tanpa batas.
 */
function kejadianTerakhir(events: LearningEvent[]): KejadianIntegritas[] {
  return events
    .slice(-BATAS_KEJADIAN_AWAL)
    .map(kejadianDariEvent)
    .filter((k): k is KejadianIntegritas => k !== null);
}

/**
 * Bukti sesi yang di-seed ke reader dari **server**.
 *
 * `CourseSessionProvider` menyimpan `bukti`/`runId` di state React, dan provider
 * itu hidup di dalam shell reader. Selama navigasi **di dalam** reader provider
 * tidak pernah di-unmount, jadi state-nya bertahan sendiri. Yang tidak bisa
 * ditutup dengan cara itu adalah **muat ulang halaman** dan **deep link langsung**
 * ke satu modul: di sana tidak ada state klien yang bisa diwarisi, dan peserta
 * yang sedang di tengah sesi akan melihat gerbang menutup lagi padahal sesinya
 * masih berjalan.
 *
 * Fungsi ini menutup celah itu. Ia bekerja karena `buktiBaru` adalah tanda
 * tangan murni atas `(courseId, owner, policyVersion)` — **bukan token acak** —
 * sehingga server bisa menurunkan ulang tanda tangan yang identik dengan yang
 * dikeluarkan `mulaiSesiAction`, tanpa memulai sesi baru.
 *
 * Fail-closed di setiap cabang: tanpa run aktif, tanpa run yang sah, atau saat
 * versi kebijakan sudah bergeser, hasilnya `null` dan UI menampilkan gerbang
 * biasa. Menandatangani bukti untuk run yang tidak sah justru lebih buruk
 * daripada tidak ada sesi: peserta melihat modul yang tampak bisa diselesaikan,
 * lalu ditolak server saat menekan "Tandai selesai".
 *
 * `owner` di dalam token adalah `users.id` yang di-lowercase — definisi yang
 * sama dengan `pemilikBukti` di `run-service.ts:69`, yang tidak diekspor. Dua
 * tempat memakai aturan yang sama; kalau salah satunya berubah, keduanya harus
 * berubah.
 *
 * `kejadian` ikut dikembalikan supaya `KejadianPanel` **tidak mulai kosong**
 * (spec §3.2). Tanpa itu, memuat ulang halaman menampilkan "0 kejadian / 0
 * celah" untuk run yang di server sudah punya celah — under-report di satu
 * panel yang seluruh tugasnya jujur soal apa yang sedang direkam. Pemetaannya
 * memakai `kejadianDariEvent` (`dashboard.ts:303`) yang sama dengan yang dipakai
 * server action, jadi bentuknya tidak bisa menyimpang; jenis tak dikenal
 * dibuang di sana, bukan diberi label karangan.
 */
export async function sesiReaderAwal(input: {
  userId: string;
  courseId: string;
  policyVersion: number;
}): Promise<{
  bukti: string;
  runId: string;
  mulaiAt: string;
  kejadian: KejadianIntegritas[];
} | null> {
  const run = await ambilRunAktif(input.userId, input.courseId);
  if (!run) return null;

  // Kedaluwarsa diperiksa **sebelum** menandatangani, dan run yang lewat batas
  // tidak ditutup di sini: penutupan adalah urusan service sesi, dan reader
  // tidak boleh menulis status run sebagai efek samping render.
  if (kedaluwarsaDb(run)) return null;

  // Versi kebijakan yang berbeda berarti bukti lama tidak berlaku lagi
  // (`buktikanSesiDb` membandingkan `integrityVersion`). Menandatangani dengan
  // versi baru untuk run versi lama hanya menghasilkan token yang pasti ditolak.
  if (run.integrityVersion !== input.policyVersion) return null;

  const bukti = buktiBaru({
    courseId: input.courseId,
    owner: input.userId.trim().toLowerCase(),
    policyVersion: input.policyVersion,
  });

  /**
   * Kejadian dibaca **setelah** gerbang di atas, bukan sebelumnya.
   *
   * Run yang ditolak tidak boleh menghasilkan bacaan apa pun: querynya jadi
   * biaya tanpa guna pada jalur yang justru paling sering (peserta tanpa sesi),
   * dan urutannya membuat "tidak ada sesi" tidak pernah bergantung pada isi
   * `learning_events`.
   */
  const kejadian = kejadianTerakhir(await listEventRun(run.id));

  return { bukti, runId: run.id, mulaiAt: run.startedAt.toISOString(), kejadian };
}
