import { revalidatePath } from "next/cache";
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

/**
 * Policy otorisasi terpusat ada di `@/lib/auth/authorization` — ia membaca
 * `roles` dari principal database, bukan claim role di cookie. `gateStaff`
 * dulu hidup di berkas ini dan membaca `session.role`, sehingga role yang
 * dicabut tetap berlaku sampai cookie kedaluwarsa. Re-export di bawah menjaga
 * pemanggil lama (`gateStaff()` di `src/actions/*.ts`) tetap bekerja dengan
 * signature yang sama sementara keputusannya kini berbasis database.
 */
export { gateStaff, gateAdmin } from "@/lib/auth/authorization";

/** Pesan penolakan tunggal — dipakai semua action yang butuh hak staff. */
export const PESAN_AKSES_DITOLAK =
  "Akses ditolak. Tindakan ini membutuhkan akun dengan hak akses verifikator atau admin.";

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
