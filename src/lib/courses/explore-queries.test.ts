import { describe, it, expect } from "vitest";
import {
  getAllPrograms,
  getProgramsByCategory,
  getProgramsByRole,
  getProgramsBySearch,
  getProgramsByQuery,
  getCertificationPrep,
  getRole,
  programHref,
  ALL_CATEGORY_SLUGS,
  ALL_ROLE_SLUGS,
} from "./explore-queries";
import {
  ROLES,
  CATEGORIES,
  CERTIFICATES,
  DEGREES,
  TRENDING_SKILLS,
  EXPLORE_FALLBACKS,
} from "./explore-taxonomy";

describe("explore-taxonomy", () => {
  it("tidak ada link Explore yang masih menunjuk ke /belajar", () => {
    const all = [
      ...ROLES,
      ...CATEGORIES,
      ...CERTIFICATES,
      ...DEGREES,
      ...TRENDING_SKILLS,
    ];
    const bad = all.filter((i) => i.href === "/belajar");
    expect(bad).toEqual([]);
  });

  it("semua href memakai path absolut yang dikenal", () => {
    const all = [
      ...ROLES,
      ...CATEGORIES,
      ...CERTIFICATES,
      ...DEGREES,
      ...TRENDING_SKILLS,
    ];
    for (const item of all) {
      expect(item.href.startsWith("/")).toBe(true);
      expect(item.href).not.toContain("//");
    }
  });

  it("slug role unik dan mengikuti pola URL Coursera", () => {
    const paths = ROLES.map((r) => r.href);
    expect(new Set(paths).size).toBe(paths.length);
    for (const r of ROLES) {
      expect(r.href).toMatch(/^\/career-academy\/roles\/[a-z0-9-]+$/);
    }
  });

  it("fallback Explore tidak kosong", () => {
    expect(EXPLORE_FALLBACKS.browseAll).toBe("/browse");
    expect(EXPLORE_FALLBACKS.viewAllRoles).toBe("/career-academy");
    expect(EXPLORE_FALLBACKS.freeCourses).toBe("/courses?query=free");
  });
});

describe("explore-queries", () => {
  it("hanya mengembalikan program yang benar-benar ada di registry", () => {
    const programs = getAllPrograms();
    expect(programs.length).toBeGreaterThan(0);
    for (const p of programs) {
      expect(p.title).not.toContain("Explore comprehensive training");
    }
  });

  it("kategori dengan isinya mengembalikan program nyata", () => {
    const ds = getProgramsByCategory("data-science");
    expect(ds.length).toBeGreaterThan(0);
    for (const p of ds) expect(p.category).toBe("Data Science");
  });

  it("kategori kosong tidak error dan mengembalikan array kosong", () => {
    expect(getProgramsByCategory("arts-and-humanities")).toEqual([]);
    expect(getProgramsByCategory("tidak-ada-slug-ini")).toEqual([]);
  });

  it("setiap role punya label dan daftar program (boleh kosong)", () => {
    for (const slug of ALL_ROLE_SLUGS) {
      const role = getRole(slug);
      expect(role).not.toBeNull();
      expect(role!.label.length).toBeGreaterThan(0);
      expect(Array.isArray(getProgramsByRole(slug))).toBe(true);
    }
  });

  it("role yang tidak dikenal mengembalikan null", () => {
    expect(getRole("astronaut")).toBeNull();
    expect(getProgramsByRole("astronaut")).toEqual([]);
  });

  it("pencarian sertifikat profesional menyaring berdasarkan tipe", () => {
    const certs = getProgramsBySearch("Professional Certificate");
    expect(certs.length).toBeGreaterThan(0);
    for (const p of certs) expect(p.type).toBe("Professional Certificate");
  });

  it("query skill mengembalikan hasil, dan query asing tidak bikin halaman kosong", () => {
    expect(getProgramsByQuery("python").length).toBeGreaterThan(0);
    // query tanpa hasil tetap balas, supaya tidak ada halaman hantu
    expect(getProgramsByQuery("zzz").length).toBeGreaterThan(0);
    expect(getProgramsByQuery("").length).toBe(getAllPrograms().length);
  });

  it("programHref mengikuti jenis program", () => {
    const [first] = getAllPrograms();
    const expected =
      first.type === "Professional Certificate"
        ? `/professional-certificates/${first.slug}`
        : `/specializations/${first.slug}`;
    expect(programHref(first)).toBe(expected);
  });

  it("slip belajar memakai link detail program, bukan /belajar", () => {
    for (const p of getAllPrograms()) {
      expect(programHref(p)).toMatch(/^\/(professional-certificates|specializations)\//);
    }
  });

  it("daftar slug kategori dan role konsisten", () => {
    expect(ALL_CATEGORY_SLUGS.length).toBeGreaterThanOrEqual(10);
    expect(ALL_ROLE_SLUGS.length).toBe(ROLES.length);
  });

  it("halaman persiapan sertifikasi tidak error", () => {
    expect(Array.isArray(getCertificationPrep())).toBe(true);
  });
});
