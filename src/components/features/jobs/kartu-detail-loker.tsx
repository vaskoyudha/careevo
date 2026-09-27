"use client";

import Link from "next/link";
import { Briefcase, Building2, ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

/**
 * Kartu detail lowongan — UI yang sama dengan kartu incrementally di hero
 * `/loker`, sekarang jadi komponen yang dipakai dua kali.
 *
 * **Asalnya disalin-tempel dua kali di `vertex-kerja-view.tsx`**: sekali di
 * anchor tak terlihat yang mengukur tinggi natural, sekali di kartu yang
 * benar-benar terlihat. Keduanya harus tetap sinkron atau anchor salah
 * mengukur tinggi — dan perubahan satu tidak pernahanía menyentuh yang lain.
 * Diekstrak di sini supaya ada satu definisi, dan supaya popup inbox memakai
 * bahasa visual yang sama tanpa menyalin JSX lagi.
 *
 * ## Kenapa hampir semua field opsional
 *
 * Kartu ini duluan hanya untuk data fixture (`FEATURED_ROLES`), yang punya
 * `domainAge`, `fitScore`, `pipeline`, `activities` — semua angka UI
 * yang di-hardcode di file itu. Baris hasil pindai **tidak punya satu pun**
 * dari itu: tidak ada skor kecocokan yang dihitung, tidak ada jejak audit
 * Sentence, tidak ada umur domain yang bisa diverifikasi.
 *
 * Jadi field itu opsional, dan `null`-nya berarti **barisnya dihilangkan**,
 * bukan diisi placeholder. Menampilkan "Umur Domain —" atau "Fit Match AI 0%"
 * untuk lowongan yang tidak pernah di-audit adalah klaim yang lebih buruk
 * daripada tidak menampilkannya sama sekali.
 *
 * Yang benar-benar berasal dari data nyata dan selalu ada: peran, perusahaan,
 * lokasi, verdict Sentinel, dan deskripsi.
 */

export interface DetailLokerData {
  role: string;
  company: string;
  location?: string;
  /** Kategori tab di kartu bertumpuk — fixture saja. */
  tabLabel?: string;
  /** Warna diamond pada tab. Fixture saja. */
  diamondClassName?: string;

  /** Gaji. `undefined` = sumber lowongan tidak menyebutkannya. */
  salary?: string;
  /** Nama papan/ATS. Untuk baris pindai ini diturunkan dari host URL. */
  source?: string;
  /** Umur domain — hanya bisa diverifikasi untuk domain yang diaudit. */
  domainAge?: string;
  /** Kecocokan AI dalam persen — hanya dihitung untuk `/loker/[id]`. */
  fitScore?: number;

  status?: "clean" | "quarantined" | "rejected";
  /**
   * Label badge yang menggantikan nama status mentah.
   *
   * `StatusBadge` memetakan `quarantined → "KARANTINA"`. Tapi `auditBaris`
   * memakai nilai yang sama untuk lowongan yang gagal di-enrichment, jadi
   * badge itu menampilkan tuduhan pada lowongan yang belum pernah dibaca.
   * Popup yang tahu bedanya (`verdict.terperiksa`) jadi menyediakan label ini
   * — "Belum diperiksa" — dan `status` dipakai hanya untuk warnanya.
   */
  statusLabel?: string;
  description?: string;
  tags: string[];

  /** Langkah audit. Fixture saja. */
  pipeline?: Array<{ step: string; title: string; desc: string; passed: boolean }>;
  /** Jejak audit. Fixture saja. */
  activities?: Array<{ action: string; time: string }>;
  upcomingReview?: string;

  /** Rute internal. Fixture saja. */
  applyHref?: string;
  /** Tautan ke lowongan aslinya. */
  externalApplyUrl: string;
  /** Label tombol tautan luar — "KarirHub" untuk fixture. */
  externalLabel?: string;
}

export function KartuDetailLoker({
  data,
  onTabClick,
  tabActive,
}: {
  data: DetailLokerData;
  /** Header tab. Fixture saja — baris pindai tidak punya tab. */
  onTabClick?: () => void;
  tabActive?: boolean;
}) {
  const adaMetadata =
    data.salary || data.source || data.domainAge || data.fitScore !== undefined;

  return (
    <article className="overflow-hidden rounded-none border border-neutral-300 bg-white ring-1 ring-neutral-200/80">
      {data.tabLabel ? (
        <div
          onClick={onTabClick}
          className={cn(
            "flex h-11 items-center gap-x-2 border-b border-neutral-200 px-4 transition-colors select-none",
            tabActive === false && "cursor-pointer",
          )}
        >
          {data.diamondClassName ? (
            <span aria-hidden className={cn("size-2 shrink-0 rotate-45 rounded-[2px]", data.diamondClassName)} />
          ) : (
            <span aria-hidden className="size-2 shrink-0" />
          )}
          <span className="font-semibold text-neutral-900 text-xs sm:text-sm tracking-tight">
            {data.company}
          </span>
          <span className="text-neutral-300 text-sm">·</span>
          <span className="truncate text-neutral-600 text-xs sm:text-sm tracking-tight">
            {data.role}
            {data.location ? ` (${data.location})` : ""}
          </span>
          <span className="ml-auto text-[11px] font-medium text-neutral-400">{data.tabLabel}</span>
        </div>
      ) : null}

      <div className="grid grid-rows-[auto_auto] lg:grid-cols-[320px_1fr] lg:grid-rows-[auto_1fr] divide-y lg:divide-y-0 lg:divide-x divide-neutral-200 bg-white">
        {/* Kolom kiri: lowongan. */}
        <div className="relative flex flex-col p-6 sm:p-7 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex size-11 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-800 shadow-xs">
              <Building2 className="size-5 text-neutral-700" />
            </div>
            {data.status ? (
              <StatusBadge status={data.status} label={data.statusLabel} />
            ) : null}
          </div>

          <div className="mt-4">
            <h2 className="text-lg font-semibold text-neutral-900 tracking-tight leading-snug">
              {data.role}
            </h2>
            <p className="mt-1 text-sm font-medium text-neutral-500">
              {data.company}
              {data.location ? ` · ${data.location}` : ""}
            </p>
          </div>

          {/* Dua tombol aksi kartu ini aslinya 32px (`!h-8`).
              `pointer-coarse:!h-11` menaikkannya ke target sentuh 44px di
              perangkat sentuh mana pun, sementara `!h-8` tetap berlaku di
              desktop. Varian pointer, bukan `sm:` — tablet 768px yang dipegang
              tangan adalah `pointer: coarse` dan tetap butuh 44px, padahal
              `sm:` hanya melihat lebar layarnya. */}
          <div className="mt-4 flex flex-wrap gap-2">
            {data.applyHref ? (
              <Link
                href={data.applyHref}
                className="chrome-btn chrome-btn-brand pointer-coarse:!h-11 !h-8 pointer-coarse:!px-4 !px-3.5 !text-xs gap-1.5"
              >
                <Briefcase className="size-3.5" />
                <span>Lamar Loker</span>
              </Link>
            ) : null}
            <a
              href={data.externalApplyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="chrome-btn chrome-btn-white pointer-coarse:!h-11 !h-8 pointer-coarse:!px-4 !px-3.5 !text-xs gap-1.5"
            >
              <ExternalLink className="size-3.5 text-neutral-500" />
              <span>{data.externalLabel ?? "Buka lowongan"}</span>
            </a>
          </div>

          {adaMetadata ? (
            <div className="mt-6 border-t border-neutral-100 pt-5 space-y-2.5 text-xs">
              {data.salary ? (
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Rentang Gaji</span>
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    {data.salary}
                  </span>
                </div>
              ) : null}
              {data.source ? (
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Sumber Data</span>
                  <span className="font-medium text-neutral-700">{data.source}</span>
                </div>
              ) : null}
              {data.domainAge ? (
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Umur Domain</span>
                  <span className="font-medium text-neutral-700">{data.domainAge}</span>
                </div>
              ) : null}
              {data.fitScore !== undefined ? (
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Fit Match AI</span>
                  <span className="font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    {data.fitScore}% Cocok
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          {data.tags.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {data.tags.map((t) => (
                <span key={t} className="px-2 py-0.5 text-[11px]">
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* Kolom kanan: audit. */}
        <div className="flex flex-col p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-4">
            <div className="text-xs font-semibold uppercase tracking-wider">
              Hasil Audit Sentinel &amp; Evaluasi Kecocokan
            </div>
            {data.upcomingReview ? (
              <span className="text-xs text-neutral-400">{data.upcomingReview}</span>
            ) : null}
          </div>

          {data.description ? (
            <div className="mt-4">
              <p className="text-sm leading-relaxed text-neutral-700">{data.description}</p>
            </div>
          ) : null}

          {data.pipeline && data.pipeline.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
                Protokol Validasi Sentinel
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.pipeline.map((item) => (
                  <div
                    key={item.step}
                    className="rounded-lg border border-neutral-200/80 bg-neutral-50/60 p-3 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                          item.passed
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700",
                        )}
                      >
                        {item.passed ? "✓" : "!"}
                      </span>
                      <span className="font-semibold text-neutral-900">{item.title}</span>
                    </div>
                    <p className="mt-1 pl-7 text-neutral-500">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {data.activities && data.activities.length > 0 ? (
            <div className="mt-6 border-t border-neutral-100 pt-5">
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2.5">
                Jejak Audit Terakhir
              </h3>
              <div className="space-y-2 text-xs text-neutral-600">
                {data.activities.map((act, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-blue-500" />
                      <span>{act.action}</span>
                    </span>
                    <span className="text-neutral-400 shrink-0">{act.time}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
