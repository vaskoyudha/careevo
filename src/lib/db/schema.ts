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
  boolean,
  check,
  index,
  integer,
  jsonb,
  primaryKey,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
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

/**
 * Learning evidence — Fase 2 (plan §7). Tabel ini memindahkan enrollment,
 * progres, sesi belajar, dan asesmen dari cookie/file menjadi baris
 * PostgreSQL yang transactional dan bisa diaudit.
 *
 * Konvensi yang dikunci di Fase 2:
 *
 * - **`course_id`/`module_id`/`quiz_id` adalah `text`, bukan uuid.** Id course
 *   berasal dari `data/courses.json` (`crs-…`) dan fixture resource (`r1`),
 *   bukan dari tabel ini. `courses` di bawah hanyalah *referensi sementara*
 *   (cache ringan) sampai Fase 4 memigrasikan CMS penuh; `enrollments.course_id`
 *   sengaja **tidak** ber-FK ke `courses.id` supaya enrollment untuk fixture
 *   resource yang tidak pernah di-persist tetap bekerja.
 * - **`completion_path`** memakai `text` + CHECK, bukan boolean, karena jalur
 *   penyelesaian punya arti (`terverifikasi` vs `informal`) yang tidak muat
 *   dalam satu bit. Satu daftar nilai diekspor (`JALUR_PENYELESAIAN`) dan
 *   dipakai CHECK + Zod, supaya tidak ada dua daftar yang bisa menyimpang.
 * - **`assessment_snapshot` immutable** (ADR 0003): penilaian server hanya
 *   membaca snapshot, tidak pernah membaca ulang `data/kuis.json`.
 */

/** Nilai `completion_path` yang sah. Satu sumber untuk CHECK dan Zod. */
export const JALUR_PENYELESAIAN = ["terverifikasi", "informal"] as const;

/** Daftar nilai `enrollments.status` untuk klausa CHECK. */
export const STATUS_ENROLLMENT = ["active", "completed", "dropped"] as const;
/** Daftar nilai `module_progress.state` untuk klausa CHECK. */
export const STATUS_MODUL_PROGRES = ["in_progress", "completed"] as const;
/** Daftar nilai `learning_runs.state` untuk klausa CHECK. */
export const STATUS_RUN = ["active", "completed", "expired"] as const;
/** Daftar nilai `quiz_attempts.status` untuk klausa CHECK. */
export const STATUS_ATTEMPT = ["in_progress", "submitted"] as const;

const CHECK_JALUR_PENYELESAIAN = sql`"completion_path" in ('terverifikasi', 'informal')`;
const CHECK_STATUS_ENROLLMENT = sql`"status" in ('active', 'completed', 'dropped')`;
const CHECK_STATUS_MODUL_PROGRES = sql`"state" in ('in_progress', 'completed')`;
const CHECK_STATUS_RUN = sql`"state" in ('active', 'completed', 'expired')`;
const CHECK_STATUS_ATTEMPT = sql`"status" in ('in_progress', 'submitted')`;

/**
 * Referensi sementara ke id course existing — cache ringan, bukan source of
 * truth. Diisi saat enrollment, dibaca dashboard untuk menampilkan judul/slug
 * tanpa memanggil store JSON. Fase 4 menggantinya dengan tabel course penuh.
 */
