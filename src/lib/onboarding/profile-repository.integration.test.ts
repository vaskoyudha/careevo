/**
 * Test integrasi repository profil onboarding — **butuh PostgreSQL** (`npm run test:db`).
 *
 * Berkas ini menguji apa yang tidak bisa diuji `integration.test.ts` (yang
 * memock repository demi keeping unit suite bebas database):
 *
 * 1. **Satu baris per akun, dan menulis ulang adalah upsert.** Onboarding yang
 *    diulang dari `/pengaturan` harus mengganti jawaban, bukan bentrok atau
 *    meninggalkan baris kedua.
 * 2. **Urutan `interests` tersimpan apa adanya.** Urutannya adalah preferensi;
 *    kalau repository mengurutkannya, `rekomendasi.ts` melihat urutan berbeda
 *    dari yang dipilih orang.
 * 3. **CHECK database menolak nilai di luar vocabulary** — interest asing,
 *    lebih dari lima, `weekly_hours` di luar set. Ini yang membuat kolom `text`
 *    (bukan `pgEnum`) tetap aman ditulis dari luar aplikasi.
 * 4. **Cascade dari `users`.** Menghapus akun menghapus profilnya; tidak ada
 *    baris profil yatim untuk akun yang tidak ada.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { getDb, tutupDb, type KoneksiDb } from "@/lib/db/client";
import { onboardingProfiles } from "@/lib/db/schema";
import { daftarPengguna } from "@/lib/auth/auth-service";
import {
  cariProfilOnboarding,
  hapusProfilOnboarding,
  simpanProfilOnboarding,
  type NilaiOnboarding,
} from "@/lib/onboarding/profile-repository";
import { getProfile, hasProfile, saveProfile } from "@/lib/onboarding/store";
import {
  BACKGROUNDS,
  EXPERIENCE_LEVELS,
  GOALS,
  INTERESTS,
  MAX_INTERESTS,
  MIN_INTERESTS,
  WEEKLY_HOURS_OPTIONS,
  WORK_PREFERENCES,
} from "@/lib/onboarding/types";

let db: KoneksiDb = getDb();

/**
 * `onboarding_profiles` ikut ter-truncate lewat `cascade` dari `users`, jadi
 * tidak perlu disebut — tapi disebut eksplisit supaya pembaca test ini tidak
 * harus mengetahui aturan cascade itu.
 */
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
      onboarding_profiles,
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

const PASSWORD = "rahasia-panjang";

async function buatAkun(email: string, username: string): Promise<string> {
  const hasil = await daftarPengguna({ nama: email, username, email, password: PASSWORD });
  if (!hasil.ok) throw new Error(`gagal buat akun ${email}`);
  return hasil.principal.userId;
}

const sample: NilaiOnboarding = {
  experience: "menengah",
  background: "career-switcher",
  interests: ["data", "ai"],
  goal: "ganti-bidang",
  weeklyHours: 12,
  workPreference: "remote",
  completedAt: new Date("2026-01-15T08:00:00.000Z"),
  version: 2,
};

