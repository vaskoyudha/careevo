import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { bacaSecret } from "@/lib/config/secrets";
import { klasifikasiKejadian, type KJenisKejadian } from "./akses";
import type { AsalSinyal } from "./sumber-sinyal";

/**
 * Penyimpanan sesi belajar — **server-only**.
 *
 * Modul ini menyentuh `node:fs/promises` dan `node:crypto`, jadi ia hanya boleh
 * diimpor dari server (route handler, server action, server component). Jangan
 * mengimpornya dari komponen klien: bundel klien akan gagal, dan kalau toh
 * jalan, peserta bisa membaca aturan integritas yang seharusnya otoritatif di
 * server.
 *
 * Sesi harus hidup di server, bukan di cookie: kelulusan dan status integritas
 * hanya boleh berasal dari catatan yang tidak bisa diubah peserta. Cookie
 * (seperti `ls_enroll`) tetap dipakai untuk progres informal, tetapi tidak
 * pernah menjadi bukti sesi.
 *
 * Direktori bisa dialihkan lewat `CAREERS_SESSION_DIR` supaya test tidak
 * menyentuh `.data/` milik repo.
 */

/** Batas sesi ketika course tidak punya modul yang menetapkan angka sendiri. */
export const BATAS_SESI_BAWAAN_MENIT = 30;

/** Direktori sesi aktif; dihitung per panggilan agar override test ikut terbaca. */
export function tempatSesi(): string {
  return process.env.CAREERS_SESSION_DIR ?? path.join(process.cwd(), ".data", "sessions");
}

export interface KejadianIntegritas {
  at: string;
  jenis: KJenisKejadian;
  jenis_klasifikasi: "kejadian" | "celah";
  visibilitas: "visible" | "hidden" | null;
  /**
   * Asal sinyal, sudah tervalidasi server terhadap empat asal yang sah
   * (`run-service.asalValid`). `undefined` untuk baris lama yang ditulis
   * sebelum field ini ada — pembaca harus memperlakukannya sebagai `server`,
   * bukan membuangnya.
   */
  asal?: AsalSinyal;
  detail?: string;
}

export type StatusRun = "aktif" | "diakhiri" | "kedaluwarsa";

export interface SessionRun {
  id: string;
  course_id: string;
  owner: string;
  policy_version: number;
  status: StatusRun;
  mulai_at: string;
  /**
   * Batas masa berlaku, ISO. **Opsional** supaya berkas run yang ditulis
   * sebelum field ini ada tidak ikut dianggap korup — `kedaluwarsa()` sudah
   * menurunkannya ke batas bawaan.
   */
  berlaku_hingga?: string;
  berakhir_at: string | null;
  alasan_akhir?: string;
  kejadian: KejadianIntegritas[];
}

export interface BuktiSesi {
  courseId: string;
  owner: string;
  policyVersion: number;
}

function tanda(isi: string): string {
  return createHmac("sha256", bacaSecret("SESSION_SECRET"))
    .update(isi)
    .digest("base64url");
}

/** Perbandingan waktu-tetap; panjang berbeda langsung ditolak (syarat timingSafeEqual). */
function samakan(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Bentuk minimal run yang layak dipercaya dari disk.
 *
 * Sengaja longgar pada field opsional (`kejadian` diperiksa sebatas array) tapi
 * ketat pada field yang dipakai pengambilan keputusan, supaya berkas yang korup
 * atau diedit tangan tidak diam-diam lolos sebagai sesi sah.
 */
function isRun(value: unknown): value is SessionRun {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    typeof c.course_id === "string" &&
    typeof c.owner === "string" &&
    typeof c.policy_version === "number" &&
    typeof c.status === "string" &&
    typeof c.mulai_at === "string" &&
    Array.isArray(c.kejadian)
  );
}

/** Pemisah kolom bukti sesi. Kolom tidak boleh memuatnya sendiri. */
const PEMISAH_BUKTI = "\u0001";

/**
 * Tolak kolom bukti sesi yang kosong atau memuat pemisah.
 *
 * Tanda tangan mengautentikasi string gabungan, bukan kolom satu per satu, jadi
 * kolom yang memuat pemisah membuat pembacaan kolom tidak lagi sepakat dengan
 * yang ditandatangani — penyerang bisa menyelipkan kolom ekstra untuk memakai
 * token milik orang lain pada versi kebijakan yang berbeda.
 */
function periksaKolomBukti(nilai: string): string {
  if (!nilai || nilai.includes(PEMISAH_BUKTI)) throw new Error("Kolom bukti sesi tidak valid");
  return nilai;
}

