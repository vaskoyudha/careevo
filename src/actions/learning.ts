"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { getCourseById } from "@/lib/courses/store";
import { cariPendaftaran } from "@/lib/courses/enrollment";
import { modulUntukSumber } from "@/lib/courses/modul-resolver";
import { checkpointEfektif, putuskanAkses, type KJenisKejadian } from "@/lib/learning/akses";
import {
  akhiriRun,
  ambilRun,
  buktiBaru,
  buktikanSesi,
  catatKejadian,
  mulaiRun,
  type SessionRun,
} from "@/lib/learning/session";
import { kebijakanDefault } from "@/lib/courses/kebijakan";

export interface SesiActionState {
  ok: boolean;
  error?: string;
  runId?: string;
  bukti?: string;
  run?: SessionRun;
}

function segarkan(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Abaikan di luar lifecycle request Next.js (mis. unit test).
  }
}

/**
 * Kebijakan efektif sebuah kursus.
 *
 * Sementara ini selalu default: tipe `Course` belum menyimpan kebijakan
 * per-kursus (`KebijakanCourse` baru ada di level tipe, field-nya menyusul di
 * Task 7). Menaruh pembacaan di satu tempat membuat Task 7 cukup mengganti isi
 * fungsi ini tanpa menyentuh setiap action.
 */
function kebijakanKursus(): ReturnType<typeof kebijakanDefault> {
  // TODO(Task 7): baca kebijakan tersimpan per-kursus; sampai itu ada, default
  // aman (`aturan_pengawasan: "wajib"`) berlaku untuk semua kursus.
  return kebijakanDefault();
}

/**
 * Mulai sesi terverifikasi untuk sebuah kursus.
 *
 * Sesi dibuat hanya untuk peserta yang benar-benar terdaftar — tanpa
 * pemeriksaan ini, siapa pun yang tahu id kursus dapat membuat sesi dan
 * mengklaim pengerjaan.
 */
export async function mulaiSesiAction(courseId: string): Promise<SesiActionState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Masuk dulu untuk memulai sesi belajar." };

  const kursus = await getCourseById(courseId);
  if (!kursus) return { ok: false, error: "Kursus tidak ditemukan." };
  if (kursus.status !== "published") return { ok: false, error: "Kursus belum dipublikasikan." };

  const pendaftaran = await cariPendaftaran(courseId);
  if (!pendaftaran) return { ok: false, error: "Daftar kursus ini dulu sebelum memulai sesi." };

  const kebijakan = kebijakanKursus();
  const run = await mulaiRun({
    courseId,
    owner: session.email,
    policyVersion: kebijakan.versi,
  });
  await catatKejadian({ runId: run.id, jenis: "sesi_dimulai", visibilitas: "visible" });

  return {
    ok: true,
    runId: run.id,
    bukti: buktiBaru({ courseId, owner: session.email, policyVersion: kebijakan.versi }),
    run,
  };
}

/** Catat kejadian integritas dari klien; selalu ditandai sumbernya. */
export async function catatKejadianAction(input: {
  runId: string;
  jenis: KJenisKejadian;
  visibilitas: "visible" | "hidden" | null;
  detail?: string;
}): Promise<SesiActionState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesi pengguna tidak ditemukan." };

  const run = await ambilRun(input.runId);
  if (!run || run.owner !== session.email.trim().toLowerCase()) {
    return { ok: false, error: "Sesi belajar tidak ditemukan untuk akun ini." };
  }

  const diperbarui = await catatKejadian({
    runId: input.runId,
    jenis: input.jenis,
    visibilitas: input.visibilitas,
    detail: input.detail,
  });
  if (!diperbarui) return { ok: false, error: "Sesi sudah berakhir; kejadian tidak dicatat." };
  return { ok: true, run: diperbarui };
}

/**
 * Selesaikan satu modul.
 *
 * Gerbang server: course wajib punya bukti sesi yang sah **dan** modulnya harus
 * memakai checkpoint `materi`. Tanpa ini, peserta bisa menyelesaikan modul kuis
 * hanya dengan memanggil action ini.
 */
export async function selesaikanMateriAction(input: {
  courseId: string;
  modulId: string;
  bukti: string;
}): Promise<SesiActionState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Masuk dulu untuk menyelesaikan materi." };

  const kursus = await getCourseById(input.courseId);
  if (!kursus) return { ok: false, error: "Kursus tidak ditemukan." };

  // Modul kuis/proyek tidak boleh diselesaikan lewat penandaan manual: periksa
  // checkpoint modul target lebih dulu, sebelum biaya verifikasi bukti sesi.
  const modul = await modulUntukSumber({
    id: kursus.id,
    title: kursus.title,
    tags: kursus.tags,
    duration_min: kursus.duration_min,
    url: kursus.url,
  });
  const target = modul.find((m) => m.id === input.modulId);
  if (!target) return { ok: false, error: "Modul tidak ditemukan pada kurikulum saat ini." };

  const checkpoint = checkpointEfektif(target);
  if (checkpoint.mode !== "materi") {
    return {
      ok: false,
      error: "Modul ini diselesaikan lewat checkpoint kuis/proyek, bukan penandaan manual.",
    };
  }

  const kebijakan = kebijakanKursus();
  const bukti = input.bukti
    ? await buktikanSesi({
        courseId: input.courseId,
        owner: session.email,
        policyVersion: kebijakan.versi,
        token: input.bukti,
      })
    : null;

  const keputusan = putuskanAkses({
    jenisKegiatan: "materi",
    kebijakan,
    adaBuktiSesi: Boolean(bukti),
  });
  // Pesan keputusan dipakai apa adanya agar copy tidak menyimpang dari mesin
  // akses: `perlu_sesi` untuk peserta tanpa bukti, `ditolak` untuk larangan.
  if (keputusan.tipe === "perlu_sesi") return { ok: false, error: keputusan.pesan };
  if (keputusan.tipe === "ditolak") return { ok: false, error: keputusan.pesan };

  segarkan(`/belajar/${kursus.slug}`);
  return { ok: true, runId: bukti?.id };
}

/** Akhiri sesi secara eksplisit (mis. peserta menutup ruang belajar). */
export async function akhiriSesiAction(runId: string, alasan = "peserta_akhiri"): Promise<SesiActionState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesi pengguna tidak ditemukan." };
  const run = await ambilRun(runId);
  if (!run || run.owner !== session.email.trim().toLowerCase()) {
    return { ok: false, error: "Sesi belajar tidak ditemukan untuk akun ini." };
  }
  const diakhiri = await akhiriRun(runId, alasan);
  return { ok: Boolean(diakhiri), run: diakhiri ?? undefined };
}
