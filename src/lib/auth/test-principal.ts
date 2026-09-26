/**
 * Fixture principal untuk **test**. Bukan kode produksi.
 *
 * `getSession()` sejak Fase 1 mengembalikan `SessionPrincipal` (dari database),
 * sedangkan test lama membuat objek `SessionPayload` literal. Alih-alih
 * menyalin dua field baru (`userId`, `roles`) ke belasan literal di delapan
 * berkas — yang menjamin salinan berikutnya lupa salah satunya — helper ini
 * adalah satu tempat yang membangun principal yang konsisten:
 *
 * - `roles` diturunkan dari `role`, sehingga keduanya tidak bisa bertentangan;
 * - `role` adalah role tertinggi dari `roles`, persis seperti di produksi
 *   (`roleTertinggi`), jadi test yang memeriksa `session.role` menguji perilaku
 *   yang sama dengan runtime;
 * - `userId` adalah uuid **deterministik** dari email, supaya test yang
 *   membandingkan kepemilikan id stabil antar-run dan tidak butuh `randomUUID`.
 *
 * Berkas ini **pure**: tidak menyentuh database, `next/headers`, maupun env.
 * Karena itu ia aman diimpor dari test mana pun, termasuk yang men-`vi.mock`
 * modul sesi.
 */

import { createHash } from "node:crypto";
import { roleTertinggi, type SessionPrincipal } from "./principal";
import type { Role } from "./types";

/**
 * UUID v4 yang bentuknya sah tetapi nilainya deterministik.
 *
 * Diambil dari SHA-256 email, bukan hardcode, supaya test yang memakai beberapa
 * akun (mis. dua pemilik berbeda) mendapat id yang berbeda pula.
 */
function uuidDari(email: string): string {
  const h = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  // Bentuk 8-4-4-4-12 dengan nibble versi (4) dan varian (8..b) yang sah.
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * Bangun principal uji.
 *
 * @example
 * const sesiAdmin = principalUji({ email: "admin@careevo.test", role: "admin" });
 */
export function principalUji(input: {
  email: string;
  role?: Role;
  /** Daftar role lengkap. Default: `[role]` (atau `["user"]`). */
  roles?: Role[];
  nama?: string;
  username?: string;
  userId?: string;
}): SessionPrincipal {
  const role = input.role ?? "user";
  const roles = input.roles ?? [role];
  return {
    userId: input.userId ?? uuidDari(input.email),
    email: input.email,
    nama: input.nama ?? role,
    username: input.username ?? input.email.split("@")[0],
    roles,
    role: roleTertinggi(roles),
    iat: Math.floor(Date.now() / 1000),
  };
}
