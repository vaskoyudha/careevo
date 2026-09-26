import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST, subjekMilikCourse } from "./route";
import * as sessionModule from "@/lib/auth/session";
import {
  originDiizinkan,
  hostPermintaan,
  izinkanTanpaOriginDariEnv,
  percayaXForwardedHostDariEnv,
  ENV_IZINKAN_TANPA_ORIGIN,
  ENV_PERCAYA_X_FORWARDED_HOST,
  type OriginEnvironment,
} from "@/lib/http/origin";
import {
  createModul,
  createMateri,
  createHalaman,
  resetCourses,
} from "@/lib/courses/store";
import { modulUntuk } from "@/lib/courses/modul-resolver";
import { principalUji } from "@/lib/auth/test-principal";

/**
 * Route handler unggah — diuji adversarial di transport, bukan sebagai unit
 * internal.
 *
 * Tiga properti keamanan yang dijaga di sini:
 *
 * 1. **Origin divalidasi sebelum apa pun.** Route handler tidak mendapat
 *    perlindungan CSRF bawaan Next.js, jadi ia memeriksa Origin sendiri.
 *    Assertion "tanpa sesi + lintas origin tetap 403 (bukan 401)" membuktikan
 *    pemeriksaan Origin berjalan lebih dulu daripada gerbang sesi.
 * 2. **`subjekId` tidak dipercaya.** Ia harus milik kursus yang disebut,
 *    mengikuti resolver modul efektif sehingga kursus bermodul turunan tetap
 *    menerima id lamanya (`${courseId}-m1`).
 * 3. **Pembatas dijalankan sebelum body dibaca.** Handler ini menampung seluruh
 *    body multipart ke memori, jadi urutannya adalah properti keamanan: gerbang
 *    sesi, gerbang peran, dan pembatas harus selesai sebelum `formData()`
 *    menyentuh body. Penolakan yang tetap membaca body lebih dulu tidak
 *    melindungi apa pun.
 *
 * Penulisan berkas di-mock supaya test tidak menyentuh `public/uploads/`.
 */

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, mkdir: vi.fn(async () => undefined), writeFile: vi.fn(async () => undefined) };
});

// Hanya modul pembatas yang di-mock. Sisanya (store kursus, origin, resolver
// modul) tetap nyata supaya suite di bawah benar-benar menguji perilakunya.
const mocks = vi.hoisted(() => ({ batasiRequestMasuk: vi.fn() }));

vi.mock("@/lib/rate-limit/next", () => ({
  batasiRequestMasuk: mocks.batasiRequestMasuk,
}));

const COURSE_ID = "crs-1";
const ASAL = "http://localhost:3000";
const URL_UNGGAH = `${ASAL}/api/unggah`;

const adminSession = principalUji({
  email: "admin@careevo.test",
  nama: "Admin Careevo",
  username: "admin",
  role: "admin",
});

/**
 * Principal learner: `roles`/`role` harus ikut berubah, bukan cuma `role`.
 * `principalUji` menurunkan `role` dari `roles`, jadi override di sini tidak
 * bisa meninggalkan objek yang mengaku admin di satu field dan user di field lain.
 */
const userSession = principalUji({
  email: "user@careevo.test",
  nama: "Normal User",
  username: "normal",
  role: "user",
});

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

/**
 * Permintaan yang bodynya **tidak dapat dibaca**. Setiap jalur yang mencapai
 * `formData()` akan melempar, sehingga "tidak melempar" menjadi bukti bahwa
 * handler berhenti lebih dulu.
 */
function permintaanTanpaBody(): Request {
  const req = permintaan();
  Object.defineProperty(req, "formData", {
    value: () => {
      throw new Error("body tidak boleh dibaca");
    },
  });
  return req;
}

async function bacaJson(res: Response): Promise<{ ok: boolean; error?: string; path?: string }> {
  return (await res.json()) as { ok: boolean; error?: string; path?: string };
}

