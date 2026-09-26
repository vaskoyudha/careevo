import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  bacaPerforma,
  catatPenyelesaian,
  indeksPerforma,
  tempatPerforma,
  tulisPerforma,
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

  it("mengindeks catatan lintas-pemilik", async () => {
    await catatPenyelesaian({ ...dasarPenyelesaian, sumber: "terverifikasi" });
    const semua = await indeksPerforma();
    expect(semua.some((r) => r.owner === PEMBELAJAR)).toBe(true);
  });

  it("menaruh berkas di direktori yang bisa dialihkan", () => {
    expect(tempatPerforma()).toBe(process.env.CAREEVO_PERFORMA_DIR);
  });

  it("tidak membaca berkas milik pemilik lain", async () => {
    await catatPenyelesaian({ ...dasarPenyelesaian, sumber: "informal" });
    expect(await bacaPerforma("orang-lain@careevo.test")).toBeNull();
  });

  it("tetap membaca record lama yang memuat sumber kuis 'klien'", async () => {
    // Kontrak historis: jalur skor lama menulis `sumber: "klien"` pada tiap
    // percobaan kuis. Penilaian kini pindah ke `quiz_attempts`, tetapi berkas
    // `.data/performa` yang sudah ada harus tetap terbaca — menghapus field itu
    // dari tipe (tanpa menjaga pembacaan) adalah cara termudah kehilangan data.
    await tulisPerforma({
      owner: PEMBELAJAR,
      nama: NAMA,
      versi_skema: 1,
      kursus: [
        {
          course_id: "crs-1",
          judul: "Fullstack Web",
          selesai: [],
          kuis: [
            {
              kuis_id: "kuis-1",
              modul_id: "crs-1-m1",
              nilai: 80,
              total_soal: 5,
              at: "2026-01-01T00:00:00.000Z",
              sumber: "klien",
            },
          ],
        },
      ],
    });

    // Jalur produksi yang tersisa melakukan read-modify-write. Pastikan
    // menambah cermin modul tidak menghapus kuis historis yang tidak lagi
    // ditulis oleh sistem baru.
    await catatPenyelesaian({
      ...dasarPenyelesaian,
      modulId: "crs-1-m2",
      sumber: "informal",
    });

    const record = await bacaPerforma(PEMBELAJAR);
    expect(record?.kursus[0].kuis[0]).toMatchObject({
      kuis_id: "kuis-1",
      nilai: 80,
      sumber: "klien",
    });
    expect(record?.kursus[0].selesai).toContainEqual(
      expect.objectContaining({ modul_id: "crs-1-m2", sumber: "informal" }),
    );
  });
});
