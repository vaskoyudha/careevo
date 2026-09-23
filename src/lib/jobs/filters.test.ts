import { describe, expect, it } from "vitest";
import {
  buatFilterGaji,
  buatFilterKonten,
  buatFilterLokasi,
  parseRentangGaji,
} from "@/lib/jobs/filters";

/**
 * Tests for the filter builders ported from career-ops (MIT).
 *
 * The load-bearing property throughout: **missing data passes**. A filter that
 * silently hides a real posting because its source omitted a field is a worse
 * failure than one that shows an extra posting.
 */

describe("buatFilterLokasi", () => {
  it("passes everything when there is no config", () => {
    const filter = buatFilterLokasi(null);
    expect(filter("Jakarta")).toBe(true);
    expect(filter("")).toBe(true);
    expect(filter(null)).toBe(true);
  });

  it("passes when the location is empty — never penalize missing data", () => {
    const filter = buatFilterLokasi({ allow: ["Jakarta"] });
    expect(filter("")).toBe(true);
    expect(filter(null)).toBe(true);
    expect(filter(undefined)).toBe(true);
  });

  it("requires an allow match when allow is non-empty", () => {
    const filter = buatFilterLokasi({ allow: ["Jakarta"] });
    expect(filter("Jakarta · Hybrid")).toBe(true);
    expect(filter("Bandung · Onsite")).toBe(false);
  });

  it("uses word boundaries so a city is not a prefix match", () => {
    // The motivating bug upstream: blocking "india" must not reject "Indianapolis".
    const filter = buatFilterLokasi({ block: ["india"] });
    expect(filter("Indianapolis, IN")).toBe(true);
    expect(filter("India")).toBe(false);
  });

  it("lets always_allow override block", () => {
    const filter = buatFilterLokasi({ always_allow: ["Jakarta"], block: ["Jakarta", "Bandung"] });
    expect(filter("Jakarta · Remote")).toBe(true);
  });

  it("lets block_hard override always_allow — the one tier that wins", () => {
    const filter = buatFilterLokasi({ block_hard: ["Indonesia"], always_allow: ["Jakarta"] });
    expect(filter("Jakarta, Indonesia")).toBe(false);
  });

  it("is case-insensitive", () => {
    const filter = buatFilterLokasi({ allow: ["jakarta"] });
    expect(filter("JAKARTA")).toBe(true);
  });

  it("ignores empty keyword entries", () => {
    // An empty keyword would match everything via includes("") and bypass tiers.
    const filter = buatFilterLokasi({ allow: ["", "  "] });
    expect(filter("Bandung")).toBe(true);
  });
});

describe("buatFilterKonten", () => {
  it("passes everything when there is no config", () => {
    const filter = buatFilterKonten(null);
    expect(filter("apa saja")).toBe(true);
  });

  it("passes when the description is empty", () => {
    const filter = buatFilterKonten({ negative: ["fee"] });
    expect(filter("")).toBe(true);
    expect(filter(null)).toBe(true);
  });

  it("rejects on a negative keyword", () => {
    const filter = buatFilterKonten({ negative: ["biaya administrasi"] });
    expect(filter("Pelamar diminta menyiapkan biaya administrasi.")).toBe(false);
    expect(filter("Membangun antarmuka React.")).toBe(true);
  });

  it("requires a positive match when positives are set", () => {
    const filter = buatFilterKonten({ positive: ["react", "node"] });
    expect(filter("Menggunakan React dan TypeScript.")).toBe(true);
    expect(filter("Menggunakan Vue.")).toBe(false);
  });

  it("lets negative win over positive", () => {
    const filter = buatFilterKonten({ positive: ["react"], negative: ["scam"] });
    expect(filter("React job, but scam")).toBe(false);
  });
});

describe("parseRentangGaji", () => {
  it("parses a jt range into IDR", () => {
    expect(parseRentangGaji("Rp6-8 jt")).toEqual({ min: 6_000_000, max: 8_000_000, currency: "IDR" });
  });

  it("parses a ribu range", () => {
    expect(parseRentangGaji("Rp500 rb")).toEqual({ min: 500_000, max: 500_000, currency: "IDR" });
  });

  it("returns null for absent or unparseable input", () => {
    expect(parseRentangGaji(null)).toBeNull();
    expect(parseRentangGaji("")).toBeNull();
    expect(parseRentangGaji("kompetitif")).toBeNull();
  });
});

describe("buatFilterGaji", () => {
  it("passes everything when there is no config", () => {
    const filter = buatFilterGaji(null);
    expect(filter({ min: 1, max: 2 })).toBe(true);
  });

  it("passes when there is no salary data — conservative", () => {
    const filter = buatFilterGaji({ min: 7_000_000, max: 10_000_000 });
    expect(filter(null)).toBe(true);
    expect(filter({ min: null, max: null })).toBe(true);
  });

  it("rejects a posting entirely below the band", () => {
    const filter = buatFilterGaji({ min: 10_000_000, max: 0, currency: "IDR" });
    expect(filter(parseRentangGaji("Rp4-6 jt"))).toBe(false);
  });

  it("rejects a posting entirely above the band", () => {
    const filter = buatFilterGaji({ min: 0, max: 7_000_000, currency: "IDR" });
    expect(filter(parseRentangGaji("Rp10-14 jt"))).toBe(false);
  });

  it("passes a partially overlapping posting", () => {
    const filter = buatFilterGaji({ min: 7_000_000, max: 10_000_000, currency: "IDR" });
    expect(filter(parseRentangGaji("Rp6-8 jt"))).toBe(true);
    expect(filter(parseRentangGaji("Rp9-12 jt"))).toBe(true);
  });

  it("disables itself on an inverted range", () => {
    const filter = buatFilterGaji({ min: 10_000_000, max: 5_000_000 });
    expect(filter(parseRentangGaji("Rp1-2 jt"))).toBe(true);
  });

  it("rejects on a currency mismatch only when both declare one", () => {
    const filter = buatFilterGaji({ min: 1, max: 0, currency: "USD" });
    expect(filter({ min: 1_000_000, max: 2_000_000, currency: "IDR" })).toBe(false);
    expect(filter({ min: 1_000_000, max: 2_000_000 })).toBe(true);
  });
});
