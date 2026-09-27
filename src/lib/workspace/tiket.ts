/**
 * Tiket akses ruang kerja — **murni**, ditandatangani HMAC.
 *
 * ## Masalah yang dipecahkan
 *
 * Ruang kerja adalah **capability URL**: siapa pun yang tahu alamatnya bisa
 * membukanya, karena code-server sendiri tidak tahu apa-apa tentang sesi
 * Careevo. Alamatnya memang tidak bisa ditebak (48 bit acak), tetapi "tidak
 * bisa ditebak" bukan kontrol akses — alamat bocor lewat riwayat peramban,
 * tangkapan layar, atau satu tautan yang diteruskan, dan setelah bocor tidak ada
 * yang bisa dicabut.
 *
 * Berkas ini memberi lapisan yang bisa **dicabut dan kedaluwarsa**: bukti
 * bertanda tangan yang mengikat satu ruang kerja ke satu peserta, dengan masa
 * berlaku. Yang memvalidasinya adalah reverse proxy di depan ruang kerja
 * (produksi) atau route Next di mesin pengembangan.
 *
 * ## Kenapa HMAC, bukan token acak di tabel
 *
 * Sama seperti `buktiBaru` di `@/lib/learning/session`: tanda tangannya adalah
 * **fungsi murni** atas `(userId, courseId, kedaluwarsa)`, bukan baris acak yang
 * harus disimpan. Yang dibeli:
 *
 * - **Tanpa tabel sesi.** Tidak ada baris yang perlu dibersihkan, tidak ada
 *   penyimpanan yang bisa tumbuh tanpa batas, dan tidak ada query di jalur
 *   pembukaan IDE.
 * - **Bisa diverifikasi tanpa database.** Proxy hanya butuh rahasia bersama.
 *   Kalau verifikasi menuntut query, proxy menjadi bergantung pada database dan
 *   satu gangguan database mematikan seluruh ruang kerja.
 * - **Bisa diturunkan ulang.** Sama seperti `sesiReaderAwal`: server bisa
 *   menerbitkan ulang tiket yang identik untuk run yang sama, jadi memuat ulang
 *   halaman tidak mengeluarkan tiket baru.
 *
 * Yang **tidak** diberikannya: pencabutan segera. Tiket yang sudah terbit sah
 * sampai kedaluwarsa. Masa berlakunya karena itu **pendek** (lihat
 * `MENIT_BERLAKU`), dan itu kompromi yang disengaja: mencabut segera menuntut
 * daftar cabutan, dan daftar itu menuntut penyimpanan yang justru dihindari.
 *
 * ## Modul ini murni
 *
 * Tanpa I/O, tanpa `node:*` selain `node:crypto` (komputasi murni). Komponen
 * klien tidak mengimpornya — tiket adalah urusan server — tetapi sifat murni
 * ini yang membuatnya bisa diuji tanpa server, proxy, atau podman.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Karakter kontrol yang ditolak di dalam kolom tiket.
 *
 * Dengan payload JSON, pemisah kolom tidak lagi relevan untuk pemisahan — JSON
 * sudah membawa batasnya sendiri. Yang tetap ditolak adalah **karakter kontrol**
 * (`\u0000`–`\u001f`), dan alasannya berbeda: kolom ini berasal dari data
 * aplikasi (`users.id`, `courses.id`) yang tidak pernah memuatnya, sedangkan
 * nilai yang memuatnya menandakan data yang tidak seperti yang diduga. Menolak
 * di sini membuat tebakan itu tidak perlu dilakukan di lapisan atas.
 */
const KONTROL = /[\u0000-\u001f]/;

/**
 * Apakah sebuah kolom aman dipakai di dalam tiket.
 *
 * Panjang dibatasi 200 karakter: `userId` adalah uuid (36) dan `courseId` id
 * course (`crs-…`), jadi nilai yang jauh lebih panjang berarti sesuatu yang
 * tidak kita duga.
 */
function kolomSah(nilai: string): boolean {
  return typeof nilai === "string" && nilai.length > 0 && nilai.length <= 200 && !KONTROL.test(nilai);
}

