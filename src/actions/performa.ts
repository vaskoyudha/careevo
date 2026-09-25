"use server";

import { getSession } from "@/lib/auth/session";
import { getCourseById } from "@/lib/courses/store";
import { cariPendaftaran } from "@/lib/courses/enrollment";
import { modulUntuk } from "@/lib/courses/modul-resolver";
import { catatSkorKuis } from "@/lib/performa/store";

export interface SimpanNilaiState {
  ok: boolean;
  error?: string;
}

/**
 * Simpan skor kuis yang dihitung di peramban.
 *
 * **Skor ini belum dinilai server.** Kunci jawaban ikut terkirim ke peramban,
 * jadi peramban yang menghitung juga bisa memalsukannya. Yang bisa diperiksa
 * di sini hanya **bentuk** angkanya: peserta terdaftar, modul ada, kuisnya
 * benar-benar terpasang, jumlah soal cocok dengan bank, rentang 0–100.
 * Substansi nilainya baru bisa dijamin setelah penilaian pindah ke server;
 * sampai itu terjadi, setiap skor wajib ditampilkan sebagai "dilaporkan klien".
 */
export async function simpanNilaiKuisAction(input: {
  courseId: string;
  modulId: string;
  kuisId: string;
  nilai: number;
  totalSoal: number;
}): Promise<SimpanNilaiState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Masuk dulu untuk menyimpan nilai kuis." };

  const pendaftaran = await cariPendaftaran(input.courseId, session.email);
  if (!pendaftaran) return { ok: false, error: "Daftar kursus ini dulu." };

  const modul = (await modulUntuk(input.courseId)).find((m) => m.id === input.modulId);
  if (!modul) return { ok: false, error: "Modul tidak ditemukan pada kurikulum saat ini." };

  // `kuis` sudah ter-resolve ke objek bank, jadi kehadirannya di sini berarti
  // kuis itu benar-benar terpasang pada modul — bukan sekadar id yang diketik
  // klien. `kuis` opsional pada `ModulKursus`, jadi dijaga eksplisit.
  const kuis = modul.kuis?.find((k) => k.id === input.kuisId);
  if (!kuis) return { ok: false, error: "Kuis ini tidak terpasang pada modul tersebut." };
  if (kuis.soal.length !== input.totalSoal) return { ok: false, error: "Jumlah soal tidak cocok." };

  const kursus = await getCourseById(input.courseId);
  await catatSkorKuis({
    owner: session.email,
    nama: session.nama,
    courseId: input.courseId,
    judulKursus: kursus?.title ?? input.courseId,
    kuisId: input.kuisId,
    modulId: input.modulId,
    nilai: input.nilai,
    totalSoal: input.totalSoal,
  });

  return { ok: true };
}
