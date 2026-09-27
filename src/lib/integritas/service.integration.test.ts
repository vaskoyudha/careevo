/**
 * Test integrasi skor kejujuran — **butuh PostgreSQL** (`npm run test:db`).
 *
 * Unit test `skor.test.ts` membuktikan aritmatikanya benar, tapi tidak bisa
 * membuktikan hal-hal yang justru paling mudah rusak di sini:
 *
 * 1. **Snapshot penalti benar-benar tersimpan.** Kalau `penalty` tidak
 *    tersimpan dan dibaca dari katalog saat runtime, mengubah bobot katalog akan
 *    diam-diam menulis ulang keputusan lama — dan tidak ada test yang gagal.
 * 2. **CHECK database menolak jenis yang tidak ada di katalog.** Zod di action
 *    bisa lolos; yang harus menolak adalah constraint.
 * 3. **Skor hanya turun dari baris `active`.** Baris `expunged` yang masih
 *    dihitung akan membuat "skor kembali sendiri" tidak pernah terjadi, dan
 *    tidak ada yang gagal.
 * 4. **Batas waktu pemulihan benar-benar membatasi.** `course_completions` unik
 *    per enrollment, jadi "mengulang" tidak membuat baris baru. Tanpa
 *    `created_at <= sebelum`, panggilan yang kebetulan terjadi sebelum
 *    pelanggaran dicatat akan memulihkan pelanggaran itu sendiri — skor's dihapus
 *    tanpa mengulang apa pun. Ini tidak bisa dibuktikan tanpa database.
 * 5. **Bukti disaring sebelum insert.** `payload_redacted` yang menyimpan
 *    `{ token: ... }` akan menjadi kebocoran yang tidak terlihat di UI.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";

import { getDb, tutupDb, type KoneksiDb } from "@/lib/db/client";
import { auditEvents, integrityViolations } from "@/lib/db/schema";
import { daftarPengguna } from "@/lib/auth/auth-service";
import { beriRole } from "@/lib/auth/invitation";
import { daftarEnrollment, rekamCompletion, listEnrollments } from "@/lib/learning/repository";
import { enrollments } from "@/lib/db/schema";
import type { SessionPrincipal } from "@/lib/auth/principal";
import {
  antrianUsulanDb,
  catatPelanggaranDb,
  integritasSertifikatDb,
  listSemuaPelanggaran,
  pulihkanPelanggaranSetelahUlang,
  putuskanUsulanDb,
  ringkasanPelanggaranCourseDb,
  skorIntegritasDb,
  tolakUsulanDb,
  usulkanPelanggaranDb,
} from "@/lib/integritas/service";
import { hitungSkorIntegritas } from "@/lib/integritas/skor";

let db: KoneksiDb = getDb();

const COURSE = "crs-uji";
const SLUG = "fullstack-web-development-nextjs-15-react-19";

async function kosongkan() {
  await db.execute(
    sql`truncate table
      attestation_events,
      attestations,
      audit_events,
      badges,
      course_completions,
      courses,
      email_verification_tokens,
      enrollments,
      integrity_violations,
      learning_events,
      learning_runs,
      module_progress,
      outbox_deliveries,
      outbox_events,
      password_reset_tokens,
      quiz_attempt_answers,
      quiz_attempts,
      reviews,
      sessions,
      staff_invitations,
      submission_versions,
      submissions,
      user_credentials,
      user_profiles,
      user_roles,
      users
      cascade`,
  );
}

beforeEach(async () => {
  db = getDb();
  await kosongkan();
});

afterAll(async () => {
  await tutupDb();
});

async function buatPrincipal(email: string, username: string): Promise<SessionPrincipal> {
  const hasil = await daftarPengguna({
    nama: `Uji ${username}`,
    username,
    email,
    password: "rahasia-panjang",
  });
  if (!hasil.ok) throw new Error("gagal buat user");
  return hasil.principal;
}

async function buatStaff(email: string, username: string): Promise<SessionPrincipal> {
  const principal = await buatPrincipal(email, username);
  const hasil = await beriRole({
    userId: principal.userId,
    role: "verifikator",
    grantedByUserId: null,
  });
  if (!hasil.ok) throw new Error("gagal beri role staff");
  return { ...principal, roles: ["verifikator"], role: "verifikator" };
}

/** Peserta yang sudah terdaftar pada `COURSE` — prasyarat pencatatan. */
async function pesertaTerdaftar(
  email: string,
  username: string,
  courseId = COURSE,
): Promise<SessionPrincipal> {
  const principal = await buatPrincipal(email, username);
  await daftarEnrollment({
    userId: principal.userId,
    courseId,
    slug: SLUG,
    title: "Kursus Uji",
  });
  return principal;
}

async function pencatatan(
  staff: SessionPrincipal,
  peserta: SessionPrincipal,
  kind: string,
  courseId = COURSE,
  bukti?: Record<string, unknown>,
) {
  return catatPelanggaranDb({
    principal: staff,
    userId: peserta.userId,
    courseId,
    kind,
    reason: "Bukti ditinjau dari rekaman sesi dan isi jawaban asesmen.",
    bukti,
  });
}

