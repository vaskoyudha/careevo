import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST, subjekMilikCourse } from "./route";
import * as sessionModule from "@/lib/auth/session";
import { originDiizinkan, hostPermintaan } from "@/lib/http/origin";
import {
  createModul,
  createMateri,
  createHalaman,
  resetCourses,
} from "@/lib/courses/store";
import { modulUntuk } from "@/lib/courses/modul-resolver";
import type { SessionPayload } from "@/lib/auth/types";

/**
 * Route handler unggah — diuji adversarial di transport, bukan sebagai unit
 * internal.
 *
 * Dua properti keamanan yang dijaga di sini:
 *
 * 1. **Origin divalidasi sebelum apa pun.** Route handler tidak mendapat
 *    perlindungan CSRF bawaan Next.js, jadi ia memeriksa Origin sendiri.
 *    Assertion "tanpa sesi + lintas origin tetap 403 (bukan 401)" membuktikan
 *    pemeriksaan Origin berjalan lebih dulu daripada gerbang sesi.
 * 2. **`subjekId` tidak dipercaya.** Ia harus milik kursus yang disebut,
 *    mengikuti resolver modul efektif sehingga kursus bermodul turunan tetap
 *    menerima id lamanya (`${courseId}-m1`).
 *
 * Penulisan berkas di-mock supaya test tidak menyentuh `public/uploads/`.
 */

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, mkdir: vi.fn(async () => undefined), writeFile: vi.fn(async () => undefined) };
});

const COURSE_ID = "crs-1";
const ASAL = "http://localhost:3000";
const URL_UNGGAH = `${ASAL}/api/unggah`;

const adminSession: SessionPayload = {
  email: "admin@careevo.test",
  nama: "Admin Careevo",
  username: "admin",
  role: "admin",
  iat: Math.floor(Date.now() / 1000),
};

const userSession: SessionPayload = { ...adminSession, role: "user", username: "normal" };

function berkasPng(): File {
  return new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "sampul.png", {
    type: "image/png",
  });
}

interface OpsiPermintaan {
  courseId?: string | null;
  subjekId?: string | null;
  origin?: string | null;
  berkas?: File | null;
  /** Header tambahan, mis. untuk menimpa host. */
  headers?: Record<string, string>;
}

function permintaan(opsi: OpsiPermintaan = {}): Request {
  const { courseId = COURSE_ID, subjekId = null, origin = ASAL, berkas = berkasPng() } = opsi;

  const form = new FormData();
  if (berkas) form.append("berkas", berkas);
  if (courseId !== null) form.append("courseId", courseId);
  if (subjekId !== null) form.append("subjekId", subjekId);

  const headers: Record<string, string> = {};
  if (origin !== null) headers.origin = origin;
  Object.assign(headers, opsi.headers ?? {});

  return new Request(URL_UNGGAH, { method: "POST", body: form, headers });
}

async function bacaJson(res: Response): Promise<{ ok: boolean; error?: string; path?: string }> {
  return (await res.json()) as { ok: boolean; error?: string; path?: string };
}

describe("POST /api/unggah — validasi Origin", () => {
  beforeEach(() => {
    resetCourses();
    vi.restoreAllMocks();
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(adminSession);
  });

  it("menolak permintaan lintas origin", async () => {
    const res = await POST(permintaan({ origin: "https://jahat.example" }));
    expect(res.status).toBe(403);
    expect((await bacaJson(res)).error).toContain("Origin");
  });

  it("menolak Origin null (origin opaque)", async () => {
    const res = await POST(permintaan({ origin: "null" }));
    expect(res.status).toBe(403);
  });

  it("memeriksa Origin sebelum gerbang sesi: lintas origin tanpa sesi tetap 403", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(null);
    const res = await POST(permintaan({ origin: "https://jahat.example" }));
    // 403 (Origin), bukan 401 (sesi) — membuktikan urutannya.
    expect(res.status).toBe(403);
  });

  it("menerima same-origin browser", async () => {
    const res = await POST(permintaan({ origin: ASAL }));
    expect(res.status).toBe(200);
  });

  it("menerima klien tanpa Origin di luar production (test/curl)", async () => {
    const res = await POST(permintaan({ origin: null }));
    expect(res.status).toBe(200);
  });

  it("menolak permintaan yang Origin-nya bukan http/https", async () => {
    const res = await POST(permintaan({ origin: "ftp://localhost:3000" }));
    expect(res.status).toBe(403);
  });
});