export const courses = pgTable("courses", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  /**
   * Id kursus pasangannya di AI Mastery, atau `null` bila belum pernah disejikan.
   *
   * **Dua ruang id yang berbeda, jadi pemetaan ini wajib disimpan.** AI Mastery
   * membuat id-nya sendiri (`course_<hex>`, `deeptutor/services/courses.py`) dan
   * API-nya tidak menerima id dari pemanggil — jadi `courses.id` Careevo tidak
   * pernah bisa menjadi id sana. Tanpa kolom ini, `?course=<id Careevo>` selalu
   * ditolak backend dan `course_study` tidak pernah aktif.
   *
   * `null` berarti "belum disejikan", bukan "tidak boleh": `null` dan id yang
   * salah menghasilkan perilaku yang sama di sisi AI Mastery, jadi distinguishnya
   * tidak menambah informasi apa pun.
   */
  aiCourseId: text("ai_course_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

/**
 * Keikutsertaan peserta pada sebuah kursus — pengganti cookie `ls_enroll`.
 *
 * `unique(user_id, course_id)` adalah penjamin idempotensi: mendaftar dua kali
 * (klik ganda, request paralel) hanya menghasilkan satu baris; pelanggarannya
 * diterjemahkan pemanggil menjadi "sudah terdaftar", bukan baris kedua.
 */
export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: text("course_id").notNull(),
    status: text("status").notNull().default("active"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    completionPath: text("completion_path"),
  },
  (table) => [
    unique("enrollments_user_course_unique").on(table.userId, table.courseId),
    index("enrollments_course_id_idx").on(table.courseId),
    check("enrollments_status_check", CHECK_STATUS_ENROLLMENT),
    check("enrollments_completion_path_check", CHECK_JALUR_PENYELESAIAN),
  ],
);

/**
 * Progres satu modul di dalam satu enrollment.
 *
 * `state: "in_progress" | "completed"` (bukan boolean) supaya pembatalan tanda
 * informal bisa dibedakan dari "belum mulai", dan `completion_path` mencatat
 * jalurnya. `evidence_id` adalah referensi **lunak** (uuid, tanpa FK) ke
 * `quiz_attempts.id` atau `learning_runs.id` yang menjadi bukti penyelesaian —
 * lunak karena bukti credential tidak boleh ikut terhapus oleh cleanup attempt.
 */
export const moduleProgress = pgTable(
  "module_progress",
  {
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    moduleId: text("module_id").notNull(),
    state: text("state").notNull().default("in_progress"),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    completionPath: text("completion_path"),
    evidenceId: uuid("evidence_id"),
  },
  (table) => [
    primaryKey({ columns: [table.enrollmentId, table.moduleId] }),
    check("module_progress_state_check", CHECK_STATUS_MODUL_PROGRES),
    check("module_progress_completion_path_check", CHECK_JALUR_PENYELESAIAN),
  ],
);

/**
 * Sesi belajar terverifikasi — pengganti berkas `.data/sessions/*.json`.
 *
 * `integrity_version` menyimpan versi kebijakan (`KebijakanCourse.versi`) yang
 * berlaku saat run dimulai: versi ikut diperiksa saat memvalidasi bukti, sama
 * seperti invariant berkas lama. Query diindeks oleh `user_id`, `course_id`,
 * `state`, dan `expires_at` — tidak ada lagi scan direktori `readdir`.
 */
export const learningRuns = pgTable(
  "learning_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    courseId: text("course_id").notNull(),
    moduleId: text("module_id"),
    state: text("state").notNull().default("active"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    integrityVersion: integer("integrity_version").notNull().default(1),
    metadataRedacted: jsonb("metadata_redacted"),
  },
  (table) => [
    index("learning_runs_user_id_idx").on(table.userId),
    index("learning_runs_course_id_idx").on(table.courseId),
    index("learning_runs_state_idx").on(table.state),
    index("learning_runs_expires_at_idx").on(table.expiresAt),
    check("learning_runs_state_check", CHECK_STATUS_RUN),
  ],
);

/**
 * Kejadian integritas sebuah run — pengganti `SessionRun.kejadian[]`.
 *
 * `unique(learning_run_id, sequence)` adalah invariant anti-replay: event dengan
 * sequence yang sama tidak bisa disisipkan dua kali, dan sequence yang dilompati
 * tidak bisa diisi belakangan (sequence di-generate `max+1` di repository, bukan
 * dari klien). `payload_redacted` disaring sebelum insert, sama seperti outbox.
 */
export const learningEvents = pgTable(
  "learning_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    learningRunId: uuid("learning_run_id")
      .notNull()
      .references(() => learningRuns.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    sequence: integer("sequence").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    payloadRedacted: jsonb("payload_redacted"),
  },
  (table) => [
    unique("learning_events_run_sequence_unique").on(table.learningRunId, table.sequence),
    index("learning_events_run_id_idx").on(table.learningRunId),
  ],
);

/**
 * Percobaan asesmen verified — snapshot immutable per attempt (ADR 0003).
 *
 * `assessment_snapshot` memuat seluruh definisi `Kuis` saat attempt dikirim
 * (judul, `soal[]` + kunci, `nilai_lulus`); `assessment_definition_version`
 * adalah hash SHA-256 bentuk JSON kanonik snapshot. Penilaian server membaca
 * **hanya** snapshot — mengubah/menghapus kuis di bank setelahnya tidak
 * mengubah outcome historis.
 *
 * `attempt_number` + `unique(enrollment_id, quiz_id, attempt_number)` mencegah
 * pengiriman ganda attempt yang sama menghasilkan dua baris skor.
 */
export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    quizId: text("quiz_id"),
    assessmentDefinitionVersion: text("assessment_definition_version").notNull(),
    assessmentSnapshot: jsonb("assessment_snapshot").notNull(),
    status: text("status").notNull().default("in_progress"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" }),
    score: integer("score"),
    gradingVersion: integer("grading_version").notNull().default(1),
    attemptNumber: integer("attempt_number").notNull().default(1),
  },
  (table) => [
    unique("quiz_attempts_enrollment_quiz_attempt_unique").on(
      table.enrollmentId,
      table.quizId,
      table.attemptNumber,
    ),
    index("quiz_attempts_user_id_idx").on(table.userId),
    index("quiz_attempts_enrollment_id_idx").on(table.enrollmentId),
    check("quiz_attempts_status_check", CHECK_STATUS_ATTEMPT),
  ],
);

