import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Direktori sesi dialihkan sebelum modul diimpor: `session.ts` membaca
// `CAREERS_SESSION_DIR` per panggilan, dan tanpa ini test akan menulis ke
// `.data/sessions` milik mesin pengembang.
const DIR = mkdtempSync(path.join(tmpdir(), "careevo-sesi-act-"));
process.env.CAREERS_SESSION_DIR = DIR;

// Cookie pendaftaran hidup di `next/headers`; jar in-memory menirukan perilaku
// peramban supaya `daftarKursus()` benar-benar terbaca oleh action.
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

const sesi = { email: "siswa@careevo.test", nama: "Siswa", username: "siswa", role: "user", iat: 1 };
/**
 * Sesi bisa dicabut per test supaya cabang "belum masuk" benar-benar diuji.
 * Modul-mock-nya tetap statis dan tanpa efek samping; keadaan sesi dipindah ke
 * variabel agar `vi.mock` tetap bisa di-hoist tanpa membaca keadaan runtime.
 */
const { auth } = vi.hoisted(() => ({ auth: { sesi: null as typeof sesi | null } }));
auth.sesi = sesi;

vi.mock("@/lib/auth/session", () => ({
  getSession: async () => auth.sesi,
}));

/**
 * `revalidatePath` di-spy supaya jalur terverifikasi bisa dibuktikan
 * me-revalidasi permukaan yang sama dengan jalur informal. `next/cache` gagal
 * di luar lifecycle request Next.js, jadi tanpa mock ini revalidasinya
 * tertelan oleh `try/catch` dan tidak bisa diamati.
 */
vi.mock("next/cache", async () => {
  const asli = await vi.importActual<typeof import("next/cache")>("next/cache");
  return { ...asli, revalidatePath: vi.fn() };
});

const { mulaiSesiAction, catatKejadianAction, selesaikanMateriAction, akhiriSesiAction } = await import(
  "./learning"
);
const { daftarKursus, decodePendaftaran, ENROLL_COOKIE } = await import("@/lib/courses/enrollment");
const { createModul, resetCourses } = await import("@/lib/courses/store");
const cacheModule = await import("next/cache");
// `mulaiRun` dipakai untuk menyiapkan sesi milik pengguna **lain**: kepemilikan
// hanya bisa diuji dengan run nyata yang ownernya bukan pemanggil, sebab run
// tak dikenal berhenti di cabang "tidak ditemukan" sebelum owner dibandingkan.
const { ambilRun, mulaiRun } = await import("@/lib/learning/session");

afterAll(() => rmSync(DIR, { recursive: true, force: true }));

/**
 * `tandaiModul` men-toggle: id yang sudah ada akan **dihapus**. Test di sini
 * membaca cookie `ls_enroll` mentah (bukan hanya nilai balik action) supaya
 * hazard itu benar-benar tertangkap, bukan sekadar tebakan dari `ok: true`.
 */
function selesaiModul(courseId: string): string[] {
  const entri = decodePendaftaran(jar.get(ENROLL_COOKIE)).find(
    (item) => item.course_id === courseId,
  );
  return entri?.selesai_modul ?? [];
}

// Store kursus bisa menghidrasi `data/courses.json` milik mesin pengembang;
// reset memakai seed in-memory tanpa menyentuh disk supaya hasil test deterministik.
beforeEach(() => {
  resetCourses();
  jar.clear();
  auth.sesi = sesi;
  vi.clearAllMocks();
});

describe("mulaiSesiAction", () => {
  it("creates a session and returns a proof token", async () => {
    await daftarKursus("crs-1", "crs-1", sesi.email);
    const hasil = await mulaiSesiAction("crs-1");
    expect(hasil.ok).toBe(true);
    expect(hasil.bukti).toBeTruthy();
    expect(hasil.run?.owner).toBe("siswa@careevo.test");
  });

  it("rejects a course the caller is not enrolled in", async () => {
    // `crs-1` ada dan published, tetapi pemanggil belum mendaftar di test ini.
    const hasil = await mulaiSesiAction("crs-1");
    expect(hasil.ok).toBe(false);
    // Pesan implementasi memakai huruf besar ("Daftar kursus ini dulu..."),
    // jadi pencocokan dilakukan tanpa peduli huruf besar/kecil.
    expect(hasil.error?.toLowerCase()).toContain("daftar");
  });
});

