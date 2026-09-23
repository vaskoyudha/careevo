import { describe, it, expect, beforeEach } from "vitest";
import { katalogBelajar, cariEntri, tipeKatalog } from "./katalog";
import { resetCourses, createCourse } from "./store";

beforeEach(() => {
  resetCourses();
});

describe("tipeKatalog", () => {
  it("memetakan bootcamp ke course dan mempertahankan sisanya", () => {
    expect(tipeKatalog("bootcamp")).toBe("course");
    expect(tipeKatalog("course")).toBe("course");
    expect(tipeKatalog("video")).toBe("video");
    expect(tipeKatalog("artikel")).toBe("artikel");
  });
});

describe("katalogBelajar", () => {
  it("hanya berisi kursus published — draft disembunyikan", async () => {
    const katalog = await katalogBelajar();
    const ids = katalog.map((entri) => entri.id);
    expect(ids).toContain("crs-1");
    expect(ids).not.toContain("crs-8");
  });

  it("mendahulukan kursus lalu fixture tanpa duplikat id", async () => {
    const katalog = await katalogBelajar();
    const ids = katalog.map((entri) => entri.id);
    expect(new Set(ids).size).toBe(ids.length);
    const indeksKursus = ids.indexOf("crs-1");
    const indeksFixture = ids.indexOf("r1");
    expect(indeksKursus).toBeGreaterThanOrEqual(0);
    expect(indeksFixture).toBeGreaterThan(indeksKursus);
  });

  it("memakai slug kursus dan id fixture sebagai slug", async () => {
    const katalog = await katalogBelajar();
    const kursus = katalog.find((entri) => entri.id === "crs-1");
    const fixture = katalog.find((entri) => entri.id === "r1");
    expect(kursus?.slug).toBe("fullstack-web-development-nextjs-15-react-19");
    expect(fixture?.slug).toBe("r1");
  });

  it("kursus selalu belum selesai di awal", async () => {
    const katalog = await katalogBelajar();
    const dariKursus = katalog.filter((entri) => entri.id.startsWith("crs-"));
    expect(dariKursus.length).toBeGreaterThan(0);
    expect(dariKursus.every((entri) => entri.completed === false)).toBe(true);
  });
});

describe("cariEntri", () => {
  it("menemukan lewat slug kursus maupun id fixture", async () => {
    expect((await cariEntri("fullstack-web-development-nextjs-15-react-19"))?.id).toBe(
      "crs-1",
    );
    expect((await cariEntri("r1"))?.id).toBe("r1");
  });

  it("mengembalikan undefined untuk slug draft dan slug asing", async () => {
    expect(
      await cariEntri("implementasi-arsitektur-hmac-attestation-zero-knowledge"),
    ).toBeUndefined();
    expect(await cariEntri("tidak-ada")).toBeUndefined();
  });

  it("kursus yang baru dibuat langsung bisa dicari", async () => {
    const dibuat = await createCourse({
      title: "Kursus Baru Untuk Uji Cari",
      description: "Deskripsi yang cukup panjang untuk lolos validasi uji.",
      provider: "Uji",
      url: "https://example.com/uji",
      duration_min: 45,
    });
    expect((await cariEntri(dibuat.slug))?.id).toBe(dibuat.id);
  });
});
