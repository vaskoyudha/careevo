import { describe, it, expect } from "vitest";
import {
  halamanUntukModul,
  cariHalaman,
  nomorHalaman,
  punyaHalaman,
  jumlahKata,
  jumlahKataHalaman,
  perkiraanMenitBaca,
  halamanDipilih,
  judulHalamanOtomatis,
  normalisasiHalamanLama,
  KATA_PER_MENIT,
} from "./halaman";
import type { Course, Halaman, Modul, Submodul } from "@/types/course";

/**
 * Fixtures halaman kini lewat **bab**, bukan array datar.
 *
 * Sejak tingkat sub-modul ada, halaman tidak lagi menempel di modul: ia hidup di
 * dalam `Modul.submodul[].halaman`. Helper di berkas ini membuat bentuk itu
 * secara implisit (satu bab per modul), karena yang diuji di sini adalah operasi
 * **halaman** — bukan penataan babnya, yang punya berkas sendiri
 * (`submodul.test.ts`).
 */

const WAKTU = "2026-09-24T00:00:00.000Z";

function halaman(id: string, urutan: number, judul = `Halaman ${urutan}`): Halaman {
  return {
    id,
    submodul_id: "sub-1",
    modul_id: "mod-1",
    course_id: "crs-1",
    judul,
    urutan,
    blok: [],
    created_at: WAKTU,
    updated_at: WAKTU,
  };
}

function bab(halamanDaftar?: Halaman[], over: Partial<Submodul> = {}): Submodul {
  return {
    id: "sub-1",
    modul_id: "mod-1",
    course_id: "crs-1",
    judul: "Bagian 1",
    ringkasan: "",
    urutan: 1,
    halaman: halamanDaftar ?? [],
    created_at: WAKTU,
    updated_at: WAKTU,
    ...over,
  };
}

/** Modul berisi **satu** bab dengan halaman yang diberikan. */
function modul(halamanDaftar?: Halaman[]): Pick<Modul, "submodul"> {
  return { submodul: [bab(halamanDaftar)] };
}

