import Link from "next/link";
import { Reveal } from "../primitives";
import { HARGA, rupiah, hematTahunanPersen } from "@/lib/pricing";

/**
 * Bottom repeat of the Careevo Plus pitch plus the plan terms. Prices come
 * from `@/lib/pricing` so this block can never drift from the plans table.
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
            Hari sibuk tidak harus menghambatmu. Ubah menit menjadi keahlian
            nyata lewat seluruh kursus, latihan, dan sertifikat Careevo. Mulai
            langgananmu dengan hemat dan nikmati belajar yang mengikuti
            rutinitasmu.
          </p>

          <p className="mb-6 flex flex-wrap items-end gap-2">
            <span className="text-2xl font-medium text-gray-900">
              {rupiah(HARGA.plusBulanan)}
            </span>
            <span className="text-base text-gray-500">
              /bulan, batalkan kapan saja
            </span>
          </p>

          <Link
            href="#paket"
            className="grad-btn mb-10 inline-block h-11 rounded-lg px-6 py-2.5 text-base font-medium transition duration-300 ease-in-out"
          >
            Lihat paket Plus
          </Link>
        </Reveal>

        <Reveal delay={80}>
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Ketentuan Layanan
          </h3>
          <div className="space-y-4 text-sm text-gray-500">
            <p>
              Careevo Plus ditagih {rupiah(HARGA.plusBulanan)} per bulan, atau{" "}
              {rupiah(HARGA.plusTahunan)} per tahun (hemat{" "}
              {hematTahunanPersen(HARGA.plusBulanan, HARGA.plusTahunan)}%, setara
              dua bulan gratis). Tersedia juga paket 6 bulan sebesar{" "}
              {rupiah(HARGA.plusSemester)}. Harga belum termasuk PPN yang
              berlaku.
            </p>
            <p>
              Langganan bulanan menyertakan uji coba gratis 7 hari. Kami mencatat
              informasi pembayaran saat kamu berlangganan, tetapi kamu tidak akan
              ditagih sampai masa uji coba berakhir. Batalkan kapan saja di
              pengaturan akun; akses berbayar tetap berlaku hingga akhir periode
              yang sudah dibayar dan tidak ada tagihan berikutnya.
            </p>
            <p>
              Semua harga ditampilkan dalam Rupiah Indonesia (IDR). Pembelian
              dari luar Indonesia akan ditampilkan dalam mata uang lokal saat
              pembayaran.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
