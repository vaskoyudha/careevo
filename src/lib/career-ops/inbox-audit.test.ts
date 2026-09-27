import { describe, expect, it } from "vitest";
import { auditBaris } from "./inbox-audit";
import type { EntriCache, IsiCache } from "./job-cache";
import type { InboxJobShape } from "./pipeline-table";

const URL_JOBSTREET = "https://id.jobstreet.com/id/job/94839531";

const row = (over: Partial<InboxJobShape> = {}): InboxJobShape => ({
  url: URL_JOBSTREET,
  company: "YO AI Labs",
  role: "AI Data Trainer - Remote",
  done: false,
  ...over,
});

const entri = (over: Partial<EntriCache> = {}): EntriCache => ({
  board: "Jobstreet",
  bahan: {
    description: "Build our React dashboard",
    apply_url: URL_JOBSTREET,
    company: "YO AI Labs",
    employer_known: true,
  },
  diambilPada: "2026-09-29",
  ...over,
});

/** The cache as `auditBaris` sees it: keyed by the normalized URL. */
const cache = (over: Partial<EntriCache> = {}): IsiCache => ({ [URL_JOBSTREET]: entri(over) });

describe("auditBaris", () => {
  it("cleans a row whose entry names a real employer", () => {
    const [out] = auditBaris([row()], cache());
    expect(out.audit.status).toBe("clean");
    expect(out.enriched).toBe(true);
  });

  it("quarantines a Private Advertiser row", () => {
    const [out] = auditBaris(
      [row({ company: "Private Advertiser" })],
      cache({
        bahan: {
          description: "x",
          apply_url: URL_JOBSTREET,
          company: "Private Advertiser",
          employer_known: false,
        },
      }),
    );
    expect(out.audit.status).toBe("quarantined");
    expect(out.audit.flags).toContain("perusahaan_tidak_terverifikasi");
  });

  it("quarantines an entry whose apply_url is a short link", () => {
    const [out] = auditBaris(
      [row()],
      cache({
        bahan: {
          description: "x",
          apply_url: "https://bit.ly/2yX06A9",
          company: "YO AI Labs",
          employer_known: true,
        },
      }),
    );
    expect(out.audit.status).toBe("quarantined");
    expect(out.audit.trust_flags).toContain("link_pendek");
  });

  it("never reports a row it could not enrich as audited-clean", () => {
    const [out] = auditBaris([row()], {});
    expect(out.enriched).toBe(false);
    expect(out.audit.status).not.toBe("clean");
  });

  it("judges a fee rule found in the description", () => {
    const [out] = auditBaris(
      [row()],
      cache({
        bahan: {
          description: "Dikenakan biaya administrasi Rp500.000",
          apply_url: URL_JOBSTREET,
          company: "YO AI Labs",
          employer_known: true,
        },
      }),
    );
    expect(out.audit.fee_flags).toContain("biaya_administrasi");
    // One content signal alone quarantines; it does not reject. `rejected` needs
    // two independent signals, which is the Sentinel policy pinned in
    // sentinel.test.ts.
    expect(out.audit.status).toBe("quarantined");
  });

  it("rejects when two independent fee rules appear in the description", () => {
    const [out] = auditBaris(
      [row()],
      cache({
        bahan: {
          description:
            "Dikenakan biaya administrasi Rp500.000\nKirim OTP ke nomor saya",
          apply_url: URL_JOBSTREET,
          company: "YO AI Labs",
          employer_known: true,
        },
      }),
    );
    expect(out.audit.fee_flags).toEqual(
      expect.arrayContaining(["biaya_administrasi", "panen_data"]),
    );
    expect(out.audit.status).toBe("rejected");
  });

  it("keys the cache by URL, so a normalized query string on the row still finds its entry", () => {
    // `utm_source` is in `url-key.ts`'s TRACKING_PARAMS denylist, so it normalizes
    // away and the lookup hits the base key. A param that is NOT denylisted (e.g.
    // `?src=x`) would keep its own key and this row would be unenriched — which is
    // the correct behaviour, not a bug, so the fixture must use a stripped param.
    const [out] = auditBaris(
      [row({ url: `${URL_JOBSTREET}?utm_source=x` })],
      cache(),
    );
    expect(out.enriched).toBe(true);
  });

  it("leaves a row no board claims marked unenriched rather than judging it blind", () => {
    const [out] = auditBaris([row({ url: "https://careers.allianz.com/job/1" })], {});
    expect(out.enriched).toBe(false);
  });

  it("treats an unnormalizable URL as unenriched, never as a cache hit", () => {
    // "" means NO KEY. If it were treated as a lookup key, every unparseable row
    // would match every other one.
    const [out] = auditBaris([row({ url: "N/A" })], { "": entri() });
    expect(out.enriched).toBe(false);
  });

  it("falls back to the pipeline row's company when the entry names none", () => {
    const [out] = auditBaris(
      [row({ company: "PT Dari Pipeline" })],
      cache({
        bahan: { description: "x", apply_url: URL_JOBSTREET, company: "", employer_known: true },
      }),
    );
    expect(out.audit.status).toBe("clean");
  });

  it("keeps one audit per row when several rows share a URL", () => {
    const out = auditBaris([row(), row()], cache());
    expect(out).toHaveLength(2);
    expect(out[0].audit.status).toBe(out[1].audit.status);
  });
});
