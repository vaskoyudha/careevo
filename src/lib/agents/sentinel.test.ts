import { describe, expect, it } from "vitest";
import { auditLoker, labelSinyal } from "@/lib/agents/sentinel";
import { FEE_RULES } from "@/lib/agents/rules/fee-rules";
import { jobs } from "@/lib/fixtures";

/**
 * Tests for the merged Sentinel audit.
 *
 * The audit combines two independent signal families:
 *   1. content (Indonesian fee scam rules, from `deteksiFee`) — Careevo's own
 *   2. structure (URL/domain trust, ported from career-ops' trust validator)
 *
 * The escalation policy is the thing worth pinning: a weak structural signal must
 * never reject a posting on its own, because "we could not confirm this link" is
 * not the same claim as "this is a scam".
 */

const DASAR = {
  title: "Frontend Engineer",
  company: "PT Nusantara Digital",
  description: "Membangun antarmuka dengan React dan TypeScript.",
  apply_url: "https://nusantaradigital.co.id/karier/fe",
  company_email: "hr@nusantaradigital.co.id",
  domain_age_days: 1200,
};

describe("auditLoker", () => {
  it("passes a clean posting", () => {
    const result = auditLoker(DASAR);
    expect(result.status).toBe("clean");
    expect(result.flags).toEqual([]);
    expect(result.trust_score).toBe(100);
    expect(result.trust_level).toBe("high");
  });

  it("quarantines a single content signal", () => {
    const result = auditLoker({
      ...DASAR,
      description: "Pelamar diminta menyiapkan biaya administrasi untuk proses seleksi.",
    });
    expect(result.status).toBe("quarantined");
    expect(result.flags).toContain("biaya_administrasi");
  });

  it("rejects two independent content signals", () => {
    const result = auditLoker({
      ...DASAR,
      description: "Wajib unduh APK dan transfer uang jaminan ke rekening pribadi.",
    });
    expect(result.status).toBe("rejected");
  });

  it("rejects on a link_apk signal alone", () => {
    const result = auditLoker({
      ...DASAR,
      description: "Wajib unduh APK sebelum seleksi.",
    });
    expect(result.status).toBe("rejected");
    expect(result.flags).toContain("link_apk");
  });

  it("quarantines a single free-mail employer signal", () => {
    const result = auditLoker({ ...DASAR, company_email: "rekrutmen@gmail.com" });
    expect(result.status).toBe("quarantined");
    expect(result.flags).toContain("email_pribadi");
  });

  it("quarantines a brand-new domain", () => {
    const result = auditLoker({ ...DASAR, domain_age_days: 10 });
    expect(result.status).toBe("quarantined");
    expect(result.flags).toContain("domain_baru");
  });

  it("quarantines on a single strong trust signal (shortener)", () => {
    const result = auditLoker({ ...DASAR, apply_url: "https://bit.ly/xyz" });
    expect(result.status).toBe("quarantined");
    expect(result.trust_flags).toContain("link_pendek");
  });

  it("rejects on a malformed URL — a URL that cannot parse is not a weak signal", () => {
    const result = auditLoker({ ...DASAR, apply_url: "javascript:alert(1)" });
    expect(result.status).toBe("rejected");
    expect(result.trust_flags).toContain("url_tidak_valid");
  });

  it("does NOT quarantine a posting that merely lacks an apply URL", () => {
    // The whole point of the escalation policy: "no link" is missing data, not
    // fraud. Quarantining here would empty the board of every link-less posting.
    const result = auditLoker({ ...DASAR, apply_url: null });
    expect(result.status).toBe("clean");
    expect(result.trust_flags).toContain("tanpa_url_lamaran");
  });

  it("rejects when a content signal and a strong trust signal combine", () => {
    const result = auditLoker({
      ...DASAR,
      description: "Pelamar menyiapkan biaya administrasi.",
      apply_url: "https://bit.ly/xyz",
    });
    expect(result.status).toBe("rejected");
  });

  it("reports both flag families in `flags` without duplication", () => {
    const result = auditLoker({ ...DASAR, apply_url: "https://bit.ly/xyz" });
    const unique = new Set(result.flags);
    expect(unique.size).toBe(result.flags.length);
    expect(result.flags).toContain("link_pendek");
  });

  it("exposes the trust score independently of the verdict", () => {
    const result = auditLoker({ ...DASAR, apply_url: "https://bit.ly/xyz" });
    expect(result.trust_score).toBeLessThan(100);
    expect(["high", "medium", "low"]).toContain(result.trust_level);
  });
});

