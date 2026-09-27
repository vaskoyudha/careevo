import { redirect } from "next/navigation";

/**
 * Rute lama → `/progres`.
 *
 * Halaman ini pernah jadi "Jalur Belajar": satu jalur personal ke satu kursus.
 * Sekarang progres dibaca per kursus di `/progres`, jadi tidak ada lagi isi di
 * sini. Rutenya **tidak** dihapus supaya tautan lama (sidebar lama, promo card,
 * dan bookmark) tidak berakhir jadi 404 — rute lama menjawab 307, lalu
 * `/progres` menjawab 200.
 *
 * Redirect terjadi setelah gate `(app)/layout.tsx` berjalan, jadi permintaan tanpa
 * sesi tetap diarahkan ke `/masuk` lebih dulu — sama seperti sebelumnya.
 */
export default function JalurBelajarRedirect() {
  redirect("/progres");
}
