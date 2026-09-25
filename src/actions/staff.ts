"use server";

/**
 * Server action administrasi staff — **admin-only**.
 *
 * Semua tindakan di sini menambah hak akses, jadi tiga hal berlaku seragam:
 *
 * 1. **Gate-nya `gateAdmin()`**, bukan `gateStaff()`: verifikator tidak boleh
 *    memberi role atau mengundang staff. Gate membaca `roles` dari principal
 *    database, bukan claim role di cookie.
 * 2. **Role divalidasi terhadap `ROLE_UNDANGAN_STAFF`.** Nilai role boleh
 *    datang dari FormData, tapi ia tidak pernah dipakai langsung: ia harus lolos
 *    skema `z.enum(ROLE_UNDANGAN_STAFF)`. Sebelumnya tidak ada jalur publik yang
 *    bisa memilih role sama sekali — memperkenalkan satu field role tanpa
 *    daftar tertutup akan membuka eskalasi hak akses.
 * 3. **Token undangan hanya dikembalikan sekali** ke pembuatnya, lewat state
 *    yang ditampilkan sekali di UI. Ia tidak disimpan di cookie, tidak ditulis
 *    ke log, dan tidak pernah muncul lagi setelah admin menutup halaman.
 *
 * Fungsi `redeemUndanganAction` adalah satu-satunya yang tidak butuh admin: ia
 * untuk user yang login dan memegang token, dan identitasnya diambil dari
 * principal — bukan dari FormData.
 */

import { z } from "zod";

import { PESAN_AKSES_DITOLAK, extractFieldErrors } from "@/lib/actions-common";
import { gateAdmin } from "@/lib/auth/authorization";
import { getSession } from "@/lib/auth/session";
import {
  beriRole,
  buatUndanganStaff,
  cabutRole,
  cabutUndangan,
  redeemUndangan,
} from "@/lib/auth/invitation";
import { ROLE_UNDANGAN_STAFF } from "@/lib/db/schema";

/**
 * State bersama untuk seluruh aksi administrasi staff.
 *
 * Bentuknya satu supaya formulir admin bisa memakai satu `useActionState`
 * berkali-kali. `token` hanya terisi oleh `buatUndanganAction` dan hanya pada
 * respons pertama.
 */
export interface StaffActionState {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  /**
   * Token undangan asli. Ditampilkan sekali ke pembuatnya; tidak pernah
   * di-echo ulang dan tidak boleh disimpan di cookie/localStorage.
   */
  token?: string;
}

/**
 * Skema undangan. `role` memakai daftar tertutup `ROLE_UNDANGAN_STAFF`, bukan
 * `z.string()`, sehingga nilai di luar verifikator/admin ditolak sebelum
 * menyentuh service.
 */
const undanganSchema = z.object({
  email: z.email("Format email tidak valid").trim().toLowerCase(),
  role: z.enum(ROLE_UNDANGAN_STAFF, {
    message: "Peran undangan harus verifikator atau admin.",
  }),
  masa_berlaku_jam: z.coerce.number().int().min(1).max(24 * 30).optional(),
});

const idSchema = z.uuid("ID tidak valid");

const roleTargetSchema = z.object({
  user_id: z.uuid("ID pengguna tidak valid"),
  role: z.enum(ROLE_UNDANGAN_STAFF, {
    message: "Peran harus verifikator atau admin.",
  }),
});

const redeemSchema = z.object({
  token: z.string().trim().min(16, "Token undangan tidak valid").max(512),
});

/** Menyeragamkan bentuk state sukses/error supaya action tidak menyalinnya. */
function tolak(pesan: string, fieldErrors?: Record<string, string>): StaffActionState {
  return { ok: false, error: pesan, fieldErrors };
}

/**
 * Membuat undangan staff baru.
 *
 * Token dikembalikan pada state — pemanggil (UI) yang menampilkannya sekali.
 * Setelah request ini selesai, token tidak bisa diambil lagi dari mana pun.
 */
