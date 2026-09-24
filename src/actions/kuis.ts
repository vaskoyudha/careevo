"use server";

import {
  createKuis,
  deleteKuis,
  geserKuis,
  getKuis,
  lepasKuis,
  pasangKuis,
  updateKuis,
} from "@/lib/courses/store";
import {
  PESAN_AKSES_DITOLAK,
  extractFieldErrors,
  gateStaff,
  safeRevalidate,
} from "@/lib/actions-common";
import { kuisSchema, updateKuisSchema } from "@/lib/validation/kuis";
import type { Kuis } from "@/types/course";

/**
 * Server Action untuk bank soal kuis.
 *
 * Susunannya menyalin `actions/halaman.ts`: gerbang staf dulu, validasi zod,
 * store, lalu revalidate. Yang berbeda hanya cakupan revalidasi — kuis dipakai
 * lintas kursus, jadi `/admin/kuis` ikut disehatkan selain halaman kurikulum.
 */

export interface KuisActionState {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Entitas lengkap yang tersimpan — klien tidak perlu menebak hasilnya. */
  kuis?: Kuis;
}

/**
 * Halaman bank soal dan kurikulum yang mungkin menampilkan kuis ini.
 *
 * `/admin/courses` ikut karena ringkasan modul menyebut jumlah kuis; `/belajar`
 * karena peserta melihat kuisnya di halaman kursus.
 */
function revalidateKuis(courseId?: string): void {
  safeRevalidate(
    "/admin/kuis",
    "/admin/courses",
    ...(courseId ? [`/admin/courses/${courseId}`] : []),
    "/belajar",
  );
}

/**
 * Baca daftar soal dari satu field JSON.
 *
 * Soal berbentuk bersarang (soal → pilihan → indeks kunci), jadi memetakannya
 * ke field datar jauh lebih rapuh daripada mengirim satu nilai JSON — pola yang
 * sama dipakai blok halaman.
 *
 * JSON yang cacat **diteruskan apa adanya**, bukan dilempar: dengan begitu
 * skema yang melaporkannya sebagai `fieldErrors.soal`, bukan exception yang
 * menutup action dan menghapus isi form yang sudah diketik admin.
 */
function bacaSoal(formData: FormData): unknown {
  const mentah = formData.get("soal");
  if (mentah === null) return undefined;
  if (typeof mentah !== "string" || !mentah.trim()) return [];
  try {
    return JSON.parse(mentah);
  } catch {
    return mentah;
  }
}

export async function createKuisAction(
  _prev: KuisActionState,
  formData: FormData,
): Promise<KuisActionState> {
  const session = await gateStaff();
  if (!session) {
    return { ok: false, error: PESAN_AKSES_DITOLAK };
  }

  const parsed = kuisSchema.safeParse({
    judul: formData.get("judul") ?? "",
    deskripsi: formData.get("deskripsi") ?? "",
    soal: bacaSoal(formData) ?? [],
    nilai_lulus: formData.get("nilai_lulus") ?? 70,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Mohon periksa kembali formulir kuis.",
      fieldErrors: extractFieldErrors(parsed.error),
    };
  }

  try {
    const kuis = await createKuis(parsed.data);
    revalidateKuis();
    return {
      ok: true,
      message: `Kuis "${kuis.judul}" berhasil ditambahkan ke bank soal!`,
      kuis,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan sistem saat membuat kuis.",
    };
  }
}

export async function updateKuisAction(
  _prev: KuisActionState,
  formData: FormData,
): Promise<KuisActionState> {
  const session = await gateStaff();
  if (!session) {
    return { ok: false, error: PESAN_AKSES_DITOLAK };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { ok: false, error: "ID Kuis tidak ditemukan." };
  }

  const existing = await getKuis(id);
  if (!existing) {
    return { ok: false, error: "Kuis tidak ditemukan dalam bank soal." };
  }

  // Field yang tidak ada di form dibiarkan `undefined` supaya skema parsial
  // mempertahankan nilai lama — bukan mengosongkannya.
  const soal = bacaSoal(formData);
  const parsed = updateKuisSchema.safeParse({
    judul: formData.get("judul") ?? undefined,
    deskripsi: formData.get("deskripsi") ?? undefined,
    soal: soal ?? undefined,
    nilai_lulus: formData.get("nilai_lulus") ?? undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali perbaikan data kuis.",
      fieldErrors: extractFieldErrors(parsed.error),
    };
  }

  try {
    const kuis = await updateKuis(id, parsed.data);
    if (!kuis) {
      return { ok: false, error: "Kuis gagal diperbarui." };
    }

    revalidateKuis();
    return {
      ok: true,
      message: `Kuis "${kuis.judul}" berhasil diperbarui!`,
      kuis,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Terjadi kegagalan saat memperbarui kuis.",
    };
  }
}

