import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { InboxList } from "@/components/features/jobs/inbox-list";
import {
  bacaInboxDiaudit,
  bacaRiwayatScan,
  bootstrapCareerOps,
  type InboxJob,
} from "@/lib/career-ops";
import { bacaCache } from "@/lib/career-ops/jobstreet-enrich";
import { katalogBelajar } from "@/lib/courses/katalog";
import { hitungJumlahKursus } from "@/lib/jobs/hitung-kursus";

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

  // Enrichment reaches the network once per uncached Jobstreet id, so it must be
  // allowed to fail: a dead listing drops that row to "belum diperiksa" rather
  // than taking the page down with it.
  const rows = await bacaInboxDiaudit().catch(() => []);
  const adaRiwayat = bacaRiwayatScan().length > 0;

  // Lencana "N kursus" di setiap kartu. Fungsi murni (ranker deterministik +
  // deskripsi yang sudah ter-cache), jadi tidak ada jaringan tambahan: satu kali
  // kerja server untuk seluruh baris, bukan satu permintaan per kartu.
  const jumlahKursus = hitungJumlahKursus(
    rows.map((r) => r as InboxJob),
    await katalogBelajar(),
    await bacaCache().catch(() => ({}) as Record<string, never>),
  );

  return (
    <AppShell session={session} current="/loker">
      <PageHead
        eyebrow="Job seeker"
        title="Lowongan ditemukan"
        lead="Hasil pindai dari papan lowongan publik. Buka di situs aslinya, lalu lacak yang kamu minati."
      />
      <section className="card">
        <InboxList
          awal={rows}
          adaRiwayat={adaRiwayat}
          jumlahKursusPerUrl={jumlahKursus}
        />
      </section>
    </AppShell>
  );
}
