import { describe, expect, it } from "vitest";
import { auditBaris } from "./inbox-audit";
import type { ListingJobstreet } from "./jobstreet-audit";
import type { InboxJobShape } from "./pipeline-table";

const row = (over: Partial<InboxJobShape> = {}): InboxJobShape => ({
  url: "https://id.jobstreet.com/id/job/94839531",
  company: "YO AI Labs",
  role: "AI Data Trainer - Remote",
  done: false,
  ...over,
});

const listing = (over: Partial<ListingJobstreet> = {}): ListingJobstreet => ({
  id: "94839531",
  title: "AI Data Trainer - Remote",
  teaser: "",
  bulletPoints: [],
  companyName: "YO AI Labs",
  employer: { id: "1", name: "YO AI Labs" },
  ...over,
});

describe("auditBaris", () => {
  it("cleans a row whose listing names a real employer", () => {
    const [out] = auditBaris([row()], { "94839531": listing() });
    expect(out.audit.status).toBe("clean");
    expect(out.enriched).toBe(true);
  });

  it("quarantines a Private Advertiser row", () => {
    const [out] = auditBaris(
      [row({ company: "Private Advertiser" })],
      { "94839531": listing({ companyName: "Private Advertiser", employer: undefined }) },
    );
    expect(out.audit.status).toBe("quarantined");
    expect(out.audit.flags).toContain("perusahaan_tidak_terverifikasi");
  });

  it("quarantines a teaser that sends the applicant to a short link", () => {
    const [out] = auditBaris(
      [row()],
      { "94839531": listing({ teaser: "Apply as an employee at \nhttps://bit.ly/2yX06A9" }) },
    );
    expect(out.audit.status).toBe("quarantined");
    expect(out.audit.trust_flags).toContain("link_pendek");
  });

  it("never reports a row it could not enrich as audited-clean", () => {
    const [out] = auditBaris([row()], {});
    expect(out.enriched).toBe(false);
    expect(out.audit.status).not.toBe("clean");
  });

  it("judges a fee rule found in the bullet points", () => {
    const [out] = auditBaris(
      [row()],
      { "94839531": listing({ bulletPoints: ["Dikenakan biaya administrasi Rp500.000"] }) },
    );
    expect(out.audit.fee_flags).toContain("biaya_administrasi");
    // One content signal alone quarantines; it does not reject. `rejected` needs
    // two independent signals, which is the Sentinel policy pinned in
    // sentinel.test.ts. Asserting `rejected` here would over-reject a board
    // where many postings merely mention a fee.
    expect(out.audit.status).toBe("quarantined");
  });

  it("rejects when two independent fee rules appear in the listing", () => {
    const [out] = auditBaris(
      [row()],
      {
        "94839531": listing({
          bulletPoints: ["Dikenakan biaya administrasi Rp500.000", "Kirim OTP ke nomor saya"],
        }),
      },
    );
    expect(out.audit.fee_flags).toEqual(
      expect.arrayContaining(["biaya_administrasi", "panen_data"]),
    );
    expect(out.audit.status).toBe("rejected");
  });

  it("keeps one audit per row when several rows share a job id", () => {
    const out = auditBaris(
      [row(), row({ url: "https://id.jobstreet.com/id/job/94839531?src=x" })],
      { "94839531": listing() },
    );
    expect(out).toHaveLength(2);
    expect(out[0].audit.status).toBe(out[1].audit.status);
  });

  it("leaves a non-jobstreet row marked unenriched rather than judging it blind", () => {
    const [out] = auditBaris([row({ url: "https://careers.allianz.com/job/1" })], {});
    expect(out.enriched).toBe(false);
  });

  it("falls back to the pipeline row's company when the listing names none", () => {
    const [out] = auditBaris(
      [row({ company: "PT Dari Pipeline" })],
      { "94839531": listing({ companyName: "" }) },
    );
    expect(out.audit.status).toBe("quarantined");
  });
});
