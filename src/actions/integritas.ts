"use server";

import { getSession } from "@/lib/auth/session";
import { safeRevalidate, PESAN_AKSES_DITOLAK } from "@/lib/actions-common";
import { z } from "zod";
import {
  GalatIntegritas,
  catatPelanggaranDb,
  pulihkanPelanggaranDb,
  putuskanUsulanDb,
  tolakUsulanDb,
} from "@/lib/integritas/service";
import { JENIS_PELANGGARAN } from "@/lib/integritas/katalog";

/**
 * Server Action pencatatan & pemulihan pelanggaran integritas — **staf saja**.
 *
 * Yang dikunci di sini:
 *
 * - **Gate di action adalah penutup, bukan otoritas.** `getSession()` +
 *   `punyaRoleStaff` mencegah permintaan tanpa hak akses mencapai service, tapi
 *   keputusan sebenarnya ada di `service.ts` yang membaca role dari database.
 *   Action yang hanya membaca role dari cookie akan membiarkan role yang sudah
 *   dicabut tetap menulis selama 8 jam.
 * - **Penalti tidak pernah ada di wire.** Tidak ada field `penalty` di form;
 *   bobot disalin dari katalog di service. Kalau field itu ada, siapa pun yang
 *   bisa memanggil action bisa memilih sendiri berapa yang dipotong.
 * - **`kind` divalidasi terhadap daftar yang sama dengan CHECK database.** Zod
 *   dengan `z.enum([...JENIS_PELANGGARAN])`, bukan `z.string()` — supaya pilihan
 *   di form dan constraint di DB tidak bisa berbeda.
 * - **Slug hanya untuk revalidasi**, sama seperti di `actions/review.ts`. Path
 *   cache bukan otoritas, jadi slug keliru paling buruk membatalkan cache yang
 *   salah.
 */

export interface PelanggaranState {
  ok: boolean;
  message?: string;
  error?: string;
  /** Id pelanggaran yang tercatat, supaya form bisa menampilkan hasilnya. */
  pelanggaranId?: string;
}

const BUKTI_SCHEMA = z
  .object({
    run_id: z.string().max(64).optional(),
    quiz_attempt_id: z.string().max(64).optional(),
    event_count: z.number().int().min(0).max(10_000).optional(),
  })
  .optional();

const CATAT_SCHEMA = z.object({
  userId: z.uuid(),
  courseId: z.string().trim().min(1).max(200),
  kind: z.enum(JENIS_PELANGGARAN, {
    message: "Jenis catatan tidak dikenal.",
  }),
  // Batas bawah 10: satu kalimat "kurang." tidak bisa ditinjau dan tidak bisa
  // diaudit. Batas atas mencegah teks yang sangat panjang masuk ke audit.
  reason: z.string().trim().min(10).max(2000),
  bukti: BUKTI_SCHEMA,
  slug: z.string().trim().max(200).optional(),
});

