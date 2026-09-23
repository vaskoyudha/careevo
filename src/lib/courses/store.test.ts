import { describe, it, expect, beforeEach } from "vitest";
import {
  listCourses,
  getCourseById,
  getCourseBySlug,
  createCourse,
  updateCourse,
  deleteCourse,
  getCourseStats,
  resetCourses,
  slugify,
  INITIAL_COURSES,
} from "./store";

describe("Course Store", () => {
  beforeEach(() => {
    resetCourses();
  });

  it("lists all initial courses when no filter is provided", async () => {
    const courses = await listCourses();
    expect(courses.length).toBe(INITIAL_COURSES.length);
    expect(courses[0].id).toBe(INITIAL_COURSES[0].id);
  });

  it("filters courses by track", async () => {
    const webDev = await listCourses({ track: "web-dev" });
    expect(webDev.length).toBeGreaterThan(0);
    expect(webDev.every((c) => c.track === "web-dev")).toBe(true);

    const cyberSec = await listCourses({ track: "cyber-sec" });
    expect(cyberSec.length).toBeGreaterThan(0);
    expect(cyberSec.every((c) => c.track === "cyber-sec")).toBe(true);
  });

  it("filters courses by level and status", async () => {
    const dasar = await listCourses({ level: "dasar" });
    expect(dasar.every((c) => c.level === "dasar")).toBe(true);

    const published = await listCourses({ status: "published" });
    expect(published.every((c) => c.status === "published")).toBe(true);

    const draft = await listCourses({ status: "draft" });
    expect(draft.every((c) => c.status === "draft")).toBe(true);
  });

  it("searches courses by title, tags, provider, and description", async () => {
    const reactSearch = await listCourses({ search: "React" });
    expect(reactSearch.length).toBeGreaterThan(0);
    expect(
      reactSearch.some(
        (c) =>
          c.title.includes("React") ||
          c.tags.includes("React") ||
          c.description.includes("React"),
      ),
    ).toBe(true);

    const nonExistent = await listCourses({ search: "xyz-non-existent-12345" });
    expect(nonExistent.length).toBe(0);
  });

  it("retrieves a course by id or slug", async () => {
    const first = INITIAL_COURSES[0];
    const byId = await getCourseById(first.id);
    expect(byId).toBeDefined();
    expect(byId?.title).toBe(first.title);

    const bySlug = await getCourseBySlug(first.slug);
    expect(bySlug).toBeDefined();
    expect(bySlug?.id).toBe(first.id);

    const notFound = await getCourseById("invalid-id-xyz");
    expect(notFound).toBeUndefined();
  });

  it("creates a new course with unique slug and generated id", async () => {
    const newCourse = await createCourse({
      title: "Advanced TypeScript Architecture",
      description: "Belajar arsitektur enterprise dengan TypeScript tingkat lanjut.",
      provider: "Careevo Academy",
      type: "course",
      track: "web-dev",
      level: "lanjut",
      tags: ["TypeScript", "Architecture", "Design Patterns"],
      url: "https://careevo.test/courses/advanced-ts",
      duration_min: 240,
      is_free: false,
      price: 199000,
      status: "published",
    });

    expect(newCourse.id).toMatch(/^crs-/);
    expect(newCourse.slug).toBe("advanced-typescript-architecture");
    expect(newCourse.price).toBe(199000);
    expect(newCourse.created_at).toBeDefined();

    const retrieved = await getCourseById(newCourse.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.title).toBe("Advanced TypeScript Architecture");

    const allCourses = await listCourses();
    expect(allCourses[0].id).toBe(newCourse.id);
  });

  it("handles duplicate slugs on creation by appending a suffix", async () => {
    const course1 = await createCourse({
      title: "Duplicated Slug Course",
      description: "Deskripsi kursus pertama dengan judul sama.",
      provider: "Careevo Academy",
      url: "https://careevo.test/c1",
      duration_min: 60,
    });

    const course2 = await createCourse({
      title: "Duplicated Slug Course",
      description: "Deskripsi kursus kedua dengan judul sama.",
      provider: "Careevo Academy",
      url: "https://careevo.test/c2",
      duration_min: 60,
    });

    expect(course1.slug).toBe("duplicated-slug-course");
    expect(course2.slug).toBe("duplicated-slug-course-1");
  });

  it("updates an existing course", async () => {
    const first = INITIAL_COURSES[0];
    const updated = await updateCourse(first.id, {
      title: "Updated Title for Next.js 15",
      is_free: true,
      price: 100000, // should be set to 0 because is_free is true
      status: "draft",
    });

    expect(updated).not.toBeNull();
    expect(updated?.title).toBe("Updated Title for Next.js 15");
    expect(updated?.status).toBe("draft");
    expect(updated?.price).toBe(0);
    expect(new Date(updated!.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(first.updated_at).getTime(),
    );

    const nonExistent = await updateCourse("non-existent-id", {
      title: "No-op",
    });
    expect(nonExistent).toBeNull();
  });

  it("deletes a course successfully", async () => {
    const toDelete = INITIAL_COURSES[1];
    const initialCount = (await listCourses()).length;

    const result = await deleteCourse(toDelete.id);
    expect(result).toBe(true);

    const afterDelete = await listCourses();
    expect(afterDelete.length).toBe(initialCount - 1);
    expect(await getCourseById(toDelete.id)).toBeUndefined();

    const deleteAgain = await deleteCourse("already-deleted");
    expect(deleteAgain).toBe(false);
  });

  it("computes course statistics accurately", async () => {
    const stats = await getCourseStats();
    expect(stats.total).toBe(INITIAL_COURSES.length);
    expect(stats.published + stats.draft + stats.archived).toBe(stats.total);
    expect(stats.free + stats.paid).toBe(stats.total);
  });

  it("generates clean URL slugs", () => {
    expect(slugify("Belajar Next.js 15 & React 19 Modern!")).toBe(
      "belajar-nextjs-15-react-19-modern",
    );
    expect(slugify("   Trim & Special @#$ Characters   ")).toBe(
      "trim-special-characters",
    );
  });
});
