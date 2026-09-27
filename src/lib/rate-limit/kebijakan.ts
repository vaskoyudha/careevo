/**
 * kebijakan.ts — satu tabel kebijakan rate limit, murni dan tanpa dependensi.
 *
 * Semua angka hidup di sini, bukan tersebar di call site, supaya kebijakan dapat
 * dibaca dan diubah di satu tempat. Modul ini **tidak mengimpor apa pun** (tanpa
 * `node:*`, tanpa `@upstash/*`) karena diimpor oleh `proxy.ts` dan seluruh
 * permukaan server.
 *
 * Kolom `failOpen` adalah keputusan produk, bukan detail teknis:
 *   - `failOpen: false` untuk endpoint yang **langsung menyerang** permukaan
 *     publik tanpa autentikasi (login, signup, verify, PDF publik). Di sini
 *     kegagalan Redis harus menutup pintu: itu pilihan yang benar karena tidak
 *     ada pemeriksaan lain di belakangnya.
 *   - `failOpen: true` untuk endpoint yang sudah memiliki auth/otorisasi sendiri
 *     (upload staff, unggah resume, evaluasi AI, chat belajar). Di sini request
 *     yang gagal karena Redis tidak boleh mematikan fitur bagi pengguna sah —
 *     lebih buruk lagi bila terjadi tepat saat Redis sedang bermasalah. Setiap
 *     fail-open log dengan alasan eksplisit agar tidak menjadi kegagalan senyap.
 */

import type { KonteksPembatasan } from "./contract";

export const NAMA_KEBIJAKAN = [
  "login",
  "signup",
  "unggahCourse",
  "unggahResume",
  "evaluasi",
  "studyChat",
  "verifyPublik",
  "pdfPublik",
  "jalankanKode",
] as const;

export type NamaKebijakan = (typeof NAMA_KEBIJAKAN)[number];

/**
 * Durasi window dalam bentuk yang diterima `Ratelimit.slidingWindow`.
 *
 * Ditulis sebagai literal union di sini (bukan `string`) supaya nilai yang salah
 * format gagal saat typecheck, bukan saat request pertama. `buatPembatasMemori`
 * memakai bentuk yang sama; mendefinisikannya ulang menjaga `kebijakan.ts` tetap
 * bebas dependensi.
 */
export type JendelaDurasi = `${number} ${"s" | "m" | "h" | "d"}`;

export interface SpesifikasiKebijakan {
  readonly limit: number;
  /** Format durasi Upstash, mis. "10 m". */
  readonly window: JendelaDurasi;
  /** ISO-8601 duration untuk header `RateLimit-Reset` (detik). */
  readonly resetDetik: number;
  readonly failOpen: boolean;
  /**
   * Bila `true`, bucket kedua per principal ditambahkan (selain bucket per IP).
   * Dipakai endpoint yang dapat diautentikasi sehingga satu IP bersama (NAT/Wi-Fi
   * publik) tidak bisa mengunci akun orang lain, dan sebaliknya satu akun tidak
   * bisa memakai banyak IP untuk menghindari batas.
   */
  readonly bucketPrincipal: boolean;
  /** Label manusiawi untuk log. Tidak pernah masuk ke respons. */
  readonly label: string;
}

/**
 * Kompilasi ISO-8601 dijalankan saat modul dimuat agar durasi invalid gagal
 * keras, bukan menghasilkan `Retry-After: NaN`.
 */
function iso(detik: number): string {
  if (!Number.isInteger(detik) || detik <= 0) {
    throw new Error(`Durasi rate limit tidak valid: ${detik}`);
  }
  return `PT${detik}S`;
}

/**
 * Tabel kebijakan.
 *
 * Tidak ada angka di sini yang boleh diubah tanpa mengubah `PREFIX` di
 * `./upstash.ts`: bucket di Redis dihitung terhadap limit lama, jadi menaikkan
 * limit tanpa memisahkan bucket berarti penghitungan lama ikut terpakai.
 */
