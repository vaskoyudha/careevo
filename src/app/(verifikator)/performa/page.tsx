import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import {
  PeringatanLaporan,
  PerformaTabel,
} from "@/components/features/performa/performa-tabel";
import { indeksPerforma } from "@/lib/performa/store";
import { ringkasIntegritasByOwner } from "@/lib/performa/integritas";
import { listRun } from "@/lib/learning/session";

export const metadata: Metadata = {
  title: "Laporan Performa",
};

export default async function PerformaPage() {
  // The role gate comes from `(verifikator)/layout.tsx`. It is repeated here so
  // that moving this page out of that group cannot silently expose learner
  // records to anyone who can sign in.
  const session = await getSession();
  if (!session) return null;

  const [catatan, runs] = await Promise.all([indeksPerforma(), listRun()]);
  const integritas = ringkasIntegritasByOwner(runs);

  return (
    <AppShell session={session} current="/performa">
      <PageHead
        eyebrow="Area verifikator"
        title="Laporan performa peserta"
        lead="Progres, skor kuis, dan catatan integritas. Angka berasal dari catatan server; baca peringatan di bawah sebelum memakai laporan ini untuk keputusan apa pun."
      />
      <div className="space-y-4">
        <PeringatanLaporan />
        <PerformaTabel
          baris={catatan.map((record) => ({
            ...record,
            integritas: integritas.get(record.owner),
          }))}
        />
      </div>
    </AppShell>
  );
}
