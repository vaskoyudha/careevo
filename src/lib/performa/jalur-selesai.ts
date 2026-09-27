/**
 * Jalur penyelesaian **yang terlihat di laporan** — diturunkan, bukan disimpan.
 *
 * Kolom `completion_path` tetap dua nilai karena punya CHECK constraint di tiga
 * tabel (`src/lib/db/schema.ts:473`), dan menambah nilai berarti migrasi yang
 * menyentuh setiap pembaca (`normalisasiJalur`, `hitungCompletionPath`,
 * `LABEL_SUMBER`, laporan). Yang ditambahkan di sini adalah **label**, bukan
 * nilai: label bisa menyatakan lebih dari yang bisa disimpan kolom.
 *
 * Keempat label, dan fakta yang masing-masing nyatakan:
 *
 * - `terverifikasi_kamera` — bukti adalah run, dan run itu punya
 *   `kamera_mulai`. Label ini muncul kapan pun run-nya memang membawanya,
 *   **bukan hanya** pada course `wajib_kamera`: `wajib_kamera` adalah kebijakan
 *   yang *menjamin* kamera tercatat (satu-satunya yang menolak penyelesaian
 *   tanpanya), sedangkan pencatatan sinyal kamera tidak memfilter per kebijakan,
 *   jadi run course `wajib` pun bisa membawanya. Karena itu penelusuran run
 *   tidak boleh dipersempit ke course `wajib_kamera` saja: run yang sebenarnya
 *   bisa ditelusuri tetapi di luar pencarian itu akan jatuh ke
 *   `terverifikasi_tanpa_bukti_kamera`, yaitu kalimat "kamera tidak bisa
 *   ditelusuri ke run" untuk baris yang sebenarnya bisa.
 * - `terverifikasi` — bukti adalah run, dan run itu **tidak** punya
 *   `kamera_mulai`. Ketiadaan kejadian inilah yang diketahui, bukan "kamera
 *   pasti mati": `kamera_mulai` adalah sinyal yang dilaporkan peramban
 *   (`ASAL_SINYAL.kamera`), jadi tidak adanya laporan bukan bukti negatif.
 * - `terverifikasi_tanpa_bukti_kamera` — label untuk "saya tidak bisa menelusuri
 *   run ini", dan itu punya **tiga** sebab yang pemanggil harus bedakan, bukan
 *   satu: (1) `evidence_id` berisi `quiz_attempts.id` — jalur kuis memang begitu,
 *   dan id itu memang tidak pernah menjadi id run; (2) `evidence_id` tidak ada
 *   sama sekali, misalnya baris lama yang ditulis sebelum bukti dicatat; (3)
 *   `evidence_id` **adalah** id run yang benar, tetapi tidak ada di peta
 *   `kameraMulai` yang diberikan pemanggil. Ketiganya berakhir di label yang sama
 *   bukan karena ketiganya setara, melainkan karena satu-satunya yang boleh
 *   dinyatakan modul ini adalah apa yang ada di tangannya: yang bisa ia katakan
 *   adalah "tidak bisa ditelusuri", tidak "tidak ada run". Jalurnya sah, dan
 *   label ini sengaja tidak menyebut "kamera menyala" walaupun `wajib_kamera`
 *   membuat kamera wajib — yang terverifikasi saat penyelesaian adalah kelulusan
 *   asesmen, bukan kehadiran kamera.
 * - `informal` — tidak ada bukti sesi yang sah. Tidak pernah dinaikkan, apa pun
 *   yang terjadi di run.
 *
 * Fungsi ini **tidak** mengembalikan skor, tingkat bahaya, atau vonis. Ia hanya
 * menyatakan bukti apa yang ada di depan pembaca.
 *
 * Modul ini **murni** — tidak boleh mengimpor `node:fs` atau `next/headers`;
 * ia dirender dari halaman server sekaligus bisa dipakai modul murni lain.
 */

export type JalurTerlihat =
  | "terverifikasi_kamera"
  | "terverifikasi"
  | "terverifikasi_tanpa_bukti_kamera"
  | "informal";

/**
 * Kalimat yang dipakai laporan untuk menyebut masing-masing jalur.
 *
 * `LABEL_SUMBER` yang sudah ada (`src/lib/performa/store.ts:36`) **tidak**
 * disentuh: ia menggambarkan bentuk data yang tersimpan di `.data/performa`,
 * yang tetap dua nilai. Kosakata label tampilan hidup di sini, bukan di sana.
 */
