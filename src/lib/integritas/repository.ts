/**
 * Repository pelanggaran integritas — **server-only**.
 *
 * Satu-satunya lapisan yang menyentuh tabel `integrity_violations`. Service
 * (`service.ts`) memanggil fungsi di sini; **tidak ada** query database langsung
 * dari Server Action atau component.
 *
 * Yang dikunci di sini:
 *
 * - **Tidak ada penulisan skor.** Repository ini hanya menulis **catatan
 *   pelanggaran**; angka skor selalu diturunkan di `skor.ts` dari baris
 *   `active`. Menyimpan skor di sini akan membuat skor bisa berbeda dengan
 *   penjumlahan penalti — dan tidak ada yang memperingatkan.
 * - **`penalty` di-snapshot di pemanggil.** Repository menyalin nilai yang
 *   sudah decided service (dari katalog saat ini), bukan membacanya sendiri, agar
 *   keputusan "bobot apa yang dipakai saat ini" ada di satu tempat yang teruji.
 * - **Expunge adalah `UPDATE`, bukan `DELETE`.** Menghapus baris akan menghapus
 *   bukti siapa yang pernah memutuskan, persis seperti `user_roles.revoke` yang
 *   juga `UPDATE revoked_at` (lihat komentar di `schema.ts`).
 * - **Expunge idempoten.** Dua pemanggilan berurutan pada baris yang sama
 *   menghasilkan satu perubahan; pemanggil kedua melihat baris yang sudah
 *   `expunged` dan tidak menimpanya (compare-and-set pada `status = 'active'`),
 *   sehingga waktu pemulihan yang pertama tidak tertimpa.
 */

import { and, desc, eq, lte, sql } from "drizzle-orm";
import { getDb, type KoneksiDb, type TransaksiDb } from "@/lib/db/client";
import { integrityViolations, type IntegrityViolation } from "@/lib/db/schema";
import type { JenisPelanggaran } from "./katalog";

export type EksekutorDb = KoneksiDb | TransaksiDb;

/** Semua pelanggaran seorang user, termasuk yang sudah dipulihkan. */
export async function listSemuaPelanggaran(
  userId: string,
): Promise<IntegrityViolation[]> {
  return getDb()
    .select()
    .from(integrityViolations)
    .where(eq(integrityViolations.userId, userId))
    .orderBy(desc(integrityViolations.createdAt));
}

/** Pelanggaran `active` seorang user — satu-satunya input skor. */
export async function listPelanggaranAktif(
  userId: string,
): Promise<IntegrityViolation[]> {
  return getDb()
    .select()
    .from(integrityViolations)
    .where(
      and(
        eq(integrityViolations.userId, userId),
        eq(integrityViolations.status, "active"),
      ),
    )
    .orderBy(desc(integrityViolations.createdAt));
}

/**
 * Pelanggaran seorang user pada satu course, `expunged` pun ikut.
 *
 * Halaman course memakai ini supaya tabel report bisa menampilkan status
 * "dipulihkan" — bukan hanya yang masih memotong skor. Pelanggaran dari course
 * lain tidak pernah ikut: `courseId` adalah bagian dari filter, bukan dari
 * `where` afterwards.
 */
export async function listPelanggaranCourse(
  userId: string,
  courseId: string,
): Promise<IntegrityViolation[]> {
  return getDb()
    .select()
    .from(integrityViolations)
    .where(
      and(
        eq(integrityViolations.userId, userId),
        eq(integrityViolations.courseId, courseId),
      ),
    )
    .orderBy(desc(integrityViolations.createdAt));
}

/** Pelanggaran `active` seorang user pada satu course. */
export async function listPelanggaranAktifCourse(
  userId: string,
  courseId: string,
): Promise<IntegrityViolation[]> {
  const semua = await listPelanggaranCourse(userId, courseId);
  return semua.filter((b) => b.status === "active");
}

/**
 * Catat satu pelanggaran. Penalti, jenis, dan alasan sudah divalidasi service.
 *
 * `evidenceRedacted` disaring pemanggil (service) sebelum sampai sini, dengan
 * `saringPayloadAudit` — repository tidak menyaring sendiri supaya tidak ada dua
 * definisi "apa yang boleh disimpan".
 */
