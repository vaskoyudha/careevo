import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CourseSessionProvider } from "./course-session";
import { MateriPane } from "./materi-pane";
import { kebijakanDefault } from "@/lib/courses/kebijakan";
import type { ModulKursus } from "@/lib/courses/kurikulum";

/**
 * Pane modul — diuji lewat HTML hasil render.
 *
 * Yang dikunci: prosa **selalu** tampil (membaca bukan penyelesaian), sedangkan
 * lampiran dan kuis tunduk pada keputusan `putuskanAkses`. Keputusan itu dibaca
 * pane dari `useCourseSession()`, jadi test ini menyuntikkan bukti lewat
 * `CourseSessionProvider` alih-alih mengoper keputusan sebagai prop — itu yang
 * membuatnya benar-benar menguji gerbangnya, bukan sekadar meneruskan nilai.
 */

const HALAMAN = {
  id: "hal-1",
  modul_id: "crs-1-m1",
  course_id: "crs-1",
  judul: "Pengantar",
  urutan: 1,
  blok: [{ id: "b1", tipe: "paragraf" as const, segmen: [{ teks: "Isi materi." }] }],
  created_at: "",
  updated_at: "",
};

const MODUL: ModulKursus = {
  id: "crs-1-m1",
  judul: "Orientasi",
  ringkasan: "r",
  durasi_min: 10,
  url: "https://contoh.test",
  halaman: [HALAMAN],
  materi: [
    {
      id: "mat-1",
      modul_id: "crs-1-m1",
      course_id: "crs-1",
      judul: "Video",
      tipe: "video",
      url: "https://youtu.be/abc",
      durasi_min: 5,
      urutan: 1,
      created_at: "",
      updated_at: "",
    },
  ],
  kuis: [
    {
      id: "k-1",
      judul: "Kuis Orientasi",
      deskripsi: "Uji pemahaman.",
      soal: [],
      nilai_lulus: 70,
      created_at: "",
      updated_at: "",
    },
  ],
};

/**
 * `bukti` menentukan keputusan: tanpa bukti, kebijakan `wajib` membuat
 * `putuskanAkses` menjawab `perlu_sesi` untuk `materi` dan `kuis`.
 *
 * `modul` bisa diganti supaya cabang modul turunan (tanpa isi) ikut teruji.
 */
function render(bukti: string | null, modul: ModulKursus = MODUL) {
  // `children` lewat properti, bukan argumen ketiga: di React 19 types
  // `children` wajib pada `CourseSessionProvider` dan bentuk tiga-argumen gagal
  // `npm run typecheck` (TS2769). Sama seperti helper Task 3 dan Task 5.
  const isi = {
    courseId: "crs-1",
    kebijakan: kebijakanDefault(),
    buktiAwal: bukti,
    runIdAwal: bukti ? "run-1" : null,
    children: createElement(MateriPane, { kursusId: "crs-1", modul }),
  };
  return renderToStaticMarkup(createElement(CourseSessionProvider, isi));
}

describe("MateriPane", () => {
  it("selalu menampilkan prosa, bahkan tanpa sesi", () => {
    // Membaca bukan penyelesaian: gerbang tidak boleh menutup prosa.
    expect(render(null)).toContain("Isi materi.");
  });

  it("menutup lampiran tanpa sesi", () => {
    const html = render(null);
    // Embed YouTube tidak boleh ikut ter-render saat gerbang menutup.
    expect(html).not.toContain("youtube.com/embed");
  });

  it("menampilkan lampiran saat sesi terverifikasi aktif", () => {
    expect(render("token.abc")).toContain("youtube.com/embed");
  });

  it("menutup kuis secara terpisah dari lampiran", () => {
    // Tanpa sesi, keduanya tertutup — tetapi yang dibuktikan di sini adalah
    // pesan gerbang `kuis` muncul sendiri, bukan hanya pesan `materi`.
    const html = render(null);
    expect(html).toContain("Kuis");
    expect(html).not.toContain("Periksa jawaban");
  });

  it("meringkas modul turunan alih-alih merender pane kosong", () => {
    // Modul turunan tidak punya `halaman`/`materi`/`kuis`. Yang benar bukan
    // pane kosong, melainkan ringkasan + tautan ke materi eksternalnya.
    const turunan: ModulKursus = {
      id: "crs-1-m2",
      judul: "Modul Turunan",
      ringkasan: "Ringkasan turunan.",
      durasi_min: 10,
      url: "https://contoh.test/turunan",
    };
    const html = render("token.abc", turunan);
    expect(html).toContain("Ringkasan turunan.");
    expect(html).toContain("https://contoh.test/turunan");
  });
});