describe("pencatatan pelanggaran — snapshot dan constraint", () => {
  it("menyalin bobot dari katalog ke dalam baris", async () => {
    const staff = await buatStaff("staf@contoh.test", "staf");
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");

    const baris = await pencatatan(staff, peserta, "plagiarisme");
    expect(baris.penalty).toBe(20);
    expect(baris.kind).toBe("plagiarisme");

    // Bukti bahwa bobotnya benar-benar **tersimpan**, bukan dibaca ulang: nilai
    // di baris harus tetap ada meski katalog berubah. Yang diuji di sini adalah
    // keberadaan salinannya — katalog yang diubah adalah perubahan produk
    // tersendiri, jadi test ini hanya memastikan kolomnya berisi angka.
    const [dariDb] = await db
      .select()
      .from(integrityViolations)
      .where(eq(integrityViolations.id, baris.id));
    expect(dariDb?.penalty).toBe(20);
  });

  it("CHECK database menolak jenis yang tidak ada di katalog", async () => {
    // Lapisan validasi action bisa lolos karena typo atau jalur lain. Yang harus
    // menahan adalah constraint — test ini menyisipkan langsung lewat Drizzle,
    // melewati Zod dan service sama sekali.
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");
    const enrollment = (await listEnrollments(peserta.userId))[0]!;

    await expect(
      db.insert(integrityViolations).values({
        userId: peserta.userId,
        courseId: COURSE,
        enrollmentId: enrollment.id,
        kind: "maling",
        penalty: 5,
        reason: "menembak constraint",
      }),
    ).rejects.toThrow();
  });

  it("CHECK database menolak penalti non-positif", async () => {
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");
    const enrollment = (await listEnrollments(peserta.userId))[0]!;

    await expect(
      db.insert(integrityViolations).values({
        userId: peserta.userId,
        courseId: COURSE,
        enrollmentId: enrollment.id,
        kind: "plagiarisme",
        penalty: 0,
        reason: "penalti nol harus ditolak",
      }),
    ).rejects.toThrow();
  });

  it("CHECK database menolak status expunged tanpa waktu pemulihan", async () => {
    // Tanpa CHECK ini, "sudah dipulihkan" punya status yang benar tanpa jejak
    // kapan — dan expunge yang gagal di tengah jalan terlihat sama dengan yang
    // benar-benar selesai.
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");
    const enrollment = (await listEnrollments(peserta.userId))[0]!;

    await expect(
      db.insert(integrityViolations).values({
        userId: peserta.userId,
        courseId: COURSE,
        enrollmentId: enrollment.id,
        kind: "plagiarisme",
        penalty: 20,
        reason: "expunged tanpa waktu",
        status: "expunged",
      }),
    ).rejects.toThrow();
  });

  it("menyaring bukti sebelum insert", async () => {
    const staff = await buatStaff("staf@contoh.test", "staf");
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");

    const baris = await pencatatan(staff, peserta, "pola_salin_tempel", COURSE, {
      run_id: "11111111-1111-4111-8111-111111111111",
      token: "rahasia-yang-tidak-boleh-disimpan",
      event_count: 3,
    });
    expect(baris.evidenceRedacted).toEqual({
      run_id: "11111111-1111-4111-8111-111111111111",
      event_count: 3,
    });
    expect(JSON.stringify(baris.evidenceRedacted)).not.toContain("rahasia");
  });

  it("menulis audit dalam transaksi yang sama", async () => {
    const staff = await buatStaff("staf@contoh.test", "staf");
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");

    const baris = await pencatatan(staff, peserta, "meninggalkan_sesi");
    const audit = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.entityId, baris.id));
    expect(audit).toHaveLength(1);
    expect(audit[0]?.action).toBe("integrity_violation.recorded");
    expect(audit[0]?.actorUserId).toBe(staff.userId);
  });
});

describe("skor membaca hanya baris aktif", () => {
  it("menurun saat ada pelanggaran dan kembali saat dipulihkan", async () => {
    const staff = await buatStaff("staf@contoh.test", "staf");
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");

    expect((await skorIntegritasDb(peserta.userId)).skor).toBe(100);

    await pencatatan(staff, peserta, "meninggalkan_sesi");
    const menurun = await skorIntegritasDb(peserta.userId);
    expect(menurun.skor).toBe(95);
    expect(menurun.jumlahAktif).toBe(1);

    // Pemulihan otomatis, dengan waktu completion yang **setelah** pencatatan.
    const dipulihkan = await pulihkanPelanggaranSetelahUlang(
      peserta.userId,
      COURSE,
      new Date(Date.now() + 1000),
    );
    expect(dipulihkan).toBe(1);

    const kembali = await skorIntegritasDb(peserta.userId);
    expect(kembali.skor).toBe(100);
    expect(kembali.jumlahAktif).toBe(0);
    // Baris **tidak dihapus** — riwayat keputusan tetap bisa diaudit.
    expect(await listSemuaPelanggaran(peserta.userId)).toHaveLength(1);
  });

  it("tidak memulihkan pelanggaran yang dibuat setelah completion", async () => {
    // Inilah kasus yang hanya bisa dibuktikan dengan database: `course_completions`
    // unik per enrollment, jadi "mengulang" tidak menghasilkan baris baru. Tanpa
    // batas waktu, satu panggilan yang terjadi sebelum pencatatan akan menghapus
    // penalti tanpa ada mengulang — dan ini akan terlihat benar di UI.
    const staff = await buatStaff("staf@contoh.test", "staf");
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");

    const completionLama = new Date(Date.now() - 60_000);
    const jumlah = await pulihkanPelanggaranSetelahUlang(
      peserta.userId,
      COURSE,
      completionLama,
    );
    expect(jumlah).toBe(0);

    await pencatatan(staff, peserta, "plagiarisme");
    const skor = await skorIntegritasDb(peserta.userId);
    expect(skor.skor).toBe(80);
  });

  it("pulihkan hanya course yang diminta, bukan seluruh akun", async () => {
    const staff = await buatStaff("staf@contoh.test", "staf");
    // Satu akun dengan dua enrollment — inilah kasus yang membuat pemulihan
    // per-course menjadi tidak opsional: `pulihkanSemuaPelanggaranCourse` tanpa
    // filter `course_id` akan mengembalikan skor penuh setelah satu course tuntas.
    const peserta = await buatPrincipal("murid@contoh.test", "murid");
    for (const courseId of [COURSE, "crs-lain"]) {
      await daftarEnrollment({
        userId: peserta.userId,
        courseId,
        slug: SLUG,
        title: "Kursus Uji",
      });
    }

    await pencatatan(staff, peserta, "plagiarisme", COURSE);
    await pencatatan(staff, peserta, "plagiarisme", "crs-lain");

    await pulihkanPelanggaranSetelahUlang(
      peserta.userId,
      COURSE,
      new Date(Date.now() + 1000),
    );

    // Satu course kembali; penalti course lain masih memotong.
    expect((await skorIntegritasDb(peserta.userId)).skor).toBe(80);
  });
});

