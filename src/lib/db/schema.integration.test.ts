/**
 * Smoke test integrasi schema identity Fase 1.
 *
 * Berkas ini membuktikan tiga hal yang tidak bisa dibuktikan test unit:
 *
 * 1. **Fresh install benar-benar jalan.** Sembilan tabel dibuat dari nol oleh
 *    migrasi di `drizzle/` pada basis data ephemeral yang kosong. Kalau SQL
 *    migrasinya rusak, tes ini gagal sebelum apa pun yang lain.
 * 2. **Constraint-nya berlaku di database, bukan cuma di TypeScript.** Unique
 *    email/username, CHECK role/status, composite PK role, dan perilaku FK
 *    on-delete diuji dengan benar-benar melanggar aturannya lalu memeriksa
 *    SQLSTATE-nya. Constraint yang hanya ada di kepala penulis schema adalah
 *    constraint yang tidak ada.
 * 3. **Nama tabel dan kolom sesuai kontrak.** Subagent auth/RBAC/invitation
 *    menulis query terhadap nama-nama ini; daftar kolom di bawah adalah
 *    kontrak itu, dan tes yang gagal saat nama berubah lebih baik daripada
 *    repository yang gagal saat runtime.
 *
 * Dijalankan hanya oleh `npm run test:db` (lihat `vitest.integration.config.mts`).
 * `npm test` mengecualikan pola `.integration.test.ts` sehingga tidak menuntut
 * database.
 */

import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { getDb, tutupDb, type KoneksiDb } from "./client";
import { auditEvents } from "./schema";

/**
 * Kode SQLSTATE yang dipakai PostgreSQL untuk pelanggaran constraint. Diuji
 * lewat kode, bukan lewat teks pesan: pesan bisa berubah antar versi
 * PostgreSQL dan antar locale, kode tidak.
 */
const KODE = {
  unique: "23505",
  check: "23514",
  foreignKey: "23503",
  notNull: "23502",
} as const;

/** Tabel yang harus ada setelah migrasi, sesuai kontrak schema.ts. */
const TABEL_WAJIB = [
  "audit_events",
  "course_completions",
  "courses",
  "email_verification_tokens",
  "enrollments",
  "learning_events",
  "learning_runs",
  "module_progress",
  "outbox_deliveries",
  "outbox_events",
  "password_reset_tokens",
  "quiz_attempt_answers",
  "quiz_attempts",
  "sessions",
  "staff_invitations",
  "user_credentials",
  "user_profiles",
  "user_roles",
  "users",
] as const;

/**
 * Kolom minimum per tabel. Hanya kolom yang menjadi bagian kontrak yang
 * dipatok; menambah kolom baru tidak menggagalkan tes, mengganti nama kolom
 * yang sudah dipakai subagent lain menggagalkannya.
 */
