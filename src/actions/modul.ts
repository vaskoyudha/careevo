"use server";

import {
  createModul,
  updateModul,
  deleteModul,
  geserModul,
  getModul,
} from "@/lib/courses/store";
import {
  PESAN_AKSES_DITOLAK,
  extractFieldErrors,
  gateStaff,
  safeRevalidate,
} from "@/lib/actions-common";
import { modulSchema, updateModulSchema } from "@/lib/validation/modul";
import { jumlahHalamanSchema } from "@/lib/validation/halaman";
import type { Modul } from "@/types/course";

export interface ModulActionState {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Entitas lengkap yang tersimpan — klien tidak perlu menebak hasilnya. */
  modul?: Modul;
}

/** Halaman yang menampilkan kurikulum — disehatkan setelah setiap mutasi. */
function revalidateKurikulum(courseId: string): void {
  safeRevalidate("/admin/courses", `/admin/courses/${courseId}`, "/belajar");
}

/**
 * Rakit `checkpoint` dari field formulir, bila ada.
 *
 * Mengembalikan objek kosong saat `checkpoint_mode` tidak dikirim, sehingga
 * `updateModulSchema` tidak menerima `checkpoint` yang tidak lengkap —
 * menyebar `checkpoint: undefined` akan tetap hadir sebagai kunci dan membuat
 * Zod menganggapnya "tidak valid" alih-alih "tidak berubah".
 */
function rakitCheckpoint(formData: FormData): Record<string, unknown> {
  const mode = formData.get("checkpoint_mode");
  if (typeof mode !== "string" || !mode) return {};

  const ref = formData.get("checkpoint_ref");
  return {
    checkpoint: {
      mode,
      batas_waktu_menit: formData.get("checkpoint_batas_waktu") ?? 30,
      // `ref` kosong berarti "tidak menautkan apa pun" — dihilangkan agar
      // tidak tersimpan sebagai string kosong yang tampak seperti referensi.
      ...(typeof ref === "string" && ref.trim() ? { ref: ref.trim() } : {}),
    },
  };
}

export async function createModulAction(
  _prev: ModulActionState,
  formData: FormData,
): Promise<ModulActionState> {
  const session = await gateStaff();
  if (!session) {
    return { ok: false, error: PESAN_AKSES_DITOLAK };
  }

  const courseId = String(formData.get("course_id") ?? "");
  if (!courseId) {
    return { ok: false, error: "ID Kursus tidak ditemukan." };
  }

  const parsed = modulSchema.safeParse({
    judul: formData.get("judul") ?? "",
    ringkasan: formData.get("ringkasan") ?? "",
    durasi_min: formData.get("durasi_min") ?? 0,
    ...rakitCheckpoint(formData),
  });

  // Jumlah halaman divalidasi terpisah, bukan lewat `modulSchema`: field ini
  // hanya ada saat membuat modul, sedangkan `updateModulSchema` adalah turunan
  // dari skema yang sama dan menerimanya akan membuat penyuntingan judul bisa
  // diam-diam menambah halaman.
  const jumlah = jumlahHalamanSchema.safeParse(formData.get("jumlah_halaman") ?? 0);

  if (!parsed.success || !jumlah.success) {
    return {
      ok: false,
      error: "Mohon periksa kembali formulir modul.",
      fieldErrors: {
        ...(parsed.success ? {} : extractFieldErrors(parsed.error)),
        ...(jumlah.success ? {} : { jumlah_halaman: "Jumlah halaman 0–50." }),
      },
    };
  }

  try {
    const modul = await createModul(courseId, {
      ...parsed.data,
      jumlah_halaman: jumlah.data,
    });
    if (!modul) {
      return { ok: false, error: "Kursus tidak ditemukan dalam sistem." };
    }

    const dibuat = modul.halaman?.length ?? 0;
    revalidateKurikulum(courseId);
    return {
      ok: true,
      message: dibuat
        ? `Modul "${modul.judul}" berhasil ditambahkan dengan ${dibuat} halaman!`
        : `Modul "${modul.judul}" berhasil ditambahkan!`,
      modul,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan sistem saat membuat modul.",
    };
  }
}

export async function updateModulAction(
  _prev: ModulActionState,
  formData: FormData,
): Promise<ModulActionState> {
  const session = await gateStaff();
  if (!session) {
    return { ok: false, error: PESAN_AKSES_DITOLAK };
  }

  const courseId = String(formData.get("course_id") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!courseId) {
    return { ok: false, error: "ID Kursus tidak ditemukan." };
  }
  if (!id) {
    return { ok: false, error: "ID Modul tidak ditemukan." };
  }

  const existing = await getModul(courseId, id);
  if (!existing) {
    return { ok: false, error: "Modul tidak ditemukan dalam sistem." };
  }

  const parsed = updateModulSchema.safeParse({
    judul: formData.get("judul") ?? existing.judul,
    ringkasan: formData.get("ringkasan") ?? existing.ringkasan,
    durasi_min: formData.get("durasi_min") ?? existing.durasi_min,
    // Checkpoint dirakit hanya bila mode-nya dikirim: form yang hanya mengubah
    // judul tidak boleh diam-diam mengembalikan aturan pengerjaan modul.
    ...rakitCheckpoint(formData),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali perbaikan data modul.",
      fieldErrors: extractFieldErrors(parsed.error),
    };
  }

  try {
    const modul = await updateModul(courseId, id, parsed.data);
    if (!modul) {
      return { ok: false, error: "Modul gagal diperbarui." };
    }

    revalidateKurikulum(courseId);
    return {
      ok: true,
      message: `Modul "${modul.judul}" berhasil diperbarui!`,
      modul,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Terjadi kegagalan saat memperbarui modul.",
    };
  }
}

export async function deleteModulAction(
  _prev: ModulActionState,
  formData: FormData,
): Promise<ModulActionState> {
  const session = await gateStaff();
  if (!session) {
    return { ok: false, error: PESAN_AKSES_DITOLAK };
  }

  const courseId = String(formData.get("course_id") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!courseId) {
    return { ok: false, error: "ID Kursus tidak ditemukan." };
  }
  if (!id) {
    return { ok: false, error: "ID Modul wajib disertakan." };
  }

  const existing = await getModul(courseId, id);
  const judul = existing?.judul ?? id;

  const success = await deleteModul(courseId, id);
  if (!success) {
    return { ok: false, error: "Gagal menghapus modul atau modul tidak ditemukan." };
  }

  revalidateKurikulum(courseId);
  return { ok: true, message: `Modul "${judul}" berhasil dihapus dari sistem.` };
}

/**
 * Pindahkan modul satu posisi. Bukan aksi form biasa — `arah` datang sebagai
 * argumen terikat, sehingga tidak ada `_prev`/`formData`.
 */
export async function geserModulAction(
  courseId: string,
  id: string,
  arah: "naik" | "turun",
): Promise<ModulActionState> {
  const session = await gateStaff();
  if (!session) {
    return { ok: false, error: PESAN_AKSES_DITOLAK };
  }

  if (!courseId || !id) {
    return { ok: false, error: "ID Kursus dan ID Modul wajib disertakan." };
  }

  try {
    const daftar = await geserModul(courseId, id, arah);
    if (!daftar) {
      return { ok: false, error: "Modul tidak ditemukan dalam sistem." };
    }

    const modul = daftar.find((m) => m.id === id);
    revalidateKurikulum(courseId);
    return {
      ok: true,
      message: arah === "naik" ? "Modul dipindahkan ke atas." : "Modul dipindahkan ke bawah.",
      modul,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Terjadi kegagalan saat memindahkan modul.",
    };
  }
}
