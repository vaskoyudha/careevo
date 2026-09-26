/**
 * Application service auth — **server-only**.
 *
 * Ini permukaan yang dipanggil Server Action. Aturan yang dikunci:
 *
 * - **Tidak ada klaim bisnis yang dibaca dari browser.** Fungsi di sini menerima
 *   nilai yang **sudah divalidasi Zod** oleh pemanggil, sebagai argumen. Tidak
 *   ada `FormData` di modul ini; khususnya, role tidak pernah datang dari input
 *   publik — `daftarPengguna` selalu memberi `["user"]`.
 * - **Satu operasi bisnis = satu transaksi.** Registrasi menulis `users` +
 *   `user_credentials` + `user_roles` dalam satu transaksi database. Tanpa itu,
 *   kegagalan di tengah meninggalkan user tanpa kredensial (tidak bisa login,
 *   dan emailnya sudah terpakai) atau user tanpa role.
 * - **Keunikan ditegakkan constraint, bukan pengecekan.** Pengecekan
 *   "email sudah dipakai?" ada untuk pesan yang ramah; dua pendaftaran paralel
 *   sama-sama lolos pengecekan itu. Yang benar-benar menjaga adalah unique index
 *   di database, dan pelanggarannya diterjemahkan di `petakanGalatUnik`.
 * - **Login tidak membocorkan email mana yang ada.** Email yang tidak dikenal
 *   tetap menjalankan verifikasi Argon2 terhadap hash umpan, supaya waktu
 *   responsnya tidak menjadi oracle enumerasi akun.
 * - **Hasil memuat alasan, bukan `null`.** Pemanggil butuh membedakan
 *   "kredensial salah" dari "email sudah dipakai" untuk memilih pesan; yang
 *   dijaga adalah pesan itu tidak membocorkan lebih dari yang perlu (lihat
 *   pemetaan status di `masukPengguna`).
 *
 * Nama fungsi bisnis berbahasa Indonesia mengikuti idiom repo
 * (`daftarPengguna`, `masukPengguna`, `cabutSession`); tipe dan helper
 * infrastruktur tetap Inggris.
 */

import { getDb } from "@/lib/db/client";
import { catatAudit } from "@/lib/auth/audit";
import { hashPassword, hashUmpanWaktu, verifyPassword } from "./password";
import { safeEqual, hashToken } from "./token";
import { findDemoAccount } from "./demo-accounts";
import {
  ambilKredensial,
  ambilRolesAktif,
  buatUser,
  cariUserByEmail,
  cariUserById,
  cariUserByUsername,
  grantRoleAwal,
  normalisasiEmail,
  normalisasiUsername,
  simpanKredensial,
  type EksekutorDb,
} from "./identity-repository";
import {
  buatSession,
  cariSessionAktifByTokenHash,
  revokeSemuaSessionUser,
  revokeSession,
  revokeSessionByTokenHash,
  rotasiSession,
  TTL_SESI_MS,
  type MetadataSession,
} from "./session-repository";
import { hanyaRoleSah, roleTertinggi, type SessionPrincipal } from "./principal";
import type { Role } from "./types";

/** Role yang boleh diberikan pendaftaran publik. Satu nilai, bukan enum. */
export const ROLE_PENDAFTARAN_PUBLIK: Role = "user";

/** Hasil registrasi: principal siap dipakai membuat sesi, atau alasan gagal. */
export type HasilDaftar =
  | { ok: true; principal: SessionPrincipal }
  | { ok: false; alasan: "email_dipakai" | "username_dipakai" };

/** Hasil login: principal, atau penolakan yang seragam. */
export type HasilMasuk =
  | { ok: true; principal: SessionPrincipal }
  | { ok: false; alasan: "kredensial_salah" | "nonaktif" };

/** Metadata request yang ikut disimpan ke baris sesi. */
export type KonteksRequest = MetadataSession;

/**
 * Ubah baris database menjadi principal.
 *
 * `role` diisi `roleTertinggi(roles)` — field kompatibilitas untuk ~17 call site
 * lama. `roles` diteruskan apa adanya; pemanggil menjamin minimal `["user"]`.
 */
function bangunPrincipal(input: {
  userId: string;
  email: string;
  nama: string;
  username: string;
  roles: Role[];
}): SessionPrincipal {
  return {
    userId: input.userId,
    email: input.email,
    nama: input.nama,
    username: input.username,
    roles: input.roles,
    role: roleTertinggi(input.roles),
    iat: Date.now(),
  };
}

