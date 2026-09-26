import { describe, expect, it } from "vitest";
import { kebijakanDefault } from "@/lib/courses/kebijakan";
import type { CheckpointMateri, KebijakanCourse } from "@/types/course";
import {
  checkpointEfektif,
  checkpointTerverifikasi,
  kategoriDiblokir,
  klasifikasiKejadian,
  lewatBatas,
  putuskanAkses,
  wajibSesiTerverifikasi,
} from "./akses";

const MODUL = { id: "m1", checkpoint: { batas_waktu_menit: 20, mode: "kuis", ref: "mat-1" } as CheckpointMateri };
const kebijakan = (p: Partial<KebijakanCourse> = {}): KebijakanCourse => ({ ...kebijakanDefault(), ...p });

describe("checkpointEfektif", () => {
  it("returns the default checkpoint when the module has none", () => {
    const hasil = checkpointEfektif({ id: "m2" });
    expect(hasil.mode).toBe("materi");
    expect(hasil.batas_waktu_menit).toBe(30);
  });

  it("prefers the module checkpoint and falls back if it is malformed", () => {
    expect(checkpointEfektif(MODUL).mode).toBe("kuis");
    const rusak = checkpointEfektif({ id: "m3", checkpoint: { mode: "kuis" } as CheckpointMateri });
    expect(rusak.mode).toBe("materi");
  });
});

describe("putuskanAkses", () => {
  it("allows free exploration when proctoring is optional", () => {
    const hasil = putuskanAkses({ jenisKegiatan: "materi", kebijakan: kebijakan({ aturan_pengawasan: "opsional" }), adaBuktiSesi: false });
    expect(hasil.tipe).toBe("bebas");
  });

  it("requires a session for required proctoring", () => {
    const hasil = putuskanAkses({ jenisKegiatan: "materi", kebijakan: kebijakan(), adaBuktiSesi: false });
    expect(hasil.tipe).toBe("perlu_sesi");
    if (hasil.tipe === "perlu_sesi") expect(hasil.pesan).toContain("sesi terverifikasi");
  });

  it("allows required activity once a session proof exists", () => {
    expect(putuskanAkses({ jenisKegiatan: "kuis", kebijakan: kebijakan(), adaBuktiSesi: true }).tipe).toBe("bebas");
  });

  // Sisi lain dari kasus di atas, dan yang diandalkan gerbang kuis di
  // `detail-kursus.tsx`: asesmen belum boleh dirender sebelum sesi berjalan.
  // Tanpa ini, menampilkan kuis selalu `bebas` hanyalah pilihan tampilan yang
  // tidak terikat mesin keputusan.
  it("requires a session for a quiz when no proof exists yet", () => {
    const hasil = putuskanAkses({ jenisKegiatan: "kuis", kebijakan: kebijakan(), adaBuktiSesi: false });
    expect(hasil.tipe).toBe("perlu_sesi");
    if (hasil.tipe === "perlu_sesi") expect(hasil.pesan).toContain("sesi terverifikasi");
  });

  it("rejects academic chatbot help under the no-AI rule", () => {
    const hasil = putuskanAkses({ jenisKegiatan: "bantuan_akademik", kebijakan: kebijakan({ aturan_bantuan: "tanpa_ai" }), adaBuktiSesi: true });
    expect(hasil.tipe).toBe("ditolak");
  });

  it("allows tutor help under the tutor rule", () => {
    expect(putuskanAkses({ jenisKegiatan: "bantuan_akademik", kebijakan: kebijakan({ aturan_bantuan: "bertutor" }), adaBuktiSesi: false }).tipe).toBe("bebas");
  });
});