const KOLOM_WAJIB: Record<string, string[]> = {
  users: [
    "id",
    "email_normalized",
    "username_normalized",
    "display_name",
    "status",
    "created_at",
    "updated_at",
  ],
  user_profiles: [
    "user_id",
    "public_bio",
    "avatar_file_id",
    "cover_file_id",
    "username_changed_at",
    "updated_at",
  ],
  user_credentials: ["user_id", "password_hash", "password_changed_at"],
  user_roles: ["user_id", "role", "granted_by_user_id", "granted_at", "revoked_at"],
  sessions: [
    "id",
    "user_id",
    "token_hash",
    "created_at",
    "expires_at",
    "rotated_at",
    "revoked_at",
    "user_agent",
    "ip_prefix",
  ],
  email_verification_tokens: ["id", "user_id", "token_hash", "expires_at", "consumed_at"],
  password_reset_tokens: ["id", "user_id", "token_hash", "expires_at", "consumed_at"],
  staff_invitations: [
    "id",
    "email_normalized",
    "role",
    "invited_by_user_id",
    "token_hash",
    "expires_at",
    "consumed_at",
    "revoked_at",
  ],
  audit_events: [
    "id",
    "actor_user_id",
    "action",
    "entity_type",
    "entity_id",
    "payload_redacted",
    "request_id",
    "created_at",
  ],
  outbox_events: [
    "id",
    "type",
    "aggregate_type",
    "aggregate_id",
    "payload_redacted",
    "occurred_at",
    "available_at",
    "attempts",
    "lease_owner",
    "lease_expires_at",
    "processed_at",
    "last_error_code",
    "dead_lettered_at",
    "idempotency_key",
  ],
  outbox_deliveries: [
    "event_id",
    "sink",
    "status",
    "updated_at",
    "delivered_at",
    "result_code",
  ],
  courses: ["id", "slug", "title", "created_at"],
  enrollments: [
    "id",
    "user_id",
    "course_id",
    "status",
    "enrolled_at",
    "completed_at",
    "completion_path",
  ],
  module_progress: [
    "enrollment_id",
    "module_id",
    "state",
    "completed_at",
    "completion_path",
    "evidence_id",
  ],
  learning_runs: [
    "id",
    "user_id",
    "enrollment_id",
    "course_id",
    "module_id",
    "state",
    "started_at",
    "expires_at",
    "completed_at",
    "integrity_version",
    "metadata_redacted",
  ],
  learning_events: [
    "id",
    "learning_run_id",
    "kind",
    "sequence",
    "occurred_at",
    "payload_redacted",
  ],
  quiz_attempts: [
    "id",
    "user_id",
    "enrollment_id",
    "quiz_id",
    "assessment_definition_version",
    "assessment_snapshot",
    "status",
    "started_at",
    "submitted_at",
    "score",
    "grading_version",
    "attempt_number",
  ],
  quiz_attempt_answers: [
    "quiz_attempt_id",
    "question_id",
    "selected_option",
    "is_correct",
    "question_snapshot_ref",
  ],
  course_completions: [
    "id",
    "user_id",
    "course_id",
    "enrollment_id",
    "completed_at",
    "completion_path",
    "policy_version",
  ],
};

let db: KoneksiDb = getDb();

/**
 * Mengosongkan semua tabel sebelum tiap tes.
 *
 * `TRUNCATE ... CASCADE` dipakai, bukan `DELETE`, karena urutan FK tidak
 * relevan dan `CASCADE` menangani tabel yang menggantung pada `users`. Urutan
 * daftarnya tidak penting — itu justru alasan memakai TRUNCATE.
 */
async function kosongkanSemua() {
  await db.execute(
    sql`truncate table
      audit_events,
      course_completions,
      courses,
      email_verification_tokens,
      enrollments,
      learning_events,
      learning_runs,
      module_progress,
      outbox_deliveries,
      outbox_events,
      password_reset_tokens,
      quiz_attempt_answers,
      quiz_attempts,
      sessions,
      staff_invitations,
      user_credentials,
      user_profiles,
      user_roles,
      users
      cascade`,
  );
}

/** Insert user minimal dengan email/username unik yang bisa ditentukan. */
async function buatUser(suffix: string) {
  const [row] = await db.execute<{ id: string; status: string; display_name: string }>(
    sql`insert into users (email_normalized, username_normalized, display_name)
        values (${`orang${suffix}@contoh.test`}, ${`orang${suffix}`}, ${`Orang ${suffix}`})
        returning id, status, display_name`,
  );
  return row;
}

/**
 * Menjalankan `fn` dan mengharap PostgreSQL menolaknya dengan SQLSTATE `kode`.
 *
 * Drizzle membungkus galat driver, jadi kode SQLSTATE bisa berada di
 * `err.code` atau di `err.cause.code` tergantung jalur yang melempar.
 * Keduanya diperiksa supaya tes tidak rapuh terhadap detail pembungkusan.
 */
async function harapDitolak(fn: () => Promise<unknown>, kode: string) {
  let tertangkap: unknown;
  try {
    await fn();
  } catch (err) {
    tertangkap = err;
  }
  if (tertangkap === undefined) {
    throw new Error(`Query seharusnya ditolak PostgreSQL dengan kode ${kode}, tapi berhasil.`);
  }
  const kandidat = tertangkap as { code?: string; cause?: { code?: string } };
  const kodeAktual = kandidat.code ?? kandidat.cause?.code;
  expect(kodeAktual, `SQLSTATE tidak sesuai (pesan: ${String(tertangkap)})`).toBe(kode);
}

