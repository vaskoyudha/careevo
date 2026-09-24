import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Hidrasi store dari disk.
 *
 * Terpisah dari `store.test.ts` karena berkas itu memanggil `resetCourses()`
 * yang justru mematikan disk dan menandai cache sudah termuat; di sini
 * kebalikannya — cache harus mulai kosong supaya pembacaan pertama sungguh
 * mengambil dari berkas.
 *
 * `CAREVEO_DATA_DIR` diarahkan di `beforeAll` dan store diimpor dinamis di
 * dalam test: import statis diangkat ke atas seluruh modul, sedangkan env harus
 * sudah terpasang sebelum fungsi store pertama dipanggil (hidrasi bersifat
 * malas, terjadi pada panggilan pertama, bukan saat modul dimuat).
 */

const SEED_DARI_DISK = [
  {
    id: "crs-disk-1",
    title: "Kursus Dari Disk",
    slug: "kursus-dari-disk",
    description: "Kursus ini hanya ada di berkas, bukan di seed in-memory.",
    provider: "Penyelenggara Uji",
    type: "course",
    track: "web-dev",
    level: "dasar",
    tags: ["Uji"],
    url: "https://example.com/disk",
    duration_min: 45,
    is_free: true,
    price: 0,
    status: "published",
    enrolled_count: 0,
    rating: 5,
    created_at: "2026-09-24T00:00:00.000Z",
    updated_at: "2026-09-24T00:00:00.000Z",
    modul: [
      {
        id: "mod-disk-1",
        course_id: "crs-disk-1",
        judul: "Modul Dari Disk",
        ringkasan: "Modul yang ikut tersimpan di berkas.",
        urutan: 1,
        durasi_min: 45,
        materi: [
          {
            id: "mat-disk-1",
            modul_id: "mod-disk-1",
            course_id: "crs-disk-1",
            judul: "Video Dari Disk",
            urutan: 1,
            created_at: "2026-09-24T00:00:00.000Z",
            updated_at: "2026-09-24T00:00:00.000Z",
            tipe: "video",
            url: "https://www.youtube.com/watch?v=abc",
            durasi_min: 45,
          },
        ],
        created_at: "2026-09-24T00:00:00.000Z",
        updated_at: "2026-09-24T00:00:00.000Z",
      },
    ],
  },
];

/**
 * Kursus dengan materi `teks` dari versi sebelumnya.
 *
 * Ditaruh di berkas terpisah supaya tidak mengganggu sifat seed di atas: yang
 * itu menguji hidrasi biasa, yang ini menguji migrasi lewat jalur disk yang
 * sebenarnya.
 */
const SEED_LEGACY = [
  {
    ...SEED_DARI_DISK[0],
    id: "crs-legacy-1",
    title: "Kursus Lama",
    slug: "kursus-lama",
    modul: [
      {
        ...SEED_DARI_DISK[0].modul![0],
        id: "mod-legacy-1",
        course_id: "crs-legacy-1",
        materi: [
          {
            id: "mat-legacy-1",
            modul_id: "mod-legacy-1",
            course_id: "crs-legacy-1",
            judul: "Catatan Lama",
            urutan: 1,
            created_at: "2026-09-20T00:00:00.000Z",
            updated_at: "2026-09-20T00:00:00.000Z",
            tipe: "teks",
            konten: "Catatan yang dulu ditulis sebagai materi teks.",
          },
        ],
      },
    ],
  },
];

let DIR = "";

beforeAll(() => {
  DIR = mkdtempSync(path.join(tmpdir(), "careevo-hidrasi-"));
  process.env.CAREEVO_DATA_DIR = DIR;
  writeFileSync(
    path.join(DIR, "courses.json"),
    JSON.stringify([...SEED_DARI_DISK, ...SEED_LEGACY], null, 2),
    "utf8",
  );
});

afterAll(() => {
  delete process.env.CAREEVO_DATA_DIR;
  if (DIR) rmSync(DIR, { recursive: true, force: true });
});

describe("hidrasi store dari disk", () => {
  it("membaca kursus dari berkas, bukan dari seed in-memory", async () => {
    const { listCourses } = await import("./store");
    const daftar = await listCourses();

    expect(daftar.map((c) => c.id)).toEqual(["crs-disk-1", "crs-legacy-1"]);
    expect(daftar[0].title).toBe("Kursus Dari Disk");
  });

  it("membawa modul dan lampirannya sekalian", async () => {
    const { getCourseById } = await import("./store");
    const kursus = await getCourseById("crs-disk-1");

    expect(kursus?.modul).toHaveLength(1);
    expect(kursus?.modul?.[0].materi?.[0].judul).toBe("Video Dari Disk");
  });

  it("resolver modul memakai modul tersimpan dari disk", async () => {
    const { modulUntuk } = await import("./modul-resolver");
    const modul = await modulUntuk("crs-disk-1");

    expect(modul.map((m) => m.id)).toEqual(["mod-disk-1"]);
    expect(modul[0].judul).toBe("Modul Dari Disk");
    expect(modul[0].materi?.[0].tipe).toBe("video");
  });

  it("mutasi menulis balik ke berkas yang sama", async () => {
    const { createModul, listModul } = await import("./store");
    await createModul("crs-disk-1", {
      judul: "Modul Baru",
      ringkasan: "Ditambahkan oleh test hidrasi untuk membuktikan penulisan.",
      durasi_min: 15,
    });

    const mentah = JSON.parse(readFileSync(path.join(DIR, "courses.json"), "utf8")) as Array<{
      modul?: Array<{ judul: string }>;
    }>;

    expect(mentah[0].modul?.map((m) => m.judul)).toContain("Modul Baru");
    expect((await listModul("crs-disk-1")).map((m) => m.judul)).toContain("Modul Baru");
  });

  it("kursus seed tidak bocor ke hasil dari disk", async () => {
    const { getCourseById } = await import("./store");
    expect(await getCourseById("crs-1")).toBeUndefined();
  });

  it("migrasi materi teks lama menjadi halaman saat dibaca dari disk", async () => {
    // Ini pengujian migrasi lewat jalur yang sebenarnya: berkas berisi materi
    // `teks` dari versi sebelumnya, dan store harus mempromosikannya menjadi
    // halaman berformat tanpa skrip sekali jalan.
    const { getCourseById } = await import("./store");
    const kursus = await getCourseById("crs-legacy-1");
    const mod = kursus?.modul?.[0];

    expect(mod?.materi).toEqual([]);
    expect(mod?.halaman).toHaveLength(1);
    expect(mod?.halaman?.[0].judul).toBe("Catatan Lama");
    expect(mod?.halaman?.[0].blok[0].tipe).toBe("paragraf");
    expect(mod?.halaman?.[0].blok[0].segmen?.[0].teks).toBe(
      "Catatan yang dulu ditulis sebagai materi teks.",
    );
  });

  it("halaman hasil migrasi terbaca lewat resolver modul", async () => {
    const { modulUntuk } = await import("./modul-resolver");
    const modul = await modulUntuk("crs-legacy-1");

    expect(modul[0].halaman).toHaveLength(1);
    // Tanpa diteruskan resolver, modul tersimpan akan tampak kosong di halaman
    // belajar walau isinya sudah dimigrasikan.
    expect(modul[0].halaman?.[0].judul).toBe("Catatan Lama");
  });
});
