"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  blokTampil,
  daftarSection,
  petaSection,
  rangkumBacklink,
  segmenKeTeks,
  type BacklinkMasuk,
} from "@/lib/courses/blok";
import { halamanUntukModul } from "@/lib/courses/halaman";
import { KodeView } from "./kode-view";
import type { BlokHalaman, Halaman, Modul, SegmenTeks, UkuranBlok } from "@/types/course";

/**
 * Renderer halaman berformat.
 *
 * Dipakai bersama oleh sisi peserta dan pratinjau admin — alasan yang sama
 * dengan `pratinjau-materi.tsx`: pratinjau yang berbeda dari kenyataan lebih
 * buruk daripada tidak ada pratinjau.
 *
 * Blok dirender sebagai elemen React, **bukan** `dangerouslySetInnerHTML`.
 * Repo ini tidak punya sanitizer, jadi merender HTML dari admin akan mengubah
 * lubang XSS jinak menjadi XSS tersimpan. Karena konten disimpan sebagai
 * struktur, renderer ini adalah satu-satunya tempat yang menentukan arti setiap
 * field — dan `switch` di bawah sengaja tanpa `default` supaya menambah
 * `TipeBlok` baru menjadi error tipe di sini, bukan blok yang diam-diam hilang.
 *
 * Tautan memakai `<a>` biasa, bukan `next/link`: seluruh tujuannya adalah
 * jangkar `#…` di halaman yang sama, yang justru harus ditangani browser
 * (lompat + masuk riwayat) tanpa perantara router.
 */

/** Kelas tipografi per ukuran. Skala tema, bukan px bebas. */
const KELAS_UKURAN: Record<UkuranBlok, string> = {
  kecil: "text-[13px] leading-relaxed",
  normal: "text-[15px] leading-relaxed",
  besar: "text-lg leading-relaxed",
  lead: "text-xl leading-relaxed",
};

const KELAS_HEADING: Record<1 | 2 | 3, string> = {
  1: "text-2xl font-bold tracking-tight",
  2: "text-xl font-bold tracking-tight",
  3: "text-base font-semibold",
};