describe("tabel report per course", () => {
  it("menghasilkan satu baris per jenis katalog, termasuk yang nol", async () => {
    const staff = await buatStaff("staf@contoh.test", "staf");
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");
    await pencatatan(staff, peserta, "pola_salin_tempel");
    await pencatatan(staff, peserta, "pola_salin_tempel");

    const baris = await ringkasanPelanggaranCourseDb(peserta.userId, COURSE);
    expect(baris.map((b) => b.jenis)).toEqual([
      "meninggalkan_sesi",
      "pola_salin_tempel",
      "plagiarisme",
    ]);
    expect(baris.find((b) => b.jenis === "pola_salin_tempel")).toMatchObject({
      jumlah: 2,
      jumlahAktif: 2,
      jumlahDipulihkan: 0,
    });
    expect(baris.find((b) => b.jenis === "meninggalkan_sesi")?.jumlah).toBe(0);
  });

  it("menampilkan jumlah dipulihkan setelah pemulihan", async () => {
    const staff = await buatStaff("staf@contoh.test", "staf");
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");
    await pencatatan(staff, peserta, "meninggalkan_sesi");
    await pulihkanPelanggaranSetelahUlang(
      peserta.userId,
      COURSE,
      new Date(Date.now() + 1000),
    );

    const baris = await ringkasanPelanggaranCourseDb(peserta.userId, COURSE);
    expect(baris.find((b) => b.jenis === "meninggalkan_sesi")).toMatchObject({
      jumlah: 1,
      jumlahAktif: 0,
      jumlahDipulihkan: 1,
    });
  });

  it("tidak pernah membaca pelanggaran peserta lain di course yang sama", async () => {
    // Dua orang bisa terdaftar pada course yang sama. Tabel harus hanya
    // menampilkan milik peserta yang sedang masuk, kalau tidak halaman course
    // membocorkan catatan orang lain.
    const staff = await buatStaff("staf@contoh.test", "staf");
    const satu = await pesertaTerdaftar("satu@contoh.test", "satu");
    const dua = await pesertaTerdaftar("dua@contoh.test", "dua");

    await pencatatan(staff, satu, "plagiarisme");
    const barisDua = await ringkasanPelanggaranCourseDb(dua.userId, COURSE);
    expect(barisDua.every((b) => b.jumlah === 0)).toBe(true);
  });
});

describe("completion terverifikasi memulihkan, informal tidak", () => {
  it("rekamCompletion terverifikasi memulihkan pelanggaran yang lebih lama", async () => {
    // Alur yang dipakai peserta: menyelesaikan course lagi setelah dicatat ada
    // catatan. Yang memicu adalah `course_completions`, jadi test ini memakai
    // repository yang sama dengan service, bukan memanggil hook langsung.
    const staff = await buatStaff("staf@contoh.test", "staf");
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");
    await pencatatan(staff, peserta, "pola_salin_tempel");

    const enrollment = (await listEnrollments(peserta.userId))[0]!;
    const { completion } = await rekamCompletion({
      userId: peserta.userId,
      courseId: COURSE,
      enrollmentId: enrollment.id,
      completionPath: "terverifikasi",
      policyVersion: 1,
    });

    // Ini yang dilakukan `selesaikanKursusDb` setelah completion terekam.
    await pulihkanPelanggaranSetelahUlang(peserta.userId, COURSE, completion.completedAt);
    expect((await skorIntegritasDb(peserta.userId)).skor).toBe(100);
  });

  it("penalti dari dua course dijumlahkan, bukan dijepit jadi satu", async () => {
    // Dua course, masing-masing satu pelanggaran sedang (10): totalnya 20, bukan
    // 10. Batas per course hanya menahan penalti **dalam** satu course — kalau
    // penjepitan ada di total, batas itu sebenarnya hanya membatasi seluruh akun.
    const staff = await buatStaff("staf@contoh.test", "staf");
    const peserta = await buatPrincipal("murid@contoh.test", "murid");
    for (const courseId of [COURSE, "crs-tiga"]) {
      await daftarEnrollment({
        userId: peserta.userId,
        courseId,
        slug: SLUG,
        title: "Kursus Uji",
      });
    }

    await pencatatan(staff, peserta, "pola_salin_tempel", COURSE);
    await pencatatan(staff, peserta, "pola_salin_tempel", "crs-tiga");

    const hasil = hitungSkorIntegritas(
      (await listSemuaPelanggaran(peserta.userId)).map((b) => ({
        id: b.id,
        courseId: b.courseId,
        penalty: b.penalty,
        status: b.status as "active" | "expunged",
      })),
    );
    expect(hasil.penaltiTotal).toBe(20);
    expect(hasil.skor).toBe(80);
    expect(hasil.perCourse).toHaveLength(2);
  });
});

