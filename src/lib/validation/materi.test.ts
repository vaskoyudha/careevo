import { describe, it, expect } from "vitest";
import { materiSchema, updateMateriSchema, TIPE_MATERI } from "./materi";

describe("materiSchema", () => {
  it("hanya mengekspor tipe lampiran — prosa dan kuis pindah ke rumahnya sendiri", () => {
    // `teks` sengaja tidak ada: prosa kini ditulis sebagai halaman berformat.
    // `kuis` juga tidak ada: asesmen berdiri sendiri di bank soal. Masing-masing
    // data lamanya dimigrasikan di `normalisasiHalamanLama()` dan
    // `promosiKuisLama()`.
    expect(TIPE_MATERI).toEqual(["video", "pdf"]);
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

  it("menolak varian kuis — asesmen tidak boleh dibuat lewat jalur materi", () => {
    // Gerbang inilah yang mencegah admin membuat asesmen lewat jalur lampiran.
    // Aturan isi soal kuis (rentang kunci, jumlah pilihan, ambang lulus) kini
    // diuji di `validation/kuis.test.ts`; di sini yang dipastikan hanyalah
    // bahwa bentuk materi kuis versi lama tidak lagi diterima sama sekali.
    const parsed = materiSchema.safeParse({
      tipe: "kuis",
      judul: "Kuis Dasar Hooks",
      soal: [
        {
          id: "soal-1",
          pertanyaan: "Apa kegunaan useState?",
          pilihan: ["Menyimpan state lokal", "Mengambil data HTTP"],
          jawaban_benar: 0,
        },
      ],
      nilai_lulus: 70,
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      // Yang menolak adalah discriminator-nya, bukan field yang kebetulan salah.
      expect(parsed.error.issues.some((i) => i.path[0] === "tipe")).toBe(true);
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
