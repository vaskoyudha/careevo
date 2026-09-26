import { describe, expect, it } from "vitest";
import {
  applyUrlFromTeaser,
  bahanAudit,
  jobIdFromUrl,
  type ListingJobstreet,
} from "./jobstreet-audit";

const listing = (over: Partial<ListingJobstreet> = {}): ListingJobstreet => ({
  id: "94527436",
  title: "Analyst, Transformation Specialist",
  teaser: "",
  bulletPoints: [],
  companyName: "PT Bank DBS Indonesia",
  employer: { id: "1", name: "PT Bank DBS Indonesia" },
  ...over,
});

describe("jobIdFromUrl", () => {
  it("pulls the id out of a jobstreet posting url", () => {
    expect(jobIdFromUrl("https://id.jobstreet.com/id/job/94527436")).toBe("94527436");
  });

  it("returns null for a url that is not a jobstreet posting", () => {
    expect(jobIdFromUrl("https://careers.allianz.com/job/106454")).toBeNull();
  });

  it("returns null rather than a partial id for a malformed url", () => {
    expect(jobIdFromUrl("https://id.jobstreet.com/id/job/")).toBeNull();
  });
});

describe("applyUrlFromTeaser", () => {
  const posting = "https://id.jobstreet.com/id/job/94839531";

  it("returns the posting url when the teaser has no link", () => {
    expect(applyUrlFromTeaser("Data Scientist", posting)).toBe(posting);
  });

  it("returns the posting url when the teaser only mentions the same host", () => {
    expect(applyUrlFromTeaser("Lihat di id.jobstreet.com", posting)).toBe(posting);
  });

  it("returns the off-domain url when the teaser points elsewhere", () => {
    expect(applyUrlFromTeaser("Apply as an employee at \nhttps://bit.ly/2yX06A9", posting)).toBe(
      "https://bit.ly/2yX06A9",
    );
  });

  it("falls back to the posting url for a non-http scheme", () => {
    expect(applyUrlFromTeaser("kirim ke mailto: recruiter@example.com", posting)).toBe(posting);
  });
});

describe("bahanAudit", () => {
  it("joins bullet points and teaser into the text the fee rules read", () => {
    const out = bahanAudit(
      listing({ teaser: "Data Scientist", bulletPoints: ["Butuh biaya administrasi 500rb"] }),
    );
    expect(out.description).toContain("biaya administrasi 500rb");
    expect(out.description).toContain("Data Scientist");
  });

  it("marks the employer as unknown when there is no employer object", () => {
    expect(bahanAudit(listing({ employer: undefined })).employer_known).toBe(false);
  });

  it("marks the employer as unknown for a Private Advertiser", () => {
    expect(bahanAudit(listing({ companyName: "Private Advertiser" })).employer_known).toBe(false);
  });

  it("marks the employer as known for a named company", () => {
    expect(bahanAudit(listing()).employer_known).toBe(true);
  });
});
