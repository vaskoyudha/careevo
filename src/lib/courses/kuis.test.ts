import { describe, it, expect } from "vitest";
import {
  kuisUntukModul,
  jumlahSoalModul,
  promosiKuisLama,
  ringkasKuis,
  terpasang,
} from "./kuis";
import type { Course, Kuis, Modul, SoalKuis } from "@/types/course";

/**
 * Operasi murni atas kuis.
 *
 * Yang diuji di sini adalah aturan yang tidak terlihat dari UI: id yatim harus
 * gugur, migrasi harus idempoten, dan kuis yang sudah disunting tidak boleh
 * ditimpa oleh migrasi yang terpanggil ulang. Ketiganya adalah cara paling
 * mudah kehilangan data, jadi masing-masing punya test sendiri.
 */

const SOAL: SoalKuis = {
  id: "s1",
  pertanyaan: "Apa kegunaan useState?",
  pilihan: ["Menyimpan state lokal", "Mengambil data HTTP"],
  jawaban_benar: 0,
};

function kuis(over: Partial<Kuis> = {}): Kuis {
  return {
    id: "kuis-1",
    judul: "Kuis Dasar",
    deskripsi: "",
    soal: [SOAL],
    nilai_lulus: 70,
    created_at: "2026-09-24T00:00:00.000Z",
    updated_at: "2026-09-24T00:00:00.000Z",
    ...over,
  };
}

/**
 * Kursus minimal dengan satu modul; cukup untuk menguji promosi.
 *
 * `materi` sengaja bertipe `unknown[]`: fixture di sini justru berisi bentuk
 * materi `kuis` dari versi lama yang sudah tidak ada di union `Materi`, dan
 * itulah yang perlu diuji migrasinya.
 */
function kursusDengan(modul: Array<Partial<Omit<Modul, "materi">> & { materi?: unknown[] }>): Course {
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
    modul: modul.map((m, i) => ({
      id: `mod-${i + 1}`,
      course_id: "crs-1",
      judul: `Modul ${i + 1}`,
      ringkasan: "Ringkasan modul yang cukup panjang untuk lolos validasi.",
      urutan: i + 1,
      durasi_min: 30,
      created_at: "2026-09-24T00:00:00.000Z",
      updated_at: "2026-09-24T00:00:00.000Z",
      ...m,
      materi: m.materi as Modul["materi"],
    })),
  };
}

/** Materi `kuis` dari versi lama — bentuk yang sudah tidak ada di `Materi`. */
function materiKuisLama(over: Record<string, unknown> = {}) {
  return {
    id: "mat-kuis-1",
    modul_id: "mod-1",
    course_id: "crs-1",
    judul: "Kuis Lama",
    urutan: 1,
    tipe: "kuis",
    soal: [SOAL],
    nilai_lulus: 70,
    created_at: "2026-09-20T00:00:00.000Z",
    updated_at: "2026-09-20T00:00:00.000Z",
    ...over,
  };
}

describe("kuisUntukModul", () => {
  it("mengembalikan kuis sesuai urutan id di modul", async () => {
    const bank = [kuis({ id: "a", judul: "A" }), kuis({ id: "b", judul: "B" })];
    const modul = { kuis: ["b", "a"] };

    expect(kuisUntukModul(modul, bank).map((k) => k.id)).toEqual(["b", "a"]);
  });

  it("mengabaikan id yang tidak ada di bank", () => {
    // Referensi yatim bisa muncul dari berkas yang disunting tangan atau
    // penghapusan yang terlewat. Mengembalikannya sebagai entri kosong akan
    // membuat UI menjanjikan asesmen yang tidak bisa dikerjakan.
    const bank = [kuis({ id: "a" })];
    const modul = { kuis: ["a", "sudah-dihapus"] };

    expect(kuisUntukModul(modul, bank).map((k) => k.id)).toEqual(["a"]);
  });

  it("mengembalikan daftar kosong bila modul belum punya kuis", () => {
    expect(kuisUntukModul({}, [kuis()])).toEqual([]);
    expect(kuisUntukModul({ kuis: [] }, [kuis()])).toEqual([]);
  });
});

describe("terpasang", () => {
  it("menandai id yang sudah dipasang", () => {
    expect(terpasang({ kuis: ["a", "b"] }, "b")).toBe(true);
    expect(terpasang({ kuis: ["a"] }, "b")).toBe(false);
    expect(terpasang({}, "a")).toBe(false);
  });
});

describe("jumlahSoalModul", () => {
  it("menjumlahkan soal dari kuis yang benar-benar terpasang", () => {
    const bank = [
      kuis({ id: "a", soal: [SOAL, SOAL] }),
      kuis({ id: "b", soal: [SOAL] }),
    ];

    // "hilang" tidak ikut dihitung karena tidak ada di bank.
    expect(jumlahSoalModul({ kuis: ["a", "b", "hilang"] }, bank)).toBe(3);
  });
});

describe("ringkasKuis", () => {
  it("menyebut jumlah soal dan ambang lulus", () => {
    expect(ringkasKuis({ soal: [SOAL, SOAL], nilai_lulus: 75 })).toBe("2 soal · lulus 75");
  });
});

