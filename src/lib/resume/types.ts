/**
 * LinkedIn-style resume domain.
 *
 * The structured side of a learner's profile: work history, projects,
 * education, skills/certifications, an "about" blurb and contact links, plus
 * uploaded files (a CV and an optional portfolio PDF).
 *
 * Deliberately separate from `src/lib/profile` (identity + avatar/cover) and
 * `src/lib/onboarding` (personalization):
 *  - `src/lib/profile` is small and lives in a signed cookie (fits the 4KB
 *    budget because it is just a name, a bio and two downscaled images).
 *  - This module is unbounded in size (N jobs, N projects, files of megabytes),
 *    so it is persisted to the **server filesystem** under `.data/`, not a
 *    cookie. Putting it in a cookie would silently exceed the ~4KB limit and
 *    lose data with no error — see the store for the exact on-disk layout.
 */

export interface RiwayatKerja {
  id: string;
  /** Job title, e.g. "Frontend Developer". */
  jabatan: string;
  /** Employer name. */
  perusahaan: string;
  /** Free-form period, e.g. "Jan 2024 — Sekarang". */
  periode: string;
  /** Optional city / work mode, e.g. "Jakarta · Hybrid". */
  lokasi: string;
  /** What the person did. May be empty. */
  deskripsi: string;
}

export interface RiwayatProyek {
  id: string;
  nama: string;
  /** Short description. May be empty. */
  deskripsi: string;
  /** Optional demo/app URL. */
  url: string;
  /** Optional source repository URL. */
  repo: string;
}

export interface Pendidikan {
  id: string;
  /** School / university. */
  institusi: string;
  /** Degree / major, e.g. "S1 Teknik Informatika". */
  jurusan: string;
  /** Free-form period, e.g. "2020 — 2024". */
  periode: string;
}

export interface Sertifikasi {
  id: string;
  nama: string;
  /** Issuing body, e.g. "Google". */
  penerbit: string;
  /** Optional credential URL. */
  url: string;
}

export interface ProfilKontak {
  /** Optional city / country shown in the header. */
  lokasi: string;
  /** Optional phone (kept off the public page by default — see UI). */
  telepon: string;
  linkedin: string;
  github: string;
  /** Any other personal site. */
  situs: string;
}

export interface Resume {
  /** Normalized email of the owning account. */
  owner: string;
  /** Public handle (without `@`), used to resolve the profile on /p/[username]. */
  username: string;
  /** LinkedIn-style headline, e.g. "Frontend developer · React, TypeScript". */
  headline: string;
  /** Longer "About" paragraph. */
  ringkasan: string;
  kontak: ProfilKontak;
  pengalaman: RiwayatKerja[];
  proyek: RiwayatProyek[];
  pendidikan: Pendidikan[];
  /** Free-text skill tags. */
  skill: string[];
  sertifikasi: Sertifikasi[];
  /**
   * Uploaded files, keyed by purpose. `null` means "none uploaded". The value
   * is the on-disk file name only (`<slug>.pdf`), never a path — the store
   * resolves it under the owner's directory, so a crafted name cannot escape.
   */
  berkas: {
    cv: BerkasUpload | null;
    portofolio: BerkasUpload | null;
  };
  /** ISO timestamp of the last save. */
  updatedAt: string;
  /** Schema version so future migrations can detect old payloads. */
  version: number;
}

export interface BerkasUpload {
  /** On-disk file name (basename only). */
  nama: string;
  /** Original name as uploaded, shown to the user. */
  namaAsli: string;
  /** Size in bytes. */
  ukuran: number;
  /** ISO timestamp of the upload. */
  diunggahPada: string;
}

export const RESUME_VERSION = 1;

/** The two upload slots the resume supports. */
export type Slot = "cv" | "portofolio";

/** Maximum upload size for a CV / portfolio file: 5 MB. */
export const BERKAS_MAX_BYTES = 5 * 1024 * 1024;

/** Maximum number of entries per list section — keeps the public page sane. */
export const MAX_ENTRIES = 30;

/** The MIME type we accept for uploads. */
export const BERKAS_MIME = "application/pdf";

/**
 * An empty resume for an owner. Every list starts empty so the UI renders
 * "nothing yet" states rather than crashing on undefined.
 */
export function resumeKosong(owner: string, username: string): Resume {
  return {
    owner: owner.trim().toLowerCase(),
    username: username.trim().replace(/^@/, ""),
    headline: "",
    ringkasan: "",
    kontak: { lokasi: "", telepon: "", linkedin: "", github: "", situs: "" },
    pengalaman: [],
    proyek: [],
    pendidikan: [],
    skill: [],
    sertifikasi: [],
    berkas: { cv: null, portofolio: null },
    updatedAt: new Date(0).toISOString(),
    version: RESUME_VERSION,
  };
}

/** A short, collision-resistant id for a list entry. */
export function buatId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * Structural validation for an untrusted parsed value (read back from disk).
 * Returns the value shape-checked, or `null` when it is not a usable resume.
 *
 * This is deliberately lenient about *content* (an empty headline is fine) but
 * strict about *shape*: a corrupt file must not crash every page that reads it.
 */
export function isResume(value: unknown): value is Resume {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  const isStr = (v: unknown) => typeof v === "string";
  const isList = (v: unknown) => Array.isArray(v);
  const berkas = c.berkas as Record<string, unknown> | undefined;

  return (
    isStr(c.owner) &&
    isStr(c.username) &&
    isStr(c.headline) &&
    isStr(c.ringkasan) &&
    typeof c.kontak === "object" &&
    c.kontak !== null &&
    isList(c.pengalaman) &&
    isList(c.proyek) &&
    isList(c.pendidikan) &&
    isList(c.skill) &&
    isList(c.sertifikasi) &&
    typeof berkas === "object" &&
    berkas !== null &&
    (berkas.cv === null || typeof berkas.cv === "object") &&
    (berkas.portofolio === null || typeof berkas.portofolio === "object") &&
    isStr(c.updatedAt) &&
    typeof c.version === "number"
  );
}

/**
 * Turn a free-text name into a filesystem-safe ASCII slug.
 * `"CV Raka Pratama.pdf"` → `"cv-raka-pratama"`. Falls back to `"berkas"` when
 * nothing usable survives (e.g. a wholly non-Latin name).
 */
export function slugBerkas(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "berkas";
}

export type HasilValidasiBerkas =
  | { ok: true }
  | { ok: false; pesan: string };

/**
 * Validate an uploaded file's declared metadata + first bytes.
 *
 * Kept as a pure function so it can be unit-tested without the server action's
 * `next/headers` dependency. The browser `accept` attribute is only a hint; a
 * crafted request supplies any `type` it likes, so we check the MIME type AND
 * the `%PDF-` magic bytes, and enforce the size cap here — the single source of
 * truth both the action and its test use.
 */
export function validasiBerkas(input: {
  size: number;
  type: string;
  bytes: Uint8Array;
}): HasilValidasiBerkas {
  if (input.size === 0) return { ok: false, pesan: "Pilih file PDF dulu." };
  if (input.size > BERKAS_MAX_BYTES) {
    return { ok: false, pesan: `Ukuran maksimum ${Math.round(BERKAS_MAX_BYTES / 1024 / 1024)}MB.` };
  }
  if (input.type && input.type !== BERKAS_MIME) {
    return { ok: false, pesan: "Hanya file PDF yang diterima." };
  }
  const head = Buffer.from(input.bytes.slice(0, 5)).toString("latin1");
  if (head !== "%PDF-") return { ok: false, pesan: "Berkas ini bukan PDF yang valid." };
  return { ok: true };
}
