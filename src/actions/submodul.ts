"use server";

import {
  createSubmodul,
  deleteSubmodul,
  geserSubmodul,
  updateSubmodul,
} from "@/lib/courses/store";
import {
  PESAN_AKSES_DITOLAK,
  extractFieldErrors,
  gateStaff,
  safeRevalidate,
} from "@/lib/actions-common";
import { submodulSchema, type SubmodulFormData } from "@/lib/validation/submodul";
import type { Submodul } from "@/types/course";

/**
 * Server Action untuk bab (sub-modul).
 *
 * Susunannya menyalin `actions/modul.ts`: gerbang staf dulu, validasi zod,
 * store, lalu revalidate — satu bentuk untuk semua editor kurikulum, supaya
 * tidak ada action yang diam-diam melewatkan gerbang.
 */

export interface SubmodulActionState {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Entitas lengkap yang tersimpan — klien tidak perlu menebak hasilnya. */
  submodul?: Submodul;
}

/** Halaman yang menampilkan kurikulum — disehatkan setelah setiap mutasi. */
function revalidateKurikulum(courseId: string): void {
  safeRevalidate("/admin/courses", `/admin/courses/${courseId}`, "/belajar");
}

export async function createSubmodulAction(
  _prev: SubmodulActionState,
  formData: FormData,
): Promise<SubmodulActionState> {
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

  const parsed = submodulSchema.safeParse({
    judul: formData.get("judul") ?? "",
    ringkasan: formData.get("ringkasan") ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Mohon periksa kembali formulir bab.",
      fieldErrors: extractFieldErrors(parsed.error),
    };
  }

  try {
    const submodul = await createSubmodul(courseId, modulId, parsed.data as SubmodulFormData);
    if (!submodul) {
      return { ok: false, error: "Kursus atau modul tidak ditemukan dalam sistem." };
    }

    revalidateKurikulum(courseId);
    return {
      ok: true,
      message: `Bab "${submodul.judul}" berhasil ditambahkan!`,
      submodul,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan sistem saat membuat bab.",
    };
  }
}

export async function updateSubmodulAction(
  _prev: SubmodulActionState,
  formData: FormData,
): Promise<SubmodulActionState> {
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
    return { ok: false, error: "ID Bab tidak ditemukan." };
  }

  const parsed = submodulSchema.safeParse({
    judul: formData.get("judul") ?? "",
    ringkasan: formData.get("ringkasan") ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali perbaikan data bab.",
      fieldErrors: extractFieldErrors(parsed.error),
    };
  }

  try {
    const submodul = await updateSubmodul(courseId, modulId, id, parsed.data as SubmodulFormData);
    if (!submodul) {
      return { ok: false, error: "Bab gagal diperbarui." };
    }

    revalidateKurikulum(courseId);
    return {
      ok: true,
      message: `Bab "${submodul.judul}" berhasil diperbarui!`,
      submodul,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Terjadi kegagalan saat memperbarui bab.",
    };
  }
}

export async function deleteSubmodulAction(
  _prev: SubmodulActionState,
  formData: FormData,
): Promise<SubmodulActionState> {
  const session = await gateStaff();
  if (!session) {
    return { ok: false, error: PESAN_AKSES_DITOLAK };
  }

  const courseId = String(formData.get("course_id") ?? "");
  const modulId = String(formData.get("modul_id") ?? "");
  const id = String(formData.get("id") ?? "");
  const jumlahHalaman = Number(formData.get("jumlah_halaman") ?? 0);
  if (!courseId) {
    return { ok: false, error: "ID Kursus tidak ditemukan." };
  }
  if (!modulId) {
    return { ok: false, error: "ID Modul tidak ditemukan." };
  }
  if (!id) {
    return { ok: false, error: "ID Bab wajib disertakan." };
  }

  const success = await deleteSubmodul(courseId, modulId, id);
  if (!success) {
    return { ok: false, error: "Gagal menghapus bab atau bab tidak ditemukan." };
  }

  revalidateKurikulum(courseId);
  return {
    ok: true,
    // Halamannya disebut eksplisit: menghapus bab ikut menghapus halaman di
    // dalamnya, dan itu bagian yang tidak bisa dikembalikan.
    message:
      jumlahHalaman > 0
        ? `Bab beserta ${jumlahHalaman} halamannya berhasil dihapus.`
        : "Bab berhasil dihapus.",
  };
}

/** Pindahkan bab satu posisi. Argumen terikat, jadi tanpa `_prev`/`formData`. */
export async function geserSubmodulAction(
  courseId: string,
  modulId: string,
  id: string,
  arah: "naik" | "turun",
): Promise<{ ok: boolean; error?: string }> {
  const session = await gateStaff();
  if (!session) {
    return { ok: false, error: PESAN_AKSES_DITOLAK };
  }

  const hasil = await geserSubmodul(courseId, modulId, id, arah);
  if (!hasil) {
    return { ok: false, error: "Bab tidak ditemukan dalam sistem." };
  }

  revalidateKurikulum(courseId);
  return { ok: true };
}