describe("selesaikanMateriAction", () => {
  it("rejects a missing session proof", async () => {
    const hasil = await selesaikanMateriAction({ courseId: "crs-1", modulId: "crs-1-m1", bukti: "" });
    expect(hasil.ok).toBe(false);
    expect(hasil.error).toContain("sesi");
  });

  it("menolak bukti sesi yang tidak sah", async () => {
    // Yang dibuktikan di sini adalah verifikasi bukti, bukan pendaftaran:
    // `selesaikanMateriAction` tidak punya gerbang enrolment sendiri — bukti
    // sesi yang ditandatangani server sudah cukup sebagai gerbangnya.
    const mulai = await mulaiSesiAction("crs-2");
    // Belum terdaftar: sesi pun tidak bisa dibuat, jadi tidak ada bukti sah.
    expect(mulai.ok).toBe(false);
    const hasil = await selesaikanMateriAction({
      courseId: "crs-2",
      modulId: "crs-2-m1",
      bukti: "bukti-palsu",
    });
    expect(hasil.ok).toBe(false);
  });

  it("rejects a module whose checkpoint is not `materi`", async () => {
    await daftarKursus("crs-3", "crs-3", sesi.email);
    // Modul tersimpan dengan checkpoint kuis: menyelesaikannya lewat penandaan
    // materi harus ditolak, sebab kelulusannya hanya sah dari kuis.
    const modulKuis = await createModul("crs-3", {
      judul: "Kuis Keamanan Dasar",
      ringkasan: "Uji pemahaman dasar OWASP lewat kuis tersimpan.",
      durasi_min: 20,
      checkpoint: { mode: "kuis", batas_waktu_menit: 20 },
    });
    expect(modulKuis).not.toBeNull();

    const mulai = await mulaiSesiAction("crs-3");
    expect(mulai.ok).toBe(true);
    const hasil = await selesaikanMateriAction({
      courseId: "crs-3",
      modulId: modulKuis!.id,
      bukti: mulai.bukti ?? "",
    });
    expect(hasil.ok).toBe(false);
    expect(hasil.error).toContain("kuis");
  });

  it("accepts a valid proof for a required-proctoring course", async () => {
    await daftarKursus("crs-2", "crs-2", sesi.email);
    const mulai = await mulaiSesiAction("crs-2");
    const hasil = await selesaikanMateriAction({
      courseId: "crs-2",
      modulId: "crs-2-m1",
      bukti: mulai.bukti ?? "",
    });
    expect(hasil.ok).toBe(true);
  });
});

/**
 * Kelengkapan terverifikasi: gerbangnya sudah benar sejak awal, tetapi
 * sebelum ini jalur terverifikasi hanya me-revalidasi dan tidak pernah
 * memanggil `tandaiModul`, sehingga centang "terverifikasi" hidup hanya di
 * state klien dan hilang begitu halaman dimuat ulang. Test di blok ini menuntut
 * **keadaan tersimpan**, bukan nilai balik action.
 *
 * Sekaligus ini penutup kebuntuan: `tandaiModulAction` menolak penyelesaian
 * informal di kursus `wajib`, sedangkan kursus seed memakai kebijakan default
 * `wajib` — tanpa penyimpanan di sini, tidak ada satu pun jalur penyelesaian
 * yang bekerja untuk kursus bawaan.
 */
