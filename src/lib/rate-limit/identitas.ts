/**
 * identitas.ts — ekstraksi IP tepercaya dan penurunan principal, **server-only**.
 *
 * ## Mengapa header IP harus dipilih dengan hati-hati
 * `x-forwarded-for` dapat diisi klien dan, di belakang reverse proxy, Vercel
 * hanya menjamin isinya pada `x-vercel-forwarded-for`: dokumentasi Vercel
 * menyatakan bahwa `x-forwarded-for` "dapat ditimpa bila Anda memakai proxy di
 * atas Vercel", sedangkan `x-vercel-forwarded-for` identik **tetapi tidak bisa
 * ditimpa**. Karena itu urutan baca di sini adalah:
 *
 *   1. `x-vercel-forwarded-for` — header tepercaya Vercel (tidak bisa ditimpa).
 *   2. `x-real-ip` — identik dengannya, dipakai bila edge/tunnel lain yang
 *      mengoperasikan deployment menyetelnya.
 *
 * `x-forwarded-for` **sengaja tidak pernah dibaca**: pada topologi ini ia dapat
 * berasal dari klien, dan memakai IP yang dapat dikendalikan klien berarti setiap
 * penyerang dapat memakai bucket baru per request — mematikan rate limiting tanpa
 * terlihat.
 *
 * Sebuah nilai tetap divalidasi bentuknya sebelum dipakai sebagai bucket: nilai
 * aneh (spasi, koma, panjang tak wajar) tidak boleh masuk ke kunci Redis,
 * betapapun tepercaya sumbernya.
 */

/** Batas panjang nilai yang boleh menjadi bagian kunci Redis. */
const MAKS_PANJANG = 64;

/**
 * Validasi bentuk alamat: IPv4, IPv4-in-IPv6, atau IPv6 dengan hextet/`:`/`%`.
 *
 * Tidak ada parser CIDR lengkap di sini — tujuannya hanya memastikan nilai yang
 * dipakai sebagai kunci Redis berbentuk alamat, bukan skrip atau teks bebas.
 */
function alamatValid(nilai: string): boolean {
  if (nilai.length === 0 || nilai.length > MAKS_PANJANG) return false;
  if (!/^[0-9a-fA-F:.%]+$/.test(nilai)) return false;
  if (nilai.includes("..")) return false;
  return true;
}

/**
 * Bentuk minimal pembaca header. Sengaja bukan `Headers` supaya baik `Headers`
 * dari `Request` maupun `ReadonlyHeaders` dari `next/headers` (yang tidak selalu
 * assignable ke `Headers`) dapat langsung dilewatkan.
 */
export interface PembacaHeader {
  get(nama: string): string | null;
}

/**
 * IP klien tepercaya, atau `null` bila tidak ada header tepercaya.
 *
 * Mengembalikan `null` (bukan string kosong) adalah keputusan sadar: pemanggil
 * kemudian mengenali "tidak dapat ditentukan" sebagai keadaan tersendiri, bukan
 * sebagai IP bernama "".
 *
 * Bila header memuat daftar (mis. `a, b`), entri **paling kanan** diambil —
 * itu entri yang paling dekat dengan edge tepercaya; entri di kiri bisa saja
 * disisipkan klien.
 */
export function ipTercepat(header: PembacaHeader): string | null {
  const sumber = [
    header.get("x-vercel-forwarded-for"),
    header.get("x-real-ip"),
  ];
  for (const nilai of sumber) {
    if (!nilai) continue;
    const bagian = nilai.split(",");
    const kandidat = bagian[bagian.length - 1]!.trim();
    if (alamatValid(kandidat)) return kandidat;
  }
  return null;
}
