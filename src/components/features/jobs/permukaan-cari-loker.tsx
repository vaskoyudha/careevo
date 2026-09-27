"use client";

import { type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpDown,
  Briefcase,
  ChevronDown,
  LayoutGrid,
  MapPin,
  Search,
  SlidersHorizontal,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { URUTAN, type NilaiUrutan } from "@/lib/jobs/faset-inbox";
import { cn } from "@/lib/utils";

/**
 * Format angka ribuan dengan pemisah titik (standar Indonesia)
 * Deterministic pada SSR dan Client, bebas hydration mismatch.
 */
export function formatAngka(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/* -------------------------------------------------------------- atoms ---- */

function KotakPilih({
  id,
  label,
  ikon: Ikon,
  nilai,
  onChange,
  pilihan,
  semuaLabel,
  className,
}: {
  id: string;
  label: string;
  ikon: React.ElementType;
  nilai: string;
  onChange: (next: string) => void;
  pilihan: readonly string[];
  semuaLabel: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Ikon
        aria-hidden
        strokeWidth={1.8}
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#0066ff]"
      />
      <select
        id={id}
        value={nilai}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white pr-9 pl-10 text-[13.5px] font-medium text-slate-800 transition-colors outline-none hover:border-slate-300 focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/20"
      >
        <option value="">{semuaLabel}</option>
        {pilihan.map((isi) => (
          <option key={isi} value={isi}>
            {isi}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        strokeWidth={1.8}
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400"
      />
    </div>
  );
}

function SelectPolos({
  id,
  label,
  nilai,
  onChange,
  pilihan,
  semuaLabel,
}: {
  id: string;
  label: string;
  nilai: string;
  onChange: (next: string) => void;
  pilihan: readonly { nilai: string; label: string }[];
  semuaLabel: string;
}) {
  return (
    <div className="relative inline-flex items-center">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={nilai}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 cursor-pointer appearance-none rounded-lg bg-transparent pr-5 pl-1 text-[13px] font-medium text-slate-600 transition-colors outline-none hover:text-slate-900 focus:ring-2 focus:ring-[#0066ff]/20"
      >
        <option value="">{semuaLabel}</option>
        {pilihan.map((item) => (
          <option key={item.nilai} value={item.nilai}>
            {item.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        strokeWidth={1.8}
        className="pointer-events-none absolute top-1/2 right-0.5 size-3.5 -translate-y-1/2 text-slate-400"
      />
    </div>
  );
}

/* -------------------------------------------------------------- header ---- */

/**
 * Catatan tangan dekoratif "Karier yang lebih baik dimulai di sini" + panah centang
 * Sesuai persis dengan gambar referensi di pojok kanan atas.
 */
function CatatanTanganDekoratif() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none relative hidden select-none md:flex flex-col items-end pr-2"
    >
      <div
        className="text-right text-[#0066ff] leading-tight font-medium"
        style={{
          fontFamily:
            "'Caveat', 'Patrick Hand', 'Dancing Script', 'Chilanka', 'Comic Neue', cursive, sans-serif",
          fontSize: "17px",
          transform: "rotate(-2deg)",
        }}
      >
        <div>Karier yang lebih baik</div>
        <div>dimulai di sini</div>
      </div>
      <svg
        viewBox="0 0 36 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="size-7 -mr-2 mt-0.5 text-[#0066ff]"
      >
        <path
          d="M6 14C10 18 13.5 22 15 24C17.5 19 24 10 32 4"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function KepalaCariLoker({ aksi }: { aksi?: ReactNode }) {
  return (
    <header className="relative mb-6 flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
      <div className="min-w-0 max-w-[62ch]">
        <p className="text-[12px] font-bold tracking-[0.14em] uppercase text-[#0066ff] mb-2">
          JOB SEEKER
        </p>
        <h1 className="text-[32px] sm:text-[38px] lg:text-[42px] font-bold tracking-tight text-[#0a2a3a] leading-[1.12]">
          Lowongan ditemukan
        </h1>
        <p className="mt-2.5 max-w-[54ch] text-[14.5px] leading-relaxed text-[#48606e]">
          Temukan pekerjaan impianmu dari ribuan lowongan terbaru yang sesuai dengan skill, minat,
          dan kariermu.
        </p>
      </div>

      <div className="flex items-center gap-3">
        {aksi ? <div className="shrink-0">{aksi}</div> : null}
        <CatatanTanganDekoratif />
      </div>
    </header>
  );
}

/* ---------------------------------------------------------- search card ---- */

export function PanelCariLoker({
  draft,
  onDraft,
  onCari,
  kota,
  onKota,
  kategori,
  onKategori,
  status,
  onStatus,
  urutan,
  onUrutan,
  pilihanStatus,
  pilihanKota,
  pilihanKategori,
  total,
  onBukaDaftar,
  refKueri,
}: {
  draft: string;
  onDraft: (next: string) => void;
  onCari: () => void;
  kota: string;
  onKota: (next: string) => void;
  kategori: string;
  onKategori: (next: string) => void;
  status: string;
  onStatus: (next: string) => void;
  urutan: NilaiUrutan;
  onUrutan: (next: NilaiUrutan) => void;
  pilihanStatus: readonly string[];
  pilihanKota: readonly string[];
  pilihanKategori: readonly string[];
  total: number;
  onBukaDaftar: () => void;
  refKueri: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <section
      aria-label="Cari lowongan"
      className="overflow-hidden rounded-[var(--radius-dock)] border border-slate-200/90 bg-white shadow-sm"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onCari();
        }}
        className="flex flex-col gap-2.5 p-3 sm:flex-row sm:items-center"
      >
        <div className="relative min-w-0 flex-1">
          <label htmlFor="cari-lowongan-teks" className="sr-only">
            Cari lowongan, posisi, perusahaan, atau lokasi
          </label>
          <Search
            aria-hidden
            strokeWidth={1.8}
            className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-[#0066ff]"
          />
          <input
            ref={refKueri}
            id="cari-lowongan-teks"
            type="search"
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            placeholder="Cari lowongan, posisi, perusahaan, atau lokasi…"
            className={cn(
              "h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 text-[13.5px] text-slate-800 placeholder:text-slate-400 transition-colors outline-none hover:border-slate-300 focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/20",
              draft.trim() ? "pr-11" : "pr-3.5"
            )}
          />
          {draft.trim() ? (
            <button
              type="submit"
              aria-label="Cari"
              title="Cari"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-lg bg-[#0066ff] hover:bg-[#0052cc] text-white shadow-xs transition-all cursor-pointer active:scale-90 animate-in fade-in zoom-in-95 duration-150"
            >
              <ArrowRight aria-hidden className="size-4" strokeWidth={2.4} />
            </button>
          ) : null}
        </div>

        <KotakPilih
          id="cari-lowongan-kota"
          label="Semua lokasi"
          ikon={MapPin}
          nilai={kota}
          onChange={onKota}
          pilihan={pilihanKota}
          semuaLabel="Semua Lokasi"
          className="sm:w-[190px]"
        />
        <KotakPilih
          id="cari-lowongan-kategori"
          label="Semua kategori"
          ikon={Briefcase}
          nilai={kategori}
          onChange={onKategori}
          pilihan={pilihanKategori}
          semuaLabel="Semua Kategori"
          className="sm:w-[200px]"
        />
      </form>

      {/* Row 2: Filter, Terbaru, dan Lihat Semua */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 px-4 py-2 text-xs">
        <div className="flex items-center gap-1.5 text-slate-600">
          <SlidersHorizontal aria-hidden strokeWidth={1.8} className="size-3.5 text-slate-500" />
          <SelectPolos
            id="cari-lowongan-status"
            label="Filter hasil menurut status audit Sentinel"
            nilai={status}
            onChange={onStatus}
            pilihan={pilihanStatus.map((lbl) => ({ nilai: lbl, label: lbl }))}
            semuaLabel="Filter"
          />
        </div>

        <span aria-hidden className="h-4 w-px bg-slate-200" />

        <div className="flex items-center gap-1.5 text-slate-600">
          <ArrowUpDown aria-hidden strokeWidth={1.8} className="size-3.5 text-slate-500" />
          <SelectPolos
            id="cari-lowongan-urutan"
            label="Urutkan hasil"
            nilai={urutan}
            onChange={(next) => onUrutan(next as NilaiUrutan)}
            pilihan={URUTAN.map((item) => ({ nilai: item.nilai, label: item.label }))}
            semuaLabel="Terbaru"
          />
        </div>

        <div className="ml-auto pr-0.5">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onBukaDaftar}
            aria-label={`Tampilkan daftar lengkap, ${total} lowongan`}
            className="h-7 gap-1 rounded-full text-[11px] text-slate-500 hover:text-slate-800"
          >
            <LayoutGrid aria-hidden className="size-3" />
            Semua
            <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-700 tabular-nums">
              {total}
            </span>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ stats bar ---- */

export function RingkasanLoker({
  total,
  baruHariIni,
  className,
}: {
  total: number;
  baruHariIni: number;
  className?: string;
}) {
  const displayTotal = formatAngka(total);
  const displayBaru = formatAngka(baruHariIni);

  return (
    <section
      aria-label="Ringkasan lowongan"
      className={cn(
        "grid grid-cols-1 divide-y divide-slate-100 rounded-[var(--radius-dock)] border border-slate-200/90 bg-white shadow-sm sm:grid-cols-2 sm:divide-x sm:divide-y-0",
        className
      )}
    >
      <div className="flex items-center gap-4.5 px-6 py-4">
        <span className="flex size-14 sm:size-16 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#0066ff]">
          <Briefcase aria-hidden strokeWidth={1.9} className="size-7 sm:size-8" />
        </span>
        <div className="min-w-0 flex flex-col justify-center">
          <div className="text-[28px] sm:text-[32px] leading-none font-bold tracking-tight text-[#0066ff] tabular-nums m-0 p-0">
            {displayTotal}
          </div>
          <div className="mt-1 text-[14px] sm:text-[15px] font-bold text-slate-900 leading-tight m-0 p-0">
            Lowongan tersedia
          </div>
          <div className="mt-0.5 text-[12px] sm:text-[12.5px] text-slate-500 leading-tight m-0 p-0">
            di berbagai bidang dan perusahaan
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4.5 px-6 py-4">
        <span className="flex size-14 sm:size-16 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#0066ff]">
          <Zap aria-hidden strokeWidth={1.9} className="size-7 sm:size-8 fill-[#0066ff]/20" />
        </span>
        <div className="min-w-0 flex flex-col justify-center">
          <div className="text-[28px] sm:text-[32px] leading-none font-bold tracking-tight text-[#0066ff] tabular-nums m-0 p-0">
            {displayBaru}
          </div>
          <div className="mt-1 text-[14px] sm:text-[15px] font-bold text-slate-900 leading-tight m-0 p-0">
            Lowongan baru hari ini
          </div>
          <div className="mt-0.5 text-[12px] sm:text-[12.5px] text-slate-500 leading-tight m-0 p-0">
            Jangan sampai ketinggalan!
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- empty state ---- */

/**
 * Ilustrasi persis seperti pada gambar referensi:
 * - Lembar dokumen putih berbingkai biru muda dengan garis-garis teks
 * - Kaca pembesar biru tebal yang tumpang tindih di kanan bawah
 * - Aksen percikan/kilau kecil di atas kaca pembesar
 * - Lingkaran latar belakang biru pastel yang lembut
 */
function IlustrasiPencarianKosong() {
  return (
    <div className="relative flex items-center justify-center size-36 mb-1">
      {/* Background soft circular / cloud aura */}
      <div className="absolute inset-0 rounded-full bg-blue-50/80 -scale-y-90 scale-x-110 filter blur-[1px]" />

      <svg
        viewBox="0 0 140 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative size-32"
      >
        {/* Document Body */}
        <rect
          x="38"
          y="28"
          width="52"
          height="66"
          rx="6"
          fill="#FFFFFF"
          stroke="#93C5FD"
          strokeWidth="3.5"
        />
        {/* Document Fold Corner Accent */}
        <path
          d="M74 28V38C74 40.2 75.8 42 78 42H90"
          stroke="#93C5FD"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Text Lines */}
        <line
          x1="48"
          y1="50"
          x2="72"
          y2="50"
          stroke="#BFDBFE"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <line
          x1="48"
          y1="62"
          x2="80"
          y2="62"
          stroke="#BFDBFE"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <line
          x1="48"
          y1="74"
          x2="66"
          y2="74"
          stroke="#BFDBFE"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Sparkle / Motion Rays above magnifying glass */}
        <line
          x1="98"
          y1="34"
          x2="104"
          y2="28"
          stroke="#0066FF"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <line
          x1="108"
          y1="44"
          x2="116"
          y2="42"
          stroke="#0066FF"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <line
          x1="94"
          y1="22"
          x2="94"
          y2="14"
          stroke="#0066FF"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Magnifying Glass Lens */}
        <circle
          cx="76"
          cy="74"
          r="19"
          fill="#FFFFFF"
          stroke="#0066FF"
          strokeWidth="6"
        />
        <circle cx="76" cy="74" r="13" fill="#EFF6FF" />

        {/* Lens Glare */}
        <path
          d="M70 65C73 63 78 63 82 66"
          stroke="#93C5FD"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Magnifying Glass Handle */}
        <path
          d="M90 88L108 106"
          stroke="#0066FF"
          strokeWidth="7"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export function KosongLoker({
  judul,
  children,
  aksi,
  className,
}: {
  judul: string;
  children: ReactNode;
  aksi?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-dock)] border border-slate-200/90 bg-white px-6 py-10 sm:py-12 text-center shadow-sm",
        className
      )}
    >
      <IlustrasiPencarianKosong />
      <h2 className="mt-3 text-[19px] sm:text-[21px] font-bold tracking-tight text-slate-900">
        {judul}
      </h2>
      <p className="mt-2 max-w-[48ch] text-[13.5px] sm:text-[14px] leading-relaxed text-slate-500">
        {children}
      </p>
      {aksi ? <div className="mt-5">{aksi}</div> : null}
    </section>
  );
}
