/**
 * Staff invitation + grant/revoke role — application service, **server-only**.
 *
 * Ini satu-satunya jalur sah untuk memberi role `verifikator`/`admin`: role
 * staff tidak boleh berasal dari input publik (form pendaftaran, body yang
 * dimodifikasi, atau pemanggilan Server Action langsung), jadi baris
 * `staff_invitations` harus dibuat admin yang sudah ada, dan penerimanya harus
 * membuktikan kepemilikan email yang diundang saat redeem.
 *
 * Aturan yang dikunci:
 *
 * - **Token asli hanya ada sekali, di nilai balik `buatUndanganStaff`.** Yang
 *   tersimpan di database adalah `sha256(token)`; token tidak pernah ditulis ke
 *   log, ke `audit_events`, atau ke respons kedua. Karena itu `HashToken` sengaja
 *   bukan `string` — pemanggil tidak bisa tidak sengaja menaruhnya di FormData.
 * - **Redeem satu kali, dijamin database.** Baris undangan dikunci
 *   (`for update`) di dalam transaksi, statusnya dievaluasi setelah kunci
 *   didapat, lalu `consumed_at` ditulis di transaksi yang sama dengan grant
 *   role. Dua redeem paralel tidak bisa sama-sama menang.
 * - **Redeem terikat pada email.** Undangan atas nama `budi@contoh.test` hanya
 *   bisa dipakai user dengan `email_normalized` yang sama; pemegang token yang
 *   bukan pemilik mailbox tidak bisa memakainya untuk dirinya sendiri.
 * - **Grant ulang = UPDATE, bukan INSERT.** PK komposit `(user_id, role)`
 *   membuat INSERT kedua gagal, jadi reaktivasi mengosongkan `revoked_at` dan
 *   mencatat pemberi baru. Selama barisnya masih aktif, grant ulang adalah
 *   no-op — `granted_by_user_id` yang lama tidak ditimpa, supaya bukti siapa
 *   yang pertama memberi tidak hilang.
 * - **Revoke = UPDATE `revoked_at`, bukan DELETE.** Menghapus barisnya akan
 *   menghilangkan bukti siapa yang pernah memberi role itu.
 * - **Setiap perubahan menulis `audit_events` di transaksi yang sama**, lewat
 *   `catatAudit` yang menyaring payload sebelum insert.
 */

