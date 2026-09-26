import type { Metadata } from "next";
import { AppShell } from "@/components/ui/app-shell";
import { getSession } from "@/lib/auth/session";
import { getAllPrograms } from "@/lib/courses/explore-queries";
import { katalogBelajar } from "@/lib/courses/katalog";
import { PromoCard } from "@/components/features/dashboard/jelajah/promo-card";
import { StartLearningGrid } from "@/components/features/dashboard/jelajah/start-learning-grid";
import { TabbedProgramRow } from "@/components/features/dashboard/jelajah/tabbed-program-row";

export const metadata: Metadata = { title: "Jelajah" };

/**
 * Halaman jelajah: katalog program berbatch dan materi belajar, di dalam
 * shell `AppShell` yang sama dengan dashboard/admin/review.
 *
 * Gate sesi sudah ditangani `(app)/layout.tsx`; `return null` di sini
 * hanya penjaga defensif, bukan jalur normal.
 */
export default async function JelajahPage() {
  const session = await getSession();
  if (!session) return null;

  const programs = getAllPrograms();
  const katalog = await katalogBelajar();
  const topik = [...new Set(katalog.flatMap((entri) => entri.tags))].slice(0, 3);

  return (
    <AppShell session={session} current="/jelajah">
      <div className="flex flex-col gap-8">
        <TabbedProgramRow programs={programs} lihatSemuaHref="/explore/most-popular-courses" />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <StartLearningGrid entries={katalog} topik={topik} />
          <PromoCard />
        </div>
      </div>
    </AppShell>
  );
}
