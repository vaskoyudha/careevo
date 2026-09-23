import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { AuditChain, type ChainRow } from "@/components/features/audit/audit-chain";
import { computeEntryHash } from "@/lib/audit/hashchain";
import { auditLog } from "@/lib/fixtures";

export const metadata: Metadata = {
  title: "Audit Log",
};

function buildChain(): ChainRow[] {
  let prev: string | null = null;
  return auditLog.map((entry) => {
    const entry_hash = computeEntryHash(prev, {
      action: entry.action,
      summary: entry.summary,
      actor: entry.actor_id,
      at: entry.at,
    });
    const row: ChainRow = {
      id: entry.id,
      at: entry.at,
      actor_type: entry.actor_type,
      actor_id: entry.actor_id,
      action: entry.action,
      summary: entry.summary,
      prev_hash: prev,
      entry_hash,
    };
    prev = entry_hash;
    return row;
  });
}

export default async function AuditPage() {
  const session = await getSession();
  if (!session) return null;

  const rows = buildChain();

  return (
    <AppShell session={session} current="/audit">
        <PageHead
          eyebrow="Area verifikator"
          title="Audit Log"
          lead="Append-only dan tamper-evident: setiap entry menautkan hash entry sebelumnya. Ubah satu byte, rantai di bawahnya gagal."
        />
        <AuditChain rows={rows} />
    </AppShell>
  );
}
