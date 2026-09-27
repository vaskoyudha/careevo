"use client";

import { type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpDown,
  Briefcase,
  Building2,
  ChevronDown,
  LayoutGrid,
  MapPin,
  RefreshCw,
  ScanSearch,
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
  className,
}: {
  id: string;
  label: string;
  nilai: string;
  onChange: (next: string) => void;
  pilihan: readonly { nilai: string; label: string }[];
  semuaLabel: string;
  className?: string;
}) {
  return (
    <div className={cn("relative inline-flex items-center", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={nilai}
        onChange={(e) => onChange(e.target.value)}
        /* h-11 adalah default; hanya perangkat dengan penunjuk presisi (mouse)
           yang turun ke h-8. Dibalik begitu supaya ukuran target sentuh tidak
           pernah bergantung pada lebar viewport: tablet 768px yang dipegang
           tangan adalah `pointer: coarse` dan tetap butuh 44px, sedangkan
           aturan `sm:h-8` akan memberinya 32px hanya karena layarnya lebar.
           Sebaran audit mobile repo ini sudah mencatatnya ("auditing 768px as
           a mouse device would skip exactly the touch rules this sweep exists
           to check"), dan `globals.css` memakai `@media (pointer: coarse)`
           untuk alasan yang sama. */
        className="h-11 cursor-pointer appearance-none rounded-lg bg-transparent pr-6 pl-1 text-[13px] font-medium text-slate-600 transition-colors outline-none hover:text-slate-900 focus:ring-2 focus:ring-[#0066ff]/20 pointer-fine:h-8 pointer-fine:pr-5"
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
        className="pointer-events-none absolute top-1/2 right-1.5 size-3.5 -translate-y-1/2 text-slate-400 pointer-fine:right-0.5"
      />
    </div>
  );
}

/* --------------------------------------------------------- scan trigger ---- */

/**
 * Pemicu scan — **ikon saja**, dan tinggal di dalam baris kotak cari.
 *
 * `jalankanScanAction` (`src/actions/inbox.ts`) punya tepat satu pemanggil di
 * seluruh aplikasi, yaitu tombol ini: tidak ada cron, tidak ada scan saat
 * halaman dimuat. Karena itu tombolnya tidak boleh bersyarat — ia dirender
 * tanpa cabang apa pun, dan satu-satunya tempat ia muncul adalah di sini.
 *
 * Bentuknya ikon saja, jadi namanya **hanya** bisa datang dari `aria-label`:
 * sebuah tombol ikon tanpa nama aksesibel adalah tombol yang tidak bisa
 * dijelaskan ke pembaca layar, dan `title` memberi tooltip yang sama ke
 * pengguna tetikus. Label yang sama dipakai sebagai `aria-busy` — ikon yang
 * berputar tidak berarti apa-apa tanpa status itu.
 *
 * Ikonnya berganti, bukan berputar di tempat: `ScanSearch` saat diam (pindai
 * permintaan pengguna), `RefreshCw` yang berputar saat berjalan (pekerjaan
 * sedang berlangsung) — sehingga keadaan "sedang memindai" terlihat bahkan
 * ketika tombolnya dinonaktifkan.
 */
export function TombolPindai({
  pending,
  onPindai,
}: {
  pending: boolean;
  onPindai: () => void;
}) {
  const label = pending ? "Memindai…" : "Pindai lowongan baru";

  return (
    <Button
      type="button"
      variant="brand"
      size="icon-lg"
      disabled={pending}
      onClick={onPindai}
      aria-label={label}
      aria-busy={pending}
      title={label}
      className="size-11 shrink-0 rounded-xl shadow-sm"
    >
      {pending ? (
        <RefreshCw aria-hidden className="size-4 animate-spin" />
      ) : (
        <ScanSearch aria-hidden className="size-[18px]" strokeWidth={2.2} />
      )}
    </Button>
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
  perusahaan,
  onPerusahaan,
  status,
  onStatus,
  urutan,
  onUrutan,
  pilihanStatus,
  pilihanKota,
  pilihanKategori,
  pilihanPerusahaan,
  total,
  onBukaDaftar,
  refKueri,
  pending,
  onPindai,
}: {
  draft: string;
  onDraft: (next: string) => void;
  onCari: () => void;
  kota: string;
  onKota: (next: string) => void;
  kategori: string;
  onKategori: (next: string) => void;
  perusahaan: string;
  onPerusahaan: (next: string) => void;
  status: string;
  onStatus: (next: string) => void;
  urutan: NilaiUrutan;
  onUrutan: (next: NilaiUrutan) => void;
  pilihanStatus: readonly string[];
  pilihanKota: readonly string[];
  pilihanKategori: readonly string[];
  pilihanPerusahaan: readonly string[];
  total: number;
  onBukaDaftar: () => void;
  refKueri: React.RefObject<HTMLInputElement | null>;
  /** Keadaan scan yang sedang berjalan, untuk `TombolPindai`. */
  pending: boolean;
  onPindai: () => void;
}) {
  return (
    <section
      aria-label="Cari lowongan"
      className="overflow-hidden rounded-[var(--radius-dock)] border border-slate-200/90 bg-white shadow-sm"
    >
      {/* Baris 1: kotak teks + pemicu scan. Pemicunya berdampingan dengan
          input, bukan menggantung di header halaman, karena ia bekerja pada
          daftar yang sedang disaring di bawahnya. `flex-row` sejak lebar
          terkecil — di mobile pun keduanya muat: input `flex-1` dan tombol
          44px. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onCari();
        }}
        className="flex flex-col gap-2.5 p-3 sm:flex-row sm:flex-wrap sm:items-center"
      >
        <div className="flex min-w-0 flex-1 gap-2 sm:basis-full xl:basis-0 xl:min-w-[13rem]">
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
                className="absolute right-1.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg bg-[#0066ff] text-white shadow-xs transition-all cursor-pointer hover:bg-[#0052cc] active:scale-90 pointer-fine:size-8 animate-in fade-in zoom-in-95 duration-150"
              >
                <ArrowRight aria-hidden className="size-4" strokeWidth={2.4} />
              </button>
            ) : null}
          </div>

          <TombolPindai pending={pending} onPindai={onPindai} />
        </div>

        <KotakPilih
          id="cari-lowongan-kota"
          label="Semua lokasi"
          ikon={MapPin}
          nilai={kota}
          onChange={onKota}
          pilihan={pilihanKota}
          semuaLabel="Semua Lokasi"
          className="sm:flex-1 sm:min-w-[10.5rem] xl:flex-none xl:w-[190px]"
        />
        <KotakPilih
          id="cari-lowongan-kategori"
          label="Semua kategori"
          ikon={Briefcase}
          nilai={kategori}
          onChange={onKategori}
          pilihan={pilihanKategori}
          semuaLabel="Semua Kategori"
          className="sm:flex-1 sm:min-w-[10.5rem] xl:flex-none xl:w-[200px]"
        />
        <KotakPilih
          id="cari-lowongan-perusahaan"
          label="Semua perusahaan"
          ikon={Building2}
          nilai={perusahaan}
          onChange={onPerusahaan}
          pilihan={pilihanPerusahaan}
          semuaLabel="Semua Perusahaan"
          className="sm:flex-1 sm:min-w-[10.5rem] xl:flex-none xl:w-[200px]"
        />
      </form>

      {/* Row 2: Filter, Terbaru, dan Lihat Semua.

          Di mobile baris ini tumbuh dua tinggi: pilihan-pilihan mengisi baris
          pertama (masing-masing `flex-1`, jadi keduanya berbagi lebar secara
          merata) dan tombol "Semua" turun ke baris kedua selebar kartu — bukan
          dipaksa sebaris dengan dua select 44px yang sudah menghabiskan ruang.
          Dari `sm` ke atas semuanya kembali sebaris seperti semula. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-100 px-4 py-2 text-xs">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-slate-600 sm:flex-none">
          <SlidersHorizontal aria-hidden strokeWidth={1.8} className="size-3.5 shrink-0 text-slate-500" />
          <SelectPolos
            id="cari-lowongan-status"
            label="Filter hasil menurut status audit Sentinel"
            nilai={status}
            onChange={onStatus}
            pilihan={pilihanStatus.map((lbl) => ({ nilai: lbl, label: lbl }))}
            semuaLabel="Filter"
            className="min-w-0 flex-1 sm:flex-none"
          />
        </div>

        <span aria-hidden className="hidden h-4 w-px bg-slate-200 sm:block" />

        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-slate-600 sm:flex-none">
          <ArrowUpDown aria-hidden strokeWidth={1.8} className="size-3.5 shrink-0 text-slate-500" />
          <SelectPolos
            id="cari-lowongan-urutan"
            label="Urutkan hasil"
            nilai={urutan}
            onChange={(next) => onUrutan(next as NilaiUrutan)}
            pilihan={URUTAN.map((item) => ({ nilai: item.nilai, label: item.label }))}
            semuaLabel="Terbaru"
            className="min-w-0 flex-1 sm:flex-none"
          />
        </div>

        <div className="w-full sm:ml-auto sm:w-auto sm:pr-0.5">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onBukaDaftar}
            aria-label={`Tampilkan daftar lengkap, ${total} lowongan`}
            className="h-11 w-full justify-center gap-1 rounded-full text-[11px] text-slate-500 hover:text-slate-800 pointer-fine:h-7 sm:w-auto pointer-fine:px-2"
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
  jumlahPerusahaan,
  className,
}: {
  total: number;
  baruHariIni: number;
  /** Berapa perusahaan berbeda yang membuka lowongan, bukan jumlah lowongan. */
  jumlahPerusahaan: number;
  className?: string;
}) {
  const displayTotal = formatAngka(total);
  const displayBaru = formatAngka(baruHariIni);
  const displayPerusahaan = formatAngka(jumlahPerusahaan);

  return (
    <section
      aria-label="Ringkasan lowongan"
      /* Di mobile ketiga angka tampil sebagai satu baris padat, bukan tiga
         blok bertumpuk: sebelumnya tiap blok memakai `px-6 py-4` dengan ikon
         56px dan angka 28px, jadi totalnya ~700px tinggi — satu layar penuh
         hanya untuk tiga angka, tepat di antara kotak cari dan daftar hasil.
         Di `sm` ke atas resep aslinya kembali utuh. */
      className={cn(
        "grid grid-cols-1 divide-y divide-slate-100 rounded-[var(--radius-dock)] border border-slate-200/90 bg-white shadow-sm xl:grid-cols-3 xl:divide-x xl:divide-y-0",
        className
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3 sm:gap-4.5 sm:px-6 sm:py-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0066ff] sm:size-16 sm:rounded-2xl">
          <Briefcase aria-hidden strokeWidth={1.9} className="size-5 sm:size-8" />
        </span>
        <div className="min-w-0 flex flex-col justify-center">
          <div className="text-[22px] sm:text-[32px] leading-none font-bold tracking-tight text-[#0066ff] tabular-nums m-0 p-0">
            {displayTotal}
          </div>
          <div className="mt-1 text-[13px] sm:text-[15px] font-bold text-slate-900 leading-tight m-0 p-0">
            Lowongan tersedia
          </div>
          <div className="mt-0.5 text-[12px] sm:text-[12.5px] text-slate-500 leading-tight m-0 p-0">
            di berbagai bidang dan perusahaan
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 py-3 sm:gap-4.5 sm:px-6 sm:py-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0066ff] sm:size-16 sm:rounded-2xl">
          <Zap aria-hidden strokeWidth={1.9} className="size-5 sm:size-8 fill-[#0066ff]/20" />
        </span>
        <div className="min-w-0 flex flex-col justify-center">
          <div className="text-[22px] sm:text-[32px] leading-none font-bold tracking-tight text-[#0066ff] tabular-nums m-0 p-0">
            {displayBaru}
          </div>
          <div className="mt-1 text-[13px] sm:text-[15px] font-bold text-slate-900 leading-tight m-0 p-0">
            Lowongan baru hari ini
          </div>
          <div className="mt-0.5 text-[12px] sm:text-[12.5px] text-slate-500 leading-tight m-0 p-0">
            Jangan sampai ketinggalan!
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 py-3 sm:gap-4.5 sm:px-6 sm:py-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0066ff] sm:size-16 sm:rounded-2xl">
          <Building2 aria-hidden strokeWidth={1.9} className="size-5 sm:size-8" />
        </span>
        <div className="min-w-0 flex flex-col justify-center">
          <div className="text-[22px] sm:text-[32px] leading-none font-bold tracking-tight text-[#0066ff] tabular-nums m-0 p-0">
            {displayPerusahaan}
          </div>
          <div className="mt-1 text-[13px] sm:text-[15px] font-bold text-slate-900 leading-tight m-0 p-0">
            Perusahaan
          </div>
          <div className="mt-0.5 text-[12px] sm:text-[12.5px] text-slate-500 leading-tight m-0 p-0">
            sedang membuka lowongan
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