/**
 * Role efektif: yang sah dari database, atau `["user"]` bila kosong/seluruhnya
 * tak dikenal. Learner adalah default yang aman; principal tanpa role tidak
 * boleh gagal-terbuka menjadi staff.
 */
function rolesEfektif(rolesDb: string[]): Role[] {
  const sah = hanyaRoleSah(rolesDb);
  return sah.length > 0 ? sah : [ROLE_PENDAFTARAN_PUBLIK];
}

/**
 * Terjemahkan pelanggaran unique dari PostgreSQL menjadi alasan domain.
 *
 * Memeriksa `constraint`/`detail` alih-alih teks pesan mentah: pesan dapat
 * berubah antar versi dan locale, nama constraint tidak. `code 23505` adalah
 * SQLSTATE unique_violation. Drizzle membungkus galat driver, jadi kode bisa
 * berada di `error.code` atau `error.cause.code`.
 */
function petakanGalatUnik(error: unknown): "email_dipakai" | "username_dipakai" | null {
  const kandidat = error as {
    code?: string;
    constraint?: string;
    detail?: string;
    cause?: { code?: string; constraint?: string; detail?: string };
  };
  const code = kandidat?.code ?? kandidat?.cause?.code;
  if (code !== "23505") return null;

  const teks = `${kandidat.constraint ?? kandidat.cause?.constraint ?? ""} ${
    kandidat.detail ?? kandidat.cause?.detail ?? ""
  }`.toLowerCase();
  // Nama constraint/index memuat nama kolomnya, jadi satu pemeriksaan menangkap
  // kedua bentuk penamaan.
  if (teks.includes("username")) return "username_dipakai";
  if (teks.includes("email")) return "email_dipakai";
  return null;
}

/**
 * Daftarkan pengguna baru dan kembalikan principal-nya.
 *
 * `role` **tidak** menjadi parameter: publik hanya boleh melahirkan learner.
 * Provisioning staff adalah alur undangan/admin, dan sebelumnya justru celah
 * yang membuat `verifikator` bisa mendaftar sendiri.
 *
 * Urutan di dalam transaksi penting: user dulu (kredensial dan role memakai FK
 * ke `users.id`), lalu kredensial, lalu role. Kegagalan di salah satu langkah
 * me-rollback ketiganya.
 */
export async function daftarPengguna(input: {
  nama: string;
  username: string;
  email: string;
  password: string;
}): Promise<HasilDaftar> {
  const emailNormalized = normalisasiEmail(input.email);
  const usernameNormalized = normalisasiUsername(input.username);
  const displayName = input.nama.trim();

  // Hash di luar transaksi: Argon2id sengaja lambat, dan menahan transaksi
  // selama puluhan milidetik mengunci baris serta menghabiskan slot pool.
  const passwordHash = await hashPassword(input.password);

  try {
    return await getDb().transaction(async (tx) => {
      // Cek ramah sebelum insert. Ini BUKAN penjamin keunikan — dua pendaftaran
      // paralel dapat sama-sama lolos di sini; unique index yang menjaminnya.
      const sudahEmail = await cariUserByEmail(tx, emailNormalized);
      if (sudahEmail) return { ok: false as const, alasan: "email_dipakai" as const };

      const sudahUsername = await cariUserByUsername(tx, usernameNormalized);
      if (sudahUsername) return { ok: false as const, alasan: "username_dipakai" as const };

      const user = await buatUser(tx, {
        emailNormalized,
        usernameNormalized,
        displayName,
      });
      await simpanKredensial(tx, { userId: user.id, passwordHash });
      await grantRoleAwal(tx, { userId: user.id, role: ROLE_PENDAFTARAN_PUBLIK });
      await catatAudit(tx, {
        actorUserId: user.id,
        action: "user.registered",
        entityType: "user",
        entityId: user.id,
        payloadRedacted: {},
      });

      return {
        ok: true as const,
        principal: bangunPrincipal({
          userId: user.id,
          email: user.emailNormalized,
          nama: user.displayName,
          username: user.usernameNormalized,
          roles: [ROLE_PENDAFTARAN_PUBLIK],
        }),
      };
    });
  } catch (error) {
    const alasan = petakanGalatUnik(error);
    if (alasan) return { ok: false, alasan };
    throw error;
  }
}

