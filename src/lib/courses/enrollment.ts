import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { normalizeOwner } from "@/lib/auth/types";
import { bacaSecret } from "@/lib/config/secrets";
import { catatPenyelesaian, type SumberPenyelesaian } from "@/lib/performa/store";
import { getCourseById } from "./store";

/**
 * Pendaftaran kursus per peramban — pola yang sama seperti `ls_users`
 * (cookie HMAC-signed, tanpa database). Setiap entri modern membawa owner
 * akun sehingga dua akun di peramban yang sama tidak berbagi progres.
 * Entri lama tanpa owner tetap dapat didekode, tetapi tidak diekspos ke
 * pembacaan yang membutuhkan owner.
 */
export const ENROLL_COOKIE = "ls_enroll";
const ENROLL_MAX_AGE = 60 * 60 * 24 * 90;
const MAX_ENROLL = 50;

export interface Pendaftaran {
  course_id: string;
  slug: string;
  owner?: string;
  enrolled_at: string;
  selesai_modul: string[];
}

function sign(body: string): string {
  return createHmac("sha256", bacaSecret("SESSION_SECRET"))
    .update(body)
    .digest("base64url");
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
    (kandidat.owner === undefined ||
      (typeof kandidat.owner === "string" && kandidat.owner.length > 0)) &&
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

function milikPemilik(item: Pendaftaran, owner: string): boolean {
  return (
    item.owner !== undefined && normalizeOwner(item.owner) === normalizeOwner(owner)
  );
}

export async function pendaftaranPenuh(): Promise<Pendaftaran[]> {
  return baca();
}

export async function listPendaftaran(owner: string): Promise<Pendaftaran[]> {
  const daftar = await baca();
  return daftar.filter((item) => milikPemilik(item, owner));
}

export async function cariPendaftaran(
  courseId: string,
  owner: string,
): Promise<Pendaftaran | undefined> {
  const daftar = await baca();
  return daftar.find(
    (item) => item.course_id === courseId && milikPemilik(item, owner),
  );
}

/** Daftarkan kursus; idempoten per owner (mendaftar dua kali tetap satu entri). */
export async function daftarKursus(
  courseId: string,
  slug: string,
  owner: string,
): Promise<Pendaftaran[]> {
  const daftar = await baca();
  if (!daftar.some((item) => item.course_id === courseId && milikPemilik(item, owner))) {
    daftar.push({
      course_id: courseId,
      slug,
      owner: normalizeOwner(owner),
      enrolled_at: new Date().toISOString(),
      selesai_modul: [],
    });
  }
  await tulis(daftar);
  return daftar;
}

/**
 * Tandai/batalkan satu modul selesai; mengembalikan entri terbaru.
 *
 * `sumber` mencatat **jalur** penyelesaian, bukan hanya hasilnya. Tanpa itu,
 * dashboard tidak bisa membedakan modul yang lolos gerbang sesi terverifikasi
 * dari modul yang peserta tandai sendiri — dan perbedaan itu justru yang
 * membuat laporan ini berguna bagi verifikator.
 *
 * Cermin ke toko performa ditulis di sini, di **satu-satunya** penulis
 * `selesai_modul`, supaya cermin dan cookie tidak bisa berbeda: dua pemanggil
 * yang menulis ke dua tempat bisa selalu berbeda pada salah satunya saja.
 */
export async function tandaiModul(
  courseId: string,
  modulId: string,
  owner: string,
  sumber: SumberPenyelesaian = "informal",
  nama: string = "",
): Promise<Pendaftaran | null> {
  const daftar = await baca();
  const entri = daftar.find(
    (item) => item.course_id === courseId && milikPemilik(item, owner),
  );
  if (!entri) return null;
  const baruDitandai = !entri.selesai_modul.includes(modulId);
  entri.selesai_modul = baruDitandai
    ? [...entri.selesai_modul, modulId]
    : entri.selesai_modul.filter((id) => id !== modulId);
  await tulis(daftar);

  const kursus = await getCourseById(courseId);
  await catatPenyelesaian({
    owner,
    nama,
    courseId,
    judulKursus: kursus?.title ?? courseId,
    modulId,
    sumber,
    batal: !baruDitandai,
  });

  return entri;
}
