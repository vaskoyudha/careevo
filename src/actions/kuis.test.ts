import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createKuisAction,
  deleteKuisAction,
  geserKuisAction,
  lepasKuisAction,
  pasangKuisAction,
  updateKuisAction,
} from "./kuis";
import { createModul, getModul, listKuis, resetCourses } from "@/lib/courses/store";
import * as sessionModule from "@/lib/auth/session";
import type { SessionPayload } from "@/lib/auth/types";
import type { SoalKuis } from "@/types/course";

/**
 * Server Action bank soal kuis.
 *
 * Yang diuji di sini adalah yang tidak diuji store: gerbang hak akses staf,
 * bentuk state yang dikembalikan, dan penanganan JSON `soal` yang cacat —
 * yang terakhir penting karena form mengirim soal sebagai satu field JSON dan
 * JSON rusak tidak boleh menutup action dengan exception.
 */

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
const KOSONG = { ok: false };

const SOAL: SoalKuis = {
  id: "s1",
  pertanyaan: "Apa kegunaan useState?",
  pilihan: ["Menyimpan state lokal", "Mengambil data HTTP"],
  jawaban_benar: 0,
};

function formKuis(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("judul", "Kuis Dasar Hooks");
  formData.set("deskripsi", "Uji pemahaman dasar.");
  formData.set("soal", JSON.stringify([SOAL]));
  formData.set("nilai_lulus", "70");
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }
  return formData;
}

async function buatKuis() {
  const res = await createKuisAction(KOSONG, formKuis());
  return res.kuis!;
}

async function buatModul() {
  return (await createModul(COURSE_ID, {
    judul: "Modul Uji",
    ringkasan: "Ringkasan modul uji yang cukup panjang.",
    durasi_min: 30,
  }))!;
}

beforeEach(() => {
  resetCourses();
  vi.restoreAllMocks();
});

describe("gerbang hak akses", () => {
  it("menolak createKuisAction tanpa sesi", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(null);

    const res = await createKuisAction(KOSONG, formKuis());
    expect(res.ok).toBe(false);
    expect(res.error).toContain("Akses ditolak");
  });

  it("menolak createKuisAction untuk role bukan staff", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(userSession);

    expect((await createKuisAction(KOSONG, formKuis())).ok).toBe(false);
  });

  it("menolak setiap aksi kuis tanpa sesi staff", async () => {
    // Diuji berkelompok: satu aksi yang lupa memasang gerbang adalah lubang
    // yang sama seriusnya dengan semua aksi lupa.
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(userSession);

    const formId = new FormData();
    formId.set("id", "kuis-1");

    const hasil = await Promise.all([
      createKuisAction(KOSONG, formKuis()),
      updateKuisAction(KOSONG, formId),
      deleteKuisAction(KOSONG, formId),
      pasangKuisAction(COURSE_ID, "mod-1", "kuis-1"),
      lepasKuisAction(COURSE_ID, "mod-1", "kuis-1"),
      geserKuisAction(COURSE_ID, "mod-1", "kuis-1", "naik"),
    ]);

    for (const res of hasil) {
      expect(res.ok).toBe(false);
      expect(res.error).toContain("Akses ditolak");
    }
  });
});

describe("createKuisAction", () => {
  beforeEach(() => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(adminSession);
  });

  it("membuat kuis dan mengembalikan entitas lengkap", async () => {
    const res = await createKuisAction(KOSONG, formKuis());

    expect(res.ok).toBe(true);
    expect(res.kuis?.judul).toBe("Kuis Dasar Hooks");
    expect(res.kuis?.soal).toHaveLength(1);
    expect(await listKuis()).toHaveLength(1);
  });

  it("melaporkan fieldErrors saat judul terlalu pendek", async () => {
    const res = await createKuisAction(KOSONG, formKuis({ judul: "Ab" }));

    expect(res.ok).toBe(false);
    expect(res.fieldErrors?.judul).toContain("3 karakter");
  });

  it("melaporkan fieldErrors.soal saat JSON soal cacat, bukan melempar", async () => {
    // Ini alasan `bacaSoal` meneruskan JSON rusak apa adanya: exception akan
    // menutup action dan menghapus seluruh isi form yang sudah diketik admin.
    const res = await createKuisAction(KOSONG, formKuis({ soal: "{bukan json" }));

    expect(res.ok).toBe(false);
    expect(res.fieldErrors?.soal).toBeTruthy();
  });

  it("menolak kuis tanpa soal", async () => {
    const res = await createKuisAction(KOSONG, formKuis({ soal: "[]" }));

    expect(res.ok).toBe(false);
    expect(res.fieldErrors?.soal).toContain("1 soal");
  });
});

