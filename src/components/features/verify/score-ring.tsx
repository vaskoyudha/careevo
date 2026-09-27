import { CincinSkor, type NadaCincin } from "@/components/ui/cincin-skor";

export type { NadaCincin };

/**
 * Cincin skor 0–100 untuk panel sertifikat.
 *
 * **Delegasi, bukan duplikat.** Busur, penjepitan, dan perlakuan nilai nol
 * sekarang hidup di `@/components/ui/cincin-skor` supaya laporan verifikator dan
 * sertifikat publik menggambar cincin yang sama dari data yang sama jenisnya.
 *
 * Sebelumnya komponen ini punya implementasi sendiri. Dua salinan itu tidak
 * langsung menyimpang, tetapi keduanya menyimpan aturan yang sama (nol tidak
 * digambar, `stroke-dashoffset` dihitung dari keliling, `aria-label` menyebut
 * nilai dan maksimum) — dan aturan yang disalin dua kali adalah aturan yang
 * akan diperbarui sekali. Adaptor ini menjaga API `ScoreRing` yang sudah dipakai
 * `rubrik-panel.tsx` tetap utuh.
 *
 * Ukuran `lg` dipakai panel sertifikat karena cincinnya berdampingan dengan
 * blok teks di kartu yang lebar; laporan verifikator memakai `sm` bawaan.
 */
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
  return <CincinSkor nilai={nilai} maks={maks} label={label} nada={nada} ukuran="lg" />;
}
