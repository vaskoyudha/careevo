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
 * Angka exit dari podman adalah detail internal. Angka 255 muncul saat
 * kontainer dihentikan karena batas waktu, dan 137 saat kehabisan memori.
 * Meneruskannya ke peserta berarti peserta membaca angka yang tidak
 * menjelaskan apa pun (P4 spec).
 */
export type StatusJalankan =
  | "sukses"
  | "gagal_kompilasi"
  | "waktu_habis"
  | "memori_habis"
  | "proses_habis"
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
 * `detail` supaya peserta tahu apa yang terjadi, bukan menebak.
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
    case "waktu_habis":
      return {
        judul: "Program dihentikan karena berjalan terlalu lama.",
        nada: "galat",
        detail: "Batas layanan adalah 10 detik per percobaan.",
      };
    case "memori_habis":
      return {
        judul: "Program dihentikan karena memakai terlalu banyak memori.",
        nada: "galat",
        detail: "Batas layanan adalah 512 MB per percobaan.",
      };
    case "proses_habis":
      return {
        judul: "Program dihentikan karena membuat terlalu banyak proses.",
        nada: "galat",
        detail: "Batas layanan adalah 64 proses untuk satu program.",
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
