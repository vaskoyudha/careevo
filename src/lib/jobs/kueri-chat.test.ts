import { describe, expect, it } from "vitest";
import { uraiKueri, teksLoker } from "./kueri-chat";
import { buatFilterKonten } from "./filters";
import { jobs, visibleJobs } from "@/lib/fixtures";

/**
 * These assertions are pinned to the real fixture corpus, not to invented jobs.
 * The two bugs this module exists to fix were both measured against it: the
 * Bandung posting's description literally starts with "Lowongan", and no Jakarta
 * posting mentions its city anywhere except `location`.
 */

const cari = (q: string) => {
  const terms = uraiKueri(q);
  // AND across terms, one ported filter each — the rule stays single-sourced.
  const perTerm = terms.map((t) => buatFilterKonten({ positive: [t] }));
  return visibleJobs()
    .filter((job) => {
      const teks = teksLoker(job);
      return perTerm.every((f) => f(teks));
    })
    .map((job) => job.title);
};

describe("uraiKueri", () => {
  it("drops the filler words a job query is wrapped in", () => {
    expect(uraiKueri("lowongan remote")).toEqual(["remote"]);
    expect(uraiKueri("cari lowongan kerja react")).toEqual(["react"]);
  });

  it("keeps every word that discriminates", () => {
    expect(uraiKueri("react")).toEqual(["react"]);
    expect(uraiKueri("jakarta")).toEqual(["jakarta"]);
    expect(uraiKueri("lowongan react remote jakarta")).toEqual([
      "react",
      "remote",
      "jakarta",
    ]);
  });

  it("splits on punctuation so a compound token is not one term", () => {
    expect(uraiKueri("React/Node")).toEqual(["react", "node"]);
    // "Rp6-8" splits into "rp6" and "8", and the one-character fragment falls
    // below the minimum — the assertion that matters is that "rp68" is not a term.
    expect(uraiKueri("Rp6-8")).toEqual(["rp6"]);
  });

  it("keeps a two-character term and drops a one-character one", () => {
    expect(uraiKueri("js")).toEqual(["js"]);
    expect(uraiKueri("a c go")).toEqual(["go"]);
  });

  it("de-duplicates and is case-insensitive", () => {
    expect(uraiKueri("React react REACT")).toEqual(["react"]);
  });

  it("returns nothing for a query that is only filler", () => {
    expect(uraiKueri("lowongan")).toEqual([]);
    expect(uraiKueri("   ")).toEqual([]);
    expect(uraiKueri("")).toEqual([]);
  });
});

describe("cari — the chat query against the real board", () => {
  it('"lowongan remote" no longer drags in the Bandung posting', () => {
    const hasil = cari("lowongan remote");
    expect(hasil).toContain("Fullstack Engineer (React/Node)");
    expect(hasil).toContain("React Native Developer");
    expect(hasil).not.toContain("Web Developer");
  });

  it('"jakarta" now matches, because location is searched', () => {
    const hasil = cari("jakarta");
    expect(hasil).toContain("Frontend Engineer (Junior)");
    expect(hasil).toContain("Backend Engineer (Node.js)");
  });

  it("requires every term, so two words narrow rather than widen", () => {
    const semuaRemote = cari("remote");
    expect(semuaRemote.length).toBeGreaterThan(1);
    // React AND remote is a strict subset of React OR remote.
    expect(cari("react remote").length).toBeLessThan(cari("react").length);
    expect(cari("react remote").every((t) => semuaRemote.includes(t))).toBe(true);
  });

  it("returns the whole visible board for a filler-only query", () => {
    expect(cari("lowongan")).toHaveLength(visibleJobs().length);
  });

  it("never returns a rejected posting", () => {
    const visible = new Set(visibleJobs().map((j) => j.id));
    for (const q of ["react", "jakarta", "remote", "magang", "apk"]) {
      for (const title of cari(q)) {
        const job = jobs.find((j) => j.title === title);
        expect(job).toBeDefined();
        expect(visible.has(job!.id)).toBe(true);
      }
    }
  });
});

describe("teksLoker", () => {
  it("includes location and tags, not just the description", () => {
    const teks = teksLoker(jobs[0]);
    expect(teks).toContain("Jakarta");
    expect(teks).toContain("TypeScript");
  });
});
