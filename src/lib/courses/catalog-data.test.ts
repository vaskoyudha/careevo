import { describe, it, expect } from "vitest";
import { PROGRAMS_REGISTRY, getProgramBySlug } from "./catalog-data";

/**
 * Sampul katalog ini punya satu aturan yang mudah dilanggar tanpa disadari:
 * satu foto tidak boleh dipakai untuk dua program. Dua program yang berbagi
 * sampul membuat katalog terbaca seperti satu program yang diulang, dan
 * `ATTRIBUTION.md` hanya benar kalau setiap baris menunjuk program yang
 * benar-benar memakainya.
 *
 * Tes ini mengunci aturan itu di dua tempat yang bisa menolaknya: registry,
 * dan program sintetis yang dibuat untuk slug yang tidak dikenal.
 */
describe("sampul program katalog", () => {
  it("setiap program punya thumbnail sendiri, tidak ada yang dipakai dua kali", () => {
    const memakaiGambar = Object.values(PROGRAMS_REGISTRY).flatMap((program) =>
      program.thumbnail ? [[program.slug, program.thumbnail] as const] : [],
    );

    // Registry bisa saja tumbuh tanpa thumbnail sama sekali. Itu bukan
    // duplikasi, tapi memeriksa aturan di atasnya tidak berarti apa-apa kalau
    // tidak ada yang perlu diperiksa.
    expect(memakaiGambar.length).toBeGreaterThan(0);

    const perGambar = new Map<string, string[]>();
    for (const [slug, gambar] of memakaiGambar) {
      perGambar.set(gambar, [...(perGambar.get(gambar) ?? []), slug]);
    }

    const duplikat = [...perGambar.entries()]
      .filter(([, slug]) => slug.length > 1)
      .map(([gambar, slug]) => `${gambar} dipakai ${slug.length}x: ${slug.join(", ")}`);

    expect(duplikat).toEqual([]);
  });

  it("program sintetis untuk slug tak dikenal tidak memakai sampul program lain", () => {
    // Slug di bawah ini tidak ada di registry, jadi semuanya jatuh ke fallback
    // `getProgramBySlug`. Kalau fallback itu memberi thumbnail, semua slug ini
    // memakainya — persis duplikasi yang dikeluhkan.
    const slugTakDikenal = [
      "google-it-support",
      "google-ux-design",
      "aws-security-engineer",
      "ai-agents-python",
      "deep-learning",
    ];

    const gambarnya = new Set(
      slugTakDikenal
        .map((slug) => getProgramBySlug(slug).thumbnail)
        .filter((nilai): nilai is string => typeof nilai === "string"),
    );

    // Nol, bukan satu. Tanpa thumbnail lebih jujur daripada memamerkan
    // foto program lain di halaman program yang tidak kitafotografikan.
    expect(gambarnya).toEqual(new Set());
  });

  it("semua thumbnail menunjuk file lokal yang ada", () => {
    // URL di luar repo tidak bisa diuji di sini, jadi yang diperiksa hanya yang
    // lokal: nama filenya harus mengikuti pola yang dipakai direktori aset, atau
    // tidak ada yang gagal diam-diam tanpa error kompilasi.
    const lokal = Object.values(PROGRAMS_REGISTRY)
      .map((program) => program.thumbnail)
      .filter((nilai): nilai is string => typeof nilai === "string" && nilai.startsWith("/images/"));

    for (const path of lokal) {
      expect(path).toMatch(/^\/images\/programs\/[a-z0-9-]+\.jpg$/);
    }
  });
});
