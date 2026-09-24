import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { LearnerShell } from "@/components/ui/learner-shell";
import { BelajarHome, type KursusTerdaftar } from "@/components/features/learning/belajar-home";
import { katalogBelajar } from "@/lib/courses/katalog";
import { hitungProgres, irisModulSelesai } from "@/lib/courses/kurikulum";
import { modulUntukSumber } from "@/lib/courses/modul-resolver";
import { listPendaftaran } from "@/lib/courses/enrollment";
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
  const pendaftaran = await listPendaftaran(session.email);

  // Loop `for...of` yang ber-`await`, bukan `.flatMap()`: resolver modul kini
  // async sehingga tidak bisa dipanggil dari callback sinkron.
  const terdaftar: KursusTerdaftar[] = [];
  for (const entri of pendaftaran) {
    const kursus = katalog.find((item) => item.id === entri.course_id);
    if (!kursus) continue;
    const modul = await modulUntukSumber({
      id: kursus.id,
      title: kursus.title,
      tags: kursus.tags,
      duration_min: kursus.duration_min,
      url: kursus.url,
    });
    const selesai = irisModulSelesai(entri.selesai_modul, modul);
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
