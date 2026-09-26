import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bacaCache, perkaya, tulisCache, type FetchJson } from "./jobstreet-enrich";
import type { ListingJobstreet } from "./jobstreet-audit";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "jobstreet-enrich-"));
  process.env.CAREERVO_JOBSTREET_CACHE = path.join(dir, "cache.json");
});

afterEach(async () => {
  delete process.env.CAREERVO_JOBSTREET_CACHE;
  await rm(dir, { recursive: true, force: true });
});

const satuListing = (id: string): ListingJobstreet => ({
  id,
  title: "AI Engineer",
  teaser: "",
  bulletPoints: [],
  companyName: "PT Foo",
  employer: { id: "1", name: "PT Foo" },
});

const listingJson = (id: string) => ({ data: [satuListing(id)] });

describe("bacaCache / tulisCache", () => {
  it("round-trips a listing", async () => {
    await tulisCache({ "1": satuListing("1") });
    expect((await bacaCache())["1"].title).toBe("AI Engineer");
  });

  it("returns an empty object when the cache file does not exist", async () => {
    expect(await bacaCache()).toEqual({});
  });

  it("returns an empty object when the cache file is corrupt", async () => {
    await writeFile(process.env.CAREERVO_JOBSTREET_CACHE!, "{not json", "utf8");
    expect(await bacaCache()).toEqual({});
  });
});

describe("perkaya", () => {
  it("does not re-fetch an id already in the cache", async () => {
    await tulisCache({ "7": satuListing("7") });
    let calls = 0;
    const fetchJson: FetchJson = async () => {
      calls++;
      return listingJson("7");
    };
    const out = await perkaya(["7"], fetchJson);
    expect(calls).toBe(0);
    expect(out["7"].title).toBe("AI Engineer");
  });

  it("fetches an id it has not seen and keeps the result", async () => {
    const fetchJson: FetchJson = async () => listingJson("9");
    const out = await perkaya(["9"], fetchJson);
    expect(out["9"].id).toBe("9");
    expect((await bacaCache())["9"].id).toBe("9");
  });

  it("skips a failed lookup without failing the whole batch", async () => {
    const fetchJson: FetchJson = async (url) => {
      if (url.includes("42")) throw new Error("HTTP 500");
      return listingJson("1");
    };
    const out = await perkaya(["42", "1"], fetchJson);
    expect(out["42"]).toBeUndefined();
    expect(out["1"].id).toBe("1");
  });

  it("requests the documented single-job endpoint", async () => {
    const seen: string[] = [];
    const fetchJson: FetchJson = async (url) => {
      seen.push(url);
      return listingJson("5");
    };
    await perkaya(["5"], fetchJson);
    expect(seen[0]).toContain("jobId=5");
    expect(seen[0]).toContain("siteKey=ID-Main");
  });
});
