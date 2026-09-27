import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LearnerShell } from "@/components/ui/learner-shell";
import { DetailKursus, type KursusTerkait } from "@/components/features/learning/detail-kursus";
import { cariEntri, katalogBelajar } from "@/lib/courses/katalog";
import { irisModulSelesai } from "@/lib/courses/kurikulum";
import { modulUntukSumber } from "@/lib/courses/modul-resolver";
import { pastikanBackfill } from "@/lib/learning/backfill-lazy";
import { progresKursusDb } from "@/lib/learning/service";
import { getCourseById } from "@/lib/courses/store";
import { kebijakanDefault } from "@/lib/courses/kebijakan";
import { kelayakanKursusSubmission } from "@/lib/review/service";
import { tasks } from "@/lib/fixtures";
import { selaraskanKursusAi } from "@/lib/learning/tutor-ai-kursus";

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
  const katalog = await katalogBelajar();
  const entri = katalog.find((item) => item.slug === slug);
  if (!entri) notFound();

  const kursusAsli = await getCourseById(entri.id);
  const deskripsi =
    kursusAsli?.description ??
    `Pelajari ${entri.tags.join(", ")} melalui ${entri.type} ${entri.duration_min} menit dari ${entri.provider}.`;

  const modul = await modulUntukSumber({
    id: entri.id,
    title: entri.title,
    tags: entri.tags,
    duration_min: entri.duration_min,
    url: entri.url,
  });

  // Migrasi lazy sebelum membaca: enrollment cookie pemilik ini (bila ada)
  // dipindahkan ke database sekali, lalu progres dibaca dari sana.
  await pastikanBackfill(session);
  const { enrollment, selesai } = await progresKursusDb(session, entri.id);
  const selesaiAwal = irisModulSelesai(selesai, modul);

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

  /**
   * Id course pasangannya di AI Mastery, hanya untuk peserta yang terdaftar.
   *
   * Dijalankan **setelah** `enrollment` dibaca karena panel tutor hanya tampil
   * setelah pendaftaran, sehingga course yang tidak pernah dibuka tidak pernah
   * menyalakan panggilan ke service lain. `selaraskanKursusAi` mengembalikan
   * `null` saat bridging tidak dikonfigurasi atau AI Mastery mati; null lalu
   * menjadi `entri.id`, yaitu perilaku lama (link polosan yang ditolak backend
   * secara diam-diam), bukan error.
   */
  const aiCourseId = enrollment
    ? ((await selaraskanKursusAi({
        courseId: entri.id,
        title: entri.title,
        modul: modul.map((m) => m.judul),
      })) ?? entri.id)
    : entri.id;

  /**
   * Panel Project selalu tampil di halaman course, tetapi status siap/kuncinya
   * **bukan** fungsi `selesai` (modul selesai) — ia fungsi completion server
   * yang jalurnya `terverifikasi`. `kelayakanKursusSubmission` membaca
   * enrollment + completion; `null` berarti Project terkunci, walau progres
   * modul sudah 100% lewat jalur informal.
   */
  const layakProject = await kelayakanKursusSubmission(session, entri.id);
  const modulProyek = modul.find(
    (m) => m.checkpoint && m.checkpoint.mode === "proyek",
  );

  return (
    <LearnerShell session={session}>
      <DetailKursus
        key={`${entri.id}-${selesaiAwal.join(",")}`}
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
        terdaftar={Boolean(enrollment)}
        selesaiAwal={selesaiAwal}
        terkait={terkait}
        tugas={tugas ? { id: tugas.id, title: tugas.title, brief: tugas.brief } : null}
        aiCourseId={aiCourseId}
        proyek={{
          terkunci: layakProject === null,
          judul: modulProyek?.judul ?? "Project akhir course",
          ringkasan:
            modulProyek?.ringkasan ??
            "Terapkan seluruh materi course ini dalam satu karya nyata, lalu kumpulkan untuk direview verifikator.",
        }}
        // Kebijakan tersimpan dibaca apa adanya; kursus yang belum pernah
        // disunting kebijakannya jatuh ke default aman (`aturan_pengawasan:
        // "wajib"`) supaya gerbang tidak diam-diam terbuka.
        kebijakan={kursusAsli?.kebijakan ?? kebijakanDefault()}
      />
    </LearnerShell>
  );
}
