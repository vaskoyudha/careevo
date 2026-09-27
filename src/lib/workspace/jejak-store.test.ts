import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Direktori sementara harus ada **sebelum** modul toko diimpor: toko membaca
 * `CAREERS_DATA_DIR` saat path dibentuk, jadi mengaturnya di dalam test akan
 * datang terlambat (pola yang sama dengan `store.test.ts` di `resume`).
 */
const AKAR = await mkdtemp(path.join(tmpdir(), "careevo-jejak-"));
process.env.CAREERS_DATA_DIR = AKAR;

const { bacaSnapshot, barisSnapshot, pathJejak, tambahSnapshot } = await import(
  "./jejak-store"
);
const { hitungJejak } = await import("./proses");

afterAll(async () => {
  await rm(AKAR, { recursive: true, force: true });
});

const USER = "11111111-1111-4111-8111-111111111111";
const COURSE = "crs-uji";

function snap(at: string, berkas: Array<[string, number]>, terpotong = false) {
  return {
    at,
    ringkasan: {
      berkas: berkas.map(([p, ukuran]) => ({ path: p, ukuran })),
      terpotong,
      total: berkas.length,
    },
  };
}

beforeEach(async () => {
  // Direktori per-test, supaya test tidak saling membaca jejak.
  await rm(path.join(AKAR, "workspace-jejak"), { recursive: true, force: true });
});

/**
 * Tulis isi mentah ke berkas jejak, membuat direktorinya lebih dulu.
 *
 * Dipakai test ketahanan: sebagian besar kegagalan baca yang realistis terjadi
 * karena file sudah ada lalu isinya rusak, dan file tidak bisa ada tanpa
 * direktorinya.
 */
async function tulisMentah(isi: string): Promise<void> {
  const berkas = pathJejak(USER, COURSE);
  await mkdir(path.dirname(berkas), { recursive: true });
  await writeFile(berkas, isi, "utf8");
}

describe("pathJejak", () => {
  it("menolak identitas kosong", async () => {
    await expect(async () => pathJejak("", COURSE)).rejects.toThrow();
    await expect(async () => pathJejak(USER, "")).rejects.toThrow();
  });

  it("menyandai segment supaya tidak bisa keluar dari akar data", () => {
    // Yang dijaga adalah **hasil resolusi path-nya**, bukan kebetulan tidak
    // mengandung karakter. `../../etc` disandi menjadi `.._.._etc` — satu nama
    // direktori yang sah; yang penting path hasil resolusi tetap di dalam akar data.
    const p = pathJejak("../../etc", "../../passwd");
    const relatif = path.relative(path.resolve(AKAR, "workspace-jejak"), path.resolve(p));
    expect(relatif.split(path.sep)).toHaveLength(3);
    expect(relatif.endsWith(path.join("snapshots.jsonl"))).toBe(true);
  });
});

describe("bacaSnapshot", () => {
  it("ruang kerja yang belum pernah diamati menghasilkan array kosong", async () => {
    expect(await bacaSnapshot(USER, "course-baru")).toEqual([]);
  });
});

