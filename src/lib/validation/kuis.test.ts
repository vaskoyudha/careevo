import { describe, it, expect } from "vitest";
import { kuisSchema, updateKuisSchema } from "./kuis";

/**
 * Skema kuis.
 *
 * Yang penting diuji bukan bentuk bahagia, melainkan batas yang mencegah kuis
 * tak bisa dinilai: kunci jawaban di luar rentang, pilihan ganda yang isinya
 * sama, dan soal tanpa pilihan yang cukup.
 */

const soalValid = {
  id: "s1",
  pertanyaan: "Apa kegunaan useState?",
  pilihan: ["Menyimpan state lokal", "Mengambil data HTTP"],
  jawaban_benar: 0,
};

function parseKuis(over: Record<string, unknown> = {}) {
  return kuisSchema.safeParse({
    judul: "Kuis Dasar Hooks",
    deskripsi: "Uji pemahaman dasar.",
    soal: [soalValid],
    nilai_lulus: 70,
    ...over,
  });
}

describe("kuisSchema", () => {
  it("meloloskan kuis yang lengkap", () => {
    const parsed = parseKuis();

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.soal).toHaveLength(1);
      expect(parsed.data.nilai_lulus).toBe(70);
    }
  });

  it("mengubah angka dari form (string) menjadi number", () => {
    const parsed = parseKuis({
      soal: [{ ...soalValid, jawaban_benar: "1" }],
      nilai_lulus: "80",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.nilai_lulus).toBe(80);
      expect(parsed.data.soal[0].jawaban_benar).toBe(1);
    }
  });

  it("memberi nilai lulus bawaan 70 bila tidak dikirim", () => {
    const parsed = kuisSchema.safeParse({ judul: "Kuis Dasar", soal: [soalValid] });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.nilai_lulus).toBe(70);
  });

  it("membuat deskripsi kosong bila tidak dikirim", () => {
    // Deskripsi opsional, tapi hasil parse harus selalu string supaya pemanggil
    // tidak perlu menangani `undefined` di setiap tempat.
    const parsed = kuisSchema.safeParse({ judul: "Kuis Dasar", soal: [soalValid] });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.deskripsi).toBe("");
  });

  it("menolak kuis tanpa soal", () => {
    // Kuis tanpa soal tidak bisa dinilai dan hanya menampilkan halaman kosong.
    expect(parseKuis({ soal: [] }).success).toBe(false);
  });

  it("menolak soal dengan pilihan kurang dari dua", () => {
    expect(parseKuis({ soal: [{ ...soalValid, pilihan: ["Hanya satu"] }] }).success).toBe(false);
  });

  it("menolak kunci jawaban di luar rentang pilihan", () => {
    const parsed = parseKuis({ soal: [{ ...soalValid, jawaban_benar: 5 }] });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path[2] === "jawaban_benar");
      expect(issue?.message).toContain("rentang");
    }
  });

  it("menolak dua pilihan yang isinya sama", () => {
    // Dua pilihan identik membuat soal tidak punya jawaban yang jelas: peserta
    // bisa memilih yang mana pun dan salah satunya dihitung benar.
    const parsed = parseKuis({ soal: [{ ...soalValid, pilihan: ["Sama", "Sama"] }] });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.message.includes("sama"))).toBe(true);
    }
  });

  it("menolak pertanyaan yang terlalu pendek", () => {
    // Dua karakter tidak bisa jadi pertanyaan yang berarti.
    expect(parseKuis({ soal: [{ ...soalValid, pertanyaan: "Ab" }] }).success).toBe(false);
  });

  it("menolak pilihan kosong", () => {
    expect(parseKuis({ soal: [{ ...soalValid, pilihan: ["Ada", "  "] }] }).success).toBe(false);
  });

  it("menolak soal tanpa id", () => {
    expect(parseKuis({ soal: [{ ...soalValid, id: "" }] }).success).toBe(false);
  });

  it("menolak nilai lulus di luar 0-100", () => {
    for (const nilai of [-1, 101]) {
      expect(parseKuis({ nilai_lulus: nilai }).success, String(nilai)).toBe(false);
    }
  });

  it("menolak judul yang terlalu pendek", () => {
    expect(parseKuis({ judul: "Ab" }).success).toBe(false);
  });

  it("memangkas spasi pada judul dan deskripsi", () => {
    const parsed = parseKuis({ judul: "  Kuis Dasar  ", deskripsi: "  Isi  " });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.judul).toBe("Kuis Dasar");
      expect(parsed.data.deskripsi).toBe("Isi");
    }
  });

  it("membuang kunci yang tidak dikenal dari payload", () => {
    // `z.object` membuang kunci tak dikenal, jadi payload kiriman tidak bisa
    // menyelipkan field di luar kontrak ke dalam berkas yang tersimpan.
    const parsed = parseKuis({ dibuat_oleh: "penyusup" });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("dibuat_oleh");
    }
  });
});

describe("updateKuisSchema", () => {
  it("meloloskan perubahan sebagian", () => {
    // Menyunting judul saja tidak boleh menuntut seluruh daftar soal dikirim.
    const parsed = updateKuisSchema.safeParse({ judul: "Judul Baru" });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.soal).toBeUndefined();
      expect(parsed.data.nilai_lulus).toBeUndefined();
    }
  });

  it("tetap memvalidasi soal penuh bila dikirim", () => {
    // "Sebagian" berlaku antar-field, bukan di dalam sebuah soal yang setengah
    // terisi — soal setengah jadi akan tersimpan sebagai asesmen yang rusak.
    expect(updateKuisSchema.safeParse({ soal: [{ pertanyaan: "Ab" }] }).success).toBe(false);
  });

  it("meloloskan objek kosong", () => {
    expect(updateKuisSchema.safeParse({}).success).toBe(true);
  });
});
