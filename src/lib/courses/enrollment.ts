import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Pendaftaran kursus per peramban — pola yang sama seperti `ls_users`
 * (cookie HMAC-signed, tanpa database). Prototype ini fixture-backed:
 * pendaftaran tersimpan di cookie, bukan di server.
 *
 * Batasan prototype yang disengaja: cookie tidak diikat ke identitas
 * pengguna (satu peramban bersama = pendaftaran bersama), dan secret
 * menumpang SESSION_SECRET seperti modul auth lain. Jangan pakai pola
 * ini untuk data sensitif di luar demo.
 */
export const ENROLL_COOKIE = "ls_enroll";
const ENROLL_SECRET = process.env.SESSION_SECRET ?? "dev-session-secret-careevo";
const ENROLL_MAX_AGE = 60 * 60 * 24 * 90;
const MAX_ENROLL = 50;

export interface Pendaftaran {
  course_id: string;
  slug: string;
  enrolled_at: string;
  selesai_modul: string[];
}

function sign(body: string): string {
  return createHmac("sha256", ENROLL_SECRET).update(body).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function isPendaftaran(value: unknown): value is Pendaftaran {
  if (typeof value !== "object" || value === null) return false;
  const kandidat = value as Record<string, unknown>;
  return (
    typeof kandidat.course_id === "string" &&
    typeof kandidat.slug === "string" &&
    typeof kandidat.enrolled_at === "string" &&
    Array.isArray(kandidat.selesai_modul) &&
    kandidat.selesai_modul.every((item) => typeof item === "string")
  );
}

export function decodePendaftaran(raw: string | undefined): Pendaftaran[] {
  if (!raw) return [];
  const [body, signature] = raw.split(".");
  if (!body || !signature) return [];
  if (!safeEqual(signature, sign(body))) return [];
  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPendaftaran);
  } catch {
    return [];
  }
}

export function encodePendaftaran(daftar: Pendaftaran[]): string {
  const body = Buffer.from(JSON.stringify(daftar), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

async function baca(): Promise<Pendaftaran[]> {
  const jar = await cookies();
  return decodePendaftaran(jar.get(ENROLL_COOKIE)?.value);
}

async function tulis(daftar: Pendaftaran[]): Promise<void> {
  const jar = await cookies();
  jar.set(ENROLL_COOKIE, encodePendaftaran(daftar.slice(-MAX_ENROLL)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ENROLL_MAX_AGE,
  });
}

export async function listPendaftaran(): Promise<Pendaftaran[]> {
  return baca();
}

export async function cariPendaftaran(courseId: string): Promise<Pendaftaran | undefined> {
  const daftar = await baca();
  return daftar.find((item) => item.course_id === courseId);
}

/** Daftarkan kursus; idempoten (mendaftar dua kali tetap satu entri). */
export async function daftarKursus(courseId: string, slug: string): Promise<Pendaftaran[]> {
  const daftar = await baca();
  if (!daftar.some((item) => item.course_id === courseId)) {
    daftar.push({
      course_id: courseId,
      slug,
      enrolled_at: new Date().toISOString(),
      selesai_modul: [],
    });
  }
  await tulis(daftar);
  return daftar;
}

/** Tandai/batalkan satu modul selesai; mengembalikan entri terbaru. */
export async function tandaiModul(
  courseId: string,
  modulId: string,
): Promise<Pendaftaran | null> {
  const daftar = await baca();
  const entri = daftar.find((item) => item.course_id === courseId);
  if (!entri) return null;
  entri.selesai_modul = entri.selesai_modul.includes(modulId)
    ? entri.selesai_modul.filter((id) => id !== modulId)
    : [...entri.selesai_modul, modulId];
  await tulis(daftar);
  return entri;
}
