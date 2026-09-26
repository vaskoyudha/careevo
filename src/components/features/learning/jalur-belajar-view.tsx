import Link from "next/link";
import { hitungProgres } from "@/lib/courses/kurikulum";
import type { PathModule, PersonalizedPath } from "@/lib/learning/personalized-path";
import { LABELS, isGoal, type OnboardingProfile } from "@/lib/onboarding/types";

const MODULE_STATUS_LABEL: Record<PathModule["status"], string> = {
  completed: "Selesai",
  current: "Sedang dipelajari",
  upcoming: "Mendatang",
};

const MODULE_STATUS_STYLE: Record<PathModule["status"], string> = {
  completed: "border-emerald-200 bg-emerald-50/60",
  current: "border-blue-300 bg-blue-50/70",
  upcoming: "border-gray-200 bg-white",
};

export function JalurBelajarView({
  path,
  profile,
}: {
  readonly path: PersonalizedPath;
  readonly profile: OnboardingProfile;
}) {
  const completedCount = path.modules.filter(
    (module) => module.status === "completed",
  ).length;
  const progress = hitungProgres(completedCount, path.modules.length);
  const courseHref = path.course
    ? `/belajar/${path.course.slug}#kurikulum`
    : "/belajar";
  const allCompleted =
    path.modules.length > 0 && completedCount === path.modules.length;
  const interests = profile.interests
    .map((interest) => LABELS.interest[interest])
    .join(", ");
  const goal = isGoal(profile.goal) ? LABELS.goal[profile.goal] : profile.goal;

  return (
    <section
      data-path-source={path.source}
      aria-labelledby="judul-jalur-belajar"
      className="min-w-0 overflow-x-clip bg-[#f5f7fa]"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-14">
        <nav aria-label="Breadcrumb" className="text-sm text-gray-500">
          <Link href="/belajar" className="hover:text-[#0056D2] hover:underline">
            Belajar
          </Link>
          <span aria-hidden="true"> / </span>
          <span className="font-medium text-gray-900">Jalur Belajar</span>
        </nav>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.18em] text-[#0056D2] uppercase">
              Jalur belajar personal
            </p>
            <h1
              id="judul-jalur-belajar"
              className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl"
            >
              Jalur Belajar
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-gray-600">
              Jalur ini disusun dari minat {interests} dan tujuan belajarmu: {goal}.
            </p>

            {/* AI Mastery is the study chat, at /ai-mastery; mastery lives at
                /belajar/mastery, books at /belajar/buku and practice quizzes at
                /belajar/latihan. Each is a separate workspace rather than
                something embedded here. */}
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/ai-mastery"
                className="inline-flex items-center gap-2 rounded-lg bg-[#1f1f1f] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black"
              >
                Buka AI Mastery
                <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/belajar/mastery"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50"
              >
                Jalur Penguasaan
                <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/belajar/buku"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50"
              >
                Buku
                <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/belajar/latihan"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50"
              >
                Latihan Soal
                <span aria-hidden="true">→</span>
              </Link>
            </div>

            {path.course ? (
              <div className="mt-7 min-w-0 rounded-2xl border border-gray-200 bg-white p-5 shadow-xs sm:p-6">
                <p className="text-xs font-bold tracking-wider text-gray-500 uppercase">
                  Kursus pilihan
                </p>
                <h2 className="mt-1 break-words text-xl font-bold text-gray-900">
                  {path.course.title}
                </h2>
                <p className="mt-1 break-words text-sm text-gray-600">
                  {path.course.provider} · {path.course.duration_min} menit
                </p>
                <div className="mt-5 flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-gray-900">Progres belajar</span>
                  <span className="font-bold text-[#0056D2]">{progress}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`Progres belajar ${path.course.title}`}
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-200"
                >
                  <div
                    className="h-full rounded-full bg-[#0056D2] transition-[width] duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {completedCount} dari {path.modules.length} modul selesai
                </p>
              </div>
            ) : (
              <div className="mt-7 rounded-2xl border border-dashed border-gray-300 bg-white p-6">
                <h2 className="text-xl font-bold text-gray-900">
                  Belum ada kursus yang cocok
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  Katalogmu masih perlu ditambah. Jelajahi pilihan lain dan kembali
                  ketika sudah menemukan arah belajar yang relevan.
                </p>
                <Link
                  href="/belajar"
                  className="mt-5 inline-flex rounded-lg bg-[#0056D2] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#00419e]"
                >
                  Jelajahi kursus
                </Link>
              </div>
            )}
          </div>

          <aside className="min-w-0 self-start rounded-2xl border border-gray-200 bg-white p-5 shadow-xs sm:p-6">
            <h2 className="text-sm font-bold tracking-wider text-gray-500 uppercase">
              Langkah berikutnya
            </h2>
            {allCompleted && path.course ? (
              <>
                <p className="mt-3 text-lg font-bold text-gray-900">Kursus selesai</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  Semua modul sudah selesai. Ulangi materi atau tinjau kursus
                  kapan pun kamu perlu.
                </p>
                <Link
                  href={courseHref}
                  className="mt-5 inline-flex w-full justify-center rounded-lg bg-[#0056D2] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#00419e]"
                >
                  Ulas kursus
                </Link>
              </>
            ) : path.nextAction ? (
              <>
                <p className="mt-3 break-words text-lg font-bold text-gray-900">
                  {path.modules.find((module) => module.status === "current")?.title ??
                    path.course?.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  Lanjutkan dari langkah yang sudah ditentukan untukmu.
                </p>
                <Link
                  href={path.nextAction.href}
                  className="mt-5 inline-flex w-full justify-center rounded-lg bg-[#0056D2] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#00419e]"
                >
                  {path.nextAction.label}
                </Link>
              </>
            ) : null}
            <Link
              href="/belajar"
              className="mt-4 block text-center text-sm font-semibold text-[#0056D2] hover:underline"
            >
              Kembali ke katalog
            </Link>
          </aside>
        </div>

        {path.course ? (
          <section aria-labelledby="judul-daftar-modul" className="mt-10 min-w-0">
            <h2 id="judul-daftar-modul" className="text-2xl font-bold tracking-tight text-gray-900">
              Daftar modul
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Ikuti urutan ini untuk menyelesaikan kursus secara bertahap.
            </p>
            <ol className="mt-5 space-y-3">
              {path.modules.map((module, index) => (
                <li
                  key={module.id}
                  data-module-status={module.status}
                  className={`min-w-0 rounded-2xl border p-4 sm:p-5 ${MODULE_STATUS_STYLE[module.status]}`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-sm font-bold text-gray-700 shadow-xs"
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Link
                          href={module.href}
                          className="break-words text-sm font-bold text-gray-900 hover:text-[#0056D2] hover:underline"
                        >
                          {module.title}
                        </Link>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-600">
                          {MODULE_STATUS_LABEL[module.status]}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>
    </section>
  );
}
