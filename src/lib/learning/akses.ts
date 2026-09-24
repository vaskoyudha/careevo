import { PESAN_POLICY } from "@/lib/courses/kebijakan";
import type { CheckpointMateri, KebijakanCourse } from "@/types/course";

/**
 * Mesin keputusan akses kegiatan belajar — **murni**, dipakai klien (untuk
 * pesan/gerbang UI) dan server (sebagai pemeriksaan otoritatif).
 *
 * Satu fungsi, satu keputusan: klien tidak boleh menyimpulkan sendiri. Pesan
 * yang dikembalikan dipakai apa adanya oleh UI supaya copy tidak menyimpang.
 */

export type JenisKegiatan = "materi" | "kuis" | "proyek" | "bantuan_akademik" | "pembelaan";

export interface KonteksAkses {
  jenisKegiatan: JenisKegiatan;
  kebijakan: KebijakanCourse;
  /** True bila ada bukti sesi yang valid & cocok dengan kebijakan saat ini. */
  adaBuktiSesi: boolean;
}

export type KeputusanAkses =
  | { tipe: "bebas" }
  | { tipe: "perlu_sesi"; pesan: string }
  | { tipe: "ditolak"; pesan: string };

const CHECKPOINT_DEFAULT: CheckpointMateri = { batas_waktu_menit: 30, mode: "materi" };

/** Aturan pengerjaan modul — sengaja hanya butuh checkpoint, bukan `Modul` utuh. */
export interface ModulCheckpoint {
  id?: string;
  checkpoint?: CheckpointMateri;
}

const MODE_SAH = ["materi", "kuis", "proyek"] as const;

/**
 * Checkpoint efektif sebuah modul: tersimpan bila lengkap, selain itu default.
 *
 * `kebijakan` tidak ikut di signature walaupun modul tanpa checkpoint secara
 * konsep mewarisi aturan **course**: nilai bawaannya sama untuk semua course,
 * dan membiarkan parameter yang tidak dibaca membuat pemanggil percaya mereka
 * bisa mengubah perilaku lewat kebijakan padahal tidak.
 *
 * Objek hasil selalu salinan dangkal: pemanggil boleh menyesuaikannya tanpa
 * merusak nilai default yang dipakai bersama.
 */
export function checkpointEfektif(modul: ModulCheckpoint): CheckpointMateri {
  const c = modul.checkpoint;
  if (!c || !c.batas_waktu_menit || typeof c.batas_waktu_menit !== "number" || !MODE_SAH.includes(c.mode)) {
    return { ...CHECKPOINT_DEFAULT };
  }
  return { ...c };
}

export function putuskanAkses({ jenisKegiatan, kebijakan, adaBuktiSesi }: KonteksAkses): KeputusanAkses {
  // Asesmen tanpa AI selalu menutup bantuan akademik, terlepas dari sesi.
  if (jenisKegiatan === "bantuan_akademik" && kebijakan.aturan_bantuan === "tanpa_ai") {
    return {
      tipe: "ditolak",
      pesan: "Aturan course ini melarang bantuan AI saat asesmen. Bantuan akademik tidak tersedia untuk sesi ini.",
    };
  }
  if (jenisKegiatan === "bantuan_akademik") return { tipe: "bebas" };

  if (kebijakan.aturan_pengawasan === "opsional") return { tipe: "bebas" };

  if (!adaBuktiSesi) {
    return { tipe: "perlu_sesi", pesan: PESAN_POLICY.wajib };
  }
  return { tipe: "bebas" };
}

/** Kategori bantuan akademik yang ditutup saat aturan `tanpa_ai`. */
export const KATEGORI_TUTOR_BLOKIR = ["minta_solusi", "minta_jawaban", "kerjakan_tugas"] as const;

export function kategoriDiblokir(kategori: string, kebijakan: KebijakanCourse): boolean {
  if (kebijakan.aturan_bantuan !== "tanpa_ai") return false;
  return (KATEGORI_TUTOR_BLOKIR as readonly string[]).includes(kategori);
}

export type KJenisKejadian =
  | "pindah_tab"
  | "fokus_hilang"
  | "kamera_mulai"
  | "kamera_berhenti"
  | "kamera_gagal"
  | "sesi_dimulai"
  | "sesi_diakhiri";

export type JenisKejadian = "kejadian" | "celah";

/**
 * Pisahkan "kejadian" dari "celah pengawasan".
 *
 * Kejadian = sesuatu yang teramati tetapi ambigu (pindah tab bisa berarti
 * dokumentasi yang diizinkan). Celah = pengawasan benar-benar berhenti,
 * sehingga bukti kegiatan menjadi tidak lengkap dan perlu klarifikasi.
 */
export function klasifikasiKejadian(jenis: KJenisKejadian, visibilitas: "visible" | "hidden" | null): JenisKejadian {
  if (jenis === "kamera_berhenti" || jenis === "kamera_gagal") return "celah";
  if (jenis === "pindah_tab") return visibilitas === "hidden" ? "kejadian" : "celah";
  return "kejadian";
}