describe("kepemilikan", () => {
  it("enrollment yang dihapus tidak menghapus catatan", async () => {
    // `enrollment_id` `set null` supaya skor tidak turun sendiri karena bukti yang
    // hilang — dan peserta tidak punya cara memulihkannya.
    const staff = await buatStaff("staf@contoh.test", "staf");
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");
    const baris = await pencatatan(staff, peserta, "plagiarisme");

    const enrollment = (await listEnrollments(peserta.userId))[0]!;
    await db.delete(enrollments).where(eq(enrollments.id, enrollment.id));

    const [tersisa] = await db
      .select()
      .from(integrityViolations)
      .where(eq(integrityViolations.id, baris.id));
    expect(tersisa?.enrollmentId).toBeNull();
    expect((await skorIntegritasDb(peserta.userId)).skor).toBe(80);
  });
});

/**
 * Sisipkan pelanggaran dengan `created_at` yang bisa dikendalikan.
 *
 * Berada di luar `describe` karena dipakai dua blok: satu yang menguji pembekuan
 * skor sertifikat, satu lagi yang menguji tahapannya.
 *
 * `reviewer_user_id` wajib untuk `active`: CHECK database menuntutnya, dan itu
 * yang membuat "hanya manusia yang bisa memotong skor" jadi properti struktural,
 * bukan konvensi. Helper ini memakai staf sungguhan — bukan karena skor butuh
 * staf, tapi karena baris `active` tanpa reviewer memang tidak boleh bisa ada.
 */
async function sisip(
  peserta: SessionPrincipal,
  kind: string,
  penalty: number,
  createdAt: Date,
  status: "active" | "expunged" | "proposed" | "dismissed" = "active",
  reviewerUserId: string | null = null,
  courseId = COURSE,
) {
  const enrollment = (await listEnrollments(peserta.userId))[0]!;
  await db.insert(integrityViolations).values({
    userId: peserta.userId,
    courseId,
    enrollmentId: enrollment.id,
    kind,
    penalty,
    reason: "Catatan uji dengan waktu terkendali.",
    reviewerUserId,
    status,
    createdAt,
    expungedAt: status === "expunged" ? createdAt : null,
    decidedAt: status === "active" || status === "dismissed" ? createdAt : null,
  });
}

