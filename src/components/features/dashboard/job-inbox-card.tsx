import Link from "next/link";

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
 */
export function JobInboxCard() {
  return (
    <section
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs"
      aria-labelledby="cari-title"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="text-base font-bold text-gray-900" id="cari-title">
            Cari lowongan
          </h2>
          <p className="mt-0.5 text-[13px] text-gray-500">
            Pindai papan lowongan publik, lalu buka dan lacak yang kamu minati
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-[#0056D2]">
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
