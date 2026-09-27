/**
 * Test integrasi application service learning run — **butuh PostgreSQL**
 * (`npm run test:db`).
 *
 * Berkas ini membuktikan properti yang tidak bisa dibuktikan test unit, karena
 * semuanya ditegakkan database:
 *
 * 1. **Satu run aktif per (user, course).** `mulaiRunDb` dua kali harus
 *    mengembalikan run yang sama, bukan membuat run kedua — sifat ini dijamin
 *    query terindeks `ambilRunAktif`, bukan scan direktori.
 * 2. **Kedaluwarsa gagal-tertutup.** Run yang `expiresAt`-nya sudah lewat
 *    ditolak `buktikanSesiDb` **dan** ditutup (`expired`), sehingga tidak
 *    menghalangi run berikutnya. Nilai waktu yang tidak bisa dibaca juga
 *    dihitung kedaluwarsa.
 * 3. **Sequence anti-replay tidak bisa dilompati.** Tiga kejadian berturut-turut
 *    mendapat sequence 1, 2, 3; menyisipkan sequence yang sama ditolak unique
 *    `(learning_run_id, sequence)`; dan run `completed`/`expired` menolak
 *    kejadian baru (`null`) — menyisipkan setelah fakta akan mengubah bukti.
 * 4. **Kepemilikan.** `catatKejadianDb`/`akhiriRunDb` menolak run milik user
 *    lain, dan `jenis` di luar `JENIS_KEJADIAN_SAH` ditolak sebelum menyentuh
 *    database.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";

import { getDb, tutupDb, type KoneksiDb } from "@/lib/db/client";
import { learningEvents, integrityViolations, learningRuns } from "@/lib/db/schema";
import { daftarPengguna } from "@/lib/auth/auth-service";
import type { SessionPrincipal } from "@/lib/auth/principal";
import type { KJenisKejadian } from "@/lib/learning/akses";
import {
  catatKejadianRun,
  daftarEnrollment,
  listEventRun,
} from "@/lib/learning/repository";
import { buktiBaru } from "@/lib/learning/session";
import {
  akhiriRunDb,
  buktikanSesiDb,
  catatKejadianDb,
  kedaluwarsaDb,
  mulaiRunDb,
  tandaiKedaluwarsaDb,
} from "@/lib/learning/run-service";

let db: KoneksiDb = getDb();

/** Semua tabel Fase 2 ikut di-truncate: run/event punya FK ke user & enrollment. */
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
      course_completions,
      integrity_violations
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

const COURSE_ID = "kursus-a";

async function buatPengguna(email: string): Promise<SessionPrincipal> {
  const hasil = await daftarPengguna({
    nama: "Peserta Uji",
    username: email.split("@")[0]!,
    email,
    password: "rahasia-panjang",
  });
  if (!hasil.ok) throw new Error(`gagal buat akun ${email}: ${hasil.alasan}`);
  return hasil.principal;
}

/** Principal + enrollment untuk satu kursus; siap dipakai `mulaiRunDb`. */
async function siapkanPeserta(email = "peserta@contoh.test") {
  const principal = await buatPengguna(email);
  const { enrollment } = await daftarEnrollment({
    userId: principal.userId,
    courseId: COURSE_ID,
    slug: COURSE_ID,
    title: "Kursus A",
  });
  return { principal, enrollment };
}

async function barisRun(runId: string) {
  const [baris] = await db.select().from(learningRuns).where(eq(learningRuns.id, runId));
  return baris;
}

