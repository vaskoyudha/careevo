import { describe, it, expect, beforeEach } from "vitest";
import {
  createKuis,
  createModul,
  deleteKuis,
  geserKuis,
  getKuis,
  getModul,
  lepasKuis,
  listKuis,
  pasangKuis,
  resetCourses,
  updateKuis,
} from "./store";
import type { SoalKuis } from "@/types/course";

/**
 * CRUD bank soal kuis pada store.
 *
 * Yang diuji adalah invariant penyimpanan yang tidak terlihat dari UI: id
 * diberikan store, menghapus kuis membersihkan referensi yatim, memasang kuis
 * bersifat idempoten, dan pengurutan bertukar berdasarkan posisi array — bukan
 * nilai `urutan` yang mungkin basi. Bukan duplikat test action: action menguji
 * gerbang staf dan bentuk hasil.
 *
 * `resetCourses()` mematikan penulisan disk, jadi test tidak menyentuh
 * `data/kuis.json` maupun `data/courses.json` milik mesin pengembang.
 */

const COURSE_ID = "crs-1";

const SOAL: SoalKuis = {
  id: "s1",
  pertanyaan: "Apa kegunaan useState?",
  pilihan: ["Menyimpan state lokal", "Mengambil data HTTP"],
  jawaban_benar: 0,
};

function isiModul(judul: string) {
  return { judul, ringkasan: `Ringkasan untuk ${judul} yang cukup panjang.`, durasi_min: 30 };
}

function isiKuis(judul: string) {
  return { judul, deskripsi: `Deskripsi ${judul}.`, soal: [SOAL], nilai_lulus: 70 };
}

beforeEach(() => {
  resetCourses();
});

describe("createKuis", () => {
  it("memberi id dan timestamp sendiri, bukan dari pemanggil", async () => {
    const kuis = await createKuis(isiKuis("Kuis Dasar"));

    expect(kuis.id).toMatch(/^kuis-/);
    expect(kuis.created_at).toBeTruthy();
    expect(kuis.updated_at).toBe(kuis.created_at);
    expect(kuis.judul).toBe("Kuis Dasar");
  });

  it("memakai nilai lulus bawaan 70 bila tidak diberikan", async () => {
    const kuis = await createKuis({ judul: "Kuis", soal: [SOAL] });

    expect(kuis.nilai_lulus).toBe(70);
  });

  it("memangkas spasi di judul dan deskripsi", async () => {
    const kuis = await createKuis({ judul: "  Kuis  ", deskripsi: "  Isi  ", soal: [SOAL] });

    expect(kuis.judul).toBe("Kuis");
    expect(kuis.deskripsi).toBe("Isi");
  });
});

describe("listKuis", () => {
  it("mengurutkan berdasarkan judul, bukan urutan pembuatan", async () => {
    await createKuis(isiKuis("Zeta"));
    await createKuis(isiKuis("Alfa"));

    // Bank soal dibaca sebagai katalog, jadi urutannya harus stabil dan bisa
    // diprediksi admin — bukan menurut kapan entri dibuat.
    expect((await listKuis()).map((k) => k.judul)).toEqual(["Alfa", "Zeta"]);
  });

  it("kosong sebelum ada kuis", async () => {
    expect(await listKuis()).toEqual([]);
  });
});

describe("updateKuis", () => {
  it("mempertahankan field yang tidak dikirim", async () => {
    const kuis = await createKuis(isiKuis("Kuis Dasar"));
    const hasil = await updateKuis(kuis.id, { judul: "Judul Baru" });

    expect(hasil?.judul).toBe("Judul Baru");
    // `undefined` berarti "jangan sentuh" — bukan "kosongkan".
    expect(hasil?.soal).toHaveLength(1);
    expect(hasil?.nilai_lulus).toBe(70);
    expect(hasil?.id).toBe(kuis.id);
    expect(hasil?.created_at).toBe(kuis.created_at);
  });

  it("mengganti seluruh daftar soal bila `soal` dikirim", async () => {
    const kuis = await createKuis(isiKuis("Kuis Dasar"));
    const baru = [{ ...SOAL, id: "s9", pertanyaan: "Pertanyaan baru?" }];

    const hasil = await updateKuis(kuis.id, { soal: baru });

    expect(hasil?.soal).toEqual(baru);
  });

  it("memperbarui timestamp `updated_at`", async () => {
    const kuis = await createKuis(isiKuis("Kuis Dasar"));
    const hasil = await updateKuis(kuis.id, { judul: "Judul Baru" });

    expect(hasil?.updated_at).not.toBe("");
    expect(hasil?.created_at).toBe(kuis.created_at);
  });

  it("mengembalikan null untuk id yang tidak ada", async () => {
    expect(await updateKuis("kuis-tidak-ada", { judul: "X" })).toBeNull();
  });
});

