import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KuisView } from "./kuis-view";
import type { Kuis, SoalKuis } from "@/types/course";

/**
 * Renderer kuis — diuji lewat HTML yang benar-benar dihasilkan.
 *
 * Dua hal yang paling penting di sini tidak terlihat dari tipe: bahwa teks dari
 * bank soal dirender sebagai teks (bukan HTML mentah), dan bahwa jawaban benar
 * tidak ikut terlihat di markup sebelum peserta menekan "Periksa jawaban".
 * Repo ini tidak punya sanitizer, jadi yang pertama adalah aturan keras.
 *
 * Memakai `React.createElement`, bukan JSX, karena `vitest.config.mts` hanya
 * menyertakan `src/**\/*.test.ts` — berkas `.tsx` tidak ikut dijalankan.
 */

const SOAL: SoalKuis = {
  id: "s1",
  pertanyaan: "Apa kegunaan useState?",
  pilihan: ["Menyimpan state lokal", "Mengambil data HTTP"],
  jawaban_benar: 0,
};

function kuisDengan(over: Partial<Kuis> = {}): Kuis {
  return {
    id: "kuis-1",
    judul: "Kuis Dasar Hooks",
    deskripsi: "Uji pemahaman dasar.",
    soal: [SOAL],
    nilai_lulus: 70,
    created_at: "2026-09-24T00:00:00.000Z",
    updated_at: "2026-09-24T00:00:00.000Z",
    ...over,
  };
}

function render(over: Partial<Kuis> = {}) {
  return renderToStaticMarkup(createElement(KuisView, { kuis: kuisDengan(over) }));
}

describe("KuisView — isi", () => {
  it("merender judul, deskripsi, dan seluruh pertanyaan", () => {
    const html = render();

    expect(html).toContain("Kuis Dasar Hooks");
    expect(html).toContain("Uji pemahaman dasar.");
    expect(html).toContain("Apa kegunaan useState?");
  });

  it("merender setiap pilihan sebagai radio", () => {
    const html = render();

    expect(html).toContain("Menyimpan state lokal");
    expect(html).toContain("Mengambil data HTTP");
    expect(html.match(/type="radio"/g)).toHaveLength(2);
  });

  it("mengelompokkan radio per soal lewat nama yang sama", () => {
    // Tanpa nama unik per soal, memilih jawaban di satu soal akan melepas
    // pilihan di soal lain — radio hanya bisa satu per grup nama.
    const html = render({
      soal: [SOAL, { ...SOAL, id: "s2", pertanyaan: "Pertanyaan kedua?" }],
    });

    const nama = [...html.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
    expect(nama).toHaveLength(4);
    // Dua soal × dua pilihan, tapi hanya dua nama berbeda: nama yang sama
    // dipakai berulang untuk pilihan-pilihan dalam satu soal.
    expect(new Set(nama).size).toBe(2);
  });

  it("memberi nama radio berbeda untuk instans kuis yang berbeda", () => {
    // Ini kasus yang jadi alasan kuis dipisahkan ke bank soal: SATU kuis
    // dipasang di BEBERAPA modul. Bila nama radionya diturunkan dari id kuis,
    // kedua salinan berbagi grup radio — menjawab di modul A membatalkan
    // jawaban di modul B, dan hitungan "terjawab" salah di keduanya.
    //
    // Kedua instans harus berada dalam SATU pohon render, persis seperti di
    // halaman belajar. Dua panggilan `renderToStaticMarkup` terpisah akan
    // me-reset penghitung `useId`, sehingga keduanya kebetulan memakai id yang
    // sama dan test-nya lulus/ gagal karena artefak alat, bukan perilaku.
    const kuis = kuisDengan();
    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(KuisView, { kuis, key: "a" }),
        createElement(KuisView, { kuis, key: "b" }),
      ),
    );

    const nama = [...html.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
    expect(nama).toHaveLength(4);
    // Dua instans × satu soal × dua pilihan, tapi hanya DUA nama berbeda:
    // satu grup per instans.
    expect(new Set(nama).size).toBe(2);
  });

  it("menyebut jumlah soal dan ambang lulus", () => {
    const html = render();

    expect(html).toContain("1 soal");
    expect(html).toContain("lulus 70");
  });

  it("menyembunyikan deskripsi bila kosong", () => {
    const html = render({ deskripsi: "" });

    expect(html).toContain("Kuis Dasar Hooks");
    expect(html).not.toContain("Uji pemahaman dasar.");
  });

  it("mengurutkan soal sesuai urutan di bank", () => {
    const html = render({
      soal: [
        { ...SOAL, id: "a", pertanyaan: "Pertanyaan pertama?" },
        { ...SOAL, id: "b", pertanyaan: "Pertanyaan kedua?" },
      ],
    });

    expect(html.indexOf("Pertanyaan pertama?")).toBeLessThan(html.indexOf("Pertanyaan kedua?"));
  });
});

describe("KuisView — kontrol", () => {
  it("menonaktifkan tombol periksa selama belum semua soal terjawab", () => {
    // Menilai kuis yang setengah terjawab akan menampilkan angka yang
    // menyesatkan; tombolnya harus menunggu sampai semua dijawab.
    const html = render({ soal: [SOAL, { ...SOAL, id: "s2" }] });

    expect(html).toContain("disabled");
    expect(html).toContain("0 dari 2 soal terjawab");
  });

  it("tidak menampilkan tombol ulangi sebelum dinilai", () => {
    expect(render()).not.toContain("Ulangi");
  });

  it("tidak menampilkan hasil sebelum diperiksa", () => {
    // Kunci jawaban tidak boleh terlihat di markup sebelum peserta menjawab:
    // menampilkannya lebih awal membocorkan seluruh kuis.
    const html = render();

    expect(html).not.toContain("Nilaimu");
    expect(html).not.toContain("Lulus!");
  });
});

describe("KuisView — keamanan teks", () => {
  it("merender HTML di judul sebagai teks, bukan elemen", () => {
    // Repo ini tidak punya sanitizer, jadi teks dari bank soal harus selalu
    // dirender sebagai teks. Sebuah <script> di judul tidak boleh menjadi
    // elemen — inilah aturan yang menjaga lubang XSS tersimpan tetap tertutup.
    const html = render({ judul: "<script>alert(1)</script>" });

    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("merender HTML di pertanyaan dan pilihan sebagai teks", () => {
    const html = render({
      soal: [
        {
          ...SOAL,
          pertanyaan: "<img src=x onerror=alert(1)>",
          pilihan: ["<b>tebal</b>", "biasa"],
        },
      ],
    });

    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>tebal</b>");
    expect(html).toContain("&lt;img");
  });

  it("merender HTML di deskripsi sebagai teks", () => {
    const html = render({ deskripsi: "<script>alert(1)</script>" });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
