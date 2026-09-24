import {
  BadgeCheck,
  Briefcase,
  CalendarClock,
  Globe,
  GraduationCap,
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
import { LandingBtnLink } from "@/components/ui/landing-btn";
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

/** Rounded-square icon chip: glass pane with the landing blue-tinted icon. */
function IconChip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={
        "glass-chip inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 " +
        (className ?? "")
      }
    >
      {children}
    </span>
  );
}

/**
 * The `/profil` page content.
 *
 * Laid out in the same visual language as `/belajar` (the learner home) and the
 * landing page: a light `#f5f7fa` → white section rhythm, rounded-2xl cards,
 * landing-style `grad-btn` / grey buttons, and rounded-square blue icon chips.
 * Sections: identity header, quick stats, personalization summary, and the
 * recommendation strip that the onboarding answers actually power.
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
    <div className="glass-ambient min-w-0 overflow-x-clip">
      {/* Identity header */}
      <section>
        <div className="mx-auto w-full max-w-7xl px-4 pt-8 pb-10 sm:px-6 lg:px-8">
          <div className="glass-card overflow-hidden rounded-2xl">
            <div className="relative h-32 bg-gradient-to-br from-blue-800 via-blue-600 to-sky-400 sm:h-40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cover}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover"
              />
              {/* glass sheen over the cover so the pane reads as glass */}
              <div
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent"
              />
            </div>

            <div className="px-5 pt-4 pb-6 sm:px-7">
              {/* Avatar overlaps the cover; name/meta/action sit beside it, below the cover. */}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-end gap-4">
                  <div className="relative z-10 -mt-16 size-24 shrink-0 overflow-hidden rounded-full border-4 border-white bg-gradient-to-br from-blue-500 to-blue-300 shadow-md">
                    {avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatar} alt={displayName} className="h-full w-full object-cover" />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-3xl font-bold text-white uppercase">
                        {initials}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 pb-2 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-semibold -tracking-[0.6px] text-gray-900">
                        {displayName}
                      </h1>
                      <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-blue-700 uppercase">
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
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline"
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
                      className="grad-btn mt-1 inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-base font-medium shadow-sm transition duration-300 ease-in-out hover:-translate-y-0.5"
                    >
                      <Pencil className="size-4" strokeWidth={2.25} aria-hidden="true" />
                      Edit profile
                    </button>
                  }
                />
              </div>

              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-gray-600">
                {editable?.bio ||
                  "Belum ada bio. Tekan Edit profile untuk menambahkan perkenalan singkat, website, dan foto profilmu."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quick stats */}
      <section>
        <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-4 px-4 py-8 sm:px-6 lg:grid-cols-4 lg:px-8">
          <StatTile
            icon={<GraduationCap className="size-6" strokeWidth={1.75} aria-hidden="true" />}
            label="Rekomendasi kursus"
            value={String(kursus.length)}
          />
          <StatTile
            icon={<Briefcase className="size-6" strokeWidth={1.75} aria-hidden="true" />}
            label="Loker cocok"
            value={String(loker.length)}
          />
          <StatTile
            icon={<Target className="size-6" strokeWidth={1.75} aria-hidden="true" />}
            label="Minat terpilih"
            value={profile ? String(profile.interests.length) : "0"}
          />
          <StatTile
            icon={<CalendarClock className="size-6" strokeWidth={1.75} aria-hidden="true" />}
            label="Target belajar"
            value={profile ? `${profile.weeklyHours} jam` : "—"}
          />
        </div>
      </section>

      {/* Personalization summary */}
      <section>
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-medium -tracking-[0.6px] text-gray-900">
                Preferensi belajar &amp; karier
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Dipakai untuk menyusun rekomendasi kursus dan loker. Bisa diubah kapan saja.
              </p>
            </div>
            <LandingBtnLink variant="secondary" href="/onboarding?edit=1">
              <Pencil className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Ubah preferensi
            </LandingBtnLink>
          </div>

          {profile ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <InfoCard
                icon={<Sparkle className="size-5" strokeWidth={1.75} aria-hidden="true" />}
                label="Pengalaman"
                value={LABELS.experience[profile.experience]}
              />
              <InfoCard
                icon={<Users className="size-5" strokeWidth={1.75} aria-hidden="true" />}
                label="Latar belakang"
                value={LABELS.background[profile.background]}
              />
              <InfoCard
                icon={<TrendingUp className="size-5" strokeWidth={1.75} aria-hidden="true" />}
                label="Tujuan"
                value={LABELS.goal[profile.goal as keyof typeof LABELS.goal] ?? profile.goal}
              />
              <InfoCard
                icon={<Target className="size-5" strokeWidth={1.75} aria-hidden="true" />}
                label="Minat"
                value={minat}
                className="sm:col-span-2 lg:col-span-1"
              />
              <InfoCard
                icon={<CalendarClock className="size-5" strokeWidth={1.75} aria-hidden="true" />}
                label="Target belajar"
                value={`${profile.weeklyHours} jam/minggu`}
              />
              <InfoCard
                icon={<Briefcase className="size-5" strokeWidth={1.75} aria-hidden="true" />}
                label="Preferensi kerja"
                value={LABELS.workPreference[profile.workPreference]}
              />
            </div>
          ) : (
            <div className="glass-card rounded-2xl border-dashed p-8 text-center">
              <p className="text-sm text-gray-600">
                Kamu belum mengisi preferensi belajar. Isi sebentar supaya rekomendasi jadi relevan.
              </p>
              <div className="mt-3 flex justify-center">
                <LandingBtnLink href="/onboarding">Isi preferensi</LandingBtnLink>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Recommendations the profile actually powers */}
      {kursus.length > 0 ? (
        <section>
          <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-medium -tracking-[0.6px] text-gray-900">
              Dipilih untukmu
            </h2>
            <p className="mt-1 mb-5 text-sm text-gray-500">
              Berdasarkan minat dan latar belakang yang kamu isi.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {kursus.map((item) => (
                <a
                  key={item.id}
                  href={`/belajar/${item.slug ?? item.id}`}
                  className="glass-card glass-card--interactive group flex flex-col rounded-2xl p-5"
                >
                  <IconChip className="size-11">
                    <GraduationCap className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  </IconChip>
                  <span className="mt-3 inline-flex w-fit rounded-full border border-blue-200/80 bg-white/70 px-2.5 py-0.5 text-[11px] font-medium text-blue-700 backdrop-blur-sm">
                    {item.tags[0] ?? "Umum"}
                  </span>
                  <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-gray-900 group-hover:underline">
                    {item.title}
                  </h3>
                  <p className="mt-auto pt-3 text-xs text-gray-500">
                    {item.provider} · {item.duration_min} mnt
                  </p>
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Public profile + account */}
      <section>
        <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-10 pb-16 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <IconChip>
                <Link2 className="size-6" strokeWidth={1.75} aria-hidden="true" />
              </IconChip>
              <div>
                <h2 className="text-lg font-medium text-gray-900">Profil publik</h2>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">
                  Bagikan halaman publikmu ke perekrut. Zero-PII: tanpa email, berbasis username.
                </p>
              </div>
            </div>
            <div className="mt-4">
              <LandingBtnLink variant="secondary" href={`/p/${username}`}>
                Lihat /p/{username}
              </LandingBtnLink>
            </div>
          </div>

          <div className="glass-card glass-card--strong rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <IconChip>
                <BadgeCheck className="size-6" strokeWidth={1.75} aria-hidden="true" />
              </IconChip>
              <div className="min-w-0">
                <h2 className="text-lg font-medium text-gray-900">Akun &amp; data</h2>
                <dl className="mt-2 space-y-1.5 text-sm">
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
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <LandingBtnLink variant="secondary" href="/pengaturan">
                Buka pengaturan privasi
              </LandingBtnLink>
              {profile ? <ResetOnboardingButton variant="landing" /> : null}
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
    <div className="glass-card glass-card--interactive rounded-2xl p-5">
      <IconChip>{icon}</IconChip>
      <p className="mt-4 text-3xl font-medium -tracking-[0.6px] text-gray-900">{value}</p>
      <p className="mt-0.5 text-sm text-gray-500">{label}</p>
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
    <div
      className={
        "glass-card flex items-start gap-3 rounded-2xl p-4 " + (className ?? "")
      }
    >
      <IconChip className="size-10 rounded-lg">{icon}</IconChip>
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-gray-900">{value || "—"}</p>
      </div>
    </div>
  );
}
