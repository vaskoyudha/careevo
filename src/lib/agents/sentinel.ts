import type { SentinelStatus } from "@/types/domain";
import { deteksiFee, labelAturan } from "./rules/fee-rules";
import {
  FLAG_KEPERCAYAAN_KUAT,
  LABEL_KEPERCAYAAN,
  nilaiKepercayaan,
  type TrustLevel,
} from "@/lib/jobs/trust";

export interface SentinelInput {
  title: string;
  company: string;
  description: string;
  apply_url: string | null;
  company_email: string | null;
  domain_age_days: number | null;
}

export interface SentinelOutput {
  status: SentinelStatus;
  /** Every signal, both families — for display. */
  flags: string[];
  /**
   * Content signals indicating a scam DEMAND: the `deteksiFee` rules plus
   * `link_apk`. This is the "no-fee" axis — deliberately narrower than `flags`,
   * which also carries the weaker identity signals (`email_pribadi`,
   * `domain_baru`) and the structural `trust_flags`.
   */
  fee_flags: string[];
  /** URL/domain trust flags (from `nilaiKepercayaan`). */
  trust_flags: string[];
  /** 0–100, from `nilaiKepercayaan`. 100 = nothing structurally suspicious. */
  trust_score: number;
  trust_level: TrustLevel;
}

const FREE_MAIL = /@(gmail|yahoo|outlook|hotmail|mail)\./i;

/** Signals that mean the posting is asking the candidate for something. */
const SINYAL_FEE = new Set([
  "biaya_administrasi",
  "rekening_pribadi",
  "tiket_travel",
  "pungutan_seragam",
  "panen_data",
  "link_apk",
]);

/**
 * Rule-based loker audit — the deterministic counterpart to career-ops' LLM
 * "Block G". Two independent signal families feed one verdict:
 *
 *   1. Content signals (Indonesian scam modus), from `deteksiFee`:
 *      biaya administrasi, rekening pribadi, APK, tiket travel, seragam, KTP/OTP.
 *   2. Structural signals (URL/domain trust), from `nilaiKepercayaan`:
 *      malformed links, link shorteners, company↔domain mismatch.
 *
 * Family 1 is unique to Careevo — career-ops has no Indonesian scam rules.
 * Family 2 is adapted from career-ops' `_trust-validator.mjs` (MIT).
 *
 * Verdict escalation is deliberately conservative: a weak structural flag never
 * rejects a posting on its own, because "we couldn't confirm this link" is not
 * "this is a scam". Only a malformed URL, or two independent strong signals,
 * escalate to `rejected`.
 */
export function auditLoker(input: SentinelInput): SentinelOutput {
  const core = new Set<string>();

  for (const match of deteksiFee(input.description)) {
    core.add(match.rule);
  }

  if (input.company_email && FREE_MAIL.test(input.company_email)) {
    core.add("email_pribadi");
  }

  if (typeof input.domain_age_days === "number" && input.domain_age_days < 30) {
    core.add("domain_baru");
  }

  if (input.apply_url && /\.apk(\?|#|$)/i.test(input.apply_url)) {
    core.add("link_apk");
  }

  const trust = nilaiKepercayaan({ url: input.apply_url, company: input.company });

  const coreList = [...core];
  const trustStrong = trust.flags.filter((flag) => FLAG_KEPERCAYAAN_KUAT.includes(flag));

  // Escalation policy, most decisive first. The shape of it matters: a weak
  // structural signal never rejects on its own, and two signals only reject when
  // they are genuinely independent (one content + one strong structural, or two
  // content). Counting a shortener and the company mismatch it *causes* as two
  // independent signals would over-escalate a single cause.
  let status: SentinelStatus = "clean";
  if (
    // A posting demanding an APK download is decisive on its own.
    coreList.includes("link_apk") ||
    // Two independent content signals.
    coreList.length >= 2 ||
    // An unparseable URL cannot be verified at all.
    trustStrong.includes("url_tidak_valid") ||
    // A content signal corroborated by a strong structural one.
    (coreList.length >= 1 && trustStrong.length >= 1)
  ) {
    status = "rejected";
  } else if (coreList.length === 1 || trustStrong.length === 1) {
    status = "quarantined";
  }

  const allFlags = [...coreList, ...trust.flags.filter((flag) => !core.has(flag))];

  return {
    status,
    flags: allFlags,
    // The "no-fee" axis: demand signals only. A domain mismatch or a free-mail
    // employer is a reason to look closer, not a claim that money was requested.
    fee_flags: allFlags.filter((flag) => SINYAL_FEE.has(flag)),
    trust_flags: trust.flags,
    trust_score: trust.score,
    trust_level: trust.level,
  };
}

/**
 * Human-readable label for any Sentinel signal id — fee rule or trust flag.
 * Keeps the detail page from having to know which family a flag came from.
 *
 * `Object.hasOwn` rather than `in`: `in` walks the prototype chain, so
 * `"toString" in LABEL_KEPERCAYAAN` is true and this would return the inherited
 * `toString` *function* where a string is expected.
 */
export function labelSinyal(flag: string): string {
  if (Object.hasOwn(LABEL_KEPERCAYAAN, flag)) return LABEL_KEPERCAYAAN[flag];
  return labelAturan(flag);
}
