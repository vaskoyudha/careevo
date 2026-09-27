import type { FaktaTranskrip, HasilRingkasTutor } from "@/lib/agents/tutor/ringkas";

/**
 * Panel ringkasan tutor — **area verifikator saja**.
 *
 * ## Kenapa bukan di sertifikat publik
 *
 * Ringkasan ini keluar dari model tentang **percakapan**, bukan tentang
 * karya yang dinilai. Sertifikat terbit karena rubrik dan keputusan manusia;
 * menambahkan ringkasan model ke sana berarti dokumen yang sudah ditandatangani
 * memuat klaim yang tidak ikut ditandatangani. Jadi panel ini hanya di halaman
 * staf, di mana pembaca sudah dalam konteks menilai.
 *
 * ## Kenapa tidak ada skor
 *
 * `AGENTS.md` mengunci dua hal: skor submission dan skor kejujuran tidak boleh
 * dijumlahkan, dan hanya keputusan manusia yang menurunkan skor. Ringkasan model
 * tidak punya bentuk yang boleh bergerak — panel ini menampilkan teks, dan
 * `ringkas-tutor.test.ts` menjaga agar skema tidak pernah mendapat field numerik.
 *
 * Yang ditampilkan berdua, dan berdua pun wajib disebut:
 *
 * - **Fakta deterministik** — jumlah sesi, pesan, topik, topik yang berulang.
 *   Hitungan ini benar tanpa model, jadi panel tidak bergantung pada 델 untuk
 *   menampilkan sesuatu yang benar.
 * - **Ringkasan model** — yang *tampak* dipahami dan yang *tampak* sulit, lengkap
 *   dengan kutipan buktinya, plus daftar apa yang tidak bisa diketahui.
 */

/** Panel kosong untuk peserta yang belum pernah memakai tutor. */
function TanpaTranskrip() {
  return (
    <p className="performa-kosong">
      Belum ada percakapan tutor untuk peserta ini, jadi tidak ada yang bisa
      diringkas.
    </p>
  );
}

/** Bentuk believable untuk panel: pesan kegagalan model, atau `null` kalau ada. */
export function PanelRingkasTutor({
  fakta,
  hasil,
  pesanGagal,
}: {
  fakta: FaktaTranskrip | null;
  /** `null` kalau ringkasan tidak tersedia (tanpa model, atau gagal). */
  hasil: HasilRingkasTutor | null;
  /** Alasan ringkasan tidak tampil, untuk ditampilkan apa adanya. */
  pesanGagal?: string;
}) {
  if (!fakta || fakta.sesi === 0) return <TanpaTranskrip />;

  return (
    <div className="tutor">
      {/*
        Fakta dulu: inilah yang benar tanpa model, jadi tidak boleh hilang hanya
        karena model tidak tersedia. Bentuknya kini kartu angka, bukan baris
        label/nilai berulang — tiga baris tabel untuk tiga angka membuat panel
        yang isinya sedikit terlihat panjang.
      */}
      <div>
        <h3 className="performa-subjudul">Yang tercatat</h3>
        <ul className="tutor-stat">
          <li className="tutor-stat-sel">
            <b>{fakta.sesi}</b>
            <span>sesi dengan percakapan</span>
          </li>
          <li className="tutor-stat-sel">
            <b>{fakta.pesanPeserta}</b>
            <span>pesan peserta</span>
          </li>
          <li className="tutor-stat-sel">
            <b>{fakta.pesanTutor}</b>
            <span>pesan tutor</span>
          </li>
          <li className="tutor-stat-sel">
            <b>{fakta.topikDiulang}</b>
            <span>topik diulang</span>
          </li>
        </ul>

        {fakta.topik.length > 0 ? (
          <div className="tutor-topik">
            <span className="tutor-topik-label">Topik</span>
            <ul className="performa-chips">
              {fakta.topik.slice(0, 8).map((t) => (
                <li className="performa-chip" key={t.judul}>
                  {t.judul}
                  <b>{t.sesi}×</b>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="performa-catatan-kecil">
          Angka di atas dihitung langsung dari berkas transkrip, bukan dari model.
        </p>
      </div>

      {hasil ? (
        <div className="tutor-hasil">
          {hasil.ringkasan ? (
            <div>
              <h3 className="performa-subjudul">Ringkasan</h3>
              <p className="tutor-ringkasan">{hasil.ringkasan}</p>
            </div>
          ) : null}

          <DaftarPoin judul="Tampak dipahami" poin={hasil.dipahami} />
          <DaftarPoin judul="Tampak sulit" poin={hasil.kesulitan} />

          {hasil.batas.length > 0 ? (
            <div>
              <h3 className="performa-subjudul">Yang tidak bisa diketahui</h3>
              <ul className="tutor-batas">
                {hasil.batas.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="performa-kosong tutor-gagal">
          {pesanGagal ??
            "Ringkasan bahasa alami tidak tersedia. Fakta di atas tetap akurat."}
        </p>
      )}

      <p className="performa-catatan-kecil">
        Ringkasan ini bahan baca, bukan penilaian. Ia tidak memotong skor dan tidak
        pernah menjadi dasar keputusan otomatis.
      </p>
    </div>
  );
}

/** Satu daftar poin, dengan kutipan buktinya di bawah teks. */
function DaftarPoin({
  judul,
  poin,
}: {
  judul: string;
  poin: Array<{ teks: string; bukti: string }>;
}) {
  if (poin.length === 0) return null;
  return (
    <div>
      <h3 className="performa-subjudul">{judul}</h3>
      <ul className="tutor-poin">
        {poin.map((p) => (
          <li key={`${p.teks}-${p.bukti}`} className="tutor-poin-baris">
            <span className="tutor-poin-teks">{p.teks}</span>
            {/* Bukti ditampilkan, bukan disembunyikan di balik-detail: panel ini
                dipakai saat menilai, dan klaim tanpa bukti yang bisa dibaca
                adalah klaim yang harus dipercaya buta. */}
            <q className="tutor-poin-bukti">{p.bukti}</q>
          </li>
        ))}
      </ul>
    </div>
  );
}