/**
 * Verifikasi kredensial dan terbitkan sesi baru.
 *
 * Rotasi: bila request datang dengan sesi lama yang sah (`sessionLamaId`), sesi
 * itu ditandai `rotated_at` dan sesi baru diterbitkan. Token yang baru selalu
 * berbeda, jadi menyalin cookie lama tidak memberi penyerang sesi yang ikut
 * diperbarui.
 *
 * `sessionLamaId` harus berasal dari `sesiAktifDariToken` (atau pembacaan
 * setara yang memakai `cariSessionAktifByTokenHash`), bukan dari cookie mentah:
 * hanya predikat itu yang menolak sesi yang sudah dicabut, sudah dirotasi, atau
 * kedaluwarsa. `rotasiSession` sendiri juga memverifikasi ulang bahwa sesi itu
 * milik user yang baru lolos autentikasi, sehingga id yang dipalsukan tidak
 * bisa menandai sesi orang lain.
 *
 * Email/password hanya dari argumen. Handler demo akun (lihat
 * `demo-accounts.ts`) diperiksa lebih dulu oleh pemanggil bila memang diizinkan
 * di environment itu.
 */
export async function masukPengguna(input: {
  email: string;
  password: string;
  konteks?: KonteksRequest;
  /** Id sesi lama untuk dirotasi, bila request datang dengan cookie sesi. */
  sessionLamaId?: string | null;
}): Promise<{ hasil: HasilMasuk; token?: string }> {
  const emailNormalized = normalisasiEmail(input.email);
  const db = getDb();

  const user = await cariUserByEmail(db, emailNormalized);

  if (!user) {
    // Rata waktu: verifikasi terhadap hash umpan supaya "email tidak ada" tidak
    // kembali lebih cepat daripada "password salah".
    await verifyPassword(await hashUmpanWaktu(), input.password);
    return { hasil: { ok: false, alasan: "kredensial_salah" } };
  }

  const kredensial = await ambilKredensial(db, user.id);
  let cocok = false;
  if (kredensial) {
    cocok = await verifyPassword(kredensial.passwordHash, input.password);
  } else {
    // User tanpa baris kredensial (mis. dibuat manual) tetap membayar biaya
    // verifikasi, lalu ditolak.
    await verifyPassword(await hashUmpanWaktu(), input.password);
  }

  if (!cocok) {
    return { hasil: { ok: false, alasan: "kredensial_salah" } };
  }

  // Status diperiksa SETELAH kredensial terbukti benar: memberi tahu "akun
  // dinonaktifkan" sebelum password diverifikasi akan mengonfirmasi bahwa akun
  // itu ada kepada siapa pun yang menebak emailnya.
  if (user.status !== "active") {
    return { hasil: { ok: false, alasan: "nonaktif" } };
  }

  const { token } = await rotasiSession(db, {
    sessionLamaId: input.sessionLamaId ?? null,
    userId: user.id,
    expiresAt: new Date(Date.now() + TTL_SESI_MS),
    userAgent: input.konteks?.userAgent ?? null,
    ipPrefix: input.konteks?.ipPrefix ?? null,
  });

  return {
    hasil: {
      ok: true,
      principal: bangunPrincipal({
        userId: user.id,
        email: user.emailNormalized,
        nama: user.displayName,
        username: user.usernameNormalized,
        roles: rolesEfektif(await ambilRolesAktif(db, user.id)),
      }),
    },
    token,
  };
}

/**
 * Muat principal dari token cookie mentah.
 *
 * Inilah jalur `getSession()`. Urutannya: hash token → cari sesi **aktif**
 * (belum dicabut, belum kedaluwarsa) → muat user → muat role aktif.
 *
 * Mengembalikan `null` untuk setiap kegagalan tanpa membedakannya ke pemanggil:
 * token tidak dikenal, sesi dicabut, sesi kedaluwarsa, dan user yang sudah
 * dihapus semuanya berarti "belum masuk", dan membedakannya di response hanya
 * memberi penyerang informasi.
 *
 * User yang `status`-nya bukan `active` juga ditolak — menonaktifkan akun harus
 * langsung mencabut aksesnya, bukan menunggu sesinya kedaluwarsa.
 */