describe("deleteKuis", () => {
  it("menghapus entri dari bank", async () => {
    const kuis = await createKuis(isiKuis("Kuis Dasar"));

    expect(await deleteKuis(kuis.id)).toBe(0);
    expect(await getKuis(kuis.id)).toBeUndefined();
    expect(await listKuis()).toEqual([]);
  });

  it("membersihkan referensi di setiap modul yang memakainya", async () => {
    // Ini alasan pembersihan dilakukan di store, bukan diserahkan pemanggil:
    // store satu-satunya tempat yang tahu semua modul mana saja yang memakainya.
    const kuis = await createKuis(isiKuis("Kuis Dasar"));
    const modulA = await createModul(COURSE_ID, isiModul("A"));
    const modulB = await createModul(COURSE_ID, isiModul("B"));

    await pasangKuis(COURSE_ID, modulA!.id, kuis.id);
    await pasangKuis(COURSE_ID, modulB!.id, kuis.id);

    expect(await deleteKuis(kuis.id)).toBe(2);
    expect((await getModul(COURSE_ID, modulA!.id))?.kuis).toEqual([]);
    expect((await getModul(COURSE_ID, modulB!.id))?.kuis).toEqual([]);
  });

  it("tidak menyentuh modul yang tidak memakai kuis itu", async () => {
    const kuis = await createKuis(isiKuis("Kuis Dasar"));
    const lain = await createKuis(isiKuis("Kuis Lain"));
    const modul = await createModul(COURSE_ID, isiModul("A"));

    await pasangKuis(COURSE_ID, modul!.id, lain.id);
    await deleteKuis(kuis.id);

    expect((await getModul(COURSE_ID, modul!.id))?.kuis).toEqual([lain.id]);
    expect(await getKuis(lain.id)).toBeDefined();
  });

  it("mengembalikan null untuk id yang tidak ada", async () => {
    expect(await deleteKuis("kuis-tidak-ada")).toBeNull();
  });
});