export const LABEL_JALUR: Record<JalurTerlihat, string> = {
  terverifikasi_kamera: "lewat sesi terverifikasi dengan kamera menyala",
  terverifikasi: "lewat sesi terverifikasi, kamera tidak tercatat",
  terverifikasi_tanpa_bukti_kamera: "jalur terverifikasi, kamera tidak bisa ditelusuri ke run",
  informal: "tanpa sesi terverifikasi",
};

export function jalurDariBukti(input: {
  completionPath: string | null;
  /** `module_progress.evidence_id`: id run **atau** id attempt, atau `null`. */
  evidenceId: string | null;
  /**
   * `run id` → apakah run itu punya `kamera_mulai`.
   *
   * **Prasyarat: peta ini harus menutup setiap run dalam lingkup laporan.**
   * Modul ini tidak membaca database, jadi peta adalah satu-satunya pandangan
   * yang ia punya; keanggotaan kunci di sini adalah satu-satunya cara ia
   * membedakan "run ini tidak punya `kamera_mulai`" dari "run ini tidak bisa
   * saya telusuri". Maka pemanggil yang menyusun peta dari bacaan **sebagian** —
   * hanya run yang kebetulan terlihat di satu halaman, atau di satu jendela
   * tanggal — akan membuat `evidence_id` yang memang id run asli dilaporkan
   * sebagai `terverifikasi_tanpa_bukti_kamera`, dan kalimat "kamera tidak bisa
   * ditelusuri ke run" akan berdiri untuk baris yang sebenarnya **bisa**
   * ditelusuri. Kesalahan seperti itu lebih berbahaya daripada tidak melapor
   * apa pun, karena ia terbaca seperti temuan, bukan seperti ketiadaan data.
   *
   * Karena itu peta yang **dihilangkan** tidak berarti "tanpa kamera", melainkan
   * "tanpa pandangan": peta kosong dan tanpa peta adalah dua masukan berbeda yang
   * sengaja diberi label berbeda. `new Map()` berarti "peta ini memang begitu",
   * sehingga bukti yang tidak ada di dalamnya menjadi
   * `terverifikasi_tanpa_bukti_kamera`. `undefined` berarti "saya tidak punya
   * peta", dan tanpa peta tidak ada yang boleh disalahkan atas kamera, sehingga
   * turun ke `terverifikasi` ("kamera tidak tercatat"). Tanpa perbedaan itu,
   * pemanggil yang lupa mengirim peta akan mengubah arti laporan tanpa
   * meninggalkan jejak apa pun; peta kosong yang eksplisit setidaknya tercatat
   * sebagai keputusan, sedangkan ketiadaan peta tidak tercatat sama sekali.
   */
  kameraMulai?: ReadonlyMap<string, boolean>;
}): JalurTerlihat {
  // Fail-closed: hanya `terverifikasi` yang eksak boleh dinaikkan. Nilai lain —
  // termasuk `null` dari baris lama dan nilai yang tidak dikenal — turun ke
  // `informal`, karena bukti yang tidak menyatakan dirinya terverifikasi tidak
  // boleh diangkat.
  if (input.completionPath !== "terverifikasi") return "informal";

  // Tanpa peta, tidak ada yang bisa disalahkan atas kamera: turun ke jalur
  // terverifikasi biasa (kamera tidak tercatat) alih-alih menebak.
  if (!input.kameraMulai) return "terverifikasi";

  // Ketiga sebab label ini muncul sudah dihitung di kontrak modul; di sini
  // hanya satu syarat yang diuji, yaitu bukti ini ada di peta run atau tidak.
  // Yang tidak ada di sana berarti modul ini tidak bisa menelusurinya. Bahwa
  // run itu sebenarnya ada adalah urusan pemanggil — peta yang tidak lengkap
  // adalah kesalahan pemanggil, bukan keadaan peserta (lihat prasyarat
  // `kameraMulai`).
  if (!input.evidenceId || !input.kameraMulai.has(input.evidenceId)) {
    return "terverifikasi_tanpa_bukti_kamera";
  }

  return input.kameraMulai.get(input.evidenceId) ? "terverifikasi_kamera" : "terverifikasi";
}