/**
 * Hapus kuis dari bank.
 *
 * Referensi di modul ikut dibersihkan store, jadi pesannya menyebut berapa
 * modul yang dilepas — supaya admin tahu dampaknya, bukan hanya bahwa entri
 * banknya hilang.
 */
export async function deleteKuisAction(
  _prev: KuisActionState,
  formData: FormData,
): Promise<KuisActionState> {
  const session = await gateStaff();
  if (!session) {
    return { ok: false, error: PESAN_AKSES_DITOLAK };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { ok: false, error: "ID Kuis wajib disertakan." };
  }

  const existing = await getKuis(id);
  const judul = existing?.judul ?? id;

  const dilepas = await deleteKuis(id);
  if (dilepas === null) {
    return { ok: false, error: "Kuis tidak ditemukan dalam bank soal." };
  }

  revalidateKuis();
  return {
    ok: true,
    message: dilepas
      ? `Kuis "${judul}" dihapus dan dilepas dari ${dilepas} modul.`
      : `Kuis "${judul}" berhasil dihapus dari bank soal.`,
  };
}

/** Pasang kuis dari bank ke sebuah modul (aksi terikat, bukan form). */
export async function pasangKuisAction(
  courseId: string,
  modulId: string,
  kuisId: string,
): Promise<KuisActionState> {
  const session = await gateStaff();
  if (!session) {
    return { ok: false, error: PESAN_AKSES_DITOLAK };
  }

  if (!courseId || !modulId || !kuisId) {
    return { ok: false, error: "ID Kursus, ID Modul, dan ID Kuis wajib disertakan." };
  }

  try {
    const modul = await pasangKuis(courseId, modulId, kuisId);
    if (!modul) {
      return { ok: false, error: "Modul atau kuis tidak ditemukan dalam sistem." };
    }

    revalidateKuis(courseId);
    return { ok: true, message: "Kuis dipasang ke modul." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Terjadi kegagalan saat memasang kuis.",
    };
  }
}

/** Lepas kuis dari sebuah modul tanpa menghapusnya dari bank soal. */
export async function lepasKuisAction(
  courseId: string,
  modulId: string,
  kuisId: string,
): Promise<KuisActionState> {
  const session = await gateStaff();
  if (!session) {
    return { ok: false, error: PESAN_AKSES_DITOLAK };
  }

  if (!courseId || !modulId || !kuisId) {
    return { ok: false, error: "ID Kursus, ID Modul, dan ID Kuis wajib disertakan." };
  }

  try {
    const modul = await lepasKuis(courseId, modulId, kuisId);
    if (!modul) {
      return { ok: false, error: "Modul tidak ditemukan dalam sistem." };
    }

    revalidateKuis(courseId);
    return { ok: true, message: "Kuis dilepas dari modul. Entrinya tetap ada di bank soal." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Terjadi kegagalan saat melepas kuis.",
    };
  }
}

/** Pindahkan kuis satu posisi di dalam modul. Sama polanya dengan `geserModulAction`. */
export async function geserKuisAction(
  courseId: string,
  modulId: string,
  kuisId: string,
  arah: "naik" | "turun",
): Promise<KuisActionState> {
  const session = await gateStaff();
  if (!session) {
    return { ok: false, error: PESAN_AKSES_DITOLAK };
  }

  if (!courseId || !modulId || !kuisId) {
    return { ok: false, error: "ID Kursus, ID Modul, dan ID Kuis wajib disertakan." };
  }

  try {
    const daftar = await geserKuis(courseId, modulId, kuisId, arah);
    if (!daftar) {
      return { ok: false, error: "Kuis tidak ditemukan di modul ini." };
    }

    revalidateKuis(courseId);
    return {
      ok: true,
      message: arah === "naik" ? "Kuis dipindahkan ke atas." : "Kuis dipindahkan ke bawah.",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Terjadi kegagalan saat memindahkan kuis.",
    };
  }
}
