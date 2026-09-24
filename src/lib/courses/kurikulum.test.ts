import { describe, it, expect, beforeEach } from "vitest";
import { modulKursus, hitungProgres, irisModulSelesai } from "./kurikulum";
import { modulUntuk, modulUntukSumber } from "./modul-resolver";
import { createModul, resetCourses } from "./store";

const SUMBER = {
  id: "crs-1",
  title: "Fullstack Web Development",
  tags: ["Next.js", "React", "TypeScript", "Tailwind"],
  duration_min: 180,
  url: "https://nextjs.org/docs",
};

describe("modulKursus", () => {
  it("selalu menghasilkan 5 modul dengan id stabil", () => {
    const a = modulKursus(SUMBER);
    const b = modulKursus(SUMBER);
    expect(a).toHaveLength(5);
    expect(a.map((m) => m.id)).toEqual(b.map((m) => m.id));
    expect(a[0].id).toBe("crs-1-m1");
    expect(a[4].id).toBe("crs-1-m5");
  });

  it("memakai 3 tag pertama sebagai modul inti", () => {
    const judul = modulKursus(SUMBER).map((m) => m.judul);
    expect(judul).toContain("Mendalami Next.js");
    expect(judul).toContain("Mendalami React");
    expect(judul).toContain("Mendalami TypeScript");
  });

  it("total durasi modul sama dengan durasi sumber", () => {
    const total = modulKursus(SUMBER).reduce((acc, m) => acc + m.durasi_min, 0);
    expect(total).toBe(180);
  });

  it("melengkapi modul inti saat tag kurang dari 3", () => {
    const modul = modulKursus({ ...SUMBER, id: "r6", tags: ["Git"] });
    expect(modul).toHaveLength(5);
    const judul = modul.map((m) => m.judul);
    expect(judul).toContain("Mendalami Git");
    expect(judul).toContain("Praktik terbimbing");
  });

  it("menangani durasi tidak valid dengan default 60 menit", () => {
    const modul = modulKursus({ ...SUMBER, duration_min: 0 });
    const total = modul.reduce((acc, m) => acc + m.durasi_min, 0);
    expect(total).toBe(60);
  });

  it("tidak pernah menghasilkan durasi negatif dan total tetap pas", () => {
    for (const durasi of [1, 3, 10, 24, 30]) {
      const modul = modulKursus({ ...SUMBER, duration_min: durasi });
      expect(modul.every((m) => m.durasi_min >= 0)).toBe(true);
      expect(modul.reduce((acc, m) => acc + m.durasi_min, 0)).toBe(durasi);
    }
  });
});

describe("irisModulSelesai", () => {
  it("membuang id yang tidak ada di kurikulum", () => {
    const modul = modulKursus(SUMBER);
    expect(irisModulSelesai(["crs-1-m1", "palsu", "crs-1-m9"], modul)).toEqual([
      "crs-1-m1",
    ]);
  });
});

describe("hitungProgres", () => {
  it("menghitung persen dengan benar dan menjepit 0–100", () => {
    expect(hitungProgres(0, 5)).toBe(0);
    expect(hitungProgres(1, 5)).toBe(20);
    expect(hitungProgres(4, 5)).toBe(80);
    expect(hitungProgres(5, 5)).toBe(100);
    expect(hitungProgres(9, 5)).toBe(100);
    expect(hitungProgres(-2, 5)).toBe(0);
    expect(hitungProgres(1, 0)).toBe(0);
  });
});

describe("modulUntukSumber", () => {
  // `resetCourses()` mematikan penulisan disk untuk sisa proses, jadi seluruh
  // test di blok ini berjalan murni in-memory dan tidak menyentuh
  // `data/courses.json` milik mesin pengembang.
  beforeEach(() => {
    resetCourses();
  });

  it("jatuh ke modul turunan saat kursus belum punya modul tersimpan", async () => {
    const modul = await modulUntukSumber(SUMBER);
    expect(modul).toHaveLength(5);
    expect(modul.map((m) => m.id)).toEqual([
      "crs-1-m1",
      "crs-1-m2",
      "crs-1-m3",
      "crs-1-m4",
      "crs-1-m5",
    ]);
  });

  it("memakai modul tersimpan bila ada, terurut menaik, ber-url kursus", async () => {
    // `createModul` selalu menaruh modul baru di akhir, jadi `urutan` yang
    // diharapkan mengikuti urutan pembuatan: 1 untuk "Orientasi", 2 untuk
    // "Deep Dive React".
    const pertama = await createModul("crs-1", {
      judul: "Orientasi",
      ringkasan: "Peta materi dan tujuan belajar.",
      durasi_min: 15,
    });
    const kedua = await createModul("crs-1", {
      judul: "Deep Dive React",
      ringkasan: "Membahas React 19 secara mendalam.",
      durasi_min: 45,
    });
    expect(pertama).not.toBeNull();
    expect(kedua).not.toBeNull();

    const modul = await modulUntukSumber(SUMBER);
    expect(modul).toHaveLength(2);
    // Terurut `urutan` menaik, dan memakai id tersimpan — bukan id turunan.
    expect(modul.map((m) => m.id)).toEqual([pertama!.id, kedua!.id]);
    expect(modul.map((m) => m.judul)).toEqual(["Orientasi", "Deep Dive React"]);
    expect(modul.map((m) => m.durasi_min)).toEqual([15, 45]);
    // Semua modul mewarisi url kursus induknya, bukan url per modul.
    expect(modul.every((m) => m.url === SUMBER.url)).toBe(true);
  });

  it("jatuh ke turunan untuk id yang tidak ada di store (kursus fixture)", async () => {
    // Fixture resource memang tidak pernah punya modul tersimpan, jadi ia tetap
    // memakai cabang turunan — bukan daftar kosong.
    const modul = await modulUntukSumber({ ...SUMBER, id: "r1" });
    expect(modul).toHaveLength(5);
    expect(modul[0].id).toBe("r1-m1");
  });
});

describe("modulUntuk", () => {
  beforeEach(() => {
    resetCourses();
  });

  it("mengembalikan daftar kosong bila id kursus tidak ada di store", async () => {
    expect(await modulUntuk("tidak-ada")).toEqual([]);
  });

  it("mendelegasikan ke modul turunan untuk kursus seed tanpa modul tersimpan", async () => {
    const modul = await modulUntuk("crs-1");
    expect(modul).toHaveLength(5);
    expect(modul[0].id).toBe("crs-1-m1");
  });
});
