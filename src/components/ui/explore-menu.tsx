"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Briefcase,
  ChevronDown,
  Compass,
  Search,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "./icons";
import {
  EXPLORE_FACETS,
  FASET_AWAL,
  TOTAL_PROGRAM,
  cariFaset,
  cariItem,
  type ExploreFacetKey,
} from "@/lib/courses/explore-facets";
import { onScrollFrame } from "@/lib/scroll/scroll-frame";

/**
 * Ikon per faset — empat glyph yang benar-benar berbeda bentuk.
 *
 * Menu Coursera memakai heksagon untuk C, C++, dan C#, jadi tiga baris
 * yang terlihat sama untuk tiga hal berbeda. Empat ikon yang satu
 * bentuknya cuma satu yang tidak bisa dipakai.
 */
const IKON_FASET: Record<ExploreFacetKey, LucideIcon> = {
  peran: Briefcase,
  keterampilan: Sparkles,
  bidang: Compass,
  sertifikat: ShieldCheck,
};

/** Jeda sebelum menutup, supaya pointer boleh lintas celah 8px. */
const JEDA_TUTUP_MS = 180;

/**
 * Panel Explore: rail faset + satu pane isi + pencarian.
 *
 * Bentuknya mengikuti mega-menu dua level, tapi isi dan keputusannya
 * semuanya lokal:
 *
 * - Tiap baris rail adalah `<Link>` ke halaman penuh faset itu, bukan
 *   pane hover. Pane hover hanya bisa dibuka tetikus; link bisa di-Tab,
 *   dibaca pembaca layar, dan di-crawl.
 * - Tiap itemiau jumlah programnya, jadi panel tidak pernah bisa
 *   mengarahkan orang ke halaman yang isinya "Belum ada program".
 * - Teks panel berbahasa Indonesia; nama peran, skill, dan bidang tetap
 *   bahasa Inggris karena itu nama yang dipakai di pasar.
 *
 * Pola aksesibilitas: disclosure navigation (bukan menubar). Trigger
 * `aria-expanded` + `aria-controls`; panel contains link dalam urutan
 * Tab biasa; `Escape` menutup dan mengembalikan fokus. Tidak ada roving
 * tabindex karena isinya link, bukan item menu.
 */
