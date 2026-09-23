import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { BelajarHome, type KursusTerdaftar } from "@/components/features/learning/belajar-home";
import { katalogBelajar } from "@/lib/courses/katalog";
import { modulKursus, hitungProgres } from "@/lib/courses/kurikulum";
import { listPendaftaran } from "@/lib/courses/enrollment";
import { tasks } from "@/lib/fixtures";

export const metadata: Metadata = {
  title: "Belajar",
};

export default async function BelajarPage() {
  const session = await getSession();
  if (!session) return null;

  const katalog = await katalogBelajar();
  const pendaftaran = await listPendaftaran();

  const terdaftar: KursusTerdaftar[] = pendaftaran.flatMap((entri) => {
    const kursus = katalog.find((item) => item.id === entri.course_id);
    if (!kursus) return [];
    const modul = modulKursus({
      id: kursus.id,
      title: kursus.title,
      tags: kursus.tags,
      duration_min: kursus.duration_min,
      url: kursus.url,
    });
    return [
      {
        id: kursus.id,
        slug: kursus.slug,
        title: kursus.title,
        provider: kursus.provider,
        progres: hitungProgres(entri.selesai_modul.length, modul.length),
        selesai: entri.selesai_modul.length,
        total: modul.length,
      },
    ];
  });

  return (
    <AppShell session={session} current="/belajar">
      <BelajarHome resources={katalog} tasks={tasks} terdaftar={terdaftar} />
    </AppShell>
  );
}