export async function principalDariToken(token: string): Promise<SessionPrincipal | null> {
  if (!token) return null;
  const db = getDb();

  const session = await cariSessionAktifByTokenHash(db, hashToken(token));
  if (!session) return null;

  const user = await cariUserById(db, session.userId);
  if (!user || user.status !== "active") return null;

  return bangunPrincipal({
    userId: user.id,
    email: user.emailNormalized,
    nama: user.displayName,
    username: user.usernameNormalized,
    roles: rolesEfektif(await ambilRolesAktif(db, user.id)),
  });
}

/**
 * Cabut sesi milik token ini (logout perangkat sekarang).
 *
 * Idempoten: token yang sudah dicabut/tidak ada tetap dianggap selesai, karena
 * tujuan pemanggilnya sama — setelah ini token itu tidak boleh bekerja lagi.
 */
export async function keluarSession(token: string): Promise<void> {
  if (!token) return;
  await revokeSessionByTokenHash(getDb(), hashToken(token));
}

/** Cabut sesi berdasarkan id. Dipakai jalur RBAC/admin. */
export async function cabutSession(db: EksekutorDb, sessionId: string): Promise<boolean> {
  return revokeSession(db, sessionId);
}

/**
 * Cabut semua sesi user (mis. setelah reset password, atau tombol
 * "keluar dari semua perangkat"). Mengembalikan jumlah sesi yang dicabut.
 */
export async function cabutSemuaSession(db: EksekutorDb, userId: string): Promise<number> {
  return revokeSemuaSessionUser(db, userId);
}

/**
 * Cabut semua sesi user **kecuali** sesi yang sedang dipakai.
 *
 * Ini yang membedakan "logout semua perangkat" dari "logout di perangkat lain":
 * pemanggil memegang id sesi aktifnya sendiri, dan sesi itulah yang dikecualikan.
 */
export async function keluarPerangkatLain(
  db: EksekutorDb,
  userId: string,
  sessionIdSekarang: string,
): Promise<number> {
  return revokeSemuaSessionUser(db, userId, { kecualiSessionId: sessionIdSekarang });
}

/**
 * Sesi aktif milik sebuah token, untuk pemanggil yang butuh barisnya (mis. `id`). */
export async function sesiAktifDariToken(token: string) {
  if (!token) return undefined;
  return cariSessionAktifByTokenHash(getDb(), hashToken(token));
}

/**
 * Authentikasi email/password dengan **satu** perjalanan ke database.
 *
 * Inilah pintu yang dipakai `loginAction`. Ia menggabungkan verifikasi
 * kredensial dan penerbitan sesi supaya token yang keluar sudah pasti berasal
 * dari principal yang baru diverifikasi — pemanggil tidak dapat (dan tidak
 * perlu) memasangkan principal dari satu query dengan token dari query lain.
 *
 * ## Akun demo
 *
 * Akun demo adalah affordance prototype: kredensial tetap yang dipublikasikan di
 * repositori dan di halaman `/masuk`. Ia **bukan** akun di database, jadi
 * principal-nya tidak punya `userId` — dan gate RBAC menolak principal tanpa
 * `userId`.
 *
 * Jalan keluarnya bukan melonggarkan gate, melainkan **mem-provisioning** user
 * demo di database saat pertama kali login demo berhasil. User demo adalah baris
 * `users` + `user_credentials` + `user_roles` yang biasa; setelah itu ia tunduk
 * pada aturan yang sama dengan user lain (role dari database, pencabutan role
 * berlaku pada request berikutnya, sesi dapat dicabut).
 *
 * `izinkanDemo` sengaja berupa argumen eksplisit, bukan bacaan `process.env` di
 * dalam fungsi: `findDemoAccount` sudah fail-closed (hanya `NODE_ENV=development`
 * **dan** `DEMO_MODE=1`), dan meneruskannya sebagai parameter membuat test dapat
 * menguji kedua sisi tanpa mengubah env global.
 *
 * Bila `izinkanDemo` benar tetapi akunnya bukan akun demo, jalur ini sama dengan
 * login biasa. Bila emailnya akun demo tetapi passwordnya salah, hasilnya
 * penolakan — bukan pembuatan user.
 *
 * Rotasi sesi (`sessionLamaId`) juga berlaku untuk akun demo: ia datang dari
 * pemanggil sebagai id yang **sudah diverifikasi** milik sesi aktif
 * (`sesiAktifDariToken`), bukan dari cookie mentah, dan `rotasiSession` tetap
 * mencocokkannya dengan `userId` principal demo.
 */
