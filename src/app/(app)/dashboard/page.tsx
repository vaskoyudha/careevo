import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/onboarding/store";
import { LABELS } from "@/lib/onboarding/types";
import { AppShell } from "@/components/ui/app-shell";
import { PageHead } from "@/components/ui/page-head";
import { DashboardRecommendations } from "@/components/features/dashboard/dashboard-recommendations";
import { JobInboxCard } from "@/components/features/dashboard/job-inbox-card";
import { KartuLanjutkan, pilihCourseDilanjutkan } from "@/components/features/dashboard/kartu-lanjutkan";
import { KartuProfil, KartuSertifikat } from "@/components/features/dashboard/kartu-profil";
import { KartuSkor } from "@/components/features/dashboard/kartu-skor";
import { KartuStreak } from "@/components/features/dashboard/kartu-streak";
import { listRunUser } from "@/lib/learning/repository";
import { ringkasKehadiran, statusKehadiran } from "@/lib/learning/kehadiran";
import { listProgresKursus } from "@/lib/learning/progres-kursus";
import { listSertifikatDb } from "@/lib/review/service";
import { skorIntegritasDb } from "@/lib/integritas/service";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * Dashboard peserta.
 *
 * Permukaan ini hanya menampilkan yang bisa ditelusuri ke akun yang sedang
 * masuk: profil, hari beruntun dari `learning_runs`, skor kejujuran dari
 * `integrity_violations`, sertifikat `active` dari `attestations`, dan course
 * yang masih berjalan. Tidak ada satu pun angka di sini yang berasal dari
 * fixture.
 *
 * Tiga hal yang dijaga oleh test dan tidak boleh dilonggarkan diam-diam:
 *
 * - **Tidak ada fixture.** Angka 87/100 di `src/fixtures/profile.json` adalah
 *   milik profil fiktif. `dashboard-integritas.test.ts` menjaga halaman dan
 *   seluruh folder komponen dashboard; `kartu.test.ts` menjaga komponennya
 *   satu per satu, karena penjaga halaman saja bisa dilewati lewat komponen
 *   yang diimpor.
 * - **Streak dan skor dihitung server.** `ringkasKehadiran` dan
 *   `hitungSkorIntegritas` tidak pernah ikut ke browser: keduanya butuh baris
 *   database. Hitung ulang di klien akan menghasilkan angka yang bisa berbeda
 *   dari yang dibaca server tanpa ada yang memperingatkan.
 * - **"Lanjutkan" memakai `listProgresKursus`.** Helper yang sama dipakai
 *   `/progres` dan `/belajar`, jadi tiga halaman tidak bisa memilih course yang
 *   berbeda untuk akun yang sama.
 */
export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const [profile, skor, sertifikat, progresKursus, run] = await Promise.all([
    getProfile(session.userId, session.email),
    skorIntegritasDb(session.userId),
    listSertifikatDb(session),
    listProgresKursus(session),
    listRunUser(session.userId),
  ]);

  // Baris run dengan `state` yang tidak dikenal dibuang, bukan dipaksa: nilainya
  // akan jatuh ke cabang durasi yang salah dan mengubah angka jam. Lihat
  // `statusKehadiran`.
  const runTerbaca = run
    .map((r) => {
      const state = statusKehadiran(r.state);
      return state === null ? null : { ...r, state };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const kehadiran = ringkasKehadiran(runTerbaca, { now: new Date() });
  const lanjutkan = pilihCourseDilanjutkan(progresKursus);

  return (
    <AppShell session={session} current="/dashboard">
      <PageHead
        title={`Halo, ${session.nama}`}
        lead="Ringkasan belajar kamu, semua dihitung dari catatan yang benar-benar ada."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KartuProfil
          nama={session.nama}
          username={session.username}
          minat={profile ? profile.interests.map((i) => LABELS.interest[i]) : []}
          targetJam={profile ? profile.weeklyHours : null}
        />
        <KartuStreak hariBeruntun={kehadiran.streakHari} />
        <KartuSkor ringkasan={skor} />
        <KartuLanjutkan course={lanjutkan} />
        <div className="sm:col-span-2 xl:col-span-2">
          <KartuSertifikat daftar={sertifikat} />
        </div>
      </div>

      {profile ? (
        <div className="mb-6">
          <DashboardRecommendations profile={profile} />
        </div>
      ) : null}
      <JobInboxCard />
    </AppShell>
  );
}
