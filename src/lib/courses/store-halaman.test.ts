import { describe, it, expect, beforeEach } from "vitest";
import {
  createModul,
  createHalaman,
  updateHalaman,
  deleteHalaman,
  geserHalaman,
  listHalaman,
  getHalaman,
  getCourseById,
  resetCourses,
} from "./store";
import type { BlokInput } from "@/types/course";

/**
 * CRUD halaman berformat pada store.
 *
 * Yang diuji di sini adalah invariant penyimpanan — penomoran `urutan` yang
 * harus rapat 1..n, penukaran posisi yang tidak boleh dibatalkan nilai `urutan`
 * basi, dan pemberian id blok. Bukan duplikat test action: action menguji
 * gerbang staf dan bentuk hasil.
 *
 * `resetCourses()` mematikan penulisan disk, jadi test tidak menyentuh
 * `data/courses.json` milik mesin pengembang.
 */

const COURSE_ID = "crs-1";

function isiModul(judul: string) {
  return { judul, ringkasan: `Ringkasan untuk ${judul} yang cukup panjang.`, durasi_min: 30 };
}

function heading(teks: string): BlokInput {
  return { tipe: "heading", level: 2, segmen: [{ teks }] };
}

beforeEach(() => {
  resetCourses();
});

describe("createHalaman", () => {
  it("menomori halaman berurutan 1..n", async () => {
    const modul = await createModul(COURSE_ID, isiModul("A"));
    await createHalaman(COURSE_ID, modul!.id, { judul: "Satu" });
    await createHalaman(COURSE_ID, modul!.id, { judul: "Dua" });

    const daftar = await listHalaman(COURSE_ID, modul!.id);
    expect(daftar.map((h) => h.urutan)).toEqual([1, 2]);
    expect(daftar.map((h) => h.judul)).toEqual(["Satu", "Dua"]);
  });

  it("mengisi id blok yang belum punya id", async () => {
    const modul = await createModul(COURSE_ID, isiModul("A"));
    const halaman = await createHalaman(COURSE_ID, modul!.id, {
      judul: "Satu",
      blok: [heading("Tujuan")],
    });

    // Id diberikan store, bukan klien — supaya klien tidak bisa menumbuk id
    // blok lain atau memutus kaitan jangkar.
    expect(halaman!.blok[0].id).toBeTruthy();
    expect(halaman!.blok[0].id).not.toBe("");
  });

  it("mempertahankan id blok yang sudah ada", async () => {
    const modul = await createModul(COURSE_ID, isiModul("A"));
    const halaman = await createHalaman(COURSE_ID, modul!.id, {
      judul: "Satu",
      blok: [{ id: "blk-tetap", tipe: "paragraf", segmen: [{ teks: "Isi." }] }],
    });
    expect(halaman!.blok[0].id).toBe("blk-tetap");
  });

  it("memangkas spasi di judul", async () => {
    const modul = await createModul(COURSE_ID, isiModul("A"));
    const halaman = await createHalaman(COURSE_ID, modul!.id, { judul: "  Rapi  " });
    expect(halaman!.judul).toBe("Rapi");
  });

  it("mengembalikan null untuk modul yang tidak ada", async () => {
    expect(await createHalaman(COURSE_ID, "mod-palsu", { judul: "X" })).toBeNull();
  });
});

describe("createModul dengan jumlah halaman", () => {
  it("membuat halaman kosong sebanyak yang diminta", async () => {
    const modul = await createModul(COURSE_ID, { ...isiModul("Berhalaman"), jumlah_halaman: 3 });

    const halaman = modul!.halaman ?? [];
    expect(halaman).toHaveLength(3);
    expect(halaman.map((h) => h.judul)).toEqual(["Halaman 1", "Halaman 2", "Halaman 3"]);
    expect(halaman.map((h) => h.urutan)).toEqual([1, 2, 3]);
  });

  it("membuat tanpa halaman bila jumlahnya nol atau tidak disebut", async () => {
    const nol = await createModul(COURSE_ID, { ...isiModul("Nol"), jumlah_halaman: 0 });
    expect(nol!.halaman).toEqual([]);

    const absen = await createModul(COURSE_ID, isiModul("Absen"));
    expect(absen!.halaman).toEqual([]);
  });

  it("menolak jumlah negatif dengan memperlakukannya sebagai nol", async () => {
    // Validasi sebenarnya ada di gerbang zod; store tetap tidak boleh
    // menghasilkan rentang negatif kalau nilainya lolos.
    const modul = await createModul(COURSE_ID, { ...isiModul("Negatif"), jumlah_halaman: -5 });
    expect(modul!.halaman).toEqual([]);
  });
});

