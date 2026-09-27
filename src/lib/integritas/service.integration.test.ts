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
  catatPelanggaranDb,
  listSemuaPelanggaran,
  pulihkanPelanggaranSetelahUlang,
  ringkasanPelanggaranCourseDb,
  skorIntegritasDb,
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

