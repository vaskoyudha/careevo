import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  bacaPerforma,
  catatPenyelesaian,
  catatSkorKuis,
  indeksPerforma,
  tempatPerforma,
} from "./store";

const PEMBELAJAR = "siswa@careevo.test";
const NAMA = "Raka Pratama";

const dasarPenyelesaian = {
  owner: PEMBELAJAR,
  nama: NAMA,
  courseId: "crs-1",
  judulKursus: "Fullstack Web",
  modulId: "crs-1-m1",
};

/**
 * Direktori **per test**, bukan hanya dari `vitest.config.mts`.
 *
 * Env global itu jaring pengaman (menjamin tidak ada test yang menyentuh
 * `.data/` repo), tetapi ia juga dipakai bersama oleh berkas test lain yang
 * berjalan paralel — `resetPerforma()` di sini akan menghapus berkas milik
 * test itu. `tempatPerforma()` membaca env per panggilan, jadi override di
 * `beforeEach` langsung berlaku meski impor modulnya statis.
 */
beforeEach(() => {
  process.env.CAREEVO_PERFORMA_DIR = mkdtempSync(path.join(tmpdir(), "careevo-performa-store-"));
});

describe("toko performa", () => {
  it("mencerminkan penyelesaian dan membedakan sumbernya", async () => {
    await catatPenyelesaian({ ...dasarPenyelesaian, sumber: "terverifikasi" });
    await catatPenyelesaian({ ...dasarPenyelesaian, modulId: "crs-1-m2", sumber: "informal" });

    const record = await bacaPerforma(PEMBELAJAR);
    expect(record?.kursus).toHaveLength(1);
    expect(record?.kursus[0].selesai).toHaveLength(2);
    expect(record?.kursus[0].selesai.map((s) => s.sumber).sort()).toEqual([
      "informal",
      "terverifikasi",
    ]);
  });

  it("tidak menggandakan cermin untuk modul yang sama", async () => {
    await catatPenyelesaian({ ...dasarPenyelesaian, sumber: "terverifikasi" });
    await catatPenyelesaian({ ...dasarPenyelesaian, sumber: "terverifikasi" });
    expect((await bacaPerforma(PEMBELAJAR))?.kursus[0].selesai).toHaveLength(1);
  });

  it("melepas cermin ketika pembatalan menandai modul selesai lagi", async () => {
    await catatPenyelesaian({ ...dasarPenyelesaian, sumber: "terverifikasi" });
    await catatPenyelesaian({ ...dasarPenyelesaian, sumber: "terverifikasi", batal: true });
    expect((await bacaPerforma(PEMBELAJAR))?.kursus[0].selesai).toHaveLength(0);
  });

  it("menyimpan skor kuis dan mengindeks lintas-pemilik", async () => {
    await catatSkorKuis({
      owner: PEMBELAJAR,
      nama: NAMA,
      courseId: "crs-1",
      judulKursus: "Fullstack Web",
      kuisId: "kuis-1",
      modulId: "crs-1-m1",
      nilai: 80,
      totalSoal: 5,
    });
    const semua = await indeksPerforma();
    expect(semua.some((r) => r.owner === PEMBELAJAR)).toBe(true);
    expect(semua.find((r) => r.owner === PEMBELAJAR)?.kursus[0].kuis[0].sumber).toBe("klien");
  });

  it("menolak skor di luar rentang 0-100", async () => {
    await expect(
      catatSkorKuis({
        owner: PEMBELAJAR,
        nama: NAMA,
        courseId: "crs-1",
        judulKursus: "F",
        kuisId: "k-1",
        modulId: "m-1",
        nilai: 120,
        totalSoal: 5,
      }),
    ).resolves.toBeNull();
  });

  it("menaruh berkas di direktori yang bisa dialihkan", () => {
    expect(tempatPerforma()).toBe(process.env.CAREEVO_PERFORMA_DIR);
  });

  it("tidak membaca berkas milik pemilik lain", async () => {
    await catatPenyelesaian({ ...dasarPenyelesaian, sumber: "informal" });
    expect(await bacaPerforma("orang-lain@careevo.test")).toBeNull();
  });
});
