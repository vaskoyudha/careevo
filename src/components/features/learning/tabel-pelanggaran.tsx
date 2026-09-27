import { ShieldCheck } from "lucide-react";
import type { BarisPelanggaran } from "./detail-kursus";

/**
 * Tabel catatan integritas di halaman course.
 *
 * Yang ditampilkan adalah **catatan yang sudah diputuskan manusia**, bukan sinyal
 * peramban. Ini perbedaan yang harus terlihat di copy halaman, bukan hanya di
 * kode: panel kejadian menampilkan rekaman mentah ("keluar tab 3×") sebagai
 * konteks, sedangkan tabel ini menampilkan hasil penafsirannya.
 *
 * Yang dikunci di sini:
 *
 * - **Katalog utuh, termasuk yang nol.** Satu baris per jenis, selalu. Baris "0"
 *   adalah informasi — ia menyatakan bahwa kategori itu dipantau dan tidak ada
 *   yang tercatat. Kalau jenis dihapus dari tabel saat kosong, peserta tidak bisa
 *   membedakan "tidak ada" dari "belum ada kategori ini", dan tabel akan
 *   membutuhkan penjelasan singkat setiap kali isinya berubah.
 * - **Jumlah dipisah jadi aktif dan dipulihkan.** Angka "2" tanpa status
 *   menyesatkan di dua arah: bisa berarti dua penalti yang masih memotong skor
 *   atau dua yang sudah dihapus.
 * - **Copy tidak pernah menyatakan vonis otomatis.** Batas kata vonis
 *   (`katalog.test.ts`) berlaku juga di sini, dan kalimat pengantar menyatakan
 *   batas yang sebenarnya: catatan ini berasal dari keputusan manusia.
 * - **Angka 100 bukan jaminan.** Kalimat itu ditulis eksplisit, karena "skor
 *   penuh" tanpa catatan bisa dibaca sebagai "sistem sudah memverifikasi semua
 *   hal", yang tidak pernah diklaim.
 */
export function TabelPelanggaran({ baris }: { baris: BarisPelanggaran[] }) {
  const adaCatatan = baris.some((b) => b.jumlah > 0);

  return (
    <section
      aria-labelledby="judul-pelanggaran"
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs"
    >
      <h2
        id="judul-pelanggaran"
        className="flex items-center gap-1.5 text-base font-bold text-gray-900"
      >
        <ShieldCheck className="size-4 text-[#0056D2]" aria-hidden="true" />
        Catatan integritas
      </h2>

      <p className="mt-0.5 mb-3 text-[13px] text-gray-500">
        Yang tercatat di course ini, setelah ditinjau verifikator atau admin.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <caption className="sr-only">
            Jumlah catatan integritas per jenis pada course ini, dipisahkan antara
            yang masih berlaku dan yang sudah dipulihkan.
          </caption>
          <thead>
            <tr className="border-b border-gray-200">
              <th scope="col" className="py-2 pr-3 font-semibold text-gray-700">
                Jenis catatan
              </th>
              <th
                scope="col"
                className="py-2 pr-3 text-right font-semibold text-gray-700"
              >
                Berlaku
              </th>
              <th
                scope="col"
                className="py-2 text-right font-semibold text-gray-700"
              >
                Dipulihkan
              </th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => (
              <tr key={b.jenis} className="border-b border-gray-100 last:border-0">
                <th scope="row" className="py-2 pr-3 font-normal text-gray-900">
                  <span className="font-semibold">{b.label}</span>
                  <span className="mt-0.5 block text-[11px] text-gray-500">
                    {b.detail}
                  </span>
                </th>
                <td
                  className="py-2 pr-3 text-right tabular-nums text-gray-900"
                  aria-label={`${b.jumlahAktif} catatan yang masih berlaku`}
                >
                  {b.jumlahAktif}
                </td>
                <td
                  className="py-2 text-right tabular-nums text-gray-500"
                  aria-label={`${b.jumlahDipulihkan} catatan yang sudah dipulihkan`}
                >
                  {b.jumlahDipulihkan}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
        {adaCatatan
          ? "Catatan yang sudah dipulihkan tidak memotong skor. Memulihkannya berarti menyelesaikan ulang course ini sampai tuntas lewat jalur terverifikasi, atau keputusan staf yang tercatat alasannya."
          : "Belum ada catatan pada course ini. Angka nol di setiap jenis berarti tidak ada yang tercatat — bukan berarti sistem sudah memeriksa semuanya."}
      </p>
    </section>
  );
}
