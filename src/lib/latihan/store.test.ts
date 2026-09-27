import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LatihanBundle, SoalLatihan } from "./types";
import { TOKEN_ISIAN } from "./tipe-soal";

/**
 * Owner isolation is the security property of this store, so it is tested
 * directly rather than inferred. `CAREERS_DATA_DIR` is set **before** the
 * module is imported — a static import would be hoisted above the assignment
 * and every test would write into the repo's real `.data/`.
 */

let root: string;
let store: typeof import("./store");

const PEMILIK_A = "a@careevo.test";
const PEMILIK_B = "b@careevo.test";

function soal(id: string, tipe: SoalLatihan["tipe"] = "concept"): SoalLatihan {
  return {
    id,
    tipe,
    pertanyaan: `Soal ${id}?`,
    jawaban: "true",
    pembahasan: "Karena benar.",
    tingkat: "medium",
  };
}

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "careevo-latihan-"));
  process.env.CAREERS_DATA_DIR = root;
  store = await import("./store");
});

afterAll(async () => {
  delete process.env.CAREERS_DATA_DIR;
  await rm(root, { recursive: true, force: true });
});

async function buatPemilik(owner: string, soalAwal: SoalLatihan[] = [soal("s1")]) {
  const latihan = await store.createLatihan({
    owner,
    judul: "Latihan uji",
    topik: "Topik",
    tingkat: "medium",
    tipe: ["concept"],
  });
  await store.saveSoal(latihan, soalAwal, "stub");
  return latihan;
}

describe("owner isolation", () => {
  it("gives each owner a separate directory keyed by a hash of the email", async () => {
    const a = await buatPemilik(PEMILIK_A);
    const b = await buatPemilik(PEMILIK_B);

    // The same email in different cases is the same owner.
    const aFolded = await store.createLatihan({
      owner: PEMILIK_A.toUpperCase(),
      judul: "Latihan uji",
      topik: "Topik",
      tingkat: "medium",
      tipe: ["concept"],
    });

    expect(a.id).not.toBe(b.id);
    expect((await store.getLatihan(PEMILIK_A, a.id))?.latihan.owner).toBe(
      PEMILIK_A.toLowerCase(),
    );
    expect((await store.getLatihan(PEMILIK_A, aFolded.id))?.latihan.owner).toBe(
      PEMILIK_A.toLowerCase(),
    );
  });

  // A 403 here would confirm the id exists, which is itself the leak.
  it("returns null, not somebody else's bundle, for a foreign id", async () => {
    const milikA = await buatPemilik(PEMILIK_A);
    expect(await store.getLatihan(PEMILIK_B, milikA.id)).toBeNull();
  });

  it("does not list another owner's latihan", async () => {
    const milikA = await buatPemilik(PEMILIK_A);
    const milikB = await buatPemilik(PEMILIK_B);
    const idsB = (await store.listLatihan(PEMILIK_B)).map((item) => item.id);
    expect(idsB).toContain(milikB.id);
    expect(idsB).not.toContain(milikA.id);
  });

  it("refuses to record an attempt against another owner's latihan", async () => {
    const milikA = await buatPemilik(PEMILIK_A);
    const hasil = await store.recordAttempt(PEMILIK_B, milikA.id, {
      soalId: "s1",
      jawaban: "true",
      benar: true,
      sumber: "otomatis",
      at: new Date().toISOString(),
    });
    expect(hasil).toBeNull();
    expect((await store.getLatihan(PEMILIK_A, milikA.id))?.percobaan).toHaveLength(0);
  });

  it("refuses to delete another owner's latihan", async () => {
    const milikA = await buatPemilik(PEMILIK_A);
    expect(await store.deleteLatihan(PEMILIK_B, milikA.id)).toBe(false);
    expect(await store.getLatihan(PEMILIK_A, milikA.id)).not.toBeNull();
  });
});

describe("id handling", () => {
  // Ids arrive from the URL, so traversal has to fail at the boundary.
  it.each(["../escape", "a/b", "..", ".", "with space", "UPPERCASE1234", "x".repeat(20)])(
    "rejects %s as a latihan id",
    async (id) => {
      expect(await store.getLatihan(PEMILIK_A, id)).toBeNull();
      expect(await store.deleteLatihan(PEMILIK_A, id)).toBe(false);
      expect(await store.recordAttempt(PEMILIK_A, id, {
        soalId: "s1",
        jawaban: "x",
        benar: true,
        sumber: "otomatis",
        at: new Date().toISOString(),
      })).toBeNull();
    },
  );

  it("never writes outside the owner directory", async () => {
    const latihan = await buatPemilik(PEMILIK_A);
    expect(await store.getLatihan(PEMILIK_A, latihan.id)).not.toBeNull();
    const dirs = await readdir(path.join(root, "latihan"));
    expect(dirs.length).toBeGreaterThan(0);
    for (const dir of dirs) {
      expect(dir).toMatch(/^[a-f0-9]{32}$/);
    }
  });
});