export const AMBANG: Record<NamaKebijakan, SpesifikasiKebijakan> = {
  // Kredensial: penyerang dapat mencoba banyak kombinasi per IP. 10 percobaan
  // per 10 menit cukup untuk salah ketik wajar, jauh terlalu sedikit untuk
  // credential stuffing, dan gagal-tertutup bila Redis mati.
  login: {
    limit: 10,
    window: "10 m",
    resetDetik: 600,
    failOpen: false,
    bucketPrincipal: false,
    label: "Masuk",
  },
  // 5 akun baru per IP per jam: rumah, kantor, dan kampus tetap muat; pembuatan
  // akun massal tidak.
  signup: {
    limit: 5,
    window: "1 h",
    resetDetik: 3600,
    failOpen: false,
    bucketPrincipal: false,
    label: "Daftar akun",
  },
  // Upload course hanya untuk staff (sudah digating sesi di handler). Batas
  // longgar; yang ditekan adalah penyalahgunaan endpoint, bukan pengguna sah.
  unggahCourse: {
    limit: 30,
    window: "10 m",
    resetDetik: 600,
    failOpen: true,
    bucketPrincipal: true,
    label: "Unggah materi kursus",
  },
  // Unggah CV/portfolio: hanya ada dua slot, jadi 10 unggahan per 15 menit sudah
  // jauh lebih dari cukup.
  unggahResume: {
    limit: 10,
    window: "15 m",
    resetDetik: 900,
    failOpen: true,
    bucketPrincipal: true,
    label: "Unggah berkas resume",
  },
  // Evaluasi AI: panggilan berbiaya per-request dan 30–60 detik per evaluasi.
  // 5 per 30 menit menahan biaya tanpa mengganggu pemakaian manusiawi.
  evaluasi: {
    limit: 5,
    window: "30 m",
    resetDetik: 1800,
    failOpen: true,
    bucketPrincipal: true,
    label: "Evaluasi AI",
  },
  // Chat tutor: percakapan multi-turn itu normal (satu pertanyaan = satu pesan),
  // jadi batasnya lebih tinggi, tetapi tetap dibatasi karena setiap balasan
  // adalah panggilan model berbiaya.
  studyChat: {
    limit: 30,
    window: "10 m",
    resetDetik: 600,
    failOpen: true,
    bucketPrincipal: true,
    label: "Tutor belajar",
  },
  // Verifikasi publik: anonim, memakai HMAC (murah) tetapi memicu pembacaan
  // token yang tidak terbatas. Ini permukaan publik tanpa auth di belakangnya,
  // jadi gagal-tertutup.
  verifyPublik: {
    limit: 60,
    window: "10 m",
    resetDetik: 600,
    failOpen: false,
    bucketPrincipal: false,
    label: "Verifikasi publik",
  },
  // PDF publik: satu halaman HTML me-render banyak berkas PDF sekaligus, jadi
  // batasnya harus cukup tinggi untuk penggunaan normal. Bucket kedua per
  // username mencegah satu profil dijadikan alat menghabiskan kuota IP.
  pdfPublik: {
    limit: 120,
    window: "10 m",
    resetDetik: 600,
    failOpen: false,
    bucketPrincipal: true,
    label: "Berkas PDF publik",
  },
  // Kompilasi C++ memakan CPU dan hanya berguna sebentar. 20 percobaan per 10
  // menit cukup untuk belajar sambil bereksperimen, dan menahan program yang
  // sengaja didesain untuk menguras mesin.
  //
  // `bucketPrincipal: true` itu wajib, bukan pilihan. Satu kelas belajar
  // berada di satu jaringan, jadi pengelompokan per IP akan membatasi satu
  // geng dan membiarkan penyalahguna berpindah IP.
  //
  // `failOpen: false` karena endpoint ini menjalankan biner. Lebih baik
  // menolak daripada membuka kompilator.
  jalankanKode: {
    limit: 20,
    window: "10 m",
    resetDetik: 600,
    failOpen: false,
    bucketPrincipal: true,
    label: "Jalankan kode",
  },
};

/**
 * ISO-8601 duration untuk header `RateLimit-Reset`. Dihitung sekali saat modul
 * dimuat sehingga nilai invalid gagal saat build/test, bukan saat request.
 */
export const RESET_ISO: Record<NamaKebijakan, string> = Object.fromEntries(
  NAMA_KEBIJAKAN.map((nama) => [nama, iso(AMBANG[nama].resetDetik)]),
) as Record<NamaKebijakan, string>;

/**
 * Label environment untuk prefiks Redis. Dipakai agar staging/dev tidak berbagi
 * bucket dengan produksi saat keduanya menunjuk database Redis yang sama.
 */
export function penandaLingkungan(): string {
  if (process.env.NODE_ENV === "production") {
    return process.env.VERCEL_ENV === "preview" ? "preview" : "prod";
  }
  return process.env.NODE_ENV === "test" ? "test" : "dev";
}

/**
 * Turunkan daftar identifier dari konteks pembatasan.
 *
 * Urutan penting dan disengaja: IP **selalu** dihitung lebih dulu, lalu principal
 * bila kebijakan memintanya, lalu kunci tambahan kebijakan. Setiap identifier
 * adalah bucket Redis tersendiri; request ditolak bila **salah satu** habis.
 * Artinya:
 *   - IP yang lebih dulu diblokir tidak bisa dibuka dengan login ke akun lain;
 *   - akun yang lebih dulu diblokir tidak bisa dibuka dengan pindah IP;
 *   - objek tambahan (mis. username PDF) menutup celah "ganti-ganti target".
 *
 * IP yang tidak dapat ditentukan **tidak** menghasilkan identifier kosong:
 * mengembalikan `[]` lebih jujur — pemanggil memperlakukannya sebagai tidak dapat
 * dibatasi (`failOpen` berlaku) alih-alih menaruh semua orang tanpa header
 * tepercaya ke dalam satu bucket bersama.
 */
export function identifierUntuk(
  nama: NamaKebijakan,
  konteks: KonteksPembatasan,
): string[] {
  const spesifikasi = AMBANG[nama];
  const daftar: string[] = [];
  if (konteks.ip) daftar.push(`ip:${konteks.ip}`);
  if (spesifikasi.bucketPrincipal && konteks.principal) {
    daftar.push(`principal:${konteks.principal}`);
  }
  if (konteks.tambahan) daftar.push(`tambahan:${konteks.tambahan}`);
  return daftar;
}
