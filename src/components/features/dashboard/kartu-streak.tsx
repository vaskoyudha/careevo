import Link from "next/link";
import { CalendarCheck, ArrowRight } from "lucide-react";

/**
 * Kartu hari beruntun di dashboard peserta.
 *
 * Angkanya diteruskan dari server, dari baris `learning_runs`. Komponen ini
 * **tidak** membaca jam atau tanggal sendiri, dan itu bukan kerapian: **hari**
 * untuk seorang peserta adalah hari di zona waktu tetap (`Asia/Jakarta`, lihat
 * `kehadiran.ts`), bukan hari di perangkat tempat ia membuka dashboard. Kalau
 * hitungannya ikut zona peramban, angka yang sama untuk run yang sama akan
 * berbeda antara WIB dan UTC — dan angka yang ditampilkan sebagai motivasi tidak
 * boleh begitu.
 *
 * Batas "hari ini atau kemarin" sudah diterapkan di server, sehingga streak tidak
 * putus setiap pagi menjelang tengah malam.
 */
export function KartuStreak({ hariBeruntun }: { hariBeruntun: number }) {
  const kosong = hariBeruntun === 0;

  return (
    <section
      aria-labelledby="judul-beruntun"
      className="min-w-0 rounded-xl border border-gray-200 bg-white p-5 shadow-xs"
    >
      <h2
        id="judul-beruntun"
        className="flex items-center gap-1.5 text-base font-bold text-gray-900"
      >
        <CalendarCheck className="size-4 text-[#0056D2]" aria-hidden="true" />
        Hari beruntun
      </h2>

      <div className="mt-3 flex items-baseline gap-1.5">
        <b className="text-3xl font-bold tracking-tight text-gray-900 tabular-nums">
          {hariBeruntun}
        </b>
        <span className="text-sm text-gray-500">hari</span>
      </div>

      <p className="mt-2 text-[13px] text-gray-600">
        {kosong
          ? "Belum ada sesi terverifikasi yang selesai hari ini atau kemarin. Satu sesi cukup untuk memulai."
          : "Sesi terverifikasi yang selesai berturut-turut. Satu sesi terputus, dan hitungannya kembali ke hari sebelum itu."}
      </p>

      <Link
        href="/progres"
        className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-[#0056D2] hover:underline"
      >
        Lihat progres lengkap
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </section>
  );
}
