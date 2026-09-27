/**
 * Ringkasan berkas ruang kerja untuk snapshot submission — **murni**.
 *
 * ## Kenapa modul tersendiri, bukan bagian dari `manager/soal.mjs`
 *
 * `soal.mjs` menjawab satu pertanyaan: "apa yang boleh dilakukan kode peserta"
 * (flag podman, batas sandbox). Pertanyaan di berkas ini berbeda — "berkas mana
 * yang ikut ke snapshot, dan berapa batasnya" — dan jawabannya dibaca oleh jalur
 * penilaian, bukan jalur sandbox. Menyatukannya akan membuat permukaan audit
 * sandbox memuat aturan presentasi, dan itu persis yang membuat `soal.mjs`
 * berharga: satu berkas, satu pertanyaan.
 *
 * Berkas ini juga **tidak menyentuh filesystem**. Ia menerima teks dan
 * mengembalikan nilai, sehingga seluruh aturannya bisa diuji tanpa podman dan
 * tanpa kontainer yang hidup — pola yang sama dengan `bagi-lab.ts`.
 */

/**
 * Batas jumlah berkas yang disnapshot.
 *
 * Snapshot masuk ke `submission_versions.content_snapshot` (jsonb) dan dibaca
 * reviewer. Daftar yang tidak dibatasi membuat satu `node_modules` yang tidak
 * sengaja ikut menghasilkan payload puluhan megabyte — cukup untuk membuat
 * halaman review tidak bisa dibuka, dan itu kegagalan pada jalur yang justru
 * dipakai verifikator.
 *
 * Angka 200 dipilih supaya proyek course yang wajar (belasan sampai puluhan
 * berkas) masuk seluruhnya, sementara proyek yang jauh lebih besar dipotong
 * dengan penanda yang jujur (`terpotong`).
 */
export const BATAS_BERKAS_SNAPSHOT = 200;

/**
 * Nama direktori yang tidak pernah masuk snapshot.
 *
 * Ini **bukan** daftar gaya. Isinya dua kelas yang berbeda, dan masing-masing
 * punya alasan:
 *
 * - `node_modules`, `.git`, `vendor`, `target`, `build`, `dist`, `.next` —
 *   keluaran alat, bukan karya peserta. Menyertakannya membuat snapshot
 *   didominasi berkas yang tidak pernah dibaca reviewer.
 * - `.cache`, `.local`, `.config`, `code-server` — direktori milik code-server
 *   sendiri di dalam home pengguna `coder`. Ia ada di volume yang sama dengan
 *   `/home/coder/project`, jadi tanpa pengecualian ini snapshot memuat
 *   konfigurasi editor dan berkas sesi, bukan pekerjaan peserta.
 *
 * Pencocokan dilakukan pada **segmen path**, bukan substring: direktori bernama
 * `my-node_modules-notes` harus tetap ikut, sedangkan `node_modules` di
 * kedalaman mana pun tidak.
 */
export const ABAIKAN_SEGMEN: ReadonlySet<string> = new Set([
  "node_modules",
  ".git",
  "vendor",
  "target",
  "build",
  "dist",
  ".next",
  ".cache",
  ".local",
  ".config",
  "code-server",
]);

/** Satu baris berkas dalam snapshot submission. */
export interface BerkasSnapshot {
  /** Path relatif terhadap akar project, mis. `src/main.cpp`. */
  path: string;
  /** Ukuran dalam byte. */
  ukuran: number;
}

/** Hasil `ringkasBerkas`. */
export interface RingkasanBerkas {
  berkas: BerkasSnapshot[];
  /** Apakah ada berkas yang dibuang karena melebihi `maks`. */
  terpotong: boolean;
  /** Jumlah berkas yang lolos penyaringan, **sebelum** pemotongan. */
  total: number;
}

/**
 * Apakah sebuah path memuat segmen yang diabaikan.
 *
 * Nilai yang bukan teks dianggap diabaikan (fail-closed): pemanggilnya adalah
 * keluaran `find` yang seharusnya selalu teks, jadi nilai lain berarti ada yang
 * tidak seperti yang diduga, dan membuangnya lebih aman daripada memasukkannya
 * ke snapshot.
 */
export function segmenDiabaikan(path: string): boolean {
  if (typeof path !== "string") return true;
  return path.split("/").some((segmen) => ABAIKAN_SEGMEN.has(segmen));
}

/**
 * Ubah keluaran `find` (`<ukuran>\t<path>` per baris) menjadi daftar berkas.
 *
 * Tiga keputusan yang disengaja:
 *
 * 1. **Baris yang tidak bisa dibaca dibuang**, bukan menjadi `ukuran: 0`.
 *    "Tidak ada data" bukan "nol byte": menampilkan 0 byte untuk berkas yang
 *    tidak terbaca membuat reviewer mengira berkasnya kosong.
 * 2. **Path absolut dibuang.** `find` dipanggil dengan direktori project sebagai
 *    akar, jadi path absolut berarti ada yang salah — dan meneruskannya akan
 *    membocorkan path mesin ini ke dalam snapshot yang dibaca verifikator.
 * 3. **Urutan deterministik** (berdasarkan path). Tanpa itu, urutan `find` yang
 *    berbeda membuat dua snapshot dari isi yang sama terlihat berubah, dan diff
 *    submission menjadi derau.
 */
export function ringkasBerkas(
  mentah: unknown,
  maks: number = BATAS_BERKAS_SNAPSHOT,
): RingkasanBerkas {
  if (typeof mentah !== "string") return { berkas: [], terpotong: false, total: 0 };

  const semua: BerkasSnapshot[] = [];
  for (const baris of mentah.split("\n")) {
    if (!baris) continue;
    const pemisah = baris.indexOf("\t");
    if (pemisah <= 0) continue;

    const ukuran = Number(baris.slice(0, pemisah));
    const path = baris.slice(pemisah + 1);
    if (!Number.isFinite(ukuran) || ukuran < 0) continue;
    if (!path) continue;
    if (path.startsWith("/")) continue;
    if (segmenDiabaikan(path)) continue;

    semua.push({ path, ukuran });
  }

  semua.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  // `maks` yang tidak masuk akal (NaN, negatif, bukan angka) jatuh ke batas
  // bawaan, bukan memotong segalanya. Pemanggilnya adalah kode server, jadi
  // nilai aneh berarti bug — dan bug tidak boleh mengubah arti "semua berkas".
  const batas = Number.isInteger(maks) && maks >= 0 ? maks : BATAS_BERKAS_SNAPSHOT;

  return {
    berkas: semua.slice(0, batas),
    terpotong: semua.length > batas,
    total: semua.length,
  };
}
