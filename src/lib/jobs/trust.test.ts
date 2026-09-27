import { describe, expect, it } from "vitest";
import {
  ATS_DIIZINKAN,
  cocokDaftarDomain,
  foldAsciiUntukHostname,
  klasifikasiLevel,
  nilaiKepercayaan,
  perusahaanCocokHostname,
  urlValid,
} from "@/lib/jobs/trust";

/**
 * Tests for the trust validator ported from career-ops (MIT).
 *
 * These lock the behaviour that matters: the validator must never invent a
 * mismatch (false penalties are the costly failure on a legitimacy check), and
 * must still catch the three signals it exists for.
 */

describe("urlValid", () => {
  it("accepts http and https", () => {
    expect(urlValid("https://example.com/jobs/1")).toBe(true);
    expect(urlValid("http://example.com")).toBe(true);
  });

  it("rejects malformed URLs and non-http protocols", () => {
    expect(urlValid("not a url")).toBe(false);
    expect(urlValid("javascript:alert(1)")).toBe(false);
    expect(urlValid("")).toBe(false);
  });
});

describe("cocokDaftarDomain", () => {
  it("matches the domain and its subdomains", () => {
    expect(cocokDaftarDomain("bit.ly", ["bit.ly"])).toBe(true);
    expect(cocokDaftarDomain("abc.bit.ly", ["bit.ly"])).toBe(true);
  });

  it("does not match a domain that merely contains the entry", () => {
    // "notbit.ly" must not match "bit.ly" — suffix matching, not substring.
    expect(cocokDaftarDomain("notbit.ly", ["bit.ly"])).toBe(false);
    expect(cocokDaftarDomain("bit.ly.evil.com", ["bit.ly"])).toBe(false);
  });
});

describe("foldAsciiUntukHostname", () => {
  it("folds accented Latin to its ASCII base letter", () => {
    expect(foldAsciiUntukHostname("Telefónica")).toBe("telefonica");
    expect(foldAsciiUntukHostname("Société Générale")).toBe("societe generale");
  });

  it("folds non-decomposing letters rather than deleting them", () => {
    expect(foldAsciiUntukHostname("Işık")).toBe("isik");
    expect(foldAsciiUntukHostname("Ørsted")).toBe("orsted");
  });

  it("deletes punctuation instead of splitting it into words", () => {
    // Upstream's deliberate 'delete' mode: "Smith&Jones" must stay ONE token so
    // "smith" cannot substring-match smithfield.com and fire a false mismatch.
    expect(foldAsciiUntukHostname("Smith&Jones")).toBe("smithjones");
  });

  it("returns empty string for non-Latin scripts", () => {
    expect(foldAsciiUntukHostname("株式会社メルカリ")).toBe("");
  });
});

describe("perusahaanCocokHostname", () => {
  it("passes when the company slug appears in the hostname", () => {
    expect(perusahaanCocokHostname("PT Nusantara Digital", "nusantaradigital.co.id")).toBe(true);
    expect(perusahaanCocokHostname("Studio Aksara", "studioaksara.com")).toBe(true);
  });

  it("flags a genuine mismatch", () => {
    expect(perusahaanCocokHostname("PT Kualitas Prima", "karir-kita.xyz")).toBe(false);
  });

  it("passes when either side is unusable — 'cannot evaluate' is not 'mismatch'", () => {
    expect(perusahaanCocokHostname("", "example.com")).toBe(true);
    expect(perusahaanCocokHostname("PT Foo", "")).toBe(true);
    expect(perusahaanCocokHostname("株式会社メルカリ", "mercari.com")).toBe(true);
  });
});

describe("klasifikasiLevel", () => {
  it("maps score bands to levels", () => {
    expect(klasifikasiLevel(100)).toBe("high");
    expect(klasifikasiLevel(90)).toBe("high");
    expect(klasifikasiLevel(89)).toBe("medium");
    expect(klasifikasiLevel(60)).toBe("medium");
    expect(klasifikasiLevel(59)).toBe("low");
    expect(klasifikasiLevel(0)).toBe("low");
  });
});

