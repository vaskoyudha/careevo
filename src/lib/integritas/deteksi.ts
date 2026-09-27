import type { KejadianIntegritas } from "@/lib/learning/session";
import { KATALOG_PELANGGARAN, type JenisPelanggaran } from "./katalog";

/**
 * Deteksi otomatis (**Stage 1**) — **murni, tanpa database**.
 *
 * Modul ini membaca rekaman sesi (`KejadianIntegritas[]`) dan mengusulkan
 * **kandidat** pelanggaran. Ia tidak pernah memutuskan, tidak pernah menyentuh
 * skor, dan tidak pernah menulis apa pun. Keputusan tetap milik manusia
 * (Stage 2); lihat `service.ts`.
 *
 * ## Aturan yang dikunci
 *
 * - **`plagiarisme` tidak pernah diusulkan otomatis.** Menilai karya berasal
 *   dari orang lain menuntut pembacaan isi karya — bukan pola peristiwa. Kalau
 *   mesin boleh mengusulkannya, ia mengusulkannya untuk semua orang yang
 *   menempel banyak teks, dan tuduhan itu tidak berdasar. Hanya dua jenis di
 *   bawah yang bisa muncul dari sini; `deteksi.test.ts` mengunci itu.
 * - **Usulan bukan penalti.** `penalty` di sini adalah bobot katalog **saat
 *   usulan dibuat** — angka yang dilihat verifikator, bukan angka yang berlaku.
 *   Skor baru bergerak setelah Stage 2 menyetujui.
 * - **Ambang adalah angka bernama**, bukan literal yang tersebar. Satu tab
 *   berpindah dalam sesi panjang itu wajar; yang dicari adalah pola.
 */

/** Panjang tempelan yang sudah tidak masuk akal sebagai pengetikan manual. */
export const AMBANG_PASTE_KARAKTER = 200;

/** Berapa kali menempel sebelum dianggap pola, walau tiap tempelan pendek. */
export const AMBANG_PASTE_PERISTIWA = 2;

/** Berapa kali halaman ditinggalkan / fokus hilang sebelum jadi pola. */
export const AMBANG_KELUAR_TAB = 3;

/** Satu usulan: jenis, bobot usulan, alasan faktual, dan bukti yang disaring. */
export interface UsulanPelanggaran {
  jenis: JenisPelanggaran;
  /** Bobot katalog saat usulan dibuat. Snapshot, bukan referensi hidup. */
  penalty: number;
  /** Kalimat faktual: apa yang tercatat. Tidak memuat kata vonis. */
  alasan: string;
  /** Penunjuk ke peristiwa — jumlah dan jenis, tanpa token atau identitas. */
  bukti: Record<string, unknown>;
}

/**
 * Panjang tempelan dari `detail` kejadian (`"240 karakter"` → `240`).
 *
 * Detail ditulis peramban dan tidak selalu ada. Yang tak terbaca menjadi `0`,
 * bukan `NaN`: satu baris tanpa detail tidak boleh membuat perbandingan
 * ambang gagal secara diam-diam.
 */
export function panjangPaste(detail: string | undefined): number {
  const cocok = detail?.match(/^(\d+)/);
  if (!cocok) return 0;
  const angka = Number(cocok[1]);
  return Number.isFinite(angka) ? angka : 0;
}

/**
 * Usulan pelanggaran dari satu rekaman sesi.
 *
 * Urutan hasil **deterministik** (jenis terberat lebih dulu) supaya daftar
 * antrian tidak berubah-ubah antar render dan test bisa membandingkan apa
 * adanya.
 */
export function deteksiUsulan(
  kejadian: readonly KejadianIntegritas[],
): UsulanPelanggaran[] {
  const usulan: UsulanPelanggaran[] = [];

  const paste = kejadian.filter((k) => k.jenis === "paste_massal");
  const terpanjang = paste.reduce(
    (maks, k) => Math.max(maks, panjangPaste(k.detail)),
    0,
  );
  if (paste.length >= AMBANG_PASTE_PERISTIWA || terpanjang >= AMBANG_PASTE_KARAKTER) {
    usulan.push({
      jenis: "pola_salin_tempel",
      penalty: KATALOG_PELANGGARAN.pola_salin_tempel.bobot,
      alasan: `Tercatat ${paste.length} peristiwa tempel panjang; terpanjang ${terpanjang} karakter.`,
      bukti: {
        jenis_kejadian: "paste_massal",
        jumlah_peristiwa: paste.length,
        panjang_terpanjang: terpanjang,
      },
    });
  }

  const keluar = kejadian.filter(
    (k) => k.jenis === "pindah_tab" || k.jenis === "fokus_hilang",
  ).length;
  if (keluar >= AMBANG_KELUAR_TAB) {
    usulan.push({
      jenis: "meninggalkan_sesi",
      penalty: KATALOG_PELANGGARAN.meninggalkan_sesi.bobot,
      alasan: `Tercatat ${keluar} peristiwa halaman ditinggalkan atau fokus hilang.`,
      bukti: {
        jenis_kejadian: "pindah_tab/fokus_hilang",
        jumlah_peristiwa: keluar,
      },
    });
  }

  return usulan;
}