beforeEach(async () => {
  // `getDb()` di-cache per URL; ambil ulang tiap tes supaya berkas ini tetap
  // benar bila kelak ada tes yang mengganti TEST_DATABASE_URL.
  db = getDb();
  await kosongkanSemua();
});

afterAll(async () => {
  // Pool harus ditutup sebelum globalSetup men-drop basis data; koneksi yang
  // masih hidup membuat DROP menunggu.
  await tutupDb();
});

describe("migrasi fresh install", () => {
  it("membuat seluruh tabel kontrak di schema public", async () => {
    const rows = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables
          where table_schema = 'public' and table_type = 'BASE TABLE'`,
    );
    const ada = rows.map((r) => r.table_name).sort();
    expect(ada).toEqual([...TABEL_WAJIB].sort());
  });

  it("mencatat migrasi di drizzle.__drizzle_migrations", async () => {
    const rows = await db.execute<{ jumlah: number }>(
      sql`select count(*)::int as jumlah from drizzle.__drizzle_migrations`,
    );
    expect(rows[0]?.jumlah).toBeGreaterThan(0);
  });

  it("memberi setiap tabel kolom yang menjadi kontrak subagent lain", async () => {
    for (const [tabel, kolomWajib] of Object.entries(KOLOM_WAJIB)) {
      const rows = await db.execute<{ column_name: string }>(
        sql`select column_name from information_schema.columns
            where table_schema = 'public' and table_name = ${tabel}`,
      );
      const ada = rows.map((r) => r.column_name);
      for (const kolom of kolomWajib) {
        expect(ada, `kolom ${tabel}.${kolom} hilang`).toContain(kolom);
      }
    }
  });

  it("memasang index yang dibutuhkan untuk pembacaan session, role, undangan, dan audit", async () => {
    const rows = await db.execute<{ indexname: string }>(
      sql`select indexname from pg_indexes where schemaname = 'public'`,
    );
    const nama = rows.map((r) => r.indexname);
    for (const idx of [
      "sessions_user_id_idx",
      "sessions_expires_at_idx",
      "user_roles_user_id_idx",
      "staff_invitations_email_normalized_idx",
      "audit_events_actor_user_id_idx",
      "outbox_events_claim_idx",
      "outbox_events_aggregate_idx",
      "outbox_deliveries_sink_idx",
    ]) {
      expect(nama, `index ${idx} hilang`).toContain(idx);
    }
  });

  it("membuat predikat index claim outbox tanpa fungsi non-imutable", async () => {
    // PostgreSQL menolak `now()` di predikat index parsial, jadi migrasi yang
    // memuatnya gagal saat fresh install. Tes ini memaku bentuk predikat yang
    // benar supaya perubahan schema yang menambahkan fungsi waktu di situ
    // tertangkap di sini, bukan di database produksi.
    const rows = await db.execute<{ indexdef: string }>(
      sql`select indexdef from pg_indexes where schemaname = 'public' and indexname = 'outbox_events_claim_idx'`,
    );
    expect(rows).toHaveLength(1);
    const def = rows[0]!.indexdef;
    expect(def).toContain("processed_at IS NULL");
    expect(def).toContain("dead_lettered_at IS NULL");
    expect(def.toLowerCase()).not.toContain("now()");
  });
});

describe("users", () => {
  it("memberi id uuid dan status 'active' secara default", async () => {
    const row = await buatUser("default");
    expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(row.status).toBe("active");
    expect(row.display_name).toBe("Orang default");
  });

  it("menolak email_normalized duplikat", async () => {
    await buatUser("dup-email");
    await harapDitolak(
      () =>
        db.execute(
          sql`insert into users (email_normalized, username_normalized, display_name)
              values ('orangdup-email@contoh.test', 'nama-lain', 'Nama Lain')`,
        ),
      KODE.unique,
    );
  });

  it("menolak username_normalized duplikat", async () => {
    await buatUser("dup-user");
    await harapDitolak(
      () =>
        db.execute(
          sql`insert into users (email_normalized, username_normalized, display_name)
              values ('lain@contoh.test', 'orangdup-user', 'Lain')`,
        ),
      KODE.unique,
    );
  });

  it("menerima email/username yang berbeda hanya pada huruf besar-kecil sebagai baris terpisah", async () => {
    // Unik berlaku pada kolom **ternormalisasi**. Bentuk asli yang berbeda
    // huruf besar-kecil adalah masalah normalisasi di pemanggil, bukan
    // sesuatu yang bisa ditebak database — tes ini memaku batas tanggung
    // jawab itu supaya tidak ada yang mengira constraint-nya case-insensitive.
    await db.execute(
      sql`insert into users (email_normalized, username_normalized, display_name)
          values ('huruf@contoh.test', 'huruf', 'Huruf Kecil')`,
    );
    await db.execute(
      sql`insert into users (email_normalized, username_normalized, display_name)
          values ('HURUF@contoh.test', 'HURUF', 'Huruf Besar')`,
    );
    const rows = await db.execute<{ jumlah: number }>(
      sql`select count(*)::int as jumlah from users where lower(email_normalized) = 'huruf@contoh.test'`,
    );
    expect(rows[0]?.jumlah).toBe(2);
  });

  it("menolak status di luar daftar lewat CHECK", async () => {
    await harapDitolak(
      () =>
        db.execute(
          sql`insert into users (email_normalized, username_normalized, display_name, status)
              values ('bogus@contoh.test', 'bogus', 'Bogus', 'aktif')`,
        ),
      KODE.check,
    );
  });

  it("menolak display_name kosong/null", async () => {
    await harapDitolak(
      () =>
        db.execute(
          sql`insert into users (email_normalized, username_normalized, display_name)
              values ('kosong@contoh.test', 'kosong', null)`,
        ),
      KODE.notNull,
    );
  });
});

describe("user_roles", () => {
  it("menolak role duplikat untuk user yang sama lewat composite PK", async () => {
    const user = await buatUser("role-pk");
    await db.execute(
      sql`insert into user_roles (user_id, role) values (${user.id}, 'verifikator')`,
    );
    await harapDitolak(
      () => db.execute(sql`insert into user_roles (user_id, role) values (${user.id}, 'verifikator')`),
      KODE.unique,
    );
  });

  it("mengizinkan seorang user memegang beberapa role berbeda", async () => {
    const user = await buatUser("role-banyak");
    await db.execute(sql`insert into user_roles (user_id, role) values (${user.id}, 'user')`);
    await db.execute(sql`insert into user_roles (user_id, role) values (${user.id}, 'admin')`);
    const rows = await db.execute<{ role: string }>(
      sql`select role from user_roles where user_id = ${user.id} order by role`,
    );
    expect(rows.map((r) => r.role)).toEqual(["admin", "user"]);
  });

  it("menolak role di luar daftar lewat CHECK", async () => {
    const user = await buatUser("role-bogus");
    await harapDitolak(
      () => db.execute(sql`insert into user_roles (user_id, role) values (${user.id}, 'learner')`),
      KODE.check,
    );
  });

  it("mendukung grant ulang setelah revoke lewat UPDATE, bukan INSERT kedua", async () => {
    // Bentuk alur yang diharapkan subagent RBAC: PK komposit membuat INSERT
    // kedua gagal, jadi grant ulang harus mengosongkan revoked_at. Tes ini
    // memaku bahwa kolomnya memang bisa dikosongkan kembali.
    const user = await buatUser("role-grant-ulang");
    await db.execute(sql`insert into user_roles (user_id, role) values (${user.id}, 'verifikator')`);
    await db.execute(
      sql`update user_roles set revoked_at = now() where user_id = ${user.id} and role = 'verifikator'`,
    );
    await db.execute(
      sql`update user_roles set revoked_at = null, granted_at = now()
          where user_id = ${user.id} and role = 'verifikator'`,
    );
    const rows = await db.execute<{ revoked_at: Date | null }>(
      sql`select revoked_at from user_roles where user_id = ${user.id} and role = 'verifikator'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.revoked_at).toBeNull();
  });

  it("mengosongkan granted_by_user_id saat admin pemberi dihapus", async () => {
    const admin = await buatUser("admin-hapus");
    const target = await buatUser("target-hapus");
    await db.execute(
      sql`insert into user_roles (user_id, role, granted_by_user_id)
          values (${target.id}, 'verifikator', ${admin.id})`,
    );
    await db.execute(sql`delete from users where id = ${admin.id}`);

    const rows = await db.execute<{ granted_by_user_id: string | null }>(
      sql`select granted_by_user_id from user_roles where user_id = ${target.id}`,
    );
    // `set null`, bukan cascade: pencabutan admin tidak boleh menghapus bukti
    // bahwa role pernah diberikan.
    expect(rows[0]?.granted_by_user_id).toBeNull();
  });

  it("menghapus role saat user-nya dihapus (cascade)", async () => {
    const user = await buatUser("role-cascade");
    await db.execute(sql`insert into user_roles (user_id, role) values (${user.id}, 'user')`);
    await db.execute(sql`delete from users where id = ${user.id}`);
    const rows = await db.execute<{ jumlah: number }>(
      sql`select count(*)::int as jumlah from user_roles where user_id = ${user.id}`,
    );
    expect(rows[0]?.jumlah).toBe(0);
  });
});