/**
 * Jawaban per soal dalam satu attempt.
 *
 * `selected_option` adalah indeks ke `pilihan[]` pada snapshot, bukan teks;
 * `is_correct` dihitung server terhadap `jawaban_benar` snapshot. PK komposit
 * `(quiz_attempt_id, question_id)` menjamin satu jawaban per soal per attempt.
 */
export const quizAttemptAnswers = pgTable(
  "quiz_attempt_answers",
  {
    quizAttemptId: uuid("quiz_attempt_id")
      .notNull()
      .references(() => quizAttempts.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull(),
    selectedOption: integer("selected_option").notNull(),
    isCorrect: boolean("is_correct"),
    questionSnapshotRef: text("question_snapshot_ref"),
  },
  (table) => [primaryKey({ columns: [table.quizAttemptId, table.questionId] })],
);

/**
 * Penyelesaian kursus — satu baris per enrollment (unique), bukan deret waktu.
 *
 * `enrollment_id` unik adalah penjamin "tidak ada double completion": dua
 * request completion paralel saling berlomba, dan hanya satu yang menang insert;
 * yang lain melihat baris yang sudah ada dan dianggap idempoten. `policy_version`
 * mencatat versi kebijakan yang dipakai saat completion, supaya perubahan
 * kebijakan kelak tidak menulis ulang arti completion lama.
 */
export const courseCompletions = pgTable(
  "course_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: text("course_id").notNull(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .unique()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    completionPath: text("completion_path").notNull(),
    policyVersion: integer("policy_version").notNull(),
  },
  (table) => [
    index("course_completions_user_id_idx").on(table.userId),
    check("course_completions_completion_path_check", CHECK_JALUR_PENYELESAIAN),
  ],
);