describe("originDiizinkan — kebijakan helper", () => {
  it("menerima same-origin dan menolak lintas origin", () => {
    expect(originDiizinkan(permintaan({ origin: ASAL }), { izinkanTanpaOrigin: true })).toBe(true);
    expect(
      originDiizinkan(permintaan({ origin: "https://jahat.example" }), {
        izinkanTanpaOrigin: true,
      }),
    ).toBe(false);
  });

  it("absen Origin ditolak bila izinkanTanpaOrigin dimatikan (mode production)", () => {
    expect(originDiizinkan(permintaan({ origin: null }), { izinkanTanpaOrigin: false })).toBe(false);
    expect(originDiizinkan(permintaan({ origin: null }), { izinkanTanpaOrigin: true })).toBe(true);
  });

  it("membandingkan terhadap X-Forwarded-Host lebih dulu", () => {
    const req = permintaan({ origin: "https://publik.example", headers: {} });
    // Host dari URL permintaan adalah localhost:3000 → lintas origin.
    expect(hostPermintaan(req)).toBe("localhost:3000");
    expect(originDiizinkan(req)).toBe(false);

    // Di belakang proxy, host yang diteruskan adalah yang dibandingkan.
    const diProxy = new Request(URL_UNGGAH, {
      method: "POST",
      headers: { origin: "https://publik.example", "x-forwarded-host": "publik.example" },
    });
    expect(originDiizinkan(diProxy)).toBe(true);
  });
});

describe("POST /api/unggah — gerbang akses", () => {
  beforeEach(() => {
    resetCourses();
    vi.restoreAllMocks();
  });

  it("menolak tanpa sesi", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(null);
    const res = await POST(permintaan());
    expect(res.status).toBe(401);
  });

  it("menolak role non-staff", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(userSession);
    const res = await POST(permintaan());
    expect(res.status).toBe(403);
    expect((await bacaJson(res)).error).toContain("verifikator atau admin");
  });
});

describe("POST /api/unggah — otorisasi course dan subjek", () => {
  beforeEach(() => {
    resetCourses();
    vi.restoreAllMocks();
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(adminSession);
  });

  it("menolak kursus yang tidak ada", async () => {
    const res = await POST(permintaan({ courseId: "crs-tidak-ada" }));
    expect(res.status).toBe(404);
    expect((await bacaJson(res)).error).toContain("tidak ditemukan");
  });

  it("menerima modul turunan milik kursus seed", async () => {
    // crs-1 belum diedit admin, jadi modulnya turunan dengan id lama.
    const res = await POST(permintaan({ subjekId: "crs-1-m1" }));
    expect(res.status).toBe(200);
    expect((await bacaJson(res)).path).toMatch(/^\/uploads\/courses\/crs-1\/crs-1-m1\//);
  });

  it("menolak subjek turunan milik kursus lain", async () => {
    const res = await POST(permintaan({ subjekId: "crs-2-m1" }));
    expect(res.status).toBe(404);
    expect((await bacaJson(res)).error).toContain("Subjek");
  });

  it("menolak id subjek yang mengarang, termasuk percobaan traversal", async () => {
    for (const subjek of ["../../etc/passwd", "mod-ngawur", "crs-1-m99"]) {
      const res = await POST(permintaan({ subjekId: subjek }));
      expect(res.status, `subjek ${subjek}`).toBe(404);
    }
  });

  it("menerima id modul tersimpan setelah kurikulum diedit admin", async () => {
    const modul = await createModul(COURSE_ID, {
      judul: "Modul Baru",
      ringkasan: "Ringkasan modul baru untuk pengujian otorisasi subjek.",
      durasi_min: 30,
    });
    expect(modul).not.toBeNull();

    const res = await POST(permintaan({ subjekId: modul!.id }));
    expect(res.status).toBe(200);

    // Id turunan lama tidak lagi berlaku begitu modul tersimpan menang.
    const lama = await POST(permintaan({ subjekId: "crs-1-m1" }));
    expect(lama.status).toBe(404);
  });

  it("menerima id materi dan id halaman yang benar-benar milik kursus", async () => {
    const modul = await createModul(COURSE_ID, {
      judul: "Modul Berisi",
      ringkasan: "Modul dengan materi dan halaman untuk pengujian subjek.",
      durasi_min: 30,
    });
    const materi = await createMateri(COURSE_ID, modul!.id, {
      tipe: "pdf",
      judul: "Lampiran",
      path: "/uploads/lampiran.pdf",
      ukuran_bytes: 1024,
    });
    const halaman = await createHalaman(COURSE_ID, modul!.id, { judul: "Halaman Satu" });

    for (const subjek of [materi!.id, halaman!.id]) {
      const res = await POST(permintaan({ subjekId: subjek }));
      expect(res.status, `subjek ${subjek}`).toBe(200);
    }
  });

  it("subjekMilikCourse mengakui modul, materi, dan halaman; menolak yang asing", async () => {
    const modul = await createModul(COURSE_ID, {
      judul: "Modul Cek",
      ringkasan: "Modul untuk menguji predicate kepemilikan subjek secara langsung.",
      durasi_min: 30,
    });
    const materi = await createMateri(COURSE_ID, modul!.id, {
      tipe: "video",
      judul: "Video",
      url: "https://contoh.example/v",
      durasi_min: 5,
    });
    const halaman = await createHalaman(COURSE_ID, modul!.id, { judul: "Halaman" });

    const modulResolved = await modulUntuk(COURSE_ID);
    expect(subjekMilikCourse(modulResolved, modul!.id)).toBe(true);
    expect(subjekMilikCourse(modulResolved, materi!.id)).toBe(true);
    expect(subjekMilikCourse(modulResolved, halaman!.id)).toBe(true);
    expect(subjekMilikCourse(modulResolved, "asing-1")).toBe(false);
  });
});