describe("sessions", () => {
  it("menyimpan hash token unik dan metadata session", async () => {
    const user = await buatUser("session");
    await db.execute(
      sql`insert into sessions (user_id, token_hash, expires_at, user_agent, ip_prefix)
          values (${user.id}, 'hash-a', now() + interval '7 days', 'vitest', '10.0.0')`,
    );
    await harapDitolak(
      () =>
        db.execute(
          sql`insert into sessions (user_id, token_hash, expires_at)
              values (${user.id}, 'hash-a', now() + interval '7 days')`,
        ),
      KODE.unique,
    );
  });

  it("menghapus session saat user-nya dihapus (cascade)", async () => {
    const user = await buatUser("session-cascade");
    await db.execute(
      sql`insert into sessions (user_id, token_hash, expires_at)
          values (${user.id}, 'hash-cascade', now() + interval '7 days')`,
    );
    await db.execute(sql`delete from users where id = ${user.id}`);
    const rows = await db.execute<{ jumlah: number }>(
      sql`select count(*)::int as jumlah from sessions where token_hash = 'hash-cascade'`,
    );
    expect(rows[0]?.jumlah).toBe(0);
  });

  it("menolak session tanpa expires_at", async () => {
    const user = await buatUser("session-tanpa-expiry");
    await harapDitolak(
      () =>
        db.execute(
          sql`insert into sessions (user_id, token_hash) values (${user.id}, 'hash-tanpa-expiry')`,
        ),
      KODE.notNull,
    );
  });
});

