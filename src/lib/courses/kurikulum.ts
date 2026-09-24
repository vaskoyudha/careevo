/**
 * Kurikulum turunan untuk katalog kursus.
 *
 * Benih kursus (`Course`) dan resource fixture tidak menyimpan silabus per
 * modul — agar tetap fixture-backed, modul diturunkan secara deterministik
 * dari judul, tag, dan durasi. Fungsi di sini murni (tanpa cookie/IO)
 * sehingga mudah diuji.
 *
 * Sejak modul bisa disimpan sungguhan, resolver `modulUntuk()` /
 * `modulUntukSumber()` tinggal di `./modul-resolver` — modul server-only —
 * supaya bundel klien tidak ikut menarik `node:fs`. Fungsi murni di bawah tidak
 * dihapus karena cabang fallback inilah yang menjaga id modul lama tetap
 * stabil.
 */

// `import type` hilang saat kompilasi, jadi ini tidak menarik runtime apa pun
// ke bundel klien — aman dipakai di berkas yang juga diimpor komponen klien.
import type { CheckpointMateri, Halaman, Kuis, Materi } from "@/types/course";

export interface ModulKursus {
  id: string;
  judul: string;
  ringkasan: string;
  durasi_min: number;
  url: string;
  /**
   * Materi modul, hanya ada untuk modul tersimpan.
   *
   * Modul turunan selalu kosong: tidak ada materi nyata untuk ditampilkan, jadi
   * UI learner tetap memakai tautan `url` kursus seperti sebelumnya.
   */
  materi?: Materi[];
  /**
   * Halaman berformat modul, juga hanya ada untuk modul tersimpan.
   *
   * Modul turunan tidak punya halaman: isinya diturunkan dari metadata, bukan
   * ditulis admin, jadi tidak ada prosa yang bisa dihalaman-kan.
   */
  halaman?: Halaman[];
  /**
  /**
   * Kuis yang dipasang di modul ini — **sudah diresolusi**, bukan daftar id.
   *
   * `Modul.kuis` menyimpan id karena bank soal adalah sumber kebenarannya;
   * resolusi ke objek terjadi di `modul-resolver.ts`, yang punya akses ke
   * store. UI learner tidak boleh menyentuh store, jadi yang dibawanya adalah
   * hasil resolusi.
   */
  kuis?: Kuis[];
  /**
   * Aturan pengerjaan modul. Diteruskan dari modul tersimpan supaya gerbang
   * learner tidak diam-diam jatuh ke default ketika modul punya checkpoint
   * sendiri. Modul turunan tidak punya checkpoint.
   */
  checkpoint?: CheckpointMateri;
}

export interface SumberModul {
  id: string;
  title: string;
  tags: string[];
  duration_min: number;
  url: string;
}

/** Porsi durasi per modul: orientasi 10%, tiga modul inti 25% each, penutup 15%. */
const PORSI = [0.1, 0.25, 0.25, 0.25, 0.15];

function bagiDurasi(total: number): number[] {
  const aman = Number.isFinite(total) && total > 0 ? Math.floor(total) : 60;
  if (aman < PORSI.length * 5) {
    // Total terlalu kecil untuk porsi minimum 5 menit/modul: bagi rata.
    const dasar = Math.floor(aman / PORSI.length);
    const sisa = aman - dasar * PORSI.length;
    return PORSI.map((_, index) => dasar + (index < sisa ? 1 : 0));
  }
  const bagian = PORSI.map((porsi) => Math.max(5, Math.round(aman * porsi)));
  const selisih = aman - bagian.reduce((a, b) => a + b, 0);
  bagian[bagian.length - 1] = Math.max(0, bagian[bagian.length - 1] + selisih);
  return bagian;
}

/**
 * Turunkan 5 modul belajar dari metadata kursus/resource.
 * Deterministik: input sama selalu menghasilkan modul yang sama.
 */
export function modulKursus(sumber: SumberModul): ModulKursus[] {
  const durasi = bagiDurasi(sumber.duration_min);
  const tagInti = sumber.tags.slice(0, 3);

  const inti: Array<Pick<ModulKursus, "judul" | "ringkasan">> = tagInti.map((tag) => ({
    judul: `Mendalami ${tag}`,
    ringkasan: `Konsep inti, contoh terapan, dan latihan mandiri seputar ${tag} dalam konteks "${sumber.title}".`,
  }));

  while (inti.length < 3) {
    const kurang = 3 - inti.length;
    inti.push(
      kurang === 2
        ? {
            judul: "Praktik terbimbing",
            ringkasan: `Latihan langkah demi langkah mengikuti materi "${sumber.title}".`,
          }
        : {
            judul: "Review dan refleksi",
            ringkasan: "Rangkum pemahaman, catat pertanyaan, dan susun rencana latihan lanjutan.",
          },
    );
  }

  const semua: Array<Pick<ModulKursus, "judul" | "ringkasan">> = [
    {
      judul: "Orientasi dan peta konsep",
      ringkasan: `Gambaran besar "${sumber.title}": tujuan belajar, prasyarat, dan cara memakai materi.`,
    },
    ...inti,
    {
      judul: "Studi kasus dan penilaian akhir",
      ringkasan: "Terapkan seluruh materi pada satu studi kasus utuh, lalu nilai pemahamanmu.",
    },
  ];

  return semua.map((modul, index) => ({
    id: `${sumber.id}-m${index + 1}`,
    judul: modul.judul,
    ringkasan: modul.ringkasan,
    durasi_min: durasi[index],
    url: sumber.url,
  }));
}

/** Progres 0–100 (dibulatkan, dijepit) dari jumlah modul selesai. */
export function hitungProgres(jumlahSelesai: number, jumlahTotal: number): number {
  if (!Number.isFinite(jumlahTotal) || jumlahTotal <= 0) return 0;
  const persen = Math.round((jumlahSelesai / jumlahTotal) * 100);
  return Math.min(100, Math.max(0, persen));
}

/**
 * Saring id modul selesai ke yang benar-benar ada di kurikulum saat ini.
 * Mencegah progres menggelembung oleh id basi/palsu.
 */
export function irisModulSelesai(selesai: string[], modul: ModulKursus[]): string[] {
  const valid = new Set(modul.map((m) => m.id));
  return selesai.filter((id) => valid.has(id));
}
