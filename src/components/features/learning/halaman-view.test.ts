import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HalamanView } from "./halaman-view";
import type { BlokHalaman, Halaman, Modul } from "@/types/course";

/**
 * Renderer halaman — diuji lewat HTML yang benar-benar dihasilkan.
 *
 * Ini pengujian yang paling langsung atas bagian ini: peta dari model data ke
 * HTML (tebal, miring, heading, ukuran huruf, backlink) adalah inti fiturnya,
 * dan hanya render sungguhan yang membuktikannya. Test unit pada `blok.ts`
 * memeriksa perhitungannya; di sini yang diperiksa adalah hasil akhirnya.
 *
 * Memakai `React.createElement`, bukan JSX, karena `vitest.config.mts` hanya
 * menyertakan `src/**\/*.test.ts` — berkas `.tsx` tidak ikut dijalankan.
 */

function halamanDengan(blok: BlokHalaman[], judul = "Halaman Uji"): Halaman {
  return {
    id: "hal-1",
    submodul_id: "sub-1",
    modul_id: "mod-1",
    course_id: "crs-1",
    judul,
    urutan: 1,
    blok,
    created_at: "2026-09-24T00:00:00.000Z",
    updated_at: "2026-09-24T00:00:00.000Z",
  };
}

function render(blok: BlokHalaman[], daftarHalaman?: Halaman[]) {
  const halaman = halamanDengan(blok);
  // Pager "halaman berikutnya" merata dari **bab**: halaman-halaman uji ini
  // disajikan sebagai satu bab, bentuk yang sama dengan yang dilihat peserta.
  const modul: Pick<Modul, "submodul"> = {
    submodul: [
      {
        id: "sub-1",
        modul_id: "mod-1",
        course_id: "crs-1",
        judul: "Bagian 1",
        ringkasan: "",
        urutan: 1,
        halaman: daftarHalaman ?? [halaman],
        created_at: "2026-09-24T00:00:00.000Z",
        updated_at: "2026-09-24T00:00:00.000Z",
      },
    ],
  };
  return renderToStaticMarkup(createElement(HalamanView, { modul, halaman }));
}

/** Modul satu-bab dari daftar halaman — bentuk yang dipakai pager. */
function modulSatuBab(daftar: Halaman[]): Pick<Modul, "submodul"> {
  return {
    submodul: [
      {
        id: "sub-1",
        modul_id: "mod-1",
        course_id: "crs-1",
        judul: "Bagian 1",
        ringkasan: "",
        urutan: 1,
        halaman: daftar,
        created_at: "2026-09-24T00:00:00.000Z",
        updated_at: "2026-09-24T00:00:00.000Z",
      },
    ],
  };
}

