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
const cacheFile = () => path.join(AKAR, "job-cache.json");

const write = (rows: string[]) =>
  writeFileSync(KOSONG, ["# Pipeline", "", "## Pending", "", ...rows, ""].join("\n"), "utf8");

/** One cache entry, keyed the way `perkayaSemua` writes it. */
const isiCache = (entries: Record<string, { board: string; description: string }>) => {
  const out: Record<string, unknown> = {};
  for (const [url, v] of Object.entries(entries)) {
    out[url] = {
      board: v.board,
      bahan: {
        description: v.description,
        apply_url: url,
        company: "PT Foo",
        employer_known: true,
      },
      diambilPada: "2026-09-29",
    };
  }
  writeFileSync(cacheFile(), JSON.stringify(out), "utf8");
};

describe("bacaInboxDiaudit", () => {
  it("returns an empty list, not an error, when the pipeline is empty", async () => {
    expect(await bacaInboxDiaudit({ cacheFile: cacheFile() })).toEqual([]);
  });

  it("gives every row a verdict and an enriched flag from the cache", async () => {
    write(["- [ ] https://id.jobstreet.com/id/job/111 | PT Foo | AI Engineer | Jakarta | posted: 2026-09-20"]);
    isiCache({ "https://id.jobstreet.com/id/job/111": { board: "Jobstreet", description: "Real work" } });
    const rows = await bacaInboxDiaudit({ cacheFile: cacheFile() });
    expect(rows).toHaveLength(1);
    expect(rows[0].enriched).toBe(true);
    expect(rows[0].audit.status).toBe("clean");
    expect(rows[0].firstSeen).toBeDefined();
  });

  it("marks a row missing from the cache as unenriched rather than clean", async () => {
    write(["- [ ] https://id.jobstreet.com/id/job/222 | PT Foo | AI Engineer | Jakarta | posted: 2026-09-20"]);
    const rows = await bacaInboxDiaudit({ cacheFile: cacheFile() });
    expect(rows[0].enriched).toBe(false);
    expect(rows[0].audit.status).not.toBe("clean");
  });

  it("enriches a non-Jobstreet row too, now that every board has an adapter", async () => {
    write(["- [ ] https://dealls.com/loker/software-engineer-ai~sirclo | Sirclo | Software Engineer AI"]);
    isiCache({
      "https://dealls.com/loker/software-engineer-ai~sirclo": { board: "Dealls", description: "Real work" },
    });
    const rows = await bacaInboxDiaudit({ cacheFile: cacheFile() });
    expect(rows[0].enriched).toBe(true);
    expect(rows[0].papan).toBe("Dealls");
  });

  it("names the board so the UI can say which one could not be read", async () => {
    write(["- [ ] https://kredivo-group.breezy.hr/p/abc-engineer | Kredivo Group | Fullstack Engineer"]);
    const rows = await bacaInboxDiaudit({ cacheFile: cacheFile() });
    expect(rows[0].enriched).toBe(false);
    expect(rows[0].papan).toBe("Breezy");
  });

  it("leaves a host no adapter claims without a board name", async () => {
    write(["- [ ] https://careers.allianz.com/job/9 | Allianz | PM | Jakarta | posted: 2026-09-20"]);
    const rows = await bacaInboxDiaudit({ cacheFile: cacheFile() });
    expect(rows[0].enriched).toBe(false);
    expect(rows[0].papan).toBeUndefined();
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
    isiCache({ "https://id.jobstreet.com/id/job/444": { board: "Jobstreet", description: "Real work" } });
    const rows = await bacaInboxDiaudit({ cacheFile: cacheFile() });
    expect(rows[0].firstSeen).toBe("2026-09-20");
    expect(rows[0].audit.status).toBe("clean");
  });
});
