import Link from "next/link";
import type { BarisIntegritas } from "@/lib/performa/ringkasan";

/**
 * Peringatan laporan **integritas**.
 *
 * Tiga baris, bukan paragraf. Semuanya singkat karena laporan ini dibaca orang
 * yang sedang menilai — kalimat panjang di situ hanya delaying keputusan.
 *
 * Bentuknya penting: setiap baris menyatakan **apa yang tercatat** dan
 * **apa yang tidak diketahui**. Baris terakhir adalah batasnya — data yang ada
 * tidak bisa membedakan dokumentasi dari bantuan AI, jadi laporan ini tidak
 * pernah menyatakan seseorang melakukan curang. Penilaian itu milik manusia.
 */
export const PERINGATAN_INTEGRITAS = [
  "Tidak ada rekaman kamera. Kamera tidak pernah diminta.",
  "Ini catatan, bukan pelanggaran. Tidak diketahui apa yang dibuka saat keluar tab.",
  "Angka ini tidak menurunkan skor, kelulusan, atau reputasi.",
] as const;

export function PeringatanIntegritas() {
  return (
    <ul className="space-y-1 text-xs text-muted-foreground">
      {PERINGATAN_INTEGRITAS.map((baris) => (
        <li key={baris}>{baris}</li>
      ))}
    </ul>
  );
}

export function IntegritasTabel({ baris }: { baris: BarisIntegritas[] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
            <th className="p-3">Peserta</th>
            <th className="p-3">Sesi</th>
            <th className="p-3">Kejadian / celah</th>
            <th className="p-3">Modul terverifikasi</th>
            <th className="p-3">Pembelajaran</th>
          </tr>
        </thead>
        <tbody>
          {baris.map((b) => (
            <tr key={b.owner} className="border-b border-border last:border-0">
              <td className="p-3">
                <Link
                  className="font-medium underline"
                  href={`/performa/integritas/${encodeURIComponent(b.owner)}`}
                >
                  {b.nama}
                </Link>
                <p className="text-xs text-muted-foreground">{b.owner}</p>
              </td>
              <td className="p-3">
                {b.sesi}
                {b.kedaluwarsa > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {b.kedaluwarsa} kedaluwarsa
                  </p>
                ) : null}
              </td>
              <td className="p-3">
                {b.kejadian} / {b.celah}
                <p className="text-xs text-muted-foreground">kamera: tidak ada</p>
              </td>
              <td className="p-3">
                {b.terverifikasi} / {b.selesai}
              </td>
              {/* Pintu ke laporan lain, bukan datanya. */}
              <td className="p-3">
                <Link
                  className="underline"
                  href={`/performa/${encodeURIComponent(b.owner)}`}
                >
                  Lihat belajar
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {baris.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          Belum ada catatan integritas.
        </p>
      ) : null}
    </div>
  );
}
