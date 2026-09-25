/**
 * Next.js instrumentation hook — dijalankan **sekali** saat instance server
 * start, sebelum server siap menerima request (lihat
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md`).
 *
 * Gerbang startup ini memeriksa **dua** hal, dan keduanya harus lulus:
 *
 * 1. **Validasi konfigurasi secret produksi.** `src/lib/config/secrets.ts`
 *    sudah menolak secret dev/placeholder saat dibaca, tetapi pembacaan itu
 *    baru terjadi pada request pertama yang menandatangani sesuatu — pada
 *    deployment dengan banyak instance, instance yang tidak kebagian request
 *    tetap terlihat sehat. Memanggil pemeriksaan di sini membuat konfigurasi
 *    yang salah menggagalkan start, bukan melayani sebagian request dengan
 *    secret yang bisa ditebak.
 *
 * 2. **Kesiapan layanan rate limit.** Backend berada di VPS (belum ada, lihat
 *    laporan) sedangkan permukaan browser ada di Vercel, dan Upstash Redis
 *    adalah penghitung bersama. Tanpa kredensialnya, pembatas produksi akan
 *    melempar pada request pertama — jadi lebih baik gagal di sini, saat
 *    deployment, daripada setelah menerima traffic.
 *
 * Keduanya dijalankan dalam satu `register()`: urutan pemeriksaan tidak
 * material (keduanya gagal-keras dan tidak saling bergantung), tetapi keduanya
 * **wajib** ada. Menghapus salah satunya akan membuat separuh konfigurasi
 * produksi bisa salah tanpa menggagalkan start.
 *
 * Pemeriksaan rate limit hanya menggagalkan `next start`, bukan `next build`
 * (dikecualikan lewat `NEXT_PHASE` di `assertRateLimitSiapProduksi()`), karena
 * build di CI tidak memegang kredensial runtime. Pada Vercel, build dan runtime
 * adalah dua proses terpisah, jadi pengecekan tetap berjalan saat runtime
 * dimulai tanpa memblokir build.
 *
 * Import dilakukan di dalam `register()` mengikuti rekomendasi dokumen:
 * efek samping tetap terkumpul di satu tempat, dan bundel Edge tidak ikut
 * menarik modul Node bila suatu saat ada route Edge.
 */
export async function register(): Promise<void> {
  const { verifikasiKonfigurasiSecret } = await import("@/lib/config/secrets");
  verifikasiKonfigurasiSecret();

  // `await` — bukan fire-and-forget — karena dokumentasi Next mensyaratkan
  // `register()` selesai sebelum server siap menerima request.
  const { assertRateLimitSiapProduksi } = await import("@/lib/rate-limit/index");
  assertRateLimitSiapProduksi();
}