describe("nilaiKepercayaan", () => {
  it("gives 100/high to a clean posting on its own domain", () => {
    const result = nilaiKepercayaan({
      url: "https://nusantaradigital.co.id/karier/frontend",
      company: "PT Nusantara Digital",
    });
    expect(result.score).toBe(100);
    expect(result.flags).toEqual([]);
    expect(result.level).toBe("high");
  });

  it("flags a missing apply URL without treating it as fraud", () => {
    const result = nilaiKepercayaan({ url: null, company: "PT Foo" });
    expect(result.flags).toContain("tanpa_url_lamaran");
    expect(result.score).toBe(60);
    expect(result.level).toBe("medium");
  });

  it("flags a malformed URL and stops", () => {
    const result = nilaiKepercayaan({ url: "bit.ly/xyz", company: "PT Foo" });
    expect(result.flags).toEqual(["url_tidak_valid"]);
    expect(result.score).toBe(50);
  });

  it("flags a link shortener", () => {
    const result = nilaiKepercayaan({
      url: "https://bit.ly/rekrutmen-qa",
      company: "PT Kualitas Prima",
    });
    expect(result.flags).toContain("link_pendek");
    // A shortener also hides the real domain, so the company check fires too.
    // This double penalty is upstream's behaviour and is intended: a shortener
    // is a stronger signal than either flag alone.
    expect(result.flags).toContain("domain_tidak_cocok");
    expect(result.score).toBe(60);
    expect(result.level).toBe("medium");
  });

  it("flags a shortener on its own when the company check is skipped", () => {
    const result = nilaiKepercayaan({ url: "https://bit.ly/x" });
    expect(result.flags).toEqual(["link_pendek"]);
    expect(result.score).toBe(75);
  });

  it("flags a company/domain mismatch", () => {
    const result = nilaiKepercayaan({
      url: "https://karir-kita.xyz/lowongan/1",
      company: "PT Kualitas Prima",
    });
    expect(result.flags).toContain("domain_tidak_cocok");
    expect(result.score).toBe(85);
    expect(result.level).toBe("medium");
  });

  it("skips the company check for ATS-hosted URLs", () => {
    // A Greenhouse posting legitimately has a domain with no company name.
    const result = nilaiKepercayaan({
      url: "https://boards.greenhouse.io/acme/jobs/123",
      company: "PT Sama Sekali Beda",
    });
    expect(result.flags).not.toContain("domain_tidak_cocok");
    expect(result.score).toBe(100);
  });

  it("skips the company check for Indonesian job boards", () => {
    for (const url of [
      "https://glints.com/id/opportunities/jobs/123",
      "https://id.jobstreet.com/id/job/123",
      "https://www.kalibrr.com/c/acme/jobs/1",
    ]) {
      const result = nilaiKepercayaan({ url, company: "PT Nama Lain" });
      expect(result.flags).not.toContain("domain_tidak_cocok");
    }
  });

  it("accumulates independent penalties", () => {
    const result = nilaiKepercayaan({
      url: "https://bit.ly/x",
      company: "PT Kualitas Prima",
    });
    // shortener (25) + mismatch (15) = 60
    expect(result.flags).toEqual(["link_pendek", "domain_tidak_cocok"]);
    expect(result.score).toBe(60);
  });

  it("never returns a negative score", () => {
    const result = nilaiKepercayaan({ url: "javascript:x", company: "PT Foo" });
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

describe("Indonesian boards are exempt from the company↔domain check", () => {
  // Dealls serves postings from dealls.com and sejutacita.id. A missing entry
  // here is not cosmetic: `nilaiKepercayaan` only skips the mismatch check for
  // listed hosts, so an omission quarantines a legitimate posting.
  it.each(["dealls.com", "www.dealls.com", "api.sejutacita.id"])(
    "lists %s",
    (host) => {
      expect(cocokDaftarDomain(host, ATS_DIIZINKAN)).toBe(true);
    },
  );

  it("does not flag a Dealls posting whose company is a brand name", () => {
    const out = nilaiKepercayaan({
      url: "https://dealls.com/loker/software-engineer-ai~sirclo",
      company: "CFACTORY.CO",
    });
    expect(out.flags).not.toContain("domain_tidak_cocok");
  });
});
