import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Integration test for `GET /p/[username]/berkas/[slot]`.
 *
 * Sama seperti `src/lib/resume/store.test.ts`, `CAREERS_DATA_DIR` dialihkan ke
 * temp dir **sebelum** modul dimuat supaya test tidak pernah menulis ke
 * `.data/` repo. Handler-nya sendiri hanya mengimpor store (node:fs murni),
 * tanpa `next/server`, jadi bisa dipanggil langsung sebagai fungsi biasa.
 */

const tmp = mkdtempSync(path.join(tmpdir(), "careevo-berkas-route-"));
process.env.CAREERS_DATA_DIR = tmp;

const { simpanBerkas, simpanResume } = await import("@/lib/resume/store");
const { resumeKosong } = await import("@/lib/resume/types");
const { GET } = await import("./route");

afterAll(() => rmSync(tmp, { recursive: true, force: true }));

beforeEach(() => {
  rmSync(tmp, { recursive: true, force: true });
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