export async function authenticatePengguna(input: {
  email: string;
  password: string;
  /** Izinkan akun demo development. Pemanggil yang menyalakannya; `false` default. */
  izinkanDemo?: boolean;
  /** Id sesi lama yang sudah diverifikasi, untuk dirotasi. Lihat `masukPengguna`. */
  sessionLamaId?: string | null;
}): Promise<{ hasil: HasilMasuk; token?: string; demo: boolean }> {
  const emailNormalized = normalisasiEmail(input.email);

  if (input.izinkanDemo) {
    const akun = findDemoAccount(emailNormalized);
    if (akun) {
      if (!safeEqual(akun.password, input.password)) {
        return { hasil: { ok: false, alasan: "kredensial_salah" }, demo: true };
      }
      const principal = await pastikanUserDemo({
        email: akun.email,
        nama: akun.nama,
        username: akun.username,
        role: akun.role,
      });
      const { token } = await rotasiSession(getDb(), {
        sessionLamaId: input.sessionLamaId ?? null,
        userId: principal.userId,
        expiresAt: new Date(Date.now() + TTL_SESI_MS),
      });
      return { hasil: { ok: true, principal }, token, demo: true };
    }
  }

  const { hasil, token } = await masukPengguna({
    email: input.email,
    password: input.password,
    sessionLamaId: input.sessionLamaId,
  });
  return { hasil, token, demo: false };
}

/**
 * Terbitkan sesi baru untuk principal yang sudah diverifikasi.
 *
 * Tidak melakukan verifikasi apa pun dan tidak menyentuh cookie — pemanggil
 * (adapter sesi) yang menaruh tokennya ke cookie. Memisahkannya membuat aturan
 * "cookie hanya membawa token opaque" berada di satu berkas.
 */
export async function terbitkanSesi(
  principal: SessionPrincipal,
  konteks?: KonteksRequest,
): Promise<string> {
  const { token } = await buatSession(getDb(), {
    userId: principal.userId,
    expiresAt: new Date(Date.now() + TTL_SESI_MS),
    userAgent: konteks?.userAgent ?? null,
    ipPrefix: konteks?.ipPrefix ?? null,
  });
  return token;
}

/**
 * Pastikan user demo ada di database dan kembalikan principal-nya.
 *
 * Idempoten dan aman dipanggil bersamaan: `onConflictDoNothing` pada email
 * membuat dua login demo paralel tetap menghasilkan satu baris. Setelah user
 * ada, kredensial dan role ditulis dengan pola upsert yang sama seperti jalur
 * registrasi.
 *
 * Password hash milik user demo adalah hash dari password demo **saat itu**,
 * tetapi jalur demo tidak pernah memverifikasi lewat hash itu (password
 * dibandingkan dengan `safeEqual` terhadap konstanta demo). Hashnya tetap
 * ditulis supaya barisnya berbentuk sama dengan user lain dan tidak ada kolom
 * NOT NULL yang kosong.
 */
async function pastikanUserDemo(input: {
  email: string;
  nama: string;
  username: string;
  role: Role;
}): Promise<SessionPrincipal> {
  const emailNormalized = normalisasiEmail(input.email);
  const usernameNormalized = normalisasiUsername(input.username);
  const db = getDb();

  let user = await cariUserByEmail(db, emailNormalized);
  if (!user) {
    // Hash di luar transaksi, seperti registrasi: Argon2id lambat.
    const passwordHash = await hashPassword(`demo:${emailNormalized}:${Date.now()}`);
    await db.transaction(async (tx) => {
      const ada = await cariUserByEmail(tx, emailNormalized);
      if (!ada) {
        const baru = await buatUser(tx, {
          emailNormalized,
          usernameNormalized,
          displayName: input.nama,
        });
        await simpanKredensial(tx, { userId: baru.id, passwordHash });
      }
    });
    user = await cariUserByEmail(db, emailNormalized);
    if (!user) throw new Error("User demo gagal dibuat.");
  }

  await grantRoleAwal(db, { userId: user.id, role: input.role });

  return bangunPrincipal({
    userId: user.id,
    email: user.emailNormalized,
    nama: user.displayName,
    username: user.usernameNormalized,
    roles: rolesEfektif(await ambilRolesAktif(db, user.id)),
  });
}

