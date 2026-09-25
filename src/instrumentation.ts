/**
 * Next.js instrumentation hook — dijalankan **sekali** saat instance server
 * start, sebelum server siap menerima request (lihat
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md`).
 *
 * Tujuannya sempit: memvalidasi konfigurasi secret produksi lebih awal.
 * `src/lib/config/secrets.ts` sudah menolak secret dev/placeholder saat
 * dibaca, tetapi pembacaan itu baru terjadi pada request pertama yang
 * menandatangani sesuatu — pada deployment dengan banyak instance, instance
 * yang tidak kebagian request tetap terlihat sehat. Memanggil pemeriksaan di
 * sini membuat konfigurasi yang salah menggagalkan start, bukan melayani
 * sebagian request dengan secret yang bisa ditebak.
 *
 * Import dilakukan di dalam `register()` mengikuti rekomendasi dokumen:
 * efek samping tetap terkumpul di satu tempat, dan bundel Edge tidak ikut
 * menarik modul Node bila suatu saat ada route Edge.
 */
export async function register(): Promise<void> {
  const { verifikasiKonfigurasiSecret } = await import("@/lib/config/secrets");
  verifikasiKonfigurasiSecret();
}
