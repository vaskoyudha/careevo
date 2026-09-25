import type { RecordPerforma } from "@/lib/performa/store";
import type { RingkasanIntegritas } from "@/lib/performa/integritas";

/**
 * Peringatan yang wajib ikut di setiap halaman laporan.
 *
 * Dua klaim di bawah **tidak boleh dibuang** saat halaman ini disunting: skor
 * kuis dihitung di peramban, dan kejadian integritas adalah catatan pengamatan
 * — bukan vonis. Menampilkan keduanya tanpa pengaman membuat dashboard menuduh
 * tanpa bukti.
 */
export const PERINGATAN_LAPORAN = [
  "Skor kuis dilaporkan oleh klien dan belum dinilai server, sehingga belum dapat diperlakukan sebagai nilai terverifikasi.",
  "Kejadian integritas adalah konteks, bukan dasar penilaian: catatan ini tidak mengurangi skor, kelulusan, atau reputasi siapa pun.",
  "Web dan kamera tidak dapat menjamin bebas bantuan AI, joki, atau perangkat kedua.",
] as const;

export interface BarisPerforma extends RecordPerforma {
  integritas?: RingkasanIntegritas;
}

function rataRataKuis(record: RecordPerforma): number | null {
  const nilai = record.kursus.flatMap((k) => k.kuis.map((q) => q.nilai));
  if (nilai.length === 0) return null;
  return Math.round(nilai.reduce((a, b) => a + b, 0) / nilai.length);
}

export function PeringatanLaporan() {
  return (
    <ul className="space-y-1 text-xs text-muted-foreground">
      {PERINGATAN_LAPORAN.map((baris) => (
        <li key={baris}>{baris}</li>
      ))}
    </ul>
  );
}

export function PerformaTabel({ baris }: { baris: BarisPerforma[] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
            <th className="p-3">Peserta</th>
            <th className="p-3">Modul selesai</th>
            <th className="p-3">Rata-rata kuis</th>
            <th className="p-3">Sesi</th>
            <th className="p-3">Kejadian / celah</th>
          </tr>
        </thead>
        <tbody>
          {baris.map((record) => {
            const selesai = record.kursus.reduce((n, k) => n + k.selesai.length, 0);
            const terverifikasi = record.kursus.reduce(
              (n, k) => n + k.selesai.filter((s) => s.sumber === "terverifikasi").length,
              0,
            );
            const rata = rataRataKuis(record);
            const i = record.integritas;
            return (
              <tr key={record.owner} className="border-b border-border last:border-0">
                <td className="p-3">
                  <a
                    className="font-medium underline"
                    href={`/performa/${encodeURIComponent(record.owner)}`}
                  >
                    {record.nama}
                  </a>
                  <p className="text-xs text-muted-foreground">{record.owner}</p>
                </td>
                <td className="p-3">
                  {selesai}
                  <p className="text-xs text-muted-foreground">{terverifikasi} terverifikasi</p>
                </td>
                <td className="p-3">
                  {rata === null ? "—" : `${rata}/100`}
                  <p className="text-xs text-muted-foreground">dilaporkan klien</p>
                </td>
                <td className="p-3">{i?.sesi ?? 0}</td>
                <td className="p-3">
                  {i ? `${i.kejadian} / ${i.celah}` : "—"}
                  {i && i.kedaluwarsa > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {i.kedaluwarsa} kedaluwarsa
                    </p>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {baris.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">Belum ada catatan performa.</p>
      ) : null}
    </div>
  );
}
