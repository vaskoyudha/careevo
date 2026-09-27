import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { LearnerShell } from "@/components/ui/learner-shell";
import { BelajarHome, type KursusTerdaftar } from "@/components/features/learning/belajar-home";
import { katalogBelajar } from "@/lib/courses/katalog";
import { pastikanBackfill } from "@/lib/learning/backfill-lazy";
import { listProgresKursus } from "@/lib/learning/progres-kursus";
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

  // Hitungan progresnya milik `listProgresKursus`, sama dengan halaman `/progres`:
  // section "Pembelajaran saya" di bawah dan halaman progres tidak boleh
  // menampilkan angka berbeda untuk enrollment yang sama.
  const terdaftar: KursusTerdaftar[] = (await listProgresKursus(session, katalog)).map(
    ({ entri, progres, selesai, total }) => ({
      id: entri.id,
      slug: entri.slug,
      title: entri.title,
      provider: entri.provider,
      progres,
      selesai,
      total,
    }),
  );

  return (
    <LearnerShell session={session} queryAwal={queryAwal} overlayMain promoBars>
      <BelajarHome
        resources={katalog}
        tasks={tasks}
        terdaftar={terdaftar}
        queryAwal={queryAwal}
      />
    </LearnerShell>
  );
}
