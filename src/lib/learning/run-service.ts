/**
 * Application service learning run — **server-only**.
 *
 * Ini pengganti `session.ts` untuk Fase 2: run dan kejadiannya sekarang hidup di
 * tabel `learning_runs` / `learning_events` lewat `repository.ts`, bukan di
 * berkas `.data/sessions/*.json`. `session.ts` tetap ada (dan tetap menjadi
 * pemilik HMAC bukti sesi), tetapi ia bukan lagi penyimpanan otoritatif.
 *
 * Invariant yang dipindahkan **apa adanya** dari versi berkas:
 *
 * 1. **Sequence anti-replay tidak bisa dilompati.** Tidak ada satu pun fungsi di
 *    sini yang menerima `sequence`: `repository.catatKejadianRun` mengunci baris
 *    run (`FOR UPDATE`) lalu menulis `max + 1`. Parameter sequence yang ada di
 *    service pasti datang dari wire, dan unique `(learning_run_id, sequence)`
 *    adalah jaring terakhirnya.
 * 2. **Run tertutup tidak bisa diisi kejadian.** `completed` maupun `expired`
 *    ditolak repository (mengembalikan `null`), sama seperti versi berkas yang
 *    menolak menyisipkan ke sesi non-aktif.
 * 3. **Satu run aktif per (user, course).** Dijaga query terindeks
 *    `ambilRunAktif` — tidak ada `readdir` yang men-scan seluruh direktori.
 * 4. **Kedaluwarsa gagal-tertutup.** `expiresAt` yang tidak bisa dibaca dihitung
 *    kedaluwarsa, bukan masih berlaku.
 * 5. **Bukti sesi tetap HMAC yang sama.** `buktiBaru`/`verifikasiBuktiSesi`
 *    diimpor dari `session.ts`, tidak ditulis ulang di sini: keduanya
 *    menandatangani `(courseId, owner, policyVersion)` — **bukan id run** —
 *    sehingga bentuk token tidak berubah oleh migrasi ini. Yang berubah hanya
 *    isi kolom `owner`: dulu email, sekarang `users.id`.
 *
 * Catatan yang disengaja, bukan bug: run yang dilanjutkan tetap memegang
 * `integrityVersion` lamanya. Bila kebijakan course naik versi di tengah sesi,
 * `mulaiRunDb` masih mengembalikan run lama (aturan "lanjutkan run aktif"),
 * sedangkan `buktikanSesiDb` dengan versi baru akan menolaknya sampai run itu
 * kedaluwarsa. Menutup run lama di sini akan mengubah aturan tersebut secara
 * implisit; keputusan itu milik pemanggil/kebijakan, bukan service.
 *
 * Nama fungsi bisnis berbahasa Indonesia; tipe/helper infrastruktur Inggris.
 */

import type { LearningEvent, LearningRun } from "@/lib/db/schema";
import type { SessionPrincipal } from "@/lib/auth/principal";
import { JENIS_KEJADIAN_SAH, klasifikasiKejadian, type KJenisKejadian } from "./akses";
import type { AsalSinyal } from "./sumber-sinyal";
import {
  akhiriRun as akhiriRunRepo,
  ambilEnrollmentById,
  ambilRun,
  ambilRunAktif,
  buatRun,
  catatKejadianRun,
  listRun,
} from "./repository";
import { BATAS_SESI_BAWAAN_MENIT, buktiBaru, verifikasiBuktiSesi } from "./session";

/** Hasil memulai sesi: run otoritatif + token bukti yang dipegang klien. */
export interface HasilMulaiRun {
  run: LearningRun;
  bukti: string;
}

/**
 * Kolom `owner` pada bukti sesi.
 *
 * Versi berkas memakai email yang dinormalkan; sekarang pemilik otoritatif
 * adalah `users.id`. Normalisasi tetap dipertahankan supaya penerbitan dan
 * pembukaan token memakai kolom yang identik — ketidakcocokan sekecil apa pun
 * membuat `verifikasiBuktiSesi` mengembalikan `null`.
 */
function pemilikBukti(userId: string): string {
  return userId.trim().toLowerCase();
}

/**
 * Apakah sebuah run sudah melewati masa berlakunya.
 *
 * `expiresAt` yang tidak bisa dibaca (bukan `Date`, `Invalid Date`, bukan angka,
 * atau string yang tidak bisa diparse) dihitung **kedaluwarsa** — gagal-tertutup,
 * sama seperti `kedaluwarsa()` di versi berkas. `now` bisa disuntikkan supaya
 * aturan ini bisa diuji tanpa memalsukan jam sistem.
 */
