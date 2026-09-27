import { describe, expect, it } from "vitest";
import { SEMUA_KURSUS_SEED } from "../../../scripts/seed/konten/daftar";

/**
 * Kontrak isi seed konten kursus.
 *
 * Test ini menjaga properti yang, kalau rusak, membuat seed **tampak berhasil
 * tetapi menghasilkan kursus yang tidak bisa dikerjakan** — kelas kesalahan yang
 * tidak tertangkap `tsc` maupun test store:
 *
 * - Kuis tanpa soal, atau soal dengan kunci jawaban di luar rentang, membuat
 *   modul mustahil diselesaikan (`selesaikanModulKuisVerified` menolak).
 * - Dua pilihan dengan teks sama membuat soal tidak punya jawaban yang jelas.
 * - Slug ganda membuat kursus kedua menimpa yang pertama secara diam-diam.
 * - Modul tanpa kuis membuat modul itu tidak punya jalur penyelesaian sama
 *   sekali di kursus yang kebijakannya `wajib`.
 */
describe("seed konten kursus", () => {
  it("tidak ada slug kursus yang ganda", () => {
    const slug = SEMUA_KURSUS_SEED.map((k) => k.slug);
    const ganda = slug.filter((s, i) => slug.indexOf(s) !== i);
    expect(ganda).toEqual([]);
  });

  it("tidak ada id kursus yang ganda, dan id fixture r1–r12 ada", () => {
    const id = SEMUA_KURSUS_SEED.flatMap((k) => (k.id ? [k.id] : []));
    expect(new Set(id).size).toBe(id.length);
    // Entri fixture r1–r12 harus punya kursus store ber-id sama supaya menutup
    // fixture di `katalogBelajar` (dedup by id) dan tidak menyisakan entri kosong.
    for (let i = 1; i <= 12; i += 1) {
      expect(id, `r${i}`).toContain(`r${i}`);
    }
  });

  it("setiap kursus punya minimal satu modul, dan judul modulnya unik", () => {
    for (const kursus of SEMUA_KURSUS_SEED) {
      expect(kursus.modul.length, kursus.slug).toBeGreaterThan(0);
      const judul = kursus.modul.map((m) => m.judul);
      expect(new Set(judul).size, `${kursus.slug} punya judul modul ganda`).toBe(judul.length);
    }
  });

  it("setiap modul punya kuis dengan 3–5 soal", () => {
    for (const kursus of SEMUA_KURSUS_SEED) {
      for (const modul of kursus.modul) {
        const kuis = modul.kuis;
        expect(kuis, `${kursus.slug} / ${modul.judul} tanpa kuis`).toBeDefined();
        expect(
          kuis!.soal.length,
          `${kursus.slug} / ${modul.judul} jumlah soal`,
        ).toBeGreaterThanOrEqual(3);
        expect(
          kuis!.soal.length,
          `${kursus.slug} / ${modul.judul} jumlah soal`,
        ).toBeLessThanOrEqual(5);
      }
    }
  });

  it("setiap soal punya >=2 pilihan, tanpa duplikat, dan kunci di dalam rentang", () => {
    for (const kursus of SEMUA_KURSUS_SEED) {
      for (const modul of kursus.modul) {
        for (const soal of modul.kuis!.soal) {
          const di = `${kursus.slug} / ${modul.judul} / "${soal.pertanyaan.slice(0, 40)}…"`;
          expect(soal.pilihan.length, di).toBeGreaterThanOrEqual(2);
          expect(new Set(soal.pilihan).size, `${di} pilihan duplikat`).toBe(soal.pilihan.length);
          expect(Number.isInteger(soal.jawaban_benar), di).toBe(true);
          expect(soal.jawaban_benar, di).toBeGreaterThanOrEqual(0);
          expect(soal.jawaban_benar, di).toBeLessThan(soal.pilihan.length);
        }
      }
    }
  });

  it("setiap soal dan pilihan tidak kosong", () => {
    for (const kursus of SEMUA_KURSUS_SEED) {
      for (const modul of kursus.modul) {
        for (const soal of modul.kuis!.soal) {
          expect(soal.pertanyaan.trim().length).toBeGreaterThan(2);
          for (const pilihan of soal.pilihan) {
            expect(pilihan.trim().length).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("kursus yang membawa halaman punya blok di setiap halamannya", () => {
    for (const kursus of SEMUA_KURSUS_SEED) {
      for (const modul of kursus.modul) {
        if (!modul.halaman) continue;
        for (const halaman of modul.halaman) {
          expect(
            halaman.blok.length,
            `${kursus.slug} / ${modul.judul} / ${halaman.judul}`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it("kursus verifikasi tetap di luar katalog peserta", () => {
    // Ini kursus perkakas: ia ada untuk membuktikan blok kode C++ bisa
    // dikompilasi runner, dan tidak pernah ditawarkan. `katalogBelajar()` hanya
    // membaca kursus `published`, jadi `draft` di sini adalah yang menariknya
    // dari `/belajar` sekaligus dari rute reader. Kalau seseorang menghapus
    // `status` ini, kursus verifikasi muncul lagi di daftar kursus peserta tanpa
    // satu pun error — hanya satu kartu yang tidak seharusnya ada.
    const verifikasi = SEMUA_KURSUS_SEED.find((k) => k.slug === "verifikasi-blok-kode-cpp");
    expect(verifikasi, "seed verifikasi-blok-kode-cpp").toBeDefined();
    expect(verifikasi!.status).toBe("draft");
  });

  it("blok kode yang bisa dijalankan selalu punya outputHarapan", () => {
    // `dapatDijalankan: true` tanpa `outputHarapan` berarti peserta melihat
    // tombol Jalankan yang tidak bisa dibandingkan dengan apa pun.
    for (const kursus of SEMUA_KURSUS_SEED) {
      for (const modul of kursus.modul) {
        for (const halaman of modul.halaman ?? []) {
          for (const blok of halaman.blok) {
            if (blok.tipe !== "kode" || blok.dapatDijalankan !== true) continue;
            expect(
              blok.outputHarapan,
              `${kursus.slug} / ${halaman.judul} kode tanpa outputHarapan`,
            ).toBeTypeOf("string");
            expect(blok.bahasa).toBe("cpp");
          }
        }
      }
    }
  });
});
