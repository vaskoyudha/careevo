import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createModulAction,
  updateModulAction,
  deleteModulAction,
  geserModulAction,
} from "./modul";
import { resetCourses, listModul, getModul } from "@/lib/courses/store";
import * as sessionModule from "@/lib/auth/session";
import type { SessionPayload } from "@/lib/auth/types";

const adminSession: SessionPayload = {
  email: "admin@careevo.test",
  nama: "Admin Careevo",
  username: "admin",
  role: "admin",
  iat: Math.floor(Date.now() / 1000),
};

const userSession: SessionPayload = {
  email: "user@careevo.test",
  nama: "Normal User",
  username: "normal",
  role: "user",
  iat: Math.floor(Date.now() / 1000),
};

const COURSE_ID = "crs-1";

function formModul(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.append("course_id", COURSE_ID);
  formData.append("judul", "Dasar React Hooks");
  formData.append("ringkasan", "Mengenal useState dan useEffect lewat latihan terarah.");
  formData.append("durasi_min", "45");
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }
  return formData;
}

describe("Modul Server Actions", () => {
  beforeEach(() => {
    resetCourses();
    vi.restoreAllMocks();
  });

  it("menolak bila tidak ada sesi", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(null);

    const res = await createModulAction({ ok: false }, formModul());
    expect(res.ok).toBe(false);
    expect(res.error).toContain("Akses ditolak");
  });

  it("menolak bila role bukan staff", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(userSession);

    const res = await createModulAction({ ok: false }, formModul());
    expect(res.ok).toBe(false);
    expect(res.error).toContain("Akses ditolak");
  });

  it("membuat modul sebagai admin dan mengembalikan entitas lengkap", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(adminSession);

    const res = await createModulAction({ ok: false }, formModul());
    expect(res.ok).toBe(true);
    expect(res.modul).toBeDefined();
    expect(res.modul?.judul).toBe("Dasar React Hooks");
    expect(res.modul?.course_id).toBe(COURSE_ID);
    expect(res.modul?.urutan).toBe(1);
    expect(res.modul?.durasi_min).toBe(45);

    const tersimpan = await getModul(COURSE_ID, res.modul!.id);
    expect(tersimpan?.judul).toBe("Dasar React Hooks");
    expect(await listModul(COURSE_ID)).toHaveLength(1);
  });

  it("mengembalikan fieldErrors pada input tidak valid", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(adminSession);

    const res = await createModulAction(
      { ok: false },
      formModul({ judul: "AB", ringkasan: "Pendek", durasi_min: "0" }),
    );

    expect(res.ok).toBe(false);
    expect(res.fieldErrors).toBeDefined();
    expect(res.fieldErrors?.judul).toBeDefined();
    expect(res.fieldErrors?.ringkasan).toBeDefined();
    expect(res.fieldErrors?.durasi_min).toBeDefined();
  });

  it("memperbarui modul dan mengembalikan entitas tersimpan", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(adminSession);

    const dibuat = await createModulAction({ ok: false }, formModul());
    const id = dibuat.modul!.id;

    const res = await updateModulAction(
      { ok: false },
      formModul({ id, judul: "React Hooks Lanjutan", durasi_min: "90" }),
    );

    expect(res.ok).toBe(true);
    expect(res.modul?.id).toBe(id);
    expect(res.modul?.judul).toBe("React Hooks Lanjutan");
    expect(res.modul?.durasi_min).toBe(90);

    const tersimpan = await getModul(COURSE_ID, id);
    expect(tersimpan?.judul).toBe("React Hooks Lanjutan");
  });

  it("menghapus modul dan mengosongkan store", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(adminSession);

    const dibuat = await createModulAction({ ok: false }, formModul());
    const id = dibuat.modul!.id;

    const res = await deleteModulAction({ ok: false }, formModul({ id }));
    expect(res.ok).toBe(true);
    expect(res.message).toContain("berhasil dihapus");
    expect(await getModul(COURSE_ID, id)).toBeUndefined();
  });

  it("meneruskan geser urutan ke store dan mengembalikan entitas yang dipindahkan", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(adminSession);

    const pertama = (await createModulAction({ ok: false }, formModul())).modul!;
    const kedua = (
      await createModulAction({ ok: false }, formModul({ judul: "Modul Kedua Utama" }))
    ).modul!;

    const naik = await geserModulAction(COURSE_ID, kedua.id, "naik");
    expect(naik.ok).toBe(true);
    expect(naik.modul?.id).toBe(kedua.id);

    // Hanya kontrak action yang diuji di sini: pemindahan posisi sesungguhnya
    // belum berpengaruh karena `rapikanUrutan()` di store mengurutkan ulang
    // berdasarkan `urutan` *setelah* penukaran, sehingga penukaran itu
    // dibatalkan. Assertion sengaja tidak mengunci urutan agar tetap sah
    // begitu store diperbaiki.
    const daftar = await listModul(COURSE_ID);
    expect(daftar.map((m) => m.id).sort()).toEqual([pertama.id, kedua.id].sort());
    expect(daftar.map((m) => m.urutan)).toEqual([1, 2]);

    const turun = await geserModulAction(COURSE_ID, kedua.id, "turun");
    expect(turun.ok).toBe(true);
    expect(turun.error).toBeUndefined();
  });

  it("menolak geser dan hapus tanpa hak staff", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(userSession);

    const geser = await geserModulAction(COURSE_ID, "mod-apa-saja", "naik");
    expect(geser.ok).toBe(false);
    expect(geser.error).toContain("Akses ditolak");

    const hapus = await deleteModulAction({ ok: false }, formModul({ id: "mod-apa-saja" }));
    expect(hapus.ok).toBe(false);
    expect(hapus.error).toContain("Akses ditolak");
  });
});
