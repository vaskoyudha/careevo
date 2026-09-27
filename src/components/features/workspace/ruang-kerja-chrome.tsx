"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RiLayoutLeft2Line } from "@remixicon/react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { halamanDipilih, modulDipilih } from "@/lib/courses/halaman";
import type { ModulKursus } from "@/lib/courses/kurikulum";

/**
 * Kerangka halaman ruang kerja — bar fokus, **sidebar silabus**, dan bar kaki.
 *
 * ## Kenapa sidebar, dan kenapa ia tinggal di sini
 *
 * Permukaan fokus lain di repo ini (reader modul) menyimpan peta kursusnya di
 * sebuah panel yang dibuka dari bar. Ruang kerja memakai pola yang sama, tetapi
 * peta itu duduk **sebagai kolom tetap** di kiri: peserta yang sedang mengetik
 * berpindah bagian sesering ia membaca, dan panel yang harus dibuka-tutup setiap
 * kali membuat peta itu berhenti jadi peta. Kolom tetap juga yang membuat
 * navigasi antar-modul tidak memakan lebar bar fokus.
 *
 * Sidebarnya hidup di komponen ini, bukan di `RuangKerjaLab`, karena dua alasan:
 *
 * 1. **Ia milik kerangka, bukan isi.** Yang mengatur tinggi halaman, bar fokus,
 *    dan bar kaki adalah kerangka; sidebar adalah saudara bar itu, bukan saudara
 *    dua kolom lab. Menaruhnya di dalam lab berarti ia ikut terbagi oleh
 *    `--lab-bagi` — kolom yang lebarnya diatur peserta untuk panduan dan IDE,
 *    bukan untuk navigasi.
 * 2. **Ia berbagi pembacaan URL dengan bar kaki.** Modul aktif dibaca **sekali**
 *    di sini (`?modul=`), lalu dipakai bersama oleh daftar modul yang disorot dan
 *    oleh tombol "sebelumnya"/"selanjutnya". Kalau keduanya membaca sendiri,
 *    sidebar bisa menyorot satu modul sementara kaki menawarkan modul lain.
 *
 * ## Tinggi: dokumen tidak menggulir, isinya yang menggulir
 *
 * `h-dvh overflow-hidden` di akar, dan `min-h-0` di sepanjang rantai flex.
 * Dengan `min-h-dvh` tidak ada yang membatasi baris di bawah bar fokus, sehingga
 * `overflow-y-auto` pada kolom-kolomnya jadi hampa dan yang menggulir justru
 * dokumen — lalu iframe IDE ikut terangkat. Ini alasan yang sama yang sudah
 * ditulis di `materi-shell.tsx`, dan rantainya wajib utuh.
 *
 * Yang menggulir ada tiga, masing-masing di dalam kotaknya sendiri: daftar modul
 * di sidebar, kolom panduan, dan — di dalam iframe — IDE itu sendiri.
 *
 * ## Di bawah `lg` sidebarnya jadi laci
 *
 * Di layar sempit tidak ada lebar untuk kolom tetap di samping IDE; kolom lab
 * sendiri sudah menumpuk. Sidebarnya karena itu keluar dari alur dan menjadi
 * laci yang menutupi layar, ditutup oleh scrim, tombol X, atau Escape. Tombol
 * pemicunya tetap di bar, jadi peta kursus selalu bisa dijangkau.
 */
