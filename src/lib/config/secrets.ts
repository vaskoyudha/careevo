/**
 * Konfigurasi secret — **server-only**.
 *
 * Sebelum modul ini ada, setiap pemakai HMAC menulis sendiri
 * `process.env.X ?? "dev-..."`. Pola itu membuat produksi yang lupa mengisi
 * env tetap "jalan" dengan secret yang nilainya ada di repositori publik:
 * siapa pun bisa memalsukan cookie sesi, cookie enrollment, atau attestation.
 * Modul ini memusatkan pembacaan secret supaya kelalaian itu berhenti di
 * proses start, bukan di permintaan pertama.
 *
 * Aturan yang dikunci:
 *
 * - Di produksi (`NODE_ENV=production`), secret wajib ada, bukan nilai
 *   default/placeholder yang diketahui, dan minimal `PANJANG_MINIMUM`
 *   karakter. Pelanggaran melempar `SecretConfigError`.
 * - Di luar produksi, nilai dev dipakai sebagai fallback supaya `npm run dev`
 *   dan test tetap berjalan tanpa `.env`. Fallback itu **eksplisit**: ia
 *   bernama, bukan `?? "..."` yang tersebar.
 * - Pesan galat tidak pernah memuat nilai secret. Pesan yang membocorkan
 *   secret akan mengubah kegagalan start menjadi kebocoran lewat log.
 *
 * Modul ini hanya membaca `process.env`; ia tidak boleh diimpor dari
 * komponen klien. `instrumentation.ts` memanggil
 * `verifikasiKonfigurasiSecret()` sekali saat server start, sehingga
 * konfigurasi yang salah gagal sebelum server menerima request.
 */

/** Nama secret yang dikenal aplikasi. Sengaja tertutup, bukan `string`. */
export type NamaSecret = "SESSION_SECRET" | "ATTESTATION_SECRET";

/**
 * Nilai dev untuk tiap secret. Nilai ini **publik** — ada di repositori dan di
 * dokumentasi — sehingga tidak boleh dipakai di produksi.
 */
export const SECRET_DEV: Readonly<Record<NamaSecret, string>> = {
  SESSION_SECRET: "dev-session-secret-careevo",
  ATTESTATION_SECRET: "dev-attestation-secret",
};

/** Panjang minimum yang diterima di produksi, dalam karakter. */
export const PANJANG_MINIMUM: Readonly<Record<NamaSecret, number>> = {
  SESSION_SECRET: 32,
  ATTESTATION_SECRET: 32,
};

/**
 * Nilai yang lahir dari template/dokumentasi. Apapun yang persis sama dengan
 * salah satunya ditolak di produksi, karena nilainya dapat ditebak.
 */
const NILAI_TEMPLATE: ReadonlySet<string> = new Set([
  ...Object.values(SECRET_DEV),
  "secret",
  "secret-key",
  "secretkey",
  "password",
  "rahasia",
  "ganti-saya",
  "ganti-secret",
  "changeme",
  "change-me",
  "change_me",
  "supersecret",
  "super-secret",
  "your-secret",
  "your-secret-here",
  "your_secret",
  "try-this-secret",
  "example",
  "sample",
  "placeholder",
  "todo",
  "xxx",
  "test",
  "testing",
]);

/**
 * Penanda awalan/substring template. Dipilih sengaja sempit: penolakan palsu
 * pada produksi berarti server gagal start, jadi hanya pola yang hampir pasti
 * berasal dari salinan dokumentasi yang masuk daftar.
 */
const PENANDA_TEMPLATE: readonly string[] = [
  "dev-",
  "dev_",
  "test-",
  "test_",
  "dummy",
  "example",
  "placeholder",
  "sample",
  "changeme",
  "change-me",
  "your-",
  "your_",
  "ganti",
  "rahasia",
  "todo",
];

/** Alasan sebuah secret ditolak di produksi. */
export type AlasanTolak =
  | "kosong"
  | "default_development"
  | "placeholder"
  | "terlalu_pendek";

export type HasilPeriksaSecret =
  | { readonly ok: true }
  | { readonly ok: false; readonly alasan: AlasanTolak };