describe("mulaiRunDb — satu run aktif per (user, course)", () => {
  it("dua panggilan untuk (user, course) sama melanjutkan run yang sama, bukan membuat run kedua", async () => {
    const { principal, enrollment } = await siapkanPeserta();

    const pertama = await mulaiRunDb({
      principal,
      enrollmentId: enrollment.id,
      courseId: COURSE_ID,
      policyVersion: 1,
    });
    const kedua = await mulaiRunDb({
      principal,
      enrollmentId: enrollment.id,
      courseId: COURSE_ID,
      policyVersion: 1,
    });

    expect(pertama.run.state).toBe("active");
    expect(kedua.run.id).toBe(pertama.run.id);
    // Bukti diterbitkan ulang untuk run yang sama, dan tetap sah.
    expect(kedua.bukti).toBe(pertama.bukti);

    const semua = await db.select().from(learningRuns);
    expect(semua).toHaveLength(1);
  });

  it("run aktif yang sudah lewat batas ditutup dulu, lalu run baru dibuat", async () => {
    const { principal, enrollment } = await siapkanPeserta();

    const lama = await mulaiRunDb({
      principal,
      enrollmentId: enrollment.id,
      courseId: COURSE_ID,
      policyVersion: 1,
    });
    await db
      .update(learningRuns)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(learningRuns.id, lama.run.id));

    const baru = await mulaiRunDb({
      principal,
      enrollmentId: enrollment.id,
      courseId: COURSE_ID,
      policyVersion: 1,
    });

    expect(baru.run.id).not.toBe(lama.run.id);
    expect(baru.run.state).toBe("active");
    // Run lama dibersihkan, bukan ditinggalkan sebagai `active` yang menghalangi.
    expect((await barisRun(lama.run.id))?.state).toBe("expired");

    const semua = await db.select().from(learningRuns);
    expect(semua).toHaveLength(2);
  });
});

describe("kedaluwarsaDb — gagal-tertutup", () => {
  it("run kedaluwarsa ditolak buktikanSesiDb dan ditutup sebagai expired", async () => {
    const { principal, enrollment } = await siapkanPeserta();
    const { run, bukti } = await mulaiRunDb({
      principal,
      enrollmentId: enrollment.id,
      courseId: COURSE_ID,
      policyVersion: 1,
    });

    // Selagi berlaku: bukti lolos.
    const sah = await buktikanSesiDb({
      userId: principal.userId,
      courseId: COURSE_ID,
      policyVersion: 1,
      token: bukti,
    });
    expect(sah?.id).toBe(run.id);

    // Lewatkan batas tanpa menyentuh status: yang mengubah keputusan adalah waktu.
    await db
      .update(learningRuns)
      .set({ expiresAt: new Date(Date.now() - 1) })
      .where(eq(learningRuns.id, run.id));

    const ditolak = await buktikanSesiDb({
      userId: principal.userId,
      courseId: COURSE_ID,
      policyVersion: 1,
      token: bukti,
    });
    expect(ditolak).toBeNull();
    // Ditutup, sehingga tidak lagi memblokir run berikutnya.
    expect((await barisRun(run.id))?.state).toBe("expired");
  });

  it("membandingkan integritas ke run, bukan hanya ke token", async () => {
    const { principal, enrollment } = await siapkanPeserta();
    const { run, bukti } = await mulaiRunDb({
      principal,
      enrollmentId: enrollment.id,
      courseId: COURSE_ID,
      policyVersion: 1,
    });

    // Token yang ditandatangani untuk versi 2 adalah token yang sah...
    const tokenVersiDua = buktiBaru({
      courseId: COURSE_ID,
      owner: principal.userId,
      policyVersion: 2,
    });
    // ...tetapi run ini dibuat di versi 1, jadi tetap ditolak.
    expect(
      await buktikanSesiDb({
        userId: principal.userId,
        courseId: COURSE_ID,
        policyVersion: 2,
        token: tokenVersiDua,
      }),
    ).toBeNull();
    // Sedangkan token milik run-nya sendiri lolos.
    const sah = await buktikanSesiDb({
      userId: principal.userId,
      courseId: COURSE_ID,
      policyVersion: 1,
      token: bukti,
    });
    expect(sah?.id).toBe(run.id);
  });

  it("expiresAt yang tidak bisa dibaca dihitung kedaluwarsa", async () => {
    const { principal, enrollment } = await siapkanPeserta();
    const { run } = await mulaiRunDb({
      principal,
      enrollmentId: enrollment.id,
      courseId: COURSE_ID,
      policyVersion: 1,
    });

    expect(kedaluwarsaDb(run, run.expiresAt.getTime() - 1)).toBe(false);
    expect(kedaluwarsaDb(run, run.expiresAt.getTime())).toBe(true);
    expect(kedaluwarsaDb({ ...run, expiresAt: new Date(Number.NaN) })).toBe(true);
  });
});