export function HalamanView({
  modul,
  halaman,
  onPindahHalaman,
  className,
}: {
  /**
   * Hanya `halaman` yang dibutuhkan, bukan `Modul` penuh.
   *
   * Modul tersimpan (`Modul`) dan modul yang dipakai UI learner (`ModulKursus`)
   * adalah dua tipe berbeda, dan renderer ini dipakai keduanya. Menuntut `Modul`
   * penuh akan memaksa salah satu sisi membangun field yang tidak pernah
   * dipakai renderer ini.
   */
  modul: Pick<Modul, "halaman">;
  halaman: Halaman;
  /**
   * Cara berpindah halaman.
   *
   * Di sisi peserta, `undefined` berarti pager memakai `Link` ke
   * `?halaman=<id>` — satu halaman punya URL yang bisa dibagikan dan tombol
   * kembali browser bekerja. Di pratinjau admin, pager **wajib** memakai
   * callback ini: `Link` akan memuat ulang halaman admin dan membuang seluruh
   * isi editor yang belum disimpan.
   */
  onPindahHalaman?: (halamanId: string) => void;
  className?: string;
}) {
  const halamanModul = halamanUntukModul(modul);
  const index = halamanModul.findIndex((h) => h.id === halaman.id);
  const sebelumnya = index > 0 ? halamanModul[index - 1] : null;
  const berikutnya = index >= 0 && index < halamanModul.length - 1 ? halamanModul[index + 1] : null;

  // Jangkar dan backlink dihitung sekali, bukan per blok: keduanya harus
  // memandang seluruh halaman untuk bisa benar.
  const bagian = daftarSection(halaman.blok);
  const peta = petaSection(halaman.blok);
  const backlink = rangkumBacklink(halaman.blok);
  // Yang dirender bukan `halaman.blok` mentah: blok yang diklik tapi tidak
  // diisi harus hilang, atau ia jadi artefak yang terlihat — untuk `kode` itu
  // panel gelap 78px dengan chip `C++` dan tombol `Salin` yang menyalin string
  // kosong. Jangkar dan backlink tetap dihitung dari daftar penuh karena
  // keduanya sudah melewati blok kosong sendiri.
  const tampil = blokTampil(halaman.blok);
  const adaIsi = tampil.length > 0;

  return (
    <div className={cn("space-y-5", className)}>
      <article className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-7">
        <header className="mb-5 border-b border-gray-100 pb-4">
          <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            Halaman {index >= 0 ? index + 1 : "?"} dari {halamanModul.length}
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">{halaman.judul}</h2>
        </header>

        {bagian.length > 1 ? (
          <nav aria-labelledby="judul-daftar-isi" className="mb-6 rounded-xl bg-[#f5f7fa] p-4">
            <p
              id="judul-daftar-isi"
              className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase"
            >
              Di halaman ini
            </p>
            <ol className="mt-2 space-y-1">
              {bagian.map((s) => (
                <li key={s.id} className={s.level === 1 ? "" : s.level === 2 ? "pl-3" : "pl-6"}>
                  <a href={`#${s.id}`} className="text-sm text-[#0056D2]">
                    {s.teks}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        {adaIsi ? (
          <div className="space-y-4">
            {tampil.map((blok) => (
              <BlokView
                key={blok.id}
                blok={blok}
                jangkar={peta.get(blok.id)}
                backlink={backlink}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
            Halaman ini belum diisi.
          </p>
        )}
      </article>

      {halamanModul.length > 1 ? (
        <nav aria-label="Navigasi halaman" className="flex items-center justify-between gap-3">
          {sebelumnya ? (
            <NavHalaman
              halaman={sebelumnya}
              arah="sebelumnya"
              onPindah={onPindahHalaman}
            />
          ) : (
            <span />
          )}
          {berikutnya ? (
            <NavHalaman halaman={berikutnya} arah="berikutnya" onPindah={onPindahHalaman} />
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}

/**
 * Pindah halaman.
 *
 * Dua mode, dipilih penerima `onPindah`: `Link` untuk peserta (URL bisa
 * dibagikan, tombol kembali browser bekerja) atau tombol biasa untuk pratinjau
 * admin (tidak meninggalkan halaman, sehingga tulisan yang belum disimpan
 * tidak hilang).
 */
function NavHalaman({
  halaman,
  arah,
  onPindah,
}: {
  halaman: Halaman;
  arah: "sebelumnya" | "berikutnya";
  onPindah?: (halamanId: string) => void;
}) {
  const label = `${arah === "sebelumnya" ? "Halaman sebelumnya" : "Halaman berikutnya"}: ${halaman.judul}`;
  const kelas = cn(
    "inline-flex max-w-[48%] cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm hover:border-[#0056D2]",
    arah === "berikutnya" && "ml-auto text-right",
  );

  const isi = (
    <>
      {arah === "sebelumnya" ? (
        <ChevronLeft className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
      ) : null}
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
          {arah === "sebelumnya" ? "Sebelumnya" : "Berikutnya"}
        </span>
        <span className="block truncate font-medium text-gray-800">{halaman.judul}</span>
      </span>
      {arah === "berikutnya" ? (
        <ChevronRight className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
      ) : null}
    </>
  );

  if (onPindah) {
    return (
      <button type="button" onClick={() => onPindah(halaman.id)} aria-label={label} className={kelas}>
        {isi}
      </button>
    );
  }

  return (
    <Link href={`?halaman=${encodeURIComponent(halaman.id)}`} aria-label={label} className={kelas}>
      {isi}
    </Link>
  );
}

/**
 * Satu blok, satu bentuk.
 *
 * Tipe balik `ReactElement` itu **wajib**, bukan gaya. Tanpa tipe balik yang
 * eksplisit, jalur yang jatuh keluar dari `switch` diserap `tsc` sebagai
 * `undefined` yang sah, sehingga `TipeBlok` baru yang belum punya `case` di
 * sini tidak menghasilkan error apa pun. Tipe balik itulah yang membuat blok
 * yang hilang jadi error tipe; menghapusnya mematikan penjaga itu diam-diam.
 */
function BlokView({
  blok,
  jangkar,
  backlink,
}: {
  blok: BlokHalaman;
  jangkar?: string;
  backlink: Map<string, BacklinkMasuk[]>;
}): ReactElement {
  const masuk = jangkar ? backlink.get(jangkar) : undefined;

  switch (blok.tipe) {
    case "heading": {
      const Tag = (`h${blok.level ?? 2}` as const) satisfies "h1" | "h2" | "h3";
      const level = blok.level ?? 2;
      return (
        <section id={jangkar} className={cn(level > 1 && "pt-2")}>
          <Tag className={cn("text-gray-900", KELAS_HEADING[level])}>
            <SegmenView segmen={blok.segmen ?? []} />
          </Tag>
          <BacklinkDaftar masuk={masuk} />
        </section>
      );
    }
    case "paragraf":
      return (
        <p className={cn("text-gray-700", KELAS_UKURAN[blok.ukuran ?? "normal"])}>
          <SegmenView segmen={blok.segmen ?? []} />
        </p>
      );
    case "kutipan":
      return (
        <blockquote className="border-l-4 border-[#0056D2]/30 bg-[#f5f7fa] py-2 pl-4 text-gray-700 italic">
          <SegmenView segmen={blok.segmen ?? []} />
        </blockquote>
      );
    case "daftar":
      return (
        <ul className="list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-gray-700">
          {(blok.butir ?? []).map((butir, index) => (
            <li key={`${blok.id}-${index}`}>
              <SegmenView segmen={butir} />
            </li>
          ))}
        </ul>
      );
    case "kode": {
      // Default dihitung sekali lalu dipakai dua kali. Chip dan editor harus
      // sepakat bahasa mana yang dibaca; kalau chip memakai `blok.bahasa`
      // mentah, blok tanpa bahasa tampil dengan header kosong.
      const bahasa = blok.bahasa ?? "cpp";
      return (
        <figure className="overflow-hidden rounded-xl border border-gray-200">
          <figcaption className="flex items-center justify-between gap-2 border-b border-gray-200 bg-[#f5f7fa] px-3 py-1.5">
            <span className="font-mono text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              {bahasa === "cpp" ? "C++" : bahasa}
            </span>
            <TombolSalin teks={blok.kode ?? ""} />
          </figcaption>
          {/*
            `kunci={blok.id}` benar di sini dan hanya di sini. Blok yang tampil
            di materi sudah tersimpan, jadi setiap blok punya id sendiri dan
            ruang latihannya tidak akan tertukar. Editor admin memakai
            identitas lokal blok, bukan `blok.id`, karena blok yang belum
            disimpan masih `id: ""`.

            `dapatJalankan={blok.dapatDijalankan === true}` bukan sekadar
            `blok.dapatDijalankan`: fieldnya opsional, dan blok yang tidak pernah
            disentuh ahli tidak punya nilainya sama sekali. `=== true` membuat
            `undefined` berarti tidak boleh dijalankan, jadi blok seperti itu
            tampil tanpa tombol alih-alih dengan tombol yang menolak.
          */}
          <KodeView
            kunci={blok.id}
            kode={blok.kode ?? ""}
            kodeAwal={blok.kodeAwal}
            stdin={blok.stdin}
            dapatJalankan={blok.dapatDijalankan === true}
            bahasa={bahasa}
            label={`Kode contoh ${blok.id}`}
          />
          {blok.outputHarapan ? (
            <div className="border-t border-gray-200 bg-white px-3 py-2">
              <p className="mb-1 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                Keluaran yang diharapkan
              </p>
              <pre className="overflow-x-auto font-mono text-[13px] whitespace-pre-wrap text-gray-700">
                {blok.outputHarapan}
              </pre>
            </div>
          ) : null}
        </figure>
      );
    }
    case "gambar":
      return (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={blok.src}
            alt={blok.alt ?? ""}
            className="w-full rounded-xl border border-gray-200"
          />
        </figure>
      );
  }
}

/**
 * Salin kode ke papan klip.
 *
 * Kegagalan papan klip diabaikan dengan sengaja. Menyalin adalah kenyamanan,
 * dan kegagalan tidak boleh membuat halaman gagal gara-gara izin atau konteks
 * yang tidak aman. Karena itu tombolnya kembali ke keadaan semula sendiri
 * setelah dua detik, dengan atau tanpa pesan.
 *
 * Labelnya dibungkus `aria-live`, **bukan** `role="status"` pada tombolnya:
 * `role="status"` akan menggantikan peran tombol, sehingga pembaca layar tidak
 * lagi tahu itu tombol yang bisa ditekan. Dengan span di dalam, tombol tetap
 * terbaca sebagai tombol dan perubahan labelnya diumumkan sebagai pesan status.
 * Kalau keduanya dipasang, pesannya dibaca dua kali.
 */
function TombolSalin({ teks }: { teks: string }) {
  const [salin, setSalin] = useState<"idle" | "ok" | "gagal">("idle");
  const pengingat = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tanpa pembatalan, dua penekanan dalam dua detik meninggalkan dua pengingat
  // hidup: yang pertama memotong "Tersalin" sebelum janjinya, dan keduanya
  // bertahan melewati halaman yang sudah ditutup.
  useEffect(() => {
    return () => {
      if (pengingat.current) clearTimeout(pengingat.current);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(teks);
          setSalin("ok");
        } catch {
          setSalin("gagal");
        }
        if (pengingat.current) clearTimeout(pengingat.current);
        pengingat.current = setTimeout(() => setSalin("idle"), 2000);
      }}
      className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-gray-500 hover:text-[#0056D2]"
    >
      <span aria-live="polite">
        {salin === "ok" ? "Tersalin" : salin === "gagal" ? "Gagal" : "Salin"}
      </span>
    </button>
  );
}

/**
 * Baris berformat: tebal, miring, dan tautan per potongan teks.
 *
 * Memakai elemen semantik `<strong>`/`<em>`, bukan `<span>` berkelas. Bedanya
 * nyata: pembaca layar mengumumkan `<strong>` dan `<em>` sebagai penekanan,
 * sedangkan `font-semibold` hanya mengubah tampilan. Isi materi belajar harus
 * terbaca sama baiknya tanpa penglihatan.
 */
function SegmenView({ segmen }: { segmen: SegmenTeks[] }) {
  return (
    <>
      {segmen.map((potongan, index) => {
        if (!potongan.teks) return null;
        const kunci = `${index}-${potongan.tautan ?? ""}`;

        let isi: ReactNode = potongan.teks;
        if (potongan.miring) isi = <em>{isi}</em>;
        if (potongan.tebal) isi = <strong>{isi}</strong>;

        if (!potongan.tautan) {
          // Fragment berkunci, bukan pembungkus tambahan: teks biasa justru
          // paling banyak, dan membungkusnya menambah kedalaman DOM tanpa guna.
          return <Fragment key={kunci}>{isi}</Fragment>;
        }

        // Tautan eksternal keluar dengan aman; backlink tetap di tab yang sama.
        const eksternal = !potongan.tautan.startsWith("#");
        return (
          <a
            key={kunci}
            href={potongan.tautan}
            className="text-[#0056D2]"
            {...(eksternal ? { target: "_blank", rel: "noreferrer" } : {})}
          >
            {isi}
          </a>
        );
      })}
    </>
  );
}

/**
 * Daftar "ditautkan dari" di bawah sebuah section.
 *
 * Hanya muncul bila ada yang benar-benar menautkan ke section ini — daftar
 * kosong tidak ditampilkan, supaya section tanpa backlink tidak menambah
 * keramaian.
 */
function BacklinkDaftar({ masuk }: { masuk?: BacklinkMasuk[] }) {
  const [buka, setBuka] = useState(false);
  if (!masuk?.length) return null;

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setBuka((v) => !v)}
        aria-expanded={buka}
        className="cursor-pointer text-xs font-medium text-gray-500 hover:text-[#0056D2]"
      >
        ↵ Ditautkan dari {masuk.length} bagian
      </button>
      {buka ? (
        <ul className="mt-1 space-y-0.5 border-l-2 border-gray-200 pl-3">
          {masuk.map((b) => (
            <li key={b.blokId} className="text-xs text-gray-600">
              {b.teks}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Ringkasan teks polos sebuah blok — dipakai daftar halaman yang terlipat. */
export function ringkasIsiHalaman(halaman: Halaman, maks = 120): string {
  for (const blok of halaman.blok) {
    if (blok.tipe === "daftar") {
      const teks = (blok.butir ?? []).map((b) => segmenKeTeks(b)).filter(Boolean).join(" · ");
      if (teks) return potong(teks, maks);
      continue;
    }
    if (blok.tipe === "gambar") continue;
    const teks = segmenKeTeks(blok.segmen);
    if (teks) return potong(teks, maks);
  }
  return "";
}

function potong(teks: string, maks: number): string {
  return teks.length <= maks ? teks : `${teks.slice(0, maks - 1).trimEnd()}…`;
}
