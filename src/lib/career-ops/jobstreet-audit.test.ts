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

  it("treats a company name as verifiable even without an employer object", () => {
    // Corrected after measuring the live feed: every normal listing carries both
    // `companyName` and `employer`, while the genuinely anonymous ones carry
    // neither. A company name on its own is still a name a candidate can look
    // up, so this is not a signal. An earlier version of this test asserted the
    // opposite and quarantined two legitimate YO AI Labs postings.
    expect(bahanAudit(listing({ employer: undefined })).employer_known).toBe(true);
  });

  it("marks the employer as unknown when neither source names one", () => {
    expect(
      bahanAudit(listing({ companyName: "" as never, employer: undefined }), "").employer_known,
    ).toBe(false);
  });

  it("marks the employer as unknown for a Private Advertiser", () => {
    expect(bahanAudit(listing({ companyName: "Private Advertiser" })).employer_known).toBe(false);
  });

  it("marks the employer as known for a named company", () => {
    expect(bahanAudit(listing()).employer_known).toBe(true);
  });

  it("marks the employer as unknown when the API returns an empty employer id", () => {
    // Measured: Jobstreet returns {"id":"","name":"Private Advertiser"} for
    // anonymised listings, so a truthy object is not a verifiable employer.
    expect(
      bahanAudit(listing({ employer: { id: "", name: "Private Advertiser" } })).employer_known,
    ).toBe(false);
  });

  it("trusts the pipeline row when the detail lookup omits the company", () => {
    // The single-job endpoint omits companyName/employer for some listings that
    // the list endpoint — the one the scan read — did name. Quarantining those
    // would punish the posting for an API inconsistency rather than for anything
    // the employer did.
    const out = bahanAudit(
      listing({ companyName: undefined as never, employer: undefined }),
      "YO AI Labs",
    );
    expect(out.company).toBe("YO AI Labs");
    expect(out.employer_known).toBe(true);
  });

  it("still reports an unverifiable employer when both sources say Private Advertiser", () => {
    const out = bahanAudit(
      listing({
        companyName: "Private Advertiser",
        employer: { id: "", name: "Private Advertiser" },
      }),
      "Private Advertiser",
    );
    expect(out.employer_known).toBe(false);
  });
});
