import { describe, expect, it } from "vitest";
import { normalizeOwner } from "@/lib/auth/types";
import { type EntriKatalog } from "@/lib/courses/katalog";
import { type Pendaftaran } from "@/lib/courses/enrollment";
import { irisModulSelesai, modulKursus } from "@/lib/courses/kurikulum";
import { tasks } from "@/lib/fixtures";
import { bangunJalurPersonalisasi } from "@/lib/learning/personalized-path";
import type { OnboardingProfile } from "@/lib/onboarding/types";

const OWNER = normalizeOwner("  RAKA@Careevo.Test  ");

const PROFILE: OnboardingProfile = {
  owner: OWNER,
  experience: "dasar",
  background: "mahasiswa",
  interests: ["web-dev"],
  goal: "dapat-kerja",
  weeklyHours: 8,
  workPreference: "remote",
  completedAt: "2026-09-01T00:00:00.000Z",
  version: 2,
};

function makeCourse(id: string, overrides: Partial<EntriKatalog> = {}): EntriKatalog {
  return {
    id,
    slug: id,
    title: `Kursus ${id}`,
    url: `https://example.test/${id}`,
    provider: "Test Provider",
    type: "course",
    tags: ["React"],
    level: "dasar",
    is_free: true,
    duration_min: 60,
    completed: false,
    ...overrides,
  };
}

function makeEnrollment(
  courseId: string,
  overrides: Partial<Pendaftaran> = {},
): Pendaftaran {
  return {
    course_id: courseId,
    slug: courseId,
    owner: OWNER,
    enrolled_at: "2026-09-10T00:00:00.000Z",
    selesai_modul: [],
    ...overrides,
  };
}

function runPolicy(
  catalog: EntriKatalog[],
  enrollments: Pendaftaran[] = [],
): ReturnType<typeof bangunJalurPersonalisasi> {
  return bangunJalurPersonalisasi({ profile: PROFILE, catalog, enrollments });
}

const RECOMMENDED_COURSE = makeCourse("test-course", { title: "Zulu Course" });
const ACTIVE_COURSE = makeCourse("active-course", {
  title: "Advanced Data Course",
  tags: ["Python"],
  level: "lanjut",
  is_free: false,
  duration_min: 300,
});
const TIE_COURSE = makeCourse("tie-course", { title: "Alpha Course" });
const RECOMMENDED_MODULES = modulKursus(RECOMMENDED_COURSE);

const INVALID_OWNED_ENROLLMENTS = [
  { label: "unowned", item: makeEnrollment("active-course", { owner: undefined }) },
  {
    label: "other-owner",
    item: makeEnrollment("active-course", { owner: "other@careevo.test" }),
  },
  {
    label: "invalid-date",
    item: makeEnrollment("active-course", { enrolled_at: "not-a-date" }),
  },
  { label: "missing-course", item: makeEnrollment("missing-course") },
] as const;

