"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  ExternalLink,
  GraduationCap,
  LayoutGrid,
  MapPin,
  Search,
  X,
} from "lucide-react";
import type { InboxJob } from "@/lib/career-ops";
import { filterInbox } from "@/lib/jobs/kueri-inbox";
import { monogram } from "@/lib/jobs/monogram";
import { Button } from "@/components/ui/button";

/**
 * Komponen bersama untuk pencarian lowongan dengan gaya kartu chat AI Mastery.
 *
 * Diujiplak dari `features/sijago/components/chat/home/` (AI Mastery):
 *   - `CapabilityConfigCard` — chrome kartu: `rounded-xl` + border rambut
 *     (`--border`/55) + bayangan berlapis `color-mix`.
 *   - `MasteryHandoffCard` — sigil bulat: ring `color-mix` primary + isian
 *     radial-gradient, mark monogram di tengahnya.
 *   - `ComposerInput` — composer: `rounded-xl` + border + shadow, fokus
 *     memunculkan ring primary, textarea transparan, tombol kirim bulat.
 *
 * Dipakai di dua permukaan: dashboard (`PapanLokerDashboard`) dan inbox
 * (`InboxList`). Yang dipindah adalah bahasanya, bukan logikanya — kartu di
 * sini merender baris hasil pindai, bukan payload tool dari backend AI Mastery.
 */

/**
 * Composer — kotak pertanyaan bergaya composer chat AI Mastery.
 *
 * Mengetik langsung menyaring; tombol kirim mencegah reload saja, karena
 * penyaringan sudah terjadi enquanto mengetik.
 *
 * Ikon kisi di dalam composer adalah jalan ke daftar lengkap: halaman ini
 * menampilkan hasil pencarian saja, jadi tanpa ikon ini ratusan lowongan tidak
 * akan pernah muncul. Angkanya ikut terbawa di pojok ikon — itu cara paling
 * murah untuk mengetahui ada yang terlewat sebelum menyaring.
 */
export function ComposerCariLowongan({
  kueri,
  onKueri,
  onBukaDaftar,
  jumlahTersedia,
}: {
  kueri: string;
  onKueri: (next: string) => void;
  onBukaDaftar: () => void;
  jumlahTersedia: number;
}) {
  const [kirim, setKirim] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setKirim(true);
        window.setTimeout(() => setKirim(false), 0);
      }}
      className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-2.5 shadow-[0_1px_2px_color-mix(in_srgb,var(--foreground)_5%,transparent),0_4px_14px_color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-shadow focus-within:border-[var(--primary)]/40 focus-within:shadow-[0_1px_2px_color-mix(in_srgb,var(--primary)_8%,transparent),0_4px_14px_color-mix(in_srgb,var(--primary)_8%,transparent)]"
    >
      <label htmlFor="composer-cari-lowongan" className="sr-only">
        Cari lowongan
      </label>
      <textarea
        id="composer-cari-lowongan"
        rows={1}
        value={kueri}
        onChange={(e) => onKueri(e.target.value)}
        placeholder="Coba: backend, Amartha, atau Jakarta…"
        className="w-full resize-none border-0 bg-transparent px-2 py-1.5 text-[15px] leading-relaxed text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
      />
      <div className="flex items-center justify-between gap-2 px-1 pt-1">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--background)]/60 px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)]">
          <Search className="size-3.5" aria-hidden />
          Cari lowongan
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="brand"
            size="icon"
            onClick={onBukaDaftar}
            aria-label={`Tampilkan daftar lengkap, ${jumlahTersedia} lowongan`}
            className="relative"
          >
            <LayoutGrid className="size-4" aria-hidden />
            {jumlahTersedia > 0 ? (
              <span className="absolute -top-1 -right-1 inline-flex min-w-4 items-center justify-center rounded-full bg-[var(--ocean-deep)] px-1 text-[9px] font-semibold text-white">
                {jumlahTersedia > 999 ? "999+" : jumlahTersedia}
              </span>
            ) : null}
          </Button>
          <Button type="submit" variant="brand" size="icon" aria-label="Cari lowongan">
            <ArrowUp className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
      {/* Satu live region untuk perubahan hasil, filter atau composer. */}
      <p aria-live="polite" className="sr-only">
        {kirim ? "Mencari" : ""}
      </p>
    </form>
  );
}

/**
 * Satu kartu lowongan, bergaya kartu chat AI Mastery.
 *
 * Header = sigil monogram + role + company (hairline border di bawah).
 * Footer = location + compensation, dengan pill verdict bila ada.
 *
 * **Kartu ini bukan `<a>`.** Membuat seluruh kartu sebuah link mustahil bila
 * panel `PersiapanLoker` ikut di dalamnya: sebuah `<button>` di dalam `<a>`
 * tidak bisa diaktifkan tanpa mengaktifkan link-nya juga, dan browser lalu
 * melompat ke lowongan saat learner sedang ingin melihat kursus. Jadi tautan ke
 * lowongan asli adalah `Buka` di header, dan seluruh kartu bisa berisi kontrol.
 */
