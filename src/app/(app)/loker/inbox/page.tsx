import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { InboxList } from "@/components/features/jobs/inbox-list";
import {
  bacaInboxDenganTanggal,
  bacaRiwayatScan,
  bootstrapCareerOps,
} from "@/lib/career-ops";

export const metadata: Metadata = { title: "Lowongan Ditemukan" };

// The inbox is read from disk on every request, so it must never be cached: a
// scan run appends to pipeline.md and the next view has to see it.
export const dynamic = "force-dynamic";

export default async function LokerInboxPage() {
  const session = await getSession();
  if (!session) return null;

  // Bootstrap is write-once, so a fresh data root still renders an empty inbox
  // instead of throwing on a missing pipeline.md. A broken data root is left to
  // the scan button to explain, per "a missing file is not a malformed file".
  try {
    bootstrapCareerOps();
  } catch {
    // fall through: the list renders empty and the button reports the failure
  }

  const rows = bacaInboxDenganTanggal();
  const adaRiwayat = bacaRiwayatScan().length > 0;

  return (
    <AppShell session={session} current="/loker">
      <PageHead
        eyebrow="Job seeker"
        title="Lowongan ditemukan"
        lead="Hasil pindai dari papan lowongan publik. Buka di situs aslinya, lalu lacak yang kamu minati."
      />
      <section className="card">
        <InboxList awal={rows} adaRiwayat={adaRiwayat} />
      </section>
    </AppShell>
  );
}
