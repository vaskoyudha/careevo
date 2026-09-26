import { describe, it, expect, beforeEach, vi } from "vitest";
import { daftarKursusAction, tandaiModulAction } from "./enrollment";
import { createModul, resetCourses, updateCourse } from "@/lib/courses/store";
import { PESAN_POLICY } from "@/lib/courses/kebijakan";
import * as sessionModule from "@/lib/auth/session";
import * as cacheModule from "next/cache";
import { principalUji } from "@/lib/auth/test-principal";
import type { SessionPrincipal } from "@/lib/auth/principal";
import type { Enrollment } from "@/lib/db/schema";

/**
 * Setelah cutover Fase 2, sumber data enrollment/progres adalah PostgreSQL
 * lewat `@/lib/learning/service`. Test ini karena itu mem-mock **lapisan
 * service**, bukan cookie `ls_enroll`: yang diuji di sini adalah keputusan
 * action (gerbang sesi/kursus/modul/checkpoint/kebijakan dan argumen delegasi),
 * sedangkan perilaku penyimpanannya sendiri sudah dikunci
 * `service.test.ts` + `run-service.integration.test.ts` di atas Postgres.
 */
const mocks = vi.hoisted(() => ({
  daftarKursusDb: vi.fn(),
  progresKursusDb: vi.fn(),
  tandaiModulDb: vi.fn(),
}));

