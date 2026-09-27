import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bacaInboxDiaudit } from "@/lib/career-ops";
import { verdictBadge } from "@/components/features/jobs/cari-lowongan-ui";
import type { Baris } from "@/components/features/jobs/cari-lowongan-ui";

// PROBE ONLY — reads the repo's real .data root to measure the shipped state.
describe("probe inbox audit state", () => {
  it("measures", async () => {
    const rows = await bacaInboxDiaudit();
    const total = rows.length;
    let tanpaAudit = 0;
    let verdictNull = 0;
    const statuses: Record<string, number> = {};
    const labels: Record<string, number> = {};
    const contohTanpaAudit: string[] = [];
    const contohVerdictNull: string[] = [];

    for (const r of rows) {
      if (!r.audit) {
        tanpaAudit++;
        if (contohTanpaAudit.length < 5) contohTanpaAudit.push(r.url);
      }
      const v = verdictBadge(r as unknown as Baris);
      if (!v) {
        verdictNull++;
        if (contohVerdictNull.length < 5) contohVerdictNull.push(r.url);
      } else {
        labels[v.label] = (labels[v.label] ?? 0) + 1;
      }
      const audit = r.audit as unknown as { status?: string } | undefined;
      const s = audit?.status ?? "(none)";
      statuses[s] = (statuses[s] ?? 0) + 1;
    }

    writeFileSync(
      "/tmp/probe-out.json",
      JSON.stringify(
        { total, tanpaAudit, verdictNull, statuses, labels, contohTanpaAudit, contohVerdictNull },
        null,
        2,
      ),
    );
    expect(total).toBeGreaterThan(0);
  });
});