/** Bukti sesi: tanda tangan atas (courseId, owner, policyVersion). */
export function buktiBaru(input: BuktiSesi): string {
  const courseId = periksaKolomBukti(input.courseId);
  const owner = periksaKolomBukti(input.owner);
  const isi = [courseId, owner, input.policyVersion].join(PEMISAH_BUKTI);
  return `${Buffer.from(isi, "utf8").toString("base64url")}.${tanda(isi)}`;
}

/**
 * Buka dan periksa bukti sesi.
 *
 * Tanda tangan diperiksa lebih dulu, baru isinya dibandingkan dengan harapan.
 * Semua ketidakcocokan (tanda tangan, course, owner, versi kebijakan)
 * dikembalikan sebagai `null` — bukan pesan berbeda-beda — supaya pemanggil
 * tidak bisa memakai perbedaan pesan untuk menebak isi token orang lain.
 */
export function verifikasiBuktiSesi(token: string, harapan: BuktiSesi): BuktiSesi | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  let isi: string;
  try {
    isi = Buffer.from(body, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!samakan(signature, tanda(isi))) return null;

  // Harus tepat tiga kolom: jumlah yang lain berarti ada pemisah yang
  // diselipkan ke dalam kolom, dan pembacaan kolom tidak lagi cocok dengan
  // string yang ditandatangani.
  const bagian = isi.split(PEMISAH_BUKTI);
  if (bagian.length !== 3) return null;
  const [courseId, owner, versi] = bagian;
  if (!courseId || !owner) return null;
  const policyVersion = Number(versi);
  if (!Number.isInteger(policyVersion)) return null;

  if (courseId !== harapan.courseId || owner !== harapan.owner) return null;
  if (policyVersion !== harapan.policyVersion) return null;
  return { courseId, owner, policyVersion };
}

/** Path berkas satu run; menolak id yang mencoba keluar dari direktori sesi. */
function berkasRun(id: string): string {
  const aman = path.basename(id);
  if (aman !== id) throw new Error(`Id sesi tidak valid: ${id}`);
  return path.join(tempatSesi(), `${aman}.json`);
}

async function tulisRun(run: SessionRun): Promise<void> {
  const tujuan = berkasRun(run.id);
  await mkdir(path.dirname(tujuan), { recursive: true });
  // Tulis ke berkas sementara lalu rename: `rename` atomik di filesystem yang
  // sama, sehingga proses yang mati di tengah penulisan tidak meninggalkan
  // berkas sesi yang terpotong (yang akan membuat bukti sesi hilang).
  const sementara = `${tujuan}.tmp`;
  await writeFile(sementara, `${JSON.stringify(run, null, 2)}\n`, "utf8");
  await rename(sementara, tujuan);
}

/**
 * Apakah sebuah run sudah melewati masa berlakunya.
 *
 * Run tanpa `berlaku_hingga` (berkas lama) dihitung dari `mulai_at` + batas
 * bawaan. Nilai yang tidak bisa diparse dianggap kedaluwarsa — gagal-tertutup,
 * bukan gagal-terbuka.
 */
export function kedaluwarsa(
  run: Pick<SessionRun, "mulai_at" | "berlaku_hingga">,
  now: number = Date.now(),
): boolean {
  const mulai = Date.parse(run.mulai_at);
  if (!Number.isFinite(mulai)) return true;
  const akhir = run.berlaku_hingga
    ? Date.parse(run.berlaku_hingga)
    : mulai + BATAS_SESI_BAWAAN_MENIT * 60_000;
  if (!Number.isFinite(akhir)) return true;
  return now >= akhir;
}

/** Tutup run sebagai kedaluwarsa; idempoten seperti `akhiriRun`. */
export async function tandaiKedaluwarsa(id: string): Promise<SessionRun | null> {
  const run = await ambilRun(id);
  if (!run) return null;
  if (run.status !== "aktif") return run;
  const berikut: SessionRun = {
    ...run,
    status: "kedaluwarsa",
    berakhir_at: new Date().toISOString(),
    alasan_akhir: "kedaluwarsa_waktu",
  };
  await tulisRun(berikut);
  return berikut;
}