describe("sequence kejadian — anti-replay", () => {
  it("memberi sequence 1, 2, 3 dan menolak run tertutup", async () => {
    const { principal, enrollment } = await siapkanPeserta();
    const { run } = await mulaiRunDb({
      principal,
      enrollmentId: enrollment.id,
      courseId: COURSE_ID,
      policyVersion: 1,
    });

    const e1 = await catatKejadianDb({
      principal,
      runId: run.id,
      jenis: "sesi_dimulai",
      visibilitas: "visible",
    });
    const e2 = await catatKejadianDb({
      principal,
      runId: run.id,
      jenis: "pindah_tab",
      visibilitas: "hidden",
    });
    const e3 = await catatKejadianDb({
      principal,
      runId: run.id,
      jenis: "fokus_hilang",
      visibilitas: null,
    });

    expect([e1?.sequence, e2?.sequence, e3?.sequence]).toEqual([1, 2, 3]);
    expect(e1?.kind).toBe("sesi_dimulai");
    // Klasifikasi disimpan bersama kejadian, seperti `KejadianIntegritas` lama.
    expect(e2?.payloadRedacted).toMatchObject({
      jenis_klasifikasi: "kejadian",
      visibilitas: "hidden",
    });
    expect(e3?.payloadRedacted).toMatchObject({ jenis_klasifikasi: "kejadian", visibilitas: null });

    const tersimpan = await listEventRun(run.id);
    expect(tersimpan.map((e) => e.sequence)).toEqual([1, 2, 3]);

    // Sequence yang sama tidak bisa disisipkan ulang — unique constraint.
    await expect(
      db
        .insert(learningEvents)
        .values({ learningRunId: run.id, kind: "pindah_tab", sequence: 1 }),
    ).rejects.toThrow();

    // Run completed menolak kejadian baru.
    const ditutup = await akhiriRunDb({ principal, runId: run.id, alasan: "selesai" });
    expect(ditutup?.state).toBe("completed");
    expect(await catatKejadianRun({ runId: run.id, kind: "pindah_tab" })).toBeNull();
    expect(
      await catatKejadianDb({
        principal,
        runId: run.id,
        jenis: "pindah_tab",
        visibilitas: "visible",
      }),
    ).toBeNull();

    // Run expired juga menolak kejadian baru.
    const kedua = await mulaiRunDb({
      principal,
      enrollmentId: enrollment.id,
      courseId: COURSE_ID,
      policyVersion: 1,
    });
    await tandaiKedaluwarsaDb(kedua.run.id);
    expect((await barisRun(kedua.run.id))?.state).toBe("expired");
    expect(await catatKejadianRun({ runId: kedua.run.id, kind: "pindah_tab" })).toBeNull();
  });
});

/**
 * Stage 1 dipicu oleh **kedua** cara sebuah run berhenti.
 *
 * Ini mengunci bug yang benar-benar ada: versi pertama menaruh deteksi hanya di
 * `akhiriRunDb`, sehingga run yang dibiarkan lewat batas (`expired`) tidak pernah
 * ditambang. Di database dev waktu itu, 201 dari 345 kejadian tidak pernah
 * diperiksa — dan sesi yang ditinggalkan justru yang paling perlu ditinjau.
 */
