"use client";

import Link from "next/link";
import { ArrowRight, MapPin, UserCheck } from "lucide-react";
import { monogram } from "@/lib/jobs/monogram";
import type { RekomendasiLokerItem } from "@/lib/jobs/rekomendasi-inbox";
import { verdictBadge, type VerdictLoker } from "@/components/features/jobs/cari-lowongan-ui";

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
        {/* Header Kontainer */}
        <div className="p-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-[#0066ff]">
                <UserCheck aria-hidden className="size-4" />
              </span>
              <h2 className="text-[14.5px] font-bold text-slate-900 tracking-tight">
                Cocok Untukmu
              </h2>
            </div>
            <Link
              href="/onboarding?edit=1"
              /* `min-h-11` + `min-w-11` + `justify-end`: target sentuh 44x44px,
                 dengan teks tetap menempel ke tepi kanan seperti semula.
                 Tinggi baris header tidak ikut bertambah karena baris itu
                 diukur dari judul di sebelahnya, yang lebih tinggi. */
              className="inline-flex min-h-11 min-w-11 items-center justify-end gap-0.5 text-[11.5px] font-semibold text-[#0066ff] hover:underline pointer-fine:min-h-0 pointer-fine:min-w-0"
            >
              Ubah
              <ArrowRight aria-hidden className="size-3" />
            </Link>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-500">
            Berdasarkan minat: <strong className="text-slate-700 font-semibold">{labelMinat}</strong>
          </p>
        </div>

        {/* Daftar Kartu di Dalam Kontainer.

            Di mobile daftarnya mendatar dan menggeser (snap), di `lg` kembali
            menjadi kolom yang menggeser ke bawah. Alasan yang pertama bukan
            estetika: kolom tegak berisi empat kartu setinggi ~500px berdiri
            tepat DI ATAS kotak pencarian, jadi di layar 375px pengguna harus
            menggulir lebih dari satu layar penuh sebelum bisa mengetik apa pun
            — dan itu sebelum bug tinggi di atas ikut menghitung. Strip
            mendatar memakan ~200px, tetap menjangkau keempat kartu yang sama,
            dan tidak lagi menjadi gerbang ke pencarian.

            `overscroll-x-contain` mencegah geseran mendatar di ujung strip
            menyeret halaman; `snap-x` membuat tiap kartu berhenti rapi di tepi
            kiri. Keduanya pola yang sudah dipakai `.tag-row` dan
            `belajar-home.tsx` untuk strip yang sama. */}
        <div className="flex flex-row gap-2.5 p-3 snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-col lg:flex-1 lg:min-h-0 lg:overflow-x-visible lg:overflow-y-auto lg:snap-none">
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
                className="group relative flex flex-col shrink-0 snap-start w-[76%] max-w-[19rem] lg:w-auto lg:max-w-none rounded-[var(--radius-dock-inner)] border border-slate-100 bg-slate-50/60 p-3.5 text-left transition-all hover:bg-white hover:border-[#0066ff]/40 hover:shadow-xs cursor-pointer disabled:cursor-default"
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

                {/* Lokasi & Tag Minat */}
                <span className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-400">
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
    </aside>
  );
}