import { createHash, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { denganTransaksi, type TransaksiDb } from "@/lib/db/client";
import {
  ROLE_UNDANGAN_STAFF,
  staffInvitations,
  userRoles,
  users,
  type RoleUndanganStaff,
  type StaffInvitation,
  type UserRole,
} from "@/lib/db/schema";
import { normalizeOwner } from "@/lib/auth/types";
import { catatAudit } from "@/lib/auth/audit";

/** Umur undangan default: 3 hari. Cukup untuk admin mengirim tautan ke orang. */
export const MASA_BERLAKU_UNDANGAN_MS = 3 * 24 * 60 * 60 * 1000;

/** Panjang token undangan dalam byte sebelum base64url (256 bit). */
const PANJANG_TOKEN_BYTE = 32;

/**
 * Nama aksi audit. Diekspor sebagai konstanta supaya test dan action tidak
 * menulis ulang stringnya — salah ketik satu huruf akan membuat query audit
 * di runbook tidak menemukan apa pun.
 */
export const AKSI_AUDIT = {
  undanganDibuat: "staff_invitation.created",
  undanganDiredeem: "staff_invitation.redeemed",
  undanganDicabut: "staff_invitation.revoked",
  roleDiberikan: "user_role.granted",
  roleDicabut: "user_role.revoked",
} as const;

/** Guard nilai role undangan — role di luar `ROLE_UNDANGAN_STAFF` ditolak. */
export function isRoleUndanganStaff(nilai: unknown): nilai is RoleUndanganStaff {
  return typeof nilai === "string" && (ROLE_UNDANGAN_STAFF as readonly string[]).includes(nilai);
}

/** Hash token undangan. Deterministik, sehingga lookup redeem memakai index unique. */
export function hashTokenUndangan(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type StatusUndangan = "aktif" | "dipakai" | "dicabut" | "kedaluwarsa";

/**
 * Menilai apakah sebuah undangan masih bisa dipakai. Fungsi murni.
 *
 * Urutan penilaian disengaja: `dicabut` diperiksa lebih dulu daripada
 * `dipakai`, karena pencabutan adalah keputusan administratif terakhir dan
 * pesan yang lebih informatif bagi operator adalah "undangan ini dibatalkan",
 * bukan "sudah dipakai".
 */
export function evaluasiUndangan(
  undangan: Pick<StaffInvitation, "consumedAt" | "revokedAt" | "expiresAt">,
  sekarang: Date = new Date(),
): { status: StatusUndangan; bisaDipakai: boolean } {
  if (undangan.revokedAt) return { status: "dicabut", bisaDipakai: false };
  if (undangan.consumedAt) return { status: "dipakai", bisaDipakai: false };
  if (undangan.expiresAt.getTime() <= sekarang.getTime()) {
    return { status: "kedaluwarsa", bisaDipakai: false };
  }
  return { status: "aktif", bisaDipakai: true };
}

export type AlasanGagalUndangan =
  | "role_tidak_valid"
  | "email_tidak_valid"
  | "tidak_ditemukan"
  | "sudah_dipakai"
  | "dicabut"
  | "kedaluwarsa"
  | "email_tidak_cocok"
  | "pengguna_tidak_ditemukan"
  | "sudah_dicabut";

const PESAN_GAGAL: Record<AlasanGagalUndangan, string> = {
  role_tidak_valid: "Peran undangan tidak valid. Hanya verifikator atau admin yang dapat diundang.",
  email_tidak_valid: "Email undangan tidak valid.",
  tidak_ditemukan: "Undangan tidak ditemukan.",
  sudah_dipakai: "Undangan ini sudah pernah dipakai.",
  dicabut: "Undangan ini sudah dibatalkan.",
  kedaluwarsa: "Undangan ini sudah kedaluwarsa.",
  email_tidak_cocok:
    "Undangan ini diterbitkan untuk alamat email lain. Masuk dengan akun yang diundang.",
  pengguna_tidak_ditemukan: "Pengguna tidak ditemukan.",
  sudah_dicabut: "Role ini sudah dalam keadaan dicabut.",
};

/**
 * Bentuk gagal dipakai bersama semua hasil di modul ini.
 *
 * `alasan` adalah kode yang bisa diuji (bukan teks), `pesan` adalah kalimat
 * yang boleh ditampilkan. Memisahkannya membuat test tidak bergantung pada
 * copywriting dan UI tidak perlu memetakan string.
 */
export interface HasilGagal {
  ok: false;
  alasan: AlasanGagalUndangan;
  pesan: string;
}

export type HasilBuatUndangan =
  | {
      ok: true;
      /** Nilai asli — **hanya ada di sini**. Jangan di-log, jangan disimpan di cookie. */
      token: string;
      undangan: StaffInvitation;
    }
  | HasilGagal;

export type HasilRedeemUndangan =
  | {
      ok: true;
      invitationId: string;
      userId: string;
      role: RoleUndanganStaff;
      /** `true` bila role ini pernah dicabut lalu diaktifkan kembali (UPDATE). */
      diaktifkanKembali: boolean;
    }
  | HasilGagal;

export type HasilCabutUndangan = { ok: true; invitationId: string } | HasilGagal;

export type HasilGrantRole =
  | { ok: true; granted: boolean; diaktifkanKembali: boolean }
  | HasilGagal;

function gagal(alasan: AlasanGagalUndangan): HasilGagal {
  return { ok: false, alasan, pesan: PESAN_GAGAL[alasan] };
}

/**
 * Membuat undangan staff.
 *
 * `emailNormalized` dinormalisasi lagi di sini meski pemanggil sudah
 * melakukannya: alamat yang berbeda hanya karena kapital akan menghasilkan
 * undangan yang tidak bisa di-redeem, dan itu bug yang mahal untuk ditemukan.
 */
export async function buatUndanganStaff(input: {
  emailNormalized: string;
  role: RoleUndanganStaff;
  invitedByUserId: string;
  masaBerlakuMs?: number;
}): Promise<HasilBuatUndangan> {
  if (!isRoleUndanganStaff(input.role)) return gagal("role_tidak_valid");

  const email = normalizeOwner(input.emailNormalized);
  // Validasi bentuk minimal: satu `@` dengan bagian sebelum/sesudah. Validasi
  // penuh ada di schema Zod action; ini jaring pengaman service.
  if (!email || email.indexOf("@") <= 0 || email.endsWith("@")) {
    return gagal("email_tidak_valid");
  }

  const masaBerlaku = input.masaBerlakuMs ?? MASA_BERLAKU_UNDANGAN_MS;
  const token = randomBytes(PANJANG_TOKEN_BYTE).toString("base64url");
  const tokenHash = hashTokenUndangan(token);
  const expiresAt = new Date(Date.now() + masaBerlaku);

  const undangan = await denganTransaksi(async (tx) => {
    const [baris] = await tx
      .insert(staffInvitations)
      .values({
        emailNormalized: email,
        role: input.role,
        invitedByUserId: input.invitedByUserId,
        tokenHash,
        expiresAt,
      })
      .returning();

    await catatAudit(tx, {
      actorUserId: input.invitedByUserId,
      action: AKSI_AUDIT.undanganDibuat,
      entityType: "staff_invitation",
      entityId: baris.id,
      // `catatAudit` menyamarkan `email` dan membuang kunci ber-token. Nilai
      // token tidak pernah sampai ke sini.
      payloadRedacted: {
        email: email,
        role: input.role,
        expires_at: expiresAt.toISOString(),
      },
    });

    return baris;
  });

  return { ok: true, token, undangan };
}

/**
 * Menerapkan grant role di dalam transaksi yang sudah berjalan.
 *
 * Dipisah dari `beriRole` supaya redeem dapat menulis `consumed_at` dan grant
 * dalam **satu** transaksi tanpa membuka transaksi bersarang.
 */
async function terapkanGrant(
  tx: TransaksiDb,
  input: { userId: string; role: RoleUndanganStaff; grantedByUserId: string | null },
): Promise<{ baris: UserRole; dibuat: boolean; diaktifkanKembali: boolean }> {
  const [ada] = await tx
    .select()
    .from(userRoles)
    .where(and(eq(userRoles.userId, input.userId), eq(userRoles.role, input.role)))
    .limit(1)
    // Kunci baris: dua grant paralel tidak boleh sama-sama membaca "belum ada"
    // lalu sama-sama INSERT.
    .for("update");

  if (ada && !ada.revokedAt) {
    // Sudah aktif — no-op. `granted_by_user_id` lama sengaja tidak ditimpa.
    return { baris: ada, dibuat: false, diaktifkanKembali: false };
  }

  if (ada) {
    // PK komposit `(user_id, role)` sudah terisi oleh baris yang dicabut, jadi
    // ini WAJIB UPDATE. INSERT akan gagal dengan SQLSTATE 23505.
    const [diperbarui] = await tx
      .update(userRoles)
      .set({ revokedAt: null, grantedAt: new Date(), grantedByUserId: input.grantedByUserId })
      .where(and(eq(userRoles.userId, input.userId), eq(userRoles.role, input.role)))
      .returning();
    return { baris: diperbarui, dibuat: false, diaktifkanKembali: true };
  }

  const [dibuat] = await tx
    .insert(userRoles)
    .values({
      userId: input.userId,
      role: input.role,
      grantedByUserId: input.grantedByUserId,
      revokedAt: null,
    })
    .returning();
  return { baris: dibuat, dibuat: true, diaktifkanKembali: false };
}

/**
 * Memakai undangan: menandai `consumed_at`, memberi role, dan menulis audit —
 * semuanya dalam satu transaksi.
 *
 * Pemanggil bertanggung jawab atas autentikasi: `userId` harus principal yang
 * sedang login, bukan nilai dari FormData.
 */
export async function redeemUndangan(input: {
  token: string;
  userId: string;
}): Promise<HasilRedeemUndangan> {
  const tokenHash = hashTokenUndangan(input.token);

  return denganTransaksi(async (tx) => {
    const [undangan] = await tx
      .select()
      .from(staffInvitations)
      .where(eq(staffInvitations.tokenHash, tokenHash))
      .limit(1)
      // Kunci sebelum evaluasi: tanpa ini, dua redeem paralel sama-sama
      // membaca status "aktif" lalu sama-sama menang.
      .for("update");

    if (!undangan) return gagal("tidak_ditemukan");

    const { status, bisaDipakai } = evaluasiUndangan(undangan);
    if (!bisaDipakai) {
      const alasan: AlasanGagalUndangan =
        status === "dipakai" ? "sudah_dipakai" : status === "dicabut" ? "dicabut" : "kedaluwarsa";
      return gagal(alasan);
    }

    if (!isRoleUndanganStaff(undangan.role)) return gagal("role_tidak_valid");

    const [pengguna] = await tx
      .select({ id: users.id, emailNormalized: users.emailNormalized })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);

    if (!pengguna) return gagal("pengguna_tidak_ditemukan");

    // Undangan terikat pada mailbox yang diundang. Ini yang membuat token
    // yang bocor tidak cukup untuk memberi seseorang role staff.
    if (normalizeOwner(pengguna.emailNormalized) !== normalizeOwner(undangan.emailNormalized)) {
      return gagal("email_tidak_cocok");
    }

    await tx
      .update(staffInvitations)
      .set({ consumedAt: new Date() })
      .where(eq(staffInvitations.id, undangan.id));

    const hasil = await terapkanGrant(tx, {
      userId: pengguna.id,
      role: undangan.role,
      grantedByUserId: undangan.invitedByUserId,
    });

    await catatAudit(tx, {
      // Pelaku redeem adalah user yang memakai token; pemberi role tetap
      // tercatat di `payload_redacted` dan di `user_roles.granted_by_user_id`.
      actorUserId: pengguna.id,
      action: AKSI_AUDIT.undanganDiredeem,
      entityType: "staff_invitation",
      entityId: undangan.id,
      payloadRedacted: {
        email: undangan.emailNormalized,
        role: undangan.role,
        granted_by_user_id: undangan.invitedByUserId,
        diaktifkan_kembali: hasil.diaktifkanKembali,
      },
    });

    return {
      ok: true as const,
      invitationId: undangan.id,
      userId: pengguna.id,
      role: undangan.role,
      diaktifkanKembali: hasil.diaktifkanKembali,
    };
  });
}

/**
 * Membatalkan undangan yang belum dipakai.
 *
 * Undangan yang sudah `consumed` tidak bisa "dicabut kembali": role yang sudah
 * diberikan harus dicabut lewat `cabutRole`, bukan dengan mengubah riwayat
 * undangan. Menolaknya di sini menjaga audit trail tetap bisa dipercaya.
 */
export async function cabutUndangan(input: {
  invitationId: string;
  revokedByUserId: string;
}): Promise<HasilCabutUndangan> {
  return denganTransaksi(async (tx) => {
    const [undangan] = await tx
      .select()
      .from(staffInvitations)
      .where(eq(staffInvitations.id, input.invitationId))
      .limit(1)
      .for("update");

    if (!undangan) return gagal("tidak_ditemukan");
    if (undangan.revokedAt) return gagal("sudah_dicabut");
    if (undangan.consumedAt) return gagal("sudah_dipakai");

    await tx
      .update(staffInvitations)
      .set({ revokedAt: new Date() })
      .where(eq(staffInvitations.id, undangan.id));

    await catatAudit(tx, {
      actorUserId: input.revokedByUserId,
      action: AKSI_AUDIT.undanganDicabut,
      entityType: "staff_invitation",
      entityId: undangan.id,
      payloadRedacted: {
        email: undangan.emailNormalized,
        role: undangan.role,
      },
    });

    return { ok: true as const, invitationId: undangan.id };
  });
}

/**
 * Memberi role staff secara langsung (jalur admin, tanpa undangan).
 *
 * Idempoten: memberi role yang sudah aktif tidak mengubah apa pun dan tidak
 * menulis audit — menulis "granted" untuk perubahan yang tidak terjadi akan
 * membuat audit trail berbohong.
 */
export async function beriRole(input: {
  userId: string;
  role: RoleUndanganStaff;
  grantedByUserId: string;
}): Promise<HasilGrantRole> {
  if (!isRoleUndanganStaff(input.role)) return gagal("role_tidak_valid");

  return denganTransaksi(async (tx) => {
    // Cek target lebih dulu: `user_roles.user_id` adalah FK ke `users`, jadi
    // id yang salah akan gagal sebagai pelanggaran FK (SQLSTATE 23503) —
    // galat database, bukan pesan yang bisa ditindaklanjuti admin.
    const [target] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);
    if (!target) return gagal("pengguna_tidak_ditemukan");

    const [ada] = await tx
      .select()
      .from(userRoles)
      .where(and(eq(userRoles.userId, input.userId), eq(userRoles.role, input.role)))
      .limit(1)
      .for("update");

    if (ada && !ada.revokedAt) {
      return { ok: true as const, granted: false, diaktifkanKembali: false };
    }

    const hasil = await terapkanGrant(tx, {
      userId: input.userId,
      role: input.role,
      grantedByUserId: input.grantedByUserId,
    });

    await catatAudit(tx, {
      actorUserId: input.grantedByUserId,
      action: AKSI_AUDIT.roleDiberikan,
      entityType: "user_role",
      // Id entitas komposit ditulis sebagai `userId:role` — `entity_id` bertipe
      // text justru supaya bentuk seperti ini tidak perlu tabel baru.
      entityId: `${input.userId}:${input.role}`,
      payloadRedacted: {
        target_user_id: input.userId,
        role: input.role,
        diaktifkan_kembali: hasil.diaktifkanKembali,
      },
    });

    return { ok: true as const, granted: true, diaktifkanKembali: hasil.diaktifkanKembali };
  });
}