describe("attempts", () => {
  it("upserts by question rather than appending", async () => {
    const latihan = await buatPemilik(PEMILIK_A, [soal("s1"), soal("s2")]);

    await store.recordAttempt(PEMILIK_A, latihan.id, {
      soalId: "s1",
      jawaban: "salah",
      benar: false,
      sumber: "otomatis",
      at: "2026-09-25T00:00:00.000Z",
    });
    await store.recordAttempt(pemilikLower(), latihan.id, {
      soalId: "s1",
      jawaban: "true",
      benar: true,
      sumber: "otomatis",
      at: "2026-09-25T01:00:00.000Z",
    });

    const bundle = await store.getLatihan(PEMILIK_A, latihan.id);
    expect(bundle?.percobaan).toHaveLength(1);
    expect(bundle?.percobaan[0].jawaban).toBe("true");
    expect(bundle?.percobaan[0].benar).toBe(true);
  });

  function pemilikLower() {
    return PEMILIK_A;
  }

  it("keeps attempts for different questions side by side", async () => {
    const latihan = await buatPemilik(PEMILIK_A, [soal("s1"), soal("s2")]);
    for (const id of ["s1", "s2"]) {
      await store.recordAttempt(PEMILIK_A, latihan.id, {
        soalId: id,
        jawaban: "true",
        benar: true,
        sumber: "otomatis",
        at: new Date().toISOString(),
      });
    }
    expect((await store.getLatihan(PEMILIK_A, latihan.id))?.percobaan).toHaveLength(2);
  });

  // Otherwise one crafted request could grow the file without bound, with rows
  // no question could ever read back.
  it("rejects an attempt for a question this latihan does not have", async () => {
    const latihan = await buatPemilik(PEMILIK_A, [soal("s1")]);
    const hasil = await store.recordAttempt(PEMILIK_A, latihan.id, {
      soalId: "tidak-ada",
      jawaban: "x",
      benar: true,
      sumber: "otomatis",
      at: new Date().toISOString(),
    });
    expect(hasil).toBeNull();
  });

  it("serialises concurrent attempts without dropping any", async () => {
    const ids = ["s1", "s2", "s3", "s4", "s5"];
    const latihan = await buatPemilik(PEMILIK_A, ids.map((id) => soal(id)));

    await Promise.all(
      ids.map((soalId) =>
        store.recordAttempt(PEMILIK_A, latihan.id, {
          soalId,
          jawaban: "true",
          benar: true,
          sumber: "otomatis",
          at: new Date().toISOString(),
        }),
      ),
    );

    const bundle = await store.getLatihan(PEMILIK_A, latihan.id);
    expect(bundle?.percobaan).toHaveLength(ids.length);
  });

  it("clears every attempt on reset but keeps the questions", async () => {
    const latihan = await buatPemilik(PEMILIK_A, [soal("s1")]);
    await store.recordAttempt(PEMILIK_A, latihan.id, {
      soalId: "s1",
      jawaban: "true",
      benar: true,
      sumber: "otomatis",
      at: new Date().toISOString(),
    });
    const setelah = await store.resetAttempts(PEMILIK_A, latihan.id);
    expect(setelah?.percobaan).toHaveLength(0);
    expect(setelah?.soal).toHaveLength(1);
  });
});

