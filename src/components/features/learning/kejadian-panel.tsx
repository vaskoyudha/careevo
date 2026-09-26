"use client";

import { useState } from "react";
import Link from "next/link";
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

export function KejadianPanel() {
  const { status, kejadian, ringkasanKejadian, laporKejadian } = useCourseSession();
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

  /**
   * Tampil selama sesi aktif, atau saat masih ada celah tercatat.
   *
   * Hari ini `akhiri` mengosongkan daftar kejadian, jadi cabang kedua praktis
   * tidak pernah aktif; ia tetap ada supaya panel tidak bergantung pada
   * pembersihan itu — kalau kelak kejadian dipertahankan setelah sesi ditutup,
   * celah yang masih ada tetap dijelaskan alih-alih menghilang diam-diam.
   */
  const bolehTampil = status === "aktif" || ringkasanKejadian.celah > 0;
  if (!bolehTampil) return null;

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
    <section
      aria-labelledby="judul-panel-kejadian"
      className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
    >
      <h3 id="judul-panel-kejadian" className="text-sm font-semibold text-gray-900">
        Catatan kejadian sesi
      </h3>

      <dl className="mt-3 flex flex-wrap gap-4">
        <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
          <dt className="text-[11px] font-medium tracking-wide text-gray-500 uppercase">Kejadian</dt>
          <dd className="mt-0.5 text-lg font-semibold text-gray-900">{ringkasanKejadian.kejadian}</dd>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <dt className="text-[11px] font-medium tracking-wide text-amber-700 uppercase">
            Celah pengawasan
          </dt>
          <dd className="mt-0.5 text-lg font-semibold text-amber-800">{ringkasanKejadian.celah}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-gray-700">
        Pindah tab, keluar layar penuh, menempel/menyalin teks panjang, dan pintasan tertentu
        dicatat untuk konteks. Kejadian ini tidak otomatis menggagalkan penilaian dan tidak
        mengurangi reputasimu.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-gray-600">
        Yang dicatat saat ini: pindah tab, fokus yang hilang, keluar layar penuh, dan pola
        menempel/menyalin teks panjang. Careevo <strong>belum</strong> mengakses kameramu — tidak
        ada aliran gambar yang dibuka, tidak ada wajah yang direkam, dan tidak ada yang dianalisis.
        Laporan kamera di bawah hanya mencatat apa yang kamu alami sendiri, supaya pengajar tahu
        konteksnya.
      </p>

      <fieldset className="mt-4">
        <legend className="text-xs font-semibold text-gray-700">Kamera: lapor apa yang kamu alami</legend>
        <div className="mt-1.5 flex flex-wrap gap-3">
          {(
            [
              ["kamera_gagal", "Kamera tidak mau menyala"],
              ["kamera_berhenti", "Kamera sempat mati"],
              ["kamera_mulai", "Kamera menyala lagi"],
            ] as const
          ).map(([nilai, label]) => (
            <label key={nilai} className="inline-flex items-center gap-1.5 text-xs text-gray-700">
              <input
                type="radio"
                name="jenis-laporan-kamera"
                value={nilai}
                checked={jenisLaporan === nilai}
                onChange={() => setJenisLaporan(nilai)}
                className="cursor-pointer"
              />
              {label}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-gray-500">
          Pilihan ini hanya menentukan catatan yang dikirim. Menekan tombol di bawah tidak menyalakan
          kamera.
        </p>
      </fieldset>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void laporkan()}
          disabled={mengirim}
          className="cursor-pointer rounded-full bg-[#0056D2] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {mengirim ? "Mencatat…" : "Laporkan gangguan"}
        </button>
        <Link href="/pengaturan" className="text-xs font-medium text-[#0056D2] underline">
          Atur cara kerja pencatatan di Pengaturan
        </Link>
      </div>

      {pesan ? (
        <p role="status" className="mt-2 text-xs text-gray-700">
          {pesan}
        </p>
      ) : null}

      {terakhir.length > 0 ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium text-gray-600">
            Lihat {kejadian.length} catatan terakhir
          </summary>
          <ul className="mt-2 space-y-1">
            {terakhir.map((k, i) => (
              <li key={`${k.jenis}-${i}`} className="flex items-center gap-2 text-xs text-gray-600">
                <span
                  aria-hidden="true"
                  className={
                    k.jenis_klasifikasi === "celah"
                      ? "size-1.5 rounded-full bg-amber-500"
                      : "size-1.5 rounded-full bg-gray-400"
                  }
                />
                <span className="font-medium text-gray-800">{LABEL_JENIS[k.jenis]}</span>
                <span className="text-gray-400">
                  {k.jenis_klasifikasi === "celah" ? "celah pengawasan" : "kejadian"}
                </span>
                <time dateTime={k.at} className="ml-auto text-gray-400">
                  {waktu(k.at)}
                </time>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-gray-500">
            Daftar ini hanya menampilkan beberapa catatan terakhir selama sesi ini.
          </p>
        </details>
      ) : null}
    </section>
  );
}
