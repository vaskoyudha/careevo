/**
 * Schema identity Fase 1 — **satu-satunya sumber kebenaran** untuk tabel
 * PostgreSQL Careevo.
 *
 * Subagent berikutnya (auth service, RBAC, invitation) membangun di atas
 * berkas ini, jadi nama tabel dan nama kolom di sini adalah kontrak: ubah
 * schema lewat migration baru, jangan pernah mengubah nama kolom di tempat.
 *
 * Konvensi yang dikunci:
 *
 * - **Role memakai `text` + CHECK, bukan `pgEnum`.** Menambah nilai role cukup
 *   mengganti definisi CHECK lewat migration biasa; `ALTER TYPE ... ADD VALUE`
 *   punya batasan transaksi yang menyulitkan (tidak boleh dipakai di dalam
 *   blok transaksi pada versi PostgreSQL lama) dan drizzle-kit menanganinya
 *   kurang mulus. Trade-off yang diterima: nilai role tidak muncul sebagai
 *   tipe Postgres, dan validasi ada di constraint + Zod.
 * - **Semua identifier adalah `uuid`** dengan `defaultRandom()`
 *   (`gen_random_uuid()`), sehingga aplikasi tidak perlu membangkitkan id.
 * - **Semua waktu adalah `timestamptz`.** `timestamp` tanpa zona akan
 *   menyimpan waktu lokal server dan rusak begitu ada lebih dari satu zona.
 * - **Email/username disimpan ternormalisasi** (`email_normalized`,
 *   `username_normalized`) dan unique di kolom itu. Bentuk asli yang diketik
 *   user tidak disimpan di sini; ia urusan presentation, bukan identity.
 * - **Token disimpan sebagai hash**, tidak pernah sebagai nilai asli
 *   (`token_hash`). Kolomnya unique supaya lookup saat redeem memakai index.
 * - **Password hash hanya ada di `user_credentials`**, tabel terpisah, supaya
 *   query profil biasa tidak pernah menyentuhnya dan tidak ada kode yang
 *   "kebetulan" mengirimkannya ke client.
 * - Nilai status/role/aksen ditulis dengan tanda petik satu di dalam SQL CHECK
 *   mentah: string bertanda petik ganda akan dibaca Postgres sebagai
 *   **identifier**, bukan literal, dan migration-nya gagal.
 *
 * Modul ini murni definisi — tidak membuka koneksi, tidak membaca env. Aman
 * diimpor dari drizzle-kit (`drizzle.config.ts`), migrator, repository, dan
 * test. Yang tidak boleh mengimpornya adalah komponen client; koneksi dan
 * query-nya ada di `./client.ts` yang server-only.
 *
 * Helper tipe di bagian bawah (`User`, `NewUser`, ...) sengaja diekspor supaya
 * repository tidak menulis ulang `typeof tabel.$inferSelect` di mana-mana.
 */

