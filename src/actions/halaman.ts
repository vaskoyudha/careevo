"use server";

import {
  createHalaman,
  updateHalaman,
  deleteHalaman,
  geserHalaman,
  getHalaman,
  getModul,
} from "@/lib/courses/store";
import {
  PESAN_AKSES_DITOLAK,
  extractFieldErrors,
  gateStaff,
  safeRevalidate,
} from "@/lib/actions-common";
import { halamanSchema, type HalamanFormData } from "@/lib/validation/halaman";
import type { Halaman } from "@/types/course";

/**
 * Server Action untuk halaman berformat.
 *
 * Susunannya sengaja menyalin `actions/modul.ts`: gerbang staf dulu, validasi
 * zod, store, lalu revalidate. Yang berbeda hanya bentuk muatannya.
 */

export interface HalamanActionState {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Entitas lengkap yang tersimpan — klien tidak perlu menebak hasilnya. */
  halaman?: Halaman;
}

/** Halaman yang menampilkan kurikulum — disehatkan setelah setiap mutasi. */
function revalidateKurikulum(courseId: string): void {
  safeRevalidate("/admin/courses", `/admin/courses/${courseId}`, "/belajar");
}

/**
 * Baca daftar blok dari satu field JSON.
 *
 * Blok berbentuk bersarang (butir → segmen → penanda), jadi memetakannya ke
 * field datar jauh lebih rapuh daripada mengirim satu nilai JSON — pola yang
 * sama dipakai `soal` pada kuis (`actions/kuis.ts`).
 *
 * JSON yang cacat **diteruskan apa adanya**, bukan dilempar: dengan begitu
 * skema yang melaporkannya sebagai `fieldErrors.blok`, bukan exception yang
 * menutup action dan menghapus isi form yang sudah diketik admin.
 *
 * `undefined` (field tidak ada) berarti "jangan sentuh blok" saat memperbarui —
 * dipakai saat admin hanya mengganti judul halaman.
 */
function bacaBlok(formData: FormData): unknown {
  const mentah = formData.get("blok");
  if (mentah === null) return undefined;
  if (typeof mentah !== "string" || !mentah.trim()) return [];
  try {
    return JSON.parse(mentah);
  } catch {
    return mentah;
  }
}

export async function createHalamanAction(
  _prev: HalamanActionState,
  formData: FormData,
): Promise<HalamanActionState> {
  const session = await gateStaff();
  if (!session) {
    return { ok: false, error: PESAN_AKSES_DITOLAK };
  }

  const courseId = String(formData.get("course_id") ?? "");
  const modulId = String(formData.get("modul_id") ?? "");
  if (!courseId) {
    return { ok: false, error: "ID Kursus tidak ditemukan." };
  }
  if (!modulId) {
    return { ok: false, error: "ID Modul tidak ditemukan." };
  }

  const parsed = halamanSchema.safeParse({
    judul: formData.get("judul") ?? "",
    blok: bacaBlok(formData),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Mohon periksa kembali formulir halaman.",
      fieldErrors: extractFieldErrors(parsed.error),
    };
  }

  try {
    const halaman = await createHalaman(courseId, modulId, parsed.data as HalamanFormData);
    if (!halaman) {
      return { ok: false, error: "Kursus atau modul tidak ditemukan dalam sistem." };
    }

    revalidateKurikulum(courseId);
    return {
      ok: true,
      message: `Halaman "${halaman.judul}" berhasil ditambahkan!`,
      halaman,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan sistem saat membuat halaman.",
    };
  }
}

export async function updateHalamanAction(
  _prev: HalamanActionState,
  formData: FormData,
): Promise<HalamanActionState> {
  const session = await gateStaff();
  if (!session) {
    return { ok: false, error: PESAN_AKSES_DITOLAK };
  }

  const courseId = String(formData.get("course_id") ?? "");
  const modulId = String(formData.get("modul_id") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!courseId) {
    return { ok: false, error: "ID Kursus tidak ditemukan." };
  }
  if (!modulId) {
    return { ok: false, error: "ID Modul tidak ditemukan." };
  }
  if (!id) {
    return { ok: false, error: "ID Halaman tidak ditemukan." };
  }

  const existing = await getHalaman(courseId, modulId, id);
  if (!existing) {
    return { ok: false, error: "Halaman tidak ditemukan dalam sistem." };
  }

  const parsed = halamanSchema.safeParse({
    judul: formData.get("judul") ?? existing.judul,
    blok: bacaBlok(formData),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali perbaikan data halaman.",
      fieldErrors: extractFieldErrors(parsed.error),
    };
  }

  try {
    const halaman = await updateHalaman(courseId, modulId, id, parsed.data as HalamanFormData);
    if (!halaman) {
      return { ok: false, error: "Halaman gagal diperbarui." };
    }

    revalidateKurikulum(courseId);
    return {
      ok: true,
      message: `Halaman "${halaman.judul}" berhasil diperbarui!`,
      halaman,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Terjadi kegagalan saat memperbarui halaman.",
    };
  }
}

export async function deleteHalamanAction(
  _prev: HalamanActionState,
  formData: FormData,
): Promise<HalamanActionState> {
  const session = await gateStaff();
  if (!session) {
    return { ok: false, error: PESAN_AKSES_DITOLAK };
  }

  const courseId = String(formData.get("course_id") ?? "");
  const modulId = String(formData.get("modul_id") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!courseId) {
    return { ok: false, error: "ID Kursus tidak ditemukan." };
  }
  if (!modulId) {
    return { ok: false, error: "ID Modul tidak ditemukan." };
  }
  if (!id) {
    return { ok: false, error: "ID Halaman wajib disertakan." };
  }

  // Modul diperiksa lebih dulu agar pesan "tidak ditemukan" menunjuk entitas
  // yang benar ketika id halaman asing muncul di modul yang tidak ada.
  const modul = await getModul(courseId, modulId);
  if (!modul) {
    return { ok: false, error: "Modul tidak ditemukan dalam sistem." };
  }

  const existing = (modul.halaman ?? []).find((h) => h.id === id);
  const judul = existing?.judul ?? id;

  const success = await deleteHalaman(courseId, modulId, id);
  if (!success) {
    return { ok: false, error: "Gagal menghapus halaman atau halaman tidak ditemukan." };
  }

  revalidateKurikulum(courseId);
  return { ok: true, message: `Halaman "${judul}" berhasil dihapus dari sistem.` };
}

/**
 * Pindahkan halaman satu posisi. Bukan aksi form biasa — `arah` datang sebagai
 * argumen terikat, sehingga tidak ada `_prev`/`formData`. Sama dengan
 * `geserModulAction`.
 */
export async function geserHalamanAction(
  courseId: string,
  modulId: string,
  id: string,
  arah: "naik" | "turun",
): Promise<HalamanActionState> {
  const session = await gateStaff();
  if (!session) {
    return { ok: false, error: PESAN_AKSES_DITOLAK };
  }

  if (!courseId || !modulId || !id) {
    return { ok: false, error: "ID Kursus, ID Modul, dan ID Halaman wajib disertakan." };
  }

  try {
    const daftar = await geserHalaman(courseId, modulId, id, arah);
    if (!daftar) {
      return { ok: false, error: "Halaman tidak ditemukan dalam sistem." };
    }

    revalidateKurikulum(courseId);
    return {
      ok: true,
      message: arah === "naik" ? "Halaman dipindahkan ke atas." : "Halaman dipindahkan ke bawah.",
      halaman: daftar.find((h) => h.id === id),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Terjadi kegagalan saat memindahkan halaman.",
    };
  }
}
