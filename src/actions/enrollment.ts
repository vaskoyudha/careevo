"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { getCourseById } from "@/lib/courses/store";
import { resources } from "@/lib/fixtures";
import { modulUntukSumber } from "@/lib/courses/modul-resolver";
import { kebijakanDefault, PESAN_POLICY } from "@/lib/courses/kebijakan";
import {
  checkpointEfektif,
  checkpointTerverifikasi,
  putuskanAkses,
  wajibSesiTerverifikasi,
} from "@/lib/learning/akses";
import {
  cariPendaftaran,
  daftarKursus,
  listPendaftaran,
  tandaiModul,
} from "@/lib/courses/enrollment";
import type { KebijakanCourse } from "@/types/course";

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

/**
 * Kebijakan efektif sebuah kursus, dari yang **tersimpan** bila ada.
 *
 * Kursus yang belum pernah disunting kebijakannya tidak membawa field ini, jadi
 * `kebijakanDefault()` (pengawasan `wajib`) yang berlaku — bukan "tanpa
 * kebijakan". Definisi dan fallback-nya sengaja sama dengan `kebijakanKursus()`
 * di `actions/learning.ts` dan `belajar/[slug]/page.tsx`: kalau tiap permukaan
 * menyelesaikannya sendiri-sendiri, satu tempat yang lupa fallback sudah cukup
 * untuk membuka gerbang sesi.
 */
function kursusKebijakan(kebijakan: KebijakanCourse | undefined): KebijakanCourse {
  return kebijakan ?? kebijakanDefault();
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
      // Kebijakan dibawa mentah (bisa `undefined`): pemanggil yang menyelesaikan
      // fallback-nya lewat `kursusKebijakan()`, satu tempat, supaya tidak ada
      // cabang yang membaca `undefined` sebagai "bebas".
      kebijakan: kursus.kebijakan,
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
  // Entri fixture tidak punya kebijakan tersimpan sama sekali, sehingga
  // `kursusKebijakan()` memberlakukan default aman untuknya juga.
  return {
    id: resource.id,
    slug: resource.id,
    berbayar: !resource.is_free,
    kebijakan: undefined as KebijakanCourse | undefined,
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
 *
 * Gerbang kedua bersifat kebijakan, bukan checkpoint: pada kursus yang
 * mewajibkan sesi terverifikasi, **arah penyelesaian** sebuah modul `materi`
 * ditolak di sini. Penandaan informal adalah endpoint publik, jadi merutekan UI
 * ke `selesaikanMateriAction` tidak menutup apa pun. Pembatalan tetap
 * dilewatkan; lihat komentar di dalam action.
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

  // Gerbang kebijakan: arah penyelesaian pada kursus yang mewajibkan sesi
  // terverifikasi tidak boleh ditembus dari jalur informal ini.
  //
  // `tandaiModulAction` adalah server action, jadi ia adalah endpoint HTTP
  // publik: merutekan UI ke `selesaikanMateriAction` saja tidak menutup apa pun,
  // sebab pemanggil bisa memanggil action ini langsung dan menandai modul
  // selesai tanpa satu pun bukti sesi. Kursus `wajib` akan tampak terverifikasi
  // padahal tandanya dibuat di luar sesi — persis kegagalan "tampak terverifikasi
  // tetapi tidak" yang dilarang spec. Karena itu penolakannya di sini, **sebelum**
  // penulisan cookie `ls_enroll` dan sebelum revalidasi cache.
  //
  // Kebijakannya diselesaikan sama seperti `kebijakanKursus()` di
  // `actions/learning.ts` dan halaman belajar: `kursus.kebijakan` kalau ada,
  // selain itu `kebijakanDefault()` (`wajib`). Tanpa fallback ini, kursus tanpa
  // kebijakan tersimpan justru jadi jalan keluar dari gerbang.
  //
  // Arah tindakan dibedakan lewat `entri.selesai_modul` sebelum penulisan:
  // `tandaiModul` membatalkan bila id-nya sudah tercatat, jadi id yang sudah
  // selesai berarti pembatalan. Pembatalan sengaja dilewatkan — itu satu-satunya
  // cara peserta mengoreksi tanda, dan menolaknya akan mengunci modul di kursus
  // `wajib` selamanya. Keputusan checkpoint/kebijakan tidak berubah karenanya:
  // modul kuis/proyek tetap ditolak walaupun sudah termuat di cookie (data basi).
  const sudahSelesai = (entri.selesai_modul ?? []).includes(modulId);
  const kebijakan = kursusKebijakan(target.kebijakan);
  if (!sudahSelesai && wajibSesiTerverifikasi(kebijakan) && checkpointTerverifikasi(checkpoint)) {
    // Pesan diambil apa adanya dari `putuskanAkses` — mesin keputusan yang sama
    // dengan `selesaikanMateriAction` — supaya kalimat penolakannya tidak bisa
    // menyimpang antar action.
    const keputusan = putuskanAkses({
      jenisKegiatan: "materi",
      kebijakan,
      adaBuktiSesi: false,
    });
    return {
      ok: false,
      error: keputusan.tipe === "bebas" ? PESAN_POLICY.wajib : keputusan.pesan,
    };
  }

  await tandaiModul(target.id, modulId);
  safeRevalidate("/belajar");
  safeRevalidate(`/belajar/${target.slug}`);
  return { ok: true };
}
