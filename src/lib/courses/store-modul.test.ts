import { describe, it, expect, beforeEach } from "vitest";
import {
  createModul,
  updateModul,
  deleteModul,
  geserModul,
  listModul,
  getModul,
  createMateri,
  updateMateri,
  deleteMateri,
  listMateri,
  getCourseById,
  resetCourses,
} from "./store";

/**
 * CRUD modul & materi pada store.
 *
 * Fokus pada invariant yang mudah rusak tanpa terlihat: penomoran `urutan`
 * yang harus selalu rapat 1..n, dan penghapusan modul yang harus ikut
 * menghapus materinya. Ini bukan duplikat test action — action menguji gate
 * dan bentuk hasil, sedangkan di sini yang diuji perilaku penyimpanannya.
 *
 * `resetCourses()` mematikan penulisan disk, jadi test tidak menyentuh
 * `data/courses.json`.
 */

const COURSE_ID = "crs-1";

function isiModul(judul: string) {
  return { judul, ringkasan: `Ringkasan untuk ${judul} yang cukup panjang.`, durasi_min: 30 };
}

function soalContoh() {
  return [
    {
      id: "s1",
      pertanyaan: "Apa itu closure?",
      pilihan: ["Fungsi", "Variabel", "Kelas"],
      jawaban_benar: 0,
    },
  ];
}

/**
 * Materi video ringkas untuk mengisi sebuah modul.
 *
 * Prosa tidak lagi menjadi materi (tipe `teks` dihapus — prosa kini ditulis
 * sebagai halaman berformat), jadi test di sini memakai lampiran.
 */
function materiContoh(judul: string) {
  return {
    tipe: "video" as const,
    judul,
    url: "https://www.youtube.com/watch?v=abc",
    durasi_min: 5,
  };
}

beforeEach(() => {
  resetCourses();
});

describe("listModul", () => {
  it("mengembalikan kosong untuk kursus tanpa modul tersimpan", async () => {
    expect(await listModul(COURSE_ID)).toEqual([]);
  });

  it("mengembalikan kosong untuk kursus yang tidak ada", async () => {
    expect(await listModul("tidak-ada")).toEqual([]);
  });
});

describe("createModul", () => {
  it("memberi urutan berurutan mulai dari 1", async () => {
    await createModul(COURSE_ID, isiModul("Pertama"));
    await createModul(COURSE_ID, isiModul("Kedua"));
    const ketiga = await createModul(COURSE_ID, isiModul("Ketiga"));

    expect(ketiga?.urutan).toBe(3);
    const daftar = await listModul(COURSE_ID);
    expect(daftar.map((m) => m.urutan)).toEqual([1, 2, 3]);
    expect(daftar.map((m) => m.judul)).toEqual(["Pertama", "Kedua", "Ketiga"]);
  });

  it("mengembalikan null untuk kursus yang tidak ada", async () => {
    expect(await createModul("tidak-ada", isiModul("X"))).toBeNull();
  });

  it("memberi id unik pada setiap modul", async () => {
    const a = await createModul(COURSE_ID, isiModul("A"));
    const b = await createModul(COURSE_ID, isiModul("B"));
    expect(a?.id).not.toBe(b?.id);
  });
});

describe("updateModul", () => {
  it("mengubah hanya field yang diberikan", async () => {
    const dibuat = await createModul(COURSE_ID, isiModul("Awal"));
    const hasil = await updateModul(COURSE_ID, dibuat!.id, { judul: "Diubah" });

    expect(hasil?.judul).toBe("Diubah");
    expect(hasil?.ringkasan).toBe(dibuat?.ringkasan);
    expect(hasil?.durasi_min).toBe(dibuat?.durasi_min);
  });

  it("mengembalikan null untuk modul yang tidak ada", async () => {
    expect(await updateModul(COURSE_ID, "mod-palsu", { judul: "X" })).toBeNull();
  });
});

describe("geserModul", () => {
  it("menukar posisi dengan tetangganya dan merapikan nomor", async () => {
    await createModul(COURSE_ID, isiModul("A"));
    const b = await createModul(COURSE_ID, isiModul("B"));
    await createModul(COURSE_ID, isiModul("C"));

    const hasil = await geserModul(COURSE_ID, b!.id, "naik");

    expect(hasil?.map((m) => m.judul)).toEqual(["B", "A", "C"]);
    expect(hasil?.map((m) => m.urutan)).toEqual([1, 2, 3]);
  });

  it("tidak berubah saat digeser melewati ujung", async () => {
    const a = await createModul(COURSE_ID, isiModul("A"));
    await createModul(COURSE_ID, isiModul("B"));

    const naikDariAtas = await geserModul(COURSE_ID, a!.id, "naik");
    expect(naikDariAtas?.map((m) => m.judul)).toEqual(["A", "B"]);
  });

  it("menggeser turun juga bekerja", async () => {
    const a = await createModul(COURSE_ID, isiModul("A"));
    await createModul(COURSE_ID, isiModul("B"));

    const hasil = await geserModul(COURSE_ID, a!.id, "turun");
    expect(hasil?.map((m) => m.judul)).toEqual(["B", "A"]);
  });
});

