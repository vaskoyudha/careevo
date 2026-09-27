"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useCourseSession } from "./course-session";
import { tandaiModulAction } from "@/actions/enrollment";
import { selesaikanMateriAction } from "@/actions/learning";
import { checkpointEfektif, checkpointTerverifikasi, wajibSesiTerverifikasi } from "@/lib/learning/akses";
import { halamanUntukModul } from "@/lib/courses/halaman";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import type { CheckpointMateri, KebijakanCourse } from "@/types/course";

/** Jalur penyelesaian satu modul. Nilai, bukan boolean, supaya pemanggilnya terbaca. */
export type JalurPenyelesaian = "informal" | "terverifikasi";

/**
 * **Satu-satunya** tempat memutuskan jalur penyelesaian sebuah modul.
 *
 * Satu permukaan memakai aturan ini: reader, lewat `useSelesaikanModul` di bawah.
 * Halaman silabus (`detail-kursus.tsx`) dulu memegang salinan **pelaksanaannya**
 * sendiri (mencentang optimistis lalu mengembalikannya bila server menolak),
 * sedangkan keputusannya tetap dibagi lewat fungsi ini; salinan itu dibuang
 * bersama tombol "Tandai selesai" di sana, sehingga penyelesaian modul kini
 * hanya bisa dilakukan di tempat modulnya benar-benar dibaca — dan di sana pun
 * tidak lagi lewat tombol, melainkan otomatis saat halaman terakhirnya tercapai
 * (`modulSelesaiMembaca`). Di sini hanya ada satu pelaksanaan yang tersisa, jadi
 * tidak ada lagi dua permukaan yang bisa berperilaku beda pada course yang sama.
 *
 * Kenapa klien **tidak** memeriksa ada/tidaknya `bukti` untuk memilih jalur
 * (alasan penuh ada di `akses.ts:31–38`, dan berlaku sama di sini):
 *
 * - `wajibSesiTerverifikasi` hanya membaca **kebijakan**. Kalau bukti ikut
 *   dihitung, jalur terverifikasi justru hanya terpilih saat bukti **tidak**
 *   ada: peserta yang sudah memulai sesi dibelokkan ke penandaan informal
 *   (gerbang server dilewati), dan peserta tanpa bukti dikirim ke action
 *   terverifikasi dengan bukti kosong yang selalu ditolaknya — modulnya
 *   mustahil diselesaikan.
 * - Jadi klien hanya **merutekan**; server yang memutuskan. Dengan bukti,
 *   permintaan berhasil; tanpa bukti, server menjawab `PESAN_POLICY.wajib`
 *   sebagai pesan gerbang yang jelas — bukan kegagalan senyap.
 *
 * Jalur informal juga dipakai untuk **pembatalan** (`sudah === true`):
 * `selesaikanMateriAction` hanya bisa menandai selesai, jadi mengoreksi tanda
 * harus tetap mungkin. Karena itu jalur informal persis untuk kursus `opsional`,
 * checkpoint `kuis`/`proyek`, dan pembatalan.
 */
export function pilihJalurPenyelesaian({
  kebijakan,
  checkpoint,
  sudah,
}: {
  kebijakan: KebijakanCourse;
  /** Checkpoint modul apa adanya; `undefined` untuk modul turunan. */
  checkpoint?: CheckpointMateri;
  /** True bila modul ini sudah bertanda selesai, sehingga klik berarti pembatalan. */
  sudah: boolean;
}): JalurPenyelesaian {
  // `checkpointEfektif` mengisi default aman saat checkpoint-nya tidak lengkap —
  // sama seperti jalur yang dipakai halaman kursus lama.
  const efektif = checkpointEfektif({ checkpoint });
  const wajibTerverifikasi =
    wajibSesiTerverifikasi(kebijakan) && checkpointTerverifikasi(efektif);

  return !wajibTerverifikasi || sudah ? "informal" : "terverifikasi";
}

/**
 * Penyelesaian modul — satu jalur untuk reader.
 *
 * Yang diputuskan di sini hanya *jalur mana* (`pilihJalurPenyelesaian`); apa yang
 * dikerjakan tiap jalur adalah perkara permukaan ini:
 *
 * - `terverifikasi` → `selesaikanMateriAction`, satu-satunya jalur yang
 *   memverifikasi bukti di server. Tidak ada penulisan optimistis: hanya
 *   `hasil.ok` yang mencentang, dan penolakan server muncul sebagai `pesan` yang
 *   dirender bar fokus.
 * - `informal` → `tandaiModulAction`.
 */
