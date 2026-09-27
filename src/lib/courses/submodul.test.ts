import { describe, it, expect } from "vitest";
import {
  submodulUntukModul,
  halamanSubmodul,
  halamanModul,
  jumlahHalamanModul,
  cariHalamanDiModul,
  submodulUntukHalaman,
  nomorHalamanModul,
  punyaSubmodul,
  judulSubmodulOtomatis,
  normalisasiSubmodulLama,
} from "./submodul";
import type { Course, Halaman, Modul, Submodul } from "@/types/course";

/**
 * Sub-modul — bab di dalam sebuah modul.
 *
 * Yang paling berharga dikunci di sini adalah **migrasi** (`normalisasiSubmodulLama`):
 * ia berjalan atas data nyata di `data/courses.json` (38 kursus, 127 modul, 202
 * halaman), jadi satu kekeliruan di sana berarti halaman yang hilang dari reader
 * tanpa error di mana pun.
 */

const WAKTU = "2026-09-24T00:00:00.000Z";

function halaman(id: string, urutan: number, over: Partial<Halaman> = {}): Halaman {
  return {
    id,
    submodul_id: "sub-1",
    modul_id: "mod-1",
    course_id: "crs-1",
    judul: `Halaman ${urutan}`,
    urutan,
    blok: [],
    created_at: WAKTU,
    updated_at: WAKTU,
    ...over,
  };
}

function bab(id: string, urutan: number, halamanDaftar: Halaman[] = []): Submodul {
  return {
    id,
    modul_id: "mod-1",
    course_id: "crs-1",
    judul: `Bagian ${urutan}`,
    ringkasan: "",
    urutan,
    halaman: halamanDaftar,
    created_at: WAKTU,
    updated_at: WAKTU,
  };
}

function kursusDengan(modulDaftar: Modul[]): Course {
  return {
    id: "crs-1",
    title: "Kursus Uji",
    slug: "kursus-uji",
    description: "Deskripsi kursus uji yang cukup panjang.",
    provider: "Penyelenggara",
    type: "course",
    track: "web-dev",
    level: "dasar",
    tags: ["Uji"],
    url: "https://example.com",
    duration_min: 60,
    is_free: true,
    price: 0,
    status: "published",
    enrolled_count: 0,
    rating: 5,
    created_at: WAKTU,
    updated_at: WAKTU,
    modul: modulDaftar,
  };
}

/** Modul lama: halaman menempel langsung (bentuk sebelum sub-modul ada). */
function modulLama(halamanDaftar: Halaman[]): Modul & { halaman: Halaman[] } {
  return {
    id: "mod-1",
    course_id: "crs-1",
    judul: "Modul Lama",
    ringkasan: "Ringkasan.",
    urutan: 1,
    durasi_min: 30,
    materi: [],
    created_at: WAKTU,
    updated_at: WAKTU,
    // Field yang sudah dihapus dari tipe tapi masih ada di berkas lama.
    ...({ halaman: halamanDaftar } as { halaman: Halaman[] }),
  };
}

