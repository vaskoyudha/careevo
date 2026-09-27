"use client";

import { HalamanView } from "./halaman-view";
import { KodeView } from "./kode-view";
import { blokKodeDijalankan } from "@/lib/courses/blok";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import type { Halaman } from "@/types/course";

/**
 * Tata letak lab kode — dua kolom untuk halaman yang isinya satu latihan.
 *
 * Susunannya: **kiri bahan belajar**, **kanan editor di atas + hasil di bawah**.
 * Kiri memakai `HalamanView` yang sama dengan jalur baca biasa (bukan renderer
 * kedua), hanya dengan blok latihannya disembunyikan: editor itu sudah pindah ke
 * kolom kanan, dan menampilkannya di sini akan memberi dua editor untuk satu
 * latihan.
 *
 * ## Kenapa komponen terpisah, bukan cabang di `MateriPane`
 *
 * `MateriPane` sudah memutuskan **apakah** halaman ini ber-lab (lewat
 * `halamanPunyaLabKode`) dan menyusun urutan bagian (lab, lalu kuis, lalu
 * lampiran). Komponen ini hanya menyusun dua kolom di dalam bagian lab itu. Kalau
 * keputusan "ber-lab atau tidak" ikut pindah ke sini, `MateriPane` dan komponen
 * ini harus menjawab pertanyaan yang sama, dan jawaban yang menyimpang tidak
 * memunculkan error — hanya tata letak yang salah untuk satu halaman.
 *
 * ## Kenapa editor bisa diketik di sini, padahal di jalur baca tidak
 *
 * Jalur baca menampilkan blok kode sebagai contoh: `editable` mati, dan hanya
 * tombol Jalankan yang tersedia. Di lab, mengetik adalah **tujuan halamannya** —
 * peserta menulis programnya sendiri sebelum menjalankannya. Karena itu editor
 * di sini menyala `editable`. Yang tetap sama: teks yang dijalankan adalah isi
 * editor (`KodeView` menyimpannya di `localStorage`), dan ia tidak pernah menjadi
 * bukti apa pun.
 *
 * ## Kenapa `lg:sticky` pada kolom kanan
 *
 * Peserta membaca bahan di kiri sambil mengedit di kanan. Tanpa `sticky`, editor
 * ikut tergulir naik begitu bahannya panjang, dan yang tersisa di layar hanya
 * hasil di bawahnya. Menempelkan kolom kanan membuat editor dan hasilnya tetap
 * terlihat selama bahan di kiri digulir — perilaku yang diharapkan dari lab.
 * Di bawah `lg` kedua kolom menumpuk, jadi `sticky` tidak berguna dan dimatikan.
 */
export function KodeLab({
  modul,
  halaman,
}: {
  modul: ModulKursus;
  halaman: Halaman;
}) {
  /**
   * Blok latihan yang diangkat ke editor.
   *
   * `[0]` aman karena `halamanPunyaLabKode` mensyaratkan **tepat satu** blok
   * yang bisa dijalankan — halaman dengan nol atau lebih dari satu tidak pernah
   * sampai ke sini. Yang membuat janji itu hidup adalah predikat yang sama yang
   * dipakai `MateriPane`; menambah latihan kedua ke sebuah halaman otomatis
   * mengeluarkannya dari tata letak ini, bukan diam-diam menampilkan yang
   * pertama.
   */
  const blok = blokKodeDijalankan(halaman)[0];
  if (!blok) return null;

  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
      {/* Kolom bahan belajar. Blok latihannya disembunyikan — lihat catatan atas. */}
      <div className="min-w-0">
        <HalamanView modul={modul} halaman={halaman} sembunyikanKodeDijalankan />
      </div>

      {/* Kolom editor: editor di atas, hasil di bawah. `lg:sticky` menahannya di
          dalam viewport saat bahan di kiri digulir, dengan `top-4` sebagai
          napas kecil dari tepi atas area baca (bar fokus sudah baris terpisah
          di atasnya, jadi tidak ada yang perlu dihindari). */}
      <div className="min-w-0 lg:sticky lg:top-4">
        <section
          aria-label="Latihan kode"
          className="overflow-hidden rounded-2xl border border-gray-200 bg-white"
        >
          <header className="flex items-center justify-between gap-2 border-b border-gray-200 bg-[#f5f7fa] px-4 py-2">
            <span className="font-mono text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              {blok.bahasa === "cpp" ? "C++" : (blok.bahasa ?? "cpp")}
            </span>
            <span className="text-[11px] text-gray-500">Latihan</span>
          </header>
          <div className="p-4">
            <KodeView
              susunan="lab"
              kunci={blok.id}
              kode={blok.kode ?? ""}
              kodeAwal={blok.kodeAwal}
              stdin={blok.stdin}
              dapatJalankan={blok.dapatDijalankan === true}
              editable
              bahasa={blok.bahasa ?? "cpp"}
              label={`Editor latihan ${blok.id}`}
            />
          </div>

          {/*
            Keluaran yang diharapkan — acuan peserta.

            Blok latihan disembunyikan dari kolom kiri, jadi tanpa baris ini
            `outputHarapan` hilang sama sekali dan peserta kehilangan satu-satunya
            patokan "programku benar kalau keluarannya begini". Ia sengaja
            ditempatkan **di bawah** hasil jalannya, bukan di atasnya: yang
            dibandingkan peserta lebih dulu adalah keluarannya sendiri, lalu
            acuannya.
          */}
          {blok.outputHarapan ? (
            <div className="border-t border-gray-200 bg-[#f5f7fa] px-4 py-3">
              <p className="mb-1 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                Keluaran yang diharapkan
              </p>
              <pre className="overflow-x-auto font-mono text-[12.5px] whitespace-pre-wrap text-gray-700">
                {blok.outputHarapan}
              </pre>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
