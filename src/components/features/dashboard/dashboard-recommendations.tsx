import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Briefcase,
  Building2,
  GraduationCap,
  MapPin,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { LABELS, levelLabel, type OnboardingProfile } from "@/lib/onboarding/types";
import { rekomendasiUntukProfil, type RekomendasiLoker } from "@/lib/onboarding/rekomendasi";
import { monogram } from "@/lib/jobs/monogram";
import { CatalogCourseCard } from "@/components/ui/catalog-course-card";
import { StatusBadge } from "@/components/ui/status-badge";

/**
 * Personalized recommendation strip for the dashboard.
 *
 * Kursus tampil sebagai kartu katalog (kartu yang sama dengan `/belajar` dan
 * `/jelajah`); loker tetap baris ringkas supaya ranking dan meta gaji tetap
 * terbaca sekilas. Server component — data is scoped to the signed profile.
 */
export async function DashboardRecommendations({
  profile,
}: {
  profile: OnboardingProfile;
}) {
  const { kursus, loker } = await rekomendasiUntukProfil(profile);

  const interestLabels = profile.interests.map((i) => LABELS.interest[i]).join(", ");
  /** Satu kalimat yang menjelaskan kenapa isi panel ini yang direkomendasikan. */
  const ringkasanMinat = `Berdasarkan minat: ${interestLabels} · target ${profile.weeklyHours} jam/minggu`;

  return (
    <section
      // min-w-0 is the grid-overflow guard here. This is a grid item, and a grid
      // item's default min-width is its min-content width, so a long interest
      // label or target role refused to shrink, pushed this card to 418px inside
      // a 320px viewport, and body's overflow-x: clip ate 98px of it silently.
      // grid-cols-1 on the parent covers the track side.
      //
      // `break-words` is gone with the subtitle it belonged to. The longest
      // single word left is a course or job title, and both sit inside their own
      // line-clamping cards, so nothing here needs somewhere to break.
      className="min-w-0 rounded-xl border border-gray-200 bg-white p-5 shadow-xs"
      aria-labelledby="personal-title"
    >
      {/* Header memakai resep header tile bento — `.dash-card-head` +
          `.dash-icon` + `.dash-title`: lencana ikon bertint + judul tebal. Satu
          resep untuk semua header dashboard, jadi panel ini terbaca sebagai
          kartu dari keluarga yang sama dan bukan judul lepas yang kebetulan
          panjang. Kelas-kelas itu di-SCOPE ke `.dashboard-shell`, jadi panel ini
          harus terus dirender di dalam shell itu — dipindah ke halaman lain
          tanpa shell-nya, ia kehilangan lencananya tanpa error.

          Judulnya tetap h2 dan tetap di atas "Kursus"/"Loker": hierarkinya TIDAK
          dibuat rata. Sub-heading di dalam panel ini tetap baris huruf kapital
          biru kecil (lihat `kursus-mu`/`loker-mu` di bawah), jadi yang berubah
          hanya kepala panelnya — bukan bahasa visual seluruh kartu.

          Ikonnya **`UserCheck`**, bukan `Sparkles`: ini permukaan rekomendasi
          yang sama dengan panel "Cocok Untukmu" di `/loker/inbox`, dan panel itu
          memakai `UserCheck` di kepalanya. Lambang yang sama membuat dua
          permukaan rekomendasi terbaca sebagai satu keluarga. `Sparkles` tetap
          dipakai di baris "Cocok: …" tiap kartu lowongan di bawah, dan itu
          memang tempat yang berbeda: di sana ia menandai baris bukti, bukan
          kepala panel.

          Baris penjelasan "Berdasarkan minat …" tidak lagi berdiri sendiri di
          bawah judul; ia jadi `title` tautan "Ubah minat" plus paragraf
          `sr-only` yang dirujuk `aria-describedby`. Satu kalimat yang bisa
          dibaca dengan hover atau pembaca layar, tanpa menambah baris di kepala
          dan tanpa menghapus alasan di balik urutan rekomendasi ini. */}
      <div className="dash-card-head mb-4 flex-wrap">
        <span className="dash-icon" aria-hidden="true">
          <UserCheck className="size-4" />
        </span>
        <h2 id="personal-title" className="dash-title">
          Dipilih untukmu
        </h2>
        <Link
          href="/onboarding?edit=1"
          title={ringkasanMinat}
          aria-describedby="personal-desc"
          className="dash-head-action inline-flex items-center gap-1 text-[13px] font-semibold text-[#007aff] whitespace-nowrap transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-[#0056d2]"
        >
          Ubah minat
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      <p className="sr-only" id="personal-desc">
        {ringkasanMinat}
      </p>

      {kursus.length === 0 && loker.length === 0 ? (
        <p className="text-xs text-gray-500">
          Belum ada rekomendasi yang cocok. Coba tambah minat di Pengaturan.
        </p>
      ) : null}

      {kursus.length > 0 && loker.length === 0 ? (
        <p className="text-xs text-gray-500">
          Belum ada lowongan yang cocok untuk minatmu saat ini. Coba ubah minat, atau jelajahi semua lowongan di{" "}
          <Link href="/loker" className="font-medium text-[#0056D2] hover:underline">
            halaman loker
          </Link>
          .
        </p>
      ) : null}

      {kursus.length > 0 ? (
        <div className="mb-6">
          {/* Blue "Kursus" tray: the four recommendation cards sit inside one
              soft-blue surface that hugs the whole set, so they read as a single
              curated group instead of four loose cards floating on the white
              panel. The tray bleeds the group's own colour from the dashboard
              tokens; the cards stay white so each one still pops off the blue. */}
          <div className="dash-reco-tray">
            <h3
              id="kursus-mu"
              className="mb-3 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-[#0056D2] uppercase"
            >
              <GraduationCap className="size-3.5" aria-hidden="true" />
              Kursus
              <span className="ml-1 rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-[#0056D2]">
                {kursus.length}
              </span>
            </h3>
            <div
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              role="group"
              aria-labelledby="kursus-mu"
            >
              {kursus.map((entry) => (
                <CatalogCourseCard
                  key={entry.slug}
                  resource={entry}
                  href={`/belajar/${entry.slug}`}
                  className="dash-reco-card"
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {loker.length > 0 ? (
        <div>
          <h3
            id="loker-mu"
            className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-[#0056D2] uppercase"
          >
            <Briefcase className="size-3.5" aria-hidden="true" />
            Loker
            <span className="ml-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-[#0056D2]">
              {loker.length}
            </span>
            <Link
              href="/loker"
              className="ml-auto text-[11px] font-medium text-[#0056D2] normal-case hover:underline"
            >
              Lihat semua
            </Link>
          </h3>

          {/* Tray yang sama dengan blok kursus, bukan baris datar di panel putih.
              Empat kartu putih di dalam satu permukaan biru muda dibaca sebagai
              satu kelompok pilihan, bukan empat lowongan lepas — persis cara
              kartu "Rilisan terbaru" di `/belajar` berdiri di dalam kolomnya. */}
          <div className="dash-reco-tray">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="group" aria-labelledby="loker-mu">
              {loker.map((item) => (
                <KartuRekomendasiLoker key={item.job.id} item={item} />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/**
 * One recommended posting, shaped like the compact catalog cards on `/belajar`
 * ("Rilisan terbaru"): white tile, square company mark on the left, then an
 * eyebrow / title / meta stack on the right.
 *
 * The fourth line is the point of the redesign. A list row can only state *what*
 * the posting is; this card also states **why it was recommended** — the evidence
 * words `analisisLoker` pulled out of the title, tags and description ("React ·
 * TypeScript · API"). That is what makes the ranking checkable instead of
 * something the learner has to take on faith: if the words look wrong, the
 * profile is wrong, and "Ubah minat" is right above.
 *
 * The Sentinel badge stays on the card. Ranking decides *order*, never
 * admissibility — a quarantined posting that matches may still be shown, but it
 * is never shown without its verdict.
 *
 * The posting's type is reached through `RekomendasiLoker`, never imported from
 * the fixtures module directly: `dashboard-integritas.test.ts` forbids that
 * import across every dashboard component — and because it reads the file as
 * plain text, a type-only import *and a comment naming the module* both trip it.
 * The lib layer is where fixtures may be read; this card only renders what the
 * ranking handed it.
 */
function KartuRekomendasiLoker({ item }: { item: RekomendasiLoker }) {
  const { job, cocok } = item;
  return (
    <Link
      href={`/loker/${job.id}`}
      className="group flex min-w-0 items-start gap-3 rounded-xl border border-transparent bg-white p-2.5 text-left shadow-2xs transition-all duration-200 hover:border-gray-200 hover:no-underline hover:shadow-xs active:scale-[0.98] sm:gap-3.5 sm:p-3"
      aria-label={`${job.title} — ${job.company}, ${job.location}, ${levelLabel(job.level)}${job.salary_range ? `, gaji ${job.salary_range}` : ""}`}
    >
      {/* Lowongan tidak punya logo, jadi kotak ini memakai monogram — sama
          seperti kartu lowongan di papan `/loker`, bukan gambar yang harus
          diunduh untuk empat inisial. Ukurannya mengecil di bawah `sm`: kartu
          selebar 301px hanya menyisakan ~170px untuk teks kalau kotaknya tetap
          64px, dan yang habis lebih dulu justru lokasi dan baris "Cocok". */}
      <span
        aria-hidden="true"
        className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-sm font-bold text-[#0056D2] ring-1 ring-blue-100 sm:size-16 sm:text-base"
      >
        {monogram(job.company)}
      </span>

      <span className="min-w-0 flex-1">
        {/* Baris identitas: perusahaan, verdict Sentinel, gaji. Badge-nya
            `shrink-0` dan gaji hilang di bawah `sm`, jadi pada 375px nama
            perusahaan tetap terbaca penuh — dan itu yang harus dipotong lebih
            dulu, karena gaji bisa dibaca lagi di `/loker/[id]`. */}
        <span className="flex items-center gap-2">
          <Building2 className="size-3 shrink-0 text-gray-400" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-xs font-normal text-[#4B5563]">
            {job.company}
          </span>
          <span className="shrink-0">
            <StatusBadge status={job.sentinel_status} />
          </span>
          {job.salary_range ? (
            <span className="hidden shrink-0 items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 sm:inline-flex">
              <Banknote className="size-3 text-emerald-600" aria-hidden="true" />
              {job.salary_range}
            </span>
          ) : null}
        </span>

        <h4 className="mt-0.5 line-clamp-2 text-[13px] leading-snug font-bold text-gray-900 transition-colors group-hover:text-[#0056D2]">
          {job.title}
        </h4>

        {/* Baris meta memakai seluruh lebar: badge sudah pindah ke atas, jadi
            di sinilah "Jakarta · Onsite · Menengah" masih muat pada 375px.
            Lokasi TIDAK memakai `flex-1`: ia harus memotong saat sempit, tapi
            tidak boleh mendorong tingkat level ke tepi kanan kartu — di lebar
            desktop itu memisahkan "Menengah" sejauh 300px dari lokasinya. */}
        <span className="mt-1 flex items-center gap-1.5 text-xs text-[#4B5563]">
          <MapPin className="size-3 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">{job.location}</span>
          <span className="text-gray-300" aria-hidden="true">
            ·
          </span>
          <span className="shrink-0">{levelLabel(job.level)}</span>
        </span>

        {/* Baris penuh untuk alasannya. Ini baris yang paling penting di kartu,
            jadi ia tidak berbagi lebar dengan badge apa pun: berbagi lebar
            menyisakan ~120px di 375px — cukup untuk "Cocok: Fullst…", yaitu
            separuh teks yang membuat kartu ini berbeda dari daftar lama. */}
        {cocok.length > 0 ? (
          <span className="mt-1.5 flex min-w-0 items-center gap-1 text-[11px] text-[#0056D2]">
            <Sparkles className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">Cocok: {cocok.join(" · ")}</span>
          </span>
        ) : null}
      </span>
    </Link>
  );
}
