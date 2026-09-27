import { describe, it, expect } from "vitest";
import {
  halamanUntukModul,
  cariHalaman,
  nomorHalaman,
  punyaHalaman,
  jumlahKata,
  judulHalamanOtomatis,
  normalisasiHalamanLama,
} from "./halaman";
import type { Course, Halaman, Modul } from "@/types/course";

function halaman(id: string, urutan: number, judul = `Halaman ${urutan}`): Halaman {
  return {
    id,
    modul_id: "mod-1",
    course_id: "crs-1",
    judul,
    urutan,
    blok: [],
    created_at: "2026-09-24T00:00:00.000Z",
    updated_at: "2026-09-24T00:00:00.000Z",
  };
}

function modul(halamanDaftar?: Halaman[]): Pick<Modul, "halaman"> {
  return { halaman: halamanDaftar };
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
    created_at: "2026-09-24T00:00:00.000Z",
    updated_at: "2026-09-24T00:00:00.000Z",
    modul: modulDaftar,
  };
}

function modulLengkap(id: string, materi: unknown[], halamanDaftar?: Halaman[]): Modul {
  return {
    id,
    course_id: "crs-1",
    judul: "Modul Uji",
    ringkasan: "Ringkasan modul uji.",
    urutan: 1,
    durasi_min: 30,
    materi: materi as Modul["materi"],
    halaman: halamanDaftar,
    created_at: "2026-09-24T00:00:00.000Z",
    updated_at: "2026-09-24T00:00:00.000Z",
  };
}

describe("halamanUntukModul", () => {
  it("mengurutkan menaik berdasarkan urutan", () => {
    const hasil = halamanUntukModul(modul([halaman("c", 3), halaman("a", 1), halaman("b", 2)]));
    expect(hasil.map((h) => h.id)).toEqual(["a", "b", "c"]);
  });

  it("mengembalikan daftar kosong bila modul tidak punya halaman", () => {
    // Modul lama memang belum punya `halaman` sama sekali — itu berarti "tidak
    // ada halaman", bukan error.
    expect(halamanUntukModul(modul(undefined))).toEqual([]);
    expect(halamanUntukModul(modul([]))).toEqual([]);
  });

  it("tidak mengubah array aslinya", () => {
    const asli = [halaman("c", 3), halaman("a", 1)];
    halamanUntukModul(modul(asli));
    expect(asli.map((h) => h.id)).toEqual(["c", "a"]);
  });
});

describe("cariHalaman", () => {
  it("menemukan halaman berdasarkan id", () => {
    expect(cariHalaman(modul([halaman("a", 1)]), "a")?.id).toBe("a");
  });

  it("mengembalikan null bila tidak ada", () => {
    expect(cariHalaman(modul([halaman("a", 1)]), "z")).toBeNull();
    expect(cariHalaman(modul(undefined), "a")).toBeNull();
  });
});

describe("nomorHalaman", () => {
  it("mengembalikan nomor 1-based mengikuti posisi array", () => {
    expect(nomorHalaman(modul([halaman("a", 1), halaman("b", 2)]), "b")).toBe(2);
  });

  it("mengembalikan null bila halaman tidak ada", () => {
    expect(nomorHalaman(modul([halaman("a", 1)]), "z")).toBeNull();
  });
});

describe("punyaHalaman", () => {
  it("membedakan modul berhalaman dari yang tidak", () => {
    expect(punyaHalaman(modul([halaman("a", 1)]))).toBe(true);
    expect(punyaHalaman(modul([]))).toBe(false);
    expect(punyaHalaman(modul(undefined))).toBe(false);
  });
});

describe("jumlahKata", () => {
  it("menghitung kata dari paragraf dan butir daftar", () => {
    const h: Halaman = {
      ...halaman("a", 1),
      blok: [
        { id: "p1", tipe: "paragraf", segmen: [{ teks: "satu dua tiga" }] },
        { id: "d1", tipe: "daftar", butir: [[{ teks: "empat lima" }], [{ teks: "enam" }]] },
      ],
    };
    expect(jumlahKata({ halaman: [h] })).toBe(6);
  });

  it("tidak menghitung gambar", () => {
    const h: Halaman = {
      ...halaman("a", 1),
      blok: [{ id: "g1", tipe: "gambar", src: "/uploads/a.png", alt: "diagram alur proses" }],
    };
    expect(jumlahKata({ halaman: [h] })).toBe(0);
  });

  it("mengembalikan 0 untuk modul tanpa halaman", () => {
    expect(jumlahKata(modul(undefined))).toBe(0);
  });

  it("tidak menghitung isi kode sebagai kata baca", () => {
    const h: Halaman = {
      id: "hal-1",
      modul_id: "m1",
      course_id: "c1",
      judul: "Kode",
      urutan: 1,
      blok: [{ id: "blk-1", tipe: "kode", bahasa: "cpp", kode: "int main(){ return 0; }" }],
      created_at: "2026-09-27T00:00:00.000Z",
      updated_at: "2026-09-27T00:00:00.000Z",
    };
    expect(jumlahKata({ halaman: [h] })).toBe(0);
  });
});

