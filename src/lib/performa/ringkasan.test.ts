import { describe, expect, it } from "vitest";
import type { RecordPerforma } from "@/lib/performa/store";
import type { RingkasanIntegritas } from "@/lib/performa/integritas";
import { barisIntegritas, barisPembelajaran } from "./ringkasan";

function record(owner: string, nama: string, selesai: Array<{ sumber: string }>, nilai: number[]): RecordPerforma {
  return {
    owner,
    nama,
    versi_skema: 1,
    kursus: [
      {
        course_id: "crs-1",
        judul: "Kursus Uji",
        selesai: selesai.map((s, i) => ({ modul_id: `m${i}`, at: "2026-09-25T10:00:00.000Z", sumber: s.sumber as "terverifikasi" | "informal" })),
        kuis: nilai.map((n, i) => ({
          kuis_id: `k${i}`,
          modul_id: "m0",
          nilai: n,
          total_soal: 4,
          at: "2026-09-25T10:00:00.000Z",
          sumber: "klien",
        })),
      },
    ],
  };
}

const tanpaSesi = (): Map<string, RingkasanIntegritas> => new Map();

describe("barisPembelajaran", () => {
  it("menghitung modul selesai dan rata-rata kuis", () => {
    const baris = barisPembelajaran([record("a@x.test", "Aisyah", [{ sumber: "terverifikasi" }, { sumber: "informal" }], [80, 100])]);
    expect(baris).toHaveLength(1);
    expect(baris[0]).toMatchObject({ owner: "a@x.test", nama: "Aisyah", selesai: 2, rataRataKuis: 90 });
  });

  it("menyisakan null ketika belum ada nilai kuis", () => {
    // `null` bukan `0`: "tidak ada data" dan "nilai nol" adalah dua klaim
    // berbeda, dan tabel harus bisa membedakannya.
    const baris = barisPembelajaran([record("a@x.test", "Aisyah", [], [])]);
    expect(baris[0].rataRataKuis).toBeNull();
  });

  it("mengurutkan berdasarkan nama", () => {
    const baris = barisPembelajaran([
      record("z@x.test", "Zulfikar", [], []),
      record("a@x.test", "Aisyah", [], []),
    ]);
    expect(baris.map((b) => b.nama)).toEqual(["Aisyah", "Zulfikar"]);
  });
});

describe("barisIntegritas", () => {
  const peta = new Map<string, RingkasanIntegritas>([
    [
      "a@x.test",
      { sesi: 3, kejadian: 9, celah: 1, kedaluwarsa: 1, daftar: [] },
    ],
    [
      "hantu@x.test",
      { sesi: 1, kejadian: 0, celah: 0, kedaluwarsa: 0, daftar: [] },
    ],
  ]);

  it("menggabungkan catatan dan run milik pemilik yang sama", () => {
    const baris = barisIntegritas([record("a@x.test", "Aisyah", [{ sumber: "terverifikasi" }, { sumber: "informal" }], [])], peta);
    const a = baris.find((b) => b.owner === "a@x.test");
    expect(a).toMatchObject({ sesi: 3, kejadian: 9, celah: 1, kedaluwarsa: 1, terverifikasi: 1, selesai: 2 });
  });

  it("memampilkan pemilik yang punya run tanpa catatan performa", () => {
    // Sesi bisa tercatat tanpa satu pun modul selesai. Kalau pemilik seperti ini
    // hilang, yang hilang justru bukti bahwa pengumpulan datanya bermasalah.
    const baris = barisIntegritas([], peta);
    const hantu = baris.find((b) => b.owner === "hantu@x.test");
    expect(hantu).toMatchObject({ nama: "hantu@x.test", sesi: 1, selesai: 0, terverifikasi: 0 });
  });

  it("memampilkan pemilik yang punya catatan tanpa run", () => {
    const baris = barisIntegritas([record("baru@x.test", "Baru", [], [])], tanpaSesi());
    const b = baris.find((x) => x.owner === "baru@x.test");
    expect(b).toMatchObject({ nama: "Baru", sesi: 0, kejadian: 0, celah: 0 });
  });

  it("tidak pernah menyertakan nilai atau skor di baris integritas", () => {
    // Baris ini tidak boleh pernah bisa dipakai sebagai vonis. Daftar field-nya
    // dipatok supaya penambahan yang tak disengaja — terutama skor — ketahuan.
    const baris = barisIntegritas(
      [record("a@x.test", "Aisyah", [{ sumber: "informal" }], [100])],
      peta,
    );
    expect(Object.keys(baris[0]).sort()).toEqual([
      "celah",
      "kedaluwarsa",
      "kejadian",
      "nama",
      "owner",
      "selesai",
      "sesi",
      "terverifikasi",
    ]);
  });

  it("mengurutkan berdasarkan nama", () => {
    const baris = barisIntegritas([record("a@x.test", "Aisyah", [], [])], peta);
    // `hantu@x.test` tidak punya catatan, jadi nama yang tampil memang email.
    expect(baris.map((b) => b.nama)).toEqual(["Aisyah", "hantu@x.test"]);
  });
});
