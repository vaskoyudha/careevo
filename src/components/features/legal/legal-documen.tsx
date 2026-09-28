"use client";

import * as React from "react";
import { onScrollFrame } from "@/lib/scroll/scroll-frame";

export type EntriLegal = { id: string; judul: string };

type Konteks = {
  daftar: (id: string) => (el: HTMLElement | null) => void;
};

const LegalKonteks = React.createContext<Konteks | null>(null);

/**
 * Mendaftarkan element section ke pemantau scroll.
 *
 * Ref-disable ini **wajib** hidup di satu tempat. Versi pertama memanggil
 * `useDaftarIsi()` dari halaman dan `DaftarIsi` menyimpan ref-nya sendiri —
 * dua `useRef` berbeda, jadi callback dari halaman mengisi peta yang tidak
 * pernah dibaca `DaftarIsi`, dan entri tidak pernah menyala.
 */
export function useDaftarIsi(): (id: string) => (el: HTMLElement | null) => void {
  const konteks = React.useContext(LegalKonteks);
  if (!konteks) {
    throw new Error(
      "useDaftarIsi harus dipakai di dalam <LegalDocumen>, yang menyediakan konteks pemantau section.",
    );
  }
  return konteks.daftar;
}

/**
 * Daftar isi lengket untuk halaman legal.
 *
 * Menyalakan entri yang sedang dibaca. Memakai `onScrollFrame`, bukan listener
 * `scroll` telanjang: di bawah Lenis setiap handler yang memanggil
 * `getBoundingClientRect()` di dalam event scroll menjadi *read after write* —
 * satu reflow paksa per handler per event. `problems-solutions` sudah
 * mengukur masalah yang sama (lihat komentar di `scroll-frame.ts`).
 *
 * Arah pemindaian dari bawah ke atas, dan yang menang adalah entri **terakhir**
 * yang `rect.top` sudah melewati garis aktivasi. Memindai ke bawah membuat
 * entri terakhir yang terlewati tetap aktif sepanjang section pendek: sebuah
 * section 200px bisa tidak pernah melewati garis 35% viewport, sehingga
 * judulnya tidak pernah menyala sama sekali.
 *
 * Garis di 35%, bukan 45% seperti `problems-solutions`: halaman legal punya
 * navbar lengket setinggi 64px, jadi pemicu yang terlalu rendah menyalakan
 * entri saat judulnya masih tertutup chrome.
 */
export function LegalDocumen({
  entri,
  children,
}: {
  entri: EntriLegal[];
  children: React.ReactNode;
}) {
  const [aktif, setAktif] = React.useState<string | null>(null);
  const peta = React.useRef<Record<string, HTMLElement | null>>({});

  const daftar = React.useCallback(
    (id: string) => (el: HTMLElement | null) => {
      peta.current[id] = el;
    },
    [],
  );

  React.useEffect(() => {
    return onScrollFrame(() => {
      const garis = window.innerHeight * 0.35;
      let ditemukan: string | null = null;

      for (let i = entri.length - 1; i >= 0; i -= 1) {
        const el = peta.current[entri[i].id];
        if (el && el.getBoundingClientRect().top <= garis) {
          ditemukan = entri[i].id;
          break;
        }
      }

      // Sebelum section pertama melewati garis (yaitu di atas fold) tidak ada
      // yang aktif — lebih benar daripada menyalakan entri pertama yang belum
      // sempat dibaca.
      setAktif(ditemukan);
    });
  }, [entri]);

  const konteks = React.useMemo(() => ({ daftar }), [daftar]);

  return (
    <LegalKonteks.Provider value={konteks}>
      <div className="mx-auto grid max-w-6xl gap-x-14 px-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:px-6">
        <div className="hidden lg:block">
          <div className="sticky top-24">
            <nav aria-label="Daftar isi">
              <p className="mb-4 font-mono text-[11px] tracking-[0.14em] text-[--text-secondary] uppercase">
                Di halaman ini
              </p>
              <ul className="space-y-0.5">
                {entri.map((e) => {
                  const nyala = aktif === e.id;
                  return (
                    <li key={e.id}>
                      <a
                        href={`#${e.id}`}
                        aria-current={nyala ? "true" : undefined}
                        className={[
                          "block border-l-2 py-1.5 pl-3 text-sm leading-snug transition-colors duration-200",
                          nyala
                            ? "border-[--ocean-mid] font-medium text-[--ocean-deep]"
                            : "border-transparent text-[--text-secondary] hover:border-[--border] hover:text-[--text]",
                        ].join(" ")}
                      >
                        {e.judul}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </div>
        <article className="min-w-0">{children}</article>
      </div>
    </LegalKonteks.Provider>
  );
}

/**
 * Satu section legal.
 *
 * `scroll-mt-28` memberi ruang untuk navbar lengket: tanpa itu, section yang
 * dipivot lewat daftar isi mendarat tepat di belakang chrome dan judulnya
 * hilang. `scroll-smooth` ada di `globals.css` dan otomatis dimatikan untuk
 * pengguna `prefers-reduced-motion`.
 */
export function BagianLegal({
  id,
  judul,
  children,
}: {
  id: string;
  judul: string;
  children: React.ReactNode;
}) {
  const daftar = useDaftarIsi();
  return (
    <section ref={daftar(id)} id={id} className="scroll-mt-28 border-t border-[--border] pt-10 pb-2 first:border-t-0 first:pt-0">
      <h2 className="mb-4 text-xl font-medium tracking-[-0.02em] text-[--text] sm:text-2xl">
        {judul}
      </h2>
      <div className="legal-body">{children}</div>
    </section>
  );
}
