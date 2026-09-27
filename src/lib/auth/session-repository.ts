/**
 * Repository session — akses tabel `sessions`. **Server-only.**
 *
 * Yang disimpan di database adalah **hash** token, bukan tokennya. Token asli
 * hanya ada di cookie klien dan di memori request; ia tidak pernah ditulis ke
 * log, tabel, atau pesan galat. Konsekuensinya lookup selalu lewat
 * `token_hash`, dan itu memang index unique-nya.
 *
 * Aturan yang dikunci:
 *
 * - **Koneksi/transaksi sebagai argumen pertama.** Sama seperti
 *   `identity-repository.ts`: menutup satu operasi bisnis (mis. rotasi) dalam
 *   satu transaksi berarti semua query harus memakai handle yang sama.
 * - **Revoke adalah `UPDATE revoked_at`, bukan `DELETE`.** Baris yang dihapus
 *   menghilangkan bukti kapan sesi berakhir; `revoked_at` menyimpannya dan
 *   membuat "sesi dicabut" dapat dibedakan dari "sesi kedaluwarsa".
 * - **Rotasi menandai baris lama `rotated_at`, bukan `revoked_at`.** Dua kolom
 *   itu berbeda artinya: `rotated` berarti token diganti karena login baru
 *   (bukan insiden), `revoked` berarti sesi dihentikan. Menyamakannya akan
 *   membuat audit logout palsu setiap kali orang login.
 * - **Rotasi terikat pada pemilik sesi lama.** `rotasiSession` hanya menandai
 *   baris yang `user_id`-nya sama dengan user yang baru lolos verifikasi.
 *   Tanpa syarat itu, login yang sah bisa mematikan token milik orang lain,
 *   dan baris yang ditandai bisa mengaku "diganti login" padahal login itu
 *   tidak pernah menggantikannya.
 * - **Filter yang menentukan sesi masih sah tinggal di satu fungsi**
 *   (`cariSessionAktifByTokenHash`): `revoked_at is null`, `rotated_at is
 *   null`, dan `expires_at > now()`. Kalau aturan itu tersebar, satu pemanggil
 *   yang lupa salah satunya adalah celah yang tidak terlihat — dan yang paling
 *   mudah terlupa adalah `rotated_at`: token yang sudah digantikan login
 *   berikutnya harus mati, bukan tetap sah sampai `expires_at`.
 */

import { and, eq, gt, isNull, lt, ne } from "drizzle-orm";

import type { EksekutorDb } from "./identity-repository";
import { sessions, type Session } from "@/lib/db/schema";
import { buatTokenOpaque, hashToken } from "./token";

/**
 * Umur sesi: 8 jam, dinyatakan dalam **milidetik**. Dipakai untuk
 * `sessions.expires_at` **dan** `maxAge` cookie, sehingga keduanya tidak bisa
 * menyimpang.
 *
 * Sesi pendek disengaja: cookie membawa token yang, bila dicuri, langsung
 * berguna. Revocation terpusat sudah ada, jadi memperpanjang umur bukan jalan
 * keluar dari login ulang — ia hanya memperpanjang jendela penyalahgunaan.
 *
 * **Satuan adalah milidetik, jadi faktornya harus `1000`.** Nilai ini pernah
 * tertulis `60 * 60 * 8` tanpa menit→milidetik, dan hasilnya bukan "8 jam
 * dikali sesuatu yang salah" melainkan **28,8 detik**: `expires_at` menjadi
 * `now + 28_800 ms`, dan `SESSION_MAX_AGE = TTL_SESI_MS / 1000` menjadi 28
 * detik. Gejalanya di UI adalah "diminta login lagi saat pindah halaman" —
 * sesi yang masih hidup di cookie sudah mati di database, jadi `getSession()`
 * mengembalikan `null` dan layout bergate me-redirect ke `/masuk`. Bug ini
 * tidak terlihat di typecheck (keduanya `number`) dan tidak ketahuan `npm test`
 * (tidak ada test yang memeriksa besaran TTL), jadi yang menjaganya sekarang
 * adalah `session-repository.test.ts` yang mengunci nilai ini terhadap 8 jam.
 */
export const TTL_SESI_MS = 8 * 60 * 60 * 1000;

export type HasilBuatSession = {
  /** Token asli — satu-satunya tempat nilai ini ada. Kirim ke cookie, jangan simpan. */
  token: string;
  /** Baris yang tersimpan; hanya memuat hash, bukan token. */
  session: Session;
};

/** Metadata request yang disimpan bersama sesi. Keduanya opsional. */
export type MetadataSession = {
  userAgent?: string | null;
  ipPrefix?: string | null;
};

/**
 * Buat sesi baru dan kembalikan token aslinya.
 *
 * `tokenHash` dihitung di sini supaya tidak ada pemanggil yang bisa lupa
 * menghash-nya dan menyimpan token mentah.
 */
export async function buatSession(
  db: EksekutorDb,
  input: { userId: string; expiresAt: Date } & MetadataSession,
): Promise<HasilBuatSession> {
  const token = buatTokenOpaque();
  const [session] = await db
    .insert(sessions)
    .values({
      userId: input.userId,
      tokenHash: hashToken(token),
      expiresAt: input.expiresAt,
      userAgent: input.userAgent ?? null,
      ipPrefix: input.ipPrefix ?? null,
    })
    .returning();
  return { token, session };
}

/** Sesi apa pun (termasuk kedaluwarsa/dicabut) berdasarkan hash token. */
export async function cariSessionByTokenHash(
  db: EksekutorDb,
  tokenHash: string,
): Promise<Session | undefined> {
  const [row] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);
  return row;
}