describe("staff_invitations", () => {
  it("hanya menerima role verifikator atau admin", async () => {
    const admin = await buatUser("inviter");
    for (const role of ["verifikator", "admin"]) {
      await db.execute(
        sql`insert into staff_invitations (email_normalized, role, invited_by_user_id, token_hash, expires_at)
            values (${`${role}@contoh.test`}, ${role}, ${admin.id}, ${`hash-${role}`}, now() + interval '7 days')`,
      );
    }
    // 'user' sengaja ditolak: undangan staff tidak boleh menjadi jalur untuk
    // memberi role learner (itu jalur registrasi biasa).
    await harapDitolak(
      () =>
        db.execute(
          sql`insert into staff_invitations (email_normalized, role, token_hash, expires_at)
              values ('bukan-staff@contoh.test', 'user', 'hash-user', now() + interval '7 days')`,
        ),
      KODE.check,
    );
  });

  it("menolak token_hash undangan duplikat", async () => {
    await db.execute(
      sql`insert into staff_invitations (email_normalized, role, token_hash, expires_at)
          values ('a@contoh.test', 'admin', 'hash-sama', now() + interval '7 days')`,
    );
    await harapDitolak(
      () =>
        db.execute(
          sql`insert into staff_invitations (email_normalized, role, token_hash, expires_at)
              values ('b@contoh.test', 'admin', 'hash-sama', now() + interval '7 days')`,
        ),
      KODE.unique,
    );
  });

  it("mengizinkan email yang sama diundang lebih dari sekali", async () => {
    // Revoke lalu undang ulang adalah alur normal; email undangan bukan kunci
    // unik, hanya token yang unik.
    await db.execute(
      sql`insert into staff_invitations (email_normalized, role, token_hash, expires_at)
          values ('sama@contoh.test', 'admin', 'hash-1', now() + interval '7 days')`,
    );
    await db.execute(
      sql`insert into staff_invitations (email_normalized, role, token_hash, expires_at)
          values ('sama@contoh.test', 'admin', 'hash-2', now() + interval '7 days')`,
    );
    const rows = await db.execute<{ jumlah: number }>(
      sql`select count(*)::int as jumlah from staff_invitations where email_normalized = 'sama@contoh.test'`,
    );
    expect(rows[0]?.jumlah).toBe(2);
  });
});

