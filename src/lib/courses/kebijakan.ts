// `import type` hilang saat kompilasi, jadi ini tidak menarik runtime apa pun
// ke bundel klien.
import type { AturanBantuan, AturanPengawasan, KebijakanCourse } from "@/types/course";

/**
 * Kosakata kebijakan course — **murni dan aman untuk komponen klien**, sama
 * seperti `kurikulum.ts`. Jangan menambahkan impor store/`node:fs` di sini;
 * import seperti itu menjatuhkan build Turbopack produksi.
 */

export const LABEL_ATURAN_BANTUAN: Record<AturanBantuan, string> = {
  bebas: "Sumber eksternal diizinkan",
  bertutor: "Tutor Careevo boleh; AI eksternal wajib diungkap",
  tanpa_ai: "Tanpa AI dan tanpa tutor saat asesmen",
};

export const LABEL_ATURAN_PENGAWASAN: Record<AturanPengawasan, string> = {
  wajib: "Pengerjaan wajib di dalam sesi terverifikasi (kamera bagian dari rancangan)",
  opsional: "Sesi terverifikasi opsional",
};

export const PESAN_POLICY: Record<AturanPengawasan, string> = {
  wajib:
    "Pengerjaan kegiatan ini hanya bisa diselesaikan di dalam sesi terverifikasi. Pencatatan kejadian (pindah tab dan fokus yang hilang) aktif selama sesi; kamera dirancang aktif di dalam sesi terverifikasi yang kamu setujui, tetapi belum berjalan di aplikasi ini.",
  opsional:
    "Kamu boleh mengerjakan tanpa sesi terverifikasi, tetapi hasilnya tidak dihitung sebagai bukti kompetensi terverifikasi.",
};

/**
 * Kebijakan awal sebuah course.
 *
 * `wajib` dipilih supaya course baru aman secara default: tanpa ini, course
 * baru akan langsung bisa diselesaikan di luar sesi dan buktinya tidak sah.
 */
export function kebijakanDefault(): KebijakanCourse {
  return {
    aturan_bantuan: "bertutor",
    aturan_pengawasan: "wajib",
    versi: 1,
    aturan_pengawasan_sejak: new Date().toISOString(),
  };
}

export const MODE_CHECKPOINT_LABEL: Record<"materi" | "kuis" | "proyek", string> = {
  materi: "Cek pemahaman materi",
  kuis: "Kuis tersimpan",
  proyek: "Proyek/tugas",
};
