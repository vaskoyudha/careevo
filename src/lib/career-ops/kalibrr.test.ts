import path from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";

interface KalibrrItem {
  id?: number | string | null;
  name?: string | null;
  slug?: string | null;
  tenure?: string | null;
  company?: { code?: string; name?: string };
  company_name?: string | null;
  company_info?: { code?: string; name?: string };
  google_location?: {
    address_components?: {
      city?: string;
      region?: string;
      country?: string;
    };
  };
  activation_date?: string | null;
  created_at?: string | null;
  description?: string | null;
}

interface ParsedJob {
  title: string;
  url: string;
  company: string;
  location: string;
  postedAt?: number;
  description?: string;
}

interface KalibrrProvider {
  id: string;
  detect: (entry: Record<string, unknown>) => unknown;
  fetch: (
    entry: Record<string, unknown>,
    ctx: { fetchJson: (url: string, opts?: Record<string, unknown>) => Promise<unknown> },
  ) => Promise<ParsedJob[]>;
}

let parseKalibrrItem: (
  item: unknown,
  fallbackCompany?: string,
  options?: { appendWorkType?: boolean },
) => ParsedJob | null;
let kalibrrProvider: KalibrrProvider;

beforeAll(async () => {
  const providerPath = path.resolve(process.cwd(), "engine", "providers", "kalibrr.mjs");
  const mod = await import(/* @vite-ignore */ pathToFileURL(providerPath).href);
  parseKalibrrItem = mod.parseKalibrrItem;
  kalibrrProvider = mod.default;
});

describe("parseKalibrrItem", () => {
  it("parses a standard Kalibrr job item into canonical shape", () => {
    const raw: KalibrrItem = {
      id: 272641,
      name: "Data Engineer",
      slug: "data-engineer-4",
      tenure: "Contractual",
      company: {
        code: "metrodata",
        name: "PT Metrodata Electronics, Tbk",
      },
      google_location: {
        address_components: {
          city: "West Jakarta",
          region: "DKI Jakarta",
          country: "Indonesia",
        },
      },
      activation_date: "2026-09-18T04:53:41.725094+00:00",
      description: "<p>We are looking for an experienced <strong>Data Engineer</strong>.</p>",
    };

    const parsed = parseKalibrrItem(raw, "Fallback Co");
    expect(parsed).toEqual({
      title: "Data Engineer",
      url: "https://www.kalibrr.com/c/metrodata/jobs/272641/data-engineer-4",
      company: "PT Metrodata Electronics, Tbk",
      location: "West Jakarta, DKI Jakarta, Indonesia",
      postedAt: Date.parse("2026-09-18T04:53:41.725094+00:00"),
      description: "We are looking for an experienced Data Engineer .",
    });
  });

  it("appends tenure to title when appendWorkType is enabled", () => {
    const raw: KalibrrItem = {
      id: 12345,
      name: "Fullstack Developer",
      slug: "fullstack-dev",
      tenure: "Full time",
      company_name: "Startup ID",
    };

    const parsed = parseKalibrrItem(raw, "", { appendWorkType: true });
    expect(parsed?.title).toBe("Fullstack Developer [Full time]");
  });

  it("falls back to entry company name and constructs slug URL when company code is absent", () => {
    const raw: KalibrrItem = {
      id: 99999,
      name: "Frontend Engineer",
      slug: "frontend-engineer",
    };

    const parsed = parseKalibrrItem(raw, "Default Company");
    expect(parsed?.company).toBe("Default Company");
    expect(parsed?.url).toBe("https://www.kalibrr.com/jobs/99999/frontend-engineer");
  });

  it("returns null when item is empty, missing name, or missing id", () => {
    expect(parseKalibrrItem(null)).toBeNull();
    expect(parseKalibrrItem({})).toBeNull();
    expect(parseKalibrrItem({ name: "   " })).toBeNull();
    expect(parseKalibrrItem({ name: "Developer", id: "" })).toBeNull();
  });
});

describe("kalibrr provider object", () => {
  it("exposes expected provider interface", () => {
    expect(kalibrrProvider.id).toBe("kalibrr");
    expect(typeof kalibrrProvider.fetch).toBe("function");
    expect(kalibrrProvider.detect({})).toBeNull();
  });

  it("fetches and parses jobs using provided transport context", async () => {
    const mockJobs = [
      {
        id: 101,
        name: "Backend Developer",
        slug: "backend-dev",
        company_name: "Bank Mandiri",
        google_location: {
          address_components: { city: "Jakarta", country: "Indonesia" },
        },
      },
    ];

    const fetchJson = vi.fn().mockResolvedValue({ jobs: mockJobs });
    const ctx = { fetchJson };

    const results = await kalibrrProvider.fetch(
      {
        searchKeywords: "backend developer",
        countryCode: "ID",
        pageSize: 10,
        maxPages: 1,
      },
      ctx,
    );

    expect(fetchJson).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchJson.mock.calls[0][0]);
    expect(calledUrl).toContain("https://www.kalibrr.com/api/job_board/search");
    expect(calledUrl).toContain("text=backend+developer");
    expect(calledUrl).toContain("country=Indonesia");
    expect(calledUrl).toContain("limit=10");

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Backend Developer");
    expect(results[0].company).toBe("Bank Mandiri");
    expect(results[0].location).toBe("Jakarta, Indonesia");
  });
});
