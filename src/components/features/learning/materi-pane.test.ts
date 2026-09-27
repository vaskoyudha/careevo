import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CourseSessionProvider } from "./course-session";
import { MateriPane } from "./materi-pane";
import { kebijakanDefault } from "@/lib/courses/kebijakan";
import type { ModulKursus } from "@/lib/courses/kurikulum";
import type { Halaman, Submodul } from "@/types/course";

/**
 * Pane modul — diuji lewat HTML hasil render.
 *
 * Yang dikunci: prosa **selalu** tampil (membaca bukan penyelesaian), sedangkan
 * lampiran dan kuis tunduk pada keputusan `putuskanAkses`. Keputusan itu dibaca
 * pane dari `useCourseSession()`, jadi test ini menyuntikkan bukti lewat
 * `CourseSessionProvider` alih-alih mengoper keputusan sebagai prop — itu yang
 * membuatnya benar-benar menguji gerbangnya, bukan sekadar meneruskan nilai.
 */

function bab(id: string, halamanDaftar: Halaman[]): Submodul {
  return {
    id,
    modul_id: "crs-1-m1",
    course_id: "crs-1",
    judul: "Bagian 1",
    ringkasan: "",
    urutan: 1,
    halaman: halamanDaftar,
    created_at: "",
    updated_at: "",
  };
}

const HALAMAN = {
  id: "hal-1",
  submodul_id: "sub-m1",
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
  // `halaman` (rata) dan `submodul` (pohon) sama-sama dibawa oleh `ModulKursus`
  // hasil resolver. Di sini keduanya diisi konsisten: `halamanDipilih` membaca
  // pohonnya, jadi fixture yang hanya mengisi `halaman` akan menjawab `null`.
  halaman: [HALAMAN],
  submodul: [bab("sub-m1", [HALAMAN])],
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
 * `halamanAwal` adalah nilai `?halaman=` apa adanya dari `page.tsx`.
 */
function render(
  bukti: string | null,
  modul: ModulKursus = MODUL,
  halamanAwal?: string | null,
) {
  // `children` lewat properti, bukan argumen ketiga: di React 19 types
  // `children` wajib pada `CourseSessionProvider` dan bentuk tiga-argumen gagal
  // `npm run typecheck` (TS2769). Sama seperti helper Task 3 dan Task 5.
  const isi = {
    courseId: "crs-1",
    kebijakan: kebijakanDefault(),
    buktiAwal: bukti,
    runIdAwal: bukti ? "run-1" : null,
    children: createElement(MateriPane, { kursusId: "crs-1", modul, halamanAwal }),
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

/**
 * Halaman yang dirender berasal dari **URL** (`?halaman=`), bukan state lokal.
 *
 * Itu yang membuat satu halaman bisa dibagikan, tombol kembali peramban bekerja,
 * dan panel silabus bisa menyorot baris yang sama. Dua sifat yang dijaga di sini:
 * id yang dikenal dirender, dan id yang tidak dikenal jatuh ke halaman **pertama**
 * (aturan `halamanDipilih`, bukan `null` yang akan menampilkan pane tanpa prosa).
 */
describe("MateriPane — halaman dari URL", () => {
  const HALAMAN_SATU = { ...HALAMAN, id: "hal-1", judul: "Halaman Satu", urutan: 1 };
  const HALAMAN_DUA = {
    ...HALAMAN,
    id: "hal-2",
    judul: "Halaman Dua",
    urutan: 2,
    blok: [{ id: "b2", tipe: "paragraf" as const, segmen: [{ teks: "Isi kedua." }] }],
  };
  const DUA_HALAMAN: ModulKursus = {
    ...MODUL,
    halaman: [HALAMAN_SATU, HALAMAN_DUA],
    submodul: [bab("sub-m1", [HALAMAN_SATU, HALAMAN_DUA])],
  };

  it("merender halaman pertama saat tidak ada ?halaman=", () => {
    const html = render("token.abc", DUA_HALAMAN);
    expect(html).toContain("Halaman Satu");
    expect(html).not.toContain("Isi kedua.");
  });

  it("merender halaman yang diminta ?halaman=", () => {
    const html = render("token.abc", DUA_HALAMAN, "hal-2");
    expect(html).toContain("Halaman Dua");
    expect(html).toContain("Isi kedua.");
  });

  it("jatuh ke halaman pertama saat ?halaman= basi", () => {
    // `?halaman=` adalah masukan dari URL: tautan lama atau halaman yang dihapus
    // admin bukan galat, dan pane tanpa prosa bukan jawaban yang benar.
    const html = render("token.abc", DUA_HALAMAN, "hal-yang-sudah-dihapus");
    expect(html).toContain("Halaman Satu");
  });

  it("memberi pager sebagai tautan ?halaman=, bukan tombol ber-state", () => {
    // Tanpa `onPindahHalaman`, pager merender `Link`. Kalau pane kembali
    // mengoper callback-nya, tautan itu hilang — dan dengan itu, sifat
    // "halaman bisa dibagikan" yang jadi alasan perubahan ini.
    const html = render("token.abc", DUA_HALAMAN);
    expect(html).toContain("Halaman berikutnya: Halaman Dua");
    expect(html).toContain("?halaman=");
  });
});
