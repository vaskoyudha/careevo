"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { getCourseById } from "@/lib/courses/store";
import { resources } from "@/lib/fixtures";
import {
  cariPendaftaran,
  daftarKursus,
  tandaiModul,
} from "@/lib/courses/enrollment";

export interface PendaftaranActionState {
  ok: boolean;
  message?: string;
  error?: string;
  /** True bila kursus berbayar: pengguna harus lewat Careevo Plus. */
  butuhPlus?: boolean;
}

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Abaikan di luar lifecycle request Next.js (mis. unit test).
  }
}

async function butuhMasuk(): Promise<PendaftaranActionState | null> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Masuk dulu untuk mendaftar kursus." };
  }
  return null;
}

/** Selesaikan id/slug kursus dari store, lalu dari fixture resource. */
async function selesaikanKursus(courseId: string) {
  const kursus = await getCourseById(courseId);
  if (kursus) {
    if (kursus.status !== "published") return { takTersedia: true as const };
    return {
      id: kursus.id,
      slug: kursus.slug,
      berbayar: !kursus.is_free,
    };
  }
  const resource = resources.find((item) => item.id === courseId);
  if (!resource) return null;
  return { id: resource.id, slug: resource.id, berbayar: !resource.is_free };
}

export async function daftarKursusAction(courseId: string): Promise<PendaftaranActionState> {
  const tolak = await butuhMasuk();
  if (tolak) return tolak;

  const target = await selesaikanKursus(courseId);
  if (!target) return { ok: false, error: "Kursus tidak ditemukan." };
  if ("takTersedia" in target) {
    return { ok: false, error: "Kursus ini belum dipublikasikan." };
  }
  if (target.berbayar) {
    return {
      ok: false,
      butuhPlus: true,
      error: "Kursus berbayar ini termasuk paket Careevo Plus.",
    };
  }

  const sudah = await cariPendaftaran(target.id);
  if (sudah) {
    return { ok: true, message: "Kamu sudah terdaftar di kursus ini." };
  }

  await daftarKursus(target.id, target.slug);
  safeRevalidate("/belajar");
  safeRevalidate(`/belajar/${target.slug}`);
  return { ok: true, message: "Pendaftaran berhasil. Selamat belajar!" };
}

export async function tandaiModulAction(
  courseId: string,
  modulId: string,
): Promise<PendaftaranActionState> {
  const tolak = await butuhMasuk();
  if (tolak) return tolak;

  const target = await selesaikanKursus(courseId);
  if (!target || "takTersedia" in target) {
    return { ok: false, error: "Kursus tidak ditemukan." };
  }

  const entri = await cariPendaftaran(target.id);
  if (!entri) {
    return { ok: false, error: "Daftar dulu sebelum menandai modul." };
  }

  await tandaiModul(target.id, modulId);
  safeRevalidate("/belajar");
  safeRevalidate(`/belajar/${target.slug}`);
  return { ok: true };
}