export async function buatUndanganAction(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const admin = await gateAdmin();
  if (!admin) return tolak(PESAN_AKSES_DITOLAK);

  const parsed = undanganSchema.safeParse({
    email: formData.get("email") ?? "",
    role: formData.get("role") ?? "",
    masa_berlaku_jam: formData.get("masa_berlaku_jam") ?? undefined,
  });
  if (!parsed.success) {
    return tolak("Periksa kembali data undangan.", extractFieldErrors(parsed.error));
  }

  const hasil = await buatUndanganStaff({
    emailNormalized: parsed.data.email,
    role: parsed.data.role,
    invitedByUserId: admin.userId,
    masaBerlakuMs: parsed.data.masa_berlaku_jam
      ? parsed.data.masa_berlaku_jam * 60 * 60 * 1000
      : undefined,
  });

  if (!hasil.ok) return tolak(hasil.pesan);

  return {
    ok: true,
    message:
      `Undangan untuk ${hasil.undangan.emailNormalized} sebagai ${hasil.undangan.role} dibuat. ` +
      "Salin tautan ini sekarang — nilainya tidak bisa ditampilkan lagi.",
    token: hasil.token,
  };
}

/**
 * Memakai undangan. **Tidak** butuh admin: yang dibutuhkan adalah principal
 * login yang emailnya cocok dengan undangan, dan itu diperiksa service.
 */
export async function redeemUndanganAction(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const principal = await getSession();
  if (!principal || !principal.userId) {
    return tolak("Masuk terlebih dahulu untuk memakai undangan ini.");
  }

  const parsed = redeemSchema.safeParse({ token: formData.get("token") ?? "" });
  if (!parsed.success) {
    return tolak("Token undangan tidak valid.", extractFieldErrors(parsed.error));
  }

  const hasil = await redeemUndangan({ token: parsed.data.token, userId: principal.userId });
  if (!hasil.ok) return tolak(hasil.pesan);

  return {
    ok: true,
    message: `Peran ${hasil.role} berhasil diaktifkan untuk akun ini.`,
  };
}

/** Mencabut undangan yang belum dipakai. */
export async function cabutUndanganAction(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const admin = await gateAdmin();
  if (!admin) return tolak(PESAN_AKSES_DITOLAK);

  const parsed = idSchema.safeParse(formData.get("invitation_id") ?? "");
  if (!parsed.success) {
    return tolak("ID undangan tidak valid.", extractFieldErrors(parsed.error));
  }

  const hasil = await cabutUndangan({
    invitationId: parsed.data,
    revokedByUserId: admin.userId,
  });
  if (!hasil.ok) return tolak(hasil.pesan);

  return { ok: true, message: "Undangan dibatalkan." };
}

/** Memberi role staff langsung (jalur admin, tanpa undangan). */
export async function beriRoleAction(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const admin = await gateAdmin();
  if (!admin) return tolak(PESAN_AKSES_DITOLAK);

  const parsed = roleTargetSchema.safeParse({
    user_id: formData.get("user_id") ?? "",
    role: formData.get("role") ?? "",
  });
  if (!parsed.success) {
    return tolak("Periksa kembali data peran.", extractFieldErrors(parsed.error));
  }

  const hasil = await beriRole({
    userId: parsed.data.user_id,
    role: parsed.data.role,
    grantedByUserId: admin.userId,
  });
  if (!hasil.ok) return tolak(hasil.pesan);

  return {
    ok: true,
    message: hasil.granted
      ? `Peran ${parsed.data.role} diberikan.`
      : `Pengguna sudah memiliki peran ${parsed.data.role}.`,
  };
}

/** Mencabut role staff. Baris `user_roles` tetap ada; hanya `revoked_at` diisi. */
export async function cabutRoleAction(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const admin = await gateAdmin();
  if (!admin) return tolak(PESAN_AKSES_DITOLAK);

  const parsed = roleTargetSchema.safeParse({
    user_id: formData.get("user_id") ?? "",
    role: formData.get("role") ?? "",
  });
  if (!parsed.success) {
    return tolak("Periksa kembali data peran.", extractFieldErrors(parsed.error));
  }

  const hasil = await cabutRole({
    userId: parsed.data.user_id,
    role: parsed.data.role,
    revokedByUserId: admin.userId,
  });
  if (!hasil.ok) return tolak(hasil.pesan);

  return { ok: true, message: `Peran ${parsed.data.role} dicabut.` };
}