export async function ambilRun(id: string): Promise<SessionRun | null> {
  let mentah: string;
  try {
    mentah = await readFile(berkasRun(id), "utf8");
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(mentah) as unknown;
    return isRun(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function mulaiRun(input: {
  courseId: string;
  owner: string;
  policyVersion: number;
  /**
   * Menit sejak mulai sampai run kedaluwarsa. Default 30.
   *
   * Nilainya berasal dari `batas_waktu_menit` checkpoint modul — lihat
   * `mulaiSesiAction`. Field itu sudah ada di model dan sudah dijelaskan
   * artinya, jadi inilah pembaca pertamanya.
   */
  batasMenit?: number;
}): Promise<SessionRun> {
  const mulai = new Date();
  const batasMenit = input.batasMenit ?? BATAS_SESI_BAWAAN_MENIT;
  const run: SessionRun = {
    id: `sesi-${randomUUID()}`,
    course_id: input.courseId,
    owner: input.owner.trim().toLowerCase(),
    policy_version: input.policyVersion,
    status: "aktif",
    mulai_at: mulai.toISOString(),
    berlaku_hingga: new Date(mulai.getTime() + batasMenit * 60_000).toISOString(),
    berakhir_at: null,
    kejadian: [],
  };
  await tulisRun(run);
  return run;
}

export async function catatKejadian(input: {
  runId: string;
  jenis: KJenisKejadian;
  visibilitas: "visible" | "hidden" | null;
  detail?: string;
  at?: string;
}): Promise<SessionRun | null> {
  const run = await ambilRun(input.runId);
  // Kejadian pada sesi yang sudah ditutup ditolak: menyisipkan kejadian ke
  // sesi selesai akan mengubah bukti setelah fakta.
  if (!run || run.status !== "aktif") return null;

  const kejadian: KejadianIntegritas = {
    at: input.at ?? new Date().toISOString(),
    jenis: input.jenis,
    jenis_klasifikasi: klasifikasiKejadian(input.jenis, input.visibilitas),
    visibilitas: input.visibilitas,
    ...(input.detail ? { detail: input.detail.slice(0, 300) } : {}),
  };

  // Batas 500 kejadian: satu peserta dengan kamera bermasalah bisa menghasilkan
  // ribuan kejadian, dan berkas yang tumbuh tanpa batas memperlambat pembacaan
  // tiap permintaan.
  const berikut: SessionRun = { ...run, kejadian: [...run.kejadian, kejadian].slice(-500) };
  await tulisRun(berikut);
  return berikut;
}

export async function akhiriRun(id: string, alasan: string): Promise<SessionRun | null> {
  const run = await ambilRun(id);
  if (!run) return null;
  // Idempoten: menutup sesi yang sudah tertutup mengembalikan keadaan apa
  // adanya, bukan mengubah waktu berakhir atau alasan yang sudah tercatat.
  if (run.status !== "aktif") return run;
  const berikut: SessionRun = {
    ...run,
    status: "diakhiri",
    berakhir_at: new Date().toISOString(),
    alasan_akhir: alasan.slice(0, 200),
  };
  await tulisRun(berikut);
  return berikut;
}

/**
 * Validasi bukti sesi terhadap server.
 *
 * Empat hal diperiksa sekaligus: tanda tangan, kecocokan owner, kecocokan
 * course, dan kecocokan versi kebijakan. Versi ikut diperiksa supaya peserta
 * yang mulai di bawah kebijakan lama tidak otomatis tunduk pada aturan baru.
 */
export async function buktikanSesi(input: {
  courseId: string;
  owner: string;
  policyVersion: number;
  token: string;
}): Promise<SessionRun | null> {
  const bukti = verifikasiBuktiSesi(input.token, {
    courseId: input.courseId,
    owner: input.owner.trim().toLowerCase(),
    policyVersion: input.policyVersion,
  });
  if (!bukti) return null;
  const id = await cariRunAktif(input);
  if (!id) return null;
  const run = await ambilRun(id);
  if (!run || run.status !== "aktif") return null;
  // Menulis statusnya bukan kosmetik: `cariRunAktif` melewatkan run non-aktif,
  // sehingga run yang lewat batas membersihkan dirinya sendiri dan tidak lagi
  // memblokir run berikutnya yang dibuat peserta yang sama.
  if (kedaluwarsa(run)) {
    await tandaiKedaluwarsa(id);
    return null;
  }
  return run;
}

/** Cari sesi aktif milik seorang peserta untuk sebuah course. */
export async function cariRunAktif(input: { courseId: string; owner: string }): Promise<string | null> {
  let berkas: string[];
  try {
    berkas = await readdir(tempatSesi());
  } catch {
    return null;
  }
  for (const nama of berkas) {
    if (!nama.endsWith(".json")) continue;
    const run = await ambilRun(nama.replace(/\.json$/, ""));
    if (!run) continue;
    if (run.status !== "aktif") continue;
    if (run.course_id !== input.courseId) continue;
    if (run.owner !== input.owner.trim().toLowerCase()) continue;
    return run.id;
  }
  return null;
}

/** Semua run tersimpan — pembacaan lintas-pemilik untuk dashboard staf. */
export async function listRun(): Promise<SessionRun[]> {
  let berkas: string[];
  try {
    berkas = await readdir(tempatSesi());
  } catch {
    return [];
  }
  const hasil: SessionRun[] = [];
  for (const nama of berkas) {
    if (!nama.endsWith(".json")) continue;
    const run = await ambilRun(nama.replace(/\.json$/, ""));
    if (run) hasil.push(run);
  }
  return hasil;
}