describe("labelSinyal", () => {
  it("labels fee rules", () => {
    expect(labelSinyal("biaya_administrasi")).toBe("Permintaan biaya administrasi");
  });

  it("labels trust flags", () => {
    expect(labelSinyal("link_pendek")).toBe("Lamaran lewat link pendek");
    expect(labelSinyal("tanpa_url_lamaran")).toBe("Tidak ada URL lamaran");
  });

  it("falls back to the raw id for an unknown flag", () => {
    expect(labelSinyal("entah_apa")).toBe("entah_apa");
  });

  it("does not return an inherited Object member (regression)", () => {
    // `"toString" in LABEL_KEPERCAYAAN` is true via the prototype chain, so an
    // `in` check returned the inherited FUNCTION where a string belongs.
    for (const inherited of ["toString", "constructor", "valueOf", "hasOwnProperty"]) {
      const label = labelSinyal(inherited);
      expect(typeof label).toBe("string");
      expect(label).toBe(inherited);
    }
  });
});

describe("fee_flags vs flags", () => {
  it("fee_flags carries only demand signals", () => {
    const result = auditLoker({ ...DASAR, apply_url: "https://bit.ly/xyz" });
    // A shortener is a structural signal, not a demand for money.
    expect(result.fee_flags).toEqual([]);
    expect(result.flags).toContain("link_pendek");
  });

  it("fee_flags excludes the weak identity signals", () => {
    const result = auditLoker({ ...DASAR, company_email: "a@gmail.com" });
    expect(result.fee_flags).toEqual([]);
    expect(result.flags).toContain("email_pribadi");
  });

  it("fee_flags includes a genuine fee demand", () => {
    const result = auditLoker({
      ...DASAR,
      description: "Pelamar menyiapkan biaya administrasi.",
    });
    expect(result.fee_flags).toContain("biaya_administrasi");
  });

  it("fee_flags includes an APK demand", () => {
    const result = auditLoker({ ...DASAR, description: "Wajib unduh APK." });
    expect(result.fee_flags).toContain("link_apk");
  });

  it("fee_flags is always a subset of flags", () => {
    for (const job of jobs) {
      for (const flag of job.fee_flags) {
        expect(job.flags).toContain(flag);
      }
    }
  });

  it("a firing rule always reaches fee_flags", () => {
    // Proves the derivation is wired through, not just declared: each rule that
    // actually fires must land on the no-fee axis. This is the test that fails if
    // a hand-written copy of the set is reintroduced.
    const cases: Array<[string, string]> = [
      ["biaya_administrasi", "Pelamar menyiapkan biaya administrasi."],
      ["rekening_pribadi", "Pembayaran transfer ke rekening pribadi."],
      ["tiket_travel", "Biaya tiket travel ditanggung pelamar."],
      ["pungutan_seragam", "Ada pungutan untuk seragam."],
      ["panen_data", "Kirim KTP dan selfie."],
      ["link_apk", "Wajib unduh APK."],
    ];
    for (const [rule, description] of cases) {
      const result = auditLoker({ ...DASAR, description });
      expect(result.flags, `${rule} should fire`).toContain(rule);
      expect(result.fee_flags, `${rule} should be on the no-fee axis`).toContain(rule);
    }
  });

  it("the no-fee axis covers EVERY fee rule, with no hard-coded list", () => {
    // The drift guard. The examples below are keyed by rule id, and the
    // exhaustiveness check at the end means adding a rule to FEE_RULES without
    // adding an example here FAILS — so the coverage cannot silently fall behind.
    //
    // If the no-fee axis were a separate hard-coded set (as it once was), a new
    // rule would fire in `flags` but be missing from `fee_flags`, and the
    // assertion below fails.
    const CONTOH: Record<string, string> = {
      biaya_administrasi: "Pelamar menyiapkan biaya administrasi untuk seleksi.",
      rekening_pribadi: "Pembayaran diminta transfer ke rekening pribadi.",
      link_apk: "Wajib unduh APK sebelum seleksi.",
      tiket_travel: "Biaya tiket travel ditanggung pelamar.",
      pungutan_seragam: "Ada pungutan untuk seragam.",
      panen_data: "Kirim KTP dan selfie via chat.",
    };

    // Exhaustiveness: every rule has an example, and no example is orphaned.
    expect(Object.keys(CONTOH).sort()).toEqual(FEE_RULES.map((r) => r.rule).sort());

    for (const { rule } of FEE_RULES) {
      const sample = CONTOH[rule];
      const result = auditLoker({ ...DASAR, description: sample });
      expect(result.flags, `${rule} should fire on "${sample}"`).toContain(rule);
      expect(result.fee_flags, `${rule} must reach the no-fee axis`).toContain(rule);
    }
  });

  it("a posting can be quarantined with an empty fee_flags (identity signal only)", () => {
    const result = auditLoker({ ...DASAR, company_email: "hr@gmail.com" });
    expect(result.status).toBe("quarantined");
    expect(result.fee_flags).toEqual([]);
  });
});
