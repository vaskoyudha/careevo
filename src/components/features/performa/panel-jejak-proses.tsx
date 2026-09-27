import type { RingkasanProses } from "@/lib/workspace/proses";

/**
 * Panel jejak proses ruang kerja — **panel verifikator**.
 *
 * ## Kenapa ini fakta, bukan penilaian
 *
 * Ruang kerja adalah code-server di dalam kontainer pada origin lain, jadi
 * halaman ini **tidak bisa** melihat ketikan atau tempelan di dalamnya. Yang
 * tersedia hanya hasil: berkas apa yang ada, sebesar apa, dan kapan ukurannya
 * berubah. Jadi panel ini menampilkan angka itu apa adanya, dan **tidak**
 * menurunkan skor integritas apa pun — tidak ada, dan tidak boleh ada:
 * yang punya skor hanya keputusan manusia atas catatan yang sudah diputuskan.
 *
 * Yang ditampilkan:
 *
 * - `perubahan` — berapa kali ukuran berkas berubah antar pengamatan. Ini yang
 *   paling informatif: iterasi yang terlihat dibanding berkas yang muncul sekali
 *   lalu tidak pernah berubah.
 * - `ukuranAwal` — ukuran saat pertama terlihat. **Berkas yang sudah besar saat
 *   pertama terlihat bisa berarti ditempel, atau diketik sangat cepat.** Keduanya
 *   mungkin; panel ini tidak memilih.
 * - `pertamaPada` / `terakhirPada` — kapan berkasnya terlihat pertama dan terakhir.
 *
 * ## Batas yang harus ditulis, bukan disembunyikan
 *
 * Kalau ada snapshot yang `terpotong`, ada berkas yang tidak terekam dan
 * perubahannya tidak akan pernah terlihat. Menyembunyikan itu membuat jejaknya
 * tampak lengkap padahal tidak — jadi penandanya ditampilkan, bukan dirapikan.
 */
/** Detik → "2 jam 5 menit" / "12 menit" / "45 detik". Pendek, karena panelnya. */
function formatMenit(detik: number): string {
  if (!Number.isFinite(detik) || detik < 0) return "tidak diketahui";
  if (detik < 60) return `${Math.round(detik)} detik`;
  const menit = Math.round(detik / 60);
  if (menit < 60) return `${menit} menit`;
  const jam = Math.floor(menit / 60);
  return `${jam} jam ${menit % 60} menit`;
}

export function PanelJejakProses({
  ringkas,
  courseId,
  jedaTerlama,
}: {
  ringkas: RingkasanProses | null;
  courseId: string;
  /** Jeda terpanjang antar pengamatan, dalam detik; `null` kalau < 2 snapshot. */
  jedaTerlama: number | null;
}) {
  if (!ringkas || ringkas.observasi === 0) {
    return (
      <p className="performa-kosong">
        Belum ada jejak proses untuk course ini. Jejak diambil berkali-kali saat
        ruang kerja dibuka, jadi baru ada setelah peserta sempat mengerjakannya.
      </p>
    );
  }

  const teratas = ringkas.jejak.slice(0, 12);

  return (
    <div className="jejak">
      <p className="performa-kosong">
        {ringkas.observasi} pengamatan · {ringkas.jejak.length} berkas. Jejak ini
        menunjukkan <strong>kapan berkas berubah</strong>, bukan siapa yang
        mengetiknya — editor berjalan di kontainer terpisah yang tidak bisa
        diamati dari sini.
      </p>

      {jedaTerlama !== null ? (
        <p className="performa-kosong">
          Jeda terpanjang antar pengamatan: {formatMenit(jedaTerlama)}. Jeda yang
          panjang setelah satu perubahan tunggal sering berarti peserta berhenti
          menulis lalu membaca — tapi bisa juga berarti ruang kerjanya tidak
          dibuka selama itu, jadi ini bukan kesimpulan apa pun.
        </p>
      ) : null}

      {ringkas.adaTerpotong ? (
        <p className="jejak-terpotong">
          Sebagian daftar berkas terpotong pada satu pengamatan. Ada berkas yang
          tidak terekam, jadi perubahannya tidak akan terlihat di sini.
        </p>
      ) : null}

      {teratas.length === 0 ? (
        <p className="performa-kosong">Tidak ada berkas yang tercatat pada course ini.</p>
      ) : (
        /*
         * Tabel, bukan baris daftar. Nilai-nilai ini sebanding antar berkas —
         * "berapa kali berubah", "berapa byte", "berapa kali terlihat" — dan
         * deretan angka yang sejajar kolomnya jauh lebih cepat dibandingkan
         * daripada empat baris kalimat bertumpuk per berkas.
         */
        <div className="jejak-tabel-wrap">
          <table className="jejak-tabel">
            <thead>
              <tr>
                <th>Berkas</th>
                <th className="jejak-angka">Berubah</th>
                <th className="jejak-angka">Ukuran awal → akhir</th>
                <th className="jejak-angka">Terlihat</th>
                <th>Rentang</th>
              </tr>
            </thead>
            <tbody>
              {teratas.map((j) => (
                <tr key={j.path} className={j.hilang ? "is-hilang" : undefined}>
                  <th scope="row" className="jejak-path">
                    {j.path}
                    {j.hilang ? (
                      <span className="jejak-tag">tidak ada di akhir</span>
                    ) : null}
                  </th>
                  <td className="jejak-angka">{j.perubahan}×</td>
                  <td className="jejak-angka">
                    {j.ukuranAwal} → {j.ukuranAkhir}
                    <small> byte</small>
                  </td>
                  <td className="jejak-angka">{j.kemunculan}×</td>
                  <td className="jejak-waktu">
                    {j.pertamaPada.slice(11, 16)}–{j.terakhirPada.slice(11, 16)}
                    <small>{j.terakhirPada.slice(0, 10)}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ringkas.jejak.length > teratas.length ? (
        <p className="performa-catatan-kecil">
          Menampilkan {teratas.length} dari {ringkas.jejak.length} berkas, diurutkan
          dari yang berubah paling banyak ({courseId}).
        </p>
      ) : null}
    </div>
  );
}