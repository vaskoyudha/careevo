import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// MUST be stubbed before the data-root module resolves, so this test never
// touches the repo's real `.data/career-ops`.
const AKAR = mkdtempSync(path.join(tmpdir(), "careevo-inbox-audit-"));
vi.stubEnv("CAREER_OPS_ROOT", AKAR);

const { bacaInboxDiaudit } = await import("./inbox");

beforeEach(() => {
  mkdirSync(path.join(AKAR, "data"), { recursive: true });
});

afterAll(() => {
  vi.unstubAllEnvs();
});

const KOSONG = path.join(AKAR, "data", "pipeline.md");

/** A cache file inside the temp root, so the test never writes into the repo. */
const cacheFile = () => path.join(AKAR, "jobstreet-cache.json");

const write = (rows: string[]) =>
  writeFileSync(KOSONG, ["# Pipeline", "", "## Pending", "", ...rows, ""].join("\n"), "utf8");

const listingJson = (id: string, over: Record<string, unknown> = {}) => ({
  data: [
    {
      id,
      title: "AI Engineer",
      teaser: "",
      bulletPoints: [],
      companyName: "PT Foo",
      employer: { id: "1", name: "PT Foo" },
      ...over,
    },
  ],
});

describe("bacaInboxDiaudit", () => {
  it("returns an empty list, not an error, when the pipeline is empty", async () => {
    const rows = await bacaInboxDiaudit({ fetchJson: async () => ({ data: [] }), cacheFile: cacheFile() });
    expect(rows).toEqual([]);
  });

  it("gives every row a verdict and an enriched flag", async () => {
    write(["- [ ] https://id.jobstreet.com/id/job/111 | PT Foo | AI Engineer | Jakarta | posted: 2026-09-20"]);
    const rows = await bacaInboxDiaudit({
      fetchJson: async () => listingJson("111"),
      cacheFile: cacheFile(),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].enriched).toBe(true);
    expect(rows[0].audit.status).toBe("clean");
    expect(rows[0].firstSeen).toBeDefined();
  });

  it("marks a row it could not fetch as unenriched rather than clean", async () => {
    write(["- [ ] https://id.jobstreet.com/id/job/222 | PT Foo | AI Engineer | Jakarta | posted: 2026-09-20"]);
    const rows = await bacaInboxDiaudit({
      fetchJson: async () => {
        throw new Error("HTTP 500");
      },
      cacheFile: cacheFile(),
    });
    expect(rows[0].enriched).toBe(false);
    expect(rows[0].audit.status).not.toBe("clean");
  });

  it("leaves a non-jobstreet row unenriched without calling the network", async () => {
    write(["- [ ] https://careers.allianz.com/job/9 | Allianz | PM | Jakarta | posted: 2026-09-20"]);
    let calls = 0;
    const rows = await bacaInboxDiaudit({
      fetchJson: async () => {
        calls++;
        return { data: [] };
      },
      cacheFile: cacheFile(),
    });
    expect(calls).toBe(0);
    expect(rows[0].enriched).toBe(false);
  });

  it("quarantines a Private Advertiser row", async () => {
    write([
      "- [ ] https://id.jobstreet.com/id/job/333 | Private Advertiser | AI Engineer | Jakarta | posted: 2026-09-20",
    ]);
    const rows = await bacaInboxDiaudit({
      fetchJson: async () =>
        listingJson("333", { companyName: "Private Advertiser", employer: undefined }),
      cacheFile: cacheFile(),
    });
    expect(rows[0].audit.status).toBe("quarantined");
    expect(rows[0].audit.flags).toContain("perusahaan_tidak_terverifikasi");
  });

  it("prefers the pipeline row's own posted date for firstSeen", async () => {
    writeFileSync(
      path.join(AKAR, "data", "scan-history.tsv"),
      "url\tfirst_seen\nhttps://id.jobstreet.com/id/job/444\t2026-09-01\n",
      "utf8",
    );
    write([
      "- [ ] https://id.jobstreet.com/id/job/444 | PT Foo | AI Engineer | Jakarta | posted: 2026-09-20",
    ]);
    const rows = await bacaInboxDiaudit({
      fetchJson: async () => listingJson("444"),
      cacheFile: cacheFile(),
    });
    // `bacaInboxDenganTanggal` resolves firstSeen as postedAt ?? scanHistoryDate,
    // and attaching the audit must not disturb that precedence.
    expect(rows[0].firstSeen).toBe("2026-09-20");
    expect(rows[0].audit.status).toBe("clean");
  });

  it("falls back to the scan-history date when the row has no posted date", async () => {
    writeFileSync(
      path.join(AKAR, "data", "scan-history.tsv"),
      "url\tfirst_seen\nhttps://id.jobstreet.com/id/job/555\t2026-09-01\n",
      "utf8",
    );
    write(["- [ ] https://id.jobstreet.com/id/job/555 | PT Foo | AI Engineer | Jakarta"]);
    const rows = await bacaInboxDiaudit({
      fetchJson: async () => listingJson("555"),
      cacheFile: cacheFile(),
    });
    expect(rows[0].firstSeen).toBe("2026-09-01");
    expect(rows[0].audit.status).toBe("clean");
  });
});
