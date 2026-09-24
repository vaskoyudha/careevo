import { describe, it, expect, beforeEach, vi } from "vitest";
import { daftarKursusAction, tandaiModulAction } from "./enrollment";
import { createModul, resetCourses, updateCourse } from "@/lib/courses/store";
import { decodePendaftaran } from "@/lib/courses/enrollment";
import { PESAN_POLICY } from "@/lib/courses/kebijakan";
import * as sessionModule from "@/lib/auth/session";
import * as cacheModule from "next/cache";
import type { SessionPayload } from "@/lib/auth/types";

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = jar.get(name);
      return value ? { value } : undefined;
    },
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const sesi: SessionPayload = {
  email: "user@careevo.test",
  nama: "Raka Pratama",
  username: "raka",
  role: "user",
  iat: Math.floor(Date.now() / 1000),
};

/** Kursus yang dipakai untuk menguji kebijakan `opsional`. */
const KURSUS_OPSIONAL = "crs-4";
/** Kursus yang dipakai untuk menguji kebijakan `wajib` yang **tersimpan**. */
const KURSUS_WAJIB = "crs-7";

/**
 * Modul `materi` tersimpan pada kurikulum sebuah kursus, dibuat lewat store.
 *
 * Dipakai alih-alih id modul turunan (`crs-N-m1`) supaya checkpoint-nya
 * eksplisit: modul turunan tidak pernah menyimpan checkpoint, jadi menguji
 * gerbang kebijakan di atasnya berarti mengandalkan default `materi` yang
 * kebetulan menguntungkan. Modul turunan tetap diuji terpisah di bawah.
 */
async function modulMateriBaru(courseId: string, judul = "Modul Materi Uji") {
  const modul = await createModul(courseId, {
    judul,
    ringkasan: "Modul uji dengan checkpoint pemahaman materi.",
    durasi_min: 15,
    checkpoint: { mode: "materi", batas_waktu_menit: 30 },
  });
  expect(modul).not.toBeNull();
  return modul!;
}

/** Setel kebijakan pengawasan kursus lewat jalur resmi store (bukan tulis paksa). */
async function setelKebijakan(courseId: string, aturanPengawasan: "wajib" | "opsional") {
  const kursus = await updateCourse(courseId, { kebijakan: { aturan_pengawasan: aturanPengawasan } });
  expect(kursus?.kebijakan?.aturan_pengawasan).toBe(aturanPengawasan);
}