describe("integritas sertifikat — dibekukan pada saat terbit", () => {

  it("skor saat terbit tidak berubah oleh pelanggaran setelahnya", async () => {
    // Inilah alasan `integritasSertifikatDb` ada. Kalau sertifikat membaca skor
    // **hari ini**, dokumen 2026 yang sudah ditandatangani akan berubah angkanya
    // setelah pelanggaran 2027 — dan dokumen yang isinya bergerak tidak bisa
    // diverifikasi siapa pun.
    const staff = await buatStaff("staf@contoh.test", "staf");
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");

    const terbit = new Date(Date.now() - 10_000);
    await sisip(
      peserta,
      "meninggalkan_sesi",
      5,
      new Date(Date.now() - 20_000),
      "active",
      staff.userId,
    );

    const saatTerbit = await integritasSertifikatDb(peserta.userId, terbit);
    expect(saatTerbit.skorSaatTerbit).toBe(95);

    // Pelanggaran **sesudah** terbit: tidak boleh menyentuh angka saat terbit.
    await sisip(peserta, "plagiarisme", 20, new Date(Date.now() - 1_000), "active", staff.userId);

    const sesudah = await integritasSertifikatDb(peserta.userId, terbit);
    expect(sesudah.skorSaatTerbit).toBe(95);
    // Tapi "sekarang" bergerak — dan itu memang harus terlihat. Penalti dijepit
    // per course (`BATAS_PENALTI_PER_COURSE = 20`), jadi 5 + 20 → 20, bukan 25.
    expect(sesudah.skorSekarang).toBe(80);
  });

  it("rincian per jenis hanya menghitung baris sampai saat terbit", async () => {
    const staff = await buatStaff("staf@contoh.test", "staf");
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");
    const terbit = new Date(Date.now() - 10_000);

    await sisip(peserta, "pola_salin_tempel", 10, new Date(Date.now() - 20_000), "active", staff.userId);
    await sisip(peserta, "pola_salin_tempel", 10, new Date(Date.now() - 5_000), "active", staff.userId); // sesudah terbit
    await sisip(peserta, "meninggalkan_sesi", 5, new Date(Date.now() - 30_000), "active", staff.userId);

    const hasil = await integritasSertifikatDb(peserta.userId, terbit);
    const perJenis = new Map(hasil.perJenis.map((b) => [b.jenis, b.jumlah]));
    expect(perJenis.get("pola_salin_tempel")).toBe(1);
    expect(perJenis.get("meninggalkan_sesi")).toBe(1);
  });

  it("katalog ditampilkan utuh, termasuk jenis yang nol", async () => {
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");
    const hasil = await integritasSertifikatDb(peserta.userId, new Date());

    expect(hasil.perJenis.map((b) => b.jenis).sort()).toEqual(
      ["meninggalkan_sesi", "plagiarisme", "pola_salin_tempel"].sort(),
    );
    expect(hasil.perJenis.every((b) => b.jumlah === 0)).toBe(true);
    expect(hasil.perJenis.every((b) => b.label.length > 0)).toBe(true);
    expect(hasil.skorSaatTerbit).toBe(100);
  });

  it("baris expunged tidak pernah masuk hitungan saat terbit", async () => {
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");
    const terbit = new Date(Date.now() - 10_000);
    await sisip(
      peserta,
      "meninggalkan_sesi",
      5,
      new Date(Date.now() - 20_000),
      "expunged",
    );

    const hasil = await integritasSertifikatDb(peserta.userId, terbit);
    expect(hasil.skorSaatTerbit).toBe(100);
    expect(hasil.jumlahAktifSaatTerbit).toBe(0);
  });

  /**
   * Dua cakupan yang berbeda, dan salah satunya mudah tertukar.
   *
   * Sertifikat menyebut **satu** course, jadi baris rinciannya harus menyebut
   * catatan course itu: tanpa penyaringan, sertifikat "Keamanan Aplikasi" bisa
   * menampilkan catatan dari course UI/UX dan terbaca seolah pelanggarannya
   * terjadi di course yang disertifikasi — tuduhan yang salah tempat, dicetak
   * di dokumen yang dilihat perusahaan.
   *
   * Skornya justru **tidak** boleh ikut dipotong. Skor kejujuran adalah
   * properti akun: `hitungSkorIntegritas` menjepit penalti per course lalu
   * menjumlahkannya, jadi memfilter input ke satu course menghasilkan angka
   * yang berbeda dari "skor kejujuran akun ini" — dan dua sertifikat untuk akun
   * yang sama akan menyebut angka yang berbeda.
   */
  describe("cakupan perJenis vs cakupan skor", () => {
    const COURSE_LAIN = "crs-uji-lain";

    it("perJenis hanya menghitung course yang diminta", async () => {
      const staff = await buatStaff("staf@contoh.test", "staf");
      const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");
      const terbit = new Date(Date.now() - 1_000);

      // Dua course berbeda, keduanya sebelum terbit.
      await sisip(peserta, "pola_salin_tempel", 10, new Date(Date.now() - 20_000), "active", staff.userId, COURSE);
      await sisip(peserta, "meninggalkan_sesi", 5, new Date(Date.now() - 20_000), "active", staff.userId, COURSE_LAIN);

      const hasil = await integritasSertifikatDb(peserta.userId, terbit, COURSE);
      const perJenis = new Map(hasil.perJenis.map((b) => [b.jenis, b.jumlah]));

      expect(perJenis.get("pola_salin_tempel")).toBe(1);
      // Catatan course lain tidak boleh muncul di sertifikat course ini.
      expect(perJenis.get("meninggalkan_sesi")).toBe(0);
    });

    it("skor tetap mencakup seluruh akun, bukan hanya course yang diminta", async () => {
      const staff = await buatStaff("staf@contoh.test", "staf");
      const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");
      const terbit = new Date(Date.now() - 1_000);

      await sisip(peserta, "pola_salin_tempel", 10, new Date(Date.now() - 20_000), "active", staff.userId, COURSE);
      await sisip(peserta, "meninggalkan_sesi", 5, new Date(Date.now() - 20_000), "active", staff.userId, COURSE_LAIN);

      const hasil = await integritasSertifikatDb(peserta.userId, terbit, COURSE);

      // 10 (course ini) + 5 (course lain) = 15, dijepit per course lalu dijumlah.
      // Kalau skor ikut dipotong ke COURSE, angkanya akan 90 — dan itulah yang
      // tidak boleh terjadi.
      expect(hasil.skorSaatTerbit).toBe(85);
      expect(hasil.jumlahAktifSaatTerbit).toBe(2);
    });

    it("penalti dipecah per cakupan dan menjumlah ke skor", async () => {
      const staff = await buatStaff("staf@contoh.test", "staf");
      const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");
      const terbit = new Date(Date.now() - 1_000);

      // Course ini: 10 + 20 = 30 mentah → dijepit ke 20. Course lain: 5.
      await sisip(peserta, "pola_salin_tempel", 10, new Date(Date.now() - 20_000), "active", staff.userId, COURSE);
      await sisip(peserta, "plagiarisme", 20, new Date(Date.now() - 20_000), "active", staff.userId, COURSE);
      await sisip(peserta, "meninggalkan_sesi", 5, new Date(Date.now() - 20_000), "active", staff.userId, COURSE_LAIN);

      const hasil = await integritasSertifikatDb(peserta.userId, terbit, COURSE);

      expect(hasil.penaltiCourseIni).toBe(20);
      expect(hasil.penaltiCourseLain).toBe(5);
      // Identitas yang membuat panel bisa direkonsiliasi pembaca.
      expect(hasil.skorSaatTerbit).toBe(100 - hasil.penaltiCourseIni - hasil.penaltiCourseLain);
      expect(hasil.skorSaatTerbit).toBe(75);
    });

    it("penalti course ini tidak melebihi batas 20 meski banyak catatan", async () => {
      const staff = await buatStaff("staf@contoh.test", "staf");
      const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");
      const terbit = new Date(Date.now() - 1_000);

      for (let i = 0; i < 4; i += 1) {
        await sisip(peserta, "pola_salin_tempel", 10, new Date(Date.now() - 20_000), "active", staff.userId, COURSE);
      }

      const hasil = await integritasSertifikatDb(peserta.userId, terbit, COURSE);
      // 4 × 10 = 40 mentah, tapi batas per course menahannya di 20.
      expect(hasil.penaltiCourseIni).toBe(20);
      expect(hasil.skorSaatTerbit).toBe(80);
    });

    it("penalti dihitung sampai saat terbit, bukan sampai sekarang", async () => {
      const staff = await buatStaff("staf@contoh.test", "staf");
      const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");
      const terbit = new Date(Date.now() - 10_000);

      await sisip(peserta, "pola_salin_tempel", 10, new Date(Date.now() - 20_000), "active", staff.userId, COURSE);
      // Setelah terbit: tidak boleh masuk rekap "saat terbit".
      await sisip(peserta, "plagiarisme", 20, new Date(Date.now() - 1_000), "active", staff.userId, COURSE);

      const hasil = await integritasSertifikatDb(peserta.userId, terbit, COURSE);
      expect(hasil.penaltiCourseIni).toBe(10);
      expect(hasil.skorSaatTerbit).toBe(90);
      // "Sekarang" tetap bergerak — dan memang harus.
      expect(hasil.skorSekarang).toBe(80);
    });

    it("tanpa courseId, semua course dihitung (perilaku lama dipertahankan)", async () => {
      const staff = await buatStaff("staf@contoh.test", "staf");
      const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");
      const terbit = new Date(Date.now() - 1_000);

      await sisip(peserta, "pola_salin_tempel", 10, new Date(Date.now() - 20_000), "active", staff.userId, COURSE);
      await sisip(peserta, "meninggalkan_sesi", 5, new Date(Date.now() - 20_000), "active", staff.userId, COURSE_LAIN);

      const hasil = await integritasSertifikatDb(peserta.userId, terbit);
      const perJenis = new Map(hasil.perJenis.map((b) => [b.jenis, b.jumlah]));

      expect(perJenis.get("pola_salin_tempel")).toBe(1);
      expect(perJenis.get("meninggalkan_sesi")).toBe(1);
    });

    it("batas waktu tetap berlaku di dalam course yang diminta", async () => {
      const staff = await buatStaff("staf@contoh.test", "staf");
      const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");
      const terbit = new Date(Date.now() - 10_000);

      await sisip(peserta, "pola_salin_tempel", 10, new Date(Date.now() - 20_000), "active", staff.userId, COURSE);
      // Sesudah terbit, course yang sama: tidak boleh ikut.
      await sisip(peserta, "pola_salin_tempel", 10, new Date(Date.now() - 5_000), "active", staff.userId, COURSE);

      const hasil = await integritasSertifikatDb(peserta.userId, terbit, COURSE);
      const perJenis = new Map(hasil.perJenis.map((b) => [b.jenis, b.jumlah]));

      expect(perJenis.get("pola_salin_tempel")).toBe(1);
    });
  });
});