describe("selesaikanMateriAction — penyimpanan progres terverifikasi", () => {
  it("menyimpan modul selesai di kursus wajib yang terverifikasi", async () => {
    await daftarKursus("crs-2", "crs-2", sesi.email);
    const mulai = await mulaiSesiAction("crs-2");

    const hasil = await selesaikanMateriAction({
      courseId: "crs-2",
      modulId: "crs-2-m1",
      bukti: mulai.bukti ?? "",
    });

    expect(hasil.ok).toBe(true);
    // Bukti penyimpanan: cookie `ls_enroll` memuat id modulnya.
    expect(selesaiModul("crs-2")).toEqual(["crs-2-m1"]);
    // Revalidasi disamakan dengan jalur informal supaya daftar dan halaman
    // belajar tidak menyajikan progres basi.
    expect(cacheModule.revalidatePath).toHaveBeenCalledWith("/belajar");
    expect(cacheModule.revalidatePath).toHaveBeenCalledWith(
      "/belajar/membangun-rest-api-modern-dengan-nodejs",
    );
  });

  it("idempoten: pemanggilan kedua tidak membatalkan tanda selesai", async () => {
    // `tandaiModul` men-toggle, jadi panggilan naif pada modul yang sudah
    // selesai justru **menghapus** tandanya. Peserta yang mengeklik dua kali
    // (atau menyelesaikan ulang modul yang sudah pernah tuntas) akan melihat
    // centangnya hilang; itu regresi yang dikunci test ini.
    await daftarKursus("crs-2", "crs-2", sesi.email);
    const mulai = await mulaiSesiAction("crs-2");
    const argumen = { courseId: "crs-2", modulId: "crs-2-m1", bukti: mulai.bukti ?? "" };

    const pertama = await selesaikanMateriAction(argumen);
    expect(pertama.ok).toBe(true);
    expect(selesaiModul("crs-2")).toEqual(["crs-2-m1"]);

    const kedua = await selesaikanMateriAction(argumen);

    expect(kedua.ok).toBe(true);
    expect(selesaiModul("crs-2")).toEqual(["crs-2-m1"]);
  });

  it("tidak menulis apa pun saat bukti sesi hilang", async () => {
    await daftarKursus("crs-2", "crs-2", sesi.email);

    const hasil = await selesaikanMateriAction({ courseId: "crs-2", modulId: "crs-2-m1", bukti: "" });

    expect(hasil.ok).toBe(false);
    expect(selesaiModul("crs-2")).toEqual([]);
    expect(cacheModule.revalidatePath).not.toHaveBeenCalled();
  });

  it("tidak menulis apa pun saat bukti sesi tidak sah", async () => {
    await daftarKursus("crs-2", "crs-2", sesi.email);

    const hasil = await selesaikanMateriAction({
      courseId: "crs-2",
      modulId: "crs-2-m1",
      bukti: "bukti-palsu",
    });

    expect(hasil.ok).toBe(false);
    expect(selesaiModul("crs-2")).toEqual([]);
    expect(cacheModule.revalidatePath).not.toHaveBeenCalled();
  });

  it("tidak menulis saat modul checkpoint kuis/proyek", async () => {
    await daftarKursus("crs-3", "crs-3", sesi.email);
    const modulKuis = await createModul("crs-3", {
      judul: "Kuis Keamanan Lanjutan",
      ringkasan: "Kuis tersimpan untuk uji gerbang checkpoint.",
      durasi_min: 20,
      checkpoint: { mode: "kuis", batas_waktu_menit: 20 },
    });
    expect(modulKuis).not.toBeNull();
    const mulai = await mulaiSesiAction("crs-3");
    expect(mulai.ok).toBe(true);

    const hasil = await selesaikanMateriAction({
      courseId: "crs-3",
      modulId: modulKuis!.id,
      bukti: mulai.bukti ?? "",
    });

    expect(hasil.ok).toBe(false);
    expect(selesaiModul("crs-3")).toEqual([]);
    expect(cacheModule.revalidatePath).not.toHaveBeenCalled();
  });

  it("tidak menulis saat pemanggil belum masuk", async () => {
    await daftarKursus("crs-2", "crs-2", sesi.email);
    const mulai = await mulaiSesiAction("crs-2");
    // Sesi dicabut setelah bukti sah didapat: bukti yang sah pun tidak boleh
    // dihormati tanpa identitas pemanggil.
    auth.sesi = null;

    const hasil = await selesaikanMateriAction({
      courseId: "crs-2",
      modulId: "crs-2-m1",
      bukti: mulai.bukti ?? "",
    });

    expect(hasil.ok).toBe(false);
    expect(hasil.error).toContain("Masuk");
    expect(selesaiModul("crs-2")).toEqual([]);
  });

  it("tidak menulis saat kursus tidak ada", async () => {
    const hasil = await selesaikanMateriAction({
      courseId: "tidak-ada",
      modulId: "crs-2-m1",
      bukti: "bukti-palsu",
    });

    expect(hasil.ok).toBe(false);
    expect(hasil.error).toContain("tidak ditemukan");
    expect(jar.get(ENROLL_COOKIE)).toBeUndefined();
  });

  it("menyimpan penyelesaian modul kursus seed berkebijakan default (wajib)", async () => {
    // Sifat yang memotivasi perbaikan ini: kursus seed `INITIAL_COURSES` tidak
    // menyimpan `kebijakan`, sehingga `kebijakanDefault()` (`wajib`) berlaku dan
    // jalur informal menolaknya. Modul turunan tanpa checkpoint juga default
    // `materi`. Dulu jalur terverifikasi satu-satunya yang menerima — tetapi
    // tidak menyimpan apa pun, jadi tidak ada modul kursus bawaan yang bisa
    // tuntas. Sekarang penyelesaiannya harus bertahan di cookie `ls_enroll`.
    await daftarKursus("crs-1", "crs-1", sesi.email);
    const mulai = await mulaiSesiAction("crs-1");
    expect(mulai.ok).toBe(true);

    const hasil = await selesaikanMateriAction({
      courseId: "crs-1",
      modulId: "crs-1-m1",
      bukti: mulai.bukti ?? "",
    });

    expect(hasil.ok).toBe(true);
    expect(selesaiModul("crs-1")).toEqual(["crs-1-m1"]);
    expect(cacheModule.revalidatePath).toHaveBeenCalledWith(
      "/belajar/fullstack-web-development-nextjs-15-react-19",
    );
  });
});

