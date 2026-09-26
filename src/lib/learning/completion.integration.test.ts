/**
 * Test integrasi policy completion — **butuh PostgreSQL** (`npm run test:db`).
 *
 * Menutup acceptance criteria plan §7 yang tidak bisa dibuktikan test unit:
 *
 * 1. **Dua request completion paralel tidak double completion.** `rekamCompletion`
 *    unik pada `enrollment_id`, jadi dua panggilan `selesaikanKursusDb` bersamaan
 *    menghasilkan tepat satu baris `course_completions` dan satu update
 *    `enrollments.status = completed`.
 * 2. **Progress konsisten lintas "perangkat"** — di database berarti dua principal
 *    berbeda tidak saling melihat progres; enrollment unik per `(user_id,
 *    course_id)` dan `tandaiModulDb` tidak pernah menulis ke enrollment milik
 *    orang lain.
 * 3. **Completion path diturunkan server-side.** Semua modul terverifikasi →
 *    `terverifikasi`; satu saja informal → `informal`; belum tuntas → tidak ada
 *    completion.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";

import { getDb, tutupDb, type KoneksiDb } from "@/lib/db/client";
import { courseCompletions, enrollments } from "@/lib/db/schema";
import { daftarPengguna } from "@/lib/auth/auth-service";
import type { SessionPrincipal } from "@/lib/auth/principal";
import { daftarEnrollment } from "@/lib/learning/repository";
import {
  selesaikanKursusDb,
  tandaiModulDb,
  type HasilSelesaikan,
} from "@/lib/learning/service";

let db: KoneksiDb = getDb();

async function kosongkan() {
  await db.execute(
    sql`truncate table
      outbox_events,
      audit_events,
      email_verification_tokens,
      password_reset_tokens,
      sessions,
      staff_invitations,
      user_credentials,
      user_profiles,
      user_roles,
      users,
      courses,
      enrollments,
      module_progress,
      learning_runs,
      learning_events,
      quiz_attempts,
      quiz_attempt_answers,
      course_completions
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

/**
 * Kursus uji dengan kurikulum turunan `modulKursus` (5 modul, id `crs-…-m1…m5`).
 * `modulUntuk` butuh kursus di store JSON; test ini memakai id `crs-1` yang ada
 * di fixture `resources`/katalog dan di-`iris` oleh `modulUntuk` lewat fallback
 * turunan. Agar deterministik, kita daftarkan enrollment dengan `courseId` yang
 * benar-benar bisa di-resolve ke modul turunan. `crs-1` ada di `resources.json`.
 */
const COURSE_ID = "crs-1";

async function daftar(principal: SessionPrincipal) {
  return daftarEnrollment({
    userId: principal.userId,
    courseId: COURSE_ID,
    slug: "fullstack-web-development-nextjs-15-react-19",
    title: "Belajar HTML & CSS dari Nol",
  });
}

describe("selesaikanKursusDb — double completion paralel", () => {
  it("dua request paralel menghasilkan satu completion dan satu baris", async () => {
    const principal = await buatPrincipal("paralel@contoh.test", "paralel");
    const { enrollment } = await daftar(principal);

    // Tandai seluruh modul turunan selesai (resolver menurunkan 5 modul).
    const modulIds = [`${COURSE_ID}-m1`, `${COURSE_ID}-m2`, `${COURSE_ID}-m3`, `${COURSE_ID}-m4`, `${COURSE_ID}-m5`];
    for (const moduleId of modulIds) {
      const hasil = await tandaiModulDb({
        principal,
        courseId: COURSE_ID,
        modulId: moduleId,
        sumber: "terverifikasi",
        nama: principal.nama,
      });
      expect(hasil.ok).toBe(true);
    }

    const policyVersion = 1;
    const [a, b] = await Promise.all([
      selesaikanKursusDb({ principal, courseId: COURSE_ID, policyVersion }),
      selesaikanKursusDb({ principal, courseId: COURSE_ID, policyVersion }),
    ]);

    const selesai = [a, b].filter((h): h is Extract<HasilSelesaikan, { selesai: true }> => h.selesai);
    expect(selesai).toHaveLength(2);
    // Satu menang sebagai baru, satunya melihat baris yang sudah ada.
    expect(selesai.filter((s) => s.baru)).toHaveLength(1);
    expect(selesai[0]?.completion.enrollmentId).toBe(enrollment.id);
    expect(selesai[1]?.completion.enrollmentId).toBe(enrollment.id);

    const count = await db
      .select()
      .from(courseCompletions)
      .where(eq(courseCompletions.enrollmentId, enrollment.id));
    expect(count).toHaveLength(1);
    expect(count[0]?.completionPath).toBe("terverifikasi");

    const [enr] = await db.select().from(enrollments).where(eq(enrollments.id, enrollment.id));
    expect(enr?.status).toBe("completed");
  });
});

