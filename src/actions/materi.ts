"use server";

import {
  createMateri,
  updateMateri,
  deleteMateri,
  listMateri,
  getModul,
} from "@/lib/courses/store";
import {
  PESAN_AKSES_DITOLAK,
  extractFieldErrors,
  gateStaff,
  safeRevalidate,
} from "@/lib/actions-common";
import { materiSchema, type MateriFormData } from "@/lib/validation/materi";
import type { Materi } from "@/types/course";

export interface MateriActionState {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Entitas lengkap yang tersimpan — klien tidak perlu menebak hasilnya. */
  materi?: Materi;
}

/** Halaman yang menampilkan kurikulum — disehatkan setelah setiap mutasi. */
function revalidateKurikulum(courseId: string): void {
  safeRevalidate("/admin/courses", `/admin/courses/${courseId}`, "/belajar");
}

/** Ambil nilai FormData bila ada, selain itu pakai cadangan. */
function ambil(formData: FormData, key: string, cadangan: unknown): unknown {
  const nilai = formData.get(key);
  return nilai ?? cadangan;
}

/**
 * Susun payload mentah sesuai `tipe`.
 *
 * `fallback` hanya diisi saat tipe tidak berubah — mengganti tipe berarti
 * mengganti payload utuh, sehingga menambal field dari tipe lama akan
 * menghasilkan nilai yang salah bentuk.
 */
function rakitPayload(
  formData: FormData,
  tipe: string,
  fallback?: Materi,
): Record<string, unknown> {
  const judul = ambil(formData, "judul", fallback?.judul ?? "");

  switch (tipe) {
    case "video":
      return {
        tipe,
        judul,
        url: ambil(formData, "url", fallback?.tipe === "video" ? fallback.url : ""),
        durasi_min: ambil(
          formData,
          "durasi_min",
          fallback?.tipe === "video" ? fallback.durasi_min : 0,
        ),
      };
    case "pdf":
      return {
        tipe,
        judul,
        path: ambil(formData, "path", fallback?.tipe === "pdf" ? fallback.path : ""),
        ukuran_bytes: ambil(
          formData,
          "ukuran_bytes",
          fallback?.tipe === "pdf" ? fallback.ukuran_bytes : 0,
        ),
      };
    case "kuis": {
      const soalMentah = formData.get("soal");
      let soal: unknown = fallback?.tipe === "kuis" ? fallback.soal : [];
      if (typeof soalMentah === "string" && soalMentah.trim()) {
        try {
          // Daftar soal datang sebagai JSON dari form; bila cacat, biarkan
          // nilainya apa adanya supaya skema yang melaporkannya sebagai
          // fieldError `soal` — bukan exception yang menutup action.
          soal = JSON.parse(soalMentah);
        } catch {
          soal = soalMentah;
        }
      }
      return {
        tipe,
        judul,
        soal,
        nilai_lulus: ambil(
          formData,
          "nilai_lulus",
          fallback?.tipe === "kuis" ? fallback.nilai_lulus : 0,
        ),
      };
    }
    default:
      // Tipe tak dikenal: teruskan apa adanya agar discriminated union yang menolak.
      return { tipe, judul };
  }
}

export async function createMateriAction(
  _prev: MateriActionState,
  formData: FormData,
): Promise<MateriActionState> {
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

  const tipe = String(formData.get("tipe") ?? "");
  const parsed = materiSchema.safeParse(rakitPayload(formData, tipe));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Mohon periksa kembali formulir materi.",
      fieldErrors: extractFieldErrors(parsed.error),
    };
  }

  try {
    const materi = await createMateri(courseId, modulId, parsed.data as MateriFormData);
    if (!materi) {
      return { ok: false, error: "Kursus atau modul tidak ditemukan dalam sistem." };
    }

    revalidateKurikulum(courseId);
    return {
      ok: true,
      message: `Materi "${materi.judul}" berhasil ditambahkan!`,
      materi,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan sistem saat membuat materi.",
    };
  }
}

export async function updateMateriAction(
  _prev: MateriActionState,
  formData: FormData,
): Promise<MateriActionState> {
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
    return { ok: false, error: "ID Materi tidak ditemukan." };
  }

  const daftar = await listMateri(courseId, modulId);
  const existing = daftar.find((m) => m.id === id);
  if (!existing) {
    return { ok: false, error: "Materi tidak ditemukan dalam sistem." };
  }

  const tipe = String(formData.get("tipe") ?? existing.tipe);
  const fallback = tipe === existing.tipe ? existing : undefined;
  const parsed = materiSchema.safeParse(rakitPayload(formData, tipe, fallback));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali perbaikan data materi.",
      fieldErrors: extractFieldErrors(parsed.error),
    };
  }

  try {
    const materi = await updateMateri(courseId, modulId, id, parsed.data as MateriFormData);
    if (!materi) {
      return { ok: false, error: "Materi gagal diperbarui." };
    }

    revalidateKurikulum(courseId);
    return {
      ok: true,
      message: `Materi "${materi.judul}" berhasil diperbarui!`,
      materi,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Terjadi kegagalan saat memperbarui materi.",
    };
  }
}

export async function deleteMateriAction(
  _prev: MateriActionState,
  formData: FormData,
): Promise<MateriActionState> {
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
    return { ok: false, error: "ID Materi wajib disertakan." };
  }

  // Modul diperiksa lebih dulu agar pesan "tidak ditemukan" menunjuk entitas
  // yang benar ketika id materi asing muncul di modul yang tidak ada.
  const modul = await getModul(courseId, modulId);
  if (!modul) {
    return { ok: false, error: "Modul tidak ditemukan dalam sistem." };
  }

  const existing = (modul.materi ?? []).find((m) => m.id === id);
  const judul = existing?.judul ?? id;

  const success = await deleteMateri(courseId, modulId, id);
  if (!success) {
    return { ok: false, error: "Gagal menghapus materi atau materi tidak ditemukan." };
  }

  revalidateKurikulum(courseId);
  return { ok: true, message: `Materi "${judul}" berhasil dihapus dari sistem.` };
}
