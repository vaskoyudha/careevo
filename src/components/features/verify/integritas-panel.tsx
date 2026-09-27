import type { CSSProperties } from "react";

import type { IntegritasSertifikat } from "@/lib/integritas/service";

/**
 * Panel integritas sertifikat — **dua hal yang tidak boleh dicampur**.
 *
 * 1. **Skor kejujuran** — diturunkan dari `integrity_violations`, yaitu keputusan
 *    manusia. Dibaca **pada saat terbit**, bukan hari ini, supaya isi dokumen
 *    tidak berubah setelah dicetak.
 * 2. **Konteks sesi** — fakta pengamatan dari `learning_events` (keluar tab,
 *    fokus hilang). Ini **tidak pernah** memotong skor.
 *
 * Batas yang dikunci `AGENTS.md`: skor submission dan skor kejujuran tidak
 * pernah dijumlahkan, dan sinyal peramban tidak pernah menurunkan skor — kalau
 * tidak, peserta bisa menaikkan skornya sendiri dengan mematikan JavaScript.
 *
 * Karena itu panel ini menampilkan dua blok terpisah dan **tidak** menghasilkan
 * satu angka gabungan. Label baris memakai `label` katalog (fakta), bukan kata
 * vonis.
 *
 * ## Kenapa komposisinya digambar sebagai donat
 *
 * Angka 80/100 sendirian tidak menjelaskan darimana ia datang — dan justru
 * itulah yang ditanyakan pembaca pertama kali ("kenapa tidak 100?"). Donat
 * membagi 100 menjadi tiga bagian yang **dijumlahkan persis**: sisa skor,
 * potongan dari course ini, potongan dari course lain. Ketiganya berasal dari
 * `perCourse` yang sama dengan yang menghasilkan skor, jadi segmennya tidak
 * pernah bisa berbeda dari angka di tengahnya.
 *
 * Segmen "course lain" hanya muncul kalau nilainya > 0. Menampilkan segmen nol
 * membuat pembaca mengira ada potongan yang tidak terlihat.
 */
type Segmen = { kunci: string; label: string; nilai: number; kelas: string };

function bangunSegmen(integritas: IntegritasSertifikat): Segmen[] {
  return [
    {
      kunci: "sisa",
      label: "Sisa skor",
      nilai: integritas.skorSaatTerbit,
      kelas: "verify-donut-sisa",
    },
    {
      kunci: "ini",
      label: "Potongan course ini",
      nilai: integritas.penaltiCourseIni,
      kelas: "verify-donut-ini",
    },
    {
      kunci: "lain",
      label: "Potongan course lain",
      nilai: integritas.penaltiCourseLain,
      kelas: "verify-donut-lain",
    },
  ].filter((s) => s.kunci === "sisa" || s.nilai > 0);
}

/**
 * Segmen + titik-mulaianya dihitung **sebelum** JSX, bukan sambil merender.
 *
 * Versi pertama menaikkan akumulator di dalam `.map()` JSX, dan itu mengubah
 * state saat render — React boleh merender ulang, dan pada render kedua
 * akumulatornya sudah bukan 0 lagi, sehingga segmennya bergeser. Aturan
 * `react-hooks/immutability` menangkap ini; perbaikannya bukan membungkam
 * aturan itu, melainkan memindahkan perhitungannya keluar dari render.
 */
function segmenBeroffset(segmen: Segmen[], keliling: number) {
  let jalan = 0;
  return segmen.map((s) => {
    const bagian = kelasSegmen(s, segmen);
    const panjang = bagian * keliling;
    const hasil = { ...s, panjang, offset: -jalan * keliling };
    jalan += bagian;
    return hasil;
  });
}

/** Bagian satu segmen, dihitung dari total pembagi yang sama untuk semua segmen. */
function kelasSegmen(s: Segmen, semua: Segmen[]): number {
  const total = semua.reduce((n, x) => n + x.nilai, 0);
  return total > 0 ? s.nilai / total : 0;
}

