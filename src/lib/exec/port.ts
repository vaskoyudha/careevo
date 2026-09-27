import type { BahasaKode } from "@/types/course";

/**
 * Kontrak eksekusi kode.
 *
 * Berkas ini **murni**. Tidak ada I/O, tidak ada `node:*`, tidak ada `fetch`.
 * Komponen klien mengimpornya, jadi satu impor server akan menjatuhkan build.
 * Implementasinya ada di `proses-lokal.ts` yang server-only.
 */

/**
 * Status semantik, bukan exit code.
 *
 * Angka exit dari podman adalah detail internal dan tidak selalu berarti
 * sesuatu: dari luar kontainer, program yang kehabisan waktu, kehabisan
 * memori, dan kehabisan proses semuanya tampak sama — proses yang dibunuh
 * (137). Yang benar-benar bisa dibedakan hanya `sukses` (0),
 * `gagal_kompilasi` (g++ sendiri yang menolak, sebelum program jalan), dan
 * crash (139). Meneruskan angka mentah ke peserta berarti peserta membaca
 * angka yang tidak menjelaskan apa pun (P4 spec).
 */
export type StatusJalankan =
  | "sukses"
  | "gagal_kompilasi"
  | "batas_dilampaui"
  | "galat_program"
  | "ditolak"
  | "galat_runner";

export interface MintaJalankan {
  bahasa: BahasaKode;
  /** Sumber yang akan dikompilasi. Teks polos. */
  kode: string;
  stdin?: string;
}

export interface HasilJalankan {
  status: StatusJalankan;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durasiMs: number;
}

export interface PortJalankan {
  jalankan(minta: MintaJalankan): Promise<HasilJalankan>;
}

/** Nada visual, supaya komponen tidak memilih warna dari teks. */
export type NadaJalankan = "sukses" | "galat" | "info";

export interface PetakanStatus {
  judul: string;
  nada: NadaJalankan;
  detail?: string;
}

/**
 * Hasil untuk kegagalan yang tidak menghasilkan keluaran program.
 *
 * `exitCode` sengaja `null`. Status semantik sudah membawa artinya, dan
 * mengisinya di sini hanya menciptakan jalan bagi UI untuk menampilkannya.
 */
export function hasilGagal(status: StatusJalankan, stderr = ""): HasilJalankan {
  return { status, stdout: "", stderr, exitCode: null, durasiMs: 0 };
}

/**
 * Pesan untuk peserta.
 *
 * Kalimatnya menyatakan peristiwa, bukan menyalahkan orang, karena batas
 * 10 detik dan 512 MB adalah limit pelayanan. Angka batasnya ditulis di
 * `detail` supaya peserta tahu apa yang terjadi, bukan menebak. Karena ketiga
 * batas tidak bisa dibedakan dari luar kontainer, `batas_dilampaui` menyebut
 * seluruh angkanya di `detail` dan tidak menunjuk satu batas di `judul`.
 *
 * `gagal_kompilasi` sengaja tidak memakai `detail`. Yang ditampilkan untuk
 * status itu adalah stderr GCC apa adanya, bukan ringkasan.
 */
export function petakanStatus(status: StatusJalankan): PetakanStatus {
  switch (status) {
    case "sukses":
      return { judul: "Program selesai tanpa galat.", nada: "sukses" };
    case "gagal_kompilasi":
      return { judul: "Program belum bisa dikompilasi.", nada: "galat" };
    case "batas_dilampaui":
      // Kenapa satu status untuk tiga batas: dari luar kontainer, kehabisan
      // waktu, kehabisan memori, dan kehabisan proses tidak bisa dibedakan —
      // semuanya terbaca sebagai proses yang dibunuh. Satu status berarti satu
      // peristiwa yang benar-benar diamati, jadi judulnya tidak pernah menyebut
      // batas yang tidak diketahui. Amplopnya diserahkan lewat `detail`.
      //
      // Pemisahan ini pernah ada (waktu_habis/memori_habis/proses_habis) dan
      // diukur salah: split itu membuat runner menebak salah satu dari tiga.
      // Kalau suatu hari runtime benar-benar menyatakan batas mana yang meletus,
      // memisahkannya kembali itu perubahan kecil — satu nilai union, satu kasus
      // di `switch`, satu baris di `SEMUA` pada test.
      return {
        judul: "Program dihentikan karena melampaui batas layanan.",
        nada: "galat",
        detail: "Batas layanan adalah 10 detik, 512 MB memori, dan 64 proses per percobaan.",
      };
    case "galat_program":
      // Bug peserta sendiri, jadi nadanya boleh berbeda dari batas layanan. Tapi
      // status ini mencakup semua crash, jadi penyebabnya tidak boleh disebut:
      // SIGSEGV cuma salah satu dan tidak dijamin. Yang dinyatakan hanya
      // peristiwanya, beserta fakta bahwa ini bukan soal batas layanan, supaya
      // peserta tahu harus memperbaiki kodenya dan bukan mengecilkan programnya.
      return {
        judul: "Program berhenti mendadak saat berjalan.",
        nada: "galat",
        detail: "Ini bukan karena batas layanan, melainkan programnya sendiri yang berhenti.",
      };
    case "ditolak":
      return { judul: "Blok kode ini belum bisa dijalankan.", nada: "info" };
    case "galat_runner":
      return {
        judul: "Layanan eksekusi sedang tidak tersedia.",
        nada: "galat",
        detail: "Coba lagi sebentar lagi.",
      };
  }
}