describe("enrollment actions", () => {
  beforeEach(() => {
    resetCourses();
    jar.clear();
    vi.clearAllMocks();
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi);
  });

  it("menolak bila belum masuk", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(null);
    const res = await daftarKursusAction("crs-1");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("Masuk");
    const tandai = await tandaiModulAction("crs-1", "crs-1-m1");
    expect(tandai.ok).toBe(false);
  });

  it("mendaftarkan kursus gratis dan idempoten", async () => {
    const pertama = await daftarKursusAction("crs-1");
    expect(pertama.ok).toBe(true);
    expect(cacheModule.revalidatePath).toHaveBeenCalledWith("/belajar");
    expect(cacheModule.revalidatePath).toHaveBeenCalledWith(
      "/belajar/fullstack-web-development-nextjs-15-react-19",
    );
    const kedua = await daftarKursusAction("crs-1");
    expect(kedua.ok).toBe(true);
    expect(kedua.message).toContain("sudah terdaftar");
  });

  it("menolak kursus berbayar dengan penanda butuhPlus", async () => {
    const res = await daftarKursusAction("crs-5");
    expect(res.ok).toBe(false);
    expect(res.butuhPlus).toBe(true);
  });

  it("menolak kursus draft yang belum dipublikasikan", async () => {
    const res = await daftarKursusAction("crs-8");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("dipublikasikan");
  });

  it("menolak id yang tidak dikenal", async () => {
    const res = await daftarKursusAction("tidak-ada");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("tidak ditemukan");
  });

  it("mendaftarkan fixture resource gratis lewat id-nya", async () => {
    const res = await daftarKursusAction("r1");
    expect(res.ok).toBe(true);
  });

  it("menandai modul hanya setelah terdaftar", async () => {
    const tanpaDaftar = await tandaiModulAction("crs-2", "crs-2-m1");
    expect(tanpaDaftar.ok).toBe(false);
    expect(tanpaDaftar.error).toContain("Daftar");

    // Kursus dibuat `opsional` dulu supaya jalur informalnya sah. `crs-2`
    // memakai kebijakan default (`wajib`), dan sejak gerbang kebijakan ada,
    // penandaan penyelesaian modul `materi` di sana memang ditolak — itu yang
    // diuji terpisah di blok "gerbang kebijakan sesi terverifikasi".
    await setelKebijakan("crs-2", "opsional");
    await daftarKursusAction("crs-2");
    const tandai = await tandaiModulAction("crs-2", "crs-2-m1");
    expect(tandai.ok).toBe(true);
    expect(cacheModule.revalidatePath).toHaveBeenCalledWith(
      "/belajar/membangun-rest-api-modern-dengan-nodejs",
    );

    const batal = await tandaiModulAction("crs-2", "crs-2-m1");
    expect(batal.ok).toBe(true);
  });

  it("menolak id modul yang tidak dikenal", async () => {
    await daftarKursusAction("crs-2");
    const res = await tandaiModulAction("crs-2", "crs-2-m99");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("tidak dikenal");
  });

  it("menolak tandai untuk kursus draft", async () => {
    const res = await tandaiModulAction("crs-8", "crs-8-m1");
    expect(res.ok).toBe(false);
  });

  it("menyimpan pendaftaran di cookie yang bisa dibaca kembali", async () => {
    // Kursus `opsional`: penandaan mandiri adalah jalur yang sah di sana, jadi
    // cookie progres benar-benar ditulis dan bisa dibaca kembali.
    await setelKebijakan("crs-1", "opsional");
    await daftarKursusAction("crs-1");
    await tandaiModulAction("crs-1", "crs-1-m1");
    const mentah = jar.get("ls_enroll");
    expect(mentah).toBeDefined();
    const daftar = decodePendaftaran(mentah);
    expect(daftar).toHaveLength(1);
    expect(daftar[0].course_id).toBe("crs-1");
    expect(daftar[0].selesai_modul).toEqual(["crs-1-m1"]);
  });

  it("menolak modul dengan checkpoint kuis", async () => {
    await daftarKursusAction("crs-3");
    // Modul tersimpan dengan checkpoint kuis: kelulusannya hanya sah dari kuis,
    // jadi tombol "Tandai selesai" tidak boleh menembusnya.
    const modulKuis = await createModul("crs-3", {
      judul: "Kuis Keamanan Dasar",
      ringkasan: "Uji pemahaman dasar OWASP lewat kuis tersimpan.",
      durasi_min: 20,
      checkpoint: { mode: "kuis", batas_waktu_menit: 20 },
    });
    expect(modulKuis).not.toBeNull();

    const res = await tandaiModulAction("crs-3", modulKuis!.id);
    expect(res.ok).toBe(false);
    // Pesannya disamakan dengan `selesaikanMateriAction`, lengkap dengan dua
    // kata kuncinya, supaya kedua jalur tidak menyimpang.
    expect(res.error).toContain("kuis/proyek");
    expect(res.error).toContain("penandaan manual");

    // Bukti bahwa penolakan benar-benar menghentikan penulisan: progres tetap
    // kosong, bukan hanya balasan `ok: false`.
    const daftar = decodePendaftaran(jar.get("ls_enroll"));
    expect(daftar[0].selesai_modul).toEqual([]);
  });

  it("menolak modul dengan checkpoint proyek", async () => {
    await daftarKursusAction("crs-3");
    const modulProyek = await createModul("crs-3", {
      judul: "Proyek Keamanan Terapan",
      ringkasan: "Bangun tinjauan keamanan sebagai proyek penilaian.",
      durasi_min: 60,
      checkpoint: { mode: "proyek", batas_waktu_menit: 120 },
    });
    expect(modulProyek).not.toBeNull();

    const res = await tandaiModulAction("crs-3", modulProyek!.id);
    expect(res.ok).toBe(false);
    expect(res.error).toContain("kuis/proyek");
  });

  it("tetap mengizinkan penandaan modul checkpoint materi", async () => {
    // Modul `materi` adalah jalur informal yang sah — pada kursus yang
    // **tidak** mewajibkan sesi terverifikasi. Kursus `crs-3` memakai
    // kebijakan default (`wajib`), jadi kebijakannya disetel `opsional` dulu;
    // sisi `wajib`-nya diuji di blok "gerbang kebijakan sesi terverifikasi".
    await setelKebijakan("crs-3", "opsional");
    await daftarKursusAction("crs-3");
    const modulMateri = await createModul("crs-3", {
      judul: "Pengantar OWASP",
      ringkasan: "Ringkasan sepuluh risiko teratas menurut OWASP.",
      durasi_min: 15,
      checkpoint: { mode: "materi", batas_waktu_menit: 30 },
    });
    expect(modulMateri).not.toBeNull();

    const res = await tandaiModulAction("crs-3", modulMateri!.id);
    expect(res.ok).toBe(true);

    const daftar = decodePendaftaran(jar.get("ls_enroll"));
    expect(daftar[0].selesai_modul).toEqual([modulMateri!.id]);
  });

  it("tetap mengizinkan penandaan modul turunan tanpa checkpoint tersimpan", async () => {
    // Kursus yang belum pernah diedit admin memakai modul turunan (id lama);
    // modul itu tidak punya checkpoint, jadi defaultnya `materi` — dan pada
    // kursus `opsional` jalur informalnya tetap bekerja persis seperti
    // sebelumnya.
    await setelKebijakan("crs-1", "opsional");
    await daftarKursusAction("crs-1");
    const res = await tandaiModulAction("crs-1", "crs-1-m1");
    expect(res.ok).toBe(true);
    expect(decodePendaftaran(jar.get("ls_enroll"))[0].selesai_modul).toEqual(["crs-1-m1"]);
  });

  /**
   * Gerbang kebijakan di dalam action itu sendiri.
   *
   * Sebelum ini `tandaiModulAction` hanya memeriksa checkpoint; kebijakan kursus
   * tidak pernah dibaca. Server action adalah endpoint HTTP publik, jadi
   * `tandaiModulAction(courseWajib, modulMateri)` menandai modul selesai tanpa
   * satu pun bukti sesi — walaupun UI sudah tidak lagi merutekan ke sana.
   * Test di bawah menuntut penolakan **di server**, bukan sekadar di perutean.
   */
  describe("gerbang kebijakan sesi terverifikasi", () => {
    it("menolak penyelesaian modul materi di kursus wajib dan tidak menulis progres", async () => {
      await setelKebijakan(KURSUS_WAJIB, "wajib");
      const modul = await modulMateriBaru(KURSUS_WAJIB);
      await daftarKursusAction(KURSUS_WAJIB);
      // Pendaftaran sendiri me-revalidasi cache; yang diuji di bawah adalah
      // revalidasi milik penandaan modul, jadi penghitungnya direset dulu.
      vi.clearAllMocks();

      const res = await tandaiModulAction(KURSUS_WAJIB, modul.id);

      expect(res.ok).toBe(false);
      // Pesannya persis string kanonik dari mesin kebijakan, bukan copy baru:
      // jalur informal dan `selesaikanMateriAction` harus memakai kalimat yang
      // sama supaya tidak bisa menyimpang.
      expect(res.error).toBe(PESAN_POLICY.wajib);

      // Bukti bahwa penolakan terjadi sebelum penulisan: progres tetap kosong,
      // dan tidak ada revalidasi cache yang dijalankan.
      const daftar = decodePendaftaran(jar.get("ls_enroll"));
      expect(daftar[0].selesai_modul).toEqual([]);
      expect(cacheModule.revalidatePath).not.toHaveBeenCalled();
    });

    it("menolak juga saat kursus wajib tidak punya kebijakan tersimpan", async () => {
      // Kursus seed tidak membawa `kebijakan`; default-nya `wajib`. Kalau gerbang
      // hanya membaca `kursus.kebijakan` tanpa fallback, kursus tanpa kebijakan
      // tersimpan justru jadi jalan keluar dari gerbang.
      const modul = await modulMateriBaru(KURSUS_WAJIB);
      await daftarKursusAction(KURSUS_WAJIB);
      vi.clearAllMocks();

      const res = await tandaiModulAction(KURSUS_WAJIB, modul.id);

      expect(res.ok).toBe(false);
      expect(res.error).toBe(PESAN_POLICY.wajib);
      expect(decodePendaftaran(jar.get("ls_enroll"))[0].selesai_modul).toEqual([]);
      expect(cacheModule.revalidatePath).not.toHaveBeenCalled();
    });

    it("tetap mengizinkan penandaan modul materi di kursus opsional", async () => {
      await setelKebijakan(KURSUS_OPSIONAL, "opsional");
      const modul = await modulMateriBaru(KURSUS_OPSIONAL);
      await daftarKursusAction(KURSUS_OPSIONAL);

      const res = await tandaiModulAction(KURSUS_OPSIONAL, modul.id);

      expect(res.ok).toBe(true);
      expect(decodePendaftaran(jar.get("ls_enroll"))[0].selesai_modul).toEqual([modul.id]);
    });

    it("tetap mengizinkan penandaan modul kuis dan proyek di kursus opsional", async () => {
      // Kursus `opsional` tidak butuh sesi sama sekali, jadi gerbang kebijakan
      // tidak boleh menyentuh checkpoint apa pun di sini.
      const modulKuis = await createModul(KURSUS_OPSIONAL, {
        judul: "Kuis Kursus Opsional",
        ringkasan: "Kuis tersimpan pada kursus berpengawasan opsional.",
        durasi_min: 20,
        checkpoint: { mode: "kuis", batas_waktu_menit: 20 },
      });
      const modulMateri = await modulMateriBaru(KURSUS_OPSIONAL, "Materi Kursus Opsional");
      expect(modulKuis).not.toBeNull();
      await setelKebijakan(KURSUS_OPSIONAL, "opsional");
      await daftarKursusAction(KURSUS_OPSIONAL);

      const resKuis = await tandaiModulAction(KURSUS_OPSIONAL, modulKuis!.id);
      const resMateri = await tandaiModulAction(KURSUS_OPSIONAL, modulMateri.id);

      expect(resKuis.ok).toBe(false);
      expect(resKuis.error).toContain("kuis/proyek");
      expect(resMateri.ok).toBe(true);
      expect(decodePendaftaran(jar.get("ls_enroll"))[0].selesai_modul).toEqual([modulMateri.id]);
    });

    it("tetap mengizinkan pembatalan modul materi di kursus wajib", async () => {
      await setelKebijakan(KURSUS_WAJIB, "wajib");
      const modul = await modulMateriBaru(KURSUS_WAJIB);
      await daftarKursusAction(KURSUS_WAJIB);
      // Modul yang statusnya sudah "selesai" **harus** bisa dibatalkan: itulah
      // satu-satunya cara peserta mengoreksi tanda. Penolakan pembatalan akan
      // mengunci modul selamanya di kursus wajib, jadi arah tindakan wajib
      // dibedakan dari arah penyelesaian.
      await setelKebijakan(KURSUS_WAJIB, "opsional");
      const tandai = await tandaiModulAction(KURSUS_WAJIB, modul.id);
      expect(tandai.ok).toBe(true);
      expect(decodePendaftaran(jar.get("ls_enroll"))[0].selesai_modul).toEqual([modul.id]);

      await setelKebijakan(KURSUS_WAJIB, "wajib");
      const res = await tandaiModulAction(KURSUS_WAJIB, modul.id);

      expect(res.ok).toBe(true);
      expect(decodePendaftaran(jar.get("ls_enroll"))[0].selesai_modul).toEqual([]);
    });
  });
});
