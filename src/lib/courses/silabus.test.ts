import { describe, it, expect } from "vitest";
import { hitungItem, itemModul, modulPunyaIsi, silabusModul, type ModulSeperti } from "./silabus";
import type { Halaman, Kuis, Materi, Submodul } from "@/types/course";

/**
 * Isi modul — satu definisi untuk panel silabus dan pane reader.
 *
 * Berkas ini ada justru karena dua daftar isi (satu di panel, satu di pane)
 * akan menyimpang tanpa error: panel bisa menjanjikan tiga sub-item sementara
 * pane merender dua. Karena itu yang diuji di sini adalah **urutan dan
 * kelengkapan**, bukan hanya "ada isinya".
 *
 * `kuis` di berkas ini adalah daftar **objek** `Kuis`, bukan daftar id —
 * `ModulKursus.kuis` sudah diresolusi `modul-resolver.ts`. Tipe
 * `ModulSeperti.kuis?: Kuis[]` yang membuat kesalahan itu jadi error tipe,
 * bukan panel yang menghitung satu kuis per huruf id.
 *
 * Sejak halaman hidup di dalam bab, fixture halaman selalu lewat `bab()`: satu
 * modul berisi satu bab kecuali test yang memang menguji penataan bab.
 */

function halaman(id: string, urutan: number, teks = "satu dua tiga"): Halaman {
  return {
    id,
    submodul_id: "sub-1",
    modul_id: "mod-1",
    course_id: "crs-1",
    judul: `Judul ${id}`,
    urutan,
    blok: [{ id: `b-${id}`, tipe: "paragraf", segmen: [{ teks }] }],
    created_at: "",
    updated_at: "",
  };
}

function bab(halamanDaftar: Halaman[], over: Partial<Submodul> = {}): Submodul {
  return {
    id: "sub-1",
    modul_id: "mod-1",
    course_id: "crs-1",
    judul: "Bagian 1",
    ringkasan: "",
    urutan: 1,
    halaman: halamanDaftar,
    created_at: "",
    updated_at: "",
    ...over,
  };
}

/** Modul satu-bab — bentuk paling umum di test ini. */
function modulSatuBab(halamanDaftar: Halaman[]): Pick<ModulSeperti, "submodul"> {
  return { submodul: [bab(halamanDaftar)] };
}

function kuis(id: string, jumlahSoal: number, judul = `Kuis ${id}`): Kuis {
  return {
    id,
    judul,
    deskripsi: "",
    soal: Array.from({ length: jumlahSoal }, (_, i) => ({
      id: `${id}-s${i}`,
      pertanyaan: `Soal ${i + 1}?`,
      pilihan: ["A", "B"],
      jawaban_benar: 0,
    })),
    nilai_lulus: 70,
    created_at: "",
    updated_at: "",
  };
}

function video(id: string, judul = `Video ${id}`): Materi {
  return {
    id,
    modul_id: "mod-1",
    course_id: "crs-1",
    judul,
    tipe: "video",
    url: "https://youtu.be/abc",
    durasi_min: 5,
    urutan: 1,
    created_at: "",
    updated_at: "",
  };
}

function pdf(id: string, judul = `PDF ${id}`): Materi {
  return {
    id,
    modul_id: "mod-1",
    course_id: "crs-1",
    judul,
    tipe: "pdf",
    path: "/uploads/a.pdf",
    ukuran_bytes: 1024,
    urutan: 2,
    created_at: "",
    updated_at: "",
  };
}