describe("rute penyelesaian terverifikasi", () => {
  it("menandai course wajib sesi sebagai butuh verifikasi", () => {
    expect(wajibSesiTerverifikasi(kebijakan({ aturan_pengawasan: "wajib" }))).toBe(true);
    expect(wajibSesiTerverifikasi(kebijakan({ aturan_pengawasan: "opsional" }))).toBe(false);
  });

  it("hanya checkpoint materi yang diverifikasi server", () => {
    expect(checkpointTerverifikasi(checkpointEfektif({ id: "m1" }))).toBe(true);
    expect(checkpointTerverifikasi(MODUL.checkpoint as CheckpointMateri)).toBe(false);
  });

  /**
   * Inilah regresi yang diperbaiki: jalur terverifikasi dipilih murni dari
   * kebijakan + checkpoint, jadi peserta **tanpa** bukti pun dikirim ke server
   * (yang menolak dengan pesan gerbangnya) alih-alih dibelokkan ke penandaan
   * informal, dan peserta **dengan** bukti tidak pernah dilewatkan verifikasi.
   */
  it("memilih jalur terverifikasi terlepas dari ada atau tidaknya bukti", () => {
    const wajib = kebijakan({ aturan_pengawasan: "wajib" });
    const materi = { id: "m1" };
    const keputusan = [true, false].map((adaBuktiSesi) => {
      const jalur =
        wajibSesiTerverifikasi(wajib) && checkpointTerverifikasi(checkpointEfektif(materi));
      // Klien hanya memilih jalur; keputusan akhir tetap milik server.
      return { adaBuktiSesi, jalur, putusanServer: putuskanAkses({ jenisKegiatan: "materi", kebijakan: wajib, adaBuktiSesi }).tipe };
    });
    expect(keputusan).toEqual([
      { adaBuktiSesi: true, jalur: true, putusanServer: "bebas" },
      { adaBuktiSesi: false, jalur: true, putusanServer: "perlu_sesi" },
    ]);
  });

  it("kursus opsional dan checkpoint kuis/proyek tetap informal", () => {
    const opsional = kebijakan({ aturan_pengawasan: "opsional" });
    const wajib = kebijakan({ aturan_pengawasan: "wajib" });
    expect(wajibSesiTerverifikasi(opsional) && checkpointTerverifikasi(checkpointEfektif({ id: "m1" }))).toBe(false);
    expect(wajibSesiTerverifikasi(wajib) && checkpointTerverifikasi(checkpointEfektif(MODUL))).toBe(false);
  });
});

describe("kategoriDiblokir", () => {
  it("blocks solution-request tutor categories when AI is banned", () => {
    expect(kategoriDiblokir("minta_solusi", kebijakan({ aturan_bantuan: "tanpa_ai" }))).toBe(true);
    expect(kategoriDiblokir("tanya_konsep", kebijakan({ aturan_bantuan: "bertutor" }))).toBe(false);
  });
});

describe("klasifikasiKejadian", () => {
  it("treats a hidden page as an event and a lost stream as a gap", () => {
    expect(klasifikasiKejadian("pindah_tab", "hidden")).toBe("kejadian");
    expect(klasifikasiKejadian("kamera_berhenti", null)).toBe("celah");
    expect(klasifikasiKejadian("fokus_hilang", "visible")).toBe("kejadian");
  });
});

describe("klasifikasiKejadian untuk sinyal browser", () => {
  it("mencatat paste dan pintasan sebagai kejadian, bukan celah", () => {
    // Sinyal yang dipicu peserta sendiri masih "kejadian": ia teramati, hanya
    // tidak selalu berarti curang. Celah dipakai saat pengawasan BERHENTI.
    expect(klasifikasiKejadian("paste_massal", null)).toBe("kejadian");
    expect(klasifikasiKejadian("pintasan_terlarang", null)).toBe("kejadian");
    expect(klasifikasiKejadian("salin_terlarang", null)).toBe("kejadian");
    expect(klasifikasiKejadian("keluar_fullscreen", null)).toBe("kejadian");
  });

  it("mencatat wajah yang hilang sebagai celah pengawasan", () => {
    // Wajah hilang berarti catatan yang kita punya tidak lengkap pada saat itu —
    // itu definisi "celah", bukan bukti perbuatan salah apa pun.
    expect(klasifikasiKejadian("wajah_tidak_terdeteksi", "hidden")).toBe("celah");
  });

  it("mencatat wajah kedua sebagai kejadian", () => {
    expect(klasifikasiKejadian("wajah_kedua", "visible")).toBe("kejadian");
  });
});

describe("lewatBatas", () => {
  const MULAI = "2026-09-25T10:00:00.000Z";
  const menit = (n: number) => Date.parse(MULAI) + n * 60_000;

  it("is not elapsed while still inside the window", () => {
    expect(lewatBatas(MULAI, 30, menit(29))).toBe(false);
  });

  it("is not elapsed exactly on the last minute", () => {
    // The comparison is strict, so finishing on the final minute is never
    // punished over a millisecond of clock skew. This pins that decision.
    expect(lewatBatas(MULAI, 30, menit(30))).toBe(false);
  });

  it("is elapsed once the window is overrun", () => {
    expect(lewatBatas(MULAI, 30, menit(31))).toBe(true);
  });

  it("treats an unparseable start time as elapsed", () => {
    // Fail closed: evidence that cannot be audited must not count as still
    // valid, otherwise a corrupt `mulai_at` grants an unbounded window.
    expect(lewatBatas("bukan tanggal", 30, menit(1))).toBe(true);
  });
});