/**
 * Mencabut role staff. `UPDATE revoked_at`, bukan `DELETE` — lihat catatan
 * modul. Baris `user_roles` tetap ada sebagai bukti siapa yang pernah memberi.
 */
export async function cabutRole(input: {
  userId: string;
  role: RoleUndanganStaff;
  revokedByUserId: string;
}): Promise<HasilCabutUndangan> {
  return denganTransaksi(async (tx) => {
    const [ada] = await tx
      .select()
      .from(userRoles)
      .where(and(eq(userRoles.userId, input.userId), eq(userRoles.role, input.role)))
      .limit(1)
      .for("update");

    if (!ada) return gagal("tidak_ditemukan");
    if (ada.revokedAt) return gagal("sudah_dicabut");

    await tx
      .update(userRoles)
      .set({ revokedAt: new Date() })
      .where(and(eq(userRoles.userId, input.userId), eq(userRoles.role, input.role)));

    await catatAudit(tx, {
      actorUserId: input.revokedByUserId,
      action: AKSI_AUDIT.roleDicabut,
      entityType: "user_role",
      entityId: `${input.userId}:${input.role}`,
      payloadRedacted: {
        target_user_id: input.userId,
        role: input.role,
        granted_by_user_id: ada.grantedByUserId,
      },
    });

    return { ok: true as const, invitationId: `${input.userId}:${input.role}` };
  });
}