describe("bangunJalurPersonalisasi", () => {
  it("uses an active owner enrollment over a higher recommendation", () => {
    // Given: a valid owner enrollment for a lower-scoring course.
    const enrollment = makeEnrollment(ACTIVE_COURSE.id);

    // When: the policy receives the recommendation and enrollment together.
    const result = runPolicy([RECOMMENDED_COURSE, ACTIVE_COURSE], [enrollment]);

    // Then: the active course wins the selection.
    expect(result).toMatchObject({
      course: { id: ACTIVE_COURSE.id },
      source: "active-enrollment",
    });
  });

  it("links active learning actions to the selected course curriculum", () => {
    // Given: an active enrollment with no completed modules.
    const enrollment = makeEnrollment(ACTIVE_COURSE.id);

    // When: the path is built.
    const result = runPolicy([RECOMMENDED_COURSE, ACTIVE_COURSE], [enrollment]);

    // Then: its action and every module use the course curriculum route.
    expect(result.nextAction).toEqual({
      kind: "continue-course",
      label: "Lanjutkan belajar",
      href: "/belajar/active-course#kurikulum",
      moduleId: `${ACTIVE_COURSE.id}-m1`,
    });
    expect(result.modules.every((module) => module.href === "/belajar/active-course#kurikulum")).toBe(true);
  });

  it("selects the newest valid owned enrollment", () => {
    // Given: two owned enrollments for catalog courses.
    const older = makeEnrollment(ACTIVE_COURSE.id, { enrolled_at: "2026-09-09T00:00:00.000Z" });
    const newer = makeEnrollment("newest-course", { enrolled_at: "2026-09-12T00:00:00.000Z" });

    // When: both valid enrollments are considered.
    const result = runPolicy(
      [ACTIVE_COURSE, makeCourse("newest-course")],
      [older, newer],
    );

    // Then: the newest enrollment timestamp wins.
    expect(result.course?.id).toBe("newest-course");
  });

  it("breaks equal enrollment dates by ascending course id", () => {
    // Given: two valid owned enrollments share the newest timestamp.
    const tieB = makeEnrollment("tie-b", { enrolled_at: "2026-09-12T00:00:00.000Z" });
    const tieA = makeEnrollment("tie-a", { enrolled_at: "2026-09-12T00:00:00.000Z" });

    // When: the enrollment timestamp does not distinguish them.
    const result = runPolicy(
      [makeCourse("tie-b"), makeCourse("tie-a")],
      [tieB, tieA],
    );

    // Then: the stable course id breaks the tie.
    expect(result.course?.id).toBe("tie-a");
  });

  it.each(INVALID_OWNED_ENROLLMENTS)("ignores an $label enrollment", ({ item }) => {
    // Given: only an enrollment that cannot prove owned learner progress.
    const catalog = [RECOMMENDED_COURSE, ACTIVE_COURSE];

    // When: the policy selects a course.
    const result = runPolicy(catalog, [item]);

    // Then: the deterministic recommendation is used instead.
    expect(result).toMatchObject({ course: { id: RECOMMENDED_COURSE.id }, source: "recommendation" });
  });

  it("uses the first profile recommendation without a valid owned enrollment", () => {
    // Given: a populated catalog and no enrollments.
    const catalog = [RECOMMENDED_COURSE];

    // When: the policy builds the path.
    const result = runPolicy(catalog);

    // Then: the start action and source identify a recommendation.
    expect(result).toMatchObject({
      source: "recommendation",
      nextAction: {
        kind: "start-course",
        label: "Mulai kursus",
        href: "/belajar/test-course",
      },
    });
  });

  it("preserves catalog order for equal-score recommendations", () => {
    // Given: equal-score courses whose title order reverses catalog order.
    const catalog = [RECOMMENDED_COURSE, TIE_COURSE];

    // When: the path selects a recommendation.
    const result = runPolicy(catalog);

    // Then: the first catalog entry remains the recommendation.
    expect(result.course?.id).toBe(RECOMMENDED_COURSE.id);
  });

  it("marks completed modules and the first incomplete module deterministically", () => {
    // Given: the first two modules are completed.
    const enrollment = makeEnrollment(RECOMMENDED_COURSE.id, {
      selesai_modul: irisModulSelesai(
        RECOMMENDED_MODULES.slice(0, 2).map((module) => module.id),
        RECOMMENDED_MODULES,
      ),
    });

    // When: the path is built from that enrollment.
    const result = runPolicy([RECOMMENDED_COURSE], [enrollment]);

    // Then: completed, current, and upcoming statuses follow module order.
    expect(result.modules.map((module) => module.status)).toEqual([
      "completed",
      "completed",
      "current",
      "upcoming",
      "upcoming",
    ]);
  });

  it("keeps an out-of-order completed module completed", () => {
    // Given: modules one and three are completed out of sequence.
    const enrollment = makeEnrollment(RECOMMENDED_COURSE.id, {
      selesai_modul: [RECOMMENDED_MODULES[0].id, RECOMMENDED_MODULES[2].id],
    });

    // When: statuses are derived.
    const result = runPolicy([RECOMMENDED_COURSE], [enrollment]);

    // Then: the first incomplete module is current, not the first array position.
    expect(result.modules.map((module) => module.status)).toEqual([
      "completed",
      "current",
      "completed",
      "upcoming",
      "upcoming",
    ]);
  });

  it("returns no next action when every module is complete", () => {
    // Given: an enrollment completing the full derived curriculum.
    const enrollment = makeEnrollment(RECOMMENDED_COURSE.id, {
      selesai_modul: RECOMMENDED_MODULES.map((module) => module.id),
    });

    // When: the path is built.
    const result = runPolicy([RECOMMENDED_COURSE], [enrollment]);

    // Then: completion is represented without another learning action.
    expect(result.nextAction).toBeNull();
    expect(result.modules.every((module) => module.status === "completed")).toBe(true);
  });

  it("returns an explicit exploration path for an empty catalog", () => {
    // Given: no catalog entries or enrollments.
    const catalog: EntriKatalog[] = [];

    // When: the path is built.
    const result = runPolicy(catalog);

    // Then: the learner receives the catalog exploration fallback.
    expect(result).toEqual({
      course: null,
      source: "empty",
      modules: [],
      nextAction: {
        kind: "explore-courses",
        label: "Jelajahi kursus",
        href: "/belajar",
      },
    });
  });

  it("does not turn catalog or global task completion into learner progress", () => {
    // Given: a recommended course marked complete and matching a passed global task.
    const passedTask = tasks[0];
    const course = makeCourse(passedTask.id, { completed: true });

    // When: no owner enrollment supplies module evidence.
    const result = runPolicy([course]);

    // Then: the first module remains current rather than completed.
    expect(result.modules[0]?.status).toBe("current");
    expect(result.modules.some((module) => module.status === "completed")).toBe(false);
  });

  it("deduplicates completion ids and ignores stale ids", () => {
    // Given: duplicate current ids, one stale id, and two valid completions.
    const enrollment = makeEnrollment(RECOMMENDED_COURSE.id, {
      selesai_modul: [
        RECOMMENDED_MODULES[0].id,
        RECOMMENDED_MODULES[0].id,
        "stale-module",
        RECOMMENDED_MODULES[1].id,
      ],
    });

    // When: module completion is normalized.
    const result = runPolicy([RECOMMENDED_COURSE], [enrollment]);

    // Then: status reflects only the two valid unique module ids.
    expect(result.modules.map((module) => module.status)).toEqual([
      "completed",
      "completed",
      "current",
      "upcoming",
      "upcoming",
    ]);
  });
});