export function IntegritasPanel({
  integritas,
}: {
  integritas: IntegritasSertifikat;
}) {
  const berubah = integritas.skorSekarang !== integritas.skorSaatTerbit;
  const segmen = bangunSegmen(integritas);

  const r = 42;
  const keliling = 2 * Math.PI * r;
  const segmenSiap = segmenBeroffset(segmen, keliling);

  return (
    <section className="verify-panel" aria-labelledby="verify-integritas">
      <h2 className="verify-panel-title" id="verify-integritas">
        Integritas saat terbit
      </h2>

      <div className="verify-integritas-head">
        <figure className="verify-donut">
          <svg viewBox="0 0 100 100" role="img" aria-label="Komposisi skor kejujuran">
            <circle className="verify-donut-track" cx="50" cy="50" r={r} />
            {segmenSiap.map((s) => {
              // Segmen nol tidak digambar: dengan ujung membulat ia tetap
              // meninggalkan satu titik, dan titik warna potongan pada skor yang
              // tidak punya potongan itu akan terbaca sebagai catatan.
              if (s.panjang <= 0) return null;
              const gaya = {
                "--seg-len": `${s.panjang.toFixed(2)}`,
                "--seg-sisa": `${Math.max(0, keliling - s.panjang).toFixed(2)}`,
                "--seg-offset": `${s.offset.toFixed(2)}`,
              } as CSSProperties;
              return (
                <circle
                  key={s.kunci}
                  className={`verify-donut-seg ${s.kelas}`}
                  cx="50"
                  cy="50"
                  r={r}
                  style={gaya}
                />
              );
            })}
          </svg>
          <figcaption className="verify-donut-pusat">
            <b>{integritas.skorSaatTerbit}</b>
            <span>/100</span>
          </figcaption>
        </figure>

        <div className="verify-integritas-headtext">
          <p className="verify-rubrik-claim">Skor kejujuran</p>
          <ul className="verify-legend">
            {segmen.map((s) => (
              <li key={s.kunci} className="verify-legend-item">
                <span className={`verify-legend-dot ${s.kelas}`} aria-hidden="true" />
                <span className="verify-legend-label">{s.label}</span>
                <span className="verify-legend-value">
                  {s.kunci === "sisa" ? `${s.nilai}/100` : `−${s.nilai}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="verify-panel-lead">
        Turun dari catatan integritas yang <strong>diputuskan manusia</strong>,
        bukan dari rekaman otomatis. Daftar di bawah mencakup course yang
        disertifikatkan ini; katalognya ditampilkan utuh, termasuk yang nol.
      </p>

      <ul className="verify-list">
        {integritas.perJenis.map((baris) => (
          <li key={baris.jenis}>
            <span className="verify-list-label">{baris.label}</span>
            <span
              className={
                baris.jumlah === 0
                  ? "verify-list-value verify-list-value-kosong"
                  : "verify-list-value"
              }
            >
              {baris.jumlah === 0 ? "—" : `${baris.jumlah} catatan`}
            </span>
          </li>
        ))}
      </ul>

      {berubah ? (
        <p className="verify-panel-note">
          Skor saat ini <b>{integritas.skorSekarang}/100</b> — berubah setelah
          sertifikat terbit. Angka di dokumen ini tetap pada keadaan saat terbit.
        </p>
      ) : null}

      <p className="verify-panel-foot">
        Skor kejujuran berlaku untuk <em>seluruh akun</em>, sedangkan daftar di
        atas hanya mencakup course yang disertifikatkan ini.
      </p>

      {/*
        Batas kejujuran panelnya, dan ia dipecah jadi dua baris pendek dengan
        sengaja. Sebelumnya ia satu paragraf yang menumpuk empat klaim sekaligus
        ("berlaku untuk akun", "penuh berarti tidak ada catatan", "bukan berarti
        diperiksa", "rekaman mentah ada di laporan") — dan batas yang paling
        penting justru hilang di tumpukan itu. Satu baris, satu batas.
      */}
      <ul className="verify-batas">
        <li>
          Skor penuh berarti <strong>tidak ada catatan</strong> — bukan berarti
          seluruh sesi sudah diperiksa.
        </li>
        <li>
          Rekaman mentah sesi (keluar tab, fokus hilang) ada di laporan
          integritas dan <strong>tidak pernah</strong> menurunkan skor ini.
        </li>
      </ul>
    </section>
  );
}
