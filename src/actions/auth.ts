"use server";

import { redirect } from "next/navigation";
import type { z } from "zod";
import { loginSchema, registerSchema } from "@/lib/validation/auth";
import {
  authenticate,
  createSession,
  destroySession,
  isDemoEmail,
} from "@/lib/auth/session";
import { addStoredUser, hashPassword, isEmailTaken } from "@/lib/auth/user-store";
import { landingFor } from "@/lib/auth/landing";
import type { AuthFormState } from "@/lib/auth/types";

function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !result[key]) {
      result[key] = issue.message;
    }
  }
  return result;
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error), values: { email } };
  }

  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) {
    return {
      ok: false,
      message:
        "Email atau password salah. Gunakan akun demo, atau daftar dulu.",
      errors: {},
      values: { email },
    };
  }

  await createSession(user);
  redirect(await landingFor(user.role));
}

export async function registerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = {
    nama: String(formData.get("nama") ?? ""),
    username: String(formData.get("username") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    consent: formData.get("consent") === "on",
    role: String(formData.get("role") ?? "user"),
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: fieldErrors(parsed.error),
      values: { email: raw.email, nama: raw.nama, username: raw.username, role: raw.role },
    };
  }

  const { email, nama, username, role, password } = parsed.data;

  if (isDemoEmail(email)) {
    return {
      ok: false,
      errors: { email: "Email ini dipakai akun demo. Silakan masuk langsung." },
      values: { email, nama, username, role },
    };
  }

  if (await isEmailTaken(email)) {
    return {
      ok: false,
      errors: { email: "Email sudah terdaftar. Silakan masuk." },
      values: { email, nama, username, role },
    };
  }

  await addStoredUser({
    email,
    nama,
    username,
    role,
    passwordHash: hashPassword(password),
  });
  await createSession({ email, nama, username, role });
  redirect(await landingFor(role));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/masuk");
}
