"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { getCourseById } from "@/lib/courses/store";
import { cariPendaftaran, tandaiModul } from "@/lib/courses/enrollment";
import { modulUntukSumber } from "@/lib/courses/modul-resolver";
import {
  JENIS_KEJADIAN_SAH,
  checkpointEfektif,
  putuskanAkses,
  wajibSesiTerverifikasi,
  type KJenisKejadian,
} from "@/lib/learning/akses";
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
import type { Course, KebijakanCourse } from "@/types/course";

export interface SesiActionState {
  ok: boolean;
  error?: string;
  runId?: string;
  bukti?: string;
  run?: SessionRun;
}

/** Nama lokal sengaja sama dengan helper `safeRevalidate` di `actions/enrollment.ts`. */
function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Abaikan di luar lifecycle request Next.js (mis. unit test).
  }
}

/**
 * Kebijakan efektif sebuah kursus.
 *
 * Kursus yang belum pernah disunting kebijakannya tidak membawa field ini,
 * jadi `kebijakanDefault()` (pengawasan `wajib`) tetap berlaku — bukan
 * "tanpa kebijakan", supaya gerbang sesi tidak diam-diam terbuka.
 */
function kebijakanKursus(kursus: Course): KebijakanCourse {
  return kursus.kebijakan ?? kebijakanDefault();
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

  const kebijakan = kebijakanKursus(kursus);
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

  // `jenis` datang dari klien sebagai JSON mentah, jadi tipenya belum tentu
  // benar saat berjalan. Tanpa pemeriksaan ini, string apa pun masuk ke catatan
  // integritas dan `klasifikasiKejadian` diam-diam memperlakukannya sebagai
  // "kejadian" biasa — bukti jadi tampak lengkap padahal isinya di luar skema.
  if (!(JENIS_KEJADIAN_SAH as readonly string[]).includes(input.jenis)) {
    return { ok: false, error: "Jenis kejadian tidak dikenal." };
  }
  // `visibilitas` menumpang validasi yang sama: nilai asing akan lolos ke
  // klasifikasi kejadian/celah dan mengubah arti catatan.
  if (input.visibilitas !== null && input.visibilitas !== "visible" && input.visibilitas !== "hidden") {
    return { ok: false, error: "Jenis kejadian tidak dikenal." };
  }

  const diperbarui = await catatKejadian({
    runId: input.runId,
    // Pemakaian cast di sini aman karena daftar sah sudah diperiksa di atas.
    jenis: input.jenis as KJenisKejadian,
    visibilitas: input.visibilitas,
    // `detail` dipotong di `catatKejadian` (session.ts), tidak diulang di sini.
    detail: input.detail,
  });
  if (!diperbarui) return { ok: false, error: "Sesi sudah berakhir; kejadian tidak dicatat." };
  return { ok: true, run: diperbarui };
}