describe("promosiKuisLama", () => {
  it("tidak mengubah apa pun bila tidak ada materi kuis", () => {
    const kursus = kursusDengan([{ materi: [] }]);
    const hasil = promosiKuisLama(kursus, []);

    // Referensi yang sama penting: menyimpannya ulang akan memicu penulisan
    // disk tanpa perubahan nyata.
    expect(hasil.course).toBe(kursus);
    expect(hasil.bank).toEqual([]);
  });

  it("memindahkan materi kuis ke bank dan memasangnya di modul", () => {
    const kursus = kursusDengan([{ materi: [materiKuisLama()] }]);
    const hasil = promosiKuisLama(kursus, []);

    expect(hasil.bank).toHaveLength(1);
    expect(hasil.bank[0].judul).toBe("Kuis Lama");
    expect(hasil.bank[0].soal).toHaveLength(1);

    const mod = hasil.course.modul![0];
    expect(mod.kuis).toEqual(["kuis-mat-kuis-1"]);
    // Materi kuis dibuang supaya tidak ada dua sumber untuk asesmen yang sama.
    expect(mod.materi).toEqual([]);
  });

  it("idempoten: dijalankan dua kali tidak menggandakan kuis", () => {
    const kursus = kursusDengan([{ materi: [materiKuisLama()] }]);
    const sekali = promosiKuisLama(kursus, []);
    const duaKali = promosiKuisLama(sekali.course, sekali.bank);

    expect(duaKali.bank).toHaveLength(1);
    expect(duaKali.course).toBe(sekali.course);
    expect(duaKali.course.modul![0].kuis).toEqual(["kuis-mat-kuis-1"]);
  });

  it("tidak menimpa kuis yang sudah ada di bank dengan id yang sama", () => {
    // Skenario nyata: migrasi sudah pernah jalan, admin menyunting judulnya,
    // lalu berkas lama entah bagaimana termuat lagi. Hasil suntingan admin
    // tidak boleh hilang.
    const sudahDisunting = kuis({ id: "kuis-mat-kuis-1", judul: "Sudah Disunting Admin" });
    const kursus = kursusDengan([{ materi: [materiKuisLama()] }]);

    const hasil = promosiKuisLama(kursus, [sudahDisunting]);

    expect(hasil.bank).toHaveLength(1);
    expect(hasil.bank[0].judul).toBe("Sudah Disunting Admin");
    // Modul tetap mendapat referensinya supaya kuisnya benar-benar terpasang.
    expect(hasil.course.modul![0].kuis).toEqual(["kuis-mat-kuis-1"]);
  });

  it("tidak menggandakan referensi bila kuis itu sudah terpasang", () => {
    const kursus = kursusDengan([{ kuis: ["kuis-mat-kuis-1"], materi: [materiKuisLama()] }]);
    const hasil = promosiKuisLama(kursus, []);

    expect(hasil.course.modul![0].kuis).toEqual(["kuis-mat-kuis-1"]);
  });

  it("menaruh kuis hasil migrasi setelah kuis yang sudah dipasang", () => {
    // Menggeser urutan yang sudah disusun admin akan membingungkan: kuis yang
    // tadinya di atas tiba-tiba turun setelah berkas lama dibaca.
    const kursus = kursusDengan([{ kuis: ["kuis-lama-pasang"], materi: [materiKuisLama()] }]);
    const hasil = promosiKuisLama(kursus, []);

    expect(hasil.course.modul![0].kuis).toEqual(["kuis-lama-pasang", "kuis-mat-kuis-1"]);
  });

  it("tidak mempromosikan kuis yang seluruh soalnya rusak", () => {
    // Soal tanpa kunci yang sah tidak bisa dinilai; kuis semacam itu hanya akan
    // menampilkan pertanyaan yang mustahil dijawab.
    const kursus = kursusDengan([
      { materi: [materiKuisLama({ soal: [{ pertanyaan: "Rusak", pilihan: ["Satu"], jawaban_benar: 9 }] })] },
    ]);
    const hasil = promosiKuisLama(kursus, []);

    expect(hasil.bank).toEqual([]);
    // Materi rusaknya dibiarkan apa adanya supaya tidak hilang tanpa jejak.
    expect(hasil.course.modul![0].materi).toHaveLength(1);
  });

  it("membuang soal rusak tapi menyimpan soal yang sah di kuis yang sama", () => {
    const kursus = kursusDengan([
      {
        materi: [
          materiKuisLama({
            soal: [
              SOAL,
              { pertanyaan: "Tanpa kunci", pilihan: ["A", "B"], jawaban_benar: 7 },
              { pertanyaan: "Ab", pilihan: ["A", "B"], jawaban_benar: 0 },
            ],
          }),
        ],
      },
    ]);
    const hasil = promosiKuisLama(kursus, []);

    expect(hasil.bank[0].soal).toHaveLength(1);
    expect(hasil.bank[0].soal[0].pertanyaan).toBe(SOAL.pertanyaan);
  });

  it("menjepit nilai lulus ke 0–100 dan memakai bawaan saat bukan angka", () => {
    const kursus = kursusDengan([
      { id: "mod-1", materi: [materiKuisLama({ id: "a", nilai_lulus: 900 })] },
      { id: "mod-2", materi: [materiKuisLama({ id: "b", nilai_lulus: -5 })] },
      { id: "mod-3", materi: [materiKuisLama({ id: "c", nilai_lulus: "bukan angka" })] },
    ]);
    const hasil = promosiKuisLama(kursus, []);

    expect(hasil.bank.map((k) => k.nilai_lulus)).toEqual([100, 0, 70]);
  });

  it("menurunkan id soal yang tidak punya id agar migrasi tetap deterministik", () => {
    const kursus = kursusDengan([
      { materi: [materiKuisLama({ soal: [{ ...SOAL, id: undefined }] })] },
    ]);
    const hasil = promosiKuisLama(kursus, []);

    expect(hasil.bank[0].soal[0].id).toBe("kuis-mat-kuis-1-s1");
  });

  it("memakai judul bawaan bila materi lama tidak punya judul", () => {
    const kursus = kursusDengan([{ materi: [materiKuisLama({ judul: "  " })] }]);
    const hasil = promosiKuisLama(kursus, []);

    expect(hasil.bank[0].judul).toBe("Kuis");
  });
});