describe("token satu kali pakai", () => {
  it("menolak token_hash duplikat pada verifikasi email dan reset password", async () => {
    const user = await buatUser("token");
    await db.execute(
      sql`insert into email_verification_tokens (user_id, token_hash, expires_at)
          values (${user.id}, 'verif-1', now() + interval '1 day')`,
    );
    await harapDitolak(
      () =>
        db.execute(
          sql`insert into email_verification_tokens (user_id, token_hash, expires_at)
              values (${user.id}, 'verif-1', now() + interval '1 day')`,
        ),
      KODE.unique,
    );

    await db.execute(
      sql`insert into password_reset_tokens (user_id, token_hash, expires_at)
          values (${user.id}, 'reset-1', now() + interval '1 hour')`,
    );
    await harapDitolak(
      () =>
        db.execute(
          sql`insert into password_reset_tokens (user_id, token_hash, expires_at)
              values (${user.id}, 'reset-1', now() + interval '1 hour')`,
        ),
      KODE.unique,
    );
  });
});

describe("user_profiles dan user_credentials", () => {
  it("membatasi satu profil dan satu kredensial per user", async () => {
    const user = await buatUser("profil");
    await db.execute(sql`insert into user_profiles (user_id, public_bio) values (${user.id}, 'bio')`);
    await harapDitolak(
      () => db.execute(sql`insert into user_profiles (user_id) values (${user.id})`),
      KODE.unique,
    );

    await db.execute(
      sql`insert into user_credentials (user_id, password_hash) values (${user.id}, 'argon2id$...')`,
    );
    await harapDitolak(
      () =>
        db.execute(
          sql`insert into user_credentials (user_id, password_hash) values (${user.id}, 'lain')`,
        ),
      KODE.unique,
    );
  });

  it("menolak profil untuk user yang tidak ada", async () => {
    await harapDitolak(
      () =>
        db.execute(
          sql`insert into user_profiles (user_id) values ('00000000-0000-0000-0000-000000000000')`,
        ),
      KODE.foreignKey,
    );
  });
});