describe("reading untrusted files", () => {
  async function tulisBundle(mutate: (bundle: LatihanBundle) => void) {
    const latihan = await buatPemilik(PEMILIK_A, [soal("s1")]);
    const bundle = (await store.getLatihan(PEMILIK_A, latihan.id))!;
    mutate(bundle);
    const file = path.join(root, "latihan", ownerDirFor(PEMILIK_A), `${latihan.id}.json`);
    await writeFile(file, `${JSON.stringify({ version: 1, bundle })}\n`, "utf8");
    return latihan;
  }

  /**
   * The owner directory name, computed the way the store computes it.
   *
   * The test derives it independently on purpose: if it reused the store's own
   * helper, a change to the derivation would move both sides together and the
   * test would keep passing while the property it names no longer held.
   */
  function ownerDirFor(owner: string): string {
    const hash = createHash("sha256").update(owner.trim().toLowerCase()).digest("hex").slice(0, 32);
    return hash;
  }

  // The directory is the only thing scoping a lookup, so a file whose owner
  // field disagrees with its directory must be ignored rather than surfaced.
  it("ignores a file whose owner disagrees with its directory", async () => {
    const latihan = await tulisBundle((bundle) => {
      bundle.latihan.owner = "orang-lain@careevo.test";
    });
    expect(await store.getLatihan(PEMILIK_A, latihan.id)).toBeNull();
  });

  it("ignores a file with an unknown version", async () => {
    const latihan = await buatPemilik(PEMILIK_A);
    const file = path.join(root, "latihan", ownerDirFor(PEMILIK_A), `${latihan.id}.json`);
    const raw = JSON.parse(await readFile(file, "utf8"));
    await writeFile(file, JSON.stringify({ ...raw, version: 2 }), "utf8");
    expect(await store.getLatihan(PEMILIK_A, latihan.id)).toBeNull();
  });

  it("ignores a file whose question lost its options", async () => {
    // Written by hand rather than through `saveSoal`, because a question with
    // no options is exactly what the store would refuse to write.
    const latihan = await store.createLatihan({
      owner: PEMILIK_A,
      judul: "Pilihan rusak",
      topik: "T",
      tingkat: "medium",
      tipe: ["choice"],
    });
    const bundle: LatihanBundle = {
      latihan: { ...latihan, disusunOleh: "stub" },
      soal: [
        {
          id: "s1",
          tipe: "choice",
          pertanyaan: "Mana?",
          jawaban: "A",
          pembahasan: "K.",
          tingkat: "medium",
        },
      ],
      percobaan: [],
    };
    const file = path.join(root, "latihan", ownerDirFor(PEMILIK_A), `${latihan.id}.json`);

    // Valid once the options are present.
    const denganPilihan: LatihanBundle = {
      ...bundle,
      soal: [{ ...bundle.soal[0], pilihan: { A: "a", B: "b", C: "c", D: "d" } }],
    };
    await writeFile(file, JSON.stringify({ version: 1, bundle: denganPilihan }), "utf8");
    expect(await store.getLatihan(PEMILIK_A, latihan.id)).not.toBeNull();

    // A choice with no options is unrenderable, so the guard rejects it.
    await writeFile(file, JSON.stringify({ version: 1, bundle }), "utf8");
    expect(await store.getLatihan(PEMILIK_A, latihan.id)).toBeNull();
  });

  it("ignores a corrupt file instead of throwing", async () => {
    const latihan = await buatPemilik(PEMILIK_A);
    const file = path.join(root, "latihan", ownerDirFor(PEMILIK_A), `${latihan.id}.json`);
    await writeFile(file, "{ not json", "utf8");
    expect(await store.getLatihan(PEMILIK_A, latihan.id)).toBeNull();
  });

  it("skips non-json files while listing", async () => {
    await buatPemilik(PEMILIK_A);
    const file = path.join(root, "latihan", ownerDirFor(PEMILIK_A), "catatan.txt");
    await writeFile(file, "bukan latihan", "utf8");
    const hasil = await store.listLatihan(PEMILIK_A);
    expect(hasil.every((item) => item.id !== "catatan")).toBe(true);
  });
});

describe("listLatihan", () => {
  it("returns newest first", async () => {
    const owner = "urut@careevo.test";
    const pertama = await store.createLatihan({
      owner,
      judul: "Pertama",
      topik: "T",
      tingkat: "easy",
      tipe: ["choice"],
    });
    const kedua = await store.createLatihan({
      owner,
      judul: "Kedua",
      topik: "T",
      tingkat: "hard",
      tipe: ["choice"],
    });
    // Force a known order rather than relying on same-millisecond timestamps.
    const bundle = (await store.getLatihan(owner, kedua.id))!;
    bundle.latihan.updatedAt = "2999-01-01T00:00:00.000Z";
    const hash = createHash("sha256").update(owner).digest("hex").slice(0, 32);
    await writeFile(
      path.join(root, "latihan", hash, `${kedua.id}.json`),
      JSON.stringify({ version: 1, bundle }),
      "utf8",
    );

    const hasil = await store.listLatihan(owner);
    expect(hasil[0].id).toBe(kedua.id);
    expect(hasil.map((item) => item.id)).toContain(pertama.id);
  });

  it("returns an empty list for an owner with no directory", async () => {
    expect(await store.listLatihan("tidak-ada@careevo.test")).toEqual([]);
  });
});

describe("discards an empty question set", () => {
  it("still writes the record, so a failed generation can be retried", async () => {
    const latihan = await store.createLatihan({
      owner: "kosong@careevo.test",
      judul: "Kosong",
      topik: "T",
      tingkat: "medium",
      tipe: ["choice"],
    });
    const bundle = await store.saveSoal(latihan, [], "stub");
    expect(bundle.soal).toHaveLength(0);
    // The action is what deletes this record; the store does not decide.
    expect((await store.getLatihan("kosong@careevo.test", latihan.id))?.soal).toHaveLength(0);
  });
});

describe("preserves the fill-in-the-blank token through a round trip", () => {
  it("keeps the question and answer intact", async () => {
    const owner = "isian@careevo.test";
    const latihan = await buatPemilik(owner, []);
    const withBlank: SoalLatihan = {
      id: "blank-1",
      tipe: "fill_in_blank",
      pertanyaan: `Pakai ${TOKEN_ISIAN} di sini.`,
      jawaban: "useEffect",
      pembahasan: "Hook.",
      tingkat: "easy",
    };
    await store.saveSoal(latihan, [withBlank], "stub");
    const bundle = await store.getLatihan(owner, latihan.id);
    expect(bundle?.soal[0].pertanyaan).toContain(TOKEN_ISIAN);
    expect(bundle?.soal[0].jawaban).toBe("useEffect");
  });
});