describe("HalamanView — format sebaris", () => {
  it("merender tebal sebagai <strong>", () => {
    const html = render([
      { id: "p1", tipe: "paragraf", segmen: [{ teks: "kata", tebal: true }] },
    ]);
    expect(html).toContain("<strong");
    expect(html).toContain("kata");
  });

  it("merender miring sebagai <em>", () => {
    const html = render([
      { id: "p1", tipe: "paragraf", segmen: [{ teks: "kata", miring: true }] },
    ]);
    expect(html).toContain("<em");
  });

  it("menggabungkan tebal dan miring pada satu potongan", () => {
    const html = render([
      { id: "p1", tipe: "paragraf", segmen: [{ teks: "x", tebal: true, miring: true }] },
    ]);
    expect(html).toContain("<strong");
    expect(html).toContain("<em");
  });

  it("tidak merender HTML dari isi teks", () => {
    // Ini pertahanan utama: konten ditulis sebagai teks, jadi markup yang
    // diketik admin tidak pernah menjadi elemen. Tanpa sanitizer di repo ini,
    // merender HTML dari admin akan menjadikannya XSS tersimpan.
    const html = render([
      {
        id: "p1",
        tipe: "paragraf",
        segmen: [{ teks: "<script>alert(1)</script>" }],
      },
    ]);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("HalamanView — heading", () => {
  it("memetakan level ke tag yang tepat", () => {
    const html = render([
      { id: "h1", tipe: "heading", level: 1, segmen: [{ teks: "Satu" }] },
      { id: "h2", tipe: "heading", level: 2, segmen: [{ teks: "Dua" }] },
      { id: "h3", tipe: "heading", level: 3, segmen: [{ teks: "Tiga" }] },
    ]);
    expect(html).toContain("<h1");
    expect(html).toContain("<h2");
    expect(html).toContain("<h3");
  });

  it("memasang jangkar pada heading sebagai sasaran backlink", () => {
    const html = render([
      { id: "h1", tipe: "heading", level: 2, segmen: [{ teks: "Menyiapkan Tools" }] },
    ]);
    expect(html).toContain('id="menyiapkan-tools"');
  });

  it("memakai level 2 sebagai bawaan", () => {
    const html = render([{ id: "h1", tipe: "heading", segmen: [{ teks: "Tanpa Level" }] }]);
    expect(html).toContain("<h2");
  });
});

describe("HalamanView — ukuran huruf", () => {
  it("memetakan setiap ukuran ke kelasnya", () => {
    const ukuran: Array<[BlokHalaman["ukuran"], string]> = [
      ["kecil", "text-[13px]"],
      ["normal", "text-[15px]"],
      ["besar", "text-lg"],
      ["lead", "text-xl"],
    ];
    for (const [nilai, kelas] of ukuran) {
      const html = render([{ id: "p1", tipe: "paragraf", ukuran: nilai, segmen: [{ teks: "x" }] }]);
      expect(html).toContain(kelas);
    }
  });
});

describe("HalamanView — backlink", () => {
  it("merender tautan jangkar tanpa target blank", () => {
    const html = render([
      { id: "h1", tipe: "heading", level: 2, segmen: [{ teks: "Tujuan" }] },
      { id: "p1", tipe: "paragraf", segmen: [{ teks: "lihat", tautan: "#tujuan" }] },
    ]);
    expect(html).toContain('href="#tujuan"');
    // Backlink tetap di tab yang sama — membuka tab baru untuk lompatan di
    // halaman sendiri akan mengganggu.
    expect(html).not.toContain('target="_blank"');
  });

  it("menampilkan daftar 'ditautkan dari' pada section yang ditautkan", () => {
    const html = render([
      { id: "h1", tipe: "heading", level: 2, segmen: [{ teks: "Tujuan" }] },
      { id: "p1", tipe: "paragraf", segmen: [{ teks: "lihat", tautan: "#tujuan" }] },
    ]);
    expect(html).toContain("Ditautkan dari");
  });

  it("tidak menampilkan daftar backlink bila tidak ada yang menautkan", () => {
    const html = render([
      { id: "h1", tipe: "heading", level: 2, segmen: [{ teks: "Tujuan" }] },
    ]);
    expect(html).not.toContain("Ditautkan dari");
  });

  it("membuat tautan eksternal keluar dengan aman", () => {
    const html = render([
      { id: "p1", tipe: "paragraf", segmen: [{ teks: "docs", tautan: "https://nodejs.org" }] },
    ]);
    expect(html).toContain('href="https://nodejs.org"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
  });
});

describe("HalamanView — daftar isi", () => {
  it("menampilkan daftar isi saat ada lebih dari satu section", () => {
    const html = render([
      { id: "h1", tipe: "heading", level: 1, segmen: [{ teks: "Satu" }] },
      { id: "h2", tipe: "heading", level: 2, segmen: [{ teks: "Dua" }] },
    ]);
    expect(html).toContain("Di halaman ini");
    expect(html).toContain('href="#satu"');
    expect(html).toContain('href="#dua"');
  });

  it("tidak menampilkan daftar isi untuk satu section saja", () => {
    const html = render([
      { id: "h1", tipe: "heading", level: 1, segmen: [{ teks: "Hanya Satu" }] },
    ]);
    expect(html).not.toContain("Di halaman ini");
  });
});

describe("HalamanView — blok lain", () => {
  it("merender daftar sebagai <ul> dengan butir berformat", () => {
    const html = render([
      {
        id: "d1",
        tipe: "daftar",
        butir: [[{ teks: "satu" }], [{ teks: "dua", tebal: true }]],
      },
    ]);
    expect(html).toContain("<ul");
    expect(html).toContain("<li");
    expect(html).toContain("<strong");
  });

  it("merender kutipan sebagai <blockquote>", () => {
    const html = render([{ id: "q1", tipe: "kutipan", segmen: [{ teks: "Catatan" }] }]);
    expect(html).toContain("<blockquote");
  });

  it("merender gambar dengan teks alternatif", () => {
    const html = render([
      { id: "g1", tipe: "gambar", src: "/uploads/courses/crs-1/mod-1/x.png", alt: "Diagram alur" },
    ]);
    expect(html).toContain('src="/uploads/courses/crs-1/mod-1/x.png"');
    expect(html).toContain('alt="Diagram alur"');
  });

  it("menampilkan keadaan kosong untuk halaman tanpa blok", () => {
    const html = render([]);
    expect(html).toContain("belum diisi");
  });
});

describe("HalamanView — pager", () => {
  const satu = halamanDengan([], "Halaman Satu");
  const dua = { ...halamanDengan([], "Halaman Dua"), id: "hal-2", urutan: 2 };

  it("menautkan ke halaman berikutnya lewat query string", () => {
    const html = renderToStaticMarkup(
      createElement(HalamanView, {
        modul: modulSatuBab([satu, dua]),
        halaman: satu,
      }),
    );
    expect(html).toContain("Berikutnya");
    expect(html).toContain("?halaman=hal-2");
  });

  it("memakai tombol, bukan tautan, saat pratinjau admin memberi callback", () => {
    // Pratinjau admin tidak boleh bernavigasi: `Link` akan memuat ulang halaman
    // dan membuang tulisan yang belum disimpan.
    const html = renderToStaticMarkup(
      createElement(HalamanView, {
        modul: modulSatuBab([satu, dua]),
        halaman: satu,
        onPindahHalaman: () => {},
      }),
    );
    expect(html).toContain("Berikutnya");
    expect(html).not.toContain("?halaman=");
  });

  it("tidak menampilkan pager untuk halaman tunggal", () => {
    const html = renderToStaticMarkup(
      createElement(HalamanView, { modul: modulSatuBab([satu]), halaman: satu }),
    );
    expect(html).not.toContain("Berikutnya");
  });

  it("menyembunyikan pager saat diminta — tata letak lab", () => {
    // Lab sudah punya tombol maju di bar kaki reader ("Selanjutnya"). Pager
    // halaman di dasar kolom prosa akan jadi tombol "Berikutnya" kedua di layar
    // yang sama, dengan tujuan berbeda (halaman vs modul).
    const html = renderToStaticMarkup(
      createElement(HalamanView, {
        modul: modulSatuBab([satu, dua]),
        halaman: satu,
        sembunyikanPager: true,
      }),
    );
    expect(html).not.toContain("Berikutnya");
    expect(html).not.toContain("?halaman=");
  });
});
