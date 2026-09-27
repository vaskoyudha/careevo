import { describe, expect, it, vi } from "vitest";
import { smartrecruiters } from "./smartrecruiters";
import type { Io } from "./types";

const URL_SR = "https://jobs.smartrecruiters.com/GudangAda/743999852547361-software-engineer-front-end";

/** Measured shape of `/v1/companies/<slug>/postings/<id>`. */
const detail = (over: Record<string, unknown> = {}) => ({
  applyUrl: "https://jobs.smartrecruiters.com/GudangAda/743999852547361-software-engineer-front-end-?oga=true",
  jobAd: {
    sections: {
      companyDescription: { text: "" },
      jobDescription: { text: "<p>Build the front end.</p>" },
      qualifications: { text: "<p>3 years React.</p>" },
      additionalInformation: { text: "" },
    },
  },
  ...over,
});

const io = (payload: unknown): Io => ({
  fetchJson: vi.fn().mockResolvedValue(payload),
  fetchHtml: vi.fn(),
});

describe("smartrecruiters adapter", () => {
  it("claims only jobs.smartrecruiters.com urls", () => {
    expect(smartrecruiters.cocok(URL_SR)).toBe(true);
    expect(smartrecruiters.cocok("https://apply.workable.com/j/X")).toBe(false);
  });

  it("requests the per-posting detail endpoint", async () => {
    const fake = io(detail());
    await smartrecruiters.ambilDetail(URL_SR, fake, { perusahaan: "GudangAda" });
    expect(String((fake.fetchJson as ReturnType<typeof vi.fn>).mock.calls[0][0])).toBe(
      "https://api.smartrecruiters.com/v1/companies/GudangAda/postings/743999852547361",
    );
  });

  it("joins sections in the engine's order, skipping empty ones", async () => {
    const hasil = await smartrecruiters.ambilDetail(URL_SR, io(detail()), { perusahaan: "GudangAda" });
    expect(hasil?.bahan.description).toBe("Build the front end.\n3 years React.");
  });

  it("keeps the posting url when applyUrl is on the same host", async () => {
    const hasil = await smartrecruiters.ambilDetail(URL_SR, io(detail()), { perusahaan: "GudangAda" });
    expect(hasil?.bahan.apply_url).toBe(URL_SR);
  });

  it("prefers an off-platform applyUrl", async () => {
    const hasil = await smartrecruiters.ambilDetail(
      URL_SR,
      io(detail({ applyUrl: "https://careers.acme.co.id/apply/1" })),
      { perusahaan: "GudangAda" },
    );
    expect(hasil?.bahan.apply_url).toBe("https://careers.acme.co.id/apply/1");
  });

  it("returns null when every section is empty", async () => {
    const kosong = detail({
      jobAd: { sections: { companyDescription: { text: "" }, jobDescription: { text: "" } } },
    });
    expect(await smartrecruiters.ambilDetail(URL_SR, io(kosong), { perusahaan: "X" })).toBeNull();
  });

  it("returns null for a url it does not own", async () => {
    expect(await smartrecruiters.ambilDetail("https://dealls.com/loker/a~b", io(detail()), { perusahaan: "X" })).toBeNull();
  });
});
