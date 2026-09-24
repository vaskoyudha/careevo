import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMateriAction,
  updateMateriAction,
  deleteMateriAction,
} from "./materi";
import { createModulAction } from "./modul";
import { resetCourses, listMateri, getModul } from "@/lib/courses/store";
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

function formMateri(
  tipe: string,
  payload: Record<string, string>,
  overrides: Record<string, string> = {},
): FormData {
  const formData = new FormData();
  formData.append("course_id", COURSE_ID);
  formData.append("tipe", tipe);
  for (const [key, value] of Object.entries(payload)) {
    formData.append(key, value);
  }
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }
  return formData;
}

const videoPayload = {
  judul: "Pengantar React Hooks",
  url: "https://www.youtube.com/watch?v=abc",
  durasi_min: "12",
};

const soalValid = [
  {
    id: "soal-1",
    pertanyaan: "Apa kegunaan useState?",
    pilihan: ["Menyimpan state lokal", "Mengambil data HTTP"],
    jawaban_benar: 0,
  },
];

const kuisPayload = {
  judul: "Kuis Dasar Hooks",
  soal: JSON.stringify(soalValid),
  nilai_lulus: "70",
};

/** Buat modul induk lebih dulu — materi selalu menempel pada modul. */
async function siapkanModul(): Promise<string> {
  const formData = new FormData();
  formData.append("course_id", COURSE_ID);
  formData.append("judul", "Modul Induk Materi");
  formData.append("ringkasan", "Modul yang menampung materi pada pengujian ini.");
  formData.append("durasi_min", "30");
  const res = await createModulAction({ ok: false }, formData);
  return res.modul!.id;
}

describe("Materi Server Actions", () => {
  beforeEach(() => {
    resetCourses();
    vi.restoreAllMocks();
  });

  it("menolak bila tidak ada sesi", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(null);

    const res = await createMateriAction({ ok: false }, formMateri("video", videoPayload));
    expect(res.ok).toBe(false);
    expect(res.error).toContain("Akses ditolak");
  });

  it("menolak bila role bukan staff", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(userSession);

    const res = await createMateriAction({ ok: false }, formMateri("video", videoPayload));
    expect(res.ok).toBe(false);
    expect(res.error).toContain("Akses ditolak");
  });

  it("membuat materi video dan mengembalikan entitas lengkap", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(adminSession);
    const modulId = await siapkanModul();

    const res = await createMateriAction(
      { ok: false },
      formMateri("video", videoPayload, { modul_id: modulId }),
    );

    expect(res.ok).toBe(true);
    expect(res.materi).toBeDefined();
    expect(res.materi?.tipe).toBe("video");
    expect(res.materi?.judul).toBe("Pengantar React Hooks");
    expect(res.materi?.modul_id).toBe(modulId);

    const tersimpan = await listMateri(COURSE_ID, modulId);
    expect(tersimpan).toHaveLength(1);
    expect(tersimpan[0].id).toBe(res.materi!.id);
  });

  it("membuat materi kuis dan menyimpan soalnya utuh", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(adminSession);
    const modulId = await siapkanModul();

    const res = await createMateriAction(
      { ok: false },
      formMateri("kuis", kuisPayload, { modul_id: modulId }),
    );

    expect(res.ok).toBe(true);
    if (res.materi?.tipe === "kuis") {
      expect(res.materi.soal).toHaveLength(1);
      expect(res.materi.soal[0].jawaban_benar).toBe(0);
      expect(res.materi.nilai_lulus).toBe(70);
    } else {
      throw new Error("materi kuis tidak kembali dalam bentuk yang benar");
    }
  });

  it("menolak materi video ber-URL javascript:", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(adminSession);
    const modulId = await siapkanModul();

    const res = await createMateriAction(
      { ok: false },
      formMateri(
        "video",
        { ...videoPayload, url: "javascript:alert(1)" },
        { modul_id: modulId },
      ),
    );

    expect(res.ok).toBe(false);
    expect(res.fieldErrors?.url).toBeDefined();
    expect(await listMateri(COURSE_ID, modulId)).toHaveLength(0);
  });

  it("mengembalikan fieldErrors saat soal kuis cacat", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(adminSession);
    const modulId = await siapkanModul();

    const res = await createMateriAction(
      { ok: false },
      formMateri(
        "kuis",
        { ...kuisPayload, soal: "{bukan json" },
        { modul_id: modulId },
      ),
    );

    expect(res.ok).toBe(false);
    expect(res.fieldErrors?.soal).toBeDefined();
  });

  it("memperbarui materi sekaligus mengganti tipenya", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(adminSession);
    const modulId = await siapkanModul();

    const dibuat = await createMateriAction(
      { ok: false },
      formMateri("video", videoPayload, { modul_id: modulId }),
    );
    const id = dibuat.materi!.id;

    const res = await updateMateriAction(
      { ok: false },
      formMateri(
        "pdf",
        {
          judul: "Materi Latihan",
          path: "/uploads/courses/crs-1/mod-1/latihan.pdf",
          ukuran_bytes: "2048",
        },
        { modul_id: modulId, id },
      ),
    );

    expect(res.ok).toBe(true);
    expect(res.materi?.id).toBe(id);
    expect(res.materi?.tipe).toBe("pdf");

    const tersimpan = await listMateri(COURSE_ID, modulId);
    expect(tersimpan[0].tipe).toBe("pdf");
  });

  it("menghapus materi dari modulnya", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(adminSession);
    const modulId = await siapkanModul();

    const dibuat = await createMateriAction(
      { ok: false },
      formMateri("pdf", { judul: "Materi Latihan", path: "/uploads/a.pdf", ukuran_bytes: "100" }, {
        modul_id: modulId,
      }),
    );
    const id = dibuat.materi!.id;

    const res = await deleteMateriAction(
      { ok: false },
      formMateri("pdf", {}, { modul_id: modulId, id }),
    );

    expect(res.ok).toBe(true);
    expect(res.message).toContain("berhasil dihapus");
    expect(await listMateri(COURSE_ID, modulId)).toHaveLength(0);

    const modul = await getModul(COURSE_ID, modulId);
    expect(modul?.materi).toEqual([]);
  });

  it("menolak mutasi tanpa hak staff", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(userSession);

    const perbarui = await updateMateriAction(
      { ok: false },
      formMateri("video", videoPayload, { modul_id: "mod-x", id: "mat-x" }),
    );
    expect(perbarui.ok).toBe(false);
    expect(perbarui.error).toContain("Akses ditolak");

    const hapus = await deleteMateriAction(
      { ok: false },
      formMateri("video", {}, { modul_id: "mod-x", id: "mat-x" }),
    );
    expect(hapus.ok).toBe(false);
    expect(hapus.error).toContain("Akses ditolak");
  });
});
