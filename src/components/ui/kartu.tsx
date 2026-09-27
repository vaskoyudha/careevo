import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Kepala kartu yang bisa dipindai: ikon, judul, satu baris penjelas, aksi.
 *
 * ## Kenapa ikon, dan kenapa ikon saja tidak cukup
 *
 * Laporan verifikator punya sembilan bagian yang semuanya berbentuk judul +
 * paragraf. Dibaca berurutan, itu jadi dinding teks: mata tidak punya tempat
 * berhenti, dan tiap bagian terasa sama pentingnya. Ikon memberi penanda bentuk
 * yang bisa dikenali sebelum judulnya dibaca.
 *
 * Tapi ikon tanpa disiplin hanya menambah bising. Karena itu kontraknya:
 *
 * 1. **Ikon harus berbeda antar bagian.** Dua kartu berikon sama membuat
 *    penandanya tidak lagi menandai apa pun.
 * 2. **Satu ikon per judul, tidak pernah dekoratif.** Setiap ikon menyatakan
 *    isi bagiannya, bukan menghias.
 * 3. **Tanpa kotak berwarna-warni.** Ikon memakai warna teks sekunder yang sama
 *    untuk semua kartu. Warna status hanya dipakai kalau memang menyatakan
 *    status — kalau tidak, sembilan kotak warna membuat halaman terbaca seperti
 *    dasbor alarm.
 *
 * Nada (`nada`) adalah satu-satunya pengecualian, dan hanya untuk keadaan yang
 * memang punya arti: antrian yang menunggu keputusan, dan skor di bawah ambang.
 */
export type NadaKartu = "netral" | "perhatian" | "baik";

export function Kartu({
  ikon: Ikon,
  judul,
  lead,
  aksi,
  nada = "netral",
  id,
  className,
  children,
}: {
  ikon: LucideIcon;
  judul: string;
  /** Satu baris. Kalau lebih dari satu kalimat, itu bukan lead lagi. */
  lead?: ReactNode;
  /** Elemen di kanan judul — badge angka, tautan, atau tombol kecil. */
  aksi?: ReactNode;
  nada?: NadaKartu;
  /** Dipakai `aria-labelledby` supaya bagian ini punya nama yang bisa ditunjuk. */
  id: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("card kartu", `kartu-${nada}`, className)} aria-labelledby={id}>
      <header className="kartu-head">
        <span className="kartu-ikon" aria-hidden="true">
          <Ikon size={17} strokeWidth={2} />
        </span>
        <div className="kartu-judul-wrap">
          <h2 className="kartu-judul" id={id}>
            {judul}
          </h2>
          {lead ? <p className="kartu-lead">{lead}</p> : null}
        </div>
        {aksi ? <div className="kartu-aksi">{aksi}</div> : null}
      </header>
      <div className="kartu-isi">{children}</div>
    </section>
  );
}

/**
 * Baris fakta berlabel — bentuk yang dipakai berulang di laporan.
 *
 * Menggantikan `<ul className="list-app">` yang berisi satu `<li>` per baris
 * untuk data yang sebenarnya pasangan label/nilai. `dl` lebih tepat secara
 * semantik, dan bentuknya tidak lagi bergantung pada grid dua kolom yang dipakai
 * daftar interaktif.
 */
export function Fakta({
  label,
  children,
  ikon: Ikon,
}: {
  label: string;
  children: ReactNode;
  ikon?: LucideIcon;
}) {
  return (
    <div className="fakta">
      {/*
        Ikon berada **di dalam** `dt`, bukan sebagai kolom grid tersendiri.
        Sebagai kolom, baris tanpa ikon akan kehilangan satu kolom dan labelnya
        bergeser ke kiri dibanding baris yang punya ikon — deretan label yang
        tidak rata membuat mata kehilangan garis baca.
      */}
      <dt className="fakta-label">
        {Ikon ? <Ikon size={14} strokeWidth={2} aria-hidden="true" /> : null}
        {label}
      </dt>
      <dd className="fakta-nilai">{children}</dd>
    </div>
  );
}

export function DaftarFakta({ children }: { children: ReactNode }) {
  return <dl className="daftar-fakta">{children}</dl>;
}
