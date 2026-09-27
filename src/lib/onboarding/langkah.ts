/**
 * Field mana yang hidup di langkah mana pada wizard onboarding.
 *
 * Dipisah dari komponennya supaya peta ini bisa diuji: `OnboardingFlow` adalah
 * client component, dan suite repo ini `node` + `.test.ts` tanpa jsdom, jadi
 * apa pun yang hanya hidup di dalam `.tsx` mustahil ikut teruji. Peta yang
 * cuma ada di komponen berarti galat yang tak terpetakan lolos tanpa terlihat.
 */

/** Field mana yang hidup di langkah mana. */
export const LANGKAH_FIELD: Readonly<Record<string, number>> = {
  experience: 0,
  background: 0,
  interests: 1,
  goal: 2,
  weeklyHours: 2,
  workPreference: 2,
};

/**
 * Langkah pertama yang punya galat, atau `null` kalau tidak ada.
 *
 * Server menolak **seluruh** profil sekaligus, bukan per langkah. Tanpa peta ini
 * galatnya tidak bisa diarahkan: wizard hanya menampilkan "ada langkah yang
 * belum lengkap" sementara orangnya berada di langkah ketiga, dan tidak pernah
 * diberi tahu itu soal jam belajar.
 *
 * Field yang tak ada di peta diabaikan diam-diam — `LANGKAH_FIELD.test.ts` yang
 * menjaga supaya itu tidak terjadi diam-diam.
 */
export function langkahSalah(errors: Record<string, string> | undefined): number | null {
  if (!errors) return null;
  let terdalam: number | null = null;
  for (const field of Object.keys(errors)) {
    const langkah = LANGKAH_FIELD[field];
    if (langkah === undefined) continue;
    if (terdalam === null || langkah < terdalam) terdalam = langkah;
  }
  return terdalam;
}
