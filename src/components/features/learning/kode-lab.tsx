"use client";

import { HalamanView } from "./halaman-view";
import { KodeView } from "./kode-view";
import { PembagiLab, useBagiLab } from "./pembagi-lab";
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
 * ## Kenapa `lg:sticky` pada kolom kanan, dan kenapa tingginya dipatok
 *
 * Peserta membaca bahan di kiri sambil mengedit di kanan. Tanpa `sticky`, editor
 * ikut tergulir naik begitu bahannya panjang, dan yang tersisa di layar hanya
 * hasil di bawahnya. Menempelkan kolom kanan membuat editor dan hasilnya tetap
 * terlihat selama bahan di kiri digulir — perilaku yang diharapkan dari lab.
 * Di bawah `lg` kedua kolom menumpuk, jadi `sticky` tidak berguna dan dimatikan.
 *
 * Tingginya **diambil dari sisa ruang baca**, bukan dihitung dari `100dvh`
 * dengan tebakan tinggi chrome. Rantainya: shell reader membagi tingginya lewat
 * `flex`, `MateriPane` meneruskan sisanya ke sini sebagai `flex-1`, dan kolom
 * kanan mengambil `h-full`-nya. Itu yang membuat editor bisa "penuh" tanpa angka
 * ajaib: apa pun yang ikut memakan tinggi di atasnya — ajakan sesi terverifikasi,
 * bar fokus, bar kaki, padding area baca — sudah dikurangi sebelum kolom ini
 * menerima ruangnya. Tinggi viewport yang dipatok dari jauh (pernah dicoba)
 * salah begitu `CourseSessionPrompt` muncul: kolomnya meleset turun dan dasarnya
 * terselip di balik bar kaki.
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

  /**
   * Pembagian kolom yang dipilih peserta (`pembagi-lab.tsx`). Disimpan per
   * halaman di `localStorage`, dan hanya berlaku di `lg` ke atas — di bawahnya
   * kedua kolom menumpuk, jadi tidak ada garis pembagi yang berguna.
   *
   * Hook-nya dipanggil **sebelum** `if (!blok) return null` karena aturan hook:
   * jumlah hook tidak boleh berbeda antar-render. Halaman yang tidak ber-lab
   * memang tidak sampai ke sini sama sekali (`MateriPane` yang memutuskan),
   * tetapi urutannya tetap dijaga supaya komponennya tidak rapuh.
   */
  const { kunci: kunciBagi, bagi, setBagi } = useBagiLab(halaman.id);

  if (!blok) return null;

  return (
    /**
     * Lebar kolom ditulis inline karena nilainya ditentukan peserta saat
     * berjalan; `data-pembagi-lab` adalah pegangan pembaginya untuk mengukur
     * wadah ini, dan `--lab-bagi` yang dibaca `.lab-lab` di `globals.css`.
     *
     * `lg:min-h-[20rem]` menjaga editor tetap punya ruang kerja yang layak saat
     * halaman juga memuat kuis atau lampiran — lab berbagi tinggi kolom dengan
     * saudara-saudaranya, dan di bawah lantai itu editor yang menyusut sampai
     * satu baris lebih buruk daripada kuismu terdorong sedikit ke bawah.
     */
    <div
      data-pembagi-lab
      style={{ ["--lab-bagi" as string]: `${bagi}fr 6px ${1 - bagi}fr` }}
      className="lab-lab grid grid-cols-1 items-stretch gap-x-5 gap-y-5 lg:min-h-[20rem] lg:flex-1"
    >
      {/* Kolom bahan belajar — menggulir di dalam kolomnya sendiri supaya kolom
          kanan yang menempel tidak pernah ikut tergulir. Blok latihannya
          disembunyikan, dan pagernya dimatikan: bar kaki reader sudah punya
          tombol maju, dan dua tombol "berikutnya" di satu layar dengan tujuan
          berbeda (halaman vs modul) terbaca sebagai duplikat.

          Kartunya direntangkan (`lab-kartu-penuh`) supaya dasarnya berhenti
          tepat di bar kaki, bukan menggantung dengan celah kosong di bawahnya
          saat prosanya pendek. Yang direntangkan **kartunya**, bukan paragrafnya:
          tinggi baris teks tetap ditentukan isinya. */}
      <div className="lab-kolom-kiri min-w-0 lg:h-full lg:overflow-y-auto lg:pr-1">
        <HalamanView
          modul={modul}
          halaman={halaman}
          sembunyikanKodeDijalankan
          sembunyikanPager
          className="lab-kartu-penuh"
        />
      </div>

      <PembagiLab kunci={kunciBagi} bagi={bagi} onBagi={setBagi} />

      {/* Kolom editor: editor di atas, hasil di bawah.

          **Tingginya mengikuti isi**, bukan `lg:h-full`. Versi pertama memakai
          `h-full` + `flex-1` supaya editor terlihat "penuh", dan hasilnya justru
          yang dikeluhkan: program 12 baris mendapat kotak gelap 548px — ~300px
          ruang kosong di dalam editor, dan tombol Jalankan melayang jauh dari
          kode terakhir. Tinggi editornya sekarang dibatasi lantai dan batas
          atasnya sendiri (`.kode-view-lab .cm-scroller`), jadi sisa ruangnya
          tinggal di dasar kolom, bukan di dalam kotak editor.

          `lg:sticky lg:top-4` tetap: kolom ini menempel di viewport saat bahan
          di kiri digulir, jadi editor dan hasilnya tidak ikut hilang ke atas. */}
      <div className="lab-kolom-kanan flex min-w-0 flex-col lg:sticky lg:top-4">
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
          className="min-h-0"
        />

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
          <section
            aria-label="Keluaran yang diharapkan"
            className="mt-3 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-[#f5f7fa]"
          >
            <div className="border-b border-gray-200 px-3.5 py-1.5">
              <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                Keluaran yang diharapkan
              </p>
            </div>
            <pre className="max-h-32 overflow-auto px-3.5 py-2.5 font-mono text-[12.5px] whitespace-pre-wrap text-gray-700">
              {blok.outputHarapan}
            </pre>
          </section>
        ) : null}
      </div>
    </div>
  );
}
