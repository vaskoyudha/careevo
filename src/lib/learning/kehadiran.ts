/**
 * Ringkasan kehadiran dari baris `learning_runs` — **murni**.
 *
 * Modul ini tidak menyentuh database, `node:fs`, maupun `next/headers`, dan
 * tidak memanggil `Date.now()` tanpa argumen: `now` selalu datang dari pemanggil.
 * Alasannya bukan kerapian. Aturan seperti "hari yang belum terjadi hari ini
 * belum memutus streak" adalah keputusan produk yang harus bisa diuji tanpa
 * PostgreSQL dan tanpa menunggu tengah malam, dan itulah bentuk yang diuji
 * `kehadiran.test.ts`.
 *
 * Yang dikunci di sini:
 *
 * - **Kehadiran adalah `completed`, bukan "run-nya ada".** Run `expired`
 *   tetap menyumbang jam belajar (peserta memakai sebagian jendela), tetapi
 *   tidak menghitung sebagai sesi hadir. Dua klaim berbeda, dan mencampurkannya
 *   membuat "saya hadir tapi lupa menutup" terlihat sama dengan "saya tidak
 *   datang".
 * - **Tanggal dihitung di satu zona waktu yang tetap.** "Hari" untuk seorang
 *   peserta adalah hari di kalender lokal, bukan hari UTC. Tanpa ini, sesi
 *   yang dimulai pukul 23:30 WIB terhitung sebagai kehadiran hari berikutnya.
 * - **Tanggal yang tidak bisa dibaca tidak dihitung sebagai hari ini.**
 *   `kunciHari` mengembalikan string kosong, dan string kosong tidak pernah
 *   sama dengan kunci hari mana pun — sehingga baris rusak tidak bisa dihitung
 *   sebagai kehadiran.
 *
 * Nama fungsi bisnis berbahasa Indonesia; konstanta dan nama tipe mengikuti
 * pola repo.
 */

/** Status run yang durasinya bisa dihitung. Sama dengan `STATUS_RUN`. */
export type StatusKehadiran = "active" | "completed" | "expired";

/**
 * Bentuk minimum satu baris `learning_runs` yang dibutuhkan ringkasan.
 *
 * Sengaja lebih sempit dari `LearningRun`: modul ini tidak butuh `userId`,
 * `courseId`, maupun `integrityVersion`, dan dengan tidak mengambilnya ia tidak
 * bisa diam-diam ikut membaca data yang tidak ada hubungannya dengan kehadiran.
 */
export interface BarisKehadiran {
  startedAt: Date;
  completedAt: Date | null;
  expiresAt: Date;
  state: StatusKehadiran;
}

export interface RingkasanKehadiran {
  /** Run yang mencapai `completed`. */
  sesiHadir: number;
  /** Total jam belajar dihitung dari durasi run, dua desimal. */
  jamEfektif: number;
  /** Hari berturut-turut dengan sesi hadir, dihitung ke belakang dari hari ini. */
  streakHari: number;
  /** Kunci `YYYY-MM-DD` dari setiap hari dengan sesi hadir, menaik. */
  hariAktif: string[];
}

/**
 * Zona waktu tempat "hari" dihitung.
 *
 * WIB, bukan UTC dan bukan zona browser. Kalau ini mengikuti zona waktu
 * peramban, angka streak dan jam yang sama akan berbeda tergantung di mana
 * peserta membuka halamannya — dan angka yang diskor tidak boleh begitu.
 */
export const ZONA_WAKTU_DEFAULT = "Asia/Jakarta";

const MS_PER_HARI = 86_400_000;

/**
 * Bentuk satu-satunya yang boleh keluar dari `kunciHari`.
 *
 * Dijaga karena `hitungStreak` mem-parsing kunci hasil `kunciHari` menjadi
 * bilangan hari: kunci yang tidak berbentuk ISO menghasilkan `NaN` di sana, dan
 * `NaN` akan melempar `RangeError` dari `toISOString()` — bukan gagal diam-diam.
 */
const POLA_HARI = /^\d{4}-\d{2}-\d{2}$/;

