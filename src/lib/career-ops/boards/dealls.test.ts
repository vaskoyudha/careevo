import { describe, expect, it, vi } from "vitest";
import { dealls } from "./dealls";
import type { Io } from "./types";

const URL_DEALLS = "https://dealls.com/loker/software-fullstack-engineer-pos-and~esb";

/** Measured shape: the job text lives in the first dehydrated query's data. */
const halaman = (data: Record<string, unknown>) =>
  `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        dehydratedState: { queries: [{ queryKey: ["job"], state: { data } }] },
      },
    },
  })}</script></body></html>`;

const io = (html: string): Io => ({
  fetchJson: vi.fn(),
  fetchHtml: vi.fn().mockResolvedValue({ html, urlAkhir: URL_DEALLS }),
});

describe("dealls adapter", () => {
  it("claims only dealls.com urls", () => {
    expect(dealls.cocok(URL_DEALLS)).toBe(true);
    expect(dealls.cocok("https://id.jobstreet.com/id/job/1")).toBe(false);
  });

  it("joins responsibilities and requirements", async () => {
    const hasil = await dealls.ambilDetail(
      URL_DEALLS,
      io(halaman({ responsibilities: "<p>Build POS.</p>", requirements: "<p>3 years.</p>" })),
      { perusahaan: "ESB" },
    );
    expect(hasil?.bahan.description).toBe("Build POS.\n3 years.");
  });

  it("reads the job query even when it is not the first one", async () => {
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          dehydratedState: {
            queries: [
              { state: { data: { unrelated: true } } },
              { state: { data: { responsibilities: "<p>Real</p>" } } },
            ],
          },
        },
      },
    })}</script>`;
    const hasil = await dealls.ambilDetail(URL_DEALLS, io(html), { perusahaan: "ESB" });
    expect(hasil?.bahan.description).toBe("Real");
  });

  it("prefers the page's company name over the pipeline fallback", async () => {
    const hasil = await dealls.ambilDetail(
      URL_DEALLS,
      io(halaman({ responsibilities: "<p>x</p>", company: { name: "CFACTORY.CO" } })),
      { perusahaan: "Stale Name" },
    );
    expect(hasil?.bahan.company).toBe("CFACTORY.CO");
  });

  it("prefers an off-platform externalPlatformApplyUrl", async () => {
    const hasil = await dealls.ambilDetail(
      URL_DEALLS,
      io(halaman({ responsibilities: "<p>x</p>", externalPlatformApplyUrl: "https://bit.ly/abc" })),
      { perusahaan: "ESB" },
    );
    expect(hasil?.bahan.apply_url).toBe("https://bit.ly/abc");
  });

  it("mengambil tag dari kategori peran dan subkategori", async () => {
    const hasil = await dealls.ambilDetail(
      URL_DEALLS,
      io(
        halaman({
          responsibilities: "<p>x</p>",
          jobRoleCategory: { name: "Engineering (IT/Software)" },
          jobRoleSubCategory: { name: "Enterprise Apps & Automation" },
        }),
      ),
      { perusahaan: "ESB" },
    );
    expect(hasil?.tags).toEqual(["Engineering (IT/Software)", "Enterprise Apps & Automation"]);
  });

  it("returns null when no query carries job text", async () => {
    expect(await dealls.ambilDetail(URL_DEALLS, io(halaman({ other: 1 })), { perusahaan: "X" })).toBeNull();
  });

  it("returns null when there is no __NEXT_DATA__ payload", async () => {
    expect(await dealls.ambilDetail(URL_DEALLS, io("<html></html>"), { perusahaan: "X" })).toBeNull();
  });

  it("returns null for a url it does not own", async () => {
    expect(await dealls.ambilDetail("https://id.jobstreet.com/id/job/1", io(halaman({})), { perusahaan: "X" })).toBeNull();
  });
});
