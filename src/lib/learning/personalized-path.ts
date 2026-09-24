import { normalizeOwner } from "@/lib/auth/types";
import type { EntriKatalog } from "@/lib/courses/katalog";
import type { Pendaftaran } from "@/lib/courses/enrollment";
import { irisModulSelesai, modulKursus } from "@/lib/courses/kurikulum";
import { rekomendasiKursus } from "@/lib/onboarding/rekomendasi";
import type { OnboardingProfile } from "@/lib/onboarding/types";

export type PersonalizedPathInput = {
  profile: OnboardingProfile;
  catalog: EntriKatalog[];
  enrollments: Pendaftaran[];
};

export type PathModule = {
  id: string;
  title: string;
  status: "completed" | "current" | "upcoming";
  href: string;
};

export type NextLearningAction = {
  kind: "continue-course" | "start-course" | "explore-courses";
  label: string;
  href: string;
  moduleId?: string;
};

export type PersonalizedPath = {
  course: EntriKatalog | null;
  source: "active-enrollment" | "recommendation" | "empty";
  modules: PathModule[];
  nextAction: NextLearningAction | null;
};

export function bangunJalurPersonalisasi(
  input: PersonalizedPathInput,
): PersonalizedPath {
  const owner = normalizeOwner(input.profile.owner);
  const validOwned = input.enrollments
    .filter(
      (item) => item.owner !== undefined && normalizeOwner(item.owner) === owner,
    )
    .flatMap((item) => {
      const course = input.catalog.find((candidate) => candidate.id === item.course_id);
      const enrolledAt = Date.parse(item.enrolled_at);
      return course && Number.isFinite(enrolledAt) ? [{ item, course, enrolledAt }] : [];
    })
    .sort(
      (a, b) =>
        b.enrolledAt - a.enrolledAt ||
        a.item.course_id.localeCompare(b.item.course_id),
    );

  const selected = validOwned[0];
  const course = selected?.course ?? rekomendasiKursus(input.catalog, input.profile, 1)[0];

  if (!course) {
    return {
      course: null,
      source: "empty",
      modules: [],
      nextAction: {
        kind: "explore-courses",
        label: "Jelajahi kursus",
        href: "/belajar",
      },
    };
  }

  const curriculum = modulKursus(course);
  const completedIds = new Set(
    irisModulSelesai(selected?.item.selesai_modul ?? [], curriculum),
  );
  const firstIncompleteIndex = curriculum.findIndex(
    (module) => !completedIds.has(module.id),
  );
  const courseHref = `/belajar/${course.slug}#kurikulum`;
  const modules = curriculum.map((module, index) => ({
    id: module.id,
    title: module.judul,
    status: completedIds.has(module.id)
      ? ("completed" as const)
      : index === firstIncompleteIndex
        ? ("current" as const)
        : ("upcoming" as const),
    href: courseHref,
  }));
  const currentModule = curriculum[firstIncompleteIndex];
  const nextAction: NextLearningAction | null = currentModule
    ? {
        kind: "continue-course",
        label: "Lanjutkan belajar",
        href: courseHref,
        moduleId: currentModule.id,
      }
    : null;

  return {
    course,
    source: selected ? "active-enrollment" : "recommendation",
    modules,
    nextAction:
      selected || !currentModule
        ? nextAction
        : {
            kind: "start-course",
            label: "Mulai kursus",
            href: `/belajar/${course.slug}`,
          },
  };
}