export function kedaluwarsaDb(run: LearningRun, now: number = Date.now()): boolean {
  const nilai: unknown = run.expiresAt;
  const akhir =
    nilai instanceof Date
      ? nilai.getTime()
      : typeof nilai === "string"
        ? Date.parse(nilai)
        : Number.NaN;
  if (!Number.isFinite(akhir)) return true;
  return now >= akhir;
}

/** Tutup run sebagai `expired`. Idempoten: run non-aktif dibiarkan apa adanya. */
export async function tandaiKedaluwarsaDb(runId: string): Promise<LearningRun | null> {
  return akhiriRunRepo(runId, "expired");
}

/**
 * Mulai — atau lanjutkan — sesi belajar terverifikasi.
 *
 * Satu run aktif per (user, course): bila sudah ada dan belum kedaluwarsa, run
 * itu dikembalikan apa adanya (peserta yang memuat ulang halaman tidak
 * kehilangan sesinya, dan tidak ada run kedua yang menyaingi yang pertama).
 * Run aktif yang sudah lewat batas ditutup lebih dulu, baru run baru dibuat —
 * persis seperti versi berkas yang membersihkan dirinya agar tidak memblokir
 * sesi berikutnya.
 *
 * `enrollmentId` harus milik principal yang sama: run yang menunjuk enrollment
 * orang lain akan membuat kepemilikan bukti bisa dipindah-pindahkan. Server
 * Action memuat enrollment dari (user, course) principal, dan service ini
 * memeriksanya sekali lagi.
 */
export async function mulaiRunDb(input: {
  principal: SessionPrincipal;
  enrollmentId: string;
  courseId: string;
  moduleId?: string | null;
  policyVersion: number;
  /**
   * Menit sejak mulai sampai run kedaluwarsa. Default 30 (sama dengan versi
   * berkas). Nilai yang bukan angka finit / negatif jatuh ke default, bukan
   * menghasilkan `Invalid Date` yang ditolak kolom `expires_at`.
   */
  batasMenit?: number;
}): Promise<HasilMulaiRun> {
  const userId = input.principal.userId;

  const ada = await ambilRunAktif(userId, input.courseId);
  if (ada) {
    if (!kedaluwarsaDb(ada)) {
      return { run: ada, bukti: terbitkanBukti(input.courseId, userId, input.policyVersion) };
    }
    await tandaiKedaluwarsaDb(ada.id);
  }

  const enrollment = await ambilEnrollmentById(input.enrollmentId);
  if (!enrollment || enrollment.userId !== userId) {
    throw new Error("Enrollment tidak ditemukan untuk pengguna ini.");
  }

  const batasMenit =
    Number.isFinite(input.batasMenit) && (input.batasMenit as number) >= 0
      ? (input.batasMenit as number)
      : BATAS_SESI_BAWAAN_MENIT;

  const run = await buatRun({
    userId,
    enrollmentId: input.enrollmentId,
    courseId: input.courseId,
    moduleId: input.moduleId ?? null,
    expiresAt: new Date(Date.now() + batasMenit * 60_000),
    integrityVersion: input.policyVersion,
  });

  return { run, bukti: terbitkanBukti(input.courseId, userId, input.policyVersion) };
}

/** Bukti sesi untuk pemilik yang sudah dinormalkan — satu tempat, satu bentuk. */
function terbitkanBukti(courseId: string, userId: string, policyVersion: number): string {
  return buktiBaru({ courseId, owner: pemilikBukti(userId), policyVersion });
}

/**
 * Catat satu kejadian integritas pada run milik principal.
 *
 * Tiga penjagaan, semuanya mengembalikan `null` dengan alasan yang sama besar
 * supaya pemanggil tidak bisa memakai perbedaan balasan untuk menebak keberadaan
 * run milik orang lain:
 *
 * - `jenis` harus ada di `JENIS_KEJADIAN_SAH` (nilai datang dari wire);
 * - run harus ada dan `run.userId === principal.userId`;
 * - run harus `active` — ditegakkan repository, karena ia yang mengunci baris
 *   dan menulis `max + 1`.
 *
 * `visibilitas` disimpan apa adanya (termasuk `null`) bersama klasifikasinya,
 * sama dengan `KejadianIntegritas` di versi berkas; `detail` dipotong 300
 * karakter sebelum menyentuh database.
 */