describe("submodulUntukModul", () => {
  it("mengurutkan bab menaik", () => {
    const modul = { submodul: [bab("c", 3), bab("a", 1), bab("b", 2)] };
    expect(submodulUntukModul(modul).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("mengembalikan daftar kosong bila modul tidak punya bab", () => {
    expect(submodulUntukModul({})).toEqual([]);
    expect(submodulUntukModul({ submodul: [] })).toEqual([]);
  });

  it("tidak mengubah array aslinya", () => {
    const asli = [bab("c", 3), bab("a", 1)];
    submodulUntukModul({ submodul: asli });
    expect(asli.map((s) => s.id)).toEqual(["c", "a"]);
  });
});

describe("halamanSubmodul", () => {
  it("mengurutkan halaman di dalam satu bab", () => {
    const s = bab("sub-1", 1, [halaman("b", 2), halaman("a", 1)]);
    expect(halamanSubmodul(s).map((h) => h.id)).toEqual(["a", "b"]);
  });
});

describe("halamanModul", () => {
  it("meratakan bab demi bab, lalu halaman demi halaman", () => {
    const modul = {
      submodul: [
        bab("sub-1", 1, [halaman("a1", 1), halaman("a2", 2)]),
        bab("sub-2", 2, [halaman("b1", 1)]),
      ],
    };
    expect(halamanModul(modul).map((h) => h.id)).toEqual(["a1", "a2", "b1"]);
  });

  it("mengurutkan babnya lebih dulu meski array-nya tidak rapi", () => {
    const modul = {
      submodul: [
        bab("sub-2", 2, [halaman("b1", 1)]),
        bab("sub-1", 1, [halaman("a1", 1)]),
      ],
    };
    expect(halamanModul(modul).map((h) => h.id)).toEqual(["a1", "b1"]);
  });
});

describe("jumlahHalamanModul", () => {
  it("menjumlahkan halaman seluruh bab", () => {
    const modul = {
      submodul: [bab("sub-1", 1, [halaman("a1", 1)]), bab("sub-2", 2, [halaman("b1", 1)])],
    };
    expect(jumlahHalamanModul(modul)).toBe(2);
  });

  it("mengembalikan 0 untuk modul tanpa bab", () => {
    expect(jumlahHalamanModul({})).toBe(0);
  });
});

describe("cariHalamanDiModul", () => {
  it("menemukan halaman di bab mana pun", () => {
    const modul = {
      submodul: [bab("sub-1", 1, [halaman("a1", 1)]), bab("sub-2", 2, [halaman("b1", 1)])],
    };
    expect(cariHalamanDiModul(modul, "b1")?.id).toBe("b1");
  });

  it("mengembalikan null bila tidak ada", () => {
    expect(cariHalamanDiModul({ submodul: [bab("sub-1", 1)] }, "z")).toBeNull();
  });
});

describe("submodulUntukHalaman", () => {
  it("menunjuk bab yang memuat halaman itu", () => {
    // Dipakai panel silabus untuk membuka bab yang benar saat halaman dibuka
    // lewat deep link.
    const modul = {
      submodul: [bab("sub-1", 1, [halaman("a1", 1)]), bab("sub-2", 2, [halaman("b1", 1)])],
    };
    expect(submodulUntukHalaman(modul, "b1")?.id).toBe("sub-2");
  });

  it("mengembalikan null bila halaman tidak ada di bab mana pun", () => {
    const modul = { submodul: [bab("sub-1", 1, [halaman("a1", 1)])] };
    expect(submodulUntukHalaman(modul, "z")).toBeNull();
  });
});

describe("nomorHalamanModul", () => {
  it("menomori lintas bab, bukan mulai ulang per bab", () => {
    const modul = {
      submodul: [bab("sub-1", 1, [halaman("a1", 1)]), bab("sub-2", 2, [halaman("b1", 1)])],
    };
    expect(nomorHalamanModul(modul, "b1")).toBe(2);
  });

  it("mengembalikan null bila tidak ada", () => {
    expect(nomorHalamanModul({ submodul: [] }, "a")).toBeNull();
  });
});

describe("punyaSubmodul", () => {
  it("membedakan modul berbab dari yang tidak", () => {
    expect(punyaSubmodul({ submodul: [bab("sub-1", 1)] })).toBe(true);
    expect(punyaSubmodul({})).toBe(false);
    expect(punyaSubmodul({ submodul: [] })).toBe(false);
  });
});

describe("judulSubmodulOtomatis", () => {
  it("memberi judul berurutan", () => {
    expect(judulSubmodulOtomatis(1)).toBe("Bagian 1");
    expect(judulSubmodulOtomatis(4)).toBe("Bagian 4");
  });
});

/**
 * Migrasi bentuk lama → berbab.
 *
 * Tiga hal yang harus benar, dan ketiganya punya cara gagal yang senyap:
 * 1. **Tidak ada halaman yang hilang.** Halaman yang lenyap dari reader tidak
 *    melempar error apa pun — ia hanya tidak ada.
 * 2. **Idempoten.** Migrasi terpanggil berkali-kali (tiap proses baru membaca
 *    berkas lama) tidak boleh menggandakan bab.
 * 3. **Id deterministik dan stabil**, diturunkan dari id modul, supaya bab yang
 *    sama tidak berubah identitas antar-pemuatan.
 */
describe("normalisasiSubmodulLama", () => {
  it("membungkus halaman lama menjadi satu bab", () => {
    const kursus = kursusDengan([modulLama([halaman("a", 1), halaman("b", 2)])]);
    const mod = normalisasiSubmodulLama(kursus).modul![0];

    expect(mod.submodul).toHaveLength(1);
    expect(mod.submodul![0].halaman.map((h) => h.id)).toEqual(["a", "b"]);
  });

  it("tidak menghilangkan satu halaman pun", () => {
    const asli = [halaman("a", 1), halaman("b", 2), halaman("c", 3)];
    const kursus = kursusDengan([modulLama(asli)]);
    const mod = normalisasiSubmodulLama(kursus).modul![0];

    expect(jumlahHalamanModul(mod)).toBe(3);
    expect(halamanModul(mod).map((h) => h.id)).toEqual(["a", "b", "c"]);
  });

  it("menandai submodul_id setiap halaman lama", () => {
    // Tanpa ini halaman tidak akan ditemukan `submodulUntukHalaman`, sehingga
    // deep link tidak bisa membuka babnya.
    const kursus = kursusDengan([modulLama([halaman("a", 1)])]);
    const mod = normalisasiSubmodulLama(kursus).modul![0];
    expect(mod.submodul![0].halaman[0].submodul_id).toBe("sub-mod-1");
  });

  it("membuang field halaman lama dari modul", () => {
    // Dua tempat menyimpan prosa yang sama akan menyimpang; pane hanya membaca
    // dari bab.
    const kursus = kursusDengan([modulLama([halaman("a", 1)])]);
    const mod = normalisasiSubmodulLama(kursus).modul![0];
    expect((mod as unknown as Record<string, unknown>).halaman).toBeUndefined();
  });

  it("idempoten: menjalankan dua kali tidak menggandakan bab", () => {
    const kursus = kursusDengan([modulLama([halaman("a", 1)])]);
    const sekali = normalisasiSubmodulLama(kursus);
    const dua = normalisasiSubmodulLama(sekali);

    expect(dua.modul![0].submodul).toHaveLength(1);
    expect(jumlahHalamanModul(dua.modul![0])).toBe(1);
  });

  it("memberi id bab deterministik dari id modul", () => {
    // Id yang diturunkan dari waktu akan membuat bab "baru" setiap pemuatan,
    // dan progres yang tertaut ke bab itu (kelak) akan hilang.
    const kursus = kursusDengan([modulLama([halaman("a", 1)])]);
    const a = normalisasiSubmodulLama(kursus).modul![0].submodul![0].id;
    const b = normalisasiSubmodulLama(kursus).modul![0].submodul![0].id;
    expect(a).toBe("sub-mod-1");
    expect(b).toBe(a);
  });

  it("tidak mengubah modul yang sudah punya bab", () => {
    // Referensi yang sama, bukan salinan — tidak ada penulisan disk tanpa
    // perubahan nyata.
    const sudah = { ...modulLama([]), submodul: [bab("sub-1", 1, [halaman("a", 1)])] };
    const kursus = kursusDengan([sudah as Modul]);
    expect(normalisasiSubmodulLama(kursus)).toBe(kursus);
  });

  it("tidak mengubah modul tanpa halaman sama sekali", () => {
    const kursus = kursusDengan([modulLama([])]);
    expect(normalisasiSubmodulLama(kursus)).toBe(kursus);
  });

  it("mengembalikan kursus tanpa modul apa adanya", () => {
    const kursus = kursusDengan([]);
    expect(normalisasiSubmodulLama(kursus)).toBe(kursus);
  });

  it("menomori ulang halaman 1..n di dalam bab", () => {
    const kursus = kursusDengan([modulLama([halaman("a", 7), halaman("b", 9)])]);
    const mod = normalisasiSubmodulLama(kursus).modul![0];
    expect(mod.submodul![0].halaman.map((h) => h.urutan)).toEqual([1, 2]);
  });
});