export function KartuLokerInbox({
  job,
  verdict,
  onBukaDetail,
  jumlahKursus,
}: {
  job: InboxJob;
  verdict?:
    | { label: string; cls: string; title: string; status?: "clean" | "quarantined" | "rejected" }
    | null;
  onBukaDetail?: (url: string, status?: "clean" | "quarantined" | "rejected") => void;
  /** Berapa kursus yang cocok, dihitung server. 0 = tidak ada. */
  jumlahKursus?: number;
}) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-[var(--border)]/55 bg-[var(--card)] shadow-[0_1px_2px_color-mix(in_srgb,var(--foreground)_5%,transparent),0_4px_14px_color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors hover:border-[var(--primary)]/40">
      {/* SELURUH badan kartu adalah satu tombol yang membuka popup detail.
          Dulu hanya baris lokasi yang bisa diklik, dan itu yang membuat
          "klik kartunya tidak terjadi apa-apa" — sebagian besar kartu lowongan
          adalah header plus judul, bukan baris lokasi. Header, lokasi, dan
          verdict sekarang satu target klik.

          Bukan `<a>`: popup memanggil server action, dan tautan ke lowongan
          asli tetap ada sebagai "Buka" di footer. */}
      <button
        type="button"
        onClick={() => onBukaDetail?.(job.url, verdict?.status)}
        disabled={!onBukaDetail}
        aria-label={`Lihat detail ${job.role} di ${job.company}`}
        className="block w-full text-left transition-colors enabled:hover:bg-[color-mix(in_srgb,var(--primary)_5%,transparent)] disabled:cursor-default"
      >
        <span className="flex items-center gap-2.5 px-3.5 py-2.5">
          <span
            aria-hidden
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--primary)_22%,transparent)] bg-[radial-gradient(circle_at_30%_25%,color-mix(in_srgb,var(--primary)_14%,transparent),transparent_70%)] text-[11px] font-bold tracking-tight text-[var(--primary)]"
          >
            {monogram(job.company)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-semibold tracking-[0.005em] text-[var(--foreground)]">
              {job.role}
            </span>
            <span className="block truncate text-[11px] text-[var(--muted-foreground)]">
              {job.company}
            </span>
          </span>
          {verdict ? (
            <span
              className={`shrink-0 rounded-full px-2 py-[2px] text-[10px] font-semibold ${verdict.cls}`}
              title={verdict.title}
            >
              {verdict.label}
            </span>
          ) : null}
        </span>
        <span className="flex items-center gap-1.5 border-t border-[var(--border)]/35 px-3.5 py-2 text-[11px] text-[var(--muted-foreground)]">
          <MapPin className="size-3 shrink-0" aria-hidden />
          <span className="truncate">
            {[job.location, job.compensation].filter(Boolean).join(" · ") ||
              "Lokasi tidak disebutkan"}
          </span>
        </span>
      </button>

      <div className="flex items-center gap-1.5 px-3.5 py-2">
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Buka lowongan ${job.role} di ${job.company} di situs aslinya`}
          className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-2 py-[2px] text-[10px] font-semibold text-[var(--primary)] transition-opacity hover:opacity-80"
        >
          <ExternalLink className="size-3" aria-hidden />
          Buka
        </a>
        {onBukaDetail ? (
          <button
            type="button"
            onClick={() => onBukaDetail(job.url, verdict?.status)}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-[2px] text-[10px] font-semibold text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
          >
            Detail
          </button>
        ) : null}
        {jumlahKursus && jumlahKursus > 0 ? (
          <span
            title={`${jumlahKursus} kursus di katalog yang cocok`}
            className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-2 py-[2px] text-[10px] font-semibold text-[var(--primary)]"
          >
            <GraduationCap className="size-3" aria-hidden />
            {jumlahKursus} kursus
          </span>
        ) : null}
      </div>
    </article>
  );
}

/**
 * DaftarLokerLayarPenuh — seluruh lowongan sebagai lapisan layar penuh.
 *
 * Dipanggil dari ikon kisi di dalam composer. Halaman utama menampilkan
 * hasil pencarian saja, jadi di sinilah daftar lengkap diletakkan; tanpa ini
 * lowongan yang tidak cocok dengan kueri mana pun tidak punya jalan masuk.
 *
 * `showModal()` BUKAN `open` — itu inti dari komponen ini. Sebuah `<dialog>`
 * yang hanya diberi atribut `open` tetap elemen biasa: ia dipositioning dengan
 * CSS lalu ikut bersaing di z-index, dan di halaman ini ia kalah. Yang melompat
 * ke *top layer* browser — di atas segalanya, tanpa z-index yang perlu
 * ditawar dengannya — hanya `showModal()`. Sidebar dashboard ada di `z-index: 60`
 * dan topbar di `50`; dengan `open` saja keduanya menutupi lapisan ini, persis
 * seperti yang terjadi sebelum perbaikan ini.
 *
 * Top layer itu juga memberi dua hal yang di versi tulisan-tangan mudah
 * dilupakan: focus terjerat di dalam lapisan, dan Escape yang menutupnya.
 * Jadi `onCancel` (kita panggil `preventDefault` supaya React yang memutuskan
 * state) menggantikan listener `keydown` global.
 */
export function DaftarLokerLayarPenuh({
  baris,
  onTutup,
  renderVerdict,
  kueriAwal = "",
  onBukaDetail,
  jumlahKursusPerUrl,
}: {
  baris: InboxJob[];
  onTutup: () => void;
  renderVerdict?: (
    job: InboxJob,
  ) => { label: string; cls: string; title: string; status?: "clean" | "quarantined" | "rejected" } | null;
  /** Kueri dari composer halaman, jadi panel dibuka dalam konteks yang sama. */
  kueriAwal?: string;
  /** Jumlah kursus per posting, dihitung server. */
  jumlahKursusPerUrl?: Map<string, number>;
  onBukaDetail?: (url: string, status?: "clean" | "quarantined" | "rejected") => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [kueri, setKueri] = useState(kueriAwal);

  useEffect(() => {
    const el = dialogRef.current;
    if (el && !el.open) el.showModal();
  }, []);

  const adaKueri = kueri.trim().length > 0;
  const cocok = useMemo(
    () => (adaKueri ? filterInbox(baris, kueri) : baris),
    [baris, kueri, adaKueri],
  );

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="daftar-loker-judul"
      onCancel={(e) => {
        e.preventDefault();
        onTutup();
      }}
      onClick={(e) => {
        // Hanya klik pada latar lapisan itu sendiri yang menutup; klik di dalam
        // panel kartu akan membubble ke sini dan menutupnya tanpa sengaja.
        if (e.target === e.currentTarget) onTutup();
      }}
      className="m-auto max-h-[min(85dvh,900px)] w-[min(1180px,calc(100vw-2rem))] max-w-none overflow-hidden rounded-2xl border border-[var(--border)]/60 bg-[var(--card)] p-0 shadow-[0_24px_64px_color-mix(in_srgb,var(--foreground)_28%,transparent)] backdrop:bg-[color-mix(in_srgb,var(--foreground)_40%,transparent)] backdrop:backdrop-blur-sm"
    >
      <div className="flex max-h-[min(85dvh,900px)] flex-col">
        <header className="shrink-0 border-b border-[var(--border)]/60 bg-[var(--card)] px-5 py-3.5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2
                className="text-base font-bold text-[var(--foreground)]"
                id="daftar-loker-judul"
              >
                Semua lowongan
              </h2>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]" aria-live="polite">
                {adaKueri
                  ? `${cocok.length} dari ${baris.length} lowongan cocok`
                  : `${baris.length} lowongan hasil pindai`}
              </p>
            </div>
            <button
              type="button"
              onClick={onTutup}
              aria-label="Tutup daftar lowongan"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          {/* Saringan kedua di dalam panel. Tanpa ini membuka 214 lowongan hanya
              memindahkan masalah: yang muncul pertama tetap 214, dan menutup
              panel untuk kembali ke composer halaman adalah satu klik lebih
              banyak tanpa memfilter apa pun. */}
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)]/50 px-3 py-2 transition-colors focus-within:border-[var(--primary)]/50">
            <Search className="size-4 shrink-0 text-[var(--muted-foreground)]" aria-hidden />
            <input
              type="search"
              value={kueri}
              onChange={(e) => setKueri(e.target.value)}
              placeholder="Saring daftar ini…"
              aria-label="Saring daftar lowongan"
              className="w-full border-0 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
            />
            {adaKueri ? (
              <button
                type="button"
                onClick={() => setKueri("")}
                aria-label="Hapus saringan"
                className="shrink-0 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {cocok.length === 0 ? (
            <p className="py-16 text-center text-sm text-[var(--muted-foreground)]">
              {baris.length === 0
                ? "Belum ada lowongan hasil pindai."
                : `Tidak ada lowongan untuk "${kueri.trim()}".`}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {cocok.map((job) => (
                <KartuLokerInbox
                  key={job.url}
                  job={job}
                  verdict={renderVerdict?.(job)}
                  onBukaDetail={onBukaDetail}
                  jumlahKursus={jumlahKursusPerUrl?.get(job.url)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
