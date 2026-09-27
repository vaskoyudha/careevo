"use client";

import { CheckCircle2, CircleSlash, Flag, ShieldCheck } from "lucide-react";
import type { StatusPemeriksaan, VerdictLoker } from "@/components/features/jobs/cari-lowongan-ui";

/**
 * Laporan audit Sentinel untuk satu lowongan.
 *
 * ## Kenapa ini chart, bukan teks lagi
 *
 * Audit Sentinel bersifat deterministik dan mengembalikan `SentinelOutput`:
 * satu status, satu skor 0–100, dan daftar flag. Teks polos mampu menyatakan
 * "aman" tetapi TIDAK mampu menyatakan APA YANG diperiksa — dan "aman" tanpa
 * rekaman pemeriksaan adalah persis tuduhan yang tidak bisa dibuktikan. Jadi
 * yang digambar di sini adalah dua hal yang punya isi:
 *
 *   1. **Skor kepercayaan** sebagai donat. Satu-satunya angka kontinu yang
 *      dimiliki baris pindai, jadi satu-satunya yang layak jadi chart.
 *   2. **Rincian pemeriksaan** per aturan, dengan empat status.
 *
 * ## Kenapa empat status dan bukan dua
 *
 * "Lolos" / "flag" saja akan memaksa pemeriksaan yang TIDAK dijalankan
 * menyamar sebagai lulus. `unavailable` menyatakan apa adanya: papan lowongan
 * tidak menyediakan data itu, jadi aturannya memang tidak dijalankan. Dan
 * `netral` berbeda lagi — "tidak ada sinyal" bukan berarti "terverifikasi".
 * Ketiga pemisahan ini yang membuat laporan ini bisa dipercaya; hilangkan satu
 * dan checklist-nya berubah jadi klaim, bukan pengukuran.
 *
 * ## Tanpa library chart
 *
 * Repo ini tidak punya recharts/d3 dan tidak boleh menambahkannya hanya untuk
 * satu donat. `stroke-dasharray` pada satu `<circle>` memberi donat yang sama
 * dengan nol dependensi, dan tetap terbaca oleh pembaca layar lewat
 * `role="img"` + `aria-label`.
 *
 * ## Soal warna kontainer
 *
 * Birunya persis warna papan lowongan yang dipakai sekeliling — `#0056D2` untuk
 * judul, `#bfdbfe` untuk garis, `#eff6ff`/`#f7faff` untuk isian. Judul card di
 * atas memuat "HASIL AUDIT SENTINEL & EVALUASI KECOCOKAN" yang sudah berbiru,
 * jadi laporan ini memakai warna yang sama agar terbaca sebagai satu blok
 * laporan, bukan enam baris biru yang Верхов. Warna status (hijau/merah/abu)
 * TIDAK ikut biru — ia membawa arti, dan meanings tidak boleh Larut dalam dekor.
 */

/**
 * Warna + label tiap status. Satu sumber untuk checklist dan ringkasan chip.
 *
 * `kelas` dipecah jadi `teks` dan `chip`: bg dan teks tidak boleh berbagi satu
 * nilai, karena bg translucent di atas biru pucat berubah warnanya sendiri.
 */
const GAYA: Record<
  StatusPemeriksaan,
  { label: string; teks: string; chip: string; Ikon: typeof CheckCircle2 }
> = {
  lolos: {
    label: "Lolos",
    teks: "text-[var(--success)]",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-800",
    Ikon: CheckCircle2,
  },
  flag: {
    label: "Perlu ditinjau",
    teks: "text-[var(--danger)]",
    chip: "border-red-200 bg-red-50 text-red-800",
    Ikon: Flag,
  },
  netral: {
    label: "Tidak ada sinyal",
    teks: "text-neutral-500",
    chip: "border-neutral-200 bg-neutral-100 text-neutral-600",
    Ikon: ShieldCheck,
  },
  unavailable: {
    label: "Tidak dicek",
    teks: "text-neutral-400",
    chip: "border-dashed border-neutral-300 bg-transparent text-neutral-500",
    Ikon: CircleSlash,
  },
};