describe("judulHalamanOtomatis", () => {
  it("memberi judul berurutan", () => {
    expect(judulHalamanOtomatis(1)).toBe("Halaman 1");
    expect(judulHalamanOtomatis(12)).toBe("Halaman 12");
  });
});

describe("normalisasiHalamanLama", () => {
  const materiTeksLama = {
    id: "mat-1",
    modul_id: "mod-1",
    course_id: "crs-1",
    judul: "Catatan Lama",
    urutan: 1,
    tipe: "teks",
    konten: "Isi catatan dari versi sebelumnya.",
    created_at: "2026-09-20T00:00:00.000Z",
    updated_at: "2026-09-20T00:00:00.000Z",
  };

  it("mempromosikan materi teks menjadi halaman berisi satu paragraf", () => {
    const kursus = kursusDengan([modulLengkap("mod-1", [materiTeksLama])]);
    const hasil = normalisasiHalamanLama(kursus);

    const mod = hasil.modul![0];
    expect(mod.halaman).toHaveLength(1);
    expect(mod.halaman![0].judul).toBe("Catatan Lama");
    expect(mod.halaman![0].blok).toHaveLength(1);
    expect(mod.halaman![0].blok[0].tipe).toBe("paragraf");
    expect(mod.halaman![0].blok[0].segmen?.[0].teks).toBe("Isi catatan dari versi sebelumnya.");
  });

  it("membuang materi teks setelah dipromosikan", () => {
    // Dua sumber untuk prosa yang sama akan membuat salah satunya jadi stale.
    const kursus = kursusDengan([modulLengkap("mod-1", [materiTeksLama])]);
    expect(normalisasiHalamanLama(kursus).modul![0].materi).toEqual([]);
  });

  it("mempertahankan id dan timestamp asli materi", () => {
    const kursus = kursusDengan([modulLengkap("mod-1", [materiTeksLama])]);
    const h = normalisasiHalamanLama(kursus).modul![0].halaman![0];
    expect(h.id).toBe("hal-mat-1");
    expect(h.created_at).toBe("2026-09-20T00:00:00.000Z");
  });

  it("idempoten: menjalankan dua kali tidak menggandakan halaman", () => {
    // Id diturunkan dari id materi, bukan dari waktu — jadi migrasi yang
    // terpanggil berulang tidak menumpuk halaman.
    const kursus = kursusDengan([modulLengkap("mod-1", [materiTeksLama])]);
    const sekali = normalisasiHalamanLama(kursus);
    const dua = normalisasiHalamanLama(sekali);
    expect(dua.modul![0].halaman).toHaveLength(1);
  });

  it("tidak mengubah kursus yang tidak punya materi teks", () => {
    // Referensi yang sama, bukan salinan: tidak ada penulisan disk yang dipicu
    // tanpa perubahan nyata.
    const kursus = kursusDengan([modulLengkap("mod-1", [])]);
    expect(normalisasiHalamanLama(kursus)).toBe(kursus);
  });

  it("mengembalikan kursus tanpa modul apa adanya", () => {
    const kursus = kursusDengan([]);
    expect(normalisasiHalamanLama(kursus)).toBe(kursus);
  });

  it("menaruh halaman hasil migrasi di depan halaman yang sudah ada", () => {
    // Materi teks dulu dibaca paling awal; menaruhnya setelah halaman yang
    // sudah ditulis admin akan membalik urutan baca.
    const kursus = kursusDengan([
      modulLengkap("mod-1", [materiTeksLama], [halaman("hal-baru", 1, "Sudah Ada")]),
    ]);
    const mod = normalisasiHalamanLama(kursus).modul![0];
    expect(mod.halaman!.map((x) => x.judul)).toEqual(["Catatan Lama", "Sudah Ada"]);
  });

  it("menomori ulang 1..n setelah penggabungan", () => {
    const kursus = kursusDengan([
      modulLengkap("mod-1", [materiTeksLama], [halaman("hal-baru", 1, "Sudah Ada")]),
    ]);
    const mod = normalisasiHalamanLama(kursus).modul![0];
    expect(mod.halaman!.map((x) => x.urutan)).toEqual([1, 2]);
  });

  it("memberi judul cadangan bila materi lama tidak punya judul", () => {
    const tanpaJudul = { ...materiTeksLama, judul: "" };
    const kursus = kursusDengan([modulLengkap("mod-1", [tanpaJudul])]);
    expect(normalisasiHalamanLama(kursus).modul![0].halaman![0].judul).toBe("Halaman 1");
  });

  it("tidak menyentuh materi bertipe lain", () => {
    const materiVideo = {
      id: "mat-v",
      modul_id: "mod-1",
      course_id: "crs-1",
      judul: "Video",
      urutan: 1,
      tipe: "video",
      url: "https://www.youtube.com/watch?v=abc",
      durasi_min: 5,
      created_at: "2026-09-20T00:00:00.000Z",
      updated_at: "2026-09-20T00:00:00.000Z",
    };
    const kursus = kursusDengan([modulLengkap("mod-1", [materiVideo, materiTeksLama])]);
    const mod = normalisasiHalamanLama(kursus).modul![0];
    expect(mod.materi).toHaveLength(1);
    expect(mod.materi![0].tipe).toBe("video");
  });
});
