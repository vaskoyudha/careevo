import type { SentinelStatus } from "@/types/domain";
import { deteksiFee } from "./rules/fee-rules";

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
  flags: string[];
}

const FREE_MAIL = /@(gmail|yahoo|outlook|hotmail|mail)\./i;

export function auditLoker(input: SentinelInput): SentinelOutput {
  const flags = new Set<string>();

  for (const match of deteksiFee(input.description)) {
    flags.add(match.rule);
  }

  if (input.company_email && FREE_MAIL.test(input.company_email)) {
    flags.add("email_pribadi");
  }

  if (typeof input.domain_age_days === "number" && input.domain_age_days < 30) {
    flags.add("domain_baru");
  }

  if (input.apply_url && /\.apk(\?|#|$)/i.test(input.apply_url)) {
    flags.add("link_apk");
  }

  const list = [...flags];
  let status: SentinelStatus = "clean";
  if (list.includes("link_apk") || list.length >= 2) {
    status = "rejected";
  } else if (list.length === 1) {
    status = "quarantined";
  }

  return { status, flags: list };
}
