import { describe, expect, it } from "vitest";
import { kebijakanDefault } from "@/lib/courses/kebijakan";
import type { CheckpointMateri, KebijakanCourse } from "@/types/course";
import {
  checkpointEfektif,
  checkpointTerverifikasi,
  kategoriDiblokir,
  klasifikasiKejadian,
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
