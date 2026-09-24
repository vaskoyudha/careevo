import { describe, it, expect } from "vitest";
import {
  daftarSection,
  gabungSegmenSejenis,
  petaSection,
  rangkumBacklink,
  ringkasBlok,
  segmenKeTeks,
  slugBagian,
  tautanSah,
  blokBerisi,
  blokKosong,
} from "./blok";
import type { BlokHalaman } from "@/types/course";

/** Blok heading ringkas untuk menyusun halaman uji. */
function heading(id: string, teks: string, level: 1 | 2 | 3 = 2): BlokHalaman {
  return { id, tipe: "heading", level, segmen: [{ teks }] };
}

function paragraf(id: string, segmen: BlokHalaman["segmen"]): BlokHalaman {
  return { id, tipe: "paragraf", ukuran: "normal", segmen };
}

describe("slugBagian", () => {
  it("menghasilkan jangkar huruf kecil tanpa spasi", () => {
    expect(slugBagian("Menyiapkan Lingkungan Kerja")).toBe("menyiapkan-lingkungan-kerja");
  });

  it("melucuti diakritik", () => {
    expect(slugBagian("Ringkasan Résumé")).toBe("ringkasan-resume");
  });

  it("merapatkan pemisah beruntun dan memangkas ujungnya", () => {
    expect(slugBagian("  A -- B !! C  ")).toBe("a-b-c");
  });

  it("tidak pernah mengembalikan string kosong", () => {
    // Jangkar kosong akan membuat `href="#"` yang melompat ke atas halaman,
    // bukan ke section — jadi harus ada cadangan.
    expect(slugBagian("!!!")).toBe("bagian");
    expect(slugBagian("你好")).toBe("bagian");
  });
});

describe("segmenKeTeks", () => {
  it("menggabungkan potongan teks", () => {
    expect(segmenKeTeks([{ teks: "Halo " }, { teks: "dunia", tebal: true }])).toBe("Halo dunia");
  });

  it("mengembalikan string kosong untuk daftar kosong atau undefined", () => {
    expect(segmenKeTeks([])).toBe("");
    expect(segmenKeTeks(undefined)).toBe("");
  });
});

describe("daftarSection", () => {
  it("hanya mengambil blok heading", () => {
    const blok: BlokHalaman[] = [
      paragraf("p1", [{ teks: "Pengantar." }]),
      heading("h1", "Tujuan Belajar"),
      paragraf("p2", [{ teks: "Isi." }]),
    ];
    expect(daftarSection(blok).map((s) => s.id)).toEqual(["tujuan-belajar"]);
  });

  it("membedakan jangkar judul kembar dalam satu halaman", () => {
    // Tanpa pembeda, kedua tautan `#latihan` akan melompat ke kemunculan
    // pertama, sehingga section kedua tidak bisa dituju sama sekali.
    const blok: BlokHalaman[] = [
      heading("h1", "Latihan"),
      heading("h2", "Latihan"),
      heading("h3", "Latihan"),
    ];
    expect(daftarSection(blok).map((s) => s.id)).toEqual(["latihan", "latihan-2", "latihan-3"]);
  });

  it("melewati heading tanpa teks", () => {
    // Heading kosong tidak menghasilkan jangkar, jadi tidak boleh muncul di
    // daftar isi sebagai baris yang tidak bisa dituju.
    const blok: BlokHalaman[] = [heading("h1", "  "), heading("h2", "Ada")];
    expect(daftarSection(blok).map((s) => s.id)).toEqual(["ada"]);
  });

  it("mempertahankan level heading", () => {
    const blok: BlokHalaman[] = [heading("h1", "Satu", 1), heading("h2", "Dua", 3)];
    expect(daftarSection(blok).map((s) => s.level)).toEqual([1, 3]);
  });
});

describe("petaSection", () => {
  it("memetakan id blok ke jangkarnya", () => {
    const blok: BlokHalaman[] = [heading("h1", "Tujuan Belajar")];
    expect(petaSection(blok).get("h1")).toBe("tujuan-belajar");
  });

  it("tidak memuat blok non-heading", () => {
    const blok: BlokHalaman[] = [paragraf("p1", [{ teks: "Isi." }])];
    expect(petaSection(blok).size).toBe(0);
  });
});

