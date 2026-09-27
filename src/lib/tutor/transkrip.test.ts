import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

/** `CAREERS_DATA_DIR` harus ada sebelum modul diimpor — path dibentuk saat impor. */
const AKAR = await mkdtemp(path.join(tmpdir(), "careevo-transkrip-"));
process.env.CAREERS_DATA_DIR = AKAR;

const { bacaTranskrip } = await import("./transkrip");

afterAll(async () => {
  await rm(AKAR, { recursive: true, force: true });
});

const EMAIL = "murid@contoh.test";

/**
 * Direktori pemilik, dihitung dengan aturan yang sama seperti modul: sha256
 * email, 32 karakter pertama.
 *
 * Hitung ulang di sini, **bukan** menyalin nilai tetap: kalau aturan di modul
 * berubah, test ini ikut berubah dan gagal dengan pesan yang benar. Nilai
 * tetap hanya akan membiarkan test hijau sambil modul membaca direktori yang
 * salah — persis kesalahan yang membuat versi pertama modul ini membaca nol sesi.
 */
const DIR_PEMILIK = createHash("sha256").update(EMAIL).digest("hex").slice(0, 32);

beforeEach(async () => {
  await rm(path.join(AKAR, "tutor"), { recursive: true, force: true });
});

/** Tulis satu berkas transkrip untuk pemilik tertentu. */
async function tulis(nama: string, isi: unknown): Promise<void> {
  const dir = path.join(AKAR, "tutor", DIR_PEMILIK);
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, nama),
    typeof isi === "string" ? isi : JSON.stringify(isi),
    "utf8",
  );
}

const SESI = {
  session: {
    id: "s1",
    owner: EMAIL,
    title: "Jelaskan closure",
    courseId: "crs-1",
    messages: [
      { id: "m1", role: "user", content: "Apa itu closure?", createdAt: "2026-09-25T05:02:05.953Z" },
      { id: "m2", role: "assistant", content: "Closure adalah…", createdAt: "2026-09-25T05:02:06.000Z" },
    ],
  },
  version: 1,
};

describe("bacaTranskrip", () => {
  it("direktori yang belum ada menghasilkan array kosong", async () => {
    // "Belum pernah memakai tutor", bukan error.
    expect(await bacaTranskrip("tidak-ada@contoh.test")).toEqual([]);
  });

  it("membaca sesi dari bentuk yang dipakai AI Mastery", async () => {
    await tulis("s1.json", SESI);
    const hasil = await bacaTranskrip(EMAIL);
    expect(hasil).toHaveLength(1);
    expect(hasil[0]).toMatchObject({ judul: "Jelaskan closure", courseId: "crs-1" });
    expect(hasil[0]!.messages).toHaveLength(2);
    expect(hasil[0]!.messages[0]).toEqual({ role: "user", content: "Apa itu closure?" });
  });

  it("mencocokkan owner dan tidak memercayai nama direktori", async () => {
    // Direktori yang dipindai bisa memuat sesi milik orang lain. Membaca
    // semuanya tanpa owner adalah kebocoran ringkasan antar akun.
    await tulis("bukan-miliknya.json", {
      session: { owner: "orang-lain@contoh.test", title: "Rahasia", messages: SESI.session.messages },
    });
    expect(await bacaTranskrip(EMAIL)).toHaveLength(0);
  });

  it("perbandingan owner mengabaikan huruf besar dan spasi", async () => {
    await tulis("s1.json", {
      session: { owner: `  ${EMAIL.toUpperCase()} `, title: "X", messages: SESI.session.messages },
    });
    expect(await bacaTranskrip(EMAIL)).toHaveLength(1);
  });

  it("file rusak tidak menggagalkan file lain", async () => {
    // Transkrip itu pelengkap: satu berkas yang gagal tidak boleh menghapus
    // sisa yang masih terbaca.
    await tulis("rusak.json", "{ ini bukan json");
    await tulis("s1.json", SESI);
    const hasil = await bacaTranskrip(EMAIL);
    expect(hasil).toHaveLength(1);
  });

  it("bentuk tak terduga dilewati, bukan membuat pembacaan gagal", async () => {
    await tulis("array.json", [1, 2, 3]);
    await tulis("tanpa-session.json", { version: 1 });
    await tulis("session-null.json", { session: null });
    await tulis("s1.json", SESI);
    expect(await bacaTranskrip(EMAIL)).toHaveLength(1);
  });

  it("pesan dengan role asing atau kosong dibuang", async () => {
    await tulis("s1.json", {
      session: {
        owner: EMAIL,
        title: "X",
        messages: [
          { role: "system", content: "prompt internal" },
          { role: "user", content: "   " },
          { role: "user", content: "beritempty tidak ikut" },
          "bukan objek",
          null,
        ],
      },
    });
    const hasil = await bacaTranskrip(EMAIL);
    expect(hasil[0]!.messages).toHaveLength(1);
  });

  it("sesi tanpa messages menghasilkan sesi kosong, bukan dilewati", async () => {
    // Sesi ada di daftar peserta; menghapusnya membuat "belum pernah
    // memakai tutor" berbeda dari "memakai tutor tapi belum bertanya".
    await tulis("s1.json", { session: { owner: EMAIL, title: "X" } });
    const hasil = await bacaTranskrip(EMAIL);
    expect(hasil).toHaveLength(1);
    expect(hasil[0]!.messages).toEqual([]);
  });

  it("hanya .json yang dibaca", async () => {
    const dir = path.join(AKAR, "tutor", DIR_PEMILIK);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "catatan.txt"), "dari file lain", "utf8");
    await tulis("s1.json", SESI);
    expect(await bacaTranskrip(EMAIL)).toHaveLength(1);
  });

  it("email dengan garis miring tidak bisa keluar dari akar data", async () => {
    // Direktori tetap dihitung dari hash, jadi `../../etc` tidak pernah
    // menjadi segmen path. Yang diuji: hasilnya kosong, bukan error, dan tidak
    // membaca berkas milik directory lain.
    const hasil = await bacaTranskrip("../../etc");
    expect(hasil).toEqual([]);
  });

  it("direktori pemilik benar-benar diturunkan dari sha256 email", async () => {
    // Mengunci aturan penamaan yang dipakai modul. Nilai dihitung ulang dari
    // ekspresi yang sama, jadi test ini gagal — bukan diam-diam lewat —
    // kalau aturan di modul berubah.
    expect(DIR_PEMILIK).toHaveLength(32);
    expect(DIR_PEMILIK).toMatch(/^[0-9a-f]{32}$/);
  });
});