import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Uji gerbang `/api/workspace/buka` sebagai **fungsi**, bukan lewat HTTP.
 *
 * Yang diuji di sini adalah urutan gerbang dan pemetaan status, karena itulah
 * yang menentukan apakah tiket palsu ditolak. Test ini **tidak** menyalakan
 * podman: `getSession`, rate limit, dan `prosesManajer` semuanya di-mock, dan
 * yang diperiksa adalah keputusan yang diambil route sebelum apa pun yang mahal
 * terjadi.
 *
 * Batasnya jujur: ini bukan test integrasi. Yang tidak tercakup adalah perilaku
 * `getSession` yang sesungguhnya dan penerusan WebSocket — keduanya diverifikasi
 * secara manual di peramban, dan itu dicatat di laporan, bukan diklaim di sini.
 */

const sesiSekarang = vi.hoisted(() => ({ nilai: null as null | { userId: string; email: string } }));
/**
 * Keadaan yang dikembalikan `prosesManajer.status` tiruan.
 *
 * Tipenya **eksplisit**, bukan disimpulkan dari nilai awal. Versi pertama
 * menulis `status: "ok" as const`, dan itu membuat TypeScript menyimpulkan tipe
 * literal `"ok"` — sehingga test yang menirukan manajer mati
 * (`status: "galat_manajer"`) gagal typecheck. Yang diuji di sini adalah
 * *bagaimana route memperlakukan setiap status*, jadi tipe-nya harus memuat
 * seluruh kemungkinan itu.
 */
const statusManajer = vi.hoisted(() => ({
  nilai: {
    status: "ok" as "ok" | "galat_manajer",
    hidup: true,
    url: "http://127.0.0.1:9999" as string | undefined,
  },
}));
const batasRate = vi.hoisted(() => ({ nilai: null as null | Response }));
/** Argumen terakhir yang diterima `prosesManajer.status` — untuk memeriksa `host`. */
const argumenStatus = vi.hoisted(() => ({ nilai: null as null | Record<string, unknown> }));

vi.mock("@/lib/auth/session", () => ({
  getSession: async () => sesiSekarang.nilai,
}));

vi.mock("@/lib/rate-limit/next", () => ({
  batasiRequestMasuk: async () => batasRate.nilai,
}));

vi.mock("@/lib/workspace", () => ({
  prosesManajer: {
    status: async (minta: Record<string, unknown>) => {
      argumenStatus.nilai = minta;
      return statusManajer.nilai;
    },
  },
}));

import { GET } from "./route";
import { terbitkanTiket } from "@/lib/workspace/tiket";

const RAHASIA = "rahasia-uji-gerbang-1234567890abcdef";

/** Bangun Request untuk route, dengan query yang diberikan. */
function minta(query: string): Request {
  return new Request(`http://127.0.0.1:3000/api/workspace/buka${query}`);
}

/** Tiket sah untuk `(userId, courseId)`. */
function tiket(userId: string, courseId: string, kedaluwarsa = Date.now() + 300_000): string {
  const t = terbitkanTiket(RAHASIA, { userId, courseId, kedaluwarsa });
  if (!t) throw new Error("tiket sah gagal diterbitkan");
  return t;
}

beforeEach(() => {
  process.env.CAREEVO_WORKSPACE_SECRET = RAHASIA;
  sesiSekarang.nilai = { userId: "u-1", email: "u1@example.test" };
  statusManajer.nilai = { status: "ok", hidup: true, url: "http://127.0.0.1:9999" };
  batasRate.nilai = null;
});

afterEach(() => {
  delete process.env.CAREEVO_WORKSPACE_SECRET;
});