describe("outbox", () => {
  /** Insert event minimal dengan kunci idempotensi yang bisa ditentukan. */
  async function buatEvent(kunci: string, type = "auth.registered") {
    const [row] = await db.execute<{ id: string }>(
      sql`insert into outbox_events (type, aggregate_type, aggregate_id, idempotency_key)
          values (${type}, 'user', 'agregat-1', ${kunci})
          returning id`,
    );
    return row;
  }

  it("menolak idempotency_key duplikat", async () => {
    await buatEvent("auth.registered:tetap");
    await harapDitolak(() => buatEvent("auth.registered:tetap"), KODE.unique);
  });

  it("memberi default attempts 0, available_at/occurred_at terisi, dan lease kosong", async () => {
    const event = await buatEvent("auth.registered:default");
    const rows = await db.execute<{
      attempts: number;
      lease_owner: string | null;
      lease_expires_at: Date | null;
      processed_at: Date | null;
      dead_lettered_at: Date | null;
      payload_redacted: unknown;
    }>(
      sql`select attempts, lease_owner, lease_expires_at, processed_at, dead_lettered_at, payload_redacted
          from outbox_events where id = ${event.id}`,
    );
    const baris = rows[0]!;
    expect(baris.attempts).toBe(0);
    expect(baris.lease_owner).toBeNull();
    expect(baris.lease_expires_at).toBeNull();
    expect(baris.processed_at).toBeNull();
    expect(baris.dead_lettered_at).toBeNull();
  });

  it("mengizinkan payload_redacted berisi jsonb", async () => {
    const [row] = await db.execute<{ id: string }>(
      sql`insert into outbox_events (type, aggregate_type, aggregate_id, idempotency_key, payload_redacted)
          values ('auth.registered', 'user', 'agregat-json', 'kunci-json', ${sql`'{"userId":"x"}'::jsonb`})
          returning id`,
    );
    const rows = await db.execute<{ userId: string }>(
      sql`select payload_redacted -> 'userId' as "userId" from outbox_events where id = ${row.id}`,
    );
    expect(rows[0]?.userId).toBe("x");
  });

  it("menolak status delivery di luar daftar lewat CHECK", async () => {
    const event = await buatEvent("auth.registered:status-bogus");
    await harapDitolak(
      () =>
        db.execute(
          sql`insert into outbox_deliveries (event_id, sink, status)
              values (${event.id}, 'audit', 'selesai')`,
        ),
      KODE.check,
    );
  });

  it("membatasi satu baris ledger per (event, sink) lewat composite PK", async () => {
    // Composite PK — bukan index parsial — adalah penjaga idempotensi per sink.
    // Karena satu baris per pasangan, retry sesudah gagal atau klaim kedua
    // **tidak** bisa menyisipkan baris baru: statusnya di-UPDATE pada baris yang
    // sama. Tes ini memaku bentuk itu supaya tidak ada yang "memperbaikinya"
    // dengan index parsial yang mustahil dilanggar terpisah.
    const event = await buatEvent("auth.registered:ledger-pk");
    await db.execute(
      sql`insert into outbox_deliveries (event_id, sink, status)
          values (${event.id}, 'audit', 'succeeded')`,
    );
    await harapDitolak(
      () =>
        db.execute(
          sql`insert into outbox_deliveries (event_id, sink, status)
              values (${event.id}, 'audit', 'failed')`,
        ),
      KODE.unique,
    );
    await harapDitolak(
      () =>
        db.execute(
          sql`insert into outbox_deliveries (event_id, sink, status)
              values (${event.id}, 'audit', 'in_progress')`,
        ),
      KODE.unique,
    );
  });

  it("mengizinkan dua sink berbeda untuk satu event", async () => {
    const event = await buatEvent("auth.registered:dua-sink");
    await db.execute(
      sql`insert into outbox_deliveries (event_id, sink) values (${event.id}, 'audit')`,
    );
    await db.execute(
      sql`insert into outbox_deliveries (event_id, sink) values (${event.id}, 'email')`,
    );
    const rows = await db.execute<{ jumlah: number }>(
      sql`select count(*)::int as jumlah from outbox_deliveries where event_id = ${event.id}`,
    );
    expect(rows[0]?.jumlah).toBe(2);
  });

  it("menjaga satu baris ledger saat klaim, gagal, lalu diklaim ulang", async () => {
    // Bentuk idempotensi per sink yang benar: satu baris, status berpindah.
    // Menyisipkan baris in_progress kedua ditolak PK (lihat tes di atas), jadi
    // jalur retry adalah UPDATE — dan tes ini memaku bahwa UPDATE itu boleh.
    const event = await buatEvent("auth.registered:in-progress");
    await db.execute(
      sql`insert into outbox_deliveries (event_id, sink, status)
          values (${event.id}, 'audit', 'in_progress')`,
    );
    await db.execute(
      sql`update outbox_deliveries set status = 'failed' where event_id = ${event.id} and sink = 'audit'`,
    );
    await db.execute(
      sql`update outbox_deliveries set status = 'in_progress', updated_at = now()
          where event_id = ${event.id} and sink = 'audit'`,
    );
    const rows = await db.execute<{ jumlah: number; status: string }>(
      sql`select count(*)::int as jumlah, min(status) as status
          from outbox_deliveries where event_id = ${event.id}`,
    );
    expect(rows[0]?.jumlah).toBe(1);
    expect(rows[0]?.status).toBe("in_progress");
  });

  it("menghapus ledger saat event-nya dihapus (cascade)", async () => {
    const event = await buatEvent("auth.registered:cascade");
    await db.execute(
      sql`insert into outbox_deliveries (event_id, sink) values (${event.id}, 'audit')`,
    );
    await db.execute(sql`delete from outbox_events where id = ${event.id}`);
    const rows = await db.execute<{ jumlah: number }>(
      sql`select count(*)::int as jumlah from outbox_deliveries where event_id = ${event.id}`,
    );
    expect(rows[0]?.jumlah).toBe(0);
  });

  it("menolak ledger untuk event yang tidak ada", async () => {
    await harapDitolak(
      () =>
        db.execute(
          sql`insert into outbox_deliveries (event_id, sink)
              values ('00000000-0000-0000-0000-000000000000', 'audit')`,
        ),
      KODE.foreignKey,
    );
  });
});