export class SecretConfigError extends Error {
  constructor(pesan: string) {
    super(pesan);
    this.name = "SecretConfigError";
  }
}

/** Apakah proses ini berjalan sebagai produksi. Dibaca per panggilan agar test dapat menimpanya. */
export function isProduksi(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Periksa satu nilai secret terhadap aturan produksi.
 *
 * Fungsi murni: tidak membaca `process.env` dan tidak melempar, supaya aturan
 * dapat diuji langsung dan pesan galat dapat disusun di satu tempat.
 */
export function periksaNilaiSecret(
  nama: NamaSecret,
  nilai: string | undefined,
): HasilPeriksaSecret {
  const bersih = nilai?.trim() ?? "";
  if (!bersih) return { ok: false, alasan: "kosong" };
  if (bersih === SECRET_DEV[nama]) {
    return { ok: false, alasan: "default_development" };
  }

  const hurufKecil = bersih.toLowerCase();
  if (
    NILAI_TEMPLATE.has(hurufKecil) ||
    PENANDA_TEMPLATE.some((penanda) => hurufKecil.includes(penanda))
  ) {
    return { ok: false, alasan: "placeholder" };
  }

  if (bersih.length < PANJANG_MINIMUM[nama]) {
    return { ok: false, alasan: "terlalu_pendek" };
  }

  return { ok: true };
}

/** Pesan galat untuk satu nama secret — menyebut nama dan alasan, bukan nilainya. */
function pesanTolak(nama: NamaSecret, alasan: AlasanTolak): string {
  const sebab =
    alasan === "kosong"
      ? "belum diisi"
      : alasan === "default_development"
        ? "memakai nilai dev yang dipublikasikan di repositori"
        : alasan === "placeholder"
          ? "menyerupai nilai template/dokumentasi"
          : `lebih pendek dari ${PANJANG_MINIMUM[nama]} karakter`;
  return `${nama} tidak valid untuk produksi: ${sebab}.`;
}

/**
 * Baca secret yang dipakai untuk menandatangani/memverifikasi.
 *
 * Di produksi, nilai yang tidak lolos `periksaNilaiSecret` melempar
 * `SecretConfigError`; pemanggil tidak pernah menerima nilai dev sebagai
 * gantinya. Di luar produksi, nilai dev dipakai bila env kosong — perilaku
 * lama dipertahankan supaya pengembangan lokal tidak butuh `.env`.
 */
export function bacaSecret(nama: NamaSecret): string {
  const nilai = process.env[nama];
  if (!isProduksi()) {
    return nilai?.trim() ? nilai.trim() : SECRET_DEV[nama];
  }

  const hasil = periksaNilaiSecret(nama, nilai);
  if (!hasil.ok) throw new SecretConfigError(pesanTolak(nama, hasil.alasan));
  return nilai!.trim();
}

/** Daftar nama secret yang diperiksa saat start, dalam urutan pesan galat. */
export const SECRET_WAJIB: readonly NamaSecret[] = [
  "SESSION_SECRET",
  "ATTESTATION_SECRET",
];

/**
 * Periksa **semua** secret wajib sekaligus lalu lempar bila ada yang gagal.
 *
 * Sengaja mengumpulkan seluruh pelanggaran, bukan berhenti di yang pertama:
 * operator yang memperbaiki satu env lalu mendapat galat berikutnya akan
 * mengulang siklus deploy. Di luar produksi fungsi ini tidak melempar.
 */
export function verifikasiKonfigurasiSecret(): void {
  if (!isProduksi()) return;

  const pelanggaran = SECRET_WAJIB.flatMap((nama) => {
    const hasil = periksaNilaiSecret(nama, process.env[nama]);
    return hasil.ok ? [] : [pesanTolak(nama, hasil.alasan)];
  });

  if (pelanggaran.length > 0) {
    throw new SecretConfigError(
      [
        "Konfigurasi secret produksi tidak valid; server menolak start.",
        ...pelanggaran,
        "Isi env dari secret manager dengan nilai acak (mis. `openssl rand -base64 48`).",
      ].join(" "),
    );
  }
}