describe("GET /api/workspace/buka", () => {
  it("menolak 401 tanpa sesi, sebelum apa pun yang lain", async () => {
    sesiSekarang.nilai = null;
    const res = await GET(minta("?courseId=c1&tiket=apa.saja"));
    expect(res.status).toBe(401);
  });

  it("menolak 400 tanpa courseId atau tiket", async () => {
    expect((await GET(minta("?tiket=x.y"))).status).toBe(400);
    expect((await GET(minta("?courseId=c1"))).status).toBe(400);
    expect((await GET(minta(""))).status).toBe(400);
  });

  it("menolak 403 untuk tiket yang dibuat dengan rahasia lain", async () => {
    const asing = terbitkanTiket("rahasia-yang-berbeda-sekali", {
      userId: "u-1",
      courseId: "c1",
      kedaluwarsa: Date.now() + 300_000,
    })!;
    const res = await GET(minta(`?courseId=c1&tiket=${encodeURIComponent(asing)}`));
    expect(res.status).toBe(403);
  });

  it("menolak 403 untuk tiket milik peserta lain", async () => {
    // Ini properti isolasi yang paling penting: tiket yang dicuri dari peserta
    // lain tidak berguna, karena isinya menunjuk `userId` pemilik aslinya.
    const res = await GET(minta(`?courseId=c1&tiket=${encodeURIComponent(tiket("u-2", "c1"))}`));
    expect(res.status).toBe(403);
  });

  it("menolak 403 untuk tiket yang sah di course lain", async () => {
    const res = await GET(minta(`?courseId=c2&tiket=${encodeURIComponent(tiket("u-1", "c1"))}`));
    expect(res.status).toBe(403);
  });

  it("menolak 403 untuk tiket yang sudah kedaluwarsa", async () => {
    const basi = tiket("u-1", "c1", Date.now() - 1000);
    const res = await GET(minta(`?courseId=c1&tiket=${encodeURIComponent(basi)}`));
    expect(res.status).toBe(403);
  });

  it("menolak 403 untuk payload yang diubah walau tanda tangannya asli", async () => {
    const sah = tiket("u-1", "c1");
    const [payload, sig] = sah.split(".");
    const isi = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    isi.userId = "penyusup";
    const palsu = Buffer.from(JSON.stringify(isi), "utf8").toString("base64url");
    const res = await GET(minta(`?courseId=c1&tiket=${encodeURIComponent(`${palsu}.${sig}`)}`));
    expect(res.status).toBe(403);
  });

  it("mengalihkan 302 ke ruang kerja untuk tiket yang sah", async () => {
    const res = await GET(minta(`?courseId=c1&tiket=${encodeURIComponent(tiket("u-1", "c1"))}`));
    expect(res.status).toBe(302);
    const lokasi = res.headers.get("location") ?? "";
    expect(lokasi).toContain("127.0.0.1:9999");
    // Tiket diteruskan ke ruang kerja lewat query — itu yang diperiksa proxy di
    // produksi.
    expect(lokasi).toContain("tiket=");
  });

  it("menolak 409 bila ruang kerja belum hidup", async () => {
    // Route ini **tidak** menyalakan ruang kerja; menyalakan adalah aksi
    // eksplisit lewat `/api/workspace`.
    statusManajer.nilai = { status: "ok", hidup: false, url: undefined };
    const res = await GET(minta(`?courseId=c1&tiket=${encodeURIComponent(tiket("u-1", "c1"))}`));
    expect(res.status).toBe(409);
  });

  it("menolak 409 bila manajer tidak tersedia", async () => {
    statusManajer.nilai = { status: "galat_manajer", hidup: false, url: undefined };
    const res = await GET(minta(`?courseId=c1&tiket=${encodeURIComponent(tiket("u-1", "c1"))}`));
    expect(res.status).toBe(409);
  });

  it("meneruskan respons rate limit apa adanya", async () => {
    batasRate.nilai = new Response("dibatasi", { status: 429 });
    const res = await GET(minta(`?courseId=c1&tiket=${encodeURIComponent(tiket("u-1", "c1"))}`));
    expect(res.status).toBe(429);
  });

  it("menolak 403 bila rahasia server belum diisi", async () => {
    // Fail-closed: rahasia kosong berarti **tidak ada** tiket yang sah.
    delete process.env.CAREEVO_WORKSPACE_SECRET;
    const res = await GET(minta(`?courseId=c1&tiket=${encodeURIComponent(tiket("u-1", "c1"))}`));
    expect(res.status).toBe(403);
  });

  it("tidak pernah mengembalikan alamat ruang kerja mentah di badan galat", async () => {
    // Badan galat dibaca di dalam iframe, jadi ia tidak boleh membocorkan port
    // internal mesin ini.
    const res = await GET(minta("?courseId=c1&tiket=palsu.palsu"));
    const teks = await res.text();
    expect(teks).not.toMatch(/127\.0\.0\.1:\d+/);
    expect(teks).not.toContain(RAHASIA);
  });

  it("meneruskan hostname permintaan ke manajer", async () => {
    // Supaya URL ruang kerja memakai origin yang sama dengan halaman yang
    // membukanya (`localhost` tetap `localhost`). Manajer yang memvalidasinya.
    await GET(new Request("http://localhost:3000/api/workspace/buka?courseId=c1&tiket=" + encodeURIComponent(tiket("u-1", "c1"))));
    expect(argumenStatus.nilai?.host).toBe("localhost");
  });
});
