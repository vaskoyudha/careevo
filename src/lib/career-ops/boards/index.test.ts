import { describe, expect, it } from "vitest";
import { ADAPTER, adapterUntuk, namaPapan } from "./index";

/** Every board present in the real inbox, by one of its rows. */
const CONTOH: ReadonlyArray<readonly [string, string]> = [
  ["https://id.jobstreet.com/id/job/94821245", "Jobstreet"],
  ["https://www.kalibrr.com/c/cti-group/jobs/256183/cloud-engineer-11", "Kalibrr"],
  ["https://apply.workable.com/j/B2B2EFD9D7", "Workable"],
  ["https://jobs.smartrecruiters.com/Julo/743999771899216-lead-software-engineer", "SmartRecruiters"],
  ["https://dealls.com/loker/software-engineer-ai~sirclo", "Dealls"],
  ["https://kredivo-group.breezy.hr/p/c43a53b3bc63-fullstack-engineer-sde-2", "Breezy"],
];

describe("registry", () => {
  it("has one adapter per board the inbox actually contains", () => {
    expect(ADAPTER.map((a) => a.nama)).toEqual([
      "Jobstreet",
      "Kalibrr",
      "Workable",
      "SmartRecruiters",
      "Dealls",
      "Breezy",
    ]);
  });

  it.each(CONTOH)("routes %s to %s", (url, nama) => {
    expect(adapterUntuk(url)?.nama).toBe(nama);
    expect(namaPapan(url)).toBe(nama);
  });

  it("routes each sample to exactly one adapter", () => {
    // Overlapping `cocok` patterns would let adapter order silently decide which
    // board owns a row — a bug that shows up as the wrong description, not an error.
    for (const [url] of CONTOH) {
      expect(ADAPTER.filter((a) => a.cocok(url))).toHaveLength(1);
    }
  });

  it("returns null for a host no adapter claims", () => {
    expect(adapterUntuk("https://careers.allianz.com/job/1")).toBeNull();
    expect(namaPapan("https://careers.allianz.com/job/1")).toBeUndefined();
  });
});
