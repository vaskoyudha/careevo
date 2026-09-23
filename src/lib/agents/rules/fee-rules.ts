export interface FeeRuleMatch {
  rule: string;
  excerpt: string;
}

export interface FeeRule {
  rule: string;
  label: string;
  pattern: RegExp;
}

export const FEE_RULES: FeeRule[] = [
  {
    rule: "biaya_administrasi",
    label: "Permintaan biaya administrasi",
    pattern: /biaya\s+(administrasi|pendaftaran|seleksi|pelatihan|jaminan|pendaftaran)/i,
  },
  {
    rule: "rekening_pribadi",
    label: "Transfer ke rekening pribadi",
    pattern: /(transfer|bayar|pembayaran|setor)[^.]{0,48}rekening\s+pribadi/i,
  },
  {
    rule: "link_apk",
    label: "Link unduhan APK",
    pattern: /(unduh|download|install|instal)[^.]{0,32}\bapk\b/i,
  },
  {
    rule: "tiket_travel",
    label: "Tiket travel fiktif",
    pattern: /tiket\s+(travel|pesawat|kereta|bus)/i,
  },
  {
    rule: "pungutan_seragam",
    label: "Pungutan seragam",
    pattern: /(biaya|pungutan)[^.]{0,24}seragam/i,
  },
  {
    rule: "panen_data",
    label: "Permintaan data pribadi sensitif",
    pattern: /\b(ktp|selfie|otp|data\s+pribadi)\b/i,
  },
];

export function deteksiFee(description: string): FeeRuleMatch[] {
  const matches: FeeRuleMatch[] = [];
  for (const { rule, pattern } of FEE_RULES) {
    const match = pattern.exec(description);
    if (match) {
      matches.push({ rule, excerpt: match[0] });
    }
  }
  return matches;
}

export function labelAturan(rule: string): string {
  return FEE_RULES.find((item) => item.rule === rule)?.label ?? rule;
}

/**
 * The ids of every fee rule, derived from `FEE_RULES` rather than listed again.
 *
 * A second hand-written copy of this set is a drift risk with a silent failure
 * mode: add a rule to `FEE_RULES`, forget the copy, and the board's "no-fee"
 * filter stops recognising the new demand while the audit still flags it — the
 * filter and the verdict disagree, and nothing errors.
 */
export const ID_ATURAN_FEE: ReadonlySet<string> = new Set(FEE_RULES.map((item) => item.rule));
