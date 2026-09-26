import { describe, expect, it } from "vitest";
import { LABEL_JALUR, jalurDariBukti } from "./jalur-selesai";

/** Peta `run id` → apakah run itu punya `kamera_mulai`. */
const peta = (...pasangan: Array<[string, boolean]>): ReadonlyMap<string, boolean> =>
  new Map(pasangan);

describe("jalurDariBukti", () => {
  it("menandai jalur terverifikasi yang ditopang kamera", () => {
    // Inilah makna `terverifikasi` pada course `wajib_kamera` lewat jalur materi:
    // bukan sekadar "ada sesi", tapi "ada sesi DAN kamera menyala".
    expect(
      jalurDariBukti({
        completionPath: "terverifikasi",
        evidenceId: "run-1",
        kameraMulai: peta(["run-1", true]),
      }),
    ).toBe("terverifikasi_kamera");
  });

  it("menandai jalur terverifikasi tanpa kamera sebagai terverifikasi biasa", () => {
    // Course `wajib` biasa: jalur ini tidak membuktikan apa pun soal kamera.
    expect(
      jalurDariBukti({
        completionPath: "terverifikasi",
        evidenceId: "run-1",
        kameraMulai: peta(["run-1", false]),
      }),
    ).toBe("terverifikasi");
  });

  it("tidak pernah menaikkan jalur yang tidak menyatakan dirinya terverifikasi", () => {
    // Fail-closed: `informal`, `null`, dan nilai tak dikenal tidak boleh
    // menjadi `terverifikasi*` apa pun, walaupun kameranya kebetulan menyala.
    for (const completionPath of ["informal", null, "", "terverifikasi_kamera"]) {
      expect(
        jalurDariBukti({
          completionPath,
          evidenceId: "run-1",
          kameraMulai: peta(["run-1", true]),
        }),
      ).toBe("informal");
      expect(
        jalurDariBukti({
          completionPath,
          evidenceId: "run-1",
          kameraMulai: peta(["run-1", false]),
        }),
      ).toBe("informal");
    }
  });

  it("berhenti pada bukti yang bukan run yang bisa ditelusuri", () => {
    // Jalur kuis menyimpan `quiz_attempts.id` di `evidence_id`, jadi id itu tidak
    // akan pernah muncul di peta run — meski kameranya jelas menyala. Menarik
    // label `terverifikasi` di sini akan menyatakan "kamera tidak tercatat"
    // untuk tepat baris yang paling perlu jujur.
    expect(
      jalurDariBukti({
        completionPath: "terverifikasi",
        evidenceId: "att-1",
        kameraMulai: peta(["run-1", true]),
      }),
    ).toBe("terverifikasi_tanpa_bukti_kamera");
  });

  it("menganggap bukti yang tidak ada sebagai jalur tanpa bukti kamera", () => {
    // Baris lama tanpa `evidence_id` juga tidak punya run yang bisa ditelusuri.
    expect(
      jalurDariBukti({
        completionPath: "terverifikasi",
        evidenceId: null,
        kameraMulai: peta(["run-1", true]),
      }),
    ).toBe("terverifikasi_tanpa_bukti_kamera");
  });

  it("tidak pernah mengklaim kamera saat pemanggil tidak menyertakan peta", () => {
    // Tanpa peta, `terverifikasi` berarti "tidak ada bukti kamera yang tersedia"
    // — bukan "kamera pasti tidak menyala". Menurunkannya ke jalur terverifikasi
    // biasa membuat pemanggil yang lupa mengirim peta tidak diam-diam mengubah
    // arti laporan.
    const tanpaPeta = { completionPath: "terverifikasi", evidenceId: "run-1" };
    expect(jalurDariBukti(tanpaPeta)).toBe("terverifikasi");
    expect(jalurDariBukti({ ...tanpaPeta, evidenceId: "att-1" })).toBe("terverifikasi");
    // `informal` tetap gagal-tertutup walau tidak ada peta sama sekali.
    expect(jalurDariBukti({ completionPath: "informal", evidenceId: "att-1" })).toBe("informal");
  });

  it("tidak memakai kata vonis di labelnya", () => {
    for (const label of Object.values(LABEL_JALUR)) {
      for (const kata of ["curang", "menyalin", "mencontek", "penyalahgunaan", "bersalah"]) {
        expect(label.toLowerCase()).not.toContain(kata);
      }
    }
  });

  it("membedakan keempat jalurnya dengan kalimat yang berbeda", () => {
    // Empat label harus **semuanya berbeda**, dan ketiga label terverifikasi
    // harus menyebut kamera: seluruh gunanya adalah memberi tahu pembaca bahwa
    // "terverifikasi" bukan satu klaim tunggal. Label yang tumpang tindih berarti
    // salah satu perbedaan di atas hilang.
    const semua = Object.values(LABEL_JALUR);
    expect(new Set(semua).size).toBe(semua.length);
    for (const nilai of [
      "terverifikasi_kamera",
      "terverifikasi",
      "terverifikasi_tanpa_bukti_kamera",
    ] as const) {
      expect(LABEL_JALUR[nilai].toLowerCase()).toContain("kamera");
    }
  });
});
