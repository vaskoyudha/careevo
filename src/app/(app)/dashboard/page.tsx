import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Target } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/onboarding/store";
import { LABELS } from "@/lib/onboarding/types";
import { AppShell } from "@/components/ui/app-shell";
import { DashboardRecommendations } from "@/components/features/dashboard/dashboard-recommendations";
import { JobInboxCard } from "@/components/features/dashboard/job-inbox-card";
import { KartuLanjutkan, pilihCourseDilanjutkan } from "@/components/features/dashboard/kartu-lanjutkan";
import { KartuProgresKursus } from "@/components/features/dashboard/kartu-kursus-progres";
import { KartuProfil, KartuSertifikat } from "@/components/features/dashboard/kartu-profil";
import { KartuSkor } from "@/components/features/dashboard/kartu-skor";
import { KartuStreak } from "@/components/features/dashboard/kartu-streak";
import { listRunUser } from "@/lib/learning/repository";
import { mingguAktif, ringkasKehadiran, statusKehadiran } from "@/lib/learning/kehadiran";
import { listProgresKursus } from "@/lib/learning/progres-kursus";
import { listSertifikatDb } from "@/lib/review/service";
import { skorIntegritasDenganDelta } from "@/lib/integritas/service";

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
 *   dari yang dibaca server tanpa ada yang memperingatkan. Strip hari mingguan
 *   mengikuti aturan yang sama — `mingguAktif` menerima `now` dari sini, bukan
 *   membaca jam peramban.
 * - **"Lanjutkan" memakai `listProgresKursus`.** Helper yang sama dipakai
 *   `/progres` dan `/belajar`, jadi tiga halaman tidak bisa memilih course yang
 *   berbeda untuk akun yang sama.
 */
export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const [profile, skor, sertifikat, progresKursus, run] = await Promise.all([
    getProfile(session.userId, session.email),
    skorIntegritasDenganDelta(session.userId),
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

  const now = new Date();
  const kehadiran = ringkasKehadiran(runTerbaca, { now });
  const minggu = mingguAktif(kehadiran.hariAktif, now);
  const lanjutkan = pilihCourseDilanjutkan(progresKursus);
  const targetJam = profile ? profile.weeklyHours : null;
  // Huruf pertama nama, untuk avatar di tepi kiri band sapaan. Kosongnya nama
  // adalah kondisi yang harus punya sesuatu yang bisa digambar, jadi ia jatuh ke
  // "?" — bukan ke avatar kosong yang terbaca sebagai gambar yang gagal dimuat.
  const inisial = session.nama.trim().charAt(0).toUpperCase() || "?";

  return (
    <AppShell session={session} current="/dashboard">
      {/* Band sapaan. Permukaannya putih bersih — satu keluarga dengan kartu di
          bawahnya, hanya beda isian — supaya perhatian jatuh ke angka milik
          peserta, bukan ke banner-nya. Chip di kanan adalah ajakan, bukan angka;
          karena band-nya sekarang putih, chip-nya diberi isian biru tipis
          supaya tetap terbaca sebagai elemen terpisah. */}
      <section className="dash-hero mb-5 px-5 py-4">
        <div className="dash-hero-inner flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <div className="relative z-10 flex min-w-0 items-center gap-3.5">
            {/* Avatar di tepi kiri band. Inisialnya dihitung dari nama yang
                diberikan, bukan dari gambar profil: belum ada unggahan avatar di
                alur onboarding, dan menampilkan gambar bawaan akan terbaca
                sebagai "foto kamu" padahal bukan. Sengaja `aria-hidden` —
                namanya sudah tertulis penuh di sapaan di sebelahnya, jadi
                inisial di sini tidak menambah informasi apa pun bagi pembaca
                layar. */}
            <span className="dash-hero-avatar" aria-hidden="true">
              {inisial}
            </span>

            <div className="min-w-0">
              <h1 className="text-[clamp(23px,2.6vw,30px)] leading-tight font-bold tracking-tight text-gray-900">
                Halo, {session.nama}
                <span className="ml-1.5 font-normal">👋</span>
              </h1>
              <p className="mt-1.5 max-w-[46ch] text-[13px] text-gray-600">
                Terus belajar, kembangkan keterampilan, dan wujudkan masa depan
                yang lebih baik.
              </p>
            </div>
          </div>

          {/* Ajakan, bukan angka: judulnya menjelaskan arah, dan tautannya ke
              dashboard/progres. Panahnya yang menandakan "ada lanjutannya",
              jadi tidak perlu tombol penuh di dalam band. */}
          <Link
            href="/progres"
            className="relative z-10 flex w-full shrink-0 items-center gap-2.5 rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-2.5 transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-blue-50 active:scale-[0.99] sm:w-auto sm:max-w-[290px]"
          >
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-50 text-[#007aff]"
            >
              <Target className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-bold text-gray-900">
                Progres Anda hari ini
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-gray-500">
                Selangkah lebih dekat menuju versi terbaik diri Anda.
              </span>
            </span>
            <ArrowRight
              className="size-4 shrink-0 text-[#007aff]"
              aria-hidden="true"
            />
          </Link>
        </div>
      </section>

      {/* Urutan DOM sengaja mengikuti urutan VISUAL di `xl` (profil, streak,
          skor, sertifikat, progres, lalu lanjutkan yang selebar penuh). Area
          grid hanya berlaku di `xl`; di bawah itu yang menentukan adalah urutan
          di sini, jadi menyamakannya membuat peserta yang mengecilkan jendela
          tidak melihat dua kartu bertukar tempat — dan pembaca layar membacanya
          dalam urutan yang sama dengan yang terlihat. */}
      <div className="dash-bento mb-5">
        <div className="dash-sel dash-sel-profil">
          <KartuProfil
            nama={session.nama}
            username={session.username}
            minat={profile ? profile.interests.map((i) => LABELS.interest[i]) : []}
            targetJam={targetJam}
          />
        </div>
        <div className="dash-sel dash-sel-streak">
          <KartuStreak hariBeruntun={kehadiran.streakHari} minggu={minggu} />
        </div>
        <div className="dash-sel dash-sel-skor">
          <KartuSkor ringkasan={skor} />
        </div>
        <div className="dash-sel dash-sel-sertif">
          <KartuSertifikat daftar={sertifikat} />
        </div>
        <div className="dash-sel dash-sel-progres">
          <KartuProgresKursus daftar={progresKursus} />
        </div>
        <div className="dash-sel dash-sel-lanjut">
          <KartuLanjutkan course={lanjutkan} />
        </div>
      </div>

      {profile ? (
        <div className="mb-5">
          <DashboardRecommendations profile={profile} />
        </div>
      ) : null}
      <JobInboxCard />
    </AppShell>
  );
}