/** Modul dari beberapa bab — untuk menguji perataan lintas bab. */
function modulBerbab(babDaftar: Submodul[]): Pick<Modul, "submodul"> {
  return { submodul: babDaftar };
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

function modulLengkap(id: string, materi: unknown[], babDaftar: Submodul[] = []): Modul {
  return {
    id,
    course_id: "crs-1",
    judul: "Modul Uji",
    ringkasan: "Ringkasan modul uji.",
    urutan: 1,
    durasi_min: 30,
    materi: materi as Modul["materi"],
    submodul: babDaftar,
    created_at: WAKTU,
    updated_at: WAKTU,
  };
}

describe("halamanUntukModul", () => {
  it("mengurutkan menaik berdasarkan urutan", () => {
    const hasil = halamanUntukModul(modul([halaman("c", 3), halaman("a", 1), halaman("b", 2)]));
    expect(hasil.map((h) => h.id)).toEqual(["a", "b", "c"]);
  });

  it("mengembalikan daftar kosong bila modul tidak punya bab", () => {
    // Modul lama memang belum punya `submodul` sama sekali — itu berarti "tidak
    // ada halaman", bukan error.
    expect(halamanUntukModul({ submodul: [] })).toEqual([]);
    expect(halamanUntukModul(modul([]))).toEqual([]);
  });

  it("tidak mengubah array aslinya", () => {
    const asli = [halaman("c", 3), halaman("a", 1)];
    halamanUntukModul(modul(asli));
    expect(asli.map((h) => h.id)).toEqual(["c", "a"]);
  });

  it("meratakan lintas bab menurut urutan babnya", () => {
    // Inti keberadaan fungsi ini: halaman modul adalah gabungan bab, dan
    // urutannya ditentukan bab dulu, baru halaman di dalam bab.
    const mod = modulBerbab([
      bab([halaman("b2", 2), halaman("b1", 1)], { id: "sub-2", urutan: 2 }),
      bab([halaman("a1", 1)], { id: "sub-1", urutan: 1 }),
    ]);
    expect(halamanUntukModul(mod).map((h) => h.id)).toEqual(["a1", "b1", "b2"]);
  });
});

describe("cariHalaman", () => {
  it("menemukan halaman berdasarkan id", () => {
    expect(cariHalaman(modul([halaman("a", 1)]), "a")?.id).toBe("a");
  });

  it("mengembalikan null bila tidak ada", () => {
    expect(cariHalaman(modul([halaman("a", 1)]), "z")).toBeNull();
    expect(cariHalaman({ submodul: [] }, "a")).toBeNull();
  });

  it("menemukan halaman di bab kedua", () => {
    const mod = modulBerbab([
      bab([halaman("a1", 1)], { id: "sub-1", urutan: 1 }),
      bab([halaman("b1", 1)], { id: "sub-2", urutan: 2 }),
    ]);
    expect(cariHalaman(mod, "b1")?.id).toBe("b1");
  });
});

describe("nomorHalaman", () => {
  it("mengembalikan nomor 1-based mengikuti posisi array", () => {
    expect(nomorHalaman(modul([halaman("a", 1), halaman("b", 2)]), "b")).toBe(2);
  });

  it("mengembalikan null bila halaman tidak ada", () => {
    expect(nomorHalaman(modul([halaman("a", 1)]), "z")).toBeNull();
  });

  it("menomori lintas bab, bukan mulai ulang tiap bab", () => {
    // Peserta melihat "Halaman 2", bukan "halaman 1 dari bab kedua".
    const mod = modulBerbab([
      bab([halaman("a1", 1)], { id: "sub-1", urutan: 1 }),
      bab([halaman("b1", 1)], { id: "sub-2", urutan: 2 }),
    ]);
    expect(nomorHalaman(mod, "b1")).toBe(2);
  });
});

describe("punyaHalaman", () => {
  it("membedakan modul berhalaman dari yang tidak", () => {
    expect(punyaHalaman(modul([halaman("a", 1)]))).toBe(true);
    expect(punyaHalaman(modul([]))).toBe(false);
    expect(punyaHalaman({ submodul: [] })).toBe(false);
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
    expect(jumlahKata(modul([h]))).toBe(6);
  });

  it("tidak menghitung gambar", () => {
    const h: Halaman = {
      ...halaman("a", 1),
      blok: [{ id: "g1", tipe: "gambar", src: "/uploads/a.png", alt: "diagram alur proses" }],
    };
    expect(jumlahKata(modul([h]))).toBe(0);
  });

  it("mengembalikan 0 untuk modul tanpa halaman", () => {
    expect(jumlahKata({ submodul: [] })).toBe(0);
  });

  it("tidak menghitung isi kode sebagai kata baca", () => {
    const h: Halaman = {
      id: "hal-1",
      submodul_id: "sub-1",
      modul_id: "m1",
      course_id: "c1",
      judul: "Kode",
      urutan: 1,
      blok: [{ id: "blk-1", tipe: "kode", bahasa: "cpp", kode: "int main(){ return 0; }" }],
      created_at: WAKTU,
      updated_at: WAKTU,
    };
    expect(jumlahKata(modul([h]))).toBe(0);
  });
});

describe("jumlahKataHalaman", () => {
  it("sama dengan jumlah kata modul yang berisi satu halaman itu", () => {
    // `jumlahKata(modul)` kini didefinisikan sebagai jumlah `jumlahKataHalaman`;
    // assertion ini yang menjaga keduanya tidak bisa menyimpang.
    const h: Halaman = {
      ...halaman("a", 1),
      blok: [
        { id: "p1", tipe: "paragraf", segmen: [{ teks: "satu dua tiga" }] },
        { id: "d1", tipe: "daftar", butir: [[{ teks: "empat lima" }]] },
      ],
    };
    expect(jumlahKataHalaman(h)).toBe(5);
    expect(jumlahKata(modul([h]))).toBe(jumlahKataHalaman(h));
  });

  it("menjumlahkan semua halaman, bukan hanya yang pertama", () => {
    const satu = { ...halaman("a", 1), blok: [{ id: "p1", tipe: "paragraf" as const, segmen: [{ teks: "satu" }] }] };
    const dua = { ...halaman("b", 2), blok: [{ id: "p2", tipe: "paragraf" as const, segmen: [{ teks: "dua tiga" }] }] };
    expect(jumlahKata(modul([satu, dua]))).toBe(3);
  });

  it("mengembalikan 0 untuk halaman tanpa blok", () => {
    expect(jumlahKataHalaman(halaman("a", 1))).toBe(0);
  });
});

/**
 * Perkiraan menit baca — satu-satunya angka "≈" di UI.
 *
 * Yang dikunci adalah **bentuk** jawabannya, bukan kecepatan bacanya: lantai 1
 * menit (halaman 3 kata bukan "0 mnt", yang terbaca seperti halaman kosong) dan
 * pembulatan ke atas (bagian menit tidak punya arti di sini).
 */
describe("perkiraanMenitBaca", () => {
  function halamanKata(n: number): Halaman {
    const teks = Array.from({ length: n }, () => "kata").join(" ");
    return { ...halaman("a", 1), blok: [{ id: "p1", tipe: "paragraf", segmen: [{ teks }] }] };
  }

  it("memberi minimal 1 menit untuk halaman pendek", () => {
    expect(perkiraanMenitBaca(halamanKata(1))).toBe(1);
    expect(perkiraanMenitBaca(halamanKata(0))).toBe(1);
  });

  it("membulatkan ke atas, bukan ke terdekat", () => {
    // 201 kata pada 200 kpm adalah 1,005 menit — pengguna yang membacanya butuh
    // lebih dari satu menit, jadi "2 mnt" lebih jujur daripada "1 mnt".
    expect(perkiraanMenitBaca(halamanKata(KATA_PER_MENIT + 1))).toBe(2);
    expect(perkiraanMenitBaca(halamanKata(KATA_PER_MENIT))).toBe(1);
  });

  it("naik seiring jumlah kata", () => {
    expect(perkiraanMenitBaca(halamanKata(KATA_PER_MENIT * 3))).toBe(3);
  });
});

/**
 * `halamanDipilih` — aturan "halaman mana yang tampil" untuk **dua** pemakai:
 * pane modul (yang merendernya) dan panel silabus (yang menyorot barisnya).
 *
 * Karena itu yang diuji di sini adalah kontraknya, bukan pemakaiannya: id yang
 * benar, id basi, dan id yang tidak ada sama sekali harus menjawab sama dengan
 * yang dirender pane. Dua salinan aturan ini akan menyimpang tanpa error.
 */
describe("halamanDipilih", () => {
  const satu = halaman("a", 1);
  const dua = halaman("b", 2);
  const mod = modul([satu, dua]);

  it("memilih halaman yang diminta", () => {
    expect(halamanDipilih(mod, "b")?.id).toBe("b");
  });

  it("jatuh ke halaman pertama saat id tidak ketemu", () => {
    // `?halaman=` datang dari URL: tautan lama atau halaman yang dihapus admin
    // bukan galat, melainkan halaman pertama.
    expect(halamanDipilih(mod, "hal-yang-dihapus")?.id).toBe("a");
  });

  it("jatuh ke halaman pertama saat tidak ada id sama sekali", () => {
    expect(halamanDipilih(mod)?.id).toBe("a");
    expect(halamanDipilih(mod, null)?.id).toBe("a");
    expect(halamanDipilih(mod, "")?.id).toBe("a");
  });

  it("mengembalikan null untuk modul tanpa halaman", () => {
    // Modul turunan tidak punya halaman; pane menanganinya dengan cabang
    // "ringkasan + tautan eksternal". `null` di sini bukan halaman pertama.
    expect(halamanDipilih({ submodul: [] }, "a")).toBeNull();
    expect(halamanDipilih(modul([]), "a")).toBeNull();
  });
});

describe("judulHalamanOtomatis", () => {
  it("memberi judul berurutan", () => {
    expect(judulHalamanOtomatis(1)).toBe("Halaman 1");
    expect(judulHalamanOtomatis(12)).toBe("Halaman 12");
  });
});

/**
 * Migrasi materi `teks` → halaman.
 *
 * Sejak halaman hidup di dalam bab, hasil promosi masuk ke **bab pertama**
 * modulnya. Berkas ini menguji cabang itu dengan modul yang sudah berbab — yang
 * belum berbab diurus `normalisasiSubmodulLama` (lihat `submodul.test.ts`), dan
 * `pastikanTermuat` menjalankannya lebih dulu.
 */
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
    const kursus = kursusDengan([modulLengkap("mod-1", [materiTeksLama], [bab([])])]);
    const hasil = normalisasiHalamanLama(kursus);

    const halamanBab = hasil.modul![0].submodul![0].halaman;
    expect(halamanBab).toHaveLength(1);
    expect(halamanBab[0].judul).toBe("Catatan Lama");
    expect(halamanBab[0].blok).toHaveLength(1);
    expect(halamanBab[0].blok[0].tipe).toBe("paragraf");
    expect(halamanBab[0].blok[0].segmen?.[0].teks).toBe("Isi catatan dari versi sebelumnya.");
  });

  it("membuang materi teks setelah dipromosikan", () => {
    // Dua sumber untuk prosa yang sama akan membuat salah satunya jadi stale.
    const kursus = kursusDengan([modulLengkap("mod-1", [materiTeksLama], [bab([])])]);
    expect(normalisasiHalamanLama(kursus).modul![0].materi).toEqual([]);
  });

  it("mempertahankan id dan timestamp asli materi", () => {
    const kursus = kursusDengan([modulLengkap("mod-1", [materiTeksLama], [bab([])])]);
    const h = normalisasiHalamanLama(kursus).modul![0].submodul![0].halaman[0];
    expect(h.id).toBe("hal-mat-1");
    expect(h.created_at).toBe("2026-09-20T00:00:00.000Z");
  });

  it("idempoten: menjalankan dua kali tidak menggandakan halaman", () => {
    // Id diturunkan dari id materi, bukan dari waktu — jadi migrasi yang
    // terpanggil berulang tidak menumpuk halaman.
    const kursus = kursusDengan([modulLengkap("mod-1", [materiTeksLama], [bab([])])]);
    const sekali = normalisasiHalamanLama(kursus);
    const dua = normalisasiHalamanLama(sekali);
    expect(dua.modul![0].submodul![0].halaman).toHaveLength(1);
  });

  it("tidak mengubah kursus yang tidak punya materi teks", () => {
    // Referensi yang sama, bukan salinan: tidak ada penulisan disk yang dipicu
    // tanpa perubahan nyata.
    const kursus = kursusDengan([modulLengkap("mod-1", [], [bab([])])]);
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
      modulLengkap("mod-1", [materiTeksLama], [bab([halaman("hal-baru", 1, "Sudah Ada")])]),
    ]);
    const halamanBab = normalisasiHalamanLama(kursus).modul![0].submodul![0].halaman;
    expect(halamanBab.map((x) => x.judul)).toEqual(["Catatan Lama", "Sudah Ada"]);
  });

  it("menomori ulang 1..n setelah penggabungan", () => {
    const kursus = kursusDengan([
      modulLengkap("mod-1", [materiTeksLama], [bab([halaman("hal-baru", 1, "Sudah Ada")])]),
    ]);
    const halamanBab = normalisasiHalamanLama(kursus).modul![0].submodul![0].halaman;
    expect(halamanBab.map((x) => x.urutan)).toEqual([1, 2]);
  });

  it("menandai submodul_id halaman hasil migrasi ke bab pertama", () => {
    // Invariant "setiap halaman punya bab" harus tetap benar setelah migrasi;
    // halaman ber-submodul_id salah tidak akan dirender `halamanModul` di bab itu.
    const kursus = kursusDengan([modulLengkap("mod-1", [materiTeksLama], [bab([])])]);
    const h = normalisasiHalamanLama(kursus).modul![0].submodul![0].halaman[0];
    expect(h.submodul_id).toBe("sub-1");
  });

  it("memberi judul cadangan bila materi lama tidak punya judul", () => {
    const tanpaJudul = { ...materiTeksLama, judul: "" };
    const kursus = kursusDengan([modulLengkap("mod-1", [tanpaJudul], [bab([])])]);
    expect(normalisasiHalamanLama(kursus).modul![0].submodul![0].halaman[0].judul).toBe(
      "Halaman 1",
    );
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
    const kursus = kursusDengan([modulLengkap("mod-1", [materiVideo, materiTeksLama], [bab([])])]);
    const mod = normalisasiHalamanLama(kursus).modul![0];
    expect(mod.materi).toHaveLength(1);
    expect(mod.materi![0].tipe).toBe("video");
  });
});
