import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { berkasCourses, muatCourses, simpanCourses } from "./storage";
import { INITIAL_COURSES } from "./store";

/**
 * Test persistensi disk.
 *
 * `CAREVEO_DATA_DIR` dialihkan ke direktori sementara supaya test tidak pernah
 * menulis ke `data/courses.json` milik mesin pengembang maupun repo.
 */

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "careevo-data-"));
  process.env.CAREEVO_DATA_DIR = dir;
});

afterEach(async () => {
  delete process.env.CAREEVO_DATA_DIR;
  await rm(dir, { recursive: true, force: true });
});

describe("berkasCourses", () => {
  it("menghormati CAREVEO_DATA_DIR", () => {
    expect(berkasCourses()).toBe(path.join(dir, "courses.json"));
  });
});

describe("muatCourses", () => {
  it("mengembalikan null bila berkas belum ada", async () => {
    expect(await muatCourses()).toBeNull();
  });

  it("mengembalikan null untuk JSON yang rusak, bukan melempar", async () => {
    await writeFile(berkasCourses(), "{ini bukan json", "utf8");
    expect(await muatCourses()).toBeNull();
  });

  it("mengembalikan null bila isinya bukan array", async () => {
    await writeFile(berkasCourses(), JSON.stringify({ courses: [] }), "utf8");
    expect(await muatCourses()).toBeNull();
  });

  it("menyaring entri yang tidak berbentuk Course", async () => {
    const campur = [...INITIAL_COURSES.slice(0, 2), { id: "rusak" }, null, "teks"];
    await writeFile(berkasCourses(), JSON.stringify(campur), "utf8");

    const hasil = await muatCourses();
    expect(hasil).not.toBeNull();
    expect(hasil).toHaveLength(2);
    expect(hasil?.map((c) => c.id)).toEqual(["crs-1", "crs-2"]);
  });
});

describe("simpanCourses", () => {
  it("menulis berkas dan bisa dibaca kembali utuh", async () => {
    await simpanCourses(INITIAL_COURSES);

    const hasil = await muatCourses();
    expect(hasil).toHaveLength(INITIAL_COURSES.length);
    expect(hasil?.map((c) => c.id)).toEqual(INITIAL_COURSES.map((c) => c.id));
  });

  it("mempertahankan modul dan materi di dalam kursus", async () => {
    const kursus = {
      ...INITIAL_COURSES[0],
      modul: [
        {
          id: "mod-1",
          course_id: INITIAL_COURSES[0].id,
          judul: "Orientasi",
          ringkasan: "Ringkasan modul orientasi yang cukup panjang.",
          urutan: 1,
          durasi_min: 20,
          materi: [
            {
              id: "mat-1",
              modul_id: "mod-1",
              course_id: INITIAL_COURSES[0].id,
              judul: "Video pengantar",
              urutan: 1,
              created_at: "2026-09-24T00:00:00.000Z",
              updated_at: "2026-09-24T00:00:00.000Z",
              tipe: "video" as const,
              url: "https://www.youtube.com/watch?v=abc",
              durasi_min: 12,
            },
          ],
          created_at: "2026-09-24T00:00:00.000Z",
          updated_at: "2026-09-24T00:00:00.000Z",
        },
      ],
    };

    await simpanCourses([kursus]);
    const hasil = await muatCourses();

    expect(hasil?.[0].modul).toHaveLength(1);
    expect(hasil?.[0].modul?.[0].materi?.[0].tipe).toBe("video");
  });

  it("tidak meninggalkan berkas sementara setelah selesai", async () => {
    await simpanCourses(INITIAL_COURSES);

    const isi = await readdir(dir);
    expect(isi).toEqual(["courses.json"]);
  });

  it("tidak membuat berkas rusak saat beberapa penulisan berbarengan", async () => {
    // Serialisasi penulisan adalah alasan rantai promise ada: tanpa itu dua
    // penulisan akan memakai berkas sementara yang sama dan rename bisa
    // memindahkan berkas yang sudah ditimpa.
    await Promise.all([
      simpanCourses(INITIAL_COURSES),
      simpanCourses([INITIAL_COURSES[0]]),
      simpanCourses(INITIAL_COURSES.slice(0, 3)),
    ]);

    const hasil = await muatCourses();
    expect(hasil).not.toBeNull();
    // Salah satu penulisan menang utuh — yang penting bukan gabungan rusak.
    expect([1, 3, INITIAL_COURSES.length]).toContain(hasil?.length);
  });
});
