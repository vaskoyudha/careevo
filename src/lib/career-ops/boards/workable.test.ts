import { describe, expect, it, vi } from "vitest";
import { workable } from "./workable";
import type { Io } from "./types";

const URL_WORKABLE = "https://apply.workable.com/j/B2B2EFD9D7";

/** Measured shape of `/api/v1/accounts/<slug>/jobs/<shortcode>`. */
const detail = (over: Record<string, unknown> = {}) => ({
  title: "Account Manager (Telco)",
  shortcode: "B2B2EFD9D7",
  description: "<p>About Us</p><p>INDICO is Telkomsel Group's digital company.</p>",
  requirements: "<p>3+ years of experience.</p>",
  ...over,
});

const io = (
  opts: { detail?: unknown; urlAkhir?: string; detailThrows?: boolean } = {},
): Io => ({
  fetchJson: opts.detailThrows
    ? vi.fn().mockRejectedValue(new Error("HTTP 500"))
    : vi.fn().mockResolvedValue(opts.detail ?? detail()),
  fetchHtml: vi.fn().mockResolvedValue({
    html: "<html></html>",
    urlAkhir: opts.urlAkhir ?? "https://apply.workable.com/indico/j/B2B2EFD9D7",
  }),
});

describe("workable adapter", () => {
  it("claims only apply.workable.com urls", () => {
    expect(workable.cocok(URL_WORKABLE)).toBe(true);
    expect(workable.cocok("https://www.kalibrr.com/c/a/jobs/1/b")).toBe(false);
  });

  it("resolves the account slug from the redirect, then fetches that account's job", async () => {
    const fake = io();
    await workable.ambilDetail(URL_WORKABLE, fake, { perusahaan: "INDICO" });

    expect(fake.fetchHtml).toHaveBeenCalledWith(URL_WORKABLE);
    const url = String((fake.fetchJson as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(url).toBe("https://apply.workable.com/api/v1/accounts/indico/jobs/B2B2EFD9D7");
  });

  it("joins description and requirements into plain text", async () => {
    const hasil = await workable.ambilDetail(URL_WORKABLE, io(), { perusahaan: "INDICO" });
    expect(hasil?.bahan.description).toBe(
      "About Us\nINDICO is Telkomsel Group's digital company.\n3+ years of experience.",
    );
  });

  it("skips the redirect when the url already carries the slug", async () => {
    const fake = io();
    await workable.ambilDetail("https://apply.workable.com/indico/j/B2B2EFD9D7", fake, {
      perusahaan: "INDICO",
    });
    expect(fake.fetchHtml).not.toHaveBeenCalled();
  });

  it("uses the pipeline company, since the job endpoint names none", async () => {
    const hasil = await workable.ambilDetail(URL_WORKABLE, io(), { perusahaan: "INDICO" });
    expect(hasil?.bahan.company).toBe("INDICO");
    expect(hasil?.bahan.employer_known).toBe(true);
  });

  it("returns null when the redirect does not resolve a slug", async () => {
    const hasil = await workable.ambilDetail(URL_WORKABLE, io({ urlAkhir: "https://apply.workable.com/j/B2B2EFD9D7" }), {
      perusahaan: "INDICO",
    });
    expect(hasil).toBeNull();
  });

  it("returns null when the job endpoint has no description", async () => {
    const hasil = await workable.ambilDetail(URL_WORKABLE, io({ detail: detail({ description: "", requirements: "" }) }), {
      perusahaan: "INDICO",
    });
    expect(hasil).toBeNull();
  });

  it("returns null for a url it does not own", async () => {
    expect(await workable.ambilDetail("https://dealls.com/loker/a~b", io(), { perusahaan: "X" })).toBeNull();
  });
});