describe("POST /api/unggah — validasi Origin", () => {
  beforeEach(() => {
    resetCourses();
    vi.restoreAllMocks();
    delete process.env[ENV_IZINKAN_TANPA_ORIGIN];
    delete process.env[ENV_PERCAYA_X_FORWARDED_HOST];
    mocks.batasiRequestMasuk.mockResolvedValue(null);
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(adminSession);
  });

  afterEach(() => {
    delete process.env[ENV_IZINKAN_TANPA_ORIGIN];
    delete process.env[ENV_PERCAYA_X_FORWARDED_HOST];
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

  it("menolak klien tanpa Origin secara default (fail-closed), walau ada sesi staff", async () => {
    const res = await POST(permintaan({ origin: null }));
    expect(res.status).toBe(403);
    expect((await bacaJson(res)).error).toContain("Origin");
  });

  it("menerima klien tanpa Origin hanya bila CAREEVO_ALLOW_MISSING_ORIGIN diisi eksplisit", async () => {
    process.env[ENV_IZINKAN_TANPA_ORIGIN] = "1";
    const res = await POST(permintaan({ origin: null }));
    expect(res.status).toBe(200);
  });

  it("menolak permintaan yang Origin-nya bukan http/https", async () => {
    const res = await POST(permintaan({ origin: "ftp://localhost:3000" }));
    expect(res.status).toBe(403);
  });

  it("TIDAK mempercayai X-Forwarded-Host dari klien: origin yang cocok dengan XFH palsu tetap ditolak", async () => {
    const res = await POST(
      permintaan({
        origin: "https://jahat.example",
        headers: { "x-forwarded-host": "jahat.example" },
      }),
    );
    // Host permintaan sebenarnya localhost:3000 (dari URL), bukan XFH.
    expect(res.status).toBe(403);
  });

  it("memakai X-Forwarded-Host hanya setelah CAREEVO_TRUST_PROXY_HEADERS diisi eksplisit", async () => {
    const headers = { origin: "https://publik.example", "x-forwarded-host": "publik.example" };

    // Default: header diabaikan → host localhost:3000 → lintas origin.
    const ditolak = await POST(permintaan({ headers }));
    expect(ditolak.status).toBe(403);

    // Di belakang proxy tepercaya yang diakui eksplisit: host diteruskan dipakai.
    process.env[ENV_PERCAYA_X_FORWARDED_HOST] = "1";
    const diterima = await POST(permintaan({ headers }));
    expect(diterima.status).toBe(200);
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

  it("absen Origin ditolak secara default dan hanya diterima bila diizinkan eksplisit", () => {
    expect(originDiizinkan(permintaan({ origin: null }), { izinkanTanpaOrigin: false })).toBe(false);
    expect(originDiizinkan(permintaan({ origin: null }), { izinkanTanpaOrigin: true })).toBe(true);
  });

  it("absen Origin ditolak tanpa opsi apa pun (fail-closed, bukan dari NODE_ENV)", () => {
    // process.env di test bukan production; tanpa izin eksplisit tetap ditolak.
    expect(originDiizinkan(permintaan({ origin: null }))).toBe(false);
  });

  it("env CAREEVO_ALLOW_MISSING_ORIGIN adalah satu-satunya saklar absennya Origin", () => {
    const kosong: OriginEnvironment = {};
    expect(izinkanTanpaOriginDariEnv(kosong)).toBe(false);
    expect(izinkanTanpaOriginDariEnv({ [ENV_IZINKAN_TANPA_ORIGIN]: "0" })).toBe(false);
    expect(izinkanTanpaOriginDariEnv({ [ENV_IZINKAN_TANPA_ORIGIN]: "false" })).toBe(false);
    expect(izinkanTanpaOriginDariEnv({ [ENV_IZINKAN_TANPA_ORIGIN]: "1" })).toBe(true);
    expect(izinkanTanpaOriginDariEnv({ [ENV_IZINKAN_TANPA_ORIGIN]: "true" })).toBe(true);
  });

  it("hostPermintaan mengabaikan X-Forwarded-Host secara default", () => {
    const req = new Request(URL_UNGGAH, {
      method: "POST",
      headers: { origin: ASAL, "x-forwarded-host": "jahat.example" },
    });
    // XFH palsu tidak dipakai: host dari URL permintaan.
    expect(hostPermintaan(req)).toBe("localhost:3000");
    // Setelah kepercayaan eksplisit, XFH dipakai.
    expect(hostPermintaan(req, { percayaXForwardedHost: true })).toBe("jahat.example");
  });

  it("env CAREEVO_TRUST_PROXY_HEADERS adalah saklar kepercayaan X-Forwarded-Host", () => {
    expect(percayaXForwardedHostDariEnv({})).toBe(false);
    expect(percayaXForwardedHostDariEnv({ [ENV_PERCAYA_X_FORWARDED_HOST]: "0" })).toBe(false);
    expect(percayaXForwardedHostDariEnv({ [ENV_PERCAYA_X_FORWARDED_HOST]: "1" })).toBe(true);
  });

  it("origin cocok dengan X-Forwarded-Host hanya bila proxy dipercaya", () => {
    const req = new Request(URL_UNGGAH, {
      method: "POST",
      headers: { origin: "https://publik.example", "x-forwarded-host": "publik.example" },
    });
    expect(originDiizinkan(req)).toBe(false);
    expect(originDiizinkan(req, { percayaXForwardedHost: true })).toBe(true);
  });
});

describe("POST /api/unggah — gerbang akses", () => {
  beforeEach(() => {
    resetCourses();
    vi.restoreAllMocks();
    mocks.batasiRequestMasuk.mockResolvedValue(null);
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
    mocks.batasiRequestMasuk.mockResolvedValue(null);
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

describe("POST /api/unggah — pembatas permintaan", () => {
  beforeEach(() => {
    resetCourses();
    vi.restoreAllMocks();
    mocks.batasiRequestMasuk.mockResolvedValue(null);
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(adminSession);
  });

  it("memakai principal email sesi, bukan nilai dari klien", async () => {
    const res = await POST(permintaan());
    expect(res.status).toBe(200);

    // Principal berasal dari sesi yang sudah divalidasi; memakai `courseId` atau
    // `subjekId` kiriman klien akan memberi penyerang cara memilih bucket sendiri.
    expect(mocks.batasiRequestMasuk).toHaveBeenCalledWith(
      expect.anything(),
      "unggahCourse",
      { tambahan: `unggah:${adminSession.email}` },
    );
  });

  it("membalas 429 tanpa membaca body saat dibatasi", async () => {
    mocks.batasiRequestMasuk.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "Terlalu banyak permintaan." }), {
        status: 429,
        headers: { "Retry-After": "30" },
      }),
    );

    // `permintaanTanpaBody()` melempar bila body dibaca, jadi 429 membuktikan
    // penolakan terjadi sebelum buffer 8 MB dialokasikan.
    const res = await POST(permintaanTanpaBody());

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("tidak menghitung permintaan yang sudah ditolak Origin atau sesi", async () => {
    // Lintas origin: ditolak lebih dulu, jadi pembatas tidak dijalankan sama sekali.
    await POST(permintaan({ origin: "https://jahat.example" }));
    expect(mocks.batasiRequestMasuk).not.toHaveBeenCalled();

    // Tanpa sesi: sama — tidak ada principal yang jujur untuk dijadikan kunci.
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(null);
    await POST(permintaan());
    expect(mocks.batasiRequestMasuk).not.toHaveBeenCalled();
  });
});