export function useSelesaikanModul({
  courseId,
  modulId,
  kebijakan,
  checkpoint,
}: {
  courseId: string;
  modulId: string;
  kebijakan: KebijakanCourse;
  /** Checkpoint modul apa adanya; `undefined` untuk modul turunan. */
  checkpoint?: CheckpointMateri;
}) {
  const { bukti } = useCourseSession();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const jalankan = useCallback(
    (sudah: boolean) =>
      startTransition(async () => {
        if (pilihJalurPenyelesaian({ kebijakan, checkpoint, sudah }) === "informal") {
          const hasil = await tandaiModulAction(courseId, modulId);
          if (hasil.ok) {
            setPesan(null);
            router.refresh();
          } else {
            setPesan(hasil.error ?? null);
          }
          return;
        }

        // Bukti diteruskan apa adanya. Bukti kosong bukan alasan mengganti jalur —
        // server yang menolak, dan pesannya dipakai apa adanya; klien bukan
        // penjaga otoritatif.
        const hasil = await selesaikanMateriAction({ courseId, modulId, bukti: bukti ?? "" });
        if (hasil.ok) {
          setPesan(null);
          router.refresh();
        } else {
          setPesan(hasil.error ?? null);
        }
      }),
    [courseId, modulId, kebijakan, checkpoint, bukti, router, startTransition],
  );

  return { jalankan, pending, pesan };
}

/**
 * Apakah peserta sudah **selesai membaca** sebuah modul.
 *
 * Inilah pengganti tombol "Tandai selesai": penyelesaian tidak lagi menunggu
 * konfirmasi, melainkan diturunkan dari posisi baca. Syaratnya dua, dan
 * keduanya harus benar:
 *
 * - **Checkpoint-nya `materi`.** Modul `kuis`/`proyek` diselesaikan lewat
 *   penilaiannya sendiri (`kuis-view.tsx` → `kirimDanSelesaikanKuisAction`).
 *   Menandainya dari halaman terakhir akan melewati gerbang asesmen itu — dan
 *   memang ditolak server (`tandaiModulAction`/`selesaikanMateriAction` sama-sama
 *   menolak mode bukan `materi`). Karena itu modul seperti itu tidak pernah
 *   dianggap "habis dibaca" di sini; penyelesaiannya bukan peristiwa membaca.
 * - **Halaman yang sedang dibuka adalah halaman terakhir modul.** Id basi
 *   (`?halaman=` yang tidak ketemu) diperlakukan sama dengan `halamanDipilih()`:
 *   jatuh ke halaman pertama, jadi modul berhalaman lebih dari satu tidak
 *   selesai hanya karena parameternya salah.
 *
 * Modul tanpa halaman — turunan, atau modul tersimpan yang isinya hanya kuis —
 * mengembalikan `false`: tidak ada "halaman terakhir" yang bisa dicapai, jadi
 * tidak ada pemicu. Modul satu halaman mengembalikan `true` begitu dibuka —
 * membuka satu-satunya halaman berarti sudah membacanya.
 *
 * Kebijakan course **sengaja tidak masuk signature**: apakah penyelesaiannya sah
 * diputuskan `pilihJalurPenyelesaian` dan server, bukan penentu *kapan* pemicu
 * dinyalakan.
 *
 * Fungsi ini **murni** supaya bisa diuji langsung; yang memicunya adalah effect
 * di `materi-shell.tsx`, bukan render.
 */
export function modulSelesaiMembaca({
  checkpoint,
  modul,
  halamanId,
}: {
  /** Checkpoint modul apa adanya; `undefined` untuk modul turunan. */
  checkpoint?: CheckpointMateri;
  /** Modul aktif, untuk daftar halamannya. */
  modul: Pick<ModulKursus, "submodul">;
  /** Nilai `?halaman=` apa adanya. */
  halamanId?: string | null;
}): boolean {
  // Kebijakan sengaja **tidak** masuk signature: apakah penyelesaiannya sah
  // (jalur terverifikasi vs informal) adalah urusan `pilihJalurPenyelesaian` dan
  // gerbang server, bukan penentu *kapan* pencobaannya dimulai. Yang penting di
  // sini: modul ini modul bacaan, dan bacaannya sudah habis.
  if (checkpointEfektif({ checkpoint }).mode !== "materi") return false;

  const daftar = halamanUntukModul(modul);
  if (daftar.length === 0) return false;

  const terpilih = daftar.find((h) => h.id === halamanId) ?? daftar[0];
  return terpilih.id === daftar[daftar.length - 1].id;
}
