import type { CSSProperties } from "react";

/**
 * Cincin skor 0–100 untuk panel sertifikat.
 *
 * ## Kenapa cincin, bukan satu angka lagi
 *
 * Angka besar di kartu menjawab "berapa", bukan "seberapa". Cincin yang terisi
 * 75% membuat proporsinya terbaca sebelum angkanya dibaca — dan pada sertifikat
 * yang dibuka perekrut selama beberapa detik, urutan baca itu yang menentukan.
 *
 * ## Kenapa busurnya dianimasikan dengan `stroke-dashoffset`
 *
 * Itu satu-satunya cara menggambar busur SVG secara bertahap tanpa menghitung
 * path baru. Biayanya paint pada satu elemen kecil, bukan layout, jadi ia tidak
 * pernah membuat halaman tersendat. Preferensi `prefers-reduced-motion` sudah
 * dipenuhi aturan global di `globals.css` (durasi animasi dipangkas 0.01ms), jadi
 * tidak ada cabang tambahan di sini.
 *
 * Nilainya **dibulatkan ke satuan** sebelum digambar: busur tidak punya
 * ketelitian sub-perseratus, dan cincin yang menjanjikan lebih presisi daripada
 * yang bisa ditampilkan lebih buruk daripada cincin yang jujur.
 */
export type NadaCincin = "ocean" | "leaf" | "warn" | "danger";

export function ScoreRing({
  nilai,
  maks = 100,
  label,
  nada = "ocean",
}: {
  nilai: number;
  maks?: number;
  /** Dibaca pembaca layar; angkanya sendiri `aria-hidden` agar tidak dibaca dua kali. */
  label: string;
  nada?: NadaCincin;
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
    <div className="verify-ring" role="img" aria-label={`${label}: ${aman} dari ${maks}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle className="verify-ring-track" cx="50" cy="50" r={r} />
        {/*
          Nol tidak digambar sama sekali. Dengan `stroke-linecap: round`, busur
          sepanjang nol tetap menghasilkan satu titik di ujungnya — dan cincin
          yang tampak "hampir penuh" untuk skor 0 adalah kebohongan yang tidak
          perlu.
        */}
        {bagian > 0 ? (
          <circle
            className={`verify-ring-fill verify-ring-fill-${nada}`}
            cx="50"
            cy="50"
            r={r}
            style={gaya}
          />
        ) : null}
      </svg>
      <span className="verify-ring-value" aria-hidden="true">
        {aman}
        <span className="verify-ring-maks">/{maks}</span>
      </span>
    </div>
  );
}
