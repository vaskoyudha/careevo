import type { CSSProperties } from "react";

/**
 * Cincin skor 0–100 — **satu primitive untuk dua permukaan**.
 *
 * Dipakai panel sertifikat publik (rubrik) dan laporan verifikator (skor
 * kejujuran). Keduanya menggambar busur yang sama dari data yang sama jenisnya,
 * jadi bentuknya tidak ditulis dua kali: dua implementasi penjepitan dan
 * pembulatan pasti menyimpang, dan yang menyimpang adalah angka yang dibaca
 * perekrut di satu halaman dan staf di halaman lain.
 *
 * ## Kenapa busur, bukan satu angka lagi
 *
 * Angka besar menjawab "berapa", bukan "seberapa". Busur yang terisi 75% membuat
 * proporsinya terbaca sebelum angkanya dibaca.
 *
 * ## Kenapa `stroke-dashoffset`
 *
 * Itu cara menggambar busur SVG secara bertahap tanpa menghitung path baru.
 * Biayanya paint pada satu elemen kecil, bukan layout. Preferensi
 * `prefers-reduced-motion` sudah dipenuhi aturan global di `globals.css`, jadi
 * tidak ada cabang tambahan di sini.
 *
 * Nilai tidak dibulatkan di dalam: yang ditampilkan adalah angka yang diberikan.
 * Membulatkan di sini akan membuat dua permukaan menampilkan angka berbeda untuk
 * data yang sama kalau pemanggilnya lupa membulatkan sendiri.
 */
export type NadaCincin = "ocean" | "leaf" | "warn" | "danger";

export type UkuranCincin = "sm" | "lg";

export function CincinSkor({
  nilai,
  maks = 100,
  label,
  nada = "ocean",
  ukuran = "sm",
}: {
  nilai: number;
  maks?: number;
  /** Dibaca pembaca layar; angkanya sendiri `aria-hidden` agar tidak dibaca dua kali. */
  label: string;
  nada?: NadaCincin;
  ukuran?: UkuranCincin;
}) {
  const aman = Number.isFinite(nilai) ? nilai : 0;
  const bagian = Math.max(0, Math.min(1, maks > 0 ? aman / maks : 0));

  const r = 42;
  const keliling = 2 * Math.PI * r;
  const gaya = {
    "--ring-len": `${keliling.toFixed(2)}`,
    "--ring-offset": `${(keliling * (1 - bagian)).toFixed(2)}`,
  } as CSSProperties;

  return (
    <div
      className={`cincin-skor cincin-skor-${ukuran}`}
      role="img"
      aria-label={`${label}: ${aman} dari ${maks}`}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle className="cincin-skor-track" cx="50" cy="50" r={r} />
        {/*
          Nol tidak digambar sama sekali. Dengan `stroke-linecap: round`, busur
          sepanjang nol tetap menghasilkan satu titik di ujungnya — dan cincin
          yang tampak "hampir penuh" untuk skor 0 adalah kebohongan yang tidak
          perlu.
        */}
        {bagian > 0 ? (
          <circle
            className={`cincin-skor-fill cincin-skor-fill-${nada}`}
            cx="50"
            cy="50"
            r={r}
            style={gaya}
          />
        ) : null}
      </svg>
      {/* Hanya angka di dalam busur. Keterangan seperti "2 catatan aktif" tidak
          muat di dalam lingkaran 108px tanpa menyentuh strokenya, dan informasinya
          sudah ada di daftar fakta di sebelah cincin — mengulangnya di sini
          menambah bising pada satu-satunya tempat yang seharusnya paling bersih. */}
      <span className="cincin-skor-isi" aria-hidden="true">
        {aman}
        <span className="cincin-skor-maks">/{maks}</span>
      </span>
    </div>
  );
}