/**
 * Masa berlaku tiket, dalam menit.
 *
 * **Pendek dengan sengaja.** Karena tiket tidak bisa dicabut, panjang masa
 * berlakunya adalah satu-satunya pembatas berapa lama tiket yang bocor tetap
 * berguna. Lima menit cukup untuk membuka IDE dan memuat workbench; setelah itu
 * peramban meminta tiket baru, dan permintaan itu melewati gerbang sesi
 * Careevo lagi — sehingga peserta yang sesinya sudah berakhir tidak bisa terus
 * membuka ruang kerjanya dengan tiket lama.
 *
 * Angka ini juga yang membuat "cabut akses" punya arti praktis: akses hilang
 * paling lama lima menit setelah dicabut, tanpa daftar cabutan.
 */
export const MENIT_BERLAKU = 5;

/**
 * Bentuk isi tiket.
 *
 * `kedaluwarsa` adalah **milidetik epoch**, bukan ISO. Alasannya: tiket ini
 * masuk ke URL, dan ISO dengan `:` dan `+` menuntut peng-escape-an yang mudah
 * salah. Angka bulat tidak butuh escape sama sekali.
 */
export interface IsiTiket {
  userId: string;
  courseId: string;
  /** Milidetik epoch. */
  kedaluwarsa: number;
}

/** Hasil verifikasi: isi tiket, atau `null`. Tidak ada alasan kegagalan yang dibedakan. */
export type HasilTiket = IsiTiket | null;

/** Isi yang ditandatangani, dalam bentuk yang tidak bisa ambigu. */
function rangkai(isi: IsiTiket): string {
  // **JSON, bukan kolom yang digabung pemisah.** Versi pertama berkas ini
  // menggabung kolom dengan `\u0001` lalu mem-parse-nya sebagai JSON — dua
  // bentuk yang tidak pernah cocok, dan kegagalannya senyap: setiap tiket yang
  // diterbitkan langsung ditolak oleh verifikasinya sendiri. Test menangkapnya
  // karena `verifikasiTiket` diuji pada tiket yang benar-benar diterbitkan.
  //
  // Urutan kunci tetap (`userId`, `courseId`, `kedaluwarsa`) supaya keluaran
  // deterministik — `terbitkanTiket` harus menghasilkan tiket yang identik
  // untuk isi yang identik, karena itulah yang membuat pemuatan ulang halaman
  // tidak menerbitkan tiket baru.
  return JSON.stringify({
    userId: isi.userId,
    courseId: isi.courseId,
    kedaluwarsa: isi.kedaluwarsa,
  });
}

/**
 * Tanda tangan base64url atas **payload yang sudah dikodekan**.
 *
 * Yang ditandatangani adalah string payload, bukan objeknya. Itu pilihan yang
 * menentukan: verifikasi bisa memeriksa tanda tangan **sebelum** mem-parse
 * payload, sehingga isi yang belum terbukti ditandatangani tidak pernah
 * menyentuh `JSON.parse`.
 */
function tanda(rahasia: string, payload: string): string {
  return createHmac("sha256", rahasia).update(payload).digest("base64url");
}