/**
 * Selesaikan satu modul.
 *
 * Gerbang server: untuk course yang mewajibkan sesi (`wajibSesiTerverifikasi`),
 * modul dengan checkpoint `materi` hanya bisa ditandai selesai dengan bukti sesi
 * yang sah; course `opsional` tidak butuh bukti. Tanpa gerbang ini, peserta bisa
 * menyelesaikan modul kuis hanya dengan memanggil action ini.
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

  const kebijakan = kebijakanKursus(kursus);
  // Sebelum ini, biaya verifikasi bukti selalu dibayar walaupun course-nya
  // `opsional` — padahal keputusannya pasti `bebas`. Lewati saja: hasilnya sama
  // dan tidak ada token yang dibaca untuk course yang tidak membutuhkannya.
  const bukti =
    input.bukti && wajibSesiTerverifikasi(kebijakan)
      ? await buktikanSesi({
          courseId: input.courseId,
          owner: session.email,
          policyVersion: kebijakan.versi,
          token: input.bukti,
        })
      : null;

  // Pemanggil tidak menyaring berdasarkan ada/tidaknya bukti: keputusannya
  // serahkan ke `putuskanAkses` di sini. `keputusan.tipe` selalu `bebas` untuk
  // course `opsional` (lihat `wajibSesiTerverifikasi`), jadi rute klien yang
  // mengirim permintaan ini pada course `opsional` tidak ikut ditolak.
  const keputusan = putuskanAkses({
    jenisKegiatan: "materi",
    kebijakan,
    adaBuktiSesi: Boolean(bukti),
  });
  // Pesan keputusan dipakai apa adanya agar copy tidak menyimpang dari mesin
  // akses: `perlu_sesi` untuk peserta tanpa bukti, `ditolak` untuk larangan.
  if (keputusan.tipe === "perlu_sesi") return { ok: false, error: keputusan.pesan };
  if (keputusan.tipe === "ditolak") return { ok: false, error: keputusan.pesan };

  // Mulai dari sini keputusannya `bebas`: sesi terverifikasi sah, atau kursus
  // `opsional` yang memang tidak menuntutnya. Baru di titik ini penyimpanan
  // boleh terjadi — semua gerbang di atas (sesi, kursus, modul, checkpoint,
  // bukti) sudah lolos lebih dulu, jadi tidak ada jalur penolakan yang menulis.
  //
  // Sebelum ini action hanya me-revalidasi dan mengembalikan `ok: true`, jadi
  // centang "terverifikasi" hidup di state klien saja dan hilang saat halaman
  // dimuat ulang — persis kegagalan "tampak terverifikasi tetapi tidak" yang
  // dilarang. Gejalanya diperparah oleh gerbang kebijakan di
  // `tandaiModulAction`: jalur informal menolak penyelesaian `materi` di kursus
  // `wajib`, sedangkan kursus seed memakai `kebijakanDefault()` (`wajib`).
  // Tanpa penulisan di sini, tidak ada satu pun jalur penyelesaian yang bekerja
  // untuk kursus bawaan.
  //
  // Gerbang pendaftaran: keikutsertaan tetap wajib, bukan karena jalur ini
  // kurang aman, melainkan karena tanpa entri `ls_enroll` namanya tidak ada
  // yang bisa ditulisi — `tandaiModul()` mengembalikan `null` dan peserta akan
  // melihat "siap" padahal progresnya tidak tersimpan. Pendaftaran sengaja
  // tidak diadakan di sini (itu tindakan berbayar/aksi lain); cukup ditolak
  // dengan pesan yang memandu, dan **sebelum** ada penulisan.
  const pendaftaran = await cariPendaftaran(kursus.id);
  if (!pendaftaran) {
    return { ok: false, error: "Daftar kursus ini dulu sebelum menyelesaikan materi." };
  }

  // `tandaiModul()` adalah **toggle**: memanggilnya untuk id yang sudah tercatat
  // justru menghapus tandanya. Peserta yang mengeklik dua kali, atau
  // menyelesaikan ulang modul yang sudah tuntas, akan kehilangan centangnya.
  // Karena itu id yang sudah ada tidak dipanggil ulang; jalur terverifikasi
  // hanya boleh **menambah** penyelesaian, tidak pernah membatalkannya —
  // pembatalan tetap milik jalur informal `tandaiModulAction`.
  if (!(pendaftaran.selesai_modul ?? []).includes(input.modulId)) {
    await tandaiModul(kursus.id, input.modulId);
  }

  // Revalidasi disamakan dengan `tandaiModulAction` (`/belajar` dan halaman
  // kursus): keduanya menulis progres yang sama, jadi keduanya harus menyegarkan
  // permukaan yang sama. Halaman `/belajar` ikut karena daftar progres di sana
  // membaca cookie pendaftaran yang baru saja berubah.
  safeRevalidate("/belajar");
  safeRevalidate(`/belajar/${kursus.slug}`);
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
