import { describe, expect, it } from "vitest";
import { normalisasiKunciUrl } from "@/lib/career-ops/url-key";
import { cariBarisTracker, kunciTeks } from "@/lib/career-ops/match-tracker";
import type { BarisTracker } from "@/lib/career-ops/types";

/**
 * url-key.ts mirrors engine/url-key.mjs's `normalizeUrl`, and match-tracker.ts
 * mirrors the engine's tracker-row resolution precedence. These tests pin the
 * mirror to the engine's documented behaviour, so a drift between the two — the
 * silent disagreement career-ops' web/AGENTS.md warns about — fails here.
 *
 * The engine itself is not imported (it is a vendored .mjs tree outside the
 * build graph); these are the same cases its own url-key module encodes.
 */
describe("normalisasiKunciUrl (parity with engine/url-key.mjs normalizeUrl)", () => {
  it("returns empty string for non-URL input", () => {
    expect(normalisasiKunciUrl("")).toBe("");
    expect(normalisasiKunciUrl(null)).toBe("");
    expect(normalisasiKunciUrl("N/A")).toBe("");
    expect(normalisasiKunciUrl("local:jds/foo.pdf")).toBe("");
    expect(normalisasiKunciUrl("mailto:hr@example.com")).toBe("");
  });

  it("lowercases the host and forces https", () => {
    expect(normalisasiKunciUrl("HTTP://Example.COM/jobs/1")).toBe(
      "https://example.com/jobs/1",
    );
  });

  it("drops a single trailing slash on a path but never the root", () => {
    expect(normalisasiKunciUrl("https://example.com/jobs/1/")).toBe(
      "https://example.com/jobs/1",
    );
    expect(normalisasiKunciUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("strips tracking params and keeps functional ones, sorted", () => {
    expect(normalisasiKunciUrl("https://a.co/jobs/1?utm_source=x&gh_jid=42&fbclid=1")).toBe(
      "https://a.co/jobs/1?gh_jid=42",
    );
  });

  it("does NOT strip generic names like ref or source", () => {
    expect(normalisasiKunciUrl("https://a.co/jobs/1?ref=home&source=search")).toBe(
      "https://a.co/jobs/1?ref=home&source=search",
    );
  });

  it("drops unrecognized fragments", () => {
    expect(normalisasiKunciUrl("https://a.co/jobs/1#section")).toBe(
      "https://a.co/jobs/1",
    );
  });
});

describe("kunciTeks (parity with engine normalizeTextKey)", () => {
  it("folds case, punctuation and whitespace", () => {
    expect(kunciTeks("PT Nusantara Digital")).toBe("ptnusantaradigital");
    expect(kunciTeks("  PT. NUSANTARA-DIGITAL  ")).toBe("ptnusantaradigital");
  });

  it("is script-preserving (does not collapse non-Latin names to empty)", () => {
    expect(kunciTeks("アクメ株式会社")).not.toBe("");
    expect(kunciTeks("Яндекс")).not.toBe("");
  });
});

describe("cariBarisTracker", () => {
  const baris = (over: Partial<BarisTracker>): BarisTracker => ({
    id: 1,
    date: "2026-09-25",
    company: "PT Nusantara Digital",
    role: "Frontend Engineer (Junior)",
    score: "4.5/5",
    status: "Evaluated",
    pdf: "❌",
    report: "[1](../reports/1-pt-nusantara-digital-2026-09-25.md)",
    notes: "",
    ...over,
  });

  it("matches by URL when both sides carry one", () => {
    const rows = [
      baris({ id: 1, url: "https://nusantaradigital.co.id/karier/frontend-engineer" }),
      baris({ id: 2, company: "Other", role: "Other", url: "https://other.example/jobs/9" }),
    ];
    const match = cariBarisTracker(rows, {
      company: "PT Nusantara Digital",
      title: "Frontend Engineer (Junior)",
      apply_url: "https://nusantaradigital.co.id/karier/frontend-engineer",
    });
    expect(match?.id).toBe(1);
  });

  it("a confirmed URL mismatch proves NOT duplicate, even with same company+role", () => {
    const rows = [
      baris({ id: 1, url: "https://other.example/jobs/9" }),
    ];
    const match = cariBarisTracker(rows, {
      company: "PT Nusantara Digital",
      title: "Frontend Engineer (Junior)",
      apply_url: "https://nusantaradigital.co.id/karier/frontend-engineer",
    });
    expect(match).toBeNull();
  });

  it("falls back to company+role when no row carries a URL", () => {
    const rows = [baris({ id: 1 })];
    const match = cariBarisTracker(rows, {
      company: "PT Nusantara Digital",
      title: "Frontend Engineer (Junior)",
      apply_url: null,
    });
    expect(match?.id).toBe(1);
  });

  it("returns null when the company is absent", () => {
    const rows = [baris({ id: 1, company: "Other" })];
    expect(cariBarisTracker(rows, { company: "Nobody", title: "x", apply_url: null })).toBeNull();
  });
});
