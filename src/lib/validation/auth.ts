import { z } from "zod";
import { ROLES } from "@/lib/auth/types";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, "Username 3-20 karakter: huruf kecil, angka, underscore");

export const roleSchema = z.enum(ROLES, {
  message: "Peran tidak valid",
});

/**
 * The only role public registration may mint.
 *
 * Staff (`verifikator`/`admin`) provisioning is an invitation/admin-only
 * workflow; it must never be reachable from the public signup form, a modified
 * request body, or a direct Server Action call. The schema keeps a `role` field
 * so the shape of the input is explicit, but the value is pinned to `user`
 * rather than read from the browser.
 *
 * Note the absent `.default(...)`: `registerSchema` is used whole, so the
 * default would only add a way for a missing key to silently choose a role.
 */
export const registerRoleSchema = z.literal("user", {
  message: "Pendaftaran publik hanya untuk peran pencari kerja (learner).",
});

export const registerSchema = z.object({
  nama: z.string().trim().min(2, "Nama minimal 2 karakter").max(80),
  username: usernameSchema,
  email: z.email("Format email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter").max(72),
  consent: z.literal(true, { message: "Persetujuan pemrosesan data wajib diisi" }),
  role: registerRoleSchema,
});

export const loginSchema = z.object({
  email: z.email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
