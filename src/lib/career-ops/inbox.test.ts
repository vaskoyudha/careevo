import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// MUST be stubbed before the data-root module resolves, so this test never
// touches the repo's real `.data/career-ops`.
const AKAR = mkdtempSync(path.join(tmpdir(), "careevo-inbox-"));
vi.stubEnv("CAREER_OPS_ROOT", AKAR);

const { bacaInbox, bacaTanggalScan, bacaInboxDenganTanggal } = await import("./inbox");

beforeEach(() => {
  mkdirSync(path.join(AKAR, "data"), { recursive: true });
});

afterAll(() => {
  vi.unstubAllEnvs();
});

const KOSONG = path.join(AKAR, "data", "pipeline.md");
const SCAN_TSV = path.join(AKAR, "data", "scan-history.tsv");

describe("bacaInbox", () => {
  it("is an empty list, not an error, when pipeline.md does not exist yet", () => {
    expect(bacaInbox()).toEqual([]);
  });

  it("parses the rows the engine writes, preserving done state", () => {
    writeFileSync(
      KOSONG,
      [
        "# Pipeline",
        "",
        "## Pending",
        "",
        "- [ ] https://a.example/1 | Acme | Engineer | Jakarta | posted: 2026-09-18",
        "- [x] https://a.example/2 | Beta | Dev",
        "",
        "## Processed",
        "",
      ].join("\n"),
    );
    const rows = bacaInbox();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      url: "https://a.example/1",
      company: "Acme",
      role: "Engineer",
      location: "Jakarta",
      postedAt: "2026-09-18",
      done: false,
    });
    expect(rows[1]).toMatchObject({ url: "https://a.example/2", company: "Beta", role: "Dev", done: true });
  });
});

describe("bacaTanggalScan", () => {
  it("is an empty map when scan-history.tsv is missing", () => {
    expect(bacaTanggalScan().size).toBe(0);
  });

  it("maps url to first_seen, skipping the header", () => {
    writeFileSync(
      SCAN_TSV,
      "url\tfirst_seen\tportal\nhttps://a.example/1\t2026-09-18\tgreenhouse\nhttps://a.example/2\t2026-09-19\tlever\n",
    );
    const m = bacaTanggalScan();
    expect(m.get("https://a.example/1")).toBe("2026-09-18");
    expect(m.get("https://a.example/2")).toBe("2026-09-19");
  });

  // Upstream's comment here claims "earliest first_seen" but its code keeps the
  // FIRST-RECORDED row (`if (!dates.has(url))`). Those agree only because
  // scan-history.tsv is append-ordered by the scanner, so we copy the code, not
  // the aspirational comment. This test pins the real invariant: in an
  // append-ordered file the first-recorded date IS the earliest.
  it("keeps the first-recorded date for a url that recurs", () => {
    writeFileSync(
      SCAN_TSV,
      "url\tfirst_seen\tportal\nhttps://a.example/1\t2026-09-18\tgreenhouse\nhttps://a.example/1\t2026-09-20\tgreenhouse\n",
    );
    expect(bacaTanggalScan().get("https://a.example/1")).toBe("2026-09-18");
  });

  it("skips a malformed row rather than throwing", () => {
    writeFileSync(SCAN_TSV, "garbage\n\nhttps://a.example/1\t2026-09-18\tgreenhouse\n");
    expect(bacaTanggalScan().get("https://a.example/1")).toBe("2026-09-18");
  });

  it("ignores a first_seen that is not a date", () => {
    writeFileSync(SCAN_TSV, "url\tfirst_seen\tportal\nhttps://a.example/1\tnot-a-date\tgreenhouse\n");
    expect(bacaTanggalScan().size).toBe(0);
  });
});

describe("bacaInboxDenganTanggal", () => {
  it("prefers the row's own posted: label over the scan-history fallback", () => {
    writeFileSync(KOSONG, "- [ ] https://a.example/1 | Acme | Eng | Jakarta | posted: 2026-09-18\n");
    writeFileSync(SCAN_TSV, "url\tfirst_seen\tportal\nhttps://a.example/1\t2026-09-01\tgreenhouse\n");
    expect(bacaInboxDenganTanggal()[0]!.firstSeen).toBe("2026-09-18");
  });

  it("falls back to the scan date when the row carries no posted: label", () => {
    writeFileSync(KOSONG, "- [ ] https://a.example/2 | Acme | Eng\n");
    writeFileSync(SCAN_TSV, "url\tfirst_seen\tportal\nhttps://a.example/2\t2026-09-01\tgreenhouse\n");
    expect(bacaInboxDenganTanggal()[0]!.firstSeen).toBe("2026-09-01");
  });
});