const formatter = new Map<string, Intl.DateTimeFormat>();

function formatterZona(zonaWaktu: string): Intl.DateTimeFormat {
  const ada = formatter.get(zonaWaktu);
  if (ada) return ada;
  // Locale di sini **tidak menentukan bentuk kunci**: `kunciHari` merakitnya dari
  // `formatToParts`, bukan dari `.format()`. Yang dipin dari locale hanya kalender
  // dan bentuk digit — `th-TH` memakai tahun Buddha, dan beberapa locale memakai
  // digit non-ASCII yang tidak bisa di-`Date.parse`.
  //
  // Bentuk `YYYY-MM-DD` juga tidak diminta dari locale: `id-ID` memberi
  // `27/09/2026`, yang tidak bisa dihitung sebagai selisih hari tanpa parsing ulang.
  const dibuat = new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaWaktu,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  formatter.set(zonaWaktu, dibuat);
  return dibuat;
}

/**
 * Kunci hari kalender `YYYY-MM-DD` untuk satu momen, di zona waktu tersebut.
 *
 * Kunci dirakit dari bagian `year`/`month`/`day` hasil `formatToParts`, bukan
 * dari `.format()`, sehingga bentuknya tidak bergantung pada pola tanggal locale
 * — hanya pada nilai bagiannya, yang numerik. Kalau rakitannya tetap tidak
 * berbentuk ISO, hasilnya string kosong, sama seperti tanggal yang tidak
 * terbaca: lebih baik tanpa kunci daripada kunci yang salah dan ikut menjadi
 * bagian `hariAktif` yang membuat `hitungStreak` melempar.
 */
export function kunciHari(tanggal: Date, zonaWaktu: string = ZONA_WAKTU_DEFAULT): string {
  if (!(tanggal instanceof Date) || !Number.isFinite(tanggal.getTime())) return "";
  const bagian = formatterZona(zonaWaktu).formatToParts(tanggal);
  const nilai = (jenis: string): string => bagian.find((b) => b.type === jenis)?.value ?? "";
  const kunci = `${nilai("year")}-${nilai("month")}-${nilai("day")}`;
  return POLA_HARI.test(kunci) ? kunci : "";
}

/** Kunci hari dari bilangan hari absolut sejak epoch UTC. */
function kunciDariNomor(nomor: number): string {
  return new Date(nomor * MS_PER_HARI).toISOString().slice(0, 10);
}

/** Bilangan hari absolut dari kunci `YYYY-MM-DD`. */
function nomorDariKunci(kunci: string): number {
  return Math.floor(Date.parse(`${kunci}T00:00:00.000Z`) / MS_PER_HARI);
}

/**
 * Durasi belajar satu run, dalam menit.
 *
 * Titik penutup mengikuti status run:
 * - `completed` → `min(completed_at, expires_at)`. `completed_at` adalah sumber
 *   durasi yang dipakai untuk skor, karena ia ditulis server saat run ditutup.
 *   Tapi `akhiriRun` tidak memeriksa `expires_at`, hanya `state = 'active'`, jadi
 *   kolom itu tidak boleh dipercaya melewati jendela.
 * - `expired` → `expires_at`. Peserta punya seluruh jendela itu. `completed_at`
 *   pada run `expired` berisi waktu **penyapu** menutupnya — selalu setelah
 *   kedaluwarsa — jadi mengukurnya akan menghitung waktu pesto, bukan belajar.
 * - `active` → `min(now, expires_at)`. Run yang masih hidup tidak boleh
 *   menambah jam setiap kali halaman dimuat.
 *
 * Hasilnya tidak pernah negatif dan tidak pernah melebihi jendela run: ketiga
 * cabang di atas dijepit oleh `expires_at` — atau oleh `now` untuk `active` —
 * dan `started_at` yang tidak terbaca menghasilkan 0.
 */