/**
 * Donat skor kepercayaan, digambar dengan `transform` pada `<g>` — bukan
 * `className="-rotate-90"` pada elemen SVG-nya.
 *
 * Tailwind memang mem-port `-rotate-90` ke `rotate` utility yang memutar
 * TENTANG titik asal CSS (`transform-origin: center`) memutar viewBox utuh
 * dan menggeser pusatnya dari (18,18); pada viewBox 36, itu menggeser lingkaran
 * keluar dari kotak. `transform="rotate(-90 18 18)"` yang eksplisit berpusat di
 * viewBox yang sama, dan tidak bisa salah asal.
 */
function DonatSkor({ skor }: { skor: number }) {
  const pct = Math.max(0, Math.min(100, skor));
  const warna = pct >= 90 ? "var(--success)" : pct >= 60 ? "var(--warning)" : "var(--danger)";

  return (
    <svg
      viewBox="0 0 36 36"
      className="size-[70px] shrink-0"
      role="img"
      aria-label={`Skor kepercayaan ${pct} dari 100`}
    >
      {/* Jalur. Bukan `var(--border)`: biru itu terlalu dingin untuk sebuah track, dan track
          gelap di atas biru pucat terbaca sebagai infrastruktur, bukan netral. */}
      <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#dbeafe" strokeWidth="3.5" />
      {/* `pathLength=100` → dasharray dibaca sebagai persen, tanpa maths busur. */}
      <g transform="rotate(-90 18 18)">
        <circle
          cx="18"
          cy="18"
          r="15.9155"
          fill="none"
          stroke={warna}
          strokeWidth="3.5"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${pct} ${100 - pct}`}
        />
      </g>
    </svg>
  );
}

/** Pita status kecil, untuk ringkasan di header. */
function ChipStatus({
  children,
  kelas,
  Ikon,
}: {
  children: React.ReactNode;
  kelas: string;
  Ikon: typeof CheckCircle2;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${kelas}`}
    >
      <Ikon className="size-3.5" strokeWidth={2.25} aria-hidden />
      {children}
    </span>
  );
}

