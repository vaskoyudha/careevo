/**
 * Next.js instrumentation hook — dijalankan **sekali** saat instance server
 * start, sebelum server siap menerima request (lihat
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md`).
 *
 * Gerbang startup memvalidasi konfigurasi secret produksi. `src/lib/config/secrets.ts`
 * menolak secret dev/placeholder saat dibaca; pemeriksaan di sini membuat
 * konfigurasi yang salah menggagalkan start, bukan menunggu request pertama.
 * Rate limit memakai memori proses dan tidak memerlukan kredensial eksternal.
 *
 * Import dilakukan di dalam `register()` mengikuti rekomendasi dokumen:
 * efek samping tetap terkumpul di satu tempat, dan bundel Edge tidak ikut
 * menarik modul Node bila suatu saat ada route Edge.
 */
export async function register(): Promise<void> {
  const { verifikasiKonfigurasiSecret } = await import("@/lib/config/secrets");
  verifikasiKonfigurasiSecret();

}
