"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { getCourseById } from "@/lib/courses/store";
import { resources } from "@/lib/fixtures";
import { modulUntukSumber } from "@/lib/courses/modul-resolver";
import { checkpointEfektif } from "@/lib/learning/akses";
import {
  cariPendaftaran,
  daftarKursus,
  listPendaftaran,
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
      // Modul utuh dibawa, bukan hanya id-nya: pemanggil perlu membaca
      // checkpoint efektif dan enggan memanggil resolver dua kali dengan sumber
      // yang sama (mahal, dan dua panggilan bisa berbeda bila store berubah).
      modul: async () => modul,
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
    modul: async () => modul,
  };
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

  const semua = await listPendaftaran();
  if (semua.length >= 50) {
    return { ok: false, error: "Batas 50 pendaftaran tercapai di peramban ini." };
  }

  await daftarKursus(target.id, target.slug);
  safeRevalidate("/belajar");
  safeRevalidate(`/belajar/${target.slug}`);
  return { ok: true, message: "Pendaftaran berhasil. Selamat belajar!" };
}

/**
 * Selesaikan/selesaikan-batal satu modul lewat tombol informal "Tandai selesai".
 *
 * Penandaan informal ini hanya sah untuk modul yang checkpoint efektifnya
 * `materi`. Modul kuis/proyek harus dilalui checkpoint-nya sendiri: tanpa
 * penolakan di sini, peserta bisa menandai modul kuis selesai dari tombol ini
 * saja dan melewati lampiran/gerbang yang dibangun untuknya — gerbang sesi
 * yang otoritatif (`selesaikanMateriAction`) jadi tidak ada artinya.
 *
 * Pesan penolakan sengaja disamakan kata per kata dengan `selesaikanMateriAction`
 * di `actions/learning.ts`: satu jalur penolakan = satu copy yang tidak
 * menyimpang antar action.
 */
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
  if (!target.modulValid.has(modulId)) {
    return { ok: false, error: "Modul tidak dikenal untuk kursus ini." };
  }

  // Modul kuis/proyek ditolak **sebelum** gerbang lain: ini penolakan yang
  // paling spesifik dan tidak bergantung pada siapa pemanggilnya.
  const modul = await target.modul();
  const modulTarget = modul.find((item) => item.id === modulId);
  const checkpoint = checkpointEfektif(modulTarget ?? { id: modulId });
  if (checkpoint.mode !== "materi") {
    return {
      ok: false,
      error: "Modul ini diselesaikan lewat checkpoint kuis/proyek, bukan penandaan manual.",
    };
  }

  await tandaiModul(target.id, modulId);
  safeRevalidate("/belajar");
  safeRevalidate(`/belajar/${target.slug}`);
  return { ok: true };
}
