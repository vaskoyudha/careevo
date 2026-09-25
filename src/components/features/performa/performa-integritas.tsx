import Link from "next/link";
import type { BarisIntegritas } from "@/lib/performa/ringkasan";

/**
 * Peringatan laporan **integritas**.
 *
 * Tiga klaim di sini tidak boleh dibuang saat halaman ini disunting:
 * kejadian adalah konteks dan bukan vonis, web dan kamera tidak menjamin
 * bebas bantuan, dan tidak ada data kamera sama sekali yang terkumpul. Yang
 * ketiga penting karena tabel ini menampilkan kolom kamera — pemerhati bisa
 * salah baca "kosong" sebagai "bersih".
 */
export const PERINGATAN_INTEGRITAS = [
  "Kejadian integritas adalah konteks, bukan dasar penilaian: catatan ini tidak mengurangi skor, kelulusan, atau reputasi siapa pun.",
  "Tidak ada video maupun rekaman kamera yang terkumpul. Kolom kamera kosong berarti tidak ada yang dicatat, bukan berarti sesi bersih.",
  "Web dan kamera tidak dapat menjamin bebas bantuan AI, joki, atau perangkat kedua.",
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
