"use client";

import Link from "next/link";
import { ArrowRight, MapPin, Sparkles } from "lucide-react";
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
      className="w-full lg:w-[350px] xl:w-[380px] shrink-0 h-full flex flex-col"
    >
      {/* Master Container: Semua kartu tersimpan rapi di dalam satu kontainer dengan tinggi penuh */}
      <div className="rounded-[var(--radius-dock)] border border-slate-200/90 bg-white shadow-sm overflow-hidden flex flex-col h-full">
        {/* Header Kontainer */}
        <div className="p-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-[#0066ff]">
                <Sparkles aria-hidden className="size-4" />
              </span>
              <h2 className="text-[14.5px] font-bold text-slate-900 tracking-tight">
                Cocok Untukmu
              </h2>
            </div>
            <Link
              href="/onboarding?edit=1"
              className="text-[11.5px] font-semibold text-[#0066ff] hover:underline flex items-center gap-0.5"
            >
              Ubah
              <ArrowRight aria-hidden className="size-3" />
            </Link>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-500">
            Berdasarkan minat: <strong className="text-slate-700 font-semibold">{labelMinat}</strong>
          </p>
        </div>

        {/* Daftar Kartu di Dalam Kontainer */}
        <div className="p-3 flex flex-col gap-2.5 flex-1 min-h-0 overflow-y-auto">
          {items.map(({ job, persentaseCocok, minatCocok }) => {
            return (
              <div
                key={job.url}
                onClick={() => onBukaDetail?.(job.url, verdictBadge(job))}
                className="group relative flex flex-col rounded-[var(--radius-dock-inner)] border border-slate-100 bg-slate-50/60 p-3.5 transition-all hover:bg-white hover:border-[#0066ff]/40 hover:shadow-xs cursor-pointer"
              >
                {/* Baris Atas: Monogram + Nama Perusahaan & Judul + Badge % */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      aria-hidden
                      className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-white text-[10.5px] font-bold text-[#0066ff] shadow-2xs"
                    >
                      {monogram(job.company)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-medium text-slate-500">
                        {job.company}
                      </p>
                      <h3 className="truncate text-[13px] font-bold text-slate-900 group-hover:text-[#0066ff] transition-colors leading-snug">
                        {job.role}
                      </h3>
                    </div>
                  </div>

                  <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200/60 tabular-nums">
                    {persentaseCocok}%
                  </span>
                </div>

                {/* Lokasi & Tag Minat */}
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                  <span className="truncate flex items-center gap-1">
                    <MapPin aria-hidden className="size-3 shrink-0" />
                    {job.location || "Lokasi fleksibel"}
                  </span>
                  <span className="shrink-0 text-[10px] font-medium text-slate-600 bg-white border border-slate-200/70 rounded px-1.5 py-0.5">
                    {minatCocok}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Kontainer */}
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-[11.5px] text-slate-500 shrink-0 mt-auto">
          <span>{items.length} peluang terbaik</span>
          <Link href="/onboarding?edit=1" className="font-medium text-[#0066ff] hover:underline">
            Preferensi profil
          </Link>
        </div>
      </div>
    </aside>
  );
}