describe("tambahSnapshot", () => {
  it("menulis dan membaca balik snapshot", async () => {
    expect(await tambahSnapshot(USER, COURSE, snap("2026-10-03T10:00:00.000Z", [["a.cpp", 10]]))).toBe(
      true,
    );
    const hasil = await bacaSnapshot(USER, COURSE);
    expect(hasil).toHaveLength(1);
    expect(hasil[0]).toMatchObject({ at: "2026-10-03T10:00:00.000Z" });
    expect(hasil[0]!.ringkasan.berkas).toEqual([{ path: "a.cpp", ukuran: 10 }]);
  });

  it("snapshot identik dengan yang terakhir tidak menambah baris", async () => {
    const s = snap("2026-10-03T10:00:00.000Z", [["a.cpp", 10]]);
    expect(await tambahSnapshot(USER, COURSE, s)).toBe(true);
    expect(await tambahSnapshot(USER, COURSE, s)).toBe(false);
    expect(await bacaSnapshot(USER, COURSE)).toHaveLength(1);
  });

  it("snapshot berbeda pada waktu sama tetap ditulis", async () => {
    // Dua capture pada detik yang sama dengan isi berbeda itu perubahan nyata.
    await tambahSnapshot(USER, COURSE, snap("2026-10-03T10:00:00.000Z", [["a.cpp", 10]]));
    expect(
      await tambahSnapshot(USER, COURSE, snap("2026-10-03T10:00:00.000Z", [["a.cpp", 90]])),
    ).toBe(true);
    expect(await bacaSnapshot(USER, COURSE)).toHaveLength(2);
  });

  it("memotong baris terlama, bukan yang terbaru", async () => {
    // Jejak yang tumbuh tak terbatas adalah risiko sumber daya, jadi baris paling
    // lama yang dibuang — dan itu yang menguji arah pemotongannya.
    for (let i = 1; i <= 5; i += 1) {
      await tambahSnapshot(
        USER,
        COURSE,
        snap(`2026-10-03T10:0${i}:00.000Z`, [["a.cpp", i * 10]]),
        3,
      );
    }
    const hasil = await bacaSnapshot(USER, COURSE);
    expect(hasil).toHaveLength(3);
    expect(hasil.map((s) => s.at)).toEqual([
      "2026-10-03T10:03:00.000Z",
      "2026-10-03T10:04:00.000Z",
      "2026-10-03T10:05:00.000Z",
    ]);
  });

  it("berkas yang diabaikan tidak masuk lewat jalur baca", async () => {
    // Jejak harus tunduk pada aturan penyaringan yang sama dengan snapshot
    // submission: `node_modules` bukan karya peserta.
    await tambahSnapshot(
      USER,
      COURSE,
      snap("2026-10-03T10:00:00.000Z", [
        ["a.cpp", 10],
        ["node_modules/x/index.js", 999],
      ]),
    );
    const hasil = await bacaSnapshot(USER, COURSE);
    expect(hasil[0]!.ringkasan.berkas).toEqual([{ path: "a.cpp", ukuran: 10 }]);
  });

  it("path absolut dibuang, bukan ikut tersimpan", async () => {
    await tambahSnapshot(
      USER,
      COURSE,
      snap("2026-10-03T10:00:00.000Z", [
        ["a.cpp", 10],
        ["/etc/passwd", 20],
      ]),
    );
    const hasil = await bacaSnapshot(USER, COURSE);
    expect(hasil[0]!.ringkasan.berkas.map((b) => b.path)).toEqual(["a.cpp"]);
  });

  it("mempertahankan penanda terpotong saat dibaca kembali", async () => {
    // Kalau `terpotong` hilang saat rekonstruksi, jejak akan tampak lengkap
    // padahal ada berkas yang tidak pernah terekam.
    await tambahSnapshot(USER, COURSE, snap("2026-10-03T10:00:00.000Z", [["a.cpp", 10]], true));
    const hasil = await bacaSnapshot(USER, COURSE);
    expect(hasil[0]!.ringkasan.terpotong).toBe(true);
    expect(hitungJejak(hasil).adaTerpotong).toBe(true);
  });

  it("ruang kerja berbeda tidak saling membaca", async () => {
    await tambahSnapshot(USER, "course-a", snap("2026-10-03T10:00:00.000Z", [["a.cpp", 1]]));
    await tambahSnapshot(USER, "course-b", snap("2026-10-03T10:00:00.000Z", [["b.cpp", 2]]));
    const a = await bacaSnapshot(USER, "course-a");
    expect(a[0]!.ringkasan.berkas.map((b) => b.path)).toEqual(["a.cpp"]);
  });
});

describe("ketahanan baca", () => {
  it("baris rusak dibuang, baris yang baik tetap terbaca", async () => {
    // Penulisan yang terputus sebagian harus tetap menghasilkan jejak yang
    // berguna — jejak yang berhenti di baris ke-2 lebih baik dari tidak ada.
    await tulisMentah(
      [
        barisSnapshot(snap("2026-10-03T10:00:00.000Z", [["a.cpp", 10]])),
        "{ ini bukan json",
        barisSnapshot(snap("2026-10-03T10:05:00.000Z", [["a.cpp", 20]])),
      ].join("\n"),
    );

    const hasil = await bacaSnapshot(USER, COURSE);
    expect(hasil).toHaveLength(2);
    expect(hitungJejak(hasil).jejak[0]!.perubahan).toBe(1);
  });

  it("baris dengan bentuk tak terduga dibuang", async () => {
    await tulisMentah(
      [
        "[1,2,3]",
        '"string"',
        JSON.stringify({ at: 123, berkas: [] }),
        JSON.stringify({ at: "2026-10-03T10:00:00.000Z", berkas: "bukan array" }),
        barisSnapshot(snap("2026-10-03T10:00:00.000Z", [["a.cpp", 1]])),
      ].join("\n"),
    );
    expect(await bacaSnapshot(USER, COURSE)).toHaveLength(1);
  });

  it("file kosong menghasilkan array kosong", async () => {
    await tulisMentah("");
    expect(await bacaSnapshot(USER, COURSE)).toEqual([]);
  });
});

describe("jejak tersimpan bisa langsung jadi ringkasan", () => {
  it("menghitung perubahan dari snapshot yang benar-benar ditulis", async () => {
    await tambahSnapshot(USER, COURSE, snap("2026-10-03T10:00:00.000Z", [["a.cpp", 100]]));
    await tambahSnapshot(USER, COURSE, snap("2026-10-03T10:05:00.000Z", [["a.cpp", 180]]));
    await tambahSnapshot(USER, COURSE, snap("2026-10-03T10:10:00.000Z", [["a.cpp", 180]]));

    const ringkas = hitungJejak(await bacaSnapshot(USER, COURSE));
    expect(ringkas.observasi).toBe(3);
    expect(ringkas.jejak[0]).toMatchObject({
      path: "a.cpp",
      ukuranAwal: 100,
      ukuranAkhir: 180,
      perubahan: 1,
    });
  });

  it("isi file yang ditulis utuh tetap utuh setelah bolak-balik", async () => {
    await tambahSnapshot(USER, COURSE, snap("2026-10-03T10:00:00.000Z", [["a.cpp", 7]]));
    const isi = await readFile(pathJejak(USER, COURSE), "utf8");
    expect(isi.endsWith("\n")).toBe(true);
    expect(isi.trim().split("\n")).toHaveLength(1);
  });
});