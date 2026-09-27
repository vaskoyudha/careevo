import type { CSSProperties } from "react";

import {
  BOBOT_RUBRIC,
  LABEL_RUBRIC,
  SKALA_RUBRIC_MAKS,
  URUTAN_RUBRIC,
} from "@/lib/scoring/karya";
import { ScoreRing } from "./score-ring";

/**
 * Rincian penilaian 5 kriteria untuk sertifikat publik.
 *
 * ## Kenapa ini ada
 *
 * Sebelum ini, sertifikat hanya menampilkan satu angka (`score`). Perekrut tidak
 * bisa membedakan "100 karena kualitas 4/4" dari "100 karena dokumentasi rapi":
 * angka total menyembunyikan *apa* yang dinilai. Rincian ini sudah tersimpan
 * sejak awal di `reviews.rubric_snapshot` — panel ini hanya menampilkannya.
 *
 * ## Kenapa nilainya dari `rubric`, bukan dari payload yang ditandatangani
 *
 * Payload (`AttestationPayload`) sengaja tetap 7 field supaya sertifikat lama
 * tidak perlu diterbitkan ulang. Rubrik dibaca dari review yang ditunjuk
 * `attestations.source_review_id` — sumber immutable-nya, dilindungi
 * `onDelete: restrict`.
 *
 * `rubric` bernilai `null` untuk sertifikat yang review-nya tidak terbaca. Itu
 * bukan alasan menjatuhkan halaman: total yang ditandatangani tetap tampil, dan
 * rinciannya diberi keterangan jujur "tidak tersedia".
 *
 * ## Kenapa grafik batang, bukan daftar angka
 *
 * `rubric_snapshot` menyimpan nilai per kriteria, jadi komposisinya memang data
 * yang bisa digambar — bukan hiasan. Yang paling menentukan pembacaan justru
 * bobotnya: "Orisinalitas 2/4" terasa ringan sampai terlihat bahwa kriterianya
 * berbobot 20%. Karena itu tiap batang membawa bobotnya sendiri, dan **skala tiap
 * batang sengaja 0–maks** (bukan 0–bobot): menormalkan lebar ke bobot akan
 * membuat bar 4/4 yang berbobot 10% tampak lebih kecil daripada bar 2/4 yang
 * berbobot 30%, dan itu membalik arti panjang batang. Panjang = capaian, angka di
 * kanan = bobot.
 *
 * Proporsi tampilan tiap batang adalah **capaian murni** (`nilai / maks`), dan
 * bobot ditulis sebagai angka di sebelah label — bukan dibagi satu panjang.
 *
 * Versi pertama mengalikan capaian dengan bobot supaya "bobot ikut terlihat",
 * dan hasilnya justru menyesatkan: 4/4 pada kriteria berbobot 10% menghasilkan
 * batang sepersepuluh track, jadi jawaban sempurna terbaca seperti hampir gagal.
 * Satu kanal harus menyampaikan satu besaran.
 */
function bagianBar(nilai: number): number {
  if (!Number.isFinite(nilai)) return 0;
  return Math.max(0, Math.min(1, nilai / SKALA_RUBRIC_MAKS)) * 100;
}

export function RubrikPanel({
  rubric,
  total,
}: {
  rubric: Record<string, number> | null;
  /** Skor yang ditandatangani, 0–100. Selalu tampil, apa pun keadaan rubrik. */
  total: number;
}) {
  const nada = total >= 80 ? "leaf" : total >= 60 ? "ocean" : "warn";

  return (
    <section className="verify-panel" aria-labelledby="verify-rubrik">
      <h2 className="verify-panel-title" id="verify-rubrik">
        Rincian penilaian
      </h2>

      {rubric ? (
        <>
          <div className="verify-rubrik-head">
            <ScoreRing nilai={total} label="Skor akhir karya" nada={nada} />
            <div className="verify-rubrik-headtext">
              <p className="verify-rubrik-claim">Dinilai verifikator manusia</p>
              <p className="verify-panel-lead">
                Lima kriteria dengan bobot berbeda. Panjang batang menunjukkan
                nilai kriteria; persentase di sebelahnya menunjukkan seberapa
                besar ia menimbang skor akhir.
              </p>
            </div>
          </div>

          <ul className="verify-bars">
            {URUTAN_RUBRIC.map((kriteria) => {
              const nilai = rubric[kriteria];
              const bobot = BOBOT_RUBRIC[kriteria];
              const adaNilai = typeof nilai === "number" && Number.isFinite(nilai);
              const persenBobot = Math.round(bobot * 100);
              const lebar = adaNilai ? bagianBar(nilai) : 0;

              return (
                <li
                  className="verify-bar"
                  key={kriteria}
                  style={{ "--bar-w": `${lebar.toFixed(2)}%` } as CSSProperties}
                >
                  <div className="verify-bar-head">
                    <span className="verify-bar-label">
                      {LABEL_RUBRIC[kriteria]}
                      <span
                        className="verify-bar-weight"
                        title="Bobot kriteria ini terhadap skor akhir"
                      >
                        {persenBobot}%
                      </span>
                    </span>
                    <span className="verify-bar-score">
                      {adaNilai ? (
                        <>
                          <b>{nilai}</b>
                          <span className="verify-bar-max">
                            /{SKALA_RUBRIC_MAKS}
                          </span>
                        </>
                      ) : (
                        <span className="verify-row-note">tidak dinilai</span>
                      )}
                    </span>
                  </div>

                  <div
                    className="verify-bar-track"
                    role="img"
                    aria-label={
                      adaNilai
                        ? `${LABEL_RUBRIC[kriteria]}: ${nilai} dari ${SKALA_RUBRIC_MAKS}, menimbang ${persenBobot} persen dari skor akhir`
                        : `${LABEL_RUBRIC[kriteria]}: tidak dinilai`
                    }
                  >
                    <span
                      className={`verify-bar-fill${adaNilai ? "" : " is-empty"}`}
                      aria-hidden="true"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <>
          <p className="verify-panel-lead">
            Rincian kriteria tidak tersedia untuk kredensial ini. Skor akhir di
            bawah tetap yang ditandatangani Careevo dan tetap terverifikasi.
          </p>
          <div className="verify-rubrik-head">
            <ScoreRing nilai={total} label="Skor akhir karya" nada={nada} />
            <div className="verify-rubrik-headtext">
              <p className="verify-rubrik-claim">Skor yang ditandatangani</p>
              <p className="verify-panel-lead">
                Nilai per kriteria tidak ikut dalam payload yang ditandatangani,
                jadi yang bisa ditunjukkan hanya totalnya.
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