describe("updateKuisAction", () => {
  beforeEach(() => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(adminSession);
  });

  it("memperbarui kuis yang ada", async () => {
    const kuis = await buatKuis();

    const res = await updateKuisAction(KOSONG, formKuis({ id: kuis.id, judul: "Judul Baru" }));

    expect(res.ok).toBe(true);
    expect(res.kuis?.judul).toBe("Judul Baru");
    expect(res.kuis?.id).toBe(kuis.id);
  });

  it("mempertahankan soal lama bila field soal tidak dikirim", async () => {
    const kuis = await buatKuis();

    const formData = new FormData();
    formData.set("id", kuis.id);
    formData.set("judul", "Hanya Judul");

    const res = await updateKuisAction(KOSONG, formData);

    expect(res.ok).toBe(true);
    expect(res.kuis?.soal).toHaveLength(1);
    // Bawaan skema TIDAK boleh ikut mengisi nilai lulus saat menyunting —
    // kalau ikut, menyunting judul akan menimpa nilai lulus yang sudah disetel.
    expect(res.kuis?.nilai_lulus).toBe(70);
  });

  it("menolak id yang tidak ada di bank", async () => {
    const res = await updateKuisAction(KOSONG, formKuis({ id: "kuis-hantu" }));

    expect(res.ok).toBe(false);
    expect(res.error).toContain("tidak ditemukan");
  });

  it("meminta id bila tidak disertakan", async () => {
    const res = await updateKuisAction(KOSONG, formKuis());

    expect(res.ok).toBe(false);
    expect(res.error).toContain("ID Kuis");
  });
});

describe("deleteKuisAction", () => {
  beforeEach(() => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(adminSession);
  });

  it("menghapus kuis dari bank", async () => {
    const kuis = await buatKuis();

    const formData = new FormData();
    formData.set("id", kuis.id);

    const res = await deleteKuisAction(KOSONG, formData);

    expect(res.ok).toBe(true);
    expect(await listKuis()).toEqual([]);
  });

  it("menyebut jumlah modul yang ikut dilepas", async () => {
    // Pesannya harus memberi tahu dampaknya: admin perlu tahu kuis ini dipakai
    // di mana saja sebelum ia menyadarinya dari halaman lain.
    const kuis = await buatKuis();
    const modul = await buatModul();
    await pasangKuisAction(COURSE_ID, modul.id, kuis.id);

    const formData = new FormData();
    formData.set("id", kuis.id);

    const res = await deleteKuisAction(KOSONG, formData);

    expect(res.ok).toBe(true);
    expect(res.message).toContain("1 modul");
  });

  it("menolak id yang tidak ada", async () => {
    const formData = new FormData();
    formData.set("id", "kuis-hantu");

    expect((await deleteKuisAction(KOSONG, formData)).ok).toBe(false);
  });
});

describe("pasangKuisAction / lepasKuisAction / geserKuisAction", () => {
  beforeEach(() => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(adminSession);
  });

  it("memasang kuis ke modul", async () => {
    const kuis = await buatKuis();
    const modul = await buatModul();

    const res = await pasangKuisAction(COURSE_ID, modul.id, kuis.id);

    expect(res.ok).toBe(true);
    expect((await getModul(COURSE_ID, modul.id))?.kuis).toEqual([kuis.id]);
  });

  it("menolak memasang kuis yang tidak ada di bank", async () => {
    const modul = await buatModul();

    const res = await pasangKuisAction(COURSE_ID, modul.id, "kuis-hantu");

    expect(res.ok).toBe(false);
    expect(res.error).toContain("tidak ditemukan");
  });

  it("meminta id lengkap bila ada yang kosong", async () => {
    const res = await pasangKuisAction(COURSE_ID, "", "kuis-1");

    expect(res.ok).toBe(false);
    expect(res.error).toContain("wajib disertakan");
  });

  it("melepas kuis dari modul tanpa menghapusnya dari bank", async () => {
    const kuis = await buatKuis();
    const modul = await buatModul();
    await pasangKuisAction(COURSE_ID, modul.id, kuis.id);

    const res = await lepasKuisAction(COURSE_ID, modul.id, kuis.id);

    expect(res.ok).toBe(true);
    expect((await getModul(COURSE_ID, modul.id))?.kuis).toEqual([]);
    expect(await listKuis()).toHaveLength(1);
  });

  it("memindahkan kuis satu posisi", async () => {
    const a = await buatKuis();
    const b = await createKuisAction(KOSONG, formKuis({ judul: "Kuis Kedua" })).then((r) => r.kuis!);
    const modul = await buatModul();
    await pasangKuisAction(COURSE_ID, modul.id, a.id);
    await pasangKuisAction(COURSE_ID, modul.id, b.id);

    const res = await geserKuisAction(COURSE_ID, modul.id, b.id, "naik");

    expect(res.ok).toBe(true);
    expect((await getModul(COURSE_ID, modul.id))?.kuis).toEqual([b.id, a.id]);
  });

  it("menolak memindahkan kuis yang tidak terpasang di modul itu", async () => {
    const kuis = await buatKuis();
    const modul = await buatModul();

    const res = await geserKuisAction(COURSE_ID, modul.id, kuis.id, "naik");

    expect(res.ok).toBe(false);
    expect(res.error).toContain("tidak ditemukan");
  });
});