import { sql } from "drizzle-orm";
import {
  bigserial,
  check,
  index,
  integer,
  jsonb,
  primaryKey,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** Nilai yang sah untuk `users.status`. Diekspor agar tidak ada dua daftar. */
export const STATUS_PENGGUNA = ["active", "suspended", "deleted"] as const;

/**
 * Role yang sah untuk `user_roles.role`.
 *
 * Catatan vocabulary: data legacy memakai `user` untuk learner. Rencana
 * (`docs/backend-production-plan.md` §5) memutuskan satu arti role; `user`
 * dipertahankan sebagai nama kanonik di sini supaya mapping ke cookie legacy
 * tidak menciptakan sinonim kedua. Bila ADR memilih `learner`, itu perubahan
 * nilai CHECK, bukan perubahan struktur.
 */
export const ROLE_PENGGUNA = ["user", "verifikator", "admin"] as const;

/** Role yang sah untuk undangan staff — sengaja lebih sempit dari `ROLE_PENGGUNA`. */
export const ROLE_UNDANGAN_STAFF = ["verifikator", "admin"] as const;

/**
 * Daftar nilai untuk klausa `IN (...)`. Ditulis manual, bukan dari array di
 * atas: array TypeScript tidak bisa diinterpolasi ke SQL mentah tanpa membuat
 * SQL-nya bergantung pada urutan runtime, dan daftar ini sengaja eksplisit di
 * migration supaya perubahan nilai terlihat di diff SQL.
 */
const CHECK_STATUS_PENGGUNA = sql`"status" in ('active', 'suspended', 'deleted')`;
const CHECK_ROLE_PENGGUNA = sql`"role" in ('user', 'verifikator', 'admin')`;
const CHECK_ROLE_UNDANGAN = sql`"role" in ('verifikator', 'admin')`;

/**
 * Akar identity. Semua tabel lain menggantung di sini.
 *
 * `email_normalized` dan `username_normalized` unique: keduanya adalah kunci
 * pencarian login dan URL profil publik (`/p/[username]`). Normalisasi
 * (lowercase, trim, aturan unicode) dilakukan pemanggil sebelum insert —
 * database hanya menjamin keunikannya.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  emailNormalized: text("email_normalized").notNull().unique(),
  usernameNormalized: text("username_normalized").notNull().unique(),
  displayName: text("display_name").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, () => [
  check("users_status_check", CHECK_STATUS_PENGGUNA),
]);

/**
 * Profil publik. Dipisah dari `users` karena ini data yang boleh dibaca orang
 * lain, sedangkan `users` memuat kolom yang tidak.
 *
 * Satu user tepat satu profil (`user_id` sebagai PK, bukan unique biasa).
 * Barisnya boleh belum ada — dibuat saat user mengisi profil, bukan saat
 * registrasi — jadi pembacanya harus siap menerima `undefined`.
 *
 * `avatar_file_id` / `cover_file_id` sengaja belum menjadi foreign key: tabel
 * file belum ada di Fase 1, dan menambah FK belakangan adalah migration biasa.
 */
export const userProfiles = pgTable("user_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  publicBio: text("public_bio"),
  avatarFileId: uuid("avatar_file_id"),
  coverFileId: uuid("cover_file_id"),
  usernameChangedAt: timestamp("username_changed_at", { withTimezone: true, mode: "date" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

/**
 * Kredensial login. Tabel terpisah dengan alasan keamanan, bukan normalisasi:
 * `SELECT * FROM users` pada alur profil biasa tidak boleh pernah menyentuh
 * hash password.
 *
 * `password_changed_at` dipakai untuk mencabut session yang terbit sebelum
 * pergantian password.
 */
export const userCredentials = pgTable("user_credentials", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  passwordHash: text("password_hash").notNull(),
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

/**
 * Role sebagai baris, bukan kolom, supaya grant/revoke punya jejak sendiri
 * (siapa yang memberi, kapan, kapan dicabut) tanpa menimpa riwayat.
 *
 * Primary key komposit `(user_id, role)`: satu user tidak bisa memegang role
 * yang sama dua kali. **Konsekuensi yang harus diingat subagent RBAC:**
 * memberi role yang sudah pernah dicabut akan bentrok dengan PK, jadi
 * grant ulang harus meng-`UPDATE` baris yang ada dan mengosongkan
 * `revoked_at`, bukan `INSERT`. Sebaliknya, revoke adalah `UPDATE
 * revoked_at`, bukan `DELETE` — menghapus barisnya akan menghilangkan bukti
 * siapa yang pernah memberi.
 *
 * `granted_by_user_id` memakai `set null` supaya menghapus admin tidak
 * menghapus baris role yang pernah ia berikan.
 */
export const userRoles = pgTable("user_roles", {
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  grantedByUserId: uuid("granted_by_user_id").references(() => users.id, { onDelete: "set null" }),
  grantedAt: timestamp("granted_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
}, (table) => [
  primaryKey({ columns: [table.userId, table.role] }),
  index("user_roles_user_id_idx").on(table.userId),
  check("user_roles_role_check", CHECK_ROLE_PENGGUNA),
]);

/**
 * Session server-side. Cookie klien hanya membawa token opaque; yang tersimpan
 * di sini adalah hash-nya, sehingga bocornya isi database tidak langsung
 * menjadi session aktif.
 *
 * `ip_prefix` menyimpan prefix alamat (bukan alamat penuh) — cukup untuk
 * mendeteksi anomali tanpa menyimpan PII yang tidak dibutuhkan.
 *
 * Index `user_id` dipakai logout-semua-device; index `expires_at` dipakai
 * pembersihan session kedaluwarsa.
 */
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  rotatedAt: timestamp("rotated_at", { withTimezone: true, mode: "date" }),
  revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  userAgent: text("user_agent"),
  ipPrefix: text("ip_prefix"),
}, (table) => [
  index("sessions_user_id_idx").on(table.userId),
  index("sessions_expires_at_idx").on(table.expiresAt),
]);

/**
 * Token verifikasi email. Dibuat satu baris per pengiriman; token lama yang
 * belum dikonsumsi tetap valid sampai kedaluwarsa kecuali pemanggil
 * mencabutnya — itu keputusan policy auth, bukan kendala schema.
 *
 * Unik pada `token_hash` supaya dua token dengan nilai sama tidak bisa hidup
 * berdampingan (itu akan membuat redeem ambigu).
 */
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "date" }),
});

