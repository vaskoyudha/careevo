import { describe, expect, it, vi } from "vitest";
import { breezy } from "./breezy";
import type { Io } from "./types";

const URL_BREEZY = "https://kredivo-group.breezy.hr/p/c43a53b3bc63-fullstack-engineer-sde-2";

/** Measured shape: description in `<div id="description">`, summary in og:description. */
const halaman = (isi: string, og = "") =>
  `<html><head>${og ? `<meta property="og:description" content="${og}">` : ""}</head>` +
  `<body><div id="description" class="container position-description">${isi}</div></body></html>`;

const io = (html: string): Io => ({
  fetchJson: vi.fn(),
  fetchHtml: vi.fn().mockResolvedValue({ html, urlAkhir: URL_BREEZY }),
});

describe("breezy adapter", () => {
  it("claims only <tenant>.breezy.hr urls", () => {
    expect(breezy.cocok(URL_BREEZY)).toBe(true);
    expect(breezy.cocok("https://jobs.smartrecruiters.com/X/1")).toBe(false);
  });

  it("reads the whole description block, not just the first paragraph", async () => {
    // The bug this guards: a non-greedy regex returned 79 chars where the real
    // block is 1725, so the audit judged an almost-empty description.
    const hasil = await breezy.ambilDetail(
      URL_BREEZY,
      io(halaman("<div><p>Intro.</p></div><p>Standing in SQL is a plus.</p>")),
      { perusahaan: "Kredivo Group" },
    );
    expect(hasil?.bahan.description).toContain("Intro.");
    expect(hasil?.bahan.description).toContain("Standing in SQL is a plus.");
  });

  it("strips Breezy's template tokens", async () => {
    const hasil = await breezy.ambilDetail(
      URL_BREEZY,
      io(halaman("%BREADCRUMB_JOB_OPENINGS% Fullstack Engineer %BUTTON_APPLY_TO_POSITION%")),
      { perusahaan: "Kredivo Group" },
    );
    expect(hasil?.bahan.description).toBe("Fullstack Engineer");
  });

  it("falls back to og:description when the container is empty", async () => {
    const hasil = await breezy.ambilDetail(
      URL_BREEZY,
      io(halaman("", "As a Fullstack Engineer, you will cover everything.")),
      { perusahaan: "Kredivo Group" },
    );
    expect(hasil?.bahan.description).toBe("As a Fullstack Engineer, you will cover everything.");
  });

  it("uses the pipeline company and keeps the posting url", async () => {
    const hasil = await breezy.ambilDetail(URL_BREEZY, io(halaman("<p>x</p>")), {
      perusahaan: "Kredivo Group",
    });
    expect(hasil?.bahan.company).toBe("Kredivo Group");
    expect(hasil?.bahan.apply_url).toBe(URL_BREEZY);
  });

  it("returns null when there is neither a container nor og:description", async () => {
    expect(await breezy.ambilDetail(URL_BREEZY, io("<html></html>"), { perusahaan: "X" })).toBeNull();
  });

  it("returns null for a url it does not own", async () => {
    expect(await breezy.ambilDetail("https://dealls.com/loker/a~b", io(halaman("<p>x</p>")), { perusahaan: "X" })).toBeNull();
  });
});
