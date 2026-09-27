"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useCourseSession } from "./course-session";
import { tandaiModulAction } from "@/actions/enrollment";
import { selesaikanMateriAction } from "@/actions/learning";
import { checkpointEfektif, checkpointTerverifikasi, wajibSesiTerverifikasi } from "@/lib/learning/akses";
import type { CheckpointMateri, KebijakanCourse } from "@/types/course";

/** Jalur penyelesaian satu modul. Nilai, bukan boolean, supaya pemanggilnya terbaca. */
export type JalurPenyelesaian = "informal" | "terverifikasi";

/**
 * **Satu-satunya** tempat memutuskan jalur penyelesaian sebuah modul.
 *
 * Dua permukaan memakai aturan ini — reader (`useSelesaikanModul`) dan halaman
 * kursus lama (`detail-kursus.tsx`). Yang **dibagi hanya keputusannya**; cara
 * masing-masing melaksanakannya sengaja berbeda: reader menunggu `hasil.ok` dan
 * tidak pernah menulis optimistis, sedangkan halaman kursus mencentang lebih
 * dulu lalu mengembalikannya bila server menolak. Aturan yang dipakai bersama
 * tidak boleh disalin, karena ia aturan yang paling mudah salah dibaca — dan
 * salinan kedua menyimpang tanpa ada yang gagal.
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

  const jalankan = (sudah: boolean) =>
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
    });

  return { jalankan, pending, pesan };
}
