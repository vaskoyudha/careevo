import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

/** `CAREERS_DATA_DIR` harus ada sebelum toko diimpor — path dibentuk saat impor. */
const AKAR = await mkdtemp(path.join(tmpdir(), "careevo-jejak-capture-"));
process.env.CAREERS_DATA_DIR = AKAR;

const { catatJejakSekarang, resetJejak, JENDELA_JEJAK_MS } = await import(
  "./jejak-capture"
);
const { bacaSnapshot } = await import("./jejak-store");
const { hitungJejak } = await import("./proses");

afterAll(async () => {
  await rm(AKAR, { recursive: true, force: true });
});

beforeEach(async () => {
  resetJejak();
  await rm(path.join(AKAR, "workspace-jejak"), { recursive: true, force: true });
});

const USER = "11111111-1111-4111-8111-111111111111";
const COURSE = "crs-uji";

/** Port palsu yang mengembalikan keluaran `find` yang diberikan. */
function portPalsu(hasil: Array<string | null>) {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    async daftarBerkas(): Promise<string | null> {
      const nilai = hasil[Math.min(calls, hasil.length - 1)] ?? null;
      calls += 1;
      return nilai;
    },
  };
}

describe("catatJejakSekarang", () => {
  it("menulis snapshot pertama", async () => {
    const port = portPalsu(["100\ta.cpp"]);
    expect(
      await catatJejakSekarang(USER, COURSE, { port, sekarang: Date.parse("2026-10-03T10:00:00Z") }),
    ).toBe(true);

    const hasil = await bacaSnapshot(USER, COURSE);
    expect(hasil).toHaveLength(1);
    expect(hasil[0]!.ringkasan.berkas).toEqual([{ path: "a.cpp", ukuran: 100 }]);
  });

  it("jendela waktu menahan proses find yang berulang", async () => {
    // Tanpa pagar waktu, polling `status` akan membangkitkan satu proses
    // container per request — dan jejaknya jadi didominasi baris identik.
    const port = portPalsu(["100\ta.cpp"]);
    const t0 = Date.parse("2026-10-03T10:00:00Z");

    expect(await catatJejakSekarang(USER, COURSE, { port, sekarang: t0 })).toBe(true);
    // 1 menit kemudian: di dalam jendela, jadi tidak memanggil `find` sama sekali.
    expect(await catatJejakSekarang(USER, COURSE, { port, sekarang: t0 + 60_000 })).toBe(false);
    expect(port.calls).toBe(1);

    // Setelah jendela lewat: capture lagi.
    expect(
      await catatJejakSekarang(USER, COURSE, { port, sekarang: t0 + JENDELA_JEJAK_MS + 1 }),
    ).toBe(true);
    expect(port.calls).toBe(2);
  });

  it("ruang kerja berbeda tidak saling memblokir", async () => {
    // Pagar waktunya per ruang kerja, bukan global: satu course yang sedang
    // aktif tidak boleh menghentikan jejak course lain.
    const port = portPalsu(["100\ta.cpp"]);
    const t0 = Date.parse("2026-10-03T10:00:00Z");
    expect(await catatJejakSekarang(USER, "course-a", { port, sekarang: t0 })).toBe(true);
    expect(await catatJejakSekarang(USER, "course-b", { port, sekarang: t0 })).toBe(true);
    expect(port.calls).toBe(2);
  });

  it("daftar berkas null tidak ditulis sebagai snapshot kosong", async () => {
    // `null` berarti "tidak diamati", bukan "tidak ada berkasnya". Menuliskannya
    // sebagai snapshot kosong akan menghapus seluruh jejak yang sudah terkumpul.
    const port = portPalsu([null]);
    expect(
      await catatJejakSekarang(USER, COURSE, { port, sekarang: Date.parse("2026-10-03T10:00:00Z") }),
    ).toBe(false);
    expect(await bacaSnapshot(USER, COURSE)).toHaveLength(0);
  });

  it("galat dari port ditelan, alur Capture tidak gagal", async () => {
    const port = {
      async daftarBerkas(): Promise<string | null> {
        throw new Error("manajer mati");
      },
    };
    await expect(
      catatJejakSekarang(USER, COURSE, { port, sekarang: Date.parse("2026-10-03T10:00:00Z") }),
    ).resolves.toBe(false);
  });

  it("snapshot berubah setelah jendela menghasilkan jejak yang bisa dihitung", async () => {
    const port = portPalsu(["100\ta.cpp", "180\ta.cpp"]);
    const t0 = Date.parse("2026-10-03T10:00:00Z");

    await catatJejakSekarang(USER, COURSE, { port, sekarang: t0 });
    await catatJejakSekarang(USER, COURSE, {
      port,
      sekarang: t0 + JENDELA_JEJAK_MS + 1,
    });

    const ringkas = hitungJejak(await bacaSnapshot(USER, COURSE));
    expect(ringkas.observasi).toBe(2);
    expect(ringkas.jejak[0]).toMatchObject({ path: "a.cpp", perubahan: 1 });
  });

  it("jendela absurd jatuh ke bawaan, bukan membuat capture terus-menerus", async () => {
    // `NaN` atau negatif berarti "pagar tidak berlaku"; membiarkan itu lewat
    // akan mengubah pagar waktu jadi tidak ada sama sekali.
    const port = portPalsu(["100\ta.cpp"]);
    const t0 = Date.parse("2026-10-03T10:00:00Z");
    await catatJejakSekarang(USER, COURSE, { port, sekarang: t0 });
    await catatJejakSekarang(USER, COURSE, { port, sekarang: t0 + 1, jendelaMs: -5 });
    expect(port.calls).toBe(1);
  });
});

describe("resetJejak", () => {
  it("memaksa capture berikutnya", async () => {
    const port = portPalsu(["100\ta.cpp"]);
    const t0 = Date.parse("2026-10-03T10:00:00Z");
    await catatJejakSekarang(USER, COURSE, { port, sekarang: t0 });
    resetJejak();
    expect(await catatJejakSekarang(USER, COURSE, { port, sekarang: t0 + 1 })).toBe(true);
  });
});