describe("rangkumBacklink", () => {
  it("mengumpulkan tautan yang menunjuk section yang ada", () => {
    const blok: BlokHalaman[] = [
      heading("h1", "Tujuan"),
      paragraf("p1", [{ teks: "Lihat " }, { teks: "tujuan", tautan: "#tujuan" }]),
    ];
    const peta = rangkumBacklink(blok);
    expect(peta.get("tujuan")?.map((b) => b.blokId)).toEqual(["p1"]);
  });

  it("mengabaikan tautan ke jangkar yang tidak ada", () => {
    // Jangkar mati tidak boleh dilaporkan sebagai backlink: itu mengklaim
    // sesuatu yang tidak benar.
    const blok: BlokHalaman[] = [paragraf("p1", [{ teks: "x", tautan: "#tidak-ada" }])];
    expect(rangkumBacklink(blok).size).toBe(0);
  });

  it("tidak menghitung tautan eksternal sebagai backlink", () => {
    const blok: BlokHalaman[] = [
      heading("h1", "Tujuan"),
      paragraf("p1", [{ teks: "x", tautan: "https://example.com" }]),
    ];
    expect(rangkumBacklink(blok).size).toBe(0);
  });

  it("menghitung satu blok sekali walau menautkan dua kali", () => {
    const blok: BlokHalaman[] = [
      heading("h1", "Tujuan"),
      paragraf("p1", [
        { teks: "a", tautan: "#tujuan" },
        { teks: " dan " },
        { teks: "b", tautan: "#tujuan" },
      ]),
    ];
    expect(rangkumBacklink(blok).get("tujuan")).toHaveLength(1);
  });

  it("menemukan tautan di dalam butir daftar", () => {
    const blok: BlokHalaman[] = [
      heading("h1", "Tujuan"),
      { id: "d1", tipe: "daftar", butir: [[{ teks: "lihat", tautan: "#tujuan" }]] },
    ];
    expect(rangkumBacklink(blok).get("tujuan")?.map((b) => b.blokId)).toEqual(["d1"]);
  });

  it("mengabaikan blok gambar", () => {
    const blok: BlokHalaman[] = [
      heading("h1", "Tujuan"),
      { id: "g1", tipe: "gambar", src: "/uploads/x.png", alt: "" },
    ];
    expect(rangkumBacklink(blok).size).toBe(0);
  });
});

describe("blokBerisi", () => {
  it("menilai tiap tipe berdasarkan isinya", () => {
    expect(blokBerisi(paragraf("p1", [{ teks: "Ada." }]))).toBe(true);
    expect(blokBerisi(paragraf("p2", [{ teks: "   " }]))).toBe(false);
    expect(blokBerisi({ id: "g1", tipe: "gambar", src: "/uploads/a.png" })).toBe(true);
    expect(blokBerisi({ id: "g2", tipe: "gambar", src: "" })).toBe(false);
    expect(blokBerisi({ id: "d1", tipe: "daftar", butir: [[{ teks: "" }]] })).toBe(false);
    expect(blokBerisi({ id: "d2", tipe: "daftar", butir: [[{ teks: "a" }]] })).toBe(true);
  });
});

describe("ringkasBlok", () => {
  it("memotong teks panjang dengan elipsis", () => {
    const panjang = "a".repeat(200);
    expect(ringkasBlok(paragraf("p1", [{ teks: panjang }]), 20).endsWith("…")).toBe(true);
  });

  it("memakai teks alternatif untuk gambar", () => {
    expect(ringkasBlok({ id: "g1", tipe: "gambar", src: "/uploads/a.png", alt: "Diagram" })).toBe(
      "Diagram",
    );
  });

  it("menggabungkan butir daftar", () => {
    const daftar: BlokHalaman = {
      id: "d1",
      tipe: "daftar",
      butir: [[{ teks: "Satu" }], [{ teks: "Dua" }]],
    };
    expect(ringkasBlok(daftar)).toBe("Satu · Dua");
  });
});

describe("tautanSah", () => {
  it("menerima backlink dan http/https", () => {
    expect(tautanSah("#tujuan-belajar")).toBe(true);
    expect(tautanSah("https://example.com")).toBe(true);
    expect(tautanSah("http://example.com")).toBe(true);
  });

  it("menolak skema berbahaya dan bentuk lain", () => {
    // `javascript:` adalah alasan utama fungsi ini ada: nilainya masuk ke
    // `<a href>`, dan zod v4 `z.url()` menerima skema itu.
    expect(tautanSah("javascript:alert(1)")).toBe(false);
    expect(tautanSah("data:text/html,x")).toBe(false);
    expect(tautanSah("/relatif")).toBe(false);
    expect(tautanSah("#Huruf-Besar")).toBe(false);
    expect(tautanSah("mailto:a@b.c")).toBe(false);
  });
});

describe("gabungSegmenSejenis", () => {
  it("menggabungkan potongan yang penandanya sama", () => {
    expect(gabungSegmenSejenis([{ teks: "a", tebal: true }, { teks: "b", tebal: true }])).toEqual([
      { teks: "ab", tebal: true },
    ]);
  });

  it("tidak menggabungkan potongan yang penandanya berbeda", () => {
    expect(gabungSegmenSejenis([{ teks: "a" }, { teks: "b", tebal: true }])).toHaveLength(2);
  });

  it("membedakan berdasarkan tautan", () => {
    expect(
      gabungSegmenSejenis([{ teks: "a", tautan: "#x" }, { teks: "b", tautan: "#y" }]),
    ).toHaveLength(2);
  });
});

describe("blokKosong", () => {
  it("membuat bentuk yang tepat untuk setiap tipe", () => {
    expect(blokKosong("paragraf").tipe).toBe("paragraf");
    expect(blokKosong("heading").level).toBe(2);
    expect(blokKosong("daftar").butir).toHaveLength(1);
    expect(blokKosong("gambar").src).toBe("");
  });

  it("membiarkan id kosong agar store yang mengisinya", () => {
    expect(blokKosong("paragraf").id).toBe("");
  });
});