/**
 * Token reset password. Bentuknya sengaja identik dengan token verifikasi
 * email: dua alur, satu pola, sehingga helper consume/expire bisa dipakai
 * ulang. Yang membedakan hanya tabel dan policy di pemanggil.
 */
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "date" }),
});

/**
 * Undangan staff. Satu-satunya jalur sah untuk mendapat role verifikator/admin
 * — role tidak boleh berasal dari input publik, jadi baris di sini harus
 * dibuat oleh admin yang sudah ada.
 *
 * `invited_by_user_id` memakai `set null`: menghapus admin yang mengundang
 * tidak boleh mencabut undangan yang mungkin sudah dipakai. Karena itu audit
 * trail "siapa mengundang" harus lengkap selagi barisnya ada.
 *
 * `revoked_at` berbeda dari `consumed_at`: consumed berarti dipakai, revoked
 * berarti dibatalkan tanpa dipakai.
 */
export const staffInvitations = pgTable("staff_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  emailNormalized: text("email_normalized").notNull(),
  role: text("role").notNull(),
  invitedByUserId: uuid("invited_by_user_id").references(() => users.id, { onDelete: "set null" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "date" }),
  revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
}, (table) => [
  index("staff_invitations_email_normalized_idx").on(table.emailNormalized),
  check("staff_invitations_role_check", CHECK_ROLE_UNDANGAN),
]);

/**
 * Audit event. Schema dibuat sekarang, pengisian penuhnya menyusul di Fase 3
 * (lihat `docs/backend-production-plan.md` §5 dan §6).
 *
 * PK-nya `bigserial`, bukan uuid, karena tabel ini append-only dan tumbuh
 * paling cepat: urutan numerik memberi ordering yang stabil untuk pembacaan
 * kronologis, dan 8 byte per baris jauh lebih murah daripada 16. Nilainya
 * di-`number` (mode default bigserial53) — cukup sampai 2^53 baris, dan JS
 * tidak bisa memegang lebih dari itu tanpa bigint.
 *
 * `payload_redacted` bernama begitu sebagai pengingat: yang ditulis ke sini
 * sudah disaring dari secret dan PII yang tidak dibutuhkan. Jangan simpan
 * payload mentah "dulu" lalu berencana meredaksinya nanti — baris audit tidak
 * pernah dihapus.
 *
 * `entity_id` bertipe `text`, bukan uuid: entitas yang diaudit tidak selalu
 * ber-id uuid (bisa slug, nomor eksternal, atau id komposit).
 */
export const auditEvents = pgTable("audit_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  payloadRedacted: jsonb("payload_redacted"),
  requestId: text("request_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  index("audit_events_actor_user_id_idx").on(table.actorUserId),
]);

/**
 * Bagian predikat "event belum selesai" yang **imutable** — aman dipakai di
 * index parsial.
 *
 * Dipisah dari `OUTBOX_LEASE_BEBAS` karena PostgreSQL menolak `now()` di dalam
 * predikat index (`functions in index predicate must be marked IMMUTABLE`).
 * Yang bisa dibekukan ke index hanya kondisi kolom; perbandingan waktu harus
 * dievaluasi saat query. Hasilnya tetap selektif: index menyaring seluruh
 * baris yang sudah `processed_at` atau `dead_lettered_at` — bagian terbesar
 * tabel yang berumur panjang — dan sisanya sangat kecil.
 */
export const OUTBOX_BELUM_SELESAI = sql`"processed_at" is null and "dead_lettered_at" is null`;

/**
 * Lease bebas atau sudah kedaluwarsa — bagian predikat claim yang memakai
 * waktu, jadi **tidak boleh** masuk predikat index parsial di atas. Selalu
 * dipasang di klausa `WHERE` saat claim.
 */
export const OUTBOX_LEASE_BEBAS = sql`("lease_owner" is null or "lease_expires_at" <= now())`;

