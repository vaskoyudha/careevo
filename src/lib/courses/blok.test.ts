import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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
  blokKodeDijalankan,
  blokTampil,
  blokKosong,
  halamanPunyaLabKode,
} from "./blok";
import type { BlokHalaman } from "@/types/course";

/** Blok heading ringkas untuk menyusun halaman uji. */
function heading(id: string, teks: string, level: 1 | 2 | 3 = 2): BlokHalaman {
  return { id, tipe: "heading", level, segmen: [{ teks }] };
}

function paragraf(id: string, segmen: BlokHalaman["segmen"]): BlokHalaman {
  return { id, tipe: "paragraf", ukuran: "normal", segmen };
}

function kode(id: string, isi: string): BlokHalaman {
  return { id, tipe: "kode", bahasa: "cpp", kode: isi };
}

/** Blok kode yang sakelar Jalankannya menyala — bahan halaman lab. */
function kodeJalan(id: string, isi = "int main(){}"): BlokHalaman {
  return { id, tipe: "kode", bahasa: "cpp", kode: isi, dapatDijalankan: true };
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

  it("blok kode kosong tidak berisi, yang berkode isi berisi", () => {
    expect(blokBerisi(kode("b1", "   "))).toBe(false);
    expect(blokBerisi(kode("b2", "int main(){}"))).toBe(true);
  });
});

describe("blokTampil", () => {
  it("membuang blok kode kosong dari daftar yang dirender", () => {
    // Ini predikat yang benar-benar jalan: `halaman-view.tsx` memetakan
    // `blokTampil(halaman.blok)`, jadi daftar kosong berarti tidak ada satu
    // pun panel kode yang sampai ke peserta.
    const halaman = [kode("b1", "int main(){}"), kode("b2", ""), kode("b3", "   ")];
    expect(blokTampil(halaman).map((b) => b.id)).toEqual(["b1"]);
  });

  it("membuang keluaran harapan yang tidak punya kode", () => {
    // `outputHarapan` tanpa `kode` tidak bisa ditafsirkan: tidak ada program
    // yang menghasilkan apa pun. Bloknya hilang seluruhnya, bukan jadi panel
    // kosong dengan kartu keluaran.
    const halaman = [{ ...kode("b1", ""), outputHarapan: "Halo, Budi!" }];
    expect(blokTampil(halaman)).toEqual([]);
  });

  it("mempertahankan urutan blok yang lolos", () => {
    const halaman = [
      paragraf("p1", [{ teks: "Satu." }]),
      kode("b1", ""),
      heading("h1", "Dua"),
    ];
    expect(blokTampil(halaman).map((b) => b.id)).toEqual(["p1", "h1"]);
  });

  it("menghasilkan daftar kosong untuk halaman yang seluruh bloknya kosong", () => {
    // Renderer memakai ini juga untuk menentukan "Halaman ini belum diisi",
    // jadi kasus ini bukan detail: halaman dengan 30 blok kode kosong harus
    // terbaca sebagai kosong, bukan sebagai artikel dengan 30 panel.
    const halaman = Array.from({ length: 30 }, (_, i) => kode(`b${i}`, ""));
    expect(blokTampil(halaman)).toEqual([]);
  });
});

