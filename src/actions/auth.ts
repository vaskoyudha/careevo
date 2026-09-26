"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { loginSchema, registerSchema } from "@/lib/validation/auth";
import {
  authenticatePengguna,
  daftarPengguna,
  keluarSession,
  terbitkanSesi,
} from "@/lib/auth/auth-service";
import {
  bacaTokenSesi,
  destroySession,
  pasangCookieSesi,
  sesiLamaIdToken,
} from "@/lib/auth/session";
import { isDemoEmail } from "@/lib/auth/demo-accounts";
import { demoAccountsAllowed } from "@/lib/config/environment";
import { landingFor } from "@/lib/auth/landing";
import { cekBatasiAksi } from "@/lib/rate-limit/next";
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

/**
 * Metadata request yang disimpan bersama baris sesi.
 *
 * `userAgent` dan prefix IP berguna untuk menampilkan "perangkat yang masuk" dan
 * mendeteksi anomali. Yang disimpan **hanya prefix**, bukan alamat penuh: cukup
 * untuk mendeteksi, tanpa menyimpan PII yang tidak dibutuhkan.
 *
 * Kegagalan membaca header tidak boleh menggagalkan login — ia hanya metadata.
 * Di luar lifecycle request Next.js (mis. unit test) `headers()` melempar, dan
 * itu bukan alasan menolak kredensial yang benar.
 */
async function konteksRequest(): Promise<{ userAgent?: string; ipPrefix?: string }> {
  try {
    const h = await headers();
    const ua = h.get("user-agent");
    // `x-forwarded-for` dipakai hanya untuk **prefix** yang tidak dipakai
    // sebagai kunci keamanan apa pun; nilainya dapat diisi klien, jadi jangan
    // pernah memperlakukannya sebagai identitas.
    const ip = h.get("x-vercel-forwarded-for") ?? h.get("x-forwarded-for");
    return {
      userAgent: ua?.slice(0, 300) ?? undefined,
      ipPrefix: ip?.split(",")[0]?.trim().slice(0, 64) || undefined,
    };
  } catch {
    return {};
  }
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  // Dibatasi SEBELUM validasi dan SEBELUM verifikasi kredensial: percobaan
  // kredensial yang buruk bentuknya pun tetap harus dihitung, kalau tidak
  // penyerang dapat memakai request cacat untuk menghindari batas sambil tetap
  // menebak.
  //
  // Email sengaja TIDAK dipakai sebagai principal di sini. Nilainya datang dari
  // klien, jadi memasukkannya ke kunci akan memberi penyerang cara mengunci akun
  // korban dari jarak jauh dengan menghabiskan bucket atas nama email itu.
  // Untuk login, satu-satunya kunci yang jujur adalah IP tepercaya.
  const batas = await cekBatasiAksi("login");
  if (batas) {
    return { ok: false, message: batas.gagal.pesan, errors: {}, values: { email } };
  }

  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error), values: { email } };
  }

  // Id sesi lama dibaca dari predikat sesi **aktif** (`sesiLamaIdToken` →
  // `cariSessionAktifByTokenHash`), bukan dari cookie mentah. Cookie adalah
  // input yang bisa dipalsukan; id baris ini adalah nilai yang sudah terbukti
  // ada, belum dicabut, belum dirotasi, dan belum kedaluwarsa. `rotasiSession`
  // mencocokkannya lagi dengan user yang baru lolos autentikasi.
  //
  // Login yang sah tetap berjalan bila cookie lamanya sudah tidak berlaku
  // dalam bentuk apa pun — `sesiLamaIdToken` mengembalikan `null`, dan rotasi
  // hanya kehilangan sesi lama yang memang sudah mati.
  const sessionLamaId = await sesiLamaIdToken();

  // Akun demo hanya diteruskan sebagai izin bila environment memang
  // mengizinkannya. `authenticatePengguna` memakai `findDemoAccount`, yang
  // sendiri fail-closed; flag ini hanya memastikan keputusan itu diambil di
  // satu tempat yang terlihat.
  const { hasil, token } = await authenticatePengguna({
    email: parsed.data.email,
    password: parsed.data.password,
    izinkanDemo: demoAccountsAllowed(),
    sessionLamaId,
  });

  if (!hasil.ok || !token) {
    return {
      ok: false,
      // Only mention demo accounts where they actually work (development with
      // `DEMO_MODE=1`); elsewhere it would send people looking for credentials
      // the server now rejects.
      message: demoAccountsAllowed()
        ? "Email atau password salah. Gunakan akun demo, atau daftar dulu."
        : "Email atau password salah. Cek kembali, atau daftar dulu.",
      errors: {},
      values: { email },
    };
  }

  await pasangCookieSesi(token);
  redirect(await landingFor(hasil.principal.role, hasil.principal.email));
}