describe("repository profil onboarding", () => {
  it("returns undefined for an account that never onboarded", async () => {
    const userId = await buatAkun("baru@contoh.test", "baru");
    expect(await cariProfilOnboarding(db, userId)).toBeUndefined();
  });

  it("round-trips every field, interests order included", async () => {
    const userId = await buatAkun("simpan@contoh.test", "simpan");

    await simpanProfilOnboarding(db, userId, sample);
    const row = await cariProfilOnboarding(db, userId);

    expect(row).toBeDefined();
    expect(row!.experience).toBe("menengah");
    expect(row!.background).toBe("career-switcher");
    expect(row!.interests).toEqual(["data", "ai"]);
    expect(row!.goal).toBe("ganti-bidang");
    expect(row!.weeklyHours).toBe(12);
    expect(row!.workPreference).toBe("remote");
    expect(row!.completedAt.toISOString()).toBe("2026-01-15T08:00:00.000Z");
    expect(row!.version).toBe(2);
  });

  it("store reads and writes onboarding by the authenticated user id", async () => {
    const email = "store@contoh.test";
    const userId = await buatAkun(email, "store");

    expect(await hasProfile(userId, email)).toBe(false);
    await saveProfile({
      experience: sample.experience,
      background: sample.background,
      interests: sample.interests,
      goal: sample.goal,
      weeklyHours: sample.weeklyHours,
      workPreference: sample.workPreference,
    }, userId, email);

    expect(await hasProfile(userId, email)).toBe(true);
    await expect(getProfile(userId, email)).resolves.toMatchObject({
      owner: email,
      interests: sample.interests,
      goal: sample.goal,
    });
  });

  it("preserves a reversed interest order rather than sorting it", async () => {
    const userId = await buatAkun("urutan@contoh.test", "urutan");

    await simpanProfilOnboarding(db, userId, { ...sample, interests: ["mobile", "web-dev", "ai"] });
    const row = await cariProfilOnboarding(db, userId);

    // Preference order, not a set: `rekomendasi.ts` ranks on this sequence.
    expect(row!.interests).toEqual(["mobile", "web-dev", "ai"]);
  });

  it("upserts on re-onboarding instead of conflicting", async () => {
    const userId = await buatAkun("ulang@contoh.test", "ulang");

    await simpanProfilOnboarding(db, userId, sample);
    const kedua = await simpanProfilOnboarding(db, userId, {
      ...sample,
      interests: ["cyber-sec"],
      goal: "naik-level",
      completedAt: new Date("2026-02-01T08:00:00.000Z"),
    });

    expect(kedua.interests).toEqual(["cyber-sec"]);
    expect(kedua.goal).toBe("naik-level");

    const semua = await db.select().from(onboardingProfiles);
    expect(semua).toHaveLength(1);
  });

  it("reports whether a delete removed anything", async () => {
    const userId = await buatAkun("hapus@contoh.test", "hapus");
    await simpanProfilOnboarding(db, userId, sample);

    expect(await hapusProfilOnboarding(db, userId)).toBe(true);
    // Idempoten: menghapus lagi tidak menemukan apa pun.
    expect(await hapusProfilOnboarding(db, userId)).toBe(false);
  });

  it("cascades when the account is deleted", async () => {
    const userId = await buatAkun("yatim@contoh.test", "yatim");
    await simpanProfilOnboarding(db, userId, sample);

    await db.execute(sql`delete from users where id = ${userId}`);

    expect(await cariProfilOnboarding(db, userId)).toBeUndefined();
  });

  /**
   * Setiap kasus harus ditolak **database**, bukan validator TypeScript — itu
   * justru yang sedang diuji. Mengembalikan `true` bila insert ditolak.
   */
  async function cobaDitolak(
    userId: string,
    nilai: Partial<NilaiOnboarding>,
  ): Promise<boolean> {
    try {
      await simpanProfilOnboarding(db, userId, { ...sample, ...nilai });
      return false;
    } catch {
      return true;
    }
  }

  describe("CHECK constraints", () => {
    it("rejects an interest outside the vocabulary", async () => {
      const userId = await buatAkun("asing@contoh.test", "asing");
      expect(
        await cobaDitolak(userId, { interests: ["blockchain" as never] }),
      ).toBe(true);
    });

    it("rejects more than three interests", async () => {
      const userId = await buatAkun("banyak@contoh.test", "banyak");
      expect(
        await cobaDitolak(userId, {
          interests: ["web-dev", "data", "ai", "mobile"] as never,
        }),
      ).toBe(true);
    });

    it("rejects zero interests", async () => {
      const userId = await buatAkun("nol@contoh.test", "nol");
      expect(await cobaDitolak(userId, { interests: [] })).toBe(true);
    });

    it("rejects a weekly_hours value outside the allowed set", async () => {
      const userId = await buatAkun("jam@contoh.test", "jam");
      expect(await cobaDitolak(userId, { weeklyHours: 7 })).toBe(true);
    });

    it("rejects an unknown experience bucket", async () => {
      const userId = await buatAkun("level@contoh.test", "level");
      expect(await cobaDitolak(userId, { experience: "dewa" as never })).toBe(true);
    });

    it("rejects an unknown goal", async () => {
      const userId = await buatAkun("tujuan@contoh.test", "tujuan");
      expect(await cobaDitolak(userId, { goal: "ter kaya" })).toBe(true);
    });
  });

  /**
   * The vocabulary exists twice on purpose: as TypeScript unions in
   * `onboarding/types.ts` (which Zod derives from, and which the UI renders)
   * and as hand-written SQL in the CHECK constraints. `schema.ts` states the
   * reason for not interpolating one into the other — the value list should be
   * visible in the migration diff — but that makes drift possible, and the
   * failure it causes is nasty: adding an interest to `INTERESTS` makes Zod
   * accept it, the form offer it, and then the INSERT fail with a 23514 that
   * surfaces as a server error on a perfectly ordinary submission.
   *
   * So the two are pinned together here, against the constraint as actually
   * deployed rather than against the DDL text.
   */
  describe("vocabulary stays in step with the domain unions", () => {
    /** Single-quoted literals inside a deployed CHECK definition. */
    async function literalConstraint(nama: string): Promise<string[]> {
      const rows = await db.execute<{ def: string }>(
        sql`select pg_get_constraintdef(c.oid) as def
            from pg_constraint c
            join pg_class t on t.oid = c.conrelid
            where t.relname = 'onboarding_profiles' and c.conname = ${nama}`,
      );
      const def = rows[0]?.def ?? "";
      return [...def.matchAll(/'([^']*)'/g)].map((m) => m[1]).sort();
    }

    it("matches EXPERIENCE_LEVELS", async () => {
      expect(await literalConstraint("onboarding_profiles_experience_check")).toEqual(
        [...EXPERIENCE_LEVELS].sort(),
      );
    });

    it("matches BACKGROUNDS", async () => {
      expect(await literalConstraint("onboarding_profiles_background_check")).toEqual(
        [...BACKGROUNDS].sort(),
      );
    });

    it("matches GOALS", async () => {
      expect(await literalConstraint("onboarding_profiles_goal_check")).toEqual(
        [...GOALS].sort(),
      );
    });

    it("matches WORK_PREFERENCES", async () => {
      expect(await literalConstraint("onboarding_profiles_work_preference_check")).toEqual(
        [...WORK_PREFERENCES].sort(),
      );
    });

    it("matches INTERESTS", async () => {
      expect(await literalConstraint("onboarding_profiles_interests_check")).toEqual(
        [...INTERESTS].sort(),
      );
    });

    it("matches WEEKLY_HOURS_OPTIONS", async () => {
      const rows = await db.execute<{ def: string }>(
        sql`select pg_get_constraintdef(c.oid) as def
            from pg_constraint c
            join pg_class t on t.oid = c.conrelid
            where t.relname = 'onboarding_profiles'
              and c.conname = 'onboarding_profiles_weekly_hours_check'`,
      );
      // Postgres renders this as `("weekly_hours" IN (3, 5, 8, 12, 20))`, so the
      // numbers in the definition are exactly the option list — nothing to filter.
      const angka = [...(rows[0]?.def ?? "").matchAll(/\b(\d+)\b/g)]
        .map((m) => Number(m[1]))
        .sort((a, b) => a - b);
      expect(angka).toEqual([...WEEKLY_HOURS_OPTIONS].sort((a, b) => a - b));
    });

    /**
     * The cardinality bound is asserted behaviourally rather than by matching
     * the DDL text: Postgres rewrites `between 1 and 3` as `>= 1 AND <= 3`, so
     * a text assertion would be pinned to one server's rendering. The bounds
     * themselves are checked in the CHECK block above, using these constants.
     */
    it("bounds interests by MIN_INTERESTS/MAX_INTERESTS", async () => {
      const userId = await buatAkun("batas@contoh.test", "batas");
      const semua = [...INTERESTS];

      // One short of the minimum, and one over the maximum, must both fail.
      expect(
        await cobaDitolak(userId, {
          interests: semua.slice(0, MIN_INTERESTS - 1) as never,
        }),
      ).toBe(true);
      expect(await cobaDitolak(userId, { interests: semua.slice(0, MAX_INTERESTS + 1) as never })).toBe(
        true,
      );
      // Exactly the maximum must be accepted.
      expect(await cobaDitolak(userId, { interests: semua.slice(0, MAX_INTERESTS) as never })).toBe(
        false,
      );
    });
  });
});