/** Empat asal yang sah; nilai lain apa pun turun ke `"server"`. */
const ASAL_SAH: ReadonlySet<string> = new Set(["browser", "kamera", "luar", "server"]);

function asalValid(nilai: string | undefined): AsalSinyal {
  return nilai && ASAL_SAH.has(nilai) ? (nilai as AsalSinyal) : "server";
}

export async function catatKejadianDb(input: {
  principal: SessionPrincipal;
  runId: string;
  jenis: KJenisKejadian;
  visibilitas: "visible" | "hidden" | null;
  detail?: string;
  /**
   * Asal sinyal yang diklaim klien. **Tidak dipercaya penuh**: nilai di luar
   * empat asal yang sah turun ke `"server"`, yang tidak menuduh dan selalu ada
   * untuk setiap jenis kejadian.
   */
  asal?: string;
}): Promise<LearningEvent | null> {
  if (!(JENIS_KEJADIAN_SAH as readonly string[]).includes(input.jenis)) return null;

  const run = await ambilRun(input.runId);
  if (!run) return null;
  if (run.userId !== input.principal.userId) return null;

  return catatKejadianRun({
    runId: input.runId,
    kind: input.jenis,
    payloadRedacted: {
      jenis_klasifikasi: klasifikasiKejadian(input.jenis, input.visibilitas),
      visibilitas: input.visibilitas,
      asal: asalValid(input.asal),
      ...(input.detail ? { detail: input.detail.slice(0, 300) } : {}),
    },
  });
}

/**
 * Tutup run sebagai `completed` atas permintaan peserta.
 *
 * Idempoten seperti versi berkas: run yang sudah tertutup dikembalikan apa
 * adanya (repository mengembalikan `null` untuk run non-aktif, jadi barisnya
 * dibaca ulang), bukan mengubah waktu berakhir yang sudah tercatat.
 *
 * `alasan` **tidak** disimpan di sini: `learning_runs` tidak punya kolom alasan
 * (lihat `schema.ts`), dan menulisnya ke `metadata_redacted` akan mencampur
 * metadata pembuatan run dengan alasan penutupan. Alasan tetap dipakai pemanggil
 * untuk audit/outbox; menghapus parameternya akan menyembunyikan niat itu.
 */
export async function akhiriRunDb(input: {
  principal: SessionPrincipal;
  runId: string;
  alasan: string;
}): Promise<LearningRun | null> {
  const run = await ambilRun(input.runId);
  if (!run) return null;
  if (run.userId !== input.principal.userId) return null;

  const ditutup = await akhiriRunRepo(input.runId, "completed");
  if (ditutup) return ditutup;

  // Sudah non-aktif sejak awal: kembalikan keadaan yang ada, bukan `null`.
  return ambilRun(input.runId);
}

/**
 * Validasi bukti sesi terhadap database.
 *
 * Urutannya sama dengan versi berkas: tanda tangan lebih dulu, baru keadaan
 * server. Empat hal diperiksa: kecocokan token (tanda tangan, course, owner,
 * versi) lewat `verifikasiBuktiSesi`; adanya run aktif milik user untuk course
 * itu; masa berlaku; dan `integrityVersion` run terhadap versi yang diminta.
 * Pemeriksaan terakhir itu baru dibandingkan ke **run**, bukan hanya ke token —
 * token bisa saja sah untuk versi 9 sementara run-nya dibuat di versi 7.
 *
 * Run aktif yang sudah lewat batas ditandai `expired` sebelum `null`
 * dikembalikan: dengan begitu ia tidak lagi menghalangi run berikutnya.
 */
export async function buktikanSesiDb(input: {
  userId: string;
  courseId: string;
  policyVersion: number;
  token: string;
}): Promise<LearningRun | null> {
  const bukti = verifikasiBuktiSesi(input.token, {
    courseId: input.courseId,
    owner: pemilikBukti(input.userId),
    policyVersion: input.policyVersion,
  });
  if (!bukti) return null;

  const run = await ambilRunAktif(input.userId, input.courseId);
  if (!run) return null;

  if (kedaluwarsaDb(run)) {
    await tandaiKedaluwarsaDb(run.id);
    return null;
  }

  if (run.integrityVersion !== input.policyVersion) return null;

  return run;
}

/** Semua run — pembacaan lintas-pemilik untuk dashboard staf (tanpa gate). */
export async function listRunStaf(): Promise<LearningRun[]> {
  return listRun();
}
