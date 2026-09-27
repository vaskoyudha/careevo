"use client";

import { HalamanView } from "./halaman-view";
import { MateriView } from "./materi-view";
import { KuisView } from "./kuis-view";
import { CourseSessionGate, useCourseSession } from "./course-session";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import { halamanDipilih } from "@/lib/courses/halaman";
import { modulPunyaIsi } from "@/lib/courses/silabus";
import type { TipeMateri } from "@/types/course";

/**
 * Label jenis lampiran.
 *
 * `Record<TipeMateri, string>`, bukan `if`/ternary: menambah varian `TipeMateri`
 * baru harus menjadi error tipe di sini, bukan chip yang diam-diam berbunyi
 * "PDF" untuk jenis yang tidak dikenal.
 */
const LABEL_TIPE: Record<TipeMateri, string> = {
  video: "Video",
  pdf: "PDF",
};

/**
 * Isi satu modul di reader.
 *
 * Urutannya mengikuti alur belajar yang lama — prosa dulu, lalu kuis, lalu
 * lampiran — supaya peserta tidak perlu belajar ulang tata letaknya. Yang
 * berubah hanya rumahnya: dulu ini dirender di dalam akordeon daftar modul,
 * sekarang di pane reader.
 *
 * Keputusan akses dibaca **di sini**, dari `useCourseSession()`, bukan dioper
 * sebagai prop. Pane dirender oleh `page.tsx` yang berada di bawah
 * `CourseSessionProvider` di layout, jadi konteksnya tersedia; dan karena
 * keputusannya dihitung saat render (bukan disimpan di state), gerbangnya tidak
 * bisa tertinggal basi ketika sesi dimulai atau diakhiri.
 *
 * Halaman yang sedang dibaca datang dari **URL** (`?halaman=<id>`, dibaca
 * `page.tsx` dan dioper sebagai `halamanAwal`), bukan dari state lokal. Itu yang
 * membuat satu halaman bisa dibagikan, tombol kembali peramban bekerja, dan
 * panel silabus bisa menyorot baris yang benar: keduanya membaca alamat yang
 * sama. Pager di `HalamanView` menulis bentuk yang sama, jadi tidak ada dua cara
 * berpindah halaman. Aturan "id basi → halaman pertama" hidup di
 * `halamanDipilih()`, satu tempat untuk pane maupun panel.
 *
 * Panel tutor AI **tidak** di sini: ia pindah ke drawer (spec §3.7).
 */
export function MateriPane({
  kursusId,
  modul,
  halamanAwal,
}: {
  kursusId: string;
  modul: ModulKursus;
  /** Nilai `?halaman=` apa adanya; `undefined`/basi berarti halaman pertama. */
  halamanAwal?: string | null;
}) {
  const { boleh } = useCourseSession();
  const keputusanLampiran = boleh("materi");
  const keputusanKuis = boleh("kuis");

  const daftarMateri = modul.materi ?? [];
  const daftarKuis = modul.kuis ?? [];
  const halamanAktif = halamanDipilih(modul, halamanAwal);

  if (!modulPunyaIsi(modul)) {
    // Modul turunan tidak punya isi tersimpan. Ia tidak berpura-pura punya pane
    // kosong: yang benar adalah mengantar ke materi eksternalnya.
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-bold tracking-tight text-gray-900">{modul.judul}</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">{modul.ringkasan}</p>
        <a
          href={modul.url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex rounded-full bg-[#0056D2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00419e]"
        >
          Buka materi eksternal ↗
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Prosa selalu bebas: membaca bukan penyelesaian, jadi tidak ada gerbang
          di atas `HalamanView`. Pager di dalamnya **tidak** diberi
          `onPindahHalaman`: tanpa callback ia merender `Link` ke
          `?halaman=<id>`, dan itulah yang membuat halaman punya alamat. */}
      {halamanAktif ? <HalamanView modul={modul} halaman={halamanAktif} /> : null}

      {daftarKuis.length > 0 ? (
        <section className="space-y-3">
          <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">Kuis</p>
          {/* Gerbang yang sama dengan lampiran: soal tidak dirender sebelum sesi
              terverifikasi tersedia. Pesan diambil apa adanya dari
              `putuskanAkses` supaya copy tidak menyimpang dari mesin akses. */}
          {keputusanKuis.tipe === "bebas" ? (
            daftarKuis.map((kuis) => (
              <KuisView key={kuis.id} kuis={kuis} konteks={{ courseId: kursusId, modulId: modul.id }} />
            ))
          ) : (
            <CourseSessionGate pesan={keputusanKuis.pesan} />
          )}
        </section>
      ) : null}

      {daftarMateri.length > 0 ? (
        <section className="space-y-3">
          <p className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            Lampiran
          </p>
          {keputusanLampiran.tipe === "bebas" ? (
            daftarMateri.map((materi) => (
              <div key={materi.id}>
                <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-gray-700">
                  <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#0056D2] uppercase">
                    {LABEL_TIPE[materi.tipe]}
                  </span>
                  {materi.judul}
                </p>
                <MateriView materi={materi} />
              </div>
            ))
          ) : (
            <CourseSessionGate pesan={keputusanLampiran.pesan} />
          )}
        </section>
      ) : null}
    </div>
  );
}