/**
 * Bila pembuatan user gagal, tidak ada cookie yang dipasang dan tidak ada sesi
 * yang terbit — kegagalan registrasi tidak boleh meninggalkan sesi setengah
 * jadi.
 */
export async function registerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  // `role` deliberately does NOT come from `FormData`. Public registration always
  // mints a learner: a tampered field, a hand-built multipart body, or a direct
  // `registerAction(...)` call must not be able to produce a staff account. The
  // field is still passed so the schema validates it explicitly (and so a future
  // edit cannot quietly start reading it from the browser again).
  const raw = {
    nama: String(formData.get("nama") ?? ""),
    username: String(formData.get("username") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    consent: formData.get("consent") === "on",
    role: "user",
  };

  // Sama seperti login: batas dihitung atas IP tepercaya, bukan atas email/nama
  // yang dikirim klien. Tanpa ini, pendaftaran akun massal dari satu sumber tidak
  // tertahan sama sekali.
  const batas = await cekBatasiAksi("signup");
  if (batas) {
    return {
      ok: false,
      message: batas.gagal.pesan,
      errors: {},
      // `role` tidak ikut: ia sengaja bukan lagi bagian dari nilai form publik
      // (lihat catatan di atas `raw`), jadi mengembalikannya di sini akan
      // menghidupkan kembali field yang justru sedang dihapus.
      values: { email: raw.email, nama: raw.nama, username: raw.username },
    };
  }

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: fieldErrors(parsed.error),
      values: { email: raw.email, nama: raw.nama, username: raw.username },
    };
  }

  const { email, nama, username, password } = parsed.data;

  if (isDemoEmail(email)) {
    return {
      ok: false,
      errors: { email: "Email ini dipakai akun demo. Silakan masuk langsung." },
      values: { email, nama, username },
    };
  }

  // Pendaftaran menulis `users` + `user_credentials` + `user_roles` dalam satu
  // transaksi di dalam service. Keunikan email/username ditegakkan unique index
  // di database; hasil `alasan` di bawah hanya untuk memilih pesan yang tepat.
  const hasil = await daftarPengguna({ nama, username, email, password });

  if (!hasil.ok) {
    if (hasil.alasan === "email_dipakai") {
      return {
        ok: false,
        errors: { email: "Email sudah terdaftar. Silakan masuk." },
        values: { email, nama, username },
      };
    }
    return {
      ok: false,
      errors: { username: "Username sudah dipakai. Coba yang lain." },
      values: { email, nama, username },
    };
  }

  const token = await terbitkanSesi(hasil.principal, await konteksRequest());
  await pasangCookieSesi(token);
  redirect(await landingFor(hasil.principal.role, hasil.principal.email));
}

/**
 * Logout. Urutannya penting: **cabut di database lebih dulu**, baru hapus cookie.
 *
 * Membalik urutannya menghasilkan window di mana cookie sudah hilang dari
 * peramban tetapi tokennya masih sah — cukup bagi siapa pun yang sempat
 * menyalinnya untuk tetap masuk.
 */
export async function logoutAction(): Promise<void> {
  const token = await bacaTokenSesi();
  if (token) await keluarSession(token);
  await destroySession();
  redirect("/masuk");
}