describe("deteksi otomatis dari kedua jalur penutupan run", () => {
  const KURSUS = "kursus-deteksi";

  async function pesertaDenganKejadian(email: string, jenis: KJenisKejadian, n: number) {
    const { principal, enrollment } = await siapkanPeserta(email);
    const { run } = await mulaiRunDb({
      principal,
      enrollmentId: enrollment.id,
      courseId: KURSUS,
      policyVersion: 1,
    });
    for (let i = 0; i < n; i += 1) {
      // Detail harus lewat `payloadRedacted.detail`: `kejadianDariEvent`
      // membacanya dari sana, dan tanpa itu `paste_massal` terbaca 0 karakter
      // sehingga tidak melewati ambang.
      await catatKejadianRun({
        runId: run.id,
        kind: jenis,
        payloadRedacted: {
          asal: "browser",
          detail: "400 karakter",
          visibilitas: "visible",
          jenis_klasifikasi: "kejadian",
        },
      });
    }
    return { principal, run };
  }

  async function usulanUntuk(userId: string) {
    return db
      .select()
      .from(integrityViolations)
      .where(eq(integrityViolations.userId, userId));
  }

  it("run yang kedaluwarsa tetap menghasilkan usulan", async () => {
    const { principal, run } = await pesertaDenganKejadian(
      "exp@contoh.test",
      "pindah_tab",
      3,
    );

    const ditutup = await tandaiKedaluwarsaDb(run.id);
    expect(ditutup?.state).toBe("expired");

    const usulan = await usulanUntuk(principal.userId);
    expect(usulan.map((u) => u.kind)).toEqual(["meninggalkan_sesi"]);
    expect(usulan[0]?.status).toBe("proposed");
    // Usulan tidak memotong skor sampai manusia memutuskan.
    expect(usulan.every((u) => u.reviewerUserId === null)).toBe(true);
  });

  it("run yang ditutup peserta juga menghasilkan usulan", async () => {
    const { principal, run } = await pesertaDenganKejadian(
      "tutup@contoh.test",
      "paste_massal",
      1,
    );

    const ditutup = await akhiriRunDb({ principal, runId: run.id, alasan: "selesai" });
    expect(ditutup?.state).toBe("completed");

    const usulan = await usulanUntuk(principal.userId);
    expect(usulan.map((u) => u.kind)).toEqual(["pola_salin_tempel"]);
  });

  it("menutup dua kali tidak menambang ulang kejadian yang sama", async () => {
    // Idempotensi: `akhiriRunRepo` mengembalikan null pada run non-aktif, jadi
    // deteksi tidak berjalan dan antrian tidak terisi salinan.
    const { principal, run } = await pesertaDenganKejadian(
      "ulang@contoh.test",
      "pindah_tab",
      3,
    );

    await tandaiKedaluwarsaDb(run.id);
    await tandaiKedaluwarsaDb(run.id);
    await akhiriRunDb({ principal, runId: run.id, alasan: "lagi" });

    expect(await usulanUntuk(principal.userId)).toHaveLength(1);
  });

  it("run tanpa sinyal tidak menghasilkan usulan apa pun", async () => {
    const { principal, run } = await pesertaDenganKejadian(
      "bersih@contoh.test",
      "sesi_dimulai",
      1,
    );
    await tandaiKedaluwarsaDb(run.id);
    expect(await usulanUntuk(principal.userId)).toHaveLength(0);
  });
});

describe("kepemilikan", () => {
  it("menolak kejadian dan penutupan run milik user lain", async () => {
    const pemilik = await siapkanPeserta("pemilik@contoh.test");
    const penyusup = await buatPengguna("penyusup@contoh.test");

    const { run } = await mulaiRunDb({
      principal: pemilik.principal,
      enrollmentId: pemilik.enrollment.id,
      courseId: COURSE_ID,
      policyVersion: 1,
    });

    expect(
      await catatKejadianDb({
        principal: penyusup,
        runId: run.id,
        jenis: "pindah_tab",
        visibilitas: "hidden",
      }),
    ).toBeNull();
    expect(
      await akhiriRunDb({ principal: penyusup, runId: run.id, alasan: "palsu" }),
    ).toBeNull();

    // Tidak ada efek samping: kejadian kosong dan run tetap aktif.
    expect(await listEventRun(run.id)).toHaveLength(0);
    expect((await barisRun(run.id))?.state).toBe("active");
  });

  it("menolak jenis kejadian di luar daftar sah sebelum menyentuh database", async () => {
    const { principal, enrollment } = await siapkanPeserta();
    const { run } = await mulaiRunDb({
      principal,
      enrollmentId: enrollment.id,
      courseId: COURSE_ID,
      policyVersion: 1,
    });

    expect(
      await catatKejadianDb({
        principal,
        runId: run.id,
        jenis: "jenis_ngawur" as KJenisKejadian,
        visibilitas: null,
      }),
    ).toBeNull();
    expect(await listEventRun(run.id)).toHaveLength(0);
  });

  it("menolak enrollment milik user lain saat memulai run", async () => {
    const pemilik = await siapkanPeserta("pemilik2@contoh.test");
    const penyusup = await buatPengguna("penyusup2@contoh.test");

    await expect(
      mulaiRunDb({
        principal: penyusup,
        enrollmentId: pemilik.enrollment.id,
        courseId: COURSE_ID,
        policyVersion: 1,
      }),
    ).rejects.toThrow("Enrollment tidak ditemukan untuk pengguna ini.");
  });
});
