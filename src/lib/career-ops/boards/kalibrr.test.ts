import { describe, expect, it, vi } from "vitest";
import { kalibrr } from "./kalibrr";
import type { Io } from "./types";

/** The real `__NEXT_DATA__` shape, measured 2026-09-29. */
const halaman = (job: Record<string, unknown>) =>
  `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { job } },
  })}</script></body></html>`;

const io = (html: string): Io => ({
  fetchJson: vi.fn(),
  fetchHtml: vi.fn().mockResolvedValue({ html, urlAkhir: "https://www.kalibrr.com/x" }),
});

const URL_KALIBRR = "https://www.kalibrr.com/c/pt-akhdani-reka-solusi/jobs/264597/software-engineer-6";

describe("kalibrr adapter", () => {
  it("claims kalibrr urls only", () => {
    expect(kalibrr.cocok(URL_KALIBRR)).toBe(true);
    expect(kalibrr.cocok("https://id.jobstreet.com/id/job/1")).toBe(false);
  });

  it("joins description and qualifications, stripped of HTML", async () => {
    const hasil = await kalibrr.ambilDetail(
      URL_KALIBRR,
      io(
        halaman({
          description: "<p>Develop and maintain web apps.</p>",
          qualifications: "<p>5 years in IT.</p>",
          company: { code: "pt-akhdani-reka-solusi", name: "PT Akhdani Reka Solusi" },
        }),
      ),
      { perusahaan: "ignored" },
    );
    expect(hasil?.bahan.description).toBe("Develop and maintain web apps.\n5 years in IT.");
    expect(hasil?.bahan.company).toBe("PT Akhdani Reka Solusi");
  });

  it("prefers an off-platform apply_redirect_url", async () => {
    const hasil = await kalibrr.ambilDetail(
      URL_KALIBRR,
      io(halaman({ description: "<p>x</p>", apply_redirect_url: "https://bit.ly/abc" })),
      { perusahaan: "PT Foo" },
    );
    expect(hasil?.bahan.apply_url).toBe("https://bit.ly/abc");
  });

  it("falls back to the pipeline company when the page names none", async () => {
    const hasil = await kalibrr.ambilDetail(
      URL_KALIBRR,
      io(halaman({ description: "<p>x</p>" })),
      { perusahaan: "PT Dari Pipeline" },
    );
    expect(hasil?.bahan.company).toBe("PT Dari Pipeline");
    expect(hasil?.bahan.employer_known).toBe(true);
  });

  it("returns null when the page carries no description", async () => {
    expect(await kalibrr.ambilDetail(URL_KALIBRR, io(halaman({})), { perusahaan: "X" })).toBeNull();
  });

  it("returns null when there is no __NEXT_DATA__ payload", async () => {
    expect(await kalibrr.ambilDetail(URL_KALIBRR, io("<html></html>"), { perusahaan: "X" })).toBeNull();
  });

  it("returns null for a url it does not own", async () => {
    expect(
      await kalibrr.ambilDetail("https://dealls.com/loker/a~b", io(halaman({})), { perusahaan: "X" }),
    ).toBeNull();
  });

  it("carries the job function as a tag", async () => {
    const hasil = await kalibrr.ambilDetail(
      URL_KALIBRR,
      io(halaman({ description: "<p>x</p>", function: "Software Development" })),
      { perusahaan: "X" },
    );
    expect(hasil?.tags).toEqual(["Software Development"]);
  });
});
