import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import {
  IntegritasTabel,
  PeringatanIntegritas,
} from "@/components/features/performa/performa-integritas";
import { indeksPerforma } from "@/lib/performa/store";
import { ringkasIntegritasByOwner } from "@/lib/performa/integritas";
import { barisIntegritas } from "@/lib/performa/ringkasan";
import { listRun } from "@/lib/learning/session";

export const metadata: Metadata = {
  title: "Laporan Integritas",
};

export default async function PerformaIntegritasPage() {
  // Role gate comes from `(verifikator)/layout.tsx`; repeated here so moving the
  // page cannot silently expose integrity records to any signed-in user.
  const session = await getSession();
  if (!session) return null;

  const [catatan, runs] = await Promise.all([indeksPerforma(), listRun()]);
  const baris = barisIntegritas(catatan, ringkasIntegritasByOwner(runs));

  return (
    <AppShell session={session} current="/performa/integritas">
      <PageHead
        eyebrow="Area verifikator"
        title="Laporan integritas"
        lead="Catatan pengamatan selama sesi terverifikasi. Laporan ini terpisah dari laporan belajar karena menjawab pertanyaan berbeda dan tidak pernah dipakai untuk menilai hasil belajar."
      />
      <div className="space-y-4">
        <PeringatanIntegritas />
        <IntegritasTabel baris={baris} />
      </div>
    </AppShell>
  );
}
