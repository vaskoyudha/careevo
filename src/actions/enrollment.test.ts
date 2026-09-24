import { describe, it, expect, beforeEach, vi } from "vitest";
import { daftarKursusAction, tandaiModulAction } from "./enrollment";
import { createModul, resetCourses } from "@/lib/courses/store";
import { decodePendaftaran } from "@/lib/courses/enrollment";
import * as sessionModule from "@/lib/auth/session";
import * as cacheModule from "next/cache";
import type { SessionPayload } from "@/lib/auth/types";

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

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const sesi: SessionPayload = {
  email: "user@careevo.test",
  nama: "Raka Pratama",
  username: "raka",
  role: "user",
  iat: Math.floor(Date.now() / 1000),
};

describe("enrollment actions", () => {
  beforeEach(() => {
    resetCourses();
    jar.clear();
    vi.clearAllMocks();
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi);
  });

  it("menolak bila belum masuk", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(null);
    const res = await daftarKursusAction("crs-1");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("Masuk");
    const tandai = await tandaiModulAction("crs-1", "crs-1-m1");
    expect(tandai.ok).toBe(false);
  });

  it("mendaftarkan kursus gratis dan idempoten", async () => {
    const pertama = await daftarKursusAction("crs-1");
    expect(pertama.ok).toBe(true);
    expect(cacheModule.revalidatePath).toHaveBeenCalledWith("/belajar");
    expect(cacheModule.revalidatePath).toHaveBeenCalledWith(
      "/belajar/fullstack-web-development-nextjs-15-react-19",
    );
    const kedua = await daftarKursusAction("crs-1");
    expect(kedua.ok).toBe(true);
    expect(kedua.message).toContain("sudah terdaftar");
  });

  it("menolak kursus berbayar dengan penanda butuhPlus", async () => {
    const res = await daftarKursusAction("crs-5");
    expect(res.ok).toBe(false);
    expect(res.butuhPlus).toBe(true);
  });

  it("menolak kursus draft yang belum dipublikasikan", async () => {
    const res = await daftarKursusAction("crs-8");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("dipublikasikan");
  });

  it("menolak id yang tidak dikenal", async () => {
    const res = await daftarKursusAction("tidak-ada");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("tidak ditemukan");
  });

  it("mendaftarkan fixture resource gratis lewat id-nya", async () => {
    const res = await daftarKursusAction("r1");
    expect(res.ok).toBe(true);
  });

  it("menandai modul hanya setelah terdaftar", async () => {
    const tanpaDaftar = await tandaiModulAction("crs-2", "crs-2-m1");
    expect(tanpaDaftar.ok).toBe(false);
    expect(tanpaDaftar.error).toContain("Daftar");

    await daftarKursusAction("crs-2");
    const tandai = await tandaiModulAction("crs-2", "crs-2-m1");
    expect(tandai.ok).toBe(true);
    expect(cacheModule.revalidatePath).toHaveBeenCalledWith(
      "/belajar/membangun-rest-api-modern-dengan-nodejs",
    );

    const batal = await tandaiModulAction("crs-2", "crs-2-m1");
    expect(batal.ok).toBe(true);
  });

  it("menolak id modul yang tidak dikenal", async () => {
    await daftarKursusAction("crs-2");
    const res = await tandaiModulAction("crs-2", "crs-2-m99");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("tidak dikenal");
  });

  it("menolak tandai untuk kursus draft", async () => {
    const res = await tandaiModulAction("crs-8", "crs-8-m1");
    expect(res.ok).toBe(false);
  });

  it("menyimpan pendaftaran di cookie yang bisa dibaca kembali", async () => {
    await daftarKursusAction("crs-1");
    await tandaiModulAction("crs-1", "crs-1-m1");
    const mentah = jar.get("ls_enroll");
    expect(mentah).toBeDefined();
    const daftar = decodePendaftaran(mentah);
    expect(daftar).toHaveLength(1);
    expect(daftar[0].course_id).toBe("crs-1");
    expect(daftar[0].selesai_modul).toEqual(["crs-1-m1"]);
  });

  it("menolak modul dengan checkpoint kuis", async () => {
    await daftarKursusAction("crs-3");
    // Modul tersimpan dengan checkpoint kuis: kelulusannya hanya sah dari kuis,
    // jadi tombol "Tandai selesai" tidak boleh menembusnya.
    const modulKuis = await createModul("crs-3", {
      judul: "Kuis Keamanan Dasar",
      ringkasan: "Uji pemahaman dasar OWASP lewat kuis tersimpan.",
      durasi_min: 20,
      checkpoint: { mode: "kuis", batas_waktu_menit: 20 },
    });
    expect(modulKuis).not.toBeNull();

    const res = await tandaiModulAction("crs-3", modulKuis!.id);
    expect(res.ok).toBe(false);
    // Pesannya disamakan dengan `selesaikanMateriAction`, lengkap dengan dua
    // kata kuncinya, supaya kedua jalur tidak menyimpang.
    expect(res.error).toContain("kuis/proyek");
    expect(res.error).toContain("penandaan manual");

    // Bukti bahwa penolakan benar-benar menghentikan penulisan: progres tetap
    // kosong, bukan hanya balasan `ok: false`.
    const daftar = decodePendaftaran(jar.get("ls_enroll"));
    expect(daftar[0].selesai_modul).toEqual([]);
  });

  it("menolak modul dengan checkpoint proyek", async () => {
    await daftarKursusAction("crs-3");
    const modulProyek = await createModul("crs-3", {
      judul: "Proyek Keamanan Terapan",
      ringkasan: "Bangun tinjauan keamanan sebagai proyek penilaian.",
      durasi_min: 60,
      checkpoint: { mode: "proyek", batas_waktu_menit: 120 },
    });
    expect(modulProyek).not.toBeNull();

    const res = await tandaiModulAction("crs-3", modulProyek!.id);
    expect(res.ok).toBe(false);
    expect(res.error).toContain("kuis/proyek");
  });

  it("tetap mengizinkan penandaan modul checkpoint materi", async () => {
    await daftarKursusAction("crs-3");
    // Mode `materi` (dan modul turunan tanpa checkpoint) adalah jalur informal
    // yang sah: kursus beraturan tetap bisa ditandai sendiri peserta.
    const modulMateri = await createModul("crs-3", {
      judul: "Pengantar OWASP",
      ringkasan: "Ringkasan sepuluh risiko teratas menurut OWASP.",
      durasi_min: 15,
      checkpoint: { mode: "materi", batas_waktu_menit: 30 },
    });
    expect(modulMateri).not.toBeNull();

    const res = await tandaiModulAction("crs-3", modulMateri!.id);
    expect(res.ok).toBe(true);

    const daftar = decodePendaftaran(jar.get("ls_enroll"));
    expect(daftar[0].selesai_modul).toEqual([modulMateri!.id]);
  });

  it("tetap mengizinkan penandaan modul turunan tanpa checkpoint tersimpan", async () => {
    // Kursus yang belum pernah diedit admin memakai modul turunan (id lama);
    // modul itu tidak punya checkpoint, jadi defaultnya `materi` dan jalur
    // informal harus tetap bekerja persis seperti sebelumnya.
    await daftarKursusAction("crs-1");
    const res = await tandaiModulAction("crs-1", "crs-1-m1");
    expect(res.ok).toBe(true);
    expect(decodePendaftaran(jar.get("ls_enroll"))[0].selesai_modul).toEqual(["crs-1-m1"]);
  });
});