describe("selesaikanKursusDb — path turunan server-side", () => {
  it("semua terverifikasi -> terverifikasi", async () => {
    const principal = await buatPrincipal("verified@contoh.test", "verified");
    const { enrollment } = await daftar(principal);

    const modulIds = [`${COURSE_ID}-m1`, `${COURSE_ID}-m2`, `${COURSE_ID}-m3`, `${COURSE_ID}-m4`, `${COURSE_ID}-m5`];
    for (const moduleId of modulIds) {
      await tandaiModulDb({ principal, courseId: COURSE_ID, modulId: moduleId, sumber: "terverifikasi", nama: principal.nama });
    }

    const hasil = await selesaikanKursusDb({ principal, courseId: COURSE_ID, policyVersion: 1 });
    expect(hasil.selesai).toBe(true);
    if (hasil.selesai) expect(hasil.completion.completionPath).toBe("terverifikasi");
  });

  it("satu informal -> informal", async () => {
    const principal = await buatPrincipal("informal@contoh.test", "informal");
    await daftar(principal);

    const modulIds = [`${COURSE_ID}-m1`, `${COURSE_ID}-m2`, `${COURSE_ID}-m3`, `${COURSE_ID}-m4`, `${COURSE_ID}-m5`];
    for (let i = 0; i < modulIds.length; i++) {
      await tandaiModulDb({
        principal,
        courseId: COURSE_ID,
        modulId: modulIds[i],
        sumber: i === 0 ? "informal" : "terverifikasi",
        nama: principal.nama,
      });
    }

    const hasil = await selesaikanKursusDb({ principal, courseId: COURSE_ID, policyVersion: 1 });
    expect(hasil.selesai).toBe(true);
    if (hasil.selesai) expect(hasil.completion.completionPath).toBe("informal");
  });

  it("belum semua modul selesai -> tidak ada completion", async () => {
    const principal = await buatPrincipal("belum@contoh.test", "belum");
    await daftar(principal);

    await tandaiModulDb({ principal, courseId: COURSE_ID, modulId: `${COURSE_ID}-m1`, sumber: "terverifikasi", nama: principal.nama });

    const hasil = await selesaikanKursusDb({ principal, courseId: COURSE_ID, policyVersion: 1 });
    expect(hasil.selesai).toBe(false);
    if (!hasil.selesai) {
      expect(hasil.selesaiCount).toBe(1);
      expect(hasil.total).toBe(5);
    }
  });
});

describe("isolasi lintas user", () => {
  it("enrollment dan progres dua user tidak saling bocor", async () => {
    const a = await buatPrincipal("aaa@contoh.test", "aaa");
    const b = await buatPrincipal("bbb@contoh.test", "bbb");

    const enrA = await daftar(a);
    const enrB = await daftar(b);
    expect(enrA.enrollment.id).not.toBe(enrB.enrollment.id);

    await tandaiModulDb({ principal: a, courseId: COURSE_ID, modulId: `${COURSE_ID}-m1`, sumber: "terverifikasi", nama: a.nama });

    // Principal B tidak bisa menandai modul pada enrollment A (enrollment B punya id berbeda).
    const hasilB = await selesaikanKursusDb({ principal: b, courseId: COURSE_ID, policyVersion: 1 });
    expect(hasilB.selesai).toBe(false);
    if (!hasilB.selesai) expect(hasilB.selesaiCount).toBe(0);
  });
});
