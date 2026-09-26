import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { LearnerShell } from "@/components/ui/learner-shell";
import { BelajarHome, type KursusTerdaftar } from "@/components/features/learning/belajar-home";
import { katalogBelajar } from "@/lib/courses/katalog";
import { hitungProgres, irisModulSelesai } from "@/lib/courses/kurikulum";
import { modulUntukSumber } from "@/lib/courses/modul-resolver";
import { pastikanBackfill } from "@/lib/learning/backfill-lazy";
import { listKursusTerdaftarDb, progresKursusDb } from "@/lib/learning/service";
import { tasks } from "@/lib/fixtures";

export const metadata: Metadata = {
  title: "Belajar",
};

export default async function BelajarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const { q } = await searchParams;
  const queryAwal = typeof q === "string" ? q.slice(0, 120) : "";

  const katalog = await katalogBelajar();
  // Migrasi lazy: progres cookie lama pemilik ini dipindahkan ke database sekali,
  // sebelum halaman membaca apa pun. Setelah itu daftar di bawah tidak lagi
  // menyentuh cookie.
  await pastikanBackfill(session);
  const enrollments = await listKursusTerdaftarDb(session);

  // Loop `for...of` yang ber-`await`, bukan `.flatMap()`: resolver modul kini
  // async sehingga tidak bisa dipanggil dari callback sinkron.
  const terdaftar: KursusTerdaftar[] = [];
  for (const enrollment of enrollments) {
    const kursus = katalog.find((item) => item.id === enrollment.courseId);
    if (!kursus) continue;
    const modul = await modulUntukSumber({
      id: kursus.id,
      title: kursus.title,
      tags: kursus.tags,
      duration_min: kursus.duration_min,
      url: kursus.url,
    });
    // Progres dibaca dari service, bukan dari cookie: `progresKursusDb`
    // memuat ulang enrollment milik principal dan menyaring modul yang
    // benar-benar `completed` di database.
    const { selesai: idSelesai } = await progresKursusDb(session, enrollment.courseId);
    const selesai = irisModulSelesai(idSelesai, modul);
    terdaftar.push({
      id: kursus.id,
      slug: kursus.slug,
      title: kursus.title,
      provider: kursus.provider,
      progres: hitungProgres(selesai.length, modul.length),
      selesai: selesai.length,
      total: modul.length,
    });
  }

  return (
    <LearnerShell session={session} queryAwal={queryAwal}>
      <BelajarHome
        resources={katalog}
        tasks={tasks}
        terdaftar={terdaftar}
        queryAwal={queryAwal}
      />
    </LearnerShell>
  );
}
