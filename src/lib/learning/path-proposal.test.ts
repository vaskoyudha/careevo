import { describe, expect, it } from "vitest";
import type { EntriKatalog } from "@/lib/courses/katalog";
import { modulKursus } from "@/lib/courses/kurikulum";
import type { StudyPathProposal } from "./chat-types";
import { validateStudyPathProposal } from "./path-proposal";

const COURSE: EntriKatalog = {
  id: "crs-1",
  slug: "fullstack-web-development-nextjs-15-react-19",
  title: "Fullstack Web Development: Next.js 15 & React 19",
  url: "https://nextjs.org/docs",
  provider: "Careevo Academy",
  type: "course",
  tags: ["Next.js", "React", "TypeScript", "Tailwind"],
  level: "dasar",
  is_free: true,
  duration_min: 180,
  completed: false,
};

const OTHER_COURSE: EntriKatalog = {
  id: "crs-2",
  slug: "membangun-rest-api-modern-dengan-nodejs",
  title: "Membangun REST API Modern dengan Node.js",
  url: "https://nodejs.org/id/learn",
  provider: "Careevo Academy",
  type: "course",
  tags: ["Node.js", "Express", "REST API", "Backend"],
  level: "menengah",
  is_free: true,
  duration_min: 240,
  completed: false,
};

const CATALOG: EntriKatalog[] = [COURSE, OTHER_COURSE];

function proposal(overrides: Partial<StudyPathProposal> = {}): StudyPathProposal {
  return {
    id: "proposal-1",
    courseId: COURSE.id,
    moduleIds: ["crs-1-m1", "crs-1-m2"],
    rationale: "This path starts with the learner's stated goal.",
    createdAt: "2026-09-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("validateStudyPathProposal", () => {
  it("rejects an unknown course", () => {
    // Given: a proposal names a course that is absent from the catalog.
    const input = proposal({ courseId: "missing" });

    // When: the proposal is validated against the catalog.
    const result = validateStudyPathProposal(input, CATALOG);

    // Then: validation reports the missing course.
    expect(result).toEqual({ valid: false, reason: "unknown_course" });
  });

  it("does not match a course by slug when the id is unknown", () => {
    // Given: the catalog knows the course slug, but the proposal has no matching id.
    const input = proposal({ courseId: COURSE.slug });

    // When: the proposal is validated against the catalog.
    const result = validateStudyPathProposal(input, CATALOG);

    // Then: exact id matching rejects the proposal.
    expect(result).toEqual({ valid: false, reason: "unknown_course" });
  });

  it("rejects an empty module list before accepting a path", () => {
    // Given: the selected course exists but the proposal contains no modules.
    const input = proposal({ moduleIds: [] });

    // When: the proposal is validated.
    const result = validateStudyPathProposal(input, CATALOG);

    // Then: the empty path is reported explicitly.
    expect(result).toEqual({ valid: false, reason: "empty_path" });
  });

  it("rejects a module outside the canonical curriculum", () => {
    // Given: the proposal names a course and a module id absent from its curriculum.
    const input = proposal({ courseId: COURSE.id, moduleIds: ["crs-1-m999"] });

    // When: the proposal is validated.
    const result = validateStudyPathProposal(input, CATALOG);

    // Then: the whole proposal is rejected instead of returning a partial path.
    expect(result).toEqual({ valid: false, reason: "unknown_module" });
  });

  it("accepts a valid proposal and returns its canonical course and modules", () => {
    // Given: every proposed module belongs to the selected course.
    const input = proposal({ moduleIds: ["crs-1-m2", "crs-1-m1"] });
    const curriculum = modulKursus(COURSE);

    // When: the proposal is validated.
    const result = validateStudyPathProposal(input, CATALOG);

    // Then: the result contains the exact catalog course and canonical module objects.
    expect(result).toEqual({
      valid: true,
      course: COURSE,
      modules: curriculum.filter((module) => input.moduleIds.includes(module.id)),
    });
  });

  it("deduplicates modules and returns canonical order", () => {
    // Given: a proposal repeats a module and supplies modules out of curriculum order.
    const input = proposal({
      courseId: "crs-1",
      moduleIds: ["crs-1-m3", "crs-1-m1", "crs-1-m3"],
    });

    // When: the proposal is validated.
    const result = validateStudyPathProposal(input, CATALOG);

    // Then: the canonical curriculum determines the ordered selected path.
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.modules.map((module) => module.id)).toEqual([
        "crs-1-m1",
        "crs-1-m3",
      ]);
    }
  });

  it("does not mutate the proposal or catalog while validating", () => {
    // Given: mutable fixture inputs contain a repeated, out-of-order path.
    const input = proposal({ moduleIds: ["crs-1-m3", "crs-1-m1", "crs-1-m3"] });
    const originalModuleIds = [...input.moduleIds];
    const originalCatalog = CATALOG.map((entry) => ({
      ...entry,
      tags: [...entry.tags],
    }));

    // When: the proposal is validated.
    const result = validateStudyPathProposal(input, CATALOG);

    // Then: both inputs remain unchanged.
    expect(input.moduleIds).toEqual(originalModuleIds);
    expect(CATALOG).toEqual(originalCatalog);
    expect(result.valid).toBe(true);
  });

  it("does not fabricate a course when the chat has no course context", () => {
    // Given: a course-less chat has no catalog course, so any stale proposal is not a generated path.
    const courseLessCatalog: EntriKatalog[] = [];
    const attemptedProposal = proposal();

    // When: a stale proposal reaches the boundary with no course context.
    const result = validateStudyPathProposal(attemptedProposal, courseLessCatalog);

    // Then: validation rejects it instead of inventing a course or path.
    expect(result).toEqual({ valid: false, reason: "unknown_course" });
  });
});