describe("catatKejadianAction", () => {
  it("records an event for an active run", async () => {
    await daftarKursus("crs-3", "crs-3", sesi.email);
    const mulai = await mulaiSesiAction("crs-3");
    const hasil = await catatKejadianAction({ runId: mulai.runId ?? "", jenis: "pindah_tab", visibilitas: "hidden" });
    expect(hasil.ok).toBe(true);
    // Kejadian pertama selalu `sesi_dimulai` dari `mulaiSesiAction`; yang
    // diuji di sini adalah kejadian terbaru yang baru saja dicatat.
    expect(hasil.run?.kejadian.at(-1)?.jenis).toBe("pindah_tab");
  });

  it("refuses an unknown run", async () => {
    const hasil = await catatKejadianAction({ runId: "sesi-palsu", jenis: "pindah_tab", visibilitas: "hidden" });
    expect(hasil.ok).toBe(false);
  });

  it("menolak kejadian pada sesi milik pengguna lain", async () => {
    // Sesi nyata milik orang lain: tanpa pemeriksaan `run.owner`, kejadian
    // pemanggil akan masuk ke catatan integritas peserta lain.
    const asing = await mulaiRun({
      courseId: "crs-1",
      owner: "orang-lain@careevo.test",
      policyVersion: 1,
    });
    const hasil = await catatKejadianAction({
      runId: asing.id,
      jenis: "pindah_tab",
      visibilitas: "hidden",
    });
    expect(hasil.ok).toBe(false);
    // Bukti bahwa tidak ada yang tercatat: sesi asing tetap bersih.
    const sesudah = await ambilRun(asing.id);
    expect(sesudah?.kejadian.length).toBe(0);
  });

  it("menolak jenis kejadian di luar daftar sah", async () => {
    await daftarKursus("crs-3", "crs-3", sesi.email);
    const mulai = await mulaiSesiAction("crs-3");
    const hasil = await catatKejadianAction({
      runId: mulai.runId ?? "",
      // Klien bisa mengirim string apa pun; yang belum dikenal harus ditolak
      // di server, bukan dianggap kejadian biasa.
      jenis: "kamera_berhenti_palsu" as never,
      visibilitas: "hidden",
    });
    expect(hasil.ok).toBe(false);
    expect(hasil.error).toContain("Jenis kejadian");
  });

  it("menolak visibilitas di luar visible/hidden/null", async () => {
    await daftarKursus("crs-3", "crs-3", sesi.email);
    const mulai = await mulaiSesiAction("crs-3");
    const hasil = await catatKejadianAction({
      runId: mulai.runId ?? "",
      jenis: "pindah_tab",
      visibilitas: "diam-diam" as never,
    });
    expect(hasil.ok).toBe(false);
    expect(hasil.error).toContain("Jenis kejadian");
  });
});

describe("akhiriSesiAction", () => {
  it("menutup sesi yang aktif", async () => {
    await daftarKursus("crs-1", "crs-1", sesi.email);
    const mulai = await mulaiSesiAction("crs-1");
    const hasil = await akhiriSesiAction(mulai.runId ?? "");
    expect(hasil.ok).toBe(true);
    expect(hasil.run?.status).toBe("diakhiri");
  });

  it("menolak sesi yang bukan milik pemanggil", async () => {
    const hasil = await akhiriSesiAction("sesi-palsu");
    expect(hasil.ok).toBe(false);
  });

  it("menolak mengakhiri sesi milik pengguna lain", async () => {
    // Sesi nyata milik orang lain: tanpa pemeriksaan `run.owner`, pemanggil
    // bisa menutup sesi peserta lain dan merusak bukti pengerjaannya.
    const asing = await mulaiRun({
      courseId: "crs-1",
      owner: "orang-lain@careevo.test",
      policyVersion: 1,
    });
    const hasil = await akhiriSesiAction(asing.id);
    expect(hasil.ok).toBe(false);
    // Sesi asing harus tetap aktif: penolakan bukan sekadar balasan `ok: false`.
    const sesudah = await ambilRun(asing.id);
    expect(sesudah?.status).toBe("aktif");
  });
});
