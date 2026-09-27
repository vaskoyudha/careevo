"use client";

import { useState } from "react";
import Link from "next/link";
import {
  RiArrowDownSLine,
  RiPulseLine,
  RiSettings3Line,
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import { LABEL_ATURAN_BANTUAN } from "@/lib/courses/kebijakan";
import type { KJenisKejadian } from "@/lib/learning/akses";
import { useCourseSession } from "./course-session";

/**
 * Panel kejadian integritas untuk sesi terverifikasi yang sedang berjalan.
 *
 * Panel ini adalah **penjelasan + pelaporan**, bukan alat bukti: ia hanya
 * menampilkan hitungan yang sudah dikonfirmasi server (`useCourseSession`) dan
 * mengirim laporan atas permintaan peserta. Tidak ada satu pun kendali di sini
 * yang memulai kamera — seluruh plan ini menyatakan pengawasan berbasis kamera
 * di luar lingkup — jadi jangan menamai tombol seolah aplikasi memegang kamera.
 *
 * Nada copy sengaja netral dan tidak menuduh: pindah tab yang teramati bisa
 * berarti dokumentasi yang diizinkan, dan spec mewajibkan pesannya jelas bahwa
 * kejadian tidak otomatis menggagalkan penilaian dan tidak mengurangi reputasi.
 *
 * ## Kenapa terlipat, dan kenapa itu bukan menyembunyikan informasi
 *
 * Versi sebelumnya selalu terbuka setinggi ~390px di atas pane modul — di
 * viewport 900px, isi modul yang jadi tugas utama peserta justru jatuh ke bawah
 * lipatan. Barisnya pun tidak bisa ditutup sama sekali.
 *
 * Yang berubah hanya **bentuknya**, bukan keberadaannya: baris ringkasnya selalu
 * tampil (menyebut jumlah kejadian dan celah apa adanya, berwarna sesuai
 * keadaan), dan seluruh penjelasan, pelaporan kamera, serta catatan terakhir ada
 * satu klik di bawahnya dengan `aria-expanded`/`aria-controls`. Peserta yang
 * butuh tahu persis apa yang dicatat tetap bisa membacanya utuh; peserta yang
 * sedang membaca tidak lagi kehilangan setengah layar pertama.
 *
 * ## Kenapa isinya dipisah ke komponen sendiri
 *
 * Repo ini lingkungan `node` tanpa jsdom, jadi `renderToStaticMarkup` tidak
 * menjalankan klik: isi yang hanya tampil setelah panel dibuka tidak akan pernah
 * bisa diperiksa dari `KejadianPanel` sendirian. `IsiPanelKejadian` diekspor
 * supaya test bisa merendernya langsung — pola yang sama dengan
 * `IsiPanelSilabus` di `reader-silabus.tsx`.
 */

/**
 * Label peserta untuk tiap jenis kejadian.
 *
 * `Record<KJenisKejadian, string>` (bukan `Record<string, string>`) supaya
 * menambah jenis baru di `JENIS_KEJADIAN_SAH` langsung memunculkan error
 * kompilasi di sini — jenis tanpa label membuat daftar menampilkan slug ke
 * peserta, yang justru mengaburkan apa yang dicatat.
 */
const LABEL_JENIS: Record<KJenisKejadian, string> = {
  pindah_tab: "Pindah tab",
  fokus_hilang: "Jendela kehilangan fokus",
  kamera_mulai: "Kamera aktif (menurut laporanmu)",
  kamera_berhenti: "Kamera berhenti (menurut laporanmu)",
  kamera_gagal: "Kamera bermasalah (menurut laporanmu)",
  sesi_dimulai: "Sesi dimulai",
  sesi_diakhiri: "Sesi diakhiri",
  keluar_fullscreen: "Keluar layar penuh",
  paste_massal: "Menempel teks panjang",
  pintasan_terlarang: "Pintasan terlarang",
  salin_terlarang: "Menyalin teks panjang",
  wajah_tidak_terdeteksi: "Wajah tidak terlihat",
  wajah_kedua: "Wajah kedua terdeteksi",
  seb_aktif: "Berjalan di lockdown browser",
};

function waktu(titik: string): string {
  const t = new Date(titik);
  if (Number.isNaN(t.getTime())) return titik;
  return t.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Isi panel: penjelasan, pelaporan kamera, dan catatan terakhir.
 *
 * Diekspor untuk test (lihat catatan modul di atas).
 */
export function IsiPanelKejadian() {
  const { kejadian, laporKejadian } = useCourseSession();
  /**
   * Jenis laporan terakhir yang dipilih peserta.
   *
   * Panel hanya punya satu tombol "Laporkan gangguan", jadi jenisnya diambil
   * dari pilihan radio di atasnya. `kamera_gagal` adalah default karena itu
   * keluhan yang paling sering memicu panel ini dibuka.
   */
  const [jenisLaporan, setJenisLaporan] = useState<"kamera_gagal" | "kamera_berhenti" | "kamera_mulai">(
    "kamera_gagal",
  );
  const [pesan, setPesan] = useState<string | null>(null);
  const [mengirim, setMengirim] = useState(false);

  const terakhir = kejadian.slice(-5).reverse();

  const laporkan = async () => {
    setMengirim(true);
    setPesan(null);
    const berhasil = await laporKejadian(jenisLaporan, null, "Dilaporkan peserta lewat panel kejadian.");
    setMengirim(false);
    setPesan(
      berhasil
        ? "Laporanmu tercatat sebagai konteks. Ini tidak otomatis menggagalkan penilaian dan tidak mengurangi reputasimu."
        : "Laporan belum bisa dicatat — sesi mungkin sudah berakhir atau koneksi terputus. Coba lagi, atau hubungi pengajar.",
    );
  };

  return (
    <>
      <p className="text-[12.5px] leading-relaxed text-gray-700">
        Pindah tab, keluar layar penuh, menempel/menyalin teks panjang, dan pintasan tertentu
        dicatat untuk konteks. Kejadian ini tidak otomatis menggagalkan penilaian dan tidak
        mengurangi reputasimu.
      </p>
      <p className="mt-2 text-[11.5px] leading-relaxed text-gray-500">
        Yang dicatat saat ini: pindah tab, fokus yang hilang, keluar layar penuh, dan pola
        menempel/menyalin teks panjang. Careevo{" "}
        <strong className="font-semibold text-gray-700">belum</strong> mengakses kameramu — tidak
        ada aliran gambar yang dibuka, tidak ada wajah yang direkam, dan tidak ada yang dianalisis.
        Laporan kamera di bawah hanya mencatat apa yang kamu alami sendiri, supaya pengajar tahu
        konteksnya.
      </p>

      <fieldset className="mt-3.5 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <legend className="px-1 text-[11px] font-semibold text-gray-600">
          Kamera: lapor apa yang kamu alami
        </legend>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
          {(
            [
              ["kamera_gagal", "Kamera tidak mau menyala"],
              ["kamera_berhenti", "Kamera sempat mati"],
              ["kamera_mulai", "Kamera menyala lagi"],
            ] as const
          ).map(([nilai, label]) => (
            <label
              key={nilai}
              className="inline-flex cursor-pointer items-center gap-1.5 text-[11.5px] text-gray-700"
            >
              <input
                type="radio"
                name="jenis-laporan-kamera"
                value={nilai}
                checked={jenisLaporan === nilai}
                onChange={() => setJenisLaporan(nilai)}
                className="size-3.5 cursor-pointer accent-[#0056D2]"
              />
              {label}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-gray-500">
          Pilihan ini hanya menentukan catatan yang dikirim. Menekan tombol di bawah tidak menyalakan
          kamera.
        </p>
      </fieldset>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={() => void laporkan()}
          disabled={mengirim}
          className="inline-flex h-9 cursor-pointer items-center rounded-lg bg-[#0056D2] px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#00419e] active:scale-[0.97] disabled:opacity-60"
        >
          {mengirim ? "Mencatat…" : "Laporkan gangguan"}
        </button>
        <Link
          href="/pengaturan"
          className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[#0056D2] underline underline-offset-2 hover:text-[#00419e]"
        >
          <RiSettings3Line className="size-3.5 shrink-0" aria-hidden="true" />
          Atur cara kerja pencatatan
        </Link>
      </div>

      {pesan ? (
        <p role="status" className="mt-2 text-[11.5px] leading-relaxed text-gray-700">
          {pesan}
        </p>
      ) : null}

      {terakhir.length > 0 ? (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <p className="text-[10.5px] font-semibold tracking-wider text-gray-500 uppercase">
            Catatan terakhir
          </p>
          <ul className="mt-1.5 space-y-1">
            {terakhir.map((k, i) => (
              <li key={`${k.jenis}-${i}`} className="flex items-center gap-2 text-[11.5px]">
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    k.jenis_klasifikasi === "celah" ? "bg-amber-500" : "bg-slate-400",
                  )}
                />
                <span className="font-medium text-gray-800">{LABEL_JENIS[k.jenis]}</span>
                <span
                  className={k.jenis_klasifikasi === "celah" ? "text-amber-700" : "text-gray-500"}
                >
                  {k.jenis_klasifikasi === "celah" ? "celah pengawasan" : "kejadian"}
                </span>
                <time dateTime={k.at} className="ml-auto tabular-nums text-gray-400">
                  {waktu(k.at)}
                </time>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-gray-500">
            Daftar ini hanya menampilkan beberapa catatan terakhir selama sesi ini.
          </p>
        </div>
      ) : null}
    </>
  );
}

/**
 * Strip sesi terverifikasi yang sedang berjalan — status + catatan yang bisa dibuka.
 *
 * Ini **satu-satunya** permukaan sesi di reader, dan itu disengaja. Sebelumnya
 * ada dua baris yang mengatakan hal yang sama dengan cara berbeda: indikator
 * "Sesi terverifikasi aktif" di bar fokus, lalu panel "Catatan kejadian sesi"
 * setinggi ~390px di bawahnya yang tidak bisa ditutup. Peserta membaca dua
 * judul untuk satu keadaan, dan isi modul — yang jadi tugas utamanya — terdorong
 * ke bawah lipatan di viewport 900px.
 *
 * Yang digabung bukan informasinya, hanya rumahnya: baris ringkas ini menyebut
 * status sesi, aturan bantuan, dan hitungan kejadian/celah apa adanya, lalu
 * seluruh penjelasan + pelaporan + catatan terakhir ada satu klik di bawahnya
 * lewat `aria-expanded`/`aria-controls`. Karena itu `CourseSessionIndicator`
 * tidak dirender lagi di reader (ia tetap dipakai di silabus, tempat tidak ada
 * catatan yang perlu dibuka).
 *
 * Tampil selama sesi aktif, atau saat masih ada celah tercatat.
 *
 * Hari ini `akhiri` mengosongkan daftar kejadian, jadi cabang kedua praktis
 * tidak pernah aktif; ia tetap ada supaya panel tidak bergantung pada
 * pembersihan itu — kalau kelak kejadian dipertahankan setelah sesi ditutup,
 * celah yang masih ada tetap dijelaskan alih-alih menghilang diam-diam.
 */
export function KejadianPanel() {
  const { status, akhiri, kebijakan, ringkasanKejadian } = useCourseSession();
  const [buka, setBuka] = useState(false);

  const bolehTampil = status === "aktif" || ringkasanKejadian.celah > 0;
  if (!bolehTampil) return null;

  const adaCelah = ringkasanKejadian.celah > 0;
  const aktif = status === "aktif";

  return (
    <section
      aria-labelledby="judul-panel-kejadian"
      /* Jorongnya ada di sini, bukan di pembungkus shell. `KejadianPanel`
         mengembalikan `null` saat tidak relevan, jadi jorong yang menempel di
         luar akan tetap menyisakan pita kosong — dan di `xl` pita itulah yang
         mendorong tepi atas drawer tutor menjauh dari bar fokus. */
      className="mx-3 mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white sm:mx-5"
    >
      {/* Judul asli tetap ada sebagai heading supaya section ini punya nama di
          accessibility tree; label yang terlihat hidup di dalam tombol, dan
          `<h3>` tidak boleh berada di dalam `<button>` (heading adalah flow
          content, bukan phrasing content). */}
      <h3 id="judul-panel-kejadian" className="sr-only">
        Catatan kejadian sesi
      </h3>

      <div className="flex items-center gap-1.5 pr-1.5">
        <button
          type="button"
          onClick={() => setBuka((v) => !v)}
          aria-expanded={buka}
          aria-controls="isi-panel-kejadian"
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg px-3.5 py-2.5 text-left transition-colors hover:bg-gray-50 active:bg-gray-100"
        >
          <span
            aria-hidden="true"
            className={cn(
              "relative grid size-8 shrink-0 place-items-center rounded-full",
              adaCelah ? "bg-amber-100 text-amber-700" : "bg-emerald-50 text-emerald-600",
            )}
          >
            <RiPulseLine className="size-4" />
            {/* Titik denyut hanya saat sesi benar-benar berjalan. Ia memakai
                `.status-pulse`, yang sudah dimatikan `prefers-reduced-motion`
                di `globals.css` — bukan animasi baru yang harus dijaga sendiri. */}
            {aktif ? (
              <span
                aria-hidden="true"
                className="status-pulse absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-white"
              />
            ) : null}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-gray-900">
              {aktif ? "Sesi terverifikasi aktif" : "Sesi terverifikasi berakhir"}
            </span>
            {/* Hitungan apa adanya, termasuk nol: peserta berhak membedakan
                "tidak ada celah" dari "belum ada yang dicatat".

                Yang dijumlahkan adalah **total catatan**, bukan
                `ringkasanKejadian.kejadian` saja: nama field itu berarti "yang
                bukan celah", sehingga mencetaknya apa adanya menghasilkan
                "1 kejadian · 1 celah pengawasan" untuk run dengan dua catatan —
                angka yang terbaca seperti total padahal bukan. Kata "catatan"
                juga memisahkannya dari "kejadian", yang di panel ini dipakai
                sebagai nama salah satu klasifikasi. */}
            <span
              className={cn(
                "mt-0.5 block truncate text-[11.5px] tabular-nums",
                adaCelah ? "font-medium text-amber-700" : "text-gray-500",
              )}
            >
              {ringkasanKejadian.kejadian + ringkasanKejadian.celah} catatan ·{" "}
              {adaCelah ? `${ringkasanKejadian.celah} celah pengawasan` : "tidak ada celah"}
              <span className="hidden sm:inline">
                {" · "}
                {LABEL_ATURAN_BANTUAN[kebijakan.aturan_bantuan]}
              </span>
            </span>
          </span>

          <span className="hidden shrink-0 items-center gap-1 text-[11.5px] font-semibold text-gray-500 sm:inline-flex">
            {buka ? "Tutup" : "Detail"}
            <RiArrowDownSLine
              aria-hidden="true"
              className={cn(
                "size-3.5 transition-transform duration-200 ease-out",
                buka && "rotate-180",
              )}
            />
          </span>
          {/* Di bawah `sm` label teksnya tidak muat; chevron tetap ada sebagai
              satu-satunya penanda bahwa baris ini membuka sesuatu. */}
          <RiArrowDownSLine
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0 text-gray-400 transition-transform duration-200 ease-out sm:hidden",
              buka && "rotate-180",
            )}
          />
        </button>

        {/* "Akhiri sesi" di luar tombol disclosure: ia adalah aksi, bukan
            navigasi. Menyarangkan <button> di dalam <button> tidak sah, dan
            menaruhnya di dalam area yang bisa dibuka berarti menekannya juga
            menutup/membuka panel. */}
        {aktif ? (
          <button
            type="button"
            onClick={() => void akhiri()}
            className="shrink-0 cursor-pointer rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 active:scale-[0.97]"
          >
            Akhiri sesi
          </button>
        ) : null}
      </div>

      {/* `hidden`, bukan render bersyarat: `aria-controls` yang menunjuk id tidak
          ada melanggar ARIA, dan membiarkan node-nya ada membuat id itu selalu
          sah. Atribut `hidden` juga mengeluarkan isinya dari urutan tab dan dari
          accessibility tree, jadi kendali di dalamnya tidak bisa dijangkau saat
          panel tertutup. */}
      <div
        id="isi-panel-kejadian"
        hidden={!buka}
        className="border-t border-gray-200 px-3.5 py-3.5"
      >
        <IsiPanelKejadian />
      </div>
    </section>
  );
}
