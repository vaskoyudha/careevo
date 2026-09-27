import Link from "next/link";
import { Briefcase } from "lucide-react";

/**
 * Kartu "Cari lowongan" — blok yang tetap jujur di dashboard lama karena isinya
 * hanya penjelasan dan tautan ke `/loker/inbox`, tanpa satu pun angka yang
 * harus bisa ditelusuri ke data milik akun yang sedang masuk.
 *
 * Blok ini dipisah menjadi komponennya sendiri supaya halaman dashboard tidak
 * lagi menjadi satu pembungkus fixture: apa yang benar-benar dirender halaman
 * itu kini bisa dibaca langsung di halaman itu juga.
 *
 * Kartu memakai resep kartu katalog belajar yang sama dengan blok lain di
 * aplikasi (`rounded-xl`, `border-gray-200`, `shadow-xs`) supaya dashboard dan
 * katalog terbaca sebagai satu produk.
 *
 * Header memakai resep header tile dashboard (`.dash-card-head` +
 * `.dash-icon` + `.dash-title`): lencana ikon bertint + judul, tanpa baris
 * penjelasan di bawahnya. Baris "Pindai papan lowongan publik …" dihapus dari
 * tampilan karena ia mengulang apa yang sudah dilakukan tombol di bawahnya,
 * sementara penjelasan kedua — lowongan menjadi inbox dan tidak ada yang
 * dikirim otomatis — tetap tampil karena itulah yang tidak bisa ditebak
 * peserta.
 */
export function JobInboxCard() {
  return (
    <section
      className="min-w-0 rounded-xl border border-gray-200 bg-white p-5 shadow-xs"
      aria-labelledby="cari-title"
    >
      <div className="dash-card-head mb-4">
        <span className="dash-icon" aria-hidden="true">
          <Briefcase className="size-4" />
        </span>
        <h2 id="cari-title" className="dash-title">
          Cari lowongan
        </h2>
        <span className="dash-head-action shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-[#0056D2]">
          Job seeker
        </span>
      </div>
      <p className="text-xs leading-relaxed text-gray-500">
        Lowongan ditemukan disimpan sebagai inbox, belum jadi lamaran. Tidak ada
        yang dikirim otomatis — kamu yang memutuskan.
      </p>
      <Link
        className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-[#0056D2] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#00419e]"
        href="/loker/inbox"
      >
        Buka lowongan ditemukan
      </Link>
    </section>
  );
}
