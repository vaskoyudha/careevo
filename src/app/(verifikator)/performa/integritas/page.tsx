import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import {
  IntegritasTabel,
  PeringatanIntegritas,
} from "@/components/features/performa/performa-integritas";
import { listEnrollmentStaf, listEventRun } from "@/lib/learning/repository";
import {
  ringkasIntegritasByOwner,
  type RingkasanIntegritas,
} from "@/lib/performa/integritas";
import { barisIntegritas } from "@/lib/performa/ringkasan";
import { listRunStaf } from "@/lib/learning/run-service";
import { sessionRunDariDb } from "@/lib/learning/dashboard";

export const metadata: Metadata = {
  title: "Laporan Integritas",
};

export default async function PerformaIntegritasPage() {
  // Role gate comes from `(verifikator)/layout.tsx`; repeated here so moving the
  // page cannot silently expose integrity records to any signed-in user.
  const session = await getSession();
  if (!session?.userId) return null;

  const [runs, enrollments] = await Promise.all([listRunStaf(), listEnrollmentStaf()]);
  // Kejadian dibaca per run dari `learning_events` — satu query per run, bukan
  // satu query raksasa. Cara ini memakai index `learning_events_run_id_idx` apa
  // adanya dan jumlah run dashboard staf masih kecil.
  const sesi = await Promise.all(
    runs.map(async (run) => sessionRunDariDb(run, await listEventRun(run.id))),
  );

  // Ringkasan dikelompokkan per `users.id` (pemilik `SessionRun`), sedangkan
  // baris laporan memakai **email** sebagai owner karena segmen rute halaman
  // detail adalah email. Pemetaan ini yang menjembatani keduanya; nama tampilan
  // ikut dari tabel yang sama, bukan dari catatan performa berkas.
  const emailPerUser = new Map(enrollments.map((b) => [b.user.userId, b.user.email]));
  const namaPerUser = new Map(enrollments.map((b) => [b.user.userId, b.user.nama]));

  const ringkasan = new Map<string, RingkasanIntegritas>();
  const nama = new Map<string, string>();
  for (const [userId, isi] of ringkasIntegritasByOwner(sesi)) {
    // Pemilik sesi tanpa enrollment (mis. kursusnya belum tercatat) tetap
    // ditampilkan dengan `userId`-nya sendiri: menyembunyikannya akan membuat
    // sesi yang ada tidak bisa ditelusuri dari laporan ini.
    const email = emailPerUser.get(userId) ?? userId;
    ringkasan.set(email, isi);
    nama.set(email, namaPerUser.get(userId) ?? email);
  }

  const baris = barisIntegritas(nama, ringkasan);

  return (
    <AppShell session={session} current="/performa/integritas">
      <PageHead
        eyebrow="Area verifikator"
        title="Laporan integritas"
        lead="Catatan pengamatan selama sesi terverifikasi. Laporan ini terpisah dari laporan belajar karena menjawab pertanyaan berbeda dan tidak pernah dipakai untuk menilai hasil belajar."
      />
      <div className="space-y-4">
        <PeringatanIntegritas />
        <IntegritasTabel baris={baris} />
      </div>
    </AppShell>
  );
}