export function durasiMenit(run: BarisKehadiran, now: Date): number {
  const mulai = run.startedAt instanceof Date ? run.startedAt.getTime() : Number.NaN;
  if (!Number.isFinite(mulai)) return 0;

  const batas = run.expiresAt instanceof Date ? run.expiresAt.getTime() : Number.NaN;
  const nowMs = now instanceof Date ? now.getTime() : Number.NaN;

  let tutup: number;
  if (run.state === "completed") {
    const ditutup = run.completedAt instanceof Date ? run.completedAt.getTime() : Number.NaN;
    // Tanpa penjepit ini, run basi yang ditutup belakangan bisa membayarkan jam
    // tanpa batas, dan `jamEfektif` ikut masuk ke `hitungSkorJadwal`.
    // `expires_at` tidak terbaca → jatuh ke `completed_at` apa adanya, bukan nol.
    tutup =
      Number.isFinite(ditutup) && Number.isFinite(batas) ? Math.min(ditutup, batas) : ditutup;
  } else if (run.state === "expired") {
    tutup = batas;
  } else {
    // `batas` tidak bisa dibaca → jatuh ke `now`, bukan ke tak hingga.
    tutup = Number.isFinite(batas) ? Math.min(nowMs, batas) : nowMs;
  }

  if (!Number.isFinite(tutup)) return 0;
  return Math.max(0, (tutup - mulai) / 60_000);
}

/**
 * Hari berturut-turut dengan sesi hadir, dihitung ke belakang dari hari ini.
 *
 * **Ancangnya hari ini, atau Kemarin kalau hari ini belum ada.** Tanpa
 * toleransi ini, streak setiap peserta putus setiap pagi menjelang tengah
 * malam dan naik lagi di sore hari — angka yang naik turun karena sekarang,
 * bukan karena belajar. Break yang sebenarnya baru terjadi ketika satu hari
 * penuh berlalu tanpa sesi.
 */
export function hitungStreak(
  hariAktif: ReadonlySet<string>,
  now: Date,
  zonaWaktu: string = ZONA_WAKTU_DEFAULT,
): number {
  const hariIni = kunciHari(now, zonaWaktu);
  if (hariIni === "") return 0;

  const nomorHariIni = nomorDariKunci(hariIni);
  const kandidat = [nomorHariIni, nomorHariIni - 1];
  const awal = kandidat.find((n) => hariAktif.has(kunciDariNomor(n)));
  if (awal === undefined) return 0;

  let hitung = 0;
  let kursor = awal;
  while (hariAktif.has(kunciDariNomor(kursor))) {
    hitung += 1;
    kursor -= 1;
  }
  return hitung;
}

/**
 * Ringkasan kehadiran dari sekumpulan baris run.
 *
 * `jamEfektif` dibulatkan dua desimal supaya angka yang ditampilkan di UI dan
 * angka yang masuk ke `hitungSkorJadwal` berasal dari pembulatan yang sama.
 */
export function ringkasKehadiran(
  runs: readonly BarisKehadiran[],
  opsi: { now: Date; zonaWaktu?: string },
): RingkasanKehadiran {
  const zonaWaktu = opsi.zonaWaktu ?? ZONA_WAKTU_DEFAULT;

  const hari = new Set<string>();
  let sesiHadir = 0;
  let menitTotal = 0;

  for (const run of runs) {
    menitTotal += durasiMenit(run, opsi.now);
    if (run.state !== "completed") continue;
    // `sesiHadir` dihitung dari `state`, bukan dari tanggal: run `completed`
    // dengan `started_at` rusak tetap dihitung hadir — ia memang selesai —
    // tetapi tidak menyumbang kunci hari, jadi tidak berpengaruh apa pun selain
    // penghitung ini. Kegagalan baca tanggal membatalkan kalender, bukan
    // kehadiran; menitnya sudah nol karena `durasiMenit` menolak baris seperti ini.
    sesiHadir += 1;
    const kunci = kunciHari(run.startedAt, zonaWaktu);
    if (kunci !== "") hari.add(kunci);
  }

  const hariAktif = [...hari].sort();

  return {
    sesiHadir,
    jamEfektif: Math.round((menitTotal / 60) * 100) / 100,
    streakHari: hitungStreak(hari, opsi.now, zonaWaktu),
    hariAktif,
  };
}