/**
 * Submission, review, badge, dan attestation — Fase 3 (plan §7 "Fase 3").
 *
 * State machine submission hidup di `ReviewService`; transition ditegakkan
 * compare-and-set di repository. Attestation authoritative di database:
 * issuance, key version, dan status active/revoked tersimpan di sini, dan
 * endpoint verify publik membaca baris `attestations` — bukan hanya memverifikasi
 * signature stateless.
 *
 * Aturan yang dikunci:
 *
 * - **`public_token` opaque, bukan id sequence.** `attestations.id` adalah uuid
 *   internal; `public_token` adalah nilai acak base64url yang tidak menurunkan
 *   id. Kebocoran satu token tidak boleh memungkinkan menebak token lain, dan
 *   urutan penerbitan tidak boleh terbaca dari token.
 * - **Paling banyak satu attestation `active` per review.** Partial unique
 *   index `attestations_active_review_unique` (`WHERE status = 'active'`)
 *   menggagalkan penerbitan ganda di constraint, bukan di pengecekan aplikasi.
 *   Re-issuance setelah revoke tetap sah: baris lama ber-`revoked`, baris baru
 *   `active` tidak bentrok dengan index.
 * - **Credential yang dipakai tidak boleh dihapus.** `reviews` di-`restrict`
 *   oleh `attestations.source_review_id`; `submissions`/`submission_versions`
 *   di-`restrict` oleh `reviews`. Bukti yang sudah jadi credential harus hidup
 *   sampai lifecycle revocation/replacement-nya dieksekusi eksplisit.
 * - **Status memakai `text` + CHECK, bukan pgEnum**, konsisten dengan konvensi
 *   Fase 1/2. Nilai diekspor sebagai konstanta (`STATUS_SUBMISSION`, dll.)
 *   supaya CHECK dan Zod memakai satu daftar.
 */

/** Nilai `submissions.status` yang sah. */
export const STATUS_SUBMISSION = [
  "draft",
  "submitted",
  "assigned",
  "in_review",
  "approved",
  "rejected",
  "changes_requested",
] as const;

/** Nilai `attestations.status` yang sah. */
export const STATUS_ATTESTATION = ["active", "revoked"] as const;

const CHECK_STATUS_SUBMISSION = sql`"status" in ('draft', 'submitted', 'assigned', 'in_review', 'approved', 'rejected', 'changes_requested')`;
const CHECK_STATUS_ATTESTATION = sql`"status" in ('active', 'revoked')`;

/**
 * Submission learner — kepala dari alur review.
 *
 * `course_id`/`enrollment_id` nullable: submission bisa mengikat kursus (alur
 * credential dari learning evidence Fase 2) atau berdiri sendiri (demo/portofolio).
 * `assigned_reviewer_user_id` memakai `set null` supaya menghapus reviewer tidak
 * menghapus jejak assignment.
 */
export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: text("course_id"),
    enrollmentId: uuid("enrollment_id").references(() => enrollments.id, {
      onDelete: "set null",
    }),
    /**
     * Topik jalur penguasaan yang menjadi bukti submission ini, atau `null`.
     *
     * **Referensi lunak, tanpa FK** — sama seperti `module_progress.evidence_id`.
     * Topik disimpan di `.data/mastery/<hash>/<id>.json` dan **bisa** dihapus
     * peserta; references yang menghambat penghapusan akan membuat kredensial
     * yang sudah terbit bisa ikut runtuh. Karena itu bukti credential bukan
     * kolom ini, melainkan `submission_versions.content_snapshot` yang dibekukan
     * server (`src/lib/mastery/selesai.ts`, `snapshotsBuktiJalur`): snapshot
     * sudah immutable dan sudah di-`restrict`, jadi menghapus topik tidak
     * merusak badge.
     */
    masteryTopicId: text("mastery_topic_id"),
    status: text("status").notNull().default("draft"),
    currentVersion: integer("current_version").notNull().default(0),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" }),
    assignedReviewerUserId: uuid("assigned_reviewer_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("submissions_user_id_idx").on(table.userId),
    index("submissions_status_idx").on(table.status),
    index("submissions_reviewer_idx").on(table.assignedReviewerUserId),
    check("submissions_status_check", CHECK_STATUS_SUBMISSION),
    // Satu submission tidak boleh terikat kursus **dan** jalur sekaligus:
    // kredensial yang ditandatangani berbeda akan memunculkan dua klaim yang
    // benar. Keduanya `null` = submission portofolio, yang tetap berdiri sendiri.
    check(
      "submissions_binding_check",
      sql`not ("course_id" is not null and "mastery_topic_id" is not null)`,
    ),
  ],
);

