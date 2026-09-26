import Link from "next/link";
import type { BarisPembelajaran } from "@/lib/performa/ringkasan";
import { LABEL_SUMBER } from "@/lib/performa/store";

/**
 * Peringatan laporan **pembelajaran**.
 *
 * Klaim yang wajib disebut di sini: skor kuis dinilai server (dari snapshot
 * attempt) sehingga **kredibel**, tetapi **bukan tahan-curang** — kunci jawaban
 * masih ikut ke peramban. Menyebutnya "terverifikasi" saja akan melebihkan
 * klaimnya; menyebutnya "dilaporkan klien" (janji lama) kini justru salah.
 * Peringatan integritas sengaja tidak ikut: laporan ini tidak memuat data
 * integritas sama sekali, dan menaruhnya di sini hanya mengajak pembaca
 * mengaitkan keduanya.
 */
export const PERINGATAN_PEMBELAJARAN = [
  "Skor kuis dinilai di server terhadap snapshot attempt, tetapi bukan bukti tahan-curang: kunci jawaban tetap terkirim ke peramban.",
] as const;

export function PeringatanPembelajaran() {
  return (
    <ul className="space-y-1 text-xs text-muted-foreground">
      {PERINGATAN_PEMBELAJARAN.map((baris) => (
        <li key={baris}>{baris}</li>
      ))}
    </ul>
  );
}

export function PembelajaranTabel({ baris }: { baris: BarisPembelajaran[] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
            <th className="p-3">Peserta</th>
            <th className="p-3">Modul selesai</th>
            <th className="p-3">Rata-rata kuis</th>
            <th className="p-3">Integritas</th>
          </tr>
        </thead>
        <tbody>
          {baris.map((b) => (
            <tr key={b.owner} className="border-b border-border last:border-0">
              <td className="p-3">
                <Link
                  className="font-medium underline"
                  href={`/performa/${encodeURIComponent(b.owner)}`}
                >
                  {b.nama}
                </Link>
                <p className="text-xs text-muted-foreground">{b.owner}</p>
              </td>
              <td className="p-3">
                {b.selesai}
                {/* Jalur penyelesaian hidup di sini, di sebelah penyebutnya.
                    Di laporan integritas angkanya tampil sebagai "3 / 10" —
                    terpisah dari penyebut, angka itu langsung dibaca sebagai
                    proporsi. */}
                <p className="text-xs text-muted-foreground">
                  {b.terverifikasi} {LABEL_SUMBER.terverifikasi}
                </p>
              </td>
              <td className="p-3">
                {b.rataRataKuis === null ? "—" : `${b.rataRataKuis}/100`}
                <p className="text-xs text-muted-foreground">dinilai server</p>
              </td>
              {/* Bukan angka integritas — hanya pintu ke laporan terpisah, supaya
                  kedua laporan tidak pernah dibandingkan di satu layar. */}
              <td className="p-3">
                <Link
                  className="underline"
                  href={`/performa/integritas/${encodeURIComponent(b.owner)}`}
                >
                  Lihat integritas
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {baris.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">Belum ada catatan belajar.</p>
      ) : null}
    </div>
  );
}
