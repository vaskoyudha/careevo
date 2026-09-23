"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/roles";
import {
  createCourse,
  updateCourse,
  deleteCourse,
  getCourseById,
} from "@/lib/courses/store";
import {
  courseSchema,
  updateCourseSchema,
  type CourseFormData,
} from "@/lib/validation/course";

import type { z } from "zod";

export interface CourseActionState {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  courseId?: string;
}

function extractFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !result[key]) {
      result[key] = issue.message;
    }
  }
  return result;
}

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Silently ignore when called outside Next.js request lifecycle (e.g. unit tests)
  }
}

export async function createCourseAction(
  _prev: CourseActionState,
  formData: FormData,
): Promise<CourseActionState> {
  const session = await getSession();
  if (!session || !isStaffRole(session.role)) {
    return {
      ok: false,
      error: "Akses ditolak. Tindakan ini membutuhkan akun dengan hak akses verifikator atau admin.",
    };
  }

  const isFreeRaw = formData.get("is_free");
  const isFree = isFreeRaw === "true" || isFreeRaw === "on" || isFreeRaw === "1";

  const raw: Record<string, unknown> = {
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    provider: formData.get("provider") ?? "",
    type: formData.get("type") ?? "course",
    track: formData.get("track") ?? "web-dev",
    level: formData.get("level") ?? "dasar",
    tags: formData.get("tags") ?? "",
    url: formData.get("url") ?? "",
    duration_min: formData.get("duration_min") ?? 60,
    is_free: isFree,
    price: isFree ? 0 : formData.get("price") ?? 0,
    status: formData.get("status") ?? "published",
  };

  const slug = formData.get("slug");
  if (slug && typeof slug === "string" && slug.trim()) {
    raw.slug = slug.trim();
  }

  const parsed = courseSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Mohon periksa kembali formulir isian kursus.",
      fieldErrors: extractFieldErrors(parsed.error),
    };
  }

  try {
    const created = await createCourse(parsed.data as CourseFormData);
    safeRevalidate("/admin/courses");
    safeRevalidate("/belajar");

    return {
      ok: true,
      message: `Kursus "${created.title}" berhasil ditambahkan!`,
      courseId: created.id,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan sistem saat membuat kursus.",
    };
  }
}

export async function updateCourseAction(
  _prev: CourseActionState,
  formData: FormData,
): Promise<CourseActionState> {
  const session = await getSession();
  if (!session || !isStaffRole(session.role)) {
    return {
      ok: false,
      error: "Akses ditolak. Tindakan ini membutuhkan akun dengan hak akses verifikator atau admin.",
    };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { ok: false, error: "ID Kursus tidak ditemukan." };
  }

  const existing = await getCourseById(id);
  if (!existing) {
    return { ok: false, error: "Kursus tidak ditemukan dalam sistem." };
  }

  const isFreeRaw = formData.get("is_free");
  const isFree = isFreeRaw === "true" || isFreeRaw === "on" || isFreeRaw === "1";

  const raw: Record<string, unknown> = {
    title: formData.get("title") ?? existing.title,
    description: formData.get("description") ?? existing.description,
    provider: formData.get("provider") ?? existing.provider,
    type: formData.get("type") ?? existing.type,
    track: formData.get("track") ?? existing.track,
    level: formData.get("level") ?? existing.level,
    tags: formData.get("tags") ?? existing.tags.join(", "),
    url: formData.get("url") ?? existing.url,
    duration_min: formData.get("duration_min") ?? existing.duration_min,
    is_free: isFree,
    price: isFree ? 0 : formData.get("price") ?? 0,
    status: formData.get("status") ?? existing.status,
  };

  const slug = formData.get("slug");
  if (slug && typeof slug === "string" && slug.trim()) {
    raw.slug = slug.trim();
  }

  const parsed = updateCourseSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali perbaikan data kursus.",
      fieldErrors: extractFieldErrors(parsed.error),
    };
  }

  try {
    const updated = await updateCourse(id, parsed.data);
    if (!updated) {
      return { ok: false, error: "Kursus gagal diperbarui." };
    }

    safeRevalidate("/admin/courses");
    safeRevalidate("/belajar");

    return {
      ok: true,
      message: `Kursus "${updated.title}" berhasil diperbarui!`,
      courseId: updated.id,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Terjadi kegagalan saat memperbarui kursus.",
    };
  }
}

export async function deleteCourseAction(
  _prev: CourseActionState,
  formData: FormData,
): Promise<CourseActionState> {
  const session = await getSession();
  if (!session || !isStaffRole(session.role)) {
    return {
      ok: false,
      error: "Akses ditolak. Tindakan ini membutuhkan akun dengan hak akses verifikator atau admin.",
    };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { ok: false, error: "ID Kursus wajib disertakan." };
  }

  const existing = await getCourseById(id);
  const title = existing?.title ?? id;

  const success = await deleteCourse(id);
  if (!success) {
    return { ok: false, error: "Gagal menghapus kursus atau kursus tidak ditemukan." };
  }

  safeRevalidate("/admin/courses");
  safeRevalidate("/belajar");

  return {
    ok: true,
    message: `Kursus "${title}" berhasil dihapus dari sistem.`,
  };
}