/**
 * Versi isi submission — snapshot konten yang di-review, append-only per submission.
 *
 * `content_snapshot` (jsonb) adalah isi yang dibekukan saat versi dibuat;
 * `unique(submission_id, version)` menjamin versi tidak bisa ditimpa. Review
 * menunjuk versi, bukan submission, supaya konten yang di-review tidak berubah
 * oleh resubmit di tengah proses.
 */
export const submissionVersions = pgTable(
  "submission_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    contentSnapshot: jsonb("content_snapshot").notNull(),
    evidenceFileId: uuid("evidence_file_id"),
    submittedByUserId: uuid("submitted_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    unique("submission_versions_submission_version_unique").on(table.submissionId, table.version),
    index("submission_versions_submission_id_idx").on(table.submissionId),
  ],
);

/**
 * Review — keputusan verifikator terhadap satu versi submission.
 *
 * `rubric_snapshot` membekukan skala/rubrik saat review; `score` adalah hasil
 * komputasi server dari rubrik (bukan angka mentah dari klien). `superseded_at`
 * menandai review yang digantikan review lebih baru atas versi yang sama.
 *
 * Baris ini di-`restrict` oleh `attestations.source_review_id`: review yang sudah
 * menerbitkan credential tidak boleh dihapus.
 */
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "restrict" }),
    submissionVersionId: uuid("submission_version_id")
      .notNull()
      .references(() => submissionVersions.id, { onDelete: "restrict" }),
    reviewerUserId: uuid("reviewer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    decision: text("decision").notNull(),
    rubricSnapshot: jsonb("rubric_snapshot").notNull(),
    score: integer("score"),
    rationale: text("rationale").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    supersededAt: timestamp("superseded_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("reviews_submission_id_idx").on(table.submissionId),
    index("reviews_reviewer_idx").on(table.reviewerUserId),
    check(
      "reviews_decision_check",
      sql`"decision" in ('approved', 'changes_requested', 'rejected')`,
    ),
  ],
);

/**
 * Badge — hasil credential atas review yang disetujui.
 *
 * `revoked_at` nullable adalah penanda aktif/turun (active = `revoked_at is
 * null`). `source_review_id` unique: satu review menghasilkan paling banyak
 * satu badge. `type` membedakan bentuk badge (mis. `course_completion` vs
 * `task`); nilainya teks bebas supaya menambah jenis tidak butuh migration.
 */
export const badges = pgTable(
  "badges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    sourceReviewId: uuid("source_review_id")
      .notNull()
      .unique()
      .references(() => reviews.id, { onDelete: "restrict" }),
    issuedAt: timestamp("issued_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("badges_user_id_idx").on(table.userId),
  ],
);

/**
 * Attestation — token public yang diverifikasi tanpa login.
 *
 * `payload_canonical` adalah string JSON kanonik (key terurut) yang persis
 * ditandatangani, bukan jsonb: verifikasi tidak bergantung pada key-order
 * PostgreSQL. `public_token` opaque; `key_version` mencatat kunci yang dipakai.
 * `status` adalah sumber kebenaran yang dibaca endpoint verify publik.
 */
export const attestations = pgTable(
  "attestations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publicToken: text("public_token").notNull().unique(),
    subjectUserId: uuid("subject_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    sourceReviewId: uuid("source_review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "restrict" }),
    badgeId: uuid("badge_id").references(() => badges.id, { onDelete: "set null" }),
    payloadCanonical: text("payload_canonical").notNull(),
    signature: text("signature").notNull(),
    keyVersion: integer("key_version").notNull().default(1),
    status: text("status").notNull().default("active"),
    issuedAt: timestamp("issued_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    revokedByUserId: uuid("revoked_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    revocationReason: text("revocation_reason"),
  },
  (table) => [
    // Paling banyak satu attestation aktif per review. Re-issue setelah revoke
    // membuat baris lama `revoked`, baris baru `active` — tidak bentrok.
    uniqueIndex("attestations_active_review_unique")
      .on(table.sourceReviewId)
      .where(sql`"status" = 'active'`),
    index("attestations_subject_idx").on(table.subjectUserId),
    check("attestations_status_check", CHECK_STATUS_ATTESTATION),
  ],
);