export async function catatPelanggaran(
  db: EksekutorDb,
  input: {
    userId: string;
    courseId: string;
    enrollmentId: string | null;
    kind: JenisPelanggaran;
    penalty: number;
    reason: string;
    reviewerUserId: string | null;
    evidenceRedacted: Record<string, unknown> | null;
  },
): Promise<IntegrityViolation> {
  const [baris] = await db
    .insert(integrityViolations)
    .values({
      userId: input.userId,
      courseId: input.courseId,
      enrollmentId: input.enrollmentId,
      kind: input.kind,
      penalty: input.penalty,
      reason: input.reason,
      reviewerUserId: input.reviewerUserId,
      evidenceRedacted: input.evidenceRedacted,
    })
    .returning();

  if (!baris) throw new Error("Pelanggaran gagal tercatat: tidak ada baris kembali.");
  return baris;
}

/**
 * Pulihkan satu pelanggaran — compare-and-set `active` → `expunged`.
 *
 * Mengembalikan baris yang sudah berubah, `null` bila barisnya tidak ada atau
 * sudah dipulihkan. `null` di sini **bukan** kegagalan: memanggil pemulihan dua
 * kali adalah hal yang wajar (dua completion paralel), dan keduanya harus berhasil
 * tanpa menimpa waktu pemulihan yang pertama.
 */
export async function pulihkanPelanggaran(
  db: EksekutorDb,
  input: { id: string; alasan: string },
): Promise<IntegrityViolation | null> {
  const [baris] = await db
    .update(integrityViolations)
    .set({ status: "expunged", expungedAt: new Date(), expungedReason: input.alasan })
    .where(
      and(eq(integrityViolations.id, input.id), eq(integrityViolations.status, "active")),
    )
    .returning();
  return baris ?? null;
}

/**
 * Pulihkan seluruh pelanggaran `active` milik seorang user pada satu course yang
 * dibuat **sebelum** `sebelum`.
 *
 * Batas waktu itu adalah seluruh isi aturan pemulihan, dan ia tidak boleh
 * dilewati. `course_completions` unik per enrollment, jadi menyelesaikan ulang
 * course **tidak** menghasilkan baris completion baru — tanpa batas waktu, satu
 * panggilan yang terjadi sebelum pelanggaran dicatat akan memulihkan
 * pelanggaran itu sendiri, yaitu skornya dihapus dengan mengabaikan kesalahan.
 *
 * Dengan `created_at <= sebelum`, hanya pelanggaran yang sudah tercatat saat
 * completion itu terjadi yang dipulihkan. Pelanggaran yang menyusul setelahnya
 * tetap memotong skor sampai peserta menyelesaikan ulang sekali lagi.
 *
 * Dikembalikan **jumlah baris yang benar-benar berubah** supaya pemanggil bisa
 * membedakan "tidak ada yang dipulihkan" dari "dipulihkan lima".
 */
export async function pulihkanSemuaPelanggaranCourse(
  db: EksekutorDb,
  input: { userId: string; courseId: string; alasan: string; sebelum: Date },
): Promise<number> {
  const baris = await db
    .update(integrityViolations)
    .set({ status: "expunged", expungedAt: new Date(), expungedReason: input.alasan })
    .where(
      and(
        eq(integrityViolations.userId, input.userId),
        eq(integrityViolations.courseId, input.courseId),
        eq(integrityViolations.status, "active"),
        lte(integrityViolations.createdAt, input.sebelum),
      ),
    )
    .returning({ id: integrityViolations.id });
  return baris.length;
}

/** Jumlah pelanggaran `active` seorang user — untuk ringkasan cepat tanpa baris. */
export async function hitungPelanggaranAktif(
  userId: string,
): Promise<{ total: number; jumlah: number }> {
  const [baris] = await getDb()
    .select({
      jumlah: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(${integrityViolations.penalty}), 0)::int`,
    })
    .from(integrityViolations)
    .where(
      and(
        eq(integrityViolations.userId, userId),
        eq(integrityViolations.status, "active"),
      ),
    );
  return { total: baris?.total ?? 0, jumlah: baris?.jumlah ?? 0 };
}
