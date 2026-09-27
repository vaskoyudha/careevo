"use client";

import { useState } from "react";
import { HalamanView } from "./halaman-view";
import { MateriView } from "./materi-view";
import { KuisView } from "./kuis-view";
import { CourseSessionGate, useCourseSession } from "./course-session";
import type { ModulKursus } from "@/lib/courses/kurikulum";
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
 * Halaman yang sedang dibaca juga state lokal di sini. Dulu ia di shell, tetapi
 * shell ada di `layout.tsx` yang tidak punya akses ke `modulId` anaknya — dan
 * pager halaman memang milik satu modul, jadi tempatnya di sini.
 *
 * Panel tutor AI **tidak** di sini: ia pindah ke drawer (spec §3.7).
 */
export function MateriPane({ kursusId, modul }: { kursusId: string; modul: ModulKursus }) {
  const { boleh } = useCourseSession();
  const keputusanLampiran = boleh("materi");
  const keputusanKuis = boleh("kuis");

  const [halamanTerpilih, setHalamanTerpilih] = useState<string | null>(null);

  const daftarHalaman = [...(modul.halaman ?? [])].sort((a, b) => a.urutan - b.urutan);
  const daftarMateri = modul.materi ?? [];
  const daftarKuis = modul.kuis ?? [];
  // Halaman yang ditampilkan: yang dipilih peserta, atau halaman pertama.
  const halamanAktif =
    daftarHalaman.find((h) => h.id === halamanTerpilih) ?? daftarHalaman[0] ?? null;
  const adaIsi = daftarHalaman.length > 0 || daftarMateri.length > 0 || daftarKuis.length > 0;

  if (!adaIsi) {
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
          di atas `HalamanView`. */}
      {halamanAktif ? (
        <HalamanView modul={modul} halaman={halamanAktif} onPindahHalaman={setHalamanTerpilih} />
      ) : null}

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