describe("deleteModul", () => {
  it("menghapus modul dan merapikan nomor sisanya", async () => {
    const a = await createModul(COURSE_ID, isiModul("A"));
    await createModul(COURSE_ID, isiModul("B"));
    await createModul(COURSE_ID, isiModul("C"));

    expect(await deleteModul(COURSE_ID, a!.id)).toBe(true);
    const daftar = await listModul(COURSE_ID);
    expect(daftar.map((m) => m.judul)).toEqual(["B", "C"]);
    expect(daftar.map((m) => m.urutan)).toEqual([1, 2]);
  });

  it("ikut menghapus materi milik modul", async () => {
    const modul = await createModul(COURSE_ID, isiModul("A"));
    await createMateri(COURSE_ID, modul!.id, materiContoh("Lampiran"));
    expect(await listMateri(COURSE_ID, modul!.id)).toHaveLength(1);

    await deleteModul(COURSE_ID, modul!.id);

    // Materi hidup di dalam modul, jadi tidak boleh ada sisa yang menggantung.
    const kursus = await getCourseById(COURSE_ID);
    expect(kursus?.modul).toEqual([]);
  });

  it("mengembalikan false untuk modul yang sudah tidak ada", async () => {
    expect(await deleteModul(COURSE_ID, "mod-palsu")).toBe(false);
  });
});

describe("materi", () => {
  it("memberi urutan berurutan di dalam modul", async () => {
    const modul = await createModul(COURSE_ID, isiModul("A"));
    await createMateri(COURSE_ID, modul!.id, materiContoh("Satu"));
    await createMateri(COURSE_ID, modul!.id, materiContoh("Dua"));

    const daftar = await listMateri(COURSE_ID, modul!.id);
    expect(daftar.map((m) => m.urutan)).toEqual([1, 2]);
  });

  it("menyimpan payload sesuai tipe", async () => {
    const modul = await createModul(COURSE_ID, isiModul("A"));
    const materi = await createMateri(COURSE_ID, modul!.id, {
      tipe: "kuis",
      judul: "Kuis akhir",
      soal: soalContoh(),
      nilai_lulus: 70,
    });

    expect(materi?.tipe).toBe("kuis");
    if (materi?.tipe === "kuis") {
      expect(materi.soal).toHaveLength(1);
      expect(materi.nilai_lulus).toBe(70);
    }
  });

  it("mengganti tipe sekaligus payload saat diubah", async () => {
    const modul = await createModul(COURSE_ID, isiModul("A"));
    const awal = await createMateri(COURSE_ID, modul!.id, {
      tipe: "pdf",
      judul: "Awal",
      path: "/uploads/courses/crs-1/mod-1/dokumen.pdf",
      ukuran_bytes: 2048,
    });

    const hasil = await updateMateri(COURSE_ID, modul!.id, awal!.id, {
      tipe: "video",
      judul: "Awal",
      url: "https://www.youtube.com/watch?v=abc",
      durasi_min: 10,
    });

    expect(hasil?.tipe).toBe("video");
    // Id dan waktu pembuatan harus bertahan: ini entitas yang sama, bukan baru.
    expect(hasil?.id).toBe(awal?.id);
    expect(hasil?.created_at).toBe(awal?.created_at);
  });

  it("merapikan urutan setelah satu materi dihapus", async () => {
    const modul = await createModul(COURSE_ID, isiModul("A"));
    const satu = await createMateri(COURSE_ID, modul!.id, materiContoh("Satu"));
    await createMateri(COURSE_ID, modul!.id, materiContoh("Dua"));
    await createMateri(COURSE_ID, modul!.id, materiContoh("Tiga"));

    expect(await deleteMateri(COURSE_ID, modul!.id, satu!.id)).toBe(true);
    const daftar = await listMateri(COURSE_ID, modul!.id);
    expect(daftar.map((m) => m.judul)).toEqual(["Dua", "Tiga"]);
    expect(daftar.map((m) => m.urutan)).toEqual([1, 2]);
  });

  it("mengembalikan null saat modul tidak ditemukan", async () => {
    expect(await createMateri(COURSE_ID, "mod-palsu", materiContoh("X"))).toBeNull();
  });

  it("modul yang tersimpan membuat getModul menemukannya", async () => {
    const modul = await createModul(COURSE_ID, isiModul("Dicetak"));
    const ditemukan = await getModul(COURSE_ID, modul!.id);
    expect(ditemukan?.judul).toBe("Dicetak");
  });
});
