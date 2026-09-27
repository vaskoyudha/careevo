import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bacaCache, perkayaSemua, tulisCache, type EntriCache } from "./job-cache";
import type { Io } from "./boards/types";
import type { InboxJobShape } from "./pipeline-table";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "job-cache-"));
  process.env.CAREERVO_JOB_CACHE = path.join(dir, "enrichment.json");
  process.env.CAREERVO_JOBSTREET_CACHE = path.join(dir, "listings.json");
});

afterEach(async () => {
  delete process.env.CAREERVO_JOB_CACHE;
  delete process.env.CAREERVO_JOBSTREET_CACHE;
  await rm(dir, { recursive: true, force: true });
});

const baris = (url: string, company = "Acme"): InboxJobShape => ({
  url,
  company,
  role: "Software Engineer",
  done: false,
});

const entri = (over: Partial<EntriCache> = {}): EntriCache => ({
  board: "Kalibrr",
  bahan: {
    description: "Build things.",
    apply_url: "https://www.kalibrr.com/c/a/jobs/1/b",
    company: "Acme",
    employer_known: true,
  },
  diambilPada: "2026-09-29",
  ...over,
});

const ioDengan = (handler: (url: string) => Promise<unknown>): Io => ({
  fetchJson: vi.fn().mockImplementation(handler),
  fetchHtml: vi.fn().mockImplementation(async () => ({ html: "<html></html>", urlAkhir: "" })),
});

describe("bacaCache / tulisCache", () => {
  it("round-trips an entry", async () => {
    await tulisCache({ "https://a.test/1": entri() });
    expect((await bacaCache())["https://a.test/1"].bahan.description).toBe("Build things.");
  });

  it("is an empty cache, not an error, when the file does not exist", async () => {
    expect(await bacaCache()).toEqual({});
  });

  it("is an empty cache, not an error, when the file is corrupt", async () => {
    await writeFile(process.env.CAREERVO_JOB_CACHE!, "{not json", "utf8");
    expect(await bacaCache()).toEqual({});
  });
});

describe("perkayaSemua", () => {
  it("does not re-fetch a URL already in the cache", async () => {
    const kunci = "https://www.kalibrr.com/c/a/jobs/1/b";
    await tulisCache({ [kunci]: entri() });
    const io = ioDengan(async () => ({ data: [] }));
    const out = await perkayaSemua([baris(kunci)], io);
    expect(io.fetchJson).not.toHaveBeenCalled();
    expect(out[kunci].bahan.description).toBe("Build things.");
  });

  it("leaves a URL whose board no adapter claims untouched", async () => {
    const io = ioDengan(async () => ({ data: [] }));
    const out = await perkayaSemua([baris("https://careers.allianz.com/job/1")], io);
    expect(Object.keys(out)).toEqual([]);
    expect(io.fetchJson).not.toHaveBeenCalled();
  });

  it("keeps a failed fetch out of the cache without failing the batch", async () => {
    const gagal = "https://jobs.smartrecruiters.com/Acme/1";
    const sukses = "https://jobs.smartrecruiters.com/Acme/2";
    const io = ioDengan(async (url) => {
      if (url.includes("/postings/1")) throw new Error("HTTP 500");
      return {
        applyUrl: "",
        jobAd: { sections: { jobDescription: { text: "<p>Real work.</p>" } } },
      };
    });
    const out = await perkayaSemua([baris(gagal), baris(sukses)], io);
    expect(out[gagal]).toBeUndefined();
    expect(out[sukses]?.bahan.description).toBe("Real work.");
    expect(out[sukses]?.board).toBe("SmartRecruiters");
  });

  it("writes what it fetched, so the next call is a cache hit", async () => {
    const url = "https://jobs.smartrecruiters.com/Acme/2";
    const io = ioDengan(async () => ({
      applyUrl: "",
      jobAd: { sections: { jobDescription: { text: "<p>Real work.</p>" } } },
    }));
    await perkayaSemua([baris(url)], io);
    expect((await bacaCache())["https://jobs.smartrecruiters.com/Acme/2"].board).toBe(
      "SmartRecruiters",
    );
  });

  it("never exceeds the concurrency limit", async () => {
    let aktif = 0;
    let puncak = 0;
    const io = ioDengan(async () => {
      aktif++;
      puncak = Math.max(puncak, aktif);
      await new Promise((r) => setTimeout(r, 5));
      aktif--;
      return { applyUrl: "", jobAd: { sections: { jobDescription: { text: "<p>x</p>" } } } };
    });
    const rows = Array.from({ length: 12 }, (_, i) =>
      baris(`https://jobs.smartrecruiters.com/Acme/${i + 100}`),
    );
    await perkayaSemua(rows, io, { konkurensi: 3 });
    expect(puncak).toBeLessThanOrEqual(3);
  });
});

describe("migration from the old Jobstreet cache", () => {
  it("maps {jobstreetId -> listing} onto URL keys without touching the network", async () => {
    await writeFile(
      process.env.CAREERVO_JOBSTREET_CACHE!,
      JSON.stringify({
        "94839531": {
          id: "94839531",
          title: "AI Engineer",
          teaser: "Build React dashboards",
          bulletPoints: ["TypeScript required"],
          companyName: "YO AI Labs",
          employer: { id: "1", name: "YO AI Labs" },
        },
      }),
      "utf8",
    );

    const io = ioDengan(async () => {
      throw new Error("migration must not fetch");
    });
    const url = "https://id.jobstreet.com/id/job/94839531";
    const out = await perkayaSemua([baris(url, "YO AI Labs")], io);

    expect(io.fetchJson).not.toHaveBeenCalled();
    expect(out["https://id.jobstreet.com/id/job/94839531"].board).toBe("Jobstreet");
    expect(out["https://id.jobstreet.com/id/job/94839531"].bahan.description).toContain(
      "TypeScript required",
    );
    // And it is persisted, so the migration happens once.
    expect((await bacaCache())["https://id.jobstreet.com/id/job/94839531"]).toBeDefined();
  });
});
