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

export const registerRoleSchema = z.enum(["user", "verifikator"], {
  message: "Peran tidak valid",
});

export const registerSchema = z.object({
  nama: z.string().trim().min(2, "Nama minimal 2 karakter").max(80),
  username: usernameSchema,
  email: z.email("Format email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter").max(72),
  consent: z.literal(true, { message: "Persetujuan pemrosesan data wajib diisi" }),
  role: registerRoleSchema.default("user"),
});

export const loginSchema = z.object({
  email: z.email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