vi.mock("@/lib/learning/service", () => ({
  daftarKursusDb: mocks.daftarKursusDb,
  progresKursusDb: mocks.progresKursusDb,
  tandaiModulDb: mocks.tandaiModulDb,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const sesi = principalUji({
  email: "user@careevo.test",
  nama: "Raka Pratama",
  username: "raka",
  role: "user",
});

/** Kursus yang dipakai untuk menguji kebijakan `opsional`. */
const KURSUS_OPSIONAL = "crs-4";
/** Kursus yang dipakai untuk menguji kebijakan `wajib` yang **tersimpan**. */
const KURSUS_WAJIB = "crs-7";

/**
 * Toko enrollment in-memory: menirukan dua sifat service yang diandalkan action.
 *
 * 1. **Unik per `(userId, courseId)`** — mendaftar dua kali mengembalikan
 *    `baru: false`, bukan baris kedua. Id pemilik adalah `principal.userId`
 *    (uuid), bukan email, persis seperti `enrollments` di database.
 * 2. **Toggle informal / tambah terverifikasi** — `tandaiModulDb` yang
 *    memutuskan arahnya, bukan action.
 *
 * Menirukan service di sini bukan berarti menguji ulang service: yang
 * diperiksa adalah bahwa action memanggilnya dengan argumen yang benar dan
 * **tidak** memanggilnya saat gerbangnya menolak.
 */
let enrollmentTersimpan: Map<string, Enrollment>;
let selesaiTersimpan: Map<string, string[]>;

function kunci(userId: string, courseId: string): string {
  return `${userId}:${courseId}`;
}

function enrollmentUji(courseId: string, userId: string): Enrollment {
  return {
    id: `enr-${courseId}-${userId.slice(0, 8)}`,
    userId,
    courseId,
    status: "active",
    enrolledAt: new Date("2026-09-01T08:00:00.000Z"),
    completedAt: null,
    completionPath: null,
  };
}

/** Progres yang sudah tersimpan untuk sebuah kursus (pemilik default `sesi`). */
function seedSelesai(courseId: string, modul: string[], principal: SessionPrincipal = sesi): void {
  const k = kunci(principal.userId, courseId);
  enrollmentTersimpan.set(k, enrollmentUji(courseId, principal.userId));
  selesaiTersimpan.set(k, [...modul]);
}

function bacaSelesai(courseId: string, principal: SessionPrincipal = sesi): string[] {
  return selesaiTersimpan.get(kunci(principal.userId, courseId)) ?? [];
}

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

/**
 * Principal dengan email berbeda, `userId` ikut berbeda.
 *
 * `principalUji` menurunkan `userId` dari email, jadi dua pemilik berbeda di
 * test lintas-owner benar-benar punya id yang berbeda — bukan id yang sama
 * dengan email yang diganti.
 */
function sesiUntuk(email: string) {
  return principalUji({ email, nama: "Raka Pratama", username: "raka", role: "user" });
}

describe("enrollment actions", () => {
  beforeEach(() => {
    resetCourses();
    vi.clearAllMocks();
    enrollmentTersimpan = new Map();
    selesaiTersimpan = new Map();
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(sesi);

    mocks.daftarKursusDb.mockImplementation(
      async ({ principal, courseId }: { principal: SessionPrincipal; courseId: string }) => {
        const k = kunci(principal.userId, courseId);
        const ada = enrollmentTersimpan.get(k);
        if (ada) return { enrollment: ada, baru: false };
        const baru = enrollmentUji(courseId, principal.userId);
        enrollmentTersimpan.set(k, baru);
        return { enrollment: baru, baru: true };
      },
    );

    mocks.progresKursusDb.mockImplementation(
      async (principal: SessionPrincipal, courseId: string) => {
        const k = kunci(principal.userId, courseId);
        const enrollment = enrollmentTersimpan.get(k) ?? null;
        return { enrollment, selesai: enrollment ? (selesaiTersimpan.get(k) ?? []) : [] };
      },
    );

    mocks.tandaiModulDb.mockImplementation(
      async ({
        principal,
        courseId,
        modulId,
        sumber,
      }: {
        principal: SessionPrincipal;
        courseId: string;
        modulId: string;
        sumber: "terverifikasi" | "informal";
      }) => {
        const k = kunci(principal.userId, courseId);
        const enrollment = enrollmentTersimpan.get(k);
        if (!enrollment) return { ok: false, alasan: "belum_terdaftar" };
        const daftar = selesaiTersimpan.get(k) ?? [];
        const sudah = daftar.includes(modulId);
        if (sumber === "informal") {
          selesaiTersimpan.set(
            k,
            sudah ? daftar.filter((id) => id !== modulId) : [...daftar, modulId],
          );
          return { ok: true, aksi: sudah ? "dibatalkan" : "ditandai", enrollment };
        }
        if (!sudah) selesaiTersimpan.set(k, [...daftar, modulId]);
        return { ok: true, aksi: "ditandai", enrollment };
      },
    );
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
    // Idempotensi datang dari unique `(user_id, course_id)` di database, bukan
    // dari pembacaan cookie: panggilan kedua mengembalikan `baru: false`.
    expect(mocks.daftarKursusDb).toHaveBeenCalledWith(
      expect.objectContaining({
        principal: sesi,
        courseId: "crs-1",
        slug: "fullstack-web-development-nextjs-15-react-19",
      }),
    );
    const kedua = await daftarKursusAction("crs-1");
    expect(kedua.ok).toBe(true);
    expect(kedua.message).toContain("sudah terdaftar");
  });

  it("menolak kursus berbayar dengan penanda butuhPlus", async () => {
    const res = await daftarKursusAction("crs-5");
    expect(res.ok).toBe(false);
    expect(res.butuhPlus).toBe(true);
    expect(mocks.daftarKursusDb).not.toHaveBeenCalled();
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
    // Judul untuk cache referensi `courses` datang dari store, bukan pemanggil.
    expect(mocks.daftarKursusDb).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: "r1", title: expect.any(String) }),
    );
  });

  it("menandai modul hanya setelah terdaftar", async () => {
    const tanpaDaftar = await tandaiModulAction("crs-2", "crs-2-m1");
    expect(tanpaDaftar.ok).toBe(false);
    expect(tanpaDaftar.error).toContain("Daftar");
    expect(mocks.tandaiModulDb).not.toHaveBeenCalled();

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
    expect(bacaSelesai("crs-2")).toEqual([]);
  });

  it("menolak id modul yang tidak dikenal", async () => {
    await daftarKursusAction("crs-2");
    const res = await tandaiModulAction("crs-2", "crs-2-m99");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("tidak dikenal");
    expect(mocks.tandaiModulDb).not.toHaveBeenCalled();
  });

  it("menolak tandai untuk kursus draft", async () => {
    const res = await tandaiModulAction("crs-8", "crs-8-m1");
    expect(res.ok).toBe(false);
  });

  it("mendelegasikan penyelesaian informal ke service dengan jalur informal", async () => {
    await setelKebijakan("crs-1", "opsional");
    await daftarKursusAction("crs-1");
    await tandaiModulAction("crs-1", "crs-1-m1");
    expect(mocks.tandaiModulDb).toHaveBeenCalledWith(
      expect.objectContaining({
        principal: sesi,
        courseId: "crs-1",
        modulId: "crs-1-m1",
        sumber: "informal",
      }),
    );
    expect(bacaSelesai("crs-1")).toEqual(["crs-1-m1"]);
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

    // Bukti bahwa penolakan benar-benar menghentikan penulisan: service tidak
    // dipanggil sama sekali, bukan hanya balasan `ok: false`.
    expect(mocks.tandaiModulDb).not.toHaveBeenCalled();
    expect(bacaSelesai("crs-3")).toEqual([]);
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
    expect(mocks.tandaiModulDb).not.toHaveBeenCalled();
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

    expect(bacaSelesai("crs-3")).toEqual([modulMateri!.id]);
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
    expect(bacaSelesai("crs-1")).toEqual(["crs-1-m1"]);
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
      // tidak ada delegasi ke service, dan tidak ada revalidasi cache.
      expect(mocks.tandaiModulDb).not.toHaveBeenCalled();
      expect(bacaSelesai(KURSUS_WAJIB)).toEqual([]);
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
      expect(mocks.tandaiModulDb).not.toHaveBeenCalled();
      expect(bacaSelesai(KURSUS_WAJIB)).toEqual([]);
      expect(cacheModule.revalidatePath).not.toHaveBeenCalled();
    });

    it("tetap mengizinkan penandaan modul materi di kursus opsional", async () => {
      await setelKebijakan(KURSUS_OPSIONAL, "opsional");
      const modul = await modulMateriBaru(KURSUS_OPSIONAL);
      await daftarKursusAction(KURSUS_OPSIONAL);

      const res = await tandaiModulAction(KURSUS_OPSIONAL, modul.id);

      expect(res.ok).toBe(true);
      expect(bacaSelesai(KURSUS_OPSIONAL)).toEqual([modul.id]);
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
      expect(bacaSelesai(KURSUS_OPSIONAL)).toEqual([modulMateri.id]);
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
      expect(bacaSelesai(KURSUS_WAJIB)).toEqual([modul.id]);

      await setelKebijakan(KURSUS_WAJIB, "wajib");
      const res = await tandaiModulAction(KURSUS_WAJIB, modul.id);

      expect(res.ok).toBe(true);
      expect(bacaSelesai(KURSUS_WAJIB)).toEqual([]);
    });
  });

  it("enrollment unik per user: dua akun boleh punya baris untuk course_id yang sama", async () => {
    // Pengganti test cookie "owner ternormalisasi"/"dua akun": kepemilikan
    // sekarang `users.id` (uuid), dan keunikannya `(user_id, course_id)`.
    const untukA = sesiUntuk("a@careevo.test");
    const untukB = sesiUntuk("b@careevo.test");
    expect(untukA.userId).not.toBe(untukB.userId);

    vi.spyOn(sessionModule, "getSession").mockResolvedValue(untukA);
    expect((await daftarKursusAction("crs-1")).ok).toBe(true);

    vi.spyOn(sessionModule, "getSession").mockResolvedValue(untukB);
    expect((await daftarKursusAction("crs-1")).ok).toBe(true);

    expect(enrollmentTersimpan.has(kunci(untukA.userId, "crs-1"))).toBe(true);
    expect(enrollmentTersimpan.has(kunci(untukB.userId, "crs-1"))).toBe(true);
  });

  it("tidak punya batas 50 pendaftaran seperti cookie", async () => {
    // Batas 50 adalah batas ukuran cookie `ls_enroll`. Dengan `enrollments`
    // unik per (user, course) tidak ada batas keras, jadi pendaftaran ke-51
    // harus tetap berhasil.
    for (let index = 0; index < 50; index += 1) {
      seedSelesai(`lain-${index}`, [], sesi);
    }
    const hasil = await daftarKursusAction("crs-1");
    expect(hasil.ok).toBe(true);
    expect(hasil.message).toContain("berhasil");
  });

  it("tandaiModulAction hanya menulis enrollment milik pemanggil", async () => {
    // Isolasi kepemilikan, bukan gerbang kebijakan: `crs-1` memakai default
    // `wajib`, dan pada kursus `wajib` jalur informal memang ditolak. Disetel
    // `opsional` dulu supaya yang diuji benar-benar penulisan lintas-owner.
    await setelKebijakan("crs-1", "opsional");
    const pemilikLain = sesiUntuk("b@careevo.test");
    const enrollmentLain = enrollmentUji("crs-1", pemilikLain.userId);
    const enrollmentSendiri = enrollmentUji("crs-1", sesi.userId);

    // Service dipanggil action dengan principal **pemanggil**: itulah yang
    // membuat enrollment milik orang lain tidak mungkin tersentuh, sebab
    // service memuat barisnya lewat `(principal.userId, courseId)`.
    mocks.progresKursusDb.mockResolvedValue({
      enrollment: enrollmentSendiri,
      selesai: [],
    });
    mocks.tandaiModulDb.mockResolvedValue({
      ok: true,
      aksi: "ditandai",
      enrollment: enrollmentSendiri,
    });

    await tandaiModulAction("crs-1", "crs-1-m1");

    expect(mocks.progresKursusDb).toHaveBeenCalledWith(sesi, "crs-1");
    expect(mocks.tandaiModulDb).toHaveBeenCalledWith(
      expect.objectContaining({ principal: sesi, courseId: "crs-1" }),
    );
    // `enrollmentId` orang lain tidak pernah ikut di argumen mana pun: action
    // tidak membawa id enrollment, ownership sepenuhnya milik service.
    expect(JSON.stringify(mocks.tandaiModulDb.mock.calls)).not.toContain(
      enrollmentLain.userId,
    );
  });
});