/** Catat satu pelanggaran integritas. Hanya staf. */
export async function catatPelanggaranAction(
  _prev: PelanggaranState,
  formData: FormData,
): Promise<PelanggaranState> {
  const session = await getSession();
  if (!session?.userId) return { ok: false, error: PESAN_AKSES_DITOLAK };

  const parsed = CATAT_SCHEMA.safeParse({
    userId: formData.get("userId"),
    courseId: formData.get("courseId"),
    kind: formData.get("kind"),
    reason: formData.get("reason"),
    bukti: BuktiDariForm(formData),
    slug: formData.get("slug"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }

  try {
    const baris = await catatPelanggaranDb({
      principal: session,
      userId: parsed.data.userId,
      courseId: parsed.data.courseId,
      kind: parsed.data.kind,
      reason: parsed.data.reason,
      bukti: parsed.data.bukti ?? null,
    });
    // Halaman course dan dashboard ikut disegarkan: angka skor dan baris tabel
    // keduanya diturunkan dari baris yang baru ditulis.
    const slug = parsed.data.slug;
    safeRevalidate(
      "/dashboard",
      "/progres",
      ...(slug ? [`/belajar/${slug}`] : []),
    );
    return {
      ok: true,
      pelanggaranId: baris.id,
      message: "Catatan integritas tersimpan dan memotong skor.",
    };
  } catch (error) {
    if (error instanceof GalatIntegritas) return { ok: false, error: error.message };
    throw error;
  }
}

const PULIH_SCHEMA = z.object({
  id: z.uuid(),
  alasan: z.string().trim().min(10).max(2000),
  slug: z.string().trim().max(200).optional(),
});

/** Pulihkan satu pelanggaran. Hanya staf, dengan alasan yang wajib. */
export async function pulihkanPelanggaranAction(
  _prev: PelanggaranState,
  formData: FormData,
): Promise<PelanggaranState> {
  const session = await getSession();
  if (!session?.userId) return { ok: false, error: PESAN_AKSES_DITOLAK };

  const parsed = PULIH_SCHEMA.safeParse({
    id: formData.get("id"),
    alasan: formData.get("alasan"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }

  try {
    const hasil = await pulihkanPelanggaranDb({
      principal: session,
      id: parsed.data.id,
      alasan: parsed.data.alasan,
    });
    if (!hasil) {
      return { ok: false, error: "Catatan itu sudah dipulihkan atau tidak ditemukan." };
    }
    const slug = parsed.data.slug;
    safeRevalidate(
      "/dashboard",
      "/progres",
      ...(slug ? [`/belajar/${slug}`] : []),
    );
    return { ok: true, message: "Catatan dipulihkan. Skor dihitung ulang otomatis." };
  } catch (error) {
    if (error instanceof GalatIntegritas) return { ok: false, error: error.message };
    throw error;
  }
}

/* ------------------------------------------------------------------ *
 * Stage 2 — keputusan atas usulan otomatis
 * ------------------------------------------------------------------ */

const KEPUTUSAN_SCHEMA = z.object({
  id: z.uuid(),
  slug: z.string().trim().max(200).optional(),
});

/**
 * Konfirmasi usulan otomatis jadi pelanggaran yang berlaku. Hanya staf.
 *
 * **Id yang dibawa ke database adalah `proposed`, bukan `active`.**
 * `putuskanUsulanDb` membandingkan status itu, jadi usulan yang sudah diputuskan
 * tidak bisa diputar dua kali meski form-nya di-submit ulang.
 *
 * `null` (sudah diputuskan) dikembalikan sebagai pesan yang **jujur** — bukan
 * error. Dua verifikator menekan bersamaan adalah keadaan normal, dan mengklaim
 * "gagal" untuk keputusan yang sebenarnya sudah sah hanya mengajari staf untuk
 * tidak percaya dengan pesan sistem.
 */
export async function konfirmasiUsulanAction(
  _prev: PelanggaranState,
  formData: FormData,
): Promise<PelanggaranState> {
  const session = await getSession();
  if (!session?.userId) return { ok: false, error: PESAN_AKSES_DITOLAK };

  const parsed = KEPUTUSAN_SCHEMA.safeParse({
    id: formData.get("id"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) return { ok: false, error: "Usulan tidak valid." };

  try {
    const hasil = await putuskanUsulanDb({
      principal: session,
      id: parsed.data.id,
    });
    if (!hasil) {
      return { ok: true, message: "Usulan itu sudah diputuskan. Tidak ada perubahan." };
    }
    const slug = parsed.data.slug;
    safeRevalidate(
      "/dashboard",
      "/progres",
      "/performa",
      "/performa/integritas",
      ...(slug ? [`/belajar/${slug}`] : []),
    );
    return {
      ok: true,
      pelanggaranId: hasil.id,
      message: "Usulan dikonfirmasi. Skor kejujuran peserta turun mulai sekarang.",
    };
  } catch (error) {
    if (error instanceof GalatIntegritas) return { ok: false, error: error.message };
    throw error;
  }
}

const TOLAK_SCHEMA = z.object({
  id: z.uuid(),
  // Batas bawah 10, sama seperti pencatatan: keputusan menolak tanpa penjelasan
  // tidak bisa ditinjau staf berikutnya yang melihat usulan ini muncul lagi.
  alasan: z.string().trim().min(10).max(2000),
  slug: z.string().trim().max(200).optional(),
});

/** Tolak usulan otomatis. Skor tidak bergerak. Hanya staf. */
export async function tolakUsulanAction(
  _prev: PelanggaranState,
  formData: FormData,
): Promise<PelanggaranState> {
  const session = await getSession();
  if (!session?.userId) return { ok: false, error: PESAN_AKSES_DITOLAK };

  const parsed = TOLAK_SCHEMA.safeParse({
    id: formData.get("id"),
    alasan: formData.get("alasan"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }

  try {
    const hasil = await tolakUsulanDb({
      principal: session,
      id: parsed.data.id,
      alasan: parsed.data.alasan,
    });
    if (!hasil) {
      return { ok: true, message: "Usulan itu sudah diputuskan. Tidak ada perubahan." };
    }
    const slug = parsed.data.slug;
    safeRevalidate(
      "/dashboard",
      "/progres",
      "/performa",
      "/performa/integritas",
      ...(slug ? [`/belajar/${slug}`] : []),
    );
    return {
      ok: true,
      message: "Usulan ditolak. Skor kejujuran peserta tidak berubah.",
    };
  } catch (error) {
    if (error instanceof GalatIntegritas) return { ok: false, error: error.message };
    throw error;
  }
}

/**
 * Bukti dari form, atau `undefined` bila tidak ada.
 *
 * Field yang tidak terkirim menghasilkan `undefined` supaya `BUKTI_SCHEMA`
 * membiarkan `bukti` kosong — bentuk "tidak ada bukti" **menerima**, bukan
 * ditolak (careevo-review §7). `NaN` dari `Number("")` juga dibuang: `0` dan
 * "tidak diisi" bukan hal yang sama, dan `NaN` akan lolos ke jsonb sebagai null.
 */
function BuktiDariForm(formData: FormData): Record<string, unknown> | undefined {
  const bukti: Record<string, unknown> = {};

  const runId = String(formData.get("run_id") ?? "").trim();
  if (runId) bukti.run_id = runId;

  const quizId = String(formData.get("quiz_attempt_id") ?? "").trim();
  if (quizId) bukti.quiz_attempt_id = quizId;

  const jumlah = Number(formData.get("event_count"));
  if (formData.get("event_count") !== null && Number.isFinite(jumlah) && jumlah >= 0) {
    bukti.event_count = Math.trunc(jumlah);
  }

  return Object.keys(bukti).length > 0 ? bukti : undefined;
}
