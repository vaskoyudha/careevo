import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MateriRail } from "./materi-rail";
import type { ModulKursus } from "@/lib/courses/kurikulum";

/**
 * Rail — diuji lewat HTML hasil render.
 *
 * Yang dikunci: rail memuat **semua** modul (bukan hanya yang aktif), dan tiap
 * baris menautkan ke URL reader modulnya. Kalau hanya modul aktif yang dirender,
 * peta kemajuan yang menetap — alasan reader ini ada — hilang.
 */

function modul(over: Partial<ModulKursus> & { id: string; judul: string }): ModulKursus {
  return { ringkasan: "ringkasan", durasi_min: 10, url: "https://contoh.test", ...over };
}

const KURIKULUM: ModulKursus[] = [
  modul({ id: "crs-1-m1", judul: "Orientasi" }),
  modul({
    id: "crs-1-m2",
    judul: "Mendalami React",
    halaman: [
      {
        id: "hal-1",
        modul_id: "crs-1-m2",
        course_id: "crs-1",
        judul: "Pengantar",
        urutan: 1,
        blok: [],
        created_at: "",
        updated_at: "",
      },
    ],
    kuis: [
      {
        id: "k-1",
        judul: "Kuis React",
        deskripsi: "Uji pemahaman React.",
        soal: [],
        nilai_lulus: 70,
        created_at: "",
        updated_at: "",
      },
    ],
  }),
  modul({ id: "crs-1-m3", judul: "Penutup" }),
];

function render(modulAktif = "crs-1-m1", selesai: string[] = []) {
  return renderToStaticMarkup(
    createElement(MateriRail, { slug: "kursus-uji", modul: KURIKULUM, modulAktif, selesai }),
  );
}

describe("MateriRail", () => {
  it("memuat setiap modul, bukan hanya yang aktif", () => {
    const html = render();
    expect(html).toContain("Orientasi");
    expect(html).toContain("Mendalami React");
    expect(html).toContain("Penutup");
  });

  it("menautkan tiap modul ke URL reader-nya", () => {
    const html = render();
    expect(html).toContain('href="/belajar/kursus-uji/materi/crs-1-m1"');
    expect(html).toContain('href="/belajar/kursus-uji/materi/crs-1-m2"');
    expect(html).toContain('href="/belajar/kursus-uji/materi/crs-1-m3"');
  });

  it("menandai modul yang sedang dibuka dengan aria-current", () => {
    const html = render("crs-1-m2");
    // `aria-current="page"` hanya pada satu baris — yang aktif.
    expect(html.match(/aria-current="page"/g) ?? []).toHaveLength(1);
  });

  it("menandai modul yang sudah selesai", () => {
    const html = render("crs-1-m1", ["crs-1-m1"]);
    expect(html).toContain("Selesai");
  });

  it("menghitung sub-item per modul", () => {
    const html = render();
    // Modul 2 punya 1 halaman + 1 kuis; modul 1 dan 3 tidak punya isi.
    expect(html).toContain("1 halaman");
    expect(html).toContain("1 kuis");
  });

  it("membuang baris meta di bentuk ciut, tapi tetap memuat semua modul", () => {
    /**
     * Bentuk ciut bukan daftar lain: ia daftar yang **sama**, hanya tanpa baris
     * meta. Kalau `ringkas` sampai menyaring modul, rail ciut berhenti menjadi
     * peta kemajuan — dan itu satu-satunya alasan rail ini ada.
     */
    const html = renderToStaticMarkup(
      createElement(MateriRail, {
        slug: "kursus-uji",
        modul: KURIKULUM,
        modulAktif: "crs-1-m1",
        selesai: [],
        ringkas: true,
      }),
    );
    expect(html).toContain("Orientasi");
    expect(html).toContain("Mendalami React");
    expect(html).toContain("Penutup");
    expect(html).toContain('href="/belajar/kursus-uji/materi/crs-1-m2"');
    expect(html.match(/aria-current="page"/g) ?? []).toHaveLength(1);
    // Meta yang dibuang: di 104px ia jadi dua baris 10px yang tidak terbaca.
    expect(html).not.toContain("1 halaman");
    expect(html).not.toContain(" mnt");
    // Judul panel ikut hilang (tidak muat), tapi nama nav-nya tidak — pembaca
    // layar masih mendengar "Daftar modul".
    expect(html).not.toContain(">Daftar modul<");
    expect(html).toContain('aria-label="Daftar modul"');
    // Nama penuh modul tetap terjangkau lewat tooltip, karena judulnya terpotong.
    expect(html).toContain('title="2. Mendalami React"');
  });

  it("menjaga status selesai terbaca saat judulnya terpotong", () => {
    // Centangnya `aria-hidden`, jadi di bentuk ciut satu-satunya penanda
    // "selesai" yang tersisa bagi pembaca layar adalah teks ini.
    const html = renderToStaticMarkup(
      createElement(MateriRail, {
        slug: "kursus-uji",
        modul: KURIKULUM,
        modulAktif: "crs-1-m1",
        selesai: ["crs-1-m1"],
        ringkas: true,
      }),
    );
    expect(html).toContain("Selesai");
  });
});