describe("pasangKuis / lepasKuis", () => {
  it("menaruh kuis baru di urutan terakhir", async () => {
    const a = await createKuis(isiKuis("A"));
    const b = await createKuis(isiKuis("B"));
    const modul = await createModul(COURSE_ID, isiModul("Modul"));

    await pasangKuis(COURSE_ID, modul!.id, a.id);
    await pasangKuis(COURSE_ID, modul!.id, b.id);

    expect((await getModul(COURSE_ID, modul!.id))?.kuis).toEqual([a.id, b.id]);
  });

  it("idempoten: memasang kuis yang sama dua kali tidak menggandakan", async () => {
    // Tombol yang terklik dua kali karena koneksi lambat tidak boleh
    // menghasilkan dua referensi ke kuis yang sama.
    const kuis = await createKuis(isiKuis("Kuis Dasar"));
    const modul = await createModul(COURSE_ID, isiModul("Modul"));

    await pasangKuis(COURSE_ID, modul!.id, kuis.id);
    await pasangKuis(COURSE_ID, modul!.id, kuis.id);

    expect((await getModul(COURSE_ID, modul!.id))?.kuis).toEqual([kuis.id]);
  });

  it("menolak memasang id yang tidak ada di bank", async () => {
    const modul = await createModul(COURSE_ID, isiModul("Modul"));

    expect(await pasangKuis(COURSE_ID, modul!.id, "kuis-hantu")).toBeNull();
    expect((await getModul(COURSE_ID, modul!.id))?.kuis).toEqual([]);
  });

  it("melepas hanya referensinya, entri bank tetap ada", async () => {
    const kuis = await createKuis(isiKuis("Kuis Dasar"));
    const modul = await createModul(COURSE_ID, isiModul("Modul"));
    await pasangKuis(COURSE_ID, modul!.id, kuis.id);

    await lepasKuis(COURSE_ID, modul!.id, kuis.id);

    expect((await getModul(COURSE_ID, modul!.id))?.kuis).toEqual([]);
    // Kuis yang sama mungkin masih dipakai modul lain; melepas bukan menghapus.
    expect(await getKuis(kuis.id)).toBeDefined();
  });

  it("satu kuis bisa dipakai beberapa modul sekaligus", async () => {
    const kuis = await createKuis(isiKuis("Kuis Dasar"));
    const a = await createModul(COURSE_ID, isiModul("A"));
    const b = await createModul(COURSE_ID, isiModul("B"));

    await pasangKuis(COURSE_ID, a!.id, kuis.id);
    await pasangKuis(COURSE_ID, b!.id, kuis.id);

    expect((await getModul(COURSE_ID, a!.id))?.kuis).toEqual([kuis.id]);
    expect((await getModul(COURSE_ID, b!.id))?.kuis).toEqual([kuis.id]);
  });

  it("mengembalikan null bila modulnya tidak ada", async () => {
    const kuis = await createKuis(isiKuis("Kuis Dasar"));

    expect(await pasangKuis(COURSE_ID, "mod-hantu", kuis.id)).toBeNull();
    expect(await lepasKuis(COURSE_ID, "mod-hantu", kuis.id)).toBeNull();
  });
});

describe("geserKuis", () => {
  it("menukar posisi dengan tetangganya", async () => {
    const a = await createKuis(isiKuis("A"));
    const b = await createKuis(isiKuis("B"));
    const modul = await createModul(COURSE_ID, isiModul("Modul"));
    await pasangKuis(COURSE_ID, modul!.id, a.id);
    await pasangKuis(COURSE_ID, modul!.id, b.id);

    await geserKuis(COURSE_ID, modul!.id, b.id, "naik");

    expect((await getModul(COURSE_ID, modul!.id))?.kuis).toEqual([b.id, a.id]);
  });

  it("tidak berubah bila sudah di ujung", async () => {
    const a = await createKuis(isiKuis("A"));
    const modul = await createModul(COURSE_ID, isiModul("Modul"));
    await pasangKuis(COURSE_ID, modul!.id, a.id);

    // Bukan error: cukup tidak ada perubahan.
    expect(await geserKuis(COURSE_ID, modul!.id, a.id, "naik")).toEqual([a.id]);
    expect(await geserKuis(COURSE_ID, modul!.id, a.id, "turun")).toEqual([a.id]);
  });

  it("mengembalikan null bila kuisnya tidak terpasang di modul itu", async () => {
    const a = await createKuis(isiKuis("A"));
    const modul = await createModul(COURSE_ID, isiModul("Modul"));

    expect(await geserKuis(COURSE_ID, modul!.id, a.id, "naik")).toBeNull();
  });
});

describe("memisahkan kuis dari materi", () => {
  it("modul baru tidak punya kuis sampai dipasang", async () => {
    const modul = await createModul(COURSE_ID, isiModul("Modul"));

    expect(modul?.kuis).toEqual([]);
  });

  it("menghapus modul tidak menghapus kuisnya dari bank", async () => {
    // Modul hanya memegang referensi. Menghapus modul tidak boleh ikut
    // menghapus asesmen yang mungkin dipakai modul lain.
    const kuis = await createKuis(isiKuis("Kuis Dasar"));
    const modul = await createModul(COURSE_ID, isiModul("Modul"));
    await pasangKuis(COURSE_ID, modul!.id, kuis.id);

    const { deleteModul } = await import("./store");
    await deleteModul(COURSE_ID, modul!.id);

    expect(await getKuis(kuis.id)).toBeDefined();
  });
});