describe("itemModul", () => {
  it("meratakan modul menjadi halaman, kuis, lalu lampiran", () => {
    // Urutan bagian inilah yang dipakai pane untuk merender; kalau panel
    // mengurutkan lain, peserta membaca dua urutan berbeda untuk isi yang sama.
    const item = itemModul({
      ...modulSatuBab([halaman("h1", 1), halaman("h2", 2)]),
      kuis: [kuis("k1", 3)],
      materi: [video("v1"), pdf("p1")],
    });

    expect(item.map((i) => i.jenis)).toEqual([
      "halaman",
      "halaman",
      "kuis",
      "lampiran",
      "lampiran",
    ]);
    expect(item.map((i) => i.id)).toEqual(["h1", "h2", "k1", "v1", "p1"]);
  });

  it("mengurutkan halaman menurut `urutan`, bukan urutan array", () => {
    // `halaman[]` yang tersimpan bisa tidak terurut; yang menentukan urutan baca
    // adalah field `urutan` — sama seperti `halamanSubmodul`.
    const item = itemModul(modulSatuBab([halaman("b", 2), halaman("a", 1)]));
    expect(item.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("menomori halaman 1-based sesuai urutan tampil", () => {
    const item = itemModul(modulSatuBab([halaman("b", 2), halaman("a", 1)]));
    expect(item).toEqual([
      { jenis: "halaman", id: "a", judul: "Judul a", nomor: 1, menit: 1 },
      { jenis: "halaman", id: "b", judul: "Judul b", nomor: 2, menit: 1 },
    ]);
  });

  it("menomori lintas bab, bukan mulai ulang tiap bab", () => {
    // Nomor halaman adalah posisi dalam **modul**; peserta membaca modul sebagai
    // satu rangkaian, bukan kumpulan bab yang saling terpisah.
    const item = itemModul({
      submodul: [
        bab([halaman("a1", 1)], { id: "sub-1", urutan: 1 }),
        bab([halaman("b1", 1)], { id: "sub-2", urutan: 2 }),
      ],
    });
    expect(item.map((i) => (i.jenis === "halaman" ? i.nomor : null))).toEqual([1, 2]);
  });

  it("menghitung soal kuis dari objek yang sudah diresolusi", () => {
    const item = itemModul({ kuis: [kuis("k1", 3)] });
    expect(item).toEqual([{ jenis: "kuis", id: "k1", judul: "Kuis k1", jumlahSoal: 3 }]);
  });

  it("membawa tipe lampiran apa adanya", () => {
    // `"video"`/`"pdf"` tidak diterjemahkan di sini: labelnya copy, dan copy
    // hidup di komponen. Fungsi ini menyampaikan fakta, bukan kalimat.
    const item = itemModul({ materi: [video("v1"), pdf("p1")] });
    expect(item.map((i) => (i.jenis === "lampiran" ? i.tipe : null))).toEqual(["video", "pdf"]);
  });

  it("mengembalikan daftar kosong untuk modul turunan", () => {
    // Modul turunan tidak punya isi tersimpan. Daftar kosong adalah jawaban yang
    // benar — pane merender ringkasan + tautan eksternalnya.
    expect(itemModul({})).toEqual([]);
  });

  it("tidak melempar saat `kuis`/`materi` absen", () => {
    expect(itemModul(modulSatuBab([halaman("h1", 1)]))).toHaveLength(1);
  });
});

describe("hitungItem", () => {
  it("menghitung tiap jenis", () => {
    const hitung = hitungItem(
      itemModul({
        ...modulSatuBab([halaman("h1", 1), halaman("h2", 2)]),
        kuis: [kuis("k1", 1)],
        materi: [video("v1")],
      }),
    );
    expect(hitung).toEqual({ halaman: 2, kuis: 1, lampiran: 1 });
  });

  it("memberi nol untuk jenis yang tidak ada", () => {
    expect(hitungItem([])).toEqual({ halaman: 0, kuis: 0, lampiran: 0 });
  });
});

describe("modulPunyaIsi", () => {
  /**
   * Predikat ini muncul **dua** kali di UI (baris silabus: bisa dibentangkan atau
   * tidak; pane: render pane atau ringkasan). Karena itu yang dijaga di sini
   * adalah jawabannya untuk setiap kombinasi isi — bukan satu contoh.
   */
  const kosong: ModulSeperti = {};

  it("false untuk modul tanpa isi apa pun", () => {
    expect(modulPunyaIsi(kosong)).toBe(false);
    expect(modulPunyaIsi({ submodul: [] })).toBe(false);
    expect(modulPunyaIsi(modulSatuBab([]))).toBe(false);
    expect(modulPunyaIsi({ kuis: [], materi: [] })).toBe(false);
  });

  it("true bila salah satu jenis isi ada", () => {
    expect(modulPunyaIsi(modulSatuBab([halaman("h1", 1)]))).toBe(true);
    // `kuis` di sini objek hasil resolusi; daftar id kosong tidak mengubahnya.
    expect(modulPunyaIsi({ kuis: [kuis("k1", 1)] })).toBe(true);
    expect(modulPunyaIsi({ materi: [video("v1")] })).toBe(true);
  });

  it("true bila halaman ada di bab mana pun", () => {
    expect(
      modulPunyaIsi({
        submodul: [
          bab([], { id: "sub-1", urutan: 1 }),
          bab([halaman("b1", 1)], { id: "sub-2", urutan: 2 }),
        ],
      }),
    ).toBe(true);
  });

  it("sejalan dengan itemModul — satu definisi, bukan dua", () => {
    // Kalau predikat ini dan `itemModul` pernah menyimpang, baris silabus akan
    // membentang menjadi daftar kosong (atau sebaliknya: pane kosong tanpa
    // sub-item yang bisa dibuka). Assertion ini yang mengikat keduanya.
    const kombinasi: ModulSeperti[] = [
      kosong,
      modulSatuBab([halaman("h1", 1)]),
      { kuis: [kuis("k1", 1)] },
      { materi: [pdf("p1")] },
      { submodul: [], kuis: [], materi: [] },
    ];
    for (const modul of kombinasi) {
      expect(modulPunyaIsi(modul)).toBe(itemModul(modul).length > 0);
    }
  });
});

/**
 * `silabusModul` — pohon yang dibaca panel silabus.
 *
 * Panel menampilkan "modul → bab → halaman", jadi yang dikunci di sini adalah
 * bentuk pohonnya: bab terurut, halaman terurut di dalam babnya, nomor halaman
 * menerus lintas bab, dan kuis/lampiran tetap di tingkat modul (bukan per bab).
 */
describe("silabusModul", () => {
  it("mengelompokkan halaman ke babnya", () => {
    const pohon = silabusModul({
      submodul: [
        bab([halaman("a1", 1), halaman("a2", 2)], { id: "sub-1", urutan: 1 }),
        bab([halaman("b1", 1)], { id: "sub-2", urutan: 2 }),
      ],
    });

    expect(pohon.bab.map((s) => s.id)).toEqual(["sub-1", "sub-2"]);
    expect(pohon.bab[0].halaman.map((h) => h.id)).toEqual(["a1", "a2"]);
    expect(pohon.bab[1].halaman.map((h) => h.id)).toEqual(["b1"]);
  });

  it("meneruskan penomoran halaman lintas bab", () => {
    const pohon = silabusModul({
      submodul: [
        bab([halaman("a1", 1), halaman("a2", 2)], { id: "sub-1", urutan: 1 }),
        bab([halaman("b1", 1)], { id: "sub-2", urutan: 2 }),
      ],
    });

    expect(pohon.bab[0].halaman.map((h) => h.nomor)).toEqual([1, 2]);
    expect(pohon.bab[1].halaman.map((h) => h.nomor)).toEqual([3]);
  });

  it("mengurutkan bab dan halaman meski array-nya tidak rapi", () => {
    const pohon = silabusModul({
      submodul: [
        bab([halaman("b2", 2), halaman("b1", 1)], { id: "sub-2", urutan: 2 }),
        bab([halaman("a1", 1)], { id: "sub-1", urutan: 1 }),
      ],
    });

    expect(pohon.bab.map((s) => s.id)).toEqual(["sub-1", "sub-2"]);
    expect(pohon.bab[1].halaman.map((h) => h.id)).toEqual(["b1", "b2"]);
  });

  it("menaruh kuis dan lampiran di tingkat modul, bukan per bab", () => {
    // Penilaian dan checkpoint berhenti di tingkat modul; kuis yang muncul di
    // dalam bab akan menjanjikan penilaian per bab yang tidak ada.
    const pohon = silabusModul({
      ...modulSatuBab([halaman("h1", 1)]),
      kuis: [kuis("k1", 2)],
      materi: [pdf("p1")],
    });

    expect(pohon.kuis.map((i) => i.id)).toEqual(["k1"]);
    expect(pohon.lampiran.map((i) => i.id)).toEqual(["p1"]);
    expect(pohon.bab[0].halaman).toHaveLength(1);
  });

  it("mengembalikan pohon kosong untuk modul turunan", () => {
    expect(silabusModul({})).toEqual({ bab: [], kuis: [], lampiran: [] });
  });

  it("membawa menit baca per halaman", () => {
    const pohon = silabusModul(modulSatuBab([halaman("h1", 1, "satu dua tiga")]));
    expect(pohon.bab[0].halaman[0].menit).toBe(1);
  });
});
