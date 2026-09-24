import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/roles";
import type { SessionPayload } from "@/lib/auth/types";
import type { z } from "zod";

/**
 * Helper bersama untuk Server Action.
 *
 * Bukan modul `"use server"` — modul ber-direktif itu hanya boleh mengekspor
 * fungsi async, sehingga helper sinkron seperti `extractFieldErrors` tidak
 * bisa tinggal di sana.
 *
 * Tiga hal ini sebelumnya disalin ulang di setiap berkas action; disatukan
 * supaya pesan penolakan dan perilaku revalidate tidak menyimpang antar modul.
 */

/** Pesan penolakan tunggal — dipakai semua action yang butuh hak staff. */
export const PESAN_AKSES_DITOLAK =
  "Akses ditolak. Tindakan ini membutuhkan akun dengan hak akses verifikator atau admin.";

/**
 * Gate hak akses staff.
 *
 * Mengembalikan sesi bila pemanggil adalah verifikator/admin, atau `null` bila
 * belum masuk maupun bukan staff. Pemanggil memetakan `null` menjadi state
 * error miliknya sendiri (bentuk state tiap action berbeda-beda).
 */
export async function gateStaff(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

/** Ambil pesan error pertama per field dari `ZodError`. */
export function extractFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !result[key]) {
      result[key] = issue.message;
    }
  }
  return result;
}

/**
 * `revalidatePath` yang menelan error.
 *
 * Server Action juga dipanggil dari unit test di luar lifecycle request
 * Next.js, di mana `revalidatePath` melempar. Di runtime nyata ia selalu
 * berhasil, jadi menelan error di sini tidak menyembunyikan masalah.
 */
export function safeRevalidate(...paths: string[]): void {
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch {
      // Abaikan di luar lifecycle request Next.js (mis. unit test).
    }
  }
}
