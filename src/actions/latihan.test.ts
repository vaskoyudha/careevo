import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as sessionModule from "@/lib/auth/session";
import type { SessionPayload } from "@/lib/auth/types";
import type { SoalLatihan } from "@/lib/latihan/types";

/**
 * Action-level tests for the answer-writing path.
 *
 * They exist because the store tests all write `sumber: "otomatis"` by hand and
 * never go through the action, which is how a real defect shipped: the card sent
 * `sumber: "diri"` for a self-assessed essay, the action ignored the field and
 * relabelled every stored verdict `otomatis`, and the verdict was silently lost
 * on reload. Driving the action is the only way to test that translation.
 *
 * `CAREERS_DATA_DIR` must be set **before** the store module is evaluated, so the
 * action is imported dynamically inside `beforeAll` rather than at the top of the
 * file where a static import would hoist above the assignment.
 */

let root: string;
let latihan: typeof import("./latihan");
let store: typeof import("@/lib/latihan/store");

const SESI: SessionPayload = {
  email: "user@careevo.test",
  nama: "User Demo",
  username: "userdemo",
  role: "user",
  iat: Math.floor(Date.now() / 1000),
};

function soal(id: string, tipe: SoalLatihan["tipe"]): SoalLatihan {
  const dasar = {
    id,
    pertanyaan: `Soal ${id}?`,
    jawaban: "true",
    pembahasan: "Karena benar.",
    tingkat: "medium" as const,
  };
  if (tipe === "choice") {
    return {
      ...dasar,
      tipe,
      pertanyaan: "Mana yang benar?",
      pilihan: { A: "Satu", B: "Dua", C: "Tiga", D: "Empat" },
      jawaban: "A",
    };
  }
  return { ...dasar, tipe };
}

function form(jawaban: string, extra: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("latihanId", latihanId);
  formData.set("soalId", soalId);
  formData.set("jawaban", jawaban);
  for (const [key, value] of Object.entries(extra)) formData.set(key, value);
  return formData;
}

let latihanId = "";
let soalId = "";

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "careevo-latihan-action-"));
  process.env.CAREERS_DATA_DIR = root;
  store = await import("@/lib/latihan/store");
  latihan = await import("./latihan");

  const dibuat = await store.createLatihan({
    owner: SESI.email,
    judul: "Latihan uji",
    topik: "Topik uji",
    tingkat: "medium",
    tipe: ["choice", "concept", "written"],
  });
  latihanId = dibuat.id;
  soalId = "g1";
  await store.saveSoal(dibuat, [soal("g1", "concept")], "stub");
});

afterAll(async () => {
  delete process.env.CAREERS_DATA_DIR;
  await rm(root, { recursive: true, force: true });
});

describe("catatJawabanAction", () => {
  it("menyimpan verdict otomatis apa adanya", async () => {
    vi.restoreAllMocks();
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(SESI);

    await latihan.catatJawabanAction(form("true", { benar: "true", sumber: "otomatis" }));

    const bundle = await store.getLatihan(SESI.email, latihanId);
    const attempt = bundle?.percobaan.find((item) => item.soalId === soalId);
    expect(attempt?.benar).toBe(true);
    expect(attempt?.sumber).toBe("otomatis");
  });

  it("menyimpan verdict penilaian mandiri sebagai `diri`, bukan `otomatis`", async () => {
    vi.restoreAllMocks();
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(SESI);

    await latihan.catatJawabanAction(form("uraianku", { benar: "false", sumber: "diri" }));

    const bundle = await store.getLatihan(SESI.email, latihanId);
    const attempt = bundle?.percobaan.find((item) => item.soalId === soalId);
    expect(attempt?.benar).toBe(false);
    expect(attempt?.sumber).toBe("diri");
  });

  it("menolak `juri` dari klien — hanya juri yang boleh mengaku juri", async () => {
    vi.restoreAllMocks();
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(SESI);

    await latihan.catatJawabanAction(form("pura-pura", { benar: "true", sumber: "juri" }));

    const bundle = await store.getLatihan(SESI.email, latihanId);
    const attempt = bundle?.percobaan.find((item) => item.soalId === soalId);
    expect(attempt?.sumber).not.toBe("juri");
    expect(attempt?.sumber).toBe("otomatis");
  });

  it("jawaban tanpa verdict tersimpan sebagai `belum`", async () => {
    vi.restoreAllMocks();
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(SESI);

    await latihan.catatJawabanAction(form("jawaban bebas"));

    const bundle = await store.getLatihan(SESI.email, latihanId);
    const attempt = bundle?.percobaan.find((item) => item.soalId === soalId);
    expect(attempt?.benar).toBeNull();
    expect(attempt?.sumber).toBe("belum");
  });

  it("tidak menulis apa pun tanpa sesi", async () => {
    vi.restoreAllMocks();
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(null);

    const sebelum = await store.getLatihan(SESI.email, latihanId);
    await latihan.catatJawabanAction(form("harus diabaikan", { benar: "true" }));
    const sesudah = await store.getLatihan(SESI.email, latihanId);

    expect(sesudah?.percobaan.find((item) => item.soalId === soalId)?.jawaban).toBe(
      sebelum?.percobaan.find((item) => item.soalId === soalId)?.jawaban,
    );
  });

  it("mengabaikan soalId yang tidak ada di latihan", async () => {
    vi.restoreAllMocks();
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(SESI);

    const formData = form("x", { soalId: "tidak-ada" });
    await latihan.catatJawabanAction(formData);

    const bundle = await store.getLatihan(SESI.email, latihanId);
    expect(bundle?.percobaan.some((item) => item.soalId === "tidak-ada")).toBe(false);
  });
});