/**
 * Sesi yang **masih sah** berdasarkan token.
 *
 * Inilah satu-satunya predikat yang boleh dipakai `getSession`: sesi yang
 * dicabut, yang sudah dirotasi, atau yang lewat `expires_at`-nya harus gagal di
 * sini, bukan disaring lagi oleh pemanggil.
 *
 * `rotated_at` ikut disaring karena rotasi berarti token itu sudah digantikan
 * login berikutnya. Bila tidak disaring, "rotasi saat login" tidak menambah
 * keamanan apa pun — token lama tetap bekerja sampai `expires_at`, persis
 * seperti sebelum rotasi ada.
 */
export async function cariSessionAktifByTokenHash(
  db: EksekutorDb,
  tokenHash: string,
): Promise<Session | undefined> {
  const [row] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        isNull(sessions.rotatedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row;
}

/**
 * Cabut satu sesi berdasarkan hash token. Mengembalikan `true` bila ada baris
 * yang benar-benar baru dicabut.
 *
 * Filter `isNull(revokedAt)` membuat operasi ini idempoten dan tidak menimpa
 * waktu pencabutan yang asli.
 */
export async function revokeSessionByTokenHash(
  db: EksekutorDb,
  tokenHash: string,
): Promise<boolean> {
  const rows = await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)))
    .returning({ id: sessions.id });
  return rows.length > 0;
}

/**
 * Cabut sesi berdasarkan id. Dipakai jalur yang sudah memegang barisnya.
 * Mengembalikan `true` bila ada yang dicabut.
 */
export async function revokeSession(db: EksekutorDb, sessionId: string): Promise<boolean> {
  const rows = await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)))
    .returning({ id: sessions.id });
  return rows.length > 0;
}

/**
 * Cabut **semua** sesi milik user (logout dari semua perangkat).
 *
 * `kecualiSessionId` untuk kasus "keluar dari perangkat lain" — sesi tempat
 * aksi dijalankan tetap hidup, sisanya dicabut. Mengembalikan jumlah sesi yang
 * dicabut.
 */
export async function revokeSemuaSessionUser(
  db: EksekutorDb,
  userId: string,
  opsi: { kecualiSessionId?: string } = {},
): Promise<number> {
  const syarat = [eq(sessions.userId, userId), isNull(sessions.revokedAt)];
  if (opsi.kecualiSessionId) {
    syarat.push(ne(sessions.id, opsi.kecualiSessionId));
  }
  const rows = await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(...syarat))
    .returning({ id: sessions.id });
  return rows.length;
}

/**
 * Rotasi: tandai sesi lama `rotated_at`, terbitkan sesi baru untuk user yang
 * sama.
 *
 * Dipanggil saat login: token yang dipegang perangkat lama mati, perangkat
 * yang baru masuk mendapat token baru. Token lama **tidak** dicabut, jadi
 * riwayatnya tetap terbaca sebagai "diganti", bukan "dihentikan".
 *
 * Dua syarat pada `UPDATE`-nya, dan keduanya menutup kegagalan yang berbeda:
 *
 * - `user_id = input.userId` — sesi lama hanya boleh ditandai bila ia memang
 *   milik user yang baru saja lolos verifikasi. Tanpa syarat ini, login yang
 *   sah (atau id sesi yang dipalsukan) dapat menandai sesi milik orang lain
 *   sebagai "diganti", yaitu pencabutan lintas pengguna lewat jalur login.
 * - `rotated_at is null` — idempoten; menandai dua kali tidak menimpa waktu
 *   rotasi yang asli.
 *
 * Bila sesi lama tidak ada, sudah dirotasi, atau milik user lain, fungsinya
 * tetap menerbitkan sesi baru. Rotasi bersifat best-effort terhadap sesi lama:
 * login yang sah tidak boleh gagal hanya karena cookie lama sudah tidak
 * berlaku. Yang penting, sesi baru tidak mewarisi apa pun dari sesi lama —
 * tokennya selalu belum pernah ada.
 *
 * Bila sesi lama sudah tidak ada/`rotated_at`-nya sudah terisi, fungsinya tetap
 * menerbitkan sesi baru — rotasi bersifat best-effort terhadap sesi lama, dan
 * kegagalan menandainya tidak boleh menghalangi login yang sah.
 */
export async function rotasiSession(
  db: EksekutorDb,
  input: {
    /** Id sesi lama, atau null bila ini login tanpa sesi sebelumnya (mis. cookie kosong). */
    sessionLamaId?: string | null;
    userId: string;
    expiresAt: Date;
  } & MetadataSession,
): Promise<HasilBuatSession> {
  if (input.sessionLamaId) {
    await db
      .update(sessions)
      .set({ rotatedAt: new Date() })
      .where(
        and(
          eq(sessions.id, input.sessionLamaId),
          eq(sessions.userId, input.userId),
          isNull(sessions.rotatedAt),
        ),
      );
  }

  return buatSession(db, {
    userId: input.userId,
    expiresAt: input.expiresAt,
    userAgent: input.userAgent,
    ipPrefix: input.ipPrefix,
  });
}

/**
 * Hapus baris sesi yang sudah kedaluwarsa. Housekeeping, bukan otorisasi:
 * sesi kedaluwarsa sudah ditolak `cariSessionAktifByTokenHash` tanpa ini.
 *
 * Mengembalikan jumlah baris yang dihapus supaya pemanggil (cron/CLI) bisa
 * melaporkannya.
 */
export async function hapusSessionKedaluwarsa(
  db: EksekutorDb,
  sebelum: Date = new Date(),
): Promise<number> {
  const rows = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, sebelum))
    .returning({ id: sessions.id });
  return rows.length;
}
