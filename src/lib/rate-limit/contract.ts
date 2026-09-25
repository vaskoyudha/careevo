/**
 * contract.ts — tipe bersama untuk Rate Limit.
 *
 * Sengaja **tanpa dependensi apa pun** (tidak `node:*`, tidak `@upstash/*`) karena
 * berkas ini juga diimpor oleh `./next.ts`, yang pada gilirannya diimpor oleh
 * `proxy.ts` (Node runtime, tapi tetap harus ringan dan tidak menarik `node:fs`).
 */

/** Hasil satu keputusan pembatasan. Bentuk ini dipetakan ke header HTTP di `./next.ts`. */
export interface HasilBatasi {
  /** `true` bila request boleh lewat. */
  readonly sukses: boolean;
  /** Jumlah maksimum request dalam window aktif. */
  readonly limit: number;
  /** Sisa jatah dalam window aktif (0 saat diblokir). */
  readonly sisa: number;
  /** Unix timestamp **milidetik** kapan limit direset. */
  readonly resetMs: number;
}

/** Kontrak minimal sebuah pembatas. Adapter Redis dan memori sama-sama memenuhinya. */
export interface Pembatas {
  batasi(identifier: string): Promise<HasilBatasi>;
}

/** Data permintaan yang dipakai untuk menurunkan key. Semuanya berasal dari server, bukan klien. */
export interface KonteksPembatasan {
  /**
   * IP tepercaya hasil `ipTercepat()` (`./identitas.ts`). `undefined` bila tidak
   * ada header tepercaya — pemanggil memperlakukannya sebagai tidak dapat dibatasi.
   */
  readonly ip?: string;
  /** Principal stabil bila sudah diketahui (mis. email sesi). Menambah bucket kedua. */
  readonly principal?: string;
  /**
   * Kunci tambahan khusus kebijakan (mis. username pada route PDF publik),
   * supaya satu akun/objek tidak bisa dipakai untuk menghabiskan kuota IP bersama.
   * Nilai ini juga berasal dari server.
   */
  readonly tambahan?: string;
}

/** Satu entri `Retry-After` + header rate limit standar. */
export interface HeaderRateLimit {
  readonly "Retry-After": string;
  readonly "RateLimit-Limit": string;
  readonly "RateLimit-Remaining": string;
  readonly "RateLimit-Reset": string;
}
