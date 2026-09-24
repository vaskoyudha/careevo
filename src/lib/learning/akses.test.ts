import { describe, expect, it } from "vitest";
import { kebijakanDefault } from "@/lib/courses/kebijakan";
import type { CheckpointMateri, KebijakanCourse } from "@/types/course";
import { checkpointEfektif, kategoriDiblokir, klasifikasiKejadian, putuskanAkses } from "./akses";

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

  it("rejects academic chatbot help under the no-AI rule", () => {
    const hasil = putuskanAkses({ jenisKegiatan: "bantuan_akademik", kebijakan: kebijakan({ aturan_bantuan: "tanpa_ai" }), adaBuktiSesi: true });
    expect(hasil.tipe).toBe("ditolak");
  });

  it("allows tutor help under the tutor rule", () => {
    expect(putuskanAkses({ jenisKegiatan: "bantuan_akademik", kebijakan: kebijakan({ aturan_bantuan: "bertutor" }), adaBuktiSesi: false }).tipe).toBe("bebas");
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