/**
 * Model dua tahap: **usulan otomatis tidak pernah memotong skor.**
 *
 * Ini aturan paling keselamatan dari seluruh perubahan, jadi diuji terhadap
 * database sungguhan — bukan terhadap `hitungSkorIntegritas` murni. Yang berbahaya
 * bukan aritmatikanya, melainkan baris `proposed` yang entah bagaimana berhasil
 * ikut dibaca jalur skor: seluruh sinyalnya dilaporkan peramban, jadi kalau Stage 1
 * boleh memotong skor, mematikan JavaScript menaikkan skor sendiri.
 */
describe("Stage 1 → Stage 2 — hanya manusia yang memotong skor", () => {
  function kejadian(jenis: Parameters<typeof usulkanPelanggaranDb>[0]["kejadian"][number]["jenis"], detail?: string) {
    return {
      at: "2026-10-03T00:00:00.000Z",
      jenis,
      jenis_klasifikasi: "kejadian" as const,
      visibilitas: "visible" as const,
      ...(detail ? { detail } : {}),
    };
  }

  /** Sesi dengan cukup sinyal untuk memicu dua jenis usulan. */
  const SESI_BERISIK = [
    kejadian("paste_massal", "400 karakter"),
    kejadian("pindah_tab"),
    kejadian("pindah_tab"),
    kejadian("pindah_tab"),
  ];

  it("usulan otomatis tidak memotong skor", async () => {
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");

    const usulan = await usulkanPelanggaranDb({
      userId: peserta.userId,
      courseId: COURSE,
      kejadian: SESI_BERISIK,
      runId: "11111111-1111-4111-8111-111111111111",
    });

    // Baris database memakai `kind`, bukan `jenis` — `jenis` adalah istilah
    // katalog di lapisan TypeScript, `kind` yang nama kolomnya.
    expect(usulan.map((u) => u.kind).sort()).toEqual([
      "meninggalkan_sesi",
      "pola_salin_tempel",
    ]);
    expect(usulan.every((u) => u.status === "proposed")).toBe(true);
    // `reviewer_user_id` null: belum ada manusia yang memutuskan.
    expect(usulan.every((u) => u.reviewerUserId === null)).toBe(true);

    // **Inilah inti test ini.** Skor tetap 100.
    expect((await skorIntegritasDb(peserta.userId)).skor).toBe(100);
  });

  it("CHECK menolak `active` tanpa reviewer — struktur, bukan konvensi", async () => {
    // Kalau batasan ini hanya konvensi di kode pemanggil, Stage 1 bisa menulis
    // `active` dan skornya bergerak tanpa manusia pernah melihat. Yang menahan
    // harus database.
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");

    // Sisip langsung lewat Drizzle, melewati service sama sekali: yang harus
    // menolak adalah constraint, bukan validasi di pemanggil.
    await expect(
      sisip(peserta, "plagiarisme", 20, new Date(), "active", null),
    ).rejects.toThrow();

    // Bukti konsekuensinya: tidak ada yang masuk, jadi skor tidak bergerak.
    expect(await listSemuaPelanggaran(peserta.userId)).toHaveLength(0);
    expect((await skorIntegritasDb(peserta.userId)).skor).toBe(100);
  });

  it("CHECK menolak `dismissed` tanpa reviewer", async () => {
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");
    const enrollment = (await listEnrollments(peserta.userId))[0]!;
    await expect(
      db.insert(integrityViolations).values({
        userId: peserta.userId,
        courseId: COURSE,
        enrollmentId: enrollment.id,
        kind: "plagiarisme",
        penalty: 20,
        reason: "Ditolak tanpa reviewer.",
        status: "dismissed",
      }),
    ).rejects.toThrow();
  });

  it("CHECK menolak `proposed` yang sudah punya reviewer", async () => {
    // Sebaliknya: usulan adalah territory sistem. Kalau `reviewer_user_id` sudah
    // terisi saat masih `proposed`, seseorang sudah "memutuskan" sebelum ada
    // keputusan — dan antriannya tidak bisa dipercaya.
    const staff = await buatStaff("staf@contoh.test", "staf");
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");
    const enrollment = (await listEnrollments(peserta.userId))[0]!;
    await expect(
      db.insert(integrityViolations).values({
        userId: peserta.userId,
        courseId: COURSE,
        enrollmentId: enrollment.id,
        kind: "pola_salin_tempel",
        penalty: 10,
        reason: "Usulan dengan reviewer.",
        status: "proposed",
        reviewerUserId: staff.userId,
      }),
    ).rejects.toThrow();
  });

  it("CHECK menolak status yang tidak dikenal", async () => {
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");
    const enrollment = (await listEnrollments(peserta.userId))[0]!;
    await expect(
      db.insert(integrityViolations).values({
        userId: peserta.userId,
        courseId: COURSE,
        enrollmentId: enrollment.id,
        kind: "plagiarisme",
        penalty: 20,
        reason: "Status karangan.",
        status: "mungkin_ada_masalahnya",
      }),
    ).rejects.toThrow();
  });

  it("konfirmasi memindahkan skor; penolakan tidak", async () => {
    const staff = await buatStaff("staf@contoh.test", "staf");
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");

    // Satu sesi yang hanya memicu `pola_salin_tempel`.
    const usulan = await usulkanPelanggaranDb({
      userId: peserta.userId,
      courseId: COURSE,
      kejadian: [kejadian("paste_massal", "400 karakter")],
    });
    const satu = usulan[0]!;
    expect(satu.kind).toBe("pola_salin_tempel");

    // Ditolak → skor tidak bergerak.
    const ditolak = await tolakUsulanDb({
      principal: staff,
      id: satu.id,
      alasan: "Tempelannya adalah catatan miliknya sendiri, terlihat dari konteks.",
    });
    expect(ditolak?.status).toBe("dismissed");
    expect((await skorIntegritasDb(peserta.userId)).skor).toBe(100);
  });

  it("proposed → active memotong skor sebesar bobot yang mengusulkan", async () => {
    const staff = await buatStaff("staf@contoh.test", "staf");
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");

    const usulan = await usulkanPelanggaranDb({
      userId: peserta.userId,
      courseId: COURSE,
      kejadian: [kejadian("paste_massal", "400 karakter")],
    });
    const satu = usulan[0]!;

    const disetujui = await putuskanUsulanDb({ principal: staff, id: satu.id });
    expect(disetujui?.status).toBe("active");
    expect(disetujui?.reviewerUserId).toBe(staff.userId);
    expect(disetujui?.decidedAt).not.toBeNull();

    const skor = await skorIntegritasDb(peserta.userId);
    expect(skor.skor).toBe(90);
    expect(skor.jumlahAktif).toBe(1);
  });

  it("hanya satu dari dua keputusan paralel yang berlaku", async () => {
    // Dua verifikator menekan tombol bersamaan. Kalau keduanya berhasil, satu
    // usulan jadi dua penalti — dan compare-and-set di repository adalah yang
    // mencegah itu.
    const staffA = await buatStaff("staf-a@contoh.test", "staf-a");
    const staffB = await buatStaff("staf-b@contoh.test", "staf-b");
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");

    const usulan = await usulkanPelanggaranDb({
      userId: peserta.userId,
      courseId: COURSE,
      kejadian: [kejadian("paste_massal", "400 karakter")],
    });
    const satu = usulan[0]!;

    const [a, b] = await Promise.all([
      putuskanUsulanDb({ principal: staffA, id: satu.id }),
      putuskanUsulanDb({ principal: staffB, id: satu.id }),
    ]);
    const berhasil = [a, b].filter(Boolean);
    expect(berhasil).toHaveLength(1);

    const skor = await skorIntegritasDb(peserta.userId);
    expect(skor.skor).toBe(90);
    expect(skor.jumlahAktif).toBe(1);
  });

  it("usulan yang sama tidak ditulis dua kali untuk sesi yang sama", async () => {
    // Sesi bisa berakhir lebih dari sekali (retry, reconnect). Tanpa penjaga,
    // antrian akan berisi salinan yang sama beberapa kali dan staf memutuskan
    // hal yang sama berulang.
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");
    const masuk = {
      userId: peserta.userId,
      courseId: COURSE,
      kejadian: SESI_BERISIK,
      runId: "11111111-1111-4111-8111-111111111111",
    };

    const pertama = await usulkanPelanggaranDb(masuk);
    const kedua = await usulkanPelanggaranDb(masuk);
    const ketiga = await usulkanPelanggaranDb(masuk);

    expect(pertama).toHaveLength(2);
    expect(kedua).toHaveLength(0);
    expect(ketiga).toHaveLength(0);
    expect(await listSemuaPelanggaran(peserta.userId)).toHaveLength(2);
  });

  it("antrian hanya memuat yang belum diputuskan", async () => {
    const staff = await buatStaff("staf@contoh.test", "staf");
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");

    const usulan = await usulkanPelanggaranDb({
      userId: peserta.userId,
      courseId: COURSE,
      kejadian: SESI_BERISIK,
    });
    expect(await antrianUsulanDb(peserta.userId)).toHaveLength(2);

    await putuskanUsulanDb({ principal: staff, id: usulan[0]!.id });
    await tolakUsulanDb({
      principal: staff,
      id: usulan[1]!.id,
      alasan: "Sudah dikonfirmasi di tempat lain.",
    });

    // Setelah keduanya diputuskan, antrian kosong — bukan "3 baris" atau
    // "1 baris", karena hanya `proposed` yang masih menunggu apa pun.
    expect(await antrianUsulanDb(peserta.userId)).toHaveLength(0);
  });

  it("Stage 1 tidak melempar saat pencatatan gagal", async () => {
    // Session end bukan tempat gagal: sesi harus tetap selesai dicatat, dan
    // verifikasi harus tetap berjalan.
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");
    const hasil = await usulkanPelanggaranDb({
      userId: peserta.userId,
      courseId: "",
      kejadian: SESI_BERISIK,
    });
    expect(hasil).toEqual([]);
  });

  it("Stage 2 menolak pemanggil tanpa role staf", async () => {
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");
    const usulan = await usulkanPelanggaranDb({
      userId: peserta.userId,
      courseId: COURSE,
      kejadian: [kejadian("paste_massal", "400 karakter")],
    });

    // Peserta itu sendiri tidak bisa menyetujui atentosnya sendiri.
    await expect(
      putuskanUsulanDb({ principal: peserta, id: usulan[0]!.id }),
    ).rejects.toMatchObject({ kode: "akses_ditolak" });
    await expect(
      tolakUsulanDb({ principal: peserta, id: usulan[0]!.id, alasan: "saya sendiri" }),
    ).rejects.toMatchObject({ kode: "akses_ditolak" });
  });

  it("tabel report memisahkan usulan yang belum diputuskan", async () => {
    // `jumlahAktif` harus berarti "sudah diputuskan dan berlaku". Kalau usulan
    // ikut di sana, tabel menampilkan usulan yang belum dilihat staf seolah sudah
    // memotong skor.
    const staff = await buatStaff("staf@contoh.test", "staf");
    const peserta = await pesertaTerdaftar("murid@contoh.test", "murid");

    await usulkanPelanggaranDb({
      userId: peserta.userId,
      courseId: COURSE,
      kejadian: SESI_BERISIK,
    });
    await sisip(peserta, "plagiarisme", 20, new Date(), "active", staff.userId);

    const baris = await ringkasanPelanggaranCourseDb(peserta.userId, COURSE);
    const paste = baris.find((b) => b.jenis === "pola_salin_tempel")!;
    const plag = baris.find((b) => b.jenis === "plagiarisme")!;

    expect(paste.jumlah).toBe(1);
    expect(paste.jumlahBelumPutus).toBe(1);
    expect(paste.jumlahAktif).toBe(0);
    expect(paste.jumlahDipulihkan).toBe(0);
    expect(paste.jumlahDitolak).toBe(0);

    expect(plag.jumlahAktif).toBe(1);
    expect(plag.jumlahBelumPutus).toBe(0);
  });
});

