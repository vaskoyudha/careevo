import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { pastikanBackfill } from "@/lib/learning/backfill-lazy";
import { listProgresKursus } from "@/lib/learning/progres-kursus";
import { ProgresView } from "@/components/features/learning/progres-view";

export const metadata: Metadata = { title: "Progres" };

/**
 * Progres belajar peserta: semua kursus yang diambil, dengan persennya.
 *
 * Di dalam `AppShell` — shell yang sama dengan dashboard, jelajah, project, dan
 * loker — supaya halaman ini satu segmen dengan dashboard, bukan halaman belajar
 * yang menyamar. Rute sebelumnya `/belajar/jalur` masih hidup sebagai redirect.
 *
 * Gate sesi ditangani `(app)/layout.tsx`; `return null` di sini hanya penjaga
 * defensif, bukan jalur normal.
 */
export default async function ProgresPage() {
  const session = await getSession();
  if (!session) return null;

  // Migrasi lazy sebelum membaca, sama seperti `/belajar`: enrollment cookie
  // pemilik ini dipindahkan ke database sekali saja, supaya angka progres di
  // halaman ini sama dengan yang dibaca halaman katalog.
  await pastikanBackfill(session);

  const kursus = await listProgresKursus(session);

  return (
    <AppShell session={session} current="/progres">
      <PageHead
        eyebrow="Progres belajar"
        title="Progres"
        lead="Semua kursus yang kamu ambil, dengan persen modul yang sudah selesai."
      />
      <ProgresView kursus={kursus} />
    </AppShell>
  );
}
