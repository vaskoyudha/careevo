import Link from "next/link";
import {
  BadgeCheck,
  Briefcase,
  CalendarClock,
  GraduationCap,
  Globe,
  Link2,
  MapPin,
  Pencil,
  Sparkle,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { EditProfileDialog } from "@/components/features/profile/edit-profile-dialog";
import { ResetOnboardingButton } from "@/components/features/settings/reset-onboarding-button";
import { LABELS, type OnboardingProfile } from "@/lib/onboarding/types";
import type { EditableProfile } from "@/lib/profile/types";
import { joinName } from "@/lib/profile/types";
import type { EntriKatalog } from "@/lib/courses/katalog";
import type { JobFixture } from "@/lib/fixtures";
import type { SessionPayload } from "@/lib/auth/types";

const DEFAULT_COVER = "/profil/cover-default.jpg";

const ROLE_LABEL: Record<SessionPayload["role"], string> = {
  user: "Peserta",
  verifikator: "Verifikator",
  admin: "Admin",
};

/**
 * The `/profil` page content.
 *
 * Laid out in the same visual language as `/belajar` (the learner home): a
 * light `#f5f7fa` → white section rhythm, rounded-2xl cards, and the `#0056D2`
 * accent — so the page feels like part of the product rather than an empty
 * card. Sections: identity header, quick stats, personalization summary, and
 * the recommendation strip that the onboarding answers actually power.
 */
export function ProfileView({
  session,
  profile,
  editable,
  kursus,
  loker,
}: {
  session: SessionPayload;
  profile: OnboardingProfile | null;
  editable: EditableProfile | null;
  kursus: EntriKatalog[];
  loker: JobFixture[];
}) {
  const displayName = editable
    ? joinName(editable.firstName, editable.lastName) || session.nama
    : session.nama;
  const username = editable?.username || session.username;
  const avatar = editable?.avatarUrl || "";
  const cover = editable?.coverUrl || DEFAULT_COVER;
  const initials = displayName.charAt(0).toUpperCase();

  const minat = profile
    ? profile.interests.map((i) => LABELS.interest[i]).join(" · ")
    : "Belum diisi";

  return (
    <div className="min-w-0 overflow-x-clip bg-white">
      {/* Identity header */}
      <section className="bg-[#f5f7fa]">
        <div className="mx-auto w-full max-w-7xl px-4 pt-8 pb-10 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
            <div className="relative h-32 bg-gradient-to-br from-blue-800 via-blue-600 to-sky-400 sm:h-40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cover}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover"
              />
            </div>

            <div className="flex flex-col gap-4 px-5 pb-6 sm:px-7">
              <div className="-mt-12 flex flex-wrap items-end justify-between gap-4">
                <div className="flex items-end gap-4">
                  <div className="relative size-24 shrink-0 overflow-hidden rounded-full border-4 border-white bg-[#0056D2] shadow-sm">
                    {avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatar} alt={displayName} className="h-full w-full object-cover" />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-3xl font-bold text-white uppercase">
                        {initials}
                      </span>
                    )}
                  </div>
                  <div className="pb-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                        {displayName}
                      </h1>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#0056D2]/10 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-[#0056D2] uppercase">
                        <BadgeCheck className="size-3.5" strokeWidth={2} aria-hidden="true" />
                        {ROLE_LABEL[session.role]}
                      </span>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
                      <span>@{username}</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                        Indonesia
                      </span>
                      {editable?.website ? (
                        <a
                          href={`https://${editable.website.replace(/^https?:\/\//, "")}`}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-[#0056D2] hover:underline"
                        >
                          <Globe className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                          {editable.website}
                        </a>
                      ) : null}
                    </p>
                  </div>
                </div>

                <EditProfileDialog
                  profile={editable}
                  nama={displayName}
                  username={username}
                  trigger={
                    <button
                      type="button"
                      className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#0056D2] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#00419e]"
                    >
                      <Pencil className="size-4" strokeWidth={2} aria-hidden="true" />
                      Edit profile
                    </button>
                  }
                />
              </div>

              <p className="max-w-2xl text-sm leading-relaxed text-gray-600">
                {editable?.bio ||
                  "Belum ada bio. Tekan Edit profile untuk menambahkan perkenalan singkat, website, dan foto profilmu."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quick stats */}
      <section className="border-y border-gray-200 bg-white">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-4 px-4 py-8 sm:px-6 lg:grid-cols-4 lg:px-8">
          <StatTile
            icon={<GraduationCap className="size-5" strokeWidth={1.75} aria-hidden="true" />}
            label="Rekomendasi kursus"
            value={String(kursus.length)}
          />
          <StatTile
            icon={<Briefcase className="size-5" strokeWidth={1.75} aria-hidden="true" />}
            label="Loker cocok"
            value={String(loker.length)}
          />
          <StatTile
            icon={<Target className="size-5" strokeWidth={1.75} aria-hidden="true" />}
            label="Minat terpilih"
            value={profile ? String(profile.interests.length) : "0"}
          />
          <StatTile
            icon={<CalendarClock className="size-5" strokeWidth={1.75} aria-hidden="true" />}
            label="Target belajar"
            value={profile ? `${profile.weeklyHours} jam` : "—"}
          />
        </div>
      </section>

      {/* Personalization summary */}
      <section className="bg-[#f5f7fa]">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-gray-900">
                Preferensi belajar &amp; karier
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Dipakai untuk menyusun rekomendasi kursus dan loker. Bisa diubah kapan saja.
              </p>
            </div>
            <Link
              href="/onboarding?edit=1"
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
            >
              <Pencil className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Ubah preferensi
            </Link>
          </div>

          {profile ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <InfoCard
                icon={<Sparkle className="size-4" strokeWidth={1.75} aria-hidden="true" />}
                label="Pengalaman"
                value={LABELS.experience[profile.experience]}
              />
              <InfoCard
                icon={<Users className="size-4" strokeWidth={1.75} aria-hidden="true" />}
                label="Latar belakang"
                value={LABELS.background[profile.background]}
              />
              <InfoCard
                icon={<TrendingUp className="size-4" strokeWidth={1.75} aria-hidden="true" />}
                label="Tujuan"
                value={LABELS.goal[profile.goal as keyof typeof LABELS.goal] ?? profile.goal}
              />
              <InfoCard
                icon={<Target className="size-4" strokeWidth={1.75} aria-hidden="true" />}
                label="Minat"
                value={minat}
                className="sm:col-span-2 lg:col-span-1"
              />
              <InfoCard
                icon={<CalendarClock className="size-4" strokeWidth={1.75} aria-hidden="true" />}
                label="Target belajar"
                value={`${profile.weeklyHours} jam/minggu`}
              />
              <InfoCard
                icon={<Briefcase className="size-4" strokeWidth={1.75} aria-hidden="true" />}
                label="Preferensi kerja"
                value={LABELS.workPreference[profile.workPreference]}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
              <p className="text-sm text-gray-600">
                Kamu belum mengisi preferensi belajar. Isi sebentar supaya rekomendasi jadi relevan.
              </p>
              <Link
                href="/onboarding"
                className="mt-3 inline-flex rounded-full bg-[#0056D2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00419e]"
              >
                Isi preferensi
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Recommendations the profile actually powers */}
      {kursus.length > 0 ? (
        <section className="bg-white">
          <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <h2 className="text-xl font-bold tracking-tight text-gray-900">Dipilih untukmu</h2>
            <p className="mt-1 mb-4 text-sm text-gray-600">
              Berdasarkan minat dan latar belakang yang kamu isi.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {kursus.map((item) => (
                <Link
                  key={item.id}
                  href={`/belajar/${item.slug ?? item.id}`}
                  className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-blue-300 hover:bg-blue-50/40"
                >
                  <span className="inline-flex w-fit rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700">
                    {item.tags[0] ?? "Umum"}
                  </span>
                  <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-gray-900 group-hover:underline">
                    {item.title}
                  </h3>
                  <p className="mt-auto pt-3 text-xs text-gray-500">
                    {item.provider} · {item.duration_min} mnt
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Public profile + account */}
      <section className="bg-[#f5f7fa]">
        <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
              <Link2 className="size-5 text-[#0056D2]" strokeWidth={1.75} aria-hidden="true" />
              Profil publik
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">
              Bagikan halaman publikmu ke perekrut. Zero-PII: tanpa email, berbasis username.
            </p>
            <Link
              href={`/p/${username}`}
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#0056D2] hover:underline"
            >
              Lihat /p/{username} →
            </Link>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-bold text-gray-900">Akun &amp; data</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-gray-500">Email:</dt>
                <dd className="font-medium text-gray-900">{session.email}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-gray-500">Username:</dt>
                <dd className="font-medium text-gray-900">@{username}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-gray-500">Peran:</dt>
                <dd className="font-medium text-gray-900">{ROLE_LABEL[session.role]}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href="/pengaturan"
                className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
              >
                Buka pengaturan privasi
              </Link>
              {profile ? (
                <ResetOnboardingButton className="border border-gray-300 bg-white text-gray-700 shadow-none hover:bg-gray-50 hover:text-gray-900" />
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <span className="inline-flex size-9 items-center justify-center rounded-lg bg-[#0056D2]/10 text-[#0056D2]">
        {icon}
      </span>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-4 ${className ?? ""}`}>
      <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
        <span className="text-[#0056D2]">{icon}</span>
        {label}
      </p>
      <p className="mt-1.5 text-sm font-medium text-gray-900">{value || "—"}</p>
    </div>
  );
}
