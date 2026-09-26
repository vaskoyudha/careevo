import { describe, expect, it } from "vitest";
import type { RecordPerforma } from "@/lib/performa/store";
import type { RingkasanIntegritas } from "@/lib/performa/integritas";
import { barisIntegritas, barisPembelajaran } from "./ringkasan";

function record(
  owner: string,
  nama: string,
  selesai: Array<{ sumber: string }>,
  nilai: number[],
): RecordPerforma {
  return {
    owner,
    nama,
    versi_skema: 1,
    kursus: [
      {
        course_id: "crs-1",
        judul: "Kursus Uji",
        selesai: selesai.map((s, i) => ({
          modul_id: `m${i}`,
          at: "2026-09-25T10:00:00.000Z",
          sumber: s.sumber as "terverifikasi" | "informal",
        })),
        kuis: nilai.map((n, i) => ({
          kuis_id: `k${i}`,
          modul_id: "m0",
          nilai: n,
          total_soal: 4,
          at: "2026-09-25T10:00:00.000Z",
          // Record historis menulis `sumber: "klien"`; tetap ada di kontrak
          // supaya pembacaan lama tidak diam-diam berubah.
          sumber: "klien" as const,
        })),
      },
    ],
  };
}

const tanpaSesi = (): Map<string, RingkasanIntegritas> => new Map();

describe("barisPembelajaran", () => {
  it("menghitung modul selesai dan rata-rata kuis", () => {
    const baris = barisPembelajaran([
      record("a@x.test", "Aisyah", [{ sumber: "terverifikasi" }, { sumber: "informal" }], [80, 100]),
    ]);
    expect(baris).toHaveLength(1);
    expect(baris[0]).toMatchObject({
      owner: "a@x.test",
      nama: "Aisyah",
      selesai: 2,
      terverifikasi: 1,
      rataRataKuis: 90,
    });
  });

  it("menyisakan null ketika belum ada nilai kuis", () => {
    // `null` bukan `0`: "tidak ada data" dan "nilai nol" adalah dua klaim
    // berbeda, dan tabel harus bisa membedakannya.
    const baris = barisPembelajaran([record("a@x.test", "Aisyah", [], [])]);
    expect(baris[0].rataRataKuis).toBeNull();
  });

  it("menghitung nol untuk terverifikasi ketika semua modul selesai secara informal", () => {
    const baris = barisPembelajaran([
      record("a@x.test", "Aisyah", [{ sumber: "informal" }, { sumber: "informal" }], []),
    ]);
    expect(baris[0].terverifikasi).toBe(0);
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
    ["a@x.test", { sesi: 3, kejadian: 9, celah: 1, kedaluwarsa: 1, daftar: [] }],
    ["hantu@x.test", { sesi: 1, kejadian: 0, celah: 0, kedaluwarsa: 0, daftar: [] }],
  ]);

  // Peta nama, bukan catatan performa. Nama adalah identitas, bukan metrik, jadi
  // satu-satunya hal dari catatan belajar yang boleh masuk ke laporan integritas.
  const nama = new Map([["a@x.test", "Aisyah"]]);

  it("hanya memakai peta nama, bukan catatan performa", () => {
    // Dulu parameternya `RecordPerforma[]`, dan `selesai` serta `terverifikasi`
    // ikut terbawa ke baris integritas. Sekarang catatan performa tidak pernah
    // masuk ke fungsi ini sama sekali.
    const baris = barisIntegritas(nama, peta);
    expect(baris).toHaveLength(2);
  });

  it("memuat hanya fakta sesi milik pemilik yang punya run", () => {
    const a = barisIntegritas(nama, peta).find((b) => b.owner === "a@x.test");
    expect(a).toMatchObject({ nama: "Aisyah", sesi: 3, kejadian: 9, celah: 1, kedaluwarsa: 1 });
  });

  it("memakai email sebagai nama ketika nama tidak diketahui", () => {
    const baris = barisIntegritas(new Map(), peta);
    const hantu = baris.find((b) => b.owner === "hantu@x.test");
    expect(hantu).toMatchObject({ nama: "hantu@x.test", sesi: 1 });
  });

  it("tidak pernah menyertakan metrik belajar di baris integritas", () => {
    // Daftar field dipatok. Guard sebelumnya justru mengunci `selesai` dan
    // `terverifikasi` ke dalam tipenya, sehingga laporan integritas menampilkan
    // "3 / 10". Separuh angka itu hasil belajar, dan orang bisa menghitung
    // sendiri memakai angka yang ada di laporan sebelah.
    //
    // Sekarang daftar ini hanya boleh berisi fakta sesi. Menambah metrik belajar
    // harus menggagalkan test ini, bukan lolos diam-diam.
    const baris = barisIntegritas(nama, peta);
    expect(Object.keys(baris[0]).sort()).toEqual([
      "celah",
      "kedaluwarsa",
      "kejadian",
      "nama",
      "owner",
      "sesi",
    ]);
  });

  it("tidak memuat pemilik yang tidak punya sesi sama sekali", () => {
    // Dulu pemilik dengan catatan tapi tanpa sesi ikut dimuat, dengan alasan
    // "pengumpulan datanya bermasalah". Alasan itu benar, tapi tidak bisa lewat
    // laporan integritas: untuk mengetahuinya perlu data belajar, sedangkan dia
    // tidak punya catatan integritas untuk dilaporkan. Ketiadaan catatan bukan
    // temuan, jadi tidak boleh muncul di tabel temuan.
    const baris = barisIntegritas(new Map([["baru@x.test", "Baru"]]), tanpaSesi());
    expect(baris).toEqual([]);
  });

  it("mengurutkan berdasarkan nama", () => {
    const baris = barisIntegritas(nama, peta);
    // `hantu@x.test` tidak ada di peta nama, jadi yang tampil memang email.
    expect(baris.map((b) => b.nama)).toEqual(["Aisyah", "hantu@x.test"]);
  });
});
