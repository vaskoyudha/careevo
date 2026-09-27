import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { InboxList } from "@/components/features/jobs/inbox-list";
import { getProfile } from "@/lib/onboarding/store";
import {
  bacaInboxDiaudit,
  bacaRiwayatScan,
  bootstrapCareerOps,
  type InboxJob,
} from "@/lib/career-ops";
import { bacaCache } from "@/lib/career-ops/job-cache";
import { katalogBelajar } from "@/lib/courses/katalog";
import { hitungJumlahKursus } from "@/lib/jobs/hitung-kursus";
import { kunciHariIni } from "@/lib/jobs/faset-inbox";

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

  // Enrichment no longer happens here: the cache is filled after a scan and by
  // `scripts/enrich-inbox.ts`. A row missing from the cache renders as "belum
  // diperiksa" rather than taking the page down or blocking on a fetch.
  const [rows, profile] = await Promise.all([
    bacaInboxDiaudit().catch(() => []),
    getProfile(session.userId, session.email),
  ]);
  const adaRiwayat = bacaRiwayatScan().length > 0;

  // Lencana "N kursus" di setiap kartu. Fungsi murni (ranker deterministik +
  // deskripsi yang sudah ter-cache), jadi tidak ada jaringan tambahan: satu kali
  // kerja server untuk seluruh baris, bukan satu permintaan per kartu.
  const jumlahKursus = hitungJumlahKursus(
    rows.map((r) => r as InboxJob),
    await katalogBelajar(),
    await bacaCache().catch(() => ({}) as Record<string, never>),
  );

  // "Hari ini" harus memakai hari lokal host, bukan hari UTC — mesin career-ops
  // menstempel `first_seen` dengan `localToday()` (lihat `kunciHariIni`).
  const hariIni = kunciHariIni();

  return (
    <AppShell
      session={session}
      current="/loker"
      mainClassName="app-main-wide"
    >
      <InboxList
        awal={rows}
        adaRiwayat={adaRiwayat}
        jumlahKursusPerUrl={jumlahKursus}
        hariIni={hariIni}
        profile={profile}
      />
    </AppShell>
  );
}
