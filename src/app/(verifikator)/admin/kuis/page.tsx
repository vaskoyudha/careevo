import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { KuisManager } from "@/components/features/admin/kuis/kuis-manager";
import { listKuis } from "@/lib/courses/store";

export const metadata: Metadata = {
  title: "Kelola Kuis",
};

export default async function AdminKuisPage() {
  const session = await getSession();
  if (!session) return null;

  // Bank soal dibaca di sini, bukan di dalam editor: `store.ts` menyentuh
  // `node:fs`, jadi ia harus tetap di sisi server dan daftarnya dioper sebagai
  // prop. Satu pembacaan untuk seluruh halaman.
  const daftar = await listKuis();

  return (
    <AppShell session={session} current="/admin/kuis">
      <PageHead
        eyebrow="Area Admin"
        title="Bank Soal Kuis"
        lead="Susun kuis sekali di sini, lalu pasang ke modul mana pun. Perbaikan satu soal langsung berlaku di semua modul yang memakainya."
      />
      <KuisManager daftar={daftar} />
    </AppShell>
  );
}
