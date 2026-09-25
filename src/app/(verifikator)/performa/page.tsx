import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import {
  PembelajaranTabel,
  PeringatanPembelajaran,
} from "@/components/features/performa/performa-belajar";
import { indeksPerforma } from "@/lib/performa/store";
import { barisPembelajaran } from "@/lib/performa/ringkasan";

export const metadata: Metadata = {
  title: "Laporan Belajar",
};

export default async function PerformaPage() {
  // Role gate comes from `(verifikator)/layout.tsx`; repeated here so moving the
  // page cannot silently expose learner records to any signed-in user.
  const session = await getSession();
  if (!session) return null;

  // Sengaja tidak membaca `.data/sessions/`: laporan ini tidak memuat data
  // integritas, jadi tidak punya alasan untuk membacanya.
  const baris = barisPembelajaran(await indeksPerforma());

  return (
    <AppShell session={session} current="/performa">
      <PageHead
        eyebrow="Area verifikator"
        title="Laporan belajar"
        lead="Progres modul dan skor kuis. Catatan integritas sesi ada di laporan terpisah, karena menjawab pertanyaan berbeda dan tidak pernah dipakai menilai hasil belajar."
      />
      <div className="space-y-4">
        <PeringatanPembelajaran />
        <PembelajaranTabel baris={baris} />
      </div>
    </AppShell>
  );
}
