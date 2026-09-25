import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integration test for `GET /p/[username]/berkas/[slot]`.
 *
 * Sama seperti `src/lib/resume/store.test.ts`, `CAREERS_DATA_DIR` dialihkan ke
 * temp dir **sebelum** modul dimuat supaya test tidak pernah menulis ke
 * `.data/` repo. Handler-nya sendiri mengimpor store (node:fs murni) tanpa
 * `next/server`, jadi bisa dipanggil langsung sebagai fungsi biasa.
 *
 * Modul pembatas di-mock. Penyebabnya bukan menghindari pengujian, melainkan
 * memisahkan dua properti yang berbeda: bagian pertama menguji perilaku
 * penyajian berkas yang sesungguhnya (store, header, isi byte), sedangkan
 * bagian terakhir menguji **penempatan dan akibat** pembatasan. Menjalankan
 * pembatas nyata di sini tidak menambah cakupan — yang diuji di
 * `src/lib/rate-limit/` adalah algoritmanya — tetapi menambah derau dan
 * ketergantungan pada urutan test.
 */
const mocks = vi.hoisted(() => ({ batasiRequestMasuk: vi.fn() }));

vi.mock("@/lib/rate-limit/next", () => ({
  batasiRequestMasuk: mocks.batasiRequestMasuk,
}));

const tmp = mkdtempSync(path.join(tmpdir(), "careevo-berkas-route-"));
process.env.CAREERS_DATA_DIR = tmp;

const { simpanBerkas, simpanResume } = await import("@/lib/resume/store");
const { resumeKosong } = await import("@/lib/resume/types");
const { GET } = await import("./route");

afterAll(() => rmSync(tmp, { recursive: true, force: true }));

beforeEach(() => {
  rmSync(tmp, { recursive: true, force: true });
  mocks.batasiRequestMasuk.mockReset();
  // Default: boleh lanjut, sehingga suite perilaku di bawah tidak terpengaruh.
  mocks.batasiRequestMasuk.mockResolvedValue(null);
});

const OWNER = "raka@careevo.test";
const USERNAME = "raka";
const PDF = new TextEncoder().encode("%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n");

/** Simpan profil + satu CV, lalu kembalikan nama berkasnya. */
async function siapkanCv(): Promise<void> {
  const meta = await simpanBerkas(OWNER, "cv", "CV Raka.pdf", PDF);
  const resume = resumeKosong(OWNER, USERNAME);
  await simpanResume({ ...resume, berkas: { ...resume.berkas, cv: meta } });
}

function panggil(
  slot: string,
  opsi: { username?: string; unduh?: boolean } = {},
): Promise<Response> {
  const username = opsi.username ?? USERNAME;
  const url = `http://localhost/p/${username}/berkas/${slot}${opsi.unduh ? "?unduh=1" : ""}`;
  return GET(new Request(url), { params: Promise.resolve({ username, slot }) });
}

describe("GET /p/[username]/berkas/[slot]", () => {
  it("mengembalikan 404 kalau profil tidak dikenal", async () => {
    await siapkanCv();

    const res = await panggil("cv", { username: "bukan-siapa" });

    expect(res.status).toBe(404);
  });

  it("mengembalikan 404 kalau slot tidak dikenal", async () => {
    // Slot di luar cv/portofolio tidak boleh menyentuh store sama sekali.
    const res = await panggil("rahasia");

    expect(res.status).toBe(404);
  });

  it("menyajikan PDF inline dengan nosniff", async () => {
    await siapkanCv();

    const res = await panggil("cv");

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    // Header eksplisit di handler ini adalah jaminan bahwa endpoint publik
    // yang memantulkan unggahan satu pengguna ke pengguna lain tidak pernah
    // di-sniff sebagai tipe lain, walau aturan global di next.config.ts
    // nanti berubah.
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Content-Disposition")).toContain("inline");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PDF);
  });

  it("memakai attachment saat ?unduh=1 dan membuang kutip dari nama", async () => {
    await siapkanCv();

    const res = await panggil("cv", { unduh: true });

    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    // Nama asli tidak boleh bisa menyuntik kutip ke dalam header.
    expect(res.headers.get("Content-Disposition")).not.toContain('""');
  });
});

/**
 * Pembatasan request pada endpoint publik tanpa autentikasi.
 *
 * Properti yang dijaga:
 *   1. Pembatasan **ada di dalam handler**, bukan hanya di `proxy.ts`. Matcher
 *      proxy dapat berubah (dan menurut dokumen Next 16, perubahan matcher juga
 *      melewati Server Action pada path itu), jadi handler ini tidak boleh
 *      bergantung padanya.
 *   2. Username yang menjadi kunci bucket sudah **di-decode**, supaya mengganti
 *      encoding (`user%40x` vs `user@x`) tidak menghasilkan bucket baru untuk
 *      target yang sama.
 *   3. Permintaan yang ditolak tidak pernah membaca store berkas.
 */
describe("GET /p/[username]/berkas/[slot] — pembatas permintaan", () => {
  it("membalas 429 tanpa menyentuh store berkas saat dibatasi", async () => {
    await siapkanCv();
    mocks.batasiRequestMasuk.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "Terlalu banyak permintaan." }), {
        status: 429,
        headers: { "Retry-After": "12" },
      }),
    );

    const res = await panggil("cv");

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("12");
    // Tidak ada byte berkas yang dibaca untuk request yang sudah ditolak.
    expect(res.headers.get("Content-Type")).not.toBe("application/pdf");
  });

  it("menegakkan batas di dalam handler, bukan hanya di proxy", async () => {
    await siapkanCv();

    await panggil("cv");

    expect(mocks.batasiRequestMasuk).toHaveBeenCalledWith(
      expect.anything(),
      "pdfPublik",
      { tambahan: `pdf:${USERNAME}` },
    );
  });

  it("menormalkan username dengan decode sebelum dijadikan kunci", async () => {
    // Adversarial: `user%40careevo.test` dan `user@careevo.test` menunjuk profil
    // yang sama. Tanpa decode, penyerang dapat mengganti encoding untuk mendapat
    // bucket baru bagi target yang sama.
    await panggil("cv", { username: "user%40careevo.test" });

    expect(mocks.batasiRequestMasuk).toHaveBeenCalledWith(
      expect.anything(),
      "pdfPublik",
      { tambahan: "pdf:user@careevo.test" },
    );
  });

  it("menjawab 404, bukan 500, saat segmen username tidak dapat di-decode", async () => {
    // `decodeURIComponent("%")` melempar. Sebelum dijaga, itu menjadi 500 pada
    // endpoint publik; sekarang harus 404 — dan bucket IP tetap tercatat lewat
    // `tambahan: undefined`, jadi request cacat pun tetap dihitung.
    const res = await panggil("cv", { username: "%" });

    expect(res.status).toBe(404);
    expect(mocks.batasiRequestMasuk).toHaveBeenCalledWith(
      expect.anything(),
      "pdfPublik",
      { tambahan: undefined },
    );
  });

  it("menolak slot tidak dikenal sebelum menjalankan pembatas", async () => {
    // Slot bukan cv/portofolio tidak dapat menyajikan apa pun, jadi tidak perlu
    // menghabiskan jatah pembatas untuknya.
    const res = await panggil("rahasia");

    expect(res.status).toBe(404);
    expect(mocks.batasiRequestMasuk).not.toHaveBeenCalled();
  });
});
