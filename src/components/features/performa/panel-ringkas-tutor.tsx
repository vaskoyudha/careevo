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
    <p className="text-sm text-muted-foreground">
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
    <div className="space-y-4">
      {/* Fakta dulu: inilah yang benar tanpa model, jadi tidak boleh hilang
          hanya karena model tidak tersedia. */}
      <div>
        <h3 className="text-sm font-semibold">Yang tercatat</h3>
        <ul className="list-app mt-2">
          <li className="list-app-row">
            <span className="row-title">Sesi dengan percakapan</span>
            <span className="text-xs text-muted-foreground">{fakta.sesi}</span>
          </li>
          <li className="list-app-row">
            <span className="row-title">Pesan</span>
            <span className="text-xs text-muted-foreground">
              {fakta.pesanPeserta} dari peserta · {fakta.pesanTutor} dari tutor
            </span>
          </li>
          <li className="list-app-row">
            <span className="row-title">Topik yang ditanyakan lebih dari sekali</span>
            <span className="text-xs text-muted-foreground">{fakta.topikDiulang}</span>
          </li>
          {fakta.topik.length > 0 ? (
            <li className="list-app-row">
              <span className="row-title">Topik</span>
              <span className="text-xs text-muted-foreground">
                {fakta.topik
                  .slice(0, 8)
                  .map((t) => `${t.judul} (${t.sesi}×)`)
                  .join(" · ")}
              </span>
            </li>
          ) : null}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Angka di atas dihitung langsung dari berkas transkrip, bukan dari model.
        </p>
      </div>

      {hasil ? (
        <div className="space-y-3">
          {hasil.ringkasan ? (
            <div>
              <h3 className="text-sm font-semibold">Ringkasan</h3>
              <p className="mt-1 text-sm">{hasil.ringkasan}</p>
            </div>
          ) : null}

          <DaftarPoin judul="Tampak dipahami" poin={hasil.dipahami} />
          <DaftarPoin judul="Tampak sulit" poin={hasil.kesulitan} />

          {hasil.batas.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold">Yang tidak bisa diketahui</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {hasil.batas.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border border-border p-3">
          <p className="text-sm text-muted-foreground">
            {pesanGagal ??
              "Ringkasan bahasa alami tidak tersedia. Fakta di atas tetap akurat."}
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
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
      <h3 className="text-sm font-semibold">{judul}</h3>
      <ul className="mt-1 space-y-2">
        {poin.map((p) => (
          <li key={`${p.teks}-${p.bukti}`} className="text-sm">
            <span className="block">{p.teks}</span>
            {/* Bukti ditampilkan, bukan disembunyikan di balik-detail: panel ini
                dipakai saat menilai, dan klaim tanpa bukti yang bisa dibaca
                adalah klaim yang harus dipercaya buta. */}
            <span className="mt-0.5 block text-xs text-muted-foreground">
              “{p.bukti}”
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}