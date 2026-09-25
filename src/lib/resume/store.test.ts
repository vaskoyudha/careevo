import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Integration test for the file-based resume store.
 *
 * `CAREERS_DATA_DIR` is redirected to a throwaway temp directory *before* the
 * store is imported, so the test never touches the repo's real `.data/`. Each
 * test starts from a clean directory so runs are independent.
 */

const tmp = mkdtempSync(path.join(tmpdir(), "careevo-resume-"));
process.env.CAREERS_DATA_DIR = tmp;

const {
  ambilResume,
  ambilResumeAtauNull,
  ambilResumeByUsername,
  simpanResume,
  simpanBerkas,
  ambilBerkas,
  hapusBerkas,
} = await import("@/lib/resume/store");
const { resumeKosong, slugBerkas, validasiBerkas } = await import("@/lib/resume/types");

afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const OWNER = "raka@careevo.test";

beforeEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("resume store", () => {
  it("returns an empty resume when nothing is stored", async () => {
    const r = await ambilResume(OWNER);
    expect(r.owner).toBe(OWNER);
    expect(r.pengalaman).toEqual([]);
    expect(r.berkas.cv).toBeNull();
  });

  it("ambilResumeAtauNull is null when nothing is stored", async () => {
    expect(await ambilResumeAtauNull(OWNER)).toBeNull();
  });

  it("round-trips a saved resume", async () => {
    const r = resumeKosong(OWNER, "raka");
    r.headline = "Frontend developer";
    r.pengalaman.push({
      id: "e1",
      jabatan: "Frontend Developer",
      perusahaan: "Acme",
      periode: "2024 — Sekarang",
      lokasi: "Jakarta",
      deskripsi: "Bangun UI.",
    });

    await simpanResume(r);
    const read = await ambilResume(OWNER);

    expect(read.headline).toBe("Frontend developer");
    expect(read.pengalaman).toHaveLength(1);
    expect(read.pengalaman[0].perusahaan).toBe("Acme");
    expect(read.updatedAt).not.toBe(new Date(0).toISOString());
  });

  it("normalizes owner and strips @ from username", async () => {
    await simpanResume({ ...resumeKosong("  RAKA@careevo.test ", "@Raka"), username: "@Raka" });
    const read = await ambilResume("raka@careevo.test");
    expect(read.owner).toBe("raka@careevo.test");
    expect(read.username).toBe("Raka");
  });

  it("resolves a public profile by username", async () => {
    await simpanResume(resumeKosong(OWNER, "raka"));
    const found = await ambilResumeByUsername("@raka");
    expect(found?.owner).toBe(OWNER);
    expect(await ambilResumeByUsername("tidakada")).toBeNull();
  });

  it("stops resolving a username after the handle changes", async () => {
    await simpanResume(resumeKosong(OWNER, "raka"));
    // Rename: the old index entry must no longer resolve.
    await simpanResume(resumeKosong(OWNER, "raka-baru"));
    expect(await ambilResumeByUsername("raka")).toBeNull();
    expect((await ambilResumeByUsername("raka-baru"))?.owner).toBe(OWNER);
  });

  it("stores and reads an uploaded file", async () => {
    const bytes = new Uint8Array([37, 80, 68, 70]); // "%PDF"
    const meta = await simpanBerkas(OWNER, "cv", "CV Raka.pdf", bytes);
    expect(meta.nama).toMatch(/^cv-\d+-[0-9a-f]+\.pdf$/);
    expect(meta.namaAsli).toBe("CV Raka.pdf");
    expect(meta.ukuran).toBe(4);

    const back = await ambilBerkas(OWNER, meta.nama);
    expect(back).toEqual(Buffer.from(bytes));
  });

  it("replaces a previous file for the same slot (no orphans)", async () => {
    const first = await simpanBerkas(OWNER, "cv", "a.pdf", new Uint8Array([1]));
    const second = await simpanBerkas(OWNER, "cv", "b.pdf", new Uint8Array([2]));
    expect(second.nama).not.toBe(first.nama);
    expect(await ambilBerkas(OWNER, first.nama)).toBeNull();
    expect(await ambilBerkas(OWNER, second.nama)).toEqual(Buffer.from(new Uint8Array([2])));
  });

  it("refuses a path-traversal file name", async () => {
    await expect(ambilBerkas(OWNER, "../../etc/passwd")).rejects.toThrow();
    await expect(hapusBerkas(OWNER, "../secret")).rejects.toThrow();
  });

  it("does not leak files across owners", async () => {
    const meta = await simpanBerkas(OWNER, "cv", "cv.pdf", new Uint8Array([9]));
    expect(await ambilBerkas("lain@careevo.test", meta.nama)).toBeNull();
  });
});

describe("slugBerkas", () => {
  it("slugifies an Indonesian file name", () => {
    expect(slugBerkas("CV Raka Pratama.pdf")).toBe("cv-raka-pratama");
  });
  it("falls back when nothing Latin survives", () => {
    expect(slugBerkas("日本語")).toBe("berkas");
  });
});

describe("validasiBerkas", () => {
  const pdf = new Uint8Array([37, 80, 68, 70, 45, 49]); // "%PDF-1"

  it("accepts a real PDF", () => {
    expect(validasiBerkas({ size: pdf.byteLength, type: "application/pdf", bytes: pdf })).toEqual({
      ok: true,
    });
  });

  it("accepts a missing MIME type when the magic bytes are right", () => {
    // Some browsers send an empty `type`; magic bytes are the real check.
    expect(validasiBerkas({ size: pdf.byteLength, type: "", bytes: pdf }).ok).toBe(true);
  });

  it("rejects an empty upload", () => {
    const r = validasiBerkas({ size: 0, type: "application/pdf", bytes: new Uint8Array([]) });
    expect(r.ok).toBe(false);
  });

  it("rejects an over-size upload even with valid bytes", () => {
    const r = validasiBerkas({
      size: 5 * 1024 * 1024 + 1,
      type: "application/pdf",
      bytes: pdf,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects a non-PDF MIME type", () => {
    const r = validasiBerkas({ size: pdf.byteLength, type: "image/png", bytes: pdf });
    expect(r.ok).toBe(false);
  });

  it("rejects a file that lies about its type (wrong magic bytes)", () => {
    // Declares PDF + is small, but is really a PNG — the bypass accept= allows.
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]);
    const r = validasiBerkas({ size: png.byteLength, type: "application/pdf", bytes: png });
    expect(r.ok).toBe(false);
  });
});
