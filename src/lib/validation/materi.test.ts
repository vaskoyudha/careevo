import { describe, it, expect } from "vitest";
import { materiSchema, updateMateriSchema, TIPE_MATERI } from "./materi";

const soalValid = {
  id: "soal-1",
  pertanyaan: "Apa kegunaan useState?",
  pilihan: ["Menyimpan state lokal", "Mengambil data HTTP"],
  jawaban_benar: 0,
};

describe("materiSchema", () => {
  it("hanya mengekspor tipe lampiran — prosa pindah ke halaman", () => {
    // `teks` sengaja tidak ada: prosa kini ditulis sebagai halaman berformat.
    // Materi `teks` lama dimigrasikan di `normalisasiHalamanLama()`.
    expect(TIPE_MATERI).toEqual(["video", "pdf", "kuis"]);
  });

  it("meloloskan varian video", () => {
    const parsed = materiSchema.safeParse({
      tipe: "video",
      judul: "Pengantar React Hooks",
      url: "https://www.youtube.com/watch?v=abc",
      durasi_min: "12",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.tipe === "video") {
      expect(parsed.data.durasi_min).toBe(12);
    }
  });

  it("menolak video dengan URL javascript:", () => {
    const parsed = materiSchema.safeParse({
      tipe: "video",
      judul: "Pengantar React Hooks",
      url: "javascript:alert(1)",
      durasi_min: 12,
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === "url")).toBe(true);
    }
  });

  it("menolak varian teks yang sudah tidak ada", () => {
    // Gerbang inilah yang mencegah admin membuat prosa lewat jalur materi.
    const parsed = materiSchema.safeParse({
      tipe: "teks",
      judul: "Catatan Hooks",
      konten: "useEffect berjalan setelah render selesai.",
    });

    expect(parsed.success).toBe(false);
  });

  it("meloloskan varian pdf", () => {
    const parsed = materiSchema.safeParse({
      tipe: "pdf",
      judul: "Materi Latihan",
      path: "/uploads/courses/crs-1/materi.pdf",
      ukuran_bytes: "204800",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.tipe === "pdf") {
      expect(parsed.data.ukuran_bytes).toBe(204800);
    }
  });

  it("menolak path pdf di luar /uploads/", () => {
    // `path` dirender ke `<a href>`/`<object data>`. Tanpa batasan folder,
    // form bisa mengirim apa pun — termasuk skema yang bisa dieksekusi.
    for (const path of [
      "javascript:alert(1)",
      "https://situs-lain.example/materi.pdf",
      "/etc/passwd",
      "/uploads/../rahasia.pdf",
    ]) {
      const parsed = materiSchema.safeParse({
        tipe: "pdf",
        judul: "Materi Latihan",
        path,
        ukuran_bytes: 100,
      });
      expect(parsed.success, `seharusnya ditolak: ${path}`).toBe(false);
    }
  });

  it("meloloskan varian kuis", () => {
    const parsed = materiSchema.safeParse({
      tipe: "kuis",
      judul: "Kuis Dasar Hooks",
      soal: [soalValid],
      nilai_lulus: "70",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.tipe === "kuis") {
      expect(parsed.data.nilai_lulus).toBe(70);
    }
  });

  it("menolak jawaban_benar di luar rentang pilihan", () => {
    const parsed = materiSchema.safeParse({
      tipe: "kuis",
      judul: "Kuis Dasar Hooks",
      soal: [{ ...soalValid, jawaban_benar: 5 }],
      nilai_lulus: 70,
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path[2] === "jawaban_benar");
      expect(issue?.message).toContain("rentang");
    }
  });

  it("menolak kuis dengan pilihan kurang dari 2", () => {
    const parsed = materiSchema.safeParse({
      tipe: "kuis",
      judul: "Kuis Dasar Hooks",
      soal: [{ ...soalValid, pilihan: ["Hanya satu"] }],
      nilai_lulus: 70,
    });

    expect(parsed.success).toBe(false);
  });

  it("menolak kuis tanpa soal", () => {
    const parsed = materiSchema.safeParse({
      tipe: "kuis",
      judul: "Kuis Dasar Hooks",
      soal: [],
      nilai_lulus: 70,
    });

    expect(parsed.success).toBe(false);
  });

  it("menolak nilai_lulus di luar 0-100", () => {
    for (const nilai of [-1, 101]) {
      const parsed = materiSchema.safeParse({
        tipe: "kuis",
        judul: "Kuis Dasar Hooks",
        soal: [soalValid],
        nilai_lulus: nilai,
      });
      expect(parsed.success, String(nilai)).toBe(false);
    }
  });

  it("menolak tipe materi yang tidak dikenal", () => {
    const parsed = materiSchema.safeParse({
      tipe: "audio",
      judul: "Podcast Belajar",
    });

    expect(parsed.success).toBe(false);
  });

  it("updateMateriSchema identik dengan materiSchema (ganti tipe = ganti payload utuh)", () => {
    expect(updateMateriSchema).toBe(materiSchema);
    expect(
      updateMateriSchema.safeParse({
        tipe: "pdf",
        judul: "Materi Latihan",
        path: "/uploads/courses/crs-1/materi.pdf",
        ukuran_bytes: "2048",
      }).success,
    ).toBe(true);
  });
});
