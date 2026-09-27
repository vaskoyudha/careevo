import path from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";

interface DeallsDoc {
  id?: string | null;
  role?: string | null;
  slug?: string | null;
  workplaceType?: string | null;
  company?: { name?: string; slug?: string; sector?: string };
  city?: { name?: string };
  country?: { name?: string };
  publishedAt?: string | null;
  skills?: Array<{ name?: string }>;
}

interface ParsedJob {
  title: string;
  url: string;
  company: string;
  location: string;
  postedAt?: number;
  description?: string;
}

interface DeallsProvider {
  id: string;
  detect: (entry: Record<string, unknown>) => unknown;
  fetch: (
    entry: Record<string, unknown>,
    ctx: { fetchJson: (url: string, opts?: Record<string, unknown>) => Promise<unknown> },
  ) => Promise<ParsedJob[]>;
}

let parseDeallsItem: (
  item: unknown,
  fallbackCompany?: string,
  options?: { appendWorkType?: boolean },
) => ParsedJob | null;
let deallsProvider: DeallsProvider;

beforeAll(async () => {
  const providerPath = path.resolve(process.cwd(), "engine", "providers", "dealls.mjs");
  const mod = await import(/* @vite-ignore */ pathToFileURL(providerPath).href);
  parseDeallsItem = mod.parseDeallsItem;
  deallsProvider = mod.default;
});

describe("parseDeallsItem", () => {
  it("parses a standard Dealls job item into canonical shape", () => {
    const raw: DeallsDoc = {
      id: "6ab853ce377e4000120f64af",
      role: "Backend Engineer",
      slug: "backend-engineer-esb",
      workplaceType: "hybrid",
      company: {
        name: "ESB",
        slug: "esb",
        sector: "SaaS",
      },
      city: { name: "Tangerang" },
      country: { name: "Indonesia" },
      publishedAt: "2026-09-26T23:22:54.779Z",
      skills: [{ name: "Node.js" }, { name: "PostgreSQL" }],
    };

    const parsed = parseDeallsItem(raw, "Fallback Co");
    expect(parsed).toEqual({
      title: "Backend Engineer",
      url: "https://dealls.com/loker/backend-engineer-esb~esb",
      company: "ESB",
      location: "Tangerang, Indonesia",
      postedAt: Date.parse("2026-09-26T23:22:54.779Z"),
      description: "Required skills: Node.js, PostgreSQL. Workplace: hybrid. Industry: SaaS",
    });
  });

  it("appends workplaceType when appendWorkType is enabled", () => {
    const raw: DeallsDoc = {
      id: "abc",
      role: "Frontend Engineer",
      slug: "frontend-engineer",
      workplaceType: "remote",
    };

    const parsed = parseDeallsItem(raw, "Dealls", { appendWorkType: true });
    expect(parsed?.title).toBe("Frontend Engineer [remote]");
  });

  it("returns null for malformed items", () => {
    expect(parseDeallsItem(null)).toBeNull();
    expect(parseDeallsItem({})).toBeNull();
    expect(parseDeallsItem({ role: "" })).toBeNull();
  });
});

describe("dealls provider object", () => {
  it("exposes expected provider interface", () => {
    expect(deallsProvider.id).toBe("dealls");
    expect(typeof deallsProvider.fetch).toBe("function");
    expect(deallsProvider.detect({})).toBeNull();
  });

  it("fetches and parses jobs using provided transport context", async () => {
    const mockDocs = [
      {
        id: "doc1",
        role: "DevOps Engineer",
        slug: "devops-engineer",
        company: { name: "Vidio", slug: "vidio" },
        city: { name: "Jakarta Pusat" },
        country: { name: "Indonesia" },
      },
    ];

    const fetchJson = vi.fn().mockResolvedValue({
      data: {
        docs: mockDocs,
        totalDocs: 1,
        totalPages: 1,
      },
    });
    const ctx = { fetchJson };

    const results = await deallsProvider.fetch(
      {
        searchKeywords: "devops",
        pageSize: 10,
        maxPages: 1,
      },
      ctx,
    );

    expect(fetchJson).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchJson.mock.calls[0][0]);
    expect(calledUrl).toContain("https://api.sejutacita.id/v1/explore-job/job");
    expect(calledUrl).toContain("search=devops");
    expect(calledUrl).toContain("limit=10");

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("DevOps Engineer");
    expect(results[0].company).toBe("Vidio");
    expect(results[0].location).toBe("Jakarta Pusat, Indonesia");
    expect(results[0].url).toBe("https://dealls.com/loker/devops-engineer~vidio");
  });
});