/** Perbandingan waktu-tetap; panjang berbeda langsung ditolak. */
function samakan(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Terbitkan tiket untuk satu ruang kerja.
 *
 * Mengembalikan `null` bila kolomnya tidak sah, bukan melempar: pemanggil adalah
 * route yang sudah memvalidasi bentuk permintaan, jadi kolom yang tidak sah di
 * sini berarti bug internal — dan bug internal tidak boleh menjadi 500 yang
 * membocorkan jejak. `null` memetakan ke "tidak bisa menerbitkan", yang aman.
 */
export function terbitkanTiket(
  rahasia: string,
  isi: IsiTiket,
): string | null {
  if (typeof rahasia !== "string" || rahasia.length === 0) return null;
  if (!kolomSah(isi.userId) || !kolomSah(isi.courseId)) return null;
  if (!Number.isFinite(isi.kedaluwarsa) || isi.kedaluwarsa <= 0) return null;

  const isiBersih: IsiTiket = {
    userId: isi.userId,
    courseId: isi.courseId,
    kedaluwarsa: Math.floor(isi.kedaluwarsa),
  };
  // Bentuk `payload.tanda` — payload dulu, tanda tangan kemudian, supaya
  // pemisah terakhir tidak ambigu dengan isi.
  const payload = Buffer.from(rangkai(isiBersih), "utf8").toString("base64url");
  return `${payload}.${tanda(rahasia, payload)}`;
}

/**
 * Verifikasi tiket.
 *
 * Urutan pemeriksaan adalah bagian dari keamanannya:
 *
 * 1. **Bentuk.** String dengan tepat satu titik, kedua bagian tidak kosong.
 * 2. **Tanda tangan.** Diperiksa atas string payload mentah, **sebelum**
 *    `JSON.parse`. Isi yang belum terbukti ditandatangani tidak pernah
 *    menyentuh parser, jadi payload buatan tidak bisa memicu kerja di sana.
 * 3. **Isi.** Kolom wajib ada dan sah.
 * 4. **Kedaluwarsa**, terakhir. Urutannya disengaja: memeriksa kedaluwarsa lebih
 *    dulu akan memberi tahu pemanggil tanpa tanda tangan yang sah bahwa tiketnya
 *    "sudah kedaluwarsa" alih-alih "tidak sah" — perbedaan yang tidak boleh
 *    terlihat dari luar.
 *
 * `now` bisa disuntikkan supaya aturan kedaluwarsa bisa diuji tanpa memalsukan
 * jam sistem.
 */
export function verifikasiTiket(
  rahasia: string,
  tiket: string,
  now: number = Date.now(),
): HasilTiket {
  if (typeof rahasia !== "string" || rahasia.length === 0) return null;
  if (typeof tiket !== "string") return null;

  const bagian = tiket.split(".");
  if (bagian.length !== 2) return null;
  const [payload, tandaTerima] = bagian;
  if (!payload || !tandaTerima) return null;

  // Tanda tangan diperiksa lebih dulu, atas payload mentah.
  if (!samakan(tanda(rahasia, payload), tandaTerima)) return null;

  let isi: IsiTiket;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const kandidat = parsed as Record<string, unknown>;
    if (typeof kandidat.userId !== "string") return null;
    if (typeof kandidat.courseId !== "string") return null;
    if (typeof kandidat.kedaluwarsa !== "number") return null;
    isi = { userId: kandidat.userId, courseId: kandidat.courseId, kedaluwarsa: kandidat.kedaluwarsa };
  } catch {
    return null;
  }

  if (!kolomSah(isi.userId) || !kolomSah(isi.courseId)) return null;
  if (!Number.isFinite(isi.kedaluwarsa) || isi.kedaluwarsa <= 0) return null;

  if (now >= isi.kedaluwarsa) return null;
  return isi;
}

/**
 * Tiket yang cocok dengan ruang kerja yang diminta, atau `null`.
 *
 * Predikat terpisah, bukan pemeriksaan yang ditulis ulang di setiap pemanggil.
 * Yang dibeli: pemanggil tidak bisa lupa membandingkan `courseId`, dan
 * perbandingan itu tidak bisa menyimpang antar pemanggil — persis kelas bug
 * "dua salinan aturan yang menyembunyikan data" di `careevo-review`.
 *
 * Tipe baliknya `HasilTiket` (yang sudah mencakup `null`), bukan `IsiTiket`:
 * pemanggil wajib menangani kasus "tidak cocok", dan tipe yang tidak mengizinkan
 * `null` membuat pemeriksaan itu bisa dilewatkan tanpa keluhan compiler.
 */
export function tiketUntuk(
  rahasia: string,
  tiket: string,
  userId: string,
  courseId: string,
  now: number = Date.now(),
): HasilTiket {
  const isi = verifikasiTiket(rahasia, tiket, now);
  if (!isi) return null;
  if (isi.userId !== userId) return null;
  if (isi.courseId !== courseId) return null;
  return isi;
}

/**
 * Alamat gerbang yang membawa tiket.
 *
 * Satu tempat, dipakai route `/api/workspace` dan halaman server. Dua tempat
 * menyusun URL yang sama berarti dua kesempatan menyusunnya berbeda — dan
 * bentuk yang berbeda berarti satu di antaranya tidak membawa tiket, yaitu
 * lubang. Karena itu fungsi ini ada di modul, bukan di route: Next melarang
 * ekspor selain handler HTTP dari berkas `route.ts`, dan menyalinnya ke dua
 * tempat justru mengembalikan masalah yang dihindari.
 */
export function alamatBuka(courseId: string, tiket: string): string {
  return `/api/workspace/buka?courseId=${encodeURIComponent(courseId)}&tiket=${encodeURIComponent(tiket)}`;
}
