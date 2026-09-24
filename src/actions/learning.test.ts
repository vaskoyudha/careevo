import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Direktori sesi dialihkan sebelum modul diimpor: `session.ts` membaca
// `CAREERS_SESSION_DIR` per panggilan, dan tanpa ini test akan menulis ke
// `.data/sessions` milik mesin pengembang.
const DIR = mkdtempSync(path.join(tmpdir(), "careevo-sesi-act-"));
process.env.CAREERS_SESSION_DIR = DIR;

// Cookie pendaftaran hidup di `next/headers`; jar in-memory menirukan perilaku
// peramban supaya `daftarKursus()` benar-benar terbaca oleh action.
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = jar.get(name);
      return value ? { value } : undefined;
    },
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
  }),
}));

const sesi = { email: "siswa@careevo.test", nama: "Siswa", username: "siswa", role: "user", iat: 1 };
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => sesi,
}));

const { mulaiSesiAction, catatKejadianAction, selesaikanMateriAction, akhiriSesiAction } = await import(
  "./learning"
);
const { daftarKursus } = await import("@/lib/courses/enrollment");
const { createModul, resetCourses } = await import("@/lib/courses/store");

afterAll(() => rmSync(DIR, { recursive: true, force: true }));

// Store kursus bisa menghidrasi `data/courses.json` milik mesin pengembang;
// reset memakai seed in-memory tanpa menyentuh disk supaya hasil test deterministik.
beforeEach(() => {
  resetCourses();
  jar.clear();
});

describe("mulaiSesiAction", () => {
  it("creates a session and returns a proof token", async () => {
    await daftarKursus("crs-1", "crs-1");
    const hasil = await mulaiSesiAction("crs-1");
    expect(hasil.ok).toBe(true);
    expect(hasil.bukti).toBeTruthy();
    expect(hasil.run?.owner).toBe("siswa@careevo.test");
  });

  it("rejects a course the caller is not enrolled in", async () => {
    // `crs-1` ada dan published, tetapi pemanggil belum mendaftar di test ini.
    const hasil = await mulaiSesiAction("crs-1");
    expect(hasil.ok).toBe(false);
    // Pesan implementasi memakai huruf besar ("Daftar kursus ini dulu..."),
    // jadi pencocokan dilakukan tanpa peduli huruf besar/kecil.
    expect(hasil.error?.toLowerCase()).toContain("daftar");
  });
});

describe("selesaikanMateriAction", () => {
  it("rejects a missing session proof", async () => {
    const hasil = await selesaikanMateriAction({ courseId: "crs-1", modulId: "crs-1-m1", bukti: "" });
    expect(hasil.ok).toBe(false);
    expect(hasil.error).toContain("sesi");
  });

  it("rejects a course the caller is not enrolled in", async () => {
    const mulai = await mulaiSesiAction("crs-2");
    // Belum terdaftar: sesi pun tidak bisa dibuat, jadi tidak ada bukti sah.
    expect(mulai.ok).toBe(false);
    const hasil = await selesaikanMateriAction({
      courseId: "crs-2",
      modulId: "crs-2-m1",
      bukti: "bukti-palsu",
    });
    expect(hasil.ok).toBe(false);
  });

  it("rejects a module whose checkpoint is not `materi`", async () => {
    await daftarKursus("crs-3", "crs-3");
    // Modul tersimpan dengan checkpoint kuis: menyelesaikannya lewat penandaan
    // materi harus ditolak, sebab kelulusannya hanya sah dari kuis.
    const modulKuis = await createModul("crs-3", {
      judul: "Kuis Keamanan Dasar",
      ringkasan: "Uji pemahaman dasar OWASP lewat kuis tersimpan.",
      durasi_min: 20,
      checkpoint: { mode: "kuis", batas_waktu_menit: 20 },
    });
    expect(modulKuis).not.toBeNull();

    const mulai = await mulaiSesiAction("crs-3");
    expect(mulai.ok).toBe(true);
    const hasil = await selesaikanMateriAction({
      courseId: "crs-3",
      modulId: modulKuis!.id,
      bukti: mulai.bukti ?? "",
    });
    expect(hasil.ok).toBe(false);
    expect(hasil.error).toContain("kuis");
  });

  it("accepts a valid proof for a required-proctoring course", async () => {
    await daftarKursus("crs-2", "crs-2");
    const mulai = await mulaiSesiAction("crs-2");
    const hasil = await selesaikanMateriAction({
      courseId: "crs-2",
      modulId: "crs-2-m1",
      bukti: mulai.bukti ?? "",
    });
    expect(hasil.ok).toBe(true);
  });
});

describe("catatKejadianAction", () => {
  it("records an event for an active run", async () => {
    await daftarKursus("crs-3", "crs-3");
    const mulai = await mulaiSesiAction("crs-3");
    const hasil = await catatKejadianAction({ runId: mulai.runId ?? "", jenis: "pindah_tab", visibilitas: "hidden" });
    expect(hasil.ok).toBe(true);
    // Kejadian pertama selalu `sesi_dimulai` dari `mulaiSesiAction`; yang
    // diuji di sini adalah kejadian terbaru yang baru saja dicatat.
    expect(hasil.run?.kejadian.at(-1)?.jenis).toBe("pindah_tab");
  });

  it("refuses an unknown run", async () => {
    const hasil = await catatKejadianAction({ runId: "sesi-palsu", jenis: "pindah_tab", visibilitas: "hidden" });
    expect(hasil.ok).toBe(false);
  });
});

describe("akhiriSesiAction", () => {
  it("menutup sesi yang aktif", async () => {
    await daftarKursus("crs-1", "crs-1");
    const mulai = await mulaiSesiAction("crs-1");
    const hasil = await akhiriSesiAction(mulai.runId ?? "");
    expect(hasil.ok).toBe(true);
    expect(hasil.run?.status).toBe("diakhiri");
  });

  it("menolak sesi yang bukan milik pemanggil", async () => {
    const hasil = await akhiriSesiAction("sesi-palsu");
    expect(hasil.ok).toBe(false);
  });
});