export function LaporanSentinel({ verdict }: { verdict: VerdictLoker }) {
  // Baris yang belum pernah dibaca: TIDAK ada yang boleh digambar. Nol dari nol
  // adalah chart yang membuat lowongan yang tak pernah diaudit tampak sudah dinilai.
  if (!verdict.terperiksa || verdict.pemeriksaan.length === 0) return null;

  const skor = verdict.trustScore;
  const jumlahLolos = verdict.pemeriksaan.filter((p) => p.status === "lolos").length;
  const jumlahFlag = verdict.pemeriksaan.filter((p) => p.status === "flag").length;
  const jumlahTidakDicek = verdict.pemeriksaan.filter((p) => p.status === "unavailable").length;

  /* Satu kartu laporan: kontainer biru penuh, isinya dipisah-pisah oleh
     hairline. Pemisahan memakai `divide-y` (satu border di antara anak, bukan
     dua per anak) supaya garis tidak pernah dobel di sambungan. */
  return (
    <section
      aria-label="Laporan audit Sentinel"
      className="mt-4 overflow-hidden rounded-xl border border-[#bfdbfe] bg-gradient-to-b from-[#f7faff] to-[#eff6ff] shadow-[0_1px_2px_color-mix(in_srgb,#0a3d62_6%,transparent),0_8px_24px_-12px_color-mix(in_srgb,#0a3d62_22%,transparent)]"
    >
      {/* Header: skor besar di kiri, ringkasan jumlah di kanan. Pada mobile
         keduanya turun ke bawah — donat 70px + teks 200px sudah melebihi 320px. */}
      <header className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-4 sm:px-5">
        {skor !== undefined ? (
          <div className="relative flex shrink-0 items-center justify-center">
            <DonatSkor skor={skor} />
            {/* Angka di luar SVG, bukan `<text>`: supaya ia terbaca sebagai teks
                biasa, bisa disalin, dan mewarisi font/size dari surrounding. */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[19px] font-semibold leading-none tabular-nums text-[#0a3d62]">
                {skor}
              </span>
              <span className="mt-0.5 text-[10px] leading-none text-[#5b7a99]">/100</span>
            </div>
          </div>
        ) : null}

        <div className="min-w-[12rem] flex-1">
          <h4 className="text-[11px] font-semibold tracking-[0.08em] text-[#0056D2] uppercase">
            Ringkasan pemeriksaan
          </h4>
          <p className="mt-1 text-sm leading-relaxed text-[#0a3d62]">
            {jumlahFlag > 0 ? (
              <>
                <b className="font-semibold">{jumlahFlag}</b> pemeriksaan menemukan sinyal
                yang perlu dilihat.
              </>
            ) : (
              <>
                <b className="font-semibold">{jumlahLolos}</b> pemeriksaan lolos — tidak ada
                pola penipuan pada lowongan ini.
              </>
            )}
          </p>
          {/* Pita jumlah. "Tidak dicek" disebut eksplisit, bukan dibiarkan
              absen: baris yang hilang tanpa penjelasan dibaca sebagai lulus. */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {jumlahLolos > 0 ? (
              <ChipStatus kelas={GAYA.lolos.chip} Ikon={GAYA.lolos.Ikon}>
                {jumlahLolos} lolos
              </ChipStatus>
            ) : null}
            {jumlahFlag > 0 ? (
              <ChipStatus kelas={GAYA.flag.chip} Ikon={GAYA.flag.Ikon}>
                {jumlahFlag} perlu ditinjau
              </ChipStatus>
            ) : null}
            {jumlahTidakDicek > 0 ? (
              <ChipStatus kelas={GAYA.unavailable.chip} Ikon={GAYA.unavailable.Ikon}>
                {jumlahTidakDicek} tidak dicek
              </ChipStatus>
            ) : null}
          </div>
        </div>
      </header>

      {/* Rincian per aturan. Baris penuh (bukan inline icon+teks) supaya tiap
          pemeriksaan bisa dibaca sebagai satu blok, dan `divide-y` memberi
          garis pemisah yang rata tanpa jarak manual. */}
      <ul className="divide-y divide-[#bfdbfe]/60 border-t border-[#bfdbfe] bg-white/45">
        {verdict.pemeriksaan.map((p) => {
          const gaya = GAYA[p.status];
          const Ikon = gaya.Ikon;
          return (
            <li key={p.label} className="flex items-start gap-3 px-4 py-3 sm:px-5">
              {/* Ikon dalam kotak: aligns optical dengan baris teks dan
                  memberi "tombol" yang bisa dibaca tanpa warna. */}
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-md border bg-white ${gaya.teks} ${
                  p.status === "unavailable" ? "border-dashed border-neutral-300" : "border-current/25"
                }`}
                aria-hidden
              >
                <Ikon className="size-3.5" strokeWidth={2.25} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={`text-sm font-semibold ${
                      p.status === "unavailable" ? "text-neutral-400" : "text-[#0a3d62]"
                    }`}
                  >
                    {p.label}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-px text-[10px] font-semibold ${gaya.chip}`}
                  >
                    {gaya.label}
                  </span>
                </span>
                {p.catatan ? (
                  <span className="mt-1 block text-[11px] leading-relaxed text-[#4a6b8a]">
                    {p.catatan}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Footer: sekali lagi, modul ini tidak menilai, ia menghitung. */}
      <p className="border-t border-[#bfdbfe] bg-white/45 px-4 py-3 text-[11px] leading-relaxed text-[#4a6b8a] sm:px-5">
        Audit ini deterministik — aturannya dijalankan di server, bukan menilai lewat model. Skor
        adalah bahan pertimbangan, bukan tuduhan.
      </p>
    </section>
  );
}