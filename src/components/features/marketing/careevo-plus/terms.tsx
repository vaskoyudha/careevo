import Link from "next/link";
import { Reveal } from "../primitives";

/**
 * Bottom repeat of the Careevo Plus pitch plus the "Offer Terms"
 * legal block, mirroring the footer-adjacent band on the original page.
 */
export function CareevoPlusTerms() {
  return (
    <section id="ketentuan" className="border-t border-gray-100 bg-gray-50 py-14 lg:py-20">
      <div className="mx-auto max-w-4xl px-4 lg:px-6">
        <Reveal>
          <h2 className="mb-4 text-2xl font-medium text-gray-900">
            Careevo Plus
          </h2>
          <p className="mb-6 max-w-2xl text-base text-gray-500">
            Hari sibuk tidak harus menghambatmu. Ubah menit menjadi lebih banyak
            keahlian lewat 10.000+ program dari Microsoft, Google, Meta,
            Stanford, dan lainnya. Mulai langgananmu dengan hemat dan nikmati
            belajar yang mengikuti rutinitasmu.
          </p>

          <p className="mb-6 flex flex-wrap items-end gap-2">
            <span className="text-lg text-gray-400 line-through">
              IDR 570.000
            </span>
            <span className="text-2xl font-medium text-gray-900">
              IDR 342.000
            </span>
            <span className="text-base text-gray-500">/bulan, batalkan kapan saja</span>
          </p>

          <Link
            href="#paket"
            className="grad-btn mb-10 inline-block h-11 rounded-lg px-6 py-2.5 text-base font-medium transition duration-300 ease-in-out"
          >
            Hemat 40% sekarang
          </Link>
        </Reveal>

        <Reveal delay={80}>
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Ketentuan Penawaran
          </h3>
          <div className="space-y-4 text-sm text-gray-500">
            <p>
              Klaim penawaran ini sebelum 23 September 2026 pukul 23.59 UTC.
              Hanya berlaku untuk pelanggan baru Careevo Plus, dibatasi satu
              per orang. Tidak dapat digunakan bersamaan dengan penawaran lain.
              Careevo berhak mengubah atau membatalkan promosi kapan saja.
            </p>
            <p>
              IDR 342.000 untuk 3 bulan berturut-turut (biasanya IDR 570.000).
              Diskon diterapkan saat pembayaran. Otomatis diperpanjang setiap
              bulan sebesar IDR 570.000/bulan (ditambah pajak yang berlaku),
              kecuali dibatalkan. Batalkan kapan saja di pengaturan akun.
              Penawaran tidak tersedia untuk penduduk India.
            </p>
            <p>
              Jika berada di luar AS, mata uang dan harga lokal akan digunakan
              untuk pembelian dan ditampilkan saat pembayaran.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