/**
 * Transactional outbox — **satu-satunya jalur keluar efek samping**.
 *
 * Perubahan bisnis dan baris di sini ditulis dalam transaksi PostgreSQL yang
 * sama, sehingga tidak ada commit bisnis tanpa event yang diwajibkan dan
 * tidak ada event tanpa commit bisnis (plan §6).
 *
 * Aturan yang dikunci:
 *
 * - **`idempotency_key` unique.** Kunci ini yang membuat penulisan event
 *   idempoten: retry penulisan event yang sama (mis. request diulang) tidak
 *   menghasilkan baris kedua, jadi handler tidak pernah dipanggil dua kali
 *   karena kesalahan penulis. Bentuknya ditentukan pemanggil (mis.
 *   `attestation:issued:<id>`), bukan dibangkitkan acak — kunci acak selalu
 *   lolos dan tidak menjamin apa pun.
 * - **`payload_redacted` disaring sebelum insert**, sama seperti
 *   `audit_events`. Handler hanya boleh menerima data yang memang
 *   dibutuhkannya; token/secret/PII mentah tidak pernah masuk baris ini.
 * - **Claim memakai lease, bukan lock tahan lama.** `lease_owner` +
 *   `lease_expires_at` membuat worker yang crash di tengah event dapat
 *   dipulihkan worker lain setelah lease kedaluwarsa, tanpa tabel lock
 *   terpisah dan tanpa double-claim selama lease belum habis.
 * - **State selesai berbeda dari state mati.** `processed_at` berarti sukses;
 *   `dead_lettered_at` + `last_error_code` berarti gagal terminal yang harus
 *   direplay manusia. Menggabungkan keduanya akan membuat "gagal permanen"
 *   terlihat seperti "selesai".
 * - **`available_at` memisahkan penjadwalan dari eksekusi.** Backoff
 *   eksponensial cukup menggeser `available_at` ke depan; tidak perlu
 *   `sleep` di worker.
 *
 * Index parsial `outbox_events_claim_idx` memakai predikat imutable yang sama
 * (`OUTBOX_BELUM_SELESAI`), sehingga pencarian event siap-proses tidak
 * menyentuh baris yang sudah selesai — bagian terbesar tabel yang tumbuh
 * terus. Perbandingan waktu lease tetap dievaluasi di klausa `WHERE` claim.
 */
export const outboxEvents = pgTable("outbox_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(),
  aggregateType: text("aggregate_type").notNull(),
  aggregateId: text("aggregate_id").notNull(),
  payloadRedacted: jsonb("payload_redacted"),
  occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  availableAt: timestamp("available_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  attempts: integer("attempts").notNull().default(0),
  leaseOwner: text("lease_owner"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true, mode: "date" }),
  processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" }),
  lastErrorCode: text("last_error_code"),
  deadLetteredAt: timestamp("dead_lettered_at", { withTimezone: true, mode: "date" }),
  idempotencyKey: text("idempotency_key").notNull().unique(),
}, (table) => [
  index("outbox_events_claim_idx")
    .on(table.availableAt)
    .where(OUTBOX_BELUM_SELESAI),
  index("outbox_events_aggregate_idx").on(table.aggregateType, table.aggregateId),
]);

/**
 * Ledger delivery per sink — pembuktian bahwa efek samping tidak dobel.
 *
 * Satu event boleh dikirim ke beberapa sink (email, audit fan-out, file scan,
 * …). Idempotensi tidak boleh bergantung pada "event ini sudah ter-claim",
 * karena claim boleh dilepas saat retry; yang harus unik adalah **pasangan
 * (event, sink)**. Karena itu PK-nya komposit, bukan uuid: barisnya adalah
 * kunci idempotensi, bukan entitas yang dirujuk dari luar.
 *
 * `event_id` memakai `on delete cascade` — baris ledger tidak punya arti tanpa
 * event-nya, dan event boleh dibersihkan sesuai retention (ADR 0001).
 *
 * `sink` adalah nama kanonik yang dipakai handler (mis. `email`, `audit`);
 * menambah sink baru tidak mengubah schema.
 *
 * `status` memisahkan tiga keadaan yang sering keliru disamakan:
 *
 * - `in_progress` — handler sudah mulai. Baris ditulis **sebelum** efek
 *   samping dijalankan, lalu statusnya diperbarui dalam transaksi yang sama
 *   dengan efeknya. Inilah yang membuat callback + ledger commit atomik: bila
 *   transaksi gagal, baris ikut hilang dan percobaan berikutnya boleh jalan;
 *   bila berhasil, baris `succeeded` menjadi bukti permanen.
 * - `succeeded` — efek samping selesai. Handler berikutnya untuk
 *   `(event, sink)` yang sama **melewatinya**, sehingga retry tidak
 *   menggandakan email/audit.
 * - `failed` — percobaan terakhir gagal. Baris tetap ada supaya retry berikut
 *   boleh mencoba lagi tanpa kehilangan riwayat.
 *
 * Ledger ini menutup celah "dua worker menjalankan sink yang sama" **tanpa
 * index parsial tambahan**: composite PK sudah membuat `(event, sink)` unik
 * apa pun statusnya, jadi klaim kedua tidak bisa lewat sebagai baris kedua —
 * ia wajib meng-UPDATE baris yang ada. Index parsial di kolom yang sama akan
 * mustahil dilanggar terpisah (PK menolak lebih dulu) dan hanya menambah biaya
 * tulis, jadi sengaja tidak dibuat. Idempotensi handler karena itu berbentuk
 * transisi state, bukan penambahan baris.
 */
