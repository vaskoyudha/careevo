import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createCourseAction,
  updateCourseAction,
  deleteCourseAction,
} from "./courses";
import { resetCourses, listCourses, getCourseById } from "@/lib/courses/store";
import * as sessionModule from "@/lib/auth/session";
import type { SessionPayload } from "@/lib/auth/types";

describe("Course Server Actions", () => {
  const adminSession: SessionPayload = {
    email: "admin@careevo.test",
    nama: "Admin Careevo",
    username: "admin",
    role: "admin",
    iat: Math.floor(Date.now() / 1000),
  };

  beforeEach(() => {
    resetCourses();
    vi.restoreAllMocks();
  });

  it("denies access if user is not authenticated or not staff", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(null);

    const formData = new FormData();
    formData.append("title", "Test Course Title");
    formData.append("description", "Deskripsi kursus yang cukup panjang untuk validasi.");
    formData.append("provider", "Careevo");
    formData.append("url", "https://careevo.test");

    const res = await createCourseAction({ ok: false }, formData);
    expect(res.ok).toBe(false);
    expect(res.error).toContain("Akses ditolak");
  });

  it("denies access if user has standard 'user' role", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue({
      email: "user@careevo.test",
      nama: "Normal User",
      username: "normal",
      role: "user",
      iat: Math.floor(Date.now() / 1000),
    });

    const formData = new FormData();
    formData.append("title", "Test Course Title");

    const res = await createCourseAction({ ok: false }, formData);
    expect(res.ok).toBe(false);
    expect(res.error).toContain("Akses ditolak");
  });

  it("creates a course when authorized as admin", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(adminSession);

    const formData = new FormData();
    formData.append("title", "Web Performance & Core Vitals");
    formData.append("description", "Pelajari optimasi LCP, FID, CLS dan rendering performa tinggi.");
    formData.append("provider", "Careevo Academy");
    formData.append("track", "web-dev");
    formData.append("level", "lanjut");
    formData.append("type", "course");
    formData.append("tags", "Performance, Web, Vitals");
    formData.append("url", "https://web.dev/vitals");
    formData.append("duration_min", "150");
    formData.append("is_free", "true");
    formData.append("status", "published");

    const res = await createCourseAction({ ok: false }, formData);
    expect(res.ok).toBe(true);
    expect(res.courseId).toBeDefined();
    expect(res.message).toContain("Web Performance & Core Vitals");

    const created = await getCourseById(res.courseId!);
    expect(created).toBeDefined();
    expect(created?.title).toBe("Web Performance & Core Vitals");
  });

  it("returns field validation errors on invalid input", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(adminSession);

    const formData = new FormData();
    formData.append("title", "No"); // too short
    formData.append("description", "short"); // too short

    const res = await createCourseAction({ ok: false }, formData);
    expect(res.ok).toBe(false);
    expect(res.fieldErrors).toBeDefined();
    expect(res.fieldErrors?.title).toBeDefined();
    expect(res.fieldErrors?.description).toBeDefined();
  });

  it("updates an existing course via updateCourseAction", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(adminSession);

    const courses = await listCourses();
    const target = courses[0];

    const formData = new FormData();
    formData.append("id", target.id);
    formData.append("title", "Judul Terupdate Baru");
    formData.append("description", "Deskripsi baru yang sudah diperbarui dengan sangat detail.");
    formData.append("status", "draft");

    const res = await updateCourseAction({ ok: false }, formData);
    expect(res.ok).toBe(true);

    const updated = await getCourseById(target.id);
    expect(updated?.title).toBe("Judul Terupdate Baru");
    expect(updated?.status).toBe("draft");
  });

  it("menyimpan kebijakan asesmen dan menaikkan versinya", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(adminSession);

    const courses = await listCourses();
    const target = courses[0];

    const formData = new FormData();
    formData.append("id", target.id);
    formData.append("kebijakan_aturan_bantuan", "tanpa_ai");
    formData.append("kebijakan_aturan_pengawasan", "wajib");

    const res = await updateCourseAction({ ok: false }, formData);
    expect(res.ok).toBe(true);

    const updated = await getCourseById(target.id);
    expect(updated?.kebijakan?.aturan_bantuan).toBe("tanpa_ai");
    expect(updated?.kebijakan?.versi).toBe(1);
    // Form kebijakan tidak menyentuh harga: kursus gratis tidak boleh
    // diam-diam berubah menjadi berbayar.
    expect(updated?.is_free).toBe(target.is_free);
    expect(updated?.price).toBe(target.price);
  });

  it("memakai default pengawasan bila form tidak mengirimnya", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(adminSession);

    const courses = await listCourses();
    const target = courses[0];

    const formData = new FormData();
    formData.append("id", target.id);
    formData.append("kebijakan_aturan_bantuan", "tanpa_ai");

    const res = await updateCourseAction({ ok: false }, formData);
    expect(res.ok).toBe(true);

    const updated = await getCourseById(target.id);
    expect(updated?.kebijakan?.aturan_pengawasan).toBe("wajib");
  });

  it("menolak nilai kebijakan yang tidak sah", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(adminSession);

    const courses = await listCourses();
    const target = courses[0];

    const formData = new FormData();
    formData.append("id", target.id);
    formData.append("kebijakan_aturan_bantuan", "bebas_sekali"); // bukan nilai sah

    const res = await updateCourseAction({ ok: false }, formData);
    expect(res.ok).toBe(false);
    expect(res.fieldErrors?.kebijakan_aturan_bantuan).toBeDefined();

    // Tidak ada yang tersimpan saat validasi gagal.
    const updated = await getCourseById(target.id);
    expect(updated?.kebijakan).toBeUndefined();
  });

  it("menolak penyimpanan kebijakan oleh non-staff", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue({
      email: "user@careevo.test",
      nama: "Normal User",
      username: "normal",
      role: "user",
      iat: Math.floor(Date.now() / 1000),
    });

    const courses = await listCourses();
    const target = courses[0];

    const formData = new FormData();
    formData.append("id", target.id);
    formData.append("kebijakan_aturan_bantuan", "tanpa_ai");

    const res = await updateCourseAction({ ok: false }, formData);
    expect(res.ok).toBe(false);
    expect(res.error).toContain("Akses ditolak");

    const updated = await getCourseById(target.id);
    expect(updated?.kebijakan).toBeUndefined();
  });

  it("deletes a course via deleteCourseAction", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(adminSession);

    const courses = await listCourses();
    const target = courses[1];

    const formData = new FormData();
    formData.append("id", target.id);

    const res = await deleteCourseAction({ ok: false }, formData);
    expect(res.ok).toBe(true);
    expect(res.message).toContain("berhasil dihapus");

    const deleted = await getCourseById(target.id);
    expect(deleted).toBeUndefined();
  });
});
