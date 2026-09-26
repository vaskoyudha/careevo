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
 *   `kamera_mulai`. Hanya mungkin pada course `wajib_kamera`, karena course
 *   `wajib` tidak pernah menolak penyelesaian tanpa kamera.
 * - `terverifikasi` — bukti adalah run, dan run itu **tidak** punya
 *   `kamera_mulai`. Ketiadaan kejadian inilah yang diketahui, bukan "kamera
 *   pasti mati": `kamera_mulai` adalah sinyal yang dilaporkan peramban
 *   (`ASAL_SINYAL.kamera`), jadi tidak adanya laporan bukan bukti negatif.
 * - `terverifikasi_tanpa_bukti_kamera` — `evidence_id` bukan id run (jalur kuis
 *   menyimpannya sebagai `quiz_attempts.id`) atau tidak ada sama sekali.
 *   Jalurnya sah, tetapi **tidak ada run yang bisa ditelusuri** untuk bicara apa
 *   pun soal kamera. Label ini sengaja tidak menyebut "kamera menyala"
 *   walaupun `wajib_kamera` membuat kamera wajib: yang terverifikasi saat
 *   penyelesaian adalah kelulusan asesmen, bukan kehadiran kamera, dan laporan
 *   hanya boleh menyatakan yang ada di baris yang tersimpan.
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
  /** `run id` → apakah run itu punya `kamera_mulai`. */
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

  // Bukti yang tidak ada di peta run adalah bukti attempt, atau run yang tidak
  // ada di tangan pemanggil. Keduanya berarti "tidak bisa ditelusuri".
  if (!input.evidenceId || !input.kameraMulai.has(input.evidenceId)) {
    return "terverifikasi_tanpa_bukti_kamera";
  }

  return input.kameraMulai.get(input.evidenceId) ? "terverifikasi_kamera" : "terverifikasi";
}
