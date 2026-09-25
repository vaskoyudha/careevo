/**
 * identitas.ts — ekstraksi IP tepercaya dan penurunan principal, **server-only**.
 *
 * ## Mengapa header IP harus dipilih dengan hati-hati
 * `x-forwarded-for` dapat diisi klien, jadi ia **tidak pernah** dibaca di sini:
 * memakai IP yang dapat dikendalikan klien berarti setiap penyerang dapat
 * memakai bucket baru per request — mematikan rate limiting tanpa terlihat.
 * Yang dibaca hanya header yang disetel oleh infrastruktur, dan hanya yang
 * kepercayaannya eksplisit:
 *
 *   1. `x-vercel-forwarded-for` — disetel Vercel di edge dan **tidak dapat
 *      ditimpa** klien. Ini satu-satunya header yang dipercaya secara default;
 *      itulah topologi yang ditetapkan (permukaan browser di Vercel).
 *   2. `x-real-ip` — **bukan** header Vercel. Ia disetel sebagian edge/tunnel
 *      lain (mis. nginx di VPS), dan kepercayaannya bergantung sepenuhnya pada
 *      infrastruktur yang mengoperasikan deployment. Karena itu ia **mati
 *      secara default** dan hanya dibaca setelah
 *      `CAREEVO_TRUST_REAL_IP_HEADER=1` diisi secara sadar (pola yang sama
 *      dipakai `CAREEVO_TRUST_PROXY_HEADERS` di `@/lib/http/origin`).
 *
 * Mengapa opt-in untuk `x-real-ip`, bukan mempercayainya begitu saja: header
 * apa pun yang datang bersama permintaan dapat dikirim klien. Di belakang proxy
 * yang menormalkannya, nilainya benar; bila klien dapat mencapai origin tanpa
 * melewati proxy itu, klien dapat memalsukannya dan setiap request mendapat
 * bucket baru. Menyalakannya adalah pernyataan eksplisit bahwa topologi memang
 * menutup jalur langsung tersebut.
 *
 * Sebuah nilai tetap divalidasi bentuknya sebelum dipakai sebagai bucket: nilai
 * aneh (spasi, koma, panjang tak wajar) tidak boleh masuk ke kunci Redis,
 * betapapun tepercaya sumbernya.
 */

/** Batas panjang nilai yang boleh menjadi bagian kunci Redis. */
const MAKS_PANJANG = 64;

/**
 * Bentuk minimal lingkungan yang dibaca berkas ini. Berupa peta, bukan properti
 * bernama, supaya `process.env` (bertipe index signature) dapat dioper langsung —
 * sama seperti `OriginEnvironment` di `@/lib/http/origin`.
 */
export type LingkunganIdentitas = Readonly<Record<string, string | undefined>>;

/**
 * Nama env untuk mempercayai `x-real-ip`. Positif eksplisit; default `false`.
 *
 * Hanya diisi bila ada proxy/tunnel tepercaya di depan yang menormalkan header
 * ini **dan** origin tidak dapat dijangkau langsung.
 */
export const ENV_PERCAYA_X_REAL_IP = "CAREEVO_TRUST_REAL_IP_HEADER";

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

/** Nilai env yang dianggap "menyala". Selain `1`/`true` (case-insensitive) → mati. */
function envPositif(nilai: string | undefined): boolean {
  const bersih = nilai?.trim().toLowerCase();
  return bersih === "1" || bersih === "true";
}

/**
 * Apakah `x-real-ip` boleh dipercaya. Default `false` — header dapat diisi klien
 * pada deployment yang tidak berada di belakang proxy tepercaya.
 */
export function percayaXRealIpDariEnv(
  env: LingkunganIdentitas = process.env,
): boolean {
  return envPositif(env[ENV_PERCAYA_X_REAL_IP]);
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
 *
 * @param percayaXRealIp default dari `CAREEVO_TRUST_REAL_IP_HEADER` (default
 *   `false`). Hanya `true` bila ada proxy tepercaya yang menormalkan `x-real-ip`
 *   dan origin tidak dapat dijangkau langsung.
 */
export function ipTercepat(
  header: PembacaHeader,
  opsi: { readonly percayaXRealIp?: boolean } = {},
): string | null {
  const percayaXRealIp = opsi.percayaXRealIp ?? percayaXRealIpDariEnv();
  const sumber = [
    // Selalu dibaca: disetel Vercel di edge dan tidak dapat ditimpa klien.
    header.get("x-vercel-forwarded-for"),
    // Hanya bila kepercayaannya dinyatakan eksplisit — header ini bukan milik
    // Vercel dan nilainya bergantung pada infrastruktur yang dipasang.
    percayaXRealIp ? header.get("x-real-ip") : null,
  ];
  for (const nilai of sumber) {
    if (!nilai) continue;
    const bagian = nilai.split(",");
    const kandidat = bagian[bagian.length - 1]!.trim();
    if (alamatValid(kandidat)) return kandidat;
  }
  return null;
}
