import { describe, expect, it, vi } from "vitest";
import { jobstreet, tagKlasifikasi } from "./jobstreet";
import type { Io } from "./types";
import type { ListingJobstreet } from "../jobstreet-audit";

const listing = (over: Partial<ListingJobstreet> = {}): ListingJobstreet => ({
  id: "94839531",
  title: "AI Data Trainer",
  teaser: "Build our React dashboard",
  bulletPoints: ["TypeScript required"],
  companyName: "YO AI Labs",
  employer: { id: "1", name: "YO AI Labs" },
  ...over,
});

const io = (data: unknown[]): Io => ({
  fetchJson: vi.fn().mockResolvedValue({ data }),
  fetchHtml: vi.fn(),
});

describe("jobstreet adapter", () => {
  it("claims only jobstreet posting urls", () => {
    expect(jobstreet.cocok("https://id.jobstreet.com/id/job/94839531")).toBe(true);
    expect(jobstreet.cocok("https://dealls.com/loker/a~b")).toBe(false);
  });

  it("requests the documented single-job endpoint", async () => {
    const fake = io([listing()]);
    await jobstreet.ambilDetail(
      "https://id.jobstreet.com/id/job/94839531",
      fake,
      { perusahaan: "YO AI Labs" },
    );
    const url = String((fake.fetchJson as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(url).toContain("jobId=94839531");
    expect(url).toContain("siteKey=ID-Main");
  });

  it("joins the listing into the text the fee rules read", async () => {
    const hasil = await jobstreet.ambilDetail(
      "https://id.jobstreet.com/id/job/94839531",
      io([listing()]),
      { perusahaan: "YO AI Labs" },
    );
    expect(hasil?.bahan.description).toContain("TypeScript required");
    expect(hasil?.bahan.description).toContain("Build our React dashboard");
  });

  it("uses the pipeline row's company when the detail endpoint omits one", async () => {
    const hasil = await jobstreet.ambilDetail(
      "https://id.jobstreet.com/id/job/94839531",
      io([listing({ companyName: undefined as never, employer: undefined })]),
      { perusahaan: "PT Dari Pipeline" },
    );
    expect(hasil?.bahan.company).toBe("PT Dari Pipeline");
    expect(hasil?.bahan.employer_known).toBe(true);
  });

  it("returns null when the API has no such listing", async () => {
    expect(
      await jobstreet.ambilDetail("https://id.jobstreet.com/id/job/1", io([]), { perusahaan: "X" }),
    ).toBeNull();
  });

  it("returns null for a url it does not own", async () => {
    expect(
      await jobstreet.ambilDetail("https://dealls.com/loker/a~b", io([listing()]), {
        perusahaan: "X",
      }),
    ).toBeNull();
  });
});

describe("tagKlasifikasi", () => {
  it("turns classification descriptions into tags", () => {
    const tags = tagKlasifikasi(
      listing({
        classifications: [
          {
            classification: { id: "1", description: "Information & Communication Technology" },
            subclassification: { id: "2", description: "Business/Systems Analysts" },
          },
        ],
      } as unknown as Partial<ListingJobstreet>),
    );
    expect(tags).toContain("Information & Communication Technology");
    expect(tags).toContain("Business/Systems Analysts");
  });

  it("returns an empty list when the listing carries no classifications", () => {
    expect(tagKlasifikasi(listing())).toEqual([]);
  });
});