/**
 * Log lifecycle sebuah attestation — append-only (issued/revoked).
 *
 * `payload_redacted` disaring sebelum insert; `actor_user_id` null untuk
 * peristiwa sistem.
 */
export const attestationEvents = pgTable(
  "attestation_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attestationId: uuid("attestation_id")
      .notNull()
      .references(() => attestations.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    payloadRedacted: jsonb("payload_redacted"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("attestation_events_attestation_id_idx").on(table.attestationId),
    check("attestation_events_kind_check", sql`"kind" in ('issued', 'revoked')`),
  ],
);

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
export type CourseRef = typeof courses.$inferSelect;
export type NewCourseRef = typeof courses.$inferInsert;
export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;
export type ModuleProgressRow = typeof moduleProgress.$inferSelect;
export type NewModuleProgressRow = typeof moduleProgress.$inferInsert;
export type LearningRun = typeof learningRuns.$inferSelect;
export type NewLearningRun = typeof learningRuns.$inferInsert;
export type LearningEvent = typeof learningEvents.$inferSelect;
export type NewLearningEvent = typeof learningEvents.$inferInsert;
export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type NewQuizAttempt = typeof quizAttempts.$inferInsert;
export type QuizAttemptAnswer = typeof quizAttemptAnswers.$inferSelect;
export type NewQuizAttemptAnswer = typeof quizAttemptAnswers.$inferInsert;
export type CourseCompletion = typeof courseCompletions.$inferSelect;
export type NewCourseCompletion = typeof courseCompletions.$inferInsert;
export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
export type SubmissionVersion = typeof submissionVersions.$inferSelect;
export type NewSubmissionVersion = typeof submissionVersions.$inferInsert;
export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
export type Badge = typeof badges.$inferSelect;
export type NewBadge = typeof badges.$inferInsert;
export type Attestation = typeof attestations.$inferSelect;
export type NewAttestation = typeof attestations.$inferInsert;
export type AttestationEvent = typeof attestationEvents.$inferSelect;
export type NewAttestationEvent = typeof attestationEvents.$inferInsert;

/** Nilai yang sah untuk `users.status`. */
export type StatusPengguna = (typeof STATUS_PENGGUNA)[number];
/** Nilai yang sah untuk `user_roles.role`. */
export type RolePengguna = (typeof ROLE_PENGGUNA)[number];
/** Nilai yang sah untuk `staff_invitations.role`. */
export type RoleUndanganStaff = (typeof ROLE_UNDANGAN_STAFF)[number];
/** Nilai yang sah untuk `outbox_deliveries.status`. */
export type StatusDelivery = (typeof STATUS_DELIVERY)[number];
/** Nilai yang sah untuk `completion_path`. */
export type JalurPenyelesaian = (typeof JALUR_PENYELESAIAN)[number];
/** Nilai yang sah untuk `enrollments.status`. */
export type StatusEnrollment = (typeof STATUS_ENROLLMENT)[number];
/** Nilai yang sah untuk `module_progress.state`. */
export type StatusModulProgres = (typeof STATUS_MODUL_PROGRES)[number];
/** Nilai yang sah untuk `learning_runs.state`. */
export type StatusRun = (typeof STATUS_RUN)[number];
/** Nilai yang sah untuk `quiz_attempts.status`. */
export type StatusAttempt = (typeof STATUS_ATTEMPT)[number];
/** Nilai yang sah untuk `submissions.status`. */
export type StatusSubmission = (typeof STATUS_SUBMISSION)[number];
/** Nilai yang sah untuk `attestations.status`. */
export type StatusAttestation = (typeof STATUS_ATTESTATION)[number];