export function RuangKerjaChrome({
  slug,
  title,
  provider,
  modul,
  tautanKarya,
  jumlahKarya,
  children,
}: {
  slug: string;
  title: string;
  provider: string;
  modul: ModulKursus[];
  /** Halaman Project course — tempat karya benar-benar dikumpulkan. */
  tautanKarya: string;
  /** Jumlah karya yang sudah ada; `0` membuat kartu Project tampil "Belum ada karya". */
  jumlahKarya: number;
  children: ReactNode;
}) {
  /**
   * Modul + halaman aktif, dibaca dari URL — sumber yang sama dengan
   * `RuangKerjaLab` (`?modul=&halaman=`). `modulDipilih`/`halamanDipilih`
   * dipakai apa adanya supaya sidebar, bar kaki, dan kolom panduan tidak bisa
   * menjawab berbeda untuk URL yang sama.
   */
  const searchParams = useSearchParams();
  const idModul = searchParams.get("modul") ?? undefined;
  const idHalaman = searchParams.get("halaman") ?? undefined;

  const modulAktif = modulDipilih(modul, idModul);
  const halamanAktif = modulAktif ? halamanDipilih(modulAktif, idHalaman) : null;

  /**
   * Sidebar terbuka secara bawaan: peta kursus adalah hal pertama yang dicari
   * peserta saat mendarat di ruang kerja. Statusnya **lokal** — tidak ditulis ke
   * URL — karena ia preferensi tampilan, bukan alamat; menaruhnya di query akan
   * membuat setiap tautan modul membawa serta keadaan buka/tutup sidebar.
   */
  const [sidebarBuka, setSidebarBuka] = useState(true);

  /**
   * Escape menutup laci di layar sempit.
   *
   * Hanya saat terbuka (effect tidak mendaftarkan listener saat tertutup), dan
   * hanya relevan di bawah `lg` — di atasnya sidebarnya kolom tetap, bukan
   * lapisan yang menutupi, jadi tidak ada yang perlu ditutup. Menutup lewat
   * Escape aman dilakukan di sana juga: hasilnya sama dengan menekan tombol
   * toggle di bar.
   */
  useEffect(() => {
    if (!sidebarBuka) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarBuka(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sidebarBuka]);

  /**
   * Tetangga modul aktif untuk bar kaki. `-1` (id basi) diperlakukan sebagai
   * modul pertama: tidak ada "sebelumnya", dan "selanjutnya" menunjuk modul
   * kedua — perilaku yang sama dengan shell reader yang jatuh ke `modul[0]`.
   */
  const indeks = modulAktif ? modul.findIndex((m) => m.id === modulAktif.id) : -1;
  const posisi = indeks < 0 ? 0 : indeks;
  const sebelum = posisi > 0 ? modul[posisi - 1] : null;
  const sesudah = posisi < modul.length - 1 ? modul[posisi + 1] : null;

  /**
   * Tautan ke modul dan halaman, satu tempat.
   *
   * Ruang kerja memilih modul lewat **query** (`?modul=`), bukan segmen path
   * seperti reader (`/materi/<id>`). Bentuknya ditulis sekali di sini supaya
   * sidebar dan bar kaki tidak bisa menghasilkan dua bentuk URL untuk tujuan
   * yang sama.
   */
  const hrefModul = (id: string) =>
    `/belajar/${slug}/ruang-kerja?modul=${encodeURIComponent(id)}`;
  const hrefHalaman = (modulId: string, halamanId: string) =>
    `/belajar/${slug}/ruang-kerja?modul=${encodeURIComponent(modulId)}&halaman=${encodeURIComponent(halamanId)}`;

  /**
   * Ada sesuatu untuk dinavigasi? Kursus tanpa modul (mis. fixture katalog yang
   * kursusnya sudah tidak ada di store) tidak punya peta dan tidak punya tetangga
   * — sidebar kosong dan bar kaki tanpa tombol lebih buruk daripada keduanya
   * tidak ada. Halaman terkunci juga lewat sini: `modul`-nya `[]`.
   */
  const adaPeta = modul.length > 0;

  const kelasNav = "chrome-btn !h-11 !min-w-11 shrink-0 gap-1.5";
  const kelasSekunder = cn(kelasNav, "chrome-btn-white");
  const kelasPrimer = cn(kelasNav, "chrome-btn-brand");
  const kelasMati = "!opacity-45 cursor-not-allowed pointer-events-none shadow-none";

  return (
    <div className="reader-shell flex h-dvh flex-col overflow-hidden">
      <header className="reader-bar">
        <div className="flex w-full items-center gap-3 py-2.5">
          {/* Tombol peta kursus, paling kiri — di layar sempit ia pintu ke laci,
              di layar lebar ia ciut/bentang kolom tetap. Satu kontrol, dua
              perilaku, karena keduanya aksi yang sama: "tampilkan/sembunyikan
              peta kursus". */}
          {adaPeta ? (
            <button
              type="button"
              onClick={() => setSidebarBuka((v) => !v)}
              aria-expanded={sidebarBuka}
              aria-controls="ruang-kerja-silabus"
              aria-label={sidebarBuka ? "Sembunyikan silabus" : "Tampilkan silabus"}
              className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50"
            >
              <RiLayoutLeft2Line className="size-4" aria-hidden="true" />
            </button>
          ) : null}

          {/* Blok merek sekaligus tautan keluar. `aria-label` menyebut tujuannya,
              bukan mereknya: di bawah `sm` kata "Careevo" disembunyikan CSS, dan
              tanpa nama itu tautan ini diumumkan sebagai "link" tanpa keterangan. */}
          <Link
            href={`/belajar/${slug}`}
            aria-label="Kembali ke halaman kursus"
            className="reader-brand"
          >
            <Image
              src="/careevo-mark.png"
              alt=""
              width={256}
              height={235}
              aria-hidden="true"
              className="reader-brand-mark"
            />
            <span className="reader-brand-nama">Careevo</span>
          </Link>

          {/* Judul course, bukan "Ruang kerja": yang sedang dibaca peserta adalah
              course-nya, dan "Ruang kerja" sudah jadi `<h2>` di panel IDE. */}
          <span className="reader-silabus-judul">{title}</span>

          <div className="min-w-0 flex-1" aria-hidden="true" />

          <Link href={tautanKarya} className="chrome-btn chrome-btn-text">
            Project
          </Link>
        </div>
      </header>

      {/* Baris isi: sidebar + (kolom baca + bar kaki). `relative` supaya bar kaki
          yang `absolute` mengacu ke **wilayah baca**, bukan ke seluruh baris —
          ia tidak boleh ikut bergeser ke dalam sidebar. */}
      <div className="relative flex min-h-0 flex-1">
        {adaPeta && sidebarBuka ? (
          <aside
            id="ruang-kerja-silabus"
            aria-label={`Silabus ${title}`}
            className={cn(
              // Bentuk dasar: kolom putih, tepi kanan, isi yang menggulir.
              "flex min-h-0 w-[280px] shrink-0 flex-col border-r border-gray-200 bg-white",
              // Di atas `lg`: kolom tetap di dalam alur flex. `z-auto` penting —
              // sebagai anak flex, `z-50` akan membuat stacking context yang
              // menaikkannya di atas isi; di sini ia hanya perlu sejajar.
              "lg:static lg:z-auto",
              // Di bawah `lg`: laci yang keluar dari alur dan menutupi layar.
              // Tidak ada animasi masuk karena panelnya **tidak dirender saat
              // tertutup** (`adaPeta && sidebarBuka`): laci tanpa keadaan
              // "setengah tertutup" tidak butuh transisi, dan ini menghindari
              // panel tersembunyi yang tetap bisa dijangkau keyboard.
              "fixed inset-y-0 left-0 z-50",
            )}
          >
            <div className="flex items-start justify-between gap-2 border-b border-gray-200 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                  Silabus
                </p>
                <p className="truncate text-sm font-semibold text-gray-900">{title}</p>
                <p className="truncate text-[12px] text-gray-500">{provider}</p>
              </div>
              {/* Tombol tutup hanya di laci: di kolom tetap, tombol toggle di bar
                  sudah jadi jalan keluarnya, dan tombol X di sini akan terbaca
                  sebagai "tutup panel" padahal panelnya bukan panel. */}
              <button
                type="button"
                onClick={() => setSidebarBuka(false)}
                aria-label="Tutup silabus"
                className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 lg:hidden"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <nav aria-label="Daftar modul" className="min-h-0 flex-1 overflow-y-auto p-2">
              <ol className="flex flex-col gap-0.5">
                {modul.map((m) => {
                  const aktif = modulAktif?.id === m.id;
                  const halamanModul = m.halaman ?? [];
                  return (
                    <li key={m.id}>
                      {/* Baris modul adalah tautan ke modulnya. Daftar halaman
                          hanya dirender untuk modul aktif: menampilkan seluruh
                          kurikulum sekaligus membuat peta lebih panjang dari
                          kebutuhan, sedangkan yang dicari saat mengetik adalah
                          bab modul yang sedang dikerjakan. */}
                      <Link
                        href={hrefModul(m.id)}
                        aria-current={aktif ? "true" : undefined}
                        className={cn(
                          "block rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                          aktif
                            ? "bg-[#0056D2]/8 text-[#0056D2]"
                            : "text-gray-700 hover:bg-gray-50",
                        )}
                      >
                        {m.judul}
                      </Link>

                      {aktif && halamanModul.length > 0 ? (
                        <ol className="mt-0.5 mb-1 ml-3 flex flex-col gap-0.5 border-l border-gray-200 pl-2">
                          {halamanModul.map((h) => {
                            const halamanHidup = halamanAktif?.id === h.id;
                            return (
                              <li key={h.id}>
                                <Link
                                  href={hrefHalaman(m.id, h.id)}
                                  aria-current={halamanHidup ? "page" : undefined}
                                  className={cn(
                                    "block rounded-lg px-2.5 py-1.5 text-[13px] transition-colors",
                                    halamanHidup
                                      ? "bg-blue-50 font-semibold text-[#0056D2]"
                                      : "text-gray-600 hover:bg-gray-50",
                                  )}
                                >
                                  {h.judul}
                                </Link>
                              </li>
                            );
                          })}
                        </ol>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </nav>

            <div className="border-t border-gray-200 p-3">
              <Link
                href={tautanKarya}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2.5 transition-colors hover:border-[#0056D2]/40 hover:bg-[#0056D2]/[0.03]"
              >
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-gray-900">
                    Project course
                  </span>
                  <span className="block text-[12px] text-gray-600">
                    {jumlahKarya > 0 ? `${jumlahKarya} karya terkumpul` : "Belum ada karya"}
                  </span>
                </span>
                <span aria-hidden="true" className="shrink-0 text-gray-400">
                  →
                </span>
              </Link>
            </div>
          </aside>
        ) : null}

        {/* Scrim laci, hanya di bawah `lg`. Tombol, bukan div: satu-satunya
            aksinya "tutup", dan pembaca layar harus mendengarnya sebagai aksi. */}
        {adaPeta && sidebarBuka ? (
          <button
            type="button"
            aria-label="Tutup silabus"
            onClick={() => setSidebarBuka(false)}
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          />
        ) : null}

        <div className="relative min-w-0 flex-1">
          {/* `lab-isi-penuh` membatalkan padding samping bawaan dan menyisakan
              `--reader-foot-h` di bawah — tinggi yang sama dengan bar kaki yang
              mengapung di atasnya, jadi kolom lab berhenti tepat di atasnya.
              `overflow-hidden` karena yang menggulir adalah kolom-kolom di
              dalamnya, bukan area ini. */}
          <main className="lab-isi-penuh flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
            {children}
          </main>

          {adaPeta ? (
            <footer className="reader-foot-bar">
              <div className="reader-foot-bar-inner">
                {sebelum ? (
                  <Link
                    href={hrefModul(sebelum.id)}
                    /* Nama aksesibel menyebut **judul** modulnya: "Sebelumnya"
                       saja tidak memberi tahu ke mana, dan judulnya terpotong di
                       layar sempit. */
                    aria-label={`Sebelumnya: ${sebelum.judul}`}
                    className={kelasSekunder}
                  >
                    <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
                    <span className="reader-foot-teks truncate">Sebelumnya</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    title="Ini modul pertama"
                    className={cn(kelasSekunder, kelasMati)}
                  >
                    <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
                    <span className="reader-foot-teks truncate">Sebelumnya</span>
                    <span className="sr-only"> — ini modul pertama</span>
                  </button>
                )}

                {/* Pintu Project di tengah, seperti pintu AI Mastery di bar kaki
                    reader: satu aksi yang selalu tersedia, tepat di tempat mata
                    berhenti. Di ruang kerja yang tersedia adalah karya, bukan
                    tutor — tidak ada drawer tutor di sini. */}
                <Link href={tautanKarya} className={kelasSekunder}>
                  <span>Project</span>
                </Link>

                {sesudah ? (
                  <Link
                    href={hrefModul(sesudah.id)}
                    aria-label={`Selanjutnya: ${sesudah.judul}`}
                    className={kelasPrimer}
                  >
                    <span className="reader-foot-teks truncate">Selanjutnya</span>
                    <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    title="Ini modul terakhir"
                    className={cn(kelasPrimer, kelasMati)}
                  >
                    <span className="reader-foot-teks truncate">Selanjutnya</span>
                    <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
                    <span className="sr-only"> — ini modul terakhir</span>
                  </button>
                )}
              </div>
            </footer>
          ) : null}
        </div>
      </div>
    </div>
  );
}