export const STATUS_DELIVERY = ["in_progress", "succeeded", "failed"] as const;

/** Daftar nilai `outbox_deliveries.status` untuk klausa CHECK, ditulis eksplisit. */
const CHECK_STATUS_DELIVERY = sql`"status" in ('in_progress', 'succeeded', 'failed')`;

export const outboxDeliveries = pgTable("outbox_deliveries", {
  eventId: uuid("event_id")
    .notNull()
    .references(() => outboxEvents.id, { onDelete: "cascade" }),
  sink: text("sink").notNull(),
  status: text("status").notNull().default("in_progress"),
  /** Kapan baris ledger ini terakhir diperbarui. */
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  /** Saat status menjadi `succeeded`. Null selama belum sukses. */
  deliveredAt: timestamp("delivered_at", { withTimezone: true, mode: "date" }),
  /** Kode hasil idempoten dari sink, mis. id pesan provider; nullable bila sink tidak memberi id. */
  resultCode: text("result_code"),
}, (table) => [
  primaryKey({ columns: [table.eventId, table.sink] }),
  index("outbox_deliveries_sink_idx").on(table.sink),
  check("outbox_deliveries_status_check", CHECK_STATUS_DELIVERY),
]);

/**
 * Kunci idempotensi di level **penulisan event** sudah cukup di
 * `outbox_events.idempotency_key` (unique), dan di level **pengiriman** sudah
 * cukup di `outbox_deliveries` (PK `(event_id, sink)`). Tabel ledger
 * idempotensi terpisah sengaja tidak dibuat: belum ada pemanggil yang
 * membutuhkannya, dan tabel yang tidak dibaca adalah tabel yang menyimpang.
 * Bila nanti ada sink yang perlu mem-`dedupe` lintas-event, tambahkan tabelnya
 * lewat migration baru — bukan dengan memperluas salah satu di atas secara
 * diam-diam.
 */

/** Baris `users` sebagaimana dibaca dari database. */
export type User = typeof users.$inferSelect;
/** Baris `users` untuk insert — kolom ber-default boleh dikosongkan. */
export type NewUser = typeof users.$inferInsert;
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
export type UserCredential = typeof userCredentials.$inferSelect;
export type NewUserCredential = typeof userCredentials.$inferInsert;
export type UserRole = typeof userRoles.$inferSelect;
export type NewUserRole = typeof userRoles.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type NewEmailVerificationToken = typeof emailVerificationTokens.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;
export type StaffInvitation = typeof staffInvitations.$inferSelect;
export type NewStaffInvitation = typeof staffInvitations.$inferInsert;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;
export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type NewOutboxEvent = typeof outboxEvents.$inferInsert;
export type OutboxDelivery = typeof outboxDeliveries.$inferSelect;
export type NewOutboxDelivery = typeof outboxDeliveries.$inferInsert;

/** Nilai yang sah untuk `users.status`. */
export type StatusPengguna = (typeof STATUS_PENGGUNA)[number];
/** Nilai yang sah untuk `user_roles.role`. */
export type RolePengguna = (typeof ROLE_PENGGUNA)[number];
/** Nilai yang sah untuk `staff_invitations.role`. */
export type RoleUndanganStaff = (typeof ROLE_UNDANGAN_STAFF)[number];
/** Nilai yang sah untuk `outbox_deliveries.status`. */
export type StatusDelivery = (typeof STATUS_DELIVERY)[number];