describe("updateHalaman", () => {
  it("mengganti judul dan isi sekaligus", async () => {
    const modul = await createModul(COURSE_ID, isiModul("A"));
    const awal = await createHalaman(COURSE_ID, modul!.id, { judul: "Awal" });

    const hasil = await updateHalaman(COURSE_ID, modul!.id, awal!.id, {
      judul: "Diubah",
      blok: [heading("Bagian Baru")],
    });

    expect(hasil!.judul).toBe("Diubah");
    expect(hasil!.blok).toHaveLength(1);
    // Id dan waktu pembuatan bertahan: ini entitas yang sama, bukan baru.
    expect(hasil!.id).toBe(awal!.id);
    expect(hasil!.created_at).toBe(awal!.created_at);
  });

  it("tidak menyentuh blok bila `blok` tidak dikirim", async () => {
    // Dipakai saat admin hanya mengganti judul tanpa mengirim ulang isinya.
    const modul = await createModul(COURSE_ID, isiModul("A"));
    const awal = await createHalaman(COURSE_ID, modul!.id, {
      judul: "Awal",
      blok: [heading("Tetap")],
    });

    const hasil = await updateHalaman(COURSE_ID, modul!.id, awal!.id, { judul: "Judul Baru" });
    expect(hasil!.blok).toHaveLength(1);
    expect(hasil!.blok[0].id).toBe(awal!.blok[0].id);
  });

  it("mengganti blok seluruhnya bila `blok` dikirim", async () => {
    const modul = await createModul(COURSE_ID, isiModul("A"));
    const awal = await createHalaman(COURSE_ID, modul!.id, {
      judul: "Awal",
      blok: [heading("Lama")],
    });

    const hasil = await updateHalaman(COURSE_ID, modul!.id, awal!.id, {
      judul: "Awal",
      blok: [heading("Baru"), heading("Tambahan")],
    });
    expect(hasil!.blok).toHaveLength(2);
  });

  it("mengembalikan null untuk halaman yang tidak ada", async () => {
    const modul = await createModul(COURSE_ID, isiModul("A"));
    expect(await updateHalaman(COURSE_ID, modul!.id, "hal-palsu", { judul: "X" })).toBeNull();
  });
});

describe("deleteHalaman", () => {
  it("menghapus halaman dan merapikan urutan sisanya", async () => {
    const modul = await createModul(COURSE_ID, isiModul("A"));
    const satu = await createHalaman(COURSE_ID, modul!.id, { judul: "Satu" });
    await createHalaman(COURSE_ID, modul!.id, { judul: "Dua" });
    await createHalaman(COURSE_ID, modul!.id, { judul: "Tiga" });

    expect(await deleteHalaman(COURSE_ID, modul!.id, satu!.id)).toBe(true);

    const daftar = await listHalaman(COURSE_ID, modul!.id);
    expect(daftar.map((h) => h.judul)).toEqual(["Dua", "Tiga"]);
    // Rapat 1..n — tidak boleh berlubang setelah penghapusan.
    expect(daftar.map((h) => h.urutan)).toEqual([1, 2]);
  });

  it("mengembalikan false untuk halaman yang tidak ada", async () => {
    const modul = await createModul(COURSE_ID, isiModul("A"));
    expect(await deleteHalaman(COURSE_ID, modul!.id, "hal-palsu")).toBe(false);
  });

  it("ikut terhapus saat modulnya dihapus", async () => {
    const modul = await createModul(COURSE_ID, { ...isiModul("A"), jumlah_halaman: 3 });
    const { deleteModul } = await import("./store");
    await deleteModul(COURSE_ID, modul!.id);

    const kursus = await getCourseById(COURSE_ID);
    expect(kursus?.modul).toEqual([]);
  });
});