export function ExploreMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [panelTop, setPanelTop] = useState<number | null>(null);
  const [faset, setFaset] = useState<ExploreFacetKey>(FASET_AWAL);
  const [query, setQuery] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const panelId = useId();
  const aktif = cariFaset(faset);
  const hasilCari = cariItem(query);
  const modeCari = query.trim().length > 0;

  const clearCloseTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  /**
   * Panel di-portal ke `<body>` dan dipin ke viewport, jadi hanya
   * anchor vertikalnya yang diukur: panel menggantung 8px di bawah
   * trigger, yang ikut turun begitu chrome berubah jadi pil kaca.
   *
   * Sumbu horizontal TIDAK diukur dari sini — `.explore-mega-menu` di
   * `globals.css` yang memegang kotak dan pusatnya, supaya kartu tidak
   * pernah menempel ikut lebar bar transparan.
   */
  const measurePanel = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    setPanelTop(Math.round(btn.getBoundingClientRect().bottom + 8));
  }, []);

  const open = useCallback(
    (opts?: { fokus?: boolean }) => {
      clearCloseTimeout();
      measurePanel();
      setIsOpen(true);
      if (opts?.fokus) {
        // Fokus baru boleh masuk setelah panel benar-benar ada di DOM.
        window.requestAnimationFrame(() => searchRef.current?.focus());
      }
    },
    [clearCloseTimeout, measurePanel],
  );

  const scheduleClose = useCallback(() => {
    clearCloseTimeout();
    timeoutRef.current = setTimeout(() => setIsOpen(false), JEDA_TUTUP_MS);
  }, [clearCloseTimeout]);

  const closeImmediately = useCallback(
    (opts?: { kembali?: boolean }) => {
      clearCloseTimeout();
      setIsOpen(false);
      if (opts?.kembali) buttonRef.current?.focus();
    },
    [clearCloseTimeout],
  );

  useEffect(() => {
    return () => {
      clearCloseTimeout();
    };
  }, [clearCloseTimeout]);

  // Tutup saat klik/tap di luar trigger maupun panel. Panel ada di
  // portal, jadi "di luar" berarti di luar KEDUA — kalau hanya trigger
  // yang dicek, setiap klik di dalam menu terbaca sebagai luar.
  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      closeImmediately();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      closeImmediately({ kembali: true });
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, closeImmediately]);

  // Chrome-nya sticky dan berganti antara `.is-top` dan `.is-scrolled`,
  // jadi kotak yang diukur saat buka cepat basi.
  useEffect(() => {
    if (!isOpen) return;
    // `measurePanel` reads `getBoundingClientRect()`. Coalesced to one read
    // per frame — see `src/lib/scroll/scroll-frame.ts`.
    return onScrollFrame(measurePanel);
  }, [isOpen, measurePanel]);

  const pilihFaset = useCallback((key: ExploreFacetKey) => {
    setFaset(key);
    setQuery("");
  }, []);

  return (
    <div
      ref={containerRef}
      className="static"
      onPointerEnter={(e) => {
        // Hanya mouse/trackpad yang membuka lewat hover. Di layar
        // sentuh `pointerenter` tetap menyala sebelum `click`, jadi
        // tanpa gerbang ini satu ketukan akan membuka panel lalu
        // langsung menutupnya lagi di `onClick` — menu tidak akan
        // pernah muncul di HP.
        if (e.pointerType !== "mouse") return;
        open();
      }}
      onPointerLeave={scheduleClose}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          // BUKAN toggle. Mouse sudah membuka lewat hover, jadi kalau
          // `click` ikut menutup, klik tetikus membuka lalu menutup
          // dalam satu gestur dan hasilnya "tidak terjadi apa-apa".
          // `pointerType` tidak menolong di sini: peramban non-sentuh
          // melaporkan `mouse` di viewport sekecil apa pun, termasuk
          // jendela sempit dan hibrida sentuh-tetikus.
          //
          // Jadi `click` hanya membuka kalau belum terbuka. Menutup
          // diurus `Escape`, klik di luar, dan `pointerleave` — bukan
          // klik pada trigger yang sudah terbuka.
          if (!isOpen) open();
        }}
        onKeyDown={(e) => {
          if (e.key !== "ArrowDown") return;
          e.preventDefault();
          open({ fokus: true });
        }}
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        aria-label="Jelajahi katalog"
        className={`nav-item cursor-pointer ${isOpen ? "is-active" : ""}`}
      >
        <Compass size={15} strokeWidth={1.5} className="shrink-0" aria-hidden="true" />
        <span>Explore</span>
        <ChevronDown
          size={12}
          strokeWidth={1.5}
          aria-hidden="true"
          className={`shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen &&
        panelTop !== null &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            style={{ top: panelTop, maxHeight: `calc(100dvh - ${panelTop}px - 16px)` }}
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse") open();
            }}
            onPointerLeave={scheduleClose}
            className="explore-mega-menu fixed z-[80] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2),0_10px_20px_-5px_rgba(0,0,0,0.08)] [-ms-overflow-style:none] [scrollbar-width:thin]"
          >
            {/* Pencarian dulu, sebelum rail. Enam program terlalu sedikit
                untuk dipindai 35 tautan, tapi cukup banyak untuk dicari.
                Rail menjawab "yang mana", kolom ini menjawab "yang itu". */}
            <div className="border-b border-border px-4 py-3 sm:px-5">
              <label className="relative block">
                <span className="sr-only">Cari skill, bidang, atau peran</span>
                <Search
                  size={15}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-tertiary"
                />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowDown") return;
                    e.preventDefault();
                    panelRef.current
                      ?.querySelector<HTMLElement>('[data-jejak="1"]')
                      ?.focus();
                  }}
                  placeholder="Cari skill, bidang, atau peran"
                  className="h-9 w-full rounded-lg border border-border bg-background pr-3 pl-9 text-sm text-foreground outline-none placeholder:text-text-tertiary focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
              </label>
            </div>

            <div className="flex flex-col lg:flex-row">
              {/* Rail: empat faset yang saling lepas. Hover dan fokus
                  menyalakan pane; kliknya tetap navigating ke halaman
                  penuh faset itu. */}
              <nav
                aria-label="Faset katalog"
                className="flex shrink-0 gap-1 overflow-x-auto border-b border-border p-2 lg:w-60 lg:flex-col lg:overflow-x-visible lg:border-r lg:border-b-0"
              >
                {EXPLORE_FACETS.map((f) => {
                  const Ikon = IKON_FASET[f.key];
                  const selected = f.key === faset;
                  return (
                    <Link
                      key={f.key}
                      href={f.href}
                      onClick={() => closeImmediately()}
                      onPointerEnter={() => {
                        if (modeCari) return;
                        pilihFaset(f.key);
                      }}
                      onFocus={() => {
                        if (modeCari) return;
                        pilihFaset(f.key);
                      }}
                      aria-current={selected ? "true" : undefined}
                      className={`flex min-w-max shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors lg:w-full ${
                        selected
                          ? "bg-ocean-deep/8 font-semibold text-ocean-deep"
                          : "text-foreground hover:bg-accent"
                      }`}
                    >
                      <Ikon size={15} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
                      <span className="flex-1 truncate">{f.label}</span>
                      <span
                        aria-hidden="true"
                        className="text-[11px] font-medium text-text-tertiary tabular-nums"
                      >
                        {f.items.length}
                      </span>
                    </Link>
                  );
                })}
              </nav>

              {/* Lebar pane dikunci di `lg` ke atas.

                  Panel memakai `width: max-content`, jadi tanpa kuncian
                  ini lebar kartu ikut ditentukan isi facet yang sedang
                  tampil — pindah facade jadi mengubah ukuran kartu.

                  Itu bukan cuma soal tampilan. Panel dipusatkan dengan
                  `left: 0; right: 0; margin-inline: auto`, jadi saat
                  lebar berubah, kartu ikut bergeser, rail keluar dari
                  bawah kursor, `pointerleave` menyala, dan panel menutup
                  sendiri di tengah kamu pindah facet.

                  Lebar tetap berarti tidak ada yang bergeser. Di bawah
                  `lg` panel sudah terkunci ke lebar viewport, jadi
                  sana juga tidak ada yang bisa loncat. */}
              <div className="min-w-0 flex-1 p-4 sm:p-5 lg:w-[700px] lg:shrink-0">
                {modeCari ? (
                  <section aria-label="Hasil pencarian">
                    <h2 className="mb-3 text-sm font-semibold text-foreground">
                      {hasilCari.length > 0
                        ? `${hasilCari.length} cocok untuk "${query.trim()}"`
                        : `Tidak ada yang cocok untuk "${query.trim()}"`}
                    </h2>
                    {hasilCari.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
                        <p className="text-sm text-text-secondary">
                          Katalog Careevo baru {TOTAL_PROGRAM} program. Coba kata kunci
                          yang lebih umum.
                        </p>
                        <Link
                          href={aktif.href}
                          onClick={() => closeImmediately()}
                          className="mt-3 inline-block text-sm font-medium text-ocean-deep underline underline-offset-2"
                        >
                          Lihat semua {aktif.label.toLowerCase()}
                        </Link>
                      </div>
                    ) : (
                      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {hasilCari.map((item) => (
                          <li key={`${item.facet}-${item.href}`}>
                            <Link
                              href={item.href}
                              onClick={() => closeImmediately()}
                              className="flex h-full items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:border-primary hover:bg-accent"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-foreground">
                                  {item.label}
                                </span>
                                <span className="block text-[11px] text-text-tertiary">
                                  {item.facetLabel}
                                </span>
                              </span>
                              <span className="shrink-0 text-[11px] text-text-tertiary tabular-nums">
                                {item.jumlah}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ) : (
                  <section aria-label={aktif.label}>
                    <h2 className="text-base font-semibold text-foreground">{aktif.label}</h2>
                    {/* `min-h` dua baris: kalimat `ringkas` tiap faset
                        punya panjang berbeda, jadi tanpa ini satu baris
                        dan panel ikut memendek. */}
                    <p className="mt-1 mb-4 min-h-10 max-w-prose text-sm text-text-secondary">
                      {aktif.ringkas}
                    </p>
                    {/* `min-h` ini demi tinggi yang sama: jumlah item per
                        facet berbeda (6/8/6/3), jadi tanpa ini tinggi kartu
                        ikut melompat saat pindah facet.

                        `content-start` itu wajib, bukan hiasan: tanpa itu
                        grid meregangkan barisnya sampai mengisi `min-h`,
                        jadi tiga kartu satu baris jadi kotak setinggi
                        142px dengan label melayang di tengah. Dengan
                        `content-start` ruang ekstra mengendap di bawah
                        baris dan kartu tetap rapat.

                        Angkanya ikut tinggi baris: 4 baris @2 kolom
                        (192px), 3 baris @3 kolom (142px). */}
                    <ul className="grid content-start grid-cols-1 gap-2 sm:grid-cols-2 lg:min-h-[192px] xl:grid-cols-3 xl:min-h-[142px]">
                      {aktif.items.map((item, i) => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => closeImmediately()}
                            data-jejak={i === 0 ? "1" : undefined}
                            className="flex h-full items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:border-primary hover:bg-accent"
                          >
                            <span className="min-w-0 truncate text-foreground">
                              {item.label}
                            </span>
                            <span className="shrink-0 text-[11px] text-text-tertiary tabular-nums">
                              {item.jumlah}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4">
                      <Link
                        href={aktif.href}
                        onClick={() => closeImmediately()}
                        className="text-sm font-medium text-ocean-deep underline underline-offset-2 hover:no-underline"
                      >
                        Lihat semua {aktif.label.toLowerCase()}
                      </Link>
                      {/* Selalu dirender, termasuk saat `tanpaIsi === 0`.
                          Kalau baris ini hilang saat tidak ada yang kosong,
                          tinggi panel ikut turun dan kartunya melompat
                          saat pindah facet — dan "semua pilihan punya
                          program" memang kabar yang berguna. */}
                      <p className="text-xs text-text-tertiary">
                        {aktif.tanpaIsi > 0
                          ? `${aktif.tanpaIsi} pilihan lain belum ada program`
                          : "Semua pilihan sudah ada programnya"}
                      </p>
                    </div>
                  </section>
                )}

                {/* CTA untuk yang belum yakin — tempatnya sama dengan
                    Coursera, tapi isinya Careevo: `/onboarding` memang
                    meminta profil belajar, bukan gimmick marketing. */}
                <div className="mt-5 rounded-xl border border-primary/25 bg-primary/5 p-4">
                  <p className="text-sm font-semibold text-foreground">
                    Belum yakin mau mulai dari mana?
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Jawab tiga pertanyaan singkat, kami susun urutan belajar dari
                    jawabanmu.
                  </p>
                  <Link
                    href="/onboarding"
                    onClick={() => closeImmediately()}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    Susun jalur belajar saya
                    <ChevronDown
                      size={14}
                      strokeWidth={2}
                      aria-hidden="true"
                      className="-rotate-90"
                    />
                  </Link>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