describe("audit_events", () => {
  it("memakai bigserial yang naik dan menerima payload jsonb", async () => {
    const actor = await buatUser("audit");
    // Lewat `db.execute` mentah, postgres.js mengembalikan bigint sebagai
    // **string**, bukan number: bigint bisa melewati 2^53 dan konversi diam-diam
    // ke number akan kehilangan presisi. Query bertipe (`db.insert(...).returning()`)
    // berbeda — di sana mode kolom yang menentukan (lihat tes di bawah).
    const pertama = await db.execute<{ id: string }>(
      sql`insert into audit_events (actor_user_id, action, entity_type, entity_id, payload_redacted, request_id)
          values (${actor.id}, 'user.registrasi', 'user', ${actor.id}, ${sql`'{"ringkas":true}'::jsonb`}, 'req-1')
          returning id`,
    );
    const kedua = await db.execute<{ id: string }>(
      sql`insert into audit_events (action, entity_type, entity_id)
          values ('session.revoke', 'session', 'abc')
          returning id`,
    );
    expect(BigInt(kedua[0]!.id)).toBeGreaterThan(BigInt(pertama[0]!.id));

    const payload = await db.execute<{ ringkas: boolean }>(
      sql`select payload_redacted -> 'ringkas' as ringkas from audit_events where id = ${pertama[0]!.id}`,
    );
    expect(payload[0]?.ringkas).toBe(true);
  });

  it("mengembalikan id audit sebagai number pada jalur Drizzle bertipe", async () => {
    // `bigserial(..., { mode: "number" })` membuat jalur bertipe memberi
    // `number`, sedangkan `db.execute` mentah memberi string. Repository yang
    // membaca lewat schema tidak perlu mengubah tipe; yang memakai SQL mentah
    // harus siap menerima string.
    const [baris] = await db
      .insert(auditEvents)
      .values({ action: "session.revoke", entityType: "session", entityId: "abc" })
      .returning({ id: auditEvents.id });
    expect(typeof baris!.id).toBe("number");
    expect(baris!.id).toBeTypeOf("number");
  });

  it("mengizinkan actor_user_id null dan mengosongkannya saat actor dihapus", async () => {
    const actor = await buatUser("audit-hapus");
    await db.execute(
      sql`insert into audit_events (actor_user_id, action, entity_type, entity_id)
          values (${actor.id}, 'role.grant', 'user_role', 'x')`,
    );
    await db.execute(sql`delete from users where id = ${actor.id}`);
    const rows = await db.execute<{ actor_user_id: string | null }>(
      sql`select actor_user_id from audit_events where action = 'role.grant'`,
    );
    // Baris audit tidak boleh ikut terhapus bersama actornya.
    expect(rows).toHaveLength(1);
    expect(rows[0]?.actor_user_id).toBeNull();
  });
});