describe("geserHalaman", () => {
  it("menukar posisi dan menomori ulang mengikuti posisi array", async () => {
    const modul = await createModul(COURSE_ID, isiModul("A"));
    const satu = await createHalaman(COURSE_ID, modul!.id, { judul: "Satu" });
    await createHalaman(COURSE_ID, modul!.id, { judul: "Dua" });

    const hasil = await geserHalaman(COURSE_ID, modul!.id, satu!.id, "turun");
    expect(hasil!.map((h) => h.judul)).toEqual(["Dua", "Satu"]);
    // Inilah bug yang pernah terjadi pada modul: mengurutkan berdasarkan field
    // `urutan` yang masih basi justru membatalkan pertukaran.
    expect(hasil!.map((h) => h.urutan)).toEqual([1, 2]);
  });

  it("memindahkan halaman dari bawah ke atas", async () => {
    const modul = await createModul(COURSE_ID, isiModul("A"));
    await createHalaman(COURSE_ID, modul!.id, { judul: "Satu" });
    const dua = await createHalaman(COURSE_ID, modul!.id, { judul: "Dua" });

    const hasil = await geserHalaman(COURSE_ID, modul!.id, dua!.id, "naik");
    expect(hasil!.map((h) => h.judul)).toEqual(["Dua", "Satu"]);
  });

  it("tidak berubah saat sudah di ujung", async () => {
    const modul = await createModul(COURSE_ID, isiModul("A"));
    const satu = await createHalaman(COURSE_ID, modul!.id, { judul: "Satu" });
    await createHalaman(COURSE_ID, modul!.id, { judul: "Dua" });

    // Bukan error — hanya tidak ada perubahan.
    const hasil = await geserHalaman(COURSE_ID, modul!.id, satu!.id, "naik");
    expect(hasil!.map((h) => h.judul)).toEqual(["Satu", "Dua"]);
  });

  it("mengembalikan null untuk halaman yang tidak ada", async () => {
    const modul = await createModul(COURSE_ID, isiModul("A"));
    expect(await geserHalaman(COURSE_ID, modul!.id, "hal-palsu", "naik")).toBeNull();
  });

  it("tetap benar untuk halaman berurutan tidak rapi", async () => {
    // Berkas dari disk bisa tidak rapi; sumber urutan harus posisi array
    // setelah sort, bukan field `urutan` yang disimpan apa adanya.
    const modul = await createModul(COURSE_ID, isiModul("A"));
    const a = await createHalaman(COURSE_ID, modul!.id, { judul: "A" });
    await createHalaman(COURSE_ID, modul!.id, { judul: "B" });
    await createHalaman(COURSE_ID, modul!.id, { judul: "C" });

    // Pindahkan A ke bawah dua kali: A,B,C -> B,A,C -> B,C,A
    await geserHalaman(COURSE_ID, modul!.id, a!.id, "turun");
    const hasil = await geserHalaman(COURSE_ID, modul!.id, a!.id, "turun");
    expect(hasil!.map((h) => h.judul)).toEqual(["B", "C", "A"]);
    expect(hasil!.map((h) => h.urutan)).toEqual([1, 2, 3]);
  });
});

describe("getHalaman", () => {
  it("menemukan halaman berdasarkan id", async () => {
    const modul = await createModul(COURSE_ID, isiModul("A"));
    const halaman = await createHalaman(COURSE_ID, modul!.id, { judul: "Cari Aku" });
    expect((await getHalaman(COURSE_ID, modul!.id, halaman!.id))?.judul).toBe("Cari Aku");
  });

  it("mengembalikan undefined bila tidak ada", async () => {
    const modul = await createModul(COURSE_ID, isiModul("A"));
    expect(await getHalaman(COURSE_ID, modul!.id, "hal-palsu")).toBeUndefined();
  });
});
