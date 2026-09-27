/**
 * Matematika pembagi dua kolom lab — **murni**, tanpa DOM.
 *
 * Dipisah dari komponennya supaya aturan yang mudah salah bisa diuji langsung:
 * pembagian ruang, batas minimum tiap kolom, dan pembacaan nilai yang tersimpan.
 * Komponennya (`pembagi-lab.tsx`) hanya mengurus pointer, fokus, dan persistensi;
 * ia tidak boleh punya salinan rumus ini.
 *
 * Satuannya **fraksi 0–1**, bukan piksel: yang disimpan adalah proporsi, supaya
 * pembagiannya tetap masuk akal ketika jendela diubah ukurannya atau halaman
 * dibuka di layar lain. Menyimpan piksel berarti lebar 900px yang dipilih di
 * monitor besar akan memenuhi seluruh layar laptop.
 */

/** Proporsi awal saat peserta belum pernah menggeser pembaginya. */
export const BAGI_AWAL = 0.5;

/**
 * Lebar minimum tiap kolom, dalam piksel.
 *
 * Bukan angka estetika. Kolom kiri memuat prosa bergulir, dan kolom kanan memuat
 * editor beserta bilah jalankannya. Di bawah `MIN_KIRI` barisnya jadi sekitar
 * empat kata dan bahannya tidak terbaca; di bawah `MIN_KANAN` baris kode
 * membungkus (CodeMirror menggulir horizontal, bukan membungkus) sehingga
 * peserta membaca programnya lewat jendela sempit.
 */
export const MIN_KIRI = 280;
export const MIN_KANAN = 340;

/** Jarak antar kolom, harus sama dengan `gap-5` (1.25rem) di tata letaknya. */
export const GAP = 20;

/** Langkah satu ketukan panah pada pembagi, dalam fraksi. */
export const LANGKAH_PAPAN_KETIK = 0.02;

function jepit(nilai: number, min: number, max: number): number {
  return Math.min(Math.max(nilai, min), max);
}

/**
 * Batas fraksi yang sah untuk lebar wadah tertentu.
 *
 * Kedua minimum diubah ke fraksi terhadap **ruang efektif** — lebar wadah
 * dikurangi jarak antar kolom — karena itulah ruang yang benar-benar dibagi dua
 * kolom. Menghitungnya terhadap lebar wadah penuh membuat batasnya meleset satu
 * `gap` dan kolom terkecil jadi lebih sempit daripada minimumnya.
 *
 * Wadah yang terlalu sempit untuk kedua minimum mengembalikan rentang terbalik;
 * pemanggil memakai `bagiDariGeser` yang menanganinya dengan jatuh ke
 * `BAGI_AWAL`, bukan memaksa salah satu minimum dan membuat kolom lain hilang.
 */
export function batasBagi({
  lebarWadah,
  minKiri = MIN_KIRI,
  minKanan = MIN_KANAN,
  gap = GAP,
}: {
  lebarWadah: number;
  minKiri?: number;
  minKanan?: number;
  gap?: number;
}): { min: number; max: number; efektif: number } {
  const efektif = lebarWadah - gap;
  if (!(efektif > 0)) return { min: BAGI_AWAL, max: BAGI_AWAL, efektif: 0 };
  return {
    min: minKiri / efektif,
    max: 1 - minKanan / efektif,
    efektif,
  };
}

/**
 * Fraksi dari posisi pointer (relatif terhadap tepi kiri wadah).
 *
 * `gap / 2` dikurangi karena pembaginya duduk di **tengah** celah antar kolom,
 * bukan di tepi kolom kiri. Tanpa koreksi itu, setiap kali peserta mulai
 * menyeret, kolomnya melompat setengah `gap`.
 */
export function bagiDariGeser({
  x,
  lebarWadah,
  minKiri = MIN_KIRI,
  minKanan = MIN_KANAN,
  gap = GAP,
}: {
  x: number;
  lebarWadah: number;
  minKiri?: number;
  minKanan?: number;
  gap?: number;
}): number {
  const { min, max, efektif } = batasBagi({ lebarWadah, minKiri, minKanan, gap });
  // Wadah terlalu sempit untuk kedua minimum: bagi rata daripada menampilkan
  // satu kolom yang menghilang.
  if (min > max) return BAGI_AWAL;
  return jepit((x - gap / 2) / efektif, min, max);
}

/**
 * Fraksi setelah satu ketukan papan ketik pada pembagi.
 *
 * Peran `min`/`max` di sini sama dengan batas seret: pembagi yang digerakkan
 * papan ketik tidak boleh melewati minimum kolom yang sama. Kalau tidak, dua
 * jalur input akan menghasilkan dua batas yang berbeda.
 */
export function bagiDariPapanKetik({
  bagi,
  tombol,
  lebarWadah,
  minKiri = MIN_KIRI,
  minKanan = MIN_KANAN,
  gap = GAP,
}: {
  bagi: number;
  tombol: "ArrowLeft" | "ArrowRight" | "Home" | "End";
  lebarWadah: number;
  minKiri?: number;
  minKanan?: number;
  gap?: number;
}): number | null {
  const { min, max } = batasBagi({ lebarWadah, minKiri, minKanan, gap });
  if (min > max) return null;
  switch (tombol) {
    case "ArrowLeft":
      return jepit(bagi - LANGKAH_PAPAN_KETIK, min, max);
    case "ArrowRight":
      return jepit(bagi + LANGKAH_PAPAN_KETIK, min, max);
    case "Home":
      return min;
    case "End":
      return max;
    default:
      return null;
  }
}

/**
 * Baca fraksi tersimpan. `null` bila belum pernah disimpan atau nilainya rusak.
 *
 * Nilai di luar 0–1 diperlakukan **rusak**, bukan dijepit: proporsi 0 atau 1
 * berarti salah satu kolom tidak punya lebar sama sekali, dan itu bukan keadaan
 * yang bisa dicapai lewat seret maupun papan ketik — jadi asalnya pasti bukan
 * dari UI ini. Jatuh ke `BAGI_AWAL` lebih baik daripada memulihkan tata letak
 * yang tidak mungkin.
 */
export function bacaBagi(mentah: string | null | undefined): number | null {
  if (mentah === null || mentah === undefined || mentah === "") return null;
  const nilai = Number(mentah);
  if (!Number.isFinite(nilai) || nilai <= 0 || nilai >= 1) return null;
  return nilai;
}

/** Fraksi → persentase bulat untuk `aria-valuenow`. */
export function kePersen(bagi: number): number {
  return Math.round(bagi * 100);
}
