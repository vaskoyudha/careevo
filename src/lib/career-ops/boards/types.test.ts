import { describe, expect, it } from "vitest";
import { perusahaanTerkenal } from "./types";

describe("perusahaanTerkenal", () => {
  it("accepts a named company", () => {
    expect(perusahaanTerkenal("Kredivo Group")).toBe(true);
  });

  it("rejects Jobstreet's anonymised marker", () => {
    expect(perusahaanTerkenal("Private Advertiser")).toBe(false);
    expect(perusahaanTerkenal("  private advertiser ")).toBe(false);
  });

  it("rejects empty and missing names", () => {
    expect(perusahaanTerkenal("")).toBe(false);
    expect(perusahaanTerkenal("   ")).toBe(false);
    expect(perusahaanTerkenal(null)).toBe(false);
    expect(perusahaanTerkenal(undefined)).toBe(false);
  });
});
