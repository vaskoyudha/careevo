import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "ok" | "warn" | "danger" | "info";

const STATUS_TONE: Record<string, Tone> = {
  approved: "ok",
  applied: "info",
  reviewed: "info",
  interview: "info",
  outcome: "ok",
  clean: "ok",
  quarantined: "warn",
  rejected: "danger",
  revision: "warn",
  waiting_review: "warn",
  waiting_socrates: "warn",
  autocheck_running: "info",
};

const STATUS_LABEL: Record<string, string> = {
  approved: "APPROVED",
  applied: "Applied",
  reviewed: "Reviewed",
  interview: "Interview",
  outcome: "Outcome",
  clean: "AMAN",
  quarantined: "KARANTINA",
  rejected: "DITOLAK",
  revision: "REVISI",
  waiting_review: "PENDING VERIFIKATOR",
  waiting_socrates: "MENUNGGU SOCRATES",
  autocheck_running: "AUTO-CHECK",
};

export function statusTone(status: string): Tone {
  return STATUS_TONE[status] ?? "info";
}

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const tone = statusTone(status);
  return (
    <Badge variant="outline" className={cn("status", `status-${tone}`)}>
      {label ?? statusLabel(status)}
    </Badge>
  );
}

export function StatusDot({ children, tone = "info" }: { children: ReactNode; tone?: Tone }) {
  return (
    <Badge variant="outline" className={cn("status", `status-${tone}`)}>
      {children}
    </Badge>
  );
}