describe("blokTampil dipakai renderer", () => {
  const sumber = readFileSync(
    fileURLToPath(
      new URL("../../components/features/learning/halaman-view.tsx", import.meta.url),
    ),
    "utf8",
  );

  it("halaman-view memetakan hasil blokTampil, bukan halaman.blok mentah", () => {
    // Alasannya dua lapis, dan keduanya harus benar.
    //
    // Lapis pertama: `blokTampil` benar. Test di atas membuktikannya, dan test
    // itu tidak bisa dilewati hanya dengan menimpa `blokTampil` — tidak ada
    // yang memanggilnya selain renderer ini.
    //
    // Lapis kedua: renderer benar-benar memanggilnya. `env: node`, tanpa jsdom,
    // jadi merender komponen tidak mungkin diuji di sini; dan `npm run check`
    // (typecheck + lint + test) buta terhadap pemanggilan yang hilang. Tanpa
    // pemeriksaan sumber di sini, seluruh perbaikan ini bisa dicabut dengan
    // satu baris dan semua test tetap hijau — persis cacat `blokBerisi` yang
    // tanpa pemanggil sejak `5d9ca2e`.
    expect(sumber).toContain("blokTampil(halaman.blok)");
    expect(sumber).toMatch(/\{tampil\.map\(/);
    // Tidak boleh ada lagi pemetaan langsung dari daftar mentah.
    expect(sumber).not.toMatch(/\{halaman\.blok\.map\(/);
    // `adaIsi` harus ikut daftar yang sama, kalau tidak halaman yang seluruh
    // bloknya kosong akan tampil sebagai artikel kosong.
    expect(sumber).toContain("const adaIsi = tampil.length > 0;");
  });
});

describe("blokKodeDijalankan", () => {
  it("hanya mengambil blok kode yang sakelar Jalankannya menyala", () => {
    const blok = [kode("b1", "int main(){}"), kodeJalan("b2"), paragraf("p1", [{ teks: "x" }])];
    expect(blokKodeDijalankan({ blok }).map((b) => b.id)).toEqual(["b2"]);
  });

  it("mengabaikan blok kode yang isinya kosong walau sakelarnya menyala", () => {
    // Sakelar yang menyala pada blok kosong tidak bisa dijalankan: tidak ada
    // program. Mengangkatnya ke editor akan menampilkan kolom editor untuk
    // latihan yang tidak ada.
    expect(blokKodeDijalankan({ blok: [kodeJalan("b1", "   ")] })).toEqual([]);
  });

  it("mengabaikan blok kode yang tidak boleh dijalankan", () => {
    // Contoh bacaan bukan latihan: sakelar yang mati berarti blok itu tetap
    // tinggal di aliran prosa.
    expect(blokKodeDijalankan({ blok: [kode("b1", "int main(){}")] })).toEqual([]);
  });
});

describe("halamanPunyaLabKode", () => {
  it("benar hanya bila tepat satu blok bisa dijalankan", () => {
    // Tata letak lab punya satu editor; dua latihan tidak punya cara tunggal
    // mengisi dua barisnya, jadi halaman seperti itu kembali ke tata letak
    // linear.
    expect(halamanPunyaLabKode({ blok: [kodeJalan("b1"), paragraf("p1", [{ teks: "x" }])] })).toBe(
      true,
    );
    expect(halamanPunyaLabKode({ blok: [kodeJalan("b1"), kodeJalan("b2")] })).toBe(false);
  });

  it("salah untuk halaman tanpa latihan yang bisa dijalankan", () => {
    expect(halamanPunyaLabKode({ blok: [paragraf("p1", [{ teks: "x" }])] })).toBe(false);
    expect(halamanPunyaLabKode({ blok: [kode("b1", "int main(){}")] })).toBe(false);
  });

  it("salah untuk halaman yang tidak ada", () => {
    // `halamanDipilih()` menjawab `null` untuk modul tanpa halaman; modul
    // seperti itu tidak boleh melebarkan kolom baca.
    expect(halamanPunyaLabKode(null)).toBe(false);
    expect(halamanPunyaLabKode(undefined)).toBe(false);
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

  it("blok kode diringkas ke baris pertamanya", () => {
    expect(ringkasBlok(kode("b1", "#include <iostream>\nint main(){}"))).toBe(
      "#include <iostream>",
    );
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

  it("blok kode baru tidak dapat dijalankan sampai ahli menyalakannya", () => {
    // Fail-closed: bawaan harus menolak eksekusi, bukan mengizinkan.
    expect(blokKosong("kode")).toEqual({
      id: "",
      tipe: "kode",
      bahasa: "cpp",
      kode: "",
      dapatDijalankan: false,
    });
  });
});
