import { describe, it, expect } from "vitest";
import { courseSchema, updateCourseSchema } from "./course";

describe("Course Schema Validation", () => {
  it("validates a complete valid course", () => {
    const validData = {
      title: "Fullstack Engineering",
      description: "Belajar fullstack dari dasar sampai siap kerja dengan project nyata.",
      provider: "Careevo Academy",
      type: "course",
      track: "web-dev",
      level: "dasar",
      tags: ["React", "Node.js"],
      url: "https://careevo.test/courses/fullstack",
      duration_min: 120,
      is_free: true,
      price: 0,
      status: "published",
    };

    const parsed = courseSchema.safeParse(validData);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.title).toBe("Fullstack Engineering");
      expect(parsed.data.duration_min).toBe(120);
    }
  });

  it("parses comma-separated tags into an array", () => {
    const dataWithCommaTags = {
      title: "Data Science dengan Python",
      description: "Panduan lengkap analisis data, statistik, dan machine learning.",
      provider: "Careevo Academy",
      tags: "Python, Pandas, NumPy, Data",
      url: "https://careevo.test/courses/data-science",
      duration_min: "180",
    };

    const parsed = courseSchema.safeParse(dataWithCommaTags);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.tags).toEqual(["Python", "Pandas", "NumPy", "Data"]);
      expect(parsed.data.duration_min).toBe(180);
    }
  });

  it("rejects invalid titles, short descriptions, and empty URLs", () => {
    const invalidData = {
      title: "AB", // too short (<3)
      description: "Pendek", // too short (<10)
      provider: "C", // too short (<2)
      url: "",
      duration_min: 0, // min 1
    };

    const parsed = courseSchema.safeParse(invalidData);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      expect(fieldErrors.title).toBeDefined();
      expect(fieldErrors.description).toBeDefined();
      expect(fieldErrors.provider).toBeDefined();
      expect(fieldErrors.url).toBeDefined();
      expect(fieldErrors.duration_min).toBeDefined();
    }
  });

  it("supports partial updates with updateCourseSchema", () => {
    const partialData = {
      title: "Updated Title Only",
      duration_min: 250,
    };

    const parsed = updateCourseSchema.safeParse(partialData);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.title).toBe("Updated Title Only");
      expect(parsed.data.duration_min).toBe(250);
      expect(parsed.data.description).toBeUndefined();
    }
  });
});
