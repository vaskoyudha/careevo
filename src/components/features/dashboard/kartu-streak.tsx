import Link from "next/link";
import { ArrowRight, CalendarDays, Flame } from "lucide-react";
import type { HariMinggu } from "@/lib/learning/kehadiran";

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
 *
 * Strip Sen–Min juga datang dari server sebagai prop `minggu`, bukan disusun di
 * sini: "hari ini" adalah keputusan waktu yang sama dengan streaknya, dan
 * menghitungnya ulang di peramban akan menandai kolom yang berbeda dari angka di
 * atasnya. Nama helper kalender sengaja tidak disebut di berkas ini — batas
 * "angka berasal dari lapisan server" dijaga `dashboard-integritas.test.ts`, dan
 * pindaiannya membaca komentar juga, supaya nama fungsi tidak bisa masuk lewat
 * dokumentasi.
 */
export function KartuStreak({
  hariBeruntun,
  minggu,
}: {
  hariBeruntun: number;
  /** Tujuh hari minggu berjalan; kosong berarti tanggal hari ini tidak terbaca. */
  minggu: HariMinggu[];
}) {
  const kosong = hariBeruntun === 0;

  return (
    <section aria-labelledby="judul-beruntun" className="dash-card min-w-0">
      <div className="dash-card-head">
        <span className="dash-icon" aria-hidden="true">
          <CalendarDays className="size-4" />
        </span>
        <h2 id="judul-beruntun" className="dash-title">
          Hari Beruntun
        </h2>
        {/* Api menyala hanya kalau streaknya benar-benar ada. Menyalakannya di
            angka 0 akan membuat "belum mulai" terlihat sama dengan "sedang
            berjalan", dan warnanya justru jadi kebisingan. Saat kosong, lingkar
            abu-abu menahan ritme header tanpa mengklaim apa pun. */}
        <span
          className={
            "dash-head-action grid size-8 place-items-center rounded-full " +
            (kosong ? "bg-gray-100 text-gray-300" : "bg-amber-50 text-[#eb8a04]")
          }
          aria-hidden="true"
        >
          <Flame className="size-4" />
        </span>
      </div>

      <div className="dash-gap-sm flex items-baseline gap-1.5">
        <b className="dash-figure">{hariBeruntun}</b>
        <span className="text-[14px] font-medium text-gray-600">hari</span>
      </div>

      <p className="dash-gap-xs text-[12.5px] leading-[1.5] text-gray-600">
        {kosong
          ? "Belum ada sesi terverifikasi yang selesai hari ini atau kemarin. Satu sesi cukup untuk memulai."
          : "Sesi terverifikasi yang selesai berturut-turut. Satu sesi terputus, dan hitungannya kembali ke hari sebelum itu."}
      </p>

      {minggu.length > 0 ? <StripMinggu minggu={minggu} /> : null}

      <Link
        href="/progres"
        className="dash-gap-md inline-flex items-center gap-1 text-[13px] font-semibold text-[#007aff] transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-[#0056d2]"
      >
        Lihat progres lengkap
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </section>
  );
}

/**
 * Strip tujuh hari Sen–Min.
 *
 * Titiknya mengikuti status nyata tiap hari: hari ini diberi cincin merek
 * (terisi kalau sudah ada sesi), hari lain yang ada sesinya diisi biru penuh,
 * dan sisanya abu-abu kosong. Label harinya selalu terlihat supaya strip bisa
 * dibaca tanpa menebak dari posisinya.
 *
 * Hari ini ditandai dengan **bentuk** (cincin), bukan hanya warna: pembaca yang
 * tidak membedakan warna tetap harus tahu kolom mana yang berlaku sekarang.
 * Transisi pada latar dan skala titik tetap di bawah 200ms dan `ease-out` —
 * sinyal kecil seperti ini harus terasa langsung, bukan menyusul.
 */
function StripMinggu({ minggu }: { minggu: HariMinggu[] }) {
  return (
    <ol
      className="dash-gap-sm flex items-start justify-between gap-1"
      aria-label="Aktivitas minggu ini"
    >
      {minggu.map((h) => {
        const keadaan = h.aktif ? "ada sesi" : "tidak ada sesi";
        const sekarang = h.hariIni ? ", hari ini" : "";
        return (
          <li
            key={h.kunci}
            className="group/dot flex min-w-0 flex-1 flex-col items-center gap-1.5"
          >
            {/* Lingkaran luar memberi "landasan" pada titik, jadi hari yang
                aktif terlihat bertambah berat tanpa perlu membesar. */}
            <span
              className={
                "grid size-5 place-items-center rounded-full transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] " +
                (h.hariIni
                  ? "bg-blue-100"
                  : h.aktif
                    ? "bg-blue-50"
                    : "bg-gray-100/70")
              }
            >
              <span
                className={
                  "size-2 rounded-full transition-all duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] " +
                  (h.hariIni
                    ? "scale-125 bg-[#007aff]"
                    : h.aktif
                      ? "bg-[#007aff]"
                      : "bg-gray-300")
                }
              />
            </span>
            <span
              className={
                h.hariIni
                  ? "text-[11px] font-bold text-[#007aff]"
                  : "text-[11px] font-medium text-gray-500"
              }
            >
              <span className="sr-only">{`${h.kunci}: ${keadaan}${sekarang}`}</span>
              <span aria-hidden="true">{h.label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
