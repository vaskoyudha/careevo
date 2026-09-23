import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { DetailKursus, type KursusTerkait } from "@/components/features/learning/detail-kursus";
import { cariEntri, katalogBelajar } from "@/lib/courses/katalog";
import { modulKursus } from "@/lib/courses/kurikulum";
import { cariPendaftaran } from "@/lib/courses/enrollment";
import { getCourseById } from "@/lib/courses/store";
import { tasks } from "@/lib/fixtures";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entri = await cariEntri(slug);
  return { title: entri ? entri.title : "Kursus" };
}

export default async function DetailKursusPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const { slug } = await params;
  const entri = await cariEntri(slug);
  if (!entri) notFound();

  const kursusAsli = await getCourseById(entri.id);
  const deskripsi =
    kursusAsli?.description ??
    `Pelajari ${entri.tags.join(", ")} melalui ${entri.type} ${entri.duration_min} menit dari ${entri.provider}.`;

  const modul = modulKursus({
    id: entri.id,
    title: entri.title,
    tags: entri.tags,
    duration_min: entri.duration_min,
    url: entri.url,
  });

  const pendaftaran = await cariPendaftaran(entri.id);

  const katalog = await katalogBelajar();
  const skor = (kandidat: (typeof katalog)[number]) =>
    kandidat.tags.filter((tag) => entri.tags.includes(tag)).length;
  const terkait: KursusTerkait[] = katalog
    .filter((kandidat) => kandidat.id !== entri.id && skor(kandidat) > 0)
    .sort((a, b) => skor(b) - skor(a))
    .slice(0, 4)
    .map((kandidat) => ({
      slug: kandidat.slug,
      title: kandidat.title,
      provider: kandidat.provider,
      level: kandidat.level,
      duration_min: kandidat.duration_min,
      is_free: kandidat.is_free,
    }));

  const tugas = tasks.find((task) => task.status === "available" || task.status === "review") ?? null;

  return (
    <AppShell session={session} current="/belajar">
      <DetailKursus
        kursus={{
          id: entri.id,
          slug: entri.slug,
          title: entri.title,
          description: deskripsi,
          provider: entri.provider,
          type: entri.type,
          level: entri.level,
          tags: entri.tags,
          url: entri.url,
          duration_min: entri.duration_min,
          is_free: entri.is_free,
          price: kursusAsli?.price ?? 0,
          rating: kursusAsli?.rating ?? null,
          enrolled_count: kursusAsli?.enrolled_count ?? null,
        }}
        modul={modul}
        terdaftar={Boolean(pendaftaran)}
        selesaiAwal={pendaftaran?.selesai_modul ?? []}
        terkait={terkait}
        tugas={tugas ? { id: tugas.id, title: tugas.title, brief: tugas.brief } : null}
      />
    </AppShell>
  );
}
