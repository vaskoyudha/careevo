/**
 * Repository profil onboarding — akses tabel `onboarding_profiles`. **Server-only.**
 *
 * Aturan yang dikunci:
 *
 * - **Koneksi/transaksi sebagai argumen pertama**, sama seperti
 *   `identity-repository.ts` dan `session-repository.ts`. Repository tidak pernah
 *   memanggil `getDb()` sendiri: begitu ia melakukan itu, operasi yang
 *   seharusnya berjalan dalam satu transaksi bisa keluar darinya, dan
 *   kegagalannya baru terlihat saat ada rollback.
 * - **Tidak ada kebijakan bisnis di sini.** Repository hanya bentuk query:
 *   kolom apa yang ditulis dan bagaimana nilainya dinormalkan bukan urusannya.
 *   Pemanggil sudah memegang `principal` yang sah, jadi `user_id` yang ia teruskan
 *   sudah benar. Keputusan "sudah onboarding atau belum" ada di `../store.ts`.
 * - **Satu baris per akun** (`user_id` adalah primary key), jadi menulis ulang
 *   jawaban adalah `upsert`, bukan insert kedua. Versi lama yang di-overwrite
 *   memang disengaja: onboarding bisa diulang dari Pengaturan, dan yang benar
 *   disimpan adalah jawaban terakhir, bukan riwayat.
 * - **Nilai `interests` dipertahankan apa adanya.** CHECK di database menjaga
 *   bentuk (1–3, dari vocabulary tertutup), tetapi urutannya bermakna —
 *   urutan preferensi — jadi ia tidak pernah diurutkan ulang di sini.
 *
 * Menggantikan cookie `ls_profile`; lihat catatan di `../store.ts` untuk
 * jalur baca-fallback yang mencegah pengguna lama diminta onboarding ulang.
 */

import { eq } from "drizzle-orm";

import { onboardingProfiles, type OnboardingProfileRow } from "@/lib/db/schema";
import type { KoneksiDb, TransaksiDb } from "@/lib/db/client";
import type {
  Background,
  ExperienceLevel,
  Interest,
  WorkPreference,
} from "./types";

/**
 * Koneksi atau transaksi. Repository menerima keduanya sehingga satu operasi
 * bisnis dapat dijalankan seluruhnya di dalam satu transaksi.
 */
export type EksekutorDb = KoneksiDb | TransaksiDb;

/** Bentuk nilai yang boleh ditulis ke baris onboarding. */
export type NilaiOnboarding = {
  experience: ExperienceLevel;
  background: Background;
  interests: Interest[];
  goal: string;
  weeklyHours: number;
  workPreference: WorkPreference;
  completedAt: Date;
  version: number;
};

/**
 * Profil onboarding milik satu akun, atau `undefined` bila belum menjawab.
 *
 * `undefined` (bukan `null`) mengikuti repository lain di repo ini: "tidak ada
 * baris" adalah kondisi normal, bukan galat.
 */
export async function cariProfilOnboarding(
  db: EksekutorDb,
  userId: string,
): Promise<OnboardingProfileRow | undefined> {
  const [row] = await db
    .select()
    .from(onboardingProfiles)
    .where(eq(onboardingProfiles.userId, userId))
    .limit(1);
  return row;
}

/**
 * Tulis jawaban onboarding untuk satu akun, menimpa jawaban sebelumnya.
 *
 * `onConflictDoUpdate` dengan primary key `user_id`: onboarding yang diulang
 * dari `/pengaturan` harus mengganti jawaban lama, bukan gagal karena bentrok
 * atau meninggalkan baris yatim. `updated_at` disegarkan di sini juga supaya
 * "kapan jawaban terakhir diubah" tidak bergantung pada pemanggil yang
 * mengingat untuk mengisinya.
 */
export async function simpanProfilOnboarding(
  db: EksekutorDb,
  userId: string,
  nilai: NilaiOnboarding,
): Promise<OnboardingProfileRow> {
  const [row] = await db
    .insert(onboardingProfiles)
    .values({
      userId,
      experience: nilai.experience,
      background: nilai.background,
      interests: nilai.interests,
      goal: nilai.goal,
      weeklyHours: nilai.weeklyHours,
      workPreference: nilai.workPreference,
      completedAt: nilai.completedAt,
      version: nilai.version,
    })
    .onConflictDoUpdate({
      target: onboardingProfiles.userId,
      set: {
        experience: nilai.experience,
        background: nilai.background,
        interests: nilai.interests,
        goal: nilai.goal,
        weeklyHours: nilai.weeklyHours,
        workPreference: nilai.workPreference,
        completedAt: nilai.completedAt,
        version: nilai.version,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

/**
 * Hapus jawaban onboarding. Dipakai "Ulangi onboarding" di `/pengaturan`.
 *
 * Mengembalikan `true` bila ada baris yang benar-benar terhapus, supaya
 * pemanggil bisa membedakannya dari "memang belum pernah menjawab".
 */
export async function hapusProfilOnboarding(
  db: EksekutorDb,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .delete(onboardingProfiles)
    .where(eq(onboardingProfiles.userId, userId))
    .returning({ userId: onboardingProfiles.userId });
  return rows.length > 0;
}
