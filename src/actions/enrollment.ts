"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { getCourseById } from "@/lib/courses/store";
import { resources } from "@/lib/fixtures";
import { modulUntukSumber } from "@/lib/courses/modul-resolver";
import {
  cariPendaftaran,
  daftarKursus,
  pendaftaranPenuh,
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

async function ambilSesiPendaftaran() {
  const session = await getSession();
  return session ?? { ok: false, error: "Masuk dulu untuk mendaftar kursus." };
}

/** Selesaikan id/slug kursus dari store, lalu dari fixture resource. */
async function selesaikanKursus(courseId: string) {
  const kursus = await getCourseById(courseId);
  if (kursus) {
    if (kursus.status !== "published") return { takTersedia: true as const };
    // Modul dari resolver tunggal: kursus yang kurikulumnya sudah diedit
    // memakai modul tersimpan, sisanya jatuh ke turunan (id lama) sehingga
    // progres di cookie `ls_enroll` tetap dikenali.
    const modul = await modulUntukSumber({
      id: kursus.id,
      title: kursus.title,
      tags: kursus.tags,
      duration_min: kursus.duration_min,
      url: kursus.url,
    });
    return {
      id: kursus.id,
      slug: kursus.slug,
      berbayar: !kursus.is_free,
      modulValid: new Set(modul.map((item) => item.id)),
    };
  }
  const resource = resources.find((item) => item.id === courseId);
  if (!resource) return null;
  const modul = await modulUntukSumber({
    id: resource.id,
    title: resource.title,
    tags: resource.tags,
    duration_min: resource.duration_min,
    url: resource.url,
  });
  return {
    id: resource.id,
    slug: resource.id,
    berbayar: !resource.is_free,
    modulValid: new Set(modul.map((item) => item.id)),
  };
}

export async function daftarKursusAction(courseId: string): Promise<PendaftaranActionState> {
  const auth = await ambilSesiPendaftaran();
  if ("ok" in auth) return auth;
  const session = auth;

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

  const sudah = await cariPendaftaran(target.id, session.email);
  if (sudah) {
    return { ok: true, message: "Kamu sudah terdaftar di kursus ini." };
  }

  const semua = await pendaftaranPenuh();
  if (semua.length >= 50) {
    return { ok: false, error: "Batas 50 pendaftaran tercapai di peramban ini." };
  }

  await daftarKursus(target.id, target.slug, session.email);
  safeRevalidate("/belajar");
  safeRevalidate(`/belajar/${target.slug}`);
  return { ok: true, message: "Pendaftaran berhasil. Selamat belajar!" };
}

export async function tandaiModulAction(
  courseId: string,
  modulId: string,
): Promise<PendaftaranActionState> {
  const auth = await ambilSesiPendaftaran();
  if ("ok" in auth) return auth;
  const session = auth;

  const target = await selesaikanKursus(courseId);
  if (!target || "takTersedia" in target) {
    return { ok: false, error: "Kursus tidak ditemukan." };
  }

  const entri = await cariPendaftaran(target.id, session.email);
  if (!entri) {
    return { ok: false, error: "Daftar dulu sebelum menandai modul." };
  }
  if (!target.modulValid.has(modulId)) {
    return { ok: false, error: "Modul tidak dikenal untuk kursus ini." };
  }

  await tandaiModul(target.id, modulId, session.email);
  safeRevalidate("/belajar");
  safeRevalidate(`/belajar/${target.slug}`);
  return { ok: true };
}
