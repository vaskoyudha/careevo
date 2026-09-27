"use client";

import Link from "next/link";
import { ArrowRight, MapPin, UserCheck } from "lucide-react";
import { monogram } from "@/lib/jobs/monogram";
import type { RekomendasiLokerItem } from "@/lib/jobs/rekomendasi-inbox";

import {
  verdictBadge,
  type VerdictLoker,
} from "@/components/features/jobs/cari-lowongan-ui";

export function KolomRekomendasiProfil({
  items,
  labelMinat,
  onBukaDetail,
}: {
  items: RekomendasiLokerItem[];
  labelMinat: string;
  onBukaDetail?: (url: string, verdict?: VerdictLoker | null) => void;
}) {
  return (
    <aside
      aria-label="Rekomendasi lowongan profil"
      className="w-full min-w-0 lg:w-[350px] xl:w-[380px] shrink-0 flex flex-col lg:h-full"
    >
      {/* Master Container: Semua kartu tersimpan rapi di dalam satu kontainer.
          Tinggi penuh HANYA di lg.

          `h-full` dulu berlaku di semua lebar, dan di mobile kolom ini
          ditumpuk DI ATAS daftar hasil yang tingginya 877 kartu. `height: 100%`
          karena itu menyelesaikan ke seluruh tinggi tumpukan itu, bukan ke
          tinggi kartunya sendiri: panel rekomendasi setinggi ~125.000px,
          daftar lowongan berdiri di dasar panel itu, dan seluruh isi halaman
          (kotak cari, ringkasan, hasil) terdorong ~156 layar ke bawah. Yang
          terlihat pengguna bukan halaman rusak, melainkan kartu putih kosong
          yang tidak berujung — persis "tidak responsif".

          Di `lg` kolomnya berdiri sendiri dan papan-nya dikunci setinggi
          viewport (lihat `.dashboard-shell:has(.loker-wide-layout)`), jadi
          `h-full` di sana memang yang membuat daftar rekomendasi punya
          scroll sendiri. */}
      <div className="rounded-[var(--radius-dock)] border border-slate-200/90 bg-white shadow-sm overflow-hidden flex flex-col lg:h-full">
        {/* Header with blue sky gradient - simplified version without dither effects */}
        <div className="relative h-[72px] shrink-0 overflow-hidden">
          {/* Blue sky gradient from top */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#8FC0F2] via-[#BAE6FD] to-[#DDEEFE]" />

          {/* Dot grid pattern as subtle texture */}
          <div className="absolute inset-0 bg-[size:3px_3px] [background-image:radial-gradient(rgba(10,61,98,0.12)_1px,transparent_1px)]" />

          {/* Isi pita. Tanpa `z-index`: `absolute inset-0` yang datang SESUDAH
              kedua lapisan latar sudah menggambarnya di atasnya, dan tautan
              "Ubah" yang menyusul setelahnya tetap duduk paling atas — jadi
              klaknya tidak terhalang lapisan ini. */}
          <div className="absolute inset-0 flex items-center gap-3 px-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/80 text-[#0a3d62] ring-1 ring-[#0a3d62]/15 shadow-xs">
              <UserCheck aria-hidden className="size-4" />
            </span>
            <h2 className="truncate text-[14.5px] font-bold tracking-tight text-[#0a3d62]">
              Cocok Untukmu
            </h2>
          </div>

          {/* Edit button with white background for better contrast */}
          <Link
            href="/onboarding?edit=1"
            className="pointer-fine:min-h-0 pointer-fine:min-w-0 absolute right-3 top-1/2 -translate-y-1/2 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-end gap-0.5 rounded-md bg-white px-2 text-[11.5px] font-semibold text-[#0056D2] shadow-[0_1px_2px_rgba(10,61,98,0.12)] transition-colors hover:bg-[#f7fbff]"
          >
            Ubah
            <ArrowRight aria-hidden className="size-3" />
          </Link>
        </div>

        {/* Lembar putih — satu lembar berujung membulat yang MENUMPUK header.

            Bukan resep baru: ini bentuk yang sama dengan `CatalogCourseCard`
            (`relative z-10 -mt-8 rounded-t-2xl bg-white`, DESIGN.md
            "Components and surfaces"), dengan tumpangan lebih kecil karena
            media di sini header 72px, bukan thumbnail 4:3.

            Keempat kelasnya satu paket, dan masing-masing bisa hilang tanpa
            satu pun gerbang repo gagal:

              - `rounded-t-2xl` — sudut membulatnya. 16px, sesuai lantai radius
                12-16px di DESIGN.md dan sama dengan kartu katalog.
              - `-mt-4` — tumpangannya 16px, sama dengan radiusnya. Ini yang
                membuat radiusnya BENAR-BENAR TERBACA: seluruh lengkung 16px
                menyingkap gradien biru di belakangnya, jadi mata membaca
                "lembar yang menimpa header". Tanpa negatif margin, radiusnya
                cuma membulat di atas latar putih kontainer — tak terlihat,
                alias kotak biasa lagi.
              - `bg-white` — menutup 16px header yang ditumpuknya.
              - `relative` + `z-10` — header di atasnya `relative` juga, jadi
                tanpa `z-10` lembar ini kalah urutan cat dan header menimpanya.

            `flex-1 min-h-0` melanjutkan peran kontainer: di `lg` lembar ini
            yang mengisi sisa tinggi papan, dan `min-h-0` yang mengizinkan
            daftar di dalamnya menggulir sendiri alih-alih memaksa lembar ikut
            setinggi isinya. */}
        <div className="relative z-10 -mt-4 flex flex-1 min-h-0 flex-col rounded-t-2xl bg-white">
          {/* Subtitle: anak pertama lembar, bukan div lepas di antara header dan
              daftar — kalau ia duduk di luar, `-mt-4` ikut mengangkatnya dan
              lembar berhenti memuat "Berdasarkan minat …". */}
          <div className="shrink-0 px-4 pt-2.5">
            <p className="text-[11.5px] leading-relaxed text-[#1e293b]">
              Berdasarkan minat:{" "}
              <strong className="font-semibold text-[#0a3d62]">
                {labelMinat}
              </strong>
            </p>
          </div>

          {/* Daftar Kartu di Dalam Kontainer.

              Di mobile daftarnya mendatar dan menggeser (snap), di `lg` kembali
              menjadi kolom yang menggeser ke bawah. Alasan yang pertama bukan
              estetika: kolom tegak berisi empat kartu setinggi ~500px berdiri
              tepat DI ATAS kotak pencarian, jadi di layar 375px pengguna harus
              menggulir lebih dari satu layar penuh sebelum bisa mengetik apa
              pun. Strip mendatar memakan ~200px, tetap menjangkau keempat kartu
              yang sama, dan tidak lagi menjadi gerbang ke pencarian.

              `overscroll-x-contain` mencegah geseran mendatar di ujung strip
              menyeret halaman; `snap-x` membuat tiap kartu berhenti rapi di tepi
              kiri. */}
          <div className="flex flex-row gap-2.5 px-4 pb-4 pt-2 snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-col lg:flex-1 lg:min-h-0 lg:overflow-x-visible lg:overflow-y-auto lg:snap-none">
            {items.map(({ job, persentaseCocok, minatCocok }) => {
              return (
                /* Tombol, bukan `<div onClick>`: kartu ini satu-satunya jalan
                   membuka detail rekomendasi, dan sebuah `<div>` tidak bisa
                   difokus keyboard maupun dibaca sebagai kontrol oleh pembaca
                   layar. Slot `KartuLokerInbox` sudah begitu sejak awal; ini
                   disamakan supaya dua kartu di halaman yang sama tidak
                   berperilaku beda. Isinya `<span>` ber-`block`, bukan
                   `<div>`/`<p>`/`<h3>`, karena `<button>` hanya menerima
                   phrasing content. */
                <button
                  key={job.url}
                  type="button"
                  onClick={() => onBukaDetail?.(job.url, verdictBadge(job))}
                  disabled={!onBukaDetail}
                  aria-label={`Lihat detail ${job.role} di ${job.company}`}
                  /* Permukaan kartu diambil dari `.dash-card` — resep tile bento,
                     jadi gradien `linear-gradient(170deg, …)`, token
                     `--dash-card-*`, dan lift bayangan saat hover semuanya sama
                     dengan tile dashboard. Gradiennya sengaja TIDAK ditulis ulang
                     sebagai `bg-linear-to-b` di sini: `globals.css` menyebut
                     terbuka bahwa tiga ramp yang disalin tangan adalah cara
                     birunya melenceng per kartu. Empat kartu ini memakai satu
                     resep, jadi panel ini tidak mungkin tertinggal satu shade dari
                     bento.

                     Ini sekaligus membuang apa yang tadinya bertabrakan dengan
                     resep. `bg-slate-50/60` dan `hover:bg-white` duduk DI BAWAH
                     `background-image`, jadi keduanya tidak akan terlihat;
                     `hover:shadow-xs` kalah dari `.dash-card:hover` (selektor
                     terlingkup 0-2-0 mengalahkan utility 0-1-0); dan
                     `transition-all` ditimpa transisi `box-shadow` milik resep.
                     Radiusnya sekarang 16px milik resep, bukan
                     `--radius-dock-inner` (14px).

                     `text-left` tetap: `.dash-card` tidak menetapkan
                     `text-align`, dan `<button>` memusatkan isinya secara
                     bawaan. */
                  className="dash-card group shrink-0 snap-start w-[76%] max-w-[19rem] text-left lg:w-auto lg:max-w-none cursor-pointer disabled:cursor-default"
                >
                  {/* Baris Atas: Monogram + Nama Perusahaan & Judul + Badge % */}
                  <span className="flex items-start justify-between gap-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        aria-hidden
                        className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-white text-[10.5px] font-bold text-[#0066ff] shadow-2xs"
                      >
                        {monogram(job.company)}
                      </span>
                      <span className="block min-w-0">
                        <span className="block truncate text-[11px] font-medium text-slate-500">
                          {job.company}
                        </span>
                        <span className="block truncate text-[13px] font-bold text-slate-900 group-hover:text-[#0066ff] transition-colors leading-snug">
                          {job.role}
                        </span>
                      </span>
                    </span>

                    <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200/60 tabular-nums">
                      {persentaseCocok}%
                    </span>
                  </span>

                  {/* Lokasi & Tag Minat

                      `text-slate-500`, bukan `text-slate-400` seperti
                      sebelumnya. Baris ini adalah teks paling redup di kartu,
                      dan gradien yang baru membuat dasar kartu turun ke
                      #e3effc — dua hal yang bersama-sama membuang kontras yang
                      tadinya sudah tipis. Baris 11px di kartu katalog sendiri
                      juga `text-gray-500`, jadi ini menyamakan, bukan memutus. */}
                  <span className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="truncate flex items-center gap-1">
                      <MapPin aria-hidden className="size-3 shrink-0" />
                      {job.location || "Lokasi fleksibel"}
                    </span>
                    <span className="shrink-0 text-[10px] font-medium text-slate-600 bg-white border border-slate-200/70 rounded px-1.5 py-0.5">
                      {minatCocok}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Footer Kontainer: `py-1.5` di mobile supaya target 44px tautannya
              sendiri yang menentukan tinggi baris (1.5 + 44 + 1.5), dan `py-3`
              seperti semula begitu penunjuknya presisi. */}
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-1.5 text-[11.5px] text-slate-500 shrink-0 mt-auto pointer-fine:py-3">
            <span>{items.length} peluang terbaik</span>
            <Link
              href="/onboarding?edit=1"
              className="inline-flex min-h-11 items-center font-medium text-[#0066ff] hover:underline pointer-fine:min-h-0"
            >
              Preferensi profil
